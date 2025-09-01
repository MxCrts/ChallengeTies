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
  ScrollView,
  ToastAndroid,
  Alert,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { db, auth } from "@/constants/firebase-config";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { createDirectInvitation } from "@/services/invitationService";


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  selectedDays: number;
  challengeTitle?: string;
  onSent?: () => void; // 👈 NEW
};

// Vérifie si l'invité est déjà en DUO sur ce challenge (encore actif)
async function isInviteeAlreadyInActiveDuoForChallenge(params: {
  inviteeId: string;
  challengeId: string;
}): Promise<boolean> {
  const { inviteeId, challengeId } = params;

  try {
    const userRef = doc(db, "users", inviteeId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return false;

    const data = snap.data() as any;
    const arr: any[] = Array.isArray(data?.CurrentChallenges)
      ? data.CurrentChallenges
      : [];

    // On match au mieux : challengeId ou id (tes objets contiennent les 2)
    const found = arr.find((c) => {
      const idMatch =
        c?.challengeId === challengeId ||
        c?.id === challengeId ||
        c?.uniqueKey?.startsWith?.(challengeId + "_"); // tolérance si uniqueKey
      return idMatch && c?.duo === true;
    });

    if (!found) return false;

    // Actif si pas terminé : completedDays < selectedDays
    const selectedDays = Number(found?.selectedDays ?? 0);
    const completedDays = Number(found?.completedDays ?? 0);

    // Si pas d’info sur les jours, on considère "actif" par prudence
    if (!selectedDays && !completedDays) return true;

    return completedDays < selectedDays;
  } catch (e) {
    console.warn("Duo check failed:", e);
    // En cas d'erreur de lecture, on NE bloque pas (retourne false).
    return false;
  }
}

export default function SendInvitationModal({
  visible,
  onClose,
  challengeId,
  selectedDays,
  challengeTitle,
  onSent,
}: Props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const showSuccessToast = () => {
    const msg = t("invitationS.sentShort", { defaultValue: "Invitation envoyée !" });
    if (Platform.OS === "android") {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert("", msg);
    }
  };

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
  if (loading) return;       // anti double-tap
  setErrorMsg("");

  const me = auth.currentUser?.uid;
  if (!me) {
    setErrorMsg(t("commonS.notLoggedIn", { defaultValue: "Tu dois être connecté." }));
    return;
  }

  if (!challengeId || !Number.isInteger(selectedDays) || selectedDays <= 0) {
    setErrorMsg(t("invitationS.errors.params", { defaultValue: "Paramètres invalides pour l’invitation." }));
    return;
  }

  const input = username.trim();
  if (!input) {
    setErrorMsg(t("invitationS.errors.usernameRequired", { defaultValue: "Entre le nom d’utilisateur de ton ami." }));
    return;
  }

  setLoading(true);
  Keyboard.dismiss();

  try {
    // 1) lookup exact
    const q = query(collection(db, "users"), where("username", "==", input));
    const snap = await getDocs(q);
    if (snap.empty) {
      setErrorMsg(t("invitationS.errors.userNotFound", { defaultValue: "Aucun utilisateur trouvé avec ce nom." }));
      return;
    }

    const inviteeDoc = snap.docs[0];
    const inviteeId = inviteeDoc.id;

    // 2) déjà en duo actif ? (même challenge)
    const alreadyInDuo = await isInviteeAlreadyInActiveDuoForChallenge({ inviteeId, challengeId });
    if (alreadyInDuo) {
      setErrorMsg(
        t("invitationS.errors.alreadyInDuoForChallenge", {
          defaultValue: "Impossible d’inviter cet utilisateur : il est déjà en duo pour ce challenge.",
        })
      );
      return;
    }

    // 3) auto-invite ?
    if (inviteeId === me) {
      setErrorMsg(t("invitationS.errors.autoInvite", { defaultValue: "Tu ne peux pas t’inviter toi-même." }));
      return;
    }

    const inviteeData = inviteeDoc.data() as any;
    const inviteeUsername: string | null = inviteeData?.username ?? null;

    // 4) créer l’invitation
    await createDirectInvitation({ challengeId, selectedDays, inviteeId, inviteeUsername });

    // 5) succès -> reset + toast + callback parent
    setUsername("");
    showSuccessToast();

    if (typeof onSent === "function") {
      onSent();      // 👈 redirection + tuto gérés par FirstPick
    } else {
      onClose();     // fallback
    }
  } catch (e) {
    console.error("🔥 createDirectInvitation error:", e);
    setErrorMsg(mapError(e));
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerWrap}>
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

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
                  returnKeyType="send"
                  onSubmitEditing={!loading ? handleSend : undefined}
                />

                {/* Error */}
                {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

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
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const MAX_WIDTH = Math.min(420, SCREEN_WIDTH - 32);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  container: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  closeBtn: { alignSelf: "flex-end" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    color: "#111",
  },
  challenge: {
    textAlign: "center",
    color: "#444",
    fontSize: 14,
    marginBottom: 8,
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
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#FFB800",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 4,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#d00", textAlign: "center", marginTop: 4 },
});
