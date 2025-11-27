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
    const ref = doc(db, "meta", "flags");

    let unsub: (() => void) | null = null;
    let alive = true;

    const failsafe = setTimeout(() => {
      if (alive) setIsReady(true);
    }, 1500);

    (async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as Partial<Flags>;
          setFlags((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // ignore
      } finally {
        if (alive) setIsReady(true);
      }
    })();

    try {
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<Flags>;
          setFlags((prev) => ({ ...prev, ...data }));
        }
      });
    } catch {}

    return () => {
      alive = false;
      clearTimeout(failsafe);
      unsub?.();
    };
  }, []);

  const value = useMemo(() => ({ flags, isReady }), [flags, isReady]);
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};


export const useFlags = () => useContext(FeatureFlagsContext);
