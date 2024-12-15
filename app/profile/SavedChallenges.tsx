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
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useNavigation } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";

export default function SavedChallenges() {
  const { savedChallenges, removeChallenge, loadSavedChallenges } =
    useSavedChallenges();
  const [isLoading, setIsLoading] = React.useState(true);
  const navigation = useNavigation();

  React.useEffect(() => {
    const fetchChallenges = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching saved challenges...");
        await loadSavedChallenges();
        console.log("Saved challenges loaded successfully.");
      } catch (error) {
        console.error("Error loading saved challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const handleRemove = (id: string) => {
    Alert.alert(
      "Remove Challenge",
      "Are you sure you want to remove this challenge?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeChallenge(id),
        },
      ]
    );
  };

  const renderRightActions = (id: string) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={styles.trashButton}
        onPress={() => handleRemove(id)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderChallenge = ({ item }: { item: any }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
    >
      <Animated.View entering={FadeIn} style={styles.challengeItem}>
        <TouchableOpacity
          style={styles.challengeContent}
          onPress={() =>
            navigation.navigate("challenge-details/[id]", {
              id: item.id,
              title: item.title,
              category: item.category,
              description: item.description,
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
              <Ionicons name="image-outline" size={40} color="#ccc" />
            </View>
          )}
          <View style={styles.challengeDetails}>
            <Text style={styles.challengeTitle}>{item.title}</Text>
            <Text style={styles.challengeCategory}>
              {item.category || "Uncategorized"}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2F80ED" />
        <Text style={styles.loadingText}>Loading saved challenges...</Text>
      </View>
    );
  }

  if (savedChallenges.length === 0) {
    return (
      <View style={styles.noChallengesContainer}>
        <Ionicons name="bookmark-outline" size={60} color="#bbb" />
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
    backgroundColor: "#f8f9fa",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2F80ED",
    marginBottom: 20,
    textAlign: "center",
  },
  challengeItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  challengeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  challengeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2F80ED",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#666",
  },
  listContainer: {
    paddingBottom: 20,
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff3b30",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#2F80ED",
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 5,
  },
});
