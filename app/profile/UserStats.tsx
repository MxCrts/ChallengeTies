import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

// Constante SPACING pour cohérence avec new-features.tsx, leaderboard.tsx, UserInfo.tsx
const SPACING = 15;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface Stat {
  name: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface UserDoc {
  longestStreak?: number;
  trophies?: number;
  achievements?: string[];
}

interface Challenge {
  id: string;
  selectedDays: number;
  completedDays?: number;
}

export default function UserStats() {
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();
  const [stats, setStats] = useState<Stat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "users", userId), (snapshot) => {
      setUserDoc(snapshot.data() as UserDoc);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userDoc) return;
    const uniqueOngoing = new Map(
      currentChallenges.map((ch: Challenge) => [`${ch.id}_${ch.selectedDays}`, ch])
    );
    const totalSaved = savedChallenges.length;
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (challenge: Challenge) => challenge.completedDays === challenge.selectedDays
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

  const renderStat = ({ item, index }: { item: Stat; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 50)} // Délai réduit
      style={styles.statCardWrapper}
    >
      <LinearGradient
        colors={[currentTheme.colors.cardBackground, `${currentTheme.colors.cardBackground}F0`]}
        style={styles.statCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: `${currentTheme.colors.secondary}1A` }]}
        >
          <Ionicons
            name={item.icon}
            size={normalizeSize(36)} // Réduit pour responsivité
            color={currentTheme.colors.secondary}
            accessibilityLabel={`Icône pour ${item.name}`}
          />
        </View>
        <View style={styles.statContent}>
          <Text
            style={[styles.statName, { color: currentTheme.colors.textPrimary }]}
            accessibilityLabel={`Nom de la statistique : ${item.name}`}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.statValue, { color: currentTheme.colors.secondary }]}
            accessibilityLabel={`Valeur de la statistique : ${item.value}`}
          >
            {item.value}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent={true}
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          <Text
            style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}
          >
            Chargement en cours...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!userDoc) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent={true}
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)}>
            <Text
              style={[styles.emptyText, { color: currentTheme.colors.textPrimary }]}
            >
              Impossible de charger vos données
            </Text>
            <Text
              style={[styles.emptySubtext, { color: currentTheme.colors.textSecondary }]}
            >
              Veuillez vérifier votre connexion et réessayer.
            </Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[currentTheme.colors.background, `${currentTheme.colors.cardBackground}F0`]}
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
          initialNumToRender={7} // Nombre de stats
          getItemLayout={(data, index) => ({
            length: normalizeSize(90),
            offset: normalizeSize(90) * index,
            index,
          })}
          accessibilityRole="list"
          accessibilityLabel="Liste des statistiques utilisateur"
          testID="stats-list"
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  listContainer: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING / 2,
    paddingBottom: SPACING * 2, // Réduit pour responsivité
  },
  statCardWrapper: {
    marginBottom: SPACING,
    borderRadius: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
  },
  iconContainer: {
    width: normalizeSize(50), // Réduit pour responsivité
    height: normalizeSize(50),
    borderRadius: normalizeSize(25),
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING,
  },
  statContent: {
    flex: 1,
  },
  statName: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  statValue: {
    fontSize: normalizeSize(18), // Réduit légèrement
    fontFamily: "Comfortaa_700Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING,
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING,
  },
});