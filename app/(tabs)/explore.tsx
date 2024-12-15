import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import Animated, { FadeIn } from "react-native-reanimated";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
}

export default function ExploreScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();

  useEffect(() => {
    let isMounted = true; // To prevent state updates after unmount
    const fetchChallenges = async () => {
      setLoading(true);
      try {
        console.log("Fetching challenges...");
        const querySnapshot = await getDocs(collection(db, "challenges"));
        if (!isMounted) return; // Prevent setting state if unmounted

        if (querySnapshot.empty) {
          console.warn("No challenges found in Firestore.");
          setChallenges([]); // Ensure challenges array is cleared if no data exists
        } else {
          const data = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Challenge[];
          console.log("Challenges fetched:", data);
          setChallenges(data); // Update challenges state
        }
      } catch (error) {
        console.error("Error fetching challenges:", error);
        Alert.alert("Error", "Unable to fetch challenges. Please try again.");
      } finally {
        setLoading(false); // End loading state
      }
    };

    fetchChallenges();
    return () => {
      isMounted = false; // Cleanup on unmount
    };
  }, []);

  const filteredChallenges = challenges.filter((challenge) => {
    const matchesSearch = challenge.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "All" || challenge.category === filter;
    return matchesSearch && matchesFilter;
  });

  const toggleSave = (challenge: Challenge) => {
    if (!challenge.id) {
      console.error("Challenge ID is undefined. Skipping toggle save.");
      return;
    }

    if (
      savedChallenges.some(
        (savedChallenge) => savedChallenge.id === challenge.id
      )
    ) {
      console.log(`Removing saved challenge: ${challenge.title}`);
      removeChallenge(challenge.id); // Remove from context and Firestore
    } else {
      console.log(`Saving challenge: ${challenge.title}`);
      addChallenge(challenge); // Add to context and Firestore
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading challenges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search challenges..."
        placeholderTextColor="#aaa"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Section */}
      <View style={styles.filterContainer}>
        {["All", "Health", "Fitness", "Finance", "Productivity"].map(
          (category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterButton,
                filter === category && styles.activeFilter,
              ]}
              onPress={() => setFilter(category)}
            >
              <Text
                style={
                  filter === category
                    ? styles.activeFilterText
                    : styles.filterText
                }
              >
                {category}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Challenges List */}
      {filteredChallenges.length > 0 ? (
        <FlatList
          data={filteredChallenges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Animated.View entering={FadeIn} style={styles.challengeCard}>
              <Link
                href={{
                  pathname: "/challenge-details/[id]",
                  params: {
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    description: item.description,
                  },
                }}
                style={styles.challengeContent}
              >
                <View>
                  <Text style={styles.challengeTitle}>{item.title}</Text>
                  <Text style={styles.challengeCategory}>
                    {item.category || "Uncategorized"}
                  </Text>
                </View>
              </Link>
              <TouchableOpacity
                style={styles.savedIndicator}
                onPress={() => toggleSave(item)}
              >
                <Ionicons
                  name={
                    savedChallenges.some(
                      (savedChallenge) => savedChallenge.id === item.id
                    )
                      ? "star"
                      : "star-outline"
                  }
                  size={24}
                  color={
                    savedChallenges.some(
                      (savedChallenge) => savedChallenge.id === item.id
                    )
                      ? "#f0c419"
                      : "#ddd"
                  }
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      ) : (
        <Text style={styles.noResults}>
          No challenges found. Try another search or filter.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#1c1c1e",
  },
  searchBar: {
    height: 40,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 10,
    backgroundColor: "#2c2c2e",
    color: "#fff",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2c2c2e",
  },
  activeFilter: {
    backgroundColor: "#007bff",
  },
  filterText: {
    color: "#bbb",
  },
  activeFilterText: {
    color: "#fff",
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#2c2c2e",
  },
  challengeContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#aaa",
  },
  savedIndicator: {
    padding: 8,
  },
  noResults: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#aaa",
    marginTop: 10,
  },
});
