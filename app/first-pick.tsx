import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  AccessibilityInfo,
  Pressable,
  Image as RNImage,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  InteractionManager,
} from "react-native";
import { useRouter, useRootNavigationState, usePathname } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { recordSelectDays } from "../src/services/metricsService";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { useToast } from "../src/ui/Toast";
import { logEvent } from "@/src/analytics";
import { initOnboardingQuests } from "@/src/services/onboardingQuestService";
import { useAuth } from "../context/AuthProvider";
import { ONBOARDING_JUST_FINISHED_KEY } from "../src/hooks/useCoachmark";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACING = 16;
const DEFAULT_DAYS = [7, 14, 21, 30, 60, 90];
const FALLBACK_DURATION_DAYS = [7, 14, 21, 30, 60, 90];
const ORANGE = "#FF8C00";
const GOLD = "#FFD700";
const CTA_GRAD_A = "#FFB000";
const CTA_GRAD_B = "#FF8C00";
const FIRSTPICK_DONE_HARD_KEY = "ties_firstpick_done_hard_v1";
const FIRSTPICK_DONE_HARD_TTL_MS = 5 * 60 * 1000;
const INK = "#0B0F17";
const LIGHT_PILL_BG = "rgba(0,0,0,0.06)";
const LIGHT_PILL_BORDER = "rgba(0,0,0,0.10)";
const DARK_PILL_BG = "rgba(255,255,255,0.06)";
const DARK_PILL_BORDER = "rgba(255,255,255,0.10)";

// ─── Categories ───────────────────────────────────────────────────────────────

type CategorySlug =
  | "Santé"
  | "Créativité"
  | "Éducation"
  | "Motivation"
  | "Carrière"
  | "Productivité"
  | "État d'esprit"
  | "Discipline"
  | "Développement personnel"
  | "Fitness"
  | "Mode de vie"
  | "Écologie"
  | "Social"
  | "Finance";

const CATEGORIES: {
  slug: CategorySlug;
  icon: keyof typeof Ionicons.glyphMap;
  firestoreKey: string;
  aliases?: string[];
}[] = [
  {
    slug: "Santé",
    icon: "heart-outline",
    firestoreKey: "Santé",
    aliases: ["sante", "health"],
  },
  {
    slug: "Créativité",
    icon: "color-palette-outline",
    firestoreKey: "Créativité",
    aliases: ["creativite", "creativity"],
  },
  {
    slug: "Éducation",
    icon: "book-outline",
    firestoreKey: "Éducation",
    aliases: ["education"],
  },
  {
    slug: "Motivation",
    icon: "flash-outline",
    firestoreKey: "Motivation",
    aliases: ["motivation"],
  },
  {
    slug: "Carrière",
    icon: "briefcase-outline",
    firestoreKey: "Carrière",
    aliases: ["carriere", "career"],
  },
  {
    slug: "Productivité",
    icon: "rocket-outline",
    firestoreKey: "Productivité",
    aliases: ["productivite", "productivity"],
  },
  {
    slug: "État d'esprit",
    icon: "bulb-outline",
    firestoreKey: "État d'esprit",
    aliases: [
      "etat d'esprit",
      "etat d esprit",
      "état d’esprit",
      "etatdesprit",
      "mindset",
    ],
  },
  {
    slug: "Discipline",
    icon: "shield-checkmark-outline",
    firestoreKey: "Discipline",
    aliases: ["discipline"],
  },
  {
    slug: "Développement personnel",
    icon: "trending-up-outline",
    firestoreKey: "Développement personnel",
    aliases: [
      "developpement personnel",
      "développement personnel",
      "personal development",
      "self improvement",
    ],
  },
  {
    slug: "Fitness",
    icon: "barbell-outline",
    firestoreKey: "Fitness",
    aliases: ["fitness"],
  },
  {
    slug: "Mode de vie",
    icon: "sunny-outline",
    firestoreKey: "Mode de vie",
    aliases: ["mode de vie", "lifestyle"],
  },
  {
    slug: "Écologie",
    icon: "leaf-outline",
    firestoreKey: "Écologie",
    aliases: ["ecologie", "écologie", "ecology"],
  },
  {
    slug: "Social",
    icon: "people-outline",
    firestoreKey: "Social",
    aliases: ["social"],
  },
  {
    slug: "Finance",
    icon: "cash-outline",
    firestoreKey: "Finance",
    aliases: ["finance", "finances"],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2;

type Challenge = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  chatId?: string;
  daysOptions?: number[];
  rawCategory?: string;
};

// ─── Assets ───────────────────────────────────────────────────────────────────

const FALLBACK_IMG = RNImage.resolveAssetSource(
  require("../assets/images/fallback-card.png")
).uri;

const blurhash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

// ─── ChallengeCard ────────────────────────────────────────────────────────────

type ChallengeCardProps = {
  item: Challenge;
  isSel: boolean;
  onPress: () => void;
  CARD_W: number;
  CARD_H: number;
  reduceMotion: boolean;
  currentTheme: any;
  t: (k: string, opts?: any) => string;
  lang: string;
};

const ChallengeCard = React.memo(function ChallengeCard({
  item, isSel, onPress, CARD_W, CARD_H, reduceMotion, currentTheme, t, lang,
}: ChallengeCardProps) {
  const [imgUri, setImgUri] = useState<string>(item.imageUrl || FALLBACK_IMG);

  const translatedTitle = useMemo(() => {
    const key = item.chatId ? `challenges.${item.chatId}.title` : "";
    return item.chatId
      ? (t(key, { defaultValue: item.title }) as string)
      : (item.title || (t("common.challenge") as string));
  }, [item.chatId, item.title, t, lang]);

  const translatedCategory = useMemo(() => {
    const rawCat = item.rawCategory || item.category || "Miscellaneous";
    return t(`categories.${rawCat}`, { defaultValue: rawCat }) as string;
  }, [item.rawCategory, item.category, t, lang]);

  useEffect(() => { setImgUri(item.imageUrl || FALLBACK_IMG); }, [item.imageUrl]);

  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: isSel ? 1.02 : 1, speed: 12, bounciness: 6, useNativeDriver: true }).start();
  }, [isSel, reduceMotion, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.cardOuter, { width: CARD_W, height: CARD_H, borderColor: isSel ? currentTheme.colors.secondary : "transparent" }]}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.92}
          style={[styles.cardInner, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.cardBackground }]}
          accessibilityRole="button"
          accessibilityLabel={`${translatedTitle} — ${translatedCategory}`}
        >
          <Image
            source={{ uri: imgUri }}
            style={styles.cardImg}
            contentFit="cover"
            transition={reduceMotion ? 0 : 120}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            placeholder={blurhash}
            onError={() => setImgUri(FALLBACK_IMG)}
          />
          <LinearGradient colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFillObject} />
          <View style={styles.cardLabelWrap}>
            <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.72} maxFontSizeMultiplier={1.25} ellipsizeMode="clip"
              style={[styles.cardTitle, { color: "#fff" }, CARD_W < 170 ? { fontSize: 13, lineHeight: 16 } : null]}>
              {translatedTitle}
            </Text>
            <Text numberOfLines={1} style={[styles.cardCat, { color: "#ddd" }]}>{translatedCategory}</Text>
          </View>
          {isSel && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={18} color="#000" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FirstPick() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { show } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const nav = useRootNavigationState();
  const pendingNavRef = useRef<null | { pathname: string; params?: any }>(null);
  const { takeChallenge } = useCurrentChallenges();
  const { userDocReady } = useAuth();

  // ─── State ────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<Step>(0);
  const [selectedCategories, setSelectedCategories] = useState<Set<CategorySlug>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<Challenge[]>([]);
  const [items, setItems] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [days, setDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<Challenge> | null>(null);

  const selectedCount = selectedCategories.size;

const toggleCategory = useCallback(async (slug: CategorySlug) => {
  setSelectedCategories(prev => {
    const next = new Set(prev);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    return next;
  });
  try { await Haptics.selectionAsync(); } catch {}
}, []);

const clearAllCategories = useCallback(() => {
  setSelectedCategories(new Set());
}, []);

  // ─── Animations ───────────────────────────────────────────────────────────

  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.985)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  // ─── Computed ─────────────────────────────────────────────────────────────

  const CARD_W = useMemo(() => (width - SPACING * 3) / 2, [width]);
  const CARD_H = useMemo(() => Math.min(230, Math.max(200, height * 0.27)), [height]);

  const availableDays = useMemo(() => {
    const opts = selected?.daysOptions?.length ? selected.daysOptions : DEFAULT_DAYS;
    const uniq = Array.from(new Set(opts.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 365))).sort((a, b) => a - b);
    return uniq.length ? uniq : FALLBACK_DURATION_DAYS;
  }, [selected?.daysOptions]);

  const selectedTitle = useMemo(() => {
    if (!selected) return t("common.challenge", { defaultValue: "Challenge" }) as string;
    const key = selected.chatId ? `challenges.${selected.chatId}.title` : "";
    return selected.chatId
      ? t(key, { defaultValue: selected.title || selected.chatId }) as string
      : (selected.title || t("common.challenge", { defaultValue: "Challenge" }) as string) as string;
  }, [selected?.id, selected?.chatId, selected?.title, t, i18n.language]);

  const progressTotal = 3; // Step 0, 1, 2
  const progressText = useMemo(() =>
    t("firstPick.progressShort", { current: step + 1, total: progressTotal, defaultValue: `${step + 1}/${progressTotal}` }) as string,
    [step, t]
  );

  const ctaDisabled = useMemo(() => {
    if (submitting) return true;
    if (!userDocReady) return true;
    if (step === 0) return selectedCount === 0;
    if (step === 1) return !selected;
    return !selected || isOffline;
  }, [step, selectedCount, selected, submitting, isOffline]);

  const ctaLabel = useMemo(() => {
    if (submitting) return t("common.loading", { defaultValue: "Chargement..." }) as string;
    if (step === 0) return selectedCount > 0
      ? t("common.continue", { defaultValue: "Continuer" }) as string
      : t("firstPick.step0.cta", { defaultValue: "Choisis une catégorie" }) as string;
    if (step === 1) return selected
      ? t("firstPick.step1.cta", { defaultValue: "Suite" }) as string
      : t("firstPick.step1.ctaDisabled", { defaultValue: "Choisis un défi" }) as string;
    return selected
      ? t("firstPick.step2.cta", { defaultValue: "C'est parti !" }) as string
      : t("firstPick.step2.ctaDisabled", { defaultValue: "Choisis une durée" }) as string;
  }, [step, selectedCount, selected, submitting, t]);

  const stepTitle = useMemo(() => {
    if (step === 0) return t("firstPick.step0.title", { defaultValue: "Qu'est-ce que tu veux changer ?" }) as string;
    if (step === 1) return t("firstPick.step1.title", { defaultValue: "Choisis ton premier défi" }) as string;
    return t("firstPick.step2.title", { defaultValue: "Combien de temps peux-tu tenir ?" }) as string;
  }, [step, t]);

  const stepSubtitle = useMemo(() => {
    if (step === 0) return t("firstPick.step0.subtitle", { defaultValue: "Choisis ce qui compte vraiment pour toi maintenant." }) as string;
    if (step === 1) return t("firstPick.step1.subtitle", { defaultValue: "Un seul défi pour commencer. Tu pourras en ajouter d'autres." }) as string;
    const byDays: Record<number, string> = {
      7:  t("firstPick.step3.subtitleByDays.7",  { defaultValue: "7 jours : parfait pour démarrer vite." }) as string,
      15: t("firstPick.step3.subtitleByDays.15", { defaultValue: "14 jours : assez pour sentir la différence." }) as string,
      21: t("firstPick.step3.subtitleByDays.21", { defaultValue: "21 jours : tu construis une vraie routine." }) as string,
      30: t("firstPick.step3.subtitleByDays.30", { defaultValue: "30 jours : objectif sérieux. Tu changes d'identité." }) as string,
      60: t("firstPick.step3.subtitleByDays.60", { defaultValue: "60 jours : discipline réelle. Tu deviens constant." }) as string,
      90: t("firstPick.step3.subtitleByDays.90", { defaultValue: "90 jours : transformation. Tu deviens quelqu'un qui finit." }) as string,
      3:  t("firstPick.step3.subtitleByDays.3",  { defaultValue: "3 jours : parfait pour démarrer vite." }) as string,
      180: t("firstPick.step3.subtitleByDays.180", { defaultValue: "180 jours : assez pour sentir la différence." }) as string,
      365: t("firstPick.step3.subtitleByDays.365", { defaultValue: "365 jours : tu construis une vraie routine." }) as string,
    };
    return byDays[days] ?? t("firstPick.step2.subtitleGeneric", { count: days, defaultValue: `${days} jours : un engagement fort.` }) as string;
  }, [step, days, t]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(Boolean(v))).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => { if (mountedRef.current) setReduceMotion(Boolean(v)); });
    const net = NetInfo.addEventListener((s) => { if (mountedRef.current) setIsOffline(s.isConnected === false || s.isInternetReachable === false); });
    return () => { mounted = false; mountedRef.current = false; sub?.remove?.(); net && net(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { introOpacity.setValue(1); introScale.setValue(1); return; }
    const tt = setTimeout(() => {
      Animated.parallel([
        Animated.timing(introOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(introScale, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }, 0);
    return () => clearTimeout(tt);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const ready = (step === 0 && selectedCount > 0) || (step === 1 && !!selected) || (step === 2 && !!selected && !isOffline);
    let loop: Animated.CompositeAnimation | null = null;
    if (ready && !submitting) {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1.03, duration: 650, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
    }
    return () => loop?.stop();
  }, [step, selectedCount, selected, submitting, isOffline, reduceMotion, ctaPulse]);

  useEffect(() => {
    if (!availableDays.length) return;
    if (!availableDays.includes(days)) setDays(availableDays.includes(7) ? 7 : availableDays[0]);
  }, [availableDays, days]);

  // Anti-bounce: si firstpick déjà fait, redirect home
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const raw = await AsyncStorage.getItem(FIRSTPICK_DONE_HARD_KEY);
        if (!alive || !raw) return;
        const ts = Number(raw);
        if (!Number.isFinite(ts) || Date.now() - ts > FIRSTPICK_DONE_HARD_TTL_MS) {
          await AsyncStorage.removeItem(FIRSTPICK_DONE_HARD_KEY).catch(() => {});
          return;
        }
        const isOnFirstPick = typeof pathname === "string" && (pathname.toLowerCase().includes("firstpick") || pathname === "/firstpick");
        if (isOnFirstPick) requestAnimationFrame(() => safeReplace({ pathname: "/(tabs)" }));
      } catch {}
    };
    run();
    return () => { alive = false; };
  }, [pathname]);

  // ─── Navigation helpers ───────────────────────────────────────────────────

  const safeReplace = useCallback(
    (to: { pathname: string; params?: any }) => {
      if (nav?.key) router.replace(to);
      else pendingNavRef.current = to;
    },
    [nav?.key, router]
  );

  useEffect(() => {
    if (nav?.key && pendingNavRef.current) {
      router.replace(pendingNavRef.current);
      pendingNavRef.current = null;
    }
  }, [nav?.key, router]);

  // ─── Step animation ───────────────────────────────────────────────────────

  const animateStep = useCallback((direction: "next" | "prev") => {
    if (reduceMotion) return;
    stepOpacity.setValue(0);
    stepTranslate.setValue(direction === "next" ? 10 : -10);
    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(stepTranslate, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, stepOpacity, stepTranslate]);

  const goToStep = useCallback(async (next: Step) => {
    if (next === step) return;
    try { await Haptics.selectionAsync(); } catch {}
    setStep(next);
    animateStep(next > step ? "next" : "prev");
  }, [animateStep, step]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isOffline) throw new Error("offline");
      const qRef = query(collection(db, "challenges"), where("approved", "==", true));
      const snap = await getDocs(qRef);
      const list: Challenge[] = snap.docs.map((d) => {
        const data: any = d.data();
        const chatId = data?.chatId || d.id;
        const rawCat = data?.category || "Miscellaneous";
        return {
          id: d.id,
          title: data?.title || chatId,
          description: data?.description || "",
          category: rawCat,
          rawCategory: rawCat,
          imageUrl: data?.imageUrl || "https://via.placeholder.com/600x400",
          chatId,
          daysOptions: Array.isArray(data?.daysOptions) && data.daysOptions.length ? data.daysOptions : DEFAULT_DAYS,
        };
      });
      setPool(list);
      const prefetchTargets = list.slice(0, 8).map((c) => c.imageUrl!).filter(Boolean);
      if (prefetchTargets.length) Promise.allSettled(prefetchTargets.map((u) => RNImage.prefetch(u))).catch(() => {});
    } catch (e: any) {
      setLoadError(t("common.networkError") || "Network error. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, isOffline]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  // ─── Filter challenges by selected category ───────────────────────────────

  const normalizeCategoryValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const filteredItems = useMemo(() => {
  if (selectedCount === 0 || !pool.length) return [];

  const matchMap = new Map<string, CategorySlug>();

  for (const cat of CATEGORIES) {
    matchMap.set(normalizeCategoryValue(cat.firestoreKey), cat.slug);

    for (const alias of cat.aliases ?? []) {
      matchMap.set(normalizeCategoryValue(alias), cat.slug);
    }
  }

  const matched: Challenge[] = [];

  for (const c of pool) {
    const raw = c.rawCategory || c.category || "";
    const normalizedRaw = normalizeCategoryValue(raw);
    const slug = matchMap.get(normalizedRaw);

    if (slug && selectedCategories.has(slug)) {
      matched.push(c);
    }
  }

  return [...matched].sort(() => Math.random() - 0.5).slice(0, 6);
}, [selectedCategories, selectedCount, pool]);

  useEffect(() => {
    setItems(filteredItems);
    setSelected((prev) => (prev && !filteredItems.find((s) => s.id === prev.id) ? null : prev));
  }, [filteredItems]);

  const scrollListToTop = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated });
      });
    });
  }, []);

  const regenerateItems = useCallback(async () => {
    const reshuffled = filteredItems.sort(() => Math.random() - 0.5);
    setItems([...reshuffled]);
    setSelected((prev) => (prev && !reshuffled.find((s) => s.id === prev.id) ? null : prev));
    try { await Haptics.selectionAsync(); } catch {}
    scrollListToTop(true);
  }, [filteredItems, scrollListToTop]);

  // ─── goHome ───────────────────────────────────────────────────────────────

 const ONBOARDING_JUST_FINISHED_KEY_FP = "onboarding.justFinished.v1"; // constante locale dans FirstPick

const goHome = useCallback(async () => {
  await AsyncStorage.setItem("firstPickDone", "1");
  await initOnboardingQuests("solo").catch(() => {});
  await AsyncStorage.setItem(FIRSTPICK_DONE_HARD_KEY, String(Date.now())).catch(() => {});
  // ✅ CRITIQUE : setter la clé avant de naviguer vers home
  // → index.tsx lit cette clé et démarre le guided tour
  await AsyncStorage.setItem(ONBOARDING_JUST_FINISHED_KEY_FP, "1").catch(() => {});
  // ✅ Naviguer directement vers /(tabs) — Screen1 n'existe plus
  safeReplace({ pathname: "/(tabs)" });
}, [safeReplace]);


  // ─── Confirm ──────────────────────────────────────────────────────────────

  const onConfirm = useCallback(async () => {
  if (submittingRef.current || submitting || !selected) return;
  
  // ✅ BLOQUE si le doc Firestore n'est pas encore prêt
  if (!userDocReady) {
    show(t("common.loading", { defaultValue: "Chargement..." }), "info");
    return;
  }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await Haptics.selectionAsync();

      const ref = doc(db, "challenges", selected.id);
      const snap = await getDoc(ref);
      const data: any = snap.exists() ? snap.data() : {};

      const challengeObj = {
        id: selected.id,
        title: selected.title || data?.title || t("common.challenge"),
        category: selected.category || data?.category || t("common.misc"),
        chatId: selected.chatId || data?.chatId || selected.id,
        rawCategory: selected.rawCategory || data?.category || "Miscellaneous",
        description: selected.description || data?.description || "",
        daysOptions: selected.daysOptions || data?.daysOptions || DEFAULT_DAYS,
        imageUrl: selected.imageUrl || data?.imageUrl || "",
      };

      await takeChallenge(challengeObj, days);

      // Stocker les catégories préférées dans Firestore
      const uid = auth.currentUser?.uid;
      if (uid && selectedCount > 0) {
  const keys = Array.from(selectedCategories)
    .map(slug => CATEGORIES.find(c => c.slug === slug)?.firestoreKey)
    .filter((k): k is string => !!k);
  try {
    await updateDoc(doc(db, "users", uid), {
      preferredCategories: keys,
      challengeCategories: keys, 
      updatedAt: serverTimestamp(),
    });
  } catch {}
}

      try {
        if (uid) {
          const bucketizeDays = (n: number): 7 | 30 | 90 | 180 | 365 => {
            if (n <= 7) return 7; if (n <= 30) return 30; if (n <= 90) return 90; if (n <= 180) return 180; return 365;
          };
          await recordSelectDays(uid, bucketizeDays(days));
          await checkForAchievements(uid);
        }
      } catch {}

      logEvent("first_pick_confirm", { categories: Array.from(selectedCategories).join(","), days, challengeId: selected.id }).catch(() => {});
      await goHome();
    } catch (e: any) {
      show(e?.message || t("common.oops", { defaultValue: "Oups, réessaie." }), "error");
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [days, goHome, selected, selectedCount, show, submitting, t, takeChallenge]);

  // ─── Navigation ───────────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    if (submitting || submittingRef.current) return;
    if (step === 0) {
      if (selectedCount === 0) { show(t("firstPick.step0.missingCategory", { defaultValue: "Choisis au moins une catégorie pour continuer." }), "warning"); return; }
      await goToStep(1);
      return;
    }
    if (step === 1) {
      if (!selected) { show(t("firstPick.alert.missingChoiceBody", { defaultValue: "Choisis un défi pour continuer." }), "warning"); return; }
      await goToStep(2);
      return;
    }
    if (step === 2) {
      await onConfirm();
    }
  }, [step, selectedCount, selected, submitting, goToStep, onConfirm, show, t]);

  const goBack = useCallback(async () => {
    if (submitting || submittingRef.current || step === 0) return;
    await goToStep((step - 1) as Step);
  }, [goToStep, step, submitting]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const row = Math.floor(index / 2);
      const rowHeight = CARD_H + SPACING;
      return { length: rowHeight, offset: row * rowHeight, index };
    },
    [CARD_H]
  );

  const keyExtractor = useCallback((it: Challenge) => it.id, []);

  const onSelectCard = useCallback(async (item: Challenge) => {
    setSelected(item);
    const opts = item.daysOptions?.length ? item.daysOptions : DEFAULT_DAYS;
    const preferred = opts.includes(7) ? 7 : opts[0];
    setDays(preferred);
    try { await Haptics.selectionAsync(); } catch {}
  }, []);

  const onPickDays = useCallback(async (n: number) => {
    if (n === days) return;
    setDays(n);
    try { await Haptics.selectionAsync(); } catch {}
  }, [days]);

  const formatDaysChip = useCallback((n: number) =>
    t(`firstPick.durationChip.${n}`, { defaultValue: `${n}j` }) as string, [t]);

  const renderItem = useCallback(
    ({ item }: { item: Challenge }) => (
      <ChallengeCard
        item={item}
        isSel={selected?.id === item.id}
        onPress={() => onSelectCard(item)}
        CARD_W={CARD_W}
        CARD_H={CARD_H}
        reduceMotion={reduceMotion}
        currentTheme={currentTheme}
        t={t}
        lang={i18n.language}
      />
    ),
    [selected?.id, onSelectCard, CARD_W, CARD_H, reduceMotion, currentTheme, t, i18n.language]
  );

  const ListEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="sparkles-outline" size={48} color={currentTheme.colors.secondary} />
        <Text style={[styles.emptyTitle, { color: currentTheme.colors.textPrimary }]}>
          {t("firstPick.emptyTitle", { defaultValue: "Aucun défi disponible" }) as string}
        </Text>
        <Text style={[styles.emptySubtitle, { color: currentTheme.colors.textSecondary }]}>
          {(loadError || t("firstPick.emptySubtitle", { defaultValue: "Tire vers le bas pour réessayer." }) as string)}
        </Text>
        <TouchableOpacity onPress={fetchChallenges} style={styles.emptyCta}>
          <LinearGradient colors={[currentTheme.colors.secondary, currentTheme.colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCtaBg}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>{t("common.retry", { defaultValue: "Réessayer" }) as string}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [currentTheme, fetchChallenges, loadError, loading, t]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const showBack = step !== 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Animated.View style={{ flex: 1, opacity: introOpacity, transform: [{ scale: introScale }] }}>
        <LinearGradient colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]} style={styles.container}>

          {/* Offline banner */}
          {isOffline && (
            <View pointerEvents="none" accessibilityLiveRegion="polite"
              style={[styles.offlineBanner, { top: Math.max(insets.top, 8) + 4 }]}>
              <Ionicons name="cloud-offline-outline" size={16} color={currentTheme.colors.textPrimary} />
              <Text style={[styles.offlineText, { color: currentTheme.colors.textPrimary }]}>
                {t("common.networkError", { defaultValue: "Problème de connexion" }) as string}
              </Text>
            </View>
          )}

          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
            <View style={styles.topBarLeft}>
              {showBack ? (
                <TouchableOpacity onPress={goBack} accessibilityRole="button"
                  accessibilityLabel={t("common.back", { defaultValue: "Retour" }) as string}
                  style={styles.backBtn} hitSlop={10}>
                  <Ionicons name="chevron-back" size={18} color={currentTheme.colors.secondary} />
                  <Text style={[styles.backText, { color: currentTheme.colors.secondary }]}>
                    {t("common.back", { defaultValue: "Retour" }) as string}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ height: 34 }} />
              )}
            </View>
            <View style={styles.topBarCenter}>
              <View style={[styles.progressPill, { backgroundColor: isDark ? DARK_PILL_BG : LIGHT_PILL_BG, borderColor: isDark ? DARK_PILL_BORDER : LIGHT_PILL_BORDER }]}>
                <Text style={[styles.progressText, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>{progressText}</Text>
              </View>
            </View>
            <View style={styles.topBarRight}><View style={{ width: 60 }} /></View>
          </View>

          {/* Step content */}
          <Animated.View style={{ flex: 1, opacity: stepOpacity, transform: [{ translateY: stepTranslate }] }}>
            {/* Header */}
            <View style={styles.header}>
              <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}
                style={[styles.title, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
                {stepTitle}
              </Text>
              <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>{stepSubtitle}</Text>
            </View>

            {/* Body */}
            <View style={{ flex: 1, width: "100%", paddingHorizontal: SPACING }}>
              {loading && step === 1 ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
                </View>
              ) : (
                <>
                  {/* ── Step 0: Intent / Categories ── */}
                  {step === 0 && (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, paddingTop: 4 }}>
    {/* Compteur sélection */}
    {selectedCount > 0 && (
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:6,
          paddingHorizontal:12, paddingVertical:6, borderRadius:999, borderWidth:1,
          backgroundColor: isDark ? "rgba(255,140,0,0.18)" : "rgba(255,140,0,0.12)",
          borderColor:"rgba(255,140,0,0.38)" }}>
          <Ionicons name="checkmark-circle" size={14} color={ORANGE} />
          <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize:13, color:ORANGE }}>
            {selectedCount === 1 ? "1 catégorie" : `${selectedCount} catégories`}
          </Text>
        </View>
        <TouchableOpacity onPress={clearAllCategories} hitSlop={10}>
          <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize:12,
            color:currentTheme.colors.textSecondary, textDecorationLine:"underline" }}>
            Tout effacer
          </Text>
        </TouchableOpacity>
      </View>
    )}
    <View style={styles.categoriesGrid}>
      {CATEGORIES.map((cat) => {
        const isSel = selectedCategories.has(cat.slug);
        const catLabel = t(`firstPick.category.${cat.slug}`, { defaultValue: cat.slug }) as string;
        return (
          <Pressable
            key={cat.slug}
            onPress={() => toggleCategory(cat.slug)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSel }}
            accessibilityLabel={catLabel}
            style={({ pressed }) => [
              styles.categoryCard,
              {
                borderColor: isSel ? ORANGE : currentTheme.colors.border,
                backgroundColor: isSel
                  ? isDark ? "rgba(255,140,0,0.22)" : "rgba(255,140,0,0.10)"
                  : currentTheme.colors.cardBackground,
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            {isSel && (
              <LinearGradient
                colors={isDark
                  ? ["rgba(255,140,0,0.30)", "rgba(255,140,0,0.04)"]
                  : ["rgba(255,140,0,0.20)", "rgba(255,255,255,0.0)"]}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <View style={[styles.categoryIconWrap, {
              backgroundColor: isSel ? ORANGE : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }]}>
              <Ionicons name={cat.icon} size={22} color={isSel ? "#000" : currentTheme.colors.textSecondary} />
            </View>
            <Text numberOfLines={2} style={[styles.categoryLabel, {
              color: isSel ? (isDark ? "#fff" : INK) : currentTheme.colors.textSecondary,
              fontFamily: isSel ? "Comfortaa_700Bold" : "Comfortaa_400Regular",
            }]}>{catLabel}</Text>
            {isSel && (
              <View style={styles.categoryCheck}>
                <Ionicons name="checkmark" size={12} color="#000" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  </ScrollView>
)}

                  {/* ── Step 1: Choose challenge ── */}
                  {step === 1 && (
                    <>
                      <FlatList
                        ref={listRef}
                        key={isDark ? "list-dark" : "list-light"}
                        data={items}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: SPACING }}
                        contentContainerStyle={{ paddingBottom: SPACING, paddingTop: 4 }}
                        ListEmptyComponent={ListEmpty}
                        removeClippedSubviews
                        getItemLayout={getItemLayout}
                        windowSize={5}
                        initialNumToRender={6}
                        maxToRenderPerBatch={6}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChallenges(); }} tintColor={currentTheme.colors.secondary} />}
                      />
                      <TouchableOpacity onPress={regenerateItems} style={styles.discreetLinkBtn} hitSlop={10} accessibilityRole="button">
                        <Text style={[styles.discreetLinkText, { color: currentTheme.colors.textSecondary }]}>
                          {t("firstPick.step1.shuffleLink", { defaultValue: "Pas trouvé ? Montre-moi d'autres défis" }) as string}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── Step 2: Duration ── */}
                  {step === 2 && (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 8 }} showsVerticalScrollIndicator={false} bounces={false}>
                      <View style={styles.step2Wrap}>
                        {/* Summary card */}
                        <View style={[styles.summaryCard, { borderColor: isDark ? currentTheme.colors.border : "rgba(0,0,0,0.10)", backgroundColor: isDark ? currentTheme.colors.cardBackground : "rgba(0,0,0,0.035)" }]}>
                          <LinearGradient
                            colors={isDark ? ["rgba(255,140,0,0.10)", "rgba(0,0,0,0.0)"] : ["rgba(255,140,0,0.14)", "rgba(255,255,255,0.0)"]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                          />
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <View style={styles.summaryThumb}>
                              <Image source={{ uri: selected?.imageUrl || FALLBACK_IMG }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={reduceMotion ? 0 : 120} cachePolicy="memory-disk" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text numberOfLines={2} style={[styles.summaryTitle, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>{selectedTitle}</Text>
                              <Text numberOfLines={1} style={[styles.summarySub, { color: isDark ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.66)" }]}>
                                {t("firstPick.step2.recapSolo", { defaultValue: "Mode : Solo" }) as string}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Days picker */}
                        <View style={[styles.daysCard, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.cardBackground }]}>
                          <Text style={[styles.daysLabel, { color: currentTheme.colors.textSecondary }]}>
                            {t("firstPick.step2.durationLabel", { defaultValue: "Durée" }) as string}
                          </Text>
                          <View style={styles.chipsRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
                              {availableDays.map((n) => {
                                const active = n === days;
                                return (
                                  <Pressable key={String(n)} onPress={() => onPickDays(n)} accessibilityRole="button" accessibilityState={{ selected: active }}
                                    style={({ pressed }) => [styles.dayChip, { opacity: pressed ? 0.92 : 1, borderColor: active ? currentTheme.colors.secondary : currentTheme.colors.border, backgroundColor: active ? "rgba(255,140,0,0.18)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                                    <Text numberOfLines={1} style={[styles.dayChipText, { color: active ? (isDark ? currentTheme.colors.textPrimary : INK) : currentTheme.colors.textSecondary }]}>
                                      {formatDaysChip(n)}
                                    </Text>
                                    {active && <View style={styles.dayChipCheck}><Ionicons name="checkmark" size={14} color="#000" /></View>}
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          </View>
                          <View style={styles.durationRow}>
                            <View style={[styles.durationPill, { borderColor: currentTheme.colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                              <Ionicons name="calendar-outline" size={14} color={currentTheme.colors.secondary} />
                              <Text style={[styles.durationPillText, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>
                                {days === 1
                                  ? t("firstPick.day_one", { count: days, defaultValue: "{{count}} jour" }) as string
                                  : t("firstPick.day_other", { count: days, defaultValue: "{{count}} jours" }) as string}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* Footer CTA */}
          <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, SPACING) }]}>
            <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaPulse }] }]}>
              <TouchableOpacity
                onPress={goNext}
                disabled={ctaDisabled}
                activeOpacity={0.9}
                accessibilityRole="button"
                testID="firstpick-cta"
                style={[styles.primaryCtaCompact, { opacity: ctaDisabled ? 0.62 : 1 }]}
              >
                <LinearGradient colors={[CTA_GRAD_A, CTA_GRAD_B]} start={{ x: 0.08, y: 0.10 }} end={{ x: 0.92, y: 0.90 }} style={StyleSheet.absoluteFillObject} />
                <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0.00)"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.ctaSheen} />
                <View pointerEvents="none" style={styles.ctaVignette} />
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.primaryCtaTextCompact}>{ctaLabel}</Text>
                    <Ionicons name={step === 2 ? "checkmark" : "arrow-forward"} size={16} color="#000" />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", paddingTop: SPACING, alignItems: "stretch" },
  topBar: { width: "100%", paddingHorizontal: SPACING, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBarLeft: { width: 110, alignItems: "flex-start" },
  topBarCenter: { flex: 1, alignItems: "center" },
  topBarRight: { width: 110, alignItems: "flex-end" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999 },
  backText: { fontSize: 12, fontFamily: "Comfortaa_700Bold" },
  progressPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  progressText: { fontSize: 12, fontFamily: "Comfortaa_700Bold" },
  offlineBanner: { position: "absolute", alignSelf: "center", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FDE68A", borderColor: "rgba(0,0,0,0.08)", borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  offlineText: { fontSize: 12, fontFamily: "Comfortaa_700Bold" },
  header: { width: "100%", paddingHorizontal: SPACING, marginBottom: 10, alignItems: "center" },
  title: { fontSize: 26, fontFamily: "Comfortaa_700Bold", textAlign: "center", width: "100%", alignSelf: "center" },
  subtitle: { fontSize: 14, fontFamily: "Comfortaa_400Regular", textAlign: "center", marginTop: 8, lineHeight: 18, paddingHorizontal: 10, flexShrink: 1 },

  // Categories grid
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  categoryCard: {
    width: "48%", borderWidth: 1.5, borderRadius: 20, padding: 14, alignItems: "center",
    gap: 8, overflow: "hidden", position: "relative", minHeight: 90,
  },
  categoryIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 13, textAlign: "center", lineHeight: 17 },
  categoryCheck: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },

  // Cards
  cardOuter: { borderRadius: 18, borderWidth: 2, padding: 2 },
  cardInner: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, position: "relative" },
  cardImg: { width: "100%", height: "100%" },
  cardLabelWrap: { position: "absolute", left: 10, right: 10, bottom: 10, minWidth: 0 },
  cardTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 14, lineHeight: 17, flexShrink: 1, minWidth: 0 },
  cardCat: { fontSize: 12, fontFamily: "Comfortaa_400Regular", marginTop: 4 },
  checkBadge: { position: "absolute", right: 8, top: 8, backgroundColor: GOLD, borderRadius: 14, padding: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },

  discreetLinkBtn: { paddingVertical: 10, alignItems: "center" },
  discreetLinkText: { fontSize: 13, fontFamily: "Comfortaa_400Regular", textDecorationLine: "underline" },

  // Step 2
  step2Wrap: { flex: 1, justifyContent: "flex-start", paddingTop: 10, paddingBottom: 6, gap: 12 },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 16, overflow: "hidden" },
  summaryThumb: { width: 46, height: 46, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.10)" },
  summaryTitle: { fontSize: 15, fontFamily: "Comfortaa_700Bold" },
  summarySub: { fontSize: 12, fontFamily: "Comfortaa_400Regular", marginTop: 3 },
  daysCard: { borderWidth: 1, borderRadius: 18, padding: 16, width: "100%" },
  daysLabel: { fontSize: 13, fontFamily: "Comfortaa_700Bold", marginBottom: 8 },
  chipsRow: { width: "100%", marginTop: 6, marginBottom: 10 },
  chipsContent: { paddingVertical: 2, paddingRight: 6, gap: 10 },
  dayChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  dayChipText: { fontSize: 13, lineHeight: 16, fontFamily: "Comfortaa_700Bold" },
  dayChipCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  durationRow: { width: "100%", alignItems: "center", justifyContent: "center", marginTop: 2 },
  durationPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, minHeight: 46 },
  durationPillText: { fontSize: 14, lineHeight: 18, textAlign: "center", fontFamily: "Comfortaa_700Bold" },

  // Empty
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 30, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 18, textAlign: "center", fontFamily: "Comfortaa_700Bold" },
  emptySubtitle: { fontSize: 14, textAlign: "center", fontFamily: "Comfortaa_400Regular", opacity: 0.9, marginBottom: 8 },
  emptyCta: { borderRadius: 999, overflow: "hidden", borderWidth: 1 },
  emptyCtaBg: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyCtaText: { color: "#fff", fontSize: 14, fontFamily: "Comfortaa_700Bold" },

  // Footer
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING, paddingTop: 8, width: "100%", gap: 12 },
  ctaWrap: { flex: 1 },
  primaryCtaCompact: {
    minHeight: 70, borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: ORANGE, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 5, borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)", width: "100%", overflow: "hidden",
  },
  ctaSheen: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  ctaVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.06)" },
  primaryCtaTextCompact: { color: "#000", fontSize: 18, fontFamily: "Comfortaa_700Bold", minWidth: 0, flexShrink: 1 },
});
