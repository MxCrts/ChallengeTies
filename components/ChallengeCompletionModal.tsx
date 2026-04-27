/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  AccessibilityInfo,
  ActivityIndicator,
  Share,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  useDerivedValue,
} from "react-native-reanimated";
import {
  useTrophiesEconomy,
  coerceToDayKey,
  dayKeyUTC,
} from "../hooks/useTrophiesEconomy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where } from "firebase/firestore";
import { translateChallenge } from "../services/translationService";
import * as Notifications from "expo-notifications";

const C = {
  gold:            "#FFD166",
  goldDeep:        "#F4A623",
  orange:          "#F97316",
  white:           "rgba(255,255,255,0.97)",
  whiteSoft:       "rgba(255,255,255,0.72)",
  whiteDim:        "rgba(255,255,255,0.42)",
  bg:              "#060402",
  glassBorder:     "rgba(255,209,102,0.28)",
  glassBorderSoft: "rgba(255,255,255,0.10)",
} as const;

const MOTIVATIONAL = [
  "completion.youAreAwesome",    "completion.keepItUp",
  "completion.successIsYours",   "completion.everyEffortCounts",
  "completion.neverGiveUp",      "completion.youAreOnTrack",
  "completion.excellenceAwaits", "completion.headHeldHigh",
  "completion.persistencePays",  "completion.challengesMakeYouStronger",
];

const pick  = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// ─── Spark sans useAnimatedStyle ─────────────────────────────────────────────
// ✅ On utilise Animated.View avec style inline via useDerivedValue + interpolate
// Pas de useAnimatedStyle = pas d'erreur de type DefaultStyle / transform
type SparkProps = {
  angle: number;
  dist: number;
  isGold: boolean;
  w: number;
  h: number;
  prog: Animated.SharedValue<number>;
};

const Spark = React.memo(function Spark({ angle, dist, isGold, w, h, prog }: SparkProps) {
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const p = prog.value;
    return {
      opacity: interpolate(p, [0, 0.18, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        { translateY: Math.sin(angle) * dist * p },
        { rotate: `${(angle * 180) / Math.PI + 90}deg` },
        { scale: interpolate(p, [0, 1], [0.4, 1.1]) },
      ] as any,
    } as any;
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: w,
          height: h,
          backgroundColor: isGold ? C.gold : C.white,
          borderRadius: 999,
          left: "50%" as any,
          top:  "50%" as any,
          marginLeft: -w / 2,
          marginTop:  -h / 2,
        },
        animatedStyle as any,
      ] as any}
    />
  );
});

const SPARKS = Array.from({ length: 24 }, (_, i) => ({
  angle:  (i / 24) * Math.PI * 2 + ((i % 5) - 2) * 0.08,
  dist:   60 + (i % 4) * 18,
  isGold: i % 3 === 0,
  w: i % 4 === 0 ? 3 : 2,
  h: i % 3 === 0 ? 22 : 13,
}));

type Props = {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  onClose: () => void;
  canShowRewarded?: boolean;
  rewardedReady?: boolean;
  rewardedLoading?: boolean;
  onPreloadRewarded?: () => void;
  onShowRewarded?: () => Promise<boolean>;
  rewardedAdUnitId?: string;
  // Nouveaux pour le flow post-complétion
  challengeCategory?: string;        // pour proposer un défi de la même catégorie
  onInviteDuo?: () => void;          // pour le nudge duo post-complétion
  completedChallengesCount?: number; // pour l'identité cumulative
};

export default function ChallengeCompletionModal({
  visible, challengeId, selectedDays, onClose,
  canShowRewarded = true, rewardedReady = false, rewardedLoading = false,
  onPreloadRewarded, onShowRewarded,
  challengeCategory, onInviteDuo, completedChallengesCount = 0,
}: Props) {
  const { t, i18n } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { completeChallenge, currentChallenges } = useCurrentChallenges();
  const { computeChallengeTrophies } = useTrophiesEconomy();

  const mountedRef = useRef(false);
  const busyRef    = useRef(false);
  const didNavRef  = useRef(false);
  const c1 = useRef<ConfettiCannon>(null);
  const c2 = useRef<ConfettiCannon>(null);
  const c3 = useRef<ConfettiCannon>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const whooshRef = useRef<Audio.Sound | null>(null);
  const dingRef   = useRef<Audio.Sound | null>(null);
  const sparkRef  = useRef<Audio.Sound | null>(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const safeH   = H - insets.top - insets.bottom;
  const isTiny  = safeH < 580;
  const isSmall = safeH < 650;

  const EMOJI_S = clamp(Math.round(safeH * (isTiny ? 0.10 : 0.125)), 52, 108);
  const GLOW_S  = EMOJI_S * 2.4;
  const CTR_S   = clamp(Math.round(safeH * (isTiny ? 0.068 : 0.082)), 38, 70);
  const KKR_S   = clamp(Math.round(safeH * 0.014),  9, 12);
  const BDY_S   = clamp(Math.round(safeH * 0.018), 11, 15);
  const BTN_PY  = clamp(Math.round(safeH * 0.018), 11, 17);
  const BTN_FS  = clamp(Math.round(safeH * 0.022), 13, 17);
  const PAD_H   = clamp(Math.round(W     * 0.05),  16, 26);
  const GAP     = clamp(Math.round(safeH * 0.012),  6, 12);
  const HERO_H  = clamp(Math.round(safeH * (isTiny ? 0.21 : isSmall ? 0.24 : 0.27)), 120, 210);

  const [reduceMotion, setReduceMotion]  = useState(false);
  const [busy,         setBusy]          = useState(false);
  const [adError,      setAdError]       = useState<string | null>(null);
  const [userTrophies, setUserTrophies]  = useState(0);
  const [longestStreak,setLongestStreak] = useState(0);
  const [streak,       setStreak]        = useState(0);
  const [partnerKey,   setPartnerKey]    = useState<string | null>(null);
  const [displayed,    setDisplayed]     = useState(0);
  const [counterDone,  setCounterDone]   = useState(false);
  const [phase,        setPhase]         = useState(0);
  const phraseKey = useMemo(() => pick(MOTIVATIONAL), [visible]);

   const [showNextStep, setShowNextStep] = useState(false);
  const [suggestedChallenges, setSuggestedChallenges] = useState<Array<{
    id: string;
    title: string;
    category: string;
  }>>([]);
  const nextStepOp = useSharedValue(0);
  const nextStepY  = useSharedValue(20);

  // Identité cumulative : "Tu as terminé X challenges. Tu es quelqu'un qui finit."
  const identityText = useMemo(() => {
    const n = completedChallengesCount + 1; // +1 car celui-ci vient d'être terminé
    if (n === 1) return t("completion.identity.first",  { defaultValue: "Premier challenge terminé. Tu as prouvé que tu commences vraiment." });
    if (n === 2) return t("completion.identity.second", { defaultValue: "Deux challenges terminés. La plupart s'arrêtent au premier." });
    if (n === 3) return t("completion.identity.third",  { defaultValue: "3 challenges. Tu es quelqu'un qui finit ce qu'il commence." });
    if (n < 7)   return t("completion.identity.few",    { n, defaultValue: `${n} challenges terminés. Tu construis quelque chose de réel.` });
    if (n < 15)  return t("completion.identity.many",   { n, defaultValue: `${n} challenges. Tu es dans le top 10% des gens qui tiennent.` });
    return t("completion.identity.legend",               { n, defaultValue: `${n} challenges terminés. Tu es dans le top 1% mondial.` });
  }, [completedChallengesCount, t]);

  // Charger des suggestions de la même catégorie
  useEffect(() => {
    if (!visible || !challengeCategory) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, "challenges"),
          where("approved", "==", true),
          where("category", "==", challengeCategory)
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        // ── Étape 1 : construire la liste avec le titre brut ──────────
        // Challenges système (chatId) → traduction i18n immédiate
        // Challenges user (creatorId) → titre brut d'abord, traduit ensuite
        // APRÈS — on attend les traductions AVANT d'afficher (max 1.5s timeout)
const candidates = snap.docs
  .filter(d => d.id !== challengeId)
  .slice(0, 3)
  .map(d => {
    const data = d.data() as any;
    const isSystem = !data?.creatorId && !!data?.chatId;
    const title = isSystem
      ? t(`challenges.${data.chatId}.title`, { defaultValue: data?.title || "Défi" })
      : (data?.title || "Défi");
    return { id: d.id, title, category: challengeCategory, isSystem, creatorId: data?.creatorId ?? null };
  });

if (cancelled) return;

// Affichage immédiat pour les challenges système (traduction i18n synchrone)
// Pour les challenges user, on attend la traduction avec timeout de 1.5s
const withTranslations = await Promise.all(
  candidates.map(async (c) => {
    if (c.isSystem) return c;
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const result = await Promise.race([
        translateChallenge(c.id, i18n.language),
        timeoutPromise,
      ]);
      if (result?.title) return { ...c, title: result.title };
    } catch {}
    return c;
  })
);

if (cancelled) return;
setSuggestedChallenges(withTranslations);

      } catch {}
    })();
    return () => { cancelled = true; };
  }, [visible, challengeCategory, challengeId, t, i18n.language]);

  useEffect(() => {
    let m = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => m && setReduceMotion(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", v => setReduceMotion(!!v));
    return () => { m = false; (sub as any)?.remove?.(); };
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      setUserTrophies(d.trophies || 0);
      setLongestStreak(Number(d.longestStreak || 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const ch = currentChallenges.find((x: any) => {
      const cid = x?.challengeId ?? x?.id;
      return String(cid) === String(challengeId) && Number(x?.selectedDays) === Number(selectedDays);
    });
    setStreak(Number((ch as any)?.streak || 0));
    const pid  = (ch as any)?.duoPartnerId as string | undefined;
    const cKey = (ch as any)?.uniqueKey    as string | undefined;
    if (!pid || !cKey) { setPartnerKey(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const pSnap = await getDoc(doc(db, "users", pid));
        if (cancelled || !pSnap.exists()) { setPartnerKey(null); return; }
        const pd   = pSnap.data() as any;
        const list = Array.isArray(pd.CurrentChallenges) ? pd.CurrentChallenges : [];
        const p    = list.find((c: any) => c?.uniqueKey === cKey);
        const pKeys: string[] = ((p as any)?.completionDateKeys ??
          (p?.completionDates || []).map(coerceToDayKey).filter(Boolean)) as string[];
        setPartnerKey(pKeys.length ? pKeys[pKeys.length - 1] : null);
      } catch { if (!cancelled) setPartnerKey(null); }
    })();
    return () => { cancelled = true; };
  }, [visible, currentChallenges, challengeId, selectedDays]);

  const rt = useMemo(() => {
    const ch = currentChallenges.find((x: any) => {
      const cid = x?.challengeId ?? x?.id;
      return String(cid) === String(challengeId) && Number(x?.selectedDays) === Number(selectedDays);
    });
    const rawKeys: string[] = ((ch as any)?.completionDateKeys ??
      ((ch as any)?.completionDates || []).map(coerceToDayKey).filter(Boolean)) as string[];
    const sorted: string[]  = Array.from(new Set(rawKeys)).sort();
    const finish: string    = sorted.length ? sorted[sorted.length - 1] : dayKeyUTC(new Date());
    const isDuo             = !!(ch as any)?.duo && !!partnerKey;
    const base = computeChallengeTrophies({ selectedDays, completionKeys: sorted, myFinishKey: finish, partnerFinishKey: partnerKey ?? undefined, isDuo, isDoubleReward: false, longestStreak }).total;
    const dbl  = computeChallengeTrophies({ selectedDays, completionKeys: sorted, myFinishKey: finish, partnerFinishKey: partnerKey ?? undefined, isDuo, isDoubleReward: true,  longestStreak }).total;
    return {
      base: Number.isFinite(base) ? Math.max(0, Math.round(base)) : 0,
      dbl:  Number.isFinite(dbl)  ? Math.max(0, Math.round(dbl))  : 0,
    };
  }, [currentChallenges, challengeId, selectedDays, partnerKey, longestStreak, computeChallengeTrophies]);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false, playsInSilentModeIOS: true,
          staysActiveInBackground: false, shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1, interruptionModeIOS: 1,
        });
        const [{ sound: w }, { sound: d }, { sound: sp }] = await Promise.all([
          Audio.Sound.createAsync(require("../assets/music/gain_whoosh.wav"), { shouldPlay: false }),
          Audio.Sound.createAsync(require("../assets/music/gain_ding.wav"),   { shouldPlay: false }),
          Audio.Sound.createAsync(require("../assets/music/gain_sparkle.wav"),{ shouldPlay: false }),
        ]);
        if (m) {
          whooshRef.current = w; dingRef.current = d; sparkRef.current = sp;
          await w.setVolumeAsync(0.7); await d.setVolumeAsync(1.0); await sp.setVolumeAsync(0.8);
        }
      } catch {}
    })();
    return () => {
      m = false;
      whooshRef.current?.unloadAsync().catch(() => {});
      dingRef.current?.unloadAsync().catch(() => {});
      sparkRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playSounds = useCallback(async () => {
    try {
      await whooshRef.current?.replayAsync();
      setTimeout(() => dingRef.current?.replayAsync().catch(() => {}),  120);
      setTimeout(() => sparkRef.current?.replayAsync().catch(() => {}), 280);
    } catch {}
  }, []);

  const blackOp  = useSharedValue(0);
  const flashOp  = useSharedValue(0);
  const cardOp   = useSharedValue(0);
  const cardY    = useSharedValue(48);
  const cardSc   = useSharedValue(0.9);
  const emjiSc   = useSharedValue(0);
  const emjiY    = useSharedValue(18);
  const emjiGlow = useSharedValue(0);
  const emjiFlot = useSharedValue(0);
  const h1       = useSharedValue(0);
  const h2       = useSharedValue(0);
  const h3       = useSharedValue(0);
  const burst    = useSharedValue(0);
  const shnX     = useSharedValue(-W - 100);
  const shnOp    = useSharedValue(0);
  const rewOp    = useSharedValue(0);
  const rewY     = useSharedValue(16);
  const ctaOp    = useSharedValue(0);
  const ctaYsv   = useSharedValue(16);
  const ctrPulse = useSharedValue(1);

  const resetAll = useCallback(() => {
    blackOp.value = 0; flashOp.value = 0;
    cardOp.value  = 0; cardY.value = 48; cardSc.value = 0.9;
    emjiSc.value  = 0; emjiY.value = 18; emjiGlow.value = 0; emjiFlot.value = 0;
    h1.value = 0; h2.value = 0; h3.value = 0; burst.value = 0;
    shnX.value = -W - 100; shnOp.value = 0;
    rewOp.value = 0; rewY.value = 16;
    ctaOp.value = 0; ctaYsv.value = 16;
    ctrPulse.value = 1;
    setDisplayed(0); setCounterDone(false); setPhase(0); setShowNextStep(false);
    nextStepOp.value = 0; nextStepY.value = 20;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [W]);

  const startCounter = useCallback((target: number) => {
    const onDone = () => {
      setCounterDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      ctrPulse.value = withSequence(
        withSpring(1.12, { damping: 8,  stiffness: 300 }),
        withSpring(1,    { damping: 12, stiffness: 200 })
      );
      setTimeout(() => {
        if (!mountedRef.current) return;
        ctaOp.value  = withTiming(1,  { duration: 280 });
        ctaYsv.value = withSpring(0,  { damping: 18, stiffness: 260, mass: 0.7 });
      }, 250);
    };
    if (target <= 0) { setDisplayed(0); onDone(); return; }
    const dur  = clamp(target * 10, 280, 700);
    const stps = clamp(target, 12, 60);
    const itv  = dur / stps;
    let cur    = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) { clearInterval(timerRef.current!); return; }
      cur += Math.ceil(target / stps);
      if (cur >= target) {
        cur = target;
        clearInterval(timerRef.current!); timerRef.current = null;
        onDone();
      }
      setDisplayed(cur);
      if (cur < target && cur % Math.max(1, Math.ceil(target / 6)) === 0) {
        Haptics.selectionAsync().catch(() => {});
      }
    }, itv);
  }, []);

  const runCinematic = useCallback(() => {
    if (!mountedRef.current) return;
    onPreloadRewarded?.();

    if (reduceMotion) {
      blackOp.value = 1; cardOp.value = 1; cardY.value = 0; cardSc.value = 1;
      emjiSc.value  = 1; emjiY.value  = 0; emjiGlow.value = 1;
      h1.value = 1; h2.value = 1; h3.value = 1;
      rewOp.value = 1; rewY.value = 0; ctaOp.value = 1; ctaYsv.value = 0;
      setDisplayed(rt.base); setCounterDone(true); setPhase(3);
      return;
    }

    setPhase(1);
    blackOp.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    setTimeout(async () => {
      if (!mountedRef.current) return;
      setPhase(2);
      flashOp.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 250 }));
      setTimeout(() => { c1.current?.start?.(); setTimeout(() => c2.current?.start?.(), 60); setTimeout(() => c3.current?.start?.(), 120); }, 35);
      await playSounds();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 120);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),   240);
      burst.value = withSequence(withTiming(1, { duration: 290, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 440, easing: Easing.in(Easing.quad) }));
      cardOp.value = withTiming(1, { duration: 230 });
      cardY.value  = withSpring(0, { damping: 18, stiffness: 220, mass: 0.8 });
      cardSc.value = withSpring(1, { damping: 14, stiffness: 200, mass: 0.7 });

      setTimeout(() => {
        if (!mountedRef.current) return;
        setPhase(3);
        emjiSc.value   = withSpring(1, { damping: 7,  stiffness: 135, mass: 0.55 });
        emjiY.value    = withSpring(0, { damping: 11, stiffness: 155, mass: 0.65 });
        emjiGlow.value = withTiming(1, { duration: 480 });
        const startPulse = (sv: Animated.SharedValue<number>, delay: number) => {
          setTimeout(() => {
            sv.value = withRepeat(withSequence(withTiming(1, { duration: 860, easing: Easing.out(Easing.quad) }), withTiming(0.4, { duration: 680, easing: Easing.inOut(Easing.quad) })), -1, true);
          }, delay);
        };
        startPulse(h1, 0); startPulse(h2, 140); startPulse(h3, 280);
        emjiFlot.value = withRepeat(withSequence(withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1150, easing: Easing.inOut(Easing.quad) })), -1, false);
        setTimeout(() => {
          shnOp.value = withSequence(withTiming(0.82, { duration: 75 }), withTiming(0.6, { duration: 650 }), withTiming(0, { duration: 160 }));
          shnX.value  = withTiming(W + 200, { duration: 920, easing: Easing.out(Easing.cubic) });
        }, 110);
        setTimeout(() => {
          if (!mountedRef.current) return;
          rewOp.value = withTiming(1, { duration: 280 });
          rewY.value  = withSpring(0, { damping: 18, stiffness: 255, mass: 0.7 });
          startCounter(rt.base);
        }, 400);
      }, 310);
    }, 200);
  }, [reduceMotion, rt.base, playSounds, onPreloadRewarded, W, startCounter]);

  useEffect(() => {
    if (!visible) return;
    resetAll(); setBusy(false); busyRef.current = false; didNavRef.current = false; setAdError(null);
    const timer = setTimeout(() => runCinematic(), 40);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    resetAll();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [visible]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Notif J+1 post-complétion — uniquement si pas de challenge actif le lendemain
  const schedulePostCompletionNotif = useCallback(async (cId: string) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // Clé de dédup — une seule notif par challenge complété
      const dedupKey = `notif.postcompletion.${cId}`;
      const already  = await AsyncStorage.getItem(dedupKey);
      if (already === "1") return;

      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) return;
      const userData = snap.data() as any;

      // Guard : si l'user a déjà repris un challenge, pas de notif "prêt pour le prochain"
      const currentList: any[] = Array.isArray(userData.CurrentChallenges)
        ? userData.CurrentChallenges : [];
      const hasOtherActive = currentList.some(
        ch => !ch?.completed && !ch?.archived && String(ch?.challengeId ?? ch?.id) !== String(cId)
      );
      if (hasOtherActive) return; // Il a déjà un autre challenge → notif inutile

      if (userData.notificationsEnabled === false) return;

      const language = String(userData.language || "en");
      const title = i18n.t("notificationsPush.postCompletionTitle", { lng: language, returnObjects: false });
      const body  = i18n.t("notificationsPush.postCompletionBody",  { lng: language, returnObjects: false });

      const trigger = new Date();
      trigger.setDate(trigger.getDate() + 1);
      trigger.setHours(10, 0, 0, 0); // 10h le lendemain matin

      await Notifications.scheduleNotificationAsync({
        content: {
          title: typeof title === "string" ? title : "🔥 Prêt pour la suite ?",
          body:  typeof body  === "string" ? body  : "Tu viens de terminer un challenge. Quel défi tu relèves maintenant ?",
          sound: "default",
          data:  { __tag: "post_completion_v1", kind: "daily_reminder", challengeId: cId },
        },
        trigger: trigger as any,
      });

      await AsyncStorage.setItem(dedupKey, "1");
    } catch {}
  }, []);

  const dismiss = useCallback(() => { if (busyRef.current) return; onClose?.(); }, [onClose]);

  const handleComplete = useCallback(async (double: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (mountedRef.current) setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      if (double) {
        if (!canShowRewarded || rewardedLoading || !rewardedReady) { if (mountedRef.current) setBusy(false); busyRef.current = false; return; }
        const earned = await onShowRewarded?.();
        if (!earned) { if (mountedRef.current) { setBusy(false); setAdError(t("completion.adNotEarned", { defaultValue: "Récompense non validée." }) as string); } busyRef.current = false; return; }
      }
      await completeChallenge(challengeId, selectedDays, double);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (didNavRef.current) return;
      didNavRef.current = true;

      // Notif J+1 en background (ne bloque pas)
      schedulePostCompletionNotif(challengeId).catch(() => {});

      // Affiche le flow "next step" au lieu de naviguer directement
      setTimeout(() => {
        if (!mountedRef.current) return;
        setBusy(false);
        busyRef.current = false;
        setShowNextStep(true);
        nextStepOp.value = withTiming(1, { duration: 320 });
        nextStepY.value  = withSpring(0, { damping: 18, stiffness: 220 });
        setTimeout(() => { didNavRef.current = false; }, 700);
      }, 340);
    } catch {
      if (mountedRef.current) { setBusy(false); setAdError(t("completion.adError", { defaultValue: "Erreur. Réessaie." }) as string); }
      busyRef.current = false;
    }
  }, [canShowRewarded, rewardedLoading, rewardedReady, onShowRewarded, completeChallenge, challengeId, selectedDays, onClose, router, t]);

  const handleShare = useCallback(async () => {
    try { await Share.share({ message: t("completion.shareMessage", { days: selectedDays, defaultValue: `Je viens de terminer un défi de ${selectedDays} jours sur ChallengeTies ! 💪🏆` }) }); } catch {}
  }, [selectedDays, t]);

  // ✅ Tous les useAnimatedStyle du composant principal : retour casté en "as any"
  // pour éviter la guerre de types Reanimated 3 / RN strict
  const stBlack = useAnimatedStyle(() => ({ opacity: blackOp.value } as any));
  const stFlash = useAnimatedStyle(() => ({ opacity: flashOp.value } as any));
  const stCard  = useAnimatedStyle(() => ({ opacity: cardOp.value, transform: [{ translateY: cardY.value }, { scale: cardSc.value }] } as any));
  const stEmji  = useAnimatedStyle(() => ({ opacity: interpolate(emjiSc.value, [0, 0.3, 1], [0, 1, 1]), transform: [{ scale: emjiSc.value }, { translateY: emjiY.value + interpolate(emjiFlot.value, [0, 1], [0, -9]) }] } as any));
  const stGlow  = useAnimatedStyle(() => ({ opacity: emjiGlow.value, transform: [{ scale: interpolate(emjiGlow.value, [0, 1], [0.4, 1]) }] } as any));
  const stH1    = useAnimatedStyle(() => ({ opacity: interpolate(h1.value, [0, 1], [0, 0.46]), transform: [{ scale: interpolate(h1.value, [0, 1], [0.7, 1.38]) }] } as any));
  const stH2    = useAnimatedStyle(() => ({ opacity: interpolate(h2.value, [0, 1], [0, 0.25]), transform: [{ scale: interpolate(h2.value, [0, 1], [0.5, 1.68]) }] } as any));
  const stH3    = useAnimatedStyle(() => ({ opacity: interpolate(h3.value, [0, 1], [0, 0.11]), transform: [{ scale: interpolate(h3.value, [0, 1], [0.3, 2.10]) }] } as any));
  const stSheen = useAnimatedStyle(() => ({ opacity: shnOp.value, transform: [{ translateX: shnX.value }, { rotate: "-18deg" }] } as any));
  const stRew   = useAnimatedStyle(() => ({ opacity: rewOp.value, transform: [{ translateY: rewY.value }] } as any));
  const stCta   = useAnimatedStyle(() => ({ opacity: ctaOp.value, transform: [{ translateY: ctaYsv.value }] } as any));
  const stCtr   = useAnimatedStyle(() => ({ transform: [{ scale: ctrPulse.value }] } as any));
   const stNextStep = useAnimatedStyle(() => ({
    opacity: nextStepOp.value,
    transform: [{ translateY: nextStepY.value }],
  } as any));

  const canDouble   = canShowRewarded && counterDone && !busy && rewardedReady && !rewardedLoading;
  const canContinue = counterDone && !busy;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <StatusBar hidden={phase >= 1} translucent backgroundColor="transparent" />
      <View style={s.root} accessibilityViewIsModal>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: C.bg }, stBlack] as any} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "#FFFFFF" }, stFlash] as any} />

        <ConfettiCannon ref={c1} count={65} origin={{ x: W * 0.18, y: -10 }} autoStart={false} fadeOut explosionSpeed={550} fallSpeed={2500} colors={["#FFD166","#F97316","#FFF","#FF6B6B","#4ECDC4"]} />
        <ConfettiCannon ref={c2} count={65} origin={{ x: W * 0.50, y: -10 }} autoStart={false} fadeOut explosionSpeed={620} fallSpeed={2700} colors={["#FFD166","#F97316","#FFF","#A78BFA","#34D399"]} />
        <ConfettiCannon ref={c3} count={65} origin={{ x: W * 0.82, y: -10 }} autoStart={false} fadeOut explosionSpeed={580} fallSpeed={2600} colors={["#FFD166","#FCD34D","#FFF","#F472B6","#60A5FA"]} />

        <Animated.View style={[s.card, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10, paddingHorizontal: PAD_H }, stCard] as any}>

          <LinearGradient pointerEvents="none" colors={[C.gold, C.goldDeep, "transparent"]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.hairline} />
          {!reduceMotion && <Animated.View pointerEvents="none" style={[s.sheen, stSheen] as any} />}

          <View style={s.header}>
            <LinearGradient colors={["rgba(255,209,102,0.16)","rgba(255,209,102,0.05)"]} style={[s.chip, { borderColor: C.glassBorder }]}>
              <Ionicons name="trophy" size={12} color={C.gold} />
              <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: KKR_S + 1, color: C.gold }}>{userTrophies}</Text>
            </LinearGradient>
            <Pressable onPress={dismiss} disabled={busy} style={({ pressed }) => [s.closeBtn, { opacity: pressed ? 0.6 : 1 }]} accessibilityRole="button">
              <Ionicons name="close" size={18} color={C.whiteSoft} />
            </Pressable>
          </View>

          <View style={[s.hero, { height: HERO_H }]}>
            <LinearGradient pointerEvents="none" colors={["rgba(255,209,102,0.09)","rgba(255,209,102,0.02)","transparent"]} start={{ x:0.5,y:0 }} end={{ x:0.5,y:1 }} style={StyleSheet.absoluteFillObject} />
            {!reduceMotion && (
              <>
                <Animated.View pointerEvents="none" style={[s.halo, { width: GLOW_S*1.8,  height: GLOW_S*1.8,  borderRadius: GLOW_S*0.90,  backgroundColor:"rgba(255,209,102,0.05)" }, stH3] as any} />
                <Animated.View pointerEvents="none" style={[s.halo, { width: GLOW_S*1.25, height: GLOW_S*1.25, borderRadius: GLOW_S*0.625, backgroundColor:"rgba(255,209,102,0.11)" }, stH2] as any} />
                <Animated.View pointerEvents="none" style={[s.halo, { width: GLOW_S*0.85, height: GLOW_S*0.85, borderRadius: GLOW_S*0.425, backgroundColor:"rgba(255,209,102,0.22)" }, stH1] as any} />
              </>
            )}
            <Animated.View pointerEvents="none" style={[s.halo, { width: EMOJI_S*1.6, height: EMOJI_S*1.6, borderRadius: EMOJI_S*0.8, backgroundColor:"rgba(255,209,102,0.30)" }, stGlow] as any} />
            {!reduceMotion && SPARKS.map((sp, i) => <Spark key={i} {...sp} prog={burst} />)}
            <Animated.View style={[s.emojiWrap, stEmji] as any}>
              <LinearGradient colors={["rgba(255,209,102,0.20)","rgba(255,209,102,0.06)"]} style={[s.emojiShell, { width: EMOJI_S*1.4, height: EMOJI_S*1.4, borderRadius: EMOJI_S*0.7, borderColor: C.glassBorder }]}>
                <Text style={{ fontSize: EMOJI_S, lineHeight: EMOJI_S*1.1 }}>🏆</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          <Animated.View style={[s.center, stRew, { gap: GAP*0.35, marginTop: GAP*0.5 }] as any}>
            <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: KKR_S, color: C.gold, letterSpacing:2.4, textAlign:"center" }}>
              {t("completion.modalTitle", { defaultValue:"CHALLENGE TERMINÉ" }).toUpperCase()}
            </Text>
            <Animated.View style={[s.ctrRow, stCtr] as any}>
              <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: CTR_S*0.50, color: C.gold, marginBottom: CTR_S*0.07 }}>+</Text>
              <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: CTR_S, color: C.gold, lineHeight: CTR_S*1.1 }}>{displayed}</Text>
              <Ionicons name="trophy" size={CTR_S*0.37} color={C.gold} style={{ marginBottom: CTR_S*0.05, marginLeft:5 }} />
            </Animated.View>
            <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: KKR_S, color: C.whiteDim, letterSpacing:1.7, textAlign:"center" }}>
              {t("completion.trophiesEarned", { defaultValue:"TROPHÉES GAGNÉS" }).toUpperCase()}
            </Text>
          </Animated.View>

          <Animated.View style={[s.statsRow, stRew, { gap: GAP, marginTop: GAP }] as any}>
            <LinearGradient colors={["rgba(255,255,255,0.07)","rgba(255,255,255,0.03)"]} style={[s.statCard, { borderColor: C.glassBorderSoft, flex:1 }]}>
              <View style={s.statTop}>
                <Ionicons name="calendar-outline" size={13} color={C.gold} />
                <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: BDY_S-1, color: C.whiteDim }} numberOfLines={1}>{t("challengeDetails.daysCompleted", { defaultValue:"Jours complétés" })}</Text>
              </View>
              <View style={s.statBot}>
                <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BDY_S+5, color: C.white }}>{selectedDays}/{selectedDays}</Text>
                <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BDY_S-1, color: C.gold }}>100%</Text>
              </View>
            </LinearGradient>
            <LinearGradient colors={["rgba(255,255,255,0.07)","rgba(255,255,255,0.03)"]} style={[s.statCard, { borderColor: C.glassBorderSoft, flex:1 }]}>
              <View style={s.statTop}>
                <Ionicons name="flame-outline" size={13} color={C.orange} />
                <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: BDY_S-1, color: C.whiteDim }} numberOfLines={1}>{t("completion.bestStreak", { defaultValue:"Meilleur streak" })}</Text>
              </View>
              <View style={s.statBot}>
                <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BDY_S+5, color: C.white }}>{streak > 0 ? streak : selectedDays}</Text>
                <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BDY_S-1, color: C.orange }}>{t("completion.days", { defaultValue:"j" })}</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[{ alignItems:"center" as const, marginTop: GAP*0.55 }, stRew] as any}>
            <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: BDY_S, color: C.whiteSoft, textAlign:"center" }} numberOfLines={1}>★ {t(phraseKey)}</Text>
          </Animated.View>

          {/* ── Phase 1 : CTA principal (récupérer + doubler) ── */}
          {!showNextStep && (
            <Animated.View style={[s.ctaBlock, stCta, { gap: GAP, marginTop: GAP }] as any}>
              <Pressable disabled={!canContinue} onPress={() => handleComplete(false)} accessibilityRole="button"
                style={({ pressed }) => [s.btnWrap, { opacity: !canContinue ? 0.46 : pressed ? 0.84 : 1 }]}>
                <LinearGradient colors={[C.white, "rgba(255,255,255,0.88)"]} style={[s.continueBtn, { paddingVertical: BTN_PY }]}>
                  <Ionicons name="checkmark-circle" size={BTN_FS+2} color="#1A0800" />
                  <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BTN_FS, color:"#1A0800", letterSpacing:0.3 }}>
                    {busy ? t("commonS.sending", { defaultValue:"Envoi…" }) : t("completion.continue", { defaultValue:"Récupérer ma récompense" })}
                  </Text>
                  {busy && <ActivityIndicator size="small" color="#1A0800" style={{ marginLeft:8 }} />}
                </LinearGradient>
              </Pressable>

              <View style={[s.row2, { gap: GAP }]}>
                <Pressable disabled={!canDouble} onPress={() => handleComplete(true)} accessibilityRole="button"
                  style={({ pressed }) => [s.dblWrap, { opacity: !canDouble ? 0.38 : pressed ? 0.80 : 1 }]}>
                  <LinearGradient
                    colors={canDouble ? ["rgba(255,209,102,0.20)","rgba(255,209,102,0.07)"] : ["rgba(255,255,255,0.05)","rgba(255,255,255,0.02)"]}
                    style={[s.dblBtn, { paddingVertical: BTN_PY*0.82, borderColor: canDouble ? C.glassBorder : C.glassBorderSoft }]}>
                    <Ionicons name="videocam-outline" size={BTN_FS} color={canDouble ? C.gold : C.whiteDim} />
                    <View style={{ flex:1, minWidth:0 }}>
                      <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BTN_FS-1, color: canDouble ? C.gold : C.whiteDim }} numberOfLines={1}>
                        {t("completion.doubleTrophies", { defaultValue:"Doubler" })} +{rt.dbl}🏆
                      </Text>
                      <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: KKR_S, color: C.whiteDim, marginTop:1 }} numberOfLines={1}>
                        {adError ?? (rewardedLoading ? t("completion.adLoading", { defaultValue:"Chargement…" }) : !rewardedReady ? t("completion.adNotReady", { defaultValue:"Pub pas prête" }) : t("completion.watchAdHint", { defaultValue:"Pub courte" }))}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={handleShare} accessibilityRole="button"
                  style={({ pressed }) => [s.shrWrap, { opacity: pressed ? 0.7 : 1 }]}>
                  <LinearGradient colors={["rgba(249,115,22,0.20)","rgba(249,115,22,0.07)"]}
                    style={[s.shrBtn, { paddingVertical: BTN_PY*0.82, paddingHorizontal: BTN_PY*1.1, borderColor:"rgba(249,115,22,0.36)" }]}>
                    <Ionicons name="share-social-outline" size={BTN_FS+1} color={C.orange} />
                    <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize: BTN_FS-1, color: C.orange }}>
                      {t("challengeDetails.actions.shareTitle", { defaultValue:"Partager" })}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* ── Phase 2 : "Qu'est-ce qu'on commence maintenant ?" ── */}
          {showNextStep && (
            <Animated.View style={[{ gap: GAP, marginTop: GAP }, stNextStep] as any}>

              {/* ── Close button haut droite ── */}
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
                  onClose?.();
                  setTimeout(() => router.replace(`/challenge-details/${challengeId}` as any), 280);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
                style={({ pressed }) => ({
                  position: "absolute" as const,
                  top: -GAP * 0.5,
                  right: 0,
                  zIndex: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center" as const,
                  justifyContent: "center" as const,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.12)",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="close" size={18} color={C.whiteSoft} />
              </Pressable>

              {/* ScrollView interne pour petits écrans */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ gap: GAP, paddingBottom: 4 }}
                style={{ maxHeight: isTiny ? 280 : isSmall ? 320 : 400 }}
              >

                {/* Texte identitaire */}
                <View style={{
                  flexDirection: "row", alignItems: "flex-start", gap: 10,
                  paddingHorizontal: 12, paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,209,102,0.08)",
                  borderWidth: 1, borderColor: "rgba(255,209,102,0.20)",
                }}>
                  <View style={{ width: 3, borderRadius: 2, alignSelf: "stretch", backgroundColor: C.gold, flexShrink: 0 }} />
                  <Text
                    style={{ flex: 1, fontFamily: "Comfortaa_700Bold", fontSize: BDY_S, color: C.white, lineHeight: BDY_S * 1.45, opacity: 0.90 }}
                    numberOfLines={4}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {identityText}
                  </Text>
                </View>

                {/* Label section */}
                <Text
                  style={{ fontFamily: "Comfortaa_700Bold", fontSize: KKR_S, color: C.gold, letterSpacing: 2, textAlign: "center" }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {t("completion.nextStep.label", { defaultValue: "ET MAINTENANT ?" }).toUpperCase()}
                </Text>

                {/* Option 1 : Défi de la même catégorie */}
                {suggestedChallenges.length > 0 && (
                  <Pressable
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
                      onClose?.();
                      setTimeout(() => {
                        router.push(`/challenge-details/${suggestedChallenges[0].id}` as any);
                      }, 280);
                    }}
                    style={({ pressed }) => [s.btnWrap, { opacity: pressed ? 0.84 : 1 }]}
                  >
                    <LinearGradient colors={[C.white, "rgba(255,255,255,0.88)"]} style={[s.continueBtn, { paddingVertical: BTN_PY }]}>
                      <Ionicons name="flame" size={BTN_FS + 2} color="#1A0800" style={{ flexShrink: 0 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ fontFamily: "Comfortaa_700Bold", fontSize: BTN_FS - 1, color: "#1A0800" }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.80}
                        >
                          {t("completion.nextStep.newChallenge", { defaultValue: "Continuer sur ta lancée 🔥" })}
                        </Text>
                        <Text
                          style={{ fontFamily: "Comfortaa_400Regular", fontSize: KKR_S, color: "rgba(26,8,0,0.60)", marginTop: 2 }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                          ellipsizeMode="tail"
                        >
                          {suggestedChallenges[0].title}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={BTN_FS} color="rgba(26,8,0,0.50)" style={{ flexShrink: 0 }} />
                    </LinearGradient>
                  </Pressable>
                )}

                {/* Option 2 : Inviter en Duo */}
                {!!onInviteDuo && (
                  <Pressable
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
                      onClose?.();
                      setTimeout(() => onInviteDuo!(), 280);
                    }}
                    style={({ pressed }) => [s.dblWrap, { opacity: pressed ? 0.80 : 1 }]}
                  >
                    <LinearGradient
                      colors={["rgba(99,102,241,0.22)", "rgba(99,102,241,0.08)"]}
                      style={[s.dblBtn, {
                        paddingVertical: BTN_PY * 0.90,
                        borderColor: "rgba(99,102,241,0.30)",
                        borderWidth: 1,
                      }]}
                    >
                      <Ionicons name="people" size={BTN_FS + 2} color="#6366F1" style={{ flexShrink: 0 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ fontFamily: "Comfortaa_700Bold", fontSize: BTN_FS - 1, color: "#A5B4FC" }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.80}
                        >
                          {t("completion.nextStep.inviteDuo", { defaultValue: "Défie quelqu'un 👥" })}
                        </Text>
                        <Text
                          style={{ fontFamily: "Comfortaa_400Regular", fontSize: KKR_S, color: "rgba(165,180,252,0.70)", marginTop: 2 }}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                        >
                          {t("completion.nextStep.inviteDuoSub", { defaultValue: "Avec un partenaire, tu tiens 2x plus." })}
                        </Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                )}

                {/* Option 3 : Explorer — toujours présent comme fallback discret */}
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
                    onClose?.();
                    setTimeout(() => router.push("/explore" as any), 280);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : 0.55, alignItems: "center" as const, paddingVertical: 6 })}
                >
                  <Text
                    style={{ fontFamily: "Comfortaa_400Regular", fontSize: KKR_S, color: C.whiteDim, textDecorationLine: "underline" }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {t("completion.nextStep.explore", { defaultValue: "Explorer tous les défis →" })}
                  </Text>
                </Pressable>

              </ScrollView>
            </Animated.View>
          )}

         {!showNextStep && (
            <Animated.View style={[{ marginTop: GAP*0.65 }, stCta] as any}>
              <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize: KKR_S, color: C.whiteDim, textAlign:"center", lineHeight: KKR_S*1.55 }} numberOfLines={2}>
                {t("completion.footer", { defaultValue:"Tu viens de tenir ta parole. C'est comme ça que l'identité change." })}
              </Text>
            </Animated.View>
          )}

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:     { ...StyleSheet.absoluteFillObject, zIndex: 999999, elevation: 999999 },
  card:     { ...StyleSheet.absoluteFillObject, overflow: "hidden", justifyContent: "space-between" },
  hairline: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, opacity: 0.75, zIndex: 1 },
  sheen:    { position: "absolute", top: -250, bottom: -250, width: 86, backgroundColor: "rgba(255,209,102,0.09)", borderRadius: 999, zIndex: 0 },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 },
  chip:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" },
  hero:     { width: "100%", alignItems: "center", justifyContent: "center", overflow: "visible", zIndex: 1 },
  halo:     { position: "absolute", alignSelf: "center" },
  emojiWrap:  { alignItems: "center", justifyContent: "center" },
  emojiShell: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  center:   { alignItems: "center", zIndex: 2 },
  ctrRow:   { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  statsRow: { flexDirection: "row", zIndex: 2 },
  statCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  statTop:  { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  statBot:  { flexDirection: "row", alignItems: "baseline", gap: 4 },
  ctaBlock: { zIndex: 2 },
  btnWrap:  { borderRadius: 18, overflow: "hidden" },
  continueBtn: { borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 10 },
  row2:    { flexDirection: "row", alignItems: "stretch" },
  dblWrap: { flex: 1, borderRadius: 16, overflow: "hidden" },
  dblBtn:  { borderRadius: 16, borderWidth: 1, flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  shrWrap: { borderRadius: 16, overflow: "hidden" },
  shrBtn:  { borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
});
