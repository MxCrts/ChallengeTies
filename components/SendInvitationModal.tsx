// components/SendInvitationModal.tsx
import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

// ✅ Service centralisé (open invite)
import { createInvitationAndLink } from "@/services/invitationService";

type Props = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  selectedDays: number;
  /** Optionnel: pour enrichir le message de partage et l’OG */
  challengeTitle?: string;
};

export default function SendInvitationModal({
  visible,
  onClose,
  challengeId,
  selectedDays,
  challengeTitle,
}: Props) {
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Langue courte "fr", "en", etc.
  const lang = useMemo(
    () => String((i18n?.language || "fr").split("-")[0]).toLowerCase(),
    [i18n?.language]
  );

  // Mappe les erreurs "métier" → clés i18n lisibles
  const mapErrorToMessage = (err: unknown): string => {
    const code = String((err as any)?.message || err || "").toLowerCase();

    if (code.includes("auto_invite")) return t("invitationS.errors.autoInvite");
    if (code.includes("invitation_already_active"))
      return t("invitationS.errors.alreadyInvited");
    if (code.includes("restart_inviteur"))
      return t("invitationS.errors.inviterAlreadyStarted");
    if (code.includes("restart_invitee"))
      return t("invitationS.errors.inviteeAlreadyStarted");
    if (code.includes("expirée") || code.includes("expired"))
      return t("invitationS.errors.expired");
    if (code.includes("invalid_challenge") || code.includes("invalid_days"))
      return t("invitationS.errors.unknown");
    if (code.includes("utilisateur non connecté"))
      return t("commonS.notLoggedIn");

    // fallback
    return t("invitationS.errors.unknown");
  };

  const handleShare = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      // 1) Création open invite + lien universel (CF /dl)
      const { universalUrl } = await createInvitationAndLink({
        challengeId,
        selectedDays,
        lang: lang as any,
        title: challengeTitle,
      });

      // 2) Partage natif (message i18n concis)
      const msg =
        (challengeTitle
          ? t("invitationS.shareMessageWithTitle", {
              days: selectedDays,
              title: challengeTitle,
              defaultValue:
                "Rejoins-moi pour ce défi « {{title}} » ! On le fait pendant {{days}} jours 💪",
            })
          : t("invitationS.shareMessage", {
              days: selectedDays,
              defaultValue:
                "Rejoins-moi sur ce défi ! On le tente pendant {{days}} jours 💪",
            })) +
        "\n" +
        universalUrl;

      await Share.share(
        {
          title: t("invitationS.shareTitle", {
            defaultValue: "Inviter un ami",
          }),
          message: msg,
        },
        {
          dialogTitle: t("invitationS.shareTitle", {
            defaultValue: "Inviter un ami",
          }),
        }
      );

      setSuccessMsg(
        t("invitationS.sent", { defaultValue: "Invitation envoyée ✅" })
      );
    } catch (err) {
      console.error("🔥 createInvitationAndLink error:", err);
      setErrorMsg(mapErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Animated.View entering={FadeInUp} style={styles.container}>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
          >
            <Ionicons name="close" size={24} color="#333" />
          </Pressable>

          <Text style={styles.title}>
            {t("invitationS.title", { defaultValue: "Inviter un ami" })}
          </Text>

          <Text style={styles.subtitle}>
            {t("invitationS.subtitle", {
              defaultValue:
                "Un lien sera généré. S’il a l’app, il ouvre ce défi avec un bouton Accepter/Refuser. Sinon, il est redirigé vers le Store.",
            })}
          </Text>

          {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
          {!!successMsg && <Text style={styles.success}>{successMsg}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleShare}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t("invitationS.send", {
              defaultValue: "Envoyer l’invitation",
            })}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>
                  {t("invitationS.send", {
                    defaultValue: "Envoyer l’invitation",
                  })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  closeBtn: { alignSelf: "flex-end" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    color: "#111",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#FFB800",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#d00", textAlign: "center", marginBottom: 10 },
  success: { color: "green", textAlign: "center", marginBottom: 10 },
});
