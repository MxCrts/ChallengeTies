import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";

type UseRewardedGateOpts = {
  adUnitId: string;
  npa?: boolean; // non-personalized ads
};

type UseRewardedGateReturn = {
  ready: boolean;
  loading: boolean;
  showAndWaitReward: () => Promise<boolean>;
  reload: () => void;
};

/**
 * Rewarded gate robuste pour modals / contexts :
 * - instance stable
 * - listeners gérés proprement
 * - reload auto après close
 * - show() -> attend reward (EARNED_REWARD) puis CLOSED
 */
export default function useRewardedGate({
  adUnitId,
  npa = true,
}: UseRewardedGateOpts): UseRewardedGateReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ instance stable
  const ad = useMemo(
    () =>
      RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: npa,
      }),
    [adUnitId, npa]
  );

  // évite les setState après unmount
  const mountedRef = useRef(true);

  const reload = useCallback(() => {
    try {
      setLoading(true);
      setReady(false);
      ad.load();
    } catch {
      setLoading(false);
      setReady(false);
    }
  }, [ad]);

  useEffect(() => {
    mountedRef.current = true;

    setLoading(true);

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (!mountedRef.current) return;
      setReady(true);
      setLoading(false);
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (!mountedRef.current) return;
      setReady(false);
      setLoading(false);
    });

    // ✅ reload automatique après fermeture
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (!mountedRef.current) return;
      setReady(false);
      setLoading(true);
      ad.load();
    });

    // premier load
    ad.load();

    return () => {
      mountedRef.current = false;
      unsubLoaded();
      unsubError();
      unsubClosed();
    };
  }, [ad]);

  const showAndWaitReward = useCallback(async (): Promise<boolean> => {
    if (!ready) return false;

    try {
      const earned = await new Promise<boolean>((resolve) => {
        let gotReward = false;

        const unsubEarned = ad.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            gotReward = true;
          }
        );

        const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          unsubEarned();
          unsubClosed();
          resolve(gotReward);
        });

        ad.show().catch(() => {
          unsubEarned();
          unsubClosed();
          resolve(false);
        });
      });

      return earned;
    } catch {
      return false;
    }
  }, [ad, ready]);

  return { ready, loading, showAndWaitReward, reload };
}
