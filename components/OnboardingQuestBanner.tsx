// components/OnboardingQuestBanner.tsx
// TOP 1 MONDIAL — ring SVG natif Android + navigation fonctionnelle + UI clean
// FIX: auto-open modal bloqué si welcomeBonus encore visible

import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity,
  Modal, Dimensions, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  FadeIn, FadeOut, FadeInDown, FadeOutUp,
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withSequence, withRepeat, Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useOnboardingQuests } from "@/src/hooks/useOnboardingQuests";
import type { QuestId } from "@/src/services/onboardingQuestService";
import { TOTAL_TROPHIES } from "@/src/services/onboardingQuestService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SW } = Dimensions.get("window");
const ns = (s: number) => Math.round(s * Math.min(Math.max(SW / 375, 0.82), 1.35));

const ORANGE = "#F97316";
const GOLD = "#E8B84B";
const GREEN = "#22C55E";
const MODAL_SHOWN_KEY = "onboarding.modal.shown.v3";

// ─── ProgressRing — SVG pur, compatible iOS + Android ────────────────────────
const ProgressRing = React.memo(function ProgressRing({
  pct, size, stroke, completedCount, totalCount, isDark,
}: {
  pct: number; size: number; stroke: number;
  completedCount: number; totalCount: number; isDark: boolean;
}) {
  const color = pct >= 1 ? GREEN : ORANGE;
  const pctInt = Math.round(pct * 100);
  const subCol = isDark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)";
  const trackCol = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const target = circumference * (1 - Math.min(Math.max(pct, 0), 1));
    const start = Date.now();
    const duration = 900;

    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setOffset(circumference + (target - circumference) * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [pct, circumference]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={cx} cy={cy} r={radius} stroke={trackCol} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      <View style={{ alignItems: "center" }} pointerEvents="none">
        {pct >= 1 ? (
          <Ionicons name="trophy" size={20} color={GREEN} />
        ) : (
          <>
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color, lineHeight: 15 }}>
              {completedCount}/{totalCount}
            </Text>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: 9, color: subCol }}>
              {pctInt}%
            </Text>
          </>
        )}
      </View>
    </View>
  );
});

// ─── QuestRow générique ───────────────────────────────────────────────────────
const QuestRow = React.memo(function QuestRow({
  questId, titleKey, descriptionKey, trophies, icon,
  completed, isDark, onPress, exploreCount,
}: {
  questId: QuestId; titleKey: string; descriptionKey: string; trophies: number;
  icon: string; completed: boolean; isDark: boolean; onPress: () => void;
  exploreCount?: number;
}) {
  const { t } = useTranslation();
  const checkV = useSharedValue(completed ? 1 : 0);
  useEffect(() => {
    checkV.value = withSpring(completed ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [completed]);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkV.value }], opacity: checkV.value,
  }));

  const textCol = isDark ? "#F1F5F9" : "#0F172A";
  const subCol = isDark ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.42)";
  const bgCol = completed
    ? (isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)")
    : (isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF");
  const borderCol = completed
    ? (isDark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.16)")
    : (isDark ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.20)");
  const iconBg = completed
    ? (isDark ? "rgba(34,197,94,0.14)" : "rgba(34,197,94,0.10)")
    : (isDark ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.10)");

  const title = t(titleKey, {
    defaultValue:
      questId === "mark_first_day" ? "Marquer ton 1er jour"
      : questId === "explore_challenges" ? "Explorer des défis"
      : questId === "claim_daily_bonus" ? "Récupérer ton bonus"
      : questId === "complete_profile" ? "Compléter ton profil"
      : questId === "invite_duo" ? "Inviter un ami en Duo"
      : "Tenir 3 jours de suite",
  });
  const desc = t(descriptionKey, {
    count: Math.min(exploreCount ?? 0, 3), // ← résout {{count}} dans la clé i18n
    defaultValue:
      questId === "mark_first_day" ? "Coche ton défi du jour"
      : questId === "explore_challenges" ? `${Math.min(exploreCount ?? 0, 3)}/3 explorés`
      : questId === "claim_daily_bonus" ? "Ouvre ta récompense quotidienne"
      : questId === "complete_profile" ? "Ajoute une photo et tes catégories"
      : questId === "invite_duo" ? "Défie quelqu'un qui compte"
      : "Ta streak grandit chaque jour",
  });

  const showExploreBar = questId === "explore_challenges" && !completed && (exploreCount ?? 0) > 0;

  return (
    <Pressable
      onPress={() => { if (!completed) onPress(); }}
      disabled={completed}
      style={({ pressed }) => [
        qS.row,
        { backgroundColor: bgCol, borderColor: borderCol, opacity: pressed ? 0.80 : 1 },
      ]}
    >
      <View style={[qS.accentBar, { backgroundColor: completed ? GREEN : ORANGE }]} />
      <View style={[qS.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={ns(18)} color={completed ? GREEN : ORANGE} />
      </View>
      <View style={qS.textWrap}>
        <Text style={[qS.title, { color: completed ? subCol : textCol }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[qS.desc, { color: subCol }]} numberOfLines={1}>{desc}</Text>
        {showExploreBar && (
          <View style={[qS.miniTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
            <View style={[qS.miniFill, { width: `${Math.min((exploreCount ?? 0) / 3, 1) * 100}%` as any }]} />
          </View>
        )}
      </View>
      <View style={qS.right}>
        <Text style={[qS.trophies, { color: completed ? subCol : GOLD }]}>+{trophies}🏆</Text>
        {completed ? (
          <Animated.View style={[qS.checkBadge, checkStyle]}>
            <Ionicons name="checkmark" size={ns(11)} color="#0B1120" />
          </Animated.View>
        ) : (
          <View style={qS.arrowWrap}>
            <Ionicons name="chevron-forward" size={ns(13)} color={ORANGE + "70"} />
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ─── StreakQuestRow ───────────────────────────────────────────────────────────
const StreakQuestRow = React.memo(function StreakQuestRow({
  titleKey, trophies, icon, completed, isDark, streakCurrent,
}: {
  titleKey: string; trophies: number; icon: string;
  completed: boolean; isDark: boolean; streakCurrent: number;
}) {
  const { t } = useTranslation();
  const textCol = isDark ? "#F1F5F9" : "#0F172A";
  const subCol = isDark ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.42)";
  const bgCol = completed
    ? (isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)")
    : (isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF");
  const borderCol = completed
    ? (isDark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.16)")
    : (isDark ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.20)");
  const iconBg = completed
    ? (isDark ? "rgba(34,197,94,0.14)" : "rgba(34,197,94,0.10)")
    : (isDark ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.10)");
  const dotFill = completed ? GREEN : ORANGE;
  const current = Math.min(streakCurrent, 3);
  const title = t(titleKey, { defaultValue: "Tenir 3 jours de suite" });

  return (
    <View style={[qS.row, { backgroundColor: bgCol, borderColor: borderCol }]}>
      <View style={[qS.accentBar, { backgroundColor: completed ? GREEN : ORANGE }]} />
      <View style={[qS.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={ns(18)} color={completed ? GREEN : ORANGE} />
      </View>
      <View style={qS.textWrap}>
        <Text style={[qS.title, { color: completed ? subCol : textCol }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: ns(5), marginTop: ns(4) }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: ns(8), height: ns(8), borderRadius: ns(4),
                backgroundColor: i < current ? dotFill : (isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"),
                borderWidth: i < current ? 0 : 1,
                borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
          <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(9), color: subCol }}>
            {current}/3
          </Text>
        </View>
      </View>
      <View style={qS.right}>
        <Text style={[qS.trophies, { color: completed ? subCol : GOLD }]}>+{trophies}🏆</Text>
        {completed ? (
          <View style={qS.checkBadge}>
            <Ionicons name="checkmark" size={ns(11)} color="#0B1120" />
          </View>
        ) : (
          <View style={[qS.arrowWrap, {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            borderRadius: ns(6),
          }]}>
            <Ionicons name="time-outline" size={ns(12)} color={subCol} />
          </View>
        )}
      </View>
    </View>
  );
});

const qS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", borderRadius: ns(14),
    borderWidth: 1, overflow: "hidden", paddingVertical: ns(10), paddingRight: ns(10), gap: ns(10),
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } }),
  },
  accentBar: { width: ns(3), alignSelf: "stretch" },
  iconWrap: {
    marginLeft: ns(8), width: ns(36), height: ns(36),
    borderRadius: ns(11), alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: "Comfortaa_700Bold", fontSize: ns(12.5) },
  desc: { fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5), marginTop: ns(2) },
  miniTrack: { height: ns(3), borderRadius: ns(2), marginTop: ns(5), overflow: "hidden", width: "80%" },
  miniFill: { height: "100%", backgroundColor: ORANGE, borderRadius: ns(2) },
  right: { alignItems: "center", gap: ns(4) },
  trophies: { fontFamily: "Comfortaa_700Bold", fontSize: ns(10) },
  checkBadge: {
    width: ns(22), height: ns(22), borderRadius: ns(11),
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
  },
  arrowWrap: { width: ns(22), height: ns(22), alignItems: "center", justifyContent: "center" },
});

// ─── Renderer unifié ──────────────────────────────────────────────────────────
function renderQuest(
  q: any, isDark: boolean, onPress: () => void,
  exploreCount: number, streakCurrent: number,
) {
  if (q.id === "maintain_3day_streak") {
    return (
      <StreakQuestRow
        key={q.id}
        titleKey={q.titleKey}
        trophies={q.trophies}
        icon={q.icon}
        completed={q.completed}
        isDark={isDark}
        streakCurrent={streakCurrent}
      />
    );
  }
  return (
    <QuestRow
      key={q.id}
      questId={q.id}
      titleKey={q.titleKey}
      descriptionKey={q.descriptionKey}
      trophies={q.trophies}
      icon={q.icon}
      completed={q.completed}
      isDark={isDark}
      exploreCount={exploreCount}
      onPress={onPress}
    />
  );
}

// ─── CompletionBanner ─────────────────────────────────────────────────────────
const CompletionBanner = React.memo(function CompletionBanner({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ margin: ns(12) }}>
      <LinearGradient
        colors={["rgba(34,197,94,0.15)", "rgba(232,184,75,0.10)"]}
        style={{ borderRadius: ns(18), padding: ns(16), borderWidth: 1, borderColor: "rgba(34,197,94,0.30)", alignItems: "center", gap: ns(8) }}
      >
        <View style={{ width: ns(56), height: ns(56), borderRadius: ns(28), backgroundColor: "rgba(34,197,94,0.18)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trophy" size={ns(28)} color={GREEN} />
        </View>
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: isDark ? "#F1F5F9" : "#0F172A", textAlign: "center" }}>
          {t("onboarding.completion.title", { defaultValue: "Départ parfait ! 🔥" })}
        </Text>
        <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(12), color: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)", textAlign: "center", lineHeight: ns(17) }}>
          {t("onboarding.completion.sub", { trophies: TOTAL_TROPHIES, defaultValue: `Tu as gagné ${TOTAL_TROPHIES} trophées. La suite, c'est toi qui l'écris.` })}
        </Text>
      </LinearGradient>
    </View>
  );
});

// ─── OnboardingModal ──────────────────────────────────────────────────────────
const OnboardingModal = React.memo(function OnboardingModal({
  visible, onClose, onQuestPress, isDark, streakCurrent,
}: {
  visible: boolean; onClose: () => void; onQuestPress: (questId: QuestId) => void;
  isDark: boolean; streakCurrent: number;
}) {
  const { t } = useTranslation();
  const { state, completedCount, totalCount, progressPct } = useOnboardingQuests();
  const cardScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    cardScale.value = withSpring(1, { damping: 18, stiffness: 200 });
    cardOpacity.value = withTiming(1, { duration: 240 });
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value, transform: [{ scale: cardScale.value }],
  }));

  const bgCard = isDark ? "#080C14" : "#FFFBF7";
  const textPrim = isDark ? "#F1F5F9" : "#0F172A";
  const textSec = isDark ? "rgba(255,255,255,0.48)" : "rgba(15,23,42,0.50)";
  const divCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const allDone = completedCount === totalCount;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={[StyleSheet.absoluteFillObject, mS.backdrop]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[mS.card, { backgroundColor: bgCard }, cardStyle]}>
          <LinearGradient
            colors={["transparent", ORANGE + "90", GOLD + "AA", ORANGE + "90", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={mS.topLine}
          />
          <View style={mS.headerRow}>
            <View style={mS.headerLeft}>
              <LinearGradient colors={[ORANGE + "33", GOLD + "22"]} style={mS.headerIconWrap}>
                <Ionicons name="flash" size={ns(20)} color={ORANGE} />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[mS.headerTitle, { color: textPrim }]}>
                  {t("onboarding.modal.title", { defaultValue: "Tes premières victoires 🔥" })}
                </Text>
                <Text style={[mS.headerSub, { color: textSec }]} numberOfLines={1}>
                  {allDone
                    ? t("onboarding.modal.subtitleDone", { defaultValue: "Toutes complétées 🎉" })
                    : t("onboarding.modal.subtitle", { trophies: TOTAL_TROPHIES, defaultValue: `+${TOTAL_TROPHIES} trophées à gagner` })}
                </Text>
              </View>
            </View>
            <ProgressRing
              pct={progressPct}
              size={ns(58)}
              stroke={ns(5)}
              completedCount={completedCount}
              totalCount={totalCount}
              isDark={isDark}
            />
          </View>

          <View style={[mS.divider, { backgroundColor: divCol }]} />

          {allDone ? <CompletionBanner isDark={isDark} /> : (
            <View style={mS.questList}>
              {state?.quests.map((q) =>
                renderQuest(
                  q, isDark,
                  () => { onClose(); setTimeout(() => onQuestPress(q.id), 280); },
                  state.exploreCount,
                  streakCurrent,
                )
              )}
            </View>
          )}

          <TouchableOpacity activeOpacity={0.88} onPress={onClose} style={mS.ctaOuter}>
            <LinearGradient
              colors={allDone ? [GREEN, "#16A34A"] : [ORANGE, "#EA6C0A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={mS.ctaInner}
            >
              <Text style={mS.ctaText}>
                {allDone
                  ? t("onboarding.modal.ctaDone", { defaultValue: "Parfait, on continue ! 🚀" })
                  : t("onboarding.modal.cta", { defaultValue: "C'est parti ! 🚀" })}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {!allDone && (
            <Text style={[mS.hint, { color: textSec }]}>
              {t("onboarding.modal.hint", { defaultValue: "Ces missions restent accessibles depuis la home." })}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const mS = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(2,6,23,0.74)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: ns(16),
  },
  card: {
    width: "100%", maxWidth: ns(420), borderRadius: ns(26), overflow: "hidden",
    borderWidth: 1, borderColor: ORANGE + "35",
    ...Platform.select({
      ios: { shadowColor: ORANGE, shadowOpacity: 0.20, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 24 },
    }),
  },
  topLine: { height: 1.5, marginBottom: ns(16) },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: ns(16), marginBottom: ns(12), gap: ns(10),
  },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: ns(10), minWidth: 0 },
  headerIconWrap: {
    width: ns(40), height: ns(40), borderRadius: ns(13),
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontFamily: "Comfortaa_700Bold", fontSize: ns(13.5), flexShrink: 1 },
  headerSub: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), marginTop: ns(2) },
  divider: { height: 1, marginHorizontal: ns(16), marginBottom: ns(12) },
  questList: { paddingHorizontal: ns(12), gap: ns(7), marginBottom: ns(14) },
  ctaOuter: { marginHorizontal: ns(14), marginBottom: ns(10), borderRadius: ns(18), overflow: "hidden" },
  ctaInner: { paddingVertical: ns(14), alignItems: "center", justifyContent: "center", borderRadius: ns(18) },
  ctaText: { fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: "#0B1120" },
  hint: {
    fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5),
    textAlign: "center", paddingHorizontal: ns(16), paddingBottom: ns(14),
  },
});

// ─── Banner compact (export default) ─────────────────────────────────────────
export default function OnboardingQuestBanner({
  onQuestPress,
  streakCurrent = 0,
  // FIX: prop pour bloquer l'auto-open pendant le WelcomeBonusModal
  welcomeVisible = false,
}: {
  onQuestPress: (questId: QuestId) => void;
  streakCurrent?: number;
  welcomeVisible?: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { visible, state, completedCount, totalCount, progressPct } = useOnboardingQuests();
  const [modalVisible, setModalVisible] = useState(false);

  const barV = useSharedValue(0);
  useEffect(() => {
    barV.value = withTiming(progressPct, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progressPct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barV.value * 100}%` as any }));

  const pulseV = useSharedValue(1);
  useEffect(() => {
    if (completedCount === 0) {
      pulseV.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1, true
      );
    } else {
      pulseV.value = withTiming(1, { duration: 200 });
    }
  }, [completedCount]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseV.value }] }));

  // FIX CRITIQUE : auto-open bloqué tant que welcomeVisible est true
  // On attend que le WelcomeBonusModal soit fermé pour ouvrir le banner modal
  useEffect(() => {
  if (!visible) return;
  if (welcomeVisible) return;

  let cancelled = false;
  AsyncStorage.getItem(MODAL_SHOWN_KEY).then((v) => {
    if (v !== "1" && !cancelled) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          setModalVisible(true);
          AsyncStorage.setItem(MODAL_SHOWN_KEY, "1").catch(() => {});
        }
      }, 1200);
      // cleanup si welcomeVisible change entre temps
      return () => { cancelled = true; clearTimeout(timer); };
    }
  }).catch(() => {});

  return () => { cancelled = true; };
}, [visible, welcomeVisible]);

  if (!visible || !state) return null;

  const bgCard = isDark ? "#080C14" : "#FFFBF7";
  const textPrim = isDark ? "#F1F5F9" : "#0F172A";
  const textSec = isDark ? "rgba(255,255,255,0.46)" : "rgba(15,23,42,0.48)";
  const divCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const allDone = completedCount === totalCount;
  const trophiesLeft = state.quests.filter((q) => !q.completed).reduce((s, q) => s + q.trophies, 0);

  const firstIncomplete = state.quests.find((q) => !q.completed) ?? null;
  const remainingCount = state.quests.filter((q) => !q.completed).length;

  return (
    <>
      <OnboardingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onQuestPress={onQuestPress}
        isDark={isDark}
        streakCurrent={streakCurrent}
      />

      <Animated.View
        entering={FadeInDown.duration(420).springify().damping(16)}
        exiting={FadeOutUp.duration(280)}
        style={[bS.wrap, { backgroundColor: bgCard }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={["transparent", allDone ? GREEN + "90" : ORANGE + "90", allDone ? GREEN + "AA" : GOLD + "AA", allDone ? GREEN + "90" : ORANGE + "90", "transparent"]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={bS.topLine}
        />

        <Pressable
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [bS.header, { opacity: pressed ? 0.80 : 1 }]}
        >
          <View style={bS.headerRow}>
            <Animated.View style={pulseStyle}>
              <LinearGradient
                colors={allDone ? [GREEN + "33", GREEN + "22"] : [ORANGE + "33", GOLD + "22"]}
                style={bS.headerIcon}
              >
                <Ionicons name={allDone ? "trophy" : "flash"} size={ns(17)} color={allDone ? GREEN : ORANGE} />
              </LinearGradient>
            </Animated.View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[bS.headerTitle, { color: textPrim }]} numberOfLines={1}>
                {allDone
                  ? t("onboarding.banner.titleDone", { defaultValue: "Onboarding complété 🎉" })
                  : t("onboarding.banner.title", { defaultValue: "Lance-toi 🔥" })}
              </Text>
              <Text style={[bS.headerSub, { color: textSec }]} numberOfLines={1}>
                {allDone
                  ? t("onboarding.banner.subtitleDone", { trophies: TOTAL_TROPHIES, defaultValue: `+${TOTAL_TROPHIES} trophées gagnés ✓` })
                  : completedCount === 0
                    ? t("onboarding.banner.subtitleNew", { trophies: TOTAL_TROPHIES, defaultValue: `Gagne ${TOTAL_TROPHIES} trophées` })
                    : t("onboarding.banner.subtitleProgress", { done: completedCount, total: totalCount, left: trophiesLeft, defaultValue: `${completedCount}/${totalCount} · +${trophiesLeft} trophées restants` })}
              </Text>
            </View>
            <View style={bS.expandIcon}>
              <Ionicons name="grid-outline" size={ns(15)} color={(allDone ? GREEN : ORANGE)} />
            </View>
          </View>
        </Pressable>

        <View style={[bS.progressTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <Animated.View style={[bS.progressFill, barStyle, { backgroundColor: allDone ? GREEN : ORANGE }]} />
        </View>
        <Text style={[bS.progressLabel, { color: textSec }]}>
          {t("onboarding.banner.progress", { done: completedCount, total: totalCount, defaultValue: `${completedCount} / ${totalCount} complétées` })}
        </Text>

        <View style={[bS.divider, { backgroundColor: divCol }]} />

        <View style={bS.questList}>
          {firstIncomplete && renderQuest(
            firstIncomplete, isDark,
            () => onQuestPress(firstIncomplete.id),
            state.exploreCount,
            streakCurrent,
          )}

          {(remainingCount > 1 || completedCount > 0) && (
            <Pressable
              onPress={() => setModalVisible(true)}
              style={({ pressed }) => [
                bS.moreLink,
                {
                  backgroundColor: isDark ? "rgba(249,115,22,0.05)" : "rgba(249,115,22,0.04)",
                  borderColor: isDark ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.10)",
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[bS.moreLinkText, { color: ORANGE }]}>
                {remainingCount > 1
                  ? `+${remainingCount - 1} quête${remainingCount - 1 > 1 ? "s" : ""} restante${remainingCount - 1 > 1 ? "s" : ""}${completedCount > 0 ? ` · ${completedCount} ✓` : ""}`
                  : `${completedCount} quête${completedCount > 1 ? "s" : ""} complétée${completedCount > 1 ? "s" : ""} ✓`}
              </Text>
              <Ionicons name="chevron-forward" size={ns(12)} color={ORANGE + "80"} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const bS = StyleSheet.create({
  wrap: {
    marginHorizontal: ns(12), marginBottom: ns(12), marginTop: ns(4),
    borderRadius: ns(22), overflow: "hidden", borderWidth: 1, borderColor: ORANGE + "30",
    ...Platform.select({ ios: { shadowColor: ORANGE, shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } }),
  },
  topLine: { height: 1.5, marginBottom: ns(12) },
  header: { paddingHorizontal: ns(14), paddingBottom: ns(8) },
  headerRow: { flexDirection: "row", alignItems: "center", gap: ns(10) },
  headerIcon: {
    width: ns(36), height: ns(36), borderRadius: ns(11),
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontFamily: "Comfortaa_700Bold", fontSize: ns(14) },
  headerSub: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11.5), marginTop: ns(1) },
  expandIcon: {
    width: ns(32), height: ns(32), borderRadius: ns(8),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.08)",
    borderWidth: 1, borderColor: "rgba(249,115,22,0.18)",
  },
  progressTrack: { height: ns(4), marginHorizontal: ns(14), borderRadius: ns(2), overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: ns(2) },
  progressLabel: {
    fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5),
    marginHorizontal: ns(14), marginTop: ns(5), marginBottom: ns(10),
  },
  divider: { height: 1, marginHorizontal: ns(14), marginBottom: ns(10) },
  questList: { paddingHorizontal: ns(12), paddingBottom: ns(14), gap: ns(7) },
  moreLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: ns(10), borderWidth: 1, paddingVertical: ns(8), paddingHorizontal: ns(12),
  },
  moreLinkText: { fontFamily: "Comfortaa_700Bold", fontSize: ns(11), flex: 1 },
});
