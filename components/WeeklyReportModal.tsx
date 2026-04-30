// components/WeeklyReportModal.tsx
import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
} from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";
import * as Haptics from "expo-haptics";

const { width: W, height: H } = Dimensions.get("window");
const ORANGE = "#F97316";
const ORANGE_D = "#D4620C";
const GOLD = "#FFD700";

const ns = (n: number) =>
  Math.round(n * Math.min(Math.max(W / 375, 0.78), 1.55));

const wa = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.min(Math.max(alpha, 0), 1)})`;
};

const AnimCircle = Animated.createAnimatedComponent(Circle);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeWeekStat = {
  id: string;
  title: string;
  category: string;
  markedThisWeek: number;        // 0-7
  totalDays: number;
  completedDays: number;
  streak: number;
  isDuo: boolean;
  partnerName?: string;
  partnerMarkedThisWeek?: number;
};

export type WeeklyReportData = {
  weekLabel: string;     
  weekId: string;        // ex: "12–18 mai 2025"
  score: number;                 // 0–100 momentum score
  prevScore: number;
  totalMarked: number;           // total jours marqués cette semaine (tous défis)
  trophiesThisWeek: number;
  bestStreak: number;
  markedDaysBits: boolean[];     // [L,M,M,J,V,S,D] vrais jours marqués
  challenges: ChallengeWeekStat[];
  diagnostic: string;            // texte court généré côté serveur/local
  weekGoal: string;              // objectif de la semaine
  weekGoalTarget: number;        // ex: 5 (marquer 5 jours)
};

type Props = {
  visible: boolean;
  data: WeeklyReportData;
  isDark: boolean;
  onClose: () => void;
  onGoalAccept: () => void;
  t: (key: string, opts?: any) => string;
};

// ─── Momentum Ring ────────────────────────────────────────────────────────────
function MomentumRing({
   score,
   prevScore,
   isDark,
   t,
 }: {
   score: number;
   prevScore: number;
   isDark: boolean;
   t: (key: string, opts?: any) => string;
 }) {
  const SIZE = ns(168);
  const SW = ns(14);
  const r = (SIZE - SW) / 2;
  const circ = 2 * Math.PI * r;
  const prog = useSharedValue(0);
  const glow = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    prog.value = withDelay(
      280,
      withTiming(Math.min(score / 100, 1), {
        duration: 1600,
        easing: Easing.out(Easing.cubic),
      })
    );
    glow.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    pulse.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [score]);

  const ap = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - prog.value),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.50,
    transform: [{ scale: 1 + glow.value * 0.07 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const delta = score - prevScore;
  const isUp = delta >= 0;
  const dColor = isUp ? "#4ADE80" : "#F87171";

 const scoreLabel =
   score >= 90 ? t("weeklyReport.scoreElite", { defaultValue: "🔥 Elite" })
   : score >= 70 ? t("weeklyReport.scoreGood", { defaultValue: "⚡ On fire" })
   : score >= 50 ? t("weeklyReport.scoreMid", { defaultValue: "💪 Getting there" })
   : score >= 30 ? t("weeklyReport.scoreIrregular", { defaultValue: "😐 Inconsistent" })
   : t("weeklyReport.scoreLow", { defaultValue: "😴 Time to restart" });

  return (
    <View style={{ alignItems: "center" }}>
      {/* Glow externe */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: SIZE * 1.15,
            height: SIZE * 1.15,
            borderRadius: SIZE * 0.575,
            backgroundColor: wa(ORANGE, 0.14),
            top: -(SIZE * 0.075),
            left: -(SIZE * 0.075),
          },
          glowStyle,
        ]}
      />

      <Animated.View style={ringStyle}>
        <View
          style={{
            width: SIZE,
            height: SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={SIZE} height={SIZE}>
            {/* Track */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={isDark ? "rgba(255,255,255,0.07)" : wa(ORANGE, 0.10)}
              strokeWidth={SW}
              fill="none"
            />
            {/* Fill */}
            <AnimCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={ORANGE}
              strokeWidth={SW}
              fill="none"
              strokeDasharray={circ}
              animatedProps={ap}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>

          {/* Centre */}
          <View style={{ position: "absolute", alignItems: "center" }}>
            <Text
              style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(50),
                color: ORANGE,
                includeFontPadding: false,
                lineHeight: ns(56),
              }}
            >
              {score}
            </Text>
            <Text
              style={{
                fontFamily: "Comfortaa_400Regular",
                fontSize: ns(12),
                color: isDark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.32)",
                marginTop: ns(2),
              }}
            >
              / 100
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Label niveau */}
      <Animated.View
        entering={FadeIn.delay(1200).duration(400)}
        style={{ marginTop: ns(10) }}
      >
        <Text
          style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(16),
            color: isDark ? "#FFFFFF" : "#1A0800",
            textAlign: "center",
          }}
        >
          {scoreLabel}
        </Text>
      </Animated.View>

      {/* Delta pill */}
      <Animated.View
        entering={FadeIn.delay(1400).duration(360)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: ns(6),
          marginTop: ns(10),
          paddingHorizontal: ns(16),
          paddingVertical: ns(7),
          borderRadius: ns(999),
          backgroundColor: isUp
            ? "rgba(74,222,128,0.12)"
            : "rgba(248,113,113,0.12)",
          borderWidth: 1,
          borderColor: isUp
            ? "rgba(74,222,128,0.30)"
            : "rgba(248,113,113,0.30)",
        }}
      >
        <Ionicons
          name={isUp ? "trending-up" : "trending-down"}
          size={ns(14)}
          color={dColor}
        />
        <Text
          style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(12.5),
            color: dColor,
          }}
        >
           {isUp ? `+${delta}` : `${delta}`} {t("weeklyReport.vsPrevWeek", { defaultValue: "vs last week" })}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Days Dots réels ──────────────────────────────────────────────────────────
function WeekDaysDots({
   markedDaysBits,
   isDark,
   t,
 }: {
   markedDaysBits: boolean[];
   isDark: boolean;
   t: (key: string, opts?: any) => string;
 }) {

  const DAY_LABELS = [
   t("weeklyReport.dayMon", { defaultValue: "M" }),
   t("weeklyReport.dayTue", { defaultValue: "T" }),
   t("weeklyReport.dayWed", { defaultValue: "W" }),
   t("weeklyReport.dayThu", { defaultValue: "T" }),
   t("weeklyReport.dayFri", { defaultValue: "F" }),
   t("weeklyReport.daySat", { defaultValue: "S" }),
   t("weeklyReport.daySun", { defaultValue: "S" }),
 ];
  const bits =
    markedDaysBits.length === 7
      ? markedDaysBits
      : Array(7)
          .fill(false)
          .map((_, i) => markedDaysBits[i] ?? false);

  return (
    <View
      style={{ flexDirection: "row", gap: ns(6), justifyContent: "center" }}
    >
      {DAY_LABELS.map((d, i) => {
        const marked = bits[i];
        return (
          <Animated.View
            key={i}
            entering={FadeIn.delay(420 + i * 50).duration(280)}
            style={{ alignItems: "center", gap: ns(5) }}
          >
            <View
              style={{
                width: ns(36),
                height: ns(36),
                borderRadius: ns(10),
                backgroundColor: marked
                  ? ORANGE
                  : isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: marked
                  ? wa(ORANGE, 0.75)
                  : isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.07)",
              }}
            >
              {marked ? (
                <Ionicons name="checkmark" size={ns(16)} color="#FFF" />
              ) : (
                <View
                  style={{
                    width: ns(5),
                    height: ns(5),
                    borderRadius: ns(3),
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.10)",
                  }}
                />
              )}
            </View>
            <Text
              style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(9.5),
                color: marked
                  ? ORANGE
                  : isDark
                  ? "rgba(255,255,255,0.20)"
                  : "rgba(0,0,0,0.20)",
              }}
            >
              {d}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({
  icon,
  val,
  label,
  isDark,
  delay,
  accent,
}: {
  icon: any;
  val: string;
  label: string;
  isDark: boolean;
  delay: number;
  accent?: string;
}) {
  const color = accent ?? ORANGE;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(340)}
      style={{ alignItems: "center", flex: 1 }}
    >
      <View
        style={{
          width: ns(44),
          height: ns(44),
          borderRadius: ns(14),
          backgroundColor: wa(color, isDark ? 0.16 : 0.09),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: ns(8),
          borderWidth: 1,
          borderColor: wa(color, isDark ? 0.28 : 0.16),
        }}
      >
        <Ionicons name={icon} size={ns(20)} color={color} />
      </View>
      <Text
        style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: ns(22),
          color: isDark ? "#FFFFFF" : "#1A0800",
          includeFontPadding: false,
          lineHeight: ns(26),
        }}
      >
        {val}
      </Text>
      <Text
        style={{
          fontFamily: "Comfortaa_400Regular",
          fontSize: ns(10),
          color: isDark ? "rgba(255,255,255,0.34)" : "rgba(0,0,0,0.34)",
          marginTop: ns(2),
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── Challenge Row ────────────────────────────────────────────────────────────
function ChallengeRow({
  stat,
  isDark,
  delay,
  t,
}: {
  stat: ChallengeWeekStat;
  isDark: boolean;
  delay: number;
  t: (key: string, opts?: any) => string;
}) {
  const pct =
    stat.totalDays > 0
      ? Math.min(1, stat.completedDays / stat.totalDays)
      : 0;
  const weekPct = stat.markedThisWeek / 7;

  const barColor =
    stat.markedThisWeek >= 5
      ? ORANGE
      : stat.markedThisWeek >= 3
      ? "#EAB308"
      : "#EF4444";

  const textPri = isDark ? "#FFFFFF" : "#1A0800";
  const textSec = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)";
  const borderCol = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(249,115,22,0.12)";

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(320)}
      style={{
        borderRadius: ns(16),
        borderWidth: 1,
        borderColor: borderCol,
        backgroundColor: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(249,115,22,0.025)",
        padding: ns(14),
        gap: ns(10),
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: ns(2) }}>
          <Text
            style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: ns(13),
              color: textPri,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {stat.title}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: ns(6) }}
          >
            <Text
              style={{
                fontFamily: "Comfortaa_400Regular",
                fontSize: ns(10),
                color: textSec,
              }}
            >
              {stat.category}
            </Text>
            {stat.isDuo && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: ns(3),
                  paddingHorizontal: ns(6),
                  paddingVertical: ns(2),
                  borderRadius: ns(999),
                  backgroundColor: isDark
                    ? "rgba(0,255,255,0.10)"
                    : "rgba(55,48,163,0.08)",
                }}
              >
                <Ionicons
                  name="people-outline"
                  size={ns(10)}
                  color={isDark ? "#00FFFF" : "#3730A3"}
                />
                <Text
                  style={{
                    fontFamily: "Comfortaa_700Bold",
                    fontSize: ns(9),
                    color: isDark ? "#00FFFF" : "#3730A3",
                  }}
                >
                  {stat.partnerName
                    ? `vs ${stat.partnerName}`
                    : t("duo.title", { defaultValue: "Duo" })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Streak */}
        {stat.streak > 0 && (
          <View
            style={{
              alignItems: "center",
              gap: ns(2),
              paddingHorizontal: ns(10),
              paddingVertical: ns(6),
              borderRadius: ns(12),
              backgroundColor: wa(ORANGE, isDark ? 0.14 : 0.08),
              borderWidth: 1,
              borderColor: wa(ORANGE, isDark ? 0.24 : 0.14),
            }}
          >
            <Text style={{ fontSize: ns(14) }}>🔥</Text>
            <Text
              style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(11),
                color: ORANGE,
              }}
            >
             {stat.streak}{t("weeklyReport.streakUnit", { defaultValue: "d" })}
            </Text>
          </View>
        )}
      </View>

      {/* Mini dots semaine */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: ns(4),
        }}
      >
        {Array.from({ length: 7 }, (_, i) => {
          const marked = i < stat.markedThisWeek;
          const isPartnerMarked =
            stat.isDuo && stat.partnerMarkedThisWeek != null
              ? i < stat.partnerMarkedThisWeek
              : false;
          return (
            <View key={i} style={{ gap: ns(2) }}>
              <View
                style={{
                  width: ns(14),
                  height: ns(14),
                  borderRadius: ns(4),
                  backgroundColor: marked
                    ? barColor
                    : isDark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.05)",
                  borderWidth: marked ? 0 : StyleSheet.hairlineWidth,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.08)",
                }}
              />
              {stat.isDuo && (
                <View
                  style={{
                    width: ns(14),
                    height: ns(4),
                    borderRadius: ns(2),
                    backgroundColor: isPartnerMarked
                      ? "#00C2FF"
                      : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.04)",
                  }}
                />
              )}
            </View>
          );
        })}
        <Text
          style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(11),
            color: barColor,
            marginLeft: ns(4),
          }}
        >
          {stat.markedThisWeek}/7
        </Text>
        {stat.isDuo && stat.partnerName && stat.partnerMarkedThisWeek != null && (
          <Text
            style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: ns(10),
              color: isDark ? "rgba(0,195,255,0.70)" : "rgba(0,120,200,0.70)",
              marginLeft: ns(2),
            }}
          >
            · {stat.partnerName} {stat.partnerMarkedThisWeek}/7
          </Text>
        )}
      </View>

      {/* Barre progression globale */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: ns(5),
          }}
        >
          <Text
            style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: ns(10),
              color: textSec,
            }}
          >
            {t("weeklyReport.globalProgress", {
              defaultValue: "Progression globale",
            })}
          </Text>
          <Text
            style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: ns(10),
              color: textSec,
            }}
          >
            {stat.completedDays}/{stat.totalDays}
          </Text>
        </View>
        <View
          style={{
            height: ns(5),
            borderRadius: ns(999),
            backgroundColor: isDark
              ? "rgba(255,255,255,0.07)"
              : "rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.round(pct * 100)}%`,
              height: "100%",
              borderRadius: ns(999),
              backgroundColor: ORANGE,
              opacity: 0.85,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Goal Progress Bar ────────────────────────────────────────────────────────
function GoalBar({
  current,
  target,
  isDark,
}: {
  current: number;
  target: number;
  isDark: boolean;
}) {
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const pct = Math.round(ratio * 100);
  const barW = useSharedValue(0);

  useEffect(() => {
    barW.value = withDelay(
      600,
      withTiming(ratio, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, [ratio]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barW.value * 100}%` as any,
  }));

  return (
    <View style={{ gap: ns(8) }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(12),
            color: isDark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.50)",
          }}
        >
          {current} / {target}{" "}
          {current >= target ? "✅" : ""}
        </Text>
        <Text
          style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(13),
            color: pct >= 100 ? "#4ADE80" : ORANGE,
          }}
        >
          {pct}%
        </Text>
      </View>
      <View
        style={{
          height: ns(8),
          borderRadius: ns(999),
          backgroundColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              borderRadius: ns(999),
              backgroundColor: pct >= 100 ? "#4ADE80" : ORANGE,
            },
            barStyle,
          ]}
        />
      </View>
    </View>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function WeeklyReportModal({
  visible,
  data,
  isDark,
  onClose,
  onGoalAccept,
  t,
}: Props) {
  const insets = useSafeAreaInsets();

  const bgColor = isDark ? "rgba(7,4,1,0.99)" : "rgba(255,251,247,0.99)";
  const cardBg = isDark
    ? (["rgba(22,9,1,0.97)", "rgba(13,5,0,0.94)"] as const)
    : (["rgba(255,255,255,0.99)", "rgba(255,247,240,0.97)"] as const);
  const borderCol = isDark ? wa(ORANGE, 0.18) : wa(ORANGE, 0.12);
  const textPri = isDark ? "#FFFFFF" : "#1A0800";
  const textSec = isDark
    ? "rgba(255,255,255,0.36)"
    : "rgba(0,0,0,0.34)";
  const textBody = isDark
    ? "rgba(255,255,255,0.78)"
    : "rgba(0,0,0,0.68)";

  const sheetH = Math.min(H * 0.94, H - insets.top - 6);

  // Jours marqués cette semaine (parmi tous les défis, dédupliqués)
  const markedCount = data.markedDaysBits.filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.72)",
          justifyContent: "flex-end",
        }}
      >
        <Animated.View
          entering={FadeInUp.springify().damping(28).stiffness(200)}
          style={{
            height: sheetH,
            backgroundColor: bgColor,
            borderTopLeftRadius: ns(32),
            borderTopRightRadius: ns(32),
            overflow: "hidden",
            ...(Platform.OS === "ios"
              ? {
                  shadowColor: ORANGE,
                  shadowOpacity: 0.22,
                  shadowRadius: 32,
                  shadowOffset: { width: 0, height: -10 },
                }
              : { elevation: 24 }),
          }}
        >
          {/* Accent strip */}
          <LinearGradient
            colors={[wa(ORANGE, 0.75), wa(ORANGE, 0.0)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: ns(4),
              zIndex: 10,
            }}
          />

          {/* ── Header fixe ── */}
          <View
            style={{
              paddingTop: ns(16),
              paddingBottom: ns(12),
              paddingHorizontal: ns(22),
              alignItems: "center",
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: ns(40),
                height: ns(4),
                borderRadius: ns(2),
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(0,0,0,0.10)",
                marginBottom: ns(16),
              }}
            />

            {/* Kicker + semaine */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: ns(8),
                marginBottom: ns(10),
              }}
            >
              <View
                style={{
                  paddingHorizontal: ns(12),
                  paddingVertical: ns(5),
                  borderRadius: ns(999),
                  backgroundColor: wa(ORANGE, isDark ? 0.16 : 0.09),
                  borderWidth: 1,
                  borderColor: wa(ORANGE, 0.32),
                }}
              >
                <Text
                  style={{
                    fontFamily: "Comfortaa_700Bold",
                    fontSize: ns(10),
                    color: ORANGE,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  {t("weeklyReport.kicker", { defaultValue: "Bilan semaine" })}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Comfortaa_400Regular",
                  fontSize: ns(11),
                  color: textSec,
                }}
              >
                {data.weekLabel}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(24),
                color: textPri,
                textAlign: "center",
                lineHeight: ns(30),
                includeFontPadding: false,
              }}
            >
              {t("weeklyReport.title", { defaultValue: "Ton momentum" })}
            </Text>
          </View>

          {/* ── ScrollView ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces
            overScrollMode="always"
            contentContainerStyle={{
              paddingHorizontal: ns(18),
              paddingBottom: Math.max(insets.bottom + ns(28), ns(44)),
              paddingTop: ns(2),
              gap: ns(14),
            }}
          >
            {/* ── 1. Ring ── */}
            <Animated.View
              entering={FadeIn.delay(100).duration(440)}
              style={{ alignItems: "center", paddingVertical: ns(6) }}
            >
              <MomentumRing
   score={data.score}
   prevScore={data.prevScore}
   isDark={isDark}
   t={t}
 />
            </Animated.View>

            {/* ── 2. Stats + dots semaine ── */}
            <Animated.View entering={FadeInDown.delay(200).duration(380)}>
              <LinearGradient
                colors={cardBg}
                style={{
                  borderRadius: ns(22),
                  borderWidth: 1,
                  borderColor: borderCol,
                  padding: ns(20),
                  gap: ns(18),
                }}
              >
                {/* Chips */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    gap: ns(8),
                  }}
                >
                  <StatChip
                    icon="calendar-outline"
                    val={`${markedCount}`}
                    label={t("weeklyReport.activeDays", {
                      defaultValue: "jours actifs",
                    })}
                    isDark={isDark}
                    delay={320}
                  />
                  <View
                    style={{
                      width: 1,
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  />
                  <StatChip
                    icon="trophy-outline"
                    val={`+${data.trophiesThisWeek}`}
                    label={t("weeklyReport.trophies", {
                      defaultValue: "trophées",
                    })}
                    isDark={isDark}
                    delay={380}
                    accent={GOLD}
                  />
                  <View
                    style={{
                      width: 1,
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  />
                  <StatChip
                    icon="flame-outline"
                    val={`${data.bestStreak}`}
                    label={t("weeklyReport.streak", {
                      defaultValue: "meilleur streak",
                    })}
                    isDark={isDark}
                    delay={440}
                  />
                </View>

                {/* Sépar */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : wa(ORANGE, 0.08),
                  }}
                />

                {/* Dots semaine */}
                <View style={{ gap: ns(10) }}>
                  <Text
                    style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(10),
                      color: textSec,
                      textAlign: "center",
                      letterSpacing: 0.9,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("weeklyReport.daysOfWeek", {
                      defaultValue: "Cette semaine",
                    })}
                  </Text>
                  <WeekDaysDots
   markedDaysBits={data.markedDaysBits}
   isDark={isDark}
   t={t}
 />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* ── 3. Diagnostic ── */}
            <Animated.View entering={FadeInDown.delay(320).duration(360)}>
              <LinearGradient
                colors={
                  isDark
                    ? [
                        "rgba(249,115,22,0.12)",
                        "rgba(249,115,22,0.04)",
                      ]
                    : [
                        "rgba(249,115,22,0.07)",
                        "rgba(249,115,22,0.02)",
                      ]
                }
                style={{
                  borderRadius: ns(22),
                  borderWidth: 1,
                  borderColor: wa(ORANGE, 0.28),
                  padding: ns(20),
                  gap: ns(14),
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: ns(12),
                  }}
                >
                  <View
                    style={{
                      width: ns(40),
                      height: ns(40),
                      borderRadius: ns(12),
                      backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.12),
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: wa(ORANGE, isDark ? 0.30 : 0.18),
                    }}
                  >
                    <Ionicons name="bulb-outline" size={ns(20)} color={ORANGE} />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(14),
                      color: textPri,
                      flex: 1,
                    }}
                  >
                    {t("weeklyReport.diagTitle", {
                      defaultValue: "Ce que je vois",
                    })}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(13.5),
                    lineHeight: ns(22),
                    color: textBody,
                  }}
                >
                  {data.diagnostic}
                </Text>
              </LinearGradient>
            </Animated.View>

            {/* ── 4. Défis de la semaine ── */}
            {data.challenges.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(400).duration(360)}
                style={{ gap: ns(10) }}
              >
                {/* Section header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: ns(8),
                    paddingHorizontal: ns(2),
                  }}
                >
                  <View
                    style={{
                      width: ns(3),
                      height: ns(16),
                      borderRadius: ns(2),
                      backgroundColor: ORANGE,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(13),
                      color: textSec,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}
                  >
                    {t("weeklyReport.challengesSection", {
                      defaultValue: "Tes défis",
                    })}
                  </Text>
                </View>

                {data.challenges.map((stat, i) => (
                  <ChallengeRow
                    key={stat.id}
                    stat={stat}
                    isDark={isDark}
                    delay={440 + i * 60}
                    t={t}
                  />
                ))}
              </Animated.View>
            )}

            {/* ── 5. Objectif semaine ── */}
            <Animated.View entering={FadeInDown.delay(500).duration(360)}>
              <LinearGradient
                colors={cardBg}
                style={{
                  borderRadius: ns(22),
                  borderWidth: 1,
                  borderColor: borderCol,
                  padding: ns(20),
                  gap: ns(16),
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: ns(12),
                  }}
                >
                  <View
                    style={{
                      width: ns(40),
                      height: ns(40),
                      borderRadius: ns(12),
                      backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.12),
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: wa(ORANGE, isDark ? 0.28 : 0.16),
                    }}
                  >
                    <Ionicons name="flag-outline" size={ns(20)} color={ORANGE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Comfortaa_700Bold",
                        fontSize: ns(14),
                        color: textPri,
                      }}
                    >
                      {t("weeklyReport.goalTitle", {
                        defaultValue: "Objectif cette semaine",
                      })}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Comfortaa_400Regular",
                        fontSize: ns(11),
                        color: textSec,
                        marginTop: ns(2),
                      }}
                    >
                      {t("weeklyReport.goalSub", {
                        defaultValue: "Fixé automatiquement selon ton rythme",
                      })}
                    </Text>
                  </View>
                </View>

                {/* Texte objectif */}
                <Text
                  style={{
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(13.5),
                    lineHeight: ns(22),
                    color: textBody,
                  }}
                >
                  {data.weekGoal}
                </Text>

                {/* Barre de progression */}
                <GoalBar
                  current={markedCount}
                  target={data.weekGoalTarget}
                  isDark={isDark}
                />

                {/* CTA */}
                <Pressable
                  onPress={async () => {
                    try {
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Medium
                      );
                    } catch {}
                    onGoalAccept();
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.86 : 1,
                    transform: [{ scale: pressed ? 0.975 : 1 }],
                    borderRadius: ns(16),
                    overflow: "hidden",
                    marginTop: ns(2),
                  })}
                >
                  <LinearGradient
                    colors={[ORANGE, ORANGE_D]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: ns(15),
                      paddingHorizontal: ns(20),
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: ns(10),
                    }}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.22)",
                        "rgba(255,255,255,0.00)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: ns(16),
                      }}
                      pointerEvents="none"
                    />
                    <Ionicons
                      name="checkmark-circle"
                      size={ns(22)}
                      color="#FFF"
                    />
                    <Text
                      style={{
                        fontFamily: "Comfortaa_700Bold",
                        fontSize: ns(15),
                        color: "#FFFFFF",
                      }}
                    >
                      {t("weeklyReport.goalAccept", {
                        defaultValue: "Je relève le défi 💪",
                      })}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </Animated.View>

            {/* ── Fermer ── */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                alignItems: "center",
                paddingVertical: ns(8),
                opacity: pressed ? 0.50 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "Comfortaa_400Regular",
                  fontSize: ns(12),
                  color: textSec,
                  textDecorationLine: "underline",
                }}
              >
                {t("weeklyReport.close", { defaultValue: "Fermer" })}
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
