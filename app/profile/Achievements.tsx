import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";

const achievementsList = [
  { id: "first_challenge", title: "First Challenge Completed", trophies: 10 },
  { id: "five_challenges", title: "Five Challenges Completed", trophies: 50 },
  { id: "ten_challenges", title: "Ten Challenges Completed", trophies: 100 },
  { id: "thirty_day_streak", title: "30-Day Streak", trophies: 200 },
  { id: "first_creation", title: "First Challenge Created", trophies: 20 },
  { id: "invited_friend", title: "Friend Invited", trophies: 15 },
  { id: "super_saver", title: "Saved 50 Challenges", trophies: 80 },
  { id: "streak_master", title: "90-Day Streak", trophies: 300 },
  { id: "hundred_club", title: "Completed 100 Challenges", trophies: 500 },
  { id: "community_hero", title: "Invited 10 Friends", trophies: 150 },
];

const AchievementsScreen = () => {
  const [userAchievements, setUserAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data();

        if (data && Array.isArray(data.achievements)) {
          setUserAchievements(data.achievements);
        }
      } catch (error) {
        console.error("Error fetching achievements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  const renderAchievement = ({ item }) => {
    const isCompleted = userAchievements.includes(item.id);

    return (
      <View style={styles.achievementCard}>
        <Ionicons
          name="trophy"
          size={24}
          color={isCompleted ? "#FFD700" : "#aaa"}
          style={styles.trophyIcon}
        />
        <Text style={styles.achievementText}>{item.title}</Text>
        <Text style={styles.trophyCount}>{item.trophies}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading achievements...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/chalkboard.png")}
      style={styles.boardBackground}
    >
      <Text style={styles.screenTitle}>Achievements</Text>
      <FlatList
        data={achievementsList.sort((a, b) => {
          const isACompleted = userAchievements.includes(a.id);
          const isBCompleted = userAchievements.includes(b.id);

          if (isACompleted && !isBCompleted) return -1;
          if (!isACompleted && isBCompleted) return 1;
          return 0;
        })}
        renderItem={renderAchievement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  boardBackground: {
    flex: 1,
    resizeMode: "cover",
    paddingTop: 50,
    paddingBottom: 30,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "ChalkboardSE-Bold", // Ensure this font is added to your project
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    paddingVertical: 5,
  },
  trophyIcon: {
    marginRight: 15,
  },
  achievementText: {
    flex: 1,
    fontSize: 16,
    color: "#FFF",
    fontFamily: "ChalkboardSE-Regular", // Ensure this font is added to your project
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trophyCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFD700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    color: "#FFF",
    fontSize: 16,
    fontStyle: "italic",
  },
});

export default AchievementsScreen;
