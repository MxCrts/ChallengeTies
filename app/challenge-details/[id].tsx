import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
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

  const [userCount, setUserCount] = useState<number>(0);
  const [userHasTaken, setUserHasTaken] = useState<boolean>(false); // Track if the user has already taken the challenge

  useEffect(() => {
    const fetchChallengeData = async () => {
      try {
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
        Alert.alert(
          "Error",
          "Unable to fetch challenge details. Please try again."
        );
      }
    };

    fetchChallengeData();
  }, [id]);

  const toggleSave = () => {
    const challenge = { id, title, category, description };
    if (savedChallenges.some((challenge) => challenge.id === id)) {
      removeChallenge(id);
    } else {
      addChallenge(challenge);
    }
  };

  const handleTakeChallenge = async () => {
    if (!userHasTaken) {
      try {
        const challengeDoc = doc(db, "challenges", id);
        const challengeSnap = await getDoc(challengeDoc);
        if (challengeSnap.exists()) {
          const challengeData = challengeSnap.data();
          const updatedUsers = [
            ...(challengeData.usersTakingChallenge || []),
            "user123", // Replace with actual user ID
          ];

          await updateDoc(challengeDoc, {
            usersTakingChallenge: updatedUsers,
            userCount: updatedUsers.length,
          });

          setUserHasTaken(true);
          setUserCount(updatedUsers.length);
        }
      } catch (error) {
        console.error("Error taking challenge:", error);
        Alert.alert("Error", "Unable to join the challenge. Please try again.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.category}>{category || "Uncategorized"}</Text>
      <Text style={styles.description}>{description}</Text>

      {/* Take the Challenge Button */}
      <TouchableOpacity
        style={[
          styles.takeChallengeButton,
          userHasTaken && styles.disabledButton,
        ]}
        onPress={handleTakeChallenge}
        disabled={userHasTaken} // Disable button if the user has already taken the challenge
      >
        <Text style={styles.takeChallengeButtonText}>
          {userHasTaken ? "Challenge Taken" : "Take the Challenge"}
        </Text>
      </TouchableOpacity>

      {/* User Count */}
      <Text style={styles.userCountText}>
        {userCount} {userCount === 1 ? "person" : "people"} taking this
        challenge
      </Text>

      {/* Save Challenge Button */}
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
  container: { padding: 16 },
  title: { fontSize: 24, fontWeight: "bold" },
  category: { fontSize: 16, color: "#6c757d", marginVertical: 8 },
  description: { marginTop: 8, fontSize: 14, color: "#343a40" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "#007bff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    marginLeft: 8,
    color: "#fff",
    fontWeight: "bold",
  },
  takeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  takeChallengeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#6c757d",
  },
  userCountText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6c757d",
  },
});
