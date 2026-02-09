// src/context/AdsVisibilityContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";
import { useAuth } from "../../context/AuthProvider";
import { usePathname } from "expo-router";
import { usePremium } from "../../src/context/PremiumContext";

const ADMIN_UIDS = new Set<string>([
  "GiN2yTfA7NWISeb4QjXmDPq5TgK2",
]);

// 🔥 IMPORTANT TEMPORAIRE :
// Tant que tu es en internal testing / closed testing,
// on force l’affichage des pubs, même si consent / flags pas OK.
// Quand tu passes en vraie prod publique, remets à false.
const FORCE_SHOW_ADS_FOR_TESTING = false;

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
  const { user } = useAuth();
  const pathname = usePathname();
  const { isPremiumUser, loading: premiumLoading } = usePremium();
const isPremium = isPremiumUser === true;

  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);

  // Lecture initiale
  const [adsReady, setAdsReady] = useState(
    (globalThis as any).__ADS_READY__ === true
  );
  const [canRequestAds, setCanRequestAds] = useState(
    (globalThis as any).__CAN_REQUEST_ADS__ !== false
  );

  // Polling léger boot — sans log
  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const r = (globalThis as any).__ADS_READY__ === true;
      const c = (globalThis as any).__CAN_REQUEST_ADS__ !== false;

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
  const adsAllowed = canRequestAds && !isAuthRoute;

  // ✅ FAIL-SAFE: tant qu’on ne sait pas encore, on n’affiche pas bannières/interstitiels
  // (sinon un premium voit des pubs, ce qui est inacceptable)
  if (premiumLoading) {
    return {
      showBanners: false,
      showInterstitials: false,
      showRewarded: adsAllowed, // rewarded OK si tu veux, sinon false aussi
      isAdmin,
      isPremium: false, // inconnu pour l’instant, mais on protège l’UX
    };
  }

  const isPremium = isPremiumUser === true;
  const hideAds = isAdmin || isPremium;

  if (FORCE_SHOW_ADS_FOR_TESTING) {
    return {
      showBanners: !isAuthRoute && !hideAds,
      showInterstitials: !isAuthRoute && !hideAds,
      showRewarded: !isAuthRoute,
      isAdmin,
      isPremium,
    };
  }

  const bannersUnlocked = (__DEV__ ? adsReady : true) && adsAllowed;
  const rewardedUnlocked = adsAllowed;
  const interUnlocked = adsAllowed;

  return {
    showBanners: bannersUnlocked && !hideAds,
    showInterstitials: interUnlocked && !hideAds,
    showRewarded: rewardedUnlocked,
    isAdmin,
    isPremium,
  };
}, [
  adsReady,
  canRequestAds,
  isAuthRoute,
  isAdmin,
  isPremiumUser,
  premiumLoading,
]);



  return (
    <AdsVisibilityContext.Provider value={value}>
      {children}
    </AdsVisibilityContext.Provider>
  );
};

export const useAdsVisibility = () => useContext(AdsVisibilityContext);
