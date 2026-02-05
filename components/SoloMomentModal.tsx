// components/SoloMomentModal.tsx
import React, { useEffect, useState } from "react";
import {
  Modal,
  Text,
  Pressable,
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  withSpring,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  onClose: () => void;

  dayIndex: number;   // 1..totalDays
  totalDays: number;  // selectedDays / total challenge days
  streak?: number;    // optional

  // daily = sobre / milestone = plus wow
  variant?: "daily" | "milestone";
};

// ✅ match Tips typography
const FONT_REG = "Comfortaa_400Regular";
const FONT_BOLD = "Comfortaa_700Bold";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function SoloMomentModal(props: Props) {
  const { visible, onClose, dayIndex, totalDays, streak, variant = "daily" } = props;

  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const CARD_MAX = width >= 768 ? 520 : 480;
  const CARD_W = Math.min(width * 0.92, CARD_MAX);
  const HALO_SIZE = Math.round(Math.min(width * 0.92, 520));
  const SAFE_MAX_H = Math.round(height * 0.86);

  const pct = clamp01(totalDays ? dayIndex / totalDays : 0);

  // ✅ message pool i18n (lock on open)
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!visible) {
      setMsg("");
      return;
    }

    const pool = t("soloMoment.pool", { returnObjects: true });
    if (!Array.isArray(pool) || pool.length === 0) {
      setMsg(String(t("soloMoment.fallback") || "").trim());
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)] ?? "";
    setMsg(
      String(picked)
        .replaceAll("{{day}}", String(dayIndex))
        .replaceAll("{{total}}", String(totalDays))
        .replaceAll("{{streak}}", String(streak ?? 0))
        .trim()
    );
  }, [visible, dayIndex, totalDays, streak, t]);

  // 🎬 animations (Duo-like)
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const bar = useSharedValue(0);
  const halo = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  // ✅ reset when closing (important)
  useEffect(() => {
    if (visible) return;

    cardScale.value = 0.9;
    cardOpacity.value = 0;
    bar.value = 0;
    halo.value = 0;
  glowPulse.value = 0;
  }, [visible, cardScale, cardOpacity, bar, halo, glowPulse]);

  useEffect(() => {
    if (!visible) return;

    cardScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    cardOpacity.value = withTiming(1, { duration: 220 });

    bar.value = withTiming(pct, {
      duration: 820,
      easing: Easing.out(Easing.cubic),
    });

    halo.value = withTiming(1, { duration: 900 });
    glowPulse.value = withTiming(1, {
      duration: 950,
      easing: Easing.out(Easing.quad),
    });

    if (Platform.OS !== "web") {
      variant === "milestone"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
 }, [visible, pct, variant, cardScale, cardOpacity, bar, halo, glowPulse]);

  const cardAnim = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const haloAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: 0.18 * halo.value,
    transform: [{ scale: 0.9 + halo.value * 0.2 }],
  }));

  const barAnim = useAnimatedStyle<ViewStyle>(() => ({
    width: `${bar.value * 100}%`,
  }));

  // subtle premium glow behind progress (Solo signature)
  const glowAnim = useAnimatedStyle<ViewStyle>(() => {
    const o = interpolate(glowPulse.value, [0, 1], [0, 1]);
    const sx = interpolate(glowPulse.value, [0, 1], [0.98, 1]);
    return {
      opacity: 0.26 * o,
      transform: [{ scaleX: sx }] as ViewStyle["transform"],
    };
  });

  // ✅ TS SAFE tuples
  const glowColors =
    variant === "milestone"
      ? (["#FBBF24", "#FB923C"] as const) // gold / orange
      : (["#38BDF8", "#A78BFA"] as const); // sky / violet

  const fillColors =
    variant === "milestone"
      ? (["#FBBF24", "#FB923C"] as const)
      : (["#38BDF8", "#A78BFA"] as const);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.root}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("soloMoment.a11y.closeBackdrop")}
      >
        <LinearGradient
          colors={["#020617", "#000000"] as const}
          style={StyleSheet.absoluteFill}
        />

        {/* halo */}
       <Animated.View
          pointerEvents="none"
          style={[styles.halo, { width: HALO_SIZE, height: HALO_SIZE }, haloAnim]}
        >
          <LinearGradient colors={glowColors} style={styles.haloGrad} />
        </Animated.View>

        <Animated.View
          style={[styles.card, cardAnim, { width: CARD_W, maxHeight: SAFE_MAX_H }]}
          onStartShouldSetResponder={() => true}
        >
          {/* glass highlight */}
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.05)"] as const}
            style={styles.glass}
          />

          {/* top row */}
          <View style={styles.topRow}>
            <View style={styles.badgeWrap}>
              <LinearGradient
                colors={fillColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Ionicons name="checkmark" size={14} color="#0B0D12" />
                <Text style={styles.badgeText}>{t("soloMoment.badge")}</Text>
              </LinearGradient>
              {/* micro pill (Solo-only, premium progress cue) */}
              <View style={styles.microPill}>
                <Ionicons
                  name={variant === "milestone" ? "sparkles" : "calendar"}
                  size={14}
                  color="#0B0D12"
                />
                <Text style={styles.microPillText}>
                  {t("soloMoment.progress", { day: dayIndex, total: totalDays })}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={14}
              style={styles.xBtn}
              accessibilityRole="button"
              accessibilityLabel={t("soloMoment.a11y.closeButton")}
            >
              <Ionicons name="close" size={18} color="#020617" />
            </Pressable>
          </View>

          <Text style={styles.kicker}>{t("soloMoment.kicker")}</Text>

          <Text style={[styles.title, { fontSize: isSmall ? 19 : 24 }]} numberOfLines={3}>
            {msg}
          </Text>

          <Text style={styles.subtitle}>
            {variant === "milestone"
              ? t("soloMoment.subtitleMilestone")
              : t("soloMoment.subtitle")}
          </Text>

          <View style={styles.progressCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>
                {t("soloMoment.progress", { day: dayIndex, total: totalDays })}
              </Text>

              {typeof streak === "number" ? (
                <View style={styles.streakPill}>
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text style={styles.streakText}>
                    {t("soloMoment.streak", { streak })}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.track}>
                {/* subtle glow behind bar */}
              <Animated.View style={[styles.trackGlow, glowAnim]}>
                <LinearGradient
                  colors={
                    variant === "milestone"
                      ? (["rgba(251,191,36,0.30)", "rgba(251,146,60,0.06)"] as const)
                      : (["rgba(56,189,248,0.26)", "rgba(167,139,250,0.06)"] as const)
                  }
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
              <Animated.View style={[styles.fill, barAnim]}>
                <LinearGradient colors={fillColors} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>

            <Text style={styles.numbers}>
              {dayIndex}/{totalDays} • {Math.round(pct * 100)}%
            </Text>
          </View>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("soloMoment.a11y.cta")}
          >
            <Text style={styles.closeText}>{t("soloMoment.cta")}</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  halo: {
    position: "absolute",
    borderRadius: 999,
  },
  haloGrad: { flex: 1, borderRadius: 999 },
  card: {
     borderRadius: 30,
    padding: 26,
    backgroundColor: "rgba(255,255,255,0.97)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
microPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    marginLeft: 10,
    flexShrink: 1,
  },
  microPillText: {
    fontSize: 12,
    fontFamily: FONT_BOLD,
    color: "#020617",
    opacity: 0.85,
    flexShrink: 1,
  },
  glass: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  badgeWrap: { flexDirection: "row", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeText: {
    color: "#0B0D12",
    fontSize: 12,
    fontFamily: FONT_BOLD,
    letterSpacing: 0.2,
  },

  xBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  kicker: {
    fontSize: 12,
    fontFamily: FONT_BOLD,
    letterSpacing: 1.4,
    opacity: 0.55,
    marginBottom: 6,
  },
title: { fontFamily: FONT_BOLD, marginBottom: 10, color: "#020617" },
  subtitle: {
    fontSize: 14,
    opacity: 0.65,
    fontFamily: FONT_REG,
    marginBottom: 18,
    color: "#020617",
  },
  progressCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(15,23,42,0.04)",
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
label: { fontSize: 14, fontFamily: FONT_BOLD, opacity: 0.85, color: "#020617" },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  streakText: { fontSize: 12,  fontFamily: FONT_BOLD, opacity: 0.85, color: "#020617" },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    position: "relative",
  },
  trackGlow: {
    position: "absolute",
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
    borderRadius: 999,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  numbers: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.75,
    fontFamily: FONT_REG,
    color: "#020617",
  },
  closeBtn: {
    marginTop: 10,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#020617",
    minHeight: 48,
    justifyContent: "center",
  },
  closeText: { color: "white",  fontFamily: FONT_BOLD, fontSize: 15 },
});
