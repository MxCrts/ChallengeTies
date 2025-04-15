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
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext"; // Ajout de useTheme
import { Theme } from "../theme/designSystem"; // Import de Theme
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import ModalExplicatif from "../components/ModalExplicatif";
import FeatureDetailModal from "../components/FeatureDetailModal";
import ProposeFeatureModal from "../components/ProposeFeatureModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

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
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownValues>({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });
  const [user, setUser] = useState<any>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showFeatureDetailModal, setShowFeatureDetailModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const { theme } = useTheme(); // Ajout de useTheme
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const snapshot = await getDoc(userDocRef);
        setUser(
          snapshot.exists()
            ? { ...snapshot.data(), uid: firebaseUser.uid }
            : firebaseUser
        );
        setUserVote(
          snapshot.exists() ? snapshot.data().votedFor || null : null
        );
      }
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    const checkModalShown = async () => {
      const value = await AsyncStorage.getItem("explanationModalShown");
      if (!value) {
        setShowExplanationModal(true);
        await AsyncStorage.setItem("explanationModalShown", "true");
      }
    };
    checkModalShown();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const featuresRef = collection(db, "polls", "new-features", "features");
    const unsubscribe = onSnapshot(featuresRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Feature[];
      setFeatures(
        data
          .filter((feature) => feature.approved)
          .sort((a, b) => b.votes - a.votes)
      );
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    const targetDate = new Date("2025-04-30T23:59:59Z");
    const updateTimer = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0)
        return setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (featureId: string) => {
    if (!user?.uid)
      return Alert.alert(
        "Connexion requise",
        "Veuillez vous connecter pour voter."
      );
    if (userVote)
      return Alert.alert("Vote déjà effectué", "Vous avez déjà voté.");
    try {
      await updateDoc(doc(db, "polls", "new-features", "features", featureId), {
        votes: increment(1),
      });
      await updateDoc(doc(db, "users", user.uid), { votedFor: featureId });
      setUserVote(featureId);
      Alert.alert("Vote enregistré", "Merci pour votre vote !");
    } catch (error) {
      console.error("Erreur lors du vote :", error);
      Alert.alert("Erreur", "Une erreur est survenue.");
    }
  };

  const handleProposeFeature = async (title: string, description?: string) => {
    if (!user?.uid)
      return Alert.alert("Connexion requise", "Veuillez vous connecter.");
    try {
      const featureRef = await addDoc(
        collection(db, "polls", "new-features", "features"),
        {
          title,
          description: description || "",
          votes: 1,
          approved: false,
          username: user?.username || "Inconnu",
        }
      );
      await setDoc(
        doc(db, "users", user.uid),
        { votedFor: featureRef.id },
        { merge: true }
      );
      setUserVote(featureRef.id);
      Alert.alert(
        "Proposition envoyée",
        "Votre idée est soumise avec votre vote !"
      );
    } catch (error) {
      console.error("Erreur lors de la proposition :", error);
      Alert.alert("Erreur", "Impossible d'envoyer.");
    }
  };

  const renderCountdown = () => (
    <LinearGradient
      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]} // Dynamique
      style={styles.countdownContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {["days", "hours", "mins", "secs"].map((unit, idx) => (
        <Animated.View
          key={idx}
          entering={FadeInUp.delay(idx * 100)}
          style={styles.countdownBox}
        >
          <Text
            style={[
              styles.countdownNumber,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {countdown[unit]}
          </Text>
          <Text
            style={[
              styles.countdownLabel,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {unit.charAt(0).toUpperCase() + unit.slice(1)}
          </Text>
        </Animated.View>
      ))}
    </LinearGradient>
  );

  const renderFeatureItem = ({ item, index }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={styles.featureCard}
    >
      <TouchableOpacity
        onPress={() => {
          setSelectedFeature(item);
          setShowFeatureDetailModal(true);
        }}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            `${currentTheme.colors.cardBackground}F0`,
          ]} // Dynamique
          style={styles.featureGradient}
        >
          <Text
            style={[
              styles.featureTitle,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {item.title}
          </Text>
          {item.username && (
            <Text
              style={[
                styles.featureUsername,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              par {item.username}
            </Text>
          )}
          <Text
            style={[
              styles.featureVotes,
              { color: currentTheme.colors.primary },
            ]}
          >
            {item.votes} vote{item.votes !== 1 ? "s" : ""}
          </Text>
          {item.description && (
            <Text
              style={[
                styles.featureDescription,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {item.description.length > 50
                ? `${item.description.substring(0, 50)}...`
                : item.description}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]} // Dynamique
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            Chargement en cours...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          `${currentTheme.colors.cardBackground}F0`,
        ]} // Dynamique
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title="Nouveautés" />
        </View>
        <TouchableOpacity
          style={styles.helpIcon}
          onPress={() => setShowExplanationModal(true)}
        >
          <Ionicons
            name="help-circle-outline"
            size={normalizeSize(30)}
            color={currentTheme.colors.secondary} // Dynamique
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.description,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          Votez pour la prochaine fonctionnalité à implémenter ou proposez la
          vôtre ! Fin le 30 avril 2025.
        </Text>
        <View
          style={[
            styles.featuresWindow,
            { backgroundColor: `${currentTheme.colors.cardBackground}80` },
          ]}
        >
          <FlatList
            data={features}
            renderItem={renderFeatureItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.featuresContent}
            showsVerticalScrollIndicator={true}
          />
        </View>
        <View style={styles.bottomContainer}>
          {renderCountdown()}
          {userVote ? (
            <Text
              style={[
                styles.thankYouText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Merci pour votre vote :{" "}
              {features.find((f) => f.id === userVote)?.title || "???"}
            </Text>
          ) : (
            <TouchableOpacity
              style={[
                styles.proposeButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => setShowProposeModal(true)}
            >
              <Text
                style={[
                  styles.proposeButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                Proposer une idée
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {showExplanationModal && (
          <ModalExplicatif onClose={() => setShowExplanationModal(false)} />
        )}
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: normalizeSize(15) },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  helpIcon: {
    position: "absolute",
    top: normalizeSize(20),
    right: normalizeSize(20),
    zIndex: 10,
  },
  description: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular", // Direct
    textAlign: "center",
    marginVertical: normalizeSize(15),
    paddingHorizontal: normalizeSize(10),
  },
  featuresWindow: {
    flex: 0.85,
    marginVertical: normalizeSize(10),
    borderRadius: normalizeSize(15),
    overflow: "hidden",
  },
  featuresContent: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(5),
  },
  featureCard: {
    marginVertical: normalizeSize(8),
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  featureGradient: {
    padding: normalizeSize(15),
    borderRadius: normalizeSize(20),
  },
  featureTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold", // Direct
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureUsername: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular", // Direct
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureVotes: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold", // Direct
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureDescription: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular", // Direct
    textAlign: "center",
  },
  bottomContainer: {
    alignItems: "center",
    paddingVertical: normalizeSize(20),
    paddingHorizontal: normalizeSize(15),
  },
  countdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: SCREEN_WIDTH * 0.9,
    padding: normalizeSize(10),
    borderRadius: normalizeSize(15),
    marginBottom: normalizeSize(15),
  },
  countdownBox: { alignItems: "center", width: "22%" },
  countdownNumber: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold", // Direct
  },
  countdownLabel: {
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_400Regular", // Direct
  },
  proposeButton: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(25),
    borderRadius: normalizeSize(25),
  },
  proposeButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold", // Direct
  },
  thankYouText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular", // Direct
    textAlign: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular", // Direct
  },
});
