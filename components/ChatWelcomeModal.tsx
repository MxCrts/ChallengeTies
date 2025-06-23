import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { CheckBox } from "react-native-elements";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface ChatWelcomeModalProps {
  chatId: string;
  visible: boolean;
  onClose: () => void;
}

const ChatWelcomeModal: React.FC<ChatWelcomeModalProps> = ({
  chatId,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const [rules, setRules] = useState<{ title: string; message: string } | null>(
    null
  );
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRulesAcceptance = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId || !chatId) {
        setLoading(false);
        return;
      }

      const acceptanceRef = doc(
        db,
        `users/${userId}/acceptedChatRules`,
        chatId
      );
      const acceptanceDoc = await getDoc(acceptanceRef);
      if (acceptanceDoc.exists()) {
        setHasAccepted(true);
        setLoading(false);
        return;
      }

      const chatRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists() && chatDoc.data()?.welcomeRules) {
        setRules(chatDoc.data().welcomeRules);
      }
      setLoading(false);
    };

    checkRulesAcceptance();
  }, [chatId]);

  const handleAccept = async () => {
    if (!isChecked) {
      alert(t("pleaseAcceptRules"));
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert(t("noUserConnected"));
      return;
    }

    try {
      const acceptanceRef = doc(
        db,
        `users/${userId}/acceptedChatRules`,
        chatId
      );
      await setDoc(acceptanceRef, {
        acceptedAt: new Date().toISOString(),
        chatId,
      });
      onClose();
      setIsChecked(false);
    } catch (error) {
      console.error(
        "Erreur lors de l’enregistrement de l’acceptation :",
        error
      );
      alert(t("errorSavingRulesAcceptance"));
    }
  };

  if (hasAccepted || !visible || loading || !rules) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={[
              currentTheme.colors.background,
              currentTheme.colors.cardBackground,
            ]}
            style={styles.modalGradient}
          >
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Ionicons
                name="chatbubbles-outline"
                size={normalizeSize(50)}
                color={currentTheme.colors.primary}
                style={styles.icon}
              />
              <Text
                style={[
                  styles.title,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {rules.title}
              </Text>
              <Text
                style={[
                  styles.message,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {rules.message}
              </Text>
              <View style={styles.checkboxContainer}>
                <CheckBox
                  checked={isChecked}
                  onPress={() => setIsChecked(!isChecked)}
                  checkedColor={currentTheme.colors.primary}
                  uncheckedColor={currentTheme.colors.textSecondary}
                  containerStyle={styles.checkbox}
                  title={t("iHaveReadRules")}
                  textStyle={[
                    styles.checkboxText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                  accessibilityLabel={t("acceptRulesCheckbox")}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  {
                    backgroundColor: isChecked
                      ? currentTheme.colors.primary
                      : currentTheme.colors.textSecondary,
                  },
                ]}
                onPress={handleAccept}
                disabled={!isChecked}
                accessibilityLabel={t("acceptRulesButton")}
              >
                <Text
                  style={[
                    styles.acceptButtonText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("iUnderstand")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  modalGradient: {
    flex: 1,
  },
  modalContent: {
    padding: SPACING * 1.5,
    alignItems: "center",
  },
  icon: {
    marginBottom: SPACING,
  },
  title: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING,
  },
  message: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "left",
    marginBottom: SPACING * 1.5,
  },
  checkboxContainer: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: SPACING,
  },
  checkbox: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  checkboxText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  acceptButton: {
    borderRadius: normalizeSize(24),
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 2,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  acceptButtonText: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
  },
});

export default ChatWelcomeModal;
