import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRoute, useNavigation } from "@react-navigation/native";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Haptics from "expo-haptics"; // optional for device vibration feedback

import { LinearGradient } from "expo-linear-gradient"; // optional for progress bar

import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";

type RouteParams = {
  id: string | undefined; // can be undefined
  title: string;
  category?: string;
  description?: string;
  selectedDays?: number;
  completedDays?: number;
};

export default function ChallengeDetails() {
  const route = useRoute();
  const navigation = useNavigation();
  const router = useRouter();

  // Read route params, with defaults
  const {
    id = "",
    title = "Untitled Challenge",
    category = "Uncategorized",
    description = "No description available",
    // If these are zero, we might override them from context below
    selectedDays: routeSelectedDays = 0,
    completedDays: routeCompletedDays = 0,
  } = route.params as Partial<RouteParams>;

  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const {
    currentChallenges,
    takeChallenge,
    removeChallenge: removeCurrentChallenge,
  } = useCurrentChallenges();

  // Local states
  const [userCount, setUserCount] = useState<number>(0);
  const [userHasTaken, setUserHasTaken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([10, 30, 60, 365]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [localSelectedDays, setLocalSelectedDays] = useState<number>(10);

  // We'll keep track of final selectedDays and completedDays used in UI
  const [finalSelectedDays, setFinalSelectedDays] = useState<number>(
    routeSelectedDays || 0
  );
  const [finalCompletedDays, setFinalCompletedDays] = useState<number>(
    routeCompletedDays || 0
  );

  // For awarding trophies
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [baseTrophyAmount, setBaseTrophyAmount] = useState(0);

  // Confetti
  const confettiRef = useRef<ConfettiCannon | null>(null);

  // Optional local function to check if challenge is saved
  const isSavedChallenge = (challengeId: string) => {
    return savedChallenges.some((ch) => ch.id === challengeId);
  };

  // 1) Possibly override selected/completed days from context
  //    if route params are missing or zero.
  useEffect(() => {
    // If we already have a nonzero routeSelectedDays, use that.
    // Otherwise, try to find the record from currentChallenges context.
    if (!id) return;

    // Listen to the global challenge doc (for userCount, image, etc.)
    const challengeDocRef = doc(db, "challenges", id);
    const unsubscribe = onSnapshot(challengeDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserCount(data.participantsCount || 0);
        setChallengeImage(data.imageUrl || null);
        setDaysOptions(data.daysOptions || [10, 30, 60, 365]);
        setUserHasTaken(
          (data.usersTakingChallenge || []).includes(auth.currentUser?.uid)
        );
      }
    });

    // Also check our currentChallenges to get the real selectedDays/completedDays
    // if route params are 0 or missing
    if (routeSelectedDays === 0 || routeCompletedDays === 0) {
      const found = currentChallenges.find((ch) => ch.id === id);
      if (found) {
        setFinalSelectedDays(found.selectedDays);
        setFinalCompletedDays(found.completedDays);
      } else {
        // If not found, we default to the route values, which might be 0
        setFinalSelectedDays(routeSelectedDays || 0);
        setFinalCompletedDays(routeCompletedDays || 0);
      }
    } else {
      // We trust the route params
      setFinalSelectedDays(routeSelectedDays!);
      setFinalCompletedDays(routeCompletedDays!);
    }

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentChallenges]);

  // RE-calc showCompleteButton whenever finalSelectedDays or finalCompletedDays changes
  const showCompleteButton =
    userHasTaken &&
    finalSelectedDays > 0 &&
    finalCompletedDays >= finalSelectedDays;

  // 2) Taking a Challenge
  const handleTakeChallenge = async () => {
    if (!userHasTaken && id) {
      try {
        setLoading(true);
        await takeChallenge(
          {
            id,
            title,
            category,
            description,
            daysOptions,
            chatId: id,
            imageUrl: challengeImage || "",
          },
          localSelectedDays
        );
        setUserHasTaken(true);
        setModalVisible(false);

        // Let’s also reflect it in local UI if user takes a 10-day challenge
        setFinalSelectedDays(localSelectedDays);
        setFinalCompletedDays(0);
      } catch (err) {
        console.error("Error taking challenge:", err);
        Alert.alert(
          "Error",
          err instanceof Error
            ? err.message
            : "Unable to join the challenge. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  // 3) Save / Unsave
  const handleSaveChallenge = async () => {
    if (!id) return;
    try {
      if (isSavedChallenge(id)) {
        await removeChallenge(id);
      } else {
        await addChallenge({
          id,
          title,
          category,
          description,
          daysOptions,
          chatId: id,
          imageUrl: challengeImage || "",
        });
      }
    } catch (err) {
      console.error("Error saving challenge:", err);
      Alert.alert("Error", "Failed to save the challenge. Please try again.");
    }
  };

  // 4) Show “Complete Challenge” if user finished
  const handleShowCompleteModal = () => {
    setBaseTrophyAmount(finalSelectedDays);
    setCompletionModalVisible(true);
  };

  // 5) Award trophies
  const awardTrophiesToUser = async (trophiesToAdd: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User doc not found");
        }
        const userData = userDoc.data();
        const currentTrophies = userData.trophies || 0;
        const newTrophyCount = currentTrophies + trophiesToAdd;

        // Example achievements logic:
        let achievements = userData.achievements || [];

        // 5A) Basic achievements
        if (!achievements.includes("First challenge completed")) {
          achievements.push("First challenge completed");
        }

        // 5B) If they completed a short challenge
        if (
          finalSelectedDays === 3 &&
          !achievements.includes("3-day challenge completed")
        ) {
          achievements.push("3-day challenge completed");
        }
        // 5C) 30-day challenge
        if (
          finalSelectedDays === 30 &&
          !achievements.includes("30-day challenge completed")
        ) {
          achievements.push("30-day challenge completed");
        }

        // If you keep track of how many total challenges they've completed, do it here:
        const totalCompleted = (userData.completedChallengesCount || 0) + 1;
        let updatedFields: any = {
          trophies: newTrophyCount,
          achievements,
          completedChallengesCount: totalCompleted,
        };

        // 5D) 10 challenges completed
        if (
          totalCompleted === 10 &&
          !achievements.includes("10 challenges completed")
        ) {
          achievements.push("10 challenges completed");
          updatedFields.achievements = achievements;
        }

        transaction.update(userRef, updatedFields);
      });

      // Fire confetti for 5 seconds
      confettiRef.current?.start();
      // optional haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Stop confetti after 5 seconds
      setTimeout(() => {
        confettiRef.current?.stop();
      }, 5000);

      Alert.alert("Success!", `You received ${trophiesToAdd} trophies!`);
    } catch (err) {
      console.error("Error awarding trophies:", err);
      Alert.alert(
        "Error",
        "Failed to update trophies. Please try again later."
      );
    }
  };

  // 6) Finalize removing from current challenges
  const finalizeChallengeRemoval = async () => {
    if (!id) return;
    try {
      await removeCurrentChallenge(id, finalSelectedDays);
    } catch (err) {
      console.error("Error removing challenge:", err);
    }
  };

  // 6A) Claim standard trophies
  const handleClaimTrophiesWithoutAd = async () => {
    await awardTrophiesToUser(baseTrophyAmount);
    setCompletionModalVisible(false);
    finalizeChallengeRemoval();
  };

  // 6B) Claim double trophies
  const handleClaimTrophiesWithAd = async () => {
    // Insert real ad logic
    const userWatchedAd = true;
    if (userWatchedAd) {
      await awardTrophiesToUser(baseTrophyAmount * 2);
    } else {
      await awardTrophiesToUser(baseTrophyAmount);
    }
    setCompletionModalVisible(false);
    finalizeChallengeRemoval();
  };

  // 7) Navigate to chat
  const handleNavigateToChat = () => {
    router.push(
      `/challenge-chat/${id || ""}?title=${encodeURIComponent(title)}`
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Calculate progress percent (only if userHasTaken & not complete yet)
  const progressPercent =
    finalSelectedDays > 0
      ? Math.min(1, finalCompletedDays / finalSelectedDays)
      : 0;

  return (
    <ScrollView style={styles.container}>
      {/* Confetti Cannon */}
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false} // Let it stay until we manually stop
        explosionSpeed={800}
        fallSpeed={3000}
      />

      <View style={styles.imageContainer}>
        {challengeImage ? (
          <Image
            source={{ uri: challengeImage }}
            style={styles.challengeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={80} color="#ccc" />
            <Text style={styles.noImageText}>No Image Available</Text>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.category}>{category}</Text>
        <Text style={styles.description}>{description}</Text>

        {/* Save / Unsave */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSavedChallenge(id) && styles.savedButton,
          ]}
          onPress={handleSaveChallenge}
        >
          <Text style={styles.saveButtonText}>
            {isSavedChallenge(id) ? "Saved" : "Save Challenge"}
          </Text>
          <Ionicons
            name={isSavedChallenge(id) ? "bookmark" : "bookmark-outline"}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>

        {/* If user not taken, let them pick days */}
        {!userHasTaken && (
          <TouchableOpacity
            style={styles.takeChallengeButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.takeChallengeButtonText}>
              Take the Challenge
            </Text>
          </TouchableOpacity>
        )}

        {/* If user is in the challenge but hasn't finished, show progress */}
        {userHasTaken && !showCompleteButton && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 16, color: "#666", marginBottom: 10 }}>
              Progress: {finalCompletedDays}/{finalSelectedDays} days completed
            </Text>

            {/* Optional: A simple linear progress bar */}
            <View style={styles.progressBarBackground}>
              <LinearGradient
                colors={["#4caf50", "#8bc34a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* If user completed all days */}
        {showCompleteButton && (
          <TouchableOpacity
            style={styles.completeChallengeButton}
            onPress={handleShowCompleteModal}
          >
            <Text style={styles.completeChallengeButtonText}>
              Complete Challenge
            </Text>
          </TouchableOpacity>
        )}

        {/* Chat button (only if user has joined) */}
        {userHasTaken && (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={handleNavigateToChat}
          >
            <Text style={styles.chatButtonText}>Join Chat</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.userCountText}>
          {userCount} {userCount === 1 ? "participant" : "participants"}
        </Text>
      </View>

      {/* Modal: pick days when taking the challenge */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Duration (Days)</Text>
            <Picker
              selectedValue={localSelectedDays}
              style={styles.daysPicker}
              onValueChange={(itemValue) => setLocalSelectedDays(itemValue)}
            >
              {daysOptions.map((days) => (
                <Picker.Item key={days} label={`${days} days`} value={days} />
              ))}
            </Picker>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleTakeChallenge}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: awarding trophies */}
      <Modal visible={completionModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Challenge Completed!</Text>
            <Text style={{ marginVertical: 10 }}>
              You’ve earned {baseTrophyAmount} trophies.
            </Text>
            <Text style={{ marginBottom: 20 }}>
              Watch an ad to double your reward to {baseTrophyAmount * 2}{" "}
              trophies!
            </Text>

            <TouchableOpacity
              style={styles.claimButton}
              onPress={handleClaimTrophiesWithoutAd}
            >
              <Text style={styles.claimButtonText}>
                Claim {baseTrophyAmount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doubleButton}
              onPress={handleClaimTrophiesWithAd}
            >
              <Text style={styles.doubleButtonText}>
                Watch Ad for {baseTrophyAmount * 2}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCompletionModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------------------
// Styles
// ---------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  imageContainer: {
    height: 250,
    width: "100%",
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  challengeImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  noImageText: {
    color: "#ccc",
    marginTop: 10,
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  category: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 8,
  },
  savedButton: {
    backgroundColor: "#6c757d",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginRight: 5,
  },
  takeChallengeButton: {
    marginTop: 20,
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  takeChallengeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  completeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  completeChallengeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  chatButton: {
    marginTop: 16,
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  chatButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  userCountText: {
    marginTop: 16,
    fontSize: 16,
    color: "#444",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#444",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  daysPicker: {
    width: "100%",
    height: 50,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  claimButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  claimButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  doubleButton: {
    backgroundColor: "#17a2b8",
    padding: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  doubleButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  // Optional progress bar
  progressBarBackground: {
    width: "100%",
    height: 12,
    backgroundColor: "#ddd",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
});
