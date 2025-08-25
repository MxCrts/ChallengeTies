// components/InvitationModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitation,
  resetInviteeChallenge, // alias -> resetInviteeChallengeByUsername
  getInvitation,
  isInvitationExpired,
  Invitation,
} from "@/services/invitationService";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";

type InvitationModalProps = {
  visible: boolean;
  inviteId: string | null;
  challengeId: string;
  onClose: () => void;
  clearInvitation?: () => void; // optionnel: pour vider l'état parent
};

const InvitationModal: React.FC<InvitationModalProps> = ({
  visible,
  inviteId,
  challengeId,
  onClose,
  clearInvitation,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const [inv, setInv] = useState<Invitation | null>(null);
  const [inviterUsername, setInviterUsername] = useState("");
  const [inviteeUsername, setInviteeUsername] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const you = auth.currentUser?.uid || "";

  // ✅ Open-aware: une open invite est valable pour tout user connecté ≠ inviter
  const isForMe = useMemo(() => {
    if (!inv || !you) return false;
    if (inv.kind === "open") {
      return inv.inviterId !== you;
    }
    // ancien modèle direct
    return inv.inviteeId === you;
  }, [inv, you]);

  const expired = useMemo(() => (inv ? isInvitationExpired(inv) : false), [inv]);

  /* =========================
   * Chargement des infos (invitation + noms + titre challenge)
   * ========================= */
  useEffect(() => {
    const load = async () => {
      if (!visible || !inviteId) return;
      try {
        setFetching(true);
        setErrorMsg("");

        // 1) Invitation
        const data = await getInvitation(inviteId);
        setInv(data);

        // 2) Inviter username
        if (data?.inviterId) {
          const inviterSnap = await getDoc(doc(db, "users", data.inviterId));
          setInviterUsername(
            (inviterSnap.exists() && (inviterSnap.data() as any)?.username) ||
              t("invitation.userFallback", { defaultValue: "Utilisateur" })
          );
        }

        // 3) Invitee username (toi)
        if (auth.currentUser?.uid) {
          const meSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          setInviteeUsername(
            (meSnap.exists() && (meSnap.data() as any)?.username) ||
              t("invitation.youFallback", { defaultValue: "Toi" })
          );
        }

        // 4) Challenge title pour le message
        if (challengeId) {
          const chSnap = await getDoc(doc(db, "challenges", challengeId));
          setChallengeTitle(
            (chSnap.exists() && (chSnap.data() as any)?.title) ||
              t("challengeDetails.untitled", { defaultValue: "Défi" })
          );
        }
      } catch (e) {
        console.error("❌ InvitationModal load error:", e);
        setErrorMsg(
          t("invitation.errors.unknown", { defaultValue: "Erreur inconnue." })
        );
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [visible, inviteId, challengeId, t]);

  /* =========================
   * Actions
   * ========================= */

  // Accepter (avec détection d’un solo en cours → confirmation reset)
  const handleAccept = async () => {
    if (!inviteId || !auth.currentUser) return;

    if (!inv || expired || !isForMe) {
      setErrorMsg(
        expired
          ? t("invitation.errors.expired", {
              defaultValue: "Invitation expirée.",
            })
          : t("invitation.errors.unknown", { defaultValue: "Erreur." })
      );
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      // Vérifier si un solo existe déjà pour ce challenge
      const meSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
      const current = (meSnap.data()?.CurrentChallenges || []) as any[];
      const hasSolo = current.some(
        (c) => (c.challengeId === challengeId || c.id === challengeId) && !c.duo
      );

      if (hasSolo) {
        setShowRestartConfirm(true);
      } else {
        await acceptInvitation(inviteId);
        onClose();
        clearInvitation?.();
      }
    } catch (e: any) {
      console.error("❌ Invitation accept error:", e);
      // surface quelques erreurs connues lisiblement
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("auto_invite")) {
        setErrorMsg(
          t("invitation.errors.autoInvite", {
            defaultValue: "Tu ne peux pas accepter ta propre invitation.",
          })
        );
      } else if (msg.includes("expirée") || msg.includes("expired")) {
        setErrorMsg(
          t("invitation.errors.expired", {
            defaultValue: "Invitation expirée.",
          })
        );
      } else if (msg.includes("restart_invitee")) {
        setErrorMsg(
          t("invitation.errors.alreadyStarted", {
            defaultValue:
              "Tu as déjà ce défi en cours. Termine-le ou réinitialise-le d'abord.",
          })
        );
      } else {
        setErrorMsg(
          t("invitation.errors.unknown", { defaultValue: "Erreur." })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Confirme le reset de mon solo, puis accepte
  const handleConfirmRestart = async () => {
    if (!inviteId || !auth.currentUser || !inv) return;

    setLoading(true);
    setErrorMsg("");
    try {
      if (inviteeUsername) {
        await resetInviteeChallenge(challengeId, inviteeUsername);
      }
      await acceptInvitation(inviteId);
      setShowRestartConfirm(false);
      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation restart+accept error:", e);
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = async () => {
    if (!inviteId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await refuseInvitation(inviteId);
      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation refuse error:", e);
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    } finally {
      setLoading(false);
    }
  };

  /* =========================
   * Styles
   * ========================= */
  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
      padding: 20,
    },
    modalView: {
      backgroundColor: currentTheme.colors.cardBackground,
      borderRadius: 16,
      padding: 22,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
      width: "100%",
      maxWidth: 420,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: "Comfortaa_700Bold",
      marginBottom: 10,
      color: currentTheme.colors.secondary,
      textAlign: "center",
    },
    modalText: {
      fontSize: 16,
      fontFamily: "Comfortaa_400Regular",
      marginBottom: 18,
      textAlign: "center",
      color: currentTheme.colors.textSecondary,
    },
    errorText: {
      color: currentTheme.colors.error,
      fontSize: 14,
      marginBottom: 12,
      textAlign: "center",
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      gap: 12,
      marginTop: 6,
    },
    btn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },
    accept: { backgroundColor: currentTheme.colors.primary },
    refuse: { backgroundColor: currentTheme.colors.error },
    neutral: { backgroundColor: currentTheme.colors.border },
    btnText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Comfortaa_700Bold",
    },
    neutralText: {
      color: currentTheme.colors.textPrimary,
    },
    spinnerWrap: { marginVertical: 10 },
  });

  /* =========================
   * Rendus conditionnels
   * ========================= */
  const renderBody = () => {
    if (fetching) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.loading", { defaultValue: "Chargement..." })}
          </Text>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.secondary}
            />
          </View>
        </>
      );
    }

    if (!inv) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.invalidTitle", {
              defaultValue: "Invitation indisponible",
            })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.invalidMessage", {
              defaultValue:
                "Cette invitation est introuvable ou a été supprimée.",
            })}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, styles.neutralText]}>
                {t("commonS.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (!isForMe) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.notForYouTitle", { defaultValue: "Oups" })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.notForYouMessage", {
              defaultValue:
                "Cette invitation n'est pas destinée à ce compte.",
            })}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, styles.neutralText]}>
                {t("commonS.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (expired) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.expiredTitle", { defaultValue: "Invitation expirée" })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.expiredMessage", {
              defaultValue:
                "Cette invitation a expiré. Demande à ton ami d'en renvoyer une nouvelle.",
            })}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, styles.neutralText]}>
                {t("commonS.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={styles.modalTitle}>
          {t("invitation.title", {
            username: inviterUsername,
            defaultValue: "{{username}} t’invite en Duo",
          })}
        </Text>
        <Text style={styles.modalText}>
          {t("invitation.message", {
            challenge: challengeTitle,
            defaultValue:
              "Accepte pour démarrer ce défi en Duo. Tu pourrez suivre vos progrès ensemble.",
          })}
        </Text>

        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            onPress={handleAccept}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {t("invitation.accept", { defaultValue: "Accepter" })}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.refuse]}
            onPress={handleRefuse}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {t("invitation.refuse", { defaultValue: "Refuser" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderRestartConfirm = () => (
    <Modal visible={showRestartConfirm} transparent animationType="fade">
      <View style={styles.centeredView}>
        <Animated.View
          entering={FadeInUp.duration(250)}
          style={styles.modalView}
        >
          <Text style={styles.modalTitle}>
            {t("invitation.restartTitle", {
              defaultValue: "Recommencer le défi en Duo ?",
            })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.restartMessage", {
              defaultValue:
                "Tu as déjà ce défi en solo. On va le réinitialiser pour repartir à zéro à deux.",
            })}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={() => setShowRestartConfirm(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, styles.neutralText]}>
                {t("invitation.cancel", { defaultValue: "Annuler" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.accept]}
              onPress={handleConfirmRestart}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {t("invitation.continue", { defaultValue: "Continuer" })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.centeredView}>
          <Animated.View
            entering={FadeInUp.duration(250)}
            style={styles.modalView}
          >
            {renderBody()}
          </Animated.View>
        </View>
      </Modal>

      {renderRestartConfirm()}
    </>
  );
};

export default InvitationModal;
