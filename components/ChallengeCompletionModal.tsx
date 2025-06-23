import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../constants/firebase-config";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { Video, ResizeMode } from "expo-av";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 16;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const motivationalPhrases = [
  "completion.youAreAwesome",
  "completion.keepItUp",
  "completion.successIsYours",
  "completion.everyEffortCounts",
  "completion.neverGiveUp",
  "completion.youAreOnTrack",
  "completion.excellenceAwaits",
  "completion.headHeldHigh",
  "completion.persistencePays",
  "completion.challengesMakeYouStronger",
];

const baseReward = 5;
const adUnitId = __DEV__
  ? TestIds.REWARDED
  : "ca-app-pub-4725616526467159/6366749139";
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  fullOverlay: {
    backgroundColor: isDarkMode ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.85)",
  },
  modalContainer: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderColor: currentTheme.colors.border,
  },
  modalGradient: {
    colors: [
      currentTheme.colors.cardBackground + "F0",
      currentTheme.colors.background + "E0",
    ] as const,
  },
  trophyHeaderText: {
    color: currentTheme.colors.secondary,
  },
  motivationalText: {
    color: isDarkMode
      ? currentTheme.colors.textPrimary
      : currentTheme.colors.textSecondary,
  },
  rewardText: {
    color: currentTheme.colors.secondary,
  },
  buttonGradient: {
    colors: [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ] as const,
  },
  buttonGradientText: {
    color: currentTheme.colors.textPrimary,
  },
  buttonIcon: {
    color: currentTheme.colors.textPrimary,
  },
  videoBorder: {
    borderColor: currentTheme.colors.primary,
  },
  glowGradient: {
    colors: [
      currentTheme.colors.primary + "80",
      currentTheme.colors.secondary + "40",
      "transparent",
    ] as const,
  },
});

interface ChallengeCompletionModalProps {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  onClose: () => void;
}

export default function ChallengeCompletionModal({
  visible,
  challengeId,
  selectedDays,
  onClose,
}: ChallengeCompletionModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);

  const [motivationalPhrase, setMotivationalPhrase] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.8)).current; // Zoom/dézoom boosté
  const videoFadeAnim = useRef(new Animated.Value(0)).current;
  const [userTrophies, setUserTrophies] = useState<number>(0);
  const { completeChallenge } = useCurrentChallenges();
  const videoRef = useRef<Video>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setAdLoaded(true);
        console.log("Vidéo récompensée chargée");
      }
    );
    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        console.log("✅ Récompense gagnée !");
      }
    );
    const unsubscribeError = rewarded.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error("Erreur vidéo récompensée:", error.message);
        setAdLoaded(false);
      }
    );
    rewarded.load();
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeError();
    };
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserTrophies(snap.data().trophies || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (visible) {
      const idx = Math.floor(Math.random() * motivationalPhrases.length);
      setMotivationalPhrase(motivationalPhrases[idx]);

      videoRef.current?.setPositionAsync(0);
      videoRef.current?.playAsync();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(videoFadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1.2, // Zoom plus marqué
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      rotateAnim.setValue(0);
      glowAnim.setValue(0.8);
      videoFadeAnim.setValue(0);
    }
  }, [visible]);

  const handleComplete = async (doubleReward: boolean) => {
    const calculatedReward = Math.round(baseReward * (selectedDays / 7));
    if (doubleReward) {
      if (adLoaded) {
        try {
          rewarded.show();
          await completeChallenge(challengeId, selectedDays, true);
          const finalReward = calculatedReward * 2;
          Alert.alert(
            t("completion.finalTitle"),
            t("completion.finalMessage", { count: finalReward })
          );
          setAdLoaded(false);
          rewarded.load();
        } catch (error) {
          console.error(t("completion.errorFinalizing"), error);
          Alert.alert(
            t("completion.finalTitle"),
            t("completion.errorFinalizingMessage")
          );
        }
      } else {
        console.log("⚠️ Vidéo non chargée, tentative de rechargement");
        rewarded.load();
        Alert.alert(
          t("completion.adNotReadyTitle"),
          t("completion.adNotReady")
        );
      }
    } else {
      try {
        await completeChallenge(challengeId, selectedDays, false);
        Alert.alert(
          t("completion.finalTitle"),
          t("completion.finalMessage", { count: calculatedReward })
        );
      } catch (error) {
        console.error(t("completion.errorFinalizing"), error);
        Alert.alert(
          t("completion.finalTitle"),
          t("completion.errorFinalizingMessage")
        );
      }
    }
    onClose();
  };

  const GradientButton: React.FC<{
    onPress: () => void;
    textKey: string;
    iconName?: keyof typeof Ionicons.glyphMap;
  }> = ({ onPress, textKey, iconName }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.gradientButton}
    >
      <LinearGradient
        colors={dynamicStyles.buttonGradient.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.buttonGradient}
      >
        <View style={styles.buttonContent}>
          {iconName && (
            <Ionicons
              name={iconName}
              size={normalizeSize(20)}
              color={dynamicStyles.buttonIcon.color}
              style={styles.buttonIcon}
            />
          )}
          <Text
            style={[
              styles.buttonGradientText,
              dynamicStyles.buttonGradientText,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {t(textKey)}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (!visible) return null;

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "0deg"],
  });

  const calculatedReward = Math.round(baseReward * (selectedDays / 7));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.fullOverlay, dynamicStyles.fullOverlay]}>
        <Animated.View
          style={[
            styles.modalContainer,
            dynamicStyles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }],
            },
          ]}
        >
          <LinearGradient
            colors={dynamicStyles.modalGradient.colors}
            style={styles.modalGradient}
          >
            <View style={styles.trophyHeader}>
              <Text
                style={[
                  styles.trophyHeaderText,
                  dynamicStyles.trophyHeaderText,
                ]}
              >
                {userTrophies} {t("completion.trophies")}
              </Text>
            </View>
            <Animated.View
              style={[styles.animationContainer, { opacity: videoFadeAnim }]}
            >
              <LinearGradient
                colors={dynamicStyles.glowGradient.colors}
                style={styles.glowEffect}
              >
                <View
                  style={[styles.videoContainer, dynamicStyles.videoBorder]}
                >
                  <Video
                    ref={videoRef}
                    source={require("../assets/videos/trophy-animation.mp4")}
                    style={styles.video}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted={false}
                  />
                </View>
              </LinearGradient>
            </Animated.View>
            <Text
              style={[styles.motivationalText, dynamicStyles.motivationalText]}
            >
              {t(motivationalPhrase)}
            </Text>
            <Animated.View
              style={[
                styles.rewardContainer,
                { transform: [{ scale: glowAnim }] },
              ]}
            >
              <LinearGradient
                colors={dynamicStyles.glowGradient.colors}
                style={styles.rewardGlow}
              >
                <Text
                  style={[styles.rewardText, dynamicStyles.rewardText]}
                  numberOfLines={2}
                >
                  {t("completion.reward", { count: calculatedReward })}
                </Text>
              </LinearGradient>
            </Animated.View>
            <GradientButton
              onPress={() => handleComplete(false)}
              textKey="completion.continue"
            />
            <GradientButton
              onPress={() => handleComplete(true)}
              textKey="completion.doubleTrophies"
              iconName="videocam-outline"
            />
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    borderRadius: normalizeSize(28),
    borderWidth: 2.5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(10) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(14),
    elevation: 14,
  },
  modalGradient: {
    paddingVertical: normalizeSize(24),
    paddingHorizontal: normalizeSize(20),
    alignItems: "center",
  },
  trophyHeader: {
    marginBottom: SPACING,
    alignItems: "center",
  },
  trophyHeaderText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  animationContainer: {
    width: normalizeSize(280),
    height: normalizeSize(280),
    marginBottom: SPACING,
    justifyContent: "center",
    alignItems: "center",
  },
  glowEffect: {
    width: normalizeSize(300),
    height: normalizeSize(300),
    borderRadius: normalizeSize(150),
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: normalizeSize(260),
    height: normalizeSize(260),
    borderRadius: normalizeSize(130),
    borderWidth: 3,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(10),
    elevation: 10,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  motivationalText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING,
    paddingHorizontal: normalizeSize(16),
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rewardContainer: {
    alignItems: "center",
    marginBottom: SPACING * 1.5,
  },
  rewardGlow: {
    padding: normalizeSize(20), // Plus d'espace pour texte gros
    paddingHorizontal: normalizeSize(28),
    borderRadius: normalizeSize(22),
    maxWidth: normalizeSize(320), // Élargi
  },
  rewardText: {
    fontSize: normalizeSize(20), // Plus gros
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: "center",
  },
  gradientButton: {
    width: "82%",
    marginVertical: normalizeSize(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: normalizeSize(14),
    paddingHorizontal: normalizeSize(24),
    borderRadius: normalizeSize(24),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "90%",
  },
  buttonGradientText: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  buttonIcon: {
    marginRight: normalizeSize(6),
  },
});
