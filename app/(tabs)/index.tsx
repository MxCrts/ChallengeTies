import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  Text,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config"; // ✅ Import de auth
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { onAuthStateChanged, User } from "firebase/auth"; // ✅ Import pour vérifier l'authentification

const { width } = Dimensions.get("window");

interface Challenge {
  id: string;
  title: string;
  imageUrl?: string;
}

const HomeScreen = () => {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null); // ✅ Ajout de l'état pour vérifier l'utilisateur
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ✅ Vérifier si l'utilisateur est connecté avant d'exécuter fetchChallenges
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  const fetchChallenges = async () => {
    if (!user) return; // 🚨 Ne pas exécuter si l'utilisateur n'est pas connecté

    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "challenges"));
      const fetchedChallenges = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data?.title || "Défi Mystère",
          imageUrl: data?.imageUrl || "https://via.placeholder.com/150",
        };
      });
      setChallenges(fetchedChallenges);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des défis :", error);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) fetchChallenges(); // ✅ Appeler fetchChallenges seulement si l'utilisateur est connecté
    }, [user])
  );

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <TouchableOpacity
      style={styles.challengeCard}
      onPress={() => router.push(`/challenge-details/${item.id}`)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.challengeImage} />
      <View style={styles.overlay}>
        <Text style={styles.challengeTitle}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={["#1C1C2E", "#2A2A3E"]} style={styles.container}>
      {/* Hero Section */}
      <Animated.View
        style={[
          styles.heroSection,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={require("../../assets/images/logoFinal.png")}
          style={styles.logo}
        />
        <Text style={styles.heroTitle}>
          Repousse Tes Limites, Devient Une Légende
        </Text>
        <Text style={styles.heroSubtitle}>
          Des défis pour t’améliorer chaque jour.
        </Text>
      </Animated.View>

      {/* ✅ Afficher les défis uniquement si l'utilisateur est connecté */}
      {user ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔥 Défis Populaires</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#FACC15" />
          ) : challenges.length > 0 ? (
            <FlatList
              data={challenges}
              keyExtractor={(item) => item.id}
              renderItem={renderChallenge}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.challengeList}
            />
          ) : (
            <Text style={styles.noChallengesText}>Aucun défi disponible</Text>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔒 Connecte-toi pour voir les défis !
          </Text>
        </View>
      )}
      {/* Découvrir Plus */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Découvrir Plus</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.tipsButton]}
            onPress={() => router.push("/tips")}
          >
            <Ionicons name="bulb-outline" size={28} color="#FFF" />
            <Text style={styles.buttonText}>Tips & Tricks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.leaderboardButton]}
            onPress={() => router.push("/leaderboard")}
          >
            <Ionicons name="trophy-outline" size={28} color="#FFF" />
            <Text style={styles.buttonText}>Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.newFeaturesButton]}
            onPress={() => router.push("/new-features")}
          >
            <Ionicons name="sparkles-outline" size={28} color="#FFF" />
            <Text style={styles.buttonText}>New Features</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 15,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginTop: 5,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FACC15",
    marginBottom: 10,
    textAlign: "center",
  },
  challengeList: {
    paddingLeft: 20,
  },
  challengeCard: {
    backgroundColor: "#1E293B",
    borderRadius: 15,
    overflow: "hidden",
    marginRight: 15,
    width: 180,
  },
  challengeImage: {
    width: "100%",
    height: 120,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 10,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
  },
  noChallengesText: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 16,
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
    marginTop: 5,
  },
  tipsButton: {
    backgroundColor: "#10B981", // ✅ Vert émeraude
  },
  leaderboardButton: {
    backgroundColor: "#FACC15", // ✅ Or
  },
  newFeaturesButton: {
    backgroundColor: "#3B82F6", // ✅ Bleu électrique
  },
});

export default HomeScreen;
``;
