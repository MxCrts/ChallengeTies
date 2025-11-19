// src/context/AdsVisibilityContext.tsx
import React, { createContext, useContext, useMemo } from "react";
import { useFlags } from "../constants/featureFlags";
import { useAuth } from "../../context/AuthProvider";
import { usePathname } from "expo-router";
import { usePremium } from "../../src/context/PremiumContext";

const ADMIN_UIDS = new Set<string>([
  "GiN2yTfA7NWISeb4QjXmDPq5TgK2", // UID admin
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

  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);
  const { isPremiumUser } = usePremium();
  const isPremium = !!isPremiumUser;

  const adsReady = (globalThis as any).__ADS_READY__ === true;
  const canRequestAds = (globalThis as any).__CAN_REQUEST_ADS__ !== false;

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  const value = useMemo<AdsVisibility>(() => {
    // Tant que le SDK n’est pas prêt OU Google n’autorise pas la requête → tout masqué
    if (!adsReady || !canRequestAds) {
      __DEV__ &&
        console.log("[AdsVisibility] ads not ready or disallowed → hide ALL", {
          adsReady,
          canRequestAds,
        });
      return {
        showBanners: false,
        showInterstitials: false,
        showRewarded: false,
        isAdmin,
        isPremium,
      };
    }

    // Routes d’auth → on masque tout
    if (isAuthRoute) {
      __DEV__ && console.log("[AdsVisibility] auth route → hide ALL ads");
      return {
        showBanners: false,
        showInterstitials: false,
        showRewarded: false,
        isAdmin,
        isPremium,
      };
    }

    // Admin ou Premium → aucune pub du tout (bannière, interstitiel, rewarded)
    const hideAll = isAdmin || isPremium;

    const computed = {
      showBanners: !hideAll,
      showInterstitials: !hideAll,
      showRewarded: !hideAll,
      isAdmin,
      isPremium,
    };

    __DEV__ &&
      console.log("[AdsVisibility] ✅ computed", {
        pathname,
        adsReady,
        canRequestAds,
        ...computed,
      });

    return computed;
  }, [adsReady, canRequestAds, isAuthRoute, isAdmin, isPremium, pathname]);

  return (
    <AdsVisibilityContext.Provider value={value}>
      {children}
    </AdsVisibilityContext.Provider>
  );
};

export const useAdsVisibility = () => useContext(AdsVisibilityContext);
