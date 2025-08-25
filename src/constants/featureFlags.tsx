// src/constants/featureFlags.ts
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type Flags = {
  enableDeepLinks: boolean;
  enableShareCards: boolean;
  enableStartFirstFlow: boolean;
  enableDuoLeaderboard: boolean;
  premium: boolean; // Masquer pubs, etc.
};

const DEFAULT_FLAGS: Flags = {
  enableDeepLinks: true,
  enableShareCards: true,
  enableStartFirstFlow: true,
  enableDuoLeaderboard: true,
  premium: false,
};

type Ctx = { flags: Flags; isReady: boolean };
const FeatureFlagsContext = createContext<Ctx>({ flags: DEFAULT_FLAGS, isReady: false });

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // ⚠️ Assure-toi d’avoir le document Firestore: collection "meta", document "flags"
    // Chemin: meta/flags  (pas une collection "flags" seule)
    const ref = doc(db, "meta", "flags");

    // 1) lecture initiale
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<Flags>;
          setFlags((prev) => ({ ...prev, ...data }));
        }
        setIsReady(true);
      })
      .catch(() => setIsReady(true));

    // 2) écoute temps réel
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<Flags>;
        setFlags((prev) => ({ ...prev, ...data }));
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(() => ({ flags, isReady }), [flags, isReady]);
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export const useFlags = () => useContext(FeatureFlagsContext);
