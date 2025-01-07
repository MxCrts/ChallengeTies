import React from "react";
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
import Animated, { FadeIn } from "react-native-reanimated";
import {
  useSavedChallenges,
  Challenge,
} from "../../context/SavedChallengesContext";
import { useRouter } from "expo-router";

export default function SavedChallenges() {
  const { savedChallenges, removeChallenge, loadSavedChallenges } =
    useSavedChallenges();
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const fetchChallenges = async () => {
      setIsLoading(true);
      try {
        await loadSavedChallenges();
      } catch (error) {
        console.error("Error loading saved challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const handleRemove = async (id: string) => {
    Alert.alert(
      "Remove Challenge",
      "Are you sure you want to remove this challenge?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeChallenge(id);
              await loadSavedChallenges();
            } catch (error) {
              console.error("Error removing challenge:", error);
              Alert.alert(
                "Error",
                "Failed to remove the challenge. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <Animated.View entering={FadeIn} style={styles.challengeItem}>
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
            onError={(error) =>
              console.error(`Error loading image for ${item.title}:`, error)
            }
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#b0bec5" />
          </View>
        )}
        <View style={styles.challengeDetails}>
          <Text style={styles.challengeTitle}>{item.title}</Text>
          <Text style={styles.challengeCategory}>
            {item.category || "Uncategorized"}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Loading saved challenges...</Text>
      </View>
    );
  }

  if (savedChallenges.length === 0) {
    return (
      <View style={styles.noChallengesContainer}>
        <Ionicons name="bookmark-outline" size={60} color="#b0bec5" />
        <Text style={styles.noChallengesText}>No saved challenges found!</Text>
        <Text style={styles.noChallengesSubtext}>
          Save some challenges to see them here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Saved Challenges</Text>
      <FlatList
        data={savedChallenges}
        renderItem={renderChallenge}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f3f9ff",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e88e5",
    marginBottom: 20,
    textAlign: "center",
  },
  challengeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e3f2fd",
    padding: 15,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e88e5",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#546e7a",
  },
  removeButton: {
    backgroundColor: "#f44336",
    padding: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#1e88e5",
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#546e7a",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    color: "#90a4ae",
    textAlign: "center",
    marginTop: 5,
  },
});
