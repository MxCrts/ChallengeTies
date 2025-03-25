import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import designSystem from "../theme/designSystem";

const { lightTheme } = designSystem;
const currentTheme = lightTheme; // Utilisation de votre palette

type ModalExplicatifProps = {
  onClose: () => void;
};

export default function ModalExplicatif({ onClose }: ModalExplicatifProps) {
  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Votre avis compte !</Text>
          <Text style={styles.message}>
            Bienvenue sur la page des nouvelles fonctionnalités ! Ici, vous
            pouvez contribuer à l’évolution de l’application.
          </Text>
          <Text style={styles.message}>Vous avez deux options :</Text>
          <Text style={styles.message}>
            • Voter pour une proposition existante proposée par un autre
            utilisateur.
          </Text>
          <Text style={styles.message}>
            • Proposer votre propre idée, qui sera ajoutée et votée dès votre
            soumission.
          </Text>
          <Text style={styles.message}>
            À la fin de la période de vote, la fonctionnalité avec le plus de
            votes sera sélectionnée pour être implémentée rapidement.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color={currentTheme.colors.cardBackground}
            />
            <Text style={styles.closeButtonText}>J'ai compris</Text>
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
