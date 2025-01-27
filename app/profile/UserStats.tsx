import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";

import { db, auth } from "../../constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

const { width } = Dimensions.get("window");

export default function UserStats() {
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();

  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // We'll also track real-time user doc to get trophies & achievements length
  const [userDoc, setUserDoc] = useState<any>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Subscribe to user doc in real time
    const unsub = onSnapshot(doc(db, "users", userId), (snapshot) => {
      setUserDoc(snapshot.data());
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Combine user doc stats with local challenges
    if (!userDoc) return;

    const totalSaved = savedChallenges.length;
    const totalOngoing = currentChallenges.length;
    const totalCompleted = currentChallenges.filter(
      (challenge) => challenge.completedDays === challenge.selectedDays
    ).length;
    const successRate =
      totalOngoing + totalCompleted > 0
        ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
        : 0;
    const longestStreak = 10; // Placeholder
    const trophies = userDoc?.trophies || 0;
    const achievementsUnlocked = userDoc?.achievements?.length || 0;

    const newStats: Stat[] = [
      {
        name: "Challenges Saved",
        value: totalSaved,
        icon: "bookmark-outline",
      },
      {
        name: "Ongoing Challenges",
        value: totalOngoing,
        icon: "hourglass-outline",
      },
      {
        name: "Challenges Completed",
        value: totalCompleted,
        icon: "trophy-outline",
      },
      {
        name: "Success Rate",
        value: `${successRate}%`,
        icon: "stats-chart-outline",
      },
      {
        name: "Trophies",
        value: trophies,
        icon: "medal-outline",
      },
      {
        name: "Achievements Unlocked",
        value: achievementsUnlocked,
        icon: "ribbon-outline",
      },
      {
        name: "Longest Streak",
        value: `${longestStreak} days`,
        icon: "flame-outline",
      },
    ];

    setStats(newStats);
  }, [savedChallenges, currentChallenges, userDoc]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A11CB" />
        <Text style={styles.loadingText}>Loading your stats...</Text>
      </View>
    );
  }

  if (stats.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No stats available yet!</Text>
        <Text style={styles.emptySubtext}>
          Start completing challenges to see your stats.
        </Text>
      </View>
    );
  }

  const renderStat = ({ item }: { item: Stat }) => (
    <View style={styles.statCard}>
      <Ionicons
        name={item.icon as keyof typeof Ionicons.glyphMap}
        size={36}
        color="#7F00FF"
      />
      <View style={styles.statContent}>
        <Text style={styles.statName}>{item.name}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={["#1C1C1E", "#2C2C2E"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <Text style={styles.header}>Your Stats</Text>
      <FlatList
        data={stats}
        renderItem={renderStat}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContainer}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6A11CB",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 40,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A3A3C",
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 3,
  },
  statContent: {
    marginLeft: 20,
  },
  statName: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7F00FF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A11CB",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    marginTop: 10,
  },
});
