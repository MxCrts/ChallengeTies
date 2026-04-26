import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
  useWindowDimensions,
  I18nManager,
  PixelRatio,
} from "react-native";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  increment,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import ModalExplicatif from "../components/ModalExplicatif";
import FeatureDetailModal from "../components/FeatureDetailModal";
import ProposeFeatureModal from "../components/ProposeFeatureModal";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import { useShareCard } from "@/hooks/useShareCard";
import { FeatureShareCard } from "@/components/ShareCards";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { incStat } from "@/src/services/metricsService";
import { useToast } from "@/src/ui/Toast";
import { translateFeature } from "../services/translationService";

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get("window");

const normalize = (size: number) => {
  const scale = Math.min(Math.max(SW / 375, 0.78), 1.9);
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

const ANDROID_HAIRLINE =
  Platform.OS === "android"
    ? Math.max(1 / PixelRatio.get(), 0.75)
    : StyleSheet.hairlineWidth;

// ─── Types ────────────────────────────────────────────────────────────────────
interface CountdownValues { days: number; hours: number; mins: number; secs: number }
interface Feature {
  id: string; title: string; votes: number;
  approved?: boolean; description?: string; username?: string;
}
interface User { uid: string; username?: string; votedFor?: string; [key: string]: any }

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  orange:     "#F97316",
  orangeLight:"#FB923C",
  orangeGlow: "rgba(249,115,22,0.22)",
  violet:     "#818CF8",
  violetDim:  "rgba(129,140,248,0.18)",
  white:      "#F8FAFC",
  ink:        "#0B1120",
  glass:      "rgba(255,255,255,0.06)",
  glassBright:"rgba(255,255,255,0.11)",
  stroke:     "rgba(255,255,255,0.10)",
  strokeLight:"rgba(2,6,23,0.08)",
} as const;

// ─── Animated countdown digit ────────────────────────────────────────────────
const CountUnit = React.memo(({
  value, label, isDark,
}: { value: number; label: string; isDark: boolean }) => {
  const prev = React.useRef(value);
  const flip = useSharedValue(0);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      flip.value = withSequence(
        withTiming(-8, { duration: 80, easing: Easing.out(Easing.ease) }),
        withTiming(0,  { duration: 120, easing: Easing.out(Easing.back(2)) }),
      );
    }
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: flip.value }],
  }));

  const numStr = String(value).padStart(2, "0");

  return (
    <View style={cu.box}>
      <LinearGradient
        colors={isDark
          ? ["rgba(255,255,255,0.09)", "rgba(255,255,255,0.04)"]
          : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.75)"]}
        style={cu.glass}
      >
        <View style={[cu.rim, { borderColor: isDark ? C.stroke : C.strokeLight }]} />
        <Animated.Text
          style={[cu.num, { color: isDark ? C.white : C.ink }, animStyle]}
          numberOfLines={1}
        >
          {numStr}
        </Animated.Text>
      </LinearGradient>
      <Text style={[cu.lbl, { color: isDark ? "rgba(226,232,240,0.65)" : "rgba(15,23,42,0.55)" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const cu = StyleSheet.create({
  box:   { alignItems: "center", flex: 1 },
  glass: {
    width: "90%", aspectRatio: 1,
    borderRadius: normalize(14), alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalize(14), borderWidth: ANDROID_HAIRLINE,
  },
  num: {
    fontSize: normalize(26), fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false, letterSpacing: -0.5,
    ...(Platform.OS === "ios" ? { fontVariant: ["tabular-nums"] } : {}),
  },
  lbl: {
    marginTop: normalize(6), fontSize: normalize(10),
    fontFamily: "Comfortaa_700Bold", letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

// ─── Feature card ─────────────────────────────────────────────────────────────
const FeatureCard = React.memo(({
  item, index, isDark, userVote, t, currentTheme,
  onPress, onVote, onShare,
}: {
  item: Feature; index: number; isDark: boolean; userVote: string | null;
  t: any; currentTheme: any;
  onPress: () => void; onVote: () => void; onShare: () => void;
}) => {
  const isVotedThis = userVote === item.id;
  const hasVotedAny = !!userVote;

  const rank = index + 1;
  const rankColor = rank === 1 ? "#FBBF24" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : null;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).springify().damping(18)}
      style={[
        fc.card,
        {
          borderColor: isVotedThis
            ? (isDark ? "rgba(249,115,22,0.45)" : "rgba(249,115,22,0.35)")
            : (isDark ? C.stroke : C.strokeLight),
          backgroundColor: isDark
            ? isVotedThis ? "rgba(249,115,22,0.07)" : "rgba(255,255,255,0.045)"
            : isVotedThis ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.82)",
        },
      ]}
    >
      {/* voted glow */}
      {isVotedThis && (
        <LinearGradient
          colors={["rgba(249,115,22,0.14)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={fc.inner}>
        {/* ── Header row ── */}
        <View style={fc.headerRow}>
          <View style={fc.titleWrap}>
            {rankColor && (
              <View style={[fc.rankBadge, { backgroundColor: rankColor + "22", borderColor: rankColor + "44" }]}>
                <Text style={[fc.rankText, { color: rankColor }]}>#{rank}</Text>
              </View>
            )}
            <Text
              style={[fc.title, {
                color: isDark ? C.white : C.ink,
                textAlign: I18nManager.isRTL ? "right" : "left",
              }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>

          {/* votes pill */}
          <View style={[fc.votesPill, {
            backgroundColor: isDark ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.10)",
            borderColor: isDark ? "rgba(249,115,22,0.28)" : "rgba(249,115,22,0.22)",
          }]}>
            <Ionicons name="heart" size={normalize(11)} color={C.orange} />
            <Text style={[fc.votesNum, { color: C.orange }]}>{item.votes}</Text>
          </View>
        </View>

        {/* by line */}
        {item.username && (
          <Text style={[fc.by, {
            color: isDark ? "rgba(226,232,240,0.50)" : "rgba(15,23,42,0.45)",
            textAlign: I18nManager.isRTL ? "right" : "left",
          }]} numberOfLines={1}>
            {t("newFeatures.byTpl", { username: item.username, defaultValue: "par {{username}}" })}
          </Text>
        )}

        {/* description */}
        {item.description ? (
          <Text style={[fc.desc, {
            color: isDark ? "rgba(226,232,240,0.68)" : "rgba(15,23,42,0.62)",
            textAlign: I18nManager.isRTL ? "right" : "left",
          }]} numberOfLines={SW > 600 ? 4 : 2} ellipsizeMode="tail">
            {item.description}
          </Text>
        ) : null}

        {/* ── Actions ── */}
        <View style={fc.actions}>
          <TouchableOpacity
            onPress={onVote}
            disabled={hasVotedAny}
            activeOpacity={0.85}
            style={[fc.voteBtn, {
              backgroundColor: hasVotedAny
                ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.07)")
                : C.orange,
              borderColor: hasVotedAny
                ? (isDark ? C.stroke : C.strokeLight)
                : "transparent",
            }]}
          >
            {isVotedThis && (
              <Ionicons name="checkmark" size={normalize(14)} color={isDark ? "rgba(226,232,240,0.80)" : "rgba(15,23,42,0.70)"} style={{ marginRight: normalize(4) }} />
            )}
            <Text style={[fc.voteBtnText, {
              color: hasVotedAny
                ? (isDark ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.55)")
                : C.ink,
            }]} numberOfLines={1}>
              {isVotedThis
                ? t("newFeatures.voted", { defaultValue: "Voté ✓" })
                : hasVotedAny
                  ? t("newFeatures.alreadyVotedShort", { defaultValue: "Déjà voté" })
                  : t("newFeatures.vote", { defaultValue: "Voter" })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onShare} activeOpacity={0.85} style={[fc.shareBtn, {
            backgroundColor: isDark ? C.glass : "rgba(2,6,23,0.05)",
            borderColor: isDark ? C.stroke : C.strokeLight,
          }]}>
            <Ionicons name="share-social-outline" size={normalize(15)} color={isDark ? "rgba(226,232,240,0.85)" : "rgba(15,23,42,0.80)"} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const fc = StyleSheet.create({
  card: {
    borderRadius: normalize(20), borderWidth: ANDROID_HAIRLINE,
    marginBottom: normalize(10), overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  inner: { padding: normalize(16) },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: normalize(10), marginBottom: normalize(6),
  },
  titleWrap: { flex: 1, minWidth: 0, gap: normalize(6) },
  rankBadge: {
    alignSelf: "flex-start", paddingHorizontal: normalize(8), paddingVertical: normalize(3),
    borderRadius: normalize(6), borderWidth: ANDROID_HAIRLINE, marginBottom: normalize(2),
  },
  rankText: { fontSize: normalize(11), fontFamily: "Comfortaa_700Bold", letterSpacing: 0.3 },
  title: { fontSize: normalize(15), fontFamily: "Comfortaa_700Bold", letterSpacing: -0.2, lineHeight: normalize(20) },
  votesPill: {
    flexDirection: "row", alignItems: "center", gap: normalize(4),
    paddingHorizontal: normalize(9), paddingVertical: normalize(5),
    borderRadius: normalize(999), borderWidth: ANDROID_HAIRLINE, flexShrink: 0,
  },
  votesNum: { fontSize: normalize(12), fontFamily: "Comfortaa_700Bold" },
  by: { fontSize: normalize(11.5), fontFamily: "Comfortaa_400Regular", marginBottom: normalize(8) },
  desc: { fontSize: normalize(12.5), fontFamily: "Comfortaa_400Regular", lineHeight: normalize(18), marginBottom: normalize(12) },
  actions: { flexDirection: "row", alignItems: "center", gap: normalize(10), marginTop: normalize(4) },
  voteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: normalize(10), paddingHorizontal: normalize(14),
    borderRadius: normalize(12), borderWidth: ANDROID_HAIRLINE,
    ...Platform.select({
      ios: { shadowColor: C.orange, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: {},
    }),
  },
  voteBtnText: { fontSize: normalize(13), fontFamily: "Comfortaa_700Bold" },
  shareBtn: {
    width: normalize(40), height: normalize(40), borderRadius: normalize(12),
    alignItems: "center", justifyContent: "center", borderWidth: ANDROID_HAIRLINE,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function NewFeatures() {
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [votedTitle, setVotedTitle] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownValues>({ days: 0, hours: 0, mins: 0, secs: 0 });
  const { width: W } = useWindowDimensions();
  const isTablet = W >= 700;
  const pad = Math.max(normalize(14), Math.min(normalize(20), Math.round(W * 0.042)));
  const npa = (globalThis as any).__NPA__ === true;
  const [user, setUser] = useState<User | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showFeatureDetailModal, setShowFeatureDetailModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();
  const currentTheme: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const { showInterstitials } = useAdsVisibility();
  const { ref: featureShareRef, share: shareFeatureCard } = useShareCard();
  const [featureSharePayload, setFeatureSharePayload] = useState<{
    id: string; title: string; votes: number; username?: string; deepLink?: string;
  } | null>(null);

  // ── pulse for propose button ──
  const proposePulse = useSharedValue(0);
  useEffect(() => {
    proposePulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true
    );
  }, []);
  const proposePulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + proposePulse.value * 0.20,
    transform: [{ scale: 1 + proposePulse.value * 0.012 }],
  }));

  // ── Ads ──
  const interstitialAdUnitId = __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({
        ios: "ca-app-pub-4725616526467159/3625641580",
        android: "ca-app-pub-4725616526467159/1602005670",
      })!;
  const interstitialRef = React.useRef<InterstitialAd | null>(null);

  const checkAdCooldown = useCallback(async () => {
    const last = await AsyncStorage.getItem("lastInterstitialTime");
    if (!last) return true;
    return Date.now() - parseInt(last) > 5 * 60 * 1000;
  }, []);
  const markAdShown = useCallback(async () => {
    await AsyncStorage.setItem("lastInterstitialTime", Date.now().toString());
  }, []);

  useEffect(() => {
    if (!showInterstitials) { interstitialRef.current = null; setAdLoaded(false); return; }
    const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, { requestNonPersonalizedAdsOnly: npa });
    interstitialRef.current = ad;
    const s1 = ad.addAdEventListener(AdEventType.LOADED, () => setAdLoaded(true));
    const s2 = ad.addAdEventListener(AdEventType.ERROR, () => setAdLoaded(false));
    const s3 = ad.addAdEventListener(AdEventType.CLOSED, () => { setAdLoaded(false); try { ad.load(); } catch {} });
    try { ad.load(); } catch {}
    return () => { s1(); s2(); s3(); interstitialRef.current = null; setAdLoaded(false); };
  }, [showInterstitials, interstitialAdUnitId]);

  // ── Auth ──
  useEffect(() => {
    return onAuthStateChanged(auth, async (fu) => {
      if (fu) {
        try {
          const snap = await getDoc(doc(db, "users", fu.uid));
          setUser(snap.exists() ? { ...snap.data(), uid: fu.uid } as User : { uid: fu.uid });
          setUserVote(snap.exists() ? snap.data().votedFor || null : null);
        } catch { setUser({ uid: fu.uid }); }
      } else { setUser(null); setUserVote(null); }
    });
  }, []);

  // ── Modal once ──
  useEffect(() => {
    AsyncStorage.getItem("explanationModalShown").then(v => {
      if (!v) { setShowExplanationModal(true); AsyncStorage.setItem("explanationModalShown", "true"); }
    });
  }, []);

  // ── Features ──
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const ref = collection(db, "polls", "new-features", "features");
    return onSnapshot(ref, snap => {
      setFeatures(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() as Omit<Feature, "id"> }))
          .filter(f => f.approved)
          .sort((a, b) => b.votes - a.votes)
      );
      setLoading(false);
    }, () => setLoading(false));
  }, [user?.uid]);

  // ── Traduit les features ──────────────────────────────────────────────────
  const translatingFeaturesRef = React.useRef<Set<string>>(new Set());
  const [featureTranslations, setFeatureTranslations] = React.useState<Record<string, { title?: string; description?: string }>>({});

  useEffect(() => {
    if (!features.length) return;
    const lang = i18n.language;

    features.forEach(async (f) => {
      const key = `${f.id}:${lang}`;
      if (translatingFeaturesRef.current.has(key)) return;
      translatingFeaturesRef.current.add(key);

      const result = await translateFeature(f.id, lang);
      if (!result) {
        translatingFeaturesRef.current.delete(key);
        return;
      }

      setFeatureTranslations(prev => ({
        ...prev,
        [key]: { title: result.title, description: result.description },
      }));
    });
  }, [features, i18n.language]);

  // ── Countdown — deadline 31 mars 2026 ──
  // ⚠️ On hardcode la date directement pour éviter que les clés i18n
  //    (qui contiennent encore l'ancienne valeur février) remettent le compteur à zéro.
  useEffect(() => {
    const DEADLINE = new Date("2026-04-30T23:59:59+02:00");
    const tick = () => {
      const diff = DEADLINE.getTime() - Date.now();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 }); return; }
      setCountdown({
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000) / 60000),
        secs:  Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Month label (mars) ──
  // ⚠️ Construit directement sans passer par deadlineIso i18n
  //    pour éviter que les vieilles clés de traduction affichent encore "Février".
  const monthLabel = useMemo(() => {
    const name = t("newFeatures.months.04", { defaultValue: "Avril" });
    return t("newFeatures.monthLabelTpl", { month: name, defaultValue: `Mise à jour • ${name}` });
  }, [t, i18n.language]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Vote ──
  const handleVote = useCallback(async (featureId: string) => {
    if (!user?.uid) { show(t("newFeatures.loginRequiredMessage"), "warning"); try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} return; }
    if (userVote) { show(t("newFeatures.alreadyVotedMessage"), "info"); try { Haptics.selectionAsync(); } catch {} return; }
    try {
      const featureRef = doc(db, "polls", "new-features", "features", featureId);
      const userRef = doc(db, "users", user.uid);
      await runTransaction(db, async tx => {
        const snap = await tx.get(userRef);
        if (snap.exists() && snap.data()?.votedFor) throw new Error("already_voted");
        tx.update(featureRef, { votes: increment(1) });
        tx.update(userRef, { votedFor: featureId });
      });
      try { await incStat(user.uid, "voteFeature.total", 1); } catch {}
      setUserVote(featureId);
      const f = features.find(x => x.id === featureId);
      if (f?.title) setVotedTitle(f.title);
      try { await checkForAchievements(user.uid); } catch {}
      const ok = await checkAdCooldown();
      if (showInterstitials && ok && adLoaded && interstitialRef.current) {
        try { await interstitialRef.current.show(); await markAdShown(); } catch {}
        setAdLoaded(false);
        try { interstitialRef.current.load(); } catch {}
      }
      show(t("newFeatures.voteRegisteredMessage"), "success");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (e: any) {
      if (e?.message === "already_voted") { setUserVote(p => p ?? featureId); show(t("newFeatures.alreadyVotedMessage"), "info"); return; }
      show(t("newFeatures.voteErrorMessage"), "error");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    }
  }, [user, userVote, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials, show, features]);

  // ── Propose ──
  const handleProposeFeature = useCallback(async (title: string, description?: string) => {
    if (!user?.uid) { show(t("newFeatures.loginRequiredMessage"), "warning"); return; }
    if (userVote) { show(t("newFeatures.alreadyVotedMessage"), "info"); return; }
    try {
      const ref = await addDoc(collection(db, "polls", "new-features", "features"), {
        title, description: description || "", votes: 1, approved: false,
        username: user.username || t("newFeatures.unknown"),
      });
      await setDoc(doc(db, "users", user.uid), { votedFor: ref.id }, { merge: true });
      try { await incStat(user.uid, "voteFeature.total", 1); } catch {}
      setUserVote(ref.id); setVotedTitle(title);
      try { await checkForAchievements(user.uid); } catch {}
      const ok = await checkAdCooldown();
      if (showInterstitials && ok && adLoaded && interstitialRef.current) {
        await interstitialRef.current.show(); await markAdShown();
        setAdLoaded(false); interstitialRef.current.load();
      }
      show(t("newFeatures.proposalSentMessage"), "success");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch { show(t("newFeatures.proposalErrorMessage"), "error"); }
  }, [user, userVote, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials, show]);

  // ── Share ──
  const handleShareFeature = useCallback(async (feature: Feature) => {
    try {
      try { await Haptics.selectionAsync(); } catch {}
      setFeatureSharePayload({ id: feature.id, title: feature.title, votes: feature.votes ?? 0, username: feature.username });
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      await shareFeatureCard(`ct-feature-${feature.id}-${Date.now()}.png`, t("newFeatures.shareDialogTitle", { defaultValue: "Partager cette nouveauté" }));
      const uid = auth.currentUser?.uid;
      if (uid) { try { await incStat(uid, "shareChallenge.total", 1); await checkForAchievements(uid); } catch {} }
    } catch {} finally { setFeatureSharePayload(null); }
  }, [t, shareFeatureCard]);

  // ── Render item ──
  const renderItem = useCallback(({ item, index }: { item: Feature; index: number }) => {
    const lang = i18n.language;
    const translated = featureTranslations[`${item.id}:${lang}`];
    const displayItem = translated
      ? { ...item, title: translated.title || item.title, description: translated.description || item.description }
      : item;

    return (
    <FeatureCard
      item={displayItem} index={index} isDark={isDark} userVote={userVote}
      t={t} currentTheme={currentTheme}
      onPress={() => { setSelectedFeature(item); setShowFeatureDetailModal(true); }}
      onVote={() => { if (!userVote) handleVote(item.id); }}
      onShare={() => handleShareFeature(item)}
    />
    );
  }, [isDark, userVote, t, currentTheme, handleVote, handleShareFeature, featureTranslations, i18n.language]);

  // ── Loading screen ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? C.ink : "#F8FAFC" }}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: normalize(14) }}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: normalize(14), color: isDark ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.60)" }}>
            {t("newFeatures.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const countdownLabels = [
    t("newFeatures.countdown.days",  { defaultValue: "JOURS" }),
    t("newFeatures.countdown.hours", { defaultValue: "H" }),
    t("newFeatures.countdown.mins",  { defaultValue: "MIN" }),
    t("newFeatures.countdown.secs",  { defaultValue: "SEC" }),
  ];
  const countdownValues = [countdown.days, countdown.hours, countdown.mins, countdown.secs];

  return (
    <LinearGradient
      colors={isDark
        ? ["#0B1120", "#0F172A", "#131B2E"]
        : ["#F8FAFC", "#EFF6FF", "#F0FDF4"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Ambient orbs */}
      <View pointerEvents="none" style={[s.orb1, {
        backgroundColor: isDark ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.06)",
      }]} />
      <View pointerEvents="none" style={[s.orb2, {
        backgroundColor: isDark ? "rgba(129,140,248,0.07)" : "rgba(99,102,241,0.05)",
      }]} />

      {/* edges="bottom" : on gère le top manuellement via paddingTop: insets.top
          comme Tips.tsx — évite que le header se retrouve sous la status bar */}
      <SafeAreaView style={{ flex: 1, paddingTop: insets.top }}>
        <CustomHeader
          title={t("newFeatures.title")}
          rightIcon={
            <TouchableOpacity
              onPress={() => setShowExplanationModal(true)}
              accessibilityLabel={t("newFeatures.openExplanation")}
              hitSlop={10}
            >
              <Ionicons name="help-circle-outline" size={normalize(26)} color={C.orange} />
            </TouchableOpacity>
          }
        />

        <FlatList
          data={features}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={9}
          contentContainerStyle={[s.listContent, { paddingHorizontal: pad, paddingBottom: insets.bottom + normalize(32) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={C.orange} colors={[C.orange]} progressViewOffset={normalize(8)} />
          }
          ListHeaderComponent={
            <View style={{ paddingTop: normalize(4) }}>

              {/* ── HERO BANNER ── */}
              <Animated.View entering={FadeInUp.springify().damping(18)} style={[s.heroBanner, {
                borderColor: isDark ? C.stroke : C.strokeLight,
              }]}>
                <LinearGradient
                  colors={["#F97316", "#EA580C", "#C2410C"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* top shine */}
                <LinearGradient
                  colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: normalize(22) }]}
                  pointerEvents="none"
                />
                {/* content */}
                <View style={s.heroInner}>
                  <View style={s.heroPill}>
                    <Ionicons name="sparkles" size={normalize(12)} color="rgba(255,255,255,0.90)" />
                    <Text style={s.heroPillText} numberOfLines={1}>{monthLabel}</Text>
                  </View>
                  <Text style={s.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>
                    {t("newFeatures.heroTitle", { defaultValue: "Vote pour les prochaines fonctionnalités" })}
                  </Text>
                  <Text style={s.heroSub} numberOfLines={3}>
                    {t("newFeatures.heroSubtitle", { defaultValue: "Ta voix façonne l'app. Un vote par mois, une vraie influence." })}
                  </Text>
                </View>
                {/* decorative circles */}
                <View pointerEvents="none" style={s.heroDeco1} />
                <View pointerEvents="none" style={s.heroDeco2} />
              </Animated.View>

              {/* ── COUNTDOWN ── */}
              <Animated.View entering={FadeInUp.delay(80).springify().damping(18)} style={[s.countdownShell, {
                borderColor: isDark ? C.stroke : C.strokeLight,
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
              }]}>
                {/* tint glow */}
                <LinearGradient
                  colors={isDark
                    ? ["rgba(249,115,22,0.08)", "rgba(0,0,0,0)"]
                    : ["rgba(249,115,22,0.05)", "rgba(0,0,0,0)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: normalize(20) }]}
                  pointerEvents="none"
                />
                <View style={s.countdownTop}>
                  <Ionicons name="time-outline" size={normalize(14)} color={C.orange} />
                  {/* ⚠️ On bypass la clé i18n countdownTitle qui contient encore "fin février"
                      et on affiche directement la string à jour "31 mars" */}
                  <Text style={[s.countdownLabel, { color: isDark ? "rgba(226,232,240,0.75)" : "rgba(15,23,42,0.65)" }]} numberOfLines={1}>
                    {t("newFeatures.countdownTitleAvril", { defaultValue: "Vote ouvert jusqu'au 30 avril" })}
                  </Text>
                </View>
                <View style={s.countdownRow}>
                  {countdownValues.map((v, i) => (
                    <React.Fragment key={i}>
                      <CountUnit value={v} label={countdownLabels[i]} isDark={isDark} />
                      {i < 3 && (
                        <Text style={[s.countdownSep, { color: isDark ? "rgba(226,232,240,0.35)" : "rgba(15,23,42,0.30)" }]}>:</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </Animated.View>

              {/* ── Section title ── */}
              <Animated.View entering={FadeInUp.delay(140).springify().damping(18)} style={s.sectionTitleRow}>
                <View style={s.sectionAccent} />
                <Text style={[s.sectionTitle, { color: isDark ? C.white : C.ink }]} numberOfLines={1}>
                  {t("newFeatures.featuresTitle", { defaultValue: "Propositions" })}
                </Text>
                <View style={[s.featureCount, {
                  backgroundColor: isDark ? C.glass : "rgba(249,115,22,0.10)",
                  borderColor: isDark ? C.stroke : "rgba(249,115,22,0.20)",
                }]}>
                  <Text style={[s.featureCountText, { color: C.orange }]}>{features.length}</Text>
                </View>
              </Animated.View>

            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="bulb-outline" size={normalize(36)} color={isDark ? "rgba(226,232,240,0.35)" : "rgba(15,23,42,0.25)"} />
              <Text style={[s.emptyText, { color: isDark ? "rgba(226,232,240,0.55)" : "rgba(15,23,42,0.50)" }]}>
                {t("newFeatures.noFeatures")}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={s.footer}>
              {userVote ? (
                /* ── Thank you pill ── */
                <Animated.View entering={ZoomIn.springify().damping(16)} style={s.thankYouWrap}>
                  <LinearGradient
                    colors={isDark
                      ? ["rgba(249,115,22,0.22)", "rgba(251,146,60,0.14)"]
                      : ["rgba(249,115,22,0.14)", "rgba(251,146,60,0.08)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.thankYouPill, { borderColor: isDark ? "rgba(249,115,22,0.30)" : "rgba(249,115,22,0.22)" }]}
                  >
                    <Ionicons name="checkmark-circle" size={normalize(18)} color={C.orange} />
                    <Text style={[s.thankYouText, { color: isDark ? C.white : C.ink }]} numberOfLines={1}>
                      {t("newFeatures.thankYouShort", { defaultValue: "Merci pour ton vote 💜" })}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              ) : (
                /* ── Propose button ── */
                <Animated.View style={[s.proposeBtnWrap, proposePulseStyle]}>
                  <TouchableOpacity
                    onPress={() => setShowProposeModal(true)}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    testID="propose-button"
                  >
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.proposeBtn}
                    >
                      <LinearGradient
                        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
                        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: normalize(16) }]}
                        pointerEvents="none"
                      />
                      <Ionicons name="add-circle-outline" size={normalize(18)} color={C.ink} />
                      <Text style={s.proposeBtnText} numberOfLines={1}>
                        {t("newFeatures.proposeIdea")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <Text style={[s.footerMicro, { color: isDark ? "rgba(226,232,240,0.35)" : "rgba(15,23,42,0.35)" }]}>
                {t("newFeatures.footerMicro", { defaultValue: "Les meilleures idées sont intégrées chaque mois." })}
              </Text>
            </View>
          }
        />
      </SafeAreaView>

      {/* Modals */}
      {showExplanationModal && <ModalExplicatif onClose={() => setShowExplanationModal(false)} />}
      {showFeatureDetailModal && selectedFeature && (
        <FeatureDetailModal
          visible={showFeatureDetailModal}
          feature={selectedFeature}
          userVoted={!!userVote}
          onVote={handleVote}
          onShare={() => handleShareFeature(selectedFeature)}
          onClose={() => { setShowFeatureDetailModal(false); setSelectedFeature(null); }}
        />
      )}
      {showProposeModal && (
        <ProposeFeatureModal visible={showProposeModal} onClose={() => setShowProposeModal(false)} onSubmit={handleProposeFeature} />
      )}

      {/* Hidden share card */}
      {featureSharePayload && (
        <View style={{ position: "absolute", opacity: 0, left: 0, top: 0 }}
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          <FeatureShareCard
            ref={featureShareRef}
            featureTitle={featureSharePayload.title}
            i18n={{
              kicker: t("newFeatures.share.kicker"),
              footer: t("newFeatures.share.footerWithDays", { days: Math.max(0, countdown.days) }),
            }}
          />
        </View>
      )}
    </LinearGradient>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ambient orbs
  orb1: {
    position: "absolute", width: SW * 0.8, height: SW * 0.8,
    borderRadius: SW * 0.4, top: -SW * 0.2, left: -SW * 0.15,
  },
  orb2: {
    position: "absolute", width: SW * 0.9, height: SW * 0.9,
    borderRadius: SW * 0.45, bottom: -SW * 0.3, right: -SW * 0.2,
  },

  listContent: {
    gap: 0,
    paddingTop: normalize(4),
  },

  // ── Hero ──
  heroBanner: {
    borderRadius: normalize(22), overflow: "hidden",
    borderWidth: ANDROID_HAIRLINE, marginBottom: normalize(14),
    ...Platform.select({
      ios: { shadowColor: C.orange, shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },
  heroInner: {
    padding: normalize(18), paddingBottom: normalize(20),
  },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: normalize(6),
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 999,
    paddingHorizontal: normalize(12), paddingVertical: normalize(5),
    borderWidth: ANDROID_HAIRLINE, borderColor: "rgba(255,255,255,0.20)",
    marginBottom: normalize(12),
  },
  heroPillText: {
    fontSize: normalize(11.5), fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.92)", letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: normalize(22), fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF", marginBottom: normalize(8), letterSpacing: -0.3,
    lineHeight: normalize(27),
  },
  heroSub: {
    fontSize: normalize(13), fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.88)", lineHeight: normalize(19),
  },
  heroDeco1: {
    position: "absolute", width: normalize(120), height: normalize(120),
    borderRadius: 999, right: -normalize(30), top: -normalize(30),
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroDeco2: {
    position: "absolute", width: normalize(70), height: normalize(70),
    borderRadius: 999, right: normalize(30), bottom: -normalize(20),
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  // ── Countdown ──
  countdownShell: {
    borderRadius: normalize(20), borderWidth: ANDROID_HAIRLINE,
    paddingHorizontal: normalize(16), paddingVertical: normalize(14),
    marginBottom: normalize(20), overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  countdownTop: {
    flexDirection: "row", alignItems: "center", gap: normalize(8),
    marginBottom: normalize(12),
  },
  countdownLabel: {
    fontSize: normalize(12), fontFamily: "Comfortaa_700Bold",
    flex: 1, letterSpacing: 0.2,
  },
  countdownRow: {
    flexDirection: "row", alignItems: "center",
  },
  countdownSep: {
    fontSize: normalize(22), fontFamily: "Comfortaa_700Bold",
    marginHorizontal: normalize(2), marginBottom: normalize(12),
  },

  // ── Section title row ──
  sectionTitleRow: {
    flexDirection: "row", alignItems: "center",
    gap: normalize(10), marginBottom: normalize(12),
  },
  sectionAccent: {
    width: normalize(4), height: normalize(20), borderRadius: normalize(2),
    backgroundColor: C.orange,
  },
  sectionTitle: {
    flex: 1, fontSize: normalize(17), fontFamily: "Comfortaa_700Bold",
    letterSpacing: -0.2,
  },
  featureCount: {
    paddingHorizontal: normalize(9), paddingVertical: normalize(3),
    borderRadius: normalize(999), borderWidth: ANDROID_HAIRLINE,
  },
  featureCountText: {
    fontSize: normalize(12), fontFamily: "Comfortaa_700Bold",
  },

  // ── Empty ──
  empty: {
    alignItems: "center", gap: normalize(12),
    paddingVertical: normalize(40),
  },
  emptyText: {
    fontSize: normalize(14), fontFamily: "Comfortaa_400Regular",
    textAlign: "center", maxWidth: "75%",
  },

  // ── Footer ──
  footer: {
    paddingTop: normalize(8), alignItems: "center", gap: normalize(14),
    paddingBottom: normalize(8),
  },
  thankYouWrap: { width: "100%" },
  thankYouPill: {
    flexDirection: "row", alignItems: "center", gap: normalize(10),
    paddingVertical: normalize(14), paddingHorizontal: normalize(18),
    borderRadius: normalize(16), borderWidth: ANDROID_HAIRLINE,
    width: "100%", justifyContent: "center",
  },
  thankYouText: {
    fontSize: normalize(14), fontFamily: "Comfortaa_700Bold",
  },
  proposeBtnWrap: {
    width: "100%",
    ...Platform.select({
      ios: { shadowColor: C.orange, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 5 },
    }),
  },
  proposeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: normalize(10), paddingVertical: normalize(14), paddingHorizontal: normalize(20),
    borderRadius: normalize(16), overflow: "hidden",
  },
  proposeBtnText: {
    fontSize: normalize(14), fontFamily: "Comfortaa_700Bold", color: C.ink,
  },
  footerMicro: {
    fontSize: normalize(11.5), fontFamily: "Comfortaa_400Regular",
    textAlign: "center", maxWidth: "80%",
  },
});
