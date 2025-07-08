import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ZoomIn, FadeInUp } from "react-native-reanimated";
import { db, auth } from "../../constants/firebase-config";
import { useTrophy } from "../../context/TrophyContext";
import { achievementsList } from "../../helpers/achievementsConfig";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

const SPACING = 18; // Aligné avec CompletedChallenges.tsx
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle
  return Math.round(size * scale);
};
interface Achievement {
  id: string;
  identifier: string;
  trophies: number;
  isClaimable: boolean;
  isCompleted: boolean;
}

interface AchievementSection {
  title: string;
  data: Achievement[];
  index: number;
}

const groupAchievements = (identifier: string) => {
  if (identifier === "first_connection" || identifier === "profile_completed")
    return "débuts";
  if (identifier.startsWith("finishChallenge_")) return "defisTermines";
  if (identifier.startsWith("selectChallengeDays_")) return "engagement";
  if (identifier.startsWith("streakProgress_")) return "serieDeFeu";
  if (identifier.startsWith("messageSent_")) return "communication";
  if (identifier.startsWith("shareChallenge_")) return "partage";
  if (identifier.startsWith("inviteFriend_")) return "reseau";
  if (identifier.startsWith("voteFeature_")) return "influence";
  if (identifier.startsWith("saveChallenge_")) return "collection";
  if (identifier.startsWith("challengeCreated_")) return "creation";
  return "divers";
};

const getIconForGroup = (groupKey: string) => {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    débuts: "star",
    defisTermines: "trophy",
    engagement: "calendar",
    serieDeFeu: "flame",
    communication: "chatbubbles",
    partage: "share-social",
    reseau: "people",
    influence: "thumbs-up",
    collection: "bookmark",
    creation: "brush",
    divers: "ribbon",
  };
  return icons[groupKey] || "ribbon";
};

const descendingGroups = new Set([
  "defisTermines",
  "engagement",
  "serieDeFeu",
  "creation",
]);

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [sections, setSections] = useState<AchievementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { setTrophyData } = useTrophy();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        const obtained = new Set(data.achievements || []);
        const pending = new Set(data.newAchievements || []);
        const formatted: Achievement[] = [];

        Object.entries(achievementsList).forEach(([key, val]) => {
          if ("name" in val && "points" in val) {
            formatted.push({
              id: key,
              identifier: key,
              trophies: (val as any).points,
              isClaimable: pending.has(key),
              isCompleted: obtained.has(key),
            });
          } else {
            Object.entries(
              val as Record<string, { name: string; points: number }>
            ).forEach(([subKey, subVal]) => {
              const id = `${key}_${subKey}`;
              formatted.push({
                id,
                identifier: id,
                trophies: subVal.points,
                isClaimable: pending.has(id),
                isCompleted: obtained.has(id),
              });
            });
          }
        });

        const grouped: Record<string, Achievement[]> = {};
        formatted.forEach((ach) => {
          const grp = groupAchievements(ach.identifier);
          grouped[grp] = grouped[grp] || [];
          grouped[grp].push(ach);
        });

        const secs = Object.entries(grouped)
          .map(([title, data], idx) => {
            data.sort((a, b) =>
              descendingGroups.has(title)
                ? b.trophies - a.trophies
                : t(a.identifier).localeCompare(t(b.identifier))
            );
            return { title, data, index: idx };
          })
          .sort((a, b) =>
            a.title === "débuts"
              ? -1
              : b.title === "débuts"
              ? 1
              : t(`sections.${a.title}`).localeCompare(t(`sections.${b.title}`))
          );

        setSections(secs);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur onSnapshot:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [t, setTrophyData]);

  const total = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections]
  );
  const done = useMemo(
    () =>
      sections.reduce(
        (sum, s) => sum + s.data.filter((a) => a.isCompleted).length,
        0
      ),
    [sections]
  );
  const metadata = useMemo(
    () => ({
      title: t("yourAchievements"),
      description: t("firstAchievementsPrompt"),
      url: `https://challengeme.com/achievements/${auth.currentUser?.uid}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: t("yourAchievements"),
        description: t("firstAchievementsPrompt"),
      },
    }),
    [t]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: AchievementSection }) => {
      const completedCount = section.data.filter((a) => a.isCompleted).length;
      return (
        <Animated.View
          entering={FadeInUp.delay(section.index * 150)}
          style={styles.sectionHeader}
        >
          <LinearGradient
            colors={[
              currentTheme.colors.primary,
              currentTheme.colors.secondary + "F0",
            ]}
            style={styles.sectionGradient}
          >
            <Ionicons
              name={getIconForGroup(section.title)}
              size={normalizeSize(22)}
              color={currentTheme.colors.textPrimary}
              accessibilityLabel={t(`sections.${section.title}`)}
            />
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t(`sections.${section.title}`)}
            </Text>
            <Text
              style={[
                styles.sectionCount,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("sectionCount", {
                completed: completedCount,
                total: section.data.length,
              })}
            </Text>
          </LinearGradient>
        </Animated.View>
      );
    },
    [t, currentTheme]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Achievement; index: number }) => (
      <Animated.View
        entering={ZoomIn.delay(index * 75)}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            item.isClaimable && setTrophyData(item.trophies, item.identifier)
          }
          accessibilityLabel={t(item.identifier)}
          accessibilityHint={
            item.isClaimable
              ? t("claim")
              : item.isCompleted
              ? t("unlocked")
              : t("inProgress")
          }
          accessibilityRole="button"
          testID={`achievement-${item.id}`}
        >
          <LinearGradient
            colors={[
              currentTheme.colors.cardBackground,
              currentTheme.colors.cardBackground + "F0",
            ]}
            style={[
              styles.card,
              {
                borderColor: isDarkMode
                  ? currentTheme.colors.secondary
                  : "#FF8C00",
              },
            ]} // Ajout de bordure dynamique
          >
            <View style={styles.cardContent}>
              <View style={styles.trophyContainer}>
                <Ionicons
                  name="trophy"
                  size={normalizeSize(48)}
                  color={
                    item.isCompleted
                      ? currentTheme.colors.secondary
                      : item.isClaimable
                      ? currentTheme.colors.primary
                      : currentTheme.colors.textSecondary
                  }
                  accessibilityLabel={t("trophy")}
                />
                <Text
                  style={[
                    styles.trophies,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#FF8C00",
                    },
                  ]}
                >
                  {item.trophies}
                </Text>
              </View>
              <View style={styles.details}>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000000",
                    },
                    item.isCompleted && styles.completed,
                    item.isClaimable && styles.claimable,
                  ]}
                >
                  {t(item.identifier, { defaultValue: item.identifier })}
                </Text>
                <Text
                  style={[
                    styles.cardDescription,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`descriptions.${item.identifier}`, {
                    defaultValue: t(item.identifier),
                  })}
                </Text>
              </View>
              <View style={styles.action}>
                {item.isClaimable ? (
                  <LinearGradient
                    colors={[
                      currentTheme.colors.primary,
                      currentTheme.colors.secondary,
                    ]}
                    style={styles.buttonGradient}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {t("claim")}
                    </Text>
                  </LinearGradient>
                ) : item.isCompleted ? (
                  <Text
                    style={[
                      styles.completedText,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    {t("unlocked")}
                  </Text>
                ) : (
                  <LinearGradient
                    colors={[
                      currentTheme.colors.textSecondary,
                      currentTheme.colors.textSecondary + "80",
                    ]}
                    style={styles.buttonGradient}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {t("inProgress")}
                    </Text>
                  </LinearGradient>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [t, currentTheme, setTrophyData, isDarkMode]
  );

  if (loading) {
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

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInUp}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel={t("backButton")}
            accessibilityHint={t("backButtonHint")}
            accessibilityRole="button"
            testID="back-button"
          >
            <Ionicons
              name="arrow-back"
              size={normalizeSize(24)}
              color={currentTheme.colors.secondary}
            />
          </TouchableOpacity>
        </Animated.View>
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
          <Animated.View
            entering={FadeInUp.duration(400)}
            style={styles.emptyContent}
          >
            <View style={styles.headerWrapper}>
              <View style={styles.headerContent}>
                <CustomHeader title={t("yourAchievements")} />
              </View>
            </View>
            <Ionicons
              name="trophy-outline"
              size={normalizeSize(80)}
              color={currentTheme.colors.primary}
              accessibilityLabel={t("noAchievementsIcon")} // Ajout pour accessibilité
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("noAchievementsYet")}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("firstAchievementsPrompt")}
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("loading")}
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Animated.View entering={FadeInUp.duration(400)}>
              <View style={styles.headerWrapper}>
                <View style={styles.headerContent}>
                  <Animated.View entering={FadeInUp}>
                    <TouchableOpacity
                      onPress={() => router.back()}
                      style={styles.backButton}
                      accessibilityLabel={t("backButton")}
                      accessibilityHint={t("backButtonHint")}
                      accessibilityRole="button"
                      testID="back-button"
                    >
                      <Ionicons
                        name="arrow-back"
                        size={normalizeSize(24)}
                        color={currentTheme.colors.secondary}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                  <CustomHeader title={t("yourAchievements")} />
                </View>
              </View>
              <Ionicons
                name="trophy-outline"
                size={normalizeSize(80)}
                color={currentTheme.colors.primary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("noAchievementsYet")}
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("firstAchievementsPrompt")}
              </Text>
            </Animated.View>
          </View>
        ) : (
          <>
            <View style={styles.headerWrapper}>
              <View style={styles.headerContent}>
                <Animated.View entering={FadeInUp}>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    accessibilityRole="button"
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
                <CustomHeader title={t("yourAchievements")} />
              </View>
            </View>
            <View style={styles.progressBarWrapper}>
              <View
                style={[
                  styles.progressBarBackground,
                  { backgroundColor: currentTheme.colors.border },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(done / total) * 100}%`,
                      backgroundColor: currentTheme.colors.secondary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: currentTheme.colors.secondary }]}>
              {t("trophiesProgress", { completed: done, total })}
            </Text>
            </View>
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderSectionHeader={renderSectionHeader}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              contentInset={{ top: SPACING, bottom: normalizeSize(100) }} // Responsivité
            />
          </>
        )}
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
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5, // Aligné avec CompletedChallenges.tsx
    position: "relative",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: normalizeSize(22), // Conservé, aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85, // Responsivité
    paddingHorizontal: SPACING,
  },
  emptySubtitle: {
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75, // Responsive
  },
  progressBar: {
    alignItems: "center",
    marginVertical: SPACING * 1.5, // Aligné avec CompletedChallenges.tsx
  },
  progressText: {
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
  },
  sectionHeader: {
    marginBottom: SPACING * 1.5, // Aligné avec CompletedChallenges.tsx
  },
  sectionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(18),
    borderRadius: normalizeSize(18), // Bordure premium
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    elevation: 10,
    width: SCREEN_WIDTH * 0.9, // Aligne avec les cartes
    alignSelf: "center", // Centre l’en-tête
  },
  sectionTitle: {
    flex: 1,
    fontSize: normalizeSize(20), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginLeft: normalizeSize(10),
  },
  sectionCount: {
    fontSize: normalizeSize(16), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SPACING, // Restaure un padding naturel
    paddingBottom: normalizeSize(80), // Aligné avec CompletedChallenges.tsx
  },
  cardWrapper: {
    marginBottom: SPACING * 1.5, // Aligné avec CompletedChallenges.tsx
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35, // Ombre premium
    shadowRadius: normalizeSize(8),
    elevation: 10,
    alignSelf: "center", // Centre les cartes
    width: SCREEN_WIDTH * 0.9, // Cohérence avec card
  },
  card: {
    width: SCREEN_WIDTH * 0.9, // Aligné avec CompletedChallenges.tsx
    padding: normalizeSize(18),
    borderRadius: normalizeSize(25), // Bordure plus arrondie
    borderWidth: 2.5, // Bordure premium
    minHeight: normalizeSize(120), // Hauteur minimale responsive
  },
  cardContent: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: normalizeSize(10),
  },
  trophyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalizeSize(12),
  },
  trophies: {
    fontSize: normalizeSize(14), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalizeSize(4),
  },
  details: {
    flex: 1,
    marginHorizontal: normalizeSize(10),
    alignItems: "center",
  },
  cardTitle: {
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
  },
  completed: {
    textDecorationLine: "line-through",
  },
  claimable: {
    fontStyle: "italic",
  },
  cardDescription: {
    fontSize: normalizeSize(14), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
    textAlign: "center",
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalizeSize(12),
  },
  buttonGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 1.2, // Aligné avec CompletedChallenges.tsx
    borderRadius: normalizeSize(18),
    alignItems: "center",
    justifyContent: "center",
    minWidth: normalizeSize(120), // Responsive
  },
  buttonText: {
    fontSize: normalizeSize(16), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  completedText: {
    fontSize: normalizeSize(14), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2, // Aligné avec CompletedChallenges.tsx
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Fond semi-transparent
    borderRadius: normalizeSize(20), // Bordure arrondie
  },
  progressBarWrapper: {
    alignItems: "center",
    marginVertical: SPACING,
  },
  // Fond statique de la barre de progression (couleur passée en inline dans le composant)
  progressBarBackground: {
    width: SCREEN_WIDTH * 0.8,
    height: normalizeSize(8),
    borderRadius: normalizeSize(4),
    overflow: "hidden",
    marginBottom: normalizeSize(6),
  },
  // Remplissage statique (couleur passée en inline dans le composant)
  progressBarFill: {
    height: "100%",
  },
});
