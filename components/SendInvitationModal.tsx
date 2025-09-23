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
    if (msg.includes("inviter_has_pending_for_challenge")) {
  return t("invitationS.errors.inviterHasPendingForChallenge", {
    defaultValue: "Tu as déjà une invitation en attente pour ce défi.",
  });
}
if (msg.includes("invitee_has_pending_for_challenge")) {
  return t("invitationS.errors.inviteeHasPendingForChallenge", {
    defaultValue: "Impossible d’inviter cet utilisateur : il a déjà une invitation en attente pour ce défi.",
  });
}
if (msg.includes("pair_already_pending")) {
  return t("invitationS.errors.alreadyInvited", {
    defaultValue: "Une invitation est déjà en attente avec cet utilisateur.",
  });
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
  if (loading) return; // anti double-tap
  setErrorMsg("");

  const me = auth.currentUser?.uid;
  if (!me) {
    setErrorMsg(
      t("commonS.notLoggedIn", { defaultValue: "Tu dois être connecté." })
    );
    return;
  }

  // Validations basiques
  if (!challengeId || !Number.isInteger(selectedDays) || selectedDays <= 0) {
    setErrorMsg(
      t("invitationS.errors.params", {
        defaultValue: "Paramètres invalides pour l’invitation.",
      })
    );
    return;
  }

  const input = username.trim();
  if (!input) {
    setErrorMsg(
      t("invitationS.errors.usernameRequired", {
        defaultValue: "Entre le nom d’utilisateur de ton ami.",
      })
    );
    return;
  }

  setLoading(true);
  Keyboard.dismiss();

  try {
    // 1) Lookup exact par username
    const userQ = query(collection(db, "users"), where("username", "==", input));
    const userSnap = await getDocs(userQ);

    if (userSnap.empty) {
      setErrorMsg(
        t("invitationS.errors.userNotFound", {
          defaultValue: "Aucun utilisateur trouvé avec ce nom.",
        })
      );
      return;
    }

    // (sécurité : on prend le premier si jamais il y en avait plusieurs, mais chez toi c’est unique)
    const inviteeDoc = userSnap.docs[0];
    const inviteeId = inviteeDoc.id;
    const inviteeData = inviteeDoc.data() as any;
    const inviteeUsername: string | null = inviteeData?.username ?? null;

    // 2) auto-invite
    if (inviteeId === me) {
      setErrorMsg(
        t("invitationS.errors.autoInvite", {
          defaultValue: "Tu ne peux pas t’inviter toi-même.",
        })
      );
      return;
    }

    // 3) L'invité est-il DÉJÀ en DUO actif sur CE challenge ?
    const alreadyInDuo = await isInviteeAlreadyInActiveDuoForChallenge({
      inviteeId,
      challengeId,
    });
    if (alreadyInDuo) {
      const msg = t("invitationS.errors.alreadyInDuoForChallenge", {
        defaultValue:
          "Impossible d’inviter cet utilisateur : il est déjà en duo pour ce challenge.",
      });
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      } else {
        Alert.alert("", msg);
      }
      onClose(); // ✅ fermeture immédiate du modal (flow demandé)
      return;
    }

    // 4) Conflits d'invitations "pending"
    // 4a) A (inviter) a-t-il déjà une pending pour CE challenge ?
    let inviterHasPendingForChallenge = false;
    try {
      const qInviter = query(
        collection(db, "invitations"),
        where("inviterId", "==", me),
        where("status", "==", "pending")
      );
      const sInviter = await getDocs(qInviter);
      inviterHasPendingForChallenge = sInviter.docs.some(
        (d) => d.data()?.challengeId === challengeId
      );
      // (on réutilisera sInviter plus bas pour vérifier A→B)
      if (inviterHasPendingForChallenge) {
        const msg = t(
          "invitationS.errors.inviterHasPendingForChallenge",
          { defaultValue: "Tu as déjà une invitation en attente pour ce défi." }
        );
        if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.LONG);
        else Alert.alert("", msg);
        onClose(); // ✅ fermeture
        return;
      }

      // 4b) Existe-t-il déjà une pending A→B pour CE challenge ?
      const pairAlreadyPending = sInviter.docs.some((d) => {
        const data = d.data();
        return (
          data?.inviteeId === inviteeId && data?.challengeId === challengeId
        );
      });
      if (pairAlreadyPending) {
        const msg = t("invitationS.errors.alreadyInvited", {
          defaultValue: "Une invitation est déjà en attente avec cet utilisateur.",
        });
        if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.LONG);
        else Alert.alert("", msg);
        onClose(); // ✅ fermeture
        return;
      }
    } catch (e) {
      // Si erreur d’index, on ne bloque pas ici : le service gérera un 2e filet côté serveur
      console.warn("Pending check (inviter) failed:", e);
    }

    // 4c) B (invitee) a-t-il déjà une pending pour CE challenge ?
    try {
      const qInvitee = query(
        collection(db, "invitations"),
        where("inviteeId", "==", inviteeId),
        where("status", "==", "pending")
      );
      const sInvitee = await getDocs(qInvitee);
      const inviteeHasPendingForChallenge = sInvitee.docs.some(
        (d) => d.data()?.challengeId === challengeId
      );
      if (inviteeHasPendingForChallenge) {
        const msg = t("invitationS.errors.inviteeHasPendingForChallenge", {
          defaultValue:
            "Impossible d’inviter cet utilisateur : il a déjà une invitation en attente pour ce défi.",
        });
        if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.LONG);
        else Alert.alert("", msg);
        onClose(); // ✅ fermeture
        return;
      }
    } catch (e) {
      console.warn("Pending check (invitee) failed:", e);
    }

    // 5) Création de l’invitation
    await createDirectInvitation({
      challengeId,
      selectedDays,
      inviteeId,
      inviteeUsername,
    });

    // 6) Succès → reset, toast, fermeture/callback
    setUsername("");
    const okMsg = t("invitationS.sentShort", {
      defaultValue: "Invitation envoyée !",
    });
    if (Platform.OS === "android") ToastAndroid.show(okMsg, ToastAndroid.SHORT);
    else Alert.alert("", okMsg);

    if (typeof onSent === "function") onSent();
    else onClose();
  } catch (e: any) {
    console.error("🔥 createDirectInvitation error:", e);
    // Mapping d’erreurs lisible
    const msg = String(e?.message || e || "").toLowerCase();
    if (msg.includes("missing or insufficient permissions")) {
      setErrorMsg(
        t("invitationS.errors.permissions", {
          defaultValue:
            "Permissions insuffisantes. Vérifie que tu es bien connecté et que les règles Firestore autorisent cette action.",
        })
      );
    } else if (msg.includes("utilisateur non connecté")) {
      setErrorMsg(
        t("commonS.notLoggedIn", { defaultValue: "Tu dois être connecté." })
      );
    } else if (msg.includes("inviter_has_pending_for_challenge")) {
      const m = t("invitationS.errors.inviterHasPendingForChallenge", {
        defaultValue: "Tu as déjà une invitation en attente pour ce défi.",
      });
      if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.LONG);
      else Alert.alert("", m);
      onClose();
    } else if (msg.includes("invitee_has_pending_for_challenge")) {
      const m = t("invitationS.errors.inviteeHasPendingForChallenge", {
        defaultValue:
          "Impossible d’inviter cet utilisateur : il a déjà une invitation en attente pour ce défi.",
      });
      if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.LONG);
      else Alert.alert("", m);
      onClose();
    } else if (msg.includes("pair_already_pending") || msg.includes("invitation_already_active")) {
      const m = t("invitationS.errors.alreadyInvited", {
        defaultValue: "Une invitation est déjà en attente avec cet utilisateur.",
      });
      if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.LONG);
      else Alert.alert("", m);
      onClose();

      
    } else if (msg.includes("pair_already_pending") || msg.includes("invitation_already_active")) {
  const m = t("invitationS.errors.alreadyInvited", {
    defaultValue: "Une invitation est déjà en attente avec cet utilisateur.",
  });
  if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.LONG);
  else Alert.alert("", m);
  onClose();
} else if (msg.includes("invitee_already_in_duo")) {
  const m = t("invitationS.errors.alreadyInDuoForChallenge", {
    defaultValue:
      "Impossible d’inviter cet utilisateur : il est déjà en duo pour ce challenge.",
  });
  if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.LONG);
  else Alert.alert("", m);
  onClose();
} else if (msg.includes("auto_invite")) {
  setErrorMsg(
    t("invitationS.errors.autoInvite", {
      defaultValue: "Tu ne peux pas t’inviter toi-même.",
    })
  );
} else {
  setErrorMsg(
    t("invitationS.errors.unknown", { defaultValue: "Erreur inconnue." })
  );
}

  } finally {
    setLoading(false);
  }
};


  return (
    <Modal
  visible={visible}
  animationType="fade"
  transparent
  statusBarTranslucent              // 👈 évite un décalage sous la status bar Android
  presentationStyle="overFullScreen"// 👈 meilleur rendu plein-écran
  onRequestClose={onClose}
>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : "height"} // 👈 Android: "height"
    style={styles.overlay}
    contentContainerStyle={styles.centerWrap}               // 👈 centre même quand la hauteur change
    keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0} // 👈 petit offset iOS
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
  placeholder={t("invitationS.usernamePlaceholder", { defaultValue: "Nom d’utilisateur" })}
  placeholderTextColor="#888"      // 👈 lisible sur fond blanc
  selectionColor="#FFB800"         // 👈 curseur/sélection visibles
  keyboardAppearance="light"  
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
    alignItems: "center",  // 👈 ajoute ça
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
    color: "#111",            // 👈 texte forcé sombre
    backgroundColor: "#fff",  // 👈 fond blanc explicite
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
