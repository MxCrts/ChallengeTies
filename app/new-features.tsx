import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
  SafeAreaView,
} from "react-native";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  increment,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../constants/firebase-config";
import { StatusBar } from "expo-status-bar";
import BackButton from "../components/BackButton";
import ModalExplicatif from "../components/ModalExplicatif";
import FeatureDetailModal from "../components/FeatureDetailModal";
import ProposeFeatureModal from "../components/ProposeFeatureModal";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import designSystem from "../theme/designSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { lightTheme } = designSystem;
const currentTheme = lightTheme;

const { width } = Dimensions.get("window");
const ITEM_WIDTH = Math.round(width * 0.9);
const ITEM_HEIGHT = 150; // Hauteur fixe de chaque card
const CARD_MARGIN = 8;

//
// Countdown en blocs
//
type CountdownValues = {
  days: number;
  hours: number;
  mins: number;
  secs: number;
};

type Feature = {
  id: string;
  title: string;
  votes: number;
  approved?: boolean;
  description?: string;
  username?: string;
};

export default function NewFeatures() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownValues>({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });
  const [user, setUser] = useState<any>(null);

  const [showExplanationModal, setShowExplanationModal] =
    useState<boolean>(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showFeatureDetailModal, setShowFeatureDetailModal] =
    useState<boolean>(false);
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);

  // Récupération de l'user (doc Firestore) et de son vote
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUser({ ...data, uid: firebaseUser.uid });
          setUserVote(data.votedFor || null);
        } else {
          setUser(firebaseUser);
        }
      }
    });
    return unsubscribeAuth;
  }, []);
  const userId = user?.uid;

  // Modal explicatif affiché une première fois
  useEffect(() => {
    const checkModalShown = async () => {
      try {
        const value = await AsyncStorage.getItem("explanationModalShown");
        if (!value) {
          setShowExplanationModal(true);
          await AsyncStorage.setItem("explanationModalShown", "true");
        }
      } catch (error) {
        console.error("Erreur AsyncStorage:", error);
      }
    };
    checkModalShown();
  }, []);

  // Récupération des features
  useEffect(() => {
    if (!userId) return;
    const featuresRef = collection(db, "polls", "new-features", "features");
    const unsubscribe = onSnapshot(featuresRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Feature[];
      const approvedFeatures = data.filter(
        (feature) => feature.approved === true
      );
      approvedFeatures.sort((a, b) => b.votes - a.votes);
      setFeatures(approvedFeatures);
      setLoading(false);
    });

    // Récupération du vote
    const fetchUserVote = async () => {
      if (userId) {
        const userDoc = doc(db, "users", userId);
        const userSnapshot = await getDoc(userDoc);
        if (userSnapshot.exists()) {
          setUserVote(userSnapshot.data().votedFor || null);
        }
      }
    };
    fetchUserVote();

    return () => unsubscribe();
  }, [userId]);

  // Countdown jusqu'au 30 avril 2025
  useEffect(() => {
    const targetDate = new Date("2025-04-30T23:59:59Z");
    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ days, hours, mins, secs });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ouverture du modal de détail d'une feature
  const openFeatureDetail = (feature: Feature) => {
    setSelectedFeature(feature);
    setShowFeatureDetailModal(true);
  };

  // Fonction de vote (vérifie si l'utilisateur a déjà voté)
  const handleVote = async (featureId: string) => {
    if (!userId) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour voter.");
      return;
    }
    if (userVote) {
      Alert.alert("Vote déjà effectué", "Vous avez déjà voté.");
      return;
    }
    try {
      const featureRef = doc(
        db,
        "polls",
        "new-features",
        "features",
        featureId
      );
      await updateDoc(featureRef, { votes: increment(1) });
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { votedFor: featureId });
      setUserVote(featureId);
      Alert.alert("Vote enregistré", "Merci pour votre vote !");
    } catch (error) {
      console.error("Erreur lors du vote :", error);
      Alert.alert("Erreur", "Une erreur est survenue lors de votre vote.");
    }
  };

  // Fonction de proposition d'une feature :
  // Si l'utilisateur propose une feature, son vote est automatiquement enregistré (il ne peut voter qu'une fois)
  const handleProposeFeature = async (title: string, description?: string) => {
    if (!userId) {
      Alert.alert(
        "Connexion requise",
        "Veuillez vous connecter pour proposer une fonctionnalité."
      );
      return;
    }
    try {
      const username = user?.username || "Inconnu";
      const featureRef = await addDoc(
        collection(db, "polls", "new-features", "features"),
        {
          title,
          description: description || "",
          votes: 1,
          approved: false,
          username: username,
        }
      );
      // Enregistre automatiquement le vote dans le doc user
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { votedFor: featureRef.id }, { merge: true });
      setUserVote(featureRef.id);
      Alert.alert(
        "Proposition envoyée",
        "Votre idée a été soumise et votre vote a été automatiquement enregistré. Vous ne pouvez voter qu'une fois."
      );
    } catch (error) {
      console.error("Erreur lors de la proposition :", error);
      Alert.alert("Erreur", "Impossible d'envoyer votre proposition.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={styles.loadingText}>
          Chargement des fonctionnalités...
        </Text>
      </View>
    );
  }

  // Countdown en 4 blocs
  const renderCountdown = () => {
    const { days, hours, mins, secs } = countdown;
    return (
      <View style={styles.countdownRow}>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownNumber}>{days}</Text>
          <Text style={styles.countdownLabel}>Jours</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownNumber}>{hours}</Text>
          <Text style={styles.countdownLabel}>Heures</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownNumber}>{mins}</Text>
          <Text style={styles.countdownLabel}>Mins</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownNumber}>{secs}</Text>
          <Text style={styles.countdownLabel}>Secs</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden />
      <BackButton color="#000000" style={styles.backButton} />
      <TouchableOpacity
        style={styles.questionIcon}
        onPress={() => setShowExplanationModal(true)}
      >
        <Ionicons
          name="help-circle-outline"
          size={28}
          color={currentTheme.colors.primary}
        />
      </TouchableOpacity>
      {showExplanationModal && (
        <ModalExplicatif onClose={() => setShowExplanationModal(false)} />
      )}
      <View style={styles.mainContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>
            Votez pour la prochaine fonctionnalité
          </Text>
          <Text style={styles.description}>
            Nous apprécions vos retours ! Choisissez une fonctionnalité que nous
            prioriserons. La fonctionnalité la plus votée sera implémentée le
            mois prochain.
          </Text>
        </View>
        <View style={styles.featuresScrollContainer}>
          <FlatList
            data={features}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 0 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => openFeatureDetail(item)}
                activeOpacity={0.85}
              >
                <Animated.View entering={FadeInUp} style={styles.featureCard}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  {item.username && (
                    <Text style={styles.featureUsername}>
                      par {item.username}
                    </Text>
                  )}
                  <Text style={styles.featureVotes}>
                    {item.votes} vote{item.votes !== 1 ? "s" : ""}
                  </Text>
                  {item.description && (
                    <Text style={styles.featureDescription}>
                      {item.description.length > 60
                        ? item.description.substring(0, 60) + "..."
                        : item.description}
                    </Text>
                  )}
                </Animated.View>
              </TouchableOpacity>
            )}
          />
        </View>
        <View style={styles.bottomContainer}>
          {!userVote && (
            <TouchableOpacity
              style={styles.proposeButton}
              onPress={() => setShowProposeModal(true)}
            >
              <Text style={styles.proposeButtonText}>Proposer une idée</Text>
            </TouchableOpacity>
          )}
          {userVote && (
            <Text style={styles.thankYouText}>
              Merci pour votre vote !{" "}
              {features.find((f) => f.id === userVote)?.title &&
                `Vous avez voté pour : ${
                  features.find((f) => f.id === userVote)?.title
                }`}
            </Text>
          )}
          <Text style={styles.countdownTitle}>Temps restant :</Text>
          {renderCountdown()}
        </View>
      </View>
      {showFeatureDetailModal && selectedFeature && (
        <FeatureDetailModal
          visible={showFeatureDetailModal}
          feature={selectedFeature}
          userVoted={!!userVote}
          onVote={handleVote}
          onClose={() => {
            setShowFeatureDetailModal(false);
            setSelectedFeature(null);
          }}
        />
      )}
      {showProposeModal && (
        <ProposeFeatureModal
          visible={showProposeModal}
          onClose={() => setShowProposeModal(false)}
          onSubmit={handleProposeFeature}
        />
      )}
    </SafeAreaView>
  );
}

//
// STYLES
//
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: currentTheme.colors.background,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 20,
  },
  questionIcon: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 20,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8, // Réduit
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 10, // Très faible
    marginTop: 60,
  },
  header: {
    fontSize: 24,
    fontFamily: currentTheme.typography.title.fontFamily,
    textAlign: "center",
    marginTop: 30,
    marginBottom: 2,
    color: "#000000",
  },
  description: {
    fontSize: 14,
    fontFamily: currentTheme.typography.body.fontFamily,
    textAlign: "center",
    marginBottom: 0, // Collé
    color: currentTheme.colors.textSecondary,
    paddingHorizontal: 5,
  },
  featuresScrollContainer: {
    flex: 1,
    width: "100%",
    maxHeight: 320, // Ajuster selon l'écran
    marginTop: 2,
    marginBottom: 50,
  },
  featureCard: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: currentTheme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    marginBottom: 2,
    textAlign: "center",
    color: "#000000",
  },
  featureUsername: {
    fontSize: 11,
    fontFamily: currentTheme.typography.body.fontFamily,
    marginBottom: 2,
    textAlign: "center",
    color: currentTheme.colors.textSecondary,
  },
  featureVotes: {
    fontSize: 14,
    fontFamily: currentTheme.typography.title.fontFamily,
    marginBottom: 2,
    textAlign: "center",
    color: currentTheme.colors.primary,
  },
  featureDescription: {
    fontSize: 12,
    fontFamily: currentTheme.typography.body.fontFamily,
    textAlign: "center",
    color: currentTheme.colors.textSecondary,
    marginBottom: 0,
  },

  bottomContainer: {
    marginTop: 2,
    alignItems: "center",
  },
  proposeButton: {
    backgroundColor: currentTheme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginVertical: 2,
    marginBottom: 20,
  },
  proposeButtonText: {
    fontSize: 14,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.textPrimary,
  },
  thankYouText: {
    fontSize: 14,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  countdownTitle: {
    fontSize: 14,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  countdownRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  countdownBox: {
    width: 70,
    height: 70,
    backgroundColor: currentTheme.colors.primary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  countdownNumber: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333",
  },
  countdownLabel: {
    fontSize: 10,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#333",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
  },
});
