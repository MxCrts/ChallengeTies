import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
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
import { useTheme } from "../../context/ThemeContext"; // Ajout de useTheme
import { Theme } from "../../theme/designSystem"; // Import de l'interface Theme
import GlobalLayout from "../../components/GlobalLayout"; // Ajout de GlobalLayout
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Hauteurs dynamiques basées sur SCREEN_HEIGHT
const TOP_ITEM_HEIGHT = Math.round(SCREEN_HEIGHT * 0.35);
const BOTTOM_ITEM_HEIGHT = Math.round(SCREEN_HEIGHT * 0.25);
const TOP_ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.8);
const BOTTOM_ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_MARGIN = Math.round(SCREEN_WIDTH * 0.015);
const EFFECTIVE_TOP_ITEM_WIDTH = TOP_ITEM_WIDTH + CARD_MARGIN * 2;
const EFFECTIVE_BOTTOM_ITEM_WIDTH = BOTTOM_ITEM_WIDTH + CARD_MARGIN * 2;
const SPACER_TOP = (SCREEN_WIDTH - TOP_ITEM_WIDTH) / 2;
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
  const { theme } = useTheme(); // Ajout de useTheme
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme; // Typage avec Theme
  const [userTrophies, setUserTrophies] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const scrollXTop = useRef(new RNAnimated.Value(0)).current;
  const scrollXBottom = useRef(new RNAnimated.Value(0)).current;
  const flatListTopRef = useRef<RNAnimated.FlatList<any>>(null);
  const flatListBottomRef = useRef<RNAnimated.FlatList<any>>(null);
  const topAutoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const bottomAutoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const topIndexRef = useRef<number>(0);
  const bottomIndexRef = useRef<number>(0);

  const [challengeParticipants, setChallengeParticipants] = useState<{
    [key: string]: number;
  }>({});

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

  const startTopAutoScroll = useCallback(() => {
    if (notMarkedToday.length <= 1) return;
    if (topAutoScrollRef.current) clearInterval(topAutoScrollRef.current);
    topAutoScrollRef.current = setInterval(() => {
      let nextIndex = topIndexRef.current + 1;
      if (nextIndex >= notMarkedToday.length) nextIndex = 0;
      topIndexRef.current = nextIndex;
      flatListTopRef.current?.scrollToOffset({
        offset: nextIndex * EFFECTIVE_TOP_ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [notMarkedToday]);

  const startBottomAutoScroll = useCallback(() => {
    if (markedToday.length <= 1) return;
    if (bottomAutoScrollRef.current) clearInterval(bottomAutoScrollRef.current);
    bottomAutoScrollRef.current = setInterval(() => {
      let nextIndex = bottomIndexRef.current + 1;
      if (nextIndex >= markedToday.length) nextIndex = 0;
      bottomIndexRef.current = nextIndex;
      flatListBottomRef.current?.scrollToOffset({
        offset: nextIndex * EFFECTIVE_BOTTOM_ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [markedToday]);

  useEffect(() => {
    startTopAutoScroll();
    startBottomAutoScroll();
    return () => {
      if (topAutoScrollRef.current) clearInterval(topAutoScrollRef.current);
      if (bottomAutoScrollRef.current)
        clearInterval(bottomAutoScrollRef.current);
    };
  }, [notMarkedToday, markedToday, startTopAutoScroll, startBottomAutoScroll]);

  const handleScrollBeginDragTop = () => {
    if (topAutoScrollRef.current) {
      clearInterval(topAutoScrollRef.current);
      topAutoScrollRef.current = null;
    }
  };

  const handleScrollBeginDragBottom = () => {
    if (bottomAutoScrollRef.current) {
      clearInterval(bottomAutoScrollRef.current);
      bottomAutoScrollRef.current = null;
    }
  };

  const handleMomentumScrollEndTop = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_TOP_ITEM_WIDTH);
    topIndexRef.current = index;
    flatListTopRef.current?.scrollToOffset({
      offset: index * EFFECTIVE_TOP_ITEM_WIDTH,
      animated: true,
    });
    if (!topAutoScrollRef.current) {
      setTimeout(() => startTopAutoScroll(), 2000);
    }
  };

  const handleMomentumScrollEndBottom = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_BOTTOM_ITEM_WIDTH);
    bottomIndexRef.current = index;
    flatListBottomRef.current?.scrollToOffset({
      offset: index * EFFECTIVE_BOTTOM_ITEM_WIDTH,
      animated: true,
    });
    if (!bottomAutoScrollRef.current) {
      setTimeout(() => startBottomAutoScroll(), 2000);
    }
  };

  if (isLoading) {
    return (
      <GlobalLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.colors.trophy} />
        </View>
      </GlobalLayout>
    );
  }

  const renderTopItem = ({
    item,
    index,
  }: {
    item: CurrentChallengeExtended;
    index: number;
  }) => {
    return (
      <RNAnimated.View style={[styles.topItemWrapper]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.topItemContainer,
            {
              backgroundColor: currentTheme.colors.cardBackground,
              borderColor: currentTheme.colors.secondary,
            },
          ]}
          onPress={() => handleNavigateToDetails(item)}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.topItemImage}
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: currentTheme.colors.border },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={normalizeFont(60)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Image non disponible
              </Text>
            </View>
          )}
          <LinearGradient
            colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
            style={styles.topItemOverlay}
          >
            <Text
              style={[
                styles.topItemTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.topItemParticipants,
                { color: currentTheme.colors.trophy },
              ]}
            >
              <Ionicons
                name="people"
                size={normalizeFont(14)}
                color={currentTheme.colors.trophy}
              />{" "}
              {challengeParticipants[item.id] ?? item.participants ?? 0}{" "}
              {(challengeParticipants[item.id] ?? item.participants ?? 0) === 1
                ? "participant"
                : "participants"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {item.lastMarkedDate !== today && (
          <TouchableOpacity
            style={[
              styles.markTodayButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={() => markToday(item.id, item.selectedDays)}
          >
            <Text
              style={[
                styles.markTodayButtonText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Marquer Aujourd'hui
            </Text>
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
    return (
      <RNAnimated.View style={[styles.bottomItemWrapper]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.bottomItemContainer,
            {
              backgroundColor: currentTheme.colors.cardBackground,
              borderColor: currentTheme.colors.secondary,
            },
          ]}
          onPress={() => handleNavigateToDetails(item)}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bottomItemImage}
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: currentTheme.colors.border },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={normalizeFont(40)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Image non disponible
              </Text>
            </View>
          )}
          <LinearGradient
            colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
            style={styles.bottomItemOverlay}
          >
            <Text
              style={[
                styles.bottomItemTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.bottomItemParticipants,
                { color: currentTheme.colors.trophy },
              ]}
            >
              <Ionicons
                name="people"
                size={normalizeFont(12)}
                color={currentTheme.colors.trophy}
              />{" "}
              {challengeParticipants[item.id] ?? item.participants ?? 0}{" "}
              {(challengeParticipants[item.id] ?? item.participants ?? 0) === 1
                ? "participant"
                : "participants"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  };

  return (
    <GlobalLayout>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.gradientContainer}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.trophyContainer}
            onPress={() => router.push("/profile")}
          >
            <Ionicons
              name="trophy-outline"
              size={normalizeFont(24)}
              color={currentTheme.colors.trophy}
            />
            <Text
              style={[styles.trophyText, { color: currentTheme.colors.trophy }]}
            >
              {userTrophies}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.plusButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={() => router.push("/create-challenge")}
          >
            <Ionicons
              name="add-circle-outline"
              size={normalizeFont(28)}
              color={currentTheme.colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Carousel du haut */}
          <View style={styles.topCarouselContainer}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Challenges du jour
            </Text>
            {notMarkedToday.length > 0 ? (
              <>
                <RNAnimated.FlatList
                  ref={flatListTopRef}
                  data={notMarkedToday}
                  keyExtractor={(item) => item.uniqueKey!}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  bounces={false}
                  snapToInterval={EFFECTIVE_TOP_ITEM_WIDTH}
                  snapToAlignment="center"
                  contentContainerStyle={{ paddingHorizontal: SPACER_TOP }}
                  onScroll={RNAnimated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollXTop } } }],
                    { useNativeDriver: true }
                  )}
                  scrollEventThrottle={16}
                  onScrollBeginDrag={handleScrollBeginDragTop}
                  onMomentumScrollEnd={handleMomentumScrollEndTop}
                  renderItem={renderTopItem}
                />
                <View style={styles.pagination}>
                  {notMarkedToday.map((_, index) => (
                    <RNAnimated.View
                      key={index}
                      style={[
                        styles.dot,
                        { backgroundColor: currentTheme.colors.secondary },
                        {
                          opacity: scrollXTop.interpolate({
                            inputRange: [
                              (index - 1) * EFFECTIVE_TOP_ITEM_WIDTH,
                              index * EFFECTIVE_TOP_ITEM_WIDTH,
                              (index + 1) * EFFECTIVE_TOP_ITEM_WIDTH,
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
              <View style={styles.emptyTopContainer}>
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  Aucun défi en cours.
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Pour créer un défi :
                </Text>
                <View style={styles.emptyList}>
                  <Text
                    style={[
                      styles.emptyItem,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    • Cliquez sur l'icône{" "}
                    <Ionicons
                      name="add-circle-outline"
                      size={normalizeFont(14)}
                      color={currentTheme.colors.secondary}
                    />{" "}
                    en haut à droite
                  </Text>
                  <Text
                    style={[
                      styles.emptyItem,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    • Ou{" "}
                    <Text
                      style={[
                        styles.linkText,
                        { color: currentTheme.colors.secondary },
                      ]}
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
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Défis complétés aujourd’hui
            </Text>
            {markedToday.length > 0 ? (
              <>
                <RNAnimated.FlatList
                  ref={flatListBottomRef}
                  data={markedToday}
                  keyExtractor={(item) => item.uniqueKey!}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  bounces={false}
                  snapToInterval={EFFECTIVE_BOTTOM_ITEM_WIDTH}
                  snapToAlignment="center"
                  contentContainerStyle={{ paddingHorizontal: SPACER_BOTTOM }}
                  onScroll={RNAnimated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollXBottom } } }],
                    { useNativeDriver: true }
                  )}
                  scrollEventThrottle={16}
                  onScrollBeginDrag={handleScrollBeginDragBottom}
                  onMomentumScrollEnd={handleMomentumScrollEndBottom}
                  renderItem={renderBottomItem}
                />
                <View style={styles.pagination}>
                  {markedToday.map((_, index) => (
                    <RNAnimated.View
                      key={index}
                      style={[
                        styles.dot,
                        { backgroundColor: currentTheme.colors.secondary },
                        {
                          opacity: scrollXBottom.interpolate({
                            inputRange: [
                              (index - 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
                              index * EFFECTIVE_BOTTOM_ITEM_WIDTH,
                              (index + 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
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
              <Text
                style={[
                  styles.noChallenges,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Aucun défi complété aujourd’hui.
              </Text>
            )}
          </View>

          {confettiRef.current && (
            <ConfettiCannon
              ref={confettiRef}
              count={150}
              origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
              fadeOut
              explosionSpeed={800}
              fallSpeed={3000}
            />
          )}
        </ScrollView>
      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  headerContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingTop: SCREEN_HEIGHT * 0.02,
  },
  trophyContainer: { flexDirection: "row", alignItems: "center" },
  trophyText: {
    fontSize: normalizeFont(18),
    marginLeft: SCREEN_WIDTH * 0.02,
    fontFamily: "Comfortaa_700Bold",
  },
  plusButton: {
    borderRadius: 50,
    padding: SCREEN_WIDTH * 0.015,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollContainer: { flex: 1 },
  scrollContent: {
    paddingBottom: SCREEN_HEIGHT * 0.05,
    paddingTop: SCREEN_HEIGHT * 0.01,
  },
  sectionTitle: {
    fontSize: normalizeFont(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginVertical: SCREEN_HEIGHT * 0.015,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  noChallenges: {
    fontSize: normalizeFont(14),
    textAlign: "center",
    marginVertical: SCREEN_HEIGHT * 0.02,
    fontFamily: "Comfortaa_400Regular",
  },
  /* Carousel du haut */
  topCarouselContainer: { marginBottom: SCREEN_HEIGHT * 0.02 },
  topItemWrapper: {
    marginHorizontal: CARD_MARGIN,
    alignItems: "center",
  },
  topItemContainer: {
    width: TOP_ITEM_WIDTH,
    height: TOP_ITEM_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
  },
  topItemImage: { width: "100%", height: "100%", resizeMode: "cover" },
  topItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: SCREEN_WIDTH * 0.03,
    alignItems: "center",
  },
  topItemTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topItemParticipants: {
    fontSize: normalizeFont(14),
    marginTop: SCREEN_WIDTH * 0.01,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  markTodayButton: {
    marginTop: SCREEN_HEIGHT * 0.01,
    paddingVertical: SCREEN_HEIGHT * 0.01,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markTodayButtonText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_700Bold",
  },
  /* Carousel du bas */
  bottomCarouselContainer: { marginBottom: SCREEN_HEIGHT * 0.02 },
  bottomItemWrapper: {
    marginHorizontal: CARD_MARGIN,
    alignItems: "center",
  },
  bottomItemContainer: {
    width: BOTTOM_ITEM_WIDTH,
    height: BOTTOM_ITEM_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
  },
  bottomItemImage: { width: "100%", height: "100%", resizeMode: "cover" },
  bottomItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: SCREEN_WIDTH * 0.025,
    alignItems: "center",
  },
  bottomItemTitle: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomItemParticipants: {
    fontSize: normalizeFont(12),
    marginTop: SCREEN_WIDTH * 0.01,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    marginTop: SCREEN_WIDTH * 0.02,
    fontSize: normalizeFont(12),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyTopContainer: {
    height: TOP_ITEM_HEIGHT + SCREEN_HEIGHT * 0.05,
    paddingHorizontal: SPACER_TOP,
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SCREEN_HEIGHT * 0.01,
    textAlign: "left",
  },
  emptySubtitle: {
    fontSize: normalizeFont(14),
    marginBottom: SCREEN_HEIGHT * 0.01,
    textAlign: "left",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyList: { alignSelf: "flex-start" },
  emptyItem: {
    fontSize: normalizeFont(14),
    marginBottom: SCREEN_HEIGHT * 0.005,
    textAlign: "left",
    fontFamily: "Comfortaa_400Regular",
  },
  linkText: {
    textDecorationLine: "underline",
    fontFamily: "Comfortaa_700Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  dot: {
    width: normalizeFont(6),
    height: normalizeFont(6),
    borderRadius: normalizeFont(3),
    marginHorizontal: SCREEN_WIDTH * 0.015,
  },
});
