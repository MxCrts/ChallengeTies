import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../constants/firebase-config";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { Video, ResizeMode } from "expo-av";

const { width } = Dimensions.get("window");

const motivationalPhrases = [
  "Tu es incroyable !",
  "Continue comme ça !",
  "Le succès est à toi !",
  "Chaque effort compte !",
  "N'abandonne jamais !",
  "Tu es sur la bonne voie !",
  "L'excellence te sourit !",
  "Garde la tête haute !",
  "Ta persévérance paie !",
  "Les défis te rendent plus fort !",
];

const baseReward = 5;

interface ChallengeCompletionModalProps {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  onClose: () => void;
}

const ChallengeCompletionModal: React.FC<ChallengeCompletionModalProps> = ({
  visible,
  challengeId,
  selectedDays,
  onClose,
}) => {
  const [motivationalPhrase, setMotivationalPhrase] = useState("");
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [userTrophies, setUserTrophies] = useState(0);
  const { completeChallenge } = useCurrentChallenges();
  const videoRef = useRef<Video>(null);

  // Calcul proportionnel de la récompense (par exemple, pour 7 jours = baseReward)
  const calculatedReward = Math.round(baseReward * (selectedDays / 7));

  // Récupération des trophées en temps réel
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserTrophies(data.trophies || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (visible) {
      const randomIndex = Math.floor(
        Math.random() * motivationalPhrases.length
      );
      setMotivationalPhrase(motivationalPhrases[randomIndex]);

      // Redémarrer la vidéo si nécessaire
      videoRef.current?.setPositionAsync(0);
      videoRef.current?.playAsync();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  const handleComplete = async (doubleReward: boolean) => {
    try {
      await completeChallenge(challengeId, selectedDays, doubleReward);
    } catch (error) {
      console.error("Erreur lors de la finalisation du défi :", error);
    }
    onClose();
  };

  // Composant bouton avec dégradé
  const GradientButton = ({
    onPress,
    text,
  }: {
    onPress: () => void;
    text: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.gradientButton}
    >
      <LinearGradient
        colors={["#4c669f", "#3b5998", "#192f6a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.buttonGradient}
      >
        <Text style={styles.buttonGradientText}>{text}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Trophées actuels centrés */}
          <View style={styles.trophyHeader}>
            <Text style={styles.trophyHeaderText}>{userTrophies} Trophées</Text>
          </View>

          {/* Animation avec vidéo */}
          <View style={styles.animationContainer}>
            <Video
              ref={videoRef}
              source={require("../assets/videos/trophy-animation.mp4")}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted={false}
            />
          </View>

          {/* Phrase motivante en blanc */}
          <Text style={styles.motivationalText}>{motivationalPhrase}</Text>

          {/* Récompense affichée */}
          <Animated.View
            style={[styles.rewardContainer, { opacity: fadeAnim }]}
          >
            <Text style={styles.rewardText}>{calculatedReward} Trophées</Text>
          </Animated.View>

          {/* Boutons d'action */}
          <View style={styles.buttonContainer}>
            <GradientButton
              onPress={() => handleComplete(false)}
              text="Continuer"
            />
            <GradientButton
              onPress={() => handleComplete(true)}
              text="Regarder une pub"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.9,
    backgroundColor: "rgba(0,0,0,0)",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  trophyHeader: {
    marginBottom: 20,
    alignItems: "center",
  },
  trophyHeaderText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFD700",
  },
  animationContainer: {
    width: 220,
    height: 220,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  motivationalText: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#FFF",
  },
  rewardContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  rewardText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#FFD700",
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  gradientButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  buttonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  buttonGradientText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  video: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
});

export default ChallengeCompletionModal;
