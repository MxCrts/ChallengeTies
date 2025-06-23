import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface Stat {
  name: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  accessibilityHint: string;
}

interface UserDoc {
  longestStreak?: number;
  trophies?: number;
  achievements?: string[];
}

interface Challenge {
  id: string;
  selectedDays: number;
  completedDays?: number;
}

export default function UserStats() {
  const { t } = useTranslation();
  const router = useRouter();
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();
  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        setUserDoc(snapshot.exists() ? (snapshot.data() as UserDoc) : null);
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur onSnapshot:", error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Calcul des stats
  const computedStats: Stat[] = useMemo(() => {
    if (!userDoc) return [];

    const uniqueOngoing = new Map(
      currentChallenges.map((ch: Challenge) => [
        `${ch.id}_${ch.selectedDays}`,
        ch,
      ])
    );

    const totalSaved = savedChallenges.length;
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (challenge: Challenge) =>
        challenge.completedDays === challenge.selectedDays
    ).length;

    const successRate =
      totalOngoing + totalCompleted > 0
        ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
        : 0;

    const longestStreak = userDoc.longestStreak || 0;
    const trophies = userDoc.trophies || 0;
    const achievementsUnlocked = userDoc.achievements?.length || 0;

    return [
      {
        name: t("savedChallenges"),
        value: totalSaved,
        icon: "bookmark-outline",
        accessibilityLabel: t("savedChallenges"),
        accessibilityHint: t("statDescription.savedChallenges"),
      },
      {
        name: t("ongoingChallenges"),
        value: totalOngoing,
        icon: "hourglass-outline",
        accessibilityLabel: t("ongoingChallenges"),
        accessibilityHint: t("statDescription.ongoingChallenges"),
      },
      {
        name: t("completedChallenges"),
        value: totalCompleted,
        icon: "trophy-outline",
        accessibilityLabel: t("completedChallenges"),
        accessibilityHint: t("statDescription.completedChallenges"),
      },
      {
        name: t("successRate"),
        value: `${successRate}%`,
        icon: "stats-chart-outline",
        accessibilityLabel: t("successRate"),
        accessibilityHint: t("statDescription.successRate"),
      },
      {
        name: t("trophies"),
        value: trophies,
        icon: "medal-outline",
        accessibilityLabel: t("trophies"),
        accessibilityHint: t("statDescription.trophies"),
      },
      {
        name: t("unlockedAchievements"),
        value: achievementsUnlocked,
        icon: "ribbon-outline",
        accessibilityLabel: t("unlockedAchievements"),
        accessibilityHint: t("statDescription.unlockedAchievements"),
      },
      {
        name: t("longestStreak"),
        value: `${longestStreak} ${t("days")}`,
        icon: "flame-outline",
        accessibilityLabel: t("longestStreak"),
        accessibilityHint: t("statDescription.longestStreak"),
      },
    ];
  }, [savedChallenges, currentChallenges, userDoc, t]);
  useEffect(() => {
    setStats(computedStats);
  }, [computedStats]);
  // Partage des stats
  const handleShareStats = useCallback(async () => {
    try {
      await Share.share({
        message: t("shareStatsMessage"), // à ajouter dans ton fichier de traductions
        url: `https://challengeme.com/stats/${auth.currentUser?.uid}`,
        title: t("statistics"),
      });
    } catch (error) {
      console.error("Erreur lors du partage :", error);
    }
  }, [t]);

  const metadata = useMemo(
    () => ({
      title: t("statistics"),
      description: t("shareStatsMessage"),
      url: `https://challengeme.com/stats/${auth.currentUser?.uid}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: t("statistics"),
        description: t("shareStatsMessage"),
      },
    }),
    [t]
  );

  const renderStat = useCallback(
    ({ item, index }: { item: Stat; index: number }) => (
      <Animated.View
        entering={ZoomIn.delay(index * 50)}
        style={styles.statCardWrapper}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[
            styles.statCard,
            {
              borderColor: isDarkMode
                ? currentTheme.colors.secondary
                : "#FF8C00",
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: currentTheme.colors.secondary + "1A" },
            ]}
          >
            <Ionicons
              name={item.icon}
              size={normalizeSize(36)}
              color={currentTheme.colors.secondary}
              accessibilityLabel={item.accessibilityLabel}
              accessibilityHint={item.accessibilityHint}
            />
          </View>
          <View style={styles.statContent}>
            <Text
              style={[
                styles.statName,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000", // Noir en light theme
                },
              ]}
              accessibilityLabel={item.accessibilityLabel}
              accessibilityHint={item.accessibilityHint}
            >
              {item.name}
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: currentTheme.colors.secondary },
              ]}
              accessibilityLabel={item.accessibilityLabel + "Value"}
              accessibilityHint={item.accessibilityHint}
            >
              {item.value}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    ),
    [currentTheme, isDarkMode]
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
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("loadingProfile")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!userDoc) {
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
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)}>
            <Ionicons
              name="alert-circle-outline"
              size={normalizeSize(40)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.emptyText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("profileLoadError")}
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("tryAgain")}
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
          <CustomHeader title={t("statistics")} />
          <Animated.View entering={ZoomIn.delay(200)}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareStats}
              accessibilityLabel={t("shareStatsButton")}
              accessibilityHint={t("shareStatsHint")}
              accessibilityRole="button"
              testID="share-stats"
            >
              <Ionicons
                name="share-social"
                size={normalizeSize(24)}
                color={currentTheme.colors.secondary}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
        <FlatList
          data={stats}
          renderItem={renderStat}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={7}
          maxToRenderPerBatch={7}
          windowSize={5}
          getItemLayout={(data, index) => ({
            length: normalizeSize(100),
            offset: normalizeSize(100) * index,
            index,
          })}
          contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay premium
    borderRadius: normalizeSize(20),
  },
  shareButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    right: SPACING,
    padding: SPACING / 2,
  },
  listContainer: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SPACING / 2,
    paddingBottom: normalizeSize(60),
  },
  statCardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(20),
    paddingHorizontal: normalizeSize(18),
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    borderWidth: 2.5,
  },
  iconContainer: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(30),
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING * 1.2,
    backgroundColor: "#FFDD95" + "20",
  },
  statContent: {
    flex: 1,
  },
  statName: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalizeSize(4),
    textAlign: "left",
  },
  statValue: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "left",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING * 2,
  },
  emptyText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING,
  },
  emptySubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    opacity: 0.8,
  },
});
