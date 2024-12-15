import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

const UserStats = () => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const userId = "anonymousUserId"; // Replace with logic to fetch the current user's ID
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          setStats([
            {
              name: "Challenges Completed",
              value: userData?.challengesCompleted || 0,
              icon: "trophy-outline",
            },
            {
              name: "Ongoing Challenges",
              value: userData?.challengesOngoing || 0,
              icon: "hourglass-outline",
            },
            {
              name: "Success Rate",
              value: `${userData?.successRate || 0}%`,
              icon: "stats-chart-outline",
            },
            {
              name: "Longest Streak",
              value: `${userData?.longestStreak || 0} days`,
              icon: "flame-outline",
            },
          ]);
        } else {
          Alert.alert("No Stats", "User stats could not be found.");
        }
      } catch (error) {
        console.error("Error fetching user stats:", error);
        Alert.alert("Error", "Failed to fetch user stats. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

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
        <Text style={styles.loadingText}>Fetching your stats...</Text>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2F80ED",
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
    color: "#555",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2F80ED",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#2F80ED",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 10,
  },
});

export default UserStats;
