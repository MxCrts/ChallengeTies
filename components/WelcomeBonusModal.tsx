// components/WelcomeBonusModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
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


export type WelcomeRewardKind = "trophies" | "streakPass" | "premium";
type WelcomeBonusReward = {
  type: WelcomeRewardKind;
  amount?: number;
  days?: number;
};

/**
 * Mapping fixe des 7 jours
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

const BASE_W = 375;

type StylesParams = {
  screenW: number;
  isTiny: boolean;
  isTablet: boolean;
  normalizeJs: (n: number) => number;
};

const makeStyles = ({ screenW, isTiny, isTablet, normalizeJs }: StylesParams) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: normalizeJs(isTiny ? 10 : 14),
      backgroundColor: "rgba(0,0,0,0.78)",
    },
    vignette: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    centerWrap: {
      flex: 1,
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    sheet: {
      width: screenW * 0.94,
      maxWidth: normalizeJs(isTablet ? 560 : 520),
      borderRadius: normalizeJs(isTiny ? 26 : 30),
      overflow: "hidden",
    } as ViewStyle,

    outerStrokeWrap: {
      borderRadius: normalizeJs(isTiny ? 26 : 30),
      overflow: "hidden",
    },

    outerStroke: {
      borderWidth: 1,
      borderRadius: normalizeJs(isTiny ? 26 : 30),
      padding: normalizeJs(2),
    },

    surface: {
      borderRadius: normalizeJs(isTiny ? 24 : 28),
      padding: normalizeJs(isTiny ? 9 : 10),
    },

    innerGlass: {
      borderRadius: normalizeJs(isTiny ? 18 : 22),
      paddingHorizontal: normalizeJs(isTiny ? 12 : 16),
      paddingTop: normalizeJs(2),
      paddingBottom: normalizeJs(2),
    },

    radial: {
      position: "absolute",
      width: normalizeJs(540),
      height: normalizeJs(540),
      borderRadius: normalizeJs(270),
      top: "10%",
      alignSelf: "center",
      transform: [{ scale: 1.05 }],
    },
    radial2: {
      position: "absolute",
      width: normalizeJs(720),
      height: normalizeJs(720),
      borderRadius: normalizeJs(360),
      bottom: "-10%",
      alignSelf: "center",
      transform: [{ scale: 1.0 }],
    },

    ctaLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: normalizeJs(10),
    },

    topRow: {
      alignItems: "center",
      marginBottom: normalizeJs(8),
    },
    pill: {
      borderRadius: normalizeJs(999),
      paddingHorizontal: normalizeJs(12),
      paddingVertical: normalizeJs(7),
      flexDirection: "row",
      alignItems: "center",
      gap: normalizeJs(6),
      borderWidth: 1,
      maxWidth: "100%",
    },
    pillText: {
      fontSize: normalizeJs(11),
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    heroWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: normalizeJs(2),
      marginBottom: normalizeJs(4),
    },
    chestWrap: {
      width: normalizeJs(isTiny ? 140 : isTablet ? 168 : 156),
      height: normalizeJs(isTiny ? 140 : isTablet ? 168 : 156),
      justifyContent: "center",
      alignItems: "center",
    },
    chestLottie: {
      width: "100%",
      height: "100%",
    },
    halo: {
      position: "absolute",
      width: normalizeJs(isTiny ? 186 : isTablet ? 220 : 204),
      height: normalizeJs(isTiny ? 186 : isTablet ? 220 : 204),
      borderRadius: normalizeJs(999),
      borderWidth: 1,
      overflow: "hidden",
      opacity: 0.92,
    },

    header: {
      alignItems: "center",
      marginBottom: normalizeJs(12),
      paddingHorizontal: normalizeJs(10),
    },
    title: {
      fontSize: normalizeJs(isTiny ? 24 : isTablet ? 30 : 27),
      textAlign: "center",
      marginBottom: normalizeJs(6),
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: normalizeJs(isTiny ? 12 : 13),
      textAlign: "center",
      lineHeight: normalizeJs(isTiny ? 17 : 18),
      opacity: 0.98,
    },

    timelineWrap: {
      marginTop: normalizeJs(2),
      marginBottom: normalizeJs(14),
      paddingHorizontal: normalizeJs(isTiny ? 8 : 12),
    },
    timelineLine: {
      height: normalizeJs(2),
      borderRadius: normalizeJs(999),
      position: "absolute",
      top: normalizeJs(18),
      left: normalizeJs(isTiny ? 4 : 6),
      right: normalizeJs(isTiny ? 4 : 6),
    },
    timelineLineFill: {
      height: normalizeJs(2),
      borderRadius: normalizeJs(999),
      position: "absolute",
      top: normalizeJs(18),
      left: normalizeJs(isTiny ? 4 : 6),
    },
    timelineGrid: {
      flexDirection: "row",
      flexWrap: "nowrap",
      width: "100%",
      alignItems: "flex-start",
    },
    timelineItem: {
      width: `${100 / 7}%` as any,
      alignItems: "center",
      paddingHorizontal: normalizeJs(2),
    },
    timelineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexWrap: "nowrap",
      width: "100%",
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    timelineDot: {
      width: normalizeJs(isTiny ? 30 : 32),
      height: normalizeJs(isTiny ? 30 : 32),
      borderRadius: normalizeJs(999),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginBottom: normalizeJs(6),
    },
    timelineLabel: {
      fontSize: normalizeJs(isTiny ? 9.5 : 10),
      fontWeight: "900",
      letterSpacing: 0.2,
      textAlign: "center",
      includeFontPadding: false,
    },
    timelineMini: {
      marginTop: normalizeJs(2),
      fontSize: normalizeJs(isTiny ? 8.5 : 9),
      fontWeight: "800",
      letterSpacing: 0.2,
      textAlign: "center",
      includeFontPadding: false,
    },

    todayCardWrapper: {
      marginTop: normalizeJs(2),
      marginBottom: normalizeJs(12),
    },
    todayCard: {
      borderRadius: normalizeJs(18),
      paddingVertical: normalizeJs(12),
      paddingHorizontal: normalizeJs(12),
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      overflow: "hidden",
      position: "relative",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: normalizeJs(8) },
      shadowOpacity: 0.28,
      shadowRadius: 20,
      elevation: 12,
    },
    todayAccentRail: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: normalizeJs(3),
      opacity: 0.95,
    },
    todayGlow: {
      ...StyleSheet.absoluteFillObject,
    },
    todayIconCircle: {
      width: normalizeJs(56),
      height: normalizeJs(56),
      borderRadius: normalizeJs(28),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginRight: normalizeJs(10),
      overflow: "hidden",
    },
    iconRing: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      borderRadius: normalizeJs(28),
      opacity: 0.45,
    },
    todayTextBlock: { flex: 1 },
    todayTitle: {
      fontSize: normalizeJs(12),
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: normalizeJs(3),
      fontWeight: "900",
    },
    todayReward: {
      fontSize: normalizeJs(16),
      fontWeight: "900",
      marginBottom: normalizeJs(4),
    },
    todayHint: {
      fontSize: normalizeJs(12),
      opacity: 0.95,
    },
    claimedNow: {
      fontWeight: "900",
      fontSize: normalizeJs(12),
    },
    dayBadge: {
      paddingHorizontal: normalizeJs(8),
      paddingVertical: normalizeJs(4),
      borderRadius: normalizeJs(999),
      borderWidth: 1,
      marginLeft: normalizeJs(6),
    },
    dayBadgeText: {
      fontSize: normalizeJs(11),
      fontWeight: "900",
      letterSpacing: 0.2,
    },

    ctaWrap: {
      marginTop: normalizeJs(10),
      marginBottom: normalizeJs(6),
    },
    ctaOuter: {
      borderRadius: normalizeJs(999),
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.34,
      shadowRadius: 22,
      elevation: 14,
    },
    ctaInner: {
      borderRadius: normalizeJs(999),
      paddingVertical: normalizeJs(isTiny ? 12 : 13),
      paddingHorizontal: normalizeJs(isTiny ? 16 : 18),
      minHeight: normalizeJs(isTiny ? 48 : 52),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    shimmer: {
      position: "absolute",
      width: normalizeJs(120),
      height: normalizeJs(220),
      backgroundColor: "white",
      top: -normalizeJs(80),
      left: "50%",
      marginLeft: -normalizeJs(60),
      borderRadius: normalizeJs(40),
    },
    ctaText: {
      fontSize: normalizeJs(isTiny ? 14 : 15),
      color: "rgba(5,7,11,0.95)",
      marginRight: normalizeJs(6),
      letterSpacing: 0.25,
      fontWeight: "950" as any,
    },
    bottomHint: {
      marginTop: normalizeJs(8),
      fontSize: normalizeJs(isTiny ? 10.5 : 11),
      textAlign: "center",
      opacity: 0.95,
      paddingHorizontal: normalizeJs(10),
      lineHeight: normalizeJs(isTiny ? 14 : 15),
    },
  });


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

    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const SCALE = useMemo(() => {
    const raw = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / BASE_W;
    return Math.min(Math.max(raw, 0.86), 1.18);
  }, [SCREEN_WIDTH, SCREEN_HEIGHT]);

  const IS_TINY = SCREEN_WIDTH < 350;
  const IS_TABLET = SCREEN_WIDTH >= 768;

  // ✅ Worklet-safe : utilisé par Reanimated (shimmerStyle) + partout ailleurs
  const normalize = useMemo(() => {
    return (size: number) => {
      "worklet";
      return Math.round(size * SCALE);
    };
  }, [SCALE]);

  // ✅ pour StyleSheet.create (JS thread)
  const normalizeJs = useMemo(() => {
    return (size: number) => Math.round(size * SCALE);
  }, [SCALE]);

  const styles = useMemo(
    () => makeStyles({ screenW: SCREEN_WIDTH, isTiny: IS_TINY, isTablet: IS_TABLET, normalizeJs }),
    [SCREEN_WIDTH, IS_TINY, IS_TABLET, normalizeJs]
  );


  const isDark = theme === "dark";
  const current: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const clampedTotal = Math.max(1, totalDays || 1);
  const dayIndex = Math.min(Math.max(currentDay, 0), clampedTotal - 1);
  const displayDay = dayIndex + 1;

  // Apple Keynote palette (monochrome + 1 accent)
  const ACCENT = current.colors.primary;
  const BG = isDark ? "#05070B" : "#070A10";
  const GLASS = "rgba(255,255,255,0.06)";
  const GLASS_STRONG = "rgba(255,255,255,0.10)";
  const STROKE = "rgba(255,255,255,0.14)";
  const STROKE_SOFT = "rgba(255,255,255,0.09)";
  const TEXT = "rgba(248,250,252,0.97)";
  const TEXT_DIM = "rgba(248,250,252,0.76)";
  const TEXT_FAINT = "rgba(248,250,252,0.54)";

  // 🔥 ANIMATIONS — Carte / coffre / halo
  const cardScale = useSharedValue(0.94);
  const cardOpacity = useSharedValue(0);
  const chestBob = useSharedValue(0);
  const chestScale = useSharedValue(1);
  const todayPulse = useSharedValue(0);
  const globalGlow = useSharedValue(0);

  // ✨ Shimmer CTA
  const shimmer = useSharedValue(-1);

  const [showConfetti, setShowConfetti] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setClaimSuccess(false);
    setShowConfetti(false);

    // entrée “cinema”
    cardScale.value = 0.94;
    cardOpacity.value = 0;
    cardOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    cardScale.value = withSpring(1, { damping: 18, stiffness: 220 });

    // bob + breathing
    chestBob.value = 0;
    chestBob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    chestScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );

    todayPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
      true
    );

    globalGlow.value = 0.25;
    globalGlow.value = withRepeat(
      withSequence(withTiming(1, { duration: 2200 }), withTiming(0.28, { duration: 2200 })),
      -1,
      true
    );

    shimmer.value = -1;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 0 })
      ),
      -1,
      false
    );

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [visible, cardScale, cardOpacity, chestBob, chestScale, todayPulse, globalGlow, shimmer]);

  const cardAnimatedStyle = useAnimatedStyle<ViewStyle>(() => {
    const lift = (1 - cardScale.value) * 20;
    return {
      opacity: cardOpacity.value,
      transform: [{ scale: cardScale.value }, { translateY: lift }] as any,
    };
  });

  const chestAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chestBob.value }, { scale: chestScale.value }] as any,
  }));

  const todayGlowStyle = useAnimatedStyle(() => {
    const scale = 1 + todayPulse.value * 0.07;
    const opacity = 0.14 + todayPulse.value * 0.18;
    return { transform: [{ scale }] as any, opacity };
  });

  const globalGlowStyle = useAnimatedStyle(() => ({
    opacity: globalGlow.value * 0.14,
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const x = shimmer.value; // -1..1
    const translateX = x * normalize(180);
    return {
      opacity: 0.18,
      transform: [{ translateX }, { rotateZ: "-18deg" }] as any,
    };
  });

  const title = useMemo(
    () => t("welcomeBonus.title", { defaultValue: "Pack de bienvenue" }),
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
    () => t("welcomeBonus.cta", { defaultValue: "Récupérer ma récompense" }),
    [t]
  );

  const getIconForKind = (kind: WelcomeRewardKind): keyof typeof Ionicons.glyphMap => {
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

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch {}

    chestScale.value = withSequence(
      withTiming(1.12, { duration: 120 }),
      withSpring(1, { damping: 12, stiffness: 220 })
    );

    try {
      await onClaim();

      setClaimSuccess(true);
      setShowConfetti(true);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}

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

  const progressRatio = clampedTotal <= 1 ? 1 : (displayDay - 1) / (clampedTotal - 1);

  const renderTimeline = () => {
    // ✅ 7 jours FIXES → flex:1 (plus jamais de “J7 coupé”)
    return (
      <View style={styles.timelineWrap}>
        <View style={[styles.timelineLine, { backgroundColor: "rgba(255,255,255,0.10)" }]} />
        <View
          style={[
            styles.timelineLineFill,
            { width: `${progressRatio * 100}%`, backgroundColor: ACCENT },
          ]}
        />

        <View style={styles.timelineGrid}>
          {Array.from({ length: clampedTotal }).map((_, idx) => {
            const isPast = idx < dayIndex;
            const isToday = idx === dayIndex;
            const isFuture = idx > dayIndex;

            const config = WELCOME_REWARDS[idx];
            const kind: WelcomeRewardKind = config?.type ?? "trophies";
            const icon = getIconForKind(kind);

            const dotBg = isToday
              ? ACCENT
              : isPast
              ? "rgba(255,255,255,0.20)"
              : "rgba(255,255,255,0.08)";

            const dotStroke = isToday ? "rgba(0,0,0,0.18)" : STROKE_SOFT;

            const iconColor = isToday
              ? "rgba(5,7,11,0.92)"
              : isPast
              ? "rgba(248,250,252,0.90)"
              : "rgba(248,250,252,0.58)";

            return (
              <View key={`tl-${idx}`} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: dotBg, borderColor: dotStroke },
                  ]}
                >
                  <Ionicons name={icon} size={normalize(16)} color={iconColor} />
                </View>

                <Text
                  style={[styles.timelineLabel, { color: isToday ? TEXT : TEXT_FAINT }]}
                  numberOfLines={1}
                >
                  {t("welcomeBonus.dayShort", {
                    day: idx + 1,
                    defaultValue: `J${idx + 1}`,
                  })}
                </Text>

                {isPast && (
                  <Text style={[styles.timelineMini, { color: TEXT_FAINT }]} numberOfLines={1}>
                    {t("welcomeBonus.claimedShort", { defaultValue: "OK" })}
                  </Text>
                )}
                {isFuture && (
                  <Text style={[styles.timelineMini, { color: TEXT_FAINT }]} numberOfLines={1}>
                    {t("welcomeBonus.lockedShort", { defaultValue: "—" })}
                  </Text>
                )}
                {isToday && (
                  <Text style={[styles.timelineMini, { color: TEXT_DIM }]} numberOfLines={1}>
                    {t("welcomeBonus.todayShort", { defaultValue: "Aujourd’hui" })}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

 const maxCardHeight = Math.min(
  SCREEN_HEIGHT - (insets.top + insets.bottom) - normalize(IS_TINY ? 28 : 44),
  normalize(IS_TABLET ? 760 : 720)
);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // ✅ tu veux “obliger” → pas de fermeture via back/outside
      onRequestClose={() => {}}
      statusBarTranslucent
      {...(Platform.OS === "ios" ? { presentationStyle: "overFullScreen" as const } : {})}
    >
      <View style={styles.overlay}>
        {/* Backdrop premium */}
        {Platform.OS === "ios" ? (
          <BlurView intensity={64} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.70)" }]} />
        )}

        {/* Radial glow layers (Keynote vibe) */}
        <View pointerEvents="none" style={styles.vignette} />
        <View pointerEvents="none" style={[styles.radial, { opacity: 0.18, backgroundColor: ACCENT }]} />
        <View pointerEvents="none" style={[styles.radial2, { opacity: 0.10, backgroundColor: ACCENT }]} />

        {/* Confetti au claim */}
        {showConfetti && (
          <ConfettiCannon
            count={110}
            origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
            fadeOut
            fallSpeed={2700}
            explosionSpeed={560}
          />
        )}

        {/* Ambient glow */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            globalGlowStyle,
            {
              backgroundColor: ACCENT,
              borderRadius: normalize(64),
              marginHorizontal: normalize(10),
              marginTop: normalize(24),
              marginBottom: normalize(24),
            },
          ]}
          pointerEvents="none"
        />
<View
  style={[
    styles.centerWrap,
    {
      paddingTop: Math.max(insets.top, normalize(10)),
      paddingBottom: Math.max(insets.bottom, normalize(10)),
    },
  ]}
>
        <Animated.View
          entering={FadeInUp.duration(260)}
          exiting={FadeOut.duration(180)}
          style={[
  styles.sheet,
  cardAnimatedStyle,
  {
    maxHeight: maxCardHeight,
    // ✅ vrai centrage vertical
    marginTop: 0,
    marginBottom: 0,
  },
]}

        >
          <View style={styles.outerStrokeWrap}>
            <View style={[styles.outerStroke, { borderColor: STROKE }]}>
              <View style={[styles.surface, { backgroundColor: BG }]}>
                <View style={[styles.innerGlass, { backgroundColor: "rgba(255,255,255,0.035)" }]}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
  styles.scrollContent,
  {
    paddingBottom: normalize(IS_TINY ? 12 : 14),
    paddingTop: normalize(IS_TINY ? 10 : 12),
  },
]}

                    bounces={false}
                  >
                    {/* Ribbon */}
                    <View style={styles.topRow}>
                      <View style={[styles.pill, { borderColor: STROKE_SOFT, backgroundColor: GLASS }]}>
                        <Ionicons name="sparkles-outline" size={normalize(14)} color={TEXT_DIM} />
                        <Text style={[styles.pillText, { color: TEXT_DIM }]} numberOfLines={1}>
                          {t("welcomeBonus.ribbon", { defaultValue: "Pack de bienvenue ChallengeTies" })}
                        </Text>
                      </View>
                    </View>

                    {/* Hero */}
                    <View style={styles.heroWrap}>
                      <Animated.View style={[styles.chestWrap, chestAnimatedStyle]}>
                        <LottieView
                          source={require("../assets/lotties/welcomeChest.json")}
                          autoPlay
                          loop={false}
                          style={styles.chestLottie}
                          resizeMode="contain"
                        />
                      </Animated.View>

                      <View pointerEvents="none" style={[styles.halo, { borderColor: STROKE_SOFT }]}>
                        <View
                          style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: ACCENT, opacity: 0.10 },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                      <Text
                        style={[
                          styles.title,
                          { color: TEXT, fontFamily: current.typography.title.fontFamily },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {title}
                      </Text>

                      <Text
                        style={[
                          styles.subtitle,
                          { color: TEXT_DIM, fontFamily: current.typography.body.fontFamily },
                        ]}
                      >
                        {subtitle}
                      </Text>
                    </View>

                    {/* Timeline */}
                    {renderTimeline()}

                    {/* Today reward */}
                    <Animated.View
                      entering={ZoomIn.springify().damping(20)}
                      exiting={ZoomOut.duration(140)}
                      style={styles.todayCardWrapper}
                    >
                      <View style={[styles.todayCard, { backgroundColor: GLASS_STRONG, borderColor: STROKE }]}>
                        {/* Accent rail */}
                        <View style={[styles.todayAccentRail, { backgroundColor: ACCENT }]} />

                        <Animated.View style={[styles.todayGlow, todayGlowStyle]} pointerEvents="none">
                          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: ACCENT, opacity: 0.10 }]} />
                        </Animated.View>

                        <View
                          style={[
                            styles.todayIconCircle,
                            {
                              borderColor: "rgba(255,255,255,0.14)",
                              backgroundColor: `${ACCENT}22`,
                            },
                          ]}
                        >
                          {/* tiny accent ring */}
                          <View pointerEvents="none" style={[styles.iconRing, { borderColor: ACCENT }]} />
                          <Ionicons name={baseRewardIcon} size={normalize(30)} color={ACCENT} />
                        </View>

                        <View style={styles.todayTextBlock}>
                          <Text style={[styles.todayTitle, { color: ACCENT }]} numberOfLines={1}>
                            {t("welcomeBonus.todayRewardTitle", { defaultValue: "Récompense du jour" })}
                          </Text>

                          <Text
                            style={[styles.todayReward, { color: TEXT }]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                          >
                            {rewardLabel}
                          </Text>

                          {claimSuccess && (
                            <Animated.View entering={FadeInUp.duration(220)} style={{ marginTop: normalize(6) }}>
                              <Text style={[styles.claimedNow, { color: TEXT_DIM }]} numberOfLines={1}>
                                {t("welcomeBonus.claimSuccess", { defaultValue: "Ajouté ✅" })}
                              </Text>
                            </Animated.View>
                          )}

                          {rewardType === "premium" && (
                            <Text style={[styles.todayHint, { color: TEXT_FAINT }]} numberOfLines={2}>
                              {t("welcomeBonus.premiumHint", {
                                defaultValue: "Aucune publicité + toute l’expérience ChallengeTies en illimité.",
                              })}
                            </Text>
                          )}
                        </View>

                        <View style={[styles.dayBadge, { borderColor: "rgba(255,255,255,0.14)", backgroundColor: `${ACCENT}14` }]}>
                          <Text style={[styles.dayBadgeText, { color: TEXT }]} numberOfLines={1}>
                            {t("welcomeBonus.dayBadge", { day: displayDay, defaultValue: "Jour {{day}}" })}
                          </Text>
                        </View>
                      </View>
                    </Animated.View>

                    {/* CTA */}
<Animated.View style={styles.ctaWrap} entering={FadeInUp.duration(220)}>
  <Pressable
    onPress={handleClaimPress}
    disabled={!!loading}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!loading, busy: !!loading }}
    accessibilityLabel={ctaLabel}
    accessibilityHint={t("welcomeBonus.ctaHint", {
      defaultValue: "Récupère la récompense du jour.",
    })}
    style={({ pressed }) => [
      styles.ctaOuter,
      { borderColor: "rgba(255,255,255,0.16)" },
      pressed && !loading && { transform: [{ scale: 0.992 }] },
      loading && { opacity: 0.85 },
    ]}
  >
    <View style={[styles.ctaInner, { backgroundColor: ACCENT }]}>
      {/* shimmer */}
      {!loading && (
        <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} />
      )}

      {/* top highlight */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: 0.16,
            backgroundColor: "white",
            transform: [{ translateY: -normalize(16) }],
          },
        ]}
      />

      {loading ? (
        <View style={styles.ctaLoadingRow}>
          <ActivityIndicator />
          <Text
            style={[
              styles.ctaText,
              { fontFamily: current.typography.title.fontFamily },
            ]}
            numberOfLines={1}
          >
            {t("welcomeBonus.ctaLoading", { defaultValue: "Un instant…" })}
          </Text>
        </View>
      ) : (
        <>
          <Text
            style={[
              styles.ctaText,
              { fontFamily: current.typography.title.fontFamily },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {ctaLabel}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={normalize(18)}
            color="rgba(5,7,11,0.92)"
          />
        </>
      )}
    </View>
  </Pressable>
</Animated.View>


                    {/* Bottom hint */}
                    <Text style={[styles.bottomHint, { color: TEXT_FAINT }]}>{bottomHint}</Text>

                    <View style={{ height: normalize(6) }} />
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
        </View>
      </View>
    </Modal>
  );
};



export default WelcomeBonusModal;
