import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";

type PremiumCtx = {
  isPremiumUser: boolean; // premium calculé (admin inclus)
  loading: boolean;
};

const PremiumContext = createContext<PremiumCtx>({
  isPremiumUser: false,
  loading: true,
});

/**
 * Admin => premium automatique
 * User => premium si users/{uid}.isPremium === true
 */
const ADMIN_UID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2"; // garde-le en phase avec tes règles Firestore

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
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

      // ⭐ Listener Firestore temps réel
      const userRef = doc(db, "users", user.uid);
      const unsubUser = onSnapshot(
        userRef,
        (snap) => {
          const data = snap.exists() ? (snap.data() as any) : {};

          // Support total des deux clés : premium & isPremium
          const premiumFlag =
            data.premium === true || data.isPremium === true;

         setIsPremiumUser(premiumFlag);
         setLoading(false);
       },
       (err) => {
         console.warn("Premium snapshot error:", err);
          setIsPremiumUser(false);
          setLoading(false);
        }
      );

      return () => unsubUser();
    });

    return () => unsubAuth();
  }, []);

  const value = useMemo(
    () => ({
      isPremiumUser,
      loading,
    }),
    [isPremiumUser, loading]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};

export const usePremium = () => useContext(PremiumContext);
