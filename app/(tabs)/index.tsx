import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Text,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.85;
const ITEM_HEIGHT = SCREEN_HEIGHT * 0.32;
const CARD_MARGIN = SCREEN_WIDTH * 0.015;
const EFFECTIVE_ITEM_WIDTH = ITEM_WIDTH + CARD_MARGIN * 2;
const SPACER = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  day?: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Sécurité pour navigation
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

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
    setIsMounted(true); // Composant monté
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
          title: data?.title || "Défi Mystère",
          description: data?.description || "Aucune description disponible",
          category: data?.category || "Divers",
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
  }, [user]);

  const flatListRef = useRef<RNAnimated.FlatList<any>>(null);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const currentIndexRef = useRef<number>(0);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            )}` +
              `&category=${encodeURIComponent(item.category)}` +
              `&description=${encodeURIComponent(item.description)}`
          )
        }
        activeOpacity={0.9}
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
              Jour {item.day}
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
      { translateY: withTiming(scrollY.value * 0.3, { duration: 100 }) },
    ],
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: 0 }]}>
      <StatusBar
        hidden={true}
        translucent={true}
        backgroundColor="transparent"
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
              />
              <Text
                style={[
                  styles.heroTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                Défie tes limites
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Rejoins une communauté vibrante et repousse tes frontières
                chaque jour !
              </Text>
              <TouchableOpacity onPress={() => safeNavigate("/explore")}>
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
                    Lancer l'Aventure
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={SCREEN_WIDTH * 0.05}
                    color={currentTheme.colors.textPrimary}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* CAROUSEL DES DÉFIS */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Défis Populaires
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
                  size={SCREEN_WIDTH * 0.1}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.noChallengesText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  Aucun défi disponible
                </Text>
                <Text
                  style={[
                    styles.noChallengesSubtext,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  De nouveaux défis arrivent bientôt !
                </Text>
              </Animated.View>
            )}
          </View>

          {/* SECTION "INSPIRE-TOI" */}
          <View style={styles.discoverSection}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Inspire-toi
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
                  >
                    <Ionicons
                      name="bulb-outline"
                      size={SCREEN_WIDTH * 0.08}
                      color={currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.discoverCardText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      Tips & Tricks
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
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={SCREEN_WIDTH * 0.08}
                      color={currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.discoverCardText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      Leaderboard
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
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={SCREEN_WIDTH * 0.08}
                    color={currentTheme.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.discoverCardText,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    Nouveautés
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SCREEN_HEIGHT * 0.05,
  },
  heroSection: {
    height: SCREEN_HEIGHT * 0.45,
    justifyContent: "flex-start",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  backgroundVideo: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.35,
  },
  heroTitle: {
    fontSize: SCREEN_WIDTH * 0.08,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginVertical: SCREEN_HEIGHT * 0.008,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SCREEN_WIDTH * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  ctaText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontFamily: "Comfortaa_700Bold",
    marginRight: SCREEN_WIDTH * 0.02,
  },
  section: {
    paddingTop: SCREEN_HEIGHT * 0.03,
    paddingBottom: SCREEN_HEIGHT * 0.02,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SCREEN_HEIGHT * 0.025,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  carousel: {
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  challengeCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginHorizontal: CARD_MARGIN,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
    padding: SCREEN_WIDTH * 0.03,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  challengeDay: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SCREEN_HEIGHT * 0.005,
  },
  challengeCategory: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SCREEN_HEIGHT * 0.005,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  dot: {
    width: SCREEN_WIDTH * 0.02,
    height: SCREEN_WIDTH * 0.02,
    borderRadius: SCREEN_WIDTH * 0.01,
    marginHorizontal: SCREEN_WIDTH * 0.01,
  },
  noChallengesContainer: {
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  noChallengesText: {
    textAlign: "center",
    fontSize: SCREEN_WIDTH * 0.045,
    fontFamily: "Comfortaa_700Bold",
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  noChallengesSubtext: {
    textAlign: "center",
    fontSize: SCREEN_WIDTH * 0.035,
    fontFamily: "Comfortaa_400Regular",
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  discoverSection: {
    marginTop: SCREEN_HEIGHT * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    alignItems: "center",
  },
  discoverGrid: {
    width: "100%",
    marginTop: SCREEN_HEIGHT * 0.025,
  },
  discoverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  discoverItem: {
    width: "48%",
  },
  discoverItemCentered: {
    width: "100%",
    alignItems: "center",
  },
  discoverCard: {
    borderRadius: 15,
    padding: SCREEN_WIDTH * 0.04,
    alignItems: "center",
    width: SCREEN_WIDTH * 0.42,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
  },
  discoverCardText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontFamily: "Comfortaa_700Bold",
    marginTop: SCREEN_HEIGHT * 0.015,
    textAlign: "center",
  },
});
