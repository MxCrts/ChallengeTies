// components/SendInvitationModal.tsx
import React, { useState } from "react";
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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { db, auth } from "@/constants/firebase-config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { createDirectInvitation } from "@/services/invitationService";

type Props = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  selectedDays: number;
  challengeTitle?: string; // affichage uniquement (non envoyé à Firestore)
};

export default function SendInvitationModal({
  visible,
  onClose,
  challengeId,
  selectedDays,
  challengeTitle,
}: Props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const mapError = (e: unknown): string => {
    const msg = String((e as any)?.message || e || "").toLowerCase();
    if (msg.includes("missing or insufficient permissions")) {
      return t("invitationS.errors.permissions", {
        defaultValue:
          "Permissions insuffisantes. Vérifie que tu es bien connecté et que les règles Firestore autorisent cette action.",
      });
    }
    if (msg.includes("utilisateur non connecté")) {
      return t("commonS.notLoggedIn", { defaultValue: "Tu dois être connecté." });
    }
    if (msg.includes("invitation_already_active")) {
      return t("invitationS.errors.alreadyInvited", {
        defaultValue: "Une invitation est déjà active.",
      });
    }
    if (msg.includes("auto_invite")) {
      return t("invitationS.errors.autoInvite", {
        defaultValue: "Tu ne peux pas t’inviter toi-même.",
      });
    }
    return t("invitationS.errors.unknown", { defaultValue: "Erreur inconnue." });
  };

  const handleSend = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    const me = auth.currentUser?.uid;
    if (!me) {
      setErrorMsg(
        t("commonS.notLoggedIn", { defaultValue: "Tu dois être connecté." })
      );
      return;
    }

    if (!challengeId || !Number.isInteger(selectedDays) || selectedDays <= 0) {
      setErrorMsg(
        t("invitationS.errors.params", {
          defaultValue: "Paramètres invalides pour l’invitation.",
        })
      );
      return;
    }

    if (!username.trim()) {
      setErrorMsg(
        t("invitationS.errors.usernameRequired", {
          defaultValue: "Entre le nom d’utilisateur de ton ami.",
        })
      );
      return;
    }

    setLoading(true);
    try {
      // 1) Trouver l'utilisateur par username
      const q = query(collection(db, "users"), where("username", "==", username.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setErrorMsg(
          t("invitationS.errors.userNotFound", {
            defaultValue: "Aucun utilisateur trouvé avec ce nom.",
          })
        );
        return;
      }

      const inviteeDoc = snap.docs[0];
      const inviteeId = inviteeDoc.id;

      // 2) Empêcher l’auto-invite
      if (inviteeId === me) {
        setErrorMsg(
          t("invitationS.errors.autoInvite", {
            defaultValue: "Tu ne peux pas t’inviter toi-même.",
          })
        );
        return;
      }

      const inviteeData = inviteeDoc.data() as any;
      const inviteeUsername: string | null = inviteeData?.username ?? null;

      // 3) Créer l’invitation DIRECT conforme aux rules
      await createDirectInvitation({
  challengeId,
  selectedDays,
  inviteeId,
  inviteeUsername,
});

      setSuccessMsg(
        t("invitationS.sent", { defaultValue: "Invitation envoyée ✅" })
      );
      setUsername("");
    } catch (e) {
      console.error("🔥 createDirectInvitation error:", e);
      setErrorMsg(mapError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Animated.View entering={FadeInUp} style={styles.container}>
          {/* Close */}
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
          >
            <Ionicons name="close" size={24} color="#333" />
          </Pressable>

          {/* Title */}
          <Text style={styles.title}>
            {t("invitationS.title", { defaultValue: "Inviter un ami" })}
          </Text>

          {!!challengeTitle && (
            <Text style={styles.challenge}>
              {t("challengeDetails.challenge", { defaultValue: "Défi" })}: {challengeTitle}
            </Text>
          )}

          <Text style={styles.subtitle}>
            {t("invitationS.subtitleDirect", {
              defaultValue:
                "Entre le nom d’utilisateur exact de ton ami pour lui envoyer une invitation.",
            })}
          </Text>

          {/* Input */}
          <TextInput
            style={styles.input}
            placeholder={t("invitationS.usernamePlaceholder", {
              defaultValue: "Nom d’utilisateur",
            })}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Messages */}
          {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
          {!!successMsg && <Text style={styles.success}>{successMsg}</Text>}

          {/* Send */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSend}
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
                  {t("invitationS.send", { defaultValue: "Envoyer l’invitation" })}
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
    marginBottom: 4,
    textAlign: "center",
    color: "#111",
  },
  challenge: {
    textAlign: "center",
    color: "#444",
    fontSize: 14,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 16,
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
