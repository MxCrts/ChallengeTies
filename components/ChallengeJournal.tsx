// components/ChallengeJournal.tsx
import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, Pressable, Modal, ScrollView,
  StyleSheet, Platform, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, withSpring, withTiming,
  useAnimatedStyle, runOnJS,
} from "react-native-reanimated";

// ─── Types ────────────────────────────────────────────────────────────────────

type PerformanceLog = {
  mood?: "perfect" | "good" | "hard";
  value?: number | null;
  note?: string;
  savedAt: string;
};

type PerformanceLogs = Record<string, PerformanceLog>;

type ChallengeDay = {
   dayNumber: number;
   dateKey: string;
   completed: boolean;
   log?: PerformanceLog;
   isFuture: boolean;
   isToday: boolean;
   fillRatio: number;
 };

type Props = {
  completionDateKeys: string[];
  performanceLogs?: PerformanceLogs;
  selectedDays: number;
  isDarkMode: boolean;
  t: (key: string, opts?: any) => string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ns = (n: number) => {
  const { PixelRatio } = require("react-native");
  const w = Dimensions.get("window").width;
  const scale = Math.min(Math.max(w / 375, 0.78), 1.55);
  return Math.round(PixelRatio.roundToNearestPixel(n * scale));
};

const ORANGE = "#F97316";

const MOOD_MAP = {
  perfect: { emoji: "🔥", color: "#F97316", label: "Parfait" },
  good:    { emoji: "👍", color: "#22C55E", label: "Bien" },
  hard:    { emoji: "😐", color: "#6366F1", label: "Difficile" },
};

function formatDateKey(dateKey: string, locale = "fr"): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(locale, {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

// ─── Grid challenge-based ─────────────────────────────────────────────────────
// Chaque case = un jour du challenge (J1 → JN), pas un calendrier glissant

function buildChallengeGrid(
   completionDateKeys: string[],
   performanceLogs: PerformanceLogs,
   selectedDays: number,
 ): ChallengeDay[] {
   const completedSet = new Set(completionDateKeys);
   const todayKey = new Date().toISOString().slice(0, 10);

   // Date de départ = la plus ancienne date marquée, sinon aujourd'hui
   const sortedMarked = [...completionDateKeys].sort();
   const startKey = sortedMarked[0] ?? todayKey;
   const [sy, sm, sd] = startKey.split("-").map(Number);
   const startDate = new Date(sy, sm - 1, sd);

   return Array.from({ length: selectedDays }, (_, i) => {
     const d = new Date(startDate);
     d.setDate(d.getDate() + i);
     const dateKey = [
       d.getFullYear(),
       String(d.getMonth() + 1).padStart(2, "0"),
       String(d.getDate()).padStart(2, "0"),
     ].join("-");

     const completed = completedSet.has(dateKey);
     const log = performanceLogs[dateKey];
     const isToday = dateKey === todayKey;
     const isFuture = dateKey > todayKey;
     const fillRatio = completed ? 1 : 0;

     return { dayNumber: i + 1, dateKey, completed, log, isFuture, isToday, fillRatio };
   });
 }

// ─── Challenge Day Cell ───────────────────────────────────────────────────────

const ChallengeDayCell = React.memo(function ChallengeDayCell({
   day, isDarkMode, onPress, cellSize,
 }: {
   day: ChallengeDay;
   isDarkMode: boolean;
   onPress: (day: ChallengeDay) => void;
   cellSize: number;
 }) {
   const mood = day.log?.mood;
   const moodColor = mood ? MOOD_MAP[mood].color : null;

   // ── Couleurs selon état ──
   let bg: string;
   let borderColor: string;
   let borderW: number;

   if (day.isFuture) {
     bg = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
     borderColor = "transparent";
     borderW = 0;
   } else if (day.completed) {
     const base = moodColor ?? ORANGE;
     bg = base + (isDarkMode ? "28" : "18");
     borderColor = base + "66";
     borderW = 1;
   } else {
     // Jour manqué passé — visible mais discret
     bg = isDarkMode ? "rgba(255,80,80,0.07)" : "rgba(220,50,50,0.05)";
     borderColor = isDarkMode ? "rgba(255,80,80,0.18)" : "rgba(220,50,50,0.14)";
     borderW = StyleSheet.hairlineWidth;
   }

   const tappable = !day.isFuture && (day.completed || !!day.log);

   return (
     <Pressable
       onPress={() => tappable ? onPress(day) : null}
       style={({ pressed }) => ({
         width: cellSize,
         height: cellSize,
         borderRadius: ns(5),
         backgroundColor: bg,
         borderWidth: day.isToday ? 1.5 : borderW,
         borderColor: day.isToday
           ? (isDarkMode ? "rgba(249,115,22,0.65)" : "rgba(249,115,22,0.50)")
           : borderColor,
         alignItems: "center",
         justifyContent: "center",
         overflow: "hidden",
         opacity: pressed ? 0.7 : day.isFuture ? 0.22 : 1,
       })}
     >
       {/* Jour complété avec mood */}
       {day.completed && mood && (
         <Text style={{ fontSize: cellSize * 0.42 }}>{MOOD_MAP[mood].emoji}</Text>
       )}
       {/* Jour complété sans mood — dot orange */}
       {day.completed && !mood && (
         <View style={{
           width: cellSize * 0.32,
           height: cellSize * 0.32,
           borderRadius: cellSize,
           backgroundColor: ORANGE,
         }} />
       )}
       {/* Jour manqué passé — croix très discrète */}
       {!day.completed && !day.isFuture && (
         <View style={{
           width: cellSize * 0.26,
           height: cellSize * 0.26,
           borderRadius: cellSize,
           backgroundColor: isDarkMode ? "rgba(255,80,80,0.35)" : "rgba(220,50,50,0.25)",
         }} />
       )}
     </Pressable>
   );
 });

// ─── Log Entry Card ───────────────────────────────────────────────────────────

const LogEntryCard = React.memo(function LogEntryCard({
  dateKey, dayNumber, log, isDarkMode, t,
}: {
  dateKey: string;
  dayNumber?: number;
  log: PerformanceLog;
  isDarkMode: boolean;
  t: (key: string, opts?: any) => string;
}) {
  const textPri = isDarkMode ? "#FFFFFF" : "#1A0800";
  const textSec = isDarkMode ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";
  const cardBg = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(249,115,22,0.04)";
  const borderCol = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.12)";
  const mood = log.mood ? MOOD_MAP[log.mood] : null;

  return (
    <View style={{
      borderRadius: ns(14),
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: cardBg,
      padding: ns(14),
      gap: ns(8),
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: ns(6) }}>
          {dayNumber != null && (
            <View style={{
              paddingHorizontal: ns(7), paddingVertical: ns(3),
              borderRadius: ns(6),
              backgroundColor: isDarkMode ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.09)",
            }}>
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(10),
                color: ORANGE,
              }}>
                J{dayNumber}
              </Text>
            </View>
          )}
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(12),
            color: textSec,
          }}>
            {formatDateKey(dateKey)}
          </Text>
        </View>
        {mood && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: ns(5),
            paddingHorizontal: ns(9), paddingVertical: ns(4),
            borderRadius: ns(999),
            backgroundColor: mood.color + (isDarkMode ? "22" : "15"),
            borderWidth: 1,
            borderColor: mood.color + "44",
          }}>
            <Text style={{ fontSize: ns(12) }}>{mood.emoji}</Text>
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: ns(11),
              color: mood.color,
            }}>
              {t(`perf.mood.${log.mood}`, { defaultValue: mood.label })}
            </Text>
          </View>
        )}
      </View>

      {log.value != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: ns(6) }}>
          <Ionicons name="analytics-outline" size={ns(14)} color={ORANGE} />
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(13),
            color: textPri,
          }}>
            {log.value}
          </Text>
        </View>
      )}

      {log.note && (
        <View style={{
          borderLeftWidth: 2, borderLeftColor: ORANGE + "66",
          paddingLeft: ns(10),
        }}>
          <Text style={{
            fontFamily: "Comfortaa_400Regular",
            fontSize: ns(13),
            color: isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.65)",
            lineHeight: ns(19),
          }}>
            {log.note}
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── Journal Full Sheet ────────────────────────────────────────────────────────

function JournalSheet({
  visible, onClose, logs, completionDateKeys, isDarkMode, t,
}: {
  visible: boolean;
  onClose: () => void;
  logs: PerformanceLogs;
  completionDateKeys: string[];
  isDarkMode: boolean;
  t: (key: string, opts?: any) => string;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 26, stiffness: 300 });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 160 });
    translateY.value = withTiming(600, { duration: 200 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  }, [onClose]);

  const sortedDates = useMemo(() => [...completionDateKeys].sort(), [completionDateKeys]);

  const entries = useMemo(() => {
    const completedSet = new Set(completionDateKeys);
    const allKeys = new Set([
      ...completionDateKeys,
      ...Object.keys(logs),
    ]);
    return Array.from(allKeys)
      .filter(k => completedSet.has(k) || logs[k])
      .sort((a, b) => b.localeCompare(a));
  }, [logs, completionDateKeys]);

  const bg = isDarkMode ? "rgba(10,6,2,0.99)" : "rgba(255,251,247,0.99)";
  const textPri = isDarkMode ? "#FFFFFF" : "#1A0800";
  const textSec = isDarkMode ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: "rgba(0,0,0,0.55)" },
        backdropStyle,
      ]}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: bg,
        borderTopLeftRadius: ns(28),
        borderTopRightRadius: ns(28),
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.12)",
        maxHeight: "88%",
        overflow: "hidden",
      }, sheetStyle]}>
        <LinearGradient
          colors={["rgba(249,115,22,0.70)", "rgba(249,115,22,0.00)"]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ height: ns(3) }}
        />

        <View style={{
          flexDirection: "row", alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: ns(20),
          paddingTop: ns(20),
          paddingBottom: ns(12),
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
        }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: ns(6), marginBottom: ns(2) }}>
              <View style={{ width: ns(3), height: ns(18), borderRadius: ns(2), backgroundColor: ORANGE }} />
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(17),
                color: textPri,
                letterSpacing: -0.3,
              }}>
                {t("journal.title", { defaultValue: "Journal" })}
              </Text>
            </View>
            <Text style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: ns(12),
              color: textSec,
            }}>
              {entries.length} {t("journal.entries", { defaultValue: "entrées" })}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={{
              width: ns(34), height: ns(34), borderRadius: ns(12),
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={ns(18)} color={textSec} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: ns(20),
            paddingTop: ns(16),
            paddingBottom: Math.max(insets.bottom + ns(20), ns(32)),
            gap: ns(10),
          }}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {entries.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: ns(40) }}>
              <Text style={{ fontSize: ns(32), marginBottom: ns(12) }}>📓</Text>
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(15),
                color: textPri,
                textAlign: "center",
                marginBottom: ns(6),
              }}>
                {t("journal.empty.title", { defaultValue: "Aucune entrée pour l'instant" })}
              </Text>
              <Text style={{
                fontFamily: "Comfortaa_400Regular",
                fontSize: ns(13),
                color: textSec,
                textAlign: "center",
                lineHeight: ns(19),
              }}>
                {t("journal.empty.sub", { defaultValue: "Après chaque marquage, tu pourras noter ton humeur, une valeur et une note libre." })}
              </Text>
            </View>
          ) : (
            entries.map(dateKey => {
              const log = logs[dateKey];
              const isCompleted = completionDateKeys.includes(dateKey);
              const dayNumber = sortedDates.indexOf(dateKey) + 1;

              if (!log && isCompleted) {
                return (
                  <View key={dateKey} style={{
                    borderRadius: ns(14),
                    borderWidth: 1,
                    borderColor: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.10)",
                    backgroundColor: isDarkMode ? "rgba(249,115,22,0.05)" : "rgba(249,115,22,0.03)",
                    padding: ns(14),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: ns(10),
                  }}>
                    <View style={{
                      paddingHorizontal: ns(7), paddingVertical: ns(3),
                      borderRadius: ns(6),
                      backgroundColor: isDarkMode ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.09)",
                    }}>
                      <Text style={{
                        fontFamily: "Comfortaa_700Bold",
                        fontSize: ns(10),
                        color: ORANGE,
                      }}>
                        J{dayNumber}
                      </Text>
                    </View>
                    <Text style={{
                      fontFamily: "Comfortaa_400Regular",
                      fontSize: ns(12),
                      color: textSec,
                      flex: 1,
                    }}>
                      {formatDateKey(dateKey)} · {t("journal.markedNoLog", { defaultValue: "Marqué ✓" })}
                    </Text>
                  </View>
                );
              }

              if (log) {
                return (
                  <LogEntryCard
                    key={dateKey}
                    dateKey={dateKey}
                    dayNumber={dayNumber > 0 ? dayNumber : undefined}
                    log={log}
                    isDarkMode={isDarkMode}
                    t={t}
                  />
                );
              }
              return null;
            })
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function ChallengeJournal({
  completionDateKeys,
  performanceLogs = {},
  selectedDays,
  isDarkMode,
  t,
}: Props) {
  const [journalVisible, setJournalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<ChallengeDay | null>(null);

  const textPri = isDarkMode ? "#FFFFFF" : "#1A0800";
  const textSec = isDarkMode ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";
  const cardBg = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(249,115,22,0.03)";
  const borderCol = isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(249,115,22,0.12)";

  // ─── Grid ─────────────────────────────────────────────────────────────────

  const challengeGrid = useMemo(
    () => buildChallengeGrid(completionDateKeys, performanceLogs, selectedDays),
    [completionDateKeys, performanceLogs, selectedDays]
  );

  // Calcul dynamique colonnes + cellSize selon durée challenge
  const SCREEN_W = Dimensions.get("window").width;
  const JOURNAL_PADDING = ns(32);
  const cellGap = ns(3);
  const MAX_COLS = selectedDays <= 30 ? 10 : selectedDays <= 90 ? 13 : 15;
  const cellSize = Math.max(
    ns(16),
    Math.floor((SCREEN_W - JOURNAL_PADDING - (MAX_COLS - 1) * cellGap) / MAX_COLS)
  );

  const rows = useMemo(() => {
    const result: ChallengeDay[][] = [];
    for (let i = 0; i < challengeGrid.length; i += MAX_COLS) {
      result.push(challengeGrid.slice(i, i + MAX_COLS));
    }
    return result;
  }, [challengeGrid, MAX_COLS]);

  // ─── Stats rapides ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = completionDateKeys.length;
    const withLog = Object.keys(performanceLogs).filter(k =>
      completionDateKeys.includes(k)
    ).length;
    const moods = Object.values(performanceLogs)
      .map(l => l.mood)
      .filter(Boolean) as ("perfect" | "good" | "hard")[];
    const moodCounts = { perfect: 0, good: 0, hard: 0 };
    moods.forEach(m => moodCounts[m]++);
    const topMood = moods.length
      ? (Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof MOOD_MAP)
      : null;
    return { total, withLog, topMood };
  }, [completionDateKeys, performanceLogs]);

  // ─── 3 derniers logs ──────────────────────────────────────────────────────

  const sortedCompletions = useMemo(
    () => [...completionDateKeys].sort(),
    [completionDateKeys]
  );

  const recentLogs = useMemo(() => {
    return Object.entries(performanceLogs)
      .filter(([k]) => completionDateKeys.includes(k))
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3);
  }, [performanceLogs, completionDateKeys]);

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <View style={{
      borderRadius: ns(20),
      borderWidth: 1,
      borderColor: borderCol,
      backgroundColor: cardBg,
      padding: ns(16),
      gap: ns(14),
    }}>

      {/* ── Header ── */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: ns(8) }}>
          <View style={{ width: ns(3), height: ns(18), borderRadius: ns(2), backgroundColor: ORANGE }} />
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(15),
            color: textPri,
            letterSpacing: -0.2,
          }}>
            {t("journal.sectionTitle", { defaultValue: "Journal" })}
          </Text>
          {stats.total > 0 && (
            <View style={{
              paddingHorizontal: ns(8), paddingVertical: ns(3),
              borderRadius: ns(999),
              backgroundColor: isDarkMode ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.09)",
            }}>
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(11),
                color: ORANGE,
              }}>
                {stats.total}/{selectedDays}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => setJournalVisible(true)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.65 : 1,
            paddingHorizontal: ns(10),
            paddingVertical: ns(5),
            borderRadius: ns(8),
            backgroundColor: isDarkMode ? "rgba(249,115,22,0.10)" : "rgba(249,115,22,0.07)",
          })}
        >
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(12),
            color: ORANGE,
          }}>
            {t("journal.seeAll", { defaultValue: "Tout voir →" })}
          </Text>
        </Pressable>
      </View>

      {/* ── Stats rapides ── */}
      {stats.total > 0 && (
        <View style={{ flexDirection: "row", gap: ns(8) }}>
          <View style={{
            flex: 1, borderRadius: ns(12),
            backgroundColor: isDarkMode ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.06)",
            borderWidth: 1, borderColor: isDarkMode ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.12)",
            padding: ns(10), alignItems: "center",
          }}>
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(18), color: ORANGE }}>
              {stats.total}
            </Text>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10), color: textSec, marginTop: ns(2) }}>
              {t("journal.daysMarked", { defaultValue: "jours" })}
            </Text>
          </View>
          <View style={{
            flex: 1, borderRadius: ns(12),
            backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            borderWidth: 1, borderColor: borderCol,
            padding: ns(10), alignItems: "center",
          }}>
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(18), color: textPri }}>
              {stats.withLog}
            </Text>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10), color: textSec, marginTop: ns(2) }}>
              {t("journal.logsCount", { defaultValue: "logs" })}
            </Text>
          </View>
          {stats.topMood && (
            <View style={{
              flex: 1, borderRadius: ns(12),
              backgroundColor: isDarkMode
                ? MOOD_MAP[stats.topMood].color + "18"
                : MOOD_MAP[stats.topMood].color + "12",
              borderWidth: 1,
              borderColor: MOOD_MAP[stats.topMood].color + "33",
              padding: ns(10), alignItems: "center",
            }}>
              <Text style={{ fontSize: ns(18) }}>{MOOD_MAP[stats.topMood].emoji}</Text>
              <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10), color: textSec, marginTop: ns(2) }}>
                {t("journal.topMood", { defaultValue: "humeur" })}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Heatmap challenge-based ── */}
      <View>
        {/* Label progression */}
        <Text style={{
          fontFamily: "Comfortaa_400Regular",
          fontSize: ns(10),
          color: textSec,
          marginBottom: ns(8),
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}>
          {t("journal.challengeProgress", {
            done: completionDateKeys.length,
            total: selectedDays,
            defaultValue: `Progression · ${completionDateKeys.length}/${selectedDays}`,
          })}
        </Text>

        {/* Grid rows */}
        <View style={{ gap: cellGap }}>
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: "row", gap: cellGap }}>
              {row.map((day) => (
                <ChallengeDayCell
                  key={day.dayNumber}
                  day={day}
                  isDarkMode={isDarkMode}
                  onPress={setSelectedDay}
                  cellSize={cellSize}
                />
              ))}
              {/* Padding dernière ligne incomplète */}
              {ri === rows.length - 1 && row.length < MAX_COLS &&
                Array.from({ length: MAX_COLS - row.length }).map((_, pi) => (
                  <View key={`pad-${pi}`} style={{ width: cellSize, height: cellSize }} />
                ))
              }
            </View>
          ))}
        </View>

        {/* Légende */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: ns(12), marginTop: ns(8), flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ns(4) }}>
     <View style={{ width: ns(10), height: ns(10), borderRadius: ns(3), backgroundColor: isDarkMode ? "rgba(255,80,80,0.25)" : "rgba(220,50,50,0.18)", borderWidth: StyleSheet.hairlineWidth, borderColor: isDarkMode ? "rgba(255,80,80,0.35)" : "rgba(220,50,50,0.25)" }} />
     <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: textSec }}>
       {t("journal.legend.missed", { defaultValue: "Manqué" })}
     </Text>
   </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ns(4) }}>
            <View style={{ width: ns(10), height: ns(10), borderRadius: ns(3), backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", opacity: 0.5 }} />
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: textSec }}>
              {t("journal.legend.future", { defaultValue: "À venir" })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ns(4) }}>
            <View style={{ width: ns(10), height: ns(10), borderRadius: ns(3), backgroundColor: isDarkMode ? "rgba(249,115,22,0.28)" : "rgba(249,115,22,0.18)", borderWidth: 1, borderColor: "#F97316" + "55" }} />
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: textSec }}>
              {t("journal.legend.done", { defaultValue: "Marqué" })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ns(4) }}>
            <Text style={{ fontSize: ns(9) }}>🔥👍😐</Text>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: textSec }}>
              {t("journal.legend.mood", { defaultValue: "Avec humeur" })}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3 derniers logs ── */}
      {recentLogs.length > 0 && (
        <View style={{ gap: ns(8) }}>
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: ns(11),
            color: textSec,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}>
            {t("journal.recent", { defaultValue: "Récents" })}
          </Text>
          {recentLogs.map(([dateKey, log]) => {
            const dayNumber = sortedCompletions.indexOf(dateKey) + 1;
            return (
              <LogEntryCard
                key={dateKey}
                dateKey={dateKey}
                dayNumber={dayNumber > 0 ? dayNumber : undefined}
                log={log}
                isDarkMode={isDarkMode}
                t={t}
              />
            );
          })}
          {Object.keys(performanceLogs).length > 3 && (
            <Pressable
              onPress={() => setJournalVisible(true)}
              style={({ pressed }) => ({
                alignItems: "center",
                paddingVertical: ns(10),
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(12),
                color: ORANGE,
                textDecorationLine: "underline",
              }}>
                {t("journal.seeAll", { defaultValue: "Tout voir →" })}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Empty state ── */}
      {stats.total === 0 && (
        <View style={{ alignItems: "center", paddingVertical: ns(8) }}>
          <Text style={{
            fontFamily: "Comfortaa_400Regular",
            fontSize: ns(12),
            color: textSec,
            textAlign: "center",
            lineHeight: ns(18),
          }}>
            {t("journal.emptyHint", { defaultValue: "Commence à marquer des jours pour voir ton historique ici." })}
          </Text>
        </View>
      )}

      {/* ── Tooltip cellule sélectionnée ── */}
      {selectedDay && selectedDay.dateKey && (
        <Pressable
          onPress={() => setSelectedDay(null)}
          style={{
            position: "absolute",
            top: 0, bottom: 0, left: 0, right: 0,
            borderRadius: ns(20),
          }}
        >
          <View style={{
            position: "absolute",
            bottom: ns(16), left: ns(16), right: ns(16),
            backgroundColor: isDarkMode ? "rgba(20,10,4,0.97)" : "rgba(255,251,247,0.98)",
            borderRadius: ns(16),
            borderWidth: 1,
            borderColor: isDarkMode ? "rgba(249,115,22,0.22)" : "rgba(249,115,22,0.18)",
            padding: ns(14),
            gap: ns(6),
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: ns(6) }}>
              <View style={{
                paddingHorizontal: ns(7), paddingVertical: ns(3),
                borderRadius: ns(6),
                backgroundColor: isDarkMode ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.09)",
              }}>
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(10), color: ORANGE }}>
                  J{selectedDay.dayNumber}
                </Text>
              </View>
              <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(12), color: textSec }}>
                {formatDateKey(selectedDay.dateKey)}
              </Text>
            </View>
            {selectedDay.log ? (
              <LogEntryCard
                dateKey={selectedDay.dateKey}
                log={selectedDay.log}
                isDarkMode={isDarkMode}
                t={t}
              />
            ) : (
              <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(12), color: textSec }}>
                {t("journal.markedNoLog", { defaultValue: "Marqué ✓" })} · {t("journal.noLog", { defaultValue: "Pas de log" })}
              </Text>
            )}
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10), color: textSec, textAlign: "center" }}>
              {t("journal.tapToClose", { defaultValue: "Appuie pour fermer" })}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Journal full sheet */}
      <JournalSheet
        visible={journalVisible}
        onClose={() => setJournalVisible(false)}
        logs={performanceLogs}
        completionDateKeys={completionDateKeys}
        isDarkMode={isDarkMode}
        t={t}
      />
    </View>
  );
}
