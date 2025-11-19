// components/InvitationModal.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
   ToastAndroid,
   Alert,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitationDirect,
  refuseOpenInvitation,
  getInvitation,
  isInvitationExpired,
  type Invitation,
} from "@/services/invitationService";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import * as Haptics from "expo-haptics";
import { logEvent } from "@/src/analytics";
import { softRefuseOpenInvitation } from "@/services/invitationService";

type InvitationModalProps = {
  visible: boolean;
  inviteId: string | null;
  challengeId: string;
  onClose: () => void;
  clearInvitation?: () => void;
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
  const [challengeTitle, setChallengeTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const mountedRef = useRef(true);
 const lastLoadKeyRef = useRef<string>(""); // protège contre les updates d’état d’une ancienne invite

 useEffect(() => {
   mountedRef.current = true;
   return () => { mountedRef.current = false; };
 }, []);

const closeAll = () => {
   try { onClose(); } finally { clearInvitation?.(); }
 };

 const showInfo = (msg: string) => {
   if (!msg) return;
   if (Platform.OS === "android") {
     ToastAndroid.show(msg, ToastAndroid.LONG);
   } else {
     Alert.alert("", msg);
   }
 };


  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const you = auth.currentUser?.uid || "";

  // OPEN: valable pour tout user connecté ≠ inviter
  const isForMe = useMemo(() => {
    if (!inv || !you) return false;
    if (inv.kind === "open") return inv.inviterId !== you;
    return inv.inviteeId === you; // direct
  }, [inv, you]);

  const expired = useMemo(() => (inv ? isInvitationExpired(inv) : false), [inv]);

  useEffect(() => {
  const load = async () => {
     if (!visible || !inviteId) return;
     if (!auth.currentUser?.uid) {
       showInfo(t("invitation.errors.notLogged", { defaultValue: "Tu dois être connecté." }));
       closeAll();
       return;
     }
     const loadKey = `${inviteId}_${Date.now()}`;
     lastLoadKeyRef.current = loadKey;
     try {
       setFetching(true);
       setErrorMsg("");

       // 1) Invitation
       const data = await getInvitation(inviteId);
       if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;
       setInv(data);

       // Auto-fermeture si invalid/expired une fois l'UI montée
       if (!data) {
         showInfo(t("invitation.invalidMessage", { defaultValue: "Cette invitation est introuvable ou a été supprimée." }));
         closeAll();
         return;
       }
       if (isInvitationExpired(data)) {
         showInfo(t("invitation.expiredMessage", {
           defaultValue: "Cette invitation a expiré. Demande à ton ami d'en renvoyer une nouvelle."
         }));
         closeAll();
         return;
       }

       // 2) Inviter username
       if (data.inviterId) {
         const inviterSnap = await getDoc(doc(db, "users", data.inviterId));
         if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;
         setInviterUsername(
           (inviterSnap.exists() && (inviterSnap.data() as any)?.username) ||
           t("invitation.userFallback", { defaultValue: "Utilisateur" })
         );
       }

       // 3) Challenge title (i18n via chatId si dispo, sinon fallback)
       const targetChallengeId = data.challengeId || challengeId;
       if (targetChallengeId) {
         const chSnap = await getDoc(doc(db, "challenges", targetChallengeId));
         if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;
         if (chSnap.exists()) {
           const ch = chSnap.data() as any;
           const chatId = ch?.chatId || targetChallengeId;
           const i18nTitle = t(`challenges.${chatId}.title`, { defaultValue: ch?.title || "" });
           setChallengeTitle(i18nTitle || ch?.title || t("challengeDetails.untitled", { defaultValue: "Défi" }));
         } else {
           setChallengeTitle(t("challengeDetails.untitled", { defaultValue: "Défi" }));
         }
       }
       logEvent("invite_modal_open", { inviteId, challengeId: targetChallengeId }).catch(() => {});
     } catch (e) {
       console.error("❌ InvitationModal load error:", e);
       if (mountedRef.current && lastLoadKeyRef.current === loadKey) {
         setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur inconnue." }));
       }
     } finally {
       if (mountedRef.current && lastLoadKeyRef.current === loadKey) {
         setFetching(false);
       }
     }
   };
   load();
  }, [visible, inviteId, challengeId, t]);

  // Reset propres quand on ferme / change d’invite
  useEffect(() => {
    if (!visible) {
      setInv(null);
      setErrorMsg("");
      setShowRestartConfirm(false);
      setFetching(false);
      setLoading(false);
    }
  }, [visible]);
  useEffect(() => {
    // nouvelle invite => nettoie l’état UX
    setErrorMsg("");
    setShowRestartConfirm(false);
  }, [inviteId]);

  // ===== Actions =====

  const handleAccept = useCallback(async () => {
  // Anti double-tap / actions pendant le fetch
  // (si tu as un state `fetching`, laisse-le ici ; sinon enlève la partie `|| fetching`)
  if (loading || fetching) return;

  const meId = auth.currentUser?.uid;
  if (!inviteId || !meId) return;

  // Sanity checks locaux
  if (!inv || !isForMe) {
    setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    return;
  }
  // UX immédiate : empêcher d’accepter sa propre invitation
  if (inv.inviterId === meId) {
    setErrorMsg(t("invitation.errors.autoInvite", {
      defaultValue: "Tu ne peux pas accepter ta propre invitation."
    }));
    return;
  }
  if (expired) {
    setErrorMsg(t("invitation.errors.expired", { defaultValue: "Invitation expirée." }));
    // UX: on ferme proprement, l’invite est caduque
    onClose();
    clearInvitation?.();
    return;
  }

  setLoading(true);
  setErrorMsg("");
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});

  try {
    // Relecture minimale de mon profil pour déterminer mon état actuel
    const meSnap = await getDoc(doc(db, "users", meId));
    const current: any[] = Array.isArray(meSnap.data()?.CurrentChallenges)
      ? meSnap.data()!.CurrentChallenges
      : [];

    const targetId = inv.challengeId || challengeId;

    // 1) Déjà en DUO actif sur ce challenge ?
    const alreadyInDuoActive = current.some((c) => {
      const cid = c?.challengeId ?? c?.id;
      const same = cid === targetId || c?.uniqueKey?.startsWith?.(targetId + "_");
      const isDuo = c?.duo === true;
      const sel = Number(c?.selectedDays ?? 0);
      const done = Number(c?.completedDays ?? 0);
      const active = !sel || done < sel; // si pas d'info de jours, on considère actif par prudence
      return same && isDuo && active;
    });

    if (alreadyInDuoActive) {
      setErrorMsg(
        t("invitation.errors.alreadyInDuoForChallenge", {
          defaultValue: "Tu es déjà en duo pour ce défi.",
        })
      );
      onClose();
      clearInvitation?.();
      return;
    }

    // 2) Déjà en SOLO sur ce challenge ? -> confirmation UI
    const hasSolo = current.some((c) => {
      const cid = c?.challengeId ?? c?.id;
      const same = cid === targetId || c?.uniqueKey?.startsWith?.(targetId + "_");
      return same && !c?.duo;
    });

    if (hasSolo) {
      setShowRestartConfirm(true); // l'autre handler fera l'accept réel
      return;
    }

    // 3) Acceptation finale (le service gère la bascule solo->duo si nécessaire côté serveur)
    await acceptInvitation(inviteId);
     logEvent("invite_accept", { inviteId, challengeId: inv.challengeId || challengeId }).catch?.(()=>{});
     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});

    // 4) Fermeture propre + nettoyage de l’état d’invitation
    onClose();
    clearInvitation?.();
  } catch (e: any) {
    console.error("❌ Invitation accept error:", e);
    const msg = String(e?.message || "").toLowerCase();

    if (msg.includes("auto_invite")) {
      setErrorMsg(
        t("invitation.errors.autoInvite", {
          defaultValue: "Tu ne peux pas accepter ta propre invitation.",
        })
      );
    } else if (msg.includes("expired") || msg.includes("expir")) {
      setErrorMsg(t("invitation.errors.expired", { defaultValue: "Invitation expirée." }));
      onClose();
      clearInvitation?.();
      } else if (msg.includes("non_autorise") || msg.includes("non autoris") || msg.includes("permission")) {
      setErrorMsg(t("invitation.errors.permission", { defaultValue: "Action non autorisée." }));
      onClose();
      clearInvitation?.();
    } else if (msg.includes("invitation_deja_traitee") || msg.includes("déjà") && msg.includes("trait")) {
      setErrorMsg(t("invitation.errors.processed", { defaultValue: "Invitation déjà traitée." }));
      onClose();
      clearInvitation?.();
    } else if (msg.includes("already_in_duo") || msg.includes("alreadyinduo") || msg.includes("duo")) {
      setErrorMsg(
        t("invitation.errors.alreadyInDuoForChallenge", {
          defaultValue: "Tu es déjà en duo pour ce défi.",
        })
      );
      onClose();
      clearInvitation?.();
       } else if (msg.includes("challenge_introuvable")) {
      setErrorMsg(t("invitation.errors.challengeMissing", { defaultValue: "Défi introuvable." }));
      onClose();
      clearInvitation?.();
    } else {
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    }
  } finally {
    setLoading(false);
  }
}, [loading, fetching, inviteId, inv, isForMe, expired, challengeId, t]);


  const handleConfirmRestart = useCallback(async () => {
    if (!inviteId || !auth.currentUser || !inv) return;
    if (loading || fetching) return;
    setLoading(true);
    setErrorMsg("");
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      // Pas de reset manuel : acceptInvitation gère déjà le remplacement SOLO -> DUO
      await acceptInvitation(inviteId);
      logEvent("invite_accept_restart", { inviteId, challengeId: inv.challengeId || challengeId }).catch?.(()=>{});
      setShowRestartConfirm(false);
      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation restart+accept error:", e);
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    } finally {
      setLoading(false);
    }
}, [inviteId, inv, loading, fetching, challengeId, t]);

  const handleRefuse = useCallback( async () => {
   if (!inviteId || !inv || loading || fetching) return;
    setLoading(true);
    setErrorMsg("");
    try {
      if (inv.kind === "direct") {
        await refuseInvitationDirect(inviteId);
      } else {
       // OPEN : refus explicite (status = refused + inviteeId = me)
      await refuseOpenInvitation(inviteId);
      }
      logEvent("invite_refuse", { inviteId, challengeId: inv.challengeId || challengeId }).catch?.(()=>{});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation refuse error:", e);
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
      const msg = String((e as any)?.message || "").toLowerCase();
    if (msg.includes("invitation_deja_traitee")) {
      setErrorMsg(t("invitation.errors.processed", { defaultValue: "Invitation déjà traitée." }));
    } else if (msg.includes("non_autorise") || msg.includes("permission")) {
      setErrorMsg(t("invitation.errors.permission", { defaultValue: "Action non autorisée." }));
    } else {
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    }
    } finally {
      setLoading(false);
    }
 }, [inviteId, inv, loading, fetching, challengeId, t]);

  // ===== Styles =====
  const styles = StyleSheet.create({
   centeredView: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
  paddingHorizontal: 20,
  paddingVertical: 40, // ✅ espace haut/bas
},
modalView: {
  backgroundColor: currentTheme.colors.cardBackground,
  borderRadius: 20,
  padding: 24,
  alignItems: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 8,
  width: "90%",        // ✅ marge horizontale
  maxWidth: 420,       // ✅ limite desktop/tablette
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
    neutralText: { color: currentTheme.colors.textPrimary },
    spinnerWrap: { marginVertical: 10 },
  });

  // ===== UI =====
  const renderBody = () => {
    if (fetching) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.loading", { defaultValue: "Chargement..." })}
          </Text>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          </View>
        </>
      );
    }

    if (!inv) {
      return (
        <>
          <Text style={styles.modalTitle}>
            {t("invitation.invalidTitle", { defaultValue: "Invitation indisponible" })}
          </Text>
          <Text style={styles.modalText}>
            {t("invitation.invalidMessage", {
              defaultValue: "Cette invitation est introuvable ou a été supprimée.",
            })}
          </Text>
          <View  style={styles.buttonRow}>
   <TouchableOpacity
     style={[styles.btn, styles.neutral]}
     onPress={closeAll}
     accessibilityRole="button"
     accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
     testID="invite-close"
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
              defaultValue: "Cette invitation n'est pas destinée à ce compte.",
            })}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.neutral]} onPress={closeAll}>
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
            <TouchableOpacity style={[styles.btn, styles.neutral]} onPress={closeAll}>
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
              "Accepte pour démarrer ce défi en Duo. Vous pourrez suivre vos progrès ensemble.",
          })}
        </Text>

        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            onPress={handleAccept}
            disabled={loading || fetching}
            activeOpacity={0.85}
            accessibilityRole="button"
  accessibilityLabel={t("invitation.accept", { defaultValue: "Accepter" })}
  accessibilityHint={t("invitation.acceptHint", { defaultValue: "Accepter l’invitation et démarrer en Duo." })}
  testID="invite-accept"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>
                {t("invitation.accept", { defaultValue: "Accepter" })}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.refuse]}
            onPress={handleRefuse}
            disabled={loading || fetching}
            activeOpacity={0.85}
            accessibilityRole="button"
  accessibilityLabel={t("invitation.refuse", { defaultValue: "Refuser" })}
  accessibilityHint={t("invitation.refuseHint", { defaultValue: "Refuser l’invitation et fermer." })}
  testID="invite-refuse"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>
                {t("invitation.refuse", { defaultValue: "Refuser" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

   const renderRestartConfirmBody = () => (
    <>
      <Text style={styles.modalTitle}>
        {t("invitation.restartTitle", { defaultValue: "Recommencer le défi en Duo ?" })}
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
          accessibilityRole="button"
   accessibilityLabel={t("invitation.cancel", { defaultValue: "Annuler" })}
   testID="invite-restart-cancel"
        >
          <Text style={[styles.btnText, styles.neutralText]}>
            {t("invitation.cancel", { defaultValue: "Annuler" })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.accept]}
          onPress={handleConfirmRestart}
          disabled={loading || fetching}
          activeOpacity={0.85}
          accessibilityRole="button"
   accessibilityLabel={t("invitation.continue", { defaultValue: "Continuer" })}
   testID="invite-restart-continue"
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.btnText}>
              {t("invitation.continue", { defaultValue: "Continuer" })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={async () => {
   try {
     if (inv && inv.kind === "open" && inv.status === "pending") {
       await softRefuseOpenInvitation(inviteId!);
     }
   } catch {} finally {
     closeAll();
   }
 }}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.centeredView]}>
        <Animated.View entering={FadeInUp.duration(250)} style={styles.modalView}>
          {showRestartConfirm ? renderRestartConfirmBody() : renderBody()}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default InvitationModal;
