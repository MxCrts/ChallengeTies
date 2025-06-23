import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";

type ModalExplicatifProps = {
  onClose: () => void;
};

export default function ModalExplicatif({ onClose }: ModalExplicatifProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const styles = createStyles(isDarkMode, currentTheme);

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["#1C2526", "#2D3A3A", "#4A5A5A"] // Dégradé sombre cohérent
              : [
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "CC",
                ]
          }
          style={styles.modalContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
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
            <Text style={styles.closeButtonText}>
              {t("explanation.understood")}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean, currentTheme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)", // Plus sombre en mode sombre
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "85%",
      borderRadius: 15,
      padding: 20,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.2,
      shadowRadius: 6,
      elevation: 8,
      borderWidth: isDarkMode ? 1 : 0, // Bordure dorée en mode sombre
      borderColor: isDarkMode ? "#FFD700" : undefined,
    },
    title: {
      fontSize: 22,
      fontFamily: currentTheme.typography.title.fontFamily,
      color: isDarkMode ? currentTheme.colors.textPrimary : "#000000", // Noir en mode clair
      marginBottom: 15,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      fontFamily: currentTheme.typography.body.fontFamily,
      color: isDarkMode
        ? currentTheme.colors.textSecondary
        : currentTheme.colors.textSecondary,
      marginBottom: 10,
      textAlign: "center",
    },
    closeButton: {
      marginTop: 20,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: currentTheme.colors.primary, // Orange ou autre selon le thème
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
