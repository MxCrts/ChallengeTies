// Enhanced CurrentChallenges.tsx
import React, { useEffect, useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import Animated, { Layout, FadeIn } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../../constants/firebase-config";
import { doc, runTransaction } from "firebase/firestore";
import ConfettiCannon from "react-native-confetti-cannon";

interface ChallengeItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const {
    currentChallenges,
    loadCurrentChallenges,
    markToday,
    removeChallenge,
  } = useCurrentChallenges();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [trophyModalVisible, setTrophyModalVisible] = useState(false);
  const [baseTrophyAmount, setBaseTrophyAmount] = useState(0);
  const [challengeToComplete, setChallengeToComplete] =
    useState<ChallengeItem | null>(null);
  const confettiRef = useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setIsLoading(true);
        await loadCurrentChallenges();
      } catch (err) {
        console.error("Error fetching current challenges:", err);
        setError("Failed to load challenges. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchChallenges();
  }, [loadCurrentChallenges]);

  const handleMarkToday = async (id: string, selectedDays: number) => {
    try {
      await markToday(id, selectedDays);
    } catch (err) {
      console.error("Error marking today:", err);
      Alert.alert("Error", "Failed to mark today. Please try again.");
    }
  };

  const handleRemoveChallenge = (id: string, selectedDays: number) => {
    Alert.alert(
      "Remove Challenge",
      "Are you sure you want to remove this challenge? Progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeChallenge(id, selectedDays);
              Alert.alert("Removed", "Challenge removed successfully.");
            } catch (err) {
              console.error("Error removing challenge:", err);
              Alert.alert("Error", "Failed to remove the challenge.");
            }
          },
        },
      ]
    );
  };

  const navigateToChallengeDetails = (item: ChallengeItem) => {
    const { id, title, category, description, selectedDays, completedDays } =
      item;
    const route =
      `/challenge-details/${encodeURIComponent(id)}` +
      `?title=${encodeURIComponent(title)}` +
      `&category=${encodeURIComponent(category || "")}` +
      `&description=${encodeURIComponent(description || "")}` +
      `&selectedDays=${selectedDays}` +
      `&completedDays=${completedDays}`;

    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const handleCompleteChallengePress = (item: ChallengeItem) => {
    setChallengeToComplete(item);
    setBaseTrophyAmount(item.selectedDays);
    setConfettiActive(true);
  };

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
        const userData = userDoc.data() || {};
        const currentTrophies = userData.trophies || 0;
        const newTrophyCount = currentTrophies + trophiesToAdd;

        let achievements = Array.isArray(userData.achievements)
          ? [...userData.achievements]
          : [];

        if (!achievements.includes("First challenge completed")) {
          achievements.push("First challenge completed");
        }

        achievements = [...new Set(achievements)];

        transaction.update(userRef, {
          trophies: newTrophyCount,
          achievements,
        });
      });

      Alert.alert("Congrats!", `You received ${trophiesToAdd} trophies!`);
    } catch (err) {
      console.error("Error awarding trophies:", err);
      Alert.alert(
        "Error",
        "Failed to update trophies. Please try again later."
      );
    }
  };

  const finalizeChallengeRemoval = async () => {
    if (!challengeToComplete) return;
    try {
      await removeChallenge(
        challengeToComplete.id,
        challengeToComplete.selectedDays
      );
    } catch (err) {
      console.error("Error removing challenge after awarding:", err);
    }
  };

  const handleClaimTrophiesWithoutAd = async () => {
    await awardTrophiesToUser(baseTrophyAmount);
    setTrophyModalVisible(false);
    finalizeChallengeRemoval();
  };

  const handleClaimTrophiesWithAd = async () => {
    const userWatchedAd = true;
    if (userWatchedAd) {
      await awardTrophiesToUser(baseTrophyAmount * 2);
    } else {
      await awardTrophiesToUser(baseTrophyAmount);
    }
    setTrophyModalVisible(false);
    finalizeChallengeRemoval();
  };

  const renderRightActions = (id: string, selectedDays: number) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={styles.trashButton}
        onPress={() => handleRemoveChallenge(id, selectedDays)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: ChallengeItem }) => {
      const isFullyCompleted = item.completedDays >= item.selectedDays;
      const isMarkedToday = item.lastMarkedDate === new Date().toDateString();

      return (
        <Swipeable
          renderRightActions={() =>
            renderRightActions(item.id, item.selectedDays)
          }
          overshootRight={false}
        >
          <Animated.View
            entering={FadeIn.delay(120).duration(400)}
            layout={Layout.springify()}
            style={styles.cardContainer}
          >
            <LinearGradient
              colors={["#ffffff", "#f1f5f9"]}
              style={styles.cardGradient}
            >
              <TouchableOpacity
                onPress={() => navigateToChallengeDetails(item)}
                style={styles.cardContent}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.cardImage}
                    onError={(e) =>
                      console.error(
                        `Error loading image for ${item.title}:`,
                        e.nativeEvent.error
                      )
                    }
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={40} color="#ccc" />
                  </View>
                )}

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardStatus}>
                    {item.completedDays}/{item.selectedDays} days completed
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.actionContainer}>
                {isFullyCompleted ? (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleCompleteChallengePress(item)}
                  >
                    <Text style={styles.completeButtonText}>Complete</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.markTodayButton,
                      isMarkedToday && styles.disabledMarkButton,
                    ]}
                    onPress={() => handleMarkToday(item.id, item.selectedDays)}
                    disabled={isMarkedToday}
                  >
                    <Text style={styles.markTodayText}>
                      {isMarkedToday ? "Marked Today" : "Mark Today"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        </Swipeable>
      );
    },
    [router]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Loading your challenges...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadCurrentChallenges}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Challenges</Text>

      {currentChallenges.length > 0 ? (
        <FlatList
          data={currentChallenges}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.id}_${item.selectedDays}`}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noChallenges}>
          You haven’t started any challenges yet!
        </Text>
      )}

      {confettiActive && (
        <ConfettiCannon
          ref={confettiRef}
          count={150}
          origin={{ x: 200, y: 0 }}
          autoStart={true}
          fadeOut={true}
          explosionSpeed={600}
          fallSpeed={2500}
          onAnimationEnd={() => {
            setConfettiActive(false);
            setTrophyModalVisible(true);
          }}
        />
      )}

      <Modal
        visible={trophyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTrophyModalVisible(false)}
      >
        <View style={styles.trophyModalContainer}>
          <View style={styles.trophyModalContent}>
            <Text style={styles.trophyModalTitle}>Challenge Completed!</Text>
            <Text style={styles.motivationalQuote}>
              "Discipline is choosing between what you want now and what you
              want most."
            </Text>
            <Text style={styles.earnedText}>
              You’ve earned {baseTrophyAmount} trophies.
            </Text>
            <Text style={styles.doubleText}>
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
              onPress={() => setTrophyModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --------------------------------
// Styles
// --------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    paddingTop: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#3b82f6",
    textAlign: "center",
    marginVertical: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  noChallenges: {
    fontSize: 16,
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 20,
  },

  // Each card
  cardContainer: {
    borderRadius: 18,
    marginBottom: 15,
    overflow: "hidden",
  },
  cardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 14,
    backgroundColor: "#ccc",
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  cardStatus: {
    fontSize: 14,
    color: "#6b7280",
  },
  actionContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  markTodayButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledMarkButton: {
    backgroundColor: "#9ca3af",
  },
  markTodayText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  completeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#FFC107",
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  // Right-swipe remove
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ef4444",
    width: 70,
    borderRadius: 18,
    marginBottom: 15,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },

  // Loading / error
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#3b82f6",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 20,
  },
  retryText: {
    color: "#3b82f6",
    fontSize: 16,
  },

  // Trophies modal
  trophyModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  trophyModalContent: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  trophyModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  motivationalQuote: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  earnedText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  doubleText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 20,
    textAlign: "center",
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
  cancelButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginTop: 6,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
