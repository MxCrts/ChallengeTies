import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

interface Challenge {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
  description?: string;
}

export default function SavedChallengesScreen() {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSavedChallenges = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.warn("Utilisateur non authentifié.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          // On s'assure que SavedChallenges est un tableau
          setSavedChallenges(userData.SavedChallenges || []);
        } else {
          setSavedChallenges([]);
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des défis sauvegardés :",
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedChallenges();
  }, []);

  const onPressChallenge = (challenge: Challenge) => {
    router.push({
      pathname: "/challenge-details/[id]",
      params: {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category,
        description: challenge.description,
      },
    });
  };

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <TouchableOpacity
      style={styles.challengeItem}
      onPress={() => onPressChallenge(item)}
    >
      <Image
        source={
          item.imageUrl
            ? { uri: item.imageUrl }
            : require("../../assets/images/default-challenge.webp")
        }
        style={styles.challengeImage}
      />
      <Text style={styles.challengeTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.challengeCategory}>
        {item.category || "Sans catégorie"}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingBackground}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (savedChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.noChallengesContainer}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesBackground}
        >
          <Ionicons name="bookmark-outline" size={60} color="#b0bec5" />
          <Text style={styles.noChallengesText}>Aucun défi sauvegardé !</Text>
          <Text style={styles.noChallengesSubtext}>
            Enregistrez des défis pour les retrouver ici.
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
      >
        <BackButton color={currentTheme.colors.primary} />
        <Text style={styles.header}>Défis Sauvegardés</Text>
        <FlatList
          data={savedChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: currentTheme.colors.background,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  challengeItem: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
  },
  challengeImage: {
    width: width * 0.85,
    height: 150,
    borderRadius: 10,
  },
  challengeTitle: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginTop: 10,
    textAlign: "center",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#555555",
    marginTop: 4,
    textAlign: "center",
    textTransform: "capitalize",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: currentTheme.colors.primary,
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    marginTop: 5,
    maxWidth: 250,
  },
});
