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

const getScreen = () => Dimensions.get("window");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = getScreen();
const BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const FALLBACK_CHALLENGE_IMG = require("../../assets/images/backgroundbase.jpg");

const ANDROID_HAIRLINE =
  Platform.OS === "android"
    ? Math.max(1 / PixelRatio.get(), 0.75)
    : StyleSheet.hairlineWidth;


const normalize = (size: number) => {
  // ✅ responsive réel (rotation / tablet / split-screen)
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


// --- Premium system tokens (minimal diff)
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

// Un seul style d’ombre cohérent (évite shadow+elevation partout)
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

type PendingInvite = {
  id: string;
  challengeId: string;
  selectedDays?: number;
  inviteeUsername?: string;
  createdAt?: any;
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

  // ✅ append _200x200 avant extension (jpg/png/webp/etc)
  const addSuffix = (s: string) => {
    const out = s.replace(/(\.[a-zA-Z0-9]+)$/i, "_200x200$1");
    return out === s ? "" : out;
  };

  try {
    const isFirebase =
      u.includes("firebasestorage.googleapis.com") && u.includes("/o/");

    // non-firebase => simple
    if (!isFirebase) {
      const [base, query] = u.split("?");
      const withThumb = addSuffix(base);
      if (!withThumb) return "";
      return query ? `${withThumb}?${query}` : withThumb;
    }

    // ✅ firebase: on ne touche qu’au segment "name" encodé après /o/
    // format: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>?alt=media&token=...
    const [pathPart, queryPart] = u.split("?");
    const idx = pathPart.indexOf("/o/");
    if (idx === -1) return "";

    const prefix = pathPart.slice(0, idx + 3); // inclut "/o/"
    const encoded = pathPart.slice(idx + 3);  // uniquement le path encodé
    if (!encoded) return "";

    const decoded = decodeURIComponent(encoded);
    const thumbDecoded = addSuffix(decoded);
    if (!thumbDecoded) return "";

    // re-encode strict du path uniquement
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
      // +2s de marge pour éviter les edge-cases
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
  const DAY_UTC = useUtcDayKeyStable();
  const router = useRouter();
  const params = useLocalSearchParams();
  // ✅ micro-tuning responsive sans refactor (petits écrans / tablettes)
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
  const [userData, setUserData] = useState<any | null>(null);
  const [duoInvitePending, setDuoInvitePending] = useState(false);
  const [duoInvitePendingFor, setDuoInvitePendingFor] = useState<string | null>(null);
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
 
const IMG_MAX_RETRIES = 2;                 // ok
const IMG_BROKEN_TTL_MS = 10 * 60_000;     // ✅ 10 min (stable + évite boucle)
const IMG_RETRY_BASE_MS = 450;  

const [imgReloadKey, setImgReloadKey] = useState<Record<string, number>>({});
const imgRetryRef = useRef<Record<string, number>>({}); // pas de re-render
const imgRetryTimerRef = useRef<Record<string, any>>({});

useEffect(() => {
  return () => {
    // cleanup timers
    Object.values(imgRetryTimerRef.current).forEach((t) => clearTimeout(t));
    imgRetryTimerRef.current = {};
  };
}, []);

const scheduleImageRetry = useCallback((id: string) => {
  const tries = (imgRetryRef.current[id] ?? 0) + 1;
  imgRetryRef.current[id] = tries;

  // remount pour forcer expo-image à retenter
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

    return true; // retry scheduled
  }

  return false; // no more retries
}, []);


  // ---------------------------
  // Onboarding Spotlight (1x)
  // ---------------------------
  const SPOTLIGHT_SHOWN_KEY = useMemo(
    () => `home.onboardingSpotlightShown.v1.${user?.uid ?? "guest"}`,
    [user?.uid]
  );
  const ONBOARDING_JUST_FINISHED_KEY = "onboarding.justFinished.v1";
  // ✅ post-welcome absorption trigger (1x)
const POST_WELCOME_ABSORB_KEY = useMemo(
  () => `home.postWelcomeAbsorb.v1.${user?.uid ?? "guest"}`,
  [user?.uid]
);

// ✅ Premium entitlement (payant OU trial actif)
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

// ✅ duoPending "first login" pulse (1x)
const DUO_PENDING_FIRST_KEY = useMemo(
  () => `home.duoPendingFirst.v1.${user?.uid ?? "guest"}`,
  [user?.uid]
);
const ABSORB_MARK_KEY = useMemo(
  () => `home.absorbMark.v1.${DAY_UTC}.${user?.uid ?? "guest"}`,
  [DAY_UTC, user?.uid]
);
 // ✅ first solo absorption (1x)
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


    // ---------------------------
  // Spotlight: anti-race / cancelable open
  // ---------------------------
  const spotlightOpenTokenRef = useRef(0);

  const isSpotlightBlocked = useCallback(() => {
    // ⚠️ IMPORTANT: on EXCLUT spotlightVisible ici (sinon on s’auto-bloque)
    return (
      isTutorialBlocking ||
      welcomeVisible ||
      dailyBonusVisible ||
      showPremiumEndModal ||
      modalVisible
    );
  }, [isTutorialBlocking, welcomeVisible, dailyBonusVisible, showPremiumEndModal, modalVisible]);

  const forceHideSpotlight = useCallback(() => {
    // ne consomme pas le flag "shown" (contrairement à dismissSpotlight)
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

    // Un modal (WelcomeBonus / Daily / Premium / Gate / Tuto) vient d’apparaître :
    // on coupe le spotlight IMMEDIATEMENT pour éviter l’effet “derrière”.
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

 const markImageBroken = useCallback((c?: Challenge) => {
  const id = c?.id;
  if (!id) return;

  // ✅ d’abord on retente 1-2 fois (transient réseau)
  const didScheduleRetry = scheduleImageRetry(id);
  if (didScheduleRetry) return;

  // ❌ seulement après retries → fallback “broken”
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
    
    // reset retry counter après TTL
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
  markImageOk(c); // garde ton cleanup broken/retry
}, [markImageOk]);

const getChallengeImageUri = useCallback(
  (c?: any, variant: "thumb" | "full" = "full") => {
    const rawFull = typeof c?.imageUrl === "string" ? c.imageUrl.trim() : "";
    const rawThumb = typeof c?.imageThumbUrl === "string" ? c.imageThumbUrl.trim() : "";
    const id = c?.id;

// ✅ on bloque seulement le "full" (hero), jamais le thumb.
// les thumbs peuvent fail transitoirement (cache/seed/list).
if (variant === "full" && id && brokenImages[id]) return "";

    if (variant === "thumb") {
      // ✅ 1) thumb explicite (si Firestore le fournit un jour)
      if (rawThumb.startsWith("http")) return rawThumb;

      // ✅ 2) sinon on dérive automatiquement le _200x200 depuis imageUrl (Firebase Storage)
      const derived = getThumbUrl200(rawFull);
      if (derived.startsWith("http")) return derived;

      // ✅ 3) dernier recours : full
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
// ✅ Solo "MARK" extra punch
const soloNudgePulse = useSharedValue(0);
const soloNudgeIn = useSharedValue(0); // 0..1 (fade/slide)

// ✅ Duo ring pulse (quand mode == "duo")
const duoRingPulse = useSharedValue(0);


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
    // ✅ supporte ta structure réelle : id dans l'objet user
    const id = (activeChallenge?.challengeId ?? activeChallenge?.id) as any;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  }, [activeChallenge]);

  useEffect(() => {
    // si pas de défi actif, ou si le défi devient duo => on réactive le nudge
    if (!hasActiveChallenges || !activeChallengeId || activeChallenge?.duo === true) {
      setDuoNudgeDismissed(false);
      return;
    }
    // si l’utilisateur change de défi actif => on réactive le nudge pour ce nouveau défi
    setDuoNudgeDismissed(false);
  }, [hasActiveChallenges, activeChallengeId, activeChallenge?.duo]);

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
// ✅ Meta "source de vérité" pour TodayHub : doit être traduite (via chatId) quand possible
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

// ✅ Banner height callback (logs uniquement en DEV)
  const handleAdHeight = useCallback((h: number) => {
    if (__DEV__) console.log("[ADS][HomeScreen] Banner height:", h);
    setAdHeight(h);
  }, []);


  const HERO_BASE_HEIGHT = useMemo(() => {
    // ✅ évite un hero trop grand sur petits écrans (et trop petit sur grands)
    const base = normalize(360);
    const capMin = Math.round(H * 0.44);
    const capMax = Math.round(H * 0.56);
    return Math.max(Math.min(base, capMax), capMin);
  }, [H]);
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;

  const bottomContentPadding =
    (showBanners && !isTutorialBlocking ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    SPACING * 2;

   const shouldShowBanner = showBanners && !isTutorialBlocking && !premiumEntitlement.isEntitled;
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
    // measure CTA position for perfect overlay
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
  // pendingInvite existe seulement pour les invites sortantes (inviterId == user.uid) dans ton query
  // donc on check juste l’essentiel + le bool guard
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
  // ✅ si des actifs existent : on prend celui choisi par TodayHub (non-marked prioritaire)
  return todayHubView.focusChallengeId ?? null;
}, [todayHubView.focusChallengeId]);

 const todayHubPrimaryMode = todayHubView.primaryMode as TodayHubPrimaryMode;

  const shouldPulsePrimary = useMemo(() => {
    // Apple-ish: pulse seulement quand il y a une action “à faire”
    // - mark: tant qu'il reste au moins 1 défi non marqué aujourd’hui
    // - duoPending: pour rappeler qu’une action est en attente
    if (todayHubView.primaryMode === "mark") return todayHubView.anyUnmarkedToday;
    if (todayHubView.primaryMode === "duoPending") return true;
    return false;
  }, [todayHubView.primaryMode, todayHubView.anyUnmarkedToday]);

  const tryOpenSpotlightWithRetry = useCallback(
    async (token: number) => {
      for (let i = 0; i < 6; i++) {
        // ✅ cancel si un autre open est déclenché entre-temps
        if (token !== spotlightOpenTokenRef.current) return;

        // ✅ si un modal arrive (welcome/daily/premium/gate/tuto), on stop
        if (isSpotlightBlocked()) return;

        // laisse le layout respirer (scroll, fonts, tabbar, etc.)
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

        // ✅ dernière vérif avant d’afficher
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

      // si on n'a jamais réussi à mesurer, on désarme pour éviter loop mentale
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
   // ✅ simple & robuste : le spotlight ne doit exister QUE si on peut "marquer aujourd’hui"
   return (
     hasActiveChallenges &&
     todayHubView.anyUnmarkedToday &&
     !hasOutgoingPendingInvite
   );
 }, [hasActiveChallenges, todayHubView.anyUnmarkedToday, hasOutgoingPendingInvite]);

const markHaloStyle = useAnimatedStyle(() => {
  const t = markPulse.value; // 0..1
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
  transform: [{ translateX: markShine.value * 260 }], // ajustable
  opacity: 0.16,
}));

const soloNudgeStyle = useAnimatedStyle(() => {
  const p = soloNudgePulse.value; // 0..1
  const a = soloNudgeIn.value; // 0..1

  return {
    opacity: 0.6 * a + 0.4 * a * (0.65 + p * 0.35),
    transform: [
      { translateY: (1 - a) * 8 },
      { scale: 1 + p * 0.015 },
    ] as any,
  };
});



const absorbToTodayHub = useCallback(async () => {
    // ✅ autorisé seulement quand l’écran est prêt
    if (!scrollRef.current) return;
    if (isAnyBlockingModalOpen && !postWelcomeAbsorbArmed) return;

    // ✅ 1x / jour / user
    try {
      const already = await AsyncStorage.getItem(ABSORB_MARK_KEY);
      if (already === "1") return;
    } catch {}

    InteractionManager.runAfterInteractions(() => {
      // 1) scroll vers TodayHub
      try {
        scrollRef.current?.scrollTo({
          y: Math.max(0, todayHubYRef.current - normalize(10)),
          animated: true,
        });
      } catch {}

      // 2) pulse du CTA principal selon le mode (Keynote: “l’action”)
      // ✅ Pulse unique, cohérent : CTA primaire (quelle que soit la variante)
      markScale.value = withSpring(0.975, { damping: 18, stiffness: 240 });
      setTimeout(() => {
        markScale.value = withSpring(1, { damping: 16, stiffness: 200 });
      }, 220);

      // 3) spotlight seulement si "mark"
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

  // ✅ pulse commun (mark + duoPending)
  markPulse.value = withRepeat(
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );

  // ✅ shine seulement sur "mark" (sinon ça fait trop “mark” sur pending)
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

  // ✅ Si on passe en duoPending, on CONSUME le flag onboarding pour éviter
  // un spotlight qui pop plus tard quand ça repasse "mark".
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

    // ✅ ne jamais lancer si un modal est visible
    if (isSpotlightBlocked()) return;

    // déjà affiché / déjà mesuré
    if (spotlightVisible || spotRect) return;

    // ✅ token: si un modal arrive après la planif, on annule
    const token = ++spotlightOpenTokenRef.current;

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        // re-check au moment exact de l’open
        if (token !== spotlightOpenTokenRef.current) return;
        if (isSpotlightBlocked()) return;

        tryOpenSpotlightWithRetry(token);
      }, 120);
    });

    return () => {
      // ✅ annule implicitement l’open prévu
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

    // ✅ pas de magie si un modal est visible
    if (
      isTutorialBlocking ||
      welcomeVisible ||
      dailyBonusVisible ||
      showPremiumEndModal ||
      modalVisible
    ) {
      return;
    }

    // ✅ absorb déclenchable dans 2 cas:
    // A) post-welcome armé
    // B) première fois solo (rail d’activation)
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

    // ✅ petite latence “Keynote” pour laisser mesurer todayHubY + CTA
    await new Promise((r) => setTimeout(r, 160));
    if (cancelled) return;

    await absorbToTodayHub();

    // consume flags
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
  const isDuo = todayHubPrimaryMode === "duo";
  const isPending = todayHubPrimaryMode === "duoPending";

  if ((!isDuo && !isPending) || isTutorialBlocking || isAnyBlockingModalOpen) {
    duoRing.value = 0;
    duoGlow.value = 0;
    return;
  }

  // Duo: pulse doux mais évident
  duoRing.value = withRepeat(
    withTiming(1, { duration: isPending ? 1400 : 1100, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );

  // Glow plus lent (Apple-ish)
  duoGlow.value = withRepeat(
    withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
}, [
  todayHubPrimaryMode,
  isTutorialBlocking,
  isAnyBlockingModalOpen,
  duoRing,
  duoGlow,
]);

// ✅ PremiumEnd: remember which expiry we are prompting for
const premiumEndExpiresMsRef = useRef<number | null>(null);

const persistPremiumEndDismiss = useCallback(async () => {
  if (!user?.uid) return;

  const expiresMs = premiumEndExpiresMsRef.current;
  if (!expiresMs) return;

  // 1) Firestore = vérité (multi-device + durable)
  try {
    await updateDoc(doc(db, "users", user.uid), {
      "premium.endModalDismissedUntil": expiresMs,
      "premium.endModalDismissedAt": serverTimestamp(),
    });
  } catch {
    // silence (on garde fallback local)
  }

  // 2) Fallback local (au cas où)
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

  // ✅ si premium payant, pas de modal
  if (premiumEntitlement.isPaying) return;

  // ✅ Firestore guard (multi-device)
  const dismissedUntil = (premium as any)?.endModalDismissedUntil;
  const dismissedUntilMs = toMs(dismissedUntil);
  if (dismissedUntilMs && dismissedUntilMs === expiresMs) return;

  // ✅ fallback local guard
  const key = `premiumEndModalShown_v3_${user.uid}`;

  const checkAndShow = async () => {
    try {
      const last = await AsyncStorage.getItem(key);
      if (last === String(expiresMs)) return;
    } catch {}

    // keep the expiry we are prompting for
    premiumEndExpiresMsRef.current = expiresMs;

    setShowPremiumEndModal(true);

    // store fallback immediately to reduce double-show even if user force closes app
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
    // ✅ refresh instant quand tu reviens de Explore / Challenge-details
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

  // ✅ invitation pending la plus récente envoyée par l'utilisateur
  // (si tu as createdAt dans Firestore, ajoute orderBy("createdAt","desc"))
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
}, []);

  useEffect(() => {
    const list = dailyFive.length ? dailyFive : allChallenges;
    if (!list?.length) return;
    list.forEach((c) => {
      if (c?.id && brokenImages[c.id]) return;
      const full = getChallengeImageUri(c, "full");
    const thumb = getChallengeImageUri(c, "thumb");

    // ✅ hero: préfetch full, minis: préfetch thumb
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
      }

      // 3) Requête Firestore pour rafraîchir les données (en arrière-plan si cache déjà affiché)
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

  // ✅ DEBUG DEV — détecte http:// (Android peut foirer parfois)
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

  // ✅ on pousse vers le détail du challenge, et tu peux y afficher un état "invitation envoyée"
  safeNavigate(`/challenge-details/${targetId}?invitePending=1`, "home-invite-friend");
}, [pendingInvite?.challengeId, todayHubView.hubChallengeId, primaryActiveId, safeNavigate]);

// ✅ WARMUP CTA (duo pending) -> renvoie vers le challenge-details du challenge concerné
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
  // ✅ “warmup=1” te permet (si tu veux) d’afficher un micro-rail dans challenge-details
  safeNavigate(`/challenge-details/${warmupTargetId}?warmup=1`, "home-warmup");
}, [warmupTargetId, safeNavigate]);

  const handleMarkTodayPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    // ✅ “Marquer” doit ouvrir le challenge-details du défi concerné (pas Focus)
  const targetId =
    primaryActiveId ??
    todayHubView.hubChallengeId ??
    activeChallengeId;

  if (!targetId) {
    // fallback safe : si on n’a aucun id, on envoie vers Explore
    safeNavigate("/explore", "home-mark-no-target");
    return;
  }

  safeNavigate(`/challenge-details/${targetId}`, "home-mark-today");
}, [primaryActiveId, todayHubView.hubChallengeId, activeChallengeId, safeNavigate]);

  const handleSpotlightMark = useCallback(async () => {
    await dismissSpotlight();
    // slight micro-delay to avoid "double modal" feel
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

  // ✅ CTA ultra-courts (jamais coupés) : on garde le sens via sous-texte + a11y/hints
  const heroCtaLabel = useMemo(
    () => t("homeZ.hero.ctaShort", "Explorer"),
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
// ✅ description safe (affichage preview)
const todayHubHubDescription = useMemo(() => {
  const raw = (todayHubView.hubMeta?.description ?? "") as any;
  const clean = String(raw ?? "").trim();
  return clean ? clean.replace(/\s+/g, " ") : "";
}, [todayHubView.hubMeta?.description]);

const whyReturn = useMemo<TodayHubWhyReturn | null>(() => {
  const hasActive = !!todayHubView?.hasActiveChallenges;

  // 1) DUO pending prioritaire (si tu veux l'effet "viral loop")
  if (todayHubPrimaryMode === "duoPending" || hasOutgoingPendingInvite) {
    const uname = pendingInvite?.inviteeUsername?.trim?.();
    return {
      variant: "duo",
      text: t("homeZ.todayHub.whyReturn.duo", {
        defaultValue: "Ton duo est en attente.",
        who: uname ? `@${uname}` : "",
      }),
    };
  }

  // 2) WARNING uniquement si on a un signal fiable
  const anyUnmarked =
    typeof (todayHubView as any)?.anyUnmarkedToday === "boolean"
      ? (todayHubView as any).anyUnmarkedToday
      : false;

  if (hasActive && anyUnmarked) {
    return {
      variant: "warning",
      text: t("homeZ.todayHub.whyReturn.warning", {
        defaultValue: "Il te reste un check-in aujourd’hui. Garde ton rythme.",
      }),
    };
  }

  // 3) BONUS
  if (canClaimDailyBonus) {
    return {
      variant: "trophy",
      text: t("homeZ.todayHub.whyReturn.trophy", {
        defaultValue: "Un bonus t’attend aujourd’hui. Petit gain, gros momentum.",
      }),
    };
  }

  // 4) STREAK
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

  // 5) DEFAULT
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
// ✅ actions TodayHub
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
 if (todayHubPrimaryMode === "new") return handlePickChallengePress(); // ou /create-challenge si tu veux pousser la création
 // duoPending => warmup
 return handleWarmupPress();
}, [
  todayHubPrimaryMode,
  handleMarkTodayPress,
  handlePickChallengePress,
  handleWarmupPress,
]);

// ✅ visuels CTA principal (gradient / icon / label)
const todayHubPrimaryGradient = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return ["#F97316", "#FB923C"] as const; // orange action
  if (todayHubPrimaryMode === "duoPending") return ["#6366F1", "#A78BFA"] as const; // violet pending
  return ["#F97316", "#FDBA74"] as const; // new -> explore warm
}, [todayHubPrimaryMode]);

const todayHubPrimaryIcon = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return "checkmark-circle-outline";
  if (todayHubPrimaryMode === "duoPending") return "hourglass-outline";
  return "compass-outline";
}, [todayHubPrimaryMode]);

const todayHubPrimaryLabel = useMemo(() => {
  if (todayHubPrimaryMode === "mark") return t("homeZ.todayHub.primaryActiveShort", "Check in");
  if (todayHubPrimaryMode === "duoPending") return t("homeZ.duoPending.cta", "View");
  // modes "pick" / "new" => explore
  return t("homeZ.todayHub.primaryNewShort", "New");
}, [t, todayHubPrimaryMode]);

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

// ✅ on arme l’absorption de façon robuste (storage + state)
try {
  await AsyncStorage.setItem(POST_WELCOME_ABSORB_KEY, "1");
} catch {}
setPostWelcomeAbsorbArmed(true);


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
            progressUpdateIntervalMillis={250}
            onError={() => {
              setVideoReady(false);
            }}
            onPlaybackStatusUpdate={(status: any) => {
              if (!heroShouldPlay) return;
              if (!status?.isLoaded) return;
              if (status.isPlaying) return;
              if (heroPlayGuardRef.current) return;

              heroPlayGuardRef.current = true;
              heroVideoRef.current
                ?.playAsync?.()
                .catch(() => {})
                .finally(() => {
                  heroPlayGuardRef.current = false;
                });
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

          <View
            style={[
              staticStyles.heroContent,
              {
                paddingTop: insets.top + normalize(IS_TINY ? 8 : 12),
                paddingHorizontal: normalize(15),
              },
            ]}
          >
            {/* Brand row : petit logo + label, très Apple */}
            <View style={staticStyles.heroBrandRow}>
              <Image
                source={require("../../assets/images/icon2.png")}
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
              minimumFontScale={IS_TINY ? 0.84 : 0.88}
            >
              {t("homeZ.hero.headline", "Reste régulier.")}
            </Text>

            {/* Proof line : courte, concrète */}
            <Text
              style={[staticStyles.heroSubtitleKeynote, dynamicStyles.heroSubtitle]}
              numberOfLines={2}
              
              minimumFontScale={IS_TINY ? 0.86 : 0.90}
            >
              {t("homeZ.hero.sub", "Un défi simple. Chaque jour. En solo ou à deux.")}
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
                  </View>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
 <View
  onLayout={(e) => {
    todayHubYRef.current = e.nativeEvent.layout.y;
  }}
>
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
</View>

<View style={{ height: normalize(18) }} />

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
                : ["rgba(255,255,255,0.90)", "rgba(255,248,235,0.78)"]
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

<View style={{ height: normalize(14) }} />

         {/* DAILY FIVE */}
<View style={staticStyles.section}>
  <View style={stylesDaily.titleRow}>
    <Text
      style={[staticStyles.sectionTitle, dynamicStyles.sectionTitle]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {t("dailyChallenges")}
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
    <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
  ) : dailyFive.length > 0 ? (
    <View style={stylesDaily.wrap}>
      {/* HERO (spotlight) */}
      <Animated.View
        entering={FadeInUp}
        style={stylesDaily.heroCard}
        renderToHardwareTextureAndroid
      >
        <TouchableOpacity
          activeOpacity={0.95}
          accessibilityRole="button"
          onPress={async () => {
            try {
              await Haptics.selectionAsync();
            } catch {}
            const c = dailyFive[0];
            safeNavigate(
              `/challenge-details/${c.id}?title=${encodeURIComponent(
                c.title
              )}&category=${encodeURIComponent(
                c.category
              )}&description=${encodeURIComponent(c.description)}`
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
                {/* fallback always visible */}
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

          <LinearGradient
            colors={[
              "rgba(0,0,0,0.05)",
              "rgba(0,0,0,0.55)",
              "rgba(0,0,0,0.92)",
            ]}
            locations={[0, 0.55, 1]}
            style={stylesDaily.heroOverlay}
            pointerEvents="none"
          />

          <View style={stylesDaily.badge}>
            <Ionicons name="flame-outline" size={normalize(14)} color="#fff" />
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

      {/* CAROUSEL (4 autres) */}
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
            const fullUri = getChallengeImageUri(item, "full"); // fallback
            const uri = thumbUri || fullUri;
            const showRemote = !!uri; // plus de check broken ici

            return (
              <Animated.View
                entering={FadeInUp.delay(80 * (index + 1))}
                style={stylesDaily.carouselCard}
                renderToHardwareTextureAndroid
              >
                <TouchableOpacity
                  activeOpacity={0.95}
                  accessibilityRole="button"
                  onPress={async () => {
                    try {
                      await Haptics.selectionAsync();
                    } catch {}
                    safeNavigate(
                      `/challenge-details/${item.id}?title=${encodeURIComponent(
                        item.title
                      )}&category=${encodeURIComponent(
                        item.category
                      )}&description=${encodeURIComponent(item.description)}`
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
                        onError={() => {
                        // ✅ retry seulement, et si ça fail encore => on laisse le fallback visible
                        scheduleImageRetry(item.id);
                      }}
                      />
                    )}
                  </View>

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
    staticStyles.discoverCardOuter,
    {
      borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(2,6,23,0.03)",
    },
  ]}
>
  <View style={staticStyles.discoverCardInner}>
              <View style={staticStyles.discoverHeader}>
                <Text
                  style={[
                    staticStyles.discoverTitle,
                    { color: isDarkMode ? "#F8FAFC" : "#0B1120" },
                  ]}
                  numberOfLines={1}
                >
                  {t("homeZ.discover.title", "Découvrir")}
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
            onClose={async () => {
  setWelcomeVisible(false);

  // ✅ même si l'user ferme sans claim, on veut le spotlight "mark today"
  try {
    await AsyncStorage.setItem(POST_WELCOME_ABSORB_KEY, "1");
  } catch {}
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

        {/* 💎 Modal fin de Premium ChallengeTies */}
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
  onPress={async () => {
    setShowPremiumEndModal(false);
    await persistPremiumEndDismiss();
  }}
  style={[
    staticStyles.actionButton,
    { backgroundColor: "#E5E7EB" },
  ]}
  accessibilityLabel={t("premiumEndModal.closeA11y", "Fermer la fenêtre")}
>
  <Text style={[staticStyles.actionButtonText, { color: "#111827" }]}>
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
discoverCardOuter: {
  width: "100%",
  maxWidth: CONTENT_W,
  alignSelf: "center",
  borderRadius: normalize(24),

  // ✅ shadow ici (pas d'overflow ici)
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
  backgroundColor: "rgba(0,0,0,0.72)", // au lieu de 0.52
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
  marginBottom: normalize(4),
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
},
todayHubWrap: {
  paddingHorizontal: SPACING,
  marginTop: normalize(14), // au lieu de 6
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
    paddingBottom: SPACING * 5, // rythme global homogène
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
}
,
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
  width: normalize(82), 
  height: normalize(82),
},
heroBrandPillText: {
  fontSize: normalize(15.2),
  fontFamily: "Comfortaa_700Bold",
  color: "#FFFFFF",          // ✅ BLANC NET
  letterSpacing: 1.6,
},
  heroBrandPill: {
  paddingHorizontal: normalize(18),
  paddingVertical: normalize(9),
  borderRadius: normalize(999),
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.35)",
  backgroundColor: "rgba(0,0,0,0.28)", // un poil plus dense
},
 heroTitleKeynote: {
    width: "100%",
    maxWidth: CONTENT_W,
    fontSize: normalize(32.5),
    lineHeight: normalize(36.5),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalize(10),
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
    marginTop: SPACING * 0.5,
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
    zIndex: 1,
  },

  titleRow: {
    position: "relative",
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING,
  },

  subtitle: {
    marginTop: normalize(2),
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    textAlign: "center",
  },

  // --- HERO ---
  heroCard: {
    width: "100%",
    maxWidth: CONTENT_W,
    alignSelf: "center",
    aspectRatio: 1.75,
    borderRadius: normalize(18),
    overflow: "hidden",
    marginBottom: normalize(12), // légèrement + tight (premium)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(8),
    zIndex: 1,
    elevation: 3,
  },
  heroImageWrap: {
    width: "100%",
    height: "100%",
    borderRadius: normalize(22),
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
    height: "55%",
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
  shadowOpacity: 0.20,
  shadowRadius: normalize(6),
  elevation: 3,
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
    height: "60%",
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
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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

