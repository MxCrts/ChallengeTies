import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import { auth, db } from "../constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitation,
} from "../services/invitationService";
import { doc, getDoc } from "firebase/firestore";

interface InviteFriendModalProps {
  visible: boolean;
  inviteId: string;
  challengeId: string;
  inviterUsername: string;
  challengeTitle: string;
  onClose: () => void;
}

const InviteFriendModal: React.FC<InviteFriendModalProps> = ({
  visible,
  inviteId,
  challengeId,
  inviterUsername,
  challengeTitle,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [loading, setLoading] = useState(false);

  

  const handleRefuse = async () => {
    try {
      setLoading(true);
      await refuseInvitation(inviteId);
      Alert.alert(t("invitation.refused"), t("invitation.refusedSuccess"));
      onClose();
    } catch (error: any) {
      Alert.alert(t("error"), error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalView: {
      backgroundColor: currentTheme.colors.cardBackground,
      borderRadius: 16,
      padding: 25,
      width: "85%",
      maxWidth: 400,
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontFamily: "Comfortaa_700Bold",
      marginBottom: 10,
      color: currentTheme.colors.secondary,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      fontFamily: "Comfortaa_400Regular",
      marginBottom: 20,
      color: currentTheme.colors.textSecondary,
      textAlign: "center",
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
      shadowOpacity: 0.2,
      shadowRadius: 5,
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
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <Animated.View entering={FadeInUp.duration(300)} style={styles.modalView}>
          <Text style={styles.title}>
            {t("invitation.titleFrom", { username: inviterUsername })}
          </Text>
          <Text style={styles.message}>
            {t("invitation.messageToJoin", { challenge: challengeTitle })}
          </Text>
          <View style={styles.buttonContainer}>
          
            <TouchableOpacity
              style={[styles.button, styles.refuseButton]}
              onPress={handleRefuse}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{t("invitation.refuse")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default InviteFriendModal;
