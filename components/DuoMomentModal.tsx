// components/DuoMomentModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  I18nManager,
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
  partnerName: string;
  myDone: number;
  myTotal: number;
  partnerDone: number;
  partnerTotal: number;
  partnerAlreadyMarkedToday: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clampInt = (v: any, min: number, max: number) => {
  const n = Math.trunc(toNum(v, min));
  return Math.min(Math.max(n, min), max);
};
const FONT_REG = "Comfortaa_400Regular";
const FONT_BOLD = "Comfortaa_700Bold";

type ConfettiParticle = {
  id: string;
  leftPct: number;
  size: number;
  rot: number;
  delay: number;
  drift: number;
};

function ConfettiPiece({
  p,
  progress,
  palette,
}: {
  p: ConfettiParticle;
  progress: Animated.SharedValue<number>;
  palette: readonly string[];
}) {
  const s = useAnimatedStyle<ViewStyle>(() => {
    const t = progress.value;
    const y = interpolate(t, [0, 1], [-14, 160]);
    const x = interpolate(t, [0, 1], [0, p.drift]);
    const r = `${interpolate(t, [0, 1], [0, p.rot])}deg`;
    const o = interpolate(t, [0, 0.15, 1], [0, 1, 0]);
    const sc = interpolate(t, [0, 0.12, 1], [0.85, 1, 0.95]);
    return {
      opacity: o,
      transform: [
        { translateY: y },
        { translateX: x },
        { rotate: r },
        { scale: sc },
      ] as ViewStyle["transform"],
   };
  });

  const c = palette[Math.abs(p.size + p.rot) % palette.length] ?? palette[0] ?? "#fff";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiPiece,
        {
          left: `${p.leftPct}%`,
          width: p.size,
          height: Math.max(10, Math.round(p.size * 1.8)),
          backgroundColor: c,
        },
        s,
      ]}
    />
  );
}

export default function DuoMomentModal(props: Props) {
  const {
    visible,
    onClose,
    partnerName,
    myDone,
    myTotal,
    partnerDone,
    partnerTotal,
    partnerAlreadyMarkedToday,
  } = props;

  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;

  const CARD_MAX = width >= 768 ? 520 : 480;
  const CARD_W = Math.min(width * 0.92, CARD_MAX);
  const HALO_SIZE = Math.round(Math.min(width * 0.92, 520));
  const SAFE_MAX_H = Math.round(height * 0.86);

  // ✅ harden payload (évite "/ • 0%" si undefined)
  const safePartnerName = String(partnerName ?? "").trim() || "Partner";
  const safeMyTotal = Math.max(1, toNum(myTotal, 1));
  const safeMyDone = clampInt(myDone, 0, safeMyTotal);
  const safePartnerTotal = Math.max(1, toNum(partnerTotal, safeMyTotal));
  const safePartnerDone = clampInt(partnerDone, 0, safePartnerTotal);
  const safePartnerAlreadyMarkedToday = !!partnerAlreadyMarkedToday;

  const myPct = clamp01(safeMyDone / safeMyTotal);
  const pPct = clamp01(safePartnerDone / safePartnerTotal);

  const isRTL = I18nManager.isRTL;
  const writingDirection = isRTL ? "rtl" : "ltr";
  const textAlign = isRTL ? "right" : "left";

  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!visible) {
      setMsg("");
      return;
    }

    const pool = safePartnerAlreadyMarkedToday
      ? t("duoMoment.syncMessages", { returnObjects: true })
      : t("duoMoment.pressureMessages", { returnObjects: true });

    if (!Array.isArray(pool) || pool.length === 0) {
      setMsg(
        safePartnerAlreadyMarkedToday
          ? t("duoMoment.fallbackSync", {
              defaultValue: "Parfait — vous êtes synchro.",
            })
          : t("duoMoment.fallbackTurn", {
              name: partnerName,
              defaultValue: "Check envoyé à {{name}}. C’est à lui de jouer.",
            })
      );
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)] ?? "";
    setMsg(String(picked).replaceAll("{{name}}", safePartnerName).trim());
  }, [visible, safePartnerAlreadyMarkedToday, safePartnerName, t]);

  // Leader logic
  const myLeader = useMemo(() => myPct >= pPct, [myPct, pPct]);
  const partnerLeader = useMemo(() => pPct > myPct, [pPct, myPct]);

  // 🎬 animations
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const myBar = useSharedValue(0);
  const pBar = useSharedValue(0);
  const halo = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const confetti = useSharedValue(0);
  const myCrown = useSharedValue(0);
  const partnerCrown = useSharedValue(0);

  useEffect(() => {
    if (visible) return;
    cardScale.value = 0.9;
    cardOpacity.value = 0;
    myBar.value = 0;
    pBar.value = 0;
    halo.value = 0;
    glowPulse.value = 0;
    confetti.value = 0;
    myCrown.value = 0;
    partnerCrown.value = 0;
  }, [
    visible,
    cardScale,
    cardOpacity,
    myBar,
    pBar,
    halo,
    glowPulse,
    confetti,
    myCrown,
    partnerCrown,
  ]);

  useEffect(() => {
    if (!visible) return;

    cardScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    cardOpacity.value = withTiming(1, { duration: 220 });

    myBar.value = withTiming(myPct, {
      duration: 820,
      easing: Easing.out(Easing.cubic),
    });
    pBar.value = withTiming(pPct, {
      duration: 820,
      easing: Easing.out(Easing.cubic),
    });

    halo.value = withTiming(1, { duration: 900 });
    glowPulse.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });

    // 👑 crown pop (leader)
    myCrown.value = withSpring(myLeader ? 1 : 0, { damping: 10, stiffness: 220 });
    partnerCrown.value = withSpring(partnerLeader ? 1 : 0, { damping: 10, stiffness: 220 });
    

    // 🎉 confetti ultra light ONLY when sync
    if (partnerAlreadyMarkedToday) {
      confetti.value = 0;
      confetti.value = withTiming(1, {
        duration: 1100,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      confetti.value = 0;
    }

    if (Platform.OS !== "web") {
      partnerAlreadyMarkedToday
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [
    visible,
    myPct,
    pPct,
    partnerAlreadyMarkedToday,
    cardScale,
    cardOpacity,
    myBar,
    pBar,
    halo,
    glowPulse,
    myLeader,
    partnerLeader,
  ]);

   const cardAnim = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const haloAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: 0.18 * halo.value,
    transform: [{ scale: 0.9 + halo.value * 0.2 }],
  }));

  const glowAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: 0.22 * glowPulse.value,
    transform: [{ scaleX: 0.98 + glowPulse.value * 0.02 }],
  }));

  const myBarAnim = useAnimatedStyle<ViewStyle>(() => ({ width: `${myBar.value * 100}%` }));
  const pBarAnim = useAnimatedStyle<ViewStyle>(() => ({ width: `${pBar.value * 100}%` }));

  const myCrownAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: myCrown.value,
     transform: [
      { scale: 0.92 + myCrown.value * 0.18 },
      { translateY: -1 * myCrown.value },
    ] as ViewStyle["transform"],
  }));

  const partnerCrownAnim = useAnimatedStyle<ViewStyle>(() => ({
    opacity: partnerCrown.value,
    transform: [
      { scale: 0.92 + partnerCrown.value * 0.18 },
      { translateY: -1 * partnerCrown.value },
    ] as ViewStyle["transform"],
  }));

  // 🎨 palette
  const stateColors = safePartnerAlreadyMarkedToday
    ? (["#10B981", "#34D399"] as const) // SYNC
    : (["#F97316", "#FB923C"] as const); // À TOI

  const myFillColors = ["#F97316", "#FB923C"] as const;
  const partnerFillColors = ["#6366F1", "#8B5CF6"] as const;

  const badgeLabel = safePartnerAlreadyMarkedToday
    ? t("duoMoment.badgeSync", { defaultValue: "SYNC" })
    : t("duoMoment.badgeTurn", { defaultValue: "À LUI" });

  const subtitle = safePartnerAlreadyMarkedToday
    ? t("duoMoment.subtitleSync", {
        defaultValue: "Vous êtes alignés. Restez synchro.",
      })
    : t("duoMoment.subtitleTurn", {
        defaultValue: "Tu as marqué. Ton partenaire est le prochain.",
      });

      const confettiPalette = useMemo(
    () =>
      safePartnerAlreadyMarkedToday
        ? (["#34D399", "#10B981", "#A7F3D0", "#FBBF24"] as const)
        : (["#FB923C", "#F97316", "#FBBF24"] as const),
   [safePartnerAlreadyMarkedToday]
  );

  const confettiParticles = useMemo<ConfettiParticle[]>(() => {
    // deterministic-ish but fresh per open (using timestamp)
    const seed = Date.now() % 100000;
    const rand = (n: number) => {
      const x = Math.sin(seed + n * 999) * 10000;
      return x - Math.floor(x);
    };
    const count = safePartnerAlreadyMarkedToday ? 14 : 0;
    return Array.from({ length: count }).map((_, i) => {
      const r1 = rand(i + 1);
      const r2 = rand(i + 7);
      const r3 = rand(i + 13);
      return {
        id: `c${i}-${seed}`,
        leftPct: Math.round(8 + r1 * 84),
        size: Math.round(6 + r2 * 6),
        rot: Math.round(-260 + r3 * 520),
        delay: Math.round(r2 * 140),
        drift: Math.round(-18 + r1 * 36),
      };
    });
  }, [safePartnerAlreadyMarkedToday, visible]);

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
        accessibilityLabel={t("duoMoment.a11y.closeBackdrop", {
          defaultValue: "Fermer la fenêtre",
        })}
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
          <LinearGradient colors={stateColors} style={styles.haloGrad} />
        </Animated.View>

        <Animated.View
          style={[styles.card, cardAnim, { width: CARD_W, maxHeight: SAFE_MAX_H }]}
          onStartShouldSetResponder={() => true}
        >
          {/* glass */}
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.55)",
              "rgba(255,255,255,0.05)",
            ] as const}
            style={styles.glass}
          />

          {/* top row */}
          <View style={styles.topRow}>
            <View style={styles.badgeWrap}>
              <LinearGradient
                colors={stateColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Ionicons
                  name={safePartnerAlreadyMarkedToday ? "sparkles" : "flash"}
                  size={14}
                  color="#0B0D12"
                />
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </LinearGradient>

              {/* micro pill (premium signal) */}
              <View style={styles.microPill}>
                <Ionicons
                  name={safePartnerAlreadyMarkedToday ? "checkmark-circle" : "notifications"}
                  size={14}
                  color="#0B0D12"
                />
                <Text style={styles.microPillText}>
                  {safePartnerAlreadyMarkedToday
                    ? t("duoMoment.stateSync", { defaultValue: "Synchro" })
                    : t("duoMoment.stateTurn", { defaultValue: "À lui" })}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={14}
              style={styles.xBtn}
              accessibilityRole="button"
              accessibilityLabel={t("duoMoment.a11y.closeButton", {
                defaultValue: "Fermer",
              })}
            >
              <Ionicons name="close" size={18} color="#020617" />
            </Pressable>
          </View>

          <Text style={[styles.kicker, { writingDirection, textAlign }]}>
            {t("duoMoment.kicker", { defaultValue: "MOMENT DUO" })}
          </Text>

          <Text
            style={[
              styles.title,
              { fontSize: isSmall ? 19 : 24, writingDirection, textAlign },
            ]}
            numberOfLines={3}
          >
            {msg}
          </Text>

          <Text style={[styles.subtitle, { writingDirection, textAlign }]} numberOfLines={2}>
            {subtitle}
          </Text>

          {/* 🎉 confetti (sync only) */}
          {safePartnerAlreadyMarkedToday && (
            <View pointerEvents="none" style={styles.confettiWrap}>
              {confettiParticles.map((p) => (
                <View key={p.id} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
                  {/* delay per piece (cheap + clean): render instantly but offset start */}
                  <ConfettiPiece p={p} progress={confetti} palette={confettiPalette} />
                </View>
              ))}
            </View>
          )}

          {/* YOU */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={[styles.dot, { backgroundColor: "#F97316" }]} />
              <Ionicons name="person" size={16} color="#020617" style={{ opacity: 0.9 }} />
              <Text style={[styles.label, { writingDirection, textAlign }]}>
                {t("duoMoment.you", { defaultValue: "Toi" })}
              </Text>
              {myLeader && (
                <Animated.View style={[styles.leaderPill, myCrownAnim]}>
                  <Ionicons name="trophy" size={14} color="#0B0D12" />
                  <Text style={styles.leaderText}>
                    {t("duoMoment.leader", { defaultValue: "Leader" })}
                  </Text>
                </Animated.View>
              )}
            </View>

            <View style={styles.track}>
              {/* subtle glow behind */}
              <Animated.View style={[styles.trackGlow, glowAnim]}>
                <LinearGradient
                  colors={["rgba(249,115,22,0.35)", "rgba(251,146,60,0.08)"] as const}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>

              <Animated.View style={[styles.fillWrap, myBarAnim]}>
                <LinearGradient
                  colors={myFillColors}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
            </View>

            <Text style={[styles.numbers, { writingDirection, textAlign }]}>
              {safeMyDone}/{safeMyTotal} • {Math.round(myPct * 100)}%
            </Text>
          </View>

          {/* PARTNER */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={[styles.dot, { backgroundColor: "#6366F1" }]} />
              <Ionicons name="people" size={16} color="#020617" style={{ opacity: 0.9 }} />
              <Text style={[styles.label, { writingDirection, textAlign }]} numberOfLines={1}>
                {safePartnerName}
              </Text>
              {partnerLeader && (
                <Animated.View style={[styles.leaderPill, partnerCrownAnim]}>
                  <Ionicons name="trophy" size={14} color="#0B0D12" />
                  <Text style={styles.leaderText}>
                    {t("duoMoment.leader", { defaultValue: "Leader" })}
                  </Text>
                </Animated.View>
              )}
            </View>

            <View style={styles.track}>
              <Animated.View style={[styles.trackGlow, glowAnim]}>
                <LinearGradient
                  colors={["rgba(99,102,241,0.30)", "rgba(139,92,246,0.08)"] as const}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>

              <Animated.View style={[styles.fillWrap, pBarAnim]}>
                <LinearGradient
                  colors={partnerFillColors}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
            </View>

            <Text style={[styles.numbers, { writingDirection, textAlign }]}>
              {safePartnerDone}/{safePartnerTotal} • {Math.round(pPct * 100)}%
            </Text>
          </View>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
          >
            <Text style={styles.closeText}>
              {t("common.close", { defaultValue: "Fermer" })}
            </Text>
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

  glass: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },

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
    letterSpacing: 0.3,
  },

  microPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    flexShrink: 1,
  },
  microPillText: {
    fontSize: 12,
    fontFamily: FONT_BOLD,
    color: "#020617",
    opacity: 0.85,
  },
// 🎉 confetti (very light)
  confettiWrap: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    height: 120,
    overflow: "hidden",
    borderRadius: 24,
    pointerEvents: "none",
  },
  confettiPiece: {
    position: "absolute",
    top: 0,
    borderRadius: 999,
    opacity: 0,
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
    opacity: 0.62,
    marginBottom: 6,
    color: "#020617",
  },

  title: {
    fontFamily: FONT_BOLD,
    marginBottom: 10,
    color: "#020617",
  },

  subtitle: {
    fontSize: 14,
    opacity: 0.68,
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

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0.95,
  },

  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_BOLD,
    color: "#020617",
    opacity: 0.92,
  },

  leaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  leaderText: {
    fontSize: 12,
    fontFamily: FONT_BOLD,
    color: "#020617",
    opacity: 0.85,
  },

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

  fillWrap: {
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },

  numbers: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.78,
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

  closeText: { color: "white", fontFamily: FONT_BOLD, fontSize: 15 },
});
