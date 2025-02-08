import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Layout, ZoomIn } from "react-native-reanimated";
import TrophyModal from "../../components/TrophyModal";
import { useTrophy, TrophyProvider } from "../../context/TrophyContext";
import { claimAchievement } from "../../helpers/trophiesHelpers";

const achievementsList = [
  { id: "first_connection", title: "Première connexion", trophies: 10, max: 1 },
  {
    id: "first_challenge",
    title: "Premier défi complété",
    trophies: 10,
    max: 1,
  },
  { id: "five_challenges", title: "5 défis complétés", trophies: 50, max: 5 },
  { id: "ten_challenges", title: "10 défis complétés", trophies: 100, max: 10 },
  {
    id: "thirty_day_streak",
    title: "30 jours consécutifs",
    trophies: 200,
    max: 30,
  },
];

const AchievementsScreenContent = () => {
  const [achievements, setAchievements] = useState({});
  const [newAchievements, setNewAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const {
    showTrophyModal,
    setTrophyData,
    resetTrophyData,
    trophiesEarned,
    achievementEarned,
  } = useTrophy();

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data();

        if (data) {
          const obtainedAchievements = new Set(data.achievements || []);
          setAchievements(
            achievementsList.reduce((acc, achievement) => {
              acc[achievement.id] = obtainedAchievements.has(achievement.id)
                ? achievement.max
                : 0;
              return acc;
            }, {})
          );

          setNewAchievements(data.newAchievements || []);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des succès:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  const handleClaimAchievement = async (achievement) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      await claimAchievement(achievement.id, achievement.trophies);

      // ✅ Met à jour l'affichage pour conserver l'état "Obtenu"
      setAchievements((prev) => ({
        ...prev,
        [achievement.id]: achievement.max,
      }));

      // ✅ Met à jour la liste des succès non réclamés
      setNewAchievements((prev) => {
        const updatedNewAchievements = prev.filter(
          (id) => id !== achievement.id
        );

        // ✅ Met à jour Firestore pour retirer le badge
        updateDoc(doc(db, "users", userId), {
          newAchievements: updatedNewAchievements,
        });

        return updatedNewAchievements;
      });

      // ✅ Ouvre le modal des trophées avec l'animation 🎉
      setTrophyData(achievement.trophies, achievement.title);
    } catch (error) {
      console.error("Erreur lors de la réclamation du succès:", error);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Chargement des succès...</Text>
      </LinearGradient>
    );
  }

  const renderAchievement = ({ item }) => {
    const isClaimable = newAchievements.includes(item.id);
    const isCompleted = achievements[item.id] >= item.max;

    return (
      <Animated.View
        entering={ZoomIn.duration(500)}
        layout={Layout.springify()}
        style={styles.achievementCard}
      >
        <Ionicons
          name="trophy"
          size={30}
          color={isCompleted ? "#FFD700" : "#aaa"}
          style={styles.trophyIcon}
        />
        <View style={styles.achievementContent}>
          <Text
            style={[
              styles.achievementText,
              isCompleted && styles.completedText,
            ]}
          >
            {item.title}
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${((achievements[item.id] || 0) / item.max) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {achievements[item.id] || 0}/{item.max}
          </Text>
        </View>
        {isClaimable ? (
          <TouchableOpacity
            style={[styles.claimButton, styles.activeButton]}
            onPress={() => handleClaimAchievement(item)}
          >
            <Text style={styles.buttonText}>Réclamer</Text>
          </TouchableOpacity>
        ) : isCompleted ? (
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
    );
  };

  return (
    <ImageBackground
      source={require("../../assets/images/chalkboard.png")}
      style={styles.boardBackground}
    >
      <Text style={styles.screenTitle}>🏆 Succès Débloqués 🏆</Text>
      <FlatList
        data={achievementsList}
        renderItem={renderAchievement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
      <TrophyModal
        visible={showTrophyModal}
        trophies={trophiesEarned}
        achievement={achievementEarned}
        onClose={(finalTrophies) => {
          resetTrophyData();
          console.log("Trophées obtenus :", finalTrophies);
        }}
      />
    </ImageBackground>
  );
};

export default function AchievementsScreen() {
  return (
    <TrophyProvider>
      <AchievementsScreenContent />
    </TrophyProvider>
  );
}
const styles = StyleSheet.create({
  boardBackground: {
    flex: 1,
    resizeMode: "cover",
    paddingTop: 50,
    paddingBottom: 30,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  progressText: {
    fontSize: 14,
    color: "#FFF",
    marginTop: 5,
    textAlign: "center",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  obtainedText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFD700",
    marginRight: 10,
  },
  loadingText: {
    marginTop: 10,
    color: "#FFF",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
  trophyIcon: { marginRight: 15 },
  achievementContent: { flex: 1 },
  achievementText: { fontSize: 16, color: "#FFF" },
  completedText: { color: "#FFD700", fontWeight: "bold" },
  progressBarContainer: {
    height: 5,
    backgroundColor: "#444",
    width: "100%",
    borderRadius: 5,
    marginTop: 5,
  },
  progressBar: { height: "100%", backgroundColor: "#FFD700", borderRadius: 5 },
  claimButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  activeButton: { backgroundColor: "#FFD700" },
  disabledButton: { backgroundColor: "#555" },
  buttonText: { fontSize: 14, fontWeight: "bold", color: "#000" },
});
