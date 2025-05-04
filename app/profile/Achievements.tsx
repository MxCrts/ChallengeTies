import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { db, auth } from "../../constants/firebase-config";
import { useTrophy } from "../../context/TrophyContext";
import { achievementsList } from "../../helpers/achievementsConfig";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalizeSize = (size: number) =>
  Math.round(size * (SCREEN_WIDTH / 375));

const currentTheme = {
  ...designSystem.lightTheme,
  colors: {
    ...designSystem.lightTheme.colors,
    primary: "#FF6200",
    accent: "#FFD700",
    background: "#FFF3E0",
    card: "#FFFFFF",
  },
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
  switch (groupKey) {
    case "débuts":
      return "star";
    case "defisTermines":
      return "trophy";
    case "engagement":
      return "calendar";
    case "serieDeFeu":
      return "flame";
    case "communication":
      return "chatbubbles";
    case "partage":
      return "share-social";
    case "reseau":
      return "people";
    case "influence":
      return "thumbs-up";
    case "collection":
      return "bookmark";
    case "creation":
      return "brush";
    default:
      return "ribbon";
  }
};

const descendingGroups = new Set([
  "defisTermines",
  "engagement",
  "serieDeFeu",
  "creation",
]);

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<AchievementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { setTrophyData } = useTrophy();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "users", userId), (snapshot) => {
      const data = snapshot.data() || {};
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
          Object.entries(val as Record<string,{name:string;points:number}>).forEach(
            ([subKey, subVal]) => {
              const id = `${key}_${subKey}`;
              formatted.push({
                id,
                identifier: id,
                trophies: subVal.points,
                isClaimable: pending.has(id),
                isCompleted: obtained.has(id),
              });
            }
          );
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
    });
    return () => unsubscribe();
  }, [t]);

  const total = sections.reduce((sum, s) => sum + s.data.length, 0);
  const done = sections.reduce(
    (sum, s) => sum + s.data.filter((a) => a.isCompleted).length,
    0
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["#FFF3E0", "#FFE8CC"]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.primary}
          />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["#FFF3E0", "#FFE8CC"]}
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.duration(400)}>
            <CustomHeader title={t("yourAchievements")} />
            <Ionicons
              name="trophy-outline"
              size={normalizeSize(80)}
              color={currentTheme.colors.primary}
            />
            <Text style={styles.emptyTitle}>
              {t("noAchievementsYet")}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t("firstAchievementsPrompt")}
            </Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#FFF3E0", "#FFE8CC"]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <CustomHeader title={t("yourAchievements")} />
        <View style={styles.progressBar}>
          <Text style={styles.progressText}>
            {t("trophiesProgress", { completed: done, total })}
          </Text>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => {
            const completedCount = section.data.filter((a) => a.isCompleted).length;
            return (
              <Animated.View
                entering={FadeInUp.delay(section.index * 150)}
                style={styles.sectionHeader}
              >
                <LinearGradient
                  colors={[currentTheme.colors.primary, "#FF8C00"]}
                  style={styles.sectionGradient}
                >
                  <Ionicons
                    name={getIconForGroup(section.title)}
                    size={normalizeSize(22)}
                    color="#FFF"
                  />
                  <Text style={styles.sectionTitle}>
                    {t(`sections.${section.title}`)}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {t("sectionCount", {
                      completed: completedCount,
                      total: section.data.length,
                    })}
                  </Text>
                </LinearGradient>
              </Animated.View>
            );
          }}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInUp.delay(index * 75)}
              style={styles.cardWrapper}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  item.isClaimable && setTrophyData(item.trophies, item.identifier)
                }
              >
                <LinearGradient
                  colors={["#FFFFFF", "#FFF8E6"]}
                  style={styles.card}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.trophyContainer}>
                      <Ionicons
                        name="trophy"
                        size={normalizeSize(48)}
                        color={
                          item.isCompleted
                            ? currentTheme.colors.accent
                            : item.isClaimable
                            ? currentTheme.colors.primary
                            : "#CCC"
                        }
                      />
                      <Text style={styles.trophies}>{item.trophies}</Text>
                    </View>
                    <View style={styles.details}>
                      <Text
                        style={[
                          styles.cardTitle,
                          item.isCompleted && styles.completed,
                          item.isClaimable && styles.claimable,
                        ]}
                      >
                        {t(item.identifier, { defaultValue: item.identifier })}
                      </Text>
                      <Text style={styles.cardDescription}>
                        {t(`descriptions.${item.identifier}`, {
                          defaultValue: t(item.identifier),
                        })}
                      </Text>
                    </View>
                    <View style={styles.action}>
                      {item.isClaimable ? (
                        <LinearGradient
                          colors={[currentTheme.colors.primary, "#FF8C00"]}
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>
                            {t("claim")}
                          </Text>
                        </LinearGradient>
                      ) : item.isCompleted ? (
                        <Text style={styles.completedText}>
                          {t("unlocked")}
                        </Text>
                      ) : (
                        <LinearGradient
                          colors={["#DDD", "#BBB"]}
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>
                            {t("inProgress")}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(12),
    fontSize: normalizeSize(16),
    color: currentTheme.colors.primary,
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: normalizeSize(22),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.primary,
    marginTop: normalizeSize(20),
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalizeSize(16),
    color: "#666",
    fontFamily: currentTheme.typography.body.fontFamily,
    textAlign: "center",
    marginTop: normalizeSize(10),
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  progressBar: {
    alignItems: "center",
    marginVertical: normalizeSize(15),
  },
  progressText: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.primary,
    fontWeight: "700",
  },
  sectionHeader: {
    marginBottom: SCREEN_WIDTH * 0.03,
  },
  sectionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(15),
    borderRadius: normalizeSize(12),
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: normalizeSize(18),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FFF",
    marginLeft: normalizeSize(10),
    fontWeight: "bold",
  },
  sectionCount: {
    fontSize: normalizeSize(14),
    color: "#FFF",
    fontFamily: currentTheme.typography.body.fontFamily,
    opacity: 0.9,
  },
  listContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  cardWrapper: {
    marginBottom: SCREEN_WIDTH * 0.03,
    alignItems: "center",
  },
  card: {
    width: SCREEN_WIDTH * 0.92,
    padding: normalizeSize(15),
    borderRadius: normalizeSize(18),
    borderWidth: 1,
    borderColor: "#FF620010",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trophyContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: SCREEN_WIDTH * 0.18,
  },
  trophies: {
    fontSize: normalizeSize(12),
    color: currentTheme.colors.primary,
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
    marginTop: normalizeSize(4),
  },
  details: {
    flex: 1,
    marginHorizontal: normalizeSize(10),
  },
  cardTitle: {
    fontSize: normalizeSize(15),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333",
    fontWeight: "bold",
  },
  completed: {
    color: currentTheme.colors.accent,
    textDecorationLine: "line-through",
  },
  claimable: {
    color: currentTheme.colors.primary,
  },
  cardDescription: {
    fontSize: normalizeSize(11),
    color: "#666",
    fontFamily: currentTheme.typography.body.fontFamily,
    marginTop: normalizeSize(4),
  },
  action: {
    width: SCREEN_WIDTH * 0.22,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGradient: {
    paddingVertical: normalizeSize(6),
    paddingHorizontal: normalizeSize(10),
    borderRadius: normalizeSize(8),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: normalizeSize(11),
    color: "#FFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
    textAlign: "center",
  },
  completedText: {
    fontSize: normalizeSize(11),
    color: currentTheme.colors.accent,
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
  },
});
