import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  AccessibilityInfo,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import { doc, onSnapshot, getDoc  } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  useTrophiesEconomy,
  coerceToDayKey,
  dayKeyUTC,
} from "../hooks/useTrophiesEconomy";
import { rewardedAdsService } from "../services/rewardedAdsService";

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const baseReward = 5;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const motivationalPhrases = [
  "completion.youAreAwesome",
  "completion.keepItUp",
  "completion.successIsYours",
  "completion.everyEffortCounts",
  "completion.neverGiveUp",
  "completion.youAreOnTrack",
  "completion.excellenceAwaits",
  "completion.headHeldHigh",
  "completion.persistencePays",
  "completion.challengesMakeYouStronger",
];

type Props = {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  onClose: () => void;
  canShowRewarded?: boolean;        // feature flag / entitlement
  rewardedReady?: boolean;          // ad loaded
  rewardedLoading?: boolean;        // ad is loading
  onPreloadRewarded?: () => void;   // parent loads
  onShowRewarded?: () => Promise<boolean>;
  /**
   * ✅ Recommandé : si fourni, le modal gère la rewarded en autonome (singleton).
   * Sinon -> fallback sur rewardedReady/onShowRewarded (comme avant).
   */
  rewardedAdUnitId?: string;
};

const VIDEO_ZOOM = Platform.OS === "android" ? 1.05 : 1.14;
const VIDEO_SHIFT_Y = Platform.OS === "android" ? -10 : -8; // ajuste à l’œil
const VIDEO_SHIFT_X = 0;

const ANDROID_HAIRLINE = Platform.OS === "android" ? 1 : StyleSheet.hairlineWidth;

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function ChallengeCompletionModal({
  visible,
  challengeId,
  selectedDays,
  onClose,
  canShowRewarded = true,
  rewardedReady = false,
  rewardedLoading = false,
  onPreloadRewarded,
  onShowRewarded,
  rewardedAdUnitId,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const IS_TINY = W < 360;
  const IS_TABLET = W >= 768;

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const { completeChallenge, currentChallenges } = useCurrentChallenges();
  const { computeChallengeTrophies } = useTrophiesEconomy();

  // Mounted guard (avoid setState after unmount)
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Responsive scale (Apple-like)
  const scale = useMemo(() => {
    const base = 390; // iPhone 14-ish
    const s = W / base;
    return clamp01(lerp(0.92, 1.18, clamp01((s - 0.9) / 0.6)));
  }, [W]);

  const phraseKey = useMemo(() => pick(motivationalPhrases), [visible]); // refresh per open

  // Reduce motion
  const [reduceMotion, setReduceMotion] = useState(false);

  // User trophies listener (header info)
  const [userTrophies, setUserTrophies] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  // Duo: partner finish key (for exact compute)
  const [partnerFinishKey, setPartnerFinishKey] = useState<string | null>(null);

  // Video fallback
  const videoRef = useRef<Video>(null);
  const [videoOk, setVideoOk] = useState(true);

  // Busy guard
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Navigation guard
  const didNavRef = useRef(false);
  const crownLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // ✅ Rewarded local state (autonome)
  const [adReadyLocal, setAdReadyLocal] = useState(false);
  const [adLoadingLocal, setAdLoadingLocal] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  /* ------------------------------ Anim values ----------------------------- */

  const scrim = useRef(new Animated.Value(0)).current; // 0..1
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardLift = useRef(new Animated.Value(18)).current;

  const halo = useRef(new Animated.Value(0)).current; // 0..1
  const ring = useRef(new Animated.Value(0)).current; // 0..1
  const spark = useRef(new Animated.Value(0)).current; // 0..1 burst
  const sheen = useRef(new Animated.Value(0)).current; // 0..1 sweep
  const crown = useRef(new Animated.Value(0)).current; // 0..1 small micro pulse
  const videoFade = useRef(new Animated.Value(0)).current;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimers = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const resetAnim = useCallback(() => {
    stopTimers();
    scrim.stopAnimation();
    cardOpacity.stopAnimation();
    cardScale.stopAnimation();
    cardLift.stopAnimation();
    halo.stopAnimation();
    ring.stopAnimation();
    spark.stopAnimation();
    sheen.stopAnimation();
    crown.stopAnimation();
    videoFade.stopAnimation();
    // stop loop if any
    try {
      crownLoopRef.current?.stop?.();
    } catch {}
    crownLoopRef.current = null;

    scrim.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.92);
    cardLift.setValue(18);
    halo.setValue(0);
    ring.setValue(0);
    spark.setValue(0);
    sheen.setValue(0);
    crown.setValue(0);
    videoFade.setValue(0);
  }, [scrim, cardOpacity, cardScale, cardLift, halo, ring, spark, sheen, crown, videoFade]);

  /* --------------------------- Accessibility hook -------------------------- */

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReduceMotion(!!v));
    return () => {
      mounted = false;
      // @ts-ignore compat
      sub?.remove?.();
    };
  }, []);

  /* ----------------------------- Firestore user ---------------------------- */

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      setUserTrophies(d.trophies || 0);
      setLongestStreak(Number(d.longestStreak || 0));
    });
    return () => unsub();
  }, []);

  // When modal opens: resolve partnerFinishKey if this completion is DUO
  useEffect(() => {
    if (!visible) return;

    const ch = currentChallenges.find((x: any) => {
      const cid = x?.challengeId ?? x?.id;
      return String(cid) === String(challengeId) && Number(x?.selectedDays) === Number(selectedDays);
    });

    const partnerId = (ch as any)?.duoPartnerId as string | undefined;
    const canonicalKey = (ch as any)?.uniqueKey as string | undefined;

    if (!partnerId || !canonicalKey) {
      setPartnerFinishKey(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pRef = doc(db, "users", partnerId);
        const pSnap = await getDoc(pRef);
        if (cancelled) return;
        if (!pSnap.exists()) {
          setPartnerFinishKey(null);
          return;
        }
        const pData = pSnap.data() as any;
        const list = Array.isArray(pData.CurrentChallenges) ? pData.CurrentChallenges : [];
        const p = list.find((c: any) => c?.uniqueKey === canonicalKey);
        const pKeys: string[] =
          (p as any)?.completionDateKeys ??
          (p?.completionDates || []).map(coerceToDayKey).filter(Boolean);
        setPartnerFinishKey(pKeys?.length ? pKeys[pKeys.length - 1] : null);
      } catch {
        if (!cancelled) setPartnerFinishKey(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, currentChallenges, challengeId, selectedDays]);

  // ✅ True reward totals (must match completeChallenge() computeChallengeTrophies)
  const rewardTotals = useMemo(() => {
    const ch = currentChallenges.find((x: any) => {
      const cid = x?.challengeId ?? x?.id;
      return String(cid) === String(challengeId) && Number(x?.selectedDays) === Number(selectedDays);
    });

    const myKeys: string[] =
      (ch as any)?.completionDateKeys ??
      ((ch as any)?.completionDates || []).map(coerceToDayKey).filter(Boolean);

    const keysSorted = Array.from(new Set(myKeys)).sort();
    const myFinishKey =
      keysSorted.length ? keysSorted[keysSorted.length - 1] : dayKeyUTC(new Date());

    const isDuo = !!(ch as any)?.duo && !!partnerFinishKey;

    const base = computeChallengeTrophies({
      selectedDays,
      completionKeys: keysSorted,
      myFinishKey,
      partnerFinishKey,
      isDuo,
      isDoubleReward: false,
      longestStreak,
    }).total;

    const dbl = computeChallengeTrophies({
      selectedDays,
      completionKeys: keysSorted,
      myFinishKey,
      partnerFinishKey,
      isDuo,
      isDoubleReward: true,
      longestStreak,
    }).total;

    return {
      base: Number.isFinite(base) ? Math.max(0, Math.round(base)) : 0,
      dbl: Number.isFinite(dbl) ? Math.max(0, Math.round(dbl)) : 0,
    };
  }, [
    currentChallenges,
    challengeId,
    selectedDays,
    partnerFinishKey,
    longestStreak,
    computeChallengeTrophies,
  ]);

  /* ------------------------------ On open/close ---------------------------- */

  useEffect(() => {
    if (!visible) return;

    // Open
    if (mountedRef.current) setBusy(false);
    didNavRef.current = false;
    setVideoOk(true);

     // Preload rewarded (best effort)
    try {
      setAdError(null);
      setAdLoadingLocal(false);

      if (rewardedAdUnitId) {
        // snapshot immédiat (si déjà prête)
        setAdReadyLocal(rewardedAdsService.isReady(rewardedAdUnitId));

        // preload en arrière-plan (mais on garde l'UI utilisable)
        setAdLoadingLocal(true);
        (async () => {
          try {
            await rewardedAdsService.preload(rewardedAdUnitId);
          } catch {}
          if (!mountedRef.current) return;
          setAdReadyLocal(rewardedAdsService.isReady(rewardedAdUnitId));
          setAdLoadingLocal(false);
        })();
      } else {
        // fallback : parent
        onPreloadRewarded?.();
        setAdReadyLocal(!!rewardedReady);
      }
    } catch {}

    resetAnim();

    // Haptics: “arrival” (subtle)
    (async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    })();

    // Video: restart
    if (!reduceMotion) {
      requestAnimationFrame(async () => {
        try {
          await videoRef.current?.setStatusAsync({ positionMillis: 0, shouldPlay: true });
        } catch {
          setVideoOk(false);
        }
      });
    }

    if (reduceMotion) {
      scrim.setValue(1);
      cardOpacity.setValue(1);
      cardScale.setValue(1);
      cardLift.setValue(0);
      halo.setValue(1);
      ring.setValue(1);
      spark.setValue(1);
      sheen.setValue(1);
      crown.setValue(1);
      videoFade.setValue(1);
      return;
    }

    // Cinematic reveal
    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 18,
        stiffness: 280,
        mass: 0.75,
        useNativeDriver: true,
      }),
      Animated.timing(cardLift, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(videoFade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Award FX (clean, not childish)
    halo.setValue(0);
    ring.setValue(0);
    spark.setValue(0);
    sheen.setValue(0);
    crown.setValue(0);

    Animated.sequence([
      Animated.delay(40),
      Animated.parallel([
        Animated.timing(halo, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ring, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0.78,
            duration: 140,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(70),
      Animated.timing(sheen, {
        toValue: 1,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(60),
      Animated.timing(spark, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spark, {
        toValue: 0,
        duration: 520,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(120),
      Animated.timing(spark, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spark, {
        toValue: 0,
        duration: 580,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    crownLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(crown, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(crown, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    crownLoopRef.current.start();

    return () => {
      // Close cleanup happens in separate effect below
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ✅ Sync fallback ready -> local
  useEffect(() => {
    if (rewardedAdUnitId) return;
    setAdReadyLocal(!!rewardedReady);
  }, [rewardedAdUnitId, rewardedReady]);

  useEffect(() => {
    if (visible) return;

    // Close cleanup
    resetAnim();
    stopTimers();
    (async () => {
      try {
        await videoRef.current?.stopAsync();
        await videoRef.current?.setStatusAsync({ shouldPlay: false });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* ------------------------------ Sparks geometry -------------------------- */

  const sparks = useMemo(() => {
    const N = 16;
    return Array.from({ length: N }).map((_, i) => {
      const a = (i / N) * Math.PI * 2;
      const jitter = ((i % 2) * 2 - 1) * 0.12;
      return { a: a + jitter, i };
    });
  }, []);

  /* ------------------------------ Theme colors ----------------------------- */

  const palette = useMemo(() => {
    // We deliberately keep “award” neutral / premium
    const bg0 = isDark ? "rgba(10,10,14,0.78)" : "rgba(14,14,18,0.72)";
    const bg1 = isDark ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.86)";
    const line = "rgba(255,255,255,0.16)";
    const line2 = "rgba(255,255,255,0.22)";
    const textStrong = "rgba(255,255,255,0.97)";
    const textSoft = "rgba(255,255,255,0.78)";
    const textDim = "rgba(255,255,255,0.62)";
    const chip = "rgba(255,255,255,0.10)";
    const chipLine = "rgba(255,255,255,0.16)";
    const glass = "rgba(255,255,255,0.06)";
    const glassStrong = "rgba(255,255,255,0.10)";
    return { bg0, bg1, line, line2, textStrong, textSoft, textDim, chip, chipLine, glass, glassStrong };
  }, [isDark]);

  /* --------------------------- Actions (complete) -------------------------- */

  const dismiss = useCallback(() => {
    if (busyRef.current) return;
    onClose?.();
  }, [onClose]);

  const successAndNavigate = useCallback(
    async (count: number) => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Micro-delay so the success haptic lands “inside” the award moment
      hideTimerRef.current = setTimeout(() => {
        if (didNavRef.current) return;
        didNavRef.current = true;

        onClose?.();
        router.replace(`/challenge-details/${challengeId}`);

        setTimeout(() => {
          didNavRef.current = false;
        }, 700);
      }, 520);
    },
    [challengeId, onClose, router]
  );

const handleComplete = useCallback(
    async (doubleReward: boolean) => {
      if (busyRef.current) return;
      if (mountedRef.current) setBusy(true);

      // Haptic “commit”
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}

      if (doubleReward) {
        try {
          // ✅ 1) Mode autonome (recommandé)
          if (rewardedAdUnitId) {
            if (!canShowRewarded) {
              if (mountedRef.current) setBusy(false);
              return;
            }

            if (adLoadingLocal) {
              if (mountedRef.current) setBusy(false);
              return;
            }

            setAdError(null);
            setAdLoadingLocal(true);

            // Si pas prête, tentative preload rapide
            if (!rewardedAdsService.isReady(rewardedAdUnitId)) {
              try {
                await rewardedAdsService.preload(rewardedAdUnitId);
              } catch {}
            }

            const readyNow = rewardedAdsService.isReady(rewardedAdUnitId);
            if (mountedRef.current) setAdReadyLocal(readyNow);

            if (!readyNow) {
              if (mountedRef.current) {
                setBusy(false);
                setAdLoadingLocal(false);
                setAdError(
                  t("completion.adNotReady", {
                    defaultValue: "Pub pas prête. Réessaie dans quelques secondes.",
                  }) as string
                );
              }
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              return;
            }

            const res = await rewardedAdsService.show(rewardedAdUnitId);
            if (res !== "earned") {
              if (mountedRef.current) {
                setBusy(false);
                setAdLoadingLocal(false);
                setAdError(
                  res === "closed"
                    ? (t("completion.adNotEarned", {
                        defaultValue: "Récompense non validée. Tu peux réessayer.",
                      }) as string)
                    : (t("completion.adError", {
                        defaultValue: "Impossible de charger la pub. Réessaie dans un instant.",
                      }) as string)
                );
              }
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              return;
            }

            // earned ✅
            if (mountedRef.current) setAdLoadingLocal(false);
          } else {
            // ✅ 2) Fallback compat : parent gère la rewarded
            if (!canShowRewarded || rewardedLoading || !rewardedReady) {
              if (mountedRef.current) setBusy(false);
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              return;
            }

            const earned = await onShowRewarded?.();
            if (!earned) {
              if (mountedRef.current) setBusy(false);
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              return;
            }
          }

          await completeChallenge(challengeId, selectedDays, true);
          await successAndNavigate(rewardTotals.dbl);
          return;
        } catch (e) {
          console.error("completion error (rewarded)", e);
          if (mountedRef.current) setBusy(false);
          if (mountedRef.current) setAdLoadingLocal(false);
          if (mountedRef.current) {
            setAdError(
              t("completion.adError", {
                defaultValue: "Impossible de charger la pub. Réessaie dans un instant.",
              }) as string
            );
          }
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch {}
          return;
        }
      }

      // No ad path
      try {
        await completeChallenge(challengeId, selectedDays, false);
        await successAndNavigate(rewardTotals.base);
      } catch (e) {
        console.error("completion error", e);
        if (mountedRef.current) setBusy(false);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
      }
    },
    [
      rewardTotals.base,
      rewardTotals.dbl,
      canShowRewarded,
      rewardedLoading,
      rewardedReady,
      onShowRewarded,
      rewardedAdUnitId,
      adLoadingLocal,
      t,
      challengeId,
      completeChallenge,
      selectedDays,
      successAndNavigate,
    ]
  );

  /* ------------------------------ Layout sizing ---------------------------- */

  const PAD = useMemo(() => {
    const base = 16;
    const extra = IS_TINY ? 12 : IS_TABLET ? 26 : W > 520 ? 22 : 16;
    return Math.round((base + extra) * scale);
  }, [W, scale, IS_TINY, IS_TABLET]);

 const CARD_MAX_W = useMemo(
    () => Math.min(W - 24, Math.max(IS_TINY ? 328 : 340, Math.round((IS_TABLET ? 560 : 520) * scale))),
    [W, scale, IS_TINY, IS_TABLET]
  );
  const HERO = useMemo(() => {
    const min = Math.round((IS_TINY ? 210 : 230) * scale);
    const max = Math.round((IS_TABLET ? 360 : 330) * scale);
    const target = Math.round((H - (insets.top + insets.bottom)) * (IS_TABLET ? 0.28 : 0.30));
    return Math.max(min, Math.min(max, target));
  }, [H, insets.bottom, insets.top, scale, IS_TINY, IS_TABLET]);

  const titleSize = useMemo(() => Math.round((IS_TINY ? 21 : 23) * scale), [scale, IS_TINY]);
  const subSize = useMemo(() => Math.round((IS_TINY ? 13.5 : 14.5) * scale), [scale, IS_TINY]);

  /* ------------------------------ Render guards ---------------------------- */

  if (!visible) return null;

  /* --------------------------------- Render -------------------------------- */

  const scrimOpacity = scrim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.18] });

  const sheenOpacity = sheen.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.55, 0] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-260, 260] });

  const crownFloat = crown.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const crownGlow = crown.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  const rewardText = t("completion.reward", { count: rewardTotals.base });
  const rewardText2 = t("completion.reward", { count: rewardTotals.dbl });

  const headerKicker = t("completion.modalTitle", { defaultValue: "Challenge terminé" });
  const headline = t("completion.wellDone", { defaultValue: "Bravo." });
  const line = t(phraseKey);

  const canPress = !busy;
  
  const isRewardedDisabled =
    !canShowRewarded ||
    !canPress ||
    (rewardedAdUnitId ? adLoadingLocal : rewardedLoading);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root} accessibilityViewIsModal accessibilityLiveRegion="polite">
        {/* Scrim */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: scrimOpacity,
            },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.16)",
              "rgba(0,0,0,0.66)",
              "rgba(0,0,0,0.90)",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.vignette} />
        </Animated.View>

        {/* Tap outside to close */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t("completion.dismiss", { defaultValue: "Fermer" })}
        />

        {/* Center card */}
        <View
          pointerEvents="box-none"
          style={[
            styles.center,
            {
              paddingTop: Math.max(12, insets.top * 0.45),
              paddingBottom: Math.max(12, insets.bottom * 0.55),
              paddingHorizontal: 14,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.cardOuter,
              {
                width: "100%",
                maxWidth: CARD_MAX_W,
                opacity: cardOpacity,
                transform: [{ translateY: cardLift }, { scale: cardScale }],
              },
            ]}
          >
            {/* FX behind */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  opacity: haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />

            {/* Card (glass + border gradient) */}
            <View style={[styles.cardBorderWrap]}>
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.18)",
                  "rgba(255,255,255,0.06)",
                  "rgba(0,0,0,0.20)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardBorder, { borderRadius: 30 }]}
              />
              <LinearGradient
                colors={[palette.bg0, palette.bg1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.card,
                  {
                    borderColor: palette.line,
                    padding: PAD,
                  },
                ]}
              >
                {/* Hairline highlight */}
                <View style={[styles.hairline, { backgroundColor: palette.line2 }]} />

              {/* Sheen sweep */}
              {!reduceMotion && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.sheen,
                    {
                      opacity: sheenOpacity,
                      transform: [{ translateX: sheenX }, { rotate: "-18deg" }],
                    },
                  ]}
                />
              )}

              {/* Header row */}
              <View style={styles.headerRow}>
                <View style={[styles.chip, { backgroundColor: palette.chip, borderColor: palette.chipLine }]}>
                  <Ionicons name="trophy-outline" size={14} color={palette.textSoft} />
                  <Text style={[styles.chipText, { color: palette.textSoft }]} numberOfLines={1}>
                    {userTrophies} {t("completion.trophies", { defaultValue: "trophées" })}
                  </Text>
                </View>

                <Pressable
                  onPress={dismiss}
                  disabled={!canPress}
                  style={({ pressed }) => [
                    styles.close,
                    {
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: palette.chip,
                      borderColor: palette.chipLine,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("completion.dismiss", { defaultValue: "Fermer" })}
                >
                  <Ionicons name="close" size={18} color={palette.textSoft} />
                </Pressable>
              </View>

 <View style={[styles.heroShell, { height: HERO, borderColor: "rgba(255,255,255,0.12)" }]}>
                {/* Media background (video) */}
                <Animated.View style={[styles.videoWrap, { opacity: videoFade }]}>
                  <View style={[styles.videoBorder, { borderColor: "rgba(255,255,255,0.12)" }]}>
                    {videoOk ? (
                      <Video
  ref={videoRef}
  source={require("../assets/videos/trophy-animation.mp4")}
  style={[
    styles.video,
    {
      transform: [
        { scale: VIDEO_ZOOM },
        { translateY: VIDEO_SHIFT_Y },
        { translateX: VIDEO_SHIFT_X },
      ],
    },
  ]}
  resizeMode={ResizeMode.COVER}
  shouldPlay={!reduceMotion}
  isLooping={!reduceMotion}
  isMuted={false}
  onError={() => setVideoOk(false)}
/>
                    ) : (
                      <View style={[styles.video, styles.videoFallback]}>
                        <Ionicons name="trophy" size={Math.round(76 * scale)} color={"rgba(255,255,255,0.92)"} />
                        <Text style={[styles.fallbackText, { color: palette.textSoft }]}>
                          {t("completion.wellDone", { defaultValue: "Bravo." })}
                        </Text>
                      </View>
                    )}
                  </View>
                   {/* Cinematic overlay */}
                  <LinearGradient
                    colors={[
                      "rgba(0,0,0,0.05)",
                      "rgba(0,0,0,0.25)",
                      "rgba(0,0,0,0.55)",
                      "rgba(0,0,0,0.80)",
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.heroOverlay}
                    pointerEvents="none"
                  />
                </Animated.View>

                {/* Badge (glass dock) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.badgeDock,
                    {
                      transform: [{ translateY: crownFloat }],
                      opacity: crownGlow,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[palette.glassStrong, palette.glass]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.badgeDockInner, { borderColor: "rgba(255,255,255,0.14)" }]}
                  >
                    <View style={[styles.badgeIcon, { backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.16)" }]}>
                      <Ionicons name="sparkles-outline" size={18} color={palette.textStrong} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.kicker, { color: palette.textDim }]} numberOfLines={1}>
                        {headerKicker}
                      </Text>
                      <Text style={[styles.headline, { color: palette.textStrong, fontSize: titleSize }]} numberOfLines={2}>
                        {headline}
                      </Text>
                      <Text style={[styles.subline, { color: palette.textSoft, fontSize: subSize }]} numberOfLines={2}>
                        {line}
                      </Text>
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* Sparks */}
                {!reduceMotion && (
                  <View pointerEvents="none" style={styles.sparkLayer}>
                    {sparks.map(({ a, i }) => {
                      const dist = Math.round(54 * scale);
                      const x = Math.cos(a) * dist;
                      const y = Math.sin(a) * dist;

                      const w = i % 3 === 0 ? 2.2 : 1.6;
                      const h2 = i % 2 === 0 ? 18 : 13;
                      const rot = `${(a * 180) / Math.PI}deg`;

                      const op = spark.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 0] });
                      const sc = spark.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.12] });
                      const tx = spark.interpolate({ inputRange: [0, 1], outputRange: [0, x] });
                      const ty = spark.interpolate({ inputRange: [0, 1], outputRange: [0, y] });

                      return (
                        <Animated.View
                          key={`sp-${i}`}
                          style={[
                            styles.spark,
                            {
                              width: w,
                              height: h2,
                              opacity: op,
                              transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale: sc }],
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Reward cards */}
              <View style={styles.rewardsRow}>
                 <View style={[styles.rewardCard, { borderColor: palette.line, backgroundColor: palette.glass }]}>
                  <Text style={[styles.rewardLabel, { color: palette.textDim }]} numberOfLines={1}>
                    {t("completion.rewardLabel", { defaultValue: "Récompense" })}
                  </Text>
                  <Text style={[styles.rewardValue, { color: palette.textStrong }]} numberOfLines={1}>
                    +{rewardTotals.base}
                  </Text>
                  <Text style={[styles.rewardCaption, { color: palette.textSoft }]} numberOfLines={2}>
                    {rewardText}
                  </Text>
                </View>

                <View style={[styles.rewardCard, { borderColor: palette.line, backgroundColor: palette.glass }]}>
                  <Text style={[styles.rewardLabel, { color: palette.textDim }]} numberOfLines={1}>
                    {t("completion.doubleRewardLabel", { defaultValue: "Double" })}
                  </Text>
                  <Text style={[styles.rewardValue, { color: palette.textStrong }]} numberOfLines={1}>
                    +{rewardTotals.dbl}
                  </Text>
                  <Text style={[styles.rewardCaption, { color: palette.textSoft }]} numberOfLines={2}>
                    {rewardText2}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable
                  disabled={!canPress}
                  onPress={() => handleComplete(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("completion.continue", { defaultValue: "Continuer" })}
                  testID="complete-without-ad"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      opacity: !canPress ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.22)",
                      "rgba(255,255,255,0.12)",
                      "rgba(0,0,0,0.14)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.btnInner, { borderColor: "rgba(255,255,255,0.18)" }]}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={palette.textStrong} />
                      <Text style={[styles.btnText, { color: palette.textStrong }]} numberOfLines={1}>
                        {t("completion.continue", { defaultValue: "Continuer" })}
                      </Text>
                    </View>

                    {busy && (
                      <ActivityIndicator
                        size={Platform.OS === "android" ? "small" : "small"}
                        color={"rgba(255,255,255,0.85)"}
                        style={{ marginLeft: 10 }}
                      />
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  disabled={isRewardedDisabled}
                  onPress={() => handleComplete(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("completion.doubleTrophies", { defaultValue: "Doubler la récompense" })}
                  accessibilityHint={t("completion.watchAdHint", { defaultValue: "Regarde une pub pour doubler." })}
                  testID="complete-with-ad"
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    {
                      opacity: isRewardedDisabled ? 0.55 : pressed ? 0.85 : 1,
                      borderColor: "rgba(255,255,255,0.12)",
                    },
                  ]}
                >
                  <View style={styles.btnRow}>
                    <Ionicons name="videocam-outline" size={18} color={palette.textSoft} />
                    <Text style={[styles.btnText, { color: palette.textSoft }]} numberOfLines={1}>
                      {t("completion.doubleTrophies", { defaultValue: "Doubler" })}
                    </Text>
                  </View>
                  {(isRewardedDisabled || !!adError) && (
                    <Text style={[styles.badgeHint, { color: palette.textDim }]} numberOfLines={1}>
                     {adError
                        ? adError
                        : rewardedAdUnitId
                        ? adLoadingLocal
                          ? t("completion.adLoading", { defaultValue: "Pub en chargement" })
                          : t("completion.adNotReady", { defaultValue: "Pub pas prête" })
                        : rewardedLoading
                        ? t("completion.adLoading", { defaultValue: "Pub en chargement" })
                        : t("completion.adNotReady", { defaultValue: "Pub pas prête" })}
                    </Text>
                  )}
                </Pressable>
              </View>

              {/* Footer microcopy (premium, not pushy) */}
              <Text style={[styles.footer, { color: palette.textDim }]} numberOfLines={2}>
                {t("completion.footer", {
                  defaultValue: "Tu viens de tenir ta parole. C’est comme ça que l’identité change.",
                })}
              </Text>
            </LinearGradient>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Styles                                  */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderRadius: 0,
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 120,
    shadowOffset: { width: 0, height: 0 },
  },
  cardOuter: {
    borderRadius: 30,
    overflow: "visible",
  },
  cardBorderWrap: {
    borderRadius: 30,
    overflow: "visible",
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    opacity: 0.9,
  },
  halo: {
    position: "absolute",
    left: -36,
    right: -36,
    top: -36,
    bottom: -36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  ring: {
    position: "absolute",
    left: -18,
    right: -18,
    top: -18,
    bottom: -18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },

  card: {
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.36,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
    elevation: 20,
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  sheen: {
    position: "absolute",
    top: -80,
    bottom: -80,
    width: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  heroShell: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  badgeDock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  badgeDockInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  badgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  kicker: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 11.5,
    letterSpacing: 1.25,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headline: {
    fontFamily: "Comfortaa_700Bold",
    lineHeight: 28,
    marginBottom: 4,
  },
  subline: {
    fontFamily: "Comfortaa_400Regular",
    lineHeight: 18,
  },

  videoWrap: {
    width: "100%",
    height: "100%",
  },
  videoBorder: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  fallbackText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 14,
    textAlign: "center",
  },

  sparkLayer: {
    position: "absolute",
    left: "50%",
    top: "58%",
    width: 1,
    height: 1,
  },
  spark: {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  rewardsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  rewardCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rewardLabel: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  rewardValue: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 22,
    marginBottom: 4,
  },
  rewardCaption: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12.5,
    lineHeight: 16.5,
  },

  actions: {
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 18,
    overflow: "hidden",
  },
  btnInner: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    borderRadius: 18,
    borderWidth: ANDROID_HAIRLINE,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  btnText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 14.5,
    letterSpacing: 0.2,
    maxWidth: "90%",
  },
  badgeHint: {
    marginTop: 6,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 11.5,
  },

  footer: {
    marginTop: 12,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
});
