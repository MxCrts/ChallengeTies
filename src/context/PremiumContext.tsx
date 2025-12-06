import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
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
      tempPremiumUntil?: string | Date | Timestamp | null;
    };

const hasTempPremiumActive = (premium: PremiumField): boolean => {
  if (!premium || typeof premium !== "object") return false;

  const raw = premium.tempPremiumUntil;

  let expireMs: number | null = null;

  if (raw instanceof Date) {
    expireMs = raw.getTime();
  } else if (raw instanceof Timestamp) {
    expireMs = raw.toMillis();
  } else if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    expireMs = Number.isNaN(parsed) ? null : parsed;
  }

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

          // 1) Flags "simples" / historiques
          const hasLegacyFlag =
            data.isPremium === true || premiumField === true;

          // 2) Premium temporaire ou structuré (objet avec tempPremiumUntil)
          const hasTempPremium = hasTempPremiumActive(premiumField);

          const nextIsPremium = hasLegacyFlag || hasTempPremium;

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
