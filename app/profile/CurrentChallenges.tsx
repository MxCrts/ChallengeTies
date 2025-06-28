import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, {
  FadeInUp,
  FadeOutRight,
  ZoomIn,
} from "react-native-reanimated";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface Challenge {
  id: string;
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  day?: number;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { currentChallenges, markToday, removeChallenge, isMarkedToday } =
    useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const confettiRef = useRef<ConfettiCannon>(null);
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  // Log pour déboguer
  useEffect(() => {}, [currentChallenges]);

  const translatedChallenges = useMemo(() => {
    if (!currentChallenges || !Array.isArray(currentChallenges)) {
      return [];
    }

    // Filtrage assoupli : accepter les challenges avec id
    const validChallenges = currentChallenges.filter((item) => item.id);

    // Déduplication basée sur uniqueKey ou id_selectedDays
    const uniqueChallenges = Array.from(
      new Map(
        validChallenges.map((item) => [
          item.uniqueKey || `${item.id}_${item.selectedDays}`,
          item,
        ])
      ).values()
    ) as Challenge[];

    // Traduction des champs
    return uniqueChallenges.map((item) => ({
      ...item,
      title: item.chatId
        ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
        : item.title,
      description: item.chatId
        ? t(`challenges.${item.chatId}.description`, {
            defaultValue: item.description || "",
          })
        : item.description || "",
      category: item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("miscellaneous"),
    }));
  }, [currentChallenges, i18n.language, t]);

  useEffect(() => {
    setLocalChallenges(translatedChallenges);
    setIsLoading(false);
  }, [translatedChallenges]);

  const handleMarkToday = useCallback(
    async (id: string, selectedDays: number) => {
      try {
        const result = await markToday(id, selectedDays);
        if (result.success) {
          setConfettiActive(true);
        }
      } catch (err) {
        console.error("Erreur markToday:", err);
        Alert.alert(t("error"), t("markTodayFailed"));
      }
    },
    [markToday, t]
  );

  const handleRemove = useCallback(
    (id: string, selectedDays: number, index: number) => {
      Alert.alert(
        t("abandonChallenge"),
        t("abandonChallengeConfirm"),
        [
          {
            text: t("cancel"),
            style: "cancel",
            onPress: () => {
              swipeableRefs.current[index]?.close();
            },
          },
          {
            text: t("continue"),
            style: "destructive",
            onPress: async () => {
              try {
                setLocalChallenges((prev) =>
                  prev.filter(
                    (c) => !(c.id === id && c.selectedDays === selectedDays)
                  )
                );
                await removeChallenge(id, selectedDays);
                // Supprimé : await updateDoc(doc(db, "challenges", id), { participantsCount: increment(-1) });
                Alert.alert(t("abandoned"), t("challengeAbandoned"));
              } catch (err) {
                console.error("Erreur removeChallenge:", err);
                Alert.alert(t("error"), t("failedToAbandonChallenge"));
                swipeableRefs.current[index]?.close();
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [removeChallenge, t]
  );

  const navigateToDetail = useCallback(
    (item: Challenge) => {
      const titleParam = encodeURIComponent(item.title);
      const catParam = encodeURIComponent(item.category || "");
      const descParam = encodeURIComponent(item.description || "");
      const imgParam = encodeURIComponent(item.imageUrl || "");
      const route = `/challenge-details/${encodeURIComponent(
        item.id
      )}?title=${titleParam}&selectedDays=${item.selectedDays}&completedDays=${
        item.completedDays
      }&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;
      router.push(route);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => {
      const marked = isMarkedToday(item.id, item.selectedDays);
      const progress = item.completedDays / item.selectedDays;
      const key = `${item.id}_${item.selectedDays}`;
      const borderColor = isDarkMode
        ? currentTheme.colors.secondary
        : "#FF8C00";

      return (
        <Animated.View
          entering={ZoomIn.delay(index * 50)}
          exiting={FadeOutRight.duration(300)}
          style={styles.cardWrapper}
        >
          <View
            accessibilityLabel={`${t("challenge")} ${item.title}, ${t(
              "swipeToDelete"
            )}`}
            testID={`challenge-swipe-${key}`}
          >
            <Swipeable
              ref={(ref: any) => {
                swipeableRefs.current[index] = ref;
              }}
              renderRightActions={() => (
                <View style={styles.swipeActionsContainer}>
                  <LinearGradient
                    colors={["#EF4444", "#B91C1C"]}
                    style={styles.trashButton}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={normalizeSize(28)}
                      color="#fff"
                      accessibilityLabel={t("deleteChallenge")}
                    />
                  </LinearGradient>
                </View>
              )}
              overshootRight={false}
              onSwipeableOpen={() =>
                handleRemove(item.id, item.selectedDays, index)
              }
            >
              <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => navigateToDetail(item)}
                activeOpacity={0.8}
                accessibilityLabel={t("viewChallengeDetails", {
                  title: item.title,
                })}
                accessibilityHint={t("viewDetails")}
                accessibilityRole="button"
                testID={`challenge-card-${key}`}
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.cardBackground,
                    currentTheme.colors.cardBackground + "F0",
                  ]}
                  style={[styles.card, { borderColor }]}
                >
                  <Image
                    source={{
                      uri: item.imageUrl || "https://via.placeholder.com/70",
                    }}
                    style={styles.cardImage}
                    accessibilityLabel={t("challengeImage", {
                      title: item.title,
                    })}
                  />
                  <View style={styles.cardContent}>
                    <Text
                      style={[
                        styles.challengeTitle,
                        {
                          color: isDarkMode
                            ? currentTheme.colors.textPrimary
                            : "#000000",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {item.day !== undefined && (
                      <Text
                        style={[
                          styles.challengeDay,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {t("day")} {item.day}
                      </Text>
                    )}
                    <View style={styles.progressContainer}>
                      <Progress.Bar
                        progress={progress}
                        width={null}
                        height={normalizeSize(8)}
                        borderRadius={normalizeSize(4)}
                        color={currentTheme.colors.secondary}
                        unfilledColor={isDarkMode ? "#4A4A4A" : "#E0E0E0"}
                        borderWidth={0}
                        style={styles.progressBar}
                        accessibilityLabel={t("progress", {
                          completed: item.completedDays,
                          total: item.selectedDays,
                        })}
                      />
                      <Text
                        style={[
                          styles.progressText,
                          { color: currentTheme.colors.secondary },
                        ]}
                      >
                        {item.completedDays}/{item.selectedDays} {t("days")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.markTodayButton,
                        marked && styles.disabledMarkButton,
                      ]}
                      onPress={() =>
                        handleMarkToday(item.id, item.selectedDays)
                      }
                      disabled={marked}
                      accessibilityLabel={
                        marked
                          ? t("alreadyMarkedToday", { title: item.title })
                          : t("markToday", { title: item.title })
                      }
                      accessibilityHint={
                        marked ? t("alreadyMarked") : t("markTodayButton")
                      }
                      accessibilityRole="button"
                      testID={`mark-today-${key}`}
                    >
                      <LinearGradient
                        colors={
                          marked
                            ? isDarkMode
                              ? ["#4A4A4A", "#2A2A2A"]
                              : ["#000000", "#333333"]
                            : [
                                currentTheme.colors.secondary,
                                currentTheme.colors.primary,
                              ]
                        }
                        style={styles.markTodayGradient}
                      >
                        <Text
                          style={[
                            styles.markTodayText,
                            {
                              color: marked
                                ? "#FFFFFF"
                                : currentTheme.colors.textPrimary,
                              textAlign: "center",
                            },
                          ]}
                        >
                          {marked ? t("alreadyMarked") : t("markTodayButton")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Swipeable>
          </View>
        </Animated.View>
      );
    },
    [
      currentTheme,
      isMarkedToday,
      handleMarkToday,
      handleRemove,
      navigateToDetail,
      t,
      isDarkMode,
    ]
  );

  const renderEmptyState = useCallback(
    () => (
      <Animated.View
        entering={FadeInUp.delay(100)}
        style={styles.noChallengesContent}
      >
        <Ionicons
          name="hourglass-outline"
          size={normalizeSize(60)}
          color={currentTheme.colors.textSecondary}
          accessibilityLabel={t("waitingChallengeIcon")}
        />
        <Text
          style={[
            styles.noChallengesText,
            {
              color: isDarkMode
                ? currentTheme.colors.textPrimary
                : currentTheme.colors.textSecondary,
            },
          ]}
        >
          {t("noOngoingChallenge")}
        </Text>
        <Text
          style={[
            styles.noChallengesSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("startAChallenge")}
        </Text>
      </Animated.View>
    ),
    [currentTheme, t]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
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
            {t("loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground + "F0",
        ]}
        style={styles.container}
      >
        <View style={styles.headerWrapper}>
          <Animated.View entering={FadeInUp}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel={t("backButton")}
              accessibilityHint={t("backButtonHint")}
              testID="back-button"
            >
              <Ionicons
                name="arrow-back"
                size={normalizeSize(24)}
                color={currentTheme.colors.secondary}
              />
            </TouchableOpacity>
          </Animated.View>
          <CustomHeader title={t("ongoingChallenges")} />
        </View>
        {localChallenges.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={localChallenges}
            renderItem={renderItem}
            keyExtractor={(item) => `current-${item.id}_${item.selectedDays}`}
            contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: normalizeSize(ITEM_HEIGHT + SPACING * 1.5),
              offset: normalizeSize(ITEM_HEIGHT + SPACING * 1.5) * index,
              index,
            })}
            contentInset={{ top: SPACING, bottom: normalizeSize(100) }}
            accessibilityRole="list"
            accessibilityLabel={t("listOfOngoingChallenges")}
            testID="challenges-list"
          />
        )}
        {confettiActive && (
          <ConfettiCannon
            count={100}
            origin={{ x: -10, y: 0 }}
            autoStart
            fadeOut
            ref={confettiRef}
            onAnimationEnd={() => setConfettiActive(false)}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5,
    position: "relative",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareButton: {
    padding: normalizeSize(10),
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingBottom: normalizeSize(80),
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
  },
  noChallengesText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  cardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    alignSelf: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(18),
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
  },
  cardImage: {
    width: normalizeSize(70),
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    marginRight: SPACING * 1.2,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  challengeDay: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  progressContainer: {
    marginVertical: normalizeSize(10),
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(6),
  },
  markTodayButton: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  disabledMarkButton: {
    opacity: 0.7,
  },
  markTodayGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  markTodayText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
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
  swipeActionsContainer: {
    width: SCREEN_WIDTH * 0.2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
  },
  trashButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: normalizeSize(25),
  },
});
