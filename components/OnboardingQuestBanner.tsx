// components/OnboardingQuestBanner.tsx
// ✅ "First Win" Banner — top 1 mondial
// Bannière sticky adaptative solo/duo avec quêtes et progress bar

import React, { useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  Platform, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown, FadeOutUp,
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withSequence,
  withRepeat, Easing, interpolate,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useOnboardingQuests } from "@/src/hooks/useOnboardingQuests";
import type { QuestId } from "@/src/services/onboardingQuestService";

const { width: SW } = Dimensions.get("window");
const ns = (s: number) => Math.round(s * Math.min(Math.max(SW / 375, 0.82), 1.35));

const ORANGE      = "#F97316";
const GOLD        = "#E8B84B";
const ORANGE_DARK = "#C2410C";

/* ─── Props ──────────────────────────────────────────────────── */
type Props = {
  /** Appelé quand l'user tape sur une quête — navigue vers la bonne page */
  onQuestPress: (questId: QuestId) => void;
};

/* ─── Icône quête avec animation check ──────────────────────── */
const QuestRow = React.memo(function QuestRow({
  questId, titleKey, trophies, icon, completed, isDark, onPress,
}: {
  questId: QuestId;
  titleKey: string;
  trophies: number;
  icon: string;
  completed: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const scaleV = useSharedValue(1);
  const checkV = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    checkV.value = withSpring(completed ? 1 : 0, { damping: 14, stiffness: 180 });
    if (completed) {
      scaleV.value = withSequence(
        withTiming(1.06, { duration: 140 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [completed]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleV.value }],
    opacity: interpolate(checkV.value, [0, 1], [1, 0.60]),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkV.value }],
    opacity: checkV.value,
  }));

  const textCol = isDark ? "#F1F5F9" : "#0F172A";
  const subCol  = isDark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.48)";
  const bgCol   = completed
    ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
    : (isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.80)");
  const borderCol = completed
    ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
    : (isDark ? ORANGE + "28" : ORANGE + "35");

  return (
    <Animated.View style={rowStyle}>
      <Pressable
        onPress={() => !completed && onPress()}
        disabled={completed}
        style={({ pressed }) => [
          qS.row,
          { backgroundColor: bgCol, borderColor: borderCol, opacity: pressed ? 0.82 : 1 },
        ]}
      >
        {/* Accent gauche */}
        <View style={[qS.accentBar, { backgroundColor: completed ? "rgba(255,255,255,0.15)" : ORANGE }]} />

        {/* Icône */}
        <View style={[qS.iconWrap, { backgroundColor: completed ? "rgba(255,255,255,0.08)" : ORANGE + "22" }]}>
          <Ionicons
            name={icon as any}
            size={ns(16)}
            color={completed ? (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)") : ORANGE}
          />
        </View>

        {/* Texte */}
        <View style={qS.textWrap}>
          <Text style={[qS.title, { color: completed ? subCol : textCol }]} numberOfLines={1}>
            {t(titleKey, { defaultValue: titleKey })}
          </Text>
          <Text style={[qS.trophies, { color: completed ? subCol : GOLD }]}>
            +{trophies} 🏆
          </Text>
        </View>

        {/* Check ou chevron */}
        {completed ? (
          <Animated.View style={[qS.checkBadge, checkStyle, { backgroundColor: GOLD }]}>
            <Ionicons name="checkmark" size={ns(11)} color="#000" />
          </Animated.View>
        ) : (
          <Ionicons name="chevron-forward" size={ns(14)} color={ORANGE + "80"} />
        )}
      </Pressable>
    </Animated.View>
  );
});

const qS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    borderRadius: ns(14), borderWidth: 1, overflow: "hidden",
    paddingVertical: ns(10), paddingRight: ns(12), gap: ns(10),
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  accentBar:  { width: ns(3), alignSelf: "stretch" },
  iconWrap:   { marginLeft: ns(8), width: ns(34), height: ns(34), borderRadius: ns(10), alignItems: "center", justifyContent: "center" },
  textWrap:   { flex: 1, minWidth: 0 },
  title:      { fontFamily: "Comfortaa_700Bold", fontSize: ns(12.5) },
  trophies:   { fontFamily: "Comfortaa_700Bold", fontSize: ns(10.5), marginTop: ns(2) },
  checkBadge: { width: ns(22), height: ns(22), borderRadius: ns(11), alignItems: "center", justifyContent: "center" },
});

/* ─── Bannière principale ────────────────────────────────────── */
export default function OnboardingQuestBanner({ onQuestPress }: Props) {
  const { t }     = useTranslation();
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  const {
    visible, state, completedCount, totalCount,
    progressPct, complete, dismiss,
  } = useOnboardingQuests();

  /* Barre de progression animée */
  const barV = useSharedValue(0);
  useEffect(() => {
    barV.value = withTiming(progressPct, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progressPct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barV.value * 100}%` as any }));

  /* Pulse sur l'éclair si pas encore commencé */
  const pulseV = useSharedValue(1);
  useEffect(() => {
    if (completedCount === 0) {
      pulseV.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1, true
      );
    } else {
      pulseV.value = withTiming(1);
    }
  }, [completedCount]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseV.value }] }));

  const handleQuestPress = useCallback((questId: QuestId) => {
    onQuestPress(questId);
  }, [onQuestPress]);

  if (!visible || !state) return null;

  const bgCard  = isDark ? "#080C14" : "#FFFBF5";
  const textPrim = isDark ? "#F1F5F9" : "#0F172A";
  const textSec  = isDark ? "rgba(255,255,255,0.48)" : "rgba(15,23,42,0.50)";
  const divCol   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const trophiesTotal = state.quests.reduce((s, q) => s + q.trophies, 0);
  const trophiesLeft  = state.quests.filter(q => !q.completed).reduce((s, q) => s + q.trophies, 0);

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(16)}
      exiting={FadeOutUp.duration(300)}
      style={[bS.wrap, { backgroundColor: bgCard }]}
    >
      {/* Border gradient top */}
      <LinearGradient
        colors={["transparent", ORANGE + "90", GOLD + "AA", ORANGE + "90", "transparent"]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={bS.topLine}
      />

      {/* Header */}
      <View style={bS.header}>
        <View style={bS.headerLeft}>
          {/* Icône éclair animée */}
          <Animated.View style={[pulseStyle]}>
            <LinearGradient colors={[ORANGE + "33", GOLD + "22"]} style={bS.headerIcon}>
              <Ionicons name="flash" size={ns(16)} color={ORANGE} />
            </LinearGradient>
          </Animated.View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[bS.headerTitle, { color: textPrim }]} numberOfLines={1}>
              {t("onboarding.banner.title", { defaultValue: "Lance-toi 🔥" })}
            </Text>
            <Text style={[bS.headerSub, { color: textSec }]} numberOfLines={1}>
              {completedCount === 0
                ? t("onboarding.banner.subtitle", { trophies: trophiesTotal, defaultValue: `Gagne ${trophiesTotal} trophées` })
                : t("onboarding.banner.subtitleProgress", {
                    done: completedCount, total: totalCount, left: trophiesLeft,
                    defaultValue: `${completedCount}/${totalCount} · +${trophiesLeft} trophées restants`,
                  })}
            </Text>
          </View>
        </View>

        {/* Dismiss */}
        <TouchableOpacity onPress={dismiss} hitSlop={12} style={bS.dismissBtn}>
          <Ionicons name="close" size={ns(16)} color={textSec} />
        </TouchableOpacity>
      </View>

      {/* Barre de progression */}
      <View style={[bS.progressTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
        <Animated.View style={[bS.progressFill, barStyle, { backgroundColor: ORANGE }]} />
      </View>
      <Text style={[bS.progressLabel, { color: textSec }]}>
        {t("onboarding.banner.progress", {
          done: completedCount, total: totalCount,
          defaultValue: `${completedCount} / ${totalCount} complétées`,
        })}
      </Text>

      {/* Divider */}
      <View style={[bS.divider, { backgroundColor: divCol }]} />

      {/* Liste des quêtes */}
      <View style={bS.questList}>
        {state.quests.map((q, i) => (
          <QuestRow
            key={q.id}
            questId={q.id}
            titleKey={q.titleKey}
            trophies={q.trophies}
            icon={q.icon}
            completed={q.completed}
            isDark={isDark}
            onPress={() => handleQuestPress(q.id)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const bS = StyleSheet.create({
  wrap: {
    marginHorizontal: ns(12), marginBottom: ns(12),
    borderRadius: ns(22), overflow: "hidden",
    borderWidth: 1, borderColor: ORANGE + "35",
    ...Platform.select({
      ios: { shadowColor: ORANGE, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  topLine:      { height: 1, marginBottom: ns(12) },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: ns(14), marginBottom: ns(10), gap: ns(10) },
  headerLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: ns(10), minWidth: 0 },
  headerIcon:   { width: ns(34), height: ns(34), borderRadius: ns(11), alignItems: "center", justifyContent: "center" },
  headerTitle:  { fontFamily: "Comfortaa_700Bold", fontSize: ns(14) },
  headerSub:    { fontFamily: "Comfortaa_400Regular", fontSize: ns(11.5), marginTop: ns(1) },
  dismissBtn:   { padding: ns(4) },
  progressTrack:{ height: ns(4), marginHorizontal: ns(14), borderRadius: ns(2), overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: ns(2) },
  progressLabel:{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5), marginTop: ns(4), marginHorizontal: ns(14), marginBottom: ns(10) },
  divider:      { height: 1, marginHorizontal: ns(14), marginBottom: ns(10) },
  questList:    { paddingHorizontal: ns(12), paddingBottom: ns(14), gap: ns(8) },
});
