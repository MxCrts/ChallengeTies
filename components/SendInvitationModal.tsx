// components/SendInvitationModal.tsx
import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { auth } from "@/constants/firebase-config";
import {
  getOrCreateOpenInvitation,
  buildUniversalLink,
} from "@/services/invitationService";
import * as Localization from "expo-localization";
import * as Haptics from "expo-haptics";
import { logEvent } from "@/src/analytics";

type Props = {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  challengeTitle?: string;
  onClose: () => void;
  onSent?: () => void; // succès (toast géré parent)
};

/** Normalise vers l’une des 9 locales supportées: ar, de, en, es, fr, hi, it, ru, zh */
const getShareLang = (i18nLang?: string) => {
  const normalize = (tag?: string | null) => {
    if (!tag) return null;
    const base = tag.split(/[-_]/)[0]?.toLowerCase();
    if (!base) return null;

    // force vers nos 12 langues
    if (
      [
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "hi",
        "it",
        "ru",
        "zh",
        "pt",
        "ja",
        "ko",
      ].includes(base)
    ) {
      return base;
    }

    // fallback anglais si non supporté
    return "en";
  };

  const fromI18n = normalize(i18nLang || null);
  if (fromI18n) return fromI18n;

  try {
    const locs = (Localization as any)?.getLocales?.();
    if (Array.isArray(locs) && locs[0]?.languageTag) {
      const n = normalize(String(locs[0].languageTag));
      if (n) return n;
    }
  } catch {}
  try {
    const tag = (Localization as any)?.locale;
    const n = normalize(typeof tag === "string" ? tag : null);
    if (n) return n;
  } catch {}
  const navLang = (globalThis as any)?.navigator?.language;
  const n = normalize(typeof navLang === "string" ? navLang : null);
  return n || "en";
};

const SendInvitationModal: React.FC<Props> = ({
  visible,
  challengeId,
  selectedDays,
  challengeTitle,
  onClose,
  onSent,
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  // Anti double-tap court
  const tapGateRef = useRef<number>(0);

  // Analytics: ouverture du modal
  useEffect(() => {
    if (visible) {
      try {
        logEvent("invite_modal_opened", { challengeId, selectedDays });
      } catch {}
    }
  }, [visible, challengeId, selectedDays]);

  const handleShare = useCallback(async () => {
    if (busy) return;

    // gate 900ms
    const now = Date.now();
    if (now - tapGateRef.current < 900) return;
    tapGateRef.current = now;

    setError("");

    try {
      if (!auth.currentUser?.uid) {
        setError(
          t("invitationS.errors.notLogged", {
            defaultValue: "Tu dois être connecté pour inviter.",
          })
        );
        return;
      }
      if (!challengeId || !Number.isFinite(selectedDays) || selectedDays <= 0) {
        setError(
          t("invitationS.errors.invalidPayload", {
            defaultValue: "Données d’invitation invalides.",
          })
        );
        return;
      }

      setBusy(true);
      Haptics.selectionAsync().catch(() => {});

      // 1) Idempotent: récupère ou crée une OPEN PENDING
      const { id: inviteId } = await getOrCreateOpenInvitation(challengeId, selectedDays);

      // 2) URL universelle
      const lang = getShareLang(i18n?.language as string | undefined);
      const url = buildUniversalLink({
        challengeId,
        inviteId,
        selectedDays,
        lang,
        title: challengeTitle,
      });

      const titleTxt = t("invitationS.shareTitle", { defaultValue: "Inviter un ami" });
      const msgTxt =
        t("invitationS.shareMessage", {
          title:
            challengeTitle ||
            t("challengeDetails.untitled", { defaultValue: "Défi" }),
          defaultValue: "Rejoins-moi sur « {{title}} » !",
        }) + "\n" + url;

      // 3) Partage natif (iOS met tout dans message; Android supporte url)
      const payload =
        Platform.OS === "ios"
          ? { title: titleTxt, message: msgTxt }
          : { title: titleTxt, message: msgTxt, url };

      const res = await Share.share(payload, { dialogTitle: titleTxt });

      // 4) UX + analytics
      if (res.action === Share.sharedAction) {
        try {
          logEvent("invite_share_success", {
            inviteId,
            challengeId,
            selectedDays,
            platform: Platform.OS,
          });
        } catch {}
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSent?.();
        onClose();
      } else {
        // Dismiss → copie lien pour ne pas perdre l’effort
        try {
          const { setStringAsync } = await import("expo-clipboard");
          await setStringAsync(url);
          Alert.alert(
            t("common.info", { defaultValue: "Info" }),
            t("invitationS.linkCopied", { defaultValue: "Lien copié dans le presse-papier." })
          );
          try {
            logEvent("invite_share_dismiss_copied", {
              inviteId,
              challengeId,
              selectedDays,
            });
          } catch {}
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onSent?.();
          onClose();
        } catch {
          try {
            logEvent("invite_share_dismiss_no_clipboard", {
              inviteId,
              challengeId,
              selectedDays,
            });
          } catch {}
        }
      }
    } catch (e: any) {
      console.error("❌ SendInvitationModal share-link error:", e);
      const raw = String(e?.message || "");
      const msg = raw.toLowerCase();

      if (msg.includes("invitation_already_active") || (msg.includes("already") && (msg.includes("active") || msg.includes("pending")))) {
        setError(
          t("invitationS.errors.alreadyInvited", {
            defaultValue: "Tu as déjà une invitation en attente pour ce défi.",
          })
        );
      } else if (msg.includes("permission") || msg.includes("denied") || msg.includes("non_autorise")) {
        setError(
          t("invitationS.errors.permission", {
            defaultValue: "Action non autorisée.",
          })
        );
      } else if (msg.includes("params_invalid")) {
        setError(
          t("invitationS.errors.invalidPayload", {
            defaultValue: "Données d’invitation invalides.",
          })
        );
      } else {
        setError(t("invitationS.errors.unknown", { defaultValue: "Erreur inconnue." }));
      }

      try {
        logEvent("invite_share_error", {
          error: raw?.slice?.(0, 300) || String(e),
          challengeId,
          selectedDays,
          platform: Platform.OS,
        });
      } catch {}
    } finally {
      setBusy(false);
    }
  }, [busy, challengeId, selectedDays, i18n?.language, t, onClose, onSent, challengeTitle]);

  const styles = StyleSheet.create({
    back: {
      flex: 1,
      backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    card: {
      width: "90%",
      maxWidth: 420,
      backgroundColor: th.colors.cardBackground,
      borderRadius: 20,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    title: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 20,
      color: th.colors.secondary,
      textAlign: "center",
      marginBottom: 6,
    },
    subtitle: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 14,
      color: th.colors.textSecondary,
      textAlign: "center",
      marginBottom: 14,
    },
    hint: {
      marginTop: 6,
      fontSize: 12,
      color: th.colors.textSecondary,
      textAlign: "center",
    },
    error: {
      marginTop: 10,
      fontSize: 13,
      color: th.colors.error,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      gap: 12,
      marginTop: 18,
    },
    btn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },
    cancel: { backgroundColor: th.colors.border },
    send: { backgroundColor: th.colors.primary },
    cancelText: {
      fontFamily: "Comfortaa_700Bold",
      color: th.colors.textPrimary,
      fontSize: 16,
    },
    sendText: {
      fontFamily: "Comfortaa_700Bold",
      color: "#fff",
      fontSize: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.back}
      >
        <View style={styles.card}>
          <Text style={styles.title}>
            {t("invitationS.sendTitle", { defaultValue: "Inviter un ami" })}
          </Text>

          <Text style={styles.subtitle}>
            {t("invitationS.shareSubtitle", {
              challenge:
                challengeTitle ||
                t("challengeDetails.untitled", { defaultValue: "Défi" }),
              days: selectedDays,
              defaultValue:
                "Génère un lien d’invitation ({{days}} jours). S’il a l’app → ouverture directe. Sinon → Store.",
            })}
          </Text>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!error && (
            <Text style={styles.hint}>
              {t("invitationS.shareHint", {
                defaultValue: "Le lien est universel et fonctionne partout.",
              })}
            </Text>
          )}

          <View style={{ height: 8 }} />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.cancel]}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.cancel", { defaultValue: "Annuler" })}
              testID="send-invite-cancel"
            >
              <Text style={styles.cancelText}>
                {t("commonS.cancel", { defaultValue: "Annuler" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.send]}
              onPress={handleShare}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("invitationS.generateAndShare", { defaultValue: "Générer & partager" })}
              accessibilityHint={t("invitationS.shareHint", {
                defaultValue: "Génère un lien universel à partager.",
              })}
              testID="send-invite-share"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendText}>
                  {t("invitationS.generateAndShare", {
                    defaultValue: "Générer & partager",
                  })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SendInvitationModal;
