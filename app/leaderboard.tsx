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
import BackButton from "../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import designSystem from "../theme/designSystem";

const { lightTheme } = designSystem;
const currentTheme = lightTheme;

const { width } = Dimensions.get("window");

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

  // Render podium (Top 3)
  const renderTopThree = () => {
    if (filteredPlayers.length < 3) return null;
    const [first, second, third] = filteredPlayers;
    return (
      <View style={styles.topThreeContainer}>
        {/* Second Place */}
        <View style={styles.podiumItem}>
          <View style={styles.circleSecond}>
            <Image
              source={
                second.profileImage
                  ? { uri: second.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <MaterialCommunityIcons
              name="medal-outline"
              size={22}
              color="#C0C0C0"
              style={styles.medalIcon}
            />
          </View>
          <Text style={styles.podiumName}>{second.username || "Inconnu"}</Text>
          <Text style={styles.podiumTrophies}>{second.trophies} 🏆</Text>
          <Text style={styles.handle}>
            @{(second.username || "").toLowerCase()}
          </Text>
        </View>

        {/* First Place */}
        <View style={styles.podiumItem}>
          <View style={styles.circleFirst}>
            <Image
              source={
                first.profileImage
                  ? { uri: first.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <MaterialCommunityIcons
              name="crown-outline"
              size={30}
              color="#FFD700"
              style={styles.crownIcon}
            />
          </View>
          <Text style={styles.podiumName}>{first.username || "Inconnu"}</Text>
          <Text style={styles.podiumTrophies}>{first.trophies} 🏆</Text>
          <Text style={styles.handle}>
            @{(first.username || "").toLowerCase()}
          </Text>
        </View>

        {/* Third Place */}
        <View style={styles.podiumItem}>
          <View style={styles.circleThird}>
            <Image
              source={
                third.profileImage
                  ? { uri: third.profileImage }
                  : require("../assets/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <MaterialCommunityIcons
              name="medal-outline"
              size={22}
              color="#CD7F32"
              style={styles.medalIcon}
            />
          </View>
          <Text style={styles.podiumName}>{third.username || "Inconnu"}</Text>
          <Text style={styles.podiumTrophies}>{third.trophies} 🏆</Text>
          <Text style={styles.handle}>
            @{(third.username || "").toLowerCase()}
          </Text>
        </View>
      </View>
    );
  };

  // Render Player Row pour le reste de la liste
  const renderPlayer = ({ item, index }: { item: Player; index: number }) => {
    const rank = item.rank ?? index + 4;
    return (
      <View
        style={[
          styles.playerRow,
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
            style={styles.playerImage}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.playerName}>{item.username || "Inconnu"}</Text>
            <Text style={styles.handle}>
              @{(item.username || "").toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.playerTrophies}>{item.trophies}</Text>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
      </View>
    );
  };

  // Préparer la liste des joueurs après le podium (joueurs 4 à 23)
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
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
      >
        <BackButton />
        <Text style={[styles.header, { color: currentTheme.colors.secondary }]}>
          Leaderboard
        </Text>
        <View style={styles.tabsContainer}>
          {["region", "national", "global"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.activeTab]}
              onPress={() =>
                setSelectedTab(tab as "region" | "national" | "global")
              }
            >
              <Text style={styles.tabText}>
                {tab === "region"
                  ? "Région"
                  : tab === "national"
                  ? "National"
                  : "Global"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={currentTheme.colors.trophy} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
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
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
    paddingTop: 10,
  },
  header: {
    fontSize: 28,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.textPrimary,
    textAlign: "center",
    marginTop: 30,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: currentTheme.colors.secondary,
  },
  tabText: {
    color: "#333333",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontSize: 16,
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  podiumItem: {
    alignItems: "center",
    width: width * 0.3,
  },
  circleFirst: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  circleSecond: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(192, 192, 192, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  circleThird: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(205, 127, 50, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  profileImage: {
    width: 95,
    height: 95,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  crownIcon: {
    position: "absolute",
    top: -25,
  },
  medalIcon: {
    position: "absolute",
    top: -25,
  },
  podiumName: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333333",
    textAlign: "center",
  },
  podiumTrophies: {
    fontSize: 14,
    color: "#FACC15",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  handle: {
    fontSize: 12,
    color: "#888888",
    textAlign: "center",
    marginTop: 2,
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginVertical: 5,
    borderRadius: 15,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightSection: {
    alignItems: "flex-end",
  },
  highlight: {
    borderWidth: 2,
    borderColor: "#FACC15",
  },
  playerImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  playerName: {
    fontSize: 15,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333333",
  },
  playerTrophies: {
    fontSize: 15,
    color: "#FACC15",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
  },
  rankText: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
});
