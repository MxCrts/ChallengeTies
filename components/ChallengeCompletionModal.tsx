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
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");

// Phrases motivantes
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
  const [motivationalPhrase, setMotivationalPhrase] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [userTrophies, setUserTrophies] = useState(0);
  const { completeChallenge } = useCurrentChallenges();
  const videoRef = useRef<Video>(null);

  const calculatedReward = Math.round(baseReward * (selectedDays / 7));

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
      const idx = Math.floor(Math.random() * motivationalPhrases.length);
      setMotivationalPhrase(motivationalPhrases[idx]);

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

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      pulseAnim.setValue(1);
    }
  }, [visible]);

  const handleComplete = async (doubleReward: boolean) => {
    try {
      await completeChallenge(challengeId, selectedDays, doubleReward);
    } catch (error) {
      console.error(t("completion.errorFinalizing"), error);
    }
    onClose();
  };

  const GradientButton = ({
    onPress,
    text,
    iconName,
  }: {
    onPress: () => void;
    text: string;
    iconName?: keyof typeof Ionicons.glyphMap;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.gradientButton}>
      <LinearGradient
        colors={["#FF9A2E", "#FEC163"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.buttonGradient}
      >
        <View style={styles.buttonContent}>
          {iconName && (
            <Ionicons name={iconName} size={20} color="#fff" style={styles.buttonIcon} />
          )}
          <Text style={styles.buttonGradientText}>{t(text)}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fullOverlay}>
        <Animated.View style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.trophyHeader}>
            <Text style={styles.trophyHeaderText}>
              {t("completion.trophies", { count: userTrophies })}
            </Text>
          </View>
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
          <Text style={styles.motivationalText}>{t(motivationalPhrase)}</Text>
          <Animated.View
            style={[styles.rewardContainer, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}
          >
            <Text style={styles.rewardText}>
              {t("completion.reward", { count: calculatedReward })}
            </Text>
          </Animated.View>
          <GradientButton onPress={() => handleComplete(false)} text="completion.continue" />
          <GradientButton
            onPress={() => handleComplete(true)}
            text="completion.doubleTrophies"
            iconName="videocam-outline"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.9,
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  trophyHeader: {
    marginBottom: 20,
    alignItems: "center",
  },
  trophyHeaderText: {
    fontSize: 24,
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
  video: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  motivationalText: {
    fontSize: 26,
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
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFD700",
  },
  gradientButton: {
    width: "80%",
    marginVertical: 8,
    shadowColor: "#FF9A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonGradientText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
});

