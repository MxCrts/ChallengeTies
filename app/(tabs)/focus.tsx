import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Dimensions,
  Animated as RNAnimated,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import designSystem from "../../theme/designSystem";

const { lightTheme } = designSystem;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const currentTheme = lightTheme;

// Carousel du haut (80% de l’écran)
const TOP_ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.8);
const TOP_ITEM_HEIGHT = 260;
const TOP_CARD_MARGIN = 5;
const EFFECTIVE_TOP_ITEM_WIDTH = TOP_ITEM_WIDTH + TOP_CARD_MARGIN * 2;
const SPACER_TOP = (SCREEN_WIDTH - TOP_ITEM_WIDTH) / 2;

// Carousel du bas (60% de l’écran)
const BOTTOM_ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const BOTTOM_ITEM_HEIGHT = 180;
const BOTTOM_CARD_MARGIN = 5;
const EFFECTIVE_BOTTOM_ITEM_WIDTH = BOTTOM_ITEM_WIDTH + BOTTOM_CARD_MARGIN * 2;
const SPACER_BOTTOM = (SCREEN_WIDTH - BOTTOM_ITEM_WIDTH) / 2;

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface CurrentChallengeExtended {
  id: string;
  title: string;
  imageUrl?: string;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
  participants?: number;
  category?: string;
  description?: string;
  uniqueKey?: string;
}

export default function FocusScreen() {
  const router = useRouter();
  const { currentChallenges, markToday } = useCurrentChallenges();
  const [userTrophies, setUserTrophies] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const scrollXTop = useRef(new RNAnimated.Value(0)).current;
  const scrollXBottom = useRef(new RNAnimated.Value(0)).current;
  const flatListTopRef = useRef<RNAnimated.FlatList<any>>(null);
  const flatListBottomRef = useRef<RNAnimated.FlatList<any>>(null);

  const [challengeParticipants, setChallengeParticipants] = useState<{
    [key: string]: number;
  }>({});

  // Récupération du nombre de trophées
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserTrophies(data.trophies || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsLoading(false);
  }, [currentChallenges]);

  const today = new Date().toDateString();

  const uniqueChallenges = Array.from(
    new Map(currentChallenges.map((ch: any) => [ch.uniqueKey, ch])).values()
  ) as CurrentChallengeExtended[];

  const notMarkedToday = uniqueChallenges.filter(
    (ch) => ch.lastMarkedDate !== today
  );
  const markedToday = uniqueChallenges.filter(
    (ch) => ch.lastMarkedDate === today
  );

  const handleNavigateToDetails = (item: CurrentChallengeExtended) => {
    router.push({
      pathname: "/challenge-details/[id]",
      params: {
        id: item.id,
        title: item.title,
        selectedDays: item.selectedDays,
        completedDays: item.completedDays,
        category: item.category || "Uncategorized",
        description: item.description || "No description available",
        imageUrl: item.imageUrl,
      },
    });
  };

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    uniqueChallenges.forEach((challenge) => {
      const challengeRef = doc(db, "challenges", challenge.id);
      const unsubscribe = onSnapshot(challengeRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setChallengeParticipants((prev) => ({
            ...prev,
            [challenge.id]: data.participantsCount || 0,
          }));
        }
      });
      unsubscribes.push(unsubscribe);
    });
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [uniqueChallenges]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={lightTheme.colors.trophy} />
      </SafeAreaView>
    );
  }

  const handleMomentumScrollEndTop = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_TOP_ITEM_WIDTH);
    flatListTopRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleMomentumScrollEndBottom = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_BOTTOM_ITEM_WIDTH);
    flatListBottomRef.current?.scrollToIndex({ index, animated: true });
  };

  const renderTopItem = ({
    item,
    index,
  }: {
    item: CurrentChallengeExtended;
    index: number;
  }) => {
    const inputRange = [
      (index - 1) * EFFECTIVE_TOP_ITEM_WIDTH,
      index * EFFECTIVE_TOP_ITEM_WIDTH,
      (index + 1) * EFFECTIVE_TOP_ITEM_WIDTH,
    ];
    const scale = scrollXTop.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: "clamp",
    });
    return (
      <RNAnimated.View
        style={[
          styles.topItemWrapper,
          { width: TOP_ITEM_WIDTH, transform: [{ scale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.topItemContainer, { height: TOP_ITEM_HEIGHT }]}
          onPress={() => handleNavigateToDetails(item)}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.topItemImage}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={80} color="#ccc" />
              <Text style={styles.noImageText}>Image non disponible</Text>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
            style={styles.topItemOverlay}
          >
            <Text
              style={[
                styles.topItemTitle,
                { color: lightTheme.colors.textPrimary },
              ]}
            >
              {item.title}
            </Text>
            <Text style={styles.topItemParticipants}>
              <Ionicons
                name="people"
                size={16}
                color={lightTheme.colors.trophy}
              />{" "}
              {challengeParticipants[item.id] ?? item.participants ?? 0}{" "}
              participants
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {item.lastMarkedDate !== today && (
          <TouchableOpacity
            style={styles.markTodayButton}
            onPress={() => markToday(item.id, item.selectedDays)}
          >
            <Text style={styles.markTodayButtonText}>Marquer Aujourd'hui</Text>
          </TouchableOpacity>
        )}
      </RNAnimated.View>
    );
  };

  const renderBottomItem = ({
    item,
    index,
  }: {
    item: CurrentChallengeExtended;
    index: number;
  }) => {
    const inputRange = [
      (index - 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
      index * EFFECTIVE_BOTTOM_ITEM_WIDTH,
      (index + 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
    ];
    const scale = scrollXBottom.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: "clamp",
    });
    return (
      <RNAnimated.View
        style={[
          styles.bottomItemWrapper,
          { width: BOTTOM_ITEM_WIDTH, transform: [{ scale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.bottomItemContainer, { height: BOTTOM_ITEM_HEIGHT }]}
          onPress={() => handleNavigateToDetails(item)}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bottomItemImage}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={60} color="#ccc" />
              <Text style={styles.noImageText}>Image non disponible</Text>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
            style={styles.bottomItemOverlay}
          >
            <Text
              style={[
                styles.bottomItemTitle,
                { color: lightTheme.colors.textPrimary },
              ]}
            >
              {item.title}
            </Text>
            <Text style={styles.bottomItemParticipants}>
              <Ionicons
                name="people"
                size={14}
                color={lightTheme.colors.trophy}
              />{" "}
              {challengeParticipants[item.id] ?? item.participants ?? 0}{" "}
              participants
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: lightTheme.colors.background },
      ]}
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.trophyContainer}
          onPress={() => router.push("/profile")}
        >
          <Ionicons
            name="trophy-outline"
            size={normalizeFont(28)}
            color={lightTheme.colors.trophy}
          />
          <Text style={styles.trophyText}>{userTrophies}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => router.push("/create-challenge")}
        >
          <Ionicons
            name="add-circle-outline"
            size={normalizeFont(32)}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      <RNAnimated.ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Carousel du haut */}
        <View style={styles.topCarouselContainer}>
          <Text style={styles.sectionTitle}>Challenges du jour</Text>
          {notMarkedToday.length > 0 ? (
            <RNAnimated.FlatList
              ref={flatListTopRef}
              data={notMarkedToday}
              keyExtractor={(item) => item.uniqueKey!}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="normal"
              disableIntervalMomentum
              bounces
              snapToInterval={EFFECTIVE_TOP_ITEM_WIDTH}
              snapToAlignment="center"
              contentContainerStyle={{ paddingHorizontal: SPACER_TOP }}
              getItemLayout={(_, index) => ({
                length: EFFECTIVE_TOP_ITEM_WIDTH,
                offset: EFFECTIVE_TOP_ITEM_WIDTH * index,
                index,
              })}
              onScroll={RNAnimated.event(
                [{ nativeEvent: { contentOffset: { x: scrollXTop } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleMomentumScrollEndTop}
              renderItem={renderTopItem}
            />
          ) : (
            <View style={styles.emptyTopContainer}>
              <Text style={styles.emptyTitle}>Aucun défi en cours.</Text>
              <Text style={styles.emptySubtitle}>Pour créer un défi :</Text>
              <View style={styles.emptyList}>
                <Text style={styles.emptyItem}>
                  • Cliquez sur l'icône{" "}
                  <Ionicons
                    name="add-circle-outline"
                    size={normalizeFont(16)}
                    color="#3B82F6"
                  />{" "}
                  en haut à droite
                </Text>
                <Text style={styles.emptyItem}>
                  • Ou{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push("/explore")}
                  >
                    rejoignez un challenge
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Carousel du bas */}
        <View style={styles.bottomCarouselContainer}>
          <Text style={styles.sectionTitle}>Défis complétés aujourd’hui</Text>
          {markedToday.length > 0 ? (
            <RNAnimated.FlatList
              ref={flatListBottomRef}
              data={markedToday}
              keyExtractor={(item) => item.uniqueKey!}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="normal"
              disableIntervalMomentum
              bounces
              snapToInterval={EFFECTIVE_BOTTOM_ITEM_WIDTH}
              snapToAlignment="center"
              contentContainerStyle={{ paddingHorizontal: SPACER_BOTTOM }}
              getItemLayout={(_, index) => ({
                length: EFFECTIVE_BOTTOM_ITEM_WIDTH,
                offset: EFFECTIVE_BOTTOM_ITEM_WIDTH * index,
                index,
              })}
              onScroll={RNAnimated.event(
                [{ nativeEvent: { contentOffset: { x: scrollXBottom } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleMomentumScrollEndBottom}
              renderItem={renderBottomItem}
            />
          ) : (
            <Text style={styles.noChallenges}>
              Aucun défi complété aujourd’hui.
            </Text>
          )}
        </View>

        {confettiRef.current && (
          <ConfettiCannon
            ref={confettiRef}
            count={150}
            origin={{ x: 200, y: 0 }}
            fadeOut
            explosionSpeed={800}
            fallSpeed={3000}
          />
        )}
      </RNAnimated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 40,
  },
  trophyContainer: { flexDirection: "row", alignItems: "center" },
  trophyText: {
    color: lightTheme.colors.trophy,
    fontSize: 20,
    marginLeft: 8,
    fontFamily: "Comfortaa_700Bold",
  },
  plusButton: { backgroundColor: "#3B82F6", borderRadius: 50, padding: 8 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 50 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: lightTheme.colors.primary,
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Comfortaa_700Bold",
  },
  noChallenges: {
    fontSize: 16,
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  /* Carousel du haut */
  topCarouselContainer: { marginTop: 10, marginBottom: 20 },
  topItemWrapper: { marginHorizontal: TOP_CARD_MARGIN, alignItems: "center" },
  topItemContainer: {
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#ccc",
  },
  topItemImage: { width: "100%", height: "100%" },
  topItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 15,
  },
  topItemTitle: {
    fontSize: 20,
    color: "#FFF",
    fontFamily: "Comfortaa_700Bold",
  },
  topItemParticipants: {
    fontSize: 16,
    color: "#FFD700",
    marginTop: 4,
    fontFamily: "Comfortaa_400Regular",
  },
  markTodayButton: {
    marginTop: 8,
    backgroundColor: "#e3701e",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    alignSelf: "center",
  },
  markTodayButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  /* Carousel du bas */
  bottomCarouselContainer: { marginTop: 10, marginBottom: 20 },
  bottomItemWrapper: {
    marginHorizontal: BOTTOM_CARD_MARGIN,
    alignItems: "center",
  },
  bottomItemContainer: {
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#ccc",
  },
  bottomItemImage: { width: "100%", height: "100%" },
  bottomItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 10,
  },
  bottomItemTitle: {
    fontSize: 18,
    color: "#FFF",
    fontFamily: "Comfortaa_700Bold",
  },
  bottomItemParticipants: {
    fontSize: 14,
    color: "#FFD700",
    marginTop: 2,
    fontFamily: "Comfortaa_400Regular",
  },
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  noImageText: {
    color: "#777",
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyTopContainer: {
    height: TOP_ITEM_HEIGHT + 40,
    paddingHorizontal: SPACER_TOP,
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 5,
    textAlign: "left",
    fontFamily: "Comfortaa_700Bold",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 5,
    textAlign: "left",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyList: { alignSelf: "flex-start" },
  emptyItem: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 3,
    textAlign: "left",
    fontFamily: "Comfortaa_400Regular",
  },
  linkText: {
    color: "#3B82F6",
    textDecorationLine: "underline",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
