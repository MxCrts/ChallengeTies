import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  StatusBar,
  PixelRatio,
  Alert,
  InteractionManager,
  Animated as RNAnimated,
  Pressable,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
import { db, auth } from "@/constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BannerSlot from "@/components/BannerSlot";
import LottieView from "lottie-react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeIn,
  Easing,
  FadeInUp,
  withRepeat,
} from "react-native-reanimated";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation, Trans } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { fetchAndSaveUserLocation } from "../../services/locationService";
import { useLanguage } from "../../context/LanguageContext";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TutorialModal from "../../components/TutorialModal";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import useGateForGuest from "@/hooks/useGateForGuest";
import RequireAuthModal from "@/components/RequireAuthModal";
import { Modal } from "react-native";
import { TUTORIAL_STEPS } from "../../components/TutorialSteps";
import * as Haptics from "expo-haptics";
import DailyBonusModal from "../../components/DailyBonusModal";
import {
  canClaimDailyBonusFromUserData,
  claimDailyBonus,
  DailyRewardResult,
  claimDailyBonusReroll,
} from "../../helpers/dailyBonusService";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import WelcomeBonusModal, {
  WelcomeRewardKind,
} from "../../components/WelcomeBonusModal";
import {
  computeWelcomeBonusState,
  claimWelcomeBonus,
  WelcomeBonusState,
} from "../../src/services/welcomeBonusService";
import { useToast } from "../../src/ui/Toast";




const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const FALLBACK_CHALLENGE_IMG = require("../../assets/images/backgroundbase.jpg");

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  const normalizedSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

const ITEM_WIDTH = Math.min(SCREEN_WIDTH * 0.85, normalize(400));
const ITEM_HEIGHT = Math.min(SCREEN_HEIGHT * 0.32, normalize(240));

const SPACING = normalize(15);
const CONTENT_W = Math.min(SCREEN_WIDTH - SPACING * 2, normalize(420));
const IS_SMALL = SCREEN_WIDTH < 360;


interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  day?: number;
  approved?: boolean;
}

type CurrentChallengeItem = {
  challengeId?: string; // legacy
  id?: string; // ✅ ce que tu as réellement dans CurrentChallenges
  title?: string;
  description?: string;
  imageUrl?: string;
  completedDays?: number;
  selectedDays?: number;
  duo?: boolean;
  duoPartnerId?: string;
  completed?: boolean;
  archived?: boolean;
};

// --- Daily picks helpers ---
const DAILY_PICKS_KEY = "daily_picks_v1";
// 🔑 Nouveau: versionner le cache pour éviter les vieux objets cassés
const CHALLENGES_CACHE_KEY = "challenges_cache_v2";


// ✅ Local day (midnight device) -> pour les 5 défis du jour
const todayKeyLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ✅ UTC day -> DOIT matcher dailyBonusService (anti désync)
const todayKeyUTC = () => new Date().toISOString().slice(0, 10);

const hashStringToInt = (str: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (a: number) => {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function seededShuffle<T>(arr: T[], seedInt: number): T[] {
  const rnd = mulberry32(seedInt);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDailyPicksFromBase(
  base: Challenge[],
  cachedDailyRaw: string | null,
  userId: string | undefined | null
): Challenge[] {
  if (!base.length) return [];

  const today = todayKeyLocal();
  const byId = new Map(base.map((c) => [c.id, c]));

  let picks: Challenge[] = [];

  // 1) Si on a un cache DAILY_PICKS pour aujourd'hui, on le respecte au max
  if (cachedDailyRaw) {
    try {
      const parsed = JSON.parse(cachedDailyRaw);
      if (parsed?.date === today && Array.isArray(parsed.ids)) {
        picks = parsed.ids
          .map((id: string) => byId.get(id))
          .filter(Boolean) as Challenge[];
      }
    } catch {
      // cache illisible → on ignore
    }
  }

  // 2) Si moins de 5, on complète avec d'autres défis aléatoires
  if (picks.length < 5) {
    const alreadyIds = new Set(picks.map((p) => p.id));
    const remaining = base.filter((c) => !alreadyIds.has(c.id));
    if (remaining.length) {
      const seed = hashStringToInt(
        `${today}#${userId ?? "global"}#fallback`
      );
      const shuffledRest = seededShuffle(remaining, seed);
      const needed = Math.max(0, 5 - picks.length);
      picks = [...picks, ...shuffledRest.slice(0, needed)];
    }
  }

  // 3) Si toujours vide (ou trop peu) → on shuffle tout
  if (!picks.length) {
    const seed = hashStringToInt(`${today}#${userId ?? "global"}`);
    picks = seededShuffle(base, seed).slice(0, 5);
  }

  return picks;
}

// --- Welcome Login Bonus UI mirror (doit matcher welcomeBonusService) ---
const WELCOME_REWARDS_UI: { type: WelcomeRewardKind; amount: number }[] = [
  { type: "trophies", amount: 8 },   // Jour 1
  { type: "trophies", amount: 12 },  // Jour 2
  { type: "streakPass", amount: 1 }, // Jour 3
  { type: "trophies", amount: 15 },  // Jour 4
  { type: "streakPass", amount: 1 }, // Jour 5
  { type: "trophies", amount: 20 },  // Jour 6
  { type: "premium", amount: 7 },    // Jour 7 (jours premium)
];

const WELCOME_TOTAL_DAYS = WELCOME_REWARDS_UI.length;



export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
    const [userData, setUserData] = useState<any | null>(null);
  const [welcomeState, setWelcomeState] = useState<WelcomeBonusState | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [pendingWelcomeAfterTutorial, setPendingWelcomeAfterTutorial] =
  useState(false);
  const [welcomeGuardDay, setWelcomeGuardDay] = useState<number | null>(null);

  const [dailyBonusVisible, setDailyBonusVisible] = useState(false);
  const [hasClaimedDailyBonus, setHasClaimedDailyBonus] = useState(false);
  const [dailyBonusLoading, setDailyBonusLoading] = useState(false);
  const [dailyReward, setDailyReward] = useState<DailyRewardResult | null>(null);
  const [rerollAdReady, setRerollAdReady] = useState(false);
  const [rerollAdLoading, setRerollAdLoading] = useState(false);
  const [rerollLoading, setRerollLoading] = useState(false);
  const { theme } = useTheme();
  const { modalVisible, gate, closeGate, hydrated } = useGateForGuest();
  const [layoutKey, setLayoutKey] = useState(0);
  const { setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [adHeight, setAdHeight] = useState(0);
  const [bannerKey, setBannerKey] = useState(0);
  const { showBanners } = useAdsVisibility();
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [dailyFive, setDailyFive] = useState<Challenge[]>([]);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const [activeChallengeMetaOverride, setActiveChallengeMetaOverride] = useState<Challenge | null>(null);
  const [showPremiumEndModal, setShowPremiumEndModal] = useState(false);
  const { show: showToast } = useToast();
  

  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();

  const [tutorialGate, setTutorialGate] = useState(false);
  const isTutorialBlocking = isTutorialActive && tutorialGate;

  const heroVideoRef = useRef<Video | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const refreshUserData = useCallback(async () => {
  if (!user?.uid) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      setUserData(null);
      return;
    }

    const data = snap.data();
    setUserData(data);

    // ⚠️ Langue : on garde SIMPLE → pas de setLanguage ici
    const userLanguage = (data as any)?.language;
    if (userLanguage && userLanguage !== i18n.language) {
      i18n.changeLanguage(userLanguage);
    }

    // Localisation : pareil, simple
    if ((data as any)?.locationEnabled) {
      fetchAndSaveUserLocation().catch(() => {});
    }
  } catch {
    // silence
  }
}, [user?.uid, i18n]);


  const openTutorial = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    // ✅ Autorise le rendu du tuto UNIQUEMENT après clic user
    setTutorialGate(true);

    // Reset propre
    setTutorialStep(0);

    // Si le context est déjà actif (bug), on le laisse tourner mais maintenant on a la gate = UI ok
    // Sinon on le démarre normalement
    startTutorial?.();
  }, [startTutorial, setTutorialStep]);

useEffect(() => {
    if (!isTutorialActive) return;
    if (tutorialGate) return; // ✅ clic user => autorisé

    // ❌ Activation auto détectée -> on coupe sans jamais afficher
    setTutorialStep(0);
    skipTutorial?.();
  }, [isTutorialActive, tutorialGate, setTutorialStep, skipTutorial]);

  const markImageBroken = useCallback((id?: string) => {
    if (!id) return;
    setBrokenImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const getChallengeImageSource = useCallback(
    (c?: Challenge) => {
      const url = typeof c?.imageUrl === "string" ? c.imageUrl.trim() : "";
      const isBroken = !!(c?.id && brokenImages[c.id]);
      if (isBroken) return FALLBACK_CHALLENGE_IMG;
      if (url.startsWith("http")) return { uri: url };
      return FALLBACK_CHALLENGE_IMG;
    },
    [brokenImages]
  );

const exploreScale = useSharedValue(1);
const markScale = useSharedValue(1);

const exploreAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: exploreScale.value }],
}));

const markAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: markScale.value }],
}));

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  const hasActiveChallenges = useMemo(() => {
    const list = (userData as any)?.CurrentChallenges;
    if (!Array.isArray(list)) return false;
    // Si au moins un challenge non terminé, on considère qu'une "série" est en cours
    return list.some((c) => !c?.completed && !c?.archived);
  }, [userData]);

  const currentChallenges = useMemo<CurrentChallengeItem[]>(() => {
    const list = (userData as any)?.CurrentChallenges;
    return Array.isArray(list) ? (list as CurrentChallengeItem[]) : [];
  }, [userData]);

  const activeChallenge = useMemo<CurrentChallengeItem | null>(() => {
    if (!currentChallenges.length) return null;
    return (
      currentChallenges.find((c) => !c?.completed && !c?.archived) ?? null
    );
  }, [currentChallenges]);

  const activeChallengeId = useMemo(() => {
    // ✅ supporte ta structure réelle : id dans l'objet user
    const id = (activeChallenge?.challengeId ?? activeChallenge?.id) as any;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  }, [activeChallenge]);

  const activeChallengeMeta = useMemo<Challenge | null>(() => {
    // ✅ 1) si on a le doc complet dans CurrentChallenges, on l'utilise direct
    // (ça règle instantanément ton "Ton défi" vide)
    if (activeChallenge) {
      const localTitle = typeof activeChallenge.title === "string" ? activeChallenge.title.trim() : "";
      const localDesc = typeof activeChallenge.description === "string" ? activeChallenge.description.trim() : "";
      const localCat = (activeChallenge as any)?.category;
      const localImg = typeof (activeChallenge as any)?.imageUrl === "string" ? (activeChallenge as any).imageUrl.trim() : "";

      if (localTitle || localDesc || localImg) {
        return {
          id: activeChallengeId ?? "active",
          title: localTitle || t("home.yourChallenge", "Ton défi"),
          description: localDesc || "",
          category: typeof localCat === "string" ? localCat : "",
          imageUrl: localImg || undefined,
        };
      }
    }

    // ✅ 2) sinon on tente via la base fetchée
    if (!activeChallengeId) return null;
    const inAll = allChallenges.find((c) => c.id === activeChallengeId);
    if (inAll) return inAll;
    const inDaily = dailyFive.find((c) => c.id === activeChallengeId);
    return inDaily ?? null;
  }, [activeChallenge, activeChallengeId, allChallenges, dailyFive, t]);

const effectiveActiveMeta = activeChallengeMetaOverride ?? activeChallengeMeta;

  const activeProgress = useMemo(() => {
    const done =
      typeof activeChallenge?.completedDays === "number"
        ? activeChallenge.completedDays
        : 0;
    const total =
      typeof activeChallenge?.selectedDays === "number"
        ? activeChallenge.selectedDays
        : 0;
    const safeTotal = Math.max(total, 0);
    const safeDone = Math.max(Math.min(done, safeTotal || done), 0);
    const pct = safeTotal > 0 ? safeDone / safeTotal : 0;
    return { done: safeDone, total: safeTotal, pct: Math.max(0, Math.min(pct, 1)) };
  }, [activeChallenge]);

    const activeChallengeDescription = useMemo(() => {
    const raw =
      (effectiveActiveMeta?.description ??
        (typeof activeChallenge?.description === "string"
          ? activeChallenge.description
          : "")) ?? "";
    const clean = String(raw).trim();
    if (!clean) return "";
    return clean.replace(/\s+/g, " ");
  }, [effectiveActiveMeta?.description, activeChallenge?.description]);

  const heroShouldPlay = useMemo(
    () => isScreenFocused && !isTutorialBlocking && videoReady,
    [isScreenFocused, isTutorialBlocking, videoReady]
  );

// ✅ Banner height callback (logs uniquement en DEV)
  const handleAdHeight = useCallback((h: number) => {
    if (__DEV__) console.log("[ADS][HomeScreen] Banner height:", h);
    setAdHeight(h);
  }, []);


  const HERO_BASE_HEIGHT = normalize(405);
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;

  const bottomContentPadding =
    (showBanners && !isTutorialBlocking ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    SPACING * 2;

   const shouldShowBanner = showBanners && !isTutorialBlocking;
   // ✅ Remount BannerSlot quand l’affichage change (fix “banner sometimes not appearing”)
  useEffect(() => {
    if (!shouldShowBanner) return;
    setBannerKey((k) => k + 1);
    // reset hauteur pour recalcul padding proprement
    setAdHeight(0);
  }, [shouldShowBanner]);

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const canClaimDailyBonus =
    !!userData &&
    !hasClaimedDailyBonus &&
    canClaimDailyBonusFromUserData(userData);

  const claimedTodayUTC =
    userData?.dailyBonus?.lastClaimDate === todayKeyUTC() ||
    hasClaimedDailyBonus;

  const hasRerolledTodayUTC =
    userData?.dailyBonus?.lastRerollDate === todayKeyUTC();

  const canRerollDailyBonus =
    !!userData && claimedTodayUTC && !hasRerolledTodayUTC;

    const isAnyBlockingModalOpen =
  isTutorialBlocking ||
  welcomeVisible ||
  dailyBonusVisible ||
  showPremiumEndModal ||
  modalVisible;

      const effectiveWelcomeReward =
    welcomeState &&
    !welcomeState.completed &&
    welcomeState.currentDay >= 0 &&
    welcomeState.currentDay < WELCOME_TOTAL_DAYS
      ? WELCOME_REWARDS_UI[welcomeState.currentDay]
      : null;

      // ✅ Logs ADS (DEV only)
  useEffect(() => {
    if (!__DEV__) return;
    const adsReady = (globalThis as any).__ADS_READY__;
    const canRequestAds = (globalThis as any).__CAN_REQUEST_ADS__;
    const npa = (globalThis as any).__NPA__;
    console.log("[ADS][HomeScreen] state =", {
      showBanners,
      isTutorialActive,
      adHeight,
      adsReady,
      canRequestAds,
      npa,
    });
  }, [showBanners, isTutorialActive, adHeight]);

useEffect(() => {
  if (!user?.uid) {
    setUserData(null);
    return;
  }
  refreshUserData();
}, [user?.uid, refreshUserData]);


  useEffect(() => {
    const last = userData?.dailyBonus?.lastClaimDate as string | undefined;
    if (last && last !== todayKeyUTC()) {
      setHasClaimedDailyBonus(false);
      setDailyReward(null);
    }
  }, [userData?.dailyBonus?.lastClaimDate]);

  useEffect(() => {
  if (!userData) {
    setWelcomeState(null);
    setWelcomeVisible(false);
    setPendingWelcomeAfterTutorial(false);
    setWelcomeGuardDay(null);
    return;
  }

  try {
    const state = computeWelcomeBonusState(userData);
    setWelcomeState(state);

    // NE JAMAIS faire setWelcomeVisible(false) ici
    // On ne touche à visible que quand on sait exactement ce qu’on veut

    if (!state.canClaimToday || state.completed) {
      setWelcomeVisible(false);
      return;
    }

    // Protection anti-rebond
    if (welcomeGuardDay === state.currentDay) {
      return;
    }

    if (isTutorialActive) {
      setPendingWelcomeAfterTutorial(true);
    } else {
      setWelcomeVisible(true); // ← on ouvre seulement ici
    }

    setWelcomeGuardDay(state.currentDay);
  } catch (e) {
    console.warn("[HomeScreen] computeWelcomeBonusState error:", e);
  }
}, [userData, isTutorialActive, welcomeGuardDay]); // welcomeGuardDay toujours dans les deps

    useEffect(() => {
    if (
      !isTutorialActive &&
      pendingWelcomeAfterTutorial &&
      welcomeState &&
      welcomeState.canClaimToday &&
      !welcomeState.completed
    ) {
      setWelcomeVisible(true);
      setPendingWelcomeAfterTutorial(false);
    }
  }, [isTutorialActive, pendingWelcomeAfterTutorial, welcomeState]);

useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeChallengeId) {
        setActiveChallengeMetaOverride(null);
        return;
      }

      // si on a déjà une meta solide (title/img/desc), inutile
      const hasSolid =
        !!activeChallengeMeta?.title ||
        !!activeChallengeMeta?.description ||
        !!activeChallengeMeta?.imageUrl;
      if (hasSolid) {
        setActiveChallengeMetaOverride(null);
        return;
      }

      try {
        const ref = doc(db, "challenges", activeChallengeId);
        const snap = await getDoc(ref);
        if (!snap.exists() || cancelled) return;
        const data: any = snap.data();
        const img =
          typeof data?.imageUrl === "string" && data.imageUrl.trim().length > 0
            ? data.imageUrl.trim()
            : undefined;
        const cat = typeof data?.category === "string" ? data.category : "";
        const chatId = typeof data?.chatId === "string" ? data.chatId : "";

        const meta: Challenge = {
          id: activeChallengeId,
          title: chatId ? t(`challenges.${chatId}.title`) : t("home.yourChallenge", "Ton défi"),
          description: chatId ? t(`challenges.${chatId}.description`) : "",
          category: cat ? t(`categories.${cat}`) : "",
          imageUrl: img,
        };
        setActiveChallengeMetaOverride(meta);
      } catch {
        // silence
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeChallengeId, activeChallengeMeta, t]);

   useEffect(() => {
    if (!user || !userData) return;

    // 1) On ne montre le modal que si le welcomeLoginBonus est terminé
    const welcome = (userData as any).welcomeLoginBonus;
    if (!welcome || welcome.completed !== true) return;

    // 2) On regarde l'état premium
    const premium = (userData as any).premium;
    if (!premium || typeof premium !== "object") return;

    // 3) Si l'utilisateur est premium "payant", on ne montre jamais ce modal
    const isPayingPremium =
      premium.isPremium === true ||
      premium.premium === true ||
      premium.isSubscribed === true ||
      premium.isLifetime === true;

    if (isPayingPremium) return;

    // 4) Parse robuste de tempPremiumUntil (string ISO, Timestamp Firestore, number ms, Date)
    const rawUntil = premium.tempPremiumUntil;
    if (!rawUntil) return;

    const toMs = (v: any): number | null => {
      // Firestore Timestamp
      if (v && typeof v === "object" && typeof v.toDate === "function") {
        const d = v.toDate();
        const ms = d?.getTime?.();
        return Number.isFinite(ms) ? ms : null;
      }
      // Date
      if (v instanceof Date) {
        const ms = v.getTime();
        return Number.isFinite(ms) ? ms : null;
      }
      // number (ms)
      if (typeof v === "number") {
        return Number.isFinite(v) ? v : null;
      }
      // string
      if (typeof v === "string") {
        const ms = Date.parse(v);
        return Number.isFinite(ms) ? ms : null;
      }
      return null;
    };

    const expiresMs = toMs(rawUntil);
    if (!expiresMs) {
      console.warn("[PremiumEnd] tempPremiumUntil unreadable:", rawUntil);
      return;
    }

    const now = Date.now();
    if (now <= expiresMs) return;

    // 5) Clé de garde pour ne pas re-afficher indéfiniment
    // On stocke une valeur stable (ms) au lieu d'une string potentiellement variable
    const key = `premiumEndModalShown_v2_${user.uid}`;

    const checkAndShow = async () => {
      try {
        const last = await AsyncStorage.getItem(key);
        if (last === String(expiresMs)) return;

        setShowPremiumEndModal(true);
        await AsyncStorage.setItem(key, String(expiresMs));
      } catch {}
    };

    checkAndShow();
  }, [user, userData]);


  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

useFocusEffect(
  useCallback(() => {
    // ✅ refresh instant quand tu reviens de Explore / Challenge-details
    refreshUserData();
  }, [refreshUserData])
);


  const fadeAnim = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  const bonusPulse = useSharedValue(0);

useEffect(() => {
  if (!canClaimDailyBonus || isTutorialBlocking) {
    bonusPulse.value = 0;
    return;
  }
  bonusPulse.value = withRepeat(
    withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [canClaimDailyBonus, isTutorialBlocking, bonusPulse]);

const bonusPulseStyle = useAnimatedStyle(() => {
  // glow discret (pas kitsch)
  const o = 0.10 + bonusPulse.value * 0.10; // 0.10 -> 0.20
  return { opacity: o };
});


  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1500 });
  }, [fadeAnim]);

  // ✅ Rewarded ad (reroll daily bonus)
  const rerollAd = useMemo(
    () =>
      RewardedAd.createForAdRequest(adUnitIds.rewarded, {
        requestNonPersonalizedAdsOnly: true,
      }),
    []
  );

  useEffect(() => {
    setRerollAdLoading(true);

    const unsubLoaded = rerollAd.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setRerollAdReady(true);
        setRerollAdLoading(false);
      }
    );

    const unsubError = rerollAd.addAdEventListener(
      AdEventType.ERROR,
      () => {
        setRerollAdReady(false);
        setRerollAdLoading(false);
      }
    );

    const unsubClosed = rerollAd.addAdEventListener(AdEventType.CLOSED, () => {
      setRerollAdReady(false);
      setRerollAdLoading(true);
      rerollAd.load();
    });

    rerollAd.load();

    return () => {
      unsubLoaded();
      unsubError();
      unsubClosed();
    };
  }, [rerollAd]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setLayoutKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const list = dailyFive.length ? dailyFive : allChallenges;
    if (!list?.length) return;
    list.forEach((c) => {
      if (c?.id && brokenImages[c.id]) return;
      if (c.imageUrl?.startsWith("http")) {
        try {
          (Image as any)?.prefetch?.(c.imageUrl);
        } catch {}
      }
    });
}, [dailyFive, allChallenges, brokenImages]);

   const fetchChallenges = useCallback(async () => {
    let hydratedFromCache = false;

    try {
      setLoading(true);

      // 1) Lire cache challenges + DAILY_PICKS en parallèle
      const [cachedChallenges, cachedDaily] = await Promise.all([
        AsyncStorage.getItem(CHALLENGES_CACHE_KEY),
        AsyncStorage.getItem(DAILY_PICKS_KEY),
      ]);

      let base: Challenge[] = [];

      if (cachedChallenges) {
  try {
    const parsed = JSON.parse(cachedChallenges);

    base = Array.isArray(parsed)
      ? parsed.map((c: any) => ({
          ...c,
          // 💎 Fallback garanti pour les vieilles entrées sans image / image vide
          imageUrl:
            (typeof c.imageUrl === "string" && c.imageUrl.trim().length > 0)
              ? c.imageUrl
              : undefined,
        }))
      : [];
  } catch {
    base = [];
  }
}


      // 2) Si on a déjà une base locale → on hydrate tout de suite l'écran
      if (base.length) {
        const picks = buildDailyPicksFromBase(
          base,
          cachedDaily,
          user?.uid
        );

        setAllChallenges(base);
        setDailyFive(picks);
        hydratedFromCache = true;
        setLoading(false); // ✅ on arrête le spinner, même si le réseau travaille encore
      }

      // 3) Requête Firestore pour rafraîchir les données (en arrière-plan si cache déjà affiché)
      const challengesQuery = query(
        collection(db, "challenges"),
        where("approved", "==", true)
      );
      const querySnapshot = await getDocs(challengesQuery);

      const fetched: Challenge[] = querySnapshot.docs.map((snap) => {
        const data = snap.data() as any;
        return {
          id: snap.id,
          title: data?.chatId
            ? t(`challenges.${data.chatId}.title`)
            : t("mysteriousChallenge"),
          description: data?.chatId
            ? t(`challenges.${data.chatId}.description`)
            : t("noDescriptionAvailable"),
          category: data?.category
            ? t(`categories.${data.category}`)
            : t("miscellaneous"),
          imageUrl:
            typeof data?.imageUrl === "string" && data.imageUrl.trim().length > 0
              ? data.imageUrl
              : undefined,

          day: data?.day,
          approved: data?.approved,
        };
      });

      const key = todayKeyLocal();
      const seedStr = `${key}#${user?.uid ?? "global"}`;
      const seed = hashStringToInt(seedStr);

      const sorted = fetched
        .slice()
        .sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0));
      const shuffled = seededShuffle(sorted, seed);
      const picksFresh = shuffled.slice(0, 5);

      // 4) Mettre à jour l’état avec les données fraîches
      setAllChallenges(fetched);
      setDailyFive(picksFresh);

      // 5) Mettre à jour les caches (base + DAILY_PICKS)
      Promise.allSettled([
        AsyncStorage.setItem(CHALLENGES_CACHE_KEY, JSON.stringify(fetched)),
        AsyncStorage.setItem(
          DAILY_PICKS_KEY,
          JSON.stringify({
            date: key,
            ids: picksFresh.map((p) => p.id),
          })
        ),
      ]).catch(() => {});
    } catch (error) {
      console.warn("[HomeScreen] fetchChallenges error:", (error as any)?.message ?? error);

      // 6) Si le cache n'a PAS pu hydrater l’UI, on tente un fallback propre
      if (!hydratedFromCache) {
        try {
          const cachedChallenges = await AsyncStorage.getItem(CHALLENGES_CACHE_KEY);
          const cachedDaily = await AsyncStorage.getItem(DAILY_PICKS_KEY);

          if (cachedChallenges) {
            const base: Challenge[] = JSON.parse(cachedChallenges);
            const picks = buildDailyPicksFromBase(
              base,
              cachedDaily,
              user?.uid
            );
            setAllChallenges(base);
            setDailyFive(picks);
          } else {
            setAllChallenges([]);
            setDailyFive([]);
          }
        } catch {
          setAllChallenges([]);
          setDailyFive([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid, t]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) fetchChallenges();
    });
    return () => {
      cancelled = true;
      task && (task.cancel?.());
    };
  }, [fetchChallenges, i18n.language]);

  const safeNavigate = useCallback(
    (path: string, why?: string) => {
      if (!isMounted || !hydrated) return;
      if (gate(path, why)) router.push(path as any);
    },
    [gate, router, isMounted, hydrated]
  );

  const handlePickChallengePress = useCallback(async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
  safeNavigate("/explore", "home-pick-challenge");
}, [safeNavigate]);

const handleCreateChallengePress = useCallback(async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}

  // ✅ route la plus safe vu tes pages existantes
  // (si tu as déjà un écran “create”, remplace par le bon)
  safeNavigate("/create-challenge", "home-create-challenge");
}, [safeNavigate]);

const handleInviteFriendPress = useCallback(async () => {
  if (!activeChallengeId) {
    // pas de défi actif → on pousse vers explore (duo mis en avant par ton UI explore)
    try {
      await Haptics.selectionAsync();
    } catch {}
    safeNavigate("/explore", "home-invite-no-active");
    return;
  }

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}

  // ✅ l’invite est déjà gérée dans challenge-details/[id]
  safeNavigate(`/challenge-details/${activeChallengeId}`, "home-invite-friend");
}, [activeChallengeId, safeNavigate]);


  const handleMarkTodayPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    // On centralise l'action “Marquer” dans Focus (déjà ton hub)
    safeNavigate("/focus", "home-mark-today");
  }, [safeNavigate]);

  const handleOpenActiveChallenge = useCallback(async () => {
    if (!activeChallengeId) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    safeNavigate(`/challenge-details/${activeChallengeId}`, "home-open-active");
  }, [activeChallengeId, safeNavigate]);

  // ✅ CTA ultra-courts (jamais coupés) : on garde le sens via sous-texte + a11y/hints
  const heroCtaLabel = useMemo(
    () => t("homeZ.hero.ctaShort", "Explorer"),
    [t]
  );
  const todayPrimaryLabel = useMemo(() => {
    // ✅ Inversion : si pas de défi actif → Duo devient le chemin naturel
    return hasActiveChallenges
      ? t("homeZ.todayHub.primaryActiveShort", "Marquer")
      : t("homeZ.todayHub.primaryDuoShort", "Duo");
  }, [hasActiveChallenges, t]);

  const shouldShowDuoNudge = useMemo(() => {
  // montre le nudge uniquement si : défi actif + pas déjà en duo
  return !!hasActiveChallenges && !!activeChallengeId && activeChallenge?.duo !== true;
}, [hasActiveChallenges, activeChallengeId, activeChallenge?.duo]);

const duoNudgeTitle = useMemo(
  () => t("homeZ.duoNudge.title", "Tu vas lâcher seul. Pas à deux."),
  [t]
);


  const dynamicStyles = useMemo(
    () => getDynamicStyles(currentTheme, isDarkMode),
    [currentTheme, isDarkMode]
  );

  const handleClaimDailyBonus = async (): Promise<DailyRewardResult | null> => {
    if (dailyBonusLoading || hasClaimedDailyBonus || !userData) {
      return null;
    }

    try {
      setDailyBonusLoading(true);

      const reward = await claimDailyBonus();

      setHasClaimedDailyBonus(true);
      setDailyReward(reward);

      setUserData((prev: any) => {
        if (!prev) return prev;
        const next: any = { ...prev };

        next.dailyBonus = {
          ...(prev.dailyBonus || {}),
          lastClaimDate: todayKeyUTC(),
        };

        switch (reward.type) {
          case "streakPass": {
            const inv = prev.inventory || {};
            const current =
              typeof inv.streakPass === "number" ? inv.streakPass : 0;
            next.inventory = { ...inv, streakPass: current + reward.amount };
            break;
          }

          case "trophies": {
            const gain = reward.amount;
            const trophies =
              typeof prev.trophies === "number" ? prev.trophies : 0;
            const total =
              typeof prev.totalTrophies === "number"
                ? prev.totalTrophies
                : trophies;

            next.trophies = trophies + gain;
            next.totalTrophies = total + gain;
            break;
          }
        }

        return next;
      });

      return reward;
    } catch (e: any) {
      console.error("DailyBonus error", e);
      Alert.alert(
        t("common.error", "Oups"),
        e?.message ||
          t(
            "dailyBonus.error",
            "Impossible de récupérer le bonus du jour pour le moment."
          )
      );
      return null;
    } finally {
      setDailyBonusLoading(false);
    }
  };

const handleClaimWelcomeBonus = async () => {
  if (!user || welcomeLoading || !welcomeState) return;

  // On fige le "jour" au moment du clic pour savoir si c'est un jour premium
  const clickedDay = welcomeState.currentDay;

  const isPremiumDay =
    !welcomeState.completed &&
    clickedDay >= 0 &&
    clickedDay < WELCOME_TOTAL_DAYS &&
    WELCOME_REWARDS_UI[clickedDay].type === "premium";

  try {
    setWelcomeLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const { state } = await claimWelcomeBonus(user.uid);

    // 💎 Anti-flicker : on FERME le modal tout de suite,
    // dans le même render où on met à jour le state
    setWelcomeVisible(false);

    // 🔁 mise à jour locale du welcomeState
    setWelcomeState(state);

    // Refresh userData Firestore...
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setUserData(snap.data());
    }

    // 🥂 Toast premium si c'était un jour premium AU MOMENT DU CLIC
    if (isPremiumDay) {
      const title = t(
        "premiumTrialActivated.title",
        "Premium ChallengeTies activé ✨"
      );
      const message = t(
        "premiumTrialActivated.message",
        "Tu viens de débloquer 7 jours de ChallengeTies Premium : aucune publicité et toute l'expérience en illimité. Profite à fond de ta lancée !"
      );
      showToast(`${title}\n${message}`, "success", { durationMs: 3500 });
    }
  } catch (e: any) {
    console.error("WelcomeBonus error", e);
    Alert.alert(
      t("common.error", "Oups"),
      e?.message ||
        t(
          "welcomeBonus.error",
          "Impossible de récupérer le bonus de bienvenue pour le moment."
        )
    );
  } finally {
    setWelcomeLoading(false);
  }
};


  const handleRerollDailyBonus = async (): Promise<DailyRewardResult | null> => {
    if (!userData || rerollLoading || !canRerollDailyBonus) return null;

    if (!rerollAdReady) {
      Alert.alert(
        t("common.error", "Oups"),
        t("dailyBonus.rerollUnavailable", "Pub en chargement…")
      );
      return null;
    }

    try {
      setRerollLoading(true);

      const earned = await new Promise<boolean>((resolve) => {
        let gotReward = false;

        const unsubEarned = rerollAd.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            gotReward = true;
          }
        );

        const unsubClosed = rerollAd.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            unsubEarned();
            unsubClosed();
            resolve(gotReward);
          }
        );

        rerollAd.show().catch(() => {
          unsubEarned();
          unsubClosed();
          resolve(false);
        });
      });

      if (!earned) return null;

      const reward = await claimDailyBonusReroll();
      setDailyReward(reward);

      setUserData((prev: any) => {
        if (!prev) return prev;
        const next: any = { ...prev };

        next.dailyBonus = {
          ...(prev.dailyBonus || {}),
          lastRerollDate: todayKeyUTC(),
        };

        switch (reward.type) {
          case "streakPass": {
            const inv = prev.inventory || {};
            const current =
              typeof inv.streakPass === "number" ? inv.streakPass : 0;
            next.inventory = {
              ...inv,
              streakPass: current + reward.amount,
            };
            break;
          }
          case "trophies": {
            const gain = reward.amount;
            const trophies =
              typeof prev.trophies === "number" ? prev.trophies : 0;
            const total =
              typeof prev.totalTrophies === "number"
                ? prev.totalTrophies
                : trophies;
            next.trophies = trophies + gain;
            next.totalTrophies = total + gain;
            break;
          }
        }

        return next;
      });

      return reward;
    } catch (e: any) {
      console.error("DailyBonus reroll error", e);
      Alert.alert(
        t("common.error", "Oups"),
        e?.message ||
          t(
            "dailyBonus.error",
            "Impossible de relancer le bonus du jour pour le moment."
          )
      );
      return null;
    } finally {
      setRerollLoading(false);
    }
  };

  const handleCloseDailyModal = () => {
    setDailyBonusVisible(false);
  };

  return (

    
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={staticStyles.gradientContainer}
      >
        <ScrollView
          ref={scrollRef}
          key={layoutKey}
          pointerEvents={isTutorialBlocking ? "none" : "auto"}
          contentContainerStyle={[
            staticStyles.scrollContent,
            { paddingBottom: bottomContentPadding },
          ]}
          bounces={false}
          overScrollMode="never"
          accessibilityElementsHidden={isTutorialBlocking}
  importantForAccessibility={isTutorialBlocking ? "no-hide-descendants" : "auto"}

          showsVerticalScrollIndicator={false}
          contentInset={{ top: 0, bottom: SPACING }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
        >
                  {/* SECTION HERO */}
        <Animated.View
          collapsable={false}
          renderToHardwareTextureAndroid
          needsOffscreenAlphaCompositing
          style={[
            staticStyles.heroSection,
            { height: HERO_TOTAL_HEIGHT },
            fadeStyle,
          ]}
        >
          <Video
            ref={heroVideoRef}
            style={[
              staticStyles.backgroundVideo,
              {
                top: -insets.top,
                height: HERO_TOTAL_HEIGHT,
              },
            ]}
            resizeMode={ResizeMode.COVER}
            source={require("../../assets/videos/Hero-Bgopti.mp4")}
            onReadyForDisplay={() => setVideoReady(true)}
            shouldPlay={heroShouldPlay}
            isLooping
            isMuted
            onError={() => {
              setVideoReady(false);
            }}
            onPlaybackStatusUpdate={async (status: any) => {
              if (status?.isLoaded && heroShouldPlay && !status.isPlaying) {
                try {
                  await heroVideoRef.current?.playAsync?.();
                } catch {}
              }
            }}
          />

          {/* Overlay Keynote : moins “ciné”, plus “product stage” */}
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.05)",
              "rgba(0,0,0,0.18)",
              "rgba(0,0,0,0.42)",
              "rgba(0,0,0,0.62)",
            ]}
            locations={[0, 0.35, 0.70, 1]}
            style={[
              staticStyles.heroOverlay,
              {
                top: -insets.top,
                height: HERO_TOTAL_HEIGHT,
              },
            ]}
            pointerEvents="none"
          />

          <View style={[staticStyles.heroContent, { paddingTop: insets.top + normalize(12) }]}>
            {/* Brand row : petit logo + label, très Apple */}
            <View style={staticStyles.heroBrandRow}>
              <Image
                source={require("../../assets/images/GreatLogo1.png")}
                style={staticStyles.logoKeynote}
                resizeMode="contain"
                accessibilityLabel={t("logoChallengeTies")}
                transition={180}
              />
              <View style={staticStyles.heroBrandPill}>
                <Text style={staticStyles.heroBrandPillText} numberOfLines={1}>
                  {t("homeZ.hero.brand", "CHALLENGETIES")}
                </Text>
              </View>
            </View>

            {/* Punchline : 1 vérité */}
            <Text
              style={[staticStyles.heroTitleKeynote, dynamicStyles.heroTitle]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.88}
            >
              {t("homeZ.hero.headline", "Reste régulier.")}
            </Text>

            {/* Proof line : courte, concrète */}
            <Text
              style={[staticStyles.heroSubtitleKeynote, dynamicStyles.heroSubtitle]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.90}
            >
              {t("homeZ.hero.sub", "Un défi simple. Chaque jour. En solo ou à deux.")}
            </Text>
            <Text
  style={[
    staticStyles.heroDuoProof,
    { color: "rgba(255,255,255,0.86)" },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
  minimumFontScale={0.92}
>
  {t("homeZ.hero.duoProof", "Le Duo transforme l’essai.")}
</Text>
          {/* Tutoriel (icône only) — top-right, ultra discret */}
          <Pressable
            onPress={() => {
              if (!isAnyBlockingModalOpen) openTutorial();
            }}
            disabled={isAnyBlockingModalOpen}
            accessibilityRole="button"
            accessibilityLabel={t("tutorial.open", "Ouvrir le tutoriel")}
            accessibilityHint={t(
              "tutorial.openHint",
              "Découvre comment utiliser ChallengeTies en 30 secondes"
            )}
            hitSlop={12}
            style={({ pressed }) => [
              staticStyles.tutorialFab,
              isAnyBlockingModalOpen && { opacity: 0.35 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <BlurView
              intensity={isDarkMode ? 22 : 18}
              tint={isDarkMode ? "dark" : "light"}
              style={staticStyles.tutorialFabBlur}
            >
              <View
                style={[
                  staticStyles.tutorialFabGlass,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(2,6,23,0.30)"
                      : "rgba(255,255,255,0.26)",
                  },
                ]}
              >
                <Ionicons
   name="sparkles"
   size={normalize(18)}
   color={isDarkMode ? "rgba(248,250,252,0.92)" : "rgba(2,6,23,0.92)"}
 />
              </View>
            </BlurView>
          </Pressable>


            <TouchableOpacity
              onPress={handlePickChallengePress}
              accessibilityRole="button"
             accessibilityLabel={t("homeZ.hero.ctaA11y", "Choisir un défi")}
              accessibilityHint={t("discover", {
                defaultValue: "Découvrir les défis",
              })}
              testID="cta-button"
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              onPressIn={() => {
                exploreScale.value = withSpring(0.96, {
                  damping: 18,
                  stiffness: 220,
                });
              }}
              onPressOut={() => {
                exploreScale.value = withSpring(1, {
                  damping: 16,
                  stiffness: 180,
                });
              }}
            >
              <Animated.View style={exploreAnimStyle}>
                <LinearGradient
                  colors={["#F97316", "#FB923C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={staticStyles.ctaButtonKeynote}
                >
                  <View style={staticStyles.heroCtaInner}>
                    <View style={staticStyles.heroCtaIcon}>
                      <Ionicons name="compass-outline" size={normalize(18)} color="#0B1120" />
                    </View>
                    <Text
                      style={staticStyles.ctaTextKeynote}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.90}
                    >
                      {heroCtaLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={normalize(18)} color="#0B1120" />
                  </View>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
{/* TODAY HUB — Keynote System Card */}
        <View style={staticStyles.todayHubWrap}>
          <View style={staticStyles.todayHubOuter}>
            <View
              style={[
                staticStyles.todayHubStroke,
                {
                  borderColor: isDarkMode
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(2,6,23,0.10)",
                },
              ]}
            >
              <LinearGradient
                colors={
                  isDarkMode
                    ? ["rgba(2,6,23,0.92)", "rgba(2,6,23,0.76)"]
                    : ["rgba(255,255,255,0.96)", "rgba(255,255,255,0.84)"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={staticStyles.todayHubCard}
              >
                <BlurView
                  intensity={isDarkMode ? 34 : 22}
                  tint={isDarkMode ? "dark" : "light"}
                  style={staticStyles.todayHubBlur}
                >
                  {/* Header */}
                  <View style={staticStyles.todayHubHeaderRow}>
                    <View style={staticStyles.todayHubBadge}>
                      <Ionicons name="flash" size={normalize(14)} color="#F97316" />
                      <Text style={staticStyles.todayHubBadgeText} numberOfLines={1}>
                        {t("homeZ.todayHub.badge", "AUJOURD’HUI")}
                      </Text>
                    </View>

                    <View style={staticStyles.todayHubMetaPill}>
                      <Ionicons
                        name={hasActiveChallenges ? "flame" : "sparkles"}
                        size={normalize(14)}
                        color={isDarkMode ? "#E2E8F0" : "#0B1120"}
                      />
                      <Text
                        style={[
                          staticStyles.todayHubMetaText,
                          { color: isDarkMode ? "#E2E8F0" : "#0B1120" },
                        ]}
                        numberOfLines={1}
                      >
                        {hasActiveChallenges
                          ? t("homeZ.todayHub.metaActive", {
                              defaultValue: "{{count}} défi(s) actif(s)",
                              count: currentChallenges.filter((c) => !c?.completed && !c?.archived).length,
                            })
                          : t("homeZ.todayHub.metaNone", "Aucun défi actif")}
                      </Text>
                    </View>
                  </View>

                  {/* Title + sub */}
                  <Text
                    style={[
                      staticStyles.todayHubTitle,
                      { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                    ]}
                    numberOfLines={2}
                  >
                    {hasActiveChallenges
                      ? t("homeZ.todayHub.titleActive2", "Marque aujourd’hui. Protège ta série.")
                       : t("homeZ.todayHub.titleNone2", "À deux, tu tiens. Lance ton Duo.")}
                  </Text>

                  <Text
                    style={[
                      staticStyles.todayHubSub,
                      {
                        color: isDarkMode
                          ? "rgba(226,232,240,0.78)"
                          : "rgba(15,23,42,0.70)",
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {hasActiveChallenges
                      ? t("homeZ.todayHub.subActive2", "1 clic pour valider. Ensuite : invite quelqu’un et double tes chances de tenir.")
 : t("homeZ.todayHub.subNone2", "Invite maintenant. Le solo, tu pourras le choisir après.")}
                  </Text>

                  {/* Active Challenge Preview (only when active) */}
                  {hasActiveChallenges && effectiveActiveMeta && (
                    <Pressable
                      onPress={handleOpenActiveChallenge}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "homeZ.todayHub.openActiveA11y",
                        "Ouvrir le défi actif"
                      )}
                      accessibilityHint={t(
                        "homeZ.todayHub.openActiveHint",
                        "Ouvre le détail du défi actif."
                      )}
                      hitSlop={10}
                      style={({ pressed }) => [
                        staticStyles.todayHubActiveCard,
                        pressed && { transform: [{ scale: 0.995 }], opacity: 0.96 },
                        {
                          borderColor: isDarkMode
                            ? "rgba(226,232,240,0.16)"
                            : "rgba(2,6,23,0.10)",
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(255,255,255,0.72)",
                        },
                      ]}
                    >
                      <View style={staticStyles.todayHubActiveLeft}>
                        <Image
                          source={getChallengeImageSource(effectiveActiveMeta)}
                          style={staticStyles.todayHubActiveImg}
                          contentFit="cover"
                          transition={180}
                          cachePolicy="memory-disk"
                          placeholder={BLURHASH}
                          placeholderContentFit="cover"
                          onError={() => markImageBroken(effectiveActiveMeta?.id)}
                        />
                      </View>

                      <View style={staticStyles.todayHubActiveMid}>
                        <Text
                          style={[
                            staticStyles.todayHubActiveTitle,
                            { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                          ]}
                          numberOfLines={1}
                        >
                          {effectiveActiveMeta.title || t("home.yourChallenge", "Ton défi")}
                        </Text>
                        {!!activeChallengeDescription && (
                          <Text
                            style={[
                              staticStyles.todayHubActiveSub,
                              { color: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)" },
                            ]}
                            numberOfLines={1}
                          >
                            {activeChallengeDescription}
                          </Text>
                        )}

                        {/* Progress */}
                        <View style={staticStyles.todayHubProgressRow}>
                          <View
                            style={[
                              staticStyles.todayHubProgressTrack,
                              { backgroundColor: isDarkMode ? "rgba(226,232,240,0.14)" : "rgba(2,6,23,0.10)" },
                            ]}
                          >
                            <View
                              style={[
                                staticStyles.todayHubProgressFill,
                                { width: `${Math.round(activeProgress.pct * 100)}%` },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              staticStyles.todayHubProgressText,
                              { color: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)" },
                            ]}
                            numberOfLines={1}
                          >
                            {t("homeZ.todayHub.progress", {
                              defaultValue: "{{done}}/{{total}} jours",
                              done: activeProgress.done,
                              total: Math.max(activeProgress.total, 0),
                            })}
                          </Text>
                        </View>
                      </View>

                      <View style={staticStyles.todayHubActiveRight}>
                        <Ionicons
                          name="chevron-forward"
                          size={normalize(18)}
                          color={isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.85)"}
                        />
                      </View>
                    </Pressable>
                  )}

                  {shouldShowDuoNudge && (
  <View
    style={[
      staticStyles.duoNudgeWrap,
      {
        borderColor: isDarkMode ? "rgba(249,115,22,0.28)" : "rgba(249,115,22,0.22)",
        backgroundColor: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.10)",
      },
    ]}
    accessibilityRole="summary"
    accessibilityLabel={t("homeZ.duoNudge.a11y", "Recommandation Duo")}
  >
    <View style={staticStyles.duoNudgeRow}>
      <View style={staticStyles.duoNudgeIcon}>
        <Ionicons name="people" size={normalize(16)} color="#F97316" />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            staticStyles.duoNudgeTitle,
            { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
          ]}
          numberOfLines={2}
        >
          {duoNudgeTitle}
        </Text>

        <Text
          style={[
            staticStyles.duoNudgeSub,
            { color: isDarkMode ? "rgba(226,232,240,0.72)" : "rgba(15,23,42,0.62)" },
          ]}
          numberOfLines={2}
        >
          {t("homeZ.duoNudge.sub", "Invite maintenant. Tu doubleras tes chances de tenir.")}
        </Text>
      </View>
    </View>

    <View style={staticStyles.duoNudgeActions}>
      <Pressable
        onPress={handleInviteFriendPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("homeZ.duoNudge.ctaA11y", "Inviter un ami en duo")}
        style={({ pressed }) => [
          staticStyles.duoNudgeCta,
          { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.992 : 1 }] },
        ]}
      >
        <LinearGradient
          colors={["#F97316", "#FB923C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={staticStyles.duoNudgeCtaGrad}
        >
          <Text style={staticStyles.duoNudgeCtaText} numberOfLines={1}>
            {t("homeZ.duoNudge.cta", "Duo")}
          </Text>
          <Ionicons name="arrow-forward" size={normalize(18)} color="#0B1120" />
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={handlePickChallengePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("homeZ.duoNudge.soloA11y", "Rester en solo")}
        accessibilityHint={t("homeZ.todayHub.soloHint", "Choisis un défi sans partenaire.")}
        style={({ pressed }) => [
          staticStyles.duoNudgeSolo,
          { opacity: pressed ? 0.75 : 0.92 },
        ]}
      >
        <Text
          style={[
            staticStyles.duoNudgeSoloText,
            { color: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.60)" },
          ]}
          numberOfLines={1}
        >
          {t("homeZ.duoNudge.solo", "Rester solo")}
        </Text>
      </Pressable>
    </View>
  </View>
)}


                  {/* Primary CTA */}
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={
   hasActiveChallenges
     ? handleMarkTodayPress
     : handleInviteFriendPress // ✅ Duo devient le CTA principal
 }
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasActiveChallenges
                        ? t("homeZ.todayHub.primaryActiveA11y", "Marquer aujourd’hui")
                        : t("homeZ.todayHub.primaryDuoA11y", "Inviter un ami en duo")
                    }
                    accessibilityHint={
                      hasActiveChallenges
                        ? t("homeZ.todayHub.primaryActiveHint2", "Ouvre Focus pour marquer ton jour.")
                        : t(
            "homeZ.todayHub.primaryDuoHint",
            "Choisis un défi, puis invite quelqu’un en duo."
          )
                    }
                    style={staticStyles.todayHubPrimaryBtnWrap}
                  >
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={staticStyles.todayHubPrimaryBtn}
                    >
                      <Text
                        style={staticStyles.todayHubPrimaryText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.92}
                      >
                        {todayPrimaryLabel}
                      </Text>
                      <Ionicons
                        name={hasActiveChallenges ? "checkmark-circle" : "arrow-forward"}
                        size={normalize(19)}
                        color="#0B1120"
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                  {!hasActiveChallenges && (
  <Pressable
    onPress={handlePickChallengePress}
    accessibilityRole="button"
    accessibilityLabel={t("homeZ.todayHub.soloA11y", "Continuer en solo")}
    accessibilityHint={t("homeZ.todayHub.soloHint", "Choisis un défi sans partenaire.")}
    hitSlop={10}
    style={({ pressed }) => [
      { alignSelf: "center", marginTop: normalize(10), opacity: pressed ? 0.75 : 0.9 },
    ]}
  >
    <Text
      style={[
        staticStyles.todayHubSoloLink,
        { color: isDarkMode ? "rgba(226,232,240,0.72)" : "rgba(15,23,42,0.62)" },
      ]}
      numberOfLines={1}
    >
      {t("homeZ.todayHub.solo", "Continuer en solo")}
    </Text>
  </Pressable>
)}


                  {/* Secondary actions — uniquement “Créer” (Solo déjà via “Continuer en solo”) */}
<View style={staticStyles.todayHubActionRowSingle}>
  <Pressable
    onPress={handleCreateChallengePress}
    accessibilityRole="button"
    accessibilityLabel={t("homeZ.todayHub.createA11y", "Créer un défi")}
    accessibilityHint={t("homeZ.todayHub.createHint", "Crée ton propre défi.")}
    hitSlop={10}
    style={({ pressed }) => [
      staticStyles.todayHubActionCardSingle,
      {
        borderColor: isDarkMode ? "rgba(226,232,240,0.18)" : "rgba(2,6,23,0.10)",
        backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.72)",
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.992 : 1 }],
      },
    ]}
  >
    <View style={[staticStyles.todayHubActionIcon, staticStyles.todayHubActionIconCentered]}>
      <Ionicons
        name="add-circle-outline"
        size={normalize(18)}
        color={isDarkMode ? "#E2E8F0" : "#0B1120"}
      />
    </View>

    <Text
      style={[
        staticStyles.todayHubActionTitle,
        { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.92}
    >
      {t("homeZ.todayHub.create", "Créer")}
    </Text>

    <Text
      style={[
        staticStyles.todayHubActionSub,
        { color: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)" },
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.92}
    >
      {t("homeZ.todayHub.createSub", "Ton défi, tes règles")}
    </Text>
  </Pressable>
</View>


                  {/* Micro */}
                  <Text
                    style={[
                      staticStyles.todayHubMicro,
                      { color: isDarkMode ? "rgba(226,232,240,0.58)" : "rgba(15,23,42,0.55)" },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.92}
                  >
                    {t("homeZ.todayHub.micro2", "Duo = motivation x2. Fais-le maintenant.")}
                  </Text>
                </BlurView>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* BONUS DU JOUR — Keynote Reward Card */}
{canClaimDailyBonus && (
  <View
    style={staticStyles.dailyBonusWrapper}
    accessibilityElementsHidden={isTutorialBlocking}
    importantForAccessibility={isTutorialBlocking ? "no-hide-descendants" : "auto"}
  >
    <Pressable
      onPress={async () => {
        if (!canClaimDailyBonus || dailyBonusLoading) return;
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
        setDailyBonusVisible(true);
      }}
      disabled={dailyBonusLoading}
      accessibilityRole="button"
      accessibilityLabel={t("dailyBonus.title", "Bonus du jour")}
      accessibilityHint={t("dailyBonus.hint", "Ouvre une récompense pour gagner un bonus.")}
      style={({ pressed }) => [
        { width: "100%", maxWidth: CONTENT_W, alignSelf: "center" },
        pressed && { transform: [{ scale: 0.995 }], opacity: 0.98 },
        dailyBonusLoading && { opacity: 0.70 },
      ]}
    >
      <View style={staticStyles.dailyBonusShell}>
        {/* subtle keynote backdrop to break "too white" */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(249,115,22,0.10)", "rgba(99,102,241,0.06)", "rgba(2,6,23,0.00)"]
              : ["rgba(249,115,22,0.10)", "rgba(99,102,241,0.06)", "rgba(255,255,255,0.00)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={staticStyles.dailyBonusBackdrop}
          pointerEvents="none"
        />
        {/* Stroke + glass */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]
              : ["rgba(15,23,42,0.14)", "rgba(15,23,42,0.06)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={staticStyles.dailyBonusStroke}
        >
          <LinearGradient
            colors={
              isDarkMode
                ? ["rgba(2,6,23,0.82)", "rgba(2,6,23,0.62)"]
                : ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.78)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={staticStyles.dailyBonusCard}
          >
            <BlurView
              intensity={isDarkMode ? 38 : 22}
              tint={isDarkMode ? "dark" : "light"}
              style={staticStyles.dailyBonusBlurKeynote}
            >
              {/* Glow pulse (discret) */}
              <Animated.View
                pointerEvents="none"
                style={[
                  staticStyles.dailyBonusGlow,
                  bonusPulseStyle,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(249,115,22,0.35)"
                      : "rgba(249,115,22,0.22)",
                  },
                ]}
              />

              {/* Header row */}
              <View style={staticStyles.dailyBonusHeaderRow}>
                <View
                  style={[
                    staticStyles.dailyBonusBadge,
                    {
                      borderColor: isDarkMode
                        ? "rgba(249,115,22,0.30)"
                        : "rgba(249,115,22,0.22)",
                      backgroundColor: isDarkMode
                        ? "rgba(249,115,22,0.14)"
                        : "rgba(249,115,22,0.10)",
                    },
                  ]}
                >
                  <Ionicons name="sparkles" size={normalize(14)} color="#F97316" />
                  <Text
                    style={[
                      staticStyles.dailyBonusBadgeText,
                      { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                    ]}
                    numberOfLines={1}
                  >
                    {t("dailyBonus.badge", "RÉCOMPENSE")}
                  </Text>
                </View>

                <View
                  style={[
                    staticStyles.dailyBonusMiniPill,
                    {
                      borderColor: isDarkMode
                        ? "rgba(226,232,240,0.18)"
                        : "rgba(2,6,23,0.10)",
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.70)",
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={normalize(14)}
                    color={isDarkMode ? "rgba(226,232,240,0.90)" : "rgba(2,6,23,0.90)"}
                  />
                  <Text
                    style={[
                      staticStyles.dailyBonusMiniPillText,
                      { color: isDarkMode ? "rgba(226,232,240,0.92)" : "rgba(2,6,23,0.92)" },
                    ]}
                    numberOfLines={1}
                  >
                    {t("dailyBonus.oncePerDay", "1 / jour")}
                  </Text>
                </View>
              </View>

              {/* Main content */}
              <View style={staticStyles.dailyBonusMainRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      staticStyles.dailyBonusTitleKeynote,
                      { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.88}
                  >
                    {t("dailyBonus.title", "Bonus du jour")}
                  </Text>

                  <Text
                    style={[
                      staticStyles.dailyBonusSubKeynote,
                      {
                        color: isDarkMode
                          ? "rgba(226,232,240,0.70)"
                          : "rgba(15,23,42,0.62)",
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.92}
                  >
                    {dailyBonusLoading
                      ? t("dailyBonus.loading", "Ouverture…")
                      : t("dailyBonus.teaser2", "Ouvre et découvre ta récompense mystère.")}
                  </Text>

                  {/* CTA pill */}
                  <View style={staticStyles.dailyBonusCtaRow}>
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={staticStyles.dailyBonusCtaPill}
                    >
                      <Text style={staticStyles.dailyBonusCtaText} numberOfLines={1}>
                        {t("dailyBonus.cta", "Ouvrir")}
                      </Text>
                      <Ionicons name="chevron-forward" size={normalize(18)} color="#0B1120" />
                    </LinearGradient>

                    <Text
                      style={[
                        staticStyles.dailyBonusMicro,
                        { color: isDarkMode ? "rgba(226,232,240,0.55)" : "rgba(15,23,42,0.55)" },
                      ]}
                      numberOfLines={1}
                    >
                      {t("dailyBonus.micro", "Rapide. Simple. Reward.")} 
                    </Text>
                  </View>
                </View>

                {/* Icon */}
                <View style={staticStyles.dailyBonusIconWrap}>
                  <LinearGradient
                    colors={
                      isDarkMode
                        ? ["rgba(249,115,22,0.28)", "rgba(249,115,22,0.14)"]
                        : ["rgba(249,115,22,0.18)", "rgba(249,115,22,0.10)"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={staticStyles.dailyBonusIconCircleKeynote}
                  >
                    <View
                      style={[
                        staticStyles.dailyBonusIconInnerKeynote,
                        {
                          borderColor: isDarkMode
                            ? "rgba(255,255,255,0.18)"
                            : "rgba(2,6,23,0.10)",
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(255,255,255,0.75)",
                        },
                      ]}
                    >
                      <Ionicons
                        name="gift-outline"
                        size={normalize(26)}
                        color={isDarkMode ? "#F8FAFC" : "#0B1120"}
                      />
                    </View>
                  </LinearGradient>
                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </LinearGradient>
      </View>
    </Pressable>
  </View>
)}



          {/* DAILY FIVE */}
          <View style={staticStyles.section}>
            <View style={stylesDaily.titleRow}>
              <Text
                style={[staticStyles.sectionTitle, dynamicStyles.sectionTitle]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t("dailyChallenges", { defaultValue: "Défis du jour" })}
              </Text>
              <Text
                style={[
                  stylesDaily.subtitle,
                  {
                    color: isDarkMode
                      ? "rgba(255,255,255,0.70)"
                      : "rgba(15,23,42,0.65)",
                  },
                ]}
                numberOfLines={1}
              >
                {t("dailySelectedSubtitleShort", { defaultValue: "Sélection du jour." })}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={currentTheme.colors.secondary}
              />
            ) : dailyFive.length > 0 ? (
              <View style={stylesDaily.wrap}>
                {/* Hero card */}
                <Animated.View
                  entering={FadeInUp}
                  style={stylesDaily.heroCard}
                  renderToHardwareTextureAndroid
                >
                  <TouchableOpacity
                    accessibilityRole="imagebutton"
                    activeOpacity={0.95}
                    onPress={async () => {
                      try {
                        await Haptics.selectionAsync();
                      } catch {}
                      safeNavigate(
                        `/challenge-details/${dailyFive[0].id}?title=${encodeURIComponent(
                          dailyFive[0].title
                        )}&category=${encodeURIComponent(
                          dailyFive[0].category
                        )}&description=${encodeURIComponent(
                          dailyFive[0].description
                        )}`
                      );
                    }}
                  >
                    <Image
   source={getChallengeImageSource(dailyFive[0])}
  style={stylesDaily.heroImage}
  contentFit="cover"
  transition={180}
  cachePolicy="memory-disk"
  priority="high"
  placeholder={BLURHASH}
  placeholderContentFit="cover"
  allowDownscaling
  onError={() => markImageBroken(dailyFive[0]?.id)}
/>


                    <LinearGradient
                      colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
                       locations={[0, 0.55, 1]}
                      style={stylesDaily.heroOverlay}
                      pointerEvents="none"
                    />
                    <View style={stylesDaily.badge}>
                      <Ionicons
                        name="flame-outline"
                        size={normalize(14)}
                        color="#fff"
                      />
                      <Text style={stylesDaily.badgeText}>
                        {t("spotlight", { defaultValue: "À la une" })}
                      </Text>
                    </View>
                    <View style={stylesDaily.heroTextZone}>
                      <Text
                        style={stylesDaily.heroTitle}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.90}
                      >
                        {dailyFive[0].title}
                      </Text>
                      <View style={stylesDaily.heroCatPill}>
                        <Text style={stylesDaily.heroCatPillText} numberOfLines={1}>
                          {dailyFive[0].category}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>

                {/* Grid 2x2 pour les 4 autres */}
                <View style={stylesDaily.grid}>
                  {dailyFive.slice(1).map((item, idx) => (
                    <Animated.View
                      key={item.id}
                      entering={FadeInUp.delay(80 * (idx + 1))}
                      style={stylesDaily.miniCard}
                      renderToHardwareTextureAndroid
                    >
                      <TouchableOpacity
                        activeOpacity={0.95}
                        onPress={async () => {
                          try {
                            await Haptics.selectionAsync();
                          } catch {}
                          safeNavigate(
                            `/challenge-details/${item.id}?title=${encodeURIComponent(
                              item.title
                            )}&category=${encodeURIComponent(
                              item.category
                            )}&description=${encodeURIComponent(
                              item.description
                            )}`
                          );
                        }}
                      >
                       <Image
  source={getChallengeImageSource(item)}
  style={stylesDaily.miniImage}
  contentFit="cover"
  transition={140}
  cachePolicy="memory-disk"
  priority="high"
  placeholder={BLURHASH}
  placeholderContentFit="cover"
 onError={() => markImageBroken(item?.id)}
/>


                        <LinearGradient
                          colors={[
                            "rgba(0,0,0,0.02)",
                            "rgba(0,0,0,0.55)",
                            "rgba(0,0,0,0.88)",
                          ]}
                          locations={[0, 0.55, 1]}
                          style={stylesDaily.miniOverlay}
                          pointerEvents="none"
                        />
                        <Text
                          style={stylesDaily.miniTitle}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.90}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={stylesDaily.miniCat}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.92}
                        >
                          {item.category}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>

                <Text
                  style={[
                    stylesDaily.footHint,
                    {
                      color: isDarkMode
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(15,23,42,0.6)",
                    },
                  ]}
                >
                  {t("refreshDaily", {
                    defaultValue: "Nouveaux défis dès demain ✨",
                  })}
                </Text>
                <TouchableOpacity
                  onPress={handlePickChallengePress}
                  activeOpacity={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t("homeZ.dailyPicks.seeAllA11y", "Voir tous les défis")}
                  accessibilityHint={t(
                    "homeZ.dailyPicks.seeAllHint",
                    "Ouvre Explore pour découvrir tous les défis."
                  )}
                  style={staticStyles.seeAllWrap}
                >
                  <View
                    style={[
                      staticStyles.seeAllBtn,
                      {
                        borderColor: isDarkMode
                          ? "rgba(226,232,240,0.20)"
                          : "rgba(15,23,42,0.14)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        staticStyles.seeAllText,
                        { color: isDarkMode ? "#E2E8F0" : "#0B1120" },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t("homeZ.dailyPicks.seeAll", "Tout voir dans Explore")}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={normalize(18)}
                      color={isDarkMode ? "#E2E8F0" : "#0B1120"}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View
                entering={FadeInUp}
                style={staticStyles.noChallengesContainer}
              >
                <Ionicons
                  name="sad-outline"
                  size={normalize(40)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    staticStyles.noChallengesText,
                    dynamicStyles.noChallengesText,
                  ]}
                >
                  {t("noChallengesAvailable")}
                </Text>
                <Text
                  style={[
                    staticStyles.noChallengesSubtext,
                    dynamicStyles.noChallengesSubtext,
                  ]}
                >
                  {t("challengesComingSoon")}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* DISCOVER — seulement 3 raccourcis : NewFeatures / Leaderboard / Tips */}
{/* DISCOVER — Keynote : 2 cartes (Leaderboards + Tips) + “Voir plus” */}
          <View
            style={staticStyles.discoverWrapper}
            accessibilityElementsHidden={isTutorialBlocking}
            importantForAccessibility={
              isTutorialBlocking ? "no-hide-descendants" : "auto"
            }
          >
            <View
              style={[
                staticStyles.discoverCardShell,
                staticStyles.keynoteCardShell,
                {
                  borderColor: isDarkMode
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(2,6,23,0.08)",
                  backgroundColor: isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(2,6,23,0.03)",
                },
              ]}
            >
              <View style={staticStyles.discoverHeader}>
                <Text
                  style={[
                    staticStyles.discoverTitle,
                    { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t("homeZ.discover.title", "Découvrir")}
                </Text>

                <Text
                  style={[
                    staticStyles.discoverSub,
                    {
                      color: isDarkMode
                        ? "rgba(226,232,240,0.70)"
                        : "rgba(15,23,42,0.60)",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t("homeZ.discover.subtitle2", "L’essentiel. Le reste en bas.")}
                </Text>
              </View>

              <View style={staticStyles.discoverRow2}>
                {/* Leaderboard */}
                <Pressable
                  onPress={() => safeNavigate("/leaderboard")}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    "homeZ.discover.leaderboardA11y",
                    "Classement"
                  )}
                  accessibilityHint={t(
                    "homeZ.discover.leaderboardHint",
                    "Consulte le classement et tes trophées."
                  )}
                  style={({ pressed }) => [
                    staticStyles.discoverBigCard,
                    {
                      borderColor: isDarkMode
                        ? "rgba(226,232,240,0.18)"
                        : "rgba(15,23,42,0.10)",
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.75)",
                      opacity: pressed ? 0.96 : 1,
                      transform: [{ scale: pressed ? 0.992 : 1 }],
                    },
                  ]}
                  hitSlop={10}
                >
                  <View
                    style={[
                      staticStyles.discoverBigIcon,
                      {
                        borderColor: isDarkMode
                          ? "rgba(249,115,22,0.34)"
                          : "rgba(249,115,22,0.28)",
                        backgroundColor: "rgba(249,115,22,0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={normalize(18)}
                      color="#F97316"
                    />
                  </View>
                  <Text
                    style={[
                      staticStyles.discoverBigTitle,
                      { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t("homeZ.discover.leaderboard", "Classement")}
                  </Text>
                  <Text
                    style={[
                      staticStyles.discoverBigSub,
                      {
                        color: isDarkMode
                          ? "rgba(226,232,240,0.70)"
                          : "rgba(15,23,42,0.62)",
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.92}
                  >
                    {t("homeZ.discover.leaderboardSub2", "Social proof. Motivation.")}
                  </Text>
                </Pressable>

                {/* Tips */}
                <Pressable
                  onPress={() => safeNavigate("/tips")}
                  accessibilityRole="button"
                  accessibilityLabel={t("homeZ.discover.tipsA11y", "Tips")}
                  accessibilityHint={t(
                    "homeZ.discover.tipsHint",
                    "Découvre des astuces courtes et actionnables."
                  )}
                  style={({ pressed }) => [
                    staticStyles.discoverBigCard,
                    {
                      borderColor: isDarkMode
                        ? "rgba(226,232,240,0.18)"
                        : "rgba(15,23,42,0.10)",
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.75)",
                      opacity: pressed ? 0.96 : 1,
                      transform: [{ scale: pressed ? 0.992 : 1 }],
                    },
                  ]}
                  hitSlop={10}
                >
                  <View
                    style={[
                      staticStyles.discoverBigIcon,
                      {
                        borderColor: isDarkMode
                          ? "rgba(249,115,22,0.34)"
                          : "rgba(249,115,22,0.28)",
                        backgroundColor: "rgba(249,115,22,0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      name="bulb-outline"
                      size={normalize(18)}
                      color="#F97316"
                    />
                  </View>
                  <Text
                    style={[
                      staticStyles.discoverBigTitle,
                      { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t("homeZ.discover.tips", "Tips")}
                  </Text>
                  <Text
                    style={[
                      staticStyles.discoverBigSub,
                      {
                        color: isDarkMode
                          ? "rgba(226,232,240,0.70)"
                          : "rgba(15,23,42,0.62)",
                      },
                    ]}
                    
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.92}
                  >
                    {t("homeZ.discover.tipsSub2", "1 minute. Action immédiate.")}
                  </Text>
                </Pressable>
              </View>

              {/* NewFeatures — 3e chemin Keynote (carte large) */}
              <Pressable
                onPress={() => safeNavigate("/new-features")}
                accessibilityRole="button"
                accessibilityLabel={t("homeZ.discover.newFeaturesA11y", "Nouveautés")}
                accessibilityHint={t("homeZ.discover.newFeaturesHint", "Découvre les nouveautés et vote pour la suite.")}
                hitSlop={10}
                style={({ pressed }) => [
                  staticStyles.discoverWideCard,
                  {
                    borderColor: isDarkMode
                      ? "rgba(226,232,240,0.18)"
                      : "rgba(15,23,42,0.10)",
                    backgroundColor: isDarkMode
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.75)",
                    opacity: pressed ? 0.96 : 1,
                    transform: [{ scale: pressed ? 0.992 : 1 }],
                  },
                ]}
              >
                <View style={staticStyles.discoverWideLeft}>
                  <View
                    style={[
                      staticStyles.discoverBigIcon,
                      {
                        borderColor: isDarkMode
                          ? "rgba(249,115,22,0.34)"
                          : "rgba(249,115,22,0.28)",
                        backgroundColor: "rgba(249,115,22,0.12)",
                        marginBottom: 0,
                      },
                    ]}
                  >
                    <Ionicons name="sparkles-outline" size={normalize(18)} color="#F97316" />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        staticStyles.discoverWideTitle,
                        { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t("homeZ.discover.newFeatures", "Nouveautés")}
                    </Text>
                    <Text
                      style={[
                        staticStyles.discoverWideSub,
                        {
                          color: isDarkMode
                            ? "rgba(226,232,240,0.70)"
                            : "rgba(15,23,42,0.62)",
                        },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.92}
                    >
                      {t("homeZ.discover.newFeaturesSub", "Découvre. Vote. Influence l’app.")}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={normalize(18)}
                  color={isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.85)"}
                />
              </Pressable>
            </View>
          </View>

        </ScrollView>

                {/* Hairline au-dessus de la bannière */}
        {shouldShowBanner && adHeight > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom + adHeight + 6,
              height: StyleSheet.hairlineWidth,
              backgroundColor: isDarkMode
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
              zIndex: 9999,
            }}
          />
        )}

        {/* Bannière dockée au-dessus de la TabBar */}
        {shouldShowBanner && (
          <>
            <View
            key={`banner-${bannerKey}`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: tabBarHeight + insets.bottom,
                alignItems: "center",
                zIndex: 9999,
                backgroundColor: "transparent",
                paddingBottom: 6,
              }}
              pointerEvents="box-none"
            >
              <BannerSlot onHeight={handleAdHeight} docked />
            </View>
          </>
        )}


        {isTutorialActive && (
          <>
            <BlurView intensity={35} style={staticStyles.blurView} />
            <TutorialModal
              step={tutorialStep}
              onNext={() => {
                const next = Math.min(
                  tutorialStep + 1,
                  TUTORIAL_STEPS.length - 1
                );
                setTutorialStep(next);
              }}
              onStart={() => {
                startTutorial?.();
                setTutorialStep(1);
              }}
              onSkip={skipTutorial}
              onFinish={skipTutorial}
            />
          </>
        )}

         {effectiveWelcomeReward && welcomeState && (
          <WelcomeBonusModal
            visible={welcomeVisible}
            onClose={() => setWelcomeVisible(false)}
            onClaim={handleClaimWelcomeBonus}
            currentDay={welcomeState.currentDay}
            totalDays={WELCOME_TOTAL_DAYS}
            rewardType={effectiveWelcomeReward.type}
            rewardAmount={effectiveWelcomeReward.amount}
            loading={welcomeLoading}
          />
        )}

        <DailyBonusModal
          visible={dailyBonusVisible}
          onClose={handleCloseDailyModal}
          onClaim={handleClaimDailyBonus}
          reward={dailyReward}
          loading={dailyBonusLoading}
          canReroll={canRerollDailyBonus}
          onReroll={handleRerollDailyBonus}
          rerollLoading={rerollLoading}
          rerollAdReady={rerollAdReady}
          rerollAdLoading={rerollAdLoading}
        />

        <RequireAuthModal visible={modalVisible} onClose={closeGate} />

        {/* 💎 Modal fin de Premium ChallengeTies */}
        <Modal
          visible={showPremiumEndModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPremiumEndModal(false)}
        >
          <View style={staticStyles.blurView}>
            <View style={staticStyles.modalContainer}>
              <Ionicons
                name="diamond-outline"
                size={normalize(36)}
                color="#6366F1"
              />

              <Text
                style={staticStyles.modalTitle}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {t("premiumEndModal.title", "Fin de ton Premium ChallengeTies")}
              </Text>

              <Text style={staticStyles.modalDescription}>
                {t(
                  "premiumEndModal.description",
                  "Ton accès Premium de 7 jours est terminé. Si ChallengeTies t'aide à garder le cap, rejoins le mouvement et soutiens le projet pour débloquer à nouveau l'expérience sans publicité."
                )}
              </Text>

              <View style={staticStyles.buttonContainer}>
                <TouchableOpacity
                  onPress={() => setShowPremiumEndModal(false)}
                  style={[
                    staticStyles.actionButton,
                    { backgroundColor: "#E5E7EB" },
                  ]}
                  accessibilityLabel={t(
                    "premiumEndModal.closeA11y",
                    "Fermer la fenêtre"
                  )}
                >
                  <Text
                    style={[
                      staticStyles.actionButtonText,
                      { color: "#111827" },
                    ]}
                  >
                    {t("premiumEndModal.closeCta", "Continuer gratuitement")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowPremiumEndModal(false);
                    // 🔁 À ajuster quand tu auras un vrai écran Premium
                    safeNavigate("/settings", "premium-end-modal");
                  }}
                  style={[staticStyles.actionButton]}
                  accessibilityLabel={t(
                    "premiumEndModal.joinA11y",
                    "Rejoindre le mouvement Premium"
                  )}
                >
                  <Text style={staticStyles.actionButtonText}>
                    {t(
                      "premiumEndModal.joinCta",
                      "Rejoindre le mouvement Premium"
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  todayHubSoloLink: {
   fontSize: normalize(12.6),
   fontFamily: "Comfortaa_700Bold",
   textDecorationLine: "underline",
   textDecorationStyle: "solid",
 },
  keynoteCardShell: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
discoverCardShell: {
  width: "100%",
  maxWidth: CONTENT_W,
  alignSelf: "center",
  borderRadius: normalize(24),
  padding: normalize(16),
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.06)",
  overflow: "hidden",
},
discoverHeader: {
  alignItems: "center",
  marginBottom: normalize(12),
},
discoverTitle: {
  fontSize: normalize(18),
  lineHeight: normalize(22),
  fontFamily: "Comfortaa_700Bold",
  textAlign: "center",
},
discoverSub: {
  marginTop: normalize(6),
  fontSize: normalize(12.8),
  lineHeight: normalize(17),
  fontFamily: "Comfortaa_400Regular",
  textAlign: "center",
  includeFontPadding: false,
},
discoverRow2: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: normalize(10),
  },
  discoverWideCard: {
  width: "100%",
  marginTop: normalize(10),
  borderRadius: normalize(18),
  padding: normalize(14),
  borderWidth: StyleSheet.hairlineWidth,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: normalize(84),
},
discoverWideLeft: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(12),
  flex: 1,
  minWidth: 0,
},
discoverWideTitle: {
  fontSize: normalize(13.8),
  fontFamily: "Comfortaa_700Bold",
  marginBottom: normalize(4),
},
discoverWideSub: {
  fontSize: normalize(12.2),
  lineHeight: normalize(16),
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},

  discoverBigCard: {
    flex: 1,
    minHeight: normalize(104),
    borderRadius: normalize(18),
    padding: normalize(14),
    borderWidth: StyleSheet.hairlineWidth,
  },
  discoverBigIcon: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: normalize(10),
  },
  discoverBigTitle: {
    fontSize: normalize(13.6),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(4),
  },
  discoverBigSub: {
    fontSize: normalize(12.0),
    lineHeight: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
todayHubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalize(10),
    gap: normalize(10),
  },

  todayHubActiveCard: {
    width: "100%",
    borderRadius: normalize(18),
    borderWidth: StyleSheet.hairlineWidth,
    padding: normalize(10),
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(10),
    marginBottom: normalize(12),
  },
  todayHubActiveLeft: {
    width: normalize(44),
    height: normalize(44),
    borderRadius: normalize(14),
    overflow: "hidden",
  },
  heroDuoProof: {
   width: "100%",
   maxWidth: CONTENT_W,
   fontSize: normalize(12.8),
   lineHeight: normalize(16),
   fontFamily: "Comfortaa_700Bold",
   textAlign: "center",
   marginBottom: normalize(10),
   opacity: 0.92,
 },
  todayHubActiveImg: {
    width: "100%",
    height: "100%",
  },
  todayHubActiveMid: {
    flex: 1,
    minWidth: 0,
  },
  todayHubActiveRight: {
    width: normalize(22),
    alignItems: "flex-end",
    justifyContent: "center",
  },
  todayHubActiveTitle: {
    fontSize: normalize(13.4),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(2),
  },
  todayHubActiveSub: {
    fontSize: normalize(11.6),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalize(8),
  },
  duoNudgeWrap: {
  width: "100%",
  borderRadius: normalize(18),
  borderWidth: StyleSheet.hairlineWidth,
  padding: normalize(12),
  marginBottom: normalize(12),
},
duoNudgeRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: normalize(10),
  marginBottom: normalize(10),
},
duoNudgeIcon: {
  width: normalize(34),
  height: normalize(34),
  borderRadius: normalize(17),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(249,115,22,0.12)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(249,115,22,0.22)",
},
todayHubActionRowSingle: {
  marginTop: normalize(10),
  alignItems: "center",
  width: "100%",
},
todayHubActionIconCentered: {
  marginBottom: normalize(8),
},

todayHubActionCardSingle: {
  width: "100%",
  borderRadius: normalize(18),
  padding: normalize(12),
  maxWidth: Math.min(CONTENT_W, normalize(170)),
  borderWidth: StyleSheet.hairlineWidth,
  minHeight: normalize(84),
   alignSelf: "center",
   alignItems: "center",
  justifyContent: "center",
},

duoNudgeTitle: {
  fontSize: normalize(13.2),
  lineHeight: normalize(17),
  fontFamily: "Comfortaa_700Bold",
  marginBottom: normalize(4),
},
duoNudgeSub: {
  fontSize: normalize(12.0),
  lineHeight: normalize(16),
  fontFamily: "Comfortaa_400Regular",
},
duoNudgeActions: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: normalize(10),
},
dailyBonusShell: {
  width: "100%",
  maxWidth: CONTENT_W,
  alignSelf: "center",
  borderRadius: normalize(24),
  position: "relative",
},
dailyBonusBackdrop: {
  position: "absolute",
  left: normalize(-14),
  right: normalize(-14),
  top: normalize(-12),
  bottom: normalize(-12),
  borderRadius: normalize(28),
  opacity: 0.9,
},

dailyBonusStroke: {
  borderRadius: normalize(24),
  padding: normalize(1),
  borderWidth: StyleSheet.hairlineWidth,
  shadowOffset: { width: 0, height: normalize(7) },
 shadowOpacity: 0.14,
 shadowRadius: normalize(14),
 elevation: 5,
},

dailyBonusCard: {
  borderRadius: normalize(23),
  overflow: "hidden",
},

dailyBonusBlurKeynote: {
  borderRadius: normalize(23),
  overflow: "hidden",
  padding: normalize(14),
},

dailyBonusGlow: {
  position: "absolute",
  left: normalize(-40),
  right: normalize(-40),
  top: normalize(-40),
  height: normalize(120),
  borderRadius: normalize(999),
  transform: [{ rotate: "-10deg" }],
},

dailyBonusHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: normalize(10),
  gap: normalize(10),
},

dailyBonusBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(6),
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: normalize(999),
  borderWidth: StyleSheet.hairlineWidth,
  maxWidth: "65%",
},

dailyBonusBadgeText: {
  fontSize: normalize(11),
  fontFamily: "Comfortaa_700Bold",
  letterSpacing: 0.4,
},

dailyBonusMiniPill: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(6),
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: normalize(999),
  borderWidth: StyleSheet.hairlineWidth,
},

dailyBonusMiniPillText: {
  fontSize: normalize(11.2),
  fontFamily: "Comfortaa_700Bold",
},

dailyBonusMainRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: normalize(12),
},
dailyBonusTitleKeynote: {
  fontSize: normalize(16.8),
  lineHeight: normalize(21),
  fontFamily: "Comfortaa_700Bold",
  marginBottom: normalize(6),
  includeFontPadding: false,
},
dailyBonusSubKeynote: {
  fontSize: normalize(13.0),
  lineHeight: normalize(18),
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},
dailyBonusCtaRow: {
  marginTop: normalize(12),
  gap: normalize(8),
},

dailyBonusCtaPill: {
  alignSelf: "flex-start",
  borderRadius: normalize(16),
  paddingVertical: normalize(10),
  paddingHorizontal: normalize(12),
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(8),
  shadowColor: "#000",
  shadowOffset: { width: 0, height: normalize(6) },
  shadowOpacity: 0.22,
  shadowRadius: normalize(14),
  elevation: 6,
},

dailyBonusCtaText: {
  fontSize: normalize(13.2),
  fontFamily: "Comfortaa_700Bold",
  color: "#0B1120",
},

dailyBonusMicro: {
  fontSize: normalize(11.6),
  fontFamily: "Comfortaa_400Regular",
},

dailyBonusIconWrap: {
  width: normalize(72),
  alignItems: "flex-end",
},

dailyBonusIconCircleKeynote: {
  width: normalize(64),
  height: normalize(64),
  borderRadius: normalize(32),
  alignItems: "center",
  justifyContent: "center",
},

dailyBonusIconInnerKeynote: {
  width: normalize(54),
  height: normalize(54),
  borderRadius: normalize(27),
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
},

duoNudgeCta: {
  flex: 1,
  borderRadius: normalize(16),
  overflow: "hidden",
},
duoNudgeCtaGrad: {
  borderRadius: normalize(16),
  paddingVertical: normalize(10),
  paddingHorizontal: normalize(12),
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
duoNudgeCtaText: {
  fontSize: normalize(13.2),
  fontFamily: "Comfortaa_700Bold",
  color: "#0B1120",
},
duoNudgeSolo: {
  paddingVertical: normalize(10),
  paddingHorizontal: normalize(6),
},
duoNudgeSoloText: {
  fontSize: normalize(12.2),
  fontFamily: "Comfortaa_700Bold",
  textDecorationLine: "underline",
},

  todayHubProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: normalize(10),
  },
  todayHubProgressTrack: {
    flex: 1,
    height: normalize(6),
    borderRadius: normalize(999),
    overflow: "hidden",
  },
  todayHubProgressFill: {
    height: "100%",
    borderRadius: normalize(999),
    backgroundColor: "#F97316",
  },
  todayHubProgressText: {
    fontSize: normalize(11.2),
    fontFamily: "Comfortaa_700Bold",
  },

  todayHubActionRow: {
    marginTop: normalize(10),
    flexDirection: "row",
    gap: normalize(10),
  },
  todayHubActionCard: {
    flex: 1,
    borderRadius: normalize(18),
    padding: normalize(12),
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: normalize(84),
  },
  todayHubActionIcon: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(10),
  },
  todayHubActionTitle: {
    fontSize: normalize(13.2),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(4),
    minWidth: 0,
    textAlign: "center",
  },
  todayHubActionSub: {
    fontSize: normalize(12.0),
    lineHeight: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    minWidth: 0,
    textAlign: "center",
  },
  discoverMoreWrap: {
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
    marginTop: normalize(12),
  },
  discoverMoreBtn: {
    width: "100%",
    borderRadius: normalize(16),
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  discoverMoreText: {
    flex: 1,
    minWidth: 0,
    marginRight: normalize(10),
    fontSize: normalize(12.8),
    fontFamily: "Comfortaa_700Bold",
  },
seeAllWrap: {
  width: CONTENT_W,
  marginTop: normalize(2),
  marginBottom: normalize(6),
},
seeAllBtn: {
  width: "100%",
  borderRadius: normalize(16),
  paddingVertical: normalize(12),
  paddingHorizontal: normalize(12),
  borderWidth: StyleSheet.hairlineWidth,
  backgroundColor: "rgba(255,255,255,0.06)",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
seeAllText: {
  flex: 1,
  minWidth: 0,
  marginRight: normalize(10),
  fontSize: normalize(12.8),
  fontFamily: "Comfortaa_700Bold",
},

  tutorialFab: {
  position: "absolute",
  top: normalize(10),
  right: normalize(14),
  zIndex: 50,
},
todayHubWrap: {
  paddingHorizontal: SPACING,
  marginTop: SPACING * 1.1,
  marginBottom: SPACING * 0.9,
  width: "100%",
  alignItems: "center",
},
todayHubOuter: {
  width: "100%",
  maxWidth: CONTENT_W,
},
todayHubStroke: {
  borderRadius: normalize(24),
  padding: normalize(1),
 borderWidth: StyleSheet.hairlineWidth,
  shadowColor: "#000",
 shadowOffset: { width: 0, height: normalize(8) },
 shadowOpacity: 0.14,
 shadowRadius: normalize(14),
 elevation: 5,
},
todayHubCard: {
  borderRadius: normalize(23),
  overflow: "hidden",
},
todayHubBlur: {
  borderRadius: normalize(23),
  overflow: "hidden",
  padding: normalize(16),
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.10)",
},
todayHubBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(6),
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: normalize(999),
 backgroundColor: "rgba(15,23,42,0.42)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
},
todayHubBadgeText: {
  fontSize: normalize(11),
  fontFamily: "Comfortaa_700Bold",
  color: "#E2E8F0",
  letterSpacing: 0.3,
},
todayHubMetaPill: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalize(6),
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: normalize(999),
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.10)",
  maxWidth: "55%",
},
todayHubMetaText: {
  fontSize: normalize(11.2),
  fontFamily: "Comfortaa_700Bold",
},
todayHubTitle: {
  fontSize: normalize(18.5),
  lineHeight: normalize(23),
  fontFamily: "Comfortaa_700Bold",
  marginBottom: normalize(6),
  includeFontPadding: false,
},
todayHubSub: {
  fontSize: normalize(13),
  lineHeight: normalize(18),
  fontFamily: "Comfortaa_400Regular",
  marginBottom: normalize(12),
  includeFontPadding: false,
},
todayHubPrimaryBtnWrap: {
  width: "100%",
  borderRadius: normalize(18),
  overflow: "hidden",
},
todayHubPrimaryBtn: {
  borderRadius: normalize(18),
  paddingVertical: normalize(12),
  paddingHorizontal: normalize(14),
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  shadowColor: "#000",
 shadowOffset: { width: 0, height: normalize(5) },
 shadowOpacity: 0.18,
 shadowRadius: normalize(12),
 elevation: 4,
},
todayHubPrimaryText: {
  fontSize: normalize(14.2),
  fontFamily: "Comfortaa_700Bold",
  color: "#0B1120",
  marginRight: normalize(10),
  flex: 1,
 minWidth: 0,
 textAlign: "center",
 includeFontPadding: false,
},
todayHubMicro: {
  marginTop: normalize(10),
  fontSize: normalize(11.8),
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},
tutorialFabBlur: {
  borderRadius: normalize(999),
  overflow: "hidden",
},
tutorialFabGlass: {
  width: normalize(44),
  height: normalize(44),
  borderRadius: normalize(999),
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.25)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: normalize(6) },
  shadowOpacity: 0.35,
  shadowRadius: normalize(10),
  elevation: 8,
},
  gradientContainer: {
    flex: 1,
    paddingBottom: normalize(10),
  },
    scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING * 5, // rythme global homogène
  },
  heroSection: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    minHeight: normalize(400),
  },
  backgroundVideo: {
    position: "absolute",
    left: 0,
    width: SCREEN_WIDTH,
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: SPACING,
    width: "100%",
    paddingBottom: normalize(20),
  },
  heroBrandRow: {
    width: "100%",
    maxWidth: CONTENT_W,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(12),
    marginBottom: normalize(12),
  },
  logoKeynote: {
    width: normalize(75),
    height: normalize(75),
  },
  heroBrandPill: {
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(7),
    borderRadius: normalize(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroBrandPillText: {
    fontSize: normalize(13.6),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 1.2,
  },
 heroTitleKeynote: {
    width: "100%",
    maxWidth: CONTENT_W,
    fontSize: normalize(31),
    lineHeight: normalize(35),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalize(10),
    includeFontPadding: false,
  },
  heroSubtitleKeynote: {
    width: "100%",
    maxWidth: CONTENT_W,
    fontSize: normalize(15.5),
    lineHeight: normalize(21),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: normalize(14),
    color: "rgba(255,255,255,0.92)",
    includeFontPadding: false,
  },
  ctaButtonKeynote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: Math.min(CONTENT_W, normalize(360)),
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(16),
    borderRadius: normalize(16),
   shadowOffset: { width: 0, height: normalize(7) },
 shadowOpacity: 0.18,
 shadowRadius: normalize(14),
 elevation: 5,
  },
  heroCtaInner: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: normalize(10),
  width: "100%",
},
heroCtaIcon: {
  width: normalize(28),
  height: normalize(28),
  borderRadius: normalize(999),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.35)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(2,6,23,0.14)",
},
  ctaTextKeynote: {
    fontSize: normalize(14.8),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
    textAlign: "center",
    flex: 1,
    minWidth: 0,
    marginHorizontal: normalize(2),
  },
    section: {
    paddingTop: SPACING * 1.1,
    paddingBottom: SPACING * 1.1,
    paddingHorizontal: SPACING,
    // léger espace sous le bloc, mais pas un cratère
    marginBottom: SPACING * 1.1,
    overflow: "visible",
  },
  sectionTitle: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    lineHeight: normalize(28),
    includeFontPadding: false,
  },
    dailyBonusWrapper: {
    paddingHorizontal: SPACING,
    // bien séparé visuellement du New Year
    marginTop: SPACING * 0.3,
    marginBottom: SPACING * 1.6,
  },
  dailyBonusOuter: {
    borderRadius: normalize(20),
    padding: normalize(1.5),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.22,
    shadowRadius: normalize(8),
    elevation: 5,
  },
  dailyBonusBlur: {
    borderRadius: normalize(18),
    overflow: "hidden",
  },
  dailyBonusContentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(14),
  },
  dailyBonusTextCol: {
    flex: 1,
    paddingRight: normalize(8),
  },
  dailyBonusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(999),
    backgroundColor: "rgba(0,0,0,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(6),
    marginBottom: normalize(6),
  },
  dailyBonusTagText: {
    fontSize: normalize(10),
    fontFamily: "Comfortaa_700Bold",
    letterSpacing: 1,
    color: "#FFECB3",
  },
  dailyBonusTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFF8E1",
    marginBottom: normalize(4),
  },
  dailyBonusText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.9)",
  },
  dailyBonusIconCol: {
    marginLeft: normalize(10),
    alignItems: "center",
    justifyContent: "center",
    minWidth: normalize(72),
  },
  dailyBonusIconCircleOuter: {
    width: normalize(56),
    height: normalize(56),
    borderRadius: normalize(28),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(6),
    elevation: 4,
  },
  dailyBonusIconCircleInner: {
    width: normalize(48),
    height: normalize(48),
    borderRadius: normalize(24),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dailyBonusPillText: {
    marginTop: normalize(6),
    fontSize: normalize(10),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.85)",
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
  },
  challengeImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: SPACING,
    alignItems: "center",
    borderTopLeftRadius: normalize(18),
    borderTopRightRadius: normalize(18),
  },
  noChallengesContainer: {
    alignItems: "center",
    marginTop: SPACING,
  },
  noChallengesText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
  },
  noChallengesSubtext: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
    discoverWrapper: {
    width: "100%",
    alignItems: "center",
    // plus petit pour casser le "gros trou" que tu vois actuellement
    marginTop: SPACING * 0.7,
    marginBottom: SPACING * 1.6,
  },
  blurView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: normalize(20),
    padding: SPACING * 1.5,
    width: "85%",
    maxWidth: normalize(400),
    marginHorizontal: SPACING,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(6),
    elevation: 5,
  },
  modalTitle: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    color: "#333",
    marginBottom: SPACING,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: SPACING * 1.5,
  },
  buttonContainer: {
  width: "100%",
  gap: normalize(12),
},
actionButton: {
  width: "100%",
  paddingVertical: normalize(12),
  paddingHorizontal: normalize(16),
  borderRadius: normalize(16),
  alignItems: "center",
  justifyContent: "center",
},
  actionButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
  },
});

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  heroTitle: {
    color: currentTheme.colors.textPrimary,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.94)",
  },
  ctaButton: {
    backgroundColor: "transparent",
  },
  ctaText: {
    color: currentTheme.colors.textPrimary,
  },
  ctaIcon: {
    color: currentTheme.colors.textPrimary,
  },
  sectionTitle: {
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
  },
  noChallengesText: {
    color: currentTheme.colors.textPrimary,
  },
  noChallengesSubtext: {
    color: currentTheme.colors.textSecondary,
  },
});


const stylesDaily = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  subtitle: {
    marginTop: normalize(2),
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    textAlign: "center",
  },
  heroCard: {
    width: CONTENT_W,
    aspectRatio: 1.6,
    borderRadius: normalize(18),
    overflow: "hidden",
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(8),
    zIndex: 1,
    elevation: 3,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  titleRow: {
    position: "relative",
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING, // spacing propre avant la hero card
  },
  heroOverlay: {
   position: "absolute",
   left: 0,
   right: 0,
   bottom: 0,
   height: "55%",
 },
  heroTextZone: {
    position: "absolute",
    bottom: SPACING,
    left: SPACING,
    right: SPACING,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: normalize(19.5),
  lineHeight: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
     includeFontPadding: false,
    textShadowRadius: 3,
  },
  heroCatPill: {
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: normalize(999),
  backgroundColor: "rgba(255,255,255,0.14)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.22)",
},
heroCatPillText: {
  fontSize: normalize(11.8),
  fontFamily: "Comfortaa_700Bold",
  color: "rgba(255,255,255,0.92)",
  includeFontPadding: false,
},
  badge: {
    position: "absolute",
    top: SPACING * 0.8,
    left: SPACING * 0.8,
    backgroundColor: "rgba(255, 111, 0, 0.9)",
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: normalize(999),
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
  },
  grid: {
    width: CONTENT_W,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  miniCard: {
    width: (CONTENT_W - SPACING) / 2,
    aspectRatio: 1.6,
    borderRadius: normalize(16),
    overflow: "hidden",
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(6),
    zIndex: 1,
    elevation: 3,
  },
  miniTitle: {
    position: "absolute",
    left: SPACING * 0.8,
    right: SPACING * 0.8,
    bottom: IS_SMALL ? SPACING * 1.8 : SPACING * 1.6,
    color: "#fff",
    fontSize: normalize(13.4),
    lineHeight: normalize(17),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    includeFontPadding: false,
  },
  miniCat: {
    position: "absolute",
    left: SPACING * 0.8,
    right: SPACING * 0.8,
    bottom: IS_SMALL ? SPACING * 0.7 : SPACING * 0.6,
    color: "rgba(255,255,255,0.9)",
    fontSize: normalize(IS_SMALL ? 10.4 : 11.2),
    lineHeight: normalize(IS_SMALL ? 12 : 13),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
  miniImage: {
    width: "100%",
    height: "100%",
  },
  miniOverlay: {
   position: "absolute",
   left: 0,
   right: 0,
   bottom: 0,
   height: "60%",
 },
  footHint: {
    marginTop: 2,
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
  },
});
