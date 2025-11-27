// src/context/AdsVisibilityContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";
import { useFlags } from "../constants/featureFlags";
import { useAuth } from "../../context/AuthProvider";
import { usePathname } from "expo-router";
import { usePremium } from "../../src/context/PremiumContext";

const ADMIN_UIDS = new Set<string>([
  "GiN2yTfA7NWISeb4QjXmDPq5TgK2",
]);

type AdsVisibility = {
  showBanners: boolean;
  showInterstitials: boolean;
  showRewarded: boolean;
  isAdmin: boolean;
  isPremium: boolean;
};

const AdsVisibilityContext = createContext<AdsVisibility>({
  showBanners: false,
  showInterstitials: false,
  showRewarded: false,
  isAdmin: false,
  isPremium: false,
});

export const AdsVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { flags } = useFlags();
  const { user } = useAuth();
  const pathname = usePathname();
  const { isPremiumUser } = usePremium();

  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);
  const isPremium = !!isPremiumUser;

  // Lecture initiale
  const [adsReady, setAdsReady] = useState(
    (globalThis as any).__ADS_READY__ === true
  );
  const [canRequestAds, setCanRequestAds] = useState(
    (globalThis as any).__CAN_REQUEST_ADS__ !== false
  );

  // Polling léger boot — MAIS sans aucun log
  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const r = (globalThis as any).__ADS_READY__ === true;
      const c = (globalThis as any).__CAN_REQUEST_ADS__ !== false;

      // setState uniquement si changement réel
      setAdsReady((prev) => (prev !== r ? r : prev));
      setCanRequestAds((prev) => (prev !== c ? c : prev));

      if (r && c) clearInterval(id);
    };

    const id = setInterval(tick, 500);
    tick();

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  const value = useMemo<AdsVisibility>(() => {
    // tant que pas prêt → pubs masquées
    if (!adsReady || !canRequestAds || isAuthRoute) {
      return {
        showBanners: false,
        showInterstitials: false,
        showRewarded: false,
        isAdmin,
        isPremium,
      };
    }

    // admin ou premium → rien
    const hideAll = isAdmin || isPremium;

    return {
      showBanners: !hideAll,
      showInterstitials: !hideAll,
      showRewarded: !hideAll,
      isAdmin,
      isPremium,
    };
  }, [
    adsReady,
    canRequestAds,
    isAuthRoute,
    isAdmin,
    isPremium,
    pathname,
    flags, // garde si tu changes flags live
  ]);

  return (
    <AdsVisibilityContext.Provider value={value}>
      {children}
    </AdsVisibilityContext.Provider>
  );
};

export const useAdsVisibility = () => useContext(AdsVisibilityContext);
