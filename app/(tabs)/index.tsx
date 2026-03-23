import React, {
  useState,
  useEffect,
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
  useWindowDimensions,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams  } from "expo-router";
import { db, auth } from "@/constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import BannerSlot from "@/components/BannerSlot";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
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
   onSnapshot,
   limit,
    updateDoc, serverTimestamp,
 } from "firebase/firestore";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
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
import TodayHub, { type TodayHubPrimaryMode } from "@/components/TodayHub/TodayHub";
import { useTodayHubState } from "@/components/TodayHub/useTodayHubState";
import type { TodayHubWhyReturn } from "../../components/TodayHub/TodayHub";
import OnboardingQuestBanner from "@/components/OnboardingQuestBanner";
import { useOnboardingQuests } from "@/src/hooks/useOnboardingQuests";
import type { QuestId } from "@/src/services/onboardingQuestService";

const getScreen = () => Dimensions.get("window");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = getScreen();
const BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const FALLBACK_CHALLENGE_IMG = require("../../assets/images/backgroundbase.jpg");

const ANDROID_HAIRLINE =
  Platform.OS === "android"
    ? Math.max(1 / PixelRatio.get(), 0.75)
    : StyleSheet.hairlineWidth;


const normalize = (size: number) => {
  const w = getScreen().width;
  const baseWidth = 375;
  const scale = Math.min(Math.max(w / baseWidth, 0.78), 1.9);
  const normalizedSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

const SPACING = normalize(15);
const CONTENT_W = Math.min(SCREEN_WIDTH - SPACING * 2, normalize(420));
const IS_SMALL = SCREEN_WIDTH < 360;
const DAILY_CARD_W = Math.round(CONTENT_W * 0.78);
const DAILY_GAP = normalize(10);
const DAILY_SNAP = DAILY_CARD_W + DAILY_GAP;

// --- Premium system tokens
const R = {
  outer: 24,
  card: 22,
  inner: 18,
  btn: 16,
  pill: 999,
} as const;

const STROKE = "rgba(255,255,255,0.10)";
const STROKE_SOFT = "rgba(255,255,255,0.07)";
const GLASS_BG = "rgba(255,255,255,0.06)";
const GLASS_BG_SOFT = "rgba(255,255,255,0.045)";
const DARK_BG = "rgba(15,23,42,0.35)";

const shadowSoft = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 0 },
  default: {},
});

// ✨ NEW: stronger shadow for hero elements
const shadowHero = Platform.select({
  ios: {
    shadowColor: "#F97316",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 8 },
  default: {},
});

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  imageThumbUrl?: string;
  day?: number;
  approved?: boolean;
}

type CurrentChallengeItem = {
  challengeId?: string;
  id?: string;
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

type PendingInvite = {
  id: string;
  challengeId: string;
  selectedDays?: number;
  inviteeUsername?: string;
  createdAt?: any;
};

const DAILY_PICKS_KEY = "daily_picks_v1";
const CHALLENGES_CACHE_KEY = "challenges_cache_v2";

const todayKeyLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const todayKeyUTC = () => new Date().toISOString().slice(0, 10);
const toMs = (v: any): number | null => {
  if (v && typeof v === "object" && typeof v.toDate === "function") {
    const d = v.toDate();
    const ms = d?.getTime?.();
    return Number.isFinite(ms) ? ms : null;
  }
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};
const getThumbUrl200 = (url?: string) => {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return "";

  const addSuffix = (s: string) => {
    const out = s.replace(/(\.[a-zA-Z0-9]+)$/i, "_200x200$1");
    return out === s ? "" : out;
  };

  try {
    const isFirebase =
      u.includes("firebasestorage.googleapis.com") && u.includes("/o/");

    if (!isFirebase) {
      const [base, query] = u.split("?");
      const withThumb = addSuffix(base);
      if (!withThumb) return "";
      return query ? `${withThumb}?${query}` : withThumb;
    }

    const [pathPart, queryPart] = u.split("?");
    const idx = pathPart.indexOf("/o/");
    if (idx === -1) return "";

    const prefix = pathPart.slice(0, idx + 3);
    const encoded = pathPart.slice(idx + 3);
    if (!encoded) return "";

    const decoded = decodeURIComponent(encoded);
    const thumbDecoded = addSuffix(decoded);
    if (!thumbDecoded) return "";

    const reEncoded = encodeURIComponent(thumbDecoded);
    return `${prefix}${reEncoded}${queryPart ? `?${queryPart}` : ""}`;
  } catch {
    return "";
  }
};


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

function useUtcDayKeyStable() {
  const [dayKey, setDayKey] = useState(() => todayKeyUTC());

  useEffect(() => {
    let timer: any;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextUtcMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 2)
      );
      const ms = Math.max(2_000, nextUtcMidnight.getTime() - now.getTime());

      timer = setTimeout(() => {
        setDayKey(todayKeyUTC());
        scheduleNextTick();
      }, ms);
    };

    scheduleNextTick();
    return () => clearTimeout(timer);
  }, []);

  return dayKey;
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

  if (!picks.length) {
    const seed = hashStringToInt(`${today}#${userId ?? "global"}`);
    picks = seededShuffle(base, seed).slice(0, 5);
  }

  return picks;
}

const WELCOME_REWARDS_UI: { type: WelcomeRewardKind; amount: number }[] = [
  { type: "trophies", amount: 8 },
  { type: "trophies", amount: 12 },
  { type: "streakPass", amount: 1 },
  { type: "trophies", amount: 15 },
  { type: "streakPass", amount: 1 },
  { type: "trophies", amount: 20 },
  { type: "premium", amount: 7 },
];

const WELCOME_TOTAL_DAYS = WELCOME_REWARDS_UI.length;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const DAY_UTC = useUtcDayKeyStable();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: W, height: H } = useWindowDimensions();
  const IS_TINY = W < 350;
  const CONTENT_MAX_W = useMemo(() => {
    const side = normalize(15) * 2;
    return Math.min(W - side, normalize(440));
  }, [W]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [discoverExpanded, setDiscoverExpanded] = useState(false);
  const [userData, setUserData] = useState<any | null>(null);
  const [duoInvitePending, setDuoInvitePending] = useState(false);
  const [duoInvitePendingFor, setDuoInvitePendingFor] = useState<string | null>(null);
  const [welcomeState, setWelcomeState] = useState<WelcomeBonusState | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [pendingWelcomeAfterTutorial, setPendingWelcomeAfterTutorial] =
  useState(false);
  const [welcomeGuardKey, setWelcomeGuardKey] = useState<string | null>(null);
  const [dailyBonusVisible, setDailyBonusVisible] = useState(false);
  const [hasClaimedDailyBonus, setHasClaimedDailyBonus] = useState(false);
  const [dailyBonusLoading, setDailyBonusLoading] = useState(false);
  const [dailyReward, setDailyReward] = useState<DailyRewardResult | null>(null);
  const [rerollAdReady, setRerollAdReady] = useState(false);
  const [rerollAdLoading, setRerollAdLoading] = useState(false);
  const [rerollLoading, setRerollLoading] = useState(false);
  const { theme } = useTheme();
  const { modalVisible, gate, closeGate, hydrated, isGuest  } = useGateForGuest();
  const { setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [adHeight, setAdHeight] = useState(0);
  const [bannerKey, setBannerKey] = useState(0);
  const { showBanners } = useAdsVisibility();
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [dailyFive, setDailyFive] = useState<Challenge[]>([]);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const [imgLoaded, setImgLoaded] = useState<Record<string, true>>({});
  const [activeChallengeMetaOverride, setActiveChallengeMetaOverride] = useState<Challenge | null>(null);
  const [showPremiumEndModal, setShowPremiumEndModal] = useState(false);
  const { show: showToast } = useToast();
  const [duoNudgeDismissed, setDuoNudgeDismissed] = useState(false);
  const [isUserDataReady, setIsUserDataReady] = useState(false);
  
 
const IMG_MAX_RETRIES = 2;
const IMG_BROKEN_TTL_MS = 10 * 60_000;
const IMG_RETRY_BASE_MS = 450;  

const [imgReloadKey, setImgReloadKey] = useState<Record<string, number>>({});
const imgRetryRef = useRef<Record<string, number>>({});
const imgRetryTimerRef = useRef<Record<string, any>>({});
const welcomeHandledRef = useRef<string | null>(null);
const discoverYRef = useRef(0);

useEffect(() => {
  return () => {
    Object.values(imgRetryTimerRef.current).forEach((t) => clearTimeout(t));
    imgRetryTimerRef.current = {};
  };
}, []);

const scheduleImageRetry = useCallback((id: string) => {
  const tries = (imgRetryRef.current[id] ?? 0) + 1;
  imgRetryRef.current[id] = tries;

  if (tries <= IMG_MAX_RETRIES) {
    const delay = IMG_RETRY_BASE_MS * tries;

    clearTimeout(imgRetryTimerRef.current[id]);
    imgRetryTimerRef.current[id] = setTimeout(() => {
  setImgLoaded((prev) => {
    if (!prev[id]) return prev;
    const copy = { ...prev };
    delete copy[id];
    return copy;
  });

  setImgReloadKey((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
}, delay);

    return true;
  }

  return false;
}, []);

  const SPOTLIGHT_SHOWN_KEY = useMemo(
    () => `home.onboardingSpotlightShown.v1.${user?.uid ?? "guest"}`,
    [user?.uid]
  );
  const ONBOARDING_JUST_FINISHED_KEY = "onboarding.justFinished.v1";
  const POST_WELCOME_ABSORB_KEY = useMemo(
  () => `home.postWelcomeAbsorb.v1.${user?.uid ?? "guest"}`,
  [user?.uid]
);

  const premiumEntitlement = useMemo(() => {
    const premium = (userData as any)?.premium;
    if (!premium || typeof premium !== "object") {
      return {
        isPaying: false,
        trialUntilMs: null as number | null,
        isTrialActive: false,
        isEntitled: false,
      };
    }

    const isPaying =
      premium.isPremium === true ||
      premium.premium === true ||
      premium.isSubscribed === true ||
      premium.isLifetime === true;

    const trialUntilMs = toMs(premium.tempPremiumUntil);
    const isTrialActive =
      !!trialUntilMs && Date.now() < trialUntilMs;

    return {
      isPaying,
      trialUntilMs,
      isTrialActive,
      isEntitled: isPaying || isTrialActive,
    };
  }, [userData]);

const DUO_PENDING_FIRST_KEY = useMemo(
  () => `home.duoPendingFirst.v1.${user?.uid ?? "guest"}`,
  [user?.uid]
);
const ABSORB_MARK_KEY = useMemo(
  () => `home.absorbMark.v1.${DAY_UTC}.${user?.uid ?? "guest"}`,
  [DAY_UTC, user?.uid]
);
 const FIRST_SOLO_ABSORB_KEY = useMemo(
  () => `home.firstSoloAbsorb.v1.${user?.uid ?? "guest"}`,
  [user?.uid]
);

  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const [postWelcomeAbsorbArmed, setPostWelcomeAbsorbArmed] = useState(false);

  const [spotRect, setSpotRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
   const [spotlightArmed, setSpotlightArmed] = useState(false);
  const spotlightOpacity = useSharedValue(0);
  const spotlightCardScale = useSharedValue(0.985);
  const duoRing = useSharedValue(0);
const duoGlow = useSharedValue(0);
  const spotlightRing = useSharedValue(0);
const markCtaRef = useRef<any>(null);
const changingLangRef = useRef(false);

  const spotlightOverlayStyle = useAnimatedStyle(() => ({
    opacity: spotlightOpacity.value,
  }));
  const spotlightCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: spotlightCardScale.value }],
  }));
  const spotlightRingStyle = useAnimatedStyle(() => {
    const o = 0.18 + spotlightRing.value * 0.18;
    const s = 1 + spotlightRing.value * 0.03;
    return { opacity: o, transform: [{ scale: s }] };
  });

  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();

  const [tutorialGate, setTutorialGate] = useState(false);
  const isTutorialBlocking = isTutorialActive && tutorialGate;
  const todayHubYRef = useRef(0);

  const spotlightOpenTokenRef = useRef(0);

  const isSpotlightBlocked = useCallback(() => {
    return (
      isTutorialBlocking ||
      welcomeVisible ||
      dailyBonusVisible ||
      showPremiumEndModal ||
      modalVisible
    );
  }, [isTutorialBlocking, welcomeVisible, dailyBonusVisible, showPremiumEndModal, modalVisible]);

  const forceHideSpotlight = useCallback(() => {
    setSpotlightArmed(false);
    setSpotlightVisible(false);
    setSpotRect(null);
    spotlightOpacity.value = 0;
    spotlightRing.value = 0;
    spotlightCardScale.value = 0.985;
  }, [spotlightOpacity, spotlightRing, spotlightCardScale]);

    useEffect(() => {
    if (!spotlightVisible) return;
    if (!isSpotlightBlocked()) return;
    forceHideSpotlight();
  }, [spotlightVisible, isSpotlightBlocked, forceHideSpotlight]);

 const heroVideoRef = useRef<any>(null);
  const scrollRef = useRef<any>(null);
  const heroPlayGuardRef = useRef(false);
  const SPOT_PAD_X = normalize(12);
const SPOT_PAD_Y = normalize(10);
const SPOT_RADIUS = normalize(24);


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
    setIsUserDataReady(true);

const userLanguage = (data as any)?.language;
    if (
      userLanguage &&
      userLanguage !== i18n.language &&
      !changingLangRef.current
    ) {
      changingLangRef.current = true;
      i18n
        .changeLanguage(userLanguage)
        .catch(() => {})
        .finally(() => {
          changingLangRef.current = false;
        });
    }

    if ((data as any)?.locationEnabled) {
      fetchAndSaveUserLocation().catch(() => {});
    }
 } catch {
    setIsUserDataReady(true);
  }
}, [user?.uid, i18n]);

  const openTutorial = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setTutorialGate(true);
    setTutorialStep(0);
    startTutorial?.();
  }, [startTutorial, setTutorialStep]);

useEffect(() => {
    if (!isTutorialActive) return;
    if (tutorialGate) return;

    setTutorialStep(0);
    skipTutorial?.();
  }, [isTutorialActive, tutorialGate, setTutorialStep, skipTutorial]);

 const markImageBroken = useCallback((c?: Challenge) => {
  const id = c?.id;
  if (!id) return;

  const didScheduleRetry = scheduleImageRetry(id);
  if (didScheduleRetry) return;

  setBrokenImages((prev) => ({ ...prev, [id]: true }));

  setTimeout(() => {
    setBrokenImages((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    setImgLoaded((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    
    delete imgRetryRef.current[id];
  }, IMG_BROKEN_TTL_MS);
}, [scheduleImageRetry]);

const markImageOk = useCallback((c?: Challenge) => {
  const id = c?.id;
  if (!id) return;

  setBrokenImages((prev) => {
    if (!prev[id]) return prev;
    const copy = { ...prev };
    delete copy[id];
    return copy;
  });

  delete imgRetryRef.current[id];
  clearTimeout(imgRetryTimerRef.current[id]);
  delete imgRetryTimerRef.current[id];
}, []);

const markImageLoaded = useCallback((c?: Challenge) => {
  const id = c?.id;
  if (!id) return;

  setImgLoaded((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  markImageOk(c);
}, [markImageOk]);

const getChallengeImageUri = useCallback(
  (c?: any, variant: "thumb" | "full" = "full") => {
    const rawFull = typeof c?.imageUrl === "string" ? c.imageUrl.trim() : "";
    const rawThumb = typeof c?.imageThumbUrl === "string" ? c.imageThumbUrl.trim() : "";
    const id = c?.id;

if (variant === "full" && id && brokenImages[id]) return "";

    if (variant === "thumb") {
      if (rawThumb.startsWith("http")) return rawThumb;

      const derived = getThumbUrl200(rawFull);
      if (derived.startsWith("http")) return derived;

      return rawFull.startsWith("http") ? rawFull : "";
    }

    return rawFull.startsWith("http") ? rawFull : "";
  },
  [brokenImages, getThumbUrl200]
);


const getChallengeImageSource = useCallback(
  (c?: Challenge, variant: "thumb" | "full" = "full") => {
    const uri = getChallengeImageUri(c, variant);
    return uri ? { uri } : FALLBACK_CHALLENGE_IMG;
  },
  [getChallengeImageUri]
);

const exploreScale = useSharedValue(1);
const markScale = useSharedValue(1);

const markPulse = useSharedValue(0);
const markShine = useSharedValue(-1);
const soloNudgePulse = useSharedValue(0);
const soloNudgeIn = useSharedValue(0);
const duoRingPulse = useSharedValue(0);

// ✨ NEW: ambient glow for hero CTA
const heroCtaGlow = useSharedValue(0);
const EXPLORE_BTN_WIDTH = normalize(220);

const exploreAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: exploreScale.value }],
  width: EXPLORE_BTN_WIDTH,
}));
const markAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: markScale.value }],
}));

// ✨ NEW: hero CTA ambient glow animation style
const heroCtaGlowStyle = useAnimatedStyle(() => ({
  opacity: 0.25 + heroCtaGlow.value * 0.20,
  transform: [{ scale: 1 + heroCtaGlow.value * 0.06 }],
}));

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  const hasActiveChallenges = useMemo(() => {
    const list = (userData as any)?.CurrentChallenges;
    if (!Array.isArray(list)) return false;
    return list.some((c) => !c?.completed && !c?.archived);
  }, [userData]);

  const currentChallenges = useMemo<CurrentChallengeItem[]>(() => {
    const list = (userData as any)?.CurrentChallenges;
    return Array.isArray(list) ? (list as CurrentChallengeItem[]) : [];
  }, [userData]);

  const activeChallenges = useMemo<CurrentChallengeItem[]>(() => {
    return currentChallenges.filter((c) => !c?.completed && !c?.archived);
  }, [currentChallenges]);
  

  const activeChallenge = useMemo<CurrentChallengeItem | null>(() => {
    if (!currentChallenges.length) return null;
    return (
      currentChallenges.find((c) => !c?.completed && !c?.archived) ?? null
    );
  }, [currentChallenges]);

  const activeChallengeId = useMemo(() => {
    const id = (activeChallenge?.challengeId ?? activeChallenge?.id) as any;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  }, [activeChallenge]);

  useEffect(() => {
    if (!hasActiveChallenges || !activeChallengeId || activeChallenge?.duo === true) {
      setDuoNudgeDismissed(false);
      return;
    }
    setDuoNudgeDismissed(false);
  }, [hasActiveChallenges, activeChallengeId, activeChallenge?.duo]);

  const activeChallengeMeta = useMemo<Challenge | null>(() => {
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

    if (!activeChallengeId) return null;
    const inAll = allChallenges.find((c) => c.id === activeChallengeId);
    if (inAll) return inAll;
    const inDaily = dailyFive.find((c) => c.id === activeChallengeId);
    return inDaily ?? null;
  }, [activeChallenge, activeChallengeId, allChallenges, dailyFive, t]);

const effectiveActiveMeta = activeChallengeMetaOverride ?? activeChallengeMeta;
const todayHubActiveMeta = useMemo(() => {
  return effectiveActiveMeta ?? null;
}, [effectiveActiveMeta]);


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

  const handleAdHeight = useCallback((h: number) => {
    if (__DEV__) console.log("[ADS][HomeScreen] Banner height:", h);
    setAdHeight(h);
  }, []);

  const WELCOME_SHOWN_KEY = useMemo(
  () => `home.welcomeShown.v1.${DAY_UTC}.${user?.uid ?? "guest"}`,
  [DAY_UTC, user?.uid]
);

const WELCOME_HANDLED_KEY = useMemo(
  () => `home.welcomeHandled.v1.${DAY_UTC}.${user?.uid ?? "guest"}`,
  [DAY_UTC, user?.uid]
);

const markWelcomeHandled = useCallback(async () => {
  welcomeHandledRef.current = DAY_UTC;
  setWelcomeGuardKey(DAY_UTC);
  setPendingWelcomeAfterTutorial(false);
  setWelcomeVisible(false);

  try {
    await AsyncStorage.setItem(WELCOME_HANDLED_KEY, "1");
  } catch {}
}, [DAY_UTC, WELCOME_HANDLED_KEY]);


    const HERO_BASE_HEIGHT = useMemo(() => {
    const base = normalize(380);
    const capMin = Math.round(H * 0.48);
    const capMax = Math.round(H * 0.58);
    return Math.max(Math.min(base, capMax), capMin);
  }, [H]);
  
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;

  const bottomContentPadding =
    (showBanners && !isTutorialBlocking ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    SPACING * 2;

   const shouldShowBanner = showBanners && !isTutorialBlocking && !premiumEntitlement.isEntitled;
  useEffect(() => {
    if (!shouldShowBanner) return;
    setBannerKey((k) => k + 1);
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
    userData?.dailyBonus?.lastClaimDate === DAY_UTC ||
    hasClaimedDailyBonus;

   const hasRerolledTodayUTC =
    userData?.dailyBonus?.lastRerollDate === DAY_UTC;

  const canRerollDailyBonus =
    !!userData && claimedTodayUTC && !hasRerolledTodayUTC;

    const isAnyBlockingModalOpen =
  isTutorialBlocking ||
  welcomeVisible ||
  dailyBonusVisible ||
  showPremiumEndModal ||
  modalVisible ||
  spotlightVisible;

  

    const dismissSpotlight = useCallback(async () => {
    setSpotlightArmed(false);
    setSpotlightVisible(false);
    setSpotRect(null);

    spotlightOpacity.value = withTiming(0, { duration: 160 });
    spotlightRing.value = 0;

    try {
      await AsyncStorage.setItem(SPOTLIGHT_SHOWN_KEY, "1");
      await AsyncStorage.removeItem(ONBOARDING_JUST_FINISHED_KEY);
    } catch {}
  }, [SPOTLIGHT_SHOWN_KEY, spotlightOpacity, spotlightRing]);

  const openSpotlight = useCallback(async () => {
    const measure = () =>
      new Promise<{ x: number; y: number; w: number; h: number } | null>(
        (resolve) => {
          const node = markCtaRef.current;
          if (!node?.measureInWindow) return resolve(null);
          node.measureInWindow((x: number, y: number, w: number, h: number) => {
            if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0)
              return resolve(null);
            resolve({ x, y, w, h });
          });
        }
      );
await new Promise((r) => requestAnimationFrame(() => r(null)));
    const rect = await measure();
    if (!rect) return;
    setSpotRect(rect);
    setSpotlightVisible(true);

    spotlightOpacity.value = 0;
    spotlightCardScale.value = 0.985;
    spotlightRing.value = 0;

    spotlightOpacity.value = withTiming(1, { duration: 220 });
    spotlightCardScale.value = withSpring(1, { damping: 18, stiffness: 220 });
    spotlightRing.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [spotlightOpacity, spotlightCardScale, spotlightRing]);

    const hasOutgoingPendingInvite = useMemo(() => {
  return (
    !!user?.uid &&
    duoInvitePending === true &&
    !!pendingInvite?.challengeId &&
    pendingInvite.challengeId === duoInvitePendingFor
  );
}, [user?.uid, duoInvitePending, pendingInvite?.challengeId, duoInvitePendingFor]);


  const todayHubView = useTodayHubState({
  dayUtc: DAY_UTC,
  currentChallenges,
  hasOutgoingPendingInvite,
  pendingInvite,
  allChallenges,
  dailyFive,
  t,
   langKey: i18n.language,
});
const primaryActiveId = useMemo(() => {
  return todayHubView.focusChallengeId ?? null;
}, [todayHubView.focusChallengeId]);

 const todayHubPrimaryMode = todayHubView.primaryMode as TodayHubPrimaryMode;

  const shouldPulsePrimary = useMemo(() => {
    if (todayHubView.primaryMode === "mark") return todayHubView.anyUnmarkedToday;
    if (todayHubView.primaryMode === "duoPending") return true;
    return false;
  }, [todayHubView.primaryMode, todayHubView.anyUnmarkedToday]);

  const tryOpenSpotlightWithRetry = useCallback(
    async (token: number) => {
      for (let i = 0; i < 6; i++) {
        if (token !== spotlightOpenTokenRef.current) return;
        if (isSpotlightBlocked()) return;

        await new Promise((r) => setTimeout(r, i === 0 ? 160 : 220));

        if (token !== spotlightOpenTokenRef.current) return;
        if (isSpotlightBlocked()) return;

        const node = markCtaRef.current;
        if (!node?.measureInWindow) continue;

        const rect = await new Promise<{ x: number; y: number; w: number; h: number } | null>(
          (resolve) => {
            node.measureInWindow((x: number, y: number, w: number, h: number) => {
              if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0) return resolve(null);
              resolve({ x, y, w, h });
            });
          }
        );

        if (!rect) continue;

        if (token !== spotlightOpenTokenRef.current) return;
        if (isSpotlightBlocked()) return;

        setSpotRect(rect);
        setSpotlightVisible(true);

        spotlightOpacity.value = 0;
        spotlightCardScale.value = 0.985;
        spotlightRing.value = 0;

        spotlightOpacity.value = withTiming(1, { duration: 220 });
        spotlightCardScale.value = withSpring(1, { damping: 18, stiffness: 220 });
        spotlightRing.value = withRepeat(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        );
        return;
      }

      setSpotlightArmed(false);
    },
    [
      isSpotlightBlocked,
      spotlightOpacity,
      spotlightCardScale,
      spotlightRing,
    ]
  );

const spotlightAllowed = useMemo(() => {
  return hasActiveChallenges && todayHubView.anyUnmarkedToday;
}, [hasActiveChallenges, todayHubView.anyUnmarkedToday]);



const markHaloStyle = useAnimatedStyle(() => {
  const t = markPulse.value;
  return {
    opacity: 0.12 + t * 0.18,
    transform: [{ scale: 1 + t * 0.02 }],
  };
});

const markGlowStyle = useAnimatedStyle(() => {
  const t = markPulse.value;
  return {
    opacity: 0.08 + t * 0.14,
  };
});

const markShineStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: markShine.value * 260 }],
  opacity: 0.16,
}));

const soloNudgeStyle = useAnimatedStyle(() => {
  const p = soloNudgePulse.value;
  const a = soloNudgeIn.value;

  return {
    opacity: 0.6 * a + 0.4 * a * (0.65 + p * 0.35),
    transform: [
      { translateY: (1 - a) * 8 },
      { scale: 1 + p * 0.015 },
    ] as any,
  };
});



const absorbToTodayHub = useCallback(async () => {
    if (!scrollRef.current) return;
    if (isAnyBlockingModalOpen && !postWelcomeAbsorbArmed) return;

    try {
      const already = await AsyncStorage.getItem(ABSORB_MARK_KEY);
      if (already === "1") return;
    } catch {}

    InteractionManager.runAfterInteractions(() => {
      try {
        scrollRef.current?.scrollTo({
          y: Math.max(0, todayHubYRef.current - normalize(10)),
          animated: true,
        });
      } catch {}

      markScale.value = withSpring(0.975, { damping: 18, stiffness: 240 });
      setTimeout(() => {
        markScale.value = withSpring(1, { damping: 16, stiffness: 200 });
      }, 220);

      setTimeout(() => {
        if (todayHubPrimaryMode !== "mark") return;
        if (!spotlightAllowed) return;
        if (isSpotlightBlocked()) return;
        const token = ++spotlightOpenTokenRef.current;
        tryOpenSpotlightWithRetry(token);
      }, 260);
    });

    try {
      await AsyncStorage.setItem(ABSORB_MARK_KEY, "1");
    } catch {}
  }, [
    ABSORB_MARK_KEY,
    isAnyBlockingModalOpen,
    postWelcomeAbsorbArmed,
    todayHubPrimaryMode,
    markScale,
    isSpotlightBlocked,
    spotlightAllowed,
    tryOpenSpotlightWithRetry,
  ]);

 useEffect(() => {
  if (!shouldPulsePrimary || isTutorialBlocking || isAnyBlockingModalOpen) {
    markPulse.value = 0;
    markShine.value = -1;
    return;
  }

  markPulse.value = withRepeat(
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );

  if (todayHubPrimaryMode === "mark") {
    markShine.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  } else {
    markShine.value = -1;
  }
}, [
  shouldPulsePrimary,
  todayHubPrimaryMode,
  isTutorialBlocking,
  isAnyBlockingModalOpen,
  markPulse,
  markShine,
]);

useEffect(() => {
  const isMark =
    todayHubPrimaryMode === "mark" &&
    !isTutorialBlocking &&
    !isAnyBlockingModalOpen;

  if (!isMark) {
    soloNudgePulse.value = 0;
    soloNudgeIn.value = withTiming(0, { duration: 140 });
    return;
  }

  soloNudgeIn.value = withTiming(1, { duration: 220 });

  soloNudgePulse.value = withRepeat(
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [
  todayHubPrimaryMode,
  isTutorialBlocking,
  isAnyBlockingModalOpen,
  soloNudgePulse,
  soloNudgeIn,
]);

  useEffect(() => {
    if (todayHubPrimaryMode !== "duoPending") return;
    (async () => {
      try {
        await AsyncStorage.removeItem(ONBOARDING_JUST_FINISHED_KEY);
      } catch {}
      setSpotlightArmed(false);
      setSpotlightVisible(false);
      spotlightOpacity.value = withTiming(0, { duration: 120 });
    })();
  }, [todayHubPrimaryMode, spotlightOpacity]);

// ✨ NEW: hero CTA glow pulse on mount
useEffect(() => {
  heroCtaGlow.value = withRepeat(
    withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [heroCtaGlow]);

useEffect(() => {
  let cancelled = false;

  const arm = async () => {
    const fromParam =
      String((params as any)?.fromOnboarding ?? "") === "1" ||
      String((params as any)?.onboarding ?? "") === "1";

    let fromStorage = false;
    try {
      const v = await AsyncStorage.getItem(ONBOARDING_JUST_FINISHED_KEY);
      fromStorage = v === "1";
    } catch {}

    if (!fromParam && !fromStorage) return;

    try {
      const shown = await AsyncStorage.getItem(SPOTLIGHT_SHOWN_KEY);
      if (shown === "1") return;
    } catch {}

    if (!cancelled) setSpotlightArmed(true);
  };

  arm();
  return () => {
    cancelled = true;
  };
}, [params, SPOTLIGHT_SHOWN_KEY]);


  useEffect(() => {
    if (!spotlightArmed) return;
    if (!spotlightAllowed) return;
    if (isSpotlightBlocked()) return;
    if (spotlightVisible || spotRect) return;

    const token = ++spotlightOpenTokenRef.current;

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (token !== spotlightOpenTokenRef.current) return;
        if (isSpotlightBlocked()) return;

        tryOpenSpotlightWithRetry(token);
      }, 120);
    });

    return () => {
      spotlightOpenTokenRef.current++;
      task?.cancel?.();
    };
  }, [
    spotlightArmed,
    spotlightAllowed,
    isSpotlightBlocked,
    spotlightVisible,
    spotRect,
    tryOpenSpotlightWithRetry,
  ]);

useEffect(() => {
  let cancelled = false;

  const run = async () => {
    if (!user?.uid) return;
    if (!userData) return;

    if (
      isTutorialBlocking ||
      welcomeVisible ||
      dailyBonusVisible ||
      showPremiumEndModal ||
      modalVisible
    ) {
      return;
    }

    let shouldAbsorb = false;
    try {
      const armed =
        postWelcomeAbsorbArmed ||
        (await AsyncStorage.getItem(POST_WELCOME_ABSORB_KEY)) === "1";
      if (armed) shouldAbsorb = true;
    } catch {}

    if (!shouldAbsorb) {
      try {
        const seen = await AsyncStorage.getItem(FIRST_SOLO_ABSORB_KEY);
        if (seen !== "1") shouldAbsorb = true;
      } catch {}
    }

    if (!shouldAbsorb) return;

    await new Promise((r) => setTimeout(r, 160));
    if (cancelled) return;

    await absorbToTodayHub();

    try {
      await AsyncStorage.removeItem(POST_WELCOME_ABSORB_KEY);
      await AsyncStorage.removeItem(ONBOARDING_JUST_FINISHED_KEY);
      await AsyncStorage.setItem(FIRST_SOLO_ABSORB_KEY, "1");
    } catch {}

    if (!cancelled) setPostWelcomeAbsorbArmed(false);
  };

  run();
  return () => {
    cancelled = true;
  };
}, [
  user?.uid,
  userData,
  postWelcomeAbsorbArmed,
  POST_WELCOME_ABSORB_KEY,
 FIRST_SOLO_ABSORB_KEY,
 isTutorialBlocking,
 welcomeVisible,
  dailyBonusVisible,
  showPremiumEndModal,
  modalVisible,
  absorbToTodayHub,
]);

      const effectiveWelcomeReward =
    welcomeState &&
    !welcomeState.completed &&
    welcomeState.currentDay >= 0 &&
    welcomeState.currentDay < WELCOME_TOTAL_DAYS
      ? WELCOME_REWARDS_UI[welcomeState.currentDay]
      : null;

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
  let cancelled = false;

  const load = async () => {
    try {
      const v = await AsyncStorage.getItem(WELCOME_HANDLED_KEY);
      if (cancelled) return;

      if (v === "1") {
        welcomeHandledRef.current = DAY_UTC;
        setWelcomeGuardKey(DAY_UTC);
        setWelcomeVisible(false);
        setPendingWelcomeAfterTutorial(false);
      }
    } catch {}
  };

  load();
  return () => {
    cancelled = true;
  };
}, [WELCOME_HANDLED_KEY, DAY_UTC]);

useEffect(() => {
  setIsUserDataReady(false);
  if (!user?.uid) {
    setUserData(null);
    setIsUserDataReady(true);
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
  let cancelled = false;

  const run = async () => {
    if (!userData) {
      setWelcomeState(null);
      setWelcomeVisible(false);
      return;
    }

    try {
      const state = computeWelcomeBonusState(userData);
      if (cancelled) return;

      setWelcomeState(state);

      if (welcomeHandledRef.current === DAY_UTC) {
        setWelcomeVisible(false);
        return;
      }

      try {
        const handled = await AsyncStorage.getItem(WELCOME_HANDLED_KEY);
        if (cancelled) return;

        if (handled === "1") {
          welcomeHandledRef.current = DAY_UTC;
          setWelcomeGuardKey(DAY_UTC);
          setPendingWelcomeAfterTutorial(false);
          setWelcomeVisible(false);
          return;
        }
      } catch {
        // ignore storage errors
      }

      if (!state.canClaimToday || state.completed) {
        setWelcomeVisible(false);
        return;
      }

      if (welcomeGuardKey === DAY_UTC) return;

      if (isTutorialActive) {
        setPendingWelcomeAfterTutorial(true);
        setWelcomeGuardKey(DAY_UTC);
        setWelcomeVisible(false);
        return;
      }

      setWelcomeVisible(true);
      setWelcomeGuardKey(DAY_UTC);
    } catch (e) {
      console.warn("[HomeScreen] computeWelcomeBonusState error:", e);
    }
  };

  run();
  return () => {
    cancelled = true;
  };
}, [
  userData,
  DAY_UTC,
  WELCOME_HANDLED_KEY,
  welcomeGuardKey,
  isTutorialActive,
]);

useEffect(() => {
  if (isTutorialActive) return;
  if (!pendingWelcomeAfterTutorial) return;
  if (!welcomeState || !welcomeState.canClaimToday || welcomeState.completed) return;

  if (welcomeHandledRef.current === DAY_UTC) {
    setPendingWelcomeAfterTutorial(false);
    return;
  }

  
  if (welcomeGuardKey === DAY_UTC) {
    setPendingWelcomeAfterTutorial(false);
    return;
  }

  setWelcomeVisible(true);
  setWelcomeGuardKey(DAY_UTC);
  setPendingWelcomeAfterTutorial(false);
}, [isTutorialActive, pendingWelcomeAfterTutorial, welcomeState, DAY_UTC, welcomeGuardKey]);


useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeChallengeId) {
        setActiveChallengeMetaOverride(null);
        return;
      }

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
  const isPending = todayHubPrimaryMode === "duoPending";

  if (!isPending || isTutorialBlocking || isAnyBlockingModalOpen) {
    duoRing.value = 0;
    duoGlow.value = 0;
    return;
  }

  duoRing.value = withRepeat(
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );

  duoGlow.value = withRepeat(
    withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [todayHubPrimaryMode, isTutorialBlocking, isAnyBlockingModalOpen, duoRing, duoGlow]);


const premiumEndExpiresMsRef = useRef<number | null>(null);

const persistPremiumEndDismiss = useCallback(async () => {
  if (!user?.uid) return;

  const expiresMs = premiumEndExpiresMsRef.current;
  if (!expiresMs) return;

  try {
    await updateDoc(doc(db, "users", user.uid), {
      "premium.endModalDismissedUntil": expiresMs,
      "premium.endModalDismissedAt": serverTimestamp(),
    });
  } catch {
    // silence
  }

  try {
    await AsyncStorage.setItem(
      `premiumEndModalShown_v3_${user.uid}`,
      String(expiresMs)
    );
  } catch {}
}, [user?.uid]);

useEffect(() => {
  if (!user || !userData) return;

  const premium = (userData as any).premium;
  if (!premium || typeof premium !== "object") return;

  const rawUntil = premium.tempPremiumUntil;
  if (!rawUntil) return;

  const expiresMs = toMs(rawUntil);
  if (!expiresMs) return;

  const now = Date.now();
  if (now <= expiresMs) return;

  if (premiumEntitlement.isPaying) return;

  const dismissedUntil = (premium as any)?.endModalDismissedUntil;
  const dismissedUntilMs = toMs(dismissedUntil);
  if (dismissedUntilMs && dismissedUntilMs === expiresMs) return;

  const key = `premiumEndModalShown_v3_${user.uid}`;

  const checkAndShow = async () => {
    try {
      const last = await AsyncStorage.getItem(key);
      if (last === String(expiresMs)) return;
    } catch {}

    premiumEndExpiresMsRef.current = expiresMs;
    setShowPremiumEndModal(true);

    try {
      await AsyncStorage.setItem(key, String(expiresMs));
    } catch {}
  };

  checkAndShow();
}, [user, userData, premiumEntitlement.isPaying]);


  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

useFocusEffect(
  useCallback(() => {
    refreshUserData();
  }, [refreshUserData])
);


  const fadeAnim = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  const bonusPulse = useSharedValue(0);
  const duoPendingPulse = useSharedValue(0);
  const duoPendingCardGlowStyle = useAnimatedStyle(() => {
  const o = 0.08 + duoPendingPulse.value * 0.14;
  const s = 1 + duoPendingPulse.value * 0.01;
  return { opacity: o, transform: [{ scale: s }] };
});


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

useEffect(() => {
  if (!user?.uid) {
    setPendingInvite(null);
    setDuoInvitePending(false);
    setDuoInvitePendingFor(null);
    return;
  }

  const qInv = query(
    collection(db, "invitations"),
    where("inviterId", "==", user.uid),
    where("status", "==", "pending"),
    limit(1)
  );

  const unsub = onSnapshot(
    qInv,
    (snap) => {
      if (snap.empty) {
        setPendingInvite(null);
        setDuoInvitePending(false);
        setDuoInvitePendingFor(null);
        return;
      }

      const doc0 = snap.docs[0];
      const data: any = doc0.data();

      const challengeId =
        typeof data?.challengeId === "string" ? data.challengeId.trim() : "";

      const selectedDays =
        typeof data?.selectedDays === "number" ? data.selectedDays : undefined;

      setPendingInvite({
        id: doc0.id,
        challengeId,
        selectedDays,
        inviteeUsername:
          typeof data?.inviteeUsername === "string" ? data.inviteeUsername : undefined,
        createdAt: data?.createdAt,
      });

      setDuoInvitePending(true);
      setDuoInvitePendingFor(challengeId || null);
    },
    () => {
      setPendingInvite(null);
      setDuoInvitePending(false);
      setDuoInvitePendingFor(null);
    }
  );

  return () => unsub();
}, [user?.uid]);

useEffect(() => {
  if (!duoInvitePending || isTutorialBlocking) {
    duoPendingPulse.value = 0;
    return;
  }
  duoPendingPulse.value = withRepeat(
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [duoInvitePending, isTutorialBlocking, duoPendingPulse]);

const bonusPulseStyle = useAnimatedStyle(() => {
  const o = 0.10 + bonusPulse.value * 0.10;
  return { opacity: o };
});

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1500 });
  }, [fadeAnim]);

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
      setIsUserDataReady(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
  setIsMounted(true);
}, []);

  useEffect(() => {
    const list = dailyFive.length ? dailyFive : allChallenges;
    if (!list?.length) return;
    list.forEach((c) => {
      if (c?.id && brokenImages[c.id]) return;
      const full = getChallengeImageUri(c, "full");
    const thumb = getChallengeImageUri(c, "thumb");

    const targets = new Set<string>();
    if (full?.startsWith("http")) targets.add(full);
    if (thumb?.startsWith("http")) targets.add(thumb);

    targets.forEach((u) => {
      try { (Image as any)?.prefetch?.(u); } catch {}
    });
    });
}, [dailyFive, allChallenges, brokenImages, getChallengeImageUri]);

   const fetchChallenges = useCallback(async () => {
    let hydratedFromCache = false;

    try {

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
          imageUrl:
            typeof c.imageUrl === "string" && c.imageUrl.trim().length > 0
              ? c.imageUrl
              : undefined,
        }))
      : [];

    if (base.length) setLoading(false);
  } catch {
    base = [];
  }
}

      if (base.length) {
        const picks = buildDailyPicksFromBase(
          base,
          cachedDaily,
          user?.uid
        );

        setAllChallenges(base);
        setDailyFive(picks);
        hydratedFromCache = true;
      }

      const challengesQuery = query(
        collection(db, "challenges"),
        where("approved", "==", true)
      );
      const querySnapshot = await getDocs(challengesQuery);

      const fetched: Challenge[] = querySnapshot.docs.map((snap) => {
        const data = snap.data() as any;
        const imageUrl =
    typeof data?.imageUrl === "string" && data.imageUrl.trim().length > 0
      ? data.imageUrl.trim()
      : undefined;

 const imageThumbUrl =
    typeof data?.imageThumbUrl === "string" && data.imageThumbUrl.trim().length > 0
      ? data.imageThumbUrl.trim()
      : (imageUrl ? getThumbUrl200(imageUrl) : undefined);

  if (__DEV__ && imageUrl?.startsWith("http://")) {
    console.warn(
      "[HomeScreen] HTTP imageUrl (risk on Android):",
      imageUrl,
      "challengeId:",
      snap.id
    );
  }

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
          imageUrl,
          imageThumbUrl,
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

      setAllChallenges(fetched);
      setDailyFive(picksFresh);

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

   const { complete: completeQuest } = useOnboardingQuests();

  const handleQuestPress = useCallback((questId: QuestId) => {
    switch (questId) {
      case "mark_first_day":
      case "view_challenge": {
        const id = primaryActiveId ?? activeChallengeId;
        if (id) safeNavigate(`/challenge-details/${id}`, "onboarding-quest");
        else safeNavigate("/explore", "onboarding-quest-no-challenge");
        break;
      }
      case "join_solo_challenge":
        safeNavigate("/explore", "onboarding-quest-join");
        break;
      case "complete_profile":
        safeNavigate("/profile/UserInfo", "onboarding-quest-profile");
        break;
      case "explore_community":
        router.push("/(tabs)/focus" as any);
        break;
    }
  }, [primaryActiveId, activeChallengeId, safeNavigate, completeQuest, router]);

  const handlePickChallengePress = useCallback(async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
  safeNavigate("/explore", "home-pick-challenge");
}, [safeNavigate]);

const handleInviteFriendPress = useCallback(async () => {
  const targetId =
    pendingInvite?.challengeId ??
    todayHubView.hubChallengeId ??
    primaryActiveId;

  if (!targetId) {
    try { await Haptics.selectionAsync(); } catch {}
    safeNavigate("/explore", "home-invite-no-active");
    return;
  }

  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

  safeNavigate(`/challenge-details/${targetId}?invitePending=1`, "home-invite-friend");
}, [pendingInvite?.challengeId, todayHubView.hubChallengeId, primaryActiveId, safeNavigate]);

const warmupTargetId = useMemo(() => {
  const id =
    pendingInvite?.challengeId ??
    todayHubView.hubChallengeId ??
    primaryActiveId;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}, [pendingInvite?.challengeId, todayHubView.hubChallengeId, primaryActiveId]);

const handleWarmupPress = useCallback(async () => {
  if (!warmupTargetId) return;
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  safeNavigate(`/challenge-details/${warmupTargetId}?warmup=1`, "home-warmup");
}, [warmupTargetId, safeNavigate]);

  const handleMarkTodayPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  const targetId =
    primaryActiveId ??
    todayHubView.hubChallengeId ??
    activeChallengeId;

  if (!targetId) {
    safeNavigate("/explore", "home-mark-no-target");
    return;
  }

  safeNavigate(`/challenge-details/${targetId}`, "home-mark-today");
}, [primaryActiveId, todayHubView.hubChallengeId, activeChallengeId, safeNavigate]);

  const handleSpotlightMark = useCallback(async () => {
    await dismissSpotlight();
    setTimeout(() => {
      handleMarkTodayPress();
    }, 80);
  }, [dismissSpotlight, handleMarkTodayPress]);

  const handleOpenActiveChallenge = useCallback(async () => {
    if (!activeChallengeId) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    safeNavigate(`/challenge-details/${activeChallengeId}`, "home-open-active");
  }, [activeChallengeId, safeNavigate]);

  const heroCtaLabel = useMemo(
    () => hasActiveChallenges
      ? t("homeZ.hero.ctaActive", "Continuer")
      : t("homeZ.hero.ctaShort", "Commencer"),
    [t, hasActiveChallenges]
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
          lastClaimDate: DAY_UTC,
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

const todayHubTitle = todayHubView.title;
const todayHubSub = todayHubView.subtitle;
const todayHubHubDescription = useMemo(() => {
  const raw = (todayHubView.hubMeta?.description ?? "") as any;
  const clean = String(raw ?? "").trim();
  return clean ? clean.replace(/\s+/g, " ") : "";
}, [todayHubView.hubMeta?.description]);

const whyReturn = useMemo<TodayHubWhyReturn | null>(() => {
  const hasActive = !!todayHubView?.hasActiveChallenges;

  const anyUnmarked =
    typeof (todayHubView as any)?.anyUnmarkedToday === "boolean"
      ? (todayHubView as any).anyUnmarkedToday
      : false;

  const uname = pendingInvite?.inviteeUsername?.trim?.();
  const duoNote = hasOutgoingPendingInvite
    ? t("homeZ.todayHub.whyReturn.duoSecondary", {
        defaultValue: "Duo en attente{{who}}.",
        who: uname ? ` (@${uname})` : "",
      })
    : "";

  if (todayHubPrimaryMode === "duoPending") {
    return {
      variant: "duo",
      text: t("homeZ.todayHub.whyReturn.duo", {
        defaultValue: "Ton duo est en attente{{who}}.",
        who: uname ? ` (@${uname})` : "",
      }),
    };
  }

  if (hasActive && anyUnmarked) {
    const base = t("homeZ.todayHub.whyReturn.warning", {
      defaultValue: "Il te reste un check-in aujourd'hui. Garde ton rythme.",
    });

    return {
      variant: "warning",
      text: duoNote ? `${base}  •  ${duoNote}` : base,
    };
  }

  if (hasOutgoingPendingInvite) {
    return {
      variant: "duo",
      text: t("homeZ.todayHub.whyReturn.duo", {
        defaultValue: "Ton duo est en attente{{who}}.",
        who: uname ? ` (@${uname})` : "",
      }),
    };
  }

  if (canClaimDailyBonus) {
    return {
      variant: "trophy",
      text: t("homeZ.todayHub.whyReturn.trophy", {
        defaultValue: "Un bonus t'attend aujourd'hui. Petit gain, gros momentum.",
      }),
    };
  }

  const streak =
    (userData as any)?.streak ??
    (userData as any)?.streakDays ??
    (userData as any)?.currentStreak ??
    null;

  const streakNum =
    typeof streak === "number"
      ? streak
      : typeof streak?.current === "number"
      ? streak.current
      : typeof streak?.count === "number"
      ? streak.count
      : null;

  if (typeof streakNum === "number" && streakNum > 0) {
    return {
      variant: "streak",
      text: t(
        "homeZ.todayHub.whyReturn.streak",
        "Tu construis une série. Un petit pas par jour."
      ),
    };
  }

  return {
    text: t("homeZ.todayHub.whyReturn.default", {
      defaultValue: "Reviens quand tu veux : 1 minute suffit pour avancer.",
    }),
  };
}, [
  t,
  userData,
  canClaimDailyBonus,
  todayHubView,
  todayHubPrimaryMode,
  hasOutgoingPendingInvite,
  pendingInvite?.inviteeUsername,
]);

const onOpenHub = useCallback(async () => {
  const id = todayHubView.hubChallengeId ?? primaryActiveId;
  if (!id) return;
  try { await Haptics.selectionAsync(); } catch {}
  safeNavigate(`/challenge-details/${id}`, "home-open-todayhub");
}, [todayHubView.hubChallengeId, primaryActiveId, safeNavigate]);

const onPickSolo = useCallback(async () => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  safeNavigate("/explore", "home-pick-solo");
}, [safeNavigate]);

const onCreate = useCallback(async () => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  safeNavigate("/create-challenge", "home-create-challenge");
}, [safeNavigate]);

const onPrimaryPress = useCallback(() => {
  if (todayHubPrimaryMode === "mark") return handleMarkTodayPress();
  if (todayHubPrimaryMode === "pick") return handlePickChallengePress();
 if (todayHubPrimaryMode === "new") return handlePickChallengePress();
 return handleWarmupPress();
}, [
  todayHubPrimaryMode,
  handleMarkTodayPress,
  handlePickChallengePress,
  handleWarmupPress,
]);

const todayHubPrimaryGradient = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return ["#F97316", "#FB923C"] as const;
  if (todayHubPrimaryMode === "duoPending") return ["#6366F1", "#A78BFA"] as const;
  return ["#F97316", "#FDBA74"] as const;
}, [todayHubPrimaryMode]);

const todayHubPrimaryIcon = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return "checkmark-circle-outline";
  if (todayHubPrimaryMode === "duoPending") return "hourglass-outline";
  return "compass-outline";
}, [todayHubPrimaryMode]);

const todayHubPrimaryLabel = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return t("homeZ.todayHub.primaryActiveShort", "Check in");
  if (todayHubPrimaryMode === "duoPending") return t("homeZ.duoPending.cta", "View");
  return t("homeZ.todayHub.primaryNewShort", "New");
}, [t, todayHubPrimaryMode]);

const handleClaimWelcomeBonus = async () => {
  if (!user || welcomeLoading || !welcomeState) return;

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

    await markWelcomeHandled();

try {
  await AsyncStorage.setItem(POST_WELCOME_ABSORB_KEY, "1");
} catch {}
setPostWelcomeAbsorbArmed(true);

    setWelcomeState(state);

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setUserData(snap.data());
    }

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
          lastRerollDate: DAY_UTC,
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

  // ─── SKELETON LOADER COMPONENT ────────────────────────────────────────────
  const SkeletonPulse = useSharedValue(0);
  useEffect(() => {
    SkeletonPulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [SkeletonPulse]);

  const skeletonAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + SkeletonPulse.value * 0.35,
  }));

  const SkeletonCard = () => (
    <Animated.View style={[stylesDaily.heroCard, skeletonAnimStyle, {
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)",
    }]} />
  );

  const SkeletonMini = () => (
    <Animated.View style={[stylesDaily.carouselCard, skeletonAnimStyle, {
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.08)",
    }]} />
  );
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <StatusBar
  barStyle="light-content"
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
          pointerEvents={isTutorialBlocking ? "none" : "auto"}
          scrollEnabled={!isTutorialBlocking}
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

          {/* ════════════════════════════════════════════════════════
              HERO SECTION — cinematic, alive, premium
          ════════════════════════════════════════════════════════ */}
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
           <Image
  source={FALLBACK_CHALLENGE_IMG}
  style={[staticStyles.backgroundVideo, { top: -insets.top, height: HERO_TOTAL_HEIGHT }]}
  contentFit="cover"
  cachePolicy="memory-disk"
/>
           <Video
  ref={heroVideoRef}
  style={[staticStyles.backgroundVideo, { top: -insets.top, height: HERO_TOTAL_HEIGHT, opacity: videoReady ? 1 : 0 }]}
  resizeMode={ResizeMode.COVER}
  source={require("../../assets/videos/Hero-Bgopti.mp4")}
  onReadyForDisplay={() => setVideoReady(true)}
  shouldPlay={heroShouldPlay}
  isLooping={false}
  isMuted
  progressUpdateIntervalMillis={250}
  onError={() => setVideoReady(false)}
  onPlaybackStatusUpdate={(status: any) => {
    if (!status?.isLoaded) return;
    if (status.didJustFinish) {
      heroVideoRef.current?.pauseAsync?.().catch(() => {});
      return;
    }
    if (!heroShouldPlay) return;
    if (status.isPlaying) return;
    if (heroPlayGuardRef.current) return;
    heroPlayGuardRef.current = true;
    heroVideoRef.current?.playAsync?.().catch(() => {}).finally(() => {
      heroPlayGuardRef.current = false;
    });
  }}
/>

            {/* ✨ IMPROVED: deeper, more directional cinematic gradient */}
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.00)",
                "rgba(0,0,0,0.05)",
                "rgba(0,0,0,0.42)",
                "rgba(0,0,0,0.78)",
                "rgba(0,0,0,0.95)",
              ]}
              locations={[0, 0.20, 0.55, 0.82, 1]}
              style={[
                staticStyles.heroOverlay,
                { top: -insets.top, height: HERO_TOTAL_HEIGHT },
              ]}
              pointerEvents="none"
            />
            {/* Gradient haut — protège la status bar */}
<LinearGradient
  colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.00)"]}
  locations={[0, 0.25, 0.55]}
  style={[staticStyles.heroOverlay, { top: -insets.top, height: HERO_TOTAL_HEIGHT }]}
  pointerEvents="none"
/>

            {/* ✨ NEW: orange ambient glow at bottom of hero (above gradient) */}
            <LinearGradient
              colors={["rgba(249,115,22,0.00)", "rgba(249,115,22,0.14)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                staticStyles.heroOrangeAmbient,
                { top: -insets.top, height: HERO_TOTAL_HEIGHT },
              ]}
              pointerEvents="none"
            />

            <View
              style={[
                staticStyles.heroContent,
                {
                  paddingTop: insets.top + normalize(IS_TINY ? 8 : 12),
                  paddingHorizontal: normalize(15),
                  gap: normalize(IS_TINY ? 6 : 8),
                },
              ]}
            >
              {/* Brand row */}
              <View style={staticStyles.heroBrandRow}>
                <Image
                  source={require("../../assets/images/icon2.png")}
                  style={staticStyles.logoKeynote}
                  resizeMode="contain"
                  accessibilityLabel={t("logoChallengeTies")}
                  transition={180}
                />
                {/* ✨ IMPROVED: frosted glass brand pill */}
                <BlurView
                  intensity={isDarkMode ? 28 : 20}
                  tint="dark"
                  style={staticStyles.heroBrandPillBlur}
                >
                  <View style={staticStyles.heroBrandPillInner}>
                    <Text style={staticStyles.heroBrandPillText} numberOfLines={1}>
                      {t("homeZ.hero.brand", "CHALLENGETIES")}
                    </Text>
                  </View>
                </BlurView>
              </View>

              {/* Punchline */}
              <Text
                style={[staticStyles.heroTitleKeynote, dynamicStyles.heroTitle]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={IS_TINY ? 0.84 : 0.88}
              >
                {t("homeZ.hero.headline", "Le déclic du jour.")}
              </Text>

              {/* Proof line */}
              <Text
                style={[staticStyles.heroSubtitleKeynote, dynamicStyles.heroSubtitle]}
                numberOfLines={2}
                minimumFontScale={IS_TINY ? 0.86 : 0.90}
              >
               {t("homeZ.hero.sub", "Un défi. Un clic. Et si tu veux tenir : Duo.")}
              </Text>

              {/* ✨ IMPROVED: Hero CTA with ambient glow effect */}
             <TouchableOpacity
                onPress={hasActiveChallenges ? handleMarkTodayPress : handlePickChallengePress}
                accessibilityRole="button"
                accessibilityLabel={t("homeZ.hero.ctaA11y", "Choisir un défi")}
                testID="cta-button"
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                style={{ alignSelf: "center" }}
                onPressIn={() => {
                  exploreScale.value = withSpring(0.96, { damping: 18, stiffness: 220 });
                }}
                onPressOut={() => {
                  exploreScale.value = withSpring(1, { damping: 16, stiffness: 180 });
                }}
              >
                <View style={staticStyles.heroCTAWrapper}>
                  {/* ✨ NEW: ambient glow behind CTA button */}
                  <Animated.View style={[exploreAnimStyle, { alignSelf: "center" }]}>
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={staticStyles.ctaButtonKeynote}
                    >
                      {/* ✨ NEW: subtle shine overlay on CTA */}
                      <LinearGradient
                        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={staticStyles.ctaShineOverlay}
                        pointerEvents="none"
                      />
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
                      </View>
                    </LinearGradient>
                  </Animated.View>
                </View>
              </TouchableOpacity>

              {/* Stat bar — données utilisateur réelles si dispo */}
{(() => {
  const list = (userData as any)?.CurrentChallenges;
  const streakNum: number | null = (() => {
    if (!Array.isArray(list)) return null;
    const active = list.filter((c: any) => !c?.completed && !c?.archived);
    if (!active.length) return null;
    const max = Math.max(...active.map((c: any) =>
      typeof c?.streak === "number" ? c.streak : 0
    ));
    return max > 0 ? max : null;
  })();

  if (!streakNum) return null; // ← rien à afficher si pas de série

  return (
    <View style={[staticStyles.heroStatBar, staticStyles.heroStatBarSafe, { marginBottom: normalize(IS_TINY ? 6 : 10) }]}>
      <View style={staticStyles.heroStatItem}>
        <Ionicons name="flame" size={normalize(13)} color="#F97316" />
        <Text style={staticStyles.heroStatText}>
          {t("homeZ.hero.statStreak", "{{n}} j de série", { n: streakNum })}
        </Text>
      </View>
    </View>
  );
})()}

            </View>
          </Animated.View>

          {/* TodayHub */}
          {/* TodayHub */}
<View
  onLayout={(e) => {
    todayHubYRef.current = e.nativeEvent.layout.y;
  }}
>
  {!isUserDataReady && !isGuest ? (
    <View style={{
      marginHorizontal: normalize(15),
      marginTop: normalize(14),
      marginBottom: normalize(4),
      borderRadius: normalize(28),
      overflow: "hidden",
      height: normalize(220),
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(2,6,23,0.05)",
    }}>
      <Animated.View style={[
        StyleSheet.absoluteFill,
        skeletonAnimStyle,
        { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(2,6,23,0.04)" }
      ]} />
      {/* Lignes skeleton */}
      <View style={{ padding: normalize(20) }}>
        <Animated.View style={[skeletonAnimStyle, {
          width: normalize(120), height: normalize(10),
          borderRadius: normalize(6),
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.10)",
          marginBottom: normalize(16),
        }]} />
        <Animated.View style={[skeletonAnimStyle, {
          width: "85%", height: normalize(28),
          borderRadius: normalize(8),
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.10)",
          marginBottom: normalize(8),
        }]} />
        <Animated.View style={[skeletonAnimStyle, {
          width: "55%", height: normalize(16),
          borderRadius: normalize(6),
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(2,6,23,0.07)",
          marginBottom: normalize(24),
        }]} />
        <Animated.View style={[skeletonAnimStyle, {
          width: "100%", height: normalize(56),
          borderRadius: normalize(18),
          backgroundColor: isDarkMode ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.12)",
        }]} />
      </View>
    </View>
  ) : !isUserDataReady && isGuest ? (
    <View style={{
      marginHorizontal: normalize(15),
      marginTop: normalize(14),
      marginBottom: normalize(4),
      borderRadius: normalize(28),
      overflow: "hidden",
      padding: normalize(24),
      backgroundColor: isDarkMode ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.06)",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(249,115,22,0.22)" : "rgba(249,115,22,0.18)",
      alignItems: "center",
      gap: normalize(16),
    }}>
      <View style={{
        width: normalize(56), height: normalize(56),
        borderRadius: normalize(28),
        backgroundColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.12)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="people" size={normalize(26)} color="#F97316" />
      </View>
      <Text style={{
        fontFamily: "Comfortaa_700Bold",
        fontSize: normalize(18),
        color: isDarkMode ? "#F8FAFC" : "#0B1120",
        textAlign: "center",
      }}>
        {t("guest.todayHub.title", { defaultValue: "Rejoins la communauté" })}
      </Text>
      <Text style={{
        fontFamily: "Comfortaa_400Regular",
        fontSize: normalize(13),
        color: isDarkMode ? "rgba(255,255,255,0.62)" : "rgba(15,23,42,0.62)",
        textAlign: "center",
        lineHeight: normalize(19),
      }}>
        {t("guest.todayHub.sub", { defaultValue: "Crée un compte pour suivre tes défis, tenir ta streak et défier un ami en duo." })}
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/register" as any)}
        activeOpacity={0.88}
        style={{ width: "100%" }}
      >
        <LinearGradient
          colors={["#F97316", "#FB923C"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            borderRadius: normalize(18),
            paddingVertical: normalize(14),
            alignItems: "center",
          }}
        >
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: normalize(15),
            color: "#0B1120",
          }}>
            {t("guest.todayHub.cta", { defaultValue: "Créer un compte — gratuit" })}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/login" as any)} hitSlop={8}>
        <Text style={{
          fontFamily: "Comfortaa_400Regular",
          fontSize: normalize(12),
          color: isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)",
          textDecorationLine: "underline",
        }}>
          {t("guest.todayHub.login", { defaultValue: "J'ai déjà un compte" })}
        </Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TodayHub
      t={t}
      langKey={i18n.language}
      isDarkMode={isDarkMode}
      primaryMode={todayHubView.primaryMode}
      hasActiveChallenges={todayHubView.hasActiveChallenges}
      activeCount={todayHubView.activeCount}
      title={todayHubTitle}
      sub={todayHubSub}
      whyReturn={whyReturn}
      hubMeta={todayHubView.hubMeta}
      hubDescription={todayHubHubDescription}
      progressPct={todayHubView.progress.pct}
      primaryGradient={todayHubPrimaryGradient}
      primaryIcon={todayHubPrimaryIcon}
      primaryLabel={todayHubPrimaryLabel}
      onOpenHub={onOpenHub}
      onPrimaryPress={onPrimaryPress}
      onPickSolo={onPickSolo}
      onCreate={onCreate}
      CONTENT_MAX_W={CONTENT_MAX_W}
      staticStyles={staticStyles}
      normalize={normalize}
      primaryCtaRef={markCtaRef}
      primaryAnimatedStyle={markAnimStyle}
    />
  )}
          </View>

        {/* ════ ONBOARDING QUEST BANNER ════ */}
       <View style={{ zIndex: 1, elevation: 1 }} pointerEvents="box-none">
          <OnboardingQuestBanner onQuestPress={handleQuestPress} />
        </View>

        {/* ════ QUICK ACTIONS ════ */}
<View style={{
  paddingHorizontal: normalize(15),
  marginTop: normalize(2),
  marginBottom: normalize(16),
  width: "100%",
  maxWidth: CONTENT_MAX_W,
  alignSelf: "center",
}}>
  <View style={{ flexDirection: "row", gap: normalize(8) }}>

    {/* Explorer */}
    <Pressable
      onPress={async () => {
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
        safeNavigate("/explore", "quick-action-explore");
      }}
      style={({ pressed }) => ({
        flex: 1, minWidth: 0,
        borderRadius: normalize(18),
        overflow: "hidden",
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View style={{
        borderRadius: normalize(18),
        paddingVertical: normalize(15),
        paddingHorizontal: normalize(8),
        alignItems: "center",
        gap: normalize(8),
        borderWidth: 1,
        borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.09)",
        backgroundColor: isDarkMode ? "rgba(30,41,59,0.90)" : "#FFFFFF",
      }}>
        <View style={{
          width: normalize(44), height: normalize(44),
          borderRadius: normalize(22),
          alignItems: "center", justifyContent: "center",
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(2,6,23,0.05)",
        }}>
          <Ionicons name="compass-outline" size={normalize(22)} color={isDarkMode ? "#E2E8F0" : "#334155"} />
        </View>
        <Text style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: normalize(11.5),
          color: isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(30,41,59,0.85)",
          textAlign: "center", width: "100%",
        }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t("homeZ.quickAction.explore", { defaultValue: "Explorer" })}
        </Text>
      </View>
    </Pressable>

    {/* Créer — seul bouton orange, CTA dominant */}
    <Pressable
      onPress={async () => {
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
        safeNavigate("/create-challenge", "quick-action-create");
      }}
      style={({ pressed }) => ({
        flex: 1, minWidth: 0,
        borderRadius: normalize(18),
        overflow: "hidden",
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <LinearGradient
        colors={["#F97316", "#EA6C0A"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          borderRadius: normalize(18),
          paddingVertical: normalize(15),
          paddingHorizontal: normalize(8),
          alignItems: "center",
          gap: normalize(8),
        }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: normalize(18) }]}
          pointerEvents="none"
        />
        <View style={{
          width: normalize(44), height: normalize(44),
          borderRadius: normalize(22),
          alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.18)",
        }}>
          <Ionicons name="add" size={normalize(26)} color="#FFFFFF" />
        </View>
        <Text style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: normalize(11.5),
          color: "#FFFFFF",
          textAlign: "center", width: "100%",
        }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t("homeZ.todayHub.create", "Créer")}
        </Text>
      </LinearGradient>
    </Pressable>

    {/* Bonus — même style que Explorer */}
    {canClaimDailyBonus && (
      <Pressable
        onPress={async () => {
          if (dailyBonusLoading) return;
          try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          setDailyBonusVisible(true);
        }}
        style={({ pressed }) => ({
          flex: 1, minWidth: 0,
          borderRadius: normalize(18),
          overflow: "hidden",
          opacity: pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <View style={{
          borderRadius: normalize(18),
          paddingVertical: normalize(15),
          paddingHorizontal: normalize(8),
          alignItems: "center",
          gap: normalize(8),
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.09)",
          backgroundColor: isDarkMode ? "rgba(30,41,59,0.90)" : "#FFFFFF",
        }}>
          <View style={{
            width: normalize(44), height: normalize(44),
            borderRadius: normalize(22),
            alignItems: "center", justifyContent: "center",
            backgroundColor: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
          }}>
            <Ionicons name="gift-outline" size={normalize(22)} color="#F97316" />
          </View>
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: normalize(11.5),
            color: isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(30,41,59,0.85)",
            textAlign: "center", width: "100%",
          }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {t("dailyBonus.short", { defaultValue: "Bonus" })}
          </Text>
        </View>
      </Pressable>
    )}
  </View>
</View>

          <View style={{ height: normalize(6) }} />

          {/* ════════════════════════════════════════════════════════
              DAILY FIVE — editorial treatment
          ════════════════════════════════════════════════════════ */}
          {/* zIndex+elevation wrapper isolates this section from Discover's FadeInUp Android layer */}
          <View style={{ zIndex: 2, elevation: 2 }}>
          <View style={staticStyles.section}>
            <View style={{ width: "100%", marginBottom: normalize(14) }}>
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: normalize(10) }}>
      <View style={{ width: normalize(4), height: normalize(22), borderRadius: 2, backgroundColor: "#F97316" }} />
      <Text style={{
        fontFamily: "Comfortaa_700Bold",
        fontSize: normalize(20),
        color: isDarkMode ? "#F8FAFC" : "#0B1120",
        letterSpacing: -0.3,
      }}>
        {t("dailyChallenges", "Défis du jour")}
      </Text>
    </View>
    <Pressable onPress={handlePickChallengePress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: normalize(12.5), color: "#F97316" }}>
        {t("seeAll", { defaultValue: "Tout voir" })} →
      </Text>
    </Pressable>
  </View>
  <Text style={{
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalize(12.5),
    color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)",
    marginTop: normalize(4),
    marginLeft: normalize(14),
  }}>
    {t("dailySelectedSubtitleShort", "Sélection du jour · Renouvelé demain")}
  </Text>
</View>

            {/* ✨ IMPROVED: skeleton loader instead of bare spinner */}
            {loading ? (
              <View style={stylesDaily.wrap}>
                <SkeletonCard />
                <View style={{ flexDirection: "row", gap: DAILY_GAP, marginTop: normalize(12) }}>
                  <SkeletonMini />
                  <SkeletonMini />
                </View>
              </View>
            ) : dailyFive.length > 0 ? (
              <View style={stylesDaily.wrap}>
                {/* HERO card */}
                <Animated.View
                  entering={FadeInUp.springify().damping(20)}
                  style={stylesDaily.heroCard}
                  renderToHardwareTextureAndroid
                >
                  <TouchableOpacity
                    activeOpacity={0.95}
                    accessibilityRole="button"
                    onPress={async () => {
                      try { await Haptics.selectionAsync(); } catch {}
                      const c = dailyFive[0];
                      safeNavigate(
                        `/challenge-details/${c.id}?title=${encodeURIComponent(c.title)}&category=${encodeURIComponent(c.category)}&description=${encodeURIComponent(c.description)}`
                      );
                    }}
                  >
                    {(() => {
                      const c = dailyFive[0];
                      const uri = getChallengeImageUri(c, "full");
                      const k = `${c.id}:${imgReloadKey[c.id] ?? 0}`;
                      const showRemote = !!uri && !brokenImages[c.id];

                      return (
                        <View style={stylesDaily.heroImageWrap}>
                          <Image
                            source={FALLBACK_CHALLENGE_IMG}
                            style={stylesDaily.heroImage}
                            contentFit="cover"
                            transition={0}
                            cachePolicy="memory-disk"
                          />

                          {showRemote && (
                            <Image
                              key={k}
                              source={{ uri }}
                              style={[
                                stylesDaily.heroImage,
                                {
                                  position: "absolute",
                                  inset: 0,
                                  opacity: imgLoaded[c.id] ? 1 : 0,
                                },
                              ]}
                              contentFit="cover"
                              transition={220}
                              cachePolicy="memory-disk"
                              priority="high"
                              placeholder={BLURHASH}
                              placeholderContentFit="cover"
                              allowDownscaling
                              onLoad={() => markImageLoaded(c)}
                              onError={() => markImageBroken(c)}
                            />
                          )}
                        </View>
                      );
                    })()}

                    {/* ✨ IMPROVED: richer gradient, more contrast at bottom */}
                    <LinearGradient
                      colors={[
                        "rgba(0,0,0,0.00)",
                        "rgba(0,0,0,0.40)",
                        "rgba(0,0,0,0.82)",
                        "rgba(0,0,0,0.96)",
                      ]}
                      locations={[0, 0.42, 0.75, 1]}
                      style={stylesDaily.heroOverlay}
                      pointerEvents="none"
                    />
                    {/* ✨ IMPROVED: glassmorphism badge */}
                    <BlurView
                      intensity={18}
                      tint="dark"
                      style={stylesDaily.badgeBlur}
                    >
                      <View style={stylesDaily.badgeInner}>
                        <Ionicons name="flame" size={normalize(13)} color="#F97316" />
                        <Text style={stylesDaily.badgeText}>
                          {t("spotlight", { defaultValue: "À la une" })}
                        </Text>
                      </View>
                    </BlurView>

                    <View style={stylesDaily.heroTextZone}>
                      <Text
                        style={stylesDaily.heroTitle}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.90}
                      >
                        {dailyFive[0].title}
                      </Text>
                      {/* ✨ IMPROVED: frosted category pill */}
                      <BlurView intensity={14} tint="dark" style={stylesDaily.heroCatBlur}>
                        <View style={stylesDaily.heroCatPillInner}>
                          <Text style={stylesDaily.heroCatPillText} numberOfLines={1}>
                            {dailyFive[0].category}
                          </Text>
                        </View>
                      </BlurView>
                    </View>
                  </TouchableOpacity>
                </Animated.View>

                {/* CAROUSEL */}
                <View style={stylesDaily.carouselOuter}>
                  <Animated.FlatList
                    horizontal
                    data={dailyFive.slice(1)}
                    keyExtractor={(it) => it.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={stylesDaily.carouselContent}
                    decelerationRate="fast"
                    snapToAlignment="start"
                    snapToInterval={DAILY_SNAP}
                    disableIntervalMomentum
                    renderItem={({ item, index }) => {
                      const k = `${item.id}:${imgReloadKey[item.id] ?? 0}`;
                      const thumbUri = getChallengeImageUri(item, "thumb");
                      const fullUri = getChallengeImageUri(item, "full");
                      const uri = thumbUri || fullUri;
                      const showRemote = !!uri;

                      return (
                        <Animated.View
                          entering={FadeInUp.delay(80 * (index + 1)).springify().damping(20)}
                          style={stylesDaily.carouselCard}
                          renderToHardwareTextureAndroid
                        >
                          <TouchableOpacity
                            activeOpacity={0.95}
                            accessibilityRole="button"
                            onPress={async () => {
                              try { await Haptics.selectionAsync(); } catch {}
                              safeNavigate(
                                `/challenge-details/${item.id}?title=${encodeURIComponent(item.title)}&category=${encodeURIComponent(item.category)}&description=${encodeURIComponent(item.description)}`
                              );
                            }}
                          >
                            <View style={stylesDaily.miniImageWrap}>
                              <Image
                                source={FALLBACK_CHALLENGE_IMG}
                                style={stylesDaily.miniImage}
                                contentFit="cover"
                                transition={0}
                                cachePolicy="memory-disk"
                              />

                              {showRemote && (
                                <Image
                                  key={k}
                                  source={{ uri }}
                                  style={[
                                    stylesDaily.miniImage,
                                    {
                                      position: "absolute",
                                      inset: 0,
                                      opacity: imgLoaded[item.id] ? 1 : 0,
                                    },
                                  ]}
                                  contentFit="cover"
                                  transition={180}
                                  cachePolicy="memory-disk"
                                  priority="normal"
                                  placeholder={BLURHASH}
                                  placeholderContentFit="cover"
                                  allowDownscaling
                                  onLoad={() => markImageLoaded(item)}
                                  onError={() => { scheduleImageRetry(item.id); }}
                                />
                              )}
                            </View>

                            {/* ✨ IMPROVED: richer gradient on mini cards */}
                            <LinearGradient
                              colors={[
                                "rgba(0,0,0,0.00)",
                                "rgba(0,0,0,0.50)",
                                "rgba(0,0,0,0.92)",
                              ]}
                              locations={[0, 0.50, 1]}
                              style={stylesDaily.miniOverlay}
                              pointerEvents="none"
                            />

                            {/* ✨ NEW: subtle inner glow on text area for legibility */}
                            <LinearGradient
                              colors={["rgba(0,0,0,0.00)", "rgba(249,115,22,0.08)"]}
                              start={{ x: 0.5, y: 0 }}
                              end={{ x: 0.5, y: 1 }}
                              style={[StyleSheet.absoluteFill, { borderRadius: normalize(16) }]}
                              pointerEvents="none"
                            />

                            <Text
                              style={stylesDaily.carouselTitle}
                              numberOfLines={2}
                              minimumFontScale={0.90}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={stylesDaily.carouselCat}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.92}
                            >
                              {item.category}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    }}
                  />
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
                  {t("refreshDaily", { defaultValue: "Nouveaux défis dès demain ✨" })}
                </Text>
              </View>
            ) : (
              <Animated.View entering={FadeInUp} style={staticStyles.noChallengesContainer}>
                <Ionicons
                  name="sad-outline"
                  size={normalize(40)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text style={[staticStyles.noChallengesText, dynamicStyles.noChallengesText]}>
                  {t("noChallengesAvailable")}
                </Text>
                <Text style={[staticStyles.noChallengesSubtext, dynamicStyles.noChallengesSubtext]}>
                  {t("challengesComingSoon")}
                </Text>
              </Animated.View>
            )}
          </View>
          </View>{/* end daily isolation wrapper */}

         <View
  style={[staticStyles.discoverWrapper, { zIndex: 0, elevation: 0 }]}
  onLayout={(e) => { discoverYRef.current = e.nativeEvent.layout.y; }}
>
  {/* Toggle button */}
  <Pressable
    onPress={() => {
  const opening = !discoverExpanded;
  setDiscoverExpanded(opening);
  if (opening) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: discoverYRef.current - normalize(16),
          animated: true,
        });
      }, 160);
    });
  }
}}
    style={({ pressed }) => ({
      width: "100%",
      maxWidth: CONTENT_MAX_W,
      alignSelf: "center",
      borderRadius: normalize(16),
      overflow: "hidden",
      opacity: pressed ? 0.88 : 1,
      marginBottom: discoverExpanded ? normalize(10) : 0,
    })}
  >
    <LinearGradient
      colors={
        isDarkMode
          ? ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.03)"]
          : ["rgba(2,6,23,0.04)", "rgba(2,6,23,0.02)"]
      }
      style={{
        borderRadius: normalize(16),
        paddingVertical: normalize(14),
        paddingHorizontal: normalize(16),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.06)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: normalize(10) }}>
        <View style={{
          width: normalize(4),
          height: normalize(20),
          borderRadius: normalize(2),
          backgroundColor: "#F97316",
        }} />
        <Text style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: normalize(16),
          color: isDarkMode ? "#F8FAFC" : "#0B1120",
        }}>
          {t("homeZ.discover.title", "Découvrir")}
        </Text>
      </View>
      <Ionicons
        name={discoverExpanded ? "chevron-up" : "chevron-down"}
        size={normalize(18)}
        color={isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(2,6,23,0.55)"}
      />
    </LinearGradient>
  </Pressable>

  {/* Contenu collapsable */}
  {discoverExpanded && (
  <View style={{
    width: "100%",
    maxWidth: CONTENT_MAX_W,
    alignSelf: "center",
    marginTop: normalize(10),
    gap: normalize(8),
  }}>
    <View style={{ flexDirection: "row", gap: normalize(8) }}>

      {/* Classement */}
      <Pressable
        onPress={() => safeNavigate("/leaderboard")}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: normalize(20),
          overflow: "hidden",
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <View style={{
          borderRadius: normalize(20),
          padding: normalize(16),
          borderWidth: 1.5,
          borderColor: isDarkMode ? "rgba(249,115,22,0.25)" : "rgba(249,115,22,0.18)",
          backgroundColor: isDarkMode ? "rgba(15,23,42,0.88)" : "#FFFFFF",
          minHeight: normalize(148),
          justifyContent: "space-between",
          elevation: 6,
          ...(Platform.OS === "ios" ? {
            shadowColor: "#F97316",
            shadowOpacity: isDarkMode ? 0.18 : 0.08,
            shadowRadius: normalize(14),
            shadowOffset: { width: 0, height: normalize(6) },
          } : {}),
        }}>
          <View style={{
            width: normalize(50), height: normalize(50),
            borderRadius: normalize(25),
            alignItems: "center", justifyContent: "center",
            backgroundColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.10)",
            borderWidth: 1.5,
            borderColor: isDarkMode ? "rgba(249,115,22,0.38)" : "rgba(249,115,22,0.22)",
          }}>
            <Ionicons name="trophy" size={normalize(22)} color="#F97316" />
          </View>
          <View style={{ marginTop: normalize(14) }}>
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: normalize(14.5),
              color: isDarkMode ? "#F8FAFC" : "#0B1120",
              marginBottom: normalize(5),
              letterSpacing: -0.3,
            }} numberOfLines={1}>
              {t("homeZ.discover.leaderboard", "Classement")}
            </Text>
            <Text style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: normalize(12),
              color: isDarkMode ? "rgba(226,232,240,0.60)" : "rgba(15,23,42,0.55)",
              lineHeight: normalize(16),
            }} numberOfLines={2}>
              {t("homeZ.discover.leaderboardSub2", "Vois où tu te situes.")}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Tips */}
      <Pressable
        onPress={() => safeNavigate("/tips")}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: normalize(20),
          overflow: "hidden",
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <View style={{
          borderRadius: normalize(20),
          padding: normalize(16),
          borderWidth: 1.5,
          borderColor: isDarkMode ? "rgba(249,115,22,0.25)" : "rgba(249,115,22,0.18)",
          backgroundColor: isDarkMode ? "rgba(15,23,42,0.88)" : "#FFFFFF",
          minHeight: normalize(148),
          justifyContent: "space-between",
          elevation: 6,
          ...(Platform.OS === "ios" ? {
            shadowColor: "#F97316",
            shadowOpacity: isDarkMode ? 0.18 : 0.08,
            shadowRadius: normalize(14),
            shadowOffset: { width: 0, height: normalize(6) },
          } : {}),
        }}>
          <View style={{
            width: normalize(50), height: normalize(50),
            borderRadius: normalize(25),
            alignItems: "center", justifyContent: "center",
            backgroundColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.10)",
            borderWidth: 1.5,
            borderColor: isDarkMode ? "rgba(249,115,22,0.38)" : "rgba(249,115,22,0.22)",
          }}>
            <Ionicons name="bulb" size={normalize(22)} color="#F97316" />
          </View>
          <View style={{ marginTop: normalize(14) }}>
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: normalize(14.5),
              color: isDarkMode ? "#F8FAFC" : "#0B1120",
              marginBottom: normalize(5),
              letterSpacing: -0.3,
            }} numberOfLines={1}>
              {t("homeZ.discover.tips", "Tips")}
            </Text>
            <Text style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: normalize(12),
              color: isDarkMode ? "rgba(226,232,240,0.60)" : "rgba(15,23,42,0.55)",
              lineHeight: normalize(16),
            }} numberOfLines={2}>
              {t("homeZ.discover.tipsSub2", "Petits hacks, grands résultats.")}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>

    {/* Nouveautés */}
    <Pressable
      onPress={() => safeNavigate("/new-features")}
      style={({ pressed }) => ({
        width: "100%",
        borderRadius: normalize(20),
        overflow: "hidden",
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.992 : 1 }],
      })}
    >
      <View style={{
        borderRadius: normalize(20),
        padding: normalize(16),
        borderWidth: 1.5,
        borderColor: isDarkMode ? "rgba(249,115,22,0.25)" : "rgba(249,115,22,0.18)",
        backgroundColor: isDarkMode ? "rgba(15,23,42,0.88)" : "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: normalize(14),
        elevation: 6,
        ...(Platform.OS === "ios" ? {
          shadowColor: "#F97316",
          shadowOpacity: isDarkMode ? 0.18 : 0.08,
          shadowRadius: normalize(14),
          shadowOffset: { width: 0, height: normalize(6) },
        } : {}),
      }}>
        <View style={{
          width: normalize(54), height: normalize(54),
          borderRadius: normalize(27),
          alignItems: "center", justifyContent: "center",
          backgroundColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.10)",
          borderWidth: 1.5,
          borderColor: isDarkMode ? "rgba(249,115,22,0.38)" : "rgba(249,115,22,0.22)",
          flexShrink: 0,
        }}>
          <Ionicons name="sparkles" size={normalize(24)} color="#F97316" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: normalize(8), marginBottom: normalize(4) }}>
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: normalize(15),
              color: isDarkMode ? "#F8FAFC" : "#0B1120",
              letterSpacing: -0.2,
            }} numberOfLines={1}>
              {t("homeZ.discover.newFeatures", "Nouveautés")}
            </Text>
            <View style={{
              paddingHorizontal: normalize(7), paddingVertical: normalize(3),
              borderRadius: normalize(6),
              backgroundColor: "#F97316",
            }}>
              <Text style={{
                fontSize: normalize(9.5), fontFamily: "Comfortaa_700Bold",
                color: "#FFFFFF", letterSpacing: 0.5,
              }}>NEW</Text>
            </View>
          </View>
          <Text style={{
            fontFamily: "Comfortaa_400Regular",
            fontSize: normalize(12),
            color: isDarkMode ? "rgba(226,232,240,0.60)" : "rgba(15,23,42,0.55)",
            lineHeight: normalize(16),
          }} numberOfLines={2}>
            {t("homeZ.discover.newFeaturesSub", "Tu shapes l'app. Vraiment.")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={normalize(18)}
          color={isDarkMode ? "rgba(249,115,22,0.70)" : "rgba(249,115,22,0.60)"}
        />
      </View>
    </Pressable>
  </View>
)}
</View>

        </ScrollView>

        {/* Banner hairline */}
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

        {shouldShowBanner && (
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
        )}

        {isTutorialActive && (
          <>
            <BlurView intensity={35} style={staticStyles.blurView} />
            <TutorialModal
              step={tutorialStep}
              onNext={() => {
                const next = Math.min(tutorialStep + 1, TUTORIAL_STEPS.length - 1);
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
            onClose={async () => {
              await markWelcomeHandled();
              try { await AsyncStorage.setItem(POST_WELCOME_ABSORB_KEY, "1"); } catch {}
              setPostWelcomeAbsorbArmed(true);
            }}
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

        <Modal
          visible={showPremiumEndModal}
          transparent
          animationType="fade"
          onRequestClose={async () => {
            setShowPremiumEndModal(false);
            await persistPremiumEndDismiss();
          }}
        >
          <View style={staticStyles.blurView}>
            <View style={staticStyles.modalContainer}>
              <Ionicons name="diamond-outline" size={normalize(36)} color="#6366F1" />

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
                  onPress={async () => {
                    setShowPremiumEndModal(false);
                    await persistPremiumEndDismiss();
                  }}
                  style={[staticStyles.actionButton, { backgroundColor: "#E5E7EB" }]}
                >
                  <Text style={[staticStyles.actionButtonText, { color: "#111827" }]}>
                    {t("premiumEndModal.closeCta", "Continuer gratuitement")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowPremiumEndModal(false);
                    safeNavigate("/settings", "premium-end-modal");
                  }}
                  style={[staticStyles.actionButton]}
                >
                  <Text style={staticStyles.actionButtonText}>
                    {t("premiumEndModal.joinCta", "Rejoindre le mouvement Premium")}
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

// ─── STATIC STYLES ─────────────────────────────────────────────────────────────
const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  heroStatBarSafe: {
  backgroundColor: "rgba(0,0,0,0.35)",
  borderRadius: normalize(999),
  paddingHorizontal: normalize(14),
  paddingVertical: normalize(7),
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.12)",
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
  discoverCardOuter: {
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
    borderRadius: normalize(24),
    ...shadowSoft,
    borderWidth: ANDROID_HAIRLINE,
    borderStyle: "solid",
  },
  discoverCardInner: {
    borderRadius: normalize(24),
    overflow: "hidden",
    padding: normalize(16),
  },
  discoverHeader: {
    alignItems: "flex-start",         // ✨ left-aligned
    marginBottom: normalize(12),
  },
  // ✨ NEW: title row with accent bar
  discoverTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(10),
  },
  discoverAccentBar: {
    width: normalize(4),
    height: normalize(22),
    borderRadius: normalize(2),
    backgroundColor: "#F97316",
  },
  discoverTitle: {
    fontSize: normalize(18),
    lineHeight: normalize(22),
    fontFamily: "Comfortaa_700Bold",
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
    borderWidth: ANDROID_HAIRLINE,
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
  // ✨ NEW: "NEW" badge
  newBadge: {
    paddingHorizontal: normalize(7),
    paddingVertical: normalize(3),
    borderRadius: normalize(6),
    backgroundColor: "#F97316",
  },
  newBadgeText: {
    fontSize: normalize(10),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
    letterSpacing: 0.5,
  },
  duoCtaGlow: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  duoCtaRingWrap: {
    position: "absolute",
    right: normalize(14),
    top: "50%",
    width: normalize(44),
    height: normalize(44),
    marginTop: -normalize(22),
    alignItems: "center",
    justifyContent: "center",
  },
  duoCtaRing: {
    width: "100%",
    height: "100%",
    borderRadius: normalize(22),
    borderWidth: 1,
    borderColor: "rgba(11,17,32,0.20)",
    overflow: "hidden",
  },
  spotRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999999,
  },
  duoPendingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: normalize(10),
    marginBottom: normalize(4),
  },
  duoPendingTitle: {
    fontSize: normalize(13.2),
    lineHeight: normalize(17),
    fontFamily: "Comfortaa_700Bold",
    flex: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  duoPendingSub: {
    fontSize: normalize(12.0),
    lineHeight: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
  spotDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  spotBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  spotRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.55)",
    backgroundColor: "rgba(249,115,22,0.10)",
  },
  spotCtaWrap: {
    position: "absolute",
    borderRadius: normalize(18),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  duoPendingStepsWrap: {
    marginTop: normalize(8),
    gap: normalize(6),
  },
  duoPendingStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(8),
  },
  duoPendingStepDot: {
    width: normalize(6),
    height: normalize(6),
    borderRadius: normalize(999),
    backgroundColor: "#6366F1",
    marginTop: normalize(1),
  },
  duoPendingStepText: {
    flex: 1,
    minWidth: 0,
    fontSize: normalize(11.6),
    lineHeight: normalize(15),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
  spotCtaGrad: {
    flex: 1,
    borderRadius: normalize(18),
    paddingHorizontal: normalize(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spotCtaText: {
    fontSize: normalize(14.2),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    includeFontPadding: false,
  },
  spotMsgWrap: {
    position: "absolute",
  },
  spotMsgCard: {
    borderRadius: normalize(18),
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    overflow: "hidden",
  },
  spotMsgTitle: {
    fontSize: normalize(13.6),
    lineHeight: normalize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(6),
    includeFontPadding: false,
  },
  spotMsgSub: {
    fontSize: normalize(12.4),
    lineHeight: normalize(16.5),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
  discoverWideTitle: {
    fontSize: normalize(13.8),
    fontFamily: "Comfortaa_700Bold",
  },
  discoverWideSub: {
    fontSize: normalize(12.2),
    lineHeight: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },
  markHalo: {
    borderRadius: normalize(18),
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  markGlow: {
    borderRadius: normalize(18),
    backgroundColor: "rgba(249,115,22,0.28)",
  },
  discoverBigCard: {
    flex: 1,
    minHeight: normalize(104),
    borderRadius: normalize(18),
    padding: normalize(14),
    borderWidth: ANDROID_HAIRLINE,
  },
  // ✨ NEW: tinted card variants
  discoverCardLeaderboard: {
    // gold tint applied inline
  },
  discoverCardTips: {
    // blue tint applied inline
  },
  discoverBigIcon: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: ANDROID_HAIRLINE,
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
    opacity: 0.85,
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
  duoPendingWrap: {
    width: "100%",
    borderRadius: normalize(18),
    borderWidth: StyleSheet.hairlineWidth,
    padding: normalize(12),
    marginBottom: normalize(12),
    overflow: "hidden",
  },
  duoPendingGlow: {
    position: "absolute",
    left: normalize(-50),
    right: normalize(-50),
    top: normalize(-38),
    height: normalize(110),
    borderRadius: normalize(999),
    transform: [{ rotate: "-8deg" }],
  },
  duoPendingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: normalize(10),
    marginBottom: normalize(10),
  },
  duoPendingIcon: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(99,102,241,0.26)",
  },
  duoPendingDotWrap: {
    width: normalize(16),
    height: normalize(16),
    alignItems: "center",
    justifyContent: "center",
  },
  duoPendingDot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: normalize(999),
    backgroundColor: "#6366F1",
  },
  duoPendingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  duoPendingCta: {
    borderRadius: normalize(16),
    overflow: "hidden",
    alignSelf: "flex-end",
    minWidth: normalize(120),
  },
  duoPendingCtaGrad: {
    borderRadius: normalize(16),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: normalize(10),
  },
  duoPendingCtaText: {
    fontSize: normalize(13.2),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
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
    backgroundColor: "rgba(249,115,22,0.08)",
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
    maxWidth: CONTENT_W,
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
  heroCTAWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCTAGlow: {
  position: "absolute",
  width: normalize(180),
  height: normalize(36),
  borderRadius: normalize(18),
  backgroundColor: "#F97316",
  top: "50%",
  marginTop: -normalize(18),
  opacity: 0.6,
},
  ctaShineOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalize(16),
  },
  heroOrangeAmbient: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  heroStatBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalize(10),
    gap: normalize(8),
  },
  heroStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(5),
  },
  heroStatText: {
    fontSize: normalize(11.8),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.82)",
  },
  heroStatDot: {
    width: normalize(3),
    height: normalize(3),
    borderRadius: normalize(999),
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  // ✨ NEW: bonus particles container
  bonusParticles: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    pointerEvents: "none",
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
    ...shadowSoft,
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
    lineHeight: normalize(21),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(6),
    includeFontPadding: false,
    fontSize: normalize(14.6),
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
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.35,
    shadowRadius: normalize(10),
    elevation: 6,
    overflow: "hidden",
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
    width: normalize(68),
    alignItems: "flex-end",
  },
  dailyBonusIconCircleKeynote: {
    width: normalize(56),
    height: normalize(56),
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
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
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
    // NOTE: this is absolutely positioned inside heroContent (no position:relative),
    // so it anchors to heroSection. insets compensation is done at render time.
  },
  todayHubWrap: {
    paddingHorizontal: SPACING,
    marginTop: normalize(14),
    marginBottom: normalize(22),
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
    ...shadowSoft,
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
    flexShrink: 1, 
    maxWidth: "60%",
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
    flexShrink: 1, 
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
    paddingHorizontal: normalize(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadowSoft,
    paddingVertical: normalize(14),
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
    ...shadowSoft,
  },
  gradientContainer: {
    flex: 1,
    paddingBottom: normalize(10),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING * 5,
  },
  heroSection: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
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
  justifyContent: "flex-end",
  flex: 1,
},
 heroBrandRow: {
    width: "100%",
    maxWidth: CONTENT_W,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(10),
    marginBottom: normalize(16),
  },
   logoKeynote: {
    width: normalize(54),
    height: normalize(54),
  },
  heroBrandPillBlur: {
    borderRadius: normalize(999),
    overflow: "hidden",
  },
  heroBrandPillInner: {
    paddingHorizontal: normalize(18),
    paddingVertical: normalize(9),
    borderRadius: normalize(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  heroBrandPillText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
    letterSpacing: 1.8,
  },
  heroTitleKeynote: {
    width: "100%",
    maxWidth: CONTENT_W,
    fontSize: normalize(34),
    lineHeight: normalize(38),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalize(8),
    includeFontPadding: false,
  },
  heroSubtitleKeynote: {
    width: "100%",
    maxWidth: CONTENT_W,
    fontSize: normalize(15.2),
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
  width: normalize(220),
  paddingVertical: normalize(14),
  paddingHorizontal: normalize(24),
  borderRadius: normalize(999),
  shadowColor: "#F97316",
  shadowOffset: { width: 0, height: normalize(8) },
  shadowOpacity: 0.55,        // ← augmenté
  shadowRadius: normalize(24), // ← augmenté
  elevation: 10,               // ← augmenté Android
  overflow: "hidden",
  alignSelf: "center",
},
  heroCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(8),
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
    fontSize: normalize(15.5),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
    textAlign: "center",
    includeFontPadding: false,
  },
  section: {
    paddingTop: SPACING * 1.1,
    paddingBottom: SPACING * 1.1,
    paddingHorizontal: SPACING,
    marginBottom: SPACING * 1.1,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    zIndex: 0,
  },
  sectionTitle: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    lineHeight: normalize(24),
    includeFontPadding: false,
  },
  dailyBonusWrapper: {
    paddingHorizontal: SPACING,
    marginTop: SPACING * 0.2,
    marginBottom: SPACING * 1.2,
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
    marginBottom: SPACING * 1.6,
    marginTop: 0,
    paddingHorizontal: SPACING,
    zIndex: 0,
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
    backgroundColor: "#F97316",
  },
  actionButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
  },
});

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  heroTitle: {
    color: "#FFFFFF",
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
  },
  titleRow: {
    position: "relative",
    alignItems: "flex-start",      // ✨ left-aligned
    width: "100%",
    marginBottom: SPACING,
  },
  // ✨ NEW: accent dot + title row
  titleAccentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(10),
  },
  titleAccentDot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: normalize(999),
    backgroundColor: "#F97316",
  },
  subtitle: {
    marginTop: normalize(4),
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    textAlign: "left",              // ✨ left-aligned
  },
  // --- HERO ---
  heroCard: {
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
    aspectRatio: 1.75,
    borderRadius: normalize(20),
    overflow: "hidden",
    marginBottom: normalize(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.22,
    shadowRadius: normalize(12),
    // no zIndex here — let the natural stacking order handle it
    elevation: 4,
  },
  heroImageWrap: {
    width: "100%",
    height: "100%",
    borderRadius: normalize(20),
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",                  // ✨ taller gradient for more depth
  },
  // ✨ IMPROVED: glassmorphism badge
  badgeBlur: {
    position: "absolute",
    top: SPACING * 0.8,
    left: SPACING * 0.8,
    borderRadius: normalize(999),
    overflow: "hidden",
  },
  badgeInner: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(7),
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(6),
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },
  badgeText: {
    color: "#fff",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
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
    textShadowColor: "rgba(0,0,0,0.50)",
    textShadowOffset: { width: 0, height: 1 },
    includeFontPadding: false,
    textShadowRadius: 4,
  },
  // ✨ IMPROVED: frosted category pill
  heroCatBlur: {
    borderRadius: normalize(999),
    overflow: "hidden",
  },
  heroCatPillInner: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(7),
    borderRadius: normalize(999),
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroCatPillText: {
    fontSize: normalize(11.8),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.95)",
    includeFontPadding: false,
  },
  carouselOuter: {
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
  },
  carouselContent: {
    paddingHorizontal: normalize(2),
    paddingRight: normalize(6),
  },
  carouselCard: {
    width: DAILY_CARD_W,
    aspectRatio: 1.6,
    borderRadius: normalize(16),
    overflow: "hidden",
    marginRight: DAILY_GAP,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.22,
    shadowRadius: normalize(8),
    elevation: 4,
  },
  miniImageWrap: {
    width: "100%",
    height: "100%",
    borderRadius: normalize(18),
    overflow: "hidden",
    backgroundColor: "transparent",
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
    height: "65%",
  },
  carouselTitle: {
    position: "absolute",
    left: SPACING * 0.8,
    right: SPACING * 0.8,
    bottom: IS_SMALL ? SPACING * 1.8 : SPACING * 1.6,
    color: "#fff",
    fontSize: normalize(13.6),
    lineHeight: normalize(17),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0,0,0,0.50)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    includeFontPadding: false,
  },
  carouselCat: {
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
  footHint: {
    marginTop: normalize(10),
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
  },
});
