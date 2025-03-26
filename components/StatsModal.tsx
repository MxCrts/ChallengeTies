import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import designSystem from "../theme/designSystem";

const currentTheme = designSystem.lightTheme;

interface Day {
  day: number;
  date: Date;
  completed: boolean;
}

interface StatsModalProps {
  visible: boolean;
  onClose: () => void;
  monthName: string;
  currentYearNum: number;
  calendarDays: (Day | null)[];
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({
  visible,
  onClose,
  monthName,
  currentYearNum,
  calendarDays,
  goToPrevMonth,
  goToNextMonth,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.statsModalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.statsModalTitle}>
              {monthName} {currentYearNum}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.calendarContainer}>
            <View style={styles.weekDaysContainer}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <Text key={day} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.daysContainer}>
              {calendarDays.map((day, index) => (
                <View key={index} style={styles.dayWrapper}>
                  {day ? (
                    <View
                      style={[
                        styles.dayCircle,
                        day.completed && styles.dayCompleted,
                      ]}
                    >
                      <Text style={styles.dayText}>{day.day}</Text>
                    </View>
                  ) : (
                    <View style={styles.emptyDay} />
                  )}
                </View>
              ))}
            </View>
          </View>
          <View style={styles.statsModalFooter}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#0F172A",
    width: "100%",
    maxWidth: 400,
    borderRadius: 10,
    padding: 20,
  },
  statsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  statsModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  calendarContainer: {
    marginVertical: 10,
  },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 5,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    color: "#aaa",
    fontSize: 12,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayWrapper: {
    width: "14.28%",
    alignItems: "center",
    marginVertical: 4,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  dayCompleted: {
    backgroundColor: "#FACC15",
  },
  dayText: {
    color: "#fff",
    fontSize: 14,
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
  },
});

export default StatsModal;
