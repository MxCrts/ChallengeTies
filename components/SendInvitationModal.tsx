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
  AccessibilityInfo,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { auth } from "@/constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import {
  buildUniversalLink,
  getOrCreateOpenInvitation,
} from "@/services/invitationService";
import * as Localization from "expo-localization";
import * as Haptics from "expo-haptics";
import { logEvent } from "@/src/analytics";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DAY_OPTIONS = [7, 14, 21, 30, 60, 90, 180, 365];
const FIRSTPICK_SHARE_IN_PROGRESS_KEY = "ties_firstpick_share_in_progress_v1";

const setShareInProgress = async (v: boolean) => {
  try {
    if (v) await AsyncStorage.setItem(FIRSTPICK_SHARE_IN_PROGRESS_KEY, "1");
    else await AsyncStorage.removeItem(FIRSTPICK_SHARE_IN_PROGRESS_KEY);
  } catch {}
};

type Props = {
  visible: boolean;
  challengeId: string;
  selectedDays: number;
  challengeTitle?: string;
  isDuo?: boolean;
  onClose: () => void;
  onSent?: (result: "shared" | "dismiss" | "start_solo", meta?: { inviteId?: string }) => void;

};

/** Normalise vers l’une des 12 locales supportées: ar, de, en, es, fr, hi, it, ru, zh, pt, ja, ko, nl */
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
         "nl", 
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
  const { width: screenW, height: screenH } = useWindowDimensions();

  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [busy, setBusy] = useState(false);
  
  const [error, setError] = useState<string>("");
  const [reduceMotion, setReduceMotion] = useState(false);

  const [localDays, setLocalDays] = useState(selectedDays);
  const [showDays, setShowDays] = useState(false);

useEffect(() => {
  if (visible) setLocalDays(selectedDays);
}, [visible, selectedDays]);

const scale = useMemo(() => {
    const base = 375;
    return Math.min(Math.max(screenW / base, 0.85), 1.4);
  }, [screenW]);
  const n = useCallback((v: number) => Math.round(v * scale), [scale]);


  // Anti double-tap court
  const tapGateRef = useRef<number>(0);
  const isSharingRef = useRef(false);


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
      setShowDays(false);
    }
  }, [visible, challengeId, selectedDays]);

  // Reset clean à la fermeture
  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setError("");
      tapGateRef.current = 0;
      setShowDays(false);
    }
  }, [visible]);

  const handleLater = useCallback(async () => {
  // ✅ Si un share est en cours, on ne fait rien (évite états bizarres)
  if (busy || isSharingRef.current) return;

  try {
    if (!reduceMotion) Haptics.selectionAsync().catch(() => {});
    logEvent?.("invite_start_solo_clicked", { challengeId, selectedDays: localDays });
  } catch {}

  // ✅ Event unique. Le parent décide (takeChallenge + goHome).
  onSent?.("start_solo");
  await setShareInProgress(false);
  onClose();
}, [busy, reduceMotion, challengeId, localDays, onSent, onClose]);

const shareLocked = busy || isSharingRef.current;

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
      if (!challengeId || !Number.isFinite(localDays) || localDays <= 0) {
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
      const { id: inviteId } = await getOrCreateOpenInvitation(challengeId, localDays);

      // 2) URL universelle
      const lang = getShareLang(i18n?.language as string | undefined);
      const url = buildUniversalLink({
        challengeId,
        inviteId,
        selectedDays: localDays,
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

 isSharingRef.current = true;

      // ✅ CRITIQUE: flags AVANT ShareSheet (Android peut "repasser" par "/")
      await setShareInProgress(true);

      await Share.share(payload, { dialogTitle: titleTxt });

try {
  logEvent?.("invite_share_sheet_closed", {
    inviteId,
    challengeId,
    selectedDays: localDays,
    platform: Platform.OS,
  });
} catch {}

// ✅ Flow unique : on ne devine pas iOS/Android
// Le parent affichera "Bien envoyé ? Oui/Non"
onSent?.("dismiss", { inviteId });
onClose();
return;


    } catch (e: any) {
      console.error("❌ SendInvitationModal share-link error:", e);
      await setShareInProgress(false);
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
          t("invitationS.errors.permissions", { defaultValue: "Action non autorisée." })
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
          selectedDays: localDays,
          platform: Platform.OS,
        });
      } catch {}
    } finally {
  isSharingRef.current = false;
  setBusy(false);
}

  }, [
    busy,
    challengeId,
    localDays,
    i18n?.language,
    t,
    onClose,
    onSent,
    challengeTitle,
    isDuo,
    reduceMotion,
  ]);

  const styles = useMemo(
    () => createStyles(isDark, th, insets, screenW, screenH, n),
    [isDark, th, insets, screenW, screenH, n]
  );

  const compact = showDays;
  const soloBtnLabel = useMemo(() => {
  // ✅ Toujours court => jamais coupé
  return t("invitationS.startSoloShort", { defaultValue: "Solo" }) as string;
}, [t]);

const handleRequestClose = () => {
  // 🚫 interdit toute fermeture pendant un share
  if (shareLocked) return;
  onClose();
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
          disabled={shareLocked}
          accessibilityRole="button"
          accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={
            Platform.OS === "ios"
              ? Math.max(insets.top, 20) + n(16)
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
             <View style={[styles.card, compact && styles.cardCompact]}>
  {/* Header */}
  <View style={[styles.headerRow, compact && styles.headerRowCompact]}>

    <View style={styles.titleRow}>
      <View style={styles.titleIcon}>
        <Ionicons name="people" size={16} color={stylesVars.iconColor(isDark)} />
      </View>

      <View style={styles.titleCol}>
        <Text style={styles.title} accessibilityRole="header">
          {t("invitationS.sendTitle", { defaultValue: "Inviter un ami" })}
        </Text>
        <Text style={styles.subtitleInline} numberOfLines={2}>
          {t("invitationS.subtitle", {
            defaultValue: "Partage un lien. Ton ami rejoint ce défi en Duo.",
          })}
        </Text>
      </View>
    </View>

    <TouchableOpacity
      onPress={handleRequestClose}
      disabled={shareLocked}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
      style={styles.closeBtn}
    >
      <Ionicons name="close" size={18} color={stylesVars.iconColor(isDark)} />
    </TouchableOpacity>
  </View>

{/* Body (scrollable slot) */}
<ScrollView
  style={styles.bodyScroll}
  contentContainerStyle={styles.bodyScrollContent}
  showsVerticalScrollIndicator={false}
  bounces={false}
  overScrollMode="never"
  keyboardShouldPersistTaps="handled"
  nestedScrollEnabled
>
  {!!challengeTitle && (
    <View style={[styles.challengePill, compact && styles.challengePillCompact]}>
      <Ionicons name="flame" size={14} color={stylesVars.accent(th)} />
      <Text style={styles.challengePillText} numberOfLines={1}>
        {challengeTitle}
      </Text>
    </View>
  )}

  {/* Why Duo (micro UX Apple Keynote) */}
  <View style={[styles.whyBox, compact && styles.whyBoxCompact]}>
    <Ionicons name="sparkles" size={16} color={stylesVars.accent(th)} />
    <Text style={styles.whyText}>
      {t("invitationS.whyDuo", {
        defaultValue: "À deux, tu tiens plus longtemps. C’est simple et ça marche.",
      })}
    </Text>
  </View>

  {!!error && (
    <View
      style={styles.alertBox}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name="alert-circle"
        size={16}
        color={stylesVars.errorColor(isDark, th)}
      />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  )}

  <View style={[styles.sectionCard, compact && styles.sectionCardCompact]}>
    <View style={styles.daysTopRow}>
      <Text style={styles.daysInlineLabel}>
        {t("invitationS.durationLabel", { defaultValue: "Durée" })}:{" "}
        {t("firstPick.day", { count: localDays }) as string}
      </Text>

      <TouchableOpacity
        onPress={() => {
          setShowDays((v) => !v);
          if (!reduceMotion) Haptics.selectionAsync().catch(() => {});
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("invitationS.changeDuration", {
          defaultValue: "Modifier la durée",
        })}
        style={styles.daysToggleBtn}
        disabled={shareLocked}
      >
        <Text style={styles.daysToggleText}>
          {showDays
            ? (t("invitationS.ctaDone", { defaultValue: "OK" }) as string)
            : (t("invitationS.ctaChange", { defaultValue: "Changer" }) as string)}
        </Text>
        <Ionicons
          name={showDays ? "chevron-up" : "chevron-down"}
          size={14}
          color={stylesVars.accent(th)}
        />
      </TouchableOpacity>
    </View>

    {showDays && (
      <View style={[styles.daysRow, styles.daysRowScrollable]}>
        {DAY_OPTIONS.map((d) => {
          const selected = d === localDays;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => {
                setLocalDays(d);
                if (!reduceMotion) Haptics.selectionAsync().catch(() => {});
              }}
              style={[
                styles.dayChip,
                styles.dayChipScrollable,
                selected && styles.dayChipSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t("firstPick.day", { count: d }) as string}
              disabled={shareLocked}
            >
              <Text
                style={[
                  styles.dayChipText,
                  selected && styles.dayChipTextSelected,
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    )}
  </View>
</ScrollView>



  {/* Buttons */}
  <View style={[styles.buttonsRow, compact && styles.buttonsRowCompact]}>
    <TouchableOpacity
  style={[
    styles.btn,
    styles.secondaryBtn,
    compact && styles.btnCompact,
    compact && styles.secondaryBtnCompact,
  ]}
  onPress={handleLater}
  disabled={shareLocked}
  activeOpacity={0.9}
  accessibilityRole="button"
  accessibilityLabel={t("invitationS.startSolo", { defaultValue: "Commencer en solo" })}
  testID="send-invite-start-solo"
>
  <View style={styles.secondaryInner}>
    <Ionicons
      name="person"
      size={16}
      color={stylesVars.iconColor(isDark)}
      style={styles.secondaryIcon}
    />
    <Text
  style={styles.secondaryText}
  numberOfLines={1}
  ellipsizeMode="tail"
>
  {soloBtnLabel}
</Text>
  </View>
</TouchableOpacity>


    <TouchableOpacity
      onPress={handleShare}
      disabled={shareLocked}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={t("invitationS.ctaInvite", { defaultValue: "Inviter" })}
      testID="send-invite-share"
      style={styles.primaryBtnWrap}
    >
      <LinearGradient
        colors={[
          withAlpha(th.colors.secondary, isDark ? 0.95 : 0.98),
          withAlpha(th.colors.primary, isDark ? 0.92 : 0.98),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryBtn, compact && styles.primaryBtnCompact]}
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="send" size={16} color="#000" />
 <Text style={styles.primaryText}>
   {t("invitationS.ctaInvite", { defaultValue: "Inviter" })}
 </Text>
          </>
        )}
      </LinearGradient>
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

const stylesVars = {
  iconColor: (isDark: boolean) => (isDark ? "#F8FAFC" : "#0B1220"),
  iconMuted: (isDark: boolean, th: Theme) => (isDark ? withAlpha("#F8FAFC", 0.7) : withAlpha(th.colors.textPrimary, 0.7)),
  successColor: (isDark: boolean) => (isDark ? "#34D399" : "#059669"),
  errorColor: (isDark: boolean, th: Theme) => (isDark ? "#FB7185" : th.colors.error),
  accent: (th: Theme) => th.colors.primary || "#FF7A18",
};


const createStyles = (
  isDark: boolean,
  th: Theme,
  insets: { top: number; bottom: number },
  screenW: number,
  screenH: number,
  n: (v: number) => number
) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.60)",
    },
    kav: {
  flexGrow: 1,
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
  paddingTop: Math.max(insets.top, 12),
  paddingBottom: Math.max(insets.bottom, 12),
},

    cardShadow: {
  width: "100%",
  maxWidth: 420,
  borderRadius: 26,
  overflow: "hidden",

 maxHeight: screenH - (insets.top + insets.bottom) - n(28),
  minHeight: n(320),

  alignSelf: "stretch",
},
titleCol: {
  flex: 1,
  minWidth: 0,
},
    borderGlow: {
  padding: 1.6,
  borderRadius: 26,

  // ✅ fait remplir le wrapper
  flex: 1,
},
    contentScroll: {
  width: "100%",
  flexGrow: 0,
  flexShrink: 1,
  minHeight: 0,
},

contentScrollContent: {
  paddingBottom: 6, // ✅ évite le cut visuel bas
},

contentScrollable: {
  flexShrink: 1,
  minHeight: 0,
},

daysRowScrollable: {
  marginTop: 10,
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
  paddingHorizontal: 2,
  paddingBottom: 2,
},
dayChipScrollable: {
  minWidth: n(60),
  paddingVertical: 8,
  paddingHorizontal: 10,
},
    // ✅ Glass card premium (plus de “blanc plat”)
    card: {
  borderRadius: 24,
  paddingVertical: 18,
  paddingHorizontal: 16,
  backgroundColor: isDark ? withAlpha("#0B1220", 0.92) : withAlpha("#FFFFFF", 0.96),
  borderWidth: 1,
  borderColor: isDark ? withAlpha("#FFFFFF", 0.10) : withAlpha("#0B1220", 0.08),

  // ✅ layout colonne + autorise le ScrollView à scroller
  flex: 1,
  flexDirection: "column",
  minHeight: 0,

  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 22,
    },
    android: { elevation: 10 },
  }),
},
bodyScroll: {
  // ✅ le “slot” scrollable entre header et boutons
  flex: 1,
  minHeight: 0,
  width: "100%",
},

bodyScrollContent: {
  paddingBottom: 12, // ✅ évite cut sous le dernier élément
},
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    titleIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? withAlpha(th.colors.primary, 0.18) : withAlpha(th.colors.primary, 0.14),
     borderWidth: 1,
     borderColor: isDark ? withAlpha(th.colors.primary, 0.30) : withAlpha(th.colors.primary, 0.26),
    },

    title: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: n(18),
      color: isDark ? "#F8FAFC" : "#0B1220",
      textAlign: "left",
      flexShrink: 1,
    },
    subtitleInline: {
      marginTop: 2,
      fontFamily: "Comfortaa_400Regular",
      fontSize: n(12.5),
      color: isDark ? withAlpha("#F8FAFC", 0.72) : withAlpha("#0B1220", 0.62),
      lineHeight: n(17),
    },
    subtitle: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: n(13),
      color: isDark ? withAlpha("#F8FAFC", 0.78) : withAlpha("#0B1220", 0.72),
      textAlign: "left",
      marginBottom: 10,
      lineHeight: n(18),
    },

    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? withAlpha("#FFFFFF", 0.08) : withAlpha("#0B1220", 0.06),
      borderWidth: 1,
      borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#0B1220", 0.08),
    },

    hint: {
      marginTop: 2,
      fontSize: n(11.5),
      color: isDark ? withAlpha("#F8FAFC", 0.65) : withAlpha("#0B1220", 0.58),
      textAlign: "left",
      lineHeight: n(16),
      marginBottom: 10,
    },

    // ✅ Alert premium
    alertBox: {
      marginTop: 2,
      marginBottom: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: isDark ? withAlpha("#FB7185", 0.12) : withAlpha("#FB7185", 0.10),
      borderWidth: 1,
      borderColor: isDark ? withAlpha("#FB7185", 0.25) : withAlpha("#FB7185", 0.20),
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    errorText: {
      flex: 1,
      fontSize: n(12),
      color: isDark ? "#FEE2E2" : "#9F1239",
      fontFamily: "Comfortaa_700Bold",
      lineHeight: n(16),
    },
    content: {
  marginTop: 0,
  flexShrink: 1,
  minHeight: 0,
},

contentCompact: {
  flexShrink: 1,
  minHeight: 0,
},
headerRowCompact: {
  marginBottom: 6,
},
challengePillCompact: {
  marginBottom: 6,
  paddingVertical: 6,
},
sectionCardCompact: {
  padding: 9,
  marginBottom: 2,
},
buttonsRowCompact: {
  marginTop: 8,
},
btnCompact: {
  paddingVertical: 11,
},

secondaryBtnCompact: {
  // rien d'obligatoire, mais on garde la cohérence
},

primaryBtnCompact: {
  paddingVertical: 12,
},

    challengePill: {
  alignSelf: "flex-start",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  marginBottom: 12,
  backgroundColor: isDark ? withAlpha("#FFFFFF", 0.06) : withAlpha("#0B1220", 0.05),
  borderWidth: 1,
  borderColor: isDark ? withAlpha("#FFFFFF", 0.10) : withAlpha("#0B1220", 0.08),
},
challengePillText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: n(12.5),
  color: isDark ? withAlpha("#F8FAFC", 0.88) : withAlpha("#0B1220", 0.78),
  maxWidth: 300,
},
    // ✅ Compact mode (quand showDays=true) => garantit que ça rentre sans scroll
    cardCompact: {
  paddingVertical: 12,
  paddingBottom: 10,
},
whyBox: {
  flexDirection: "row",
  alignItems: "center",
 gap: 10,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 16,
  marginBottom: 10,
  backgroundColor: isDark ? withAlpha(th.colors.primary, 0.10) : withAlpha(th.colors.primary, 0.08),
  borderWidth: 1,
  borderColor: isDark ? withAlpha(th.colors.primary, 0.22) : withAlpha(th.colors.primary, 0.18),
},
whyBoxCompact: {
  paddingVertical: 8,
  marginBottom: 8,
},
whyText: {
  flex: 1,
  minWidth: 0,
  fontFamily: "Comfortaa_700Bold",
  fontSize: n(12.5),
  lineHeight: n(17),
  color: isDark ? withAlpha("#F8FAFC", 0.92) : withAlpha("#0B1220", 0.78),
},
    daysRowCompact: {
      marginTop: 1,
      gap: 1,
      // 4 colonnes stable (évite les retours de ligne bizarres)
    },
    dayChipCompact: {
  width: Math.floor((Math.min(screenW, 420) - 16 * 2 - 12 * 2 - 8 * 3) / 4),
  minWidth: 0,
  paddingVertical: 8,
  paddingHorizontal: 1,
},
dayChipTextCompact: {
  fontSize: n(12),
},

    // ✅ Section surface (durée)
    sectionCard: {
      marginTop: 4,
      marginBottom: 6,
      padding: 12,
     paddingBottom: 10,
      borderRadius: 18,
      backgroundColor: isDark ? withAlpha("#FFFFFF", 0.07) : withAlpha("#0B1220", 0.035),
      borderWidth: 1,
      marginHorizontal: 2,
      borderColor: isDark ? withAlpha("#FFFFFF", 0.10) : withAlpha("#0B1220", 0.08),
    },

    daysContainer: { marginTop: 0, marginBottom: 0 },

    daysTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    daysInlineLabel: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: n(13),
      color: isDark ? "#F8FAFC" : "#0B1220",
      flexShrink: 1,
    },

    daysToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
 paddingHorizontal: 10,
 borderRadius: 999,
      backgroundColor: isDark ? withAlpha("#FFFFFF", 0.08) : withAlpha("#0B1220", 0.06),
      borderWidth: 1,
      borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#0B1220", 0.08),
    },
    daysToggleText: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: n(11.5),
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
daysRow: {
     marginTop: 8,              // ✅ moins d’espace sous le header Durée
     flexDirection: "row",
     flexWrap: "wrap",
     justifyContent: "center",
     gap: 8,                    // ✅ serré mais respirant
     paddingHorizontal: 2,      // ✅ évite que ça “touche” la bordure
   },
    // ✅ Chips contrastées
    dayChip: {
       minWidth: n(64),
      alignItems: "center",
     paddingVertical: 9,
     paddingHorizontal: 10,
 borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? withAlpha("#FFFFFF", 0.14) : withAlpha("#0B1220", 0.12),
      backgroundColor: isDark ? withAlpha("#0B1220", 0.72) : withAlpha("#FFFFFF", 0.92),
    },
    dayChipSelected: {
      backgroundColor: th.colors.primary,  // ✅ brand (orange)
     borderColor: withAlpha(th.colors.primary, 0.95),
      ...Platform.select({
   ios: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
   android: { elevation: 6 },
 }),
    },
    dayChipText: {
      fontFamily: "Comfortaa_700Bold",
     fontSize: n(13),
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    dayChipTextSelected: {
      color: "#0B1220",
    },
    dayChipUnit: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: n(10),
      color: isDark ? withAlpha("#F8FAFC", 0.6) : withAlpha("#0B1220", 0.5),
    },
    dayChipUnitSelected: {
      color: isDark ? withAlpha("#0B1220", 0.65) : withAlpha("#F8FAFC", 0.75),
    },
    secondaryInner: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,        // au lieu de 8
  width: "100%",
},

secondaryIcon: {
  marginTop: Platform.OS === "ios" ? 0 : 1, // micro align visuel
},
buttonsRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 12,
  gap: 10,

  // ✅ footer fixe (ne se fait plus bouffer)
  flexShrink: 0,
},
    btn: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 13,
  borderRadius: 16,
},
    // ✅ Secondary button
    secondaryBtn: {
      backgroundColor: isDark ? withAlpha("#FFFFFF", 0.08) : withAlpha("#0B1220", 0.06),
      borderWidth: 1,
      borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#0B1220", 0.10),
    },
    secondaryText: {
  fontFamily: "Comfortaa_700Bold",
  color: isDark ? "#F8FAFC" : "#0B1220",
  fontSize: n(14),

  // ✅ anti-coupure
  flexShrink: 1,
  minWidth: 0,
  textAlign: "center",
},
    // ✅ Primary button gradient wrap
    primaryBtnWrap: { flex: 1, borderRadius: 16, overflow: "hidden" },
    primaryBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 16,
  paddingVertical: 13,
},
    scroll: {
      flexGrow: 0,
      marginTop: 0,
    },
    scrollContent: {
      paddingBottom: 10, // ✅ évite le “cut” visuel au bas
    },
    primaryText: {
      fontFamily: "Comfortaa_700Bold",
      color: "#000",
      fontSize: n(14.5),
    },
  });


export default SendInvitationModal;
