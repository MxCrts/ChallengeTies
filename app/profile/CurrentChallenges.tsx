import React, { useEffect, useCallback } from "react";
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
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import Animated, { Layout, FadeIn } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function CurrentChallenges() {
  const router = useRouter();
  const {
    currentChallenges,
    loadCurrentChallenges,
    markToday,
    removeChallenge,
  } = useCurrentChallenges();

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    ({ item }: { item: any }) => (
      <Swipeable
        renderRightActions={() =>
          renderRightActions(item.id, item.selectedDays)
        }
        overshootRight={false}
      >
        <Animated.View
          entering={FadeIn.delay(100).duration(300)}
          layout={Layout.springify()}
          style={styles.challengeItem}
        >
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/challenge-details/[id]",
                params: {
                  id: item.id,
                  title: item.title,
                  category: item.category,
                  description: item.description,
                  selectedDays: item.selectedDays,
                  completedDays: item.completedDays,
                },
              })
            }
            style={styles.challengeContent}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.challengeImage}
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
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>{item.title}</Text>
              <Text style={styles.challengeStatus}>
                {item.completedDays}/{item.selectedDays} days completed
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.markTodayButton,
              item.lastMarkedDate === new Date().toDateString() &&
                styles.disabledMarkButton,
            ]}
            onPress={() => handleMarkToday(item.id, item.selectedDays)}
            disabled={item.lastMarkedDate === new Date().toDateString()}
          >
            <Text style={styles.markTodayText}>
              {item.lastMarkedDate === new Date().toDateString()
                ? "Marked Today"
                : "Mark Today"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    ),
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
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={styles.noChallenges}>
          You haven’t started any challenges yet!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f9fafa", // Light neutral background
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#3b82f6", // Primary blue color
    textAlign: "center",
    marginBottom: 15,
  },
  challengeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff", // White card background
    padding: 15,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3, // Adds shadow for Android
  },
  challengeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  challengeImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 15,
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#e5e7eb", // Neutral gray for placeholder
    justifyContent: "center",
    alignItems: "center",
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937", // Darker neutral for better readability
    marginBottom: 5,
  },
  challengeStatus: {
    fontSize: 14,
    color: "#6b7280", // Neutral gray for secondary text
  },
  markTodayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#22c55e", // Green for action
    justifyContent: "center",
    alignItems: "center",
  },
  disabledMarkButton: {
    backgroundColor: "#9ca3af", // Gray for disabled state
  },
  markTodayText: {
    color: "#ffffff", // White text
    fontWeight: "bold",
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ef4444", // Red for delete action
    width: 75,
    height: "100%",
    borderRadius: 10,
    marginVertical: 5,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#3b82f6", // Primary blue color
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
    color: "#ef4444", // Red for errors
    textAlign: "center",
    marginBottom: 20,
  },
  retryText: {
    color: "#3b82f6", // Primary blue for retry
    fontSize: 16,
  },
  noChallenges: {
    fontSize: 16,
    textAlign: "center",
    color: "#9ca3af", // Neutral gray for no data text
    marginTop: 20,
  },
  list: {
    paddingBottom: 20,
  },
});
