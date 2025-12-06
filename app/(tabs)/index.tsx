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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BannerSlot from "@/components/BannerSlot";
import { useFocusEffect } from "@react-navigation/native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeInUp,
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
import WeeklyTrophiesCard from "@/components/WeeklyTrophiesCard";
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

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  const normalizedSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

const ITEM_WIDTH = Math.min(SCREEN_WIDTH * 0.85, normalize(400));
const ITEM_HEIGHT = Math.min(SCREEN_HEIGHT * 0.32, normalize(240));

const SPACING = normalize(15);

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  day?: number;
  approved?: boolean;
}

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
  { type: "trophies", amount: 10 },   // Jour 1
  { type: "trophies", amount: 15 },   // Jour 2
  { type: "streakPass", amount: 1 },  // Jour 3
  { type: "trophies", amount: 20 },   // Jour 4
  { type: "streakPass", amount: 1 },  // Jour 5
  { type: "trophies", amount: 25 },   // Jour 6
  { type: "premium", amount: 7 },   // Jour 7 (jours de premium)
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
  const { showBanners } = useAdsVisibility();
  const params = useLocalSearchParams<{ startTutorial?: string }>();
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [dailyFive, setDailyFive] = useState<Challenge[]>([]);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [showPremiumEndModal, setShowPremiumEndModal] = useState(false);
  const { show: showToast } = useToast();

  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();

  const heroVideoRef = useRef<Video | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Micro-anim du CTA (premium tactile)
  const ctaScale = useSharedValue(1);
  const ctaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  const heroShouldPlay = useMemo(
    () => isScreenFocused && !isTutorialActive && videoReady,
    [isScreenFocused, isTutorialActive, videoReady]
  );

  // 🧩 DIFF 1 — log quand BannerSlot remonte une hauteur
const handleAdHeight = useCallback((h: number) => {
  console.log("[ADS][HomeScreen] handleAdHeight called with:", h);
  setAdHeight(h);
}, []);


  const HERO_BASE_HEIGHT = normalize(405);
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;

  const bottomContentPadding =
    (showBanners && !isTutorialActive ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    SPACING * 2;

    const shouldShowBanner = showBanners && !isTutorialActive;

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

      const effectiveWelcomeReward =
    welcomeState &&
    !welcomeState.completed &&
    welcomeState.currentDay >= 0 &&
    welcomeState.currentDay < WELCOME_TOTAL_DAYS
      ? WELCOME_REWARDS_UI[welcomeState.currentDay]
      : null;

      // 🧩 DIFF 2 — Logs de debug pubs sur HomeScreen
useEffect(() => {
  const adsReady = (globalThis as any).__ADS_READY__;
  const canRequestAds = (globalThis as any).__CAN_REQUEST_ADS__;
  const npa = (globalThis as any).__NPA__;

  console.log(
    "[ADS][HomeScreen] state =",
    {
      showBanners,
      isTutorialActive,
      adHeight,
      adsReady,
      canRequestAds,
      npa,
    }
  );
}, [showBanners, isTutorialActive, adHeight]);



  useEffect(() => {
    let ran = false;

    const maybeStartTutorial = async () => {
      if (ran) return;
      ran = true;

      if (params?.startTutorial === "1") {
        startTutorial?.();
        setTutorialStep?.(0);
        return;
      }

      const flag = await AsyncStorage.getItem("pendingTutorial");
      if (flag === "1") {
        await AsyncStorage.removeItem("pendingTutorial");
        startTutorial?.();
        setTutorialStep?.(0);
      }
    };

    maybeStartTutorial();
  }, [params?.startTutorial, startTutorial, setTutorialStep]);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      getDoc(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserData(data);

            const userLanguage = (data as any).language || i18n.language;
            i18n.changeLanguage(userLanguage);
            setLanguage(userLanguage);

            if ((data as any).locationEnabled) {
              fetchAndSaveUserLocation().catch(() => {});
            }
          } else {
            setUserData(null);
          }
        })
        .catch(() => {
          // On ne casse rien en cas d'erreur
        });
    } else {
      setUserData(null);
    }
  }, [user, setLanguage, i18n.language]);

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
    setWelcomeGuardDay(null); // reset propre quand pas de user
    return;
  }

  try {
    const state = computeWelcomeBonusState(userData);
    setWelcomeState(state);

    // Si tout est terminé → on ne force plus rien
    if (!state.canClaimToday || state.completed) {
      return;
    }

    // 🛡️ Garde : si on a déjà ouvert ce "currentDay", on ne ré-ouvre pas
    if (welcomeGuardDay === state.currentDay) {
      return;
    }

    if (isTutorialActive) {
      setPendingWelcomeAfterTutorial(true);
    } else {
      setWelcomeVisible(true);
    }

    // On marque ce jour comme "déjà affiché"
    setWelcomeGuardDay(state.currentDay);
  } catch (e) {
    console.warn("[HomeScreen] computeWelcomeBonusState error:", e);
  }
}, [userData, isTutorialActive, welcomeGuardDay]);


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

    // 4) On lit la date de fin du tempPremiumUntil (essai 7 jours)
    const tempUntil = premium.tempPremiumUntil;
    if (!tempUntil || typeof tempUntil !== "string") return;

    const expiresMs = Date.parse(tempUntil);
    if (Number.isNaN(expiresMs)) return;

    const now = Date.now();
    // Si encore actif → rien à faire
    if (now <= expiresMs) return;

    // 5) Clé de garde pour ne pas re-afficher indéfiniment
    const key = `premiumEndModalShown_v1_${user.uid}`;

    const checkAndShow = async () => {
      try {
        const last = await AsyncStorage.getItem(key);

        // Si on a déjà montré le modal pour CETTE date d'expiration → on ne re-show pas
        if (last === tempUntil) return;

        setShowPremiumEndModal(true);
        await AsyncStorage.setItem(key, tempUntil);
      } catch {
        // on ne casse pas l'UI si AsyncStorage plante
      }
    };

    checkAndShow();
  }, [user, userData]);


  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

  const fadeAnim = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

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
    const checkPioneerFlag = async () => {
      try {
        const flag = await AsyncStorage.getItem("pioneerJustGranted");
        if (flag === "1") {
          setShowPioneerModal(true);
          await AsyncStorage.removeItem("pioneerJustGranted");
        }
      } catch {}
    };

    if (user) {
      checkPioneerFlag();
    }
  }, [user]);

  useEffect(() => {
    const list = dailyFive.length ? dailyFive : allChallenges;
    if (!list?.length) return;
    list.forEach((c) => {
      if (c.imageUrl) {
        try {
          (Image as any)?.prefetch?.(c.imageUrl);
        } catch {}
      }
    });
  }, [dailyFive, allChallenges]);

   const fetchChallenges = async () => {
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
              : "https://via.placeholder.com/600x400?text=ChallengeTies",
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
    : "https://via.placeholder.com/600x400?text=ChallengeTies",

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
  };


  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) fetchChallenges();
    });
    return () => {
      cancelled = true;
      task && (task.cancel?.());
    };
  }, [user, i18n.language]);

  const safeNavigate = useCallback(
    (path: string, why?: string) => {
      if (!isMounted || !hydrated) return;
      if (gate(path, why)) router.push(path as any);
    },
    [gate, router, isMounted, hydrated]
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

  const isPremiumDay =
    !welcomeState.completed &&
    welcomeState.currentDay >= 0 &&
    welcomeState.currentDay < WELCOME_TOTAL_DAYS &&
    WELCOME_REWARDS_UI[welcomeState.currentDay].type === "premium";

  try {
    setWelcomeLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const { state } = await claimWelcomeBonus(user.uid);

    // 🔁 mise à jour locale
    setWelcomeState(state);
    setWelcomeVisible(false);
    // 🛡️ On marque ce jour comme déjà traité, pour être sûr
    setWelcomeGuardDay(state.currentDay);

    // Refresh userData Firestore...
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setUserData(snap.data());
    }

    // ... puis ton toast premium si besoin
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
          pointerEvents={isTutorialActive ? "none" : "auto"}
          contentContainerStyle={[
            staticStyles.scrollContent,
            { paddingBottom: bottomContentPadding },
          ]}
          bounces={false}
          overScrollMode="never"
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

            <LinearGradient
              colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.2)"]}
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
                { paddingTop: insets.top + normalize(10) },
              ]}
            >
              <Image
                source={require("../../assets/images/GreatLogo1.png")}
                style={staticStyles.logo}
                resizeMode="contain"
                accessibilityLabel={t("logoChallengeTies")}
                transition={200}
              />

              <Text
                style={[staticStyles.heroTitle, dynamicStyles.heroTitle]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {t("defyYourLimits")}
              </Text>

              <Text
                style={[staticStyles.heroSubtitle, dynamicStyles.heroSubtitle]}
              >
                {t("joinVibrantCommunity")}
              </Text>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium
                    );
                  } catch {}
                  safeNavigate("/explore");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("launchAdventure")}
                accessibilityHint={t("discover", {
                  defaultValue: "Découvrir les défis",
                })}
                testID="cta-button"
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                onPressIn={() => {
                  ctaScale.value = withSpring(0.96, {
                    damping: 18,
                    stiffness: 220,
                  });
                }}
                onPressOut={() => {
                  ctaScale.value = withSpring(1, {
                    damping: 16,
                    stiffness: 180,
                  });
                }}
              >
                <Animated.View style={ctaAnimStyle}>
                  <LinearGradient
                    colors={[
                      currentTheme.colors.secondary,
                      currentTheme.colors.primary,
                    ]}
                    style={[staticStyles.ctaButton, dynamicStyles.ctaButton]}
                  >
                    <Text
                      style={[staticStyles.ctaText, dynamicStyles.ctaText]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t("launchAdventure")}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={normalize(20)}
                      style={dynamicStyles.ctaIcon}
                    />
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* WEEKLY TROPHIES */}
          <View style={staticStyles.headerCardWrap} accessibilityRole="summary">
            <WeeklyTrophiesCard />
          </View>

          {/* BONUS DU JOUR */}
          {canClaimDailyBonus && (
            <View
              style={staticStyles.dailyBonusWrapper}
              accessibilityElementsHidden={isTutorialActive}
              importantForAccessibility={
                isTutorialActive ? "no-hide-descendants" : "auto"
              }
            >
              <TouchableOpacity
                onPress={async () => {
                  if (!canClaimDailyBonus || dailyBonusLoading) return;
                  try {
                    await Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium
                    );
                  } catch {}
                  setDailyBonusVisible(true);
                }}
                activeOpacity={0.9}
                disabled={dailyBonusLoading}
                accessibilityRole="button"
                accessibilityLabel={t("dailyBonus.title", "Bonus du jour")}
                accessibilityHint={t(
                  "dailyBonus.hint",
                  "Ouvre une roue mystère pour gagner une récompense."
                )}
              >
                <LinearGradient
                  colors={
                    isDarkMode
                      ? ["#3B2F11", "#1F1308"]
                      : ["#F6A623", "#C47100"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    staticStyles.dailyBonusOuter,
                    dailyBonusLoading && { opacity: 0.7 },
                  ]}
                >
                  <BlurView
                    intensity={isDarkMode ? 45 : 35}
                    tint="dark"
                    style={staticStyles.dailyBonusBlur}
                  >
                    <View style={staticStyles.dailyBonusContentRow}>
                      <View style={staticStyles.dailyBonusTextCol}>
                        <View style={staticStyles.dailyBonusTag}>
                          <Ionicons
                            name="sparkles"
                            size={normalize(14)}
                            color="#FFEB3B"
                          />
                          <Text style={staticStyles.dailyBonusTagText}>
                            {t(
                              "dailyBonus.tag",
                              "EXCLU DU JOUR"
                            ).toUpperCase()}
                          </Text>
                        </View>

                        <Text
                          style={[
                            staticStyles.dailyBonusTitle,
                            !isDarkMode && { color: "#FFFDF5" },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          🎁 {t("dailyBonus.title", "Bonus du jour")}
                        </Text>

                        <Text
                          style={[
                            staticStyles.dailyBonusText,
                            !isDarkMode && {
                              color: "rgba(255,255,255,0.95)",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {dailyBonusLoading
                            ? t(
                                "dailyBonus.loading",
                                "Ouverture du coffre mystère..."
                              )
                            : t(
                                "dailyBonus.teaser",
                                "Touche pour découvrir ta récompense mystère."
                              )}
                        </Text>
                      </View>

                      <View style={staticStyles.dailyBonusIconCol}>
                        <LinearGradient
                          colors={
                            isDarkMode
                              ? ["#FFB800", "#FF6F00"]
                              : ["#FFCA28", "#FF8F00"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={staticStyles.dailyBonusIconCircleOuter}
                        >
                          <View
                            style={staticStyles.dailyBonusIconCircleInner}
                          >
                            <Ionicons
                              name="gift-outline"
                              size={normalize(26)}
                              color="#FFF8E1"
                            />
                          </View>
                        </LinearGradient>
                        <Text
                          style={[
                            staticStyles.dailyBonusPillText,
                            !isDarkMode && {
                              color: "#FFF8E1",
                              borderColor: "rgba(255,248,225,0.6)",
                            },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {t(
                            "dailyBonus.shortCta",
                            "1 clic, 1 surprise"
                          )}
                        </Text>
                      </View>
                    </View>
                  </BlurView>
                </LinearGradient>
              </TouchableOpacity>
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
                      ? "rgba(255,255,255,0.75)"
                      : "rgba(15,23,42,0.75)",
                  },
                ]}
              >
                {t("dailySelectedSubtitle", {
                  defaultValue:
                    "5 défis sélectionnés pour toi, renouvelés chaque jour.",
                })}
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
  source={{ uri: dailyFive[0].imageUrl }}
  style={stylesDaily.heroImage}
  contentFit="cover"
  transition={180}
  cachePolicy="memory-disk"
  priority="high"
  placeholder={BLURHASH}
  placeholderContentFit="cover"
  allowDownscaling
/>


                    <LinearGradient
                      colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)"]}
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
                      >
                        {dailyFive[0].title}
                      </Text>
                      <Text
                        style={stylesDaily.heroCat}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {dailyFive[0].category}
                      </Text>
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
  source={{ uri: item.imageUrl }}
  style={stylesDaily.miniImage}
  contentFit="cover"
  transition={140}
  cachePolicy="memory-disk"
  priority="high"
  placeholder={BLURHASH}
  placeholderContentFit="cover"
  allowDownscaling
/>


                        <LinearGradient
                          colors={[
                            "rgba(0,0,0,0.05)",
                            "rgba(0,0,0,0.7)",
                          ]}
                          style={stylesDaily.miniOverlay}
                          pointerEvents="none"
                        />
                        <Text
                          style={stylesDaily.miniTitle}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={stylesDaily.miniCat}
                          numberOfLines={1}
                          adjustsFontSizeToFit
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

          {/* INSPIRE-TOI */}
          <View style={staticStyles.discoverWrapper}>
            <View
              style={staticStyles.discoverSection}
              accessibilityElementsHidden={isTutorialActive}
              importantForAccessibility={
                isTutorialActive ? "no-hide-descendants" : "auto"
              }
            >
              <View style={staticStyles.discoverTitleContainer}>
                <Text
                  style={[
                    staticStyles.sectionTitle,
                    dynamicStyles.sectionTitle,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t("getInspired")}
                </Text>
              </View>
              <View style={staticStyles.discoverGrid}>
                <View style={staticStyles.discoverRow}>
                  <Animated.View entering={FadeInUp.delay(24)}>
                    <TouchableOpacity
                      style={[
                        staticStyles.discoverCard,
                        dynamicStyles.discoverCard,
                      ]}
                      onPress={() => safeNavigate("/tips")}
                      accessibilityLabel={t("tipsAndTricks")}
                      testID="tips-card"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="bulb-outline"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          staticStyles.discoverCardText,
                          dynamicStyles.discoverCardText,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {t("tipsAndTricks")}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View entering={FadeInUp.delay(20)}>
                    <TouchableOpacity
                      style={[
                        staticStyles.discoverCard,
                        dynamicStyles.discoverCard,
                      ]}
                      onPress={() => safeNavigate("/leaderboard")}
                      accessibilityLabel={t("leaderboardTitle")}
                      testID="leaderboard-card"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="trophy-outline"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          staticStyles.discoverCardText,
                          dynamicStyles.discoverCardText,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {t("leaderboardTitle")}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
                <View style={staticStyles.discoverRow}>
                  <Animated.View entering={FadeInUp.delay(28)}>
                    <TouchableOpacity
                      style={[
                        staticStyles.discoverCard,
                        dynamicStyles.discoverCard,
                      ]}
                      onPress={() => safeNavigate("/new-features")}
                      accessibilityLabel={t("whatsNew")}
                      testID="new-features-card"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="sparkles"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          staticStyles.discoverCardText,
                          dynamicStyles.discoverCardText,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {t("whatsNew")}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View entering={FadeInUp.delay(36)}>
                    <TouchableOpacity
                      style={[
                        staticStyles.discoverCard,
                        dynamicStyles.discoverCard,
                      ]}
                      onPress={() => safeNavigate("/Questions")}
                      accessibilityLabel={t("questions.title")}
                      testID="faq-card"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          staticStyles.discoverCardText,
                          dynamicStyles.discoverCardText,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {t("faqShort", { defaultValue: "FAQ" })}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
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
            {console.log(
              "[ADS][HomeScreen] Rendering BannerSlot with adHeight:",
              adHeight
            )}
            <View
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

                <Modal
          visible={showPioneerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPioneerModal(false)}
        >
          <View style={staticStyles.blurView}>
            <View style={staticStyles.modalContainer}>
              <Ionicons
                name="sparkles"
                size={normalize(36)}
                color="#FFB800"
              />
              <Text
                style={staticStyles.modalTitle}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {t("pioneerModal.title")}
              </Text>

              <Text style={staticStyles.modalDescription}>
                <Trans
                  i18nKey="pioneerModal.description"
                  values={{ first: 1000, trophies: 50 }}
                  components={{
                    b: <Text style={{ fontWeight: "700" }} />,
                  }}
                />
              </Text>

              <View style={staticStyles.buttonContainer}>
                <TouchableOpacity
                  onPress={() => setShowPioneerModal(false)}
                  style={staticStyles.actionButton}
                  accessibilityLabel={t("pioneerModal.closeA11y")}
                >
                  <Text style={staticStyles.actionButtonText}>
                    {t("pioneerModal.cta")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                  style={[
                    staticStyles.actionButton,
                    { marginLeft: normalize(10) },
                  ]}
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
  gradientContainer: {
    flex: 1,
    paddingBottom: normalize(10),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: normalize(100),
  },
  bannerContainer: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "transparent",
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
  logo: {
    width: normalize(200),
    height: normalize(140),
    marginBottom: SPACING / 8,
  },
  carouselWrap: {
    position: "relative",
    alignItems: "center",
  },
  edgeFadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: normalize(30),
    zIndex: 10,
  },
  edgeFadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: normalize(30),
    zIndex: 10,
  },
  heroTitle: {
    fontSize: normalize(32),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING / 2,
    lineHeight: normalize(36),
  },
  heroSubtitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING,
    lineHeight: normalize(20),
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(5),
    elevation: 5,
  },
  ctaText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginRight: SPACING / 2,
    lineHeight: normalize(22),
  },
  section: {
    paddingTop: SPACING * 1.2,
    paddingBottom: SPACING,
    paddingHorizontal: SPACING,
    marginBottom: SPACING * 0.5,
    overflow: "visible",
  },
  sectionTitle: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    lineHeight: normalize(28),
  },
  dailyBonusCard: {
    borderRadius: normalize(18),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(14),
    backgroundColor: "rgba(255,213,79,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,213,79,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.18,
    shadowRadius: normalize(5),
    elevation: 3,
  },
  dailyBonusWrapper: {
    paddingHorizontal: SPACING,
    marginTop: normalize(4),
    marginBottom: normalize(10),
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
  miniChallengeWrapper: {
    paddingHorizontal: SPACING,
    marginBottom: normalize(10),
  },
  miniChallengeCard: {
    borderRadius: normalize(18),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(14),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  miniChallengeTitle: {
    fontSize: normalize(15),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    marginBottom: normalize(4),
  },
  miniChallengeDescription: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginBottom: normalize(10),
  },
  miniChallengeButton: {
    alignSelf: "flex-start",
    borderRadius: normalize(999),
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(8),
    backgroundColor: "#FFD54F",
  },
  miniChallengeButtonText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    color: "#1A1A1A",
  },
  challengeCard: {
    borderRadius: normalize(18),
    overflow: "hidden",
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(8),
    elevation: 8,
    borderWidth: 2,
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
  headerCardWrap: {
    paddingHorizontal: SPACING,
    marginTop: normalize(8),
    marginBottom: normalize(6),
  },
  challengeTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  challengeDay: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
  challengeCategory: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: normalize(5),
    marginBottom: normalize(1),
    zIndex: 10,
    elevation: 10,
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
  spacer: {
    height: normalize(5),
  },
  discoverSection: {
    paddingHorizontal: SPACING,
    paddingTop: SPACING * 1.2,
    paddingBottom: SPACING * 1.4,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  discoverTitleContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: normalize(30),
  },
  discoverGrid: {
    width: "90%",
    flexDirection: "column",
    alignItems: "center",
    marginTop: normalize(10),
  },
  discoverRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: normalize(15),
    marginBottom: normalize(15),
    width: "100%",
    paddingHorizontal: SPACING,
  },
  discoverSingleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 0,
  },
  discoverSingleCardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  discoverCard: {
    borderWidth: 1,
    borderRadius: normalize(18),
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 1.1,
    alignItems: "center",
    justifyContent: "center",
    width: normalize(150),
    height: normalize(115),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.18,
    shadowRadius: normalize(6),
    elevation: 4,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    zIndex: 5,
    position: "relative",
  },
  discoverWrapper: {
    width: "100%",
    alignItems: "center",
    marginTop: 0,
  },
  discoverCardText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING / 2,
    textAlign: "center",
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  actionButton: {
    backgroundColor: "#FFB800",
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(25),
    alignSelf: "center",
  },
  actionButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
  },
  skipButton: {
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(20),
  },
  skipButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    color: "#666",
  },
  nextButton: {
    position: "absolute",
    bottom: SPACING,
    right: SPACING,
  },
});

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  challengeCard: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderColor: "rgba(255,255,255,0.18)",
  },
  challengeTitle: {
    color: currentTheme.colors.textPrimary,
  },
  challengeDay: {
    color: currentTheme.colors.primary,
  },
  challengeCategory: {
    color: isDarkMode ? "#CCCCCC" : "#999999",
  },
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
  discoverCard: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderColor: isDarkMode
      ? currentTheme.colors.secondary
      : currentTheme.colors.primary,
  },
  discoverCardText: {
    color: currentTheme.colors.secondary,
  },
});

const CONTENT_W = Math.min(SCREEN_WIDTH - SPACING * 2, normalize(420));
const IS_SMALL = SCREEN_WIDTH < 360;

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
    height: normalize(220),
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
    zIndex: 5,
    elevation: 5,
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING,
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  heroTextZone: {
    position: "absolute",
    bottom: SPACING,
    left: SPACING,
    right: SPACING,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: normalize(18),
    lineHeight: normalize(22),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroCat: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.9)",
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
    height: normalize(120),
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
    fontSize: normalize(13),
    lineHeight: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  miniCat: {
    position: "absolute",
    left: SPACING * 0.8,
    right: SPACING * 0.8,
    bottom: IS_SMALL ? SPACING * 0.7 : SPACING * 0.6,
    color: "rgba(255,255,255,0.9)",
    fontSize: normalize(IS_SMALL ? 10 : 11),
    lineHeight: normalize(IS_SMALL ? 12 : 13),
    fontFamily: "Comfortaa_400Regular",
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
    top: 0,
  },
  footHint: {
    marginTop: 2,
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
  },
});
