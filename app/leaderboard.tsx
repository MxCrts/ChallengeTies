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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

const { width } = Dimensions.get("window");

interface Player {
  id: string;
  username: string;
  trophies: number;
  profilePicture?: string;
  country?: string;
  region?: string;
}

export default function LeaderboardScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "region" | "national" | "global"
  >("global");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const fetchedPlayers = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          username: doc.data().username || "Joueur Mystère",
          trophies: doc.data().trophies || 0,
          profilePicture: doc.data().profilePicture || null,
          country: doc.data().country || "Unknown",
          region: doc.data().region || "Unknown",
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

    return (
      <View style={styles.topThreeContainer}>
        <View style={[styles.podium, styles.second]}>
          <Image
            source={
              filteredPlayers[1]?.profilePicture
                ? { uri: filteredPlayers[1].profilePicture }
                : require("../assets/images/default-profile.webp")
            }
            style={styles.topImage}
          />
          <Text style={styles.topName}>{filteredPlayers[1].username}</Text>
          <Text style={styles.topTrophies}>
            {filteredPlayers[1].trophies} 🏆
          </Text>
          <Ionicons name="medal-outline" size={24} color="#C0C0C0" />
        </View>

        <View style={[styles.podium, styles.first]}>
          <Image
            source={
              filteredPlayers[0]?.profilePicture
                ? { uri: filteredPlayers[0].profilePicture }
                : require("../assets/images/default-profile.webp")
            }
            style={[styles.topImage, styles.goldBorder]}
          />
          <Text style={styles.topName}>{filteredPlayers[0].username}</Text>
          <Text style={styles.topTrophies}>
            {filteredPlayers[0].trophies} 🏆
          </Text>
          <Ionicons name="medal-outline" size={28} color="#FFD700" />
        </View>

        <View style={[styles.podium, styles.third]}>
          <Image
            source={
              filteredPlayers[2]?.profilePicture
                ? { uri: filteredPlayers[2].profilePicture }
                : require("../assets/images/default-profile.webp")
            }
            style={styles.topImage}
          />
          <Text style={styles.topName}>{filteredPlayers[2].username}</Text>
          <Text style={styles.topTrophies}>
            {filteredPlayers[2].trophies} 🏆
          </Text>
          <Ionicons name="medal-outline" size={24} color="#CD7F32" />
        </View>
      </View>
    );
  };

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => (
    <View
      style={[
        styles.playerRow,
        item.id === currentUser?.id && styles.highlight,
      ]}
    >
      <Text style={styles.rank}>{index + 1}</Text>
      <Image
        source={
          item.profilePicture
            ? { uri: item.profilePicture }
            : require("../assets/images/default-profile.webp")
        }
        style={styles.playerImage}
      />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.username}</Text>
        <Text style={styles.playerTrophies}>{item.trophies} 🏆</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={["#1E1E2E", "#2C2C3E"]} style={styles.container}>
      <Text style={styles.header}>🏆 Classement</Text>

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
        <ActivityIndicator size="large" color="#FACC15" />
      ) : (
        <>
          {renderTopThree()}
          <FlatList
            data={filteredPlayers.slice(3)}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FACC15",
    textAlign: "center",
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#2C2C3E",
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: "#FACC15",
  },
  goldBorder: {
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  tabText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: 20,
  },
  podium: {
    alignItems: "center",
    padding: 10,
    borderRadius: 15,
    backgroundColor: "#2E2E3E",
    width: width * 0.28,
  },
  first: { backgroundColor: "#FFD700" },
  second: { backgroundColor: "#C0C0C0" },
  third: { backgroundColor: "#CD7F32" },
  topImage: { width: 60, height: 60, borderRadius: 30, marginBottom: 5 },
  topName: { fontSize: 16, fontWeight: "bold", color: "#FFF" },
  topTrophies: { fontSize: 14, color: "#FFF" },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F2E",
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
  },
  highlight: { borderWidth: 2, borderColor: "#FACC15" },
  rank: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FACC15",
    width: 40,
    textAlign: "center",
  },
  playerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  playerTrophies: {
    fontSize: 14,
    color: "#FACC15",
  },
  listContainer: {
    paddingHorizontal: 20,
  },
});
