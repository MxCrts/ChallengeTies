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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;

const normalizeSize = (size: number) =>
  Math.round(size * (SCREEN_WIDTH / 375));

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
    if (showTrophyModal) {
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
      scaleAnim.setValue(0);
    }
  }, [showTrophyModal, trophiesEarned, scaleAnim, calculatedReward]);

  const handleAdPress = useCallback(() => {
       console.log("✅ Pub regardée !");
       setAdWatched(true);
       activateDoubleReward();
       const doubled = trophiesEarned * 2;
       setReward(doubled);
       // utilise la clé de traduction trophyModal.doubleMessage
       setMessage(t("trophyModal.doubleMessage", { count: doubled }));
     }, [activateDoubleReward, trophiesEarned, t])

     const handleClaimPress = useCallback(() => {
         console.log(`✅ Réclamation : ${reward} trophées`);
         // utilise la clé de traduction trophyModal.claimMessage
         setMessage(t("trophyModal.claimMessage", { count: reward }));
         setTimeout(() => {
           resetTrophyData();
         }, 1500);
       }, [reward, resetTrophyData, t]);

  if (!showTrophyModal) return null;

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

          <Text style={styles.title}>{t("trophyModal.congrats")}</Text>
          <Text style={styles.rewardText}>
            {t("trophyModal.reward", { count: reward })}
          </Text>

          {achievementEarned && (
            <Text style={styles.achievementText}>
              🏆 {t(`achievements.${achievementEarned}`)}
            </Text>
          )}

          {!!message && (
            <Text style={styles.message}>{message}</Text>
          )}

          <GradientButton
            onPress={handleClaimPress}
            text={t("trophyModal.claim")}
          />

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
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.gradientButton}>
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
