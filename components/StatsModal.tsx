// components/StatsModal.tsx
import React, { useMemo, memo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

type Day = { day: number; date: Date; completed: boolean };

const WEEKDAYS_FALLBACK: Record<string, string[]> = {
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  it: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  hi: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"],
  ar: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  pt: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
  ja: ["月", "火", "水", "木", "金", "土", "日"],
  ko: ["월", "화", "수", "목", "금", "토", "일"],
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

const withAlpha = (color: string, a: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const alpha = Math.round(clamp(a) * 255)
    .toString(16)
    .padStart(2, "0");

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  if (!hexMatch.test(color)) return color;

  const clean = color.replace("#", "");
  if (clean.length === 3) {
    const r = clean[0];
    const g = clean[1];
    const b = clean[2];
    return `#${r}${r}${g}${g}${b}${b}${alpha}`;
  }
  return `#${clean}${alpha}`;
};

/* --- Légende mémoïsée --- */
const LegendDot = memo(function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <View style={legendStyles.wrapper}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={legendStyles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const legendStyles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  text: {
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
    color: "#888",
  },
});

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
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const circle = useMemo(() => {
    const col = Math.floor((Math.min(width, 440) - 16) / 7);
    return Math.max(30, Math.min(col - 6, 42));
  }, [width]);

  const modalMaxWidth = useMemo(
    () => Math.min(width - 32, 440),
    [width]
  );

  const modalMaxHeight = useMemo(
    () =>
      Math.min(
        520,
        height - insets.top - insets.bottom - 48
      ),
    [height, insets.top, insets.bottom]
  );

  const weekDays: string[] = useMemo(() => {
    const raw = t("statsModal.weekdays", {
      returnObjects: true,
      defaultValue: [],
    }) as unknown;
    if (Array.isArray(raw) && raw.length) return raw as string[];
    const lang = (i18n.language || "en").split("-")[0].toLowerCase();
    return WEEKDAYS_FALLBACK[lang] || WEEKDAYS_FALLBACK.en;
  }, [t, i18n.language]);

  const textMainColor = useMemo(
    () => (isDarkMode ? currentTheme.colors.textPrimary : "#000"),
    [isDarkMode, currentTheme.colors.textPrimary]
  );
  const textSecondaryColor = useMemo(
    () => (isDarkMode ? currentTheme.colors.textSecondary : "#555"),
    [isDarkMode, currentTheme.colors.textSecondary]
  );

  const borderSoft = useMemo(
    () => withAlpha(currentTheme.colors.border, 0.55),
    [currentTheme.colors.border]
  );
  const borderSofter = useMemo(
    () => withAlpha(currentTheme.colors.border, 0.5),
    [currentTheme.colors.border]
  );

  const handleClose = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    onClose();
  }, [onClose]);

  const handlePrevMonth = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    goToPrevMonth();
  }, [goToPrevMonth]);

  const handleNextMonth = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    goToNextMonth();
  }, [goToNextMonth]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      {/* OVERLAY FULLSCREEN SIMPLE */}
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Backdrop – clique pour fermer */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("statsModal.close", {
            defaultValue: "Fermer le calendrier",
          })}
        />

        {/* Carte centrée */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: currentTheme.colors.background,
              borderColor: borderSoft,
              maxWidth: modalMaxWidth,
              maxHeight: modalMaxHeight,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityLabel={t("statsModal.close")}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="close-stats-modal"
            >
              <Ionicons name="close" size={22} color={textMainColor} />
            </TouchableOpacity>

            <Text
              style={[styles.title, { color: textMainColor }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {t("statsModal.title", {
                month: monthName,
                year: currentYearNum,
              })}
            </Text>

            <View style={{ width: 22 }} />
          </View>

          {/* Corps scrollable */}
          <View style={styles.body}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Légende */}
              <View style={styles.legendRow}>
                <LegendDot
                  color={isDarkMode ? "#4ADE80" : "#22C55E"}
                  label={t("statsModal.completed", {
                    defaultValue: "Fait",
                  })}
                />
                <LegendDot
                  color={withAlpha(
                    currentTheme.colors.border,
                    isDarkMode ? 0.6 : 0.8
                  )}
                  label={t("statsModal.pending", {
                    defaultValue: "À faire",
                  })}
                />
              </View>

              {/* Calendrier */}
              <View
                style={[
                  styles.calendarContainer,
                  {
                    backgroundColor: currentTheme.colors.cardBackground,
                    borderColor: borderSofter,
                  },
                ]}
              >
                <View style={styles.weekDaysContainer}>
                  {weekDays.map((abbr, idx) => (
                    <Text
                      key={`${abbr}-${idx}`}
                      style={[styles.weekDay, { color: textSecondaryColor }]}
                      numberOfLines={1}
                    >
                      {abbr}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysContainer}>
                  {calendarDays.map((day, idx) => {
                    if (!day) {
                      return (
                        <View
                          key={`empty-${idx}`}
                          style={[styles.dayWrapper, { height: circle }]}
                        />
                      );
                    }
                    const completed = day.completed;
                    return (
                      <View
                        key={`${day.day}-${idx}`}
                        style={[styles.dayWrapper, { height: circle }]}
                      >
                        <View
                          style={[
                            styles.dayCircle,
                            {
                              width: circle,
                              height: circle,
                              borderRadius: circle / 2,
                              borderColor: withAlpha(
                                currentTheme.colors.border,
                                0.6
                              ),
                              backgroundColor: completed
                                ? isDarkMode
                                  ? "#FFB347"
                                  : "#4ADE80"
                                : "transparent",
                              borderWidth: completed
                                ? 0
                                : StyleSheet.hairlineWidth,
                            },
                          ]}
                          accessibilityLabel={t("statsModal.dayLabel", {
                            defaultValue: "Jour {{n}}",
                            n: day.day,
                          })}
                          accessibilityState={{ selected: completed }}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              {
                                color: completed ? "#000" : textMainColor,
                                fontFamily: completed
                                  ? "Comfortaa_700Bold"
                                  : "Comfortaa_400Regular",
                              },
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
            </ScrollView>
          </View>

          {/* Footer nav mois */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[
                styles.navButton,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: borderSofter,
                },
              ]}
              accessibilityLabel={t("statsModal.prevMonth")}
              accessibilityRole="button"
              testID="prev-month-button"
            >
              <Ionicons name="chevron-back" size={20} color={textMainColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={[
                styles.navButton,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: borderSofter,
                },
              ]}
              accessibilityLabel={t("statsModal.nextMonth")}
              accessibilityRole="button"
              testID="next-month-button"
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textMainColor}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* --- Styles --- */
const styles = StyleSheet.create({
  // Overlay plein écran, centrage simple
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
  body: {
    flexShrink: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  scroll: {
    maxHeight: "100%",
  },
  scrollContent: {
    paddingBottom: 4,
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
