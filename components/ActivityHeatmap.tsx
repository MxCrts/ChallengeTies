import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width: W } = Dimensions.get("window");
const ORANGE = "#F97316";

const wa = (c: string, a: number): string => {
  const cl = Math.min(Math.max(a, 0), 1);
  const h = c.replace("#", "").padEnd(6, "0");
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${cl})`;
};

const ns = (n: number) => Math.round(n * Math.min(Math.max(W / 375, 0.78), 1.55));

// ── Types ────────────────────────────────────────────────────────────────────
export type HeatmapDay = {
  date: string; // "YYYY-MM-DD"
  count: number; // nombre de défis marqués ce jour
};

type Props = {
  days: HeatmapDay[];
  isDark: boolean;
  t: (key: string, opts?: any) => string;
  weeks?: number; // nb semaines affichées, défaut 16
};

// ── Couleur par intensité ────────────────────────────────────────────────────
function cellColor(count: number, isDark: boolean): [string, string] {
  if (count <= 0) return [
    isDark ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.06)",
    isDark ? "rgba(255,255,255,0.04)" : "rgba(249,115,22,0.04)",
  ];
  if (count === 1) return ["rgba(249,115,22,0.35)", "rgba(249,115,22,0.25)"];
  if (count === 2) return ["rgba(249,115,22,0.60)", "rgba(249,115,22,0.50)"];
  if (count === 3) return ["rgba(249,115,22,0.80)", "rgba(249,115,22,0.70)"];
  return ["#F97316", "#D4620C"];
}

// ── Cell animée ───────────────────────────────────────────────────────────────
const HeatCell = React.memo(function HeatCell({
  count, isDark, onPress, isSelected, isToday, colIdx, rowIdx,
}: {
  count: number; isDark: boolean;
  onPress: () => void;
  isSelected: boolean;
  isToday: boolean;
  colIdx: number; rowIdx: number;
}) {
  const scale = useSharedValue(1);
  const [colors] = useState(() => cellColor(count, isDark));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

   const CELL = ns(15);
  const GAP = ns(3);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.82, { damping: 18, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 240 }); }}
      style={{ width: CELL, height: CELL, margin: GAP / 2 }}
    >
      <Animated.View style={[{ width: CELL, height: CELL, borderRadius: ns(3) }, animStyle]}>
        <LinearGradient
          colors={colors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: ns(3),
            borderWidth: isSelected ? 1.5 : isToday ? 1.5 : 0,
            borderColor: isSelected ? "#FFFFFF" : isToday ? ORANGE : "transparent",
            ...(Platform.OS === "ios" && count > 0 ? {
              shadowColor: ORANGE,
              shadowOpacity: count >= 4 ? 0.55 : count >= 2 ? 0.30 : 0.15,
              shadowRadius: count >= 4 ? 4 : 2,
              shadowOffset: { width: 0, height: 0 },
            } : {}),
          }}
        />
      </Animated.View>
    </Pressable>
  );
});

// ── Composant principal ───────────────────────────────────────────────────────
export default function ActivityHeatmap({ days, isDark, t, weeks = 16 }: Props) {
  const [selected, setSelected] = useState<HeatmapDay | null>(null);
  const CELL = ns(15);
  const GAP = ns(3);
  const CELL_TOTAL = CELL + GAP;

  // ── Construit la grille semaine × jour ──────────────────────────────────
  const { grid, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Index par date
    const byDate: Record<string, number> = {};
    days.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.count; });

    // Recule au lundi de la semaine courante
    const startDate = new Date(today);
    const dow = (startDate.getDay() + 6) % 7; // lundi = 0
    startDate.setDate(startDate.getDate() - dow - (weeks - 1) * 7);

    const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < weeks; w++) {
      const week: { date: string; count: number; isToday: boolean; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const key = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
        const isFuture = date > today;
        const isToday = date.getTime() === today.getTime();

        // Label mois
        if (date.getMonth() !== lastMonth && d === 0) {
          lastMonth = date.getMonth();
          monthLabels.push({
            col: w,
            label: date.toLocaleString("default", { month: "short" }),
          });
        }

        week.push({ date: key, count: isFuture ? 0 : (byDate[key] || 0), isToday, isFuture });
      }
      grid.push(week);
    }

    return { grid, monthLabels };
  }, [days, weeks]);

  // ── Stats résumé ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalDays = days.filter(d => d.count > 0).length;
    const totalMarks = days.reduce((s, d) => s + d.count, 0);
    // Streak actuel
    // Streak — O(1) avec Set
    const dateSet = new Set(days.filter(d => d.count > 0).map(d => d.date));
    let streak = 0;
    const todayForStreak = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayForStreak);
      d.setDate(todayForStreak.getDate() - i);
      const key = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      if (dateSet.has(key)) streak++;
      else break;
    }
    return { totalDays, totalMarks, streak };
  }, [days]);

  const DAY_LABELS = useMemo(() => ["L","M","M","J","V","S","D"], []);

  const tooltipAnim = useSharedValue(0);
  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipAnim.value,
    transform: [{ translateY: (1 - tooltipAnim.value) * 6 }],
  }));

  const handleCellPress = useCallback((day: { date: string; count: number; isToday: boolean; isFuture: boolean }) => {
    if (day.isFuture) return;
    setSelected(prev => prev?.date === day.date ? null : { date: day.date, count: day.count });
    tooltipAnim.value = withTiming(1, { duration: 180 });
  }, []);

  const scrollRef = React.useRef<ScrollView>(null);

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(420)} style={{ marginBottom: ns(14) }}>
      <LinearGradient
        colors={isDark
          ? ["rgba(26,11,2,0.97)", "rgba(16,7,1,0.94)"]
          : ["rgba(255,255,255,0.99)", "rgba(255,246,238,0.96)"]}
        style={{
          borderRadius: ns(22),
          borderWidth: 1,
          borderColor: isDark ? wa(ORANGE, 0.22) : wa(ORANGE, 0.15),
          overflow: "hidden",
          padding: ns(16),
          ...(Platform.OS === "ios" ? {
            shadowColor: ORANGE,
            shadowOpacity: 0.13,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          } : { elevation: 5 }),
        }}
      >
        {/* Glow coin */}
        <View pointerEvents="none" style={{
          position: "absolute", top: -ns(26), right: -ns(26),
          width: ns(100), height: ns(100), borderRadius: ns(50),
          backgroundColor: wa(ORANGE, isDark ? 0.14 : 0.09),
        }} />

        {/* ── Header ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ns(14) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ns(8) }}>
            <View style={{
              width: ns(32), height: ns(32), borderRadius: ns(9),
              backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.10),
              borderWidth: 1, borderColor: wa(ORANGE, isDark ? 0.30 : 0.16),
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="calendar-outline" size={ns(16)} color={ORANGE} />
            </View>
            <View>
              <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: isDark ? "#FFFFFF" : "#1A0800", includeFontPadding: false }}>
                {t("heatmap.title", { defaultValue: "Activité" })}
              </Text>
              <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5), color: isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.40)", includeFontPadding: false }}>
                {t("heatmap.subtitle", { defaultValue: "16 dernières semaines" })}
              </Text>
            </View>
          </View>

          {/* Pill streak uniquement */}
          <View style={{
            paddingHorizontal: ns(10), paddingVertical: ns(5),
            borderRadius: ns(999),
            backgroundColor: summary.streak > 0
              ? wa(ORANGE, isDark ? 0.20 : 0.12)
              : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            borderWidth: 1,
            borderColor: summary.streak > 0 ? wa(ORANGE, 0.35) : "transparent",
            flexDirection: "row", alignItems: "center", gap: ns(5),
          }}>
            <Ionicons
              name="flame"
              size={ns(11)}
              color={summary.streak > 0 ? ORANGE : isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.25)"}
            />
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: ns(11),
              color: summary.streak > 0 ? ORANGE : isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)",
            }}>
              {summary.streak > 0
                ? `${summary.streak}j streak 🔥`
                : `Pas de streak`}
            </Text>
          </View>
        </View>

        {/* ── Tooltip sélection ── */}
        {selected && (
          <Animated.View style={[{
            marginBottom: ns(10),
            paddingHorizontal: ns(12), paddingVertical: ns(8),
            borderRadius: ns(12),
            backgroundColor: isDark ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
            borderWidth: 1, borderColor: wa(ORANGE, 0.25),
            flexDirection: "row", alignItems: "center", gap: ns(8),
          }, tooltipStyle]}>
            <View style={{
              width: ns(8), height: ns(8), borderRadius: ns(4),
              backgroundColor: cellColor(selected.count, isDark)[0],
            }} />
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(11.5), color: isDark ? "#FFFFFF" : "#1A0800", flex: 1 }}>
              {selected.date} — {selected.count > 0
                ? t("heatmap.marked", { count: selected.count, defaultValue: `${selected.count} défi${selected.count > 1 ? "s" : ""} marqué${selected.count > 1 ? "s" : ""}` })
                : t("heatmap.noMark", { defaultValue: "Aucun défi ce jour" })}
            </Text>
            <Pressable onPress={() => setSelected(null)} hitSlop={8}>
              <Ionicons name="close" size={ns(14)} color={isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)"} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Grille scrollable ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={scrollRef}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={{ paddingRight: ns(4) }}
        >
          <View>
            {/* Labels mois */}
            <View style={{ flexDirection: "row", marginBottom: ns(4), height: ns(14) }}>
              <View style={{ width: ns(18) }} /> 
              {grid.map((_, colIdx) => {
                const ml = monthLabels.find(m => m.col === colIdx);
                return (
                  <View key={colIdx} style={{ width: CELL_TOTAL }}>
                    {ml && (
                      <Text style={{
                        fontFamily: "Comfortaa_400Regular",
                        fontSize: ns(9),
                        color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.36)",
                        includeFontPadding: false,
                      }}>
                        {ml.label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Rows L→D */}
            <View style={{ flexDirection: "row" }}>
              {/* Labels jours */}
              <View style={{ justifyContent: "space-around", marginRight: ns(4) }}>
                {DAY_LABELS.map((d, i) => (
                  <Text key={i} style={{
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(7.5),
                    color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
                    height: CELL_TOTAL,
                    textAlignVertical: "center",
                    includeFontPadding: false,
                    lineHeight: CELL_TOTAL,
                  }}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Colonnes semaines */}
              {grid.map((week, colIdx) => (
                <View key={colIdx} style={{ flexDirection: "column" }}>
                  {week.map((day, rowIdx) => (
                    <HeatCell
                      key={day.date}
                      count={day.isFuture ? -1 : day.count}
                      isDark={isDark}
                      isSelected={selected?.date === day.date}
                      isToday={day.isToday}
                      onPress={() => handleCellPress(day)}
                      colIdx={colIdx}
                      rowIdx={rowIdx}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── Légende ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: ns(4), marginTop: ns(10) }}>
          <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)" }}>
            {t("heatmap.less", { defaultValue: "Moins" })}
          </Text>
          {[0, 1, 2, 3, 4].map(level => (
            <LinearGradient
              key={level}
              colors={cellColor(level, isDark) as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: ns(11), height: ns(11), borderRadius: ns(2.5) }}
            />
          ))}
          <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)" }}>
            {t("heatmap.more", { defaultValue: "Plus" })}
          </Text>
        </View>

        {/* ── Stat bar bas ── */}
        <View style={{
          flexDirection: "row",
          marginTop: ns(12),
          paddingTop: ns(10),
          borderTopWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(249,115,22,0.10)",
          gap: ns(0),
        }}>
          {[
            { icon: "calendar-outline" as const, val: `${summary.totalDays}`, label: t("heatmap.activeDays", { defaultValue: "jours actifs" }) },
            { icon: "checkmark-done-outline" as const, val: `${summary.totalMarks}`, label: t("heatmap.totalMarks", { defaultValue: "marquages" }) },
            { icon: "flame-outline" as const, val: `${summary.streak}`, label: t("heatmap.currentStreak", { defaultValue: "jours de suite" }) },
          ].map(({ icon, val, label }, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: ns(2) }}>
              <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(18), color: ORANGE, includeFontPadding: false }}>
                {val}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: ns(3) }}>
                <Ionicons name={icon} size={ns(9)} color={isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"} />
                <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(9.5), color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.36)", textAlign: "center" }}>
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}