import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
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
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

const normalizeSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

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

  useEffect(() => {
    if (!userDoc) return;
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
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color="#FF6200" />
          <Text style={styles.loadingText}>Chargement en cours...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (stats.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)}>
            <Text style={styles.emptyText}>
              Aucune statistique disponible !
            </Text>
            <Text style={styles.emptySubtext}>
              Commencez des défis pour voir vos stats.
            </Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const renderStat = ({ item, index }: { item: Stat; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={styles.statCardWrapper}
    >
      <LinearGradient
        colors={["#FFFFFF", "#FFE0B2"]} // Blanc à orange clair
        style={styles.statCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={item.icon as keyof typeof Ionicons.glyphMap}
            size={normalizeSize(40)}
            color="#FF6200"
          />
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statName}>{item.name}</Text>
          <Text style={styles.statValue}>{item.value}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title="Vos Statistiques" />
        </View>
        <FlatList
          data={stats}
          renderItem={renderStat}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  listContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  statCardWrapper: {
    marginBottom: normalizeSize(15),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(15),
    borderRadius: normalizeSize(20),
    borderWidth: 1,
    borderColor: "#FF620030",
    overflow: "hidden",
  },
  iconContainer: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(30),
    backgroundColor: "rgba(255, 98, 0, 0.1)", // Fond orange clair pour l'icône
    justifyContent: "center",
    alignItems: "center",
    marginRight: normalizeSize(15),
  },
  statContent: {
    flex: 1,
  },
  statName: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#333333",
    marginBottom: normalizeSize(5),
  },
  statValue: {
    fontSize: normalizeSize(20),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FF6200",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: normalizeSize(20),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.textPrimary,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    textAlign: "center",
    marginTop: normalizeSize(10),
  },
});
