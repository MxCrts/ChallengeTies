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
  NativeSyntheticEvent,
  NativeScrollEvent,
  PixelRatio,
  Platform,
} from "react-native";
import  {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import type { ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where,  } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import type {TextStyle } from "react-native";
import  {
  useSharedValue,
  withTiming,
  FadeInUp,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation, Trans } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { fetchAndSaveUserLocation } from "../../services/locationService";
import { doc, getDoc } from "firebase/firestore";
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

type Deg = `${number}deg`;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  const normalizedSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

const ITEM_WIDTH = Math.min(SCREEN_WIDTH * 0.85, normalize(400));
const ITEM_HEIGHT = Math.min(SCREEN_HEIGHT * 0.32, normalize(240));
const CARD_MARGIN = normalize(6);
const BANNER_HEIGHT = normalize(50);

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

const ChallengeCard = React.memo<ChallengeCardProps>(function ChallengeCard({
  item,
  index,
  safeNavigate,
  currentTheme,
  dynamicStyles,
  t,
}) {
  const pressed = useSharedValue<number>(0);

  const pressStyle = useAnimatedStyle<ViewStyle>(() => {
  const scale = pressed.value ? 0.98 : 1;
  const rx = interpolate(pressed.value, [0, 1], [0, 6]);   // deg
  const ry = interpolate(pressed.value, [0, 1], [0, -6]);  // deg

  return {
    transform: [
      { perspective: 900 },
      { scale },
      { rotateX: `${rx}deg` as Deg },
      { rotateY: `${ry}deg` as Deg },
    ] as ViewStyle["transform"],
  };
});


  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80)}
      style={[staticStyles.challengeCard, dynamicStyles.challengeCard, pressStyle]}
    >
      <TouchableOpacity
        activeOpacity={0.96}
        onPressIn={() => (pressed.value = withTiming(1, { duration: 100 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 140 }))}
        onPress={() =>
          safeNavigate(
            `/challenge-details/${item.id}?title=${encodeURIComponent(item.title)}&category=${encodeURIComponent(
              item.category
            )}&description=${encodeURIComponent(item.description)}`
          )
        }
        accessibilityLabel={`${t("viewChallengeDetails")} ${item.title}`}
        testID={`challenge-card-${index}`}
      >
        {/* image + overlay inchangés */}
        <Image
          source={{ uri: item.imageUrl }}
          style={staticStyles.challengeImage}
          cachePolicy="memory-disk"
          priority="high"
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)"]}
          style={staticStyles.overlay}
        >
          <Text style={[staticStyles.challengeTitle, dynamicStyles.challengeTitle]} numberOfLines={2} accessibilityRole="header">
            {item.title}
          </Text>
          {item.day !== undefined && (
            <Text style={[staticStyles.challengeDay, dynamicStyles.challengeDay]}>
              {t("day")} {item.day}
            </Text>
          )}
          <Text style={[staticStyles.challengeCategory, dynamicStyles.challengeCategory]}>
            {item.category}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();
  const { modalVisible, gate, closeGate } = useGateForGuest();
const scrollX = useSharedValue(0);
  const [layoutKey, setLayoutKey] = useState(0);
  const { setLanguage } = useLanguage();
  const [showTutorial, setShowTutorial] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();            // hauteur réelle de la tabbar
const bannerHeight = BANNER_HEIGHT;                      // ta constante
const bannerLift = tabBarHeight + insets.bottom + normalize(8);
  const HERO_BASE_HEIGHT = normalize(405);
  const HERO_TOTAL_HEIGHT = HERO_BASE_HEIGHT + insets.top;
const { showBanners } = useAdsVisibility();
 const bottomPadding = showBanners ? BANNER_HEIGHT * 2+ SPACING * 2 : SPACING * 2;
const params = useLocalSearchParams<{ startTutorial?: string }>();
const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
const [dailyFive, setDailyFive] = useState<Challenge[]>([]);
const npa = (globalThis as any).__NPA__ === true;
const [showPioneerModal, setShowPioneerModal] = useState(false); 
  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();
const heroVideoRef = useRef<Video | null>(null);
const [videoReady, setVideoReady] = useState(false);
const requiresAuth = (path: string) =>
  path.startsWith("/leaderboard") ||
  path.startsWith("/new-features") ||
  path.startsWith("/challenge-details");


  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

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
            const userLanguage = data.language || i18n.language;
            i18n.changeLanguage(userLanguage);
            setLanguage(userLanguage);
            if (data.locationEnabled) {
              fetchAndSaveUserLocation().catch((error) => {
              });
            }
          }
        })
        .catch((error) => {
        });
    }
  }, [user, setLanguage]);

  const fadeAnim = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1500 });
  }, [fadeAnim]);

  useEffect(() => {
  if (params?.startTutorial === "1") {
    // démarre proprement le tuto
    // selon ton implémentation:
    startTutorial?.();       // si tu as cette fonction
    setTutorialStep?.(0);    // sinon force le step 0
  }
}, [params?.startTutorial]);

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


useEffect(() => {
  if (!challenges?.length) return;
  challenges.forEach((c) => {
    if (c.imageUrl) {
      try {
        (Image as any)?.prefetch?.(c.imageUrl);
      } catch {}
    }
  });
}, [challenges]);

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

    // Persiste le catalogue complet et en mémoire
    setAllChallenges(fetched);
    await AsyncStorage.setItem("challenges_cache", JSON.stringify(fetched));

    // 3) Déterminer les 5 du jour de manière déterministe
    const key = todayKey();
    const seedStr = `${key}#${user?.uid ?? "global"}`;
    const seed = hashStringToInt(seedStr);

    // Optionnel: trie pour que les plus riches en images soient priorisés
    const sorted = fetched.slice().sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0));
    const shuffled = seededShuffle(sorted, seed);

    const picks = shuffled.slice(0, 5);
    setDailyFive(picks);

    // 4) Cache “daily picks” (ids + date)
    await AsyncStorage.setItem(
      DAILY_PICKS_KEY,
      JSON.stringify({ date: key, ids: picks.map((p) => p.id) })
    );
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
    fetchChallenges(); 
  }, [user, i18n.language]);

  const safeNavigate = (path: string) => {
  if (!isMounted) return;

  if (requiresAuth(path)) {
    // gate() => true si connecté, sinon ouvre la modale et retourne false
    if (gate()) router.push(path);
    return;
  }

  router.push(path); // routes libres (explore, tips, etc.)
};


const pressed = useSharedValue<number>(0);

  const dynamicStyles = useMemo(
    () => getDynamicStyles(currentTheme, isDarkMode),
    [currentTheme, isDarkMode]
  );

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
          key={layoutKey}
          contentContainerStyle={[staticStyles.scrollContent, { paddingBottom: (showBanners ? bannerHeight : 0) + tabBarHeight + insets.bottom + SPACING * 2, }]}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          contentInset={{ top: 0, bottom: SPACING }}
        >
          {/* SECTION HERO */}
<Animated.View
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
    shouldPlay
    isLooping
    isMuted
    onError={() => {}}
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
    onPress={() => safeNavigate("/explore")}
    accessibilityLabel={t("launchAdventure")}
    testID="cta-button"
  >
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
  </TouchableOpacity>
</View>


          </Animated.View>

          {/* DAILY FIVE */}
<View style={staticStyles.section}>
  <View style={stylesDaily.titleRow}>
  <Text style={[staticStyles.sectionTitle, dynamicStyles.sectionTitle]}>
    {t("dailyChallenges", { defaultValue: "Défis du jour" })}
  </Text>
</View>

  {loading ? (
    <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
  ) : dailyFive.length > 0 ? (
    <View style={stylesDaily.wrap}>
      {/* Hero card */}
      <Animated.View entering={FadeInUp} style={stylesDaily.heroCard}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() =>
            safeNavigate(
              `/challenge-details/${dailyFive[0].id}?title=${encodeURIComponent(
                dailyFive[0].title
              )}&category=${encodeURIComponent(dailyFive[0].category)}&description=${encodeURIComponent(
                dailyFive[0].description
              )}`
            )
          }
        >
          <Image
            source={{ uri: dailyFive[0].imageUrl }}
            style={stylesDaily.heroImage}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)"]}
            style={stylesDaily.heroOverlay}
          />
          <View style={stylesDaily.badge}>
            <Ionicons name="flame-outline" size={normalize(14)} color="#fff" />
            <Text style={stylesDaily.badgeText}>
              {t("spotlight", { defaultValue: "À la une" })}
            </Text>
          </View>
          <View style={stylesDaily.heroTextZone}>
            <Text style={stylesDaily.heroTitle} numberOfLines={2}>
              {dailyFive[0].title}
            </Text>
            <Text style={stylesDaily.heroCat} numberOfLines={1}>
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
          >
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() =>
                safeNavigate(
                  `/challenge-details/${item.id}?title=${encodeURIComponent(
                    item.title
                  )}&category=${encodeURIComponent(item.category)}&description=${encodeURIComponent(
                    item.description
                  )}`
                )
              }
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={stylesDaily.miniImage}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]}
                style={stylesDaily.miniOverlay}
              />
              <Text style={stylesDaily.miniTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={stylesDaily.miniCat} numberOfLines={1}>
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
            <View style={staticStyles.discoverSection}>
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
        {/* Bannière AdMob fixée en bas */}
        {showBanners && (
  <View
    style={[
      staticStyles.bannerContainer,
      {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bannerLift,      // 👈 la bannière est au-dessus de la TabBar
      },
    ]}
    pointerEvents="box-none"
  >
    <BannerAd
  unitId={adUnitIds.banner}
  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: npa }}
/>
  </View>
)}
        {isTutorialActive && (tutorialStep === 0 || tutorialStep === 1) && (
          <BlurView intensity={50} style={staticStyles.blurView}>
            <TutorialModal
              step={tutorialStep}
              onNext={() => setTutorialStep(2)}
              onStart={startTutorial}
              onSkip={skipTutorial}
              onFinish={skipTutorial}
            />
          </BlurView>
        )}
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
              <Text style={staticStyles.modalTitle}>
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
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
    marginBottom: 0,
    overflow: "visible",
  },
  sectionTitle: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    lineHeight: normalize(28),
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
  paddingTop: 0,
  paddingBottom: SPACING,
  alignItems: "center",
  backgroundColor: "rgba(255, 255, 255, 0.05)",
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
    borderRadius: normalize(16),
    padding: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    width: normalize(150),
    height: normalize(110),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.15,
    shadowRadius: normalize(5),
    elevation: 4,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    color: isDarkMode ? "#FFF" : "#FFF",
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
  // avant: bottom: SPACING * 1.2,
  bottom: IS_SMALL ? SPACING * 1.8 : SPACING * 1.6, // ↑ un peu plus d’air
  color: "#fff",
  fontSize: normalize(13),
  lineHeight: normalize(16),
  fontFamily: "Comfortaa_700Bold",
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

