import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";

type ProposeFeatureModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, description?: string) => void;
};

export default function ProposeFeatureModal({
  visible,
  onClose,
  onSubmit,
}: ProposeFeatureModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmission = () => {
    if (!title.trim()) {
      Alert.alert(
        t("proposeFeature.errorTitle"),
        t("proposeFeature.errorNoTitle")
      );
      return;
    }
    onSubmit(title.trim(), description.trim());
    // Réinitialisation du formulaire et fermeture automatique
    setTitle("");
    setDescription("");
    onClose(); // Ferme le modal après soumission
  };

  const styles = createStyles(isDarkMode, currentTheme);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["#1C2526", "#2D3A3A", "#4A5A5A"] // Dégradé sombre cohérent avec NewFeatures
              : [
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "CC",
                ]
          }
          style={styles.modalContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.title}>{t("proposeFeature.modalTitle")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("proposeFeature.placeholderTitle")}
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t("proposeFeature.placeholderDescription")}
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmission}
          >
            <Text style={styles.submitButtonText}>
              {t("proposeFeature.submitButton")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="close-circle-outline"
              size={32}
              color={currentTheme.colors.primary}
            />
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
      backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.6)", // Plus sombre en mode sombre
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "85%",
      borderRadius: 10,
      padding: 20,
      alignItems: "center",
      position: "relative",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.3 : 0.2,
      shadowRadius: 4,
      elevation: 5,
    },
    title: {
      fontSize: 22,
      fontFamily: currentTheme.typography.title.fontFamily,
      color: isDarkMode ? currentTheme.colors.textPrimary : "#000000", // Noir en mode clair
      marginBottom: 15,
      textAlign: "center",
    },
    input: {
      width: "100%",
      backgroundColor: isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(245, 245, 245, 0.8)",
      color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
      borderRadius: 5,
      padding: 10,
      marginBottom: 15,
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? "#FFD700" : undefined, // Bordure dorée en mode sombre
    },
    textArea: {
      height: 100,
      textAlignVertical: "top",
    },
    submitButton: {
      backgroundColor: currentTheme.colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 5,
      marginBottom: 15,
      width: "100%",
      alignItems: "center",
    },
    submitButtonText: {
      color: currentTheme.colors.cardBackground,
      fontSize: 16,
      fontFamily: currentTheme.typography.title.fontFamily,
    },
    closeButton: {
      position: "absolute",
      top: 10,
      right: 10,
    },
  });
