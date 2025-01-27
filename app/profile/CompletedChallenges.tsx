import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore"; // <-- Changed here
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";

interface CompletedChallenge {
  id: string;
  title: string;
  imageUrl?: string;
  dateCompleted: string;
  category?: string;
  description?: string;
  selectedDays: number; // <-- Added this property
}

export default function CompletedChallenges() {
  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // 1) Listen to the user document
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() || {};
          // 2) Get the CompletedChallenges array (if any)
          const challenges = Array.isArray(userData.CompletedChallenges)
            ? userData.CompletedChallenges
            : [];

          // 3) Map each challenge into the shape we need
          const mappedChallenges = challenges.map((c) => ({
            id: c.id,
            title: c.title || "Untitled Challenge",
            imageUrl: c.imageUrl || null,
            dateCompleted: c.dateCompleted || "Unknown Date",
            category: c.category || "Uncategorized",
            description: c.description || "No description available",
            selectedDays: c.selectedDays || 0, // <-- Included
          }));

          setCompletedChallenges(mappedChallenges);
        } else {
          setCompletedChallenges([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching completed challenges:", error);
        Alert.alert("Error", "Failed to load completed challenges.");
        setIsLoading(false);
      }
    );

    // Cleanup
    return () => unsubscribe();
  }, []);

  const renderChallenge = ({ item }: { item: CompletedChallenge }) => (
    <Animated.View entering={FadeIn} style={styles.challengeCard}>
      <TouchableOpacity
        style={styles.challengeContent}
        onPress={() =>
          router.push({
            pathname: "/challenge-details/[id]",
            params: {
              id: item.id,
              title: item.title,
              category: item.category,
              description: item.description,
            },
          })
        }
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.challengeImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#b0bec5" />
          </View>
        )}
        <View style={styles.challengeDetails}>
          <Text style={styles.challengeTitle}>{item.title}</Text>
          <Text style={styles.challengeDate}>
            Completed: {new Date(item.dateCompleted).toLocaleDateString()}
          </Text>
          <Text style={styles.challengeCategory}>{item.category}</Text>
          <Text style={styles.challengeSelectedDays}>
            Selected Days: {item.selectedDays}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#8bc34a" />
        <Text style={styles.loadingText}>Loading completed challenges...</Text>
      </LinearGradient>
    );
  }

  if (completedChallenges.length === 0) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.noChallengesContainer}
      >
        <Ionicons name="checkmark-done-outline" size={60} color="#b0bec5" />
        <Text style={styles.noChallengesText}>
          No completed challenges yet!
        </Text>
        <Text style={styles.noChallengesSubtext}>
          Finish some challenges to see them here.
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1C1C1E", "#2C2C2E"]} style={styles.container}>
      <Text style={styles.header}>Completed Challenges</Text>
      <FlatList
        data={completedChallenges}
        renderItem={renderChallenge}
        keyExtractor={(item) => `${item.id}_${item.selectedDays}`} // <-- Ensured uniqueness
        contentContainerStyle={styles.listContainer}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#8bc34a",
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    marginTop: 5,
    maxWidth: 250,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#8bc34a",
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A3A3C",
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  challengeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  challengeImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#8bc34a",
    marginBottom: 5,
  },
  challengeDate: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#bbb",
  },
  challengeSelectedDays: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 5,
  },
});
