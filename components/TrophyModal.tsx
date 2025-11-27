// components/TrophyModal.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Vibration,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Animated as RNAnimated } from "react-native";
import { Video, ResizeMode, AVPlaybackStatusSuccess } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useTrophy } from "../context/TrophyContext";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const scaleBase = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
const normalizeSize = (n: number) => Math.max(1, Math.round(n * scaleBase));
const SPACING = normalizeSize(14);

interface TrophyModalProps {
  challengeId: string;
  selectedDays: number;
}

const TrophyModal: React.FC<TrophyModalProps> = ({ challengeId, selectedDays }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const {
    showTrophyModal,
    trophiesEarned,
    achievementEarned,
    activateDoubleReward,
    resetTrophyData,
    closeTrophyModal,
    isClaiming,
    canClaim,
    setShowTrophyModal,
  } = useTrophy();

  const { requestRewardedAd, preloadRewarded } = useCurrentChallenges();
  const { showRewarded } = useAdsVisibility() as any;
  const canShowRewarded = !!showRewarded;

  const [reward, setReward] = useState<number>(0);
  const [adWatched, setAdWatched] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [bgFailed, setBgFailed] = useState(false);
  const [trophyVidFailed, setTrophyVidFailed] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);

  const videoBgRef = useRef<Video>(null);
  const videoTrophyRef = useRef<Video>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations premium stables
  const cardEnter = ZoomIn.springify().damping(18);
  const cardExit = ZoomOut.duration(140);

  const defaultBaseReward = useMemo(
    () => trophiesEarned || Math.max(3, Math.round(5 * (selectedDays / 7))),
    [trophiesEarned, selectedDays]
  );

  const withAlpha = useCallback((hex: string, a: number) => {
    const clamp = (x: number, min = 0, max = 1) =>
      Math.min(Math.max(x, min), max);
    const alpha = Math.round(clamp(a) * 255)
      .toString(16)
      .padStart(2, "0");
    const clean = hex.replace("#", "");
    if (clean.length === 3)
      return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}${alpha}`;
    return `#${clean}${alpha}`;
  }, []);

  // Preload rewarded au moment où ça s’ouvre
  useEffect(() => {
    if (!showTrophyModal) return;
    try {
      preloadRewarded();
    } catch {}
  }, [showTrophyModal, preloadRewarded]);

  // Init / reset état à l’ouverture + lecture vidéo
  useEffect(() => {
    if (showTrophyModal) {
      setReward(defaultBaseReward);
      setAdWatched(false);
      setAdBusy(false);
      setMessage("");
      setBgFailed(false);
      setTrophyVidFailed(false);
      setShouldPlay(true);

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      try {
        Vibration.vibrate(25);
      } catch {}

      // petite pulse sur le médaillon
      pulseSV.value = 0;
      pulseSV.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400 }),
          withTiming(0, { duration: 1400 })
        ),
        -1,
        true
      );
    } else {
      setShouldPlay(false);
      if (guardRef.current) clearTimeout(guardRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      pulseSV.value = 0;
    }
  }, [showTrophyModal, defaultBaseReward]);

  // Cleanup sur unmount
  useEffect(() => {
    return () => {
      if (guardRef.current) clearTimeout(guardRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      videoBgRef.current?.unloadAsync().catch(() => {});
      videoTrophyRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ===== Close WITHOUT claim (important UX) =====
  const closeManually = useCallback(() => {
    if (isClaiming) return; // on évite de casser une transaction en cours
    if (closeTrophyModal) return closeTrophyModal();
    // fallback au cas où
    setShowTrophyModal?.(false);
  }, [closeTrophyModal, setShowTrophyModal, isClaiming]);

  const handleDouble = useCallback(async () => {
    if (adBusy || isClaiming) return;

    if (!canShowRewarded) {
      setMessage(
        t("completion.adNotReady", {
          defaultValue: "Vidéo pas prête, réessaie dans 2–3 secondes.",
        })
      );
      return;
    }

    setAdBusy(true);
    try {
      guardRef.current = setTimeout(() => setAdBusy(false), 12000);
      const ok = await requestRewardedAd();
      if (guardRef.current) clearTimeout(guardRef.current);

      if (ok) {
        setAdWatched(true);
        activateDoubleReward();

        const doubled = defaultBaseReward * 2;
        setReward(doubled);

        setMessage(
          t("trophyModal.doubleMessage", {
            count: doubled,
            defaultValue: `Récompense doublée : ${doubled}`,
          })
        );

        try {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } catch {}
      } else {
        setMessage(
          t("completion.adNotReady", {
            defaultValue: "Vidéo pas prête, réessaie dans 2–3 secondes.",
          })
        );
      }
    } catch {
      setMessage(
        t("completion.adNotReady", {
          defaultValue: "Vidéo pas prête, réessaie dans 2–3 secondes.",
        })
      );
    } finally {
      setAdBusy(false);
    }
  }, [
    adBusy,
    isClaiming,
    canShowRewarded,
    requestRewardedAd,
    activateDoubleReward,
    defaultBaseReward,
    t,
  ]);

  const handleClaim = useCallback(() => {
    if (!canClaim || isClaiming) return;

    try {
      Haptics.selectionAsync();
    } catch {}
    try {
      Vibration.vibrate(20);
    } catch {}

    setMessage(
      t("trophyModal.claimMessage", {
        count: reward,
        defaultValue: `+${reward} trophées ajoutés ✅`,
      })
    );

    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      resetTrophyData();
    }, 650);
  }, [reward, resetTrophyData, t, canClaim, isClaiming]);

    // subtle pulse style
  // ⚠️ hook AVANT tout return conditionnel
  const pulseSV = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => {
    const s = 1 + pulseSV.value * 0.03;
    const o = 0.85 + pulseSV.value * 0.15;
    return { transform: [{ scale: s }], opacity: o };
  });

  // Sécurise: pas de modal si fermé
  if (!showTrophyModal) return null;

  const textPrimary = isDarkMode
    ? currentTheme.colors.textPrimary
    : "#0B0F1C";
  const textSecondary = isDarkMode
    ? currentTheme.colors.textSecondary
    : "rgba(11,15,28,0.75)";


  return (
    <Modal
      visible={showTrophyModal}
      transparent
      animationType="none"
      onRequestClose={closeManually}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      accessibilityViewIsModal
    >
      <Reanimated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={styles.root}
      >
        {/* ===== Fond vidéo / fallback ===== */}
        {!bgFailed ? (
          <Video
            ref={videoBgRef}
            source={require("../assets/videos/intro-video8.mp4")}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={shouldPlay}
            isMuted
            onError={() => setBgFailed(true)}
            onLoad={(st) => {
              const s = st as AVPlaybackStatusSuccess;
              if (!s.isLoaded) setBgFailed(true);
            }}
          />
        ) : (
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.primary, 0.25),
              withAlpha(currentTheme.colors.secondary, 0.25),
            ]}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={closeManually}
          accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
          accessibilityRole="button"
        />

        <View
          style={[
            styles.center,
            {
              paddingTop: Math.max(12, insets.top * 0.35),
              paddingBottom: Math.max(12, insets.bottom * 0.35),
              paddingHorizontal: 16,
            },
          ]}
          pointerEvents="box-none"
        >
          {/* ===== CARD ===== */}
          <Reanimated.View
            entering={cardEnter}
            exiting={cardExit}
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.colors.background,
                borderColor: withAlpha(currentTheme.colors.border, 0.6),
              },
            ]}
            testID="trophy-card"
            accessibilityRole="summary"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={closeManually}
                accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="trophy-close"
              >
                <Ionicons name="close" size={normalizeSize(20)} color={textPrimary} />
              </TouchableOpacity>

              <Text
                style={[styles.title, { color: textPrimary }]}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {t("trophyModal.congrats", { defaultValue: "Bravo ! 🎉" })}
              </Text>

              <View style={{ width: normalizeSize(20) }} />
            </View>

            {/* Trophy animation */}
            <View style={styles.animationContainer}>
              <Reanimated.View style={pulseStyle}>
                <LinearGradient
                  colors={[
                    withAlpha(currentTheme.colors.primary, 0.7),
                    withAlpha(currentTheme.colors.secondary, 0.4),
                    "transparent",
                  ]}
                  style={styles.glow}
                >
                  <View style={[styles.videoCircle, { borderColor: currentTheme.colors.primary }]}>
                    {!trophyVidFailed ? (
                      <Video
                        ref={videoTrophyRef}
                        source={require("../assets/videos/trophy-animation.mp4")}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={shouldPlay}
                        isMuted
                        usePoster
                        posterSource={require("../assets/images/trophy-poster.png")}
                        onError={() => setTrophyVidFailed(true)}
                      />
                    ) : (
                      <View style={styles.fallbackIcon}>
                        <Ionicons name="trophy" size={normalizeSize(64)} color={textPrimary} />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </Reanimated.View>
            </View>

            {/* Texts */}
            <View style={{ alignItems: "center", paddingHorizontal: 12 }}>
              <Text style={[styles.rewardText, { color: currentTheme.colors.secondary }]}>
                {t("trophyModal.reward", {
                  count: reward,
                  defaultValue: `+${reward} trophées`,
                })}
              </Text>

              {achievementEarned ? (
                <Text style={[styles.achievementText, { color: currentTheme.colors.primary }]}>
                  🏆{" "}
                  {t(`achievements.${achievementEarned}`, {
                    defaultValue: t(achievementEarned),
                  })}
                </Text>
              ) : null}

              {!!message && (
                <Text
                  style={[
                    styles.message,
                    { color: isDarkMode ? "#8BFFB0" : "#0E9F6E" },
                  ]}
                >
                  {message}
                </Text>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.buttons}>
              <GradientButton
                onPress={handleClaim}
                text={t("trophyModal.claim", { defaultValue: "Récupérer 🎁" })}
                iconName="checkmark-circle-outline"
                gradientColors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                disabled={!canClaim || isClaiming}
                loading={isClaiming}
              />

              {!adWatched && !isClaiming && (
                <GradientButton
                  onPress={handleDouble}
                  text={t("trophyModal.doubleReward", {
                    defaultValue: "Doubler la récompense",
                  })}
                  iconName="videocam-outline"
                  gradientColors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                  disabled={!canShowRewarded || adBusy}
                  loading={adBusy}
                />
              )}
            </View>
          </Reanimated.View>
          {/* ===== END CARD ===== */}
        </View>
      </Reanimated.View>
    </Modal>
  );
};

interface GradientButtonProps {
  onPress: () => void;
  text: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string, ...string[]];
  disabled?: boolean;
  loading?: boolean;
}

const GradientButton: React.FC<GradientButtonProps> = React.memo(
  ({ onPress, text, iconName, gradientColors, disabled, loading }) => {
    const scale = useRef(new RNAnimated.Value(1)).current;

    const pressIn = () => {
      if (disabled) return;
      try { Vibration.vibrate(12); } catch {}
      RNAnimated.spring(scale, {
        toValue: 0.96,
        friction: 6,
        useNativeDriver: true,
      }).start();
    };

    const pressOut = () => {
      RNAnimated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start(() => {
        if (!disabled) onPress();
      });
    };

    return (
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.85}
        style={[btnStyles.wrap, disabled && { opacity: 0.55 }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={btnStyles.gradient}
          >
            <View style={btnStyles.content}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
              ) : (
                iconName && (
                  <Ionicons
                    name={iconName}
                    size={normalizeSize(18)}
                    color="#FFFFFF"
                    style={btnStyles.icon}
                  />
                )
              )}

              <Text style={btnStyles.text} adjustsFontSizeToFit numberOfLines={1}>
                {text}
              </Text>
            </View>
          </LinearGradient>
        </RNAnimated.View>
      </TouchableOpacity>
    );
  }
);

/* Styles */
const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "92%",
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: Platform.OS === "android" ? 6 : 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING,
  },
  title: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  animationContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING,
  },
  glow: {
    width: normalizeSize(172),
    height: normalizeSize(172),
    borderRadius: normalizeSize(86),
    alignItems: "center",
    justifyContent: "center",
  },
  videoCircle: {
    width: normalizeSize(140),
    height: normalizeSize(140),
    borderRadius: normalizeSize(70),
    overflow: "hidden",
    borderWidth: 3,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  fallbackIcon: { flex: 1, alignItems: "center", justifyContent: "center" },
  rewardText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 4,
  },
  achievementText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_600SemiBold" as any,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 8,
  },
  message: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: 6,
  },
  buttons: { marginTop: SPACING, alignItems: "center" },
});

const btnStyles = StyleSheet.create({
  wrap: {
    width: "92%",
    marginVertical: normalizeSize(6),
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  gradient: {
    paddingVertical: normalizeSize(14),
    paddingHorizontal: normalizeSize(22),
    borderRadius: normalizeSize(24),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { marginRight: normalizeSize(6) },
  text: {
    color: "#fff",
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
});

export default TrophyModal;
