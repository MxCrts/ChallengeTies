import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, { FadeInUp, FadeOutRight } from "react-native-reanimated";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next"; // 👈 import pour i18n
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.85;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.4;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
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
  const {
    currentChallenges,
    markToday,
    removeChallenge,
    isMarkedToday,
  } = useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const confettiRef = useRef<ConfettiCannon>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const { theme } = useTheme();
  const { t, i18n } = useTranslation(); // 👈 ajout de i18n
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Dès que currentChallenges ou la langue change, on reconstruit et traduit la liste
  useEffect(() => {
    if (!currentChallenges || !Array.isArray(currentChallenges)) {
      setLocalChallenges([]);
      setIsLoading(false);
      return;
    }

    // Dédupliquer
    const uniqueArr = Array.from(
      new Map(
        currentChallenges
          .filter((item) => item.id && item.selectedDays != null)
          .map((item) => [
            `${item.id}_${item.selectedDays}`,
            item as Challenge,
          ])
      ).values()
    );

    // Traduction de chaque champ
    const translated = uniqueArr.map((item) => ({
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

    setLocalChallenges(translated);
    setIsLoading(false);
  }, [currentChallenges, i18n.language]);

  // Nettoyage des refs Swipeable
  useEffect(() => {
    return () => {
      swipeableRefs.current.clear();
    };
  }, []);

  const handleMarkToday = async (id: string, selectedDays: number) => {
    try {
      const result = await markToday(id, selectedDays);
      if (result.success) {
        setConfettiActive(true);
      }
    } catch (err) {
      console.error(err);
      Alert.alert(t("error"), t("markTodayFailed"));
    }
  };

  const handleRemove = (id: string, selectedDays: number, key: string) => {
    Alert.alert(
      t("abandonChallenge"),
      t("abandonChallengeConfirm"),
      [
        {
          text: t("cancel"),
          style: "cancel",
          onPress: () => {
            swipeableRefs.current.get(key)?.close();
          },
        },
        {
          text: t("continue"),
          style: "destructive",
          onPress: async () => {
            try {
              setLocalChallenges((prev) =>
                prev.filter(
                  (c) =>
                    !(
                      c.id === id &&
                      c.selectedDays === selectedDays
                    )
                )
              );
              await removeChallenge(id, selectedDays);
              await updateDoc(doc(db, "challenges", id), {
                participantsCount: increment(-1),
              });
              Alert.alert(t("abandoned"), t("challengeAbandoned"));
            } catch (err) {
              console.error(err);
              Alert.alert(t("error"), t("failedToAbandonChallenge"));
              swipeableRefs.current.get(key)?.close();
            }
          },
        },
      ]
    );
  };

  const navigateToDetail = (item: Challenge) => {
    const titleParam = encodeURIComponent(item.title);
    const catParam = encodeURIComponent(item.category || "");
    const descParam = encodeURIComponent(item.description || "");
    const imgParam = encodeURIComponent(item.imageUrl || "");
    const route = `/challenge-details/${encodeURIComponent(
      item.id
    )}?title=${titleParam}&selectedDays=${
      item.selectedDays
    }&completedDays=${item.completedDays}&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;
    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: Challenge;
    index: number;
  }) => {
    const marked = isMarkedToday(item.id, item.selectedDays);
    const progress = item.completedDays / item.selectedDays;
    const key = `${item.id}_${item.selectedDays}`;

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50)}
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
            ref={(ref) => swipeableRefs.current.set(key, ref)}
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
              handleRemove(item.id, item.selectedDays, key)
            }
          >
            <TouchableOpacity
              style={styles.cardContainer}
              onPress={() => navigateToDetail(item)}
              activeOpacity={0.9}
              accessibilityLabel={`${t("viewChallengeDetails")} ${
                item.title
              }`}
              testID={`challenge-card-${key}`}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  `${currentTheme.colors.cardBackground}F0`,
                ]}
                style={styles.card}
              >
                <Image
                  source={{
                    uri: item.imageUrl || "https://via.placeholder.com/70",
                  }}
                  style={styles.cardImage}
                  accessibilityLabel={`${t("challengeImage")} ${
                    item.title
                  }`}
                />
                <View style={styles.cardContent}>
                  <Text
                    style={[
                      styles.challengeTitle,
                      { color: currentTheme.colors.textPrimary },
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
                      unfilledColor={
                        isDarkMode ? "#4A4A4A" : "#E0E0E0"
                      }
                      borderWidth={0}
                      style={styles.progressBar}
                    />
                    <Text
                      style={[
                        styles.progressText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {item.completedDays}/{item.selectedDays}{" "}
                      {t("days")}
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
                        ? `${t("alreadyMarkedToday")} ${item.title}`
                        : `${t("markToday")} ${item.title}`
                    }
                    testID={`mark-today-${key}`}
                  >
                    <LinearGradient
                      colors={
                        marked
                          ? [
                              isDarkMode ? "#4A4A4A" : "#D3D3D3",
                              isDarkMode ? "#2A2A2A" : "#A3A3A3",
                            ]
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
                          },
                        ]}
                      >
                        {marked
                          ? t("alreadyMarked")
                          : t("markTodayButton")}
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
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent={true}
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
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (localChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent={true}
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)}>
            <Ionicons
              name="hourglass-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
              accessibilityLabel={t("waitingChallengeIcon")}
            />
            <Text
              style={[
                styles.noChallengesText,
                { color: currentTheme.colors.textPrimary },
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
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          `${currentTheme.colors.cardBackground}F0`,
        ]}
        style={styles.container}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("ongoingChallenges")} />
        </View>
        <FlatList
          data={localChallenges}
          renderItem={renderItem}
          keyExtractor={(item) =>
            `current-${item.id}_${item.selectedDays}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          getItemLayout={(data, index) => ({
            length: normalizeSize(ITEM_HEIGHT + SPACING),
            offset:
              normalizeSize(ITEM_HEIGHT + SPACING) * index,
            index,
          })}
          accessibilityRole="list"
          accessibilityLabel={t("listOfOngoingChallenges")}
          testID="challenges-list"
        />
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
  container: { flex: 1, paddingHorizontal: SPACING },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  listContent: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING / 2,
    paddingBottom: SPACING * 2,
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesContent: {
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING,
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  cardWrapper: {
    marginBottom: SPACING,
    borderRadius: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    alignSelf: "center",
  },
  card: {
    flexDirection: "row",
    padding: SPACING,
    borderRadius: normalizeSize(20),
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(12),
    marginRight: SPACING,
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  challengeDay: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(2),
  },
  progressContainer: {
    marginVertical: SPACING / 2,
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(12),
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  markTodayButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: SPACING / 2,
  },
  disabledMarkButton: {},
  markTodayGradient: {
    paddingVertical: SPACING / 1.5,
    paddingHorizontal: SPACING,
    alignItems: "center",
  },
  markTodayText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING,
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  swipeActionsContainer: {
    width: SCREEN_WIDTH * 0.18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
  },
  trashButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: normalizeSize(20),
  },
});