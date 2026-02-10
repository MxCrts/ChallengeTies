// components/InvitationModal.tsx
// ✅ UI/UX refonte "top monde" (responsive + centré parfait) — LOGIQUE INCHANGÉE
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  AccessibilityInfo,
  Alert,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import {
  acceptInvitation,
  refuseInvitationDirect,
  refuseOpenInvitation,
  getInvitation,
  isInvitationExpired,
  type Invitation,
  softRefuseOpenInvitation,
} from "@/services/invitationService";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import * as Haptics from "expo-haptics";
import { logEvent } from "@/src/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------- Utils ----------
const normalize = (size: number) => {
  const baseWidth = 375;
  const width = Math.max(
    320,
    Math.min(1024, require("react-native").Dimensions.get("window").width)
  );
  const scale = Math.min(Math.max(width / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

// ✅ SAFETY FIX: après acceptInvitation, on force une cohérence minimale
async function acceptInvitationSafetyFix(opts: { inviteId: string; challengeId: string }) {
  const me = auth.currentUser?.uid;
  if (!me) return;

  const invSnap = await getDoc(doc(db, "invitations", opts.inviteId));
  if (!invSnap.exists()) return;
  const inv = invSnap.data() as any;
  if (inv?.status !== "accepted") return;

  const inviterId = inv?.inviterId;
  const inviteeId = inv?.inviteeId;
  if (!inviterId || !inviteeId) return;
  if (inviteeId !== me) return;

  const userRef = doc(db, "users", me);
  const uSnap = await getDoc(userRef);
  if (!uSnap.exists()) return;
  const u = uSnap.data() as any;

  const list: any[] = Array.isArray(u?.CurrentChallenges) ? u.CurrentChallenges : [];

  const pairKey = [inviterId, inviteeId].sort().join("-");
  const uniqueKey = `${inv.challengeId}_${inv.selectedDays}_${pairKey}`;

  const idx = list.findIndex((c: any) => {
    const cid = c?.challengeId ?? c?.id;
    return (c?.uniqueKey && c.uniqueKey === uniqueKey) || cid === inv.challengeId;
  });
  if (idx < 0) return;

  const entry = list[idx];
  if (entry?.duo === true && entry?.duoPartnerId === inviterId) return;

  const next = [...list];
  next[idx] = {
    ...entry,
    duo: true,
    duoPartnerId: inviterId,
    duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    selectedDays: inv.selectedDays ?? entry?.selectedDays,
    challengeId: inv.challengeId ?? entry?.challengeId,
    id: inv.challengeId ?? entry?.id,
    uniqueKey,
  };

  await updateDoc(userRef, { CurrentChallenges: next });
}

type InvitationModalProps = {
  visible: boolean;
  inviteId: string | null;
  challengeId: string;
  onClose: () => void;
  clearInvitation?: () => void;
  onLoaded?: () => void;
};

const InvitationModal: React.FC<InvitationModalProps> = ({
  visible,
  inviteId,
  challengeId,
  onClose,
  clearInvitation,
  onLoaded,
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const [inv, setInv] = useState<Invitation | null>(null);
  const [inviterUsername, setInviterUsername] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeChatId, setChallengeChatId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [reduceMotion, setReduceMotion] = useState(false);

  const mountedRef = useRef(true);
  const lastLoadKeyRef = useRef<string>("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ Respect Reduce Motion
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      // @ts-ignore compat RN
      sub?.remove?.();
    };
  }, []);

  const closeAll = useCallback(() => {
    try {
      onClose();
    } finally {
      clearInvitation?.();
    }
  }, [onClose, clearInvitation]);

  const handleCloseRequest = useCallback(async () => {
    try {
      if (inv && inv.kind === "open" && inv.status === "pending" && inviteId) {
        await softRefuseOpenInvitation(inviteId);
      }
    } catch {
      // no-op
    } finally {
      closeAll();
    }
  }, [inv, inviteId, closeAll]);

  const showInfo = (msg: string) => {
    if (!msg) return;
    if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.LONG);
    else Alert.alert("", msg);
  };

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const you = auth.currentUser?.uid || "";

  const isForMe = useMemo(() => {
    if (!inv || !you) return false;
    if (inv.kind === "open") return inv.inviterId !== you;
    return inv.inviteeId === you;
  }, [inv, you]);

  const expired = useMemo(() => (inv ? isInvitationExpired(inv) : false), [inv]);

  // ✅ Responsive measurements (centrage + tailles)
  const layout = useMemo(() => {
    const isTiny = width < 360;
    const sidePad = normalize(isTiny ? 14 : 18);
    const maxW = Math.min(width - sidePad * 2, normalize(460));
    const safeTop = insets.top + normalize(14);
    const safeBot = insets.bottom + normalize(18);
    const maxH = Math.max(
      normalize(280),
      Math.min(height - safeTop - safeBot, normalize(680))
    );

    return { isTiny, sidePad, maxW, maxH, safeTop, safeBot };
  }, [width, height, insets.top, insets.bottom]);

  // ===== Chargement =====
  useEffect(() => {
    const load = async () => {
      if (!visible || !inviteId) return;

      if (!auth.currentUser?.uid) {
        showInfo(
          t("invitation.errors.notLogged", {
            defaultValue: "Tu dois être connecté.",
          })
        );
        onLoaded?.();
        closeAll();
        return;
      }

      const loadKey = `${inviteId}_${Date.now()}`;
      lastLoadKeyRef.current = loadKey;

      try {
        setFetching(true);
        setErrorMsg("");
        setInv(null);
        setInviterUsername("");
        setChallengeTitle("");
        setChallengeChatId("");

        // 1) Invitation
        const data = await getInvitation(inviteId);
        if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;

        if (!data) {
          showInfo(
            t("invitation.invalidMessage", {
              defaultValue: "Cette invitation est introuvable ou a été supprimée.",
            })
          );
          closeAll();
          return;
        }

        if (isInvitationExpired(data)) {
          showInfo(
            t("invitation.expiredMessage", {
              defaultValue:
                "Cette invitation a expiré. Demande à ton ami d'en renvoyer une nouvelle.",
            })
          );
          closeAll();
          return;
        }

        setInv(data);
        const chId = data.challengeId || challengeId;

        // 2) Inviter username
        try {
          const inviterSnap = await getDoc(doc(db, "users", data.inviterId));
          if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;

          if (inviterSnap.exists()) {
            const u = inviterSnap.data() as any;
            const username =
              u?.username ||
              u?.displayName ||
              (typeof u?.email === "string" ? u.email.split("@")[0] : "") ||
              "";
            setInviterUsername(username);
          } else setInviterUsername("");
        } catch {
          if (mountedRef.current && lastLoadKeyRef.current === loadKey) setInviterUsername("");
        }

        // 3) Challenge (chatId + title i18n)
        try {
          const chSnap = await getDoc(doc(db, "challenges", chId));
          if (!mountedRef.current || lastLoadKeyRef.current !== loadKey) return;

          if (chSnap.exists()) {
            const ch = chSnap.data() as any;
            const chatIdFromDoc = ch?.chatId || ch?.id || chId || "";
            setChallengeChatId(chatIdFromDoc);

            const i18nTitle = t(`challenges.${chatIdFromDoc}.title`, {
              defaultValue: ch?.title || "",
            });
            setChallengeTitle(i18nTitle || ch?.title || "");
          } else {
            setChallengeChatId(chId);
            const i18nTitle = t(`challenges.${chId}.title`, { defaultValue: "" });
            setChallengeTitle(i18nTitle || "");
          }
        } catch {
          if (mountedRef.current && lastLoadKeyRef.current === loadKey) {
            setChallengeChatId(chId);
            const i18nTitle = t(`challenges.${chId}.title`, { defaultValue: "" });
            setChallengeTitle(i18nTitle || "");
          }
        }

        try {
          await logEvent("invite_modal_shown", {
            inviteId,
            challengeId: data.challengeId || challengeId,
            kind: data.kind,
          });
        } catch {}
      } catch (e) {
        console.error("❌ InvitationModal load error:", e);
        if (mountedRef.current && lastLoadKeyRef.current !== loadKey) return;
        setErrorMsg(
          t("invitation.errors.unknown", {
            defaultValue: "Erreur inconnue.",
          })
        );
      } finally {
        if (mountedRef.current && lastLoadKeyRef.current === loadKey) {
          setFetching(false);
          try {
            onLoaded?.();
          } catch {}
        }
      }
    };

    load();
  }, [visible, inviteId, challengeId, t, i18n.language, closeAll, onLoaded]);

  // ✅ Retraduction locale si la langue change
  useEffect(() => {
    if (!visible || !challengeChatId) return;
    setChallengeTitle((prev) => {
      const i18nTitle = t(`challenges.${challengeChatId}.title`, {
        defaultValue: prev || "",
      });
      return i18nTitle || prev;
    });
  }, [i18n.language, visible, challengeChatId, t]);

  // Reset propres quand on ferme / change d’invite
  useEffect(() => {
    if (!visible) {
      setInv(null);
      setErrorMsg("");
      setShowRestartConfirm(false);
      setFetching(false);
      setLoading(false);
      setChallengeChatId("");
      setChallengeTitle("");
      setInviterUsername("");
    }
  }, [visible]);

  useEffect(() => {
    setErrorMsg("");
    setShowRestartConfirm(false);
  }, [inviteId]);

  // ===== Actions (LOGIQUE INCHANGÉE) =====
  const handleAccept = useCallback(async () => {
    if (loading || fetching) return;

    const meId = auth.currentUser?.uid;
    if (!inviteId || !meId) return;

    if (!inv || !isForMe) {
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
      return;
    }

    if (inv.inviterId === meId) {
      setErrorMsg(
        t("invitation.errors.autoInvite", {
          defaultValue: "Tu ne peux pas accepter ta propre invitation.",
        })
      );
      return;
    }

    if (expired) {
      setErrorMsg(
        t("invitation.errors.expired", { defaultValue: "Invitation expirée." })
      );
      onClose();
      clearInvitation?.();
      return;
    }

    setLoading(true);
    setErrorMsg("");
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      const meSnap = await getDoc(doc(db, "users", meId));
      const current: any[] = Array.isArray(meSnap.data()?.CurrentChallenges)
        ? meSnap.data()!.CurrentChallenges
        : [];

      const targetId = inv.challengeId || challengeId;

      const alreadyInDuoActive = current.some((c) => {
        const cid = c?.challengeId ?? c?.id;
        const same = cid === targetId;
        const isDuo = c?.duo === true;
        const sel = Number(c?.selectedDays ?? 0);
        const done = Number(c?.completedDays ?? 0);
        const active = !sel || done < sel;
        return same && isDuo && active;
      });

      if (alreadyInDuoActive) {
        setErrorMsg(
          t("invitation.errors.alreadyInDuoForChallenge", {
            defaultValue:
              "Tu es déjà en duo pour ce défi. Tu peux quitter l’ancien duo dans tes défis en cours avant d’en accepter un nouveau.",
          })
        );
        return;
      }

      const hasSolo = current.some((c) => {
        const cid = c?.challengeId ?? c?.id;
        return cid === targetId && !c?.duo;
      });

      if (hasSolo) {
        setLoading(false);
        setShowRestartConfirm(true);
        return;
      }

      await acceptInvitation(inviteId);

      try {
        await new Promise((r) => setTimeout(r, 350));
        await acceptInvitationSafetyFix({ inviteId, challengeId: targetId });
      } catch {}

      logEvent("invite_accept", {
        inviteId,
        challengeId: inv.challengeId || challengeId,
      }).catch?.(() => {});

      if (!reduceMotion) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }

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
      } else if (msg.includes("invitation_deja_traitee") || (msg.includes("déjà") && msg.includes("trait"))) {
        setErrorMsg(t("invitation.errors.processed", { defaultValue: "Invitation déjà traitée." }));
        onClose();
        clearInvitation?.();
      } else if (msg.includes("invitee_already_in_duo")) {
        setErrorMsg(
          t("invitation.errors.alreadyInDuoForChallenge", {
            defaultValue:
              "Tu es déjà en duo pour ce défi. Tu peux quitter l’ancien duo dans tes défis en cours avant d’en accepter un nouveau.",
          })
        );
      } else if (msg.includes("inviter_already_in_duo")) {
        setErrorMsg(
          t("invitation.errors.inviterAlreadyInDuo", {
            defaultValue:
              "Ton ami est déjà en duo sur ce défi. Demande-lui d’abord de quitter son duo avant d’utiliser ce lien.",
          })
        );
      } else if (msg.includes("already_in_duo") || msg.includes("alreadyinduo") || msg.includes("duo")) {
        setErrorMsg(
          t("invitation.errors.alreadyInDuoGeneric", {
            defaultValue: "Un des deux comptes est déjà en duo pour ce défi.",
          })
        );
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
  }, [
    loading,
    fetching,
    inviteId,
    inv,
    isForMe,
    expired,
    challengeId,
    t,
    onClose,
    clearInvitation,
    reduceMotion,
  ]);

  const handleConfirmRestart = useCallback(async () => {
    if (!inviteId || !auth.currentUser || !inv) return;
    if (loading || fetching) return;

    setLoading(true);
    setErrorMsg("");

    try {
      if (!reduceMotion) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      await acceptInvitation(inviteId);

      try {
        await new Promise((r) => setTimeout(r, 350));
        await acceptInvitationSafetyFix({
          inviteId,
          challengeId: inv.challengeId || challengeId,
        });
      } catch {}

      logEvent("invite_accept_restart", {
        inviteId,
        challengeId: inv.challengeId || challengeId,
      }).catch?.(() => {});

      setShowRestartConfirm(false);
      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation restart+accept error:", e);
      setErrorMsg(t("invitation.errors.unknown", { defaultValue: "Erreur." }));
    } finally {
      setLoading(false);
    }
  }, [
    inviteId,
    inv,
    loading,
    fetching,
    reduceMotion,
    challengeId,
    t,
    onClose,
    clearInvitation,
  ]);

  const handleRefuse = useCallback(async () => {
    if (!inviteId || !inv || loading || fetching) return;

    setLoading(true);
    setErrorMsg("");

    try {
      if (inv.kind === "direct") await refuseInvitationDirect(inviteId);
      else await refuseOpenInvitation(inviteId);

      logEvent("invite_refuse", {
        inviteId,
        challengeId: inv.challengeId || challengeId,
      }).catch?.(() => {});

      if (!reduceMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      onClose();
      clearInvitation?.();
    } catch (e) {
      console.error("❌ Invitation refuse error:", e);
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
  }, [
    inviteId,
    inv,
    loading,
    fetching,
    challengeId,
    t,
    onClose,
    clearInvitation,
    reduceMotion,
  ]);

  // ===== Styles (TOP MONDE) =====
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: isDarkMode ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.62)",
          paddingTop: layout.safeTop,
          paddingBottom: layout.safeBot,
          paddingHorizontal: layout.sidePad,
          justifyContent: "center",
          alignItems: "center",
        },

        backdrop: {
          ...StyleSheet.absoluteFillObject,
        },

        // Wrapper de carte (centrage parfait, jamais collé au top)
        cardWrap: {
          width: "100%",
          maxWidth: layout.maxW,
          maxHeight: layout.maxH,
          alignSelf: "center",
        },

        card: {
          backgroundColor: currentTheme.colors.cardBackground,
          borderRadius: normalize(22),
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",

          shadowColor: "#000",
          shadowOffset: { width: 0, height: normalize(10) },
          shadowOpacity: 0.32,
          shadowRadius: normalize(14),
          elevation: 10,
        },

        // Header slim (close button)
        header: {
          width: "100%",
          paddingHorizontal: normalize(16),
          paddingTop: normalize(12),
          paddingBottom: normalize(10),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
        },
        headerTitle: {
          flex: 1,
          fontSize: normalize(13),
          fontFamily: "Comfortaa_700Bold",
          color: currentTheme.colors.textSecondary,
          textAlign: "center",
          opacity: 0.9,
        },
        headerSide: {
          width: normalize(36),
          height: normalize(36),
          alignItems: "center",
          justifyContent: "center",
        },
        closeBtn: {
          width: normalize(36),
          height: normalize(36),
          borderRadius: normalize(12),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        },
        closeX: {
          fontSize: normalize(18),
          lineHeight: normalize(18),
          fontFamily: "Comfortaa_700Bold",
          color: currentTheme.colors.textPrimary,
          opacity: 0.9,
          ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
        },

        scroll: {
          width: "100%",
        },
        content: {
          paddingHorizontal: normalize(20),
          paddingTop: normalize(18),
          paddingBottom: normalize(22),
          alignItems: "center",
        },

        modalTitle: {
          fontSize: normalize(layout.isTiny ? 18 : 19),
          fontFamily: "Comfortaa_700Bold",
          marginBottom: normalize(10),
          color: currentTheme.colors.secondary,
          textAlign: "center",
          alignSelf: "stretch",
        },
        modalText: {
          fontSize: normalize(14),
          fontFamily: "Comfortaa_400Regular",
          marginBottom: normalize(14),
          textAlign: "center",
          color: currentTheme.colors.textSecondary,
        },

        tag: {
          alignSelf: "center",
          paddingHorizontal: normalize(14),
          paddingVertical: normalize(7),
          borderRadius: 999,
          backgroundColor: currentTheme.colors.border,
          marginBottom: normalize(12),
          maxWidth: "100%",
        },
        tagText: {
          fontSize: normalize(13),
          fontFamily: "Comfortaa_500Medium",
          color: currentTheme.colors.textPrimary,
          textAlign: "center",
        },
        durationText: {
          fontSize: normalize(13),
          fontFamily: "Comfortaa_500Medium",
          marginBottom: normalize(10),
          textAlign: "center",
          color: currentTheme.colors.textPrimary,
        },

        errorText: {
          color: currentTheme.colors.error,
          fontSize: normalize(13),
          marginTop: normalize(2),
          marginBottom: normalize(10),
          textAlign: "center",
        },

        buttonRow: {
          flexDirection: layout.isTiny ? "column" : "row",
          width: "100%",
          gap: normalize(10),
          marginTop: normalize(8),
        },

        btn: {
          flex: 1,
          borderRadius: normalize(14),
          paddingVertical: normalize(12),
          paddingHorizontal: normalize(12),
          alignItems: "center",
          justifyContent: "center",
          minHeight: normalize(44),

          shadowColor: "#000",
          shadowOffset: { width: 0, height: normalize(4) },
          shadowOpacity: 0.18,
          shadowRadius: normalize(6),
          elevation: 4,
        },
        accept: {
          backgroundColor: currentTheme.colors.primary,
        },
        refuse: {
          backgroundColor: currentTheme.colors.error,
        },
        neutral: {
          backgroundColor: currentTheme.colors.border,
        },

        btnText: {
          color: "#fff",
          fontSize: normalize(15),
          fontFamily: "Comfortaa_700Bold",
          ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
        },
        neutralText: {
          color: currentTheme.colors.textPrimary,
        },

        spinnerWrap: {
          marginVertical: normalize(12),
        },
      }),
    [isDarkMode, currentTheme, layout]
  );

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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={closeAll}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
              testID="invite-close"
              activeOpacity={0.9}
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
            <TouchableOpacity
              style={[styles.btn, styles.neutral]}
              onPress={closeAll}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
              activeOpacity={0.9}
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
              onPress={closeAll}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
              activeOpacity={0.9}
            >
              <Text style={[styles.btnText, styles.neutralText]}>
                {t("commonS.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    const daysCount =
      typeof inv?.selectedDays === "number" && inv.selectedDays > 0 ? inv.selectedDays : undefined;

    const usernameForTitle =
      inviterUsername || t("invitation.someone", { defaultValue: "Quelqu'un" });

    return (
      <>
        <Text style={styles.modalTitle}>
          {t("invitation.title", {
            username: usernameForTitle,
            defaultValue: "{{username}} t’invite en Duo",
          })}
        </Text>

        {!!challengeTitle && (
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={2} ellipsizeMode="tail">
              {challengeTitle}
            </Text>
          </View>
        )}

        {typeof daysCount === "number" && (
          <Text style={styles.durationText}>
            {t("invitation.duration", { count: daysCount, defaultValue: "{{count}} jours de défi" })}
          </Text>
        )}

        <Text style={styles.modalText}>
          {t("invitation.message", {
            challenge: challengeTitle,
            defaultValue:
              "Accepte pour démarrer ce défi en Duo. Vous pourrez suivre vos progrès ensemble.",
          })}
        </Text>

        {!!errorMsg && (
          <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {errorMsg}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            onPress={handleAccept}
            disabled={loading || fetching}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("invitation.accept", { defaultValue: "Accepter" })}
            accessibilityHint={t("invitation.acceptHint", {
              defaultValue: "Accepter l’invitation et démarrer en Duo.",
            })}
            testID="invite-accept"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t("invitation.accept", { defaultValue: "Accepter" })}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.refuse]}
            onPress={handleRefuse}
            disabled={loading || fetching}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("invitation.refuse", { defaultValue: "Refuser" })}
            accessibilityHint={t("invitation.refuseHint", {
              defaultValue: "Refuser l’invitation et fermer.",
            })}
            testID="invite-refuse"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t("invitation.refuse", { defaultValue: "Refuser" })}</Text>
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
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t("invitation.continue", { defaultValue: "Continuer" })}</Text>
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
      onRequestClose={handleCloseRequest}
    >
      <View
        style={styles.root}
        accessible
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        {/* Backdrop tappable */}
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!loading && !fetching) handleCloseRequest();
          }}
          accessibilityRole="button"
          accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
        />

        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(240)}
          style={styles.cardWrap}
          pointerEvents="auto"
        >
          <View style={styles.card}>
            {/* Header premium (X) */}
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                {t("invitation.header", { defaultValue: "Invitation Duo" })}
              </Text>
              <View style={styles.headerSide}>
                <Pressable
                  onPress={() => {
                    if (!loading && !fetching) handleCloseRequest();
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
                  testID="invite-close-x"
                >
                  <Text style={styles.closeX}>×</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {showRestartConfirm ? renderRestartConfirmBody() : renderBody()}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default InvitationModal;
