import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  AccessibilityInfo,
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
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
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
      (currentTheme.colors.cardBackground as string) + "F0",
      (currentTheme.colors.background as string) + "E0",
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
    colors: [currentTheme.colors.primary, currentTheme.colors.secondary] as const,
  },
  buttonGradientText: { color: "#FFFFFF" },
  buttonIcon: { color: isDarkMode ? "#FFD700" : "#FFFFFF" },
  videoBorder: { borderColor: currentTheme.colors.primary },
  glowGradient: {
    colors: [
      (currentTheme.colors.primary as string) + "80",
      (currentTheme.colors.secondary as string) + "40",
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
  const { showRewarded } = useAdsVisibility() as any;
  const canShowRewarded = !!showRewarded;

  const safeReward = useMemo(() => {
    const r = Math.round((baseReward * Math.max(1, selectedDays)) / 7);
    return Math.max(1, r);
  }, [selectedDays]);

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);

  // Accessibilité / animations
  const [reduceMotion, setReduceMotion] = useState(false);

  // Toast state
  const [toastText, setToastText] = useState<string>("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(30)).current;

  // Busy guard
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Navigation
  const router = useRouter();
  const didNavigateRef = useRef(false);

  // Vidéo / fallback image
  const videoRef = useRef<Video>(null);
  const [videoOk, setVideoOk] = useState(true);

  // Loop handle pour stopper proprement
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(
    () => () => {
      loopRef.current?.stop?.();
    },
    []
  );

  // Animations
  const [motivationalPhrase, setMotivationalPhrase] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.8)).current;
  const videoFadeAnim = useRef(new Animated.Value(0)).current;

  // Data
  const [userTrophies, setUserTrophies] = useState<number>(0);
  const { completeChallenge, requestRewardedAd, preloadRewarded } =
    useCurrentChallenges();

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Accessibilité : réduire animations
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(!!enabled);
      }
    );
    return () => {
      mounted = false;
      // @ts-ignore RN <=0.72 compat
      sub?.remove?.();
    };
  }, []);

  // Précharge la rewarded à chaque ouverture
  useEffect(() => {
    if (visible) {
      try {
        preloadRewarded();
      } catch {}
      // reset vidéo & animations
      setVideoOk(true);
      loopRef.current?.stop?.();
    }
  }, [visible, preloadRewarded]);

  // User trophies listener
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setUserTrophies(snap.data().trophies || 0);
    });
    return () => unsubscribe();
  }, []);

  // Toast helper
  const showToast = (msg: string, duration = 1200) => {
    setToastText(msg);
    setToastVisible(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslate, {
            toValue: 30,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setToastVisible(false));
      }, duration);
    });
  };

  // Open/close animations
  useEffect(() => {
    if (visible) {
      const phrase =
        motivationalPhrases[
          Math.floor(Math.random() * motivationalPhrases.length)
        ];
      setMotivationalPhrase(phrase);

      if (!reduceMotion) {
        // relance la vidéo
        (async () => {
          try {
            await videoRef.current?.setStatusAsync({
              positionMillis: 0,
              shouldPlay: true,
            });
          } catch {
            setVideoOk(false);
          }
        })();

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

        // loop pulsation
        loopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1.2,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.8,
              duration: 700,
              useNativeDriver: true,
            }),
          ])
        );
        loopRef.current.start();
      } else {
        // Mode reduceMotion : on montre direct l'état final, sans animations
        fadeAnim.setValue(1);
        scaleAnim.setValue(1);
        rotateAnim.setValue(1);
        videoFadeAnim.setValue(1);
        glowAnim.setValue(1);
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      rotateAnim.setValue(0);
      glowAnim.setValue(0.8);
      videoFadeAnim.setValue(0);
      loopRef.current?.stop?.();
      (async () => {
        try {
          await videoRef.current?.stopAsync();
          await videoRef.current?.setStatusAsync({ shouldPlay: false });
        } catch {}
      })();
      setBusy(false);
    }
  }, [visible, fadeAnim, scaleAnim, rotateAnim, glowAnim, videoFadeAnim, reduceMotion]);

  // Success + navigation smooth
  const showSuccessAndNavigate = async (count: number) => {
    try {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch {}

    showToast(t("completion.finalMessage", { count }), 1000);

    setTimeout(() => {
      if (!didNavigateRef.current) {
        didNavigateRef.current = true;
        onClose?.();
        router.replace(`/challenge-details/${challengeId}`);
        setTimeout(() => {
          didNavigateRef.current = false;
          setBusy(false);
        }, 800);
      }
    }, 1000);
  };

  const handleComplete = async (doubleReward: boolean): Promise<void> => {
    if (busyRef.current) return;
    setBusy(true);

    const calculatedReward = safeReward;

    if (doubleReward) {
      if (!canShowRewarded) {
        showToast(t("completion.adNotReady"));
        setBusy(false);
        return;
      }

      try {
        const ok = await requestRewardedAd();
        if (ok) {
          await completeChallenge(challengeId, selectedDays, true);
          await showSuccessAndNavigate(calculatedReward * 2);
        } else {
          showToast(t("completion.adNotReady"));
          setBusy(false);
        }
      } catch (error) {
        console.error(t("completion.errorFinalizing"), error);
        showToast(t("completion.errorFinalizingMessage"), 1400);
        setBusy(false);
      }
      return;
    }

    // Flux sans pub
    try {
      await completeChallenge(challengeId, selectedDays, false);
      await showSuccessAndNavigate(calculatedReward);
    } catch (error) {
      console.error(t("completion.errorFinalizing"), error);
      showToast(t("completion.errorFinalizingMessage"), 1400);
      setBusy(false);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "0deg"],
  });

  const calculatedReward = safeReward;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={() => {
        loopRef.current?.stop?.();
      }}
      statusBarTranslucent
    >
      <View
        style={[styles.fullOverlay, dynamicStyles.fullOverlay]}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        <Animated.View
          style={[
            styles.modalContainer,
            dynamicStyles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }],
            },
          ]}
          accessible
          accessibilityLabel={t("completion.modalTitle") || "Challenge complété"}
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
              pointerEvents="box-none"
            >
              <LinearGradient
                colors={dynamicStyles.glowGradient.colors}
                style={styles.glowEffect}
              >
                <View
                  style={[styles.videoContainer, dynamicStyles.videoBorder]}
                  accessibilityLabel={t("completion.animationLabel") || ""}
                  accessible={false}
                >
                  {videoOk ? (
                    <Video
                      ref={videoRef}
                      source={require("../assets/videos/trophy-animation.mp4")}
                      style={styles.video}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={!reduceMotion}
                      isLooping={!reduceMotion}
                      isMuted={false}
                      onError={() => setVideoOk(false)}
                    />
                  ) : (
                    <View
                      style={[
                        styles.video,
                        { alignItems: "center", justifyContent: "center" },
                      ]}
                    >
                      <Ionicons
                        name="trophy"
                        size={normalizeSize(72)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={{
                          marginTop: 8,
                          color: currentTheme.colors.textSecondary,
                          fontFamily: "Comfortaa_700Bold",
                          fontSize: normalizeSize(13),
                        }}
                      >
                        {t("completion.wellDone")}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>

            <Text
              style={[
                styles.motivationalText,
                dynamicStyles.motivationalText,
              ]}
            >
              {t(motivationalPhrase)}
            </Text>

            <Animated.View
              style={[
                styles.rewardContainer,
                { transform: [{ scale: glowAnim }] },
              ]}
              pointerEvents="none"
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

            {/* Continuer (sans pub) */}
            <TouchableOpacity
              onPress={() => handleComplete(false)}
              activeOpacity={0.7}
              disabled={busy}
              style={[styles.gradientButton, busy && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={t("completion.continue")}
              testID="complete-without-ad"
            >
              <LinearGradient
                colors={dynamicStyles.buttonGradient.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <View style={styles.buttonContent}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={normalizeSize(20)}
                    color={dynamicStyles.buttonIcon.color}
                    style={styles.buttonIcon}
                  />
                  <Text
                    style={[
                      styles.buttonGradientText,
                      dynamicStyles.buttonGradientText,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t("completion.continue")}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Doubler (rewarded) */}
            <TouchableOpacity
              onPress={() => handleComplete(true)}
              activeOpacity={0.7}
              disabled={!canShowRewarded || busy}
              style={[
                styles.gradientButton,
                (!canShowRewarded || busy) && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("completion.doubleTrophies")}
              accessibilityHint={
                t("completion.watchAdHint", {
                  defaultValue: "Watch an ad to double your reward.",
                }) || undefined
              }
              testID="complete-with-ad"
            >
              <LinearGradient
                colors={dynamicStyles.buttonGradient.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <View style={styles.buttonContent}>
                  <Ionicons
                    name="videocam-outline"
                    size={normalizeSize(20)}
                    color={dynamicStyles.buttonIcon.color}
                    style={styles.buttonIcon}
                  />
                  <Text
                    style={[
                      styles.buttonGradientText,
                      dynamicStyles.buttonGradientText,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t("completion.doubleTrophies")}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {toastVisible && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: normalizeSize(40),
              left: normalizeSize(20),
              right: normalizeSize(20),
              borderRadius: normalizeSize(14),
              paddingVertical: normalizeSize(12),
              paddingHorizontal: normalizeSize(16),
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDarkMode
                ? "rgba(0,0,0,0.85)"
                : "rgba(0,0,0,0.8)",
              transform: [{ translateY: toastTranslate }],
              opacity: toastOpacity,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "Comfortaa_700Bold",
                fontSize: normalizeSize(14),
                textAlign: "center",
              }}
              numberOfLines={2}
            >
              {toastText}
            </Text>
          </Animated.View>
        )}
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
  video: { width: "100%", height: "100%" },
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
    padding: normalizeSize(20),
    paddingHorizontal: normalizeSize(28),
    borderRadius: normalizeSize(22),
    maxWidth: normalizeSize(320),
  },
  rewardText: {
    fontSize: normalizeSize(20),
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
  buttonIcon: { marginRight: normalizeSize(6) },
});
