import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";

type PremiumCtx = {
  isPremiumUser: boolean;     // premium calculé par USER (admin inclus)
  loading: boolean;
};

const PremiumContext = createContext<PremiumCtx>({ isPremiumUser: false, loading: true });

/**
 * Admin => premium automatique
 * User => premium si users/{uid}.premium === true
 */
const ADMIN_UID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2"; // garde-le en phase avec tes règles Firestore

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // écoute auth
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setIsPremiumUser(false);
        setLoading(false);
        return;
      }

      // Admin = premium automatique
      if (u.uid === ADMIN_UID) {
        setIsPremiumUser(true);
        setLoading(false);
        return;
      }

      // écoute temps réel du document user
      const userRef = doc(db, "users", u.uid);
      const unsubUser = onSnapshot(
        userRef,
        (snap) => {
          const premium = (snap.exists() && (snap.data() as any)?.premium) === true;
          setIsPremiumUser(premium);
          setLoading(false);
        },
        () => {
          // en cas d’erreur de lecture user -> pas premium
          setIsPremiumUser(false);
          setLoading(false);
        }
      );

      return () => unsubUser();
    });

    return () => unsubAuth();
  }, []);

  const value = useMemo(() => ({ isPremiumUser, loading }), [isPremiumUser, loading]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};

export const usePremium = () => useContext(PremiumContext);
