import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config"; 

type PremiumCtx = {
  /** true si l'utilisateur est premium (admin, abo, ou premium temporaire actif) */
  isPremiumUser: boolean;
  /** true tant qu'on ne sait pas encore si l'user est premium */
  loading: boolean;
};

const PremiumContext = createContext<PremiumCtx>({
  isPremiumUser: false,
  loading: true,
});

/**
 * Admin => premium automatique
 * User => premium si :
 *  - users/{uid}.isPremium === true  (abo "classique")
 *  - users/{uid}.premium === true   (compat historique)
 *  - users/{uid}.premium.tempPremiumUntil > now (essai temporaire actif)
 */
const ADMIN_UID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2"; // garde-le en phase avec tes règles Firestore

type PremiumField =
  | boolean
  | {
      isPremium?: boolean;
      premium?: boolean;
      isSubscribed?: boolean;
      isLifetime?: boolean;
      tempPremiumUntil?: string | Date | Timestamp | null;
    };

const getExpireMs = (raw: any): number | null => {
  if (!raw) return null;
  if (raw instanceof Date) return raw.getTime();
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const hasTempPremiumActive = (premiumObj: any): boolean => {
  if (!premiumObj || typeof premiumObj !== "object") return false;

  const expireMs = getExpireMs(premiumObj.tempPremiumUntil);

  if (!expireMs) return false;
  return expireMs > Date.now();
};

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let userUnsub: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // On reset le listener user à chaque changement d'auth
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (!user) {
        setIsPremiumUser(false);
        setLoading(false);
        return;
      }

      // ⭐ Admin = premium auto
      if (user.uid === ADMIN_UID) {
        setIsPremiumUser(true);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);

      setLoading(true);

      userUnsub = onSnapshot(
  userRef,
  (snap) => {
    const data = snap.exists() ? (snap.data() as any) : {};

    const premiumField: PremiumField = data.premium;

// ⚠️ logs uniquement dev (sinon ça te flingue le boot en prod)
          if (__DEV__) {
             console.log("[PremiumContext] premiumField =", premiumField);
             console.log("[PremiumContext] isPremium =", data.isPremium, "premium=", data.premium);
          }


    // ✅ premium object safe
          const premiumObj =
            premiumField && typeof premiumField === "object" ? premiumField : null;

          // 1) Flags "simples" / historiques (bool ONLY)
          const hasLegacyFlag =
            data.isPremium === true ||
            premiumField === true ||
            data.premium === true;

          // 1bis) Flags dans premium object (comme ailleurs dans ton app)
          const hasPremiumObjectFlag =
            premiumObj?.isPremium === true ||
            premiumObj?.premium === true ||
            premiumObj?.isSubscribed === true ||
            premiumObj?.isLifetime === true;

    // 2) Premium temporaire (support aussi anciens schémas)
          const expireMsFromObj = premiumObj ? getExpireMs(premiumObj.tempPremiumUntil) : null;
          const expireMsFromRoot = getExpireMs(data.tempPremiumUntil) ?? getExpireMs(data.premiumUntil);

          const expireMs = expireMsFromObj ?? expireMsFromRoot;
          const hasTempPremium = typeof expireMs === "number" ? expireMs > Date.now() : false;

    const nextIsPremium = hasLegacyFlag || hasPremiumObjectFlag || hasTempPremium;

    setIsPremiumUser(nextIsPremium);
    setLoading(false);
  },
  (err) => {
    console.warn("Premium snapshot error:", err);
    setIsPremiumUser(false);
    setLoading(false);
  }
);

    });

    return () => {
      unsubAuth();
      if (userUnsub) {
        userUnsub();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      isPremiumUser,
      loading,
    }),
    [isPremiumUser, loading]
  );

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => useContext(PremiumContext);
