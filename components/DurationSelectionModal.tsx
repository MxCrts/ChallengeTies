import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { width: viewportWidth } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

interface DurationSelectionModalProps {
  visible: boolean;
  daysOptions: number[];
  selectedDays: number;
  onSelectDays: (days: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  dayIcons: Record<number, keyof typeof Ionicons.glyphMap>;
}

const DurationSelectionModal: React.FC<DurationSelectionModalProps> = ({
  visible,
  daysOptions,
  selectedDays,
  onSelectDays,
  onConfirm,
  onCancel,
  dayIcons,
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {t("durationModal.title")}
          </Text>
          <View style={styles.daysOptionsContainer}>
            {daysOptions.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.dayOption,
                  selectedDays === days && styles.dayOptionSelected,
                ]}
                onPress={() => onSelectDays(days)}
              >
                <Ionicons
                  name={dayIcons[days] || "alarm-outline"}
                  size={24}
                  color={selectedDays === days ? "#fff" : "#333"}
                />
                <Text
                  style={[
                    styles.dayOptionText,
                    selectedDays === days && { color: "#fff" },
                  ]}
                >
                  {t("durationModal.days", { count: days })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>
              {t("durationModal.confirm")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>
              {t("durationModal.cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Comfortaa_700Bold",
    color: currentTheme.colors.primary,
  },
  daysOptionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 10,
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: currentTheme.colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
  },
  dayOptionSelected: { backgroundColor: currentTheme.colors.primary },
  dayOptionText: {
    marginLeft: 6,
    fontSize: 16,
    color: "#333",
    fontFamily: "Comfortaa_400Regular",
  },
  confirmButton: {
    backgroundColor: currentTheme.colors.primary,
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Bold",
  },
  cancelButton: {
    backgroundColor: currentTheme.colors.error,
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Bold",
  },
});

export default DurationSelectionModal;
