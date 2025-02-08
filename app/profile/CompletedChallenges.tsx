import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, Layout } from "react-native-reanimated";

interface CompletedChallenge {
  id: string;
  title: string;
  imageUrl?: string;
  dateCompleted: string;
  category?: string;
  description?: string;
  selectedDays: number;
}

export default function CompletedChallenges() {
  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() || {};
          const challenges = Array.isArray(userData.CompletedChallenges)
            ? userData.CompletedChallenges
            : [];

          const mappedChallenges = challenges.map((c) => ({
            id: c.id,
            title: c.title || "Défi sans titre",
            imageUrl: c.imageUrl || null,
            dateCompleted: c.dateCompleted || "Date inconnue",
            category: c.category || "Non catégorisé",
            description: c.description || "Pas de description",
            selectedDays: c.selectedDays || 0,
          }));

          setCompletedChallenges(mappedChallenges);
        } else {
          setCompletedChallenges([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur lors du chargement :", error);
        Alert.alert("Erreur", "Impossible de charger les défis complétés.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const renderChallenge = ({ item }: { item: CompletedChallenge }) => (
    <Animated.View
      entering={FadeIn}
      layout={Layout.springify()}
      style={styles.challengeCard}
    >
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
        {/* ✅ Image du challenge */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.challengeImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#b0bec5" />
          </View>
        )}

        {/* ✅ Détails du challenge */}
        <View style={styles.challengeDetails}>
          <Text style={styles.challengeTitle}>{item.title}</Text>
          <Text style={styles.challengeDate}>
            Complété le {new Date(item.dateCompleted).toLocaleDateString()}
          </Text>
          <Text style={styles.challengeCategory}>{item.category}</Text>
          <Text style={styles.challengeSelectedDays}>
            {item.selectedDays} jours de défi
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#FACC15" />
        <Text style={styles.loadingText}>
          Chargement des défis complétés...
        </Text>
      </LinearGradient>
    );
  }

  if (completedChallenges.length === 0) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.noChallengesContainer}
      >
        <Ionicons name="checkmark-done-outline" size={60} color="#b0bec5" />
        <Text style={styles.noChallengesText}>Aucun défi complété !</Text>
        <Text style={styles.noChallengesSubtext}>
          Terminez des défis pour les voir ici.
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1C1C1E", "#2C2C2E"]} style={styles.container}>
      <Text style={styles.header}>Défis Complétés</Text>
      <FlatList
        data={completedChallenges}
        renderItem={renderChallenge}
        keyExtractor={(item) => `${item.id}_${item.selectedDays}`}
        contentContainerStyle={styles.listContainer}
      />
    </LinearGradient>
  );
}

// --------------------------------
// 🎨 Styles ultra modernes
// --------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FACC15",
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    marginTop: 5,
    maxWidth: 250,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FACC15",
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  challengeCard: {
    backgroundColor: "#2A2A2E",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
  },
  challengeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  challengeImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 15,
  },
  placeholderImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
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
    color: "#FACC15",
  },
  challengeDate: {
    fontSize: 14,
    color: "#bbb",
    marginBottom: 3,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#bbb",
  },
  challengeSelectedDays: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 3,
  },
});
