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
  StatusBar,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

// Constante SPACING pour cohérence avec new-features.tsx
const SPACING = 15;

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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

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
            setCurrentUser(
              foundUser
                ? {
                    ...foundUser,
                    country: userData.country,
                    region: userData.region,
                  }
                : null
            );
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
    if (filteredPlayers.length < 3) {
      return (
        <Text
          style={[styles.noPlayersText, { color: currentTheme.colors.textSecondary }]}
        >
          Pas assez de joueurs pour afficher le podium.
        </Text>
      );
    }
    const [first, second, third] = filteredPlayers;
    return (
      <Animated.View
        entering={FadeInUp.delay(200)}
        style={styles.topThreeContainer}
      >
        {/* Second Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#C0C0C0", "#A9A9A9"]}
            style={styles.circleSecond}
          >
            <Image
              source={
                second.profileImage
                  ? { uri: second.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
              accessibilityLabel={`Image de profil de ${second.username || "Inconnu"}`}
            />
            <MaterialCommunityIcons
              name="medal"
              size={normalizeSize(26)}
              color="#C0C0C0"
              style={styles.medalIcon}
            />
          </LinearGradient>
          <Text
            style={[styles.podiumName, { color: currentTheme.colors.textPrimary }]}
          >
            {second.username || "Inconnu"}
          </Text>
          <Text
            style={[styles.podiumTrophies, { color: currentTheme.colors.trophy }]}
          >
            {second.trophies} 🏆
          </Text>
          <Text
            style={[styles.handle, { color: currentTheme.colors.textSecondary }]}
          >
            @{(second.username || "").toLowerCase()}
          </Text>
        </View>

        {/* First Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#FFD700", "#FFA500"]}
            style={styles.circleFirst}
          >
            <Image
              source={
                first.profileImage
                  ? { uri: first.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImageFirst}
              accessibilityLabel={`Image de profil de ${first.username || "Inconnu"}`}
            />
            <MaterialCommunityIcons
              name="crown"
              size={normalizeSize(34)}
              color="#FFD700"
              style={styles.crownIcon}
            />
          </LinearGradient>
          <Text
            style={[styles.podiumName, { color: currentTheme.colors.textPrimary }]}
          >
            {first.username || "Inconnu"}
          </Text>
          <Text
            style={[styles.podiumTrophies, { color: currentTheme.colors.trophy }]}
          >
            {first.trophies} 🏆
          </Text>
          <Text
            style={[styles.handle, { color: currentTheme.colors.textSecondary }]}
          >
            @{(first.username || "").toLowerCase()}
          </Text>
        </View>

        {/* Third Place */}
        <View style={styles.podiumItem}>
          <LinearGradient
            colors={["#CD7F32", "#8B4513"]}
            style={styles.circleThird}
          >
            <Image
              source={
                third.profileImage
                  ? { uri: third.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
              accessibilityLabel={`Image de profil de ${third.username || "Inconnu"}`}
            />
            <MaterialCommunityIcons
              name="medal"
              size={normalizeSize(26)}
              color="#CD7F32"
              style={styles.medalIcon}
            />
          </LinearGradient>
          <Text
            style={[styles.podiumName, { color: currentTheme.colors.textPrimary }]}
          >
            {third.username || "Inconnu"}
          </Text>
          <Text
            style={[styles.podiumTrophies, { color: currentTheme.colors.trophy }]}
          >
            {third.trophies} 🏆
          </Text>
          <Text
            style={[styles.handle, { color: currentTheme.colors.textSecondary }]}
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
        entering={FadeInUp.delay(300 + index * 50)} // Délai réduit
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
            style={[styles.playerImage, { borderColor: currentTheme.colors.border }]}
            accessibilityLabel={`Image de profil de ${item.username || "Inconnu"}`}
          />
          <View style={styles.playerInfo}>
            <Text
              style={[styles.playerName, { color: currentTheme.colors.textPrimary }]}
            >
              {item.username || "Inconnu"}
            </Text>
            <Text
              style={[styles.handle, { color: currentTheme.colors.textSecondary }]}
            >
              @{(item.username || "").toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text
            style={[styles.playerTrophies, { color: currentTheme.colors.trophy }]}
          >
            {item.trophies} 🏆
          </Text>
          <Text
            style={[styles.rankText, { color: currentTheme.colors.textSecondary }]}
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
            Chargement du classement...
          </Text>
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
          <CustomHeader title="Classement" />
        </View>
        <Animated.View entering={FadeInUp.delay(100)} style={styles.tabsContainer}>
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
              accessibilityLabel={`Filtrer par ${tab === "region" ? "région" : tab === "national" ? "national" : "global"}`}
              testID={`tab-${tab}`}
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
          {filteredPlayers.length > 0 ? (
            <>
              {renderTopThree()}
              <View style={styles.listContainer}>
                <FlatList
                  data={listPlayers}
                  renderItem={renderPlayer}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  initialNumToRender={10}
                  getItemLayout={(data, index) => ({
                    length: normalizeSize(80),
                    offset: normalizeSize(80) * index,
                    index,
                  })}
                  accessibilityRole="list"
                  accessibilityLabel="Liste des joueurs classés"
                />
              </View>
            </>
          ) : (
            <Text
              style={[styles.noPlayersText, { color: currentTheme.colors.textSecondary }]}
            >
              Aucun joueur disponible pour ce classement.
            </Text>
          )}
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
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  tab: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(25),
    marginHorizontal: SPACING / 2,
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
    fontFamily: "Comfortaa_700Bold",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  podiumItem: {
    alignItems: "center",
    width: SCREEN_WIDTH * 0.3, // Ajusté pour responsivité
  },
  circleFirst: {
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: normalizeSize(60),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
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
    marginBottom: SPACING,
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
    marginBottom: SPACING,
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
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginTop: SPACING / 2,
  },
  podiumTrophies: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING / 2,
    textAlign: "center",
  },
  handle: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
  },
  scrollContent: {
    paddingBottom: SPACING * 2, // Réduit pour responsivité
  },
  listContainer: {
    paddingHorizontal: SPACING,
    marginTop: SPACING,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING,
    marginVertical: SPACING / 2,
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
    borderColor: "#FACC15",
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
    marginLeft: SPACING,
  },
  playerName: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
  },
  rightSection: {
    alignItems: "flex-end",
  },
  playerTrophies: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
  },
  rankText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  noPlayersText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    padding: SPACING,
  },
});