import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
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
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

const { width: W, height: H } = Dimensions.get("window");
const ORANGE = "#F97316";
const ORANGE_D = "#D4620C";

const ns = (n: number) => Math.round(n * Math.min(Math.max(W / 375, 0.78), 1.55));

const AnimCircle = Animated.createAnimatedComponent(Circle);

const wa = (c: string, a: number): string => {
  const h = c.replace("#", "").padEnd(6, "0");
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${Math.min(Math.max(a,0),1)})`;
};

// ── Momentum Ring ──────────────────────────────────────────────────────────────
function MomentumRing({ score, prevScore, isDark }: { score: number; prevScore: number; isDark: boolean }) {
  const SIZE = ns(160);
  const SW   = ns(13);
  const r    = (SIZE - SW) / 2;
  const circ = 2 * Math.PI * r;
  const prog = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    prog.value = withDelay(300, withTiming(Math.min(score / 100, 1), {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    }));
    glow.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(1,   { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    ));
  }, [score]);

  const ap = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - prog.value),
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 1 + glow.value * 0.06 }],
  }));

  const delta = score - prevScore;
  const isUp  = delta >= 0;
  const dColor = isUp ? "#4ADE80" : "#F87171";

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
        {/* Glow ambiant */}
        <Animated.View style={[{
          position: "absolute",
          width: SIZE * 0.72, height: SIZE * 0.72,
          borderRadius: SIZE * 0.36,
          backgroundColor: wa(ORANGE, 0.28),
        }, glowStyle]} />

        <Svg width={SIZE} height={SIZE}>
          {/* Track */}
          <Circle cx={SIZE/2} cy={SIZE/2} r={r}
            stroke={isDark ? "rgba(255,255,255,0.07)" : wa(ORANGE, 0.11)}
            strokeWidth={SW} fill="none"
          />
          {/* Progrès */}
          <AnimCircle cx={SIZE/2} cy={SIZE/2} r={r}
            stroke={ORANGE} strokeWidth={SW} fill="none"
            strokeDasharray={circ}
            animatedProps={ap}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
          />
        </Svg>

        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(46), color: ORANGE, includeFontPadding: false, lineHeight: ns(52) }}>
            {score}
          </Text>
          <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)", marginTop: ns(1) }}>
            / 100
          </Text>
        </View>
      </View>

      {/* Delta */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: ns(6),
        marginTop: ns(12),
        paddingHorizontal: ns(16), paddingVertical: ns(7),
        borderRadius: ns(999),
        backgroundColor: isUp ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
        borderWidth: 1,
        borderColor: isUp ? "rgba(74,222,128,0.30)" : "rgba(248,113,113,0.30)",
      }}>
        <Ionicons name={isUp ? "trending-up" : "trending-down"} size={ns(14)} color={dColor} />
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(12.5), color: dColor }}>
          {isUp ? `+${delta}` : delta} vs semaine dernière
        </Text>
      </View>
    </View>
  );
}

// ── Barre de jours ─────────────────────────────────────────────────────────────
function DaysBar({ markedDays, isDark }: { markedDays: number; isDark: boolean }) {
  const days = ["L","M","M","J","V","S","D"];
  return (
    <View style={{ flexDirection: "row", gap: ns(6), justifyContent: "center" }}>
      {days.map((d, i) => {
        const marked = i < markedDays;
        return (
          <Animated.View key={i} entering={FadeIn.delay(480 + i * 55).duration(280)} style={{ alignItems: "center", gap: ns(5) }}>
            <View style={{
              width: ns(36), height: ns(36), borderRadius: ns(10),
              backgroundColor: marked ? ORANGE : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              alignItems: "center", justifyContent: "center",
              borderWidth: 1,
              borderColor: marked ? ORANGE : isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
            }}>
              {marked
                ? <Ionicons name="checkmark" size={ns(16)} color="#FFF" />
                : <View style={{ width: ns(5), height: ns(5), borderRadius: ns(3), backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)" }} />
              }
            </View>
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(9.5), color: marked ? ORANGE : isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)" }}>
              {d}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────────
function StatChip({ icon, val, label, isDark, delay }: { icon: any; val: string; label: string; isDark: boolean; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(340)} style={{ alignItems: "center", flex: 1 }}>
      <View style={{
        width: ns(44), height: ns(44), borderRadius: ns(14),
        backgroundColor: wa(ORANGE, isDark ? 0.16 : 0.09),
        alignItems: "center", justifyContent: "center",
        marginBottom: ns(8),
        borderWidth: 1, borderColor: wa(ORANGE, isDark ? 0.28 : 0.16),
      }}>
        <Ionicons name={icon} size={ns(20)} color={ORANGE} />
      </View>
      <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(23), color: isDark ? "#FFFFFF" : "#1A0800", includeFontPadding: false, lineHeight: ns(27) }}>
        {val}
      </Text>
      <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10), color: isDark ? "rgba(255,255,255,0.36)" : "rgba(0,0,0,0.36)", marginTop: ns(2), textAlign: "center" }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type WeeklyReportData = {
  weekId: string;
  score: number;
  prevScore: number;
  delta: number;
  markedDays: number;
  trophiesThisWeek: number;
  diagnostic: string;
  goal: string;
  goalTarget: number;
};

type Props = {
  visible: boolean;
  data: WeeklyReportData;
  isDark: boolean;
  onClose: () => void;
  onGoalAccept: () => void;
  t: (key: string, opts?: any) => string;
};

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────────
export default function WeeklyReportModal({ visible, data, isDark, onClose, onGoalAccept, t }: Props) {
  const insets = useSafeAreaInsets();

  const bgColor   = isDark ? "rgba(7,4,1,0.99)"        : "rgba(255,251,247,0.99)";
  const cardBg    = isDark
    ? ["rgba(22,9,1,0.97)",  "rgba(13,5,0,0.94)"] as const
    : ["rgba(255,255,255,0.99)", "rgba(255,247,240,0.97)"] as const;
  const borderCol = isDark ? wa(ORANGE, 0.18) : wa(ORANGE, 0.13);
  const textPri   = isDark ? "#FFFFFF"                   : "#1A0800";
  const textSec   = isDark ? "rgba(255,255,255,0.38)"    : "rgba(0,0,0,0.36)";
  const textBody  = isDark ? "rgba(255,255,255,0.78)"    : "rgba(0,0,0,0.68)";

  const sheetH = Math.min(H * 0.93, H - insets.top - 8);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}>
        <Animated.View
          entering={FadeInUp.springify().damping(26).stiffness(200)}
          style={{
            height: sheetH,
            backgroundColor: bgColor,
            borderTopLeftRadius: ns(32),
            borderTopRightRadius: ns(32),
            overflow: "hidden",
            ...(Platform.OS === "ios"
              ? { shadowColor: ORANGE, shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } }
              : { elevation: 22 }),
          }}
        >
          {/* Accent orange strip */}
          <LinearGradient
            colors={[wa(ORANGE, 0.70), wa(ORANGE, 0.00)]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: ns(4), zIndex: 10 }}
          />

          {/* ─── Header fixe ─── */}
          <View style={{ paddingTop: ns(16), paddingBottom: ns(12), paddingHorizontal: ns(22), alignItems: "center" }}>
            {/* Handle */}
            <View style={{ width: ns(40), height: ns(4), borderRadius: ns(2), backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.11)", marginBottom: ns(18) }} />

            {/* Kicker pill */}
            <View style={{
              paddingHorizontal: ns(14), paddingVertical: ns(5),
              borderRadius: ns(999),
              backgroundColor: wa(ORANGE, isDark ? 0.16 : 0.09),
              borderWidth: 1, borderColor: wa(ORANGE, 0.32),
              marginBottom: ns(10),
            }}>
              <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(10), color: ORANGE, letterSpacing: 1.4, textTransform: "uppercase" }}>
                {t("weeklyReport.kicker", { defaultValue: "Bilan semaine" })}
              </Text>
            </View>

            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(24), color: textPri, textAlign: "center", lineHeight: ns(30), includeFontPadding: false }}>
              {t("weeklyReport.title", { defaultValue: "Ton momentum" })}
            </Text>
          </View>

          {/* ─── Scroll ─── */}
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
            {/* Ring */}
            <Animated.View entering={FadeIn.delay(120).duration(420)} style={{ alignItems: "center", paddingVertical: ns(4) }}>
              <MomentumRing score={data.score} prevScore={data.prevScore} isDark={isDark} />
            </Animated.View>

            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(220).duration(360)}>
              <LinearGradient colors={cardBg} style={{ borderRadius: ns(22), borderWidth: 1, borderColor: borderCol, padding: ns(20) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-around", gap: ns(8) }}>
                  <StatChip icon="calendar-outline" val={`${data.markedDays}`} label={t("weeklyReport.activeDays", { defaultValue: "jours actifs" })} isDark={isDark} delay={300} />
                  <View style={{ width: 1, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }} />
                  <StatChip icon="trophy-outline" val={`+${data.trophiesThisWeek}`} label={t("weeklyReport.trophies", { defaultValue: "trophées" })} isDark={isDark} delay={360} />
                  <View style={{ width: 1, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }} />
                  <StatChip icon="flash-outline" val={`${data.score}`} label={t("weeklyReport.momentum", { defaultValue: "momentum" })} isDark={isDark} delay={420} />
                </View>

                <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : wa(ORANGE, 0.09), marginVertical: ns(18) }} />

                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(10), color: textSec, textAlign: "center", marginBottom: ns(14), letterSpacing: 0.9, textTransform: "uppercase" }}>
                  {t("weeklyReport.daysOfWeek", { defaultValue: "Cette semaine" })}
                </Text>
                <DaysBar markedDays={data.markedDays} isDark={isDark} />
              </LinearGradient>
            </Animated.View>

            {/* Diagnostic */}
            <Animated.View entering={FadeInDown.delay(340).duration(360)}>
              <LinearGradient
                colors={isDark ? ["rgba(249,115,22,0.12)", "rgba(249,115,22,0.04)"] : ["rgba(249,115,22,0.07)", "rgba(249,115,22,0.02)"]}
                style={{ borderRadius: ns(22), borderWidth: 1, borderColor: wa(ORANGE, 0.28), padding: ns(20) }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: ns(12), marginBottom: ns(14) }}>
                  <View style={{ width: ns(40), height: ns(40), borderRadius: ns(12), backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.12), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="bulb-outline" size={ns(20)} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: textPri }}>
                    {t("weeklyReport.diagTitle", { defaultValue: "Ce que je vois" })}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(13.5), lineHeight: ns(21), color: textBody }}>
                  {data.diagnostic}
                </Text>
              </LinearGradient>
            </Animated.View>

            {/* Objectif */}
            <Animated.View entering={FadeInDown.delay(440).duration(360)}>
              <LinearGradient colors={cardBg} style={{ borderRadius: ns(22), borderWidth: 1, borderColor: borderCol, padding: ns(20) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: ns(12), marginBottom: ns(14) }}>
                  <View style={{ width: ns(40), height: ns(40), borderRadius: ns(12), backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.12), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="flag-outline" size={ns(20)} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: textPri }}>
                    {t("weeklyReport.goalTitle", { defaultValue: "Objectif cette semaine" })}
                  </Text>
                </View>

                <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(13.5), lineHeight: ns(21), color: textBody, marginBottom: ns(18) }}>
                  {data.goal}
                </Text>

                {/* CTA */}
                <Pressable
                  onPress={async () => {
                    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                    onGoalAccept();
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.86 : 1,
                    transform: [{ scale: pressed ? 0.975 : 1 }],
                    borderRadius: ns(16), overflow: "hidden",
                  })}
                >
                  <LinearGradient
                    colors={[ORANGE, ORANGE_D]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: ns(15), paddingHorizontal: ns(20), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ns(10) }}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={{ position: "absolute", inset: 0, borderRadius: ns(16) }}
                      pointerEvents="none"
                    />
                    <Ionicons name="checkmark-circle" size={ns(22)} color="#FFF" />
                    <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: "#FFFFFF" }}>
                      {t("weeklyReport.goalAccept", { defaultValue: "Je relève le défi 💪" })}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </Animated.View>

            {/* Fermer */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({ alignItems: "center", paddingVertical: ns(8), opacity: pressed ? 0.55 : 1 })}
            >
              <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(12), color: textSec, textDecorationLine: "underline" }}>
                {t("weeklyReport.close", { defaultValue: "Fermer" })}
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
