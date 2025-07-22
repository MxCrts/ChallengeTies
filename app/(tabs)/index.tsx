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
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import  {
  useSharedValue,
  withTiming,
  FadeInUp,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { fetchAndSaveUserLocation } from "../../services/locationService";
import { doc, getDoc } from "firebase/firestore";
import { useLanguage } from "../../context/LanguageContext";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TutorialModal from "../../components/TutorialModal";
import ThreeDCarousel from "@/components/ThreeDCarousel";


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
const EFFECTIVE_ITEM_WIDTH = ITEM_WIDTH + CARD_MARGIN * 2;

const SPACING = normalize(15);
const STATUS_BAR_HEIGHT = Platform.select({
  ios: normalize(44),
  android: StatusBar.currentHeight || normalize(24),
  default: normalize(24),
});

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

const ChallengeCard: React.FC<ChallengeCardProps> = ({
   item, index, safeNavigate, currentTheme, dynamicStyles, t,
 }) => {
   return (
     <Animated.View
       entering={FadeInUp.delay(index * 100)}
       style={[staticStyles.challengeCard, dynamicStyles.challengeCard]}
     >
      <TouchableOpacity
        onPress={() => safeNavigate(`/challenge-details/${item.id}?title=${encodeURIComponent(item.title)}&category=${encodeURIComponent(item.category)}&description=${encodeURIComponent(item.description)}`)}
        activeOpacity={0.9}
        accessibilityLabel={`${t("viewChallengeDetails")} ${item.title}`}
        testID={`challenge-card-${index}`}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={staticStyles.challengeImage}
          cachePolicy="memory-disk"
          priority="high"
          contentFit="cover"
        />
        <LinearGradient
          colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
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
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();
const scrollX = useSharedValue(0);
  const [layoutKey, setLayoutKey] = useState(0);
  const { setLanguage } = useLanguage();
  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();
const heroVideoRef = useRef<Video | null>(null);
const [videoReady, setVideoReady] = useState(false);

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;


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
  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-4725616526467159/3887969618";
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

  const fetchChallenges = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cachedChallenges = await AsyncStorage.getItem("challenges_cache");
      if (cachedChallenges) {
        setChallenges(JSON.parse(cachedChallenges).slice(0, 20));
      }
      const challengesQuery = query(
        collection(db, "challenges"),
        where("approved", "==", true)
      );
      const querySnapshot = await getDocs(challengesQuery);
      const fetched = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data?.chatId
            ? t(`challenges.${data.chatId}.title`)
            : t("mysteriousChallenge"),
          description: data?.chatId
            ? t(`challenges.${data.chatId}.description`)
            : t("noDescriptionAvailable"),
          category: data?.category
            ? t(`categories.${data.category}`)
            : t("miscellaneous"),
          imageUrl: data?.imageUrl || "https://via.placeholder.com/300",
          day: data?.day,
          approved: data?.approved,
        };
      });
      setChallenges(fetched.slice(0, 8));
      await AsyncStorage.setItem("challenges_cache", JSON.stringify(fetched));
    } catch (error) {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchChallenges();
  }, [user, i18n.language]);

  useEffect(() => {
  const loadHeroVideo = async () => {
    if (heroVideoRef.current) {
      try {
        const status = await heroVideoRef.current.loadAsync(
          require("../../assets/videos/Hero-Bgopti.mp4"),
          { shouldPlay: true, isLooping: true, isMuted: true }
        );
      } catch (error) {
      }
    }
  };

  if (videoReady) {
    loadHeroVideo();
  }

  return () => {
    if (heroVideoRef.current) {
      heroVideoRef.current.unloadAsync();
    }
  };
}, [videoReady]);

  const safeNavigate = (path: string) => {
    if (isMounted) {
      router.push(path);
    } else {
    }
  };

  const scrollY = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withTiming(scrollY.value * 0.2, { duration: 100 }) },
    ],
  }));

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    []
  );

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
          contentContainerStyle={staticStyles.scrollContent}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentInset={{ top: 0, bottom: SPACING }}
        >
          {/* SECTION HERO */}
          <Animated.View style={[staticStyles.heroSection, fadeStyle]}>
            <Video
  ref={heroVideoRef}
  style={staticStyles.backgroundVideo}
  resizeMode={ResizeMode.COVER}
  source={require("../../assets/videos/Hero-Bgopti.mp4")} // ⚡️ Donne-lui une source de base pour monter
  onReadyForDisplay={() => {
    setVideoReady(true);
  }}
  shouldPlay={false} // On laisse `loadAsync` gérer
/>
            <LinearGradient
              colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.2)"]}
              style={staticStyles.heroOverlay}
            />
            <Animated.View style={[staticStyles.heroContent, headerStyle]}>
              <Image
                source={require("../../assets/images/GreatLogo1.png")}
                style={staticStyles.logo}
                resizeMode="contain"
                accessibilityLabel={t("logoChallengeTies")}
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
                onPress={() => safeNavigate("/explore")}
                accessibilityLabel={t("launchAdventure")}
                testID="cta-button"
              >
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
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* CAROUSEL */}
          <View style={staticStyles.section}>
            <Text
              style={[staticStyles.sectionTitle, dynamicStyles.sectionTitle]}
            >
              {t("popularChallenges")}
            </Text>
            {loading ? (
              <ActivityIndicator
                size="large"
                color={currentTheme.colors.secondary}
              />
            ) : challenges.length > 0 ? (
              <>
                {challenges.length > 0 && (
                  <ThreeDCarousel
                  data={challenges.slice(0, 8)}        // exactement 8 items
                  itemWidth={ITEM_WIDTH}
                  spacing={CARD_MARGIN * 2}
                  autoRotateInterval={4000}
                  renderItem={({ item, index }) => (
                    <ChallengeCard
                      item={item}
                      index={index}
                      safeNavigate={safeNavigate}
                      currentTheme={currentTheme}
                      dynamicStyles={dynamicStyles}
                      t={t}
                    />
                  )}
                />

          )}
              </>
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

          {/* SPACER */}
          <View style={staticStyles.spacer} />

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
                <View style={staticStyles.discoverSingleRow}>
                  <View style={staticStyles.discoverSingleCardContainer}>
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
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        {/* Bannière AdMob fixée en bas */}
        <View style={staticStyles.bannerContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
        </View>
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
    paddingVertical: SPACING / 2,
    backgroundColor: "transparent",
  },
  heroSection: {
    height: normalize(405),
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    minHeight: normalize(400),
  },
  backgroundVideo: {
    position: "absolute",
    top: -STATUS_BAR_HEIGHT,
    left: 0,
    width: SCREEN_WIDTH,
    height: normalize(400) + STATUS_BAR_HEIGHT,
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: SPACING,
    width: "100%",
    paddingTop: STATUS_BAR_HEIGHT + normalize(10),
    paddingBottom: normalize(20),
  },
  logo: {
    width: normalize(200),
    height: normalize(140),
    marginBottom: SPACING / 8,
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
    marginBottom: normalize(40),
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
    paddingVertical: SPACING,
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
    marginTop: normalize(-10),
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
    justifyContent: "space-between",
    width: "100%",
  },
  actionButton: {
    backgroundColor: "#FFB800",
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(25),
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
    borderColor: currentTheme.colors.secondary,
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
