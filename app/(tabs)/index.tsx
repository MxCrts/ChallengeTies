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
import { useRouter } from "expo-router";
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
import { useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import useGateForGuest from "@/hooks/useGateForGuest";
import RequireAuthModal from "@/components/RequireAuthModal";
import { Modal } from "react-native";
import { findNodeHandle, UIManager } from "react-native";
import SpotlightOverlay from "../../components/SpotlightOverlay";
import { TUTORIAL_STEPS } from "../../components/TutorialSteps";
import * as Haptics from "expo-haptics";
import WeeklyTrophiesCard from "@/components/WeeklyTrophiesCard";
import DailyBonusModal from "../../components/DailyBonusModal";
import {
  canClaimDailyBonusFromUserData,
  claimDailyBonus,
  DailyRewardResult,
} from "../../helpers/dailyBonusService";

type Deg = `${number}deg`;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const useReliableMeasure = () => {
  const [orientationKey, setOrientationKey] = useState(0);

  useEffect(() => {
    const sub = Dimensions.addEventListener?.("change", () => {
      setOrientationKey((k) => k + 1);
    });
    return () => sub?.remove?.();
  }, []);

  const measureRef = useCallback((
    ref: React.RefObject<View>,
    key: "exploreCta" | "daily" | "discover",
    setRects: React.Dispatch<React.SetStateAction<any>>,
    tryCount = 0
  ) => {
    const node = ref.current && findNodeHandle(ref.current);
    if (!node) return;

    // mesure après une frame (layout fini)
    requestAnimationFrame(() => {
      UIManager.measureInWindow(node, (x, y, w, h) => {
        const valid = w > 1 && h > 1;
        if (valid) {
          setRects((prev: any) => ({
            ...prev,
            [key]: { x, y, width: w, height: h },
          }));
        } else if (tryCount < 3) {
          // retry si l’image/typo n’est pas encore rendue
          setTimeout(() => measureRef(ref, key, setRects, tryCount + 1), 60);
        }
      });
    });
  }, []);

  return { orientationKey, measureRef };
};

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

interface ChallengeCardProps {
  item: Challenge;
  index: number;
  safeNavigate: (path: string) => void;
  currentTheme: Theme;
  dynamicStyles: any;
  t: (key: string, options?: any) => string;
}


// --- Daily picks helpers ---
const DAILY_PICKS_KEY = "daily_picks_v1";

const todayKey = () => {
  const d = new Date();
  // YYYY-MM-DD en local (peu importe le fuseau, on veut "jour device")
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
    a = (a + 0x6D2B79F5) | 0;
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


export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
const [userData, setUserData] = useState<any | null>(null);
const [dailyBonusVisible, setDailyBonusVisible] = useState(false);
const [hasClaimedDailyBonus, setHasClaimedDailyBonus] = useState(false);
const [dailyBonusLoading, setDailyBonusLoading] = useState(false);
const [dailyReward, setDailyReward] = useState<DailyRewardResult | null>(null); // ⭐ NEW
  const { theme } = useTheme();
  const { modalVisible, gate, closeGate } = useGateForGuest();
  const [layoutKey, setLayoutKey] = useState(0);
  const { setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [adHeight, setAdHeight] = useState(0);
  const exploreCtaRef = useRef<View | null>(null);
 const dailyRef = useRef<View | null>(null);
 const discoverRef = useRef<View | null>(null);
 const [spotRects, setSpotRects] = useState({
   exploreCta: null as null | { x: number; y: number; width: number; height: number },
   daily: null as null | { x: number; y: number; width: number; height: number },
   discover: null as null | { x: number; y: number; width: number; height: number },
 });
 const { orientationKey, measureRef } = useReliableMeasure();

  const handleAdHeight = useCallback((h: number) => setAdHeight(h), []);
  const HERO_BASE_HEIGHT = normalize(405);
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;
const { showBanners } = useAdsVisibility();
const params = useLocalSearchParams<{ startTutorial?: string }>();
const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
const [dailyFive, setDailyFive] = useState<Challenge[]>([]);

const [showPioneerModal, setShowPioneerModal] = useState(false); 
  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();
const heroVideoRef = useRef<Video | null>(null);
// Micro-anim du CTA (premium tactile)
const ctaScale = useSharedValue(1);
const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));
const [isScreenFocused, setIsScreenFocused] = useState(true);
const [videoReady, setVideoReady] = useState(false);
const heroShouldPlay = useMemo(
  () => isScreenFocused && !isTutorialActive && videoReady,
  [isScreenFocused, isTutorialActive, videoReady]
);
const requiresAuth = (path: string) =>
  path.startsWith("/leaderboard") ||
  path.startsWith("/new-features") ||
  path.startsWith("/challenge-details");
const bottomContentPadding =
  (showBanners && !isTutorialActive ? adHeight : 0) +
  tabBarHeight +
  insets.bottom +
  SPACING * 2;

  const scrollRef = useRef<ScrollView | null>(null);

const sectionYRef = useRef<{exploreCta: number; daily: number; discover: number}>({
  exploreCta: 0,
  daily: 0,
  discover: 0,
});

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

    const canClaimDailyBonus =
  !!userData &&
  !hasClaimedDailyBonus &&
  canClaimDailyBonusFromUserData(userData);

    useEffect(() => {
  let ran = false;

  const maybeStartTutorial = async () => {
    if (ran) return;
    ran = true;

    // 1) param direct → priorité
    if (params?.startTutorial === "1") {
      startTutorial?.();
      setTutorialStep?.(0);
      return;
    }

    // 2) sinon flag persistant
    const flag = await AsyncStorage.getItem("pendingTutorial");
    if (flag === "1") {
      await AsyncStorage.removeItem("pendingTutorial"); // 🔥 one-shot
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
          setUserData(data); // 🔥 on garde tout le doc user ici

          const userLanguage = data.language || i18n.language;
          i18n.changeLanguage(userLanguage);
          setLanguage(userLanguage);

          if (data.locationEnabled) {
            fetchAndSaveUserLocation().catch(() => {});
          }
        } else {
          setUserData(null);
        }
      })
      .catch(() => {
        // en cas d'erreur, on ne casse rien, on laisse userData tel quel
      });
  } else {
    setUserData(null);
  }
}, [user, setLanguage, i18n.language]);

  useEffect(() => {
    const last = userData?.dailyBonus?.lastClaimDate as string | undefined;
    // Si le doc user vient d'un nouveau jour => on réactive le bonus localement
    if (last && last !== todayKey()) {
      setHasClaimedDailyBonus(false);
      setDailyReward(null);
    }
  }, [userData?.dailyBonus?.lastClaimDate]);


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
  if (!isTutorialActive) return;

  const cfg = TUTORIAL_STEPS[tutorialStep];
  if (!cfg) return;

  // 1) scroller vers la zone cible si spotlight demandé
  const key = cfg.spotlight as "exploreCta" | "daily" | "discover" | null;
  if (key && scrollRef.current) {
    // on met la cible ~sous le haut de l'écran (laisse de la place au panneau bas)
    const padTop = normalize(80);
    const baseY = Math.max(0, sectionYRef.current[key] - padTop);
    scrollRef.current.scrollTo({ y: baseY, animated: true });
  }

  // 2) re-mesure APRÈS le scroll (coords écran exactes)
  const t = setTimeout(() => {
    if (cfg.spotlight === "exploreCta") measureRef(exploreCtaRef, "exploreCta", setSpotRects);
    if (cfg.spotlight === "daily")      measureRef(dailyRef,      "daily",      setSpotRects);
    if (cfg.spotlight === "discover")   measureRef(discoverRef,   "discover",   setSpotRects);
  }, 180); // léger délai pour que le scroll finisse

  return () => clearTimeout(t);
}, [isTutorialActive, tutorialStep, orientationKey, measureRef]);


  useEffect(() => {
    const checkPioneerFlag = async () => {
      try {
        const flag = await AsyncStorage.getItem("pioneerJustGranted");
        if (flag === "1") {
          setShowPioneerModal(true);
          await AsyncStorage.removeItem("pioneerJustGranted"); // one-shot
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
  setLoading(true);
  try {
    // 1) Lire cache global (toutes les challenges)
    const cachedChallenges = await AsyncStorage.getItem("challenges_cache");
    let base: Challenge[] = [];
    if (cachedChallenges) {
      base = JSON.parse(cachedChallenges);
      setAllChallenges(base);
    }

    // 2) Fetch Firestore (approved)
    const challengesQuery = query(
      collection(db, "challenges"),
      where("approved", "==", true)
    );
    const querySnapshot = await getDocs(challengesQuery);
    const fetched: Challenge[] = querySnapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: data?.chatId
          ? t(`challenges.${data.chatId}.title`)
          : t("mysteriousChallenge"),
        description: data?.chatId
          ? t(`challenges.${data.chatId}.description`)
          : t("noDescriptionAvailable"),
        category: data?.category ? t(`categories.${data.category}`) : t("miscellaneous"),
        imageUrl: data?.imageUrl || "https://via.placeholder.com/300",
        day: data?.day,
        approved: data?.approved,
      };
    });

    // 3) Déterminer les 5 du jour de manière déterministe
    const key = todayKey();
    const seedStr = `${key}#${user?.uid ?? "global"}`;
    const seed = hashStringToInt(seedStr);

    // Optionnel: trie pour que les plus riches en images soient priorisés
    const sorted = fetched.slice().sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0));
    const shuffled = seededShuffle(sorted, seed);

    const picks = shuffled.slice(0, 5);
    // Batch state updates
    setAllChallenges(fetched);
    setDailyFive(picks);
    // Cache en parallèle
    Promise.allSettled([
      AsyncStorage.setItem("challenges_cache", JSON.stringify(fetched)),
      AsyncStorage.setItem(DAILY_PICKS_KEY, JSON.stringify({ date: key, ids: picks.map((p) => p.id) })),
    ]).catch(() => {});
  } catch (error) {
    // Fallback: si on a du cache + daily cache et que Firestore plante
    const cachedChallenges = await AsyncStorage.getItem("challenges_cache");
    const cachedDaily = await AsyncStorage.getItem(DAILY_PICKS_KEY);
    if (cachedChallenges) {
      const base: Challenge[] = JSON.parse(cachedChallenges);
      setAllChallenges(base);
      if (cachedDaily) {
        const parsed = JSON.parse(cachedDaily);
        if (parsed?.date === todayKey() && Array.isArray(parsed.ids)) {
          const picks = parsed.ids
            .map((id: string) => base.find((c) => c.id === id))
            .filter(Boolean) as Challenge[];
          setDailyFive(picks.slice(0, 5));
        } else {
          // sinon recalcule localement
          const seed = hashStringToInt(`${todayKey()}#${user?.uid ?? "global"}`);
          const shuffled = seededShuffle(base, seed);
          setDailyFive(shuffled.slice(0, 5));
        }
      }
    } else {
      setAllChallenges([]);
      setDailyFive([]);
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

  const safeNavigate = useCallback((path: string) => {
  if (!isMounted) return;

  if (requiresAuth(path)) {
    // gate() => true si connecté, sinon ouvre la modale et retourne false
    if (gate()) router.push(path);
    return;
  }

  router.push(path); // routes libres (explore, tips, etc.)
}, [gate, router, isMounted]);

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

      // Flag local : on considère qu'il est pris pour aujourd'hui
      setHasClaimedDailyBonus(true);
      setDailyReward(reward);

      // Patch userData pour UI instantanée
      setUserData((prev: any) => {
        if (!prev) return prev;
        const next: any = { ...prev };

        // 1) Date de claim
        next.dailyBonus = {
          ...(prev.dailyBonus || {}),
          lastClaimDate: todayKey(),
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
        style={[staticStyles.gradientContainer]}
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
  removeClippedSubviews
  scrollEventThrottle={16}
>

          {/* SECTION HERO */}
<Animated.View
  collapsable={false}
  renderToHardwareTextureAndroid
  needsOffscreenAlphaCompositing
  style={[
    staticStyles.heroSection,
    { height: HERO_TOTAL_HEIGHT }, // <= hauteur dynamique
    fadeStyle,
  ]}
>
  <Video
    ref={heroVideoRef}
    style={[
      staticStyles.backgroundVideo,
      {
        top: -insets.top,                          // pousse la vidéo sous la status bar
        height: HERO_TOTAL_HEIGHT,                 // couvre toute la hero
      },
    ]}
    resizeMode={ResizeMode.COVER}
    source={require("../../assets/videos/Hero-Bgopti.mp4")}
    onReadyForDisplay={() => setVideoReady(true)}
    shouldPlay={heroShouldPlay}
    isLooping
    isMuted
    onError={() => {
      // Fallback doux : on stoppe la lecture si erreur (overlay + logo gardent un rendu premium)
      setVideoReady(false);
    }}
    onPlaybackStatusUpdate={async (status: any) => {
      // Robustesse Android : parfois la vidéo se met en pause toute seule
      if (status?.isLoaded && heroShouldPlay && !status.isPlaying) {
        try { await heroVideoRef.current?.playAsync?.(); } catch {}
      }
    }}
  />

  <LinearGradient
    colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.2)"]}
    style={[
      staticStyles.heroOverlay,
      {
        top: -insets.top,                          // overlay suit la vidéo
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
    // (transition OK à garder)
    transition={200}
  />

  <Text
    style={[staticStyles.heroTitle, dynamicStyles.heroTitle]}
    numberOfLines={2}
    adjustsFontSizeToFit
  >
    {t("defyYourLimits")}
  </Text>

  <Text style={[staticStyles.heroSubtitle, dynamicStyles.heroSubtitle]}>
    {t("joinVibrantCommunity")}
  </Text>

  <TouchableOpacity
  ref={exploreCtaRef}
  onLayout={e => {
    sectionYRef.current.exploreCta = e.nativeEvent.layout.y;
    measureRef(exploreCtaRef, "exploreCta", setSpotRects);
  }}
 onPress={async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    safeNavigate("/explore");
  }}
  accessibilityRole="button"
  accessibilityLabel={t("launchAdventure")}
  accessibilityHint={t("discover", { defaultValue: "Découvrir les défis" })}
  testID="cta-button"
  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
  onPressIn={() => { ctaScale.value = withSpring(0.96, { damping: 18, stiffness: 220 }); }}
  onPressOut={() => { ctaScale.value = withSpring(1, { damping: 16, stiffness: 180 }); }}
>
    <Animated.View style={ctaAnimStyle}>
      <LinearGradient
      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
      style={[staticStyles.ctaButton, dynamicStyles.ctaButton]}
    >
      <Text
        style={[staticStyles.ctaText, dynamicStyles.ctaText]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {t("launchAdventure")}
      </Text>
      <Ionicons name="arrow-forward" size={normalize(20)} style={dynamicStyles.ctaIcon} />
    </LinearGradient>
    </Animated.View>
  </TouchableOpacity>
</View>


          </Animated.View>

          {/* WEEKLY TROPHIES (banque hebdo) */}
          <View
            style={staticStyles.headerCardWrap}
            accessibilityRole="summary"
            // Pas de pointerEvents spécial ici : la carte gère ses propres touchables
          >
            <WeeklyTrophiesCard />
          </View>

                   {/* BONUS DU JOUR */}
{canClaimDailyBonus && (
  <View
    style={staticStyles.dailyBonusWrapper}
    accessibilityElementsHidden={isTutorialActive}
    importantForAccessibility={isTutorialActive ? "no-hide-descendants" : "auto"}
  >
    <TouchableOpacity
      onPress={async () => {
        if (!canClaimDailyBonus || dailyBonusLoading) return;
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
        setDailyBonusVisible(true); // 👉 on ouvre le modal, la roue gère le claim
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
            ? ["#3B2F11", "#1F1308"] // or chaud sombre
            : ["#F6A623", "#C47100"] // 🔥 plus contrasté, plus lisible
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
          // 👉 "dark" même en light pour bien faire ressortir le texte
          tint="dark"
          style={staticStyles.dailyBonusBlur}
        >
          <View style={staticStyles.dailyBonusContentRow}>
            {/* Colonne texte */}
            <View style={staticStyles.dailyBonusTextCol}>
              <View style={staticStyles.dailyBonusTag}>
                <Ionicons
                  name="sparkles"
                  size={normalize(14)}
                  color="#FFEB3B"
                />
                <Text style={staticStyles.dailyBonusTagText}>
                  {t("dailyBonus.tag", "EXCLU DU JOUR").toUpperCase()}
                </Text>
              </View>

              <Text
                style={[
                  staticStyles.dailyBonusTitle,
                  !isDarkMode && { color: "#FFFDF5" }, // boost lisibilité en clair
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                🎁 {t("dailyBonus.title", "Bonus du jour")}
              </Text>

              <Text
                style={[
                  staticStyles.dailyBonusText,
                  !isDarkMode && { color: "rgba(255,255,255,0.95)" },
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

            {/* Colonne icône cadeau */}
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
                <View style={staticStyles.dailyBonusIconCircleInner}>
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
    !isDarkMode && { color: "#FFF8E1", borderColor: "rgba(255,248,225,0.6)" },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {t("dailyBonus.shortCta", "1 clic, 1 surprise")}
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
 <View
  collapsable={false}
  ref={dailyRef}
  onLayout={e => {
    sectionYRef.current.daily = e.nativeEvent.layout.y;
    measureRef(dailyRef, "daily", setSpotRects);
  }}
  style={stylesDaily.titleRow}
>
  <Text
    style={[staticStyles.sectionTitle, dynamicStyles.sectionTitle]}
    numberOfLines={1}
    adjustsFontSizeToFit
  >
    {t("dailyChallenges", { defaultValue: "Défis du jour" })}
  </Text>
  <Text style={stylesDaily.subtitle}>
    {t("dailyChallengesSubtitle", {
      defaultValue: "5 défis sélectionnés pour toi, renouvelés chaque jour.",
    })}
  </Text>
</View>



  {loading ? (
    <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
  ) : dailyFive.length > 0 ? (
    <View style={stylesDaily.wrap}>
      {/* Hero card */}
      <Animated.View entering={FadeInUp} style={stylesDaily.heroCard} renderToHardwareTextureAndroid>
        <TouchableOpacity
        accessibilityRole="imagebutton"
          activeOpacity={0.95}
          onPress={async () => {
     try { await Haptics.selectionAsync(); } catch {}
     safeNavigate(
              `/challenge-details/${dailyFive[0].id}?title=${encodeURIComponent(
                dailyFive[0].title
              )}&category=${encodeURIComponent(dailyFive[0].category)}&description=${encodeURIComponent(
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
            recyclingKey={dailyFive[0].id}
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
     try { await Haptics.selectionAsync(); } catch {}
     safeNavigate(
                  `/challenge-details/${item.id}?title=${encodeURIComponent(
                    item.title
                  )}&category=${encodeURIComponent(item.category)}&description=${encodeURIComponent(
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
                recyclingKey={item.id}
                placeholder={BLURHASH}
                placeholderContentFit="cover"
                allowDownscaling
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
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

      {/* Hint “ça change demain” */}
      <Text style={stylesDaily.footHint}>
        {t("refreshDaily", { defaultValue: "Nouveaux défis dès demain ✨" })}
      </Text>
    </View>
  ) : (
    <Animated.View entering={FadeInUp} style={staticStyles.noChallengesContainer}>
      <Ionicons name="sad-outline" size={normalize(40)} color={currentTheme.colors.textSecondary} />
      <Text style={[staticStyles.noChallengesText, dynamicStyles.noChallengesText]}>
        {t("noChallengesAvailable")}
      </Text>
      <Text style={[staticStyles.noChallengesSubtext, dynamicStyles.noChallengesSubtext]}>
        {t("challengesComingSoon")}
      </Text>
    </Animated.View>
  )}
</View>

          {/* INSPIRE-TOI */}
          <View style={staticStyles.discoverWrapper}>
            <View
    collapsable={false}
    ref={discoverRef}
    onLayout={e => {
      sectionYRef.current.discover = e.nativeEvent.layout.y;
      measureRef(discoverRef, "discover", setSpotRects);
    }}
    style={staticStyles.discoverSection}
    accessibilityElementsHidden={isTutorialActive}
    importantForAccessibility={isTutorialActive ? "no-hide-descendants" : "auto"}
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
  {/* New Features */}
  <Animated.View entering={FadeInUp.delay(28)}>
    <TouchableOpacity
      style={[staticStyles.discoverCard, dynamicStyles.discoverCard]}
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
        style={[staticStyles.discoverCardText, dynamicStyles.discoverCardText]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {t("whatsNew")}
      </Text>
    </TouchableOpacity>
  </Animated.View>

  {/* FAQ */}
  <Animated.View entering={FadeInUp.delay(36)}>
    <TouchableOpacity
      style={[staticStyles.discoverCard, dynamicStyles.discoverCard]}
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
        style={[staticStyles.discoverCardText, dynamicStyles.discoverCardText]}
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

        {showBanners && !isTutorialActive && adHeight > 0 && (
  <View
    pointerEvents="none"
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: tabBarHeight + insets.bottom + adHeight + 6, // +6 = paddingBottom du conteneur
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      zIndex: 9999,
    }}
  />
)}
{showBanners && !isTutorialActive && (
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
)}

        {isTutorialActive && (() => {
   const cfg = TUTORIAL_STEPS[tutorialStep];
   const target =
     cfg?.spotlight === "exploreCta" ? spotRects.exploreCta :
     cfg?.spotlight === "daily" ? spotRects.daily :
     cfg?.spotlight === "discover" ? spotRects.discover :
     null;

   return (
     <>
       {/* Spotlight (tap pour avancer si spotlight actif) */}
       {cfg?.spotlight ? (
  <SpotlightOverlay
    target={target || undefined}
    onPress={() =>
      setTutorialStep(Math.min(tutorialStep + 1, TUTORIAL_STEPS.length - 1))
    }
    dimOpacity={0.85}     // moins sombre, meilleure lisibilité
    radius={14}
    strokeWidth={2}
    padding={
      target
        ? Math.max(8, Math.min(14, Math.round(Math.min(target.width, target.height) * 0.08)))
        : 10
    }
  />
) : (
  <BlurView intensity={50} style={staticStyles.blurView} />
)}

       {/* Pane bas (titre/desc/boutons) */}
       <TutorialModal
         step={tutorialStep}
         onNext={() => setTutorialStep(tutorialStep + 1)}
         onStart={() => { startTutorial?.(); setTutorialStep(1); }}
         onSkip={skipTutorial}
         onFinish={skipTutorial}
       />
     </>
   );
 })()}
 <DailyBonusModal
  visible={dailyBonusVisible}
  onClose={handleCloseDailyModal}
  onClaim={handleClaimDailyBonus}
  reward={dailyReward}
  loading={dailyBonusLoading}
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
              <Ionicons name="sparkles" size={normalize(36)} color="#FFB800" />
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
           components={{ b: <Text style={{ fontWeight: "700" }} /> }}
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
    padding: normalize(1.5), // léger bord doré via le gradient parent
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
    fontFamily: "Comfortaa_500Medium",
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
  backgroundColor: "rgba(0, 0, 0, 0.12)", // discret en dark, léger contraste en light
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
  backgroundColor: "rgba(255, 255, 255, 0.02)", // le vrai fond vient du thème via dynamicStyles
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
  justifyContent: "center",     // ⬅️ was "space-between"
  alignItems: "center",         // ⬅️ ensure vertical centering too
  width: "100%",
},
  actionButton: {
  backgroundColor: "#FFB800",
  paddingVertical: normalize(10),
  paddingHorizontal: normalize(20),
  borderRadius: normalize(25),
  alignSelf: "center",          // ⬅️ keeps it centered even if container changes later
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
    zIndex: 1,          // contenu sous le titre
  },
subtitle: {
  marginTop: normalize(2),
  fontSize: normalize(12),
  fontFamily: "Comfortaa_400Regular",
  opacity: 0.8,
  color: "rgba(255,255,255,0.75)",
  textAlign: "center",
},
  heroCard: {
    width: CONTENT_W,                 // ← avant: 380
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
    zIndex: 5,          // ↑ au-dessus des cartes
    elevation: 5,       // Android: indispensable pour dépasser l'elevation des cartes
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING, // espace sous le titre
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
    width: CONTENT_W,                 // ← avant: 380
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  miniCard: {
    width: (CONTENT_W - SPACING) / 2, // ← calc dynamique
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
  bottom: IS_SMALL ? SPACING * 1.8 : SPACING * 1.6, // ↑ un peu plus d’air
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
  // avant: bottom: SPACING * 0.4,
  bottom: IS_SMALL ? SPACING * 0.7 : SPACING * 0.6, // ↓ légèrement
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
    color: "rgba(255,255,255,0.6)",
  },
});

