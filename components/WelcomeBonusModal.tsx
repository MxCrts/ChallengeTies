// components/WelcomeBonusModal.tsx
import React, { useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
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
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  // Gradients principaux : board + contour
  const gradBg = useMemo<[string, string, string]>(
    () =>
      isDark
        ? ["#020617", "#020617", "#020617"]
        : ["#0F172A", "#020617", "#020617"],
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

  // 🔥 mapping propre type -> icône
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

  // Pulse sur la carte du jour
  const pulseSV = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    pulseSV.value = 0;
    pulseSV.value = withRepeat(
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
  }, [visible, pulseSV]);

  const todayGlowStyle = useAnimatedStyle(() => {
    const scale = 1 + pulseSV.value * 0.06;
    const opacity = 0.55 + pulseSV.value * 0.3;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  if (!visible) return null;

  const handleClaimPress = async () => {
    if (loading) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {}
      );
    } catch {}

    try {
      await onClaim();
      onClose();
    } catch (e) {
      console.error("WelcomeBonus onClaim error:", e);
    }
  };

  // Disposition des tuiles de jours
  const columns = clampedTotal <= 3 ? clampedTotal : 4;
  const dayTileWidth =
    columns === 1
      ? "100%"
      : columns === 2
      ? "46%"
      : columns === 3
      ? "30%"
      : "22%";

  // Progression (barre + pastilles)
  const progressRatio = (displayDay - 1) / (clampedTotal - 1 || 1);

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
        <Animated.View
          entering={FadeInUp.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.modalContainer}
        >
          <LinearGradient colors={gradBorder} style={styles.borderWrap}>
            <LinearGradient colors={gradBg} style={styles.modalBackground}>
              <LinearGradient colors={gradBoard} style={styles.boardInner}>
                {/* Badge / ruban top */}
                <View style={styles.ribbonWrapper}>
                  <LinearGradient
                    colors={["rgba(251,191,36,1)", "rgba(245,158,11,1)"]}
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

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={baseRewardIcon}
                      size={normalize(40)}
                      color="#FFE082"
                    />
                  </View>

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

                {/* 🔥 Carte récompense du jour ULTRA FLASHY (fond clair) */}
                <Animated.View
                  entering={ZoomIn.springify().damping(20)}
                  exiting={ZoomOut.duration(140)}
                  style={styles.todayCardWrapper}
                >
                  <LinearGradient
                    colors={["#FFEDD5", "#FED7AA", "#FDBA74"]}
                    style={styles.todayCard}
                  >
                    <Animated.View
                      style={[styles.todayGlow, todayGlowStyle]}
                    />
                    <View style={styles.todayIconCircle}>
                      <Ionicons
                        name={baseRewardIcon}
                        size={normalize(34)}
                        color="#1F2937"
                      />
                    </View>
                    <View style={styles.todayTextBlock}>
                      <Text
                        style={[
                          styles.todayTitle,
                          { color: "#7C2D12" },
                        ]}
                      >
                        {t("welcomeBonus.todayRewardTitle", {
                          defaultValue: "Récompense du jour",
                        })}
                      </Text>
                      <Text
                        style={[
                          styles.todayReward,
                          { color: "#1F2937" },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {rewardLabel}
                      </Text>
                      {rewardType === "premium" && (
                        <Text
                          style={[
                            styles.todayHint,
                            { color: "#4B5563" },
                          ]}
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

                {/* Grille des jours façon “tableau de loot” */}
                {/* Grille des jours façon “tableau de loot” */}
<View style={styles.gridWrapper}>
  {Array.from({ length: clampedTotal }).map((_, idx) => {
    const isPast = idx < dayIndex;
    const isToday = idx === dayIndex;
    const isFuture = idx > dayIndex;

    // 🔥 type de récompense réel du jour basé sur WELCOME_REWARDS
    const config = WELCOME_REWARDS[idx];
    const dayKind: WelcomeRewardKind = config?.type ?? "trophies";
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

    const overlayBadgeIcon: keyof typeof Ionicons.glyphMap | null = isPast
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
            {/* ✅ plus de texte "Bientôt" pour les jours futurs */}
          </View>
        </LinearGradient>
      </View>
    );
  })}
</View>


                {/* CTA principal */}
                <TouchableOpacity
                  style={[styles.ctaButton, loading && { opacity: 0.7 }]}
                  activeOpacity={0.9}
                  onPress={handleClaimPress}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={ctaLabel}
                >
                  <LinearGradient
                    colors={[current.colors.secondary, current.colors.primary]}
                    style={styles.ctaInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
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
                </TouchableOpacity>

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
  },
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
    paddingVertical: normalize(18),
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
  header: {
    alignItems: "center",
    marginBottom: normalize(12),
  },
  iconCircle: {
    width: normalize(64),
    height: normalize(64),
    borderRadius: normalize(32),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(8),
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.18)",
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
    marginTop: normalize(6),
    marginBottom: normalize(12),
  },
  todayCard: {
    borderRadius: normalize(20),
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  todayGlow: {
    position: "absolute",
    top: -normalize(40),
    bottom: -normalize(40),
    left: -normalize(60),
    right: -normalize(60),
    backgroundColor: "rgba(251,146,60,0.35)",
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
  dayStatusToday: {
    fontSize: normalize(10),
    color: "#FEF9C3",
    marginTop: normalize(2),
  },
  dayStatusFuture: {
    fontSize: normalize(10),
    color: "#E5E7EB",
    marginTop: normalize(2),
    opacity: 0.85,
  },
  ctaButton: {
    marginTop: normalize(10),
    marginBottom: normalize(4),
  },
  ctaInner: {
    borderRadius: normalize(999),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(18),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
