import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";

interface Day {
  day: number;
  date: Date;
  completed: boolean;
}

interface StatsModalProps {
  visible: boolean;
  onClose: () => void;
  monthName: string; // already translated month
  currentYearNum: number;
  calendarDays: (Day | null)[];
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
}

export default function StatsModal({
  visible,
  onClose,
  monthName,
  currentYearNum,
  calendarDays,
  goToPrevMonth,
  goToNextMonth,
}: StatsModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Translated weekday abbreviations
  const weekDays = t("statsModal.weekdays", {
    returnObjects: true,
  }) as string[];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalContainer,
          {
            backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
          },
        ]}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          {/* Header */}
          <View style={styles.statsModalHeader}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel={t("statsModal.close")}
              testID="close-stats-modal"
            >
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? currentTheme.colors.textPrimary : "#000000"}
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.statsModalTitle,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000",
                },
              ]}
            >
              {t("statsModal.title", {
                month: monthName,
                year: currentYearNum,
              })}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Calendar grid */}
          <View
            style={[
              styles.calendarContainer,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <View style={styles.weekDaysContainer}>
              {weekDays.map((abbr) => (
                <Text
                  key={abbr}
                  style={[
                    styles.weekDay,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textSecondary
                        : "#555555",
                    },
                  ]}
                >
                  {abbr}
                </Text>
              ))}
            </View>
            <View style={styles.daysContainer}>
              {calendarDays.map((day, idx) => (
                <View key={idx} style={styles.dayWrapper}>
                  {day ? (
                    <View
                      style={[
                        styles.dayCircle,
                        day.completed && [
                          styles.dayCompleted,
                          {
                            backgroundColor: isDarkMode ? "#FF6200" : "#4ADE80",
                          },
                        ],
                        { borderColor: currentTheme.colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: day.completed
                              ? "#000000"
                              : isDarkMode
                              ? currentTheme.colors.textPrimary
                              : "#000000",
                          },
                        ]}
                      >
                        {day.day}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyDay} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Month navigation */}
          <View style={styles.statsModalFooter}>
            <TouchableOpacity
              onPress={goToPrevMonth}
              style={[
                styles.navButton,
                { backgroundColor: currentTheme.colors.cardBackground },
              ]}
              accessibilityLabel={t("statsModal.prevMonth")}
              testID="prev-month-button"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={isDarkMode ? currentTheme.colors.textPrimary : "#000000"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goToNextMonth}
              style={[
                styles.navButton,
                { backgroundColor: currentTheme.colors.cardBackground },
              ]}
              accessibilityLabel={t("statsModal.nextMonth")}
              testID="next-month-button"
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={isDarkMode ? currentTheme.colors.textPrimary : "#000000"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  statsModalTitle: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
  },
  calendarContainer: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
  },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dayWrapper: {
    width: "14.28%",
    alignItems: "center",
    marginVertical: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  dayCompleted: {
    borderWidth: 0,
  },
  dayText: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
  },
  emptyDay: {
    width: 32,
    height: 32,
  },
  statsModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  navButton: {
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
