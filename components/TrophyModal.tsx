import React, { useEffect, useState, useCallback, useRef } from "react";
import {
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
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;

const normalizeSize = (size) => Math.round(size * (SCREEN_WIDTH / 375));

const achievementNames: Record<string, string> = {
  first_connection: "Première Connexion",
  profile_completed: "Profil Complet",
  finishChallenge_10: "Sérieux dans ses défis",
  finishChallenge_3: "Débutant Motivé",
  finishChallenge_1: "Premier défi complété",
  finishChallenge_25: "Machine à Challenges !",
  finishChallenge_50: "Imbattable !",
  finishChallenge_100: "...Légende Vivante...",
  selectChallengeDays_30: "Détermination",
  selectChallengeDays_180: "Le long terme, c'est mon truc...",
  selectChallengeDays_7: "Petit Joueur",
  selectChallengeDays_90: "Marathonien !",
  selectChallengeDays_365: "...Le Patient Légendaire...",
  streakProgress_3: "Mini Streak",
  streakProgress_7: "Routine en place",
  streakProgress_14: "Impressionant !",
  streakProgress_30: "Détermination en Béton !",
  streakProgress_60: "Rien ne peut m'arrêter",
  streakProgress_90: "Je suis une Machine !",
  streakProgress_180: "Discipline Ultime",
  streakProgress_365: "...Je suis un Monstre...",
  messageSent_1: "Premier message envoyé !",
  messageSent_10: "Esprit d'équipe",
  messageSent_50: "...Communauté Active...",
  shareChallenge_1: "J'aime partager",
  shareChallenge_5: "Influenceur en Herbe",
  shareChallenge_20: "...Meneur de Communauté...",
  voteFeature_1: "Premier défi Voté !",
  voteFeature_5: "...J'aime voter...",
  saveChallenge_1: "Défi sauvegardé",
  saveChallenge_5: "...Les Favoris...",
  challengeCreated_1: "Créateur de Défis",
  challengeCreated_5: "J'ai de l'Inspiration !",
  challengeCreated_10: "...Innovateur...",
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
  const { t } = useTranslation();

  const calculatedReward = Math.round(5 * (selectedDays / 7));

  useEffect(() => {
    console.log("🔍 TrophyModal - showTrophyModal:", showTrophyModal);
    console.log("🔍 TrophyModal - trophiesEarned:", trophiesEarned);
    console.log("🔍 TrophyModal - achievementEarned:", achievementEarned);
    if (showTrophyModal) {
      console.log("✅ TrophyModal s’affiche au centre");
      setReward(trophiesEarned || calculatedReward);
      setAdWatched(false);
      setMessage("");
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      console.log("🚫 TrophyModal masqué");
      scaleAnim.setValue(0);
    }
  }, [showTrophyModal, trophiesEarned, scaleAnim, calculatedReward]);

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
    setTimeout(() => {
      resetTrophyData();
    }, 1500);
  }, [reward, resetTrophyData]);

  if (!showTrophyModal) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Video
        ref={videoRef}
        source={require("../assets/videos/intro-video8.mp4")}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      <View style={styles.modalBackground}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <LinearGradient
            colors={["#FFD700", "#FFCA28"]}
            style={styles.trophyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="trophy" size={normalizeSize(60)} color="#FFF" />
          </LinearGradient>
          <Text style={styles.title}>{t("trophyModal.congrats") /* "Félicitations ! 🎉" */}</Text>
          <Text style={styles.rewardText}>{t("trophyModal.reward", { count: reward }) /* "+{reward} Trophées" */}</Text>
          {achievementEarned && (
            <Text style={styles.achievementText}>
              🏆 {t(`achievements.${achievementEarned}`)}
            </Text>
          )}
          {message !== "" && <Text style={styles.message}>{t("trophyModal.message", { message })}</Text>}
          <GradientButton onPress={handleClaimPress} text={t("trophyModal.claim")} />
          {!adWatched && (
            <GradientButton
              onPress={handleAdPress}
              text={t("trophyModal.doubleReward")}
              iconName="videocam-outline"
            />
          )}
        </Animated.View>
      </View>
    </View>
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
      colors={["#FF6200", "#FF8C00"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.buttonGradient}
    >
      <View style={styles.buttonContent}>
        {iconName && (
          <Ionicons
            name={iconName}
            size={normalizeSize(20)}
            color="#FFF"
            style={styles.buttonIcon}
          />
        )}
        <Text style={styles.buttonGradientText}>{text}</Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    backgroundColor: "#FFF3E0",
    borderRadius: normalizeSize(25),
    paddingVertical: normalizeSize(30),
    paddingHorizontal: normalizeSize(20),
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOpacity: 0.5,
    shadowRadius: normalizeSize(15),
    elevation: 15,
  },
  trophyGradient: {
    padding: normalizeSize(10),
    borderRadius: normalizeSize(50),
    marginBottom: normalizeSize(15),
  },
  title: {
    fontSize: normalizeSize(26),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FF6200",
    marginVertical: normalizeSize(10),
    textAlign: "center",
    fontWeight: "bold",
    textShadowColor: "#000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  rewardText: {
    fontSize: normalizeSize(22),
    color: "#FFD700",
    textAlign: "center",
    marginBottom: normalizeSize(5),
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
  },
  achievementText: {
    fontSize: normalizeSize(18),
    color: "#FF6200",
    textAlign: "center",
    marginBottom: normalizeSize(15),
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  message: {
    fontSize: normalizeSize(16),
    color: "#00FF88",
    textAlign: "center",
    marginTop: normalizeSize(5),
    marginBottom: normalizeSize(15),
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  gradientButton: {
    width: "85%",
    marginVertical: normalizeSize(8),
    shadowColor: "#FF6200",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.7,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: normalizeSize(12),
    borderRadius: normalizeSize(30),
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonGradientText: {
    color: "#FFF",
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.title.fontFamily,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: normalizeSize(8),
  },
});

export default TrophyModal;
