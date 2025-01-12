import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { db, auth } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import Animated, { FadeInUp } from "react-native-reanimated";

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  days: number;
  imageUrl?: string;
  participantsCount?: number;
}

export default function ExploreScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [newChallenge, setNewChallenge] = useState<Partial<Challenge>>({
    title: "",
    description: "",
    category: "Health",
    days: undefined,
  });
  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const router = useRouter();

  const categories = [
    "All",
    "Health",
    "Fitness",
    "Finance",
    "Productivity",
    "Creativity",
    "Education",
    "Career",
    "Lifestyle",
    "Social",
    "Miscellaneous",
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetchedChallenges = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "Untitled Challenge",
          description: doc.data().description || "No description available",
          category: doc.data().category || "Miscellaneous",
          days: doc.data().days || 1,
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

  const filteredChallenges = challenges.filter((challenge) => {
    const matchesSearch = challenge.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "All" || challenge.category === filter;
    return matchesSearch && matchesFilter;
  });

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilter("All");
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
          <Text style={styles.challengeCategory}>{item.category}</Text>
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
                daysOptions: [],
                chatId: item.id,
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
      <TouchableOpacity style={styles.resetButton} onPress={handleResetFilters}>
        <Ionicons name="refresh-outline" size={24} color="#fff" />
        <Text style={styles.resetText}>Reset Filters</Text>
      </TouchableOpacity>
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
    fontSize: 16,
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
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#ff3b30",
    marginBottom: 16,
  },
  resetText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
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
  challengeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  savedIndicator: {
    padding: 8,
    alignSelf: "center",
    backgroundColor: "#3A3A3C",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
