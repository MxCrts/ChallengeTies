import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

interface LeaderboardEntry {
  id: string;
  name: string;
  profileImage: string;
  trophies: number;
}

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(null);
  const userId = auth.currentUser?.uid;
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"), // Fetch data directly from the "users" collection
      (querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().displayName || "Anonymous", // Assuming "displayName" exists in "users"
          profileImage: doc.data().profileImage || "",
          trophies: doc.data().trophies || 0, // Trophies directly from "users"
        })) as LeaderboardEntry[];

        const sortedData = data.sort((a, b) => b.trophies - a.trophies); // Sort by trophies
        setLeaderboardData(sortedData.slice(0, 100)); // Limit leaderboard to top 100 users

        if (userId) {
          const currentUserData = data.find((user) => user.id === userId);
          setCurrentUser(currentUserData || null); // Sync current user details
        }

        setLoading(false); // Stop loading spinner
      },
      (error) => {
        console.error("Error fetching leaderboard data:", error);
        setLoading(false); // Stop loading spinner even on error
      }
    );

    return () => unsubscribe(); // Cleanup subscription
  }, [userId]);

  const renderItem = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => (
    <View
      style={[styles.entryContainer, item.id === userId && styles.highlight]}
    >
      <Image
        source={
          item.profileImage
            ? { uri: item.profileImage }
            : require("../public/images/default-profile.webp")
        }
        style={styles.profileImage}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.trophies}>{item.trophies} trophies</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#FF9800", "#FF5722"]} style={styles.container}>
      <TouchableOpacity
        style={styles.elegantBackButton}
        onPress={() => router.back()}
      >
        <View style={styles.elegantBackButtonContainer}>
          <Ionicons name="arrow-back-outline" size={24} color="#FFD700" />
          <Text style={styles.elegantBackButtonText}>Back</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.header}>Leaderboard</Text>
      {leaderboardData.length === 0 ? (
        <Text style={styles.emptyText}>No users on the leaderboard yet.</Text>
      ) : (
        <FlatList
          data={leaderboardData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
      {currentUser && (
        <View style={styles.currentUserContainer}>
          <Text style={styles.currentUserHeader}>Your Stats</Text>
          <View style={styles.entryContainer}>
            <Image
              source={
                currentUser.profileImage
                  ? { uri: currentUser.profileImage }
                  : require("../public/images/default-profile.webp")
              }
              style={styles.profileImage}
            />
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{currentUser.name}</Text>
              <Text style={styles.trophies}>
                {currentUser.trophies} trophies
              </Text>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  elegantBackButton: {
    marginBottom: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  elegantBackButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  elegantBackButtonText: {
    fontSize: 16,
    color: "#FFD700",
    marginLeft: 8,
    fontWeight: "bold",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  entryContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  highlight: {
    borderWidth: 2,
    borderColor: "#FF9800",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  trophies: {
    fontSize: 14,
    color: "#888",
  },
  currentUserContainer: {
    marginTop: 20,
  },
  currentUserHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFF",
  },
  emptyText: {
    fontSize: 18,
    color: "#FFF",
    textAlign: "center",
    marginTop: 20,
  },
});
