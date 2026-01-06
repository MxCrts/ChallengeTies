// components/WelcomeBonusModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
 } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import type { ViewStyle } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { BlurView } from "expo-blur";
import { Pressable } from "react-native";


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalize = (size: number) => {
  const base = 375;
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / base;
  return Math.round(size * scale);
};

export type WelcomeRewardKind = "trophies" | "streakPass" | "premium";
type WelcomeBonusReward = {
  type: WelcomeRewardKind;
  amount?: number;
  days?: number;
};

/**
 * Mapping fixe des 7 jours (pour la grille en bas)
 */
const WELCOME_REWARDS: WelcomeBonusReward[] = [
  { type: "trophies", amount: 8 }, // Jour 1
  { type: "trophies", amount: 12 }, // Jour 2
  { type: "streakPass", amount: 1 }, // Jour 3
  { type: "trophies", amount: 15 }, // Jour 4
  { type: "streakPass", amount: 1 }, // Jour 5
  { type: "trophies", amount: 20 }, // Jour 6
  { type: "premium", days: 7 }, // Jour 7
];

export type WelcomeBonusModalProps = {
  visible: boolean;
  onClose: () => void;
  onClaim: () => Promise<void> | void;
  /** index du jour actuel (0–6) */
  currentDay: number;
  /** nombre total de jours dans la série (ex: 7) */
  totalDays: number;
  /** type de récompense du jour (pour le texte / icône) */
  rewardType: WelcomeRewardKind;
  /** quantité (trophées ou streakPass / jours premium) */
  rewardAmount: number;
  loading?: boolean;
};

const WelcomeBonusModal: React.FC<WelcomeBonusModalProps> = ({
  visible,
  onClose,
  onClaim,
  currentDay,
  totalDays,
  rewardType,
  rewardAmount,
  loading,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const isDark = theme === "dark";
  const current: Theme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const clampedTotal = Math.max(1, totalDays || 1);
  const dayIndex = Math.min(Math.max(currentDay, 0), clampedTotal - 1);
  const displayDay = dayIndex + 1;

  // 🔥 ANIMATIONS — Carte / coffre / halo
  const cardScale = useSharedValue(0.9);
  const chestBob = useSharedValue(0);
  const chestScale = useSharedValue(1);
  const todayPulse = useSharedValue(0);
  const globalGlow = useSharedValue(0);
const [showConfetti, setShowConfetti] = useState(false);
const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setClaimSuccess(false);
setShowConfetti(false);
globalGlow.value = 0.2;

    // scale d'apparition de la carte
    cardScale.value = 0.9;
    cardScale.value = withSpring(1, { damping: 18, stiffness: 220 });

    // léger "bob" vertical du coffre + breathing scale
    chestBob.value = 0;
    chestBob.value = withRepeat(
      withSequence(
        withTiming(-6, {
          duration: 600,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 600,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      true
    );

    chestScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );

    // halo sur la récompense du jour
    todayPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 })
      ),
      -1,
      true
    );

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    // Glow global de la carte – effet "divin" sans confettis
    globalGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.3, { duration: 1800 })
      ),
      -1,
      true
    );
  }, [visible, cardScale, chestBob, chestScale, todayPulse, globalGlow]);


const cardAnimatedStyle = useAnimatedStyle<ViewStyle>(() => {
  const lift = (1 - cardScale.value) * 16;

  return {
    transform: [
      { scale: cardScale.value },
      { translateY: lift },
    ] as any,
  };
});


  const chestAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: chestBob.value },
        { scale: chestScale.value },
      ] as any, // 👈 cast pour calmer TS sur le type de transform
    };
  });

  const todayGlowStyle = useAnimatedStyle(() => {
    const scale = 1 + todayPulse.value * 0.06;
    const opacity = 0.45 + todayPulse.value * 0.35;
    return {
      transform: [{ scale }] as any,
      opacity,
    };
  });

  const globalGlowStyle = useAnimatedStyle(() => ({
    opacity: globalGlow.value * 0.25,
  }));

  const title = useMemo(
    () =>
      t("welcomeBonus.title", {
        defaultValue: "Pack de bienvenue",
      }),
    [t]
  );

  const subtitle = useMemo(
    () =>
      t("welcomeBonus.subtitle", {
        day: displayDay,
        total: clampedTotal,
        defaultValue: "Jour {{day}} sur {{total}} • Chaque jour compte.",
      }),
    [t, displayDay, clampedTotal]
  );

  const bottomHint = useMemo(
    () =>
      t("welcomeBonus.bottomHint", {
        defaultValue: "Connecte-toi chaque jour pour débloquer 100 % du pack.",
      }),
    [t]
  );

  const rewardLabel = useMemo(() => {
    switch (rewardType) {
      case "trophies":
        return t("welcomeBonus.reward.trophies", {
          count: rewardAmount,
          defaultValue: "{{count}} trophées bonus",
        });
      case "streakPass":
        return t("welcomeBonus.reward.streakPass", {
          count: rewardAmount,
          defaultValue: "{{count}} Streak Pass pour protéger ta série",
        });
      case "premium":
        return t("welcomeBonus.reward.premium", {
          count: rewardAmount,
          defaultValue: "{{count}} jours de ChallengeTies Premium",
        });
      default:
        return "";
    }
  }, [rewardType, rewardAmount, t]);

  const ctaLabel = useMemo(
    () =>
      t("welcomeBonus.cta", {
        defaultValue: "Récupérer ma récompense",
      }),
    [t]
  );

  // Gradients
  const gradBg = useMemo<[string, string, string]>(
    () =>
      isDark
        ? ["#020617", "#020617", "#020617"]
        : ["#020617", "#020617", "#020617"],
    [isDark]
  );

  const gradBoard = useMemo<[string, string, string]>(
    () => [
      "rgba(15,23,42,0.98)",
      "rgba(30,41,59,0.98)",
      "rgba(15,23,42,0.98)",
    ],
    []
  );

  const gradBorder = useMemo<[string, string, string]>(
    () =>
      isDark
        ? [
            "rgba(248,250,252,0.35)",
            "rgba(148,163,184,0.25)",
            "rgba(248,250,252,0.32)",
          ]
        : [
            "rgba(251,191,36,0.95)",
            "rgba(56,189,248,0.85)",
            "rgba(251,113,133,0.98)",
          ],
    [isDark]
  );

  const getIconForKind = (
    kind: WelcomeRewardKind
  ): keyof typeof Ionicons.glyphMap => {
    switch (kind) {
      case "premium":
        return "diamond-outline";
      case "streakPass":
        return "ticket-outline";
      case "trophies":
      default:
        return "trophy-outline";
    }
  };

  const baseRewardIcon = getIconForKind(rewardType);

  if (!visible) return null;

  const handleClaimPress = async () => {
  if (loading) return;

  // haptique + punch du coffre
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  } catch {}

  chestScale.value = withSequence(
    withTiming(1.12, { duration: 120 }),
    withSpring(1, { damping: 12, stiffness: 220 })
  );

  try {
    await onClaim();

    // ✅ moment dopamine
    setClaimSuccess(true);
    setShowConfetti(true);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}

    // laisse le wow et ferme
    setTimeout(() => {
      setShowConfetti(false);
      setClaimSuccess(false);
      onClose();
    }, 700);
  } catch (e) {
    console.error("WelcomeBonus onClaim error:", e);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } catch {}
  }
};


  const columns = clampedTotal <= 3 ? clampedTotal : 4;
  const dayTileWidth =
    columns === 1
      ? "100%"
      : columns === 2
      ? "46%"
      : columns === 3
      ? "30%"
      : "22%";

  const progressRatio = clampedTotal <= 1 
  ? 1 
  : ((displayDay - 1) / (clampedTotal - 1));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      {...(Platform.OS === "ios"
        ? { presentationStyle: "overFullScreen" as const }
        : {})}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + normalize(10), normalize(20)),
            paddingBottom: Math.max(
              insets.bottom + normalize(10),
              normalize(20)
            ),
          },
        ]}
      >
        {/* Backdrop premium */}
{Platform.OS === "ios" ? (
  <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
) : (
  <View
    style={[
      StyleSheet.absoluteFillObject,
      { backgroundColor: "rgba(0,0,0,0.25)" },
    ]}
  />
)}

{/* Confetti au claim */}
{showConfetti && (
  <ConfettiCannon
    count={90}
    origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
    fadeOut
    fallSpeed={2600}
    explosionSpeed={520}
  />
)}

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            globalGlowStyle,
            {
              backgroundColor: "#FCD34D",
              borderRadius: normalize(34),
              marginHorizontal: normalize(20),
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          entering={FadeInUp.duration(260)}
          exiting={FadeOut.duration(180)}
          style={[styles.modalContainer, cardAnimatedStyle]}
        >
          <LinearGradient colors={gradBorder} style={styles.borderWrap}>
            <LinearGradient colors={gradBg} style={styles.modalBackground}>
              <LinearGradient colors={gradBoard} style={styles.boardInner}>
                {/* Ruban top */}
                <View style={styles.ribbonWrapper}>
                  <LinearGradient
                    colors={["#FCD34D", "#F59E0B", "#DC2626"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ribbon}
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={normalize(16)}
                      color="#0F172A"
                    />
                    <Text style={styles.ribbonText}>
                      {t("welcomeBonus.ribbon", {
                        defaultValue: "Pack de bienvenue ChallengeTies",
                      })}
                    </Text>
                    <Ionicons
                      name="sparkles-outline"
                      size={normalize(16)}
                      color="#0F172A"
                    />
                  </LinearGradient>
                </View>

                {/* Hero coffre Lottie */}
                <Animated.View style={[styles.chestIconWrap, chestAnimatedStyle]}>
                  <LottieView
                    source={require("../assets/lotties/welcomeChest.json")}
                    autoPlay
                    loop={false}
                    style={styles.chestLottie}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Header titre + sous-titre */}
                <View style={styles.header}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: current.colors.textPrimary,
                        fontFamily: current.typography.title.fontFamily,
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {title}
                  </Text>

                  <Text
                    style={[
                      styles.subtitle,
                      {
                        color: current.colors.textSecondary,
                        fontFamily: current.typography.body.fontFamily,
                      },
                    ]}
                  >
                    {subtitle}
                  </Text>
                </View>

                {/* Barre de progression des jours */}
                <View style={styles.progressWrapper}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${progressRatio * 100}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressDotsRow}>
                    {Array.from({ length: clampedTotal }).map((_, idx) => {
                      const reached = idx <= dayIndex;
                      return (
                        <View
                          key={`dot-${idx}`}
                          style={[
                            styles.progressDot,
                            reached && styles.progressDotActive,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Carte récompense du jour */}
                <Animated.View
                  entering={ZoomIn.springify().damping(20)}
                  exiting={ZoomOut.duration(140)}
                  style={styles.todayCardWrapper}
                >
                  <LinearGradient
                    colors={["#FFF8E1", "#FEF3C7", "#FDE68A"]}
                    style={styles.todayCard}
                  >
                    <Animated.View style={[styles.todayGlow, todayGlowStyle]} pointerEvents="none">
  <LinearGradient
    colors={["rgba(251,146,60,0.55)", "transparent", "rgba(236,72,153,0.18)"]}
    style={StyleSheet.absoluteFillObject}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
  />
</Animated.View>

                    <View style={styles.todayIconCircle}>
                      <Ionicons
                        name={baseRewardIcon}
                        size={normalize(34)}
                        color="#1F2937"
                      />
                    </View>
                    <View style={styles.todayTextBlock}>
                      <Text
                        style={[styles.todayTitle, { color: "#7C2D12" }]}
                      >
                        {t("welcomeBonus.todayRewardTitle", {
                          defaultValue: "Récompense du jour",
                        })}
                      </Text>
                      <Text
                        style={[styles.todayReward, { color: "#1F2937" }]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {rewardLabel}
                      </Text>
                      {claimSuccess && (
  <Animated.View entering={FadeInUp.duration(220)} style={{ marginTop: normalize(6) }}>
    <Text style={styles.claimedNow}>
      {t("welcomeBonus.claimSuccess", { defaultValue: "Ajouté ✅" })}
    </Text>
  </Animated.View>
)}
                      {rewardType === "premium" && (
                        <Text
                          style={[styles.todayHint, { color: "#4B5563" }]}
                          numberOfLines={2}
                        >
                          {t("welcomeBonus.premiumHint", {
                            defaultValue:
                              "Aucune publicité + toute l’expérience ChallengeTies en illimité.",
                          })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>
                        {t("welcomeBonus.dayBadge", {
                          day: displayDay,
                          defaultValue: "Jour {{day}}",
                        })}
                      </Text>
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* Grille des jours façon lootboard */}
                <View style={styles.gridWrapper}>
                  {Array.from({ length: clampedTotal }).map((_, idx) => {
                    const isPast = idx < dayIndex;
                    const isToday = idx === dayIndex;
                    const isFuture = idx > dayIndex;

                    const config = WELCOME_REWARDS[idx];
                    const dayKind: WelcomeRewardKind =
                      config?.type ?? "trophies";
                    const iconName = getIconForKind(dayKind);

                    const tileColors: [string, string] = isToday
                      ? ["#FACC15", "#FB7185"]
                      : isPast
                      ? ["rgba(34,197,94,0.9)", "rgba(22,163,74,0.95)"]
                      : ["rgba(148,163,184,0.95)", "rgba(100,116,139,0.95)"];

                    const iconColor = isToday
                      ? "#1F2937"
                      : isPast
                      ? "#ECFDF3"
                      : "#E5E7EB";

                    const overlayBadgeIcon:
                      | keyof typeof Ionicons.glyphMap
                      | null = isPast
                      ? "checkmark-circle"
                      : isFuture
                      ? "lock-closed"
                      : null;

                    const overlayBadgeColor = isPast ? "#BBF7D0" : "#E5E7EB";

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.dayTileOuter,
                          { width: dayTileWidth as any },
                        ]}
                      >
                        <LinearGradient
                          colors={tileColors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.dayTileBorder}
                        >
                          <View style={styles.dayTileInner}>
                            <View style={styles.dayIconWrap}>
                              <Ionicons
                                name={iconName}
                                size={normalize(22)}
                                color={iconColor}
                              />
                              {overlayBadgeIcon && (
                                <View style={styles.dayBadgeOverlay}>
                                  <Ionicons
                                    name={overlayBadgeIcon}
                                    size={normalize(14)}
                                    color={overlayBadgeColor}
                                  />
                                </View>
                              )}
                            </View>

                            <Text style={styles.dayLabel}>
                              {t("welcomeBonus.dayLabel", {
                                day: idx + 1,
                                defaultValue: `Jour ${idx + 1}`,
                              })}
                            </Text>

                            {isPast && (
                              <Text style={styles.dayStatus}>
                                {t("welcomeBonus.claimed", {
                                  defaultValue: "Récupéré",
                                })}
                              </Text>
                            )}
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  })}
                </View>

                {/* CTA principal */}
                <Pressable
  onPress={handleClaimPress}
  disabled={loading}
  accessibilityRole="button"
  accessibilityLabel={ctaLabel}
  style={({ pressed }) => [
    styles.ctaButton,
    loading && { opacity: 0.7 },
    pressed && { transform: [{ scale: 0.985 }] }, // 👈 press premium
  ]}
>

                  <LinearGradient
                    colors={[current.colors.secondary, current.colors.primary]}
                    style={styles.ctaInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <LinearGradient
  colors={["rgba(255,255,255,0.32)", "transparent"]}
  style={StyleSheet.absoluteFillObject}
  start={{ x: 0, y: 0 }}
  end={{ x: 0, y: 1 }}
  pointerEvents="none"
/>
                    <Text
                      style={[
                        styles.ctaText,
                        { fontFamily: current.typography.title.fontFamily },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {loading
                        ? t("welcomeBonus.ctaLoading", {
                            defaultValue: "Un instant…",
                          })
                        : ctaLabel}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={normalize(18)}
                      color="#FFF"
                    />
                  </LinearGradient>
                </Pressable>

                {/* Hint bas */}
                <Text
                  style={[
                    styles.bottomHint,
                    { color: current.colors.textSecondary },
                  ]}
                >
                  {bottomHint}
                </Text>

                {/* Close */}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.close", {
                    defaultValue: "Fermer",
                  })}
                >
                  <Ionicons
                    name="close"
                    size={normalize(18)}
                    color="rgba(248,250,252,0.9)"
                  />
                </TouchableOpacity>
              </LinearGradient>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
     flex: 1,
     backgroundColor: "rgba(15,23,42,0.92)",
     justifyContent: "center",
     alignItems: "center",
     paddingHorizontal: normalize(12),
   },
  modalContainer: {
  width: SCREEN_WIDTH * 0.94,
  maxWidth: normalize(460),
  borderRadius: normalize(30),
  overflow: "hidden",
} as ViewStyle,

   borderWrap: {
     padding: 2,
     borderRadius: normalize(30),
   },
  modalBackground: {
     borderRadius: normalize(28),
     padding: normalize(4),
   },
  boardInner: {
    borderRadius: normalize(24),
    paddingVertical: normalize(24), // 👈 un peu plus d’air en haut/bas
    paddingHorizontal: normalize(16),
  },
  ribbonWrapper: {
    alignItems: "center",
    marginBottom: normalize(8),
  },
  ribbon: {
    borderRadius: normalize(999),
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(6),
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(6),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  ribbonText: {
    fontSize: normalize(11),
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  ctaInner: {
  borderRadius: normalize(999),
  paddingVertical: normalize(11),
  paddingHorizontal: normalize(18),
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 10,
},

  chestIconWrap: {
    width: normalize(150),          // 👈 coffre plus gros
    height: normalize(150),
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginTop: normalize(4),        // 👈 descend légèrement sous le ruban
    marginBottom: normalize(10),
  },
  chestLottie: {
    width: "100%",
    height: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: normalize(10),
  },
  title: {
    fontSize: normalize(22),
    textAlign: "center",
    marginBottom: normalize(4),
  },
  subtitle: {
    fontSize: normalize(13),
    textAlign: "center",
    opacity: 0.95,
  },
  progressWrapper: {
    marginTop: normalize(4),
    marginBottom: normalize(10),
  },
  progressBarBackground: {
    height: normalize(6),
    borderRadius: normalize(999),
    backgroundColor: "rgba(15,23,42,0.9)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: normalize(999),
    backgroundColor: "rgba(250,204,21,0.95)",
  },
  progressDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: normalize(4),
    paddingHorizontal: normalize(4),
  },
  progressDot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: normalize(4),
    backgroundColor: "rgba(148,163,184,0.7)",
  },
  progressDotActive: {
    backgroundColor: "#FACC15",
  },
  todayCardWrapper: {
    marginTop: normalize(4),
    marginBottom: normalize(12),
  },
  todayCard: {
    borderRadius: normalize(20),
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
borderColor: "rgba(249,115,22,0.55)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
 todayGlow: {
  ...StyleSheet.absoluteFillObject,
  opacity: 0.55,
},
claimedNow: {
  color: "#065F46",
  fontWeight: "800",
  fontSize: normalize(12),
},
  todayIconCircle: {
    width: normalize(56),
    height: normalize(56),
    borderRadius: normalize(28),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.7)",
    marginRight: normalize(10),
  },
  todayTextBlock: {
    flex: 1,
  },
  todayTitle: {
    fontSize: normalize(13),
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: normalize(2),
  },
  todayReward: {
    fontSize: normalize(16),
    fontWeight: "700",
    marginBottom: normalize(4),
  },
  todayHint: {
    fontSize: normalize(12),
    opacity: 0.95,
  },
  dayBadge: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(999),
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "rgba(30,64,175,0.9)",
    marginLeft: normalize(6),
  },
  dayBadgeText: {
    fontSize: normalize(11),
    color: "#FACC15",
    fontWeight: "600",
  },
  gridWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginVertical: normalize(4),
  },
  dayTileOuter: {
    marginVertical: normalize(4),
  },
  dayTileBorder: {
    borderRadius: normalize(14),
    padding: 1.2,
  },
  dayTileInner: {
    borderRadius: normalize(13),
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(6),
    backgroundColor: "rgba(15,23,42,0.98)",
    alignItems: "center",
  },
  dayIconWrap: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(4),
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.9)",
    position: "relative",
  },
  dayBadgeOverlay: {
    position: "absolute",
    bottom: -normalize(4),
    right: -normalize(4),
    width: normalize(18),
    height: normalize(18),
    borderRadius: normalize(9),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.98)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.9)",
  },
  dayLabel: {
    fontSize: normalize(11),
    color: "#E5E7EB",
    fontWeight: "600",
  },
  dayStatus: {
    fontSize: normalize(10),
    color: "#BBF7D0",
    marginTop: normalize(2),
  },
  ctaButton: {
    marginTop: normalize(10),
    marginBottom: normalize(4),
  },
  ctaText: {
    fontSize: normalize(15),
    color: "#FFF",
    marginRight: normalize(6),
  },
  bottomHint: {
    marginTop: normalize(4),
    fontSize: normalize(11),
    textAlign: "center",
    opacity: 0.9,
  },
  closeButton: {
    position: "absolute",
    top: normalize(8),
    right: normalize(8),
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
  },
});

export default WelcomeBonusModal;
