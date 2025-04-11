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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

const normalizeSize = (size) => Math.round(size * (SCREEN_WIDTH / 375));

const achievementDescriptions = {
  finishChallenge_1: "Termine ton premier défi avec brio.",
  finishChallenge_3: "Complète 3 défis et montre ta détermination.",
  finishChallenge_10: "Atteins 10 défis pour prouver ton sérieux.",
  finishChallenge_25: "25 défis terminés : t’es une machine !",
  finishChallenge_50: "50 défis : personne ne t’arrête !",
  finishChallenge_100: "100 défis : une légende est née.",
  selectChallengeDays_7: "Lance-toi dans un défi de 7 jours.",
  selectChallengeDays_30: "Engage-toi sur 30 jours de challenge.",
  selectChallengeDays_90: "90 jours : un marathonien est en toi.",
  selectChallengeDays_180: "180 jours de défi, un vrai warrior.",
  selectChallengeDays_365: "Un an de défi : patience légendaire.",
  streakProgress_3: "3 jours consécutifs : bon début !",
  streakProgress_7: "7 jours de suite : t’es en feu !",
  streakProgress_14: "14 jours consécutifs : impressionnant.",
  streakProgress_30: "30 jours de streak : discipline de fer.",
  streakProgress_60: "60 jours : rien ne te résiste.",
  streakProgress_90: "90 jours : une machine unstoppable.",
  streakProgress_180: "180 jours consécutifs : discipline ultime.",
  streakProgress_365: "365 jours : t’es un monstre !",
  messageSent_1: "Envoie ton premier message dans le chat.",
  messageSent_10: "10 messages : l’esprit d’équipe est là.",
  messageSent_50: "50 messages : ambassadeur de la communauté.",
  shareChallenge_1: "Partage un défi pour la première fois.",
  shareChallenge_5: "5 partages : influenceur en herbe.",
  shareChallenge_20: "20 partages : leader incontesté.",
  inviteFriend_1: "Invite ton premier pote à rejoindre.",
  inviteFriend_5: "5 invitations : élargis ton crew.",
  inviteFriend_10: "10 amis invités : roi du réseau.",
  voteFeature_1: "Vote pour une idée pour la première fois.",
  voteFeature_5: "5 votes : fais entendre ta voix.",
  saveChallenge_1: "Sauvegarde ton premier défi.",
  saveChallenge_5: "5 défis sauvés : collectionneur aguerri.",
  challengeCreated_1: "Crée ton premier défi personnalisé.",
  challengeCreated_5: "5 défis créés : esprit créatif.",
  challengeCreated_10: "10 défis créés : innovateur de génie.",
  first_connection: "Première connexion : bienvenue !",
  profile_completed: "Profil complété : t’es prêt à briller.",
};

interface Achievement {
  id: string;
  identifier: string;
  name: string;
  trophies: number;
  description: string;
  isClaimable: boolean;
  isCompleted: boolean;
}

interface AchievementSection {
  title: string;
  data: Achievement[];
  index: number;
}

const groupAchievements = (achievement: Achievement) => {
  const id = achievement.identifier;
  if (id === "first_connection" || id === "profile_completed") return "Débuts";
  if (id.startsWith("finishChallenge_")) return "Défis Terminés";
  if (id.startsWith("selectChallengeDays_")) return "Engagement";
  if (id.startsWith("streakProgress_")) return "Série de Feu";
  if (id.startsWith("messageSent_")) return "Communication";
  if (id.startsWith("shareChallenge_")) return "Partage";
  if (id.startsWith("inviteFriend_")) return "Réseau";
  if (id.startsWith("voteFeature_")) return "Influence";
  if (id.startsWith("saveChallenge_")) return "Collection";
  if (id.startsWith("challengeCreated_")) return "Création";
  return "Divers";
};

const getIconForGroup = (group: string) => {
  switch (group) {
    case "Débuts":
      return "star";
    case "Défis Terminés":
      return "trophy";
    case "Engagement":
      return "calendar";
    case "Série de Feu":
      return "flame";
    case "Communication":
      return "chatbubbles";
    case "Partage":
      return "share-social";
    case "Réseau":
      return "people";
    case "Influence":
      return "thumbs-up";
    case "Collection":
      return "bookmark";
    case "Création":
      return "brush";
    default:
      return "ribbon";
  }
};

const descendingGroups = new Set([
  "Défis Terminés",
  "Engagement",
  "Série de Feu",
  "Création",
]);

const AchievementsScreen = () => {
  const [sections, setSections] = useState<AchievementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { setTrophyData } = useTrophy();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      const obtained = new Set(data.achievements || []);
      const pending = new Set(data.newAchievements || []);
      const formattedAchievements: Achievement[] = [];

      Object.entries(achievementsList).forEach(([key, value]) => {
        if ("name" in value && "points" in value) {
          const identifier = key;
          formattedAchievements.push({
            id: identifier,
            identifier,
            name: value.name,
            trophies: value.points,
            description:
              achievementDescriptions[identifier] || "Succès mystère.",
            isClaimable: pending.has(identifier),
            isCompleted: obtained.has(identifier),
          });
        } else {
          Object.entries(value).forEach(([subKey, subValue]) => {
            const identifier = `${key}_${subKey}`;
            formattedAchievements.push({
              id: identifier,
              identifier,
              name: subValue.name,
              trophies: subValue.points,
              description:
                achievementDescriptions[identifier] || "Nouveau défi !",
              isClaimable: pending.has(identifier),
              isCompleted: obtained.has(identifier),
            });
          });
        }
      });

      const groupedAchievements: { [key: string]: Achievement[] } = {};
      formattedAchievements.forEach((ach) => {
        const group = groupAchievements(ach);
        if (!groupedAchievements[group]) groupedAchievements[group] = [];
        groupedAchievements[group].push(ach);
      });

      const sortedSections = Object.entries(groupedAchievements)
        .map(([title, data], index) => {
          data.sort((a, b) =>
            descendingGroups.has(title)
              ? b.trophies - a.trophies
              : a.name.localeCompare(b.name)
          );
          return { title, data, index };
        })
        .sort((a, b) =>
          a.title === "Débuts"
            ? -1
            : b.title === "Débuts"
            ? 1
            : a.title.localeCompare(b.title)
        );

      setSections(sortedSections);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleClaimAchievement = (achievement: Achievement) => {
    setTrophyData(achievement.trophies, achievement.identifier);
  };

  const totalAchievements = sections.reduce((sum, s) => sum + s.data.length, 0);
  const completedAchievements = sections.reduce(
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
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!sections.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["#FFF3E0", "#FFE8CC"]}
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.duration(400)}>
            <CustomHeader title="Succès" />
            <Ionicons
              name="trophy-outline"
              size={normalizeSize(80)}
              color={currentTheme.colors.primary}
            />
            <Text style={styles.emptyTitle}>Pas encore de succès</Text>
            <Text style={styles.emptySubtitle}>
              Relève des défis pour tes premiers trophées !
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
        <CustomHeader title="Succès" />
        <View style={styles.progressBar}>
          <Text style={styles.progressText}>
            {completedAchievements} / {totalAchievements} Trophées
          </Text>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => {
            const { title, data, index } = section;
            const completed = data.filter((a) => a.isCompleted).length;
            return (
              <Animated.View
                entering={FadeInUp.delay(index * 150)}
                style={styles.sectionHeader}
              >
                <LinearGradient
                  colors={[currentTheme.colors.primary, "#FF8C00"]}
                  style={styles.sectionGradient}
                >
                  <Ionicons
                    name={getIconForGroup(title)}
                    size={normalizeSize(22)}
                    color="#FFF"
                  />
                  <Text style={styles.sectionTitle}>{title}</Text>
                  <Text style={styles.sectionCount}>
                    {completed}/{data.length}
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
                onPress={() => item.isClaimable && handleClaimAchievement(item)}
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
                        {item.name}
                      </Text>
                      <Text style={styles.cardDescription}>
                        {item.description}
                      </Text>
                    </View>
                    <View style={styles.action}>
                      {item.isClaimable ? (
                        <LinearGradient
                          colors={[currentTheme.colors.primary, "#FF8C00"]}
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>Réclamer</Text>
                        </LinearGradient>
                      ) : item.isCompleted ? (
                        <Text style={styles.completedText}>Débloqué</Text>
                      ) : (
                        <LinearGradient
                          colors={["#DDD", "#BBB"]}
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>En cours</Text>
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
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
  },
  container: {
    flex: 1,
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
  listContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingBottom: SCREEN_HEIGHT * 0.1,
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
});

export default AchievementsScreen;
