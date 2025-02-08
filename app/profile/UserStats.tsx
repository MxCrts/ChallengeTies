import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
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
  const [userDoc, setUserDoc] = useState<any>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, "users", userId), (snapshot) => {
      setUserDoc(snapshot.data());
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
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
    const longestStreak = 10;
    const trophies = userDoc?.trophies || 0;
    const achievementsUnlocked = userDoc?.achievements?.length || 0;

    const newStats: Stat[] = [
      { name: "Challenges Saved", value: totalSaved, icon: "bookmark-outline" },
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
      { name: "Trophies", value: trophies, icon: "medal-outline" },
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [savedChallenges, currentChallenges, userDoc]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FACC15" />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  if (stats.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucune statistique disponible !</Text>
        <Text style={styles.emptySubtext}>
          Commencez des défis pour voir vos statistiques.
        </Text>
      </View>
    );
  }

  const renderStat = ({ item }: { item: Stat }) => (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim }]}>
      <Ionicons
        name={item.icon as keyof typeof Ionicons.glyphMap}
        size={36}
        color="#FACC15"
      />
      <View style={styles.statContent}>
        <Text style={styles.statName}>{item.name}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient colors={["#0F172A", "#1E293B"]} style={styles.container}>
      <Text style={styles.header}>Vos Statistiques</Text>
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
    paddingTop: 40,
  },
  header: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FACC15",
    textAlign: "center",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FACC15",
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
    color: "#FACC15",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FACC15",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
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
