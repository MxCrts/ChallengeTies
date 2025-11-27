import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { acceptInvitation } from "../services/invitationService";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { normalize } from "../utils/normalize";
import { useTheme } from "../context/ThemeContext";
import * as Haptics from "expo-haptics";
import { useToast } from "@/src/ui/Toast";

type Status = "idle" | "accepted" | "error";

const HandleInvite = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { show } = useToast();

  const params = useLocalSearchParams();

  const rawChallengeId = params.challengeId;
  const rawInvite = params.invite;
  const rawUsername = (params.username ??
    params.inviterUsername) as string | string[] | undefined;

  const challengeId =
    typeof rawChallengeId === "string"
      ? rawChallengeId
      : Array.isArray(rawChallengeId)
      ? rawChallengeId[0]
      : undefined;

  const inviteId =
    typeof rawInvite === "string"
      ? rawInvite
      : Array.isArray(rawInvite)
      ? rawInvite[0]
      : undefined;

  const inviterUsername =
    typeof rawUsername === "string"
      ? rawUsername
      : Array.isArray(rawUsername)
      ? rawUsername[0]
      : undefined;

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTheme = useMemo(
    () => (isDark ? designSystem.darkTheme : designSystem.lightTheme),
    [isDark]
  );

  const hasValidParams = !!challengeId && !!inviteId;

  // Petite anim d’apparition de la carte
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, scaleAnim]);

  // ✅ évite redirection fantôme si l’écran se démonte vite
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasValidParams) {
      console.log("[HandleInvite] Invalid params", {
        challengeId,
        inviteId,
        inviterUsername,
      });
    }
  }, [hasValidParams, challengeId, inviteId, inviterUsername]);

  const decodeError = (e: any) => {
    const raw = String(e?.code || e?.message || "").toLowerCase();

    if (raw.includes("expired")) {
      // Invitation expirée -> clés dédiées
      return {
        title: t("invitation.expiredTitle"),
        message: t("invitation.expiredMessage"),
      };
    }

    if (raw.includes("auto") || raw.includes("self")) {
      return {
        title: t("invitation.notForYouTitle"),
        message: t("invitation.errors.autoInvite"),
      };
    }

    if (raw.includes("already_in_duo") || raw.includes("alreadyinduo")) {
      return {
        title: t("invitation.notForYouTitle"),
        message: t("invitation.errors.alreadyInDuoForChallenge"),
      };
    }

    if (raw.includes("not_for_you")) {
      return {
        title: t("invitation.notForYouTitle"),
        message: t("invitation.notForYouMessage"),
      };
    }

    // Fallback
    return {
      title: t("invitation.invalidTitle"),
      message: t("invitation.errors.unknown"),
    };
  };

  const handleAccept = async () => {
    if (!hasValidParams || loading) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
      const decode = decodeError(null);
      setStatus("error");
      setErrorMessage(decode.message);
      show(decode.message, "warning");
      return;
    }

    setErrorMessage(null);
    setStatus("idle");

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      await acceptInvitation(inviteId as string);

      setStatus("accepted");
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      // On laisse 700 ms pour voir le feedback, puis redirection
     redirectTimeoutRef.current = setTimeout(() => {
        router.replace(`/challenge-details/${challengeId}`);
      }, 700);
    } catch (error: any) {
      console.error("Erreur acceptation invitation:", error);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});

      const decoded = decodeError(error);
      setStatus("error");
      setErrorMessage(decoded.message);

      // ✅ Toast premium au lieu de pop-up système
      show(decoded.message, decoded.title?.toLowerCase().includes("expired") ? "warning" : "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefuse = () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace("/"); // tu peux changer pour router.back() si tu préfères
  };

  const titleText = hasValidParams
    ? t("invitation.title", {
        username:
          inviterUsername ||
          t("invitation.userFallback", { defaultValue: "Utilisateur" }),
      })
    : t("invitation.invalidTitle");

  const subtitleText = hasValidParams
    ? t("invitation.subtitle", { challengeId })
    : t("invitation.invalidMessage");

  const messageText = hasValidParams
    ? t("invitation.message")
    : t("invitation.invalidMessage");

  const pillColor =
    status === "accepted"
      ? "#22C55E"
      : status === "error"
      ? "#F97316"
      : "#FFB800";

  const pillLabel =
    status === "accepted"
      ? t("invitation.success")
      : status === "error"
      ? t("invitation.invalid")
      : "Duo";

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.modalWrapper,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ["#020617", "#0F172A"]
              : ["#0F172A", "#1E293B"]
          }
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Close pill */}
          <Pressable
            style={styles.closeButton}
            onPress={handleRefuse}
            accessibilityRole="button"
            accessibilityLabel={
              t("invitation.refuseHint") ||
              "Refuser l’invitation et fermer."
            }
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={normalize(20)} color="#FFF" />
          </Pressable>

          {/* Duo pill en haut à gauche */}
          <View style={styles.duoPill}>
            <View
              style={[
                styles.duoPillInner,
                {
                  backgroundColor: `${pillColor}33`,
                  borderColor: pillColor,
                },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={normalize(14)}
                color={pillColor}
              />
              <Text
                style={[
                  styles.duoPillText,
                  { color: pillColor },
                ]}
              >
                {pillLabel}
              </Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="people-outline"
                size={normalize(40)}
                color={currentTheme.colors.secondary}
              />
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: currentTheme.colors.textPrimary,
                  fontFamily: currentTheme.typography.title.fontFamily,
                },
              ]}
            >
              {titleText}
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: currentTheme.colors.textSecondary,
                  fontFamily: currentTheme.typography.body.fontFamily,
                },
              ]}
            >
              {subtitleText}
            </Text>
          </View>

          {/* Body message */}
          <Text
            style={[
              styles.message,
              {
                color: currentTheme.colors.textSecondary,
                fontFamily: currentTheme.typography.body.fontFamily,
              },
            ]}
          >
            {messageText}
          </Text>

          {/* Optional inline error */}
          {!!errorMessage && (
            <View style={styles.inlineError}>
              <Ionicons
                name="alert-circle-outline"
                size={normalize(16)}
                color="#F97316"
              />
              <Text
                style={[
                  styles.inlineErrorText,
                  { fontFamily: currentTheme.typography.body.fontFamily },
                ]}
              >
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            {/* Refuser */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRefuse}
              accessibilityRole="button"
              accessibilityLabel={
                t("invitation.refuseHint") ||
                "Refuser l’invitation et fermer."
              }
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  {
                    color: currentTheme.colors.textSecondary,
                    fontFamily: currentTheme.typography.body.fontFamily,
                  },
                ]}
              >
                {t("invitation.refuse")}
              </Text>
            </TouchableOpacity>

            {/* Accepter */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!hasValidParams || loading) && styles.disabledButton,
              ]}
              onPress={handleAccept}
              disabled={loading || !hasValidParams}
              accessibilityRole="button"
              accessibilityLabel={
                t("invitation.acceptHint") ||
                "Accepter l’invitation et démarrer en Duo."
              }
              accessibilityState={{ disabled: loading || !hasValidParams }}
            >
              <LinearGradient
                colors={
                  hasValidParams
                    ? ["#FFB800", "#FF8C00"]
                    : ["#4B5563", "#374151"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                {loading ? (
                  <Ionicons
                    name="sync-outline"
                    size={normalize(18)}
                    color="#FFF"
                  />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={normalize(18)}
                    color="#FFF"
                  />
                )}
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      fontFamily: currentTheme.typography.title.fontFamily,
                    },
                  ]}
                >
                  {loading
                    ? t("invitation.accepting")
                    : t("invitation.accept")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: normalize(16),
  },
  modalWrapper: {
    width: "100%",
    maxWidth: normalize(430),
  },
  modalContent: {
    borderRadius: normalize(24),
    paddingVertical: normalize(24),
    paddingHorizontal: normalize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(12) },
    shadowOpacity: 0.6,
    shadowRadius: normalize(20),
    elevation: 25,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: normalize(10),
    right: normalize(10),
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248,250,252,0.35)",
    zIndex: 2,
  },
  duoPill: {
    position: "absolute",
    top: normalize(10),
    left: normalize(14),
    zIndex: 1,
  },
  duoPillInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(999),
    borderWidth: 1,
  },
  duoPillText: {
    marginLeft: normalize(6),
    fontSize: normalize(12),
    fontWeight: "800",
  },
  header: {
    alignItems: "center",
    marginTop: normalize(24),
    marginBottom: normalize(16),
  },
  iconWrapper: {
    width: normalize(64),
    height: normalize(64),
    borderRadius: normalize(32),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.85)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.18)",
  },
  title: {
    fontSize: normalize(24),
    marginTop: normalize(14),
    textAlign: "center",
  },
  subtitle: {
    fontSize: normalize(14),
    textAlign: "center",
    marginTop: normalize(6),
    opacity: 0.9,
  },
  message: {
    fontSize: normalize(14),
    textAlign: "center",
    marginHorizontal: normalize(8),
    marginBottom: normalize(12),
  },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(8),
    marginHorizontal: normalize(8),
    gap: normalize(6),
  },
  inlineErrorText: {
    fontSize: normalize(12),
    color: "#F97316",
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: normalize(10),
    gap: normalize(10),
  },
  secondaryButton: {
    flex: 1,
    borderRadius: normalize(18),
    paddingVertical: normalize(12),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.8)",
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  secondaryButtonText: {
    fontSize: normalize(14),
    textDecorationLine: "underline",
  },
  primaryButton: {
    flex: 1.2,
    borderRadius: normalize(18),
    overflow: "hidden",
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryGradient: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(8),
  },
  primaryButtonText: {
    fontSize: normalize(16),
    color: "#FFF",
  },
});

export default HandleInvite;
