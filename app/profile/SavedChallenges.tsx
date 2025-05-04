import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Progress from "react-native-progress";
import Animated, { FadeInUp, FadeOutRight } from "react-native-reanimated";
import {
  useSavedChallenges,
  Challenge as ContextChallenge,
} from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import BackButton from "../../components/BackButton";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 15;
const ITEM_WIDTH = SCREEN_WIDTH - SPACING * 2;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SPACING / 2;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function SavedChallengesScreen() {
  const { t, i18n } = useTranslation();
  const { savedChallenges, removeChallenge } = useSavedChallenges();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Traduction à chaque changement de langue
  useEffect(() => {
    if (savedChallenges !== undefined) {
      setIsLoading(false);
      if (savedChallenges.length === 0) {
        Alert.alert(t("savedChallenges"), t("saveChallengesToSeeHere"));
      }
    }
  }, [savedChallenges, t, i18n.language]);

  const dynamicStyles = useMemo(
    () => ({
      card: {
        flexDirection: "row" as const,
        padding: SPACING,
        borderRadius: normalizeSize(12),
        borderWidth: 1,
        borderColor: currentTheme.colors.border,
        minHeight: ITEM_HEIGHT,
      },
      cardImage: {
        width: normalizeSize(70),
        height: normalizeSize(70),
        borderRadius: normalizeSize(12),
        marginRight: SPACING,
        borderWidth: 1,
        borderColor: currentTheme.colors.border,
      },
    }),
    [currentTheme]
  );

  const navigateToChallengeDetails = useCallback(
    (item: ContextChallenge) => {
      // on récupère la traduction du titre et description
      const titleTrans = item.chatId
        ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
        : item.title;
      const descTrans = item.chatId
        ? t(`challenges.${item.chatId}.description`, {
            defaultValue: item.description || "",
          })
        : item.description || "";
      const catTrans = item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("noCategory");

      const selectedDays =
        item.daysOptions && item.daysOptions.length > 0
          ? item.daysOptions[0]
          : 7;
      const completedDays = 0;
      const route =
        `/challenge-details/${encodeURIComponent(item.id)}` +
        `?title=${encodeURIComponent(titleTrans)}` +
        `&selectedDays=${selectedDays}` +
        `&completedDays=${completedDays}` +
        `&category=${encodeURIComponent(catTrans)}` +
        `&description=${encodeURIComponent(descTrans)}` +
        `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
      router.push(route as any);
    },
    [router, t]
  );

  const handleRemoveChallenge = useCallback(
    (challengeId: string, index: number) => {
      Alert.alert(
        t("deleteChallenge"),
        t("deleteChallengeConfirm"),
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
                await removeChallenge(challengeId);
                Alert.alert(t("deleted"), t("challengeDeletedSuccess"));
              } catch (err) {
                console.error(err);
                Alert.alert(t("error"), t("failedToDeleteChallenge"));
                swipeableRefs.current[index]?.close();
              }
            },
          },
        ]
      );
    },
    [removeChallenge, t]
  );

  const renderChallengeItem = useCallback(
    ({ item, index }: { item: ContextChallenge; index: number }) => {
      const titleTrans = item.chatId
        ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
        : item.title;
      const catTrans = item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("noCategory");

      const selectedDays =
        item.daysOptions && item.daysOptions.length > 0
          ? item.daysOptions[0]
          : 7;
      const completedDays = 0;
      const progress = completedDays / selectedDays;

      return (
        <Animated.View
          entering={FadeInUp.delay(index * 100)}
          exiting={FadeOutRight.duration(300)}
          style={styles.cardWrapper}
        >
          <Swipeable
            ref={(ref) => (swipeableRefs.current[index] = ref)}
            renderRightActions={() => (
              <View style={styles.swipeActionsContainer}>
                <TouchableOpacity
                  style={styles.trashButton}
                  onPress={() => handleRemoveChallenge(item.id, index)}
                  accessibilityLabel={t("deleteChallenge")}
                  accessibilityHint={t("deleteChallengeConfirm")}
                  testID={`trash-button-${index}`}
                >
                  <LinearGradient
                    colors={[currentTheme.colors.error, currentTheme.colors.error]}
                    style={styles.trashButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={normalizeSize(28)}
                      color={currentTheme.colors.textPrimary}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            overshootRight={false}
            onSwipeableOpen={() => handleRemoveChallenge(item.id, index)}
          >
            <TouchableOpacity
              style={styles.cardContainer}
              onPress={() => navigateToChallengeDetails(item)}
              activeOpacity={0.9}
              accessibilityLabel={t("viewChallengeDetails")}
              accessibilityHint={t("viewChallengeDetails")}
              testID={`challenge-card-${index}`}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.overlay,
                ]}
                style={dynamicStyles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image
                  source={{
                    uri: item.imageUrl || "https://via.placeholder.com/70",
                  }}
                  style={dynamicStyles.cardImage}
                />
                <View style={styles.cardContent}>
                  <Text
                    style={[
                      styles.challengeTitle,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {titleTrans}
                  </Text>
                  <Text
                    style={[
                      styles.challengeCategory,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {catTrans}
                  </Text>
                  <View style={styles.progressContainer}>
                    <Progress.Bar
                      progress={progress}
                      width={null}
                      height={normalizeSize(8)}
                      borderRadius={normalizeSize(4)}
                      color={currentTheme.colors.secondary}
                      unfilledColor={currentTheme.colors.border}
                      borderWidth={0}
                      style={styles.progressBar}
                    />
                    <Text
                      style={[
                        styles.progressText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {completedDays}/{selectedDays} {t("days")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => navigateToChallengeDetails(item)}
                    accessibilityLabel={t("viewDetails")}
                    accessibilityHint={t("viewChallengeDetails")}
                    testID={`view-details-button-${index}`}
                  >
                    <LinearGradient
                      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                      style={styles.viewButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text
                        style={[
                          styles.viewButtonText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        {t("viewDetails")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Swipeable>
        </Animated.View>
      );
    },
    [
      currentTheme,
      dynamicStyles,
      navigateToChallengeDetails,
      handleRemoveChallenge,
      t,
    ]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.loadingContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          <Text
            style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}
          >
            {t("loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (savedChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.noChallengesContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.noChallengesContent}>
            <Ionicons
              name="bookmark-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[styles.noChallengesText, { color: currentTheme.colors.textPrimary }]}
            >
              {t("noSavedChallenges")}
            </Text>
            <Text
              style={[styles.noChallengesSubtext, { color: currentTheme.colors.textSecondary }]}
            >
              {t("saveChallengesToSeeHere")}
            </Text>
          </Animated.View>
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
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <BackButton color={currentTheme.colors.textPrimary} />
          <CustomHeader title={t("savedChallengesScreenTitle")} />
        </View>
        <FlatList
          data={savedChallenges}
          renderItem={renderChallengeItem}
          keyExtractor={(item, idx) => `saved-${item.id}-${idx}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerWrapper: {
    marginTop: SPACING,
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
    position: "relative",
  },
  listContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  cardWrapper: {
    marginBottom: CARD_MARGIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    alignSelf: "center",
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
  },
  challengeCategory: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
    textTransform: "capitalize",
  },
  progressContainer: {
    marginVertical: SPACING,
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(12),
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  viewButton: {
    borderRadius: normalizeSize(8),
    overflow: "hidden",
    marginTop: SPACING,
  },
  viewButtonGradient: {
    paddingVertical: SPACING / 1.5,
    paddingHorizontal: SPACING,
    alignItems: "center",
  },
  viewButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
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
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  swipeActionsContainer: {
    width: SCREEN_WIDTH * 0.18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: CARD_MARGIN,
  },
  trashButton: {
    width: "100%",
    height: "100%",
    borderRadius: normalizeSize(12),
  },
  trashButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});