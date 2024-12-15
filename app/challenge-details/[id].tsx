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
import { useCurrentChallenges } from "../../context/CurrentChallengesContext"; // Import the new context
import { useRoute } from "@react-navigation/native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../constants/firebase-config";

type RouteParams = {
  id: string;
  title: string;
  category?: string;
  description?: string;
};

export default function ChallengeDetails() {
  const route = useRoute();
  const { id, title, category, description } = route.params as RouteParams;

  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const {
    currentChallenges,
    takeChallenge,
    removeChallenge: removeCurrentChallenge,
  } = useCurrentChallenges(); // Use CurrentChallengesContext

  const [userCount, setUserCount] = useState<number>(0);
  const [userHasTaken, setUserHasTaken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false); // Loading spinner for actions

  useEffect(() => {
    const fetchChallengeData = async () => {
      try {
        setLoading(true);
        const challengeDoc = doc(db, "challenges", id);
        const challengeSnap = await getDoc(challengeDoc);
        if (challengeSnap.exists()) {
          const challengeData = challengeSnap.data();
          const users = challengeData.usersTakingChallenge || [];
          const userHasAlreadyTaken = users.includes("user123"); // Replace with actual user ID
          setUserHasTaken(userHasAlreadyTaken);
          setUserCount(users.length);
        }
      } catch (error) {
        console.error("Error fetching challenge data:", error);
        Alert.alert("Error", "Unable to fetch challenge details. Try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchChallengeData();
  }, [id]);

  const toggleSave = () => {
    const challenge = { id, title, category, description };
    if (savedChallenges.some((challenge) => challenge.id === id)) {
      removeChallenge(id); // Remove from context and Firestore
    } else {
      addChallenge(challenge); // Add to context and Firestore
    }
  };

  const handleTakeChallenge = async () => {
    if (!userHasTaken) {
      try {
        setLoading(true);

        const challenge = {
          id,
          title,
          category,
          description,
          totalDays: 30, // Default to a 30-day challenge
          completedDays: 0,
          lastMarkedDate: null,
        };

        const challengeDoc = doc(db, "challenges", id);
        const challengeSnap = await getDoc(challengeDoc);

        if (challengeSnap.exists()) {
          const challengeData = challengeSnap.data();
          const updatedUsers = [
            ...(challengeData.usersTakingChallenge || []),
            "user123", // Replace with actual user ID
          ];

          // Update Firestore challenge
          await updateDoc(challengeDoc, {
            usersTakingChallenge: updatedUsers,
            userCount: updatedUsers.length,
          });

          // Update currentChallenges context
          await takeChallenge(challenge);

          setUserHasTaken(true);
          setUserCount(updatedUsers.length);
        }
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
      // Remove from Firestore
      const challengeDoc = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeDoc);
      if (challengeSnap.exists()) {
        const challengeData = challengeSnap.data();
        const updatedUsers = (challengeData.usersTakingChallenge || []).filter(
          (userId: string) => userId !== "user123" // Replace with actual user ID
        );

        await updateDoc(challengeDoc, {
          usersTakingChallenge: updatedUsers,
          userCount: updatedUsers.length,
        });

        // Update context
        await removeCurrentChallenge(id);

        setUserHasTaken(false);
        setUserCount(updatedUsers.length);
      }
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
        <ActivityIndicator size="large" color="#007bff" />
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

      <TouchableOpacity style={styles.saveButton} onPress={toggleSave}>
        <Ionicons
          name={
            savedChallenges.some((challenge) => challenge.id === id)
              ? "bookmark"
              : "bookmark-outline"
          }
          size={20}
          color="#fff"
        />
        <Text style={styles.saveButtonText}>
          {savedChallenges.some((challenge) => challenge.id === id)
            ? "Saved"
            : "Save Challenge"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8f9fa" },
  title: { fontSize: 24, fontWeight: "bold", color: "#343a40" },
  category: { fontSize: 16, color: "#6c757d", marginVertical: 8 },
  description: { marginTop: 8, fontSize: 14, color: "#495057" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "#007bff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: { marginLeft: 8, color: "#fff", fontWeight: "bold" },
  takeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  takeChallengeButtonText: { color: "#fff", fontWeight: "bold" },
  disabledButton: { backgroundColor: "#6c757d" },
  removeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#dc3545",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  removeChallengeButtonText: { color: "#fff", fontWeight: "bold" },
  userCountText: { marginTop: 16, fontSize: 16, color: "#6c757d" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6c757d" },
});
