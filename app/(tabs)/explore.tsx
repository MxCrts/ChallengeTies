import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { Alert } from "react-native";

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
    const fetchChallenges = async () => {
      try {
        if (!db) throw new Error("Firestore is not initialized properly.");

        const querySnapshot = await getDocs(collection(db, "challenges"));
        if (querySnapshot.empty) {
          console.warn("No challenges found in the database.");
          setChallenges([]);
        } else {
          const data = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Challenge[];
          setChallenges(data);
        }
      } catch (error) {
        const errorMessage =
          (error as Error).message || "Unknown error occurred";
        console.error("Error fetching challenges:", errorMessage);
        Alert.alert("Error", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const filteredChallenges = challenges.filter((challenge) => {
    const matchesSearch = challenge.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "All" || challenge.category === filter;
    return matchesSearch && matchesFilter;
  });

  const toggleSave = (challenge: Challenge) => {
    if (
      savedChallenges.some(
        (savedChallenge) => savedChallenge.id === challenge.id
      )
    ) {
      removeChallenge(challenge.id);
    } else {
      addChallenge(challenge);
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
            <View style={styles.challengeCard}>
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
            </View>
          )}
        />
      ) : (
        <Text style={styles.noResults}>No challenges found.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  searchBar: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
  },
  activeFilter: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  filterText: {
    color: "#000",
  },
  activeFilterText: {
    color: "#fff",
  },
  challengeCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  challengeContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#6c757d",
  },
  savedIndicator: {
    marginLeft: 10,
    padding: 8,
  },
  noResults: {
    textAlign: "center",
    color: "#6c757d",
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6c757d",
  },
});
