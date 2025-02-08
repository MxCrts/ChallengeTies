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
import Animated, { FadeIn, Layout } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { auth, db } from "../../constants/firebase-config";
import { doc, updateDoc, getDoc } from "firebase/firestore";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

export default function SavedChallenges() {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 🔥 Récupérer les défis sauvegardés depuis Firestore
  const loadSavedChallenges = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("Utilisateur non authentifié.");
      return;
    }

    try {
      setIsLoading(true);
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setSavedChallenges(userData.SavedChallenges || []);
      } else {
        setSavedChallenges([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des défis sauvegardés :", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedChallenges();
  }, []);

  // 🔥 Supprimer un défi des favoris
  const handleRemoveChallenge = async (id: string) => {
    Alert.alert("Supprimer", "Voulez-vous vraiment supprimer ce défi ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;

            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
              SavedChallenges: savedChallenges.filter((ch) => ch.id !== id),
            });

            setSavedChallenges((prev) => prev.filter((ch) => ch.id !== id));
          } catch (error) {
            console.error("Erreur lors de la suppression :", error);
            Alert.alert("Erreur", "Impossible de supprimer ce défi.");
          }
        },
      },
    ]);
  };

  // 🔥 Définir l'affichage des boutons de suppression
  const renderRightActions = (id: string) => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity
        style={styles.trashButton}
        onPress={() => handleRemoveChallenge(id)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // 🔥 Affichage de chaque défi sauvegardé
  const renderChallenge = ({ item }: { item: Challenge }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
    >
      <Animated.View
        entering={FadeIn}
        layout={Layout.springify()}
        style={styles.challengeItem}
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

          <View style={styles.challengeDetails}>
            <Text style={styles.challengeTitle}>{item.title}</Text>
            <Text style={styles.challengeCategory}>
              {item.category || "Sans catégorie"}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );

  if (isLoading) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#8bc34a" />
        <Text style={styles.loadingText}>
          Chargement des défis sauvegardés...
        </Text>
      </LinearGradient>
    );
  }

  if (savedChallenges.length === 0) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.noChallengesContainer}
      >
        <Ionicons name="bookmark-outline" size={60} color="#b0bec5" />
        <Text style={styles.noChallengesText}>Aucun défi sauvegardé !</Text>
        <Text style={styles.noChallengesSubtext}>
          Enregistrez des défis pour les retrouver ici.
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1C1C1E", "#2C2C2E"]} style={styles.container}>
      <Text style={styles.header}>Défis Sauvegardés</Text>
      <FlatList
        data={savedChallenges}
        renderItem={renderChallenge}
        keyExtractor={(item) => item.id}
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
    color: "#8bc34a",
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
    color: "#8bc34a",
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  challengeItem: {
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
    color: "#8bc34a",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#bbb",
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f44336",
    width: 70,
    borderRadius: 10,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
});
