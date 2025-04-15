import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext"; // Ajout de useTheme
import { Theme } from "../theme/designSystem"; // Import de Theme
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface Player {
  id: string;
  username?: string;
  trophies: number;
  profileImage?: string;
  country?: string;
  region?: string;
  rank?: number;
}

export default function LeaderboardScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "region" | "national" | "global"
  >("global");
  const router = useRouter();
  const { theme } = useTheme(); // Ajout de useTheme
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const fetchedPlayers: Player[] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          username: docSnap.data().username,
          trophies: docSnap.data().trophies || 0,
          profileImage: docSnap.data().profileImage || null,
          country: docSnap.data().country || "Unknown",
          region: docSnap.data().region || "Unknown",
        }));
        setPlayers(fetchedPlayers);

        const userId = auth.currentUser?.uid;
        if (userId) {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const foundUser = fetchedPlayers.find(
              (player) => player.id === userId
            );
            setCurrentUser({
              ...foundUser,
              country: userData.country,
              region: userData.region,
            });
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du leaderboard :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let filtered = players;
    if (selectedTab === "region") {
      filtered = players.filter((p) => p.region === currentUser.region);
    } else if (selectedTab === "national") {
      filtered = players.filter((p) => p.country === currentUser.country);
    }
    filtered.sort((a, b) => b.trophies - a.trophies);
    setFilteredPlayers(filtered);
  }, [selectedTab, players, currentUser]);

  const renderTopThree = () => {
    if (filteredPlayers.length < 3) return null;
    const [first, second, third] = filteredPlayers;
    return (
      <Animated.View
        entering={FadeInUp.delay(200)}
        style={styles.topThreeContainer}
      >
        {/* Second Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#C0C0C0", "#A9A9A9"]} // Argent, reste fixe
            style={styles.circleSecond}
          >
            <Image
              source={
                second.profileImage
                  ? { uri: second.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <MaterialCommunityIcons
              name="medal"
              size={normalizeSize(26)}
              color="#C0C0C0"
              style={styles.medalIcon}
            />
          </LinearGradient>
          <Text
            style={[
              styles.podiumName,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {second.username || "Inconnu"}
          </Text>
          <Text
            style={[
              styles.podiumTrophies,
              { color: currentTheme.colors.trophy },
            ]}
          >
            {second.trophies} 🏆
          </Text>
          <Text
            style={[
              styles.handle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            @{(second.username || "").toLowerCase()}
          </Text>
        </View>

        {/* First Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#FFD700", "#FFA500"]} // Or, reste fixe
            style={styles.circleFirst}
          >
            <Image
              source={
                first.profileImage
                  ? { uri: first.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImageFirst}
            />
            <MaterialCommunityIcons
              name="crown"
              size={normalizeSize(34)}
              color="#FFD700"
              style={styles.crownIcon}
            />
          </LinearGradient>
          <Text
            style={[
              styles.podiumName,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {first.username || "Inconnu"}
          </Text>
          <Text
            style={[
              styles.podiumTrophies,
              { color: currentTheme.colors.trophy },
            ]}
          >
            {first.trophies} 🏆
          </Text>
          <Text
            style={[
              styles.handle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            @{(first.username || "").toLowerCase()}
          </Text>
        </View>

        {/* Third Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#CD7F32", "#8B4513"]} // Bronze, reste fixe
            style={styles.circleThird}
          >
            <Image
              source={
                third.profileImage
                  ? { uri: third.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <MaterialCommunityIcons
              name="medal"
              size={normalizeSize(26)}
              color="#CD7F32"
              style={styles.medalIcon}
            />
          </LinearGradient>
          <Text
            style={[
              styles.podiumName,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {third.username || "Inconnu"}
          </Text>
          <Text
            style={[
              styles.podiumTrophies,
              { color: currentTheme.colors.trophy },
            ]}
          >
            {third.trophies} 🏆
          </Text>
          <Text
            style={[
              styles.handle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            @{(third.username || "").toLowerCase()}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => {
    const rank = item.rank ?? index + 4;
    return (
      <Animated.View
        entering={FadeInUp.delay(300 + index * 100)}
        style={[
          styles.playerRow,
          {
            backgroundColor: currentTheme.colors.cardBackground,
            borderColor: currentTheme.colors.border,
          },
          item.id === currentUser?.id && styles.highlight,
        ]}
      >
        <View style={styles.leftSection}>
          <Image
            source={
              item.profileImage
                ? { uri: item.profileImage }
                : require("../assets/images/default-profile.webp")
            }
            style={[
              styles.playerImage,
              { borderColor: currentTheme.colors.border },
            ]}
          />
          <View style={styles.playerInfo}>
            <Text
              style={[
                styles.playerName,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {item.username || "Inconnu"}
            </Text>
            <Text
              style={[
                styles.handle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              @{(item.username || "").toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text
            style={[
              styles.playerTrophies,
              { color: currentTheme.colors.trophy },
            ]}
          >
            {item.trophies} 🏆
          </Text>
          <Text
            style={[
              styles.rankText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            #{rank}
          </Text>
        </View>
      </Animated.View>
    );
  };

  let listPlayers: Player[] = filteredPlayers.slice(3, 23);
  const currentUserIndex = filteredPlayers.findIndex(
    (p) => p.id === currentUser?.id
  );
  if (currentUser && currentUserIndex > 22) {
    listPlayers.push({ ...currentUser, rank: currentUserIndex + 1 });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            Chargement du classement...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          `${currentTheme.colors.cardBackground}F0`,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title="Classement" />
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.tabsContainer}
        >
          {["region", "national", "global"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                { backgroundColor: `${currentTheme.colors.cardBackground}90` },
                selectedTab === tab && [
                  styles.activeTab,
                  { backgroundColor: currentTheme.colors.secondary },
                ],
              ]}
              onPress={() =>
                setSelectedTab(tab as "region" | "national" | "global")
              }
            >
              <Text
                style={[
                  styles.tabText,
                  { color: currentTheme.colors.textPrimary },
                  selectedTab === tab && styles.activeTabText,
                ]}
              >
                {tab === "region"
                  ? "Région"
                  : tab === "national"
                  ? "National"
                  : "Global"}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderTopThree()}
          <View style={styles.listContainer}>
            <FlatList
              data={listPlayers}
              renderItem={renderPlayer}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  tab: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(20),
    borderRadius: normalizeSize(25),
    marginHorizontal: normalizeSize(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  activeTab: {
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
  },
  tabText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold", // Direct
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginVertical: SCREEN_HEIGHT * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  podiumItem: {
    alignItems: "center",
    width: SCREEN_WIDTH * 0.28,
  },
  circleFirst: {
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: normalizeSize(60),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalizeSize(15),
    position: "relative",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  circleSecond: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalizeSize(15),
    position: "relative",
    borderWidth: 2,
    borderColor: "#C0C0C0",
  },
  circleThird: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalizeSize(15),
    position: "relative",
    borderWidth: 2,
    borderColor: "#CD7F32",
  },
  profileImage: {
    width: normalizeSize(80),
    height: normalizeSize(80),
    borderRadius: normalizeSize(40),
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileImageFirst: {
    width: normalizeSize(95),
    height: normalizeSize(95),
    borderRadius: normalizeSize(47.5),
    borderWidth: 3,
    borderColor: "#FFF",
  },
  crownIcon: {
    position: "absolute",
    top: -normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(4),
  },
  medalIcon: {
    position: "absolute",
    top: -normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(4),
  },
  podiumName: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold", // Direct
    textAlign: "center",
    marginTop: normalizeSize(5),
  },
  podiumTrophies: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold", // Direct
    marginTop: normalizeSize(4),
    textAlign: "center",
  },
  handle: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular", // Direct
    textAlign: "center",
    marginTop: normalizeSize(2),
  },
  scrollContent: {
    paddingBottom: SCREEN_HEIGHT * 0.08,
  },
  listContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(15),
    marginVertical: normalizeSize(8),
    borderRadius: normalizeSize(15),
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
  },
  highlight: {
    borderWidth: 2,
    borderColor: "#FACC15", // Trophy reste fixe pour highlight
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerImage: {
    width: normalizeSize(50),
    height: normalizeSize(50),
    borderRadius: normalizeSize(25),
    borderWidth: 2,
  },
  playerInfo: {
    marginLeft: normalizeSize(12),
  },
  playerName: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold", // Direct
  },
  rightSection: {
    alignItems: "flex-end",
  },
  playerTrophies: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold", // Direct
  },
  rankText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular", // Direct
    marginTop: normalizeSize(4),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular", // Direct
    marginTop: SCREEN_HEIGHT * 0.02,
  },
});
