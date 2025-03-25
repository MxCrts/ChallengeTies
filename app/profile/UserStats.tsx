import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import BackButton from "../../components/BackButton";
import Animated, { FadeInUp } from "react-native-reanimated";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

export default function UserStats() {
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();
  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userDoc, setUserDoc] = useState<any>(null);

  // Écoute des mises à jour du document utilisateur
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "users", userId), (snapshot) => {
      setUserDoc(snapshot.data());
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Calcul des statistiques personnelles
  useEffect(() => {
    if (!userDoc) return;
    // Suppression des doublons dans les défis en cours
    const uniqueOngoing = new Map(
      currentChallenges.map((ch: any) => [`${ch.id}_${ch.selectedDays}`, ch])
    );
    const totalSaved = savedChallenges.length;
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (challenge: any) => challenge.completedDays === challenge.selectedDays
    ).length;
    const successRate =
      totalOngoing + totalCompleted > 0
        ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
        : 0;
    const longestStreak = userDoc?.longestStreak || 0;
    const trophies = userDoc?.trophies || 0;
    const achievementsUnlocked = userDoc?.achievements?.length || 0;

    const newStats: Stat[] = [
      {
        name: "Défis sauvegardés",
        value: totalSaved,
        icon: "bookmark-outline",
      },
      {
        name: "Défis en cours",
        value: totalOngoing,
        icon: "hourglass-outline",
      },
      {
        name: "Défis complétés",
        value: totalCompleted,
        icon: "trophy-outline",
      },
      {
        name: "Taux de réussite",
        value: `${successRate}%`,
        icon: "stats-chart-outline",
      },
      { name: "Trophées", value: trophies, icon: "medal-outline" },
      {
        name: "Succès débloqués",
        value: achievementsUnlocked,
        icon: "ribbon-outline",
      },
      {
        name: "Série la plus longue",
        value: `${longestStreak} jours`,
        icon: "flame-outline",
      },
    ];
    setStats(newStats);
  }, [savedChallenges, currentChallenges, userDoc]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
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

  // Chaque carte de statistique utilise l'animation d'entrée FadeInUp
  const renderStat = ({ item }: { item: Stat }) => (
    <Animated.View style={styles.statCard} entering={FadeInUp}>
      <Ionicons
        name={item.icon as keyof typeof Ionicons.glyphMap}
        size={36}
        color={currentTheme.colors.trophy}
      />
      <View style={styles.statContent}>
        <Text style={styles.statName}>{item.name}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
    >
      <BackButton color={currentTheme.colors.primary} />
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
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: currentTheme.colors.cardBackground,
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4.65,
    elevation: 3,
  },
  statContent: {
    marginLeft: 20,
  },
  statName: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "bold",
    color: currentTheme.colors.primary,
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
    color: "#000000",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#777777",
    textAlign: "center",
    marginTop: 10,
  },
});
