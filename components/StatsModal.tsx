import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

type Day = { day: number; date: Date; completed: boolean };

const WEEKDAYS_FALLBACK: Record<string, string[]> = {
  fr: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],
  en: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  es: ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],
  it: ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"],
  de: ["Mo","Di","Mi","Do","Fr","Sa","So"],
  zh: ["周一","周二","周三","周四","周五","周六","周日"],
  hi: ["सोम","मंगल","बुध","गुरु","शुक्र","शनि","रवि"],
  ar: ["الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت","الأحد"],
  ru: ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
  pt: ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],
  ja: ["月","火","水","木","金","土","日"],
  ko: ["월","화","수","목","금","토","일"],
};

interface Props {
  visible: boolean;
  onClose: () => void;
  monthName: string;
  currentYearNum: number;
  calendarDays: (Day | null)[];
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
}

const withAlpha = (hex: string, a: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const alpha = Math.round(clamp(a) * 255).toString(16).padStart(2, "0");
  const clean = hex.replace("#", "");
  if (clean.length === 3) return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}${alpha}`;
  return `#${clean}${alpha}`;
};

export default function StatsModal({
  visible,
  onClose,
  monthName,
  currentYearNum,
  calendarDays,
  goToPrevMonth,
  goToNextMonth,
}: Props) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const circle = useMemo(() => {
    const col = Math.floor((Math.min(width, 440) - 16) / 7);
    return Math.max(30, Math.min(col - 6, 42));
  }, [width]);

  const weekDays: string[] = useMemo(() => {
    const raw = t("statsModal.weekdays", { returnObjects: true, defaultValue: [] }) as unknown;
    if (Array.isArray(raw) && raw.length) return raw as string[];
    const lang = (i18n.language || "en").split("-")[0].toLowerCase();
    return WEEKDAYS_FALLBACK[lang] || WEEKDAYS_FALLBACK.en;
  }, [t, i18n.language]);

  if (!visible) return null;

  const handleClose = async () => { try { await Haptics.selectionAsync(); } catch {} onClose(); };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      {/* root plein écran */}
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={styles.root}
        accessibilityViewIsModal
        accessibilityLabel={t("statsModal.a11yOverlay", { defaultValue: "Calendrier des progrès" })}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Container centré via flex */}
        <View
          style={[
            styles.center,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: 16,
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={ZoomIn.springify().damping(18)}
            exiting={ZoomOut.duration(140)}
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.colors.background,
                borderColor: withAlpha(currentTheme.colors.border, 0.55),
              },
            ]}
            accessibilityRole="summary"
            testID="stats-modal-card"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                accessibilityLabel={t("statsModal.close")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="close-stats-modal"
              >
                <Ionicons name="close" size={22} color={isDarkMode ? currentTheme.colors.textPrimary : "#000"} />
              </TouchableOpacity>

              <Text
                style={[styles.title, { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" }]}
                accessibilityRole="header"
                numberOfLines={2}
              >
                {t("statsModal.title", { month: monthName, year: currentYearNum })}
              </Text>

              <View style={{ width: 22 }} />
            </View>

            {/* Légende */}
            <View style={styles.legendRow}>
              <LegendDot color={isDarkMode ? "#4ADE80" : "#22C55E"} label={t("statsModal.completed", { defaultValue: "Fait" })} />
              <LegendDot color={withAlpha(currentTheme.colors.border, isDarkMode ? 0.6 : 0.8)} label={t("statsModal.pending", { defaultValue: "À faire" })} />
            </View>

            {/* Calendrier */}
            <View style={[
              styles.calendarContainer,
              { backgroundColor: currentTheme.colors.cardBackground, borderColor: withAlpha(currentTheme.colors.border, 0.5) },
            ]}>
              <View style={styles.weekDaysContainer}>
                {weekDays.map((abbr, idx) => (
                  <Text
                    key={`${abbr}-${idx}`}
                    style={[styles.weekDay, { color: isDarkMode ? currentTheme.colors.textSecondary : "#555" }]}
                    numberOfLines={1}
                  >
                    {abbr}
                  </Text>
                ))}
              </View>

              <View style={styles.daysContainer}>
                {calendarDays.map((day, idx) => {
                  if (!day) return <View key={idx} style={[styles.dayWrapper, { height: circle }]} />;
                  const completed = day.completed;
                  return (
                    <View key={`${day.day}-${idx}`} style={[styles.dayWrapper, { height: circle }]}>
                      <View
                        style={[
                          styles.dayCircle,
                          {
                            width: circle,
                            height: circle,
                            borderRadius: circle / 2,
                            borderColor: withAlpha(currentTheme.colors.border, 0.6),
                            backgroundColor: completed ? (isDarkMode ? "#FF6200" : "#4ADE80") : "transparent",
                            borderWidth: completed ? 0 : StyleSheet.hairlineWidth,
                          },
                        ]}
                        accessibilityLabel={t("statsModal.dayLabel", { defaultValue: "Jour {{n}}", n: day.day })}
                        accessibilityState={{ selected: completed }}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: completed ? "#000" : isDarkMode ? currentTheme.colors.textPrimary : "#000" },
                          ]}
                        >
                          {day.day}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={goToPrevMonth}
                style={[
                  styles.navButton,
                  { backgroundColor: currentTheme.colors.cardBackground, borderColor: withAlpha(currentTheme.colors.border, 0.5) },
                ]}
                accessibilityLabel={t("statsModal.prevMonth")}
                testID="prev-month-button"
              >
                <Ionicons name="chevron-back" size={20} color={isDarkMode ? currentTheme.colors.textPrimary : "#000"} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={goToNextMonth}
                style={[
                  styles.navButton,
                  { backgroundColor: currentTheme.colors.cardBackground, borderColor: withAlpha(currentTheme.colors.border, 0.5) },
                ]}
                accessibilityLabel={t("statsModal.nextMonth")}
                testID="next-month-button"
              >
                <Ionicons name="chevron-forward" size={20} color={isDarkMode ? currentTheme.colors.textPrimary : "#000"} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* --- Légende --- */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={legendStyles.wrapper}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={legendStyles.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  text: { fontSize: 12, fontFamily: "Comfortaa_700Bold", color: "#888" },
});

/* --- Styles --- */
const styles = StyleSheet.create({
  root: {
    flex: 1,                      // ✅ remplit TOUT l’écran (clé Android)
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  center: {
    flex: 1,                      // ✅ conteneur centré
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "92%",
    maxWidth: 440,
    maxHeight: 520,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    // ombres
    shadowColor: "#000",
    shadowOffset: { width: 0, height: Platform.OS === "android" ? 6 : 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calendarContainer: {
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekDaysContainer: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Comfortaa_700Bold",
    opacity: 0.85,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayWrapper: {
    width: "14.2857%",
    alignItems: "center",
    marginVertical: 6,
  },
  dayCircle: {
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    fontSize: 13,
    fontFamily: "Comfortaa_400Regular",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
});
