import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated as RNAnimated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSharedValue, withTiming, useAnimatedStyle } from "react-native-reanimated";
import { runOnJS } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import TutorialModal from "../../components/TutorialModal";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle
  return Math.round(size * scale);
};

const TOP_ITEM_WIDTH = SCREEN_WIDTH * 0.8;
const BOTTOM_ITEM_WIDTH = SCREEN_WIDTH * 0.6;
const TOP_ITEM_HEIGHT = normalizeSize(280); // Ajusté pour responsivité
const BOTTOM_ITEM_HEIGHT = normalizeSize(200); // Ajusté pour responsivité

const EFFECTIVE_TOP_ITEM_WIDTH = TOP_ITEM_WIDTH + SPACING;
const EFFECTIVE_BOTTOM_ITEM_WIDTH = BOTTOM_ITEM_WIDTH + SPACING;

const SPACER_TOP = (SCREEN_WIDTH - TOP_ITEM_WIDTH) / 2;
const SPACER_BOTTOM = (SCREEN_WIDTH - BOTTOM_ITEM_WIDTH) / 2;

interface CurrentChallengeExtended {
  id: string;
  title: string;
  chatId?: string;
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
  const { t } = useTranslation();
  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();
  const router = useRouter();
  const { currentChallenges, markToday } = useCurrentChallenges();
  const { theme } = useTheme();
const scrollViewRef = useRef<ScrollView>(null);

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [isLoading, setIsLoading] = useState(true);
  const [userTrophies, setUserTrophies] = useState(0);
  const [challengeParticipants, setChallengeParticipants] = useState<{
    [key: string]: number;
  }>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const fadeAnim = useSharedValue(1);
 const animatedStyle = useAnimatedStyle(() => ({
   flex: 1,
   opacity: fadeAnim.value,
 }));

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const scrollXTop = useRef(new RNAnimated.Value(0)).current;
  const scrollXBottom = useRef(new RNAnimated.Value(0)).current;

  const flatListTopRef = useRef<RNAnimated.FlatList<any>>(null);
  const flatListBottomRef = useRef<RNAnimated.FlatList<any>>(null);

  const topAutoScrollRef = useRef<number | null>(null);
  const bottomAutoScrollRef = useRef<number | null>(null);

  const topIndexRef = useRef(0);
  const bottomIndexRef = useRef(0);

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

  const translatedChallenges = uniqueChallenges.map((item) => {
    const key = item.chatId || item.id;
    return {
      ...item,
      title: t(`challenges.${key}.title`, { defaultValue: item.title }),
      description: t(`challenges.${key}.description`, {
        defaultValue: item.description || "",
      }),
      category: item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("miscellaneous"),
    };
  });

  const notMarkedToday = translatedChallenges.filter(
    (ch) => ch.lastMarkedDate !== today
  );

  const markedToday = translatedChallenges.filter(
    (ch) => ch.lastMarkedDate === today
  );

  const handleNavigateToDetails = (item: CurrentChallengeExtended) => {
    navigateWithFade(`/challenge-details/${item.id}?title=${encodeURIComponent(item.title)}&selectedDays=${item.selectedDays}&completedDays=${item.completedDays}&category=${encodeURIComponent(item.category)}&description=${encodeURIComponent(item.description)}&imageUrl=${encodeURIComponent(item.imageUrl||"")}`);

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

    return () => unsubscribes.forEach((unsub) => unsub());
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

  useEffect(() => {
  fadeAnim.value = withTiming(1, { duration: 300 });
  setIsNavigating(false);
}, []);

useFocusEffect(
  useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [])
);

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
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("loadingChallenges")}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

const navigateWithFade = (path: string) => {
   if (isNavigating) return;
   setIsNavigating(true);
  fadeAnim.value = withTiming(0, { duration: 300 }, (finished) => {
    if (finished) {
       runOnJS(router.push)(path);
       // on rétablit l’opacité et le flag
       fadeAnim.value = 1;
       runOnJS(setIsNavigating)(false);
     }
   });
 };

  const renderTopItem = ({ item }: { item: CurrentChallengeExtended }) => (
    <RNAnimated.View style={styles.topItemWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.topItemContainer}
        onPress={() => handleNavigateToDetails(item)}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[
            styles.topItemGradient,
            {
              borderColor: isDarkMode
                ? currentTheme.colors.secondary
                : "#FF8C00",
            },
          ]}
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
                size={normalizeSize(60)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("imageNotAvailable")}
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
                size={normalizeSize(14)}
                color={currentTheme.colors.trophy}
              />
              {t("participant", {
                count: challengeParticipants[item.id] ?? item.participants ?? 0,
              })}
            </Text>
          </LinearGradient>
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
              {
                color: isDarkMode ? "#000000" : currentTheme.colors.textPrimary,
              },
            ]}
          >
            {t("markToday")}
          </Text>
        </TouchableOpacity>
      )}
    </RNAnimated.View>
  );

  const renderBottomItem = ({ item }: { item: CurrentChallengeExtended }) => (
    <RNAnimated.View style={styles.bottomItemWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.bottomItemContainer}
        onPress={() => handleNavigateToDetails(item)}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[
            styles.bottomItemGradient,
            {
              borderColor: isDarkMode
                ? currentTheme.colors.secondary
                : "#FF8C00",
            },
          ]}
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
                size={normalizeSize(40)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("imageNotAvailable")}
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
                size={normalizeSize(12)}
                color={currentTheme.colors.trophy}
              />
              {t("participant", {
                count: challengeParticipants[item.id] ?? item.participants ?? 0,
              })}
            </Text>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </RNAnimated.View>
  );
  return (
    <GlobalLayout>
      <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground + "F0",
        ]}
        style={styles.gradientContainer}
      >
        <View style={styles.headerWrapper}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={[
                styles.trophyContainer,
                {
                  backgroundColor: isDarkMode
                    ? currentTheme.colors.cardBackground
                    : "#FF8C00",
                  borderColor: isDarkMode ? currentTheme.colors.border : "#FFF",
                },
              ]}
              onPress={() => navigateWithFade("/profile")}
            >
              <Ionicons
                name="trophy-outline"
                size={normalizeSize(28)}
                color={isDarkMode ? currentTheme.colors.trophy : "#FFF"}
              />
              <Text
                style={[
                  styles.trophyText,
                  { color: isDarkMode ? currentTheme.colors.trophy : "#FFF" },
                ]}
              >
                {userTrophies}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.plusButton,
                { backgroundColor: currentTheme.colors.secondary },
              ]}
              onPress={() => navigateWithFade("/create-challenge")}
            >
              <Ionicons
                name="add-circle-outline"
                size={normalizeSize(28)}
                color={isDarkMode ? "#000000" : currentTheme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
        ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* === Carrousel haut : défis à faire === */}
          <View style={styles.topCarouselContainer}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000",
                }, // Blanc en dark, noir en light
              ]}
            >
              {t("dailyChallenges")}
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
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "F0",
                ]}
                style={styles.emptyTopContainer}
              >
                <Animated.View entering={FadeInUp.delay(100)}>
                  <Ionicons
                    name="create-outline"
                    size={normalizeSize(60)}
                    color={currentTheme.colors.textSecondary}
                    accessibilityLabel={t("noChallengesIcon")}
                  />
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("noOngoingChallenge")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("createPrompt")}
                  </Text>
                  <View style={styles.emptyList}>
                    <Text
                      style={[
                        styles.emptyItem,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      • {t("clickIconTopRight")}
                    </Text>
                    <Text
                      style={[
                        styles.emptyItem,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      •{" "}
                      <Text
                        style={[
                          styles.linkText,
                          { color: currentTheme.colors.secondary },
                        ]}
                        onPress={() => navigateWithFade("/explore")}
                      >
                        {t("orJoinChallenge")}
                      </Text>
                    </Text>
                  </View>
                </Animated.View>
              </LinearGradient>
            )}
          </View>

          {/* === Carrousel bas : défis complétés aujourd’hui === */}
          <View style={styles.bottomCarouselContainer}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000",
                }, // Blanc en dark, noir en light
              ]}
            >
              {t("completedChallengesScreenTitle")} {t("today")}
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
                {t("noCompletedChallenges")}
              </Text>
            )}
          </View>

          {/* === Confettis (célébration) === */}
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

        {/* === Tuto étape 3 === */}
        {isTutorialActive && tutorialStep === 3 && (
          <BlurView intensity={50} style={styles.blurView}>
            <TutorialModal
              step={tutorialStep}
              onNext={() => setTutorialStep(4)}
              onStart={() => {}}
              onSkip={skipTutorial}
              onFinish={skipTutorial}
            />
          </BlurView>
        )}
      </LinearGradient>
      </Animated.View>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5, // Aligné avec Notifications.tsx
    position: "relative",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trophyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
    paddingVertical: normalizeSize(8),
    borderRadius: normalizeSize(20),
    borderWidth: 1,
  },
  trophyText: {
    fontSize: normalizeSize(20),
    marginLeft: normalizeSize(8),
    fontFamily: "Comfortaa_700Bold",
  },
  plusButton: {
    borderRadius: normalizeSize(50),
    padding: normalizeSize(8),
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: normalizeSize(80),
    paddingTop: normalizeSize(10),
  },
  sectionTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginVertical: normalizeSize(12),
  },
  noChallenges: {
    fontSize: normalizeSize(18),
    textAlign: "center",
    marginVertical: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: normalizeSize(12),
  },
  dot: {
    width: normalizeSize(8),
    height: normalizeSize(8),
    borderRadius: normalizeSize(4),
    marginHorizontal: normalizeSize(6),
  },
  topCarouselContainer: {
    marginBottom: normalizeSize(20),
  },
  topItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  topItemContainer: {
    width: TOP_ITEM_WIDTH,
    height: TOP_ITEM_HEIGHT,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  topItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
    overflow: "hidden",
  },
  topItemImage: { width: "100%", height: "100%", resizeMode: "cover" },
  topItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: normalizeSize(12),
    alignItems: "center",
  },
  topItemTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topItemParticipants: {
    fontSize: normalizeSize(14),
    marginTop: normalizeSize(6),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  markTodayButton: {
    marginTop: normalizeSize(12),
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(16),
    borderRadius: normalizeSize(18),
  },
  markTodayButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
  },
  bottomCarouselContainer: {
    marginBottom: normalizeSize(30),
  },
  bottomItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  bottomItemContainer: {
    width: BOTTOM_ITEM_WIDTH,
    height: BOTTOM_ITEM_HEIGHT,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  bottomItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
    overflow: "hidden",
  },
  bottomItemImage: { width: "100%", height: "100%", resizeMode: "cover" },
  bottomItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: normalizeSize(10),
    alignItems: "center",
  },
  bottomItemTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomItemParticipants: {
    fontSize: normalizeSize(12),
    marginTop: normalizeSize(6),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    marginTop: normalizeSize(8),
    fontSize: normalizeSize(12),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyTopContainer: {
    height: TOP_ITEM_HEIGHT + normalizeSize(30),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
    borderRadius: normalizeSize(25),
  },
  emptyTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(6),
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  emptyList: {
    alignSelf: "center",
    marginTop: normalizeSize(8),
  },
  emptyItem: {
    fontSize: normalizeSize(16),
    marginBottom: normalizeSize(4),
    textAlign: "center",
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
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
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
    borderRadius: normalizeSize(25),
    padding: normalizeSize(20),
    width: SCREEN_WIDTH * 0.8,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: normalizeSize(24),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
    marginBottom: normalizeSize(12),
    textAlign: "center",
  },
  modalDescription: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    color: "#333",
    textAlign: "center",
    marginBottom: normalizeSize(20),
  },
  nextButton: {
    position: "absolute",
    bottom: normalizeSize(20),
    right: normalizeSize(20),
  },
});
