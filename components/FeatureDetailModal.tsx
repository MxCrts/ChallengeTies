import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { lightTheme } = designSystem;
const currentTheme = lightTheme; // palette couleurs

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
}

export default function FeatureDetailModal({
  visible,
  feature,
  userVoted,
  onVote,
  onClose,
}: FeatureDetailModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{feature.title}</Text>
          {feature.description && (
            <Text style={styles.description}>{feature.description}</Text>
          )}
          <Text style={styles.voteCount}>
            {t("featureDetail.votes", { count: feature.votes })}
          </Text>
          {!userVoted ? (
            <TouchableOpacity
              style={styles.voteButton}
              onPress={() => onVote(feature.id)}
            >
              <Text style={styles.voteButtonText}>
                {t("featureDetail.vote")}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.alreadyVotedText}>
              {t("featureDetail.alreadyVoted")}
            </Text>
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
    backgroundColor: currentTheme.colors.cardBackground, // fond blanc
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    position: "relative",
  },
  title: {
    fontSize: 22,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary, // gris foncé
    marginBottom: 15,
    textAlign: "center",
  },
  voteCount: {
    fontSize: 18,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.primary, // orange
    marginBottom: 20,
  },
  voteButton: {
    backgroundColor: currentTheme.colors.primary, // orange
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  voteButtonText: {
    fontSize: 16,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.cardBackground, // blanc
  },
  alreadyVotedText: {
    fontSize: 16,
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#AAAAAA",
    marginBottom: 15,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
