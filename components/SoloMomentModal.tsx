// components/SoloMomentModal.tsx
// TOP 1 MONDIAL — texte identitaire émotionnel + nudge duo contextuel

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

  dayIndex: number;
  totalDays: number;
  streak?: number;
  variant?: "daily" | "milestone";

  // Nudge duo — affiché après le marquage pour pousser l'invitation
  onInviteDuo?: () => void;
  challengeTitle?: string;
};

const FONT_REG = "Comfortaa_400Regular";
const FONT_BOLD = "Comfortaa_700Bold";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ─── Identité contextuelle selon le jour ─────────────────────────────────────
// La clé du top 1 : on ne dit pas "Jour 4/30"
// On dit "Tu deviens quelqu'un de constant."
function getIdentityKey(dayIndex: number, totalDays: number): string {
  const pct = totalDays > 0 ? dayIndex / totalDays : 0;
  if (dayIndex === 1) return "soloMoment.identity.day1";
  if (dayIndex === 2) return "soloMoment.identity.day2";
  if (dayIndex === 3) return "soloMoment.identity.day3";
  if (dayIndex === 7) return "soloMoment.identity.day7";
  if (dayIndex === 14) return "soloMoment.identity.day14";
  if (dayIndex === 21) return "soloMoment.identity.day21";
  if (dayIndex === totalDays) return "soloMoment.identity.last";
  if (pct <= 0.25) return "soloMoment.identity.early";
  if (pct <= 0.5) return "soloMoment.identity.mid";
  if (pct <= 0.75) return "soloMoment.identity.late";
  return "soloMoment.identity.final";
}

export default function SoloMomentModal(props: Props) {
  const { visible, onClose, dayIndex, totalDays, streak, variant = "daily", onInviteDuo } = props;

  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const CARD_W = Math.min(width * 0.92, width >= 768 ? 520 : 480);
  const HALO_SIZE = Math.round(Math.min(width * 0.92, 520));
  const SAFE_MAX_H = Math.round(height * 0.86);

  const pct = clamp01(totalDays ? dayIndex / totalDays : 0);
  const isMilestone = variant === "milestone";

  // Texte identitaire contextuel (le vrai différenciateur vs stats froides)
  const identityText = t(getIdentityKey(dayIndex, totalDays), {
    day: dayIndex,
    total: totalDays,
    streak: streak ?? 0,
    defaultValue: t("soloMoment.identity.default", {
      defaultValue: "Tu deviens quelqu'un de constant.",
    }),
  });

  // ─── Message pool (aléatoire, locké à l'ouverture) ───────────────────
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!visible) { setMsg(""); return; }

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

  // ─── Animations ───────────────────────────────────────────────────────
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const bar = useSharedValue(0);
  const halo = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const duoNudgeV = useSharedValue(0);

  useEffect(() => {
    if (visible) return;
    cardScale.value = 0.9;
    cardOpacity.value = 0;
    bar.value = 0;
    halo.value = 0;
    glowPulse.value = 0;
    duoNudgeV.value = 0;
  }, [visible, cardScale, cardOpacity, bar, halo, glowPulse, duoNudgeV]);

  useEffect(() => {
    if (!visible) return;
    cardScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    cardOpacity.value = withTiming(1, { duration: 220 });
    bar.value = withTiming(pct, { duration: 820, easing: Easing.out(Easing.cubic) });
    halo.value = withTiming(1, { duration: 900 });
    glowPulse.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });

    if (onInviteDuo) {
      setTimeout(() => {
        duoNudgeV.value = withSpring(1, { damping: 14, stiffness: 160 });
      }, 500);
    }

    if (Platform.OS !== "web") {
      variant === "milestone"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [visible, pct, variant, cardScale, cardOpacity, bar, halo, glowPulse, duoNudgeV, onInviteDuo]);

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
  const glowAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: 0.26 * interpolate(glowPulse.value, [0, 1], [0, 1]),
    transform: [{ scaleX: interpolate(glowPulse.value, [0, 1], [0.98, 1]) }] as ViewStyle["transform"],
  }));

  const duoNudgeStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: duoNudgeV.value,
    transform: [{ translateY: (1 - duoNudgeV.value) * 8 }] as ViewStyle["transform"],
  }));

  // ✅ TS SAFE tuples
  const glowColors =
    variant === "milestone"
      ? (["#FBBF24", "#FB923C"] as const)
      : (["#F97316", "#FB923C"] as const); // orange brand (cohérence ChallengeTies)

  const fillColors =
    variant === "milestone"
      ? (["#FBBF24", "#FB923C"] as const)
      : (["#F97316", "#FB923C"] as const);

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
        accessibilityLabel={t("soloMoment.a11y.closeBackdrop", { defaultValue: "Fermer" })}
      >
        <LinearGradient colors={["#020617", "#000000"] as const} style={StyleSheet.absoluteFill} />

        <Animated.View pointerEvents="none"
          style={[styles.halo, { width: HALO_SIZE, height: HALO_SIZE }, haloAnim]}
        >
          <LinearGradient colors={glowColors} style={styles.haloGrad} />
        </Animated.View>

        <Animated.View
          style={[styles.card, cardAnim, { width: CARD_W, maxHeight: SAFE_MAX_H }]}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.05)"] as const}
            style={styles.glass}
          />

          {/* ── Top row ── */}
          <View style={styles.topRow}>
            <View style={styles.badgeWrap}>
              <LinearGradient
                colors={fillColors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Ionicons name="checkmark" size={14} color="#0B0D12" />
                <Text style={styles.badgeText}>
                  {t("soloMoment.badge", { defaultValue: "CHECK ✓" })}
                </Text>
              </LinearGradient>

              <View style={styles.microPill}>
                <Ionicons
                  name={isMilestone ? "sparkles" : "flame"}
                  size={14}
                  color="#F97316"
                />
                <Text style={styles.microPillText}>
                  {t("soloMoment.progress", {
                    day: dayIndex,
                    total: totalDays,
                    defaultValue: `Jour {{day}}/${totalDays}`,
                  })}
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} hitSlop={14} style={styles.xBtn}
              accessibilityRole="button"
              accessibilityLabel={t("soloMoment.a11y.closeButton", { defaultValue: "Fermer" })}
            >
              <Ionicons name="close" size={18} color="#020617" />
            </Pressable>
          </View>

          {/* ── Kicker ── */}
          <Text style={styles.kicker}>
            {t("soloMoment.kicker", { defaultValue: "MOMENT SOLO" })}
          </Text>

          {/* ── Message pool (aléatoire) ── */}
          <Text style={[styles.title, { fontSize: isSmall ? 19 : 24 }]} numberOfLines={3}>
            {msg}
          </Text>

          {/* ── IDENTITÉ — la vraie valeur ajoutée ── */}
          <View style={styles.identityRow}>
            <View style={styles.identityAccent} />
            <Text style={styles.identityText}>{identityText}</Text>
          </View>

          {/* ── Progress card ── */}
          <View style={styles.progressCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>
                {t("soloMoment.progressLabel", {
                  day: dayIndex,
                  total: totalDays,
                  defaultValue: `{{day}} / {{total}} jours`,
                })}
              </Text>
              {typeof streak === "number" && streak > 0 && (
                <View style={styles.streakPill}>
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text style={styles.streakText}>
                    {t("soloMoment.streak", {
                      streak,
                      defaultValue: `{{streak}} 🔥`,
                    })}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.track}>
              <Animated.View style={[styles.trackGlow, glowAnim]}>
                <LinearGradient
                  colors={["rgba(249,115,22,0.30)", "rgba(251,146,60,0.06)"] as const}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
              <Animated.View style={[styles.fill, barAnim]}>
                <LinearGradient colors={fillColors} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>

            <Text style={styles.numbers}>
              {Math.round(pct * 100)}% {t("soloMoment.complete", { defaultValue: "accompli" })}
            </Text>
          </View>

          {/* ── NUDGE DUO — apparaît avec délai ── */}
          {!!onInviteDuo && (
            <Animated.View style={[styles.duoNudge, duoNudgeStyle]}>
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                  onClose();
                  setTimeout(() => onInviteDuo(), 280);
                }}
                style={({ pressed }) => [
                  styles.duoNudgeInner,
                  { opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["rgba(99,102,241,0.10)", "rgba(99,102,241,0.06)"] as const}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.duoNudgeGrad}
                >
                  <View style={styles.duoNudgeLeft}>
                    <View style={styles.duoNudgeIconWrap}>
                      <Ionicons name="people" size={18} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.duoNudgeTitle}>
                        {t("soloMoment.duoNudge.title", {
                          defaultValue: "Avec un partenaire, tu tiens 2x plus.",
                        })}
                      </Text>
                      <Text style={styles.duoNudgeSub}>
                        {t("soloMoment.duoNudge.sub", {
                          defaultValue: "Invite quelqu'un maintenant →",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(99,102,241,0.60)" />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {/* ── CTA principal ── */}
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("soloMoment.a11y.cta", { defaultValue: "Continuer" })}
          >
            <Text style={styles.closeText}>
              {t("soloMoment.cta", { defaultValue: "Continuer" })}
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16,
  },
  halo: { position: "absolute", borderRadius: 999 },
  haloGrad: { flex: 1, borderRadius: 999 },
  card: {
    borderRadius: 30, padding: 26,
    backgroundColor: "rgba(255,255,255,0.97)",
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 }, elevation: 12,
  },
  glass: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  topRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  badgeWrap: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
  },
  badgeText: { color: "#0B0D12", fontSize: 12, fontFamily: FONT_BOLD, letterSpacing: 0.2 },
  microPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.08)", flexShrink: 1,
  },
  microPillText: { fontSize: 12, fontFamily: FONT_BOLD, color: "#F97316", opacity: 0.9 },
  xBtn: {
    width: 36, height: 36, borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  kicker: {
    fontSize: 12, fontFamily: FONT_BOLD, letterSpacing: 1.4,
    opacity: 0.55, marginBottom: 6, color: "#020617",
  },
  title: { fontFamily: FONT_BOLD, marginBottom: 12, color: "#020617" },

  // ── Texte identitaire ──
  identityRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 10, marginBottom: 18,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.06)",
    borderWidth: 1, borderColor: "rgba(249,115,22,0.14)",
  },
  identityAccent: {
    width: 3, borderRadius: 2, alignSelf: "stretch",
    backgroundColor: "#F97316", flexShrink: 0,
  },
  identityText: {
    flex: 1, fontSize: 14, fontFamily: FONT_BOLD,
    color: "#020617", lineHeight: 20, opacity: 0.88,
  },

  progressCard: {
    borderRadius: 18, padding: 14,
    backgroundColor: "rgba(15,23,42,0.04)", marginBottom: 14,
  },
  rowBetween: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", gap: 10, marginBottom: 8,
  },
  label: { fontSize: 14, fontFamily: FONT_BOLD, opacity: 0.85, color: "#020617" },
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  streakText: { fontSize: 12, fontFamily: FONT_BOLD, color: "#F97316" },
  track: {
    height: 14, borderRadius: 999, backgroundColor: "#E5E7EB",
    overflow: "hidden", position: "relative",
  },
  trackGlow: {
    position: "absolute", left: -10, right: -10, top: -10, bottom: -10, borderRadius: 999,
  },
  fill: { height: "100%", borderRadius: 999, overflow: "hidden" },
  numbers: { marginTop: 8, fontSize: 13, opacity: 0.75, fontFamily: FONT_REG, color: "#020617" },

  // ── Nudge duo ──
  duoNudge: { marginBottom: 14 },
  duoNudgeInner: { borderRadius: 16, overflow: "hidden" },
  duoNudgeGrad: {
    flexDirection: "row", alignItems: "center",
    padding: 12, gap: 10, borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.22)",
  },
  duoNudgeLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  duoNudgeIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  duoNudgeTitle: {
    fontFamily: FONT_BOLD, fontSize: 13, color: "#020617", opacity: 0.90,
    marginBottom: 2,
  },
  duoNudgeSub: {
    fontFamily: FONT_REG, fontSize: 11.5, color: "#6366F1", opacity: 0.85,
  },

  closeBtn: {
    borderRadius: 20, paddingVertical: 16, alignItems: "center",
    backgroundColor: "#020617", minHeight: 48, justifyContent: "center",
  },
  closeText: { color: "white", fontFamily: FONT_BOLD, fontSize: 15 },
});
