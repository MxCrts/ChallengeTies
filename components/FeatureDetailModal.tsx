import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Feature {
  id: string;
  title: string;
  votes: number;
  approved?: boolean;
  description?: string;
  username?: string;
}

interface FeatureDetailModalProps {
  visible: boolean;
  feature: {
    id: string;
    title: string;
    votes: number;
    description?: string;
  };
  userVoted: boolean;
  onVote: (featureId: string) => void;
  onClose: () => void;
  onShare?: () => Promise<void>; // Nouvelle prop, optionnelle
}

export default function FeatureDetailModal({
  visible,
  feature,
  userVoted,
  onVote,
  onClose,
  onShare,
}: FeatureDetailModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Ajustement de l'opacité pour le fond en mode dark
  const modalBackgroundColor = isDarkMode
    ? `${currentTheme.colors.cardBackground}E6` // Opacité à ~90% (E6 en hex)
    : currentTheme.colors.cardBackground;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: modalBackgroundColor,
              maxWidth: Math.min(SCREEN_WIDTH * 0.85, 400),
            },
          ]}
        >
          <Text
            style={[styles.title, { color: currentTheme.colors.textPrimary }]}
          >
            {feature.title}
          </Text>
          {feature.description && (
            <Text
              style={[
                styles.description,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {feature.description}
            </Text>
          )}
          <Text
            style={[styles.voteCount, { color: currentTheme.colors.primary }]}
          >
            {t("featureDetail.votes", { count: feature.votes })}
          </Text>
          {!userVoted ? (
            <TouchableOpacity
              style={[
                styles.voteButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => onVote(feature.id)}
            >
              <Text
                style={[
                  styles.voteButtonText,
                  { color: currentTheme.colors.cardBackground },
                ]}
              >
                {t("featureDetail.vote")}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={[
                styles.alreadyVotedText,
                { color: currentTheme.colors.textSecondary + "CC" },
              ]}
            >
              {t("featureDetail.alreadyVoted")}
            </Text>
          )}
          {onShare && (
            <TouchableOpacity
              style={[
                styles.voteButton,
                { backgroundColor: currentTheme.colors.secondary },
              ]}
              onPress={onShare}
            >
              <Text
                style={[
                  styles.voteButtonText,
                  { color: currentTheme.colors.cardBackground },
                ]}
              >
                {t("featureDetail.share")}
              </Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "transparent", // Rendu dynamique via modalBackgroundColor
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 15,
    textAlign: "center",
  },
  voteCount: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 20,
  },
  voteButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  voteButtonText: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },
  alreadyVotedText: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 15,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
