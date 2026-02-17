import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

type TFn = (key: string, opts?: any) => string;

type Args = {
  showBanners: boolean;
  completionModalVisible: boolean;
  t: TFn;
  onClaim: () => Promise<void> | void;
};

export function useRewardedDetailsAd({
  showBanners,
  completionModalVisible,
  t,
  onClaim,
}: Args) {
  const rewardedRef = useRef<RewardedAd | null>(null);
  const rewardedEarnedRef = useRef(false);

  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  const [rewardedLoading, setRewardedLoading] = useState(false);
  const [rewardedShowing, setRewardedShowing] = useState(false);

  // ✅ AdUnit stable + PROD ready (exactement comme ton screen)
  const REWARDED_UNIT_ID = useMemo(() => {
    const prod =
      (process.env.EXPO_PUBLIC_ADMOB_REWARDED_DETAILS as string | undefined) ||
      (process.env.EXPO_PUBLIC_ADMOB_REWARDED as string | undefined) ||
      "";
    return __DEV__ ? TestIds.REWARDED : (prod || TestIds.REWARDED);
  }, []);

  const ensureRewardedInstance = useCallback(() => {
    if (rewardedRef.current) return rewardedRef.current;
    const ad = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    rewardedRef.current = ad;
    return ad;
  }, [REWARDED_UNIT_ID]);

  const loadRewarded = useCallback(() => {
    if (!showBanners) return;
    if (rewardedLoaded || rewardedLoading) return;

    const ad = ensureRewardedInstance();
    rewardedEarnedRef.current = false;
    setRewardedLoading(true);

    try {
      ad.load();
    } catch {
      setRewardedLoading(false);
    }
  }, [ensureRewardedInstance, rewardedLoaded, rewardedLoading, showBanners]);

  // ✅ cleanup hard (évite instances fantômes)
  useEffect(() => {
    return () => {
      rewardedRef.current = null;
      rewardedEarnedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showBanners) {
      // ✅ reset clean si ads off
      setRewardedLoaded(false);
      setRewardedLoading(false);
      setRewardedShowing(false);
      rewardedEarnedRef.current = false;
      return;
    }

    const ad = ensureRewardedInstance();

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedLoaded(true);
      setRewardedLoading(false);
    });

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardedEarnedRef.current = true;
      }
    );

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);

      // ✅ claim UNIQUEMENT si reward gagné
      if (rewardedEarnedRef.current) {
        rewardedEarnedRef.current = false;
        Promise.resolve(onClaim()).catch(() => {});
      }

      // preload next
      requestAnimationFrame(() => {
        try {
          ad.load();
        } catch {}
      });
    });

    const unsubErr = ad.addAdEventListener(AdEventType.ERROR, () => {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);
      rewardedEarnedRef.current = false;

      // retry soft
      setTimeout(() => {
        try {
          ad.load();
        } catch {}
      }, 900);
    });

    // preload initial
    try {
      ad.load();
    } catch {}

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubErr();
    };
  }, [ensureRewardedInstance, onClaim, showBanners]);

  // quand le modal s'ouvre => on s'assure que c'est preload
  useEffect(() => {
    if (!completionModalVisible) return;
    loadRewarded();
  }, [completionModalVisible, loadRewarded]);

  const showRewarded = useCallback(async () => {
    if (!showBanners) {
      // Ads off -> fallback direct
      await Promise.resolve(onClaim());
      return;
    }

    const ad = ensureRewardedInstance();
    rewardedEarnedRef.current = false;

    // pas prêt ? on tente load + UX identique
    if (!rewardedLoaded) {
      loadRewarded();
      Alert.alert(
        t("commonS.loading", { defaultValue: "Chargement…" }),
        t("commonS.tryAgainInSeconds", {
          defaultValue: "La vidéo se prépare. Réessaie dans quelques secondes.",
        })
      );
      return;
    }

    try {
      setRewardedShowing(true);
      await ad.show();
    } catch {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);
      rewardedEarnedRef.current = false;

      loadRewarded();
      Alert.alert(
        t("alerts.error"),
        t("adsS.rewardedFailed", {
          defaultValue: "La vidéo n’a pas pu se lancer.",
        })
      );
    }
  }, [ensureRewardedInstance, loadRewarded, onClaim, rewardedLoaded, showBanners, t]);

  return {
    rewardedLoaded,
    rewardedLoading,
    rewardedShowing,
    loadRewarded,
    showRewarded,
    rewardedAdUnitId: REWARDED_UNIT_ID,
  };
}
