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
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { lightTheme } = designSystem;
const currentTheme = lightTheme; // Utilisation de la palette de couleurs

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
    // Réinitialisation du formulaire après soumission
    setTitle("");
    setDescription("");
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    position: "relative",
  },
  title: {
    fontSize: 22,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.textPrimary,
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(245, 245, 245, 0.8)",
    color: "#000000",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
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
