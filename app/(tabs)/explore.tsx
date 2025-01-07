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
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import Animated, { FadeInUp } from "react-native-reanimated";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  participantsCount?: number;
}

export default function ExploreScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.filter) {
      setFilter(params.filter as string);
    }
  }, [params.filter]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetchedChallenges = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "Untitled Challenge",
          category: doc.data().category || "Miscellaneous",
          description: doc.data().description || "No description available",
          imageUrl: doc.data().imageUrl || null,
          participantsCount: doc.data().participantsCount || 0,
        })) as Challenge[];

        setChallenges(fetchedChallenges);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching challenges:", error);
        Alert.alert("Error", "Failed to fetch challenges. Please try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const categories = [
    "All",
    "Health",
    "Fitness",
    "Finance",
    "Productivity",
    "Special",
    "Creativity",
    "Education",
    "Career",
    "Lifestyle",
    "Social",
    "Miscellaneous",
  ];

  const filteredChallenges = challenges.filter((challenge) => {
    const matchesSearch = challenge.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "All" || challenge.category === filter;
    return matchesSearch && matchesFilter;
  });

  const takeChallenge = async (challenge: Challenge) => {
    try {
      const challengeRef = doc(db, "challenges", challenge.id);

      await updateDoc(challengeRef, {
        participantsCount: increment(1), // Ensure atomic increment
      });

      console.log(`Challenge "${challenge.title}" taken.`);
    } catch (error) {
      console.error("Error taking challenge:", error);
      Alert.alert("Error", "Failed to take challenge. Please try again.");
    }
  };

  const renderChallengeItem = ({ item }: { item: Challenge }) => (
    <Animated.View entering={FadeInUp} style={styles.challengeCard}>
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
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No Image</Text>
          </View>
        )}
        <View>
          <Text style={styles.challengeTitle}>{item.title}</Text>
          <Text style={styles.challengeCategory}>
            {item.category || "Miscellaneous"}
          </Text>
          <Text style={styles.participantsCount}>
            {item.participantsCount || 0} participants
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.savedIndicator}
        onPress={() =>
          savedChallenges.some(
            (savedChallenge) => savedChallenge.id === item.id
          )
            ? removeChallenge(item.id)
            : addChallenge({
                id: item.id,
                title: item.title,
                category: item.category,
                description: item.description,
                imageUrl: item.imageUrl,
                daysOptions: [], // Ensure this is fetched from Firestore if necessary
                chatId: item.id, // Use `id` as chatId for now
              })
        }
      >
        <Ionicons
          name={
            savedChallenges.some(
              (savedChallenge) => savedChallenge.id === item.id
            )
              ? "bookmark"
              : "bookmark-outline"
          }
          size={24}
          color={
            savedChallenges.some(
              (savedChallenge) => savedChallenge.id === item.id
            )
              ? "#FFD700"
              : "#bbb"
          }
        />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search challenges..."
        placeholderTextColor="#aaa"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <View style={styles.filterContainer}>
        {categories.map((category) => (
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
        ))}
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : filteredChallenges.length > 0 ? (
        <FlatList
          data={filteredChallenges}
          keyExtractor={(item) => item.id}
          renderItem={renderChallengeItem}
          contentContainerStyle={styles.challengeList}
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
    backgroundColor: "#1C1C1E",
  },
  searchBar: {
    height: 40,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#2C2C2E",
    color: "#fff",
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#2C2C2E",
    marginBottom: 10,
  },
  activeFilter: {
    backgroundColor: "#007bff",
  },
  filterText: {
    fontSize: 14,
    color: "#bbb",
  },
  activeFilterText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "bold",
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
    elevation: 3,
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
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#bbb",
    fontSize: 12,
  },
  challengeContent: {
    flex: 1,
  },
  savedIndicator: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  challengeList: {
    paddingBottom: 20,
  },
  noResults: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
    color: "#aaa",
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#aaa",
  },
  participantsCount: {
    fontSize: 12,
    color: "#ddd",
    marginTop: 5,
  },
});
