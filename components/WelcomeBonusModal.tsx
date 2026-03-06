// components/WelcomeBonusModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  interpolateColor,
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
import { LinearGradient } from "expo-linear-gradient";

export type WelcomeRewardKind = "trophies" | "streakPass" | "premium";
type WelcomeBonusReward = {
  type: WelcomeRewardKind;
  amount?: number;
  days?: number;
};

const WELCOME_REWARDS: WelcomeBonusReward[] = [
  { type: "trophies", amount: 8 },
  { type: "trophies", amount: 12 },
  { type: "streakPass", amount: 1 },
  { type: "trophies", amount: 15 },
  { type: "streakPass", amount: 1 },
  { type: "trophies", amount: 20 },
  { type: "premium", days: 7 },
];

const BASE_W = 375;

// ─── Palette ────────────────────────────────────────────────────────────────
const AMBER       = "#FFB300";
const AMBER_LIGHT = "#FFD060";
const AMBER_DIM   = "#C87800";
const GOLD        = "#FFE066";
const BG_DEEP     = "#06080E";
const BG_CARD     = "#0D1018";
const STROKE      = "rgba(255,183,0,0.22)";
const STROKE_SOFT = "rgba(255,255,255,0.09)";
const TEXT        = "rgba(248,250,252,0.97)";
const TEXT_DIM    = "rgba(248,250,252,0.70)";
const TEXT_FAINT  = "rgba(248,250,252,0.40)";
const GLASS       = "rgba(255,255,255,0.055)";
const GLASS_AMBER = "rgba(255,179,0,0.10)";

// ─── Types ───────────────────────────────────────────────────────────────────
type StylesParams = {
  screenW: number;
  isTiny: boolean;
  isTablet: boolean;
  n: (v: number) => number;
};

const makeStyles = ({ screenW, isTiny, isTablet, n }: StylesParams) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: n(isTiny ? 10 : 14),
    },

    centerWrap: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Sheet ──────────────────────────────────────────────────────────────
    sheet: {
      width: Math.min(screenW * 0.94, n(isTablet ? 560 : 500)),
      borderRadius: n(32),
      overflow: "hidden",
      borderWidth: 1,
      borderColor: STROKE,
    } as ViewStyle,

    sheetInner: {
      borderRadius: n(32),
      overflow: "hidden",
      backgroundColor: BG_DEEP,
    },

    scrollContent: {
      paddingBottom: n(20),
      paddingTop: n(6),
    },

    // ── Mesh background layers ─────────────────────────────────────────────
    meshLayer1: {
      position: "absolute",
      width: n(600),
      height: n(600),
      borderRadius: n(300),
      top: -n(180),
      alignSelf: "center",
      opacity: 0.13,
    },
    meshLayer2: {
      position: "absolute",
      width: n(400),
      height: n(400),
      borderRadius: n(200),
      bottom: -n(80),
      right: -n(80),
      opacity: 0.09,
    },
    meshLayer3: {
      position: "absolute",
      width: n(280),
      height: n(280),
      borderRadius: n(140),
      bottom: n(60),
      left: -n(60),
      opacity: 0.07,
    },

    // ── Top ribbon ──────────────────────────────────────────────────────────
    ribbonWrap: {
      alignItems: "center",
      paddingTop: n(isTiny ? 16 : 20),
      paddingBottom: n(6),
    },
    ribbon: {
      flexDirection: "row",
      alignItems: "center",
      gap: n(6),
      backgroundColor: GLASS_AMBER,
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.28)",
      borderRadius: n(999),
      paddingHorizontal: n(14),
      paddingVertical: n(6),
    },
    ribbonText: {
      fontSize: n(10.5),
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: AMBER_LIGHT,
    },

    // ── Hero zone ──────────────────────────────────────────────────────────
    heroZone: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: n(4),
      paddingBottom: n(0),
      position: "relative",
    },

    // Rings concentriques derrière le coffre
    ringOuter: {
      position: "absolute",
      width: n(isTiny ? 190 : isTablet ? 240 : 210),
      height: n(isTiny ? 190 : isTablet ? 240 : 210),
      borderRadius: n(999),
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.14)",
    },
    ringMiddle: {
      position: "absolute",
      width: n(isTiny ? 154 : isTablet ? 196 : 172),
      height: n(isTiny ? 154 : isTablet ? 196 : 172),
      borderRadius: n(999),
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.20)",
    },
    ringInner: {
      position: "absolute",
      width: n(isTiny ? 118 : isTablet ? 152 : 134),
      height: n(isTiny ? 118 : isTablet ? 152 : 134),
      borderRadius: n(999),
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.30)",
      backgroundColor: "rgba(255,183,0,0.045)",
    },

    chestWrap: {
      width: n(isTiny ? 130 : isTablet ? 164 : 148),
      height: n(isTiny ? 130 : isTablet ? 164 : 148),
      zIndex: 2,
    },
    chestLottie: {
      width: "100%",
      height: "100%",
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      alignItems: "center",
      paddingHorizontal: n(20),
      paddingTop: n(4),
      paddingBottom: n(16),
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: n(8),
      marginBottom: n(6),
    },
    title: {
      fontSize: n(isTiny ? 26 : isTablet ? 34 : 30),
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: -0.5,
      color: TEXT,
    },
    subtitle: {
      fontSize: n(isTiny ? 12 : 13),
      textAlign: "center",
      lineHeight: n(19),
      color: TEXT_DIM,
    },

    // Day counter — grand comme un score
    dayCounterWrap: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: n(4),
      marginBottom: n(4),
    },
    dayCounterBig: {
      fontSize: n(isTiny ? 42 : 52),
      fontWeight: "900",
      letterSpacing: -2,
      color: AMBER,
    },
    dayCounterSlash: {
      fontSize: n(isTiny ? 22 : 28),
      fontWeight: "700",
      color: TEXT_FAINT,
    },
    dayCounterTotal: {
      fontSize: n(isTiny ? 22 : 28),
      fontWeight: "700",
      color: TEXT_FAINT,
    },
    dayCounterLabel: {
      fontSize: n(11),
      fontWeight: "700",
      letterSpacing: 1.0,
      textTransform: "uppercase",
      color: TEXT_FAINT,
      marginTop: n(2),
    },

    // ── Timeline ──────────────────────────────────────────────────────────
    timelineWrap: {
      paddingHorizontal: n(isTiny ? 10 : 16),
      marginBottom: n(16),
    },
    timelineTrack: {
      height: n(3),
      borderRadius: n(999),
      backgroundColor: "rgba(255,255,255,0.08)",
      position: "absolute",
      top: n(14),
      left: n(isTiny ? 10 + 14 : 16 + 14),
      right: n(isTiny ? 10 + 14 : 16 + 14),
    },
    timelineTrackFill: {
      height: n(3),
      borderRadius: n(999),
      position: "absolute",
      top: n(14),
      left: n(isTiny ? 10 + 14 : 16 + 14),
    },
    timelineGrid: {
      flexDirection: "row",
      width: "100%",
    },
    timelineCol: {
      flex: 1,
      alignItems: "center",
    },
    // Dot normal
    dot: {
      width: n(isTiny ? 28 : 30),
      height: n(isTiny ? 28 : 30),
      borderRadius: n(999),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: n(6),
      borderWidth: 1,
    },
    // Ring externe pulsant (today only)
    dotRingActive: {
      position: "absolute",
      width: n(isTiny ? 40 : 44),
      height: n(isTiny ? 40 : 44),
      borderRadius: n(999),
      borderWidth: 1.5,
      borderColor: AMBER,
    },
    dotLabel: {
      fontSize: n(isTiny ? 9 : 9.5),
      fontWeight: "800",
      letterSpacing: 0.1,
      textAlign: "center",
    },
    dotSub: {
      fontSize: n(isTiny ? 7.5 : 8),
      fontWeight: "700",
      letterSpacing: 0.1,
      textAlign: "center",
      marginTop: n(1),
    },

    // ── Today Reward Card ─────────────────────────────────────────────────
    rewardCardWrap: {
      paddingHorizontal: n(isTiny ? 12 : 16),
      marginBottom: n(14),
    },
    rewardCard: {
      borderRadius: n(24),
      overflow: "hidden",
      borderWidth: 1,
      borderColor: STROKE,
    },
    rewardCardGradient: {
      padding: n(isTiny ? 14 : 18),
    },
    rewardCardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: n(14),
    },
    rewardIconCircle: {
      width: n(64),
      height: n(64),
      borderRadius: n(20),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,183,0,0.14)",
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.30)",
      flexShrink: 0,
    },
    rewardTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    rewardCardEyebrow: {
      fontSize: n(10),
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: AMBER,
      marginBottom: n(4),
    },
    rewardCardAmount: {
      fontSize: n(isTiny ? 18 : 22),
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.3,
      marginBottom: n(3),
    },
    rewardCardHint: {
      fontSize: n(11.5),
      color: TEXT_DIM,
      lineHeight: n(16),
    },
    rewardCardSeparator: {
      height: 1,
      backgroundColor: "rgba(255,183,0,0.14)",
      marginTop: n(14),
      marginBottom: n(12),
    },
    rewardCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rewardCardFooterText: {
      fontSize: n(11),
      color: TEXT_DIM,
      flex: 1,
    },
    claimedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: n(5),
      backgroundColor: "rgba(100,220,100,0.15)",
      borderWidth: 1,
      borderColor: "rgba(100,220,100,0.30)",
      borderRadius: n(999),
      paddingHorizontal: n(10),
      paddingVertical: n(4),
    },
    claimedBadgeText: {
      fontSize: n(11),
      fontWeight: "800",
      color: "#6DDC7A",
    },

    // ── CTA ───────────────────────────────────────────────────────────────
    ctaWrap: {
      paddingHorizontal: n(isTiny ? 12 : 16),
      marginBottom: n(4),
    },
    ctaBtn: {
      borderRadius: n(18),
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,183,0,0.35)",
      shadowColor: AMBER,
      shadowOffset: { width: 0, height: n(8) },
      shadowOpacity: 0.40,
      shadowRadius: n(20),
      elevation: 16,
    },
    ctaGradient: {
      minHeight: n(isTiny ? 52 : 58),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: n(10),
      paddingHorizontal: n(24),
    },
    ctaShimmer: {
      position: "absolute",
      width: n(100),
      height: n(200),
      backgroundColor: "rgba(255,255,255,0.22)",
      borderRadius: n(50),
      top: -n(80),
    },
    ctaText: {
      fontSize: n(isTiny ? 15 : 16),
      fontWeight: "900",
      letterSpacing: 0.2,
      color: "#05070B",
    },
    ctaLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: n(10),
    },

    // ── Bottom hint ────────────────────────────────────────────────────────
    bottomHint: {
      fontSize: n(isTiny ? 10.5 : 11),
      textAlign: "center",
      color: TEXT_FAINT,
      paddingHorizontal: n(20),
      lineHeight: n(15),
      paddingBottom: n(4),
    },
  });

// ─── Props ────────────────────────────────────────────────────────────────────
export type WelcomeBonusModalProps = {
  visible: boolean;
  onClose: () => void;
  onClaim: () => Promise<void> | void;
  currentDay: number;
  totalDays: number;
  rewardType: WelcomeRewardKind;
  rewardAmount: number;
  loading?: boolean;
};

// ─── Animated dot ring (today) ────────────────────────────────────────────────
const PulsingRing: React.FC<{ size: number }> = ({ size }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withTiming(0.9, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1.5,
    borderColor: AMBER,
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={style} pointerEvents="none" />;
};

// ─── Main Component ────────────────────────────────────────────────────────────
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
  const { width: SW, height: SH } = useWindowDimensions();

  const SCALE = useMemo(() => Math.min(Math.max(Math.min(SW, SH) / BASE_W, 0.86), 1.18), [SW, SH]);
  const IS_TINY   = SW < 350;
  const IS_TABLET = SW >= 768;

  const normalize = useMemo(() => {
    const fn = (size: number) => {
      "worklet";
      return Math.round(size * SCALE);
    };
    return fn;
  }, [SCALE]);

  const n = useMemo(() => (v: number) => Math.round(v * SCALE), [SCALE]);

  const styles = useMemo(
    () => makeStyles({ screenW: SW, isTiny: IS_TINY, isTablet: IS_TABLET, n }),
    [SW, IS_TINY, IS_TABLET, n]
  );

  const isDark = theme === "dark";
  const current: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const clampedTotal = Math.max(1, totalDays || 1);
  const dayIndex    = Math.min(Math.max(currentDay, 0), clampedTotal - 1);
  const displayDay  = dayIndex + 1;
  const progressRatio = clampedTotal <= 1 ? 1 : (displayDay - 1) / (clampedTotal - 1);

  // ── Shared values ──────────────────────────────────────────────────────────
  const cardScale   = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);
  const chestBob    = useSharedValue(0);
  const chestScale  = useSharedValue(1);
  const meshRotate  = useSharedValue(0);
  const shimmer     = useSharedValue(-1);
  const glowPulse   = useSharedValue(0);

  const [showConfetti, setShowConfetti] = useState(false);
  const [claimSuccess, setClaimSuccess]  = useState(false);

  useEffect(() => {
    if (!visible) return;
    setClaimSuccess(false);
    setShowConfetti(false);

    // Entrée cinématographique
    cardScale.value = 0.92;
    cardOpacity.value = 0;
    cardOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    cardScale.value   = withSpring(1, { damping: 16, stiffness: 200 });

    // Coffre : bob flottant
    chestBob.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0,  { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1, true
    );
    chestScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1100 }),
        withTiming(1,    { duration: 1100 })
      ),
      -1, true
    );

    // Mesh lente rotation (ambient)
    meshRotate.value = withRepeat(
      withTiming(360, { duration: 18000, easing: Easing.linear }),
      -1, false
    );

    // Shimmer CTA
    shimmer.value = -1;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 0 })
      ),
      -1, false
    );

    // Glow ambient pulsant
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400 }),
        withTiming(0.3, { duration: 2400 })
      ),
      -1, true
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const cardStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { translateY: (1 - cardScale.value) * 24 },
    ] as any,
  }));

  const chestStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: chestBob.value },
      { scale: chestScale.value },
    ] as any,
  }));

  const meshStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${meshRotate.value}deg` }] as any,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.22,
    transform: [
      { translateX: shimmer.value * normalize(160) },
      { rotateZ: "-20deg" },
    ] as any,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value * 0.18,
  }));

  // ── Icon helpers ───────────────────────────────────────────────────────────
  const getIcon = (kind: WelcomeRewardKind): keyof typeof Ionicons.glyphMap => {
    switch (kind) {
      case "premium":    return "diamond";
      case "streakPass": return "ticket";
      default:           return "trophy";
    }
  };

  // ── Labels ─────────────────────────────────────────────────────────────────
  const rewardLabel = useMemo(() => {
    switch (rewardType) {
      case "trophies":
        return t("welcomeBonus.reward.trophies", { count: rewardAmount, defaultValue: "{{count}} trophées bonus" });
      case "streakPass":
        return t("welcomeBonus.reward.streakPass", { count: rewardAmount, defaultValue: "{{count}} Streak Pass" });
      case "premium":
        return t("welcomeBonus.reward.premium", { count: rewardAmount, defaultValue: "{{count}} jours Premium" });
      default: return "";
    }
  }, [rewardType, rewardAmount, t]);

  const rewardHint = useMemo(() => {
    switch (rewardType) {
      case "premium":
        return t("welcomeBonus.premiumHint", { defaultValue: "Sans pub + toute l'expérience en illimité." });
      case "streakPass":
        return t("welcomeBonus.streakPassHint", { defaultValue: "Protège ta série si tu rates un jour." });
      default:
        return t("welcomeBonus.trophiesHint", { defaultValue: "S'accumulent dans ton profil." });
    }
  }, [rewardType, t]);

  const ctaLabel = useMemo(
    () => t("welcomeBonus.cta", { defaultValue: "Récupérer ma récompense" }),
    [t]
  );

  // ── Claim handler ──────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    chestScale.value = withSequence(
      withTiming(1.18, { duration: 110 }),
      withSpring(1, { damping: 10, stiffness: 240 })
    );

    try {
      await onClaim();
      setClaimSuccess(true);
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        setShowConfetti(false);
        setClaimSuccess(false);
        onClose();
      }, 900);
    } catch (e) {
      console.error("WelcomeBonus onClaim error:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  // ── Timeline ───────────────────────────────────────────────────────────────
  const renderTimeline = () => (
    <View style={styles.timelineWrap}>
      {/* Track */}
      <View style={styles.timelineTrack} />
      <LinearGradient
        colors={[AMBER_DIM, AMBER, AMBER_LIGHT]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.timelineTrackFill, { width: `${progressRatio * 100}%` }]}
      />

      <View style={styles.timelineGrid}>
        {Array.from({ length: clampedTotal }).map((_, idx) => {
          const isPast   = idx < dayIndex;
          const isToday  = idx === dayIndex;
          const isFuture = idx > dayIndex;
          const kind     = WELCOME_REWARDS[idx]?.type ?? "trophies";

          return (
            <View key={`tl-${idx}`} style={styles.timelineCol}>
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                {isToday && <PulsingRing size={n(IS_TINY ? 40 : 44)} />}
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isToday
                        ? AMBER
                        : isPast
                        ? "rgba(255,183,0,0.25)"
                        : "rgba(255,255,255,0.06)",
                      borderColor: isToday
                        ? "rgba(255,220,100,0.50)"
                        : isPast
                        ? "rgba(255,183,0,0.30)"
                        : STROKE_SOFT,
                    },
                  ]}
                >
                  {isPast ? (
                    <Ionicons name="checkmark" size={n(14)} color={AMBER} />
                  ) : (
                    <Ionicons
                      name={getIcon(kind)}
                      size={n(14)}
                      color={
                        isToday
                          ? "#05070B"
                          : isFuture
                          ? "rgba(255,255,255,0.35)"
                          : TEXT
                      }
                    />
                  )}
                </View>
              </View>

              <Text
                style={[styles.dotLabel, { color: isToday ? AMBER_LIGHT : TEXT_FAINT }]}
                numberOfLines={1}
              >
                {t("welcomeBonus.dayShort", { day: idx + 1, defaultValue: `J${idx + 1}` })}
              </Text>

              <Text style={[styles.dotSub, { color: TEXT_FAINT }]} numberOfLines={1}>
                {isPast
                  ? "✓"
                  : isToday
                  ? t("welcomeBonus.todayShort", { defaultValue: "Auj." })
                  : "—"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  // ── Reward Card ────────────────────────────────────────────────────────────
  const renderRewardCard = () => (
    <Animated.View
      entering={ZoomIn.springify().damping(18).mass(0.8)}
      exiting={ZoomOut.duration(140)}
      style={styles.rewardCardWrap}
    >
      <View style={styles.rewardCard}>
        <LinearGradient
          colors={["rgba(255,183,0,0.12)", "rgba(255,140,0,0.06)", "rgba(8,10,16,0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.rewardCardGradient}
        >
          {/* Shimmer sur la card */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                overflow: "hidden",
                borderRadius: n(24),
              },
            ]}
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: n(80),
                  height: n(300),
                  backgroundColor: "rgba(255,220,100,0.09)",
                  borderRadius: n(40),
                  top: -n(100),
                },
                shimmerStyle,
              ]}
            />
          </Animated.View>

          <View style={styles.rewardCardTop}>
            <View style={styles.rewardIconCircle}>
              <Ionicons name={getIcon(rewardType)} size={n(32)} color={AMBER} />
            </View>

            <View style={styles.rewardTextBlock}>
              <Text style={styles.rewardCardEyebrow} numberOfLines={1}>
                {t("welcomeBonus.todayRewardTitle", { defaultValue: "Récompense du jour" })}
              </Text>
              <Text
                style={styles.rewardCardAmount}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {rewardLabel}
              </Text>
              <Text style={styles.rewardCardHint} numberOfLines={2}>
                {rewardHint}
              </Text>
            </View>
          </View>

          <View style={styles.rewardCardSeparator} />

          <View style={styles.rewardCardFooter}>
            <Text style={styles.rewardCardFooterText} numberOfLines={1}>
              {t("welcomeBonus.dayBadge", { day: displayDay, defaultValue: "Jour {{day}}" })}
              {" · "}
              {t("welcomeBonus.totalDays", { total: clampedTotal, defaultValue: "{{total}} jours au total" })}
            </Text>

            {claimSuccess && (
              <Animated.View entering={ZoomIn.springify()} style={styles.claimedBadge}>
                <Ionicons name="checkmark-circle" size={n(13)} color="#6DDC7A" />
                <Text style={styles.claimedBadgeText}>
                  {t("welcomeBonus.claimSuccess", { defaultValue: "Ajouté !" })}
                </Text>
              </Animated.View>
            )}
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  const maxH = Math.min(
    SH - (insets.top + insets.bottom) - n(IS_TINY ? 24 : 40),
    n(IS_TABLET ? 780 : 740)
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      statusBarTranslucent
      {...(Platform.OS === "ios" ? { presentationStyle: "overFullScreen" as const } : {})}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        {Platform.OS === "ios" ? (
          <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(4,5,10,0.88)" }]} />
        )}

        {/* Ambient orbs */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.meshLayer1,
            meshStyle,
            { backgroundColor: AMBER },
          ]}
        />
        <View pointerEvents="none" style={[styles.meshLayer2, { backgroundColor: AMBER_DIM }]} />
        <View pointerEvents="none" style={[styles.meshLayer3, { backgroundColor: "#FF6B00" }]} />

        {/* Ambient glow pulsant */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            glowStyle,
            {
              backgroundColor: AMBER,
              borderRadius: n(80),
              margin: n(20),
            },
          ]}
        />

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={140}
            origin={{ x: SW / 2, y: 0 }}
            fadeOut
            fallSpeed={2400}
            explosionSpeed={620}
            colors={[AMBER, GOLD, "#FF8C00", "#FFF3B0", "#FFFFFF", "#FFD060"]}
          />
        )}

        {/* Card */}
        <View
          style={[
            styles.centerWrap,
            {
              paddingTop: Math.max(insets.top, n(12)),
              paddingBottom: Math.max(insets.bottom, n(12)),
            },
          ]}
        >
          <Animated.View
            entering={FadeInUp.duration(300).springify()}
            exiting={FadeOut.duration(200)}
            style={[styles.sheet, cardStyle, { maxHeight: maxH }]}
          >
            <View style={styles.sheetInner}>
              {/* Mesh interne */}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { borderRadius: n(32) },
                  { overflow: "hidden" },
                ]}
              >
                <View
                  style={{
                    position: "absolute",
                    width: n(500),
                    height: n(500),
                    borderRadius: n(250),
                    top: -n(220),
                    alignSelf: "center",
                    backgroundColor: AMBER,
                    opacity: 0.06,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: n(320),
                    height: n(320),
                    borderRadius: n(160),
                    bottom: -n(80),
                    right: -n(60),
                    backgroundColor: AMBER_DIM,
                    opacity: 0.05,
                  }}
                />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                bounces={false}
              >
                {/* Ribbon */}
                <Animated.View
                  entering={FadeInDown.delay(60).duration(300)}
                  style={styles.ribbonWrap}
                >
                  <View style={styles.ribbon}>
                    <Ionicons name="sparkles" size={n(11)} color={AMBER_LIGHT} />
                    <Text style={styles.ribbonText} numberOfLines={1}>
                      {t("welcomeBonus.ribbon", { defaultValue: "Pack de bienvenue ChallengeTies" })}
                    </Text>
                  </View>
                </Animated.View>

                {/* Hero — coffre + rings */}
                <Animated.View
                  entering={FadeInUp.delay(80).duration(340)}
                  style={styles.heroZone}
                >
                  <View pointerEvents="none" style={styles.ringOuter} />
                  <View pointerEvents="none" style={styles.ringMiddle} />
                  <View pointerEvents="none" style={styles.ringInner} />

                  <Animated.View style={[styles.chestWrap, chestStyle]}>
                    <LottieView
                      source={require("../assets/lotties/welcomeChest.json")}
                      autoPlay
                      loop={false}
                      style={styles.chestLottie}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </Animated.View>

                {/* Header — score day counter + titre */}
                <Animated.View
                  entering={FadeInUp.delay(140).duration(320)}
                  style={styles.header}
                >
                  {/* Grand compteur jour "42 / 7" style scoreboard */}
                  <View style={styles.dayCounterWrap}>
                    <Text style={styles.dayCounterBig}>{displayDay}</Text>
                    <Text style={styles.dayCounterSlash}>/</Text>
                    <Text style={styles.dayCounterTotal}>{clampedTotal}</Text>
                  </View>
                  <Text style={styles.dayCounterLabel}>
                    {t("welcomeBonus.dayCounterLabel", { defaultValue: "jours consécutifs" })}
                  </Text>

                  <View style={{ height: n(10) }} />

                  <Text
                    style={[styles.title, { fontFamily: current.typography.title.fontFamily }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {t("welcomeBonus.title", { defaultValue: "Pack de bienvenue" })}
                  </Text>

                  <View style={{ height: n(6) }} />

                  <Text style={[styles.subtitle, { fontFamily: current.typography.body.fontFamily }]}>
                    {t("welcomeBonus.subtitle", {
                      day: displayDay,
                      total: clampedTotal,
                      defaultValue: "Chaque connexion débloque une récompense.",
                    })}
                  </Text>
                </Animated.View>

                {/* Timeline */}
                <Animated.View entering={FadeInUp.delay(180).duration(320)}>
                  {renderTimeline()}
                </Animated.View>

                {/* Reward card */}
                {renderRewardCard()}

                {/* CTA */}
                <Animated.View
                  entering={FadeInUp.delay(240).duration(320)}
                  style={styles.ctaWrap}
                >
                  <Pressable
                    onPress={handleClaim}
                    disabled={!!loading}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !!loading, busy: !!loading }}
                    accessibilityLabel={ctaLabel}
                    style={({ pressed }) => [
                      styles.ctaBtn,
                      pressed && !loading && { transform: [{ scale: 0.985 }], opacity: 0.92 },
                      loading && { opacity: 0.80 },
                    ]}
                  >
                    <LinearGradient
                      colors={[AMBER_LIGHT, AMBER, AMBER_DIM]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ctaGradient}
                    >
                      {/* Shimmer */}
                      {!loading && (
                        <Animated.View
                          pointerEvents="none"
                          style={[styles.ctaShimmer, shimmerStyle]}
                        />
                      )}
                      {/* Top highlight */}
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            opacity: 0.18,
                            backgroundColor: "white",
                            transform: [{ translateY: -n(22) }],
                          },
                        ]}
                      />

                      {loading ? (
                        <View style={styles.ctaLoadingRow}>
                          <ActivityIndicator color="#05070B" />
                          <Text
                            style={[styles.ctaText, { fontFamily: current.typography.title.fontFamily }]}
                            numberOfLines={1}
                          >
                            {t("welcomeBonus.ctaLoading", { defaultValue: "Un instant…" })}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text
                            style={[styles.ctaText, { fontFamily: current.typography.title.fontFamily }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {ctaLabel}
                          </Text>
                          <Ionicons name="arrow-forward" size={n(18)} color="#05070B" />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Bottom hint */}
                <Animated.View entering={FadeInUp.delay(280).duration(300)}>
                  <Text style={styles.bottomHint}>
                    {t("welcomeBonus.bottomHint", { defaultValue: "Connecte-toi chaque jour pour tout débloquer." })}
                  </Text>
                </Animated.View>

                <View style={{ height: n(8) }} />
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default WelcomeBonusModal;
