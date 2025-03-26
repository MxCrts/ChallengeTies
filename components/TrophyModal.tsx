import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { useTrophy } from "../context/TrophyContext";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import designSystem from "../theme/designSystem";

const { width } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;

// Mapping des identifiants de succès vers un libellé utilisateur
const achievementNames: Record<string, string> = {
  first_connection: "Première Connexion",
  profile_completed: "Profil Complet",
  finishChallenge_10: "Sérieux dans ses défis",
  finishChallenge_3: "Débutant motivé",
  finishChallenge_1: "Premier défi complété",
};

const TrophyModal: React.FC<{ challengeId: string; selectedDays: number }> = ({
  challengeId,
  selectedDays,
}) => {
  const {
    showTrophyModal,
    trophiesEarned,
    achievementEarned,
    activateDoubleReward,
    resetTrophyData,
  } = useTrophy();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const [reward, setReward] = useState(trophiesEarned);
  const [adWatched, setAdWatched] = useState(false);
  const [message, setMessage] = useState("");
  const videoRef = useRef<Video>(null);

  // Calcul proportionnel : pour 7 jours = 5 trophées
  const calculatedReward = Math.round(5 * (selectedDays / 7));

  useEffect(() => {
    if (showTrophyModal) {
      setReward(trophiesEarned);
      setAdWatched(false);
      setMessage("");
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [showTrophyModal, trophiesEarned, scaleAnim]);

  const handleAdPress = useCallback(() => {
    console.log("✅ Pub regardée !");
    setAdWatched(true);
    activateDoubleReward();
    setReward((prev) => prev * 2);
    setMessage(`🔥 Tu as gagné ${trophiesEarned * 2} Trophées !`);
  }, [activateDoubleReward, trophiesEarned]);

  const handleClaimPress = useCallback(() => {
    console.log(`✅ Réclamation : ${reward} Trophées`);
    setMessage(`🎉 Tu as gagné ${reward} Trophées !`);
    // Délai pour que le message soit visible avant fermeture
    setTimeout(() => {
      resetTrophyData();
    }, 1500);
  }, [reward, resetTrophyData]);

  if (!showTrophyModal) return null;

  // Utilise le nom lisible pour le succès
  const displayAchievement = achievementEarned
    ? achievementNames[achievementEarned] || achievementEarned
    : null;

  return (
    <Modal
      visible={showTrophyModal}
      transparent
      animationType="fade"
      onRequestClose={resetTrophyData}
      statusBarTranslucent
    >
      <View style={styles.fullOverlay}>
        {/* Vidéo de fond couvrant toute la surface */}
        <Video
          ref={videoRef}
          source={require("../assets/videos/intro-video8.mp4")}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <Ionicons name="trophy" size={50} color="#FFD700" />
          <Text style={styles.title}>Félicitations ! 🎉</Text>
          <Text style={styles.rewardText}>+{reward} Trophées</Text>
          {displayAchievement && (
            <Text style={styles.achievementText}>🏆 {displayAchievement}</Text>
          )}
          {message !== "" && <Text style={styles.message}>{message}</Text>}
          <GradientButton onPress={handleClaimPress} text="Réclamer" />
          {!adWatched && (
            <GradientButton
              onPress={handleAdPress}
              text="Doublez vos trophées"
              iconName="videocam-outline"
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

interface GradientButtonProps {
  onPress: () => void;
  text: string;
  iconName?: keyof typeof Ionicons.glyphMap;
}

const GradientButton: React.FC<GradientButtonProps> = ({
  onPress,
  text,
  iconName,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={styles.gradientButton}
  >
    <LinearGradient
      colors={["#FF9A2E", "#FEC163"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.buttonGradient}
    >
      <View style={styles.buttonContent}>
        {iconName && (
          <Ionicons
            name={iconName}
            size={20}
            color="#fff"
            style={styles.buttonIcon}
          />
        )}
        <Text style={styles.buttonGradientText}>{text}</Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.9,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FEC163",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FF8C00",
    marginVertical: 10,
    textAlign: "center",
  },
  rewardText: {
    fontSize: 20,
    color: "#FF8C00",
    textAlign: "center",
    marginBottom: 5,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  achievementText: {
    fontSize: 18,
    color: "#FF8C00",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  message: {
    fontSize: 16,
    color: "#00FF88",
    textAlign: "center",
    marginTop: 5,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  gradientButton: {
    width: "80%",
    marginVertical: 8,
    shadowColor: "#FF9A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  buttonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEC163",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonGradientText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: currentTheme.typography.title.fontFamily,
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default TrophyModal;
