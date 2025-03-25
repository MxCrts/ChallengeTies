import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import BackButton from "../../components/BackButton";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTrophy } from "../../context/TrophyContext";
import { achievementsList } from "../../helpers/achievementsConfig";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

// Descriptions pour chaque achievement
const achievementDescriptions: Record<string, string> = {
  finishChallenge_1: "Complétez votre premier défi.",
  finishChallenge_3: "Complétez 3 défis pour prouver votre motivation.",
  finishChallenge_10: "Complétez 10 défis pour montrer votre sérieux.",
  finishChallenge_25:
    "Atteignez 25 défis complétés pour devenir une machine à challenges.",
  finishChallenge_50: "Complétez 50 défis et devenez imbattable !",
  finishChallenge_100:
    "Atteignez 100 défis complétés et devenez une légende vivante.",
  selectChallengeDays_7: "Choisissez un défi de 7 jours et engagez-vous.",
  selectChallengeDays_30:
    "Sélectionnez un défi de 30 jours pour montrer votre détermination.",
  selectChallengeDays_90:
    "Choisissez un défi de 90 jours et devenez marathonien.",
  selectChallengeDays_180:
    "Sélectionnez un défi de 180 jours pour prouver votre engagement à long terme.",
  selectChallengeDays_365:
    "Optez pour un défi d'un an et devenez le patient légendaire.",
  streakProgress_3: "Atteignez 3 jours consécutifs de réussite.",
  streakProgress_7: "Maintenez 7 jours consécutifs de succès.",
  streakProgress_14: "Atteignez 14 jours consécutifs pour impressionner.",
  streakProgress_30:
    "Obtenez 30 jours consécutifs pour une détermination en béton.",
  streakProgress_60:
    "Atteignez 60 jours consécutifs : rien ne peut vous arrêter.",
  streakProgress_90: "Maintenez 90 jours de succès, vous êtes une machine !",
  streakProgress_180:
    "Atteignez 180 jours consécutifs pour une discipline ultime.",
  streakProgress_365: "Maintenez 365 jours de succès et devenez un monstre !",
  messageSent_1: "Envoyez votre premier message dans le chat.",
  messageSent_10: "Envoyez 10 messages pour montrer votre esprit d'équipe.",
  messageSent_50:
    "Atteignez 50 messages envoyés et dynamisez votre communauté.",
  shareChallenge_1: "Partagez un défi pour la première fois.",
  shareChallenge_5: "Partagez 5 défis pour devenir un influenceur en herbe.",
  shareChallenge_20: "Partagez 20 défis et devenez le meneur de communauté.",
  inviteFriend_1: "Invitez votre premier ami à rejoindre les défis.",
  inviteFriend_5: "Invitez 5 amis pour étendre votre réseau.",
  inviteFriend_10: "Invitez 10 amis et devenez le roi de la communauté.",
  voteFeature_1:
    "Votez pour une nouvelle fonctionnalité pour la première fois.",
  voteFeature_5: "Votez 5 fois pour montrer votre engagement.",
  saveChallenge_1: "Sauvegardez un défi pour la première fois.",
  saveChallenge_5: "Sauvegardez 5 défis pour montrer votre intérêt.",
  challengeCreated_1: "Créez votre premier défi.",
  challengeCreated_5: "Créez 5 défis pour montrer votre inspiration.",
  challengeCreated_10: "Créez 10 défis et devenez un innovateur.",
  first_connection: "Connectez-vous pour la première fois.",
  profile_completed: "Complétez toutes les informations de votre profil.",
};

interface Achievement {
  id: string;
  identifier: string;
  name: string;
  points: number;
  description: string;
  isClaimable: boolean;
  isCompleted: boolean;
}

interface AchievementSection {
  title: string;
  data: Achievement[];
}

const getGroupForAchievement = (achievement: Achievement): string => {
  const id = achievement.identifier;
  if (id === "first_connection" || id === "profile_completed") {
    return "Premier pas";
  } else if (id.startsWith("finishChallenge_")) {
    return "Défis terminés";
  } else if (id.startsWith("selectChallengeDays_")) {
    return "Durée de défi";
  } else if (id.startsWith("streakProgress_")) {
    return "Série de réussite";
  } else if (id.startsWith("messageSent_")) {
    return "Messages";
  } else if (id.startsWith("shareChallenge_")) {
    return "Partages";
  } else if (id.startsWith("inviteFriend_")) {
    return "Invitations";
  } else if (id.startsWith("voteFeature_")) {
    return "Votes";
  } else if (id.startsWith("saveChallenge_")) {
    return "Défis sauvegardés";
  } else if (id.startsWith("challengeCreated_")) {
    return "Défis créés";
  }
  return "Autres";
};

const descendingGroups = new Set([
  "Défis terminés",
  "Durée de défi",
  "Série de réussite",
  "Défis créés",
]);

const AchievementsScreen = () => {
  const [sections, setSections] = useState<AchievementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { setTrophyData } = useTrophy();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (userSnap) => {
      const data = userSnap.data();
      if (data) {
        const obtained = new Set(data.achievements || []);
        const pending = new Set(data.newAchievements || []);
        let formatted: Achievement[] = [];

        Object.entries(achievementsList).forEach(([category, config]) => {
          if (
            typeof config === "object" &&
            "name" in config &&
            "points" in config
          ) {
            const identifier = category;
            formatted.push({
              id: identifier,
              identifier,
              name: config.name,
              points: config.points,
              description:
                achievementDescriptions[identifier] ||
                "Accomplissez ce défi pour débloquer ce succès.",
              isClaimable: pending.has(identifier),
              isCompleted: obtained.has(identifier),
            });
          } else {
            Object.entries(config as object).forEach(
              ([threshold, achievementData]: any) => {
                const identifier = `${category}_${threshold}`;
                formatted.push({
                  id: identifier,
                  identifier,
                  name: achievementData.name,
                  points: achievementData.points,
                  description:
                    achievementDescriptions[identifier] ||
                    `Atteignez le palier ${threshold} pour ${achievementData.name}.`,
                  isClaimable: pending.has(identifier),
                  isCompleted: obtained.has(identifier),
                });
              }
            );
          }
        });

        const sectionsMap: { [group: string]: Achievement[] } = {};
        formatted.forEach((ach) => {
          const group = getGroupForAchievement(ach);
          if (!sectionsMap[group]) {
            sectionsMap[group] = [];
          }
          sectionsMap[group].push(ach);
        });

        const sectionArr: AchievementSection[] = Object.entries(
          sectionsMap
        ).map(([title, data]) => {
          if (descendingGroups.has(title)) {
            data.sort((a, b) => b.points - a.points);
          } else {
            data.sort((a, b) => a.name.localeCompare(b.name));
          }
          return { title, data };
        });

        // Placer "Premier pas" en haut
        sectionArr.sort((a, b) => {
          if (a.title === "Premier pas") return -1;
          if (b.title === "Premier pas") return 1;
          return a.title.localeCompare(b.title);
        });

        setSections(sectionArr);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleClaimAchievement = (achievement: Achievement) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    console.log(
      `Réclamation : ${achievement.name} (+${achievement.points} trophées)`
    );
    setTrophyData(achievement.points, achievement.identifier);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={styles.loadingText}>Chargement des succès...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
    >
      <BackButton color={currentTheme.colors.primary} />
      <Text style={styles.header}>Vos Succès</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title, data } }) => {
          const total = data.length;
          const achieved = data.filter((item) => item.isCompleted).length;
          return (
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>{title}</Text>
              <Text style={styles.sectionCounter}>
                {achieved}/{total}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <Animated.View style={styles.achievementCard} entering={FadeInUp}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="trophy"
                size={30}
                color={
                  item.isCompleted
                    ? "#FFD700"
                    : item.isClaimable
                    ? "#C2410C" // Orange foncé
                    : "#A0AEC0"
                }
              />
              <Text style={styles.pointsText}>{item.points}</Text>
            </View>
            <View style={styles.achievementContent}>
              <Text
                style={[
                  styles.achievementTitle,
                  item.isCompleted && styles.completedText,
                  item.isClaimable && styles.claimableText,
                ]}
              >
                {item.name}
              </Text>
              <Text style={styles.achievementDescription}>
                {item.description}
              </Text>
            </View>
            {item.isClaimable ? (
              <TouchableOpacity
                style={[styles.claimButton, styles.activeButton]}
                onPress={() => handleClaimAchievement(item)}
              >
                <Text style={styles.buttonText}>Réclamer</Text>
              </TouchableOpacity>
            ) : item.isCompleted ? (
              <Text style={styles.obtainedText}>Obtenu</Text>
            ) : (
              <TouchableOpacity
                style={[styles.claimButton, styles.disabledButton]}
                disabled
              >
                <Text style={styles.buttonText}>En cours</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </LinearGradient>
  );
};

export default AchievementsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: currentTheme.colors.background,
  },
  header: {
    fontSize: 25,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EDF2F7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  sectionHeader: {
    fontSize: 20,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.primary,
  },
  sectionCounter: {
    fontSize: 16,
    color: currentTheme.colors.primary,
  },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: currentTheme.colors.cardBackground,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4.65,
    elevation: 3,
  },
  iconContainer: {
    alignItems: "center",
    marginRight: 15,
    width: 50,
  },
  pointsText: {
    marginTop: 4,
    fontSize: 14,
    color: currentTheme.colors.primary,
    fontFamily: currentTheme.typography.title.fontFamily,
    textAlign: "center",
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
  },
  completedText: {
    color: "#FFD700",
    textDecorationLine: "line-through",
  },
  claimableText: {
    color: "#C2410C",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  achievementDescription: {
    fontSize: 14,
    color: "#4A5568",
    marginTop: 4,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  claimButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: "#C2410C",
  },
  disabledButton: {
    backgroundColor: "#E2E8F0",
  },
  buttonText: {
    fontSize: 14,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#1A202C",
  },
  obtainedText: {
    fontSize: 14,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#FFD700",
    marginRight: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: currentTheme.colors.primary,
  },
});
