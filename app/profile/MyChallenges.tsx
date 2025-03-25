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
  Dimensions,
  SafeAreaView,
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
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

// On réduit légèrement la largeur des cartes en définissant un pourcentage du SCREEN_WIDTH
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

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
      "Supprimer le défi",
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
            <Text style={styles.challengeTitle} numberOfLines={1}>
              {item.title}
            </Text>
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
        colors={["#ECECEC", "#F8F8F8"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#ED8F03" />
        <Text style={styles.loadingText}>Chargement de vos défis...</Text>
      </LinearGradient>
    );
  }

  if (myChallenges.length === 0) {
    return (
      <LinearGradient
        colors={["#ECECEC", "#F8F8F8"]}
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
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#ECECEC", "#F8F8F8"]} style={styles.container}>
        <BackButton color="#ED8F03" />
        <Text style={styles.header}>Mes Défis Créés</Text>
        <FlatList
          data={myChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

interface Challenge {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: string;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: "#ECECEC",
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    textAlign: "center",
    marginVertical: 20,
    marginBottom: 30,
  },
  listContainer: {
    paddingBottom: 40,
  },
  challengeCard: {
    width: CARD_WIDTH,
    alignSelf: "center",
    borderRadius: 18,
    marginBottom: 15,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ED8F03",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  challengeContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  challengeImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 14,
  },
  placeholderImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#555555",
    marginTop: 4,
    textTransform: "capitalize",
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EF4444",
    width: 70,
    borderRadius: 18,
    marginBottom: 15,
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
    backgroundColor: "#ECECEC",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#ED8F03",
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
});
