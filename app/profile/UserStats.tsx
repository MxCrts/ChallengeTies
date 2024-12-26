import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { Ionicons } from "@expo/vector-icons";

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

export default function UserStats() {
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();

  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateStats = () => {
      const totalSaved = savedChallenges.length;
      const totalOngoing = currentChallenges.length;
      const totalCompleted = currentChallenges.filter(
        (challenge) => challenge.completedDays === challenge.totalDays
      ).length;
      const successRate =
        totalOngoing + totalCompleted > 0
          ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
          : 0;
      const longestStreak = 10; // Placeholder, calculate if needed

      setStats([
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
          name: "Longest Streak",
          value: `${longestStreak} days`,
          icon: "flame-outline",
        },
      ]);
      setIsLoading(false);
    };

    calculateStats();
  }, [savedChallenges, currentChallenges]);

  const renderStat = ({ item }: { item: Stat }) => (
    <View style={styles.statCard}>
      <Ionicons
        name={item.icon as keyof typeof Ionicons.glyphMap}
        size={40}
        color="#2F80ED"
      />
      <View style={styles.statContent}>
        <Text style={styles.statName}>{item.name}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2F80ED" />
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Stats</Text>
      <FlatList
        data={stats}
        renderItem={renderStat}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6A11CB",
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
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
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6A11CB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
