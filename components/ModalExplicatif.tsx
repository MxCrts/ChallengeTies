import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { lightTheme } = designSystem;
const currentTheme = lightTheme; // Utilisation de votre palette

type ModalExplicatifProps = {
  onClose: () => void;
};

export default function ModalExplicatif({ onClose }: ModalExplicatifProps) {
  const { t } = useTranslation();

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{t("explanation.title")}</Text>
          <Text style={styles.message}>{t("explanation.welcome")}</Text>
          <Text style={styles.message}>{t("explanation.optionsIntro")}</Text>
          <Text style={styles.message}>• {t("explanation.optionVote")}</Text>
          <Text style={styles.message}>• {t("explanation.optionPropose")}</Text>
          <Text style={styles.message}>{t("explanation.outcome")}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color={currentTheme.colors.cardBackground}
            />
            <Text style={styles.closeButtonText}>{t("explanation.understood")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: currentTheme.colors.cardBackground, // Fond (blanc par ex.)
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000", // Par exemple noir
    marginBottom: 15,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary, // Gris foncé
    marginBottom: 10,
    textAlign: "center",
  },
  closeButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: currentTheme.colors.primary, // Orange
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.cardBackground, // Blanc
    marginLeft: 10,
  },
});
