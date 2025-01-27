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
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
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
  creatorId?: string;
}

export default function ExploreScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [customChallenges, setCustomChallenges] = useState<Challenge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [isCustomTab, setIsCustomTab] = useState(false);
  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const router = useRouter();

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
          creatorId: doc.data().creatorId || null,
        })) as Challenge[];

        setChallenges(
          fetchedChallenges.filter((challenge) => !challenge.creatorId)
        );
        setCustomChallenges(
          fetchedChallenges.filter((challenge) => challenge.creatorId)
        );
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

  const filteredChallenges = (
    isCustomTab ? customChallenges : challenges
  ).filter((challenge) => {
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

  const toggleCategoryVisibility = () => {
    setCategoryVisible(!categoryVisible);
  };

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
        <View style={styles.challengeDetails}>
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
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={isCustomTab ? styles.switchInactive : styles.switchActive}
          onPress={() => setIsCustomTab(false)}
        >
          <Text style={styles.switchText}>Challenges</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={isCustomTab ? styles.switchActive : styles.switchInactive}
          onPress={() => setIsCustomTab(true)}
        >
          <Text style={styles.switchText}>Custom Challenges</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search challenges..."
        placeholderTextColor="#aaa"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={toggleCategoryVisibility}
          style={styles.categoryButton}
        >
          <Ionicons name="list" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetFilters}
        >
          <Ionicons name="refresh-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isCustomTab && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/create-challenge")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Create Challenge</Text>
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryVisible}
        onRequestClose={() => {
          setCategoryVisible(!categoryVisible);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              decelerationRate="fast"
              snapToInterval={50}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryItem}
                  onPress={() => {
                    setFilter(category);
                    setCategoryVisible(false);
                  }}
                >
                  <Text style={styles.categoryText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCategoryVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    backgroundColor: "#FAFAFA", // Light color scheme
  },
  switchContainer: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "#E8E8E8",
    borderRadius: 8,
  },
  switchActive: {
    flex: 1,
    padding: 12,
    backgroundColor: "#007bff",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 2,
  },
  switchInactive: {
    flex: 1,
    padding: 12,
    backgroundColor: "#D3D3D3",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 2,
  },
  switchText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  searchBar: {
    height: 40,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    color: "#333",
    fontSize: 16,
    borderColor: "#E0E0E0",
    borderWidth: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007bff",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#333",
  },
  challengeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
  },
  savedIndicator: {
    padding: 8,
    backgroundColor: "#E6E6FA",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 16,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  challengeImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: "#dcdcdc",
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#999",
    fontSize: 12,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 4,
    textAlign: "left",
    flexWrap: "wrap",
    flexShrink: 1,
    flexGrow: 1,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  participantsCount: {
    fontSize: 12,
    color: "#888",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollView: {
    maxHeight: 250,
  },
  scrollContent: {
    justifyContent: "center",
    paddingBottom: 10,
  },
  categoryItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    alignItems: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingVertical: 10,
    marginVertical: 15,
  },
  createButtonText: {
    marginLeft: 8,
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  categoryText: {
    color: "#333",
    fontSize: 16,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: "#ff3b30",
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  closeButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  challengeDetails: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
});
