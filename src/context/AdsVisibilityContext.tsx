import React, { createContext, useContext, useMemo } from "react";
import { useFlags } from "../constants/featureFlags";
import { useAuth } from "../../context/AuthProvider";

// ✅ Liste des UID admin (mets-y le tien, tu peux en mettre plusieurs)
const ADMIN_UIDS = new Set<string>([
  "GiN2yTfA7NWISeb4QjXmDPq5TgK2", // <- remplace/ajoute si besoin
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
  showRewarded: true,
  isAdmin: false,
  isPremium: false,
});

export const AdsVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { flags } = useFlags();          // premium vient des feature flags (meta/flags)
  const { user } = useAuth();            // utilisateur courant
  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);
  const isPremium = !!flags.premium;

  // - Admin ou Premium => pas de bannières, pas d’interstitiels
  // - Rewarded => toujours autorisées (choix utilisateur)
  const value = useMemo<AdsVisibility>(() => {
    const hideAllNonRewarded = isAdmin || isPremium;
    return {
      showBanners: !hideAllNonRewarded,
      showInterstitials: !hideAllNonRewarded,
      showRewarded: true,
      isAdmin,
      isPremium,
    };
  }, [isAdmin, isPremium]);

  return (
    <AdsVisibilityContext.Provider value={value}>
      {children}
    </AdsVisibilityContext.Provider>
  );
};

export const useAdsVisibility = () => useContext(AdsVisibilityContext);
