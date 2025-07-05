import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeOutDown,
  Layout,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const dayOptions = [7, 14, 21, 30, 60, 90, 180, 365];

interface InviteFriendModalProps {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  onSendInvitation?: (username: string, days: number) => void;
}

export default function InviteFriendModal({
  visible,
  onClose,
  challengeId,
  onSendInvitation,
}: InviteFriendModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [username, setUsername] = useState("");
  const [selectedDays, setSelectedDays] = useState(7);

  const handleSend = () => {
    if (!username.trim()) return;
    if (onSendInvitation) {
      onSendInvitation(username.trim(), selectedDays);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    setUsername("");
    setSelectedDays(7);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalContainer}>
        <Animated.View
          entering={FadeInUp.springify()}
          exiting={FadeOutDown.duration(300)}
          layout={Layout.springify()}
          style={[
            styles.modalContent,
            { backgroundColor: currentTheme.colors.cardBackground },
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              { color: currentTheme.colors.secondary },
            ]}
          >
            {t("inviteFriendModal.title", "Invite a Friend")}
          </Text>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="person-outline"
              size={normalize(20)}
              color={currentTheme.colors.secondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { color: currentTheme.colors.textPrimary }]}
              placeholder={t("inviteFriendModal.usernamePlaceholder", "Username")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Days Options */}
          <Text
            style={[
              styles.daysTitle,
              { color: currentTheme.colors.secondary },
            ]}
          >
            {t("inviteFriendModal.selectDuration", "Select Duration")}
          </Text>
          <View style={styles.daysContainer}>
            {dayOptions.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.dayOption,
                  {
                    backgroundColor:
                      selectedDays === days
                        ? currentTheme.colors.primary
                        : currentTheme.colors.background,
                    borderColor: currentTheme.colors.primary,
                  },
                ]}
                onPress={() => setSelectedDays(days)}
              >
                <Text
                  style={{
                    color:
                      selectedDays === days
                        ? "#fff"
                        : currentTheme.colors.textPrimary,
                    fontFamily: "Comfortaa_700Bold",
                    fontSize: normalize(14),
                  }}
                >
                  {days} {t("inviteFriendModal.days", "days")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.buttonWrapper}
              onPress={handleSend}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {t("inviteFriendModal.send", "Send")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonWrapper}
              onPress={onClose}
            >
              <LinearGradient
                colors={[currentTheme.colors.error, "#FF6B6B"]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {t("inviteFriendModal.cancel", "Cancel")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: normalize(20),
  },
  modalContent: {
    width: "100%",
    borderRadius: normalize(20),
    padding: normalize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(8),
    elevation: 8,
  },
  modalTitle: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(20),
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: normalize(1),
    borderRadius: normalize(12),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    marginBottom: normalize(16),
  },
  inputIcon: {
    marginRight: normalize(8),
  },
  input: {
    flex: 1,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  daysTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(8),
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: normalize(20),
  },
  dayOption: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    borderWidth: normalize(1.5),
    borderRadius: normalize(8),
    margin: normalize(4),
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  buttonWrapper: {
    flex: 1,
    marginHorizontal: normalize(6),
    borderRadius: normalize(10),
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: normalize(12),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },
});
