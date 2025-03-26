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
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.8);
const ITEM_HEIGHT = 260;
const CARD_MARGIN = 5;
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

  // Animation fade pour la section HERO
  const fadeAnim = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 2000 });
  }, [fadeAnim]);

  // Surveille l'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Récupère les défis depuis Firestore
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
    if (user) {
      fetchChallenges();
    }
  }, [user]);

  const flatListRef = useRef<RNAnimated.FlatList<any>>(null);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const currentIndexRef = useRef<number>(0);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Démarre l'auto-scroll avec un intervalle
  const startAutoScroll = useCallback(() => {
    if (challenges.length === 0) return;
    autoScrollIntervalRef.current = setInterval(() => {
      let nextIndex = currentIndexRef.current + 1;
      if (nextIndex >= challenges.length) nextIndex = 0;
      try {
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } catch (err) {
        // En cas d'erreur, on ignore
      }
      currentIndexRef.current = nextIndex;
    }, 3000);
  }, [challenges]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollIntervalRef.current)
        clearInterval(autoScrollIntervalRef.current);
    };
  }, [challenges, startAutoScroll]);

  // Annule l'auto-scroll lors du début du swipe
  const handleScrollBeginDrag = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  // Lors du relâchement, recentrer et redémarrer l'auto-scroll après un délai
  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_ITEM_WIDTH);
    currentIndexRef.current = index;
    try {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    } catch (err) {}
    if (!autoScrollIntervalRef.current) {
      setTimeout(() => startAutoScroll(), 1500);
    }
  };

  // Met à jour l'index courant via viewability
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      currentIndexRef.current = viewableItems[0].index;
    }
  }).current;
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <TouchableOpacity
      style={styles.challengeCard}
      onPress={() =>
        router.push(
          `/challenge-details/${item.id}?title=${encodeURIComponent(
            item.title
          )}&category=${encodeURIComponent(
            item.category
          )}&description=${encodeURIComponent(item.description)}`
        )
      }
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.challengeImage} />
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
        style={styles.overlay}
      >
        <Text style={styles.challengeTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.day !== undefined && (
          <Text style={styles.challengeDay}>Jour {item.day}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <LinearGradient colors={["#e3e2e9", "#e3e2e9"]} style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1, backgroundColor: "#e3e2e9" },
          ]}
          bounces={false}
        >
          {/* SECTION HERO */}
          <RNAnimated.View style={[styles.heroSection, fadeStyle]}>
            <Video
              source={require("../../assets/videos/hero-bg.mp4")}
              style={styles.backgroundVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
            <View style={styles.heroOverlay} />
            <Image
              source={require("../../assets/images/Challenge.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Réveille ton potentiel</Text>
            <Text style={styles.heroSubtitle}>
              Rejoins ChallengeTies et trouve l'inspiration au quotidien !
            </Text>
            <TouchableOpacity onPress={() => router.push("/explore")}>
              <LinearGradient
                colors={["#e3701e", "#e3701e"]}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>Commence l'Aventure</Text>
              </LinearGradient>
            </TouchableOpacity>
          </RNAnimated.View>

          {/* CAROUSEL DES DÉFIS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Défis Inspirants</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#a67c52" />
            ) : challenges.length > 0 ? (
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
                getItemLayout={(_, index) => ({
                  length: EFFECTIVE_ITEM_WIDTH,
                  offset: EFFECTIVE_ITEM_WIDTH * index,
                  index,
                })}
                onScroll={RNAnimated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                onScrollBeginDrag={handleScrollBeginDrag}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                renderItem={renderChallenge}
                keyExtractor={(item) => item.id}
                style={{ marginBottom: 20 }}
              />
            ) : (
              <Text style={styles.noChallengesText}>Aucun défi disponible</Text>
            )}
          </View>

          {/* SECTION "INSPIRE-TOI" */}
          <View style={styles.discoverSection}>
            <Text style={styles.sectionTitle}>Inspire-toi</Text>
            <View style={styles.discoverRow}>
              <TouchableOpacity
                style={styles.discoverButton}
                onPress={() => router.push("/tips")}
              >
                <Text style={styles.discoverButtonText}>Tips & Tricks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discoverButton}
                onPress={() => router.push("/leaderboard")}
              >
                <Text style={styles.discoverButtonText}>Leaderboard</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.discoverRowCenter}>
              <TouchableOpacity
                style={styles.discoverButton}
                onPress={() => router.push("/new-features")}
              >
                <Text style={styles.discoverButtonText}>Nouveautés</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#e3e2e9" },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  heroSection: {
    height: SCREEN_HEIGHT * 0.5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  backgroundVideo: { position: "absolute", width: "100%", height: "100%" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  logo: { width: 180, height: 180, position: "absolute", top: -20 },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFF",
    textAlign: "center",
    marginTop: 80,
    marginHorizontal: 20,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
    marginHorizontal: 20,
  },
  ctaButton: {
    backgroundColor: "#ed8f03",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginTop: 5,
  },
  ctaText: { fontSize: 18, fontFamily: "Comfortaa_700Bold", color: "#FFF" },
  section: { paddingTop: 20, paddingBottom: 10 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    color: "#060606",
    marginBottom: 15,
    textAlign: "center",
  },
  challengeCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    marginHorizontal: CARD_MARGIN,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  challengeImage: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 10,
  },
  challengeTitle: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 2,
  },
  challengeDay: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    color: "#a67c52",
    fontWeight: "600",
    textAlign: "center",
  },
  noChallengesText: {
    color: "#555",
    textAlign: "center",
    fontSize: 16,
    marginTop: 10,
    fontFamily: "Comfortaa_400Regular",
  },
  discoverSection: {
    marginTop: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  discoverRow: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
    width: "100%",
  },
  discoverRowCenter: {
    width: "100%",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 20,
  },
  discoverButton: {
    backgroundColor: "#e3701e",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
  },
  discoverButtonText: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFF",
  },
});
