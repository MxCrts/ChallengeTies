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
    const hideAll = isAdmin || (!premiumLoading && isPremium);
    const adsAllowed = canRequestAds && !isAuthRoute;

    // 🔓 MODE TEST : on ignore adsReady / canRequestAds,
    // mais on respecte TOUJOURS admin / premium.
    if (FORCE_SHOW_ADS_FOR_TESTING) {
      return {
        showBanners: !isAuthRoute && !hideAll,
        showInterstitials: !isAuthRoute && !hideAll,
        showRewarded: !isAuthRoute && !hideAll,
        isAdmin,
        isPremium,
      };
    }

    // ✅ IMPORTANT:
    // - banners: on peut garder un gate "ready" en dev pour éviter les blancs
    // - rewarded/interstitials: NE DOIVENT PAS être bloquées par adsReady, sinon elles ne se chargent jamais
    const bannersUnlocked = (__DEV__ ? adsReady : true) && adsAllowed;
    const rewardedUnlocked = adsAllowed;      // se charge en arrière-plan, show() seulement quand prêt
    const interUnlocked = adsAllowed;  

    // admin ou premium → pas de pubs
    return {
      showBanners: bannersUnlocked && !hideAll,
      showInterstitials: interUnlocked && !hideAll,
      showRewarded: rewardedUnlocked && !hideAll,
      isAdmin,
      isPremium,
    };
  }, [
    adsReady,
    canRequestAds,
    isAuthRoute,
    isAdmin,
    isPremium,
    premiumLoading,
  ]);


  return (
    <AdsVisibilityContext.Provider value={value}>
      {children}
    </AdsVisibilityContext.Provider>
  );
};

export const useAdsVisibility = () => useContext(AdsVisibilityContext);
