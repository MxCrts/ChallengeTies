import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitation,
} from "../services/invitationService";

interface InvitationModalProps {
  visible: boolean;
  inviteId: string | null;
  challengeId: string;
  onClose: () => void;
}

const InvitationModal: React.FC<InvitationModalProps> = ({
  visible,
  inviteId,
  challengeId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [inviterUsername, setInviterUsername] = useState<string>("");
  const [challengeTitle, setChallengeTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Récupérer inviterUsername et challengeTitle
  useEffect(() => {
    const fetchInvitationData = async () => {
      if (!inviteId || !challengeId) return;

      try {
        // Récupérer invitation
        const invitationRef = doc(db, "invitations", inviteId);
        const invitationSnap = await getDoc(invitationRef);
        if (!invitationSnap.exists()) {
          console.warn("⚠️ Invitation non trouvée");
          onClose();
          return;
        }

        const invitation = invitationSnap.data();
        // Récupérer nom de l'inviteur
        const inviterRef = doc(db, "users", invitation.inviterId);
        const inviterSnap = await getDoc(inviterRef);
        if (inviterSnap.exists()) {
          setInviterUsername(inviterSnap.data().username || "Utilisateur");
        }

        // Récupérer titre du challenge
        const challengeRef = doc(db, "challenges", challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (challengeSnap.exists()) {
          setChallengeTitle(challengeSnap.data().title || "Challenge");
        }
      } catch (error) {
        console.error("❌ Erreur récupération données invitation :", error);
        onClose();
      }
    };

    fetchInvitationData();
  }, [inviteId, challengeId]);

  // Gérer acceptation
  const handleAccept = async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      await acceptInvitation(inviteId);
      console.log("✅ Modal : Invitation acceptée");
      onClose();
    } catch (error) {
      console.error("❌ Modal : Erreur acceptation :", error);
    } finally {
      setLoading(false);
    }
  };

  // Gérer refus
  const handleRefuse = async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      await refuseInvitation(inviteId);
      console.log("❌ Modal : Invitation refusée");
      onClose();
    } catch (error) {
      console.error("❌ Modal : Erreur refus :", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>
            {t("invitation.title", { username: inviterUsername })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.message", { challenge: challengeTitle })}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{t("invitation.accept")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.refuseButton]}
              onPress={handleRefuse}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{t("invitation.refuse")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Fond semi-transparent
  },
  modalView: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#555",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 10,
    padding: 12,
    width: "45%",
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "#28A745", // Vert
  },
  refuseButton: {
    backgroundColor: "#DC3545", // Rouge
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default InvitationModal;
