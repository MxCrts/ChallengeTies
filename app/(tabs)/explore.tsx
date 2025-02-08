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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetchedChallenges = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "Défi sans titre",
          description:
            doc.data().description || "Aucune description disponible",
          category: doc.data().category || "Divers",
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
        console.error("Erreur de chargement :", error);
        Alert.alert("Erreur", "Impossible de charger les défis.");
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

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1E293B", "#0F172A"] : ["#F3F4F6", "#FFFFFF"]}
      style={styles.container}
    >
      {/* 🔄 Switch entre Challenges & Custom Challenges */}
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={isCustomTab ? styles.switchInactive : styles.switchActive}
          onPress={() => setIsCustomTab(false)}
        >
          <Text style={styles.switchText}>Défis</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={isCustomTab ? styles.switchActive : styles.switchInactive}
          onPress={() => setIsCustomTab(true)}
        >
          <Text style={styles.switchText}>Défis personnalisés</Text>
        </TouchableOpacity>
      </View>

      {/* 🔎 Barre de recherche */}
      <TextInput
        style={styles.searchBar}
        placeholder="Rechercher un défi..."
        placeholderTextColor={isDarkMode ? "#ccc" : "#666"}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* 🛠️ Boutons Filtre & Reset */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => setCategoryVisible(true)}
          style={styles.categoryButton}
        >
          <Ionicons name="list" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSearchQuery("")}
          style={styles.resetButton}
        >
          <Ionicons name="refresh-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ➕ Bouton Création pour Custom Challenges */}
      {isCustomTab && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/create-challenge")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Créer un défi</Text>
        </TouchableOpacity>
      )}

      {/* 🔄 Liste des Challenges */}
      {loading ? (
        <ActivityIndicator size="large" color="#FACC15" />
      ) : filteredChallenges.length > 0 ? (
        <FlatList
          data={filteredChallenges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Animated.View entering={FadeInUp} style={styles.challengeCard}>
              <TouchableOpacity
                onPress={() => router.push(`/challenge-details/${item.id}`)}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.challengeImage}
                />
                <Text style={styles.challengeTitle}>{item.title}</Text>
                <Text style={styles.challengeCategory}>{item.category}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      ) : (
        <Text style={styles.noResults}>Aucun défi trouvé.</Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  switchContainer: { flexDirection: "row", marginBottom: 16 },
  switchActive: {
    flex: 1,
    padding: 12,
    backgroundColor: "#FACC15",
    borderRadius: 8,
    alignItems: "center",
  },
  switchInactive: {
    flex: 1,
    padding: 12,
    backgroundColor: "#D3D3D3",
    borderRadius: 8,
    alignItems: "center",
  },
  switchText: { color: "#222", fontWeight: "bold", fontSize: 16 },
  searchBar: {
    height: 40,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderColor: "#ccc",
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
  challengeCard: {
    padding: 16,
    borderRadius: 15,
    backgroundColor: "#fff",
    marginBottom: 15,
    elevation: 4,
  },
  challengeImage: { width: "100%", height: 100, borderRadius: 12 },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 4,
  },
  challengeCategory: { fontSize: 14, color: "#666", marginBottom: 4 },
  noResults: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
    color: "#FFF",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 15,
  },
  createButtonText: {
    marginLeft: 8,
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
