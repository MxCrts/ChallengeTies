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
import {
  collection,
  doc,
  onSnapshot,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import Animated, { FadeIn, Layout } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: string;
}

export default function MyChallenges() {
  const router = useRouter();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        const challengeRefs = userData.createdChallenges || [];

        // Récupérer les défis créés avec leurs `participantsCount`
        const challengesWithParticipants = await Promise.all(
          challengeRefs.map(async (challenge) => {
            const challengeSnap = await getDoc(
              doc(db, "challenges", challenge.id)
            );
            if (challengeSnap.exists()) {
              return {
                ...challenge,
                participantsCount: challengeSnap.data().participantsCount,
              };
            }
            return challenge;
          })
        );

        setMyChallenges(challengesWithParticipants);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRemoveChallenge = async (id: string) => {
    Alert.alert(
      "Supprimer le Défi",
      "Êtes-vous sûr de vouloir supprimer ce défi ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "challenges", id));
              setMyChallenges((prev) =>
                prev.filter((challenge) => challenge.id !== id)
              );
              Alert.alert("Supprimé", "Votre défi a été supprimé avec succès.");
            } catch (error) {
              console.error("Erreur lors de la suppression:", error);
              Alert.alert("Erreur", "Impossible de supprimer ce défi.");
            }
          },
        },
      ]
    );
  };

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

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
    >
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
        <ActivityIndicator size="large" color="#FACC15" />
        <Text style={styles.loadingText}>Chargement de vos défis...</Text>
      </LinearGradient>
    );
  }

  if (myChallenges.length === 0) {
    return (
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E"]}
        style={styles.noChallengesContainer}
      >
        <Ionicons name="create-outline" size={60} color="#b0bec5" />
        <Text style={styles.noChallengesText}>Aucun défi créé</Text>
        <Text style={styles.noChallengesSubtext}>
          Créez votre premier défi dès maintenant !
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1C1C1E", "#2C2C2E"]} style={styles.container}>
      <Text style={styles.header}>Mes Défis Créés</Text>
      <FlatList
        data={myChallenges}
        renderItem={renderChallenge}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </LinearGradient>
  );
}

// --------------------------------
// 🎨 Styles modernes et épurés
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A3A3C",
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
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
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FACC15",
    marginBottom: 5,
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
    marginBottom: 15,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
});
