import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { useRoute } from "@react-navigation/native";
import {
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useRouter } from "expo-router";

type RouteParams = {
  id: string;
  title: string;
  category?: string;
  description?: string;
};

export default function ChallengeDetails() {
  const route = useRoute();
  const router = useRouter();
  const { id, title, category, description } = route.params as RouteParams;

  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const { takeChallenge, removeChallenge: removeCurrentChallenge } =
    useCurrentChallenges();

  const [userCount, setUserCount] = useState<number>(0);
  const [userHasTaken, setUserHasTaken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const challengeDoc = doc(db, "challenges", id);
    const unsubscribe = onSnapshot(challengeDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const users = data.usersTakingChallenge || [];
        setUserHasTaken(users.includes(auth.currentUser?.uid));
        setUserCount(users.length);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const handleTakeChallenge = async () => {
    if (!userHasTaken) {
      try {
        setLoading(true);
        const challengeDoc = doc(db, "challenges", id);

        // Update Firestore
        await updateDoc(challengeDoc, {
          usersTakingChallenge: arrayUnion(auth.currentUser?.uid),
          participantsCount: userCount + 1,
        });

        // Add to local currentChallenges
        await takeChallenge({
          id,
          title,
          category,
          description,
          totalDays: 30,
          completedDays: 0,
          lastMarkedDate: null,
        });
      } catch (error) {
        console.error("Error taking challenge:", error);
        Alert.alert("Error", "Unable to join the challenge. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveChallenge = async () => {
    try {
      setLoading(true);
      const challengeDoc = doc(db, "challenges", id);

      // Update Firestore
      await updateDoc(challengeDoc, {
        usersTakingChallenge: arrayRemove(auth.currentUser?.uid),
        participantsCount: Math.max(0, userCount - 1),
      });

      // Remove from local currentChallenges
      await removeCurrentChallenge(id);
    } catch (error) {
      console.error("Error removing challenge:", error);
      Alert.alert("Error", "Unable to remove the challenge. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.category}>{category || "Uncategorized"}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity
        style={[
          styles.takeChallengeButton,
          userHasTaken && styles.disabledButton,
        ]}
        onPress={handleTakeChallenge}
        disabled={userHasTaken}
      >
        <Text style={styles.takeChallengeButtonText}>
          {userHasTaken ? "Challenge Taken" : "Take the Challenge"}
        </Text>
      </TouchableOpacity>
      {userHasTaken && (
        <TouchableOpacity
          style={styles.removeChallengeButton}
          onPress={handleRemoveChallenge}
        >
          <Text style={styles.removeChallengeButtonText}>Remove Challenge</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.userCountText}>
        {userCount} {userCount === 1 ? "person" : "people"} taking this
        challenge
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f0f4f8" },
  title: { fontSize: 24, fontWeight: "bold", color: "#222" },
  category: { fontSize: 16, color: "#555", marginVertical: 8 },
  description: { fontSize: 14, color: "#666", marginVertical: 8 },
  takeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
  },
  takeChallengeButtonText: { color: "#fff", fontWeight: "bold" },
  disabledButton: { backgroundColor: "#999" },
  removeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
  },
  removeChallengeButtonText: { color: "#fff", fontWeight: "bold" },
  userCountText: { marginTop: 16, fontSize: 16, color: "#444" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#444" },
});
