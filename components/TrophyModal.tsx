import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useTrophy } from "../context/TrophyContext";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import { adUnitIds } from "@/constants/admob";

const normalizeSize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scale);
};
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = normalizeSize(15);


interface TrophyModalProps {
  challengeId: string;
  selectedDays: number;
}

const TrophyModal: React.FC<TrophyModalProps> = ({
  challengeId,
  selectedDays,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const [videoFailed, setVideoFailed] = useState(false);

  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const {
    showTrophyModal,
    trophiesEarned,
    achievementEarned,
    activateDoubleReward,
    resetTrophyData,
  } = useTrophy();
  const videoRefTrophy = useRef<Video>(null);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
// true => pubs non personnalisées (rempli par ton écran consentement / CMP)
const npa = (globalThis as any).__NPA__ === true;

  // States
  const [reward, setReward] = useState(trophiesEarned);
  const [adWatched, setAdWatched] = useState(false);
  const [message, setMessage] = useState("");
  const [adLoaded, setAdLoaded] = useState(false);
  const videoRef = useRef<Video>(null);
  const { showRewardedAds, showInterstitials } = useAdsVisibility() as any;
  const canShowRewarded = (showRewardedAds ?? showInterstitials) === true;
  const rewardedRef = useRef<RewardedAd | null>(null);
  const earnedRef = useRef(false);

  // Ad handling (gating + flux EARNED -> CLOSED)
 useEffect(() => {
  if (!canShowRewarded || !showTrophyModal) {
    setAdLoaded(false);
    return;
  }

  // (re)crée l'instance si absente OU si le consentement a changé
  if (!rewardedRef.current || (rewardedRef.current as any).__npa !== npa) {
    const unitId = __DEV__ ? TestIds.REWARDED : adUnitIds.rewarded;
    const inst = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: npa, // 👈 respecte le consentement
    });
    (inst as any).__npa = npa; // mémo local pour détecter un changement ultérieur
    rewardedRef.current = inst;
  }
  const rewarded = rewardedRef.current!;

  const unsubLoaded = rewarded.addAdEventListener(
    RewardedAdEventType.LOADED,
    () => setAdLoaded(true)
  );
  const unsubEarned = rewarded.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    () => { earnedRef.current = true; }
  );
  const unsubError = rewarded.addAdEventListener(
    AdEventType.ERROR,
    (error) => {
      console.error("❌ Rewarded error:", error?.message ?? error);
      setAdLoaded(false);
    }
  );
  const unsubClosed = rewarded.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      const earned = earnedRef.current;
      earnedRef.current = false;
      setAdLoaded(false);
      try { rewarded.load(); } catch {}

      if (earned) {
        setAdWatched(true);
        activateDoubleReward();
        const base = trophiesEarned || Math.round(5 * (selectedDays / 7));
        const doubled = base * 2;
        setReward(doubled);
        setMessage(t("trophyModal.doubleMessage", { count: doubled }));
      } else {
        setMessage(t("trophyModal.adNotReady"));
      }
    }
  );

  try { rewarded.load(); } catch {}

  return () => {
    unsubLoaded();
    unsubEarned();
    unsubError();
    unsubClosed();
  };
}, [canShowRewarded, showTrophyModal, activateDoubleReward, trophiesEarned, selectedDays, t, npa]);


  // Animation on modal show/hide
  useEffect(() => {
    if (showTrophyModal) {
      setReward(trophiesEarned || Math.round(5 * (selectedDays / 7)));
      setAdWatched(false);
      setMessage("");
      setVideoFailed(false);
      videoRef.current?.playAsync();
      videoRefTrophy.current?.playAsync();
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
          Animated.timing(buttonsTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      videoRef.current?.pauseAsync();
      videoRefTrophy.current?.pauseAsync();
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        scaleAnim.setValue(0);
        textTranslateY.setValue(30);
        buttonsTranslateY.setValue(30);
      });
    }
  }, [showTrophyModal, trophiesEarned, selectedDays]);

   const handleAdPress = useCallback(() => {
    Vibration.vibrate(50);
    if (!canShowRewarded) {
      setMessage(t("trophyModal.adNotReady"));
      return;
    }
    const rewarded = rewardedRef.current;
    if (adLoaded && rewarded) {
      try {
        rewarded.show();
      } catch {
        setMessage(t("trophyModal.adNotReady"));
        try { rewarded.load(); } catch {}
      }
    } else {
      setMessage(t("trophyModal.adNotReady"));
      try { rewarded?.load(); } catch {}
    }
  }, [adLoaded, canShowRewarded, t]);

  const handleClaimPress = useCallback(() => {
    Vibration.vibrate(50);
    setMessage(t("trophyModal.claimMessage", { count: reward }));
    setTimeout(() => {
      resetTrophyData();
    }, 600);
  }, [reward, resetTrophyData, t]);

  // Définir les styles dynamiquement
  const styles = StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    modalBackground: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: SCREEN_WIDTH * 0.9,
      maxWidth: normalizeSize(420),
      borderRadius: normalizeSize(20),
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: normalizeSize(12),
      elevation: 12,
    },
    modalInner: {
      paddingVertical: normalizeSize(25),
      paddingHorizontal: normalizeSize(20),
      alignItems: "center",
      borderWidth: 1,
      borderColor: currentTheme.colors.border,
    },
    animationContainer: {
      width: normalizeSize(140),
      height: normalizeSize(140),
      marginBottom: normalizeSize(20),
      justifyContent: "center",
      alignItems: "center",
    },
    glowEffect: {
      width: normalizeSize(160),
      height: normalizeSize(160),
      borderRadius: normalizeSize(80),
      justifyContent: "center",
      alignItems: "center",
    },
    videoContainer: {
      width: normalizeSize(120),
      height: normalizeSize(120),
      borderRadius: normalizeSize(60),
      borderWidth: 3,
      borderColor: currentTheme.colors.primary,
      overflow: "hidden",
      backgroundColor: currentTheme.colors.background, // Fallback visuel
      justifyContent: "center", // Pour centrer l’icône fallback
      alignItems: "center",
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
    title: {
      fontSize: normalizeSize(28),
      fontFamily: "Comfortaa_700Bold",
      marginVertical: normalizeSize(12),
      textAlign: "center",
      color: currentTheme.colors.secondary,
      textShadowColor: "rgba(0, 0, 0, 0.3)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 4,
    },
    rewardText: {
      fontSize: normalizeSize(22),
      fontFamily: "Comfortaa_600SemiBold",
      textAlign: "center",
      marginBottom: normalizeSize(10),
      color: currentTheme.colors.textSecondary,
      textShadowColor: "rgba(0, 0, 0, 0.2)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    achievementText: {
      fontSize: normalizeSize(18),
      fontFamily: "Comfortaa_500Medium",
      textAlign: "center",
      marginBottom: normalizeSize(15),
      color: currentTheme.colors.primary,
      textShadowColor: "rgba(0, 0, 0, 0.2)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    message: {
      fontSize: normalizeSize(16),
      fontFamily: "Comfortaa_400Regular",
      textAlign: "center",
      marginVertical: normalizeSize(16),
      color: "#00FF88", // Remplacement temporaire de success
      textShadowColor: "rgba(0, 0, 0, 0.2)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
  });

  if (!showTrophyModal) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim as any }]}>
      <Video
        ref={videoRef}
        source={require("../assets/videos/intro-video8.mp4")}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.9)"] as const}
        style={styles.modalBackground}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: scaleAnim as any }] },
          ]}
        >
          <LinearGradient
            colors={
              [
                currentTheme.colors.background,
                currentTheme.colors.cardBackground,
              ] as const
            }
            style={styles.modalInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.animationContainer}>
              {!videoFailed ? (
                <LinearGradient
                  colors={
                    [
                      currentTheme.colors.primary + "80",
                      currentTheme.colors.secondary + "40",
                      "transparent",
                    ] as const
                  }
                  style={styles.glowEffect}
                >
                  <View style={styles.videoContainer}>
                    <Video
                      ref={videoRefTrophy}
                      source={require("../assets/videos/trophy-animation.mp4")}
                      style={styles.video}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      isMuted={true}
                      useNativeControls={false}
                      usePoster={true}
                      posterSource={require("../assets/images/trophy-poster.png")}
                      onError={(error) => {
                        console.error(
                          "Erreur chargement trophy-animation.mp4:",
                          error
                        );
                        setVideoFailed(true);
                      }}
                    />
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.videoContainer}>
                  <Ionicons
                    name="trophy"
                    size={normalizeSize(60)}
                    color={currentTheme.colors.textPrimary}
                  />
                </View>
              )}
            </View>

            <Animated.View
              style={{ transform: [{ translateY: textTranslateY as any }] }}
            >
              <Text style={styles.title}>{t("trophyModal.congrats")}</Text>
              <Text style={styles.rewardText}>
                {t("trophyModal.reward", { count: reward })}
              </Text>

              {achievementEarned && (
  <Text style={styles.achievementText}>
    🏆 {t(`achievements.${achievementEarned}`, { defaultValue: t(achievementEarned) })}
  </Text>
)}

              {!!message && <Text style={styles.message}>{message}</Text>}
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateY: buttonsTranslateY as any }] }}
            >
              <GradientButton
                onPress={handleClaimPress}
                text={t("trophyModal.claim")}
                gradientColors={
                  [
                    currentTheme.colors.primary,
                    currentTheme.colors.secondary,
                  ] as const
                }
              />
              {!adWatched && (
                <GradientButton
  onPress={handleAdPress}
  text={t("trophyModal.doubleReward")}
  iconName="videocam-outline"
  gradientColors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
  // optionnel : wrapper côté appelant pour ajuster l’opacité si !adLoaded
/>
              )}
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
};

interface GradientButtonProps {
  onPress: () => void;
  text: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string, ...string[]];
}

const GradientButton: React.FC<GradientButtonProps> = ({
  onPress,
  text,
  iconName,
  gradientColors,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Vibration.vibrate(50);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  const buttonStyles = StyleSheet.create({
    gradientButton: {
      width: "90%", // Agrandi pour plus d’espace
      marginVertical: normalizeSize(8),
      alignSelf: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: normalizeSize(4) },
      shadowOpacity: 0.3,
      shadowRadius: normalizeSize(6),
      elevation: 8,
    },
    buttonGradient: {
      paddingVertical: normalizeSize(14),
      paddingHorizontal: normalizeSize(32), // Plus de padding pour le texte
      borderRadius: normalizeSize(24),
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    buttonContent: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    buttonIcon: {
      marginRight: normalizeSize(6),
    },
    buttonGradientText: {
      color: "#FFFFFF",
      fontSize: normalizeSize(15),
      fontFamily: "Comfortaa_700Bold",
      textAlign: "center",
      textShadowColor: "rgba(0, 0, 0, 0.1)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 1,
    },
  });

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      style={buttonStyles.gradientButton}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={buttonStyles.buttonGradient}
        >
          <View style={buttonStyles.buttonContent}>
            {iconName && (
              <Ionicons
                name={iconName}
                size={normalizeSize(20)}
                color="#FFFFFF"
                style={buttonStyles.buttonIcon}
              />
            )}
            <Text
              style={buttonStyles.buttonGradientText}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {text}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default TrophyModal;
