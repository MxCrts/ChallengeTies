import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Text,
  Dimensions,
  ScrollView,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PixelRatio,
  SafeAreaView,
} from "react-native";
import { Animated as RNAnimated } from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, User } from "firebase/auth";
import { Video, ResizeMode } from "expo-av";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  FadeInUp,
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
import { doc, getDoc } from "firebase/firestore"; // Ajoute cet import
import { useLanguage } from "../../context/LanguageContext"; // Ajoute cet import
import i18n from "../../i18n"; // Ajoute cet import

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Fonction de normalisation des tailles pour la responsivité
const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Constantes pour le carousel
const ITEM_WIDTH = SCREEN_WIDTH * 0.85;
const ITEM_HEIGHT = Math.min(SCREEN_HEIGHT * 0.32, normalize(240));
const CARD_MARGIN = normalize(6);
const EFFECTIVE_ITEM_WIDTH = ITEM_WIDTH + CARD_MARGIN * 2;
const SPACER = (SCREEN_WIDTH - ITEM_WIDTH) / 2;
const SPACING = normalize(15);

// Estimation de la hauteur de la barre d’état
const STATUS_BAR_HEIGHT = normalize(44);

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  day?: number;
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();
  const { setLanguage } = useLanguage(); // Ajoute ceci
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
            const userLanguage = data.language || i18n.language; // Firestore ou détectée
            i18n.changeLanguage(userLanguage);
            setLanguage(userLanguage);
            // Vérifier locationEnabled et mettre à jour localisation
            if (data.locationEnabled) {
              fetchAndSaveUserLocation().catch((error) => {
                console.error("Erreur localisation index:", error);
              });
            }
          }
        })
        .catch((error) => {
          console.error("Erreur chargement utilisateur:", error);
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
  }, []);

  const fetchChallenges = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "challenges"));
      const fetched = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          // on remplace les fallbacks en dur par t("…")
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
        };
      });
      setChallenges(fetched.slice(0, 20));
    } catch (error) {
      console.error("Erreur lors de la récupération des défis :", error);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchChallenges();
  }, [user, i18n.language]);

  const flatListRef = useRef<RNAnimated.FlatList<any>>(null);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const currentIndexRef = useRef<number>(0);
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const startAutoScroll = useCallback(() => {
    if (challenges.length <= 1) return;
    if (autoScrollIntervalRef.current)
      clearInterval(autoScrollIntervalRef.current);
    autoScrollIntervalRef.current = setInterval(() => {
      let nextIndex = currentIndexRef.current + 1;
      if (nextIndex >= challenges.length) nextIndex = 0;
      currentIndexRef.current = nextIndex;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * EFFECTIVE_ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [challenges]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollIntervalRef.current)
        clearInterval(autoScrollIntervalRef.current);
    };
  }, [challenges, startAutoScroll]);

  const handleScrollBeginDrag = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_ITEM_WIDTH);
    currentIndexRef.current = index;
    flatListRef.current?.scrollToOffset({
      offset: index * EFFECTIVE_ITEM_WIDTH,
      animated: true,
    });
    if (!autoScrollIntervalRef.current) {
      setTimeout(() => startAutoScroll(), 2000);
    }
  };

  const safeNavigate = (path: string) => {
    if (isMounted) {
      router.push(path);
    } else {
      console.warn("Navigation bloquée : composant pas encore monté.");
    }
  };

  const renderChallenge = ({
    item,
    index,
  }: {
    item: Challenge;
    index: number;
  }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={[
        styles.challengeCard,
        {
          backgroundColor: currentTheme.colors.cardBackground,
          borderColor: currentTheme.colors.secondary,
        },
      ]}
    >
      <TouchableOpacity
        onPress={() =>
          safeNavigate(
            `/challenge-details/${item.id}?title=${encodeURIComponent(
              item.title
            )}&category=${encodeURIComponent(
              item.category
            )}&description=${encodeURIComponent(item.description)}`
          )
        }
        activeOpacity={0.9}
        accessibilityLabel={`${t("viewChallengeDetails")} ${item.title}`}
        testID={`challenge-card-${index}`}
      >
        <Image source={{ uri: item.imageUrl }} style={styles.challengeImage} />
        <LinearGradient
          colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
          style={styles.overlay}
        >
          <Text
            style={[
              styles.challengeTitle,
              { color: currentTheme.colors.textPrimary },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.day !== undefined && (
            <Text
              style={[
                styles.challengeDay,
                { color: currentTheme.colors.primary },
              ]}
            >
              {t("day")} {item.day}
            </Text>
          )}
          <Text
            style={[
              styles.challengeCategory,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {item.category}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const scrollY = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withTiming(scrollY.value * 0.2, { duration: 100 }) },
    ],
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.gradientContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentInset={{ top: 0, bottom: SPACING }}
        >
          {/* SECTION HERO */}
          <Animated.View style={[styles.heroSection, fadeStyle]}>
            <Video
              source={require("../../assets/videos/hero-bg.mp4")}
              style={styles.backgroundVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              usePoster
              posterSource={require("../../assets/images/chalkboard.png")}
            />
            <LinearGradient
              colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.2)"]}
              style={styles.heroOverlay}
            />
            <Animated.View style={[styles.heroContent, headerStyle]}>
              <Image
                source={require("../../assets/images/Challenge.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={t("logoChallengeTies")}
              />
              <Text
                style={[
                  styles.heroTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("defyYourLimits")}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { color: currentTheme.colors.textSecondary },
                ]}
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
                  style={styles.ctaButton}
                >
                  <Text
                    style={[
                      styles.ctaText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("launchAdventure")}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={normalize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* RESTE DU CONTENU */}
          <SafeAreaView style={styles.safeAreaContent}>
            {/* CAROUSEL */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
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
                  <RNAnimated.FlatList
                    ref={flatListRef}
                    data={challenges}
                    horizontal
                    decelerationRate="fast"
                    bounces={false}
                    snapToInterval={EFFECTIVE_ITEM_WIDTH}
                    snapToAlignment="center"
                    contentContainerStyle={{ paddingHorizontal: SPACER }}
                    showsHorizontalScrollIndicator={false}
                    onScroll={RNAnimated.event(
                      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                      { useNativeDriver: true }
                    )}
                    scrollEventThrottle={16}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    renderItem={renderChallenge}
                    keyExtractor={(item) => item.id}
                    style={styles.carousel}
                  />
                  <View style={styles.pagination}>
                    {challenges.map((_, index) => (
                      <RNAnimated.View
                        key={index}
                        style={[
                          styles.dot,
                          { backgroundColor: currentTheme.colors.secondary },
                          {
                            opacity: scrollX.interpolate({
                              inputRange: [
                                (index - 1) * EFFECTIVE_ITEM_WIDTH,
                                index * EFFECTIVE_ITEM_WIDTH,
                                (index + 1) * EFFECTIVE_ITEM_WIDTH,
                              ],
                              outputRange: [0.3, 1, 0.3],
                              extrapolate: "clamp",
                            }),
                          },
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Animated.View
                  entering={FadeInUp}
                  style={styles.noChallengesContainer}
                >
                  <Ionicons
                    name="sad-outline"
                    size={normalize(40)}
                    color={currentTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.noChallengesText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("noChallengesAvailable")}
                  </Text>
                  <Text
                    style={[
                      styles.noChallengesSubtext,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("challengesComingSoon")}
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* INSPIRE-TOI */}
            <View style={styles.discoverSection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("getInspired")}
              </Text>
              <View style={styles.discoverGrid}>
                <View style={styles.discoverRow}>
                  <Animated.View
                    entering={FadeInUp.delay(100)}
                    style={styles.discoverItem}
                  >
                    <TouchableOpacity
                      style={[
                        styles.discoverCard,
                        {
                          backgroundColor: currentTheme.colors.cardBackground,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                      onPress={() => safeNavigate("/tips")}
                      accessibilityLabel={t("tipsAndTricks")}
                      testID="tips-card"
                    >
                      <Ionicons
                        name="bulb-outline"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.discoverCardText,
                          { color: currentTheme.colors.secondary },
                        ]}
                      >
                        {t("tipsAndTricks")}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View
                    entering={FadeInUp.delay(200)}
                    style={styles.discoverItem}
                  >
                    <TouchableOpacity
                      style={[
                        styles.discoverCard,
                        {
                          backgroundColor: currentTheme.colors.cardBackground,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                      onPress={() => safeNavigate("/leaderboard")}
                      accessibilityLabel={t("leaderboardTitle")}
                      testID="leaderboard-card"
                    >
                      <Ionicons
                        name="trophy-outline"
                        size={normalize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.discoverCardText,
                          { color: currentTheme.colors.secondary },
                        ]}
                      >
                        {t("leaderboardTitle")}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
                <Animated.View
                  entering={FadeInUp.delay(300)}
                  style={styles.discoverItemCentered}
                >
                  <TouchableOpacity
                    style={[
                      styles.discoverCard,
                      {
                        backgroundColor: currentTheme.colors.cardBackground,
                        borderColor: currentTheme.colors.border,
                      },
                    ]}
                    onPress={() => safeNavigate("/new-features")}
                    accessibilityLabel={t("whatsNew")}
                    testID="new-features-card"
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={normalize(32)}
                      color={currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.discoverCardText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {t("whatsNew")}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </SafeAreaView>
        </ScrollView>
        {/* Bannière AdMob fixée en bas */}
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => console.log("Bannière chargée")}
            onAdFailedToLoad={(err) =>
              console.error("Échec chargement bannière", err)
            }
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeAreaContent: {
    flex: 1,
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING * 2,
  },
  heroSection: {
    height: Math.min(SCREEN_HEIGHT * 0.5, normalize(400)), // Hauteur pour immersion
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: Math.min(SCREEN_HEIGHT * 0.5, normalize(400)) + STATUS_BAR_HEIGHT, // Inclut la barre d’état
    zIndex: -1, // Assure que la vidéo est en arrière-plan
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0, // Overlay au-dessus de la vidéo, sous le contenu
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingTop: STATUS_BAR_HEIGHT + SPACING, // Positionne le contenu sous la barre d’état
    zIndex: 1, // Contenu au-dessus de l’overlay
  },
  logo: {
    width: normalize(150),
    height: normalize(130),
  },
  heroTitle: {
    fontSize: normalize(28),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: normalize(4),
  },
  heroSubtitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginVertical: SPACING / 2,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: normalize(2),
    maxWidth: "90%",
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
  },
  section: {
    paddingTop: SPACING,
    paddingBottom: SPACING,
  },
  sectionTitle: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: normalize(2),
  },
  carousel: {
    marginBottom: SPACING,
  },
  challengeCard: {
    borderRadius: normalize(16),
    overflow: "hidden",
    marginHorizontal: CARD_MARGIN,
    width: ITEM_WIDTH,
    maxWidth: normalize(400),
    height: ITEM_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(8),
    elevation: 8,
    borderWidth: normalize(2),
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
    padding: SPACING / 2,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: normalize(3),
  },
  challengeDay: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 4,
  },
  challengeCategory: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 4,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING,
  },
  dot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: normalize(4),
    marginHorizontal: normalize(4),
  },
  noChallengesContainer: {
    alignItems: "center",
    marginTop: SPACING,
  },
  noChallengesText: {
    textAlign: "center",
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
  },
  noChallengesSubtext: {
    textAlign: "center",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
  discoverSection: {
    marginTop: SPACING,
    paddingHorizontal: SPACING,
    alignItems: "center",
  },
  discoverGrid: {
    width: "100%",
    marginTop: SPACING,
  },
  discoverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SPACING,
  },
  discoverItem: {
    width: "48%",
  },
  discoverItemCentered: {
    width: "100%",
    alignItems: "center",
  },
  discoverCard: {
    borderRadius: normalize(12),
    padding: SPACING,
    alignItems: "center",
    width: "100%",
    maxWidth: normalize(200),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(6),
    elevation: 5,
    borderWidth: normalize(1),
  },
  discoverCardText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING / 2,
    textAlign: "center",
  },
});
