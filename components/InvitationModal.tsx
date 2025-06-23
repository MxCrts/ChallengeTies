import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitation,
} from "../services/invitationService";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import { useRouter } from "expo-router";
import { auth } from "../constants/firebase-config";

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
  const { theme } = useTheme();
  const router = useRouter();

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const [inviterUsername, setInviterUsername] = useState<string>("");
  const [challengeTitle, setChallengeTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Récupérer inviterUsername et challengeTitle
  useEffect(() => {
    const fetchInvitationData = async () => {
      if (!inviteId || !challengeId) {
        console.warn("⚠️ Données manquantes", { inviteId, challengeId });
        onClose();
        return;
      }

      if (!auth.currentUser) {
        console.warn("⚠️ Utilisateur non connecté");
        router.push("/login"); // Redirige vers la page de login
        onClose();
        return;
      }

      try {
        const invitationRef = doc(db, "invitations", inviteId);
        const invitationSnap = await getDoc(invitationRef);
        if (!invitationSnap.exists()) {
          console.warn("⚠️ Invitation non trouvée");
          onClose();
          return;
        }

        const invitation = invitationSnap.data();
        const inviterRef = doc(db, "users", invitation.inviterId);
        const inviterSnap = await getDoc(inviterRef);
        if (inviterSnap.exists()) {
          setInviterUsername(inviterSnap.data().username || "Utilisateur");
        }

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
  }, [inviteId, challengeId, onClose, router]); // Ajoute router aux dépendances

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

  // Définir les styles dynamiquement avec currentTheme
  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
    },
    modalView: {
      backgroundColor: currentTheme.colors.cardBackground,
      borderRadius: 16,
      padding: 25,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
      width: "85%",
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: "Comfortaa_700Bold",
      marginBottom: 15,
      color: currentTheme.colors.secondary,
      textAlign: "center",
    },
    modalText: {
      fontSize: 16,
      fontFamily: "Comfortaa_400Regular",
      marginBottom: 20,
      textAlign: "center",
      color: currentTheme.colors.textSecondary,
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
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 5,
    },
    acceptButton: {
      backgroundColor: currentTheme.colors.primary,
    },
    refuseButton: {
      backgroundColor: currentTheme.colors.error,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Comfortaa_700Bold",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={styles.modalView}
        >
          <Text style={styles.modalTitle}>
            {t("invitation.title", { username: inviterUsername })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.message", { challenge: challengeTitle })}
          </Text>
          <View style={styles.buttonContainer}>
            <Animated.View entering={FadeInUp.delay(200)}>
              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={handleAccept}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{t("invitation.accept")}</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(300)}>
              <TouchableOpacity
                style={[styles.button, styles.refuseButton]}
                onPress={handleRefuse}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{t("invitation.refuse")}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default InvitationModal;
