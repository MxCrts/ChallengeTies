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

  const handleMarkToday = async (id: string) => {
    try {
      await markToday(id);
    } catch (err) {
      console.error("Error marking today:", err);
    }
  };

  const handleRemoveChallenge = (id: string) => {
    Alert.alert(
      "Remove Challenge",
      "Are you sure? You will lose your progress on this challenge.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeChallenge(id);
            } catch (err) {
              console.error("Error removing challenge:", err);
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (id: string) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={styles.trashButton}
        onPress={() => handleRemoveChallenge(id)}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <Swipeable
        renderRightActions={() => renderRightActions(item.id)}
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
                  totalDays: item.totalDays,
                  completedDays: item.completedDays,
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
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>{item.title}</Text>
              <Text style={styles.challengeStatus}>
                {item.completedDays}/{item.totalDays} days completed
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.markTodayButton}
            onPress={() => handleMarkToday(item.id)}
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
        <ActivityIndicator size="large" color="#2F80ED" />
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={styles.noChallenges}>No current challenges found!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#121212",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#E0E0E0",
    textAlign: "center",
  },
  challengeItem: {
    flexDirection: "row",
    backgroundColor: "#1E1E1E",
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  challengeImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#E0E0E0",
    borderRadius: 10,
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#666",
    fontSize: 14,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E0E0E0",
    marginBottom: 5,
  },
  challengeStatus: {
    fontSize: 14,
    color: "#A0A0A0",
  },
  markTodayButton: {
    alignSelf: "center",
    backgroundColor: "#2F80ED",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  markTodayText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff6b6b",
    width: 75,
    borderRadius: 10,
    marginVertical: 5,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
  deleteText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 20,
  },
  retryText: {
    color: "#2F80ED",
    fontSize: 16,
    marginTop: 10,
  },
  noChallenges: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 50,
    color: "#A0A0A0",
  },
  list: {
    paddingBottom: 20,
  },
});
