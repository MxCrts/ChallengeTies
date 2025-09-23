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
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import { adUnitIds } from "@/constants/admob";
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
    colors: [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ] as const,
  },
  buttonGradientText: {
    color: "#FFFFFF",
  },
  buttonIcon: {
    color: isDarkMode ? "#FFD700" : "#FFFFFF",
  },
  videoBorder: {
    borderColor: currentTheme.colors.primary,
  },
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);
const npa = (globalThis as any).__NPA__ === true;

  // --- Toast state
  const [toastText, setToastText] = useState<string>("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(30)).current;
const rewardedAdUnitId = __DEV__ ? TestIds.REWARDED : adUnitIds.rewarded;
const rewardedRef = useRef<RewardedAd | null>(null);
const [adLoaded, setAdLoaded] = useState(false);
const [isShowingAd, setIsShowingAd] = useState(false);
const earnedRef = useRef(false);
const createdRef = useRef(false);
  // --- Busy guard
  const [busy, setBusy] = useState(false);

  // --- Navigation
  const router = useRouter();
  const didNavigateRef = useRef(false);

  // --- Animations
  const [motivationalPhrase, setMotivationalPhrase] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.8)).current;
  const videoFadeAnim = useRef(new Animated.Value(0)).current;

  // --- Data
  const [userTrophies, setUserTrophies] = useState<number>(0);
  const { completeChallenge } = useCurrentChallenges();
  const videoRef = useRef<Video>(null);

  // ---- Helper toast (réutilisable)
  const showToast = (msg: string, duration = 1200) => {
    setToastText(msg);
    setToastVisible(true);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(toastTranslate, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(toastTranslate, { toValue: 30, duration: 200, useNativeDriver: true }),
        ]).start(() => setToastVisible(false));
      }, duration);
    });
  };

  // --- Ads listeners (create once)
useEffect(() => {
  if (!canShowRewarded) { setAdLoaded(false); return; }
  if (createdRef.current) return;       // only once per mount
  createdRef.current = true;

  const ad = RewardedAd.createForAdRequest(rewardedAdUnitId, {
    requestNonPersonalizedAdsOnly: npa,
  });
  rewardedRef.current = ad;

  const unsubLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => setAdLoaded(true)
    );

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earnedRef.current = true;
      }
    );

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error("Erreur vidéo récompensée:", error?.message ?? error);
      setAdLoaded(false);
      setIsShowingAd(false);
      setBusy(false);
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, async () => {
      const userEarned = earnedRef.current;
      earnedRef.current = false;
      setIsShowingAd(false);
      setAdLoaded(false);

      try {
        if (userEarned) {
          await completeChallenge(challengeId, selectedDays, true);
          const finalReward = Math.round(baseReward * (selectedDays / 7)) * 2;
          await showSuccessAndNavigate(finalReward);
        } else {
          showToast(t("completion.adNotReady"));
          onClose?.();
        }
      } catch (e) {
        console.error(t("completion.errorFinalizing"), e);
        showToast(t("completion.errorFinalizingMessage"), 1400);
        onClose?.();
      } finally {
        try { rewardedRef.current?.load(); } catch {}
        setBusy(false);
      }
    });

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubError();
      unsubClosed();
      rewardedRef.current = null;
    createdRef.current = false;
    };
 }, [canShowRewarded]);

  // ---- User trophies listener
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

  // ---- Open/close animations
  useEffect(() => {
    if (visible) {
      setAdLoaded(false);
    try { rewardedRef.current?.load(); } catch {}
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
      ).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      rotateAnim.setValue(0);
      glowAnim.setValue(0.8);
      videoFadeAnim.setValue(0);
      setIsShowingAd(false);
    setBusy(false);
    }
  }, [visible]);

  // +++ Toast success + nav smooth
  const showSuccessAndNavigate = async (count: number) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    showToast(t("completion.finalMessage", { count }), 1000);

    // Attends que le toast reste visible un court instant, puis ferme et remplace l’écran
    setTimeout(() => {
      if (!didNavigateRef.current) {
        didNavigateRef.current = true;

        onClose?.(); // ferme la modale

        // nav smooth (remplace au lieu d’empiler)
        router.replace(`/challenge-details/${challengeId}`);

        setTimeout(() => {
          didNavigateRef.current = false;
          setBusy(false);
        }, 800);
      }
    }, 1000);
  };

  const handleComplete = async (doubleReward: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);

    const calculatedReward = Math.round(baseReward * (selectedDays / 7));

    if (doubleReward) {
      if (!canShowRewarded) {
        showToast(t("completion.adNotReady"));
        setBusy(false);
        return;
      }
      if (!adLoaded || !rewardedRef.current) {
        // Try to load and tell the user we’re prepping the ad
        try { rewardedRef.current?.load(); } catch {}
        showToast(t("completion.adNotReady"));
        setBusy(false);
        return;
      }

      try {
        setIsShowingAd(true);
        earnedRef.current = false;
         rewardedRef.current.show();
      } catch (error) {
        console.error(t("completion.errorFinalizing"), error);
        setIsShowingAd(false);
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

  // === Anim helpers
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "0deg"],
  });

  const calculatedReward = Math.round(baseReward * (selectedDays / 7));

  // ====== RENDER ======
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
              pointerEvents="box-none"
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

            <Text style={[styles.motivationalText, dynamicStyles.motivationalText]}>
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
            >
              <LinearGradient
                colors={dynamicStyles.buttonGradient.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <View style={styles.buttonContent}>
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
  disabled={!canShowRewarded || busy || !adLoaded || isShowingAd}
              style={[
                styles.gradientButton,
                (!canShowRewarded || busy || !adLoaded || isShowingAd) && { opacity: 0.5 },
              ]}
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
                    {isShowingAd
          ? t("pleaseWait", { defaultValue: "Patiente..." })
          : adLoaded
            ? t("completion.doubleTrophies")
            : t("completion.loadingAd", { defaultValue: "Préparation de la vidéo..." })}
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
  buttonIcon: {
    marginRight: normalizeSize(6),
  },
});
