// components/SendInvitationModal.tsx
import React, {
  useCallback,
  useState,
  useRef,
  useMemo,
  useEffect,
} from "react";
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
  Pressable,
  Alert,
  AccessibilityInfo,
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
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";

type Props = {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  challengeTitle?: string;
  isDuo?: boolean;
  onClose: () => void;
  onSent?: () => void; // succès (toast géré parent)
};

/** Normalise vers l’une des 12 locales supportées: ar, de, en, es, fr, hi, it, ru, zh, pt, ja, ko */
const getShareLang = (i18nLang?: string) => {
  const normalize = (tag?: string | null) => {
    if (!tag) return null;
    const base = tag.split(/[-_]/)[0]?.toLowerCase();
    if (!base) return null;

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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const normalize = (n: number) => {
  const base = 375;
  const scale = Math.min(Math.max(SCREEN_W / base, 0.85), 1.4);
  return Math.round(n * scale);
};

const withAlpha = (hex: string, a: number) => {
  const clamp = (x: number, min = 0, max = 1) => Math.min(Math.max(x, min), max);
  const alpha = Math.round(clamp(a) * 255)
    .toString(16)
    .padStart(2, "0");
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `#${r}${g}${b}${alpha}`;
  }
  return `#${clean}${alpha}`;
};

const SendInvitationModal: React.FC<Props> = ({
  visible,
  challengeId,
  selectedDays,
  challengeTitle,
  isDuo,
  onClose,
  onSent,
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Anti double-tap court
  const tapGateRef = useRef<number>(0);

  // ✅ Respect Reduce Motion (haptics + animations)
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

  // Analytics: ouverture du modal
  useEffect(() => {
    if (visible) {
      try {
        logEvent("invite_share_modal_opened", { challengeId, selectedDays });
      } catch {}
      setError("");
      setBusy(false);
    }
  }, [visible, challengeId, selectedDays]);

  // Reset clean à la fermeture
  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setError("");
      tapGateRef.current = 0;
    }
  }, [visible]);

  const handleShare = useCallback(async () => {
    if (busy) return;

    const now = Date.now();
    if (now - tapGateRef.current < 900) return;
    tapGateRef.current = now;

    setError("");

    try {
      if (isDuo) {
        setError(
          t("invitationS.errors.duoAlready", {
            defaultValue: "Tu es déjà en duo sur ce défi.",
          })
        );
        return;
      }
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
      if (!reduceMotion) {
        Haptics.selectionAsync().catch(() => {});
      }

      // 1) Idempotent: récupère ou crée une OPEN PENDING
      const { id: inviteId } = await getOrCreateOpenInvitation(
        challengeId,
        selectedDays
      );

      // 2) URL universelle
      const lang = getShareLang(i18n?.language as string | undefined);
      const url = buildUniversalLink({
        challengeId,
        inviteId,
        selectedDays,
        lang,
        title: challengeTitle,
      });

      const titleTxt = t("invitationS.shareTitle", {
        defaultValue: "Inviter un ami",
      });
      const msgTxt =
        t("invitationS.shareMessage", {
          title:
            challengeTitle ||
            t("challengeDetails.untitled", { defaultValue: "Défi" }),
          defaultValue: 'Rejoins-moi sur « {{title}} » !',
        }) +
        "\n" +
        url;

      const payload =
        Platform.OS === "ios"
          ? { title: titleTxt, message: msgTxt }
          : { title: titleTxt, message: msgTxt, url };

      const res = await Share.share(payload, { dialogTitle: titleTxt });

      if (res.action === Share.sharedAction) {
        try {
          logEvent("invite_share_success", {
            inviteId,
            challengeId,
            selectedDays,
            platform: Platform.OS,
          });
        } catch {}
        if (!reduceMotion) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
        onSent?.();
        onClose();
      } else {
        // Dismiss → on tente de sauver l’effort en copiant le lien
        try {
          const { setStringAsync } = await import("expo-clipboard");
          await setStringAsync(url);
          Alert.alert(
            t("common.info", { defaultValue: "Info" }),
            t("invitationS.linkCopied", {
              defaultValue: "Lien copié dans le presse-papier.",
            })
          );
          try {
            logEvent("invite_share_dismiss_copied", {
              inviteId,
              challengeId,
              selectedDays,
            });
          } catch {}
          if (!reduceMotion) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            ).catch(() => {});
          }
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

      if (
        msg.includes("invitation_already_active") ||
        (msg.includes("already") &&
          (msg.includes("active") || msg.includes("pending")))
      ) {
        setError(
          t("invitationS.errors.alreadyInvited", {
            defaultValue:
              "Tu as déjà une invitation en attente pour ce défi.",
          })
        );
      } else if (
        msg.includes("permission") ||
        msg.includes("denied") ||
        msg.includes("non_autorise")
      ) {
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
        setError(
          t("invitationS.errors.unknown", {
            defaultValue: "Erreur inconnue.",
          })
        );
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
  }, [
    busy,
    challengeId,
    selectedDays,
    i18n?.language,
    t,
    onClose,
    onSent,
    challengeTitle,
    isDuo,
    reduceMotion,
  ]);

  const styles = useMemo(
    () => createStyles(isDark, th, insets),
    [isDark, th, insets]
  );

  const handleRequestClose = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(160)}
        exiting={reduceMotion ? undefined : FadeOut.duration(140)}
        style={styles.overlay}
        accessible
        accessibilityViewIsModal
        accessibilityLabel={t("invitationS.a11yTitle", {
          defaultValue: "Envoyer une invitation en duo",
        })}
        accessibilityHint={t("invitationS.a11yHint", {
          defaultValue:
            "Génère un lien d’invitation pour partager ce défi avec un ami.",
        })}
      >
        {/* Backdrop tappable premium */}
        <Pressable
          style={styles.backdrop}
          onPress={handleRequestClose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={
            Platform.OS === "ios"
              ? Math.max(insets.top, 20) + normalize(16)
              : 0
          }
          style={styles.kav}
        >
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : ZoomIn.springify().damping(18).stiffness(190)
            }
            exiting={reduceMotion ? undefined : ZoomOut.duration(140)}
            style={styles.cardShadow}
          >
            <LinearGradient
              colors={
                [
                  withAlpha(th.colors.secondary, 0.95),
                  withAlpha(th.colors.primary, 0.9),
                ] as const
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.borderGlow}
            >
              <View style={styles.card}>
                <Text style={styles.title} accessibilityRole="header">
                  {t("invitationS.sendTitle", {
                    defaultValue: "Inviter un ami",
                  })}
                </Text>

                <Text style={styles.subtitle}>
                  {t("invitationS.shareSubtitle", {
                    challenge:
                      challengeTitle ||
                      t("challengeDetails.untitled", {
                        defaultValue: "Défi",
                      }),
                    days: selectedDays,
                    defaultValue:
                      "Génère un lien d’invitation ({{days}} jours). S’il a l’app → ouverture directe. Sinon → Store.",
                  })}
                </Text>

                {!!error && (
                  <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {error}
                  </Text>
                )}

                {!error && (
                  <Text style={styles.hint}>
                    {t("invitationS.shareHint", {
                      defaultValue:
                        "Le lien est universel et fonctionne partout (WhatsApp, SMS, réseaux…).",
                    })}
                  </Text>
                )}

                <View style={styles.buttonsRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.cancelBtn]}
                    onPress={handleRequestClose}
                    disabled={busy}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={t("commonS.cancel", {
                      defaultValue: "Annuler",
                    })}
                    testID="send-invite-cancel"
                  >
                    <Text style={styles.cancelText}>
                      {t("commonS.cancel", { defaultValue: "Annuler" })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.sendBtn]}
                    onPress={handleShare}
                    disabled={busy}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={t("invitationS.generateAndShare", {
                      defaultValue: "Générer & partager",
                    })}
                    accessibilityHint={t("invitationS.shareHint", {
                      defaultValue:
                        "Génère un lien universel à partager à ton ami.",
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
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};

const createStyles = (
  isDark: boolean,
  th: Theme,
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.65)",
    },
    kav: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Math.max(insets.top, 18),
      paddingBottom: Math.max(insets.bottom, 18),
    },
    cardShadow: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 22,
      overflow: "hidden",
      maxHeight: SCREEN_H - (insets.top + insets.bottom) - normalize(48),
    },
    borderGlow: {
      padding: 1.4,
      borderRadius: 22,
    },
    card: {
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 16,
      backgroundColor: isDark
        ? withAlpha(th.colors.cardBackground, 0.96)
        : withAlpha("#ffffff", 0.98),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(th.colors.border, 0.6),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    title: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(18),
      color: th.colors.secondary,
      textAlign: "center",
      marginBottom: 6,
    },
    subtitle: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(13),
      color: th.colors.textSecondary,
      textAlign: "center",
      marginBottom: 10,
    },
    hint: {
      marginTop: 2,
      fontSize: normalize(11),
      color: th.colors.textSecondary,
      textAlign: "center",
    },
    error: {
      marginTop: 8,
      fontSize: normalize(12),
      color: th.colors.error,
      textAlign: "center",
    },
    buttonsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
      gap: 10,
    },
    btn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      borderRadius: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 7,
      elevation: 5,
    },
    cancelBtn: {
      backgroundColor: withAlpha(th.colors.border, 0.95),
    },
    sendBtn: {
      backgroundColor: th.colors.primary,
    },
    cancelText: {
      fontFamily: "Comfortaa_700Bold",
      color: th.colors.textPrimary,
      fontSize: normalize(14),
    },
    sendText: {
      fontFamily: "Comfortaa_700Bold",
      color: "#fff",
      fontSize: normalize(14),
    },
  });

export default SendInvitationModal;
