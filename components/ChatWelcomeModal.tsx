// components/ChatWelcomeModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeOut, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { auth, db } from "../constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";

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

/** Petite checkbox maison (sans dépendances) */
const PremiumCheckbox = ({
  checked,
  onToggle,
  label,
  tint,
  textColor,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  tint: string;
  textColor: string;
}) => {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkboxRow}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.checkboxBox, { borderColor: tint }]}>
        {checked ? (
          <LinearGradient
            colors={[tint, tint + "CC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkboxFill}
          >
            <Ionicons name="checkmark" size={normalizeSize(14)} color="#fff" />
          </LinearGradient>
        ) : null}
      </View>
      <Text style={[styles.checkboxLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const ChatWelcomeModal: React.FC<ChatWelcomeModalProps> = ({
  chatId,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const [rules, setRules] = useState<{ title: string; message: string } | null>(null);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const overlayBg = isDarkMode ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.5)";

  const titleText = useMemo(
    () => rules?.title || t("chatRules.title", { defaultValue: "Bienvenue dans ce chat" }),
    [rules, t]
  );
  const messageText = useMemo(
    () =>
      rules?.message ||
      t("chatRules.message", {
        defaultValue:
          "Avant de participer, merci de respecter les règles du chat : bienveillance, respect, aucun contenu offensant, et pas de spam. Bonne discussion !",
      }),
    [rules, t]
  );

  /** Charge l’état d’acceptation + récupère les règles */
  useEffect(() => {
    const run = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId || !chatId) {
          setLoading(false);
          return;
        }

        // déjà accepté ?
        const acceptanceRef = doc(db, `users/${userId}/acceptedChatRules`, chatId);
        const acceptanceDoc = await getDoc(acceptanceRef);
        if (acceptanceDoc.exists()) {
          setHasAccepted(true);
          setLoading(false);
          return;
        }

        // règles du chat
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);
        const data = chatSnap.exists() ? chatSnap.data() : null;

        if (data?.welcomeRules && typeof data.welcomeRules === "object") {
          setRules({
            title: String(data.welcomeRules.title ?? ""),
            message: String(data.welcomeRules.message ?? ""),
          });
        } else {
          // fallback (si pas défini en base)
          setRules({
            title: t("chatRules.title", { defaultValue: "Bienvenue dans ce chat" }),
            message:
              t("chatRules.message", {
                defaultValue:
                  "Avant de participer, merci de respecter les règles du chat : bienveillance, respect, aucun contenu offensant, et pas de spam. Bonne discussion !",
              }) || "",
          });
        }
      } catch (e) {
        // Même en cas d’erreur, on montre un fallback
        setRules({
          title: t("chatRules.title", { defaultValue: "Bienvenue dans ce chat" }),
          message:
            t("chatRules.message", {
              defaultValue:
                "Avant de participer, merci de respecter les règles du chat : bienveillance, respect, aucun contenu offensant, et pas de spam. Bonne discussion !",
            }) || "",
        });
      } finally {
        setLoading(false);
      }
    };
    if (visible) run();
  }, [chatId, visible, t]);

  const handleAccept = useCallback(async () => {
    if (!isChecked) {
      return;
    }
    const userId = auth.currentUser?.uid;
    if (!userId) {
      return;
    }
    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const acceptanceRef = doc(db, `users/${userId}/acceptedChatRules`, chatId);
      await setDoc(acceptanceRef, {
        acceptedAt: new Date().toISOString(),
        chatId,
        device: Platform.OS,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasAccepted(true);
      setIsChecked(false);
      onClose?.();
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [chatId, isChecked, onClose]);

  // Si déjà accepté ou pas visible → rien à rendre
  if (hasAccepted || !visible) return null;

  // Évite un flash blanc lors du fade
  const overlayStyle = useMemo(
    () => [styles.overlay, { backgroundColor: overlayBg, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0 }],
    [overlayBg]
  );

  return (
    <Modal
      transparent
      visible={visible && !hasAccepted}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={overlayStyle}>
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.modalGradient}
          >
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Icone d’accueil */}
              <Animated.View entering={FadeInDown.delay(80).duration(350)}>
                <View style={[styles.heroIcon, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={normalizeSize(36)}
                    color={currentTheme.colors.primary}
                  />
                </View>
              </Animated.View>

              {/* Titre */}
              <Text style={[styles.title, { color: currentTheme.colors.textPrimary }]}>
                {loading ? "…" : titleText}
              </Text>

              {/* Message */}
              {loading ? (
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
              ) : (
                <Text
                  style={[styles.message, { color: currentTheme.colors.textSecondary }]}
                >
                  {messageText}
                </Text>
              )}

              {/* Checkbox d’acceptation */}
              <View style={styles.checkboxContainer}>
                <PremiumCheckbox
                  checked={isChecked}
                  onToggle={() => setIsChecked((v) => !v)}
                  label={t("iHaveReadRules", { defaultValue: "J’ai lu et j’accepte les règles." })}
                  tint={currentTheme.colors.primary}
                  textColor={currentTheme.colors.textPrimary}
                />
              </View>

              {/* CTA Valider */}
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  {
                    opacity: isChecked && !saving ? 1 : 0.6,
                  },
                ]}
                onPress={isChecked && !saving ? handleAccept : undefined}
                disabled={!isChecked || saving}
                accessibilityRole="button"
                accessibilityLabel={t("acceptRulesButton", { defaultValue: "J’accepte et je comprends" })}
              >
                <LinearGradient
                  colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={normalizeSize(18)}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.acceptButtonText}>
                        {t("iUnderstand", { defaultValue: "Je comprends" })}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Bouton secondaire : Fermer */}
              <TouchableOpacity
                onPress={onClose}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
              >
                <Text style={[styles.secondaryText, { color: currentTheme.colors.textSecondary }]}>
                  {t("common.close", { defaultValue: "Fermer" })}
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
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxHeight: SCREEN_HEIGHT * 0.74,
    borderRadius: normalizeSize(22),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(8) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(14),
    elevation: 12,
  },
  modalGradient: {
    flex: 1,
  },
  modalContent: {
    padding: SPACING * 1.5,
    alignItems: "center",
  },
  heroIcon: {
    width: normalizeSize(72),
    height: normalizeSize(72),
    borderRadius: normalizeSize(36),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING * 0.9,
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
    marginBottom: SPACING * 1.4,
    lineHeight: normalizeSize(23),
  },
  checkboxContainer: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: SPACING,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxBox: {
    width: normalizeSize(22),
    height: normalizeSize(22),
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxFill: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_500Medium",
  },
  acceptButton: {
    borderRadius: normalizeSize(24),
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(24),
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  secondaryBtn: {
    marginTop: normalizeSize(10),
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(10),
  },
  secondaryText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },
});

export default ChatWelcomeModal;
