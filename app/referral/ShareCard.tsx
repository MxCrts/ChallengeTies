// app/referral/ShareCard.tsx
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  Easing,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";

import { auth } from "@/constants/firebase-config";
import { buildWebLink, getAppNameFallback } from "@/src/referral/links";
import { logEvent } from "@/src/analytics";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "@/theme/designSystem";
import { tap, success } from "@/src/utils/haptics";

const P = 16;

type ToastType = "success" | "error" | "info";
interface ToastState {
  type: ToastType;
  message: string;
}
const TOAST_DURATION = 2200;

export default function ShareCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette = isDark
    ? designSystem.darkTheme.colors
    : designSystem.lightTheme.colors;

  const { width } = useWindowDimensions();

  const normalize = useCallback(
    (size: number) => {
      const baseWidth = 375;
      const scale = Math.min(Math.max(width / baseWidth, 0.7), 1.9);
      return Math.round(size * scale);
    },
    [width]
  );

  const styles = useMemo(() => makeStyles(normalize), [normalize]);

  const me = auth.currentUser;

  const username =
    me?.displayName ||
    me?.email?.split("@")[0] ||
    t("referral.shareCard.defaultUsername", {
      defaultValue: "New Challenger",
    });

  const refUid = me?.uid || "me";
  const webLink = useMemo(() => buildWebLink(refUid), [refUid]);
  const appName = getAppNameFallback();

  // ✅ ref ViewShot
  const shotRef = useRef<ViewShot | null>(null);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  // Responsive card / QR
  const cardWidth = useMemo(() => {
    const w = width - P * 2;
    return Math.min(Math.max(w, 280), 380);
  }, [width]);

  const qrSize = useMemo(() => Math.round(cardWidth * 0.56), [cardWidth]);

  // === Toast premium (comme ShareAndEarn) ===
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(10)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

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
      isMountedRef.current = false;
      // @ts-ignore RN compat
      sub?.remove?.();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      if (!isMountedRef.current) return;

      setToast({ type, message });

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      toastOpacity.setValue(0);
      toastTranslateY.setValue(10);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      toastTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: reduceMotion ? 0 : 220,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslateY, {
            toValue: 10,
            duration: reduceMotion ? 0 : 220,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMountedRef.current) return;
          setToast((current) =>
            current && current.message === message ? null : current
          );
        });
      }, TOAST_DURATION);
    },
    [reduceMotion, toastOpacity, toastTranslateY]
  );

  const captureCard = useCallback(async () => {
    if (!shotRef.current) {
      throw new Error("viewshot_ref_null");
    }
    return await captureRef(shotRef.current, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });
  }, []);

  const onSave = useCallback(async () => {
    tap();
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "error",
          String(
            t("referral.shareCard.alerts.permission.media", {
              defaultValue:
                "Autorise l’accès à ta galerie pour enregistrer la carte.",
            })
          )
        );
        return;
      }

      if (!isMountedRef.current) return;
      setBusy("save");

      const uri = await captureCard();
      await MediaLibrary.saveToLibraryAsync(uri);

      success();
      showToast(
        "success",
        String(
          t("referral.shareCard.alerts.saved.msg", {
            defaultValue: "Carte enregistrée dans ta galerie 📸",
          })
        )
      );

      try {
        await logEvent("share_card_saved");
      } catch {}
    } catch (e: any) {
      console.log("save error:", e?.message ?? e);
      showToast(
        "error",
        String(
          t("referral.shareCard.alerts.saveFailed", {
            defaultValue: "Impossible d’enregistrer la carte.",
          })
        )
      );
    } finally {
      if (isMountedRef.current) {
        setBusy(null);
      }
    }
  }, [t, captureCard, showToast]);

  const onShare = useCallback(async () => {
    tap();
    try {
      if (!webLink) {
        showToast(
          "error",
          String(
            t("referral.shareCard.alerts.missingLink", {
              defaultValue: "Lien de parrainage introuvable.",
            })
          )
        );
        return;
      }

      if (!isMountedRef.current) return;
      setBusy("share");

      const uri = await captureCard();

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
        success();

        showToast(
          "success",
          String(
            t("referral.shareCard.alerts.shared", {
              defaultValue: "Carte prête à être partagée 🚀",
            })
          )
        );

        try {
          await logEvent("share_card_shared");
        } catch {}
      } else {
        showToast(
          "info",
          String(
            t("referral.shareCard.alerts.shareUnavailable.msg", {
              defaultValue:
                "Le partage natif n’est pas disponible sur cet appareil.",
            })
          )
        );
      }
    } catch (e: any) {
      console.log("share error:", e?.message ?? e);
      showToast(
        "error",
        String(
          t("referral.shareCard.alerts.shareFailed", {
            defaultValue: "Impossible de partager la carte.",
          })
        )
      );
    } finally {
      if (isMountedRef.current) {
        setBusy(null);
      }
    }
  }, [t, captureCard, showToast, webLink]);

  // Backgrounds pour lisibilité QR
  const qrBg = isDark ? "rgba(255,255,255,0.06)" : "#FFF7D6";
  const footerBg = isDark ? "rgba(255,255,255,0.08)" : "#FFE9A6";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <LinearGradient
        colors={[palette.background, palette.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.screen}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: palette.textPrimary }]}
            accessibilityRole="header"
          >
            {t("referral.shareCard.title")}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            {t("referral.shareCard.subtitle")}
          </Text>
        </View>

        {/* Carte à capturer */}
        <ViewShot
          ref={shotRef}
          style={styles.cardWrapper}
          options={{ format: "png", quality: 1 }}
        >
          <View
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: palette.cardBackground,
                borderColor: palette.primary,
              },
            ]}
            accessible
            accessibilityLabel={t("referral.shareCard.cardLabel", {
              defaultValue: "Carte de parrainage",
            })}
          >
            <Text style={[styles.app, { color: palette.primary }]}>
              {appName}
            </Text>

            <Text
              style={[styles.handle, { color: palette.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              @{username}
            </Text>

            <View
              style={[
                styles.qrWrap,
                {
                  backgroundColor: qrBg,
                  borderColor: palette.primary,
                },
              ]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={t("referral.shareCard.qrLabel", {
                defaultValue: "QR code de parrainage",
              })}
            >
              {/* QR Code fallback si jamais webLink est vide (ultra rare) */}
              <QRCode value={webLink || "https://challenge-ties.app"} size={qrSize} />
            </View>

            <Text
              numberOfLines={1}
              ellipsizeMode="middle"
              style={[styles.linkText, { color: palette.textSecondary }]}
              selectable
            >
              {webLink}
            </Text>

            <Text
              style={[styles.tagline, { color: palette.textPrimary }]}
              numberOfLines={2}
            >
              {t("referral.shareCard.tagline")}
            </Text>

            <View
              style={[
                styles.footer,
                {
                  backgroundColor: footerBg,
                  borderColor: palette.primary,
                },
              ]}
            >
              <Text
                style={[styles.footerText, { color: palette.textPrimary }]}
                numberOfLines={2}
              >
                {t("referral.shareCard.footer")}
              </Text>
            </View>
          </View>
        </ViewShot>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            disabled={!!busy}
            style={[
              styles.btn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "#FFE9A6",
                borderColor: isDark ? "rgba(255,255,255,0.2)" : "#111",
                opacity: busy ? 0.7 : 1,
              },
            ]}
            onPress={onSave}
            accessibilityRole="button"
            accessibilityLabel={t("referral.shareCard.actions.save")}
          >
            {busy === "save" ? (
              <ActivityIndicator
                color={isDark ? palette.textPrimary : "#111"}
              />
            ) : (
              <>
                <Ionicons
                  name="download-outline"
                  size={normalize(18)}
                  color={isDark ? palette.textPrimary : "#111"}
                />
                <Text
                  style={[
                    styles.btnTxt,
                    { color: isDark ? palette.textPrimary : "#111" },
                  ]}
                >
                  {t("referral.shareCard.actions.save")}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!!busy}
            style={[
              styles.btn,
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                borderColor: isDark ? "rgba(0,0,0,0.9)" : "#111",
                opacity: busy ? 0.7 : 1,
              },
            ]}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t("referral.shareCard.actions.share")}
          >
            {busy === "share" ? (
              <ActivityIndicator color={isDark ? "#000" : "#111"} />
            ) : (
              <>
                <Ionicons
                  name="share-social-outline"
                  size={normalize(18)}
                  color={isDark ? "#000" : "#111"}
                />
                <Text
                  style={[
                    styles.btnTxt,
                    { color: isDark ? "#000" : "#111" },
                  ]}
                >
                  {t("referral.shareCard.actions.share")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Toast premium bottom */}
        {toast && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastContainer,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.toastInner,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "error" && styles.toastError,
                toast.type === "info" && styles.toastInfo,
              ]}
            >
              <Text style={styles.toastIcon}>
                {
                  {
                    success: "✅",
                    error: "⚠️",
                    info: "ℹ️",
                  }[toast.type]
                }
              </Text>
              <Text style={styles.toastText} numberOfLines={3}>
                {toast.message}
              </Text>
            </View>
          </Animated.View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const makeStyles = (normalize: (n: number) => number) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    screen: {
      flex: 1,
      padding: P,
    },

    header: {
      marginBottom: P,
    },
    title: {
      fontSize: normalize(21),
      fontWeight: "900",
    },
    subtitle: {
      marginTop: 4,
      fontSize: normalize(13),
      fontWeight: "500",
    },

    cardWrapper: {
      alignItems: "center",
      paddingTop: 6,
      paddingBottom: 8,
    },
    card: {
      borderRadius: 24,
      paddingVertical: P * 1.2,
      paddingHorizontal: P * 1.1,
      borderWidth: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      alignItems: "center",
    },
    app: {
      fontSize: normalize(13),
      fontWeight: "900",
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    handle: {
      fontSize: normalize(20),
      fontWeight: "900",
      marginBottom: 10,
      maxWidth: "100%",
    },
    qrWrap: {
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    linkText: {
      fontSize: normalize(11),
      opacity: 0.95,
      marginBottom: 6,
      maxWidth: "100%",
    },
    tagline: {
      fontSize: normalize(13),
      fontWeight: "700",
      marginBottom: 6,
      textAlign: "center",
    },
    footer: {
      marginTop: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    footerText: {
      fontSize: normalize(11),
      fontWeight: "800",
      textAlign: "center",
    },

    actions: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 10,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      marginRight: 12,
    },
    primaryBtn: {
      marginRight: 0,
    },
    btnTxt: {
      fontWeight: "900",
      fontSize: normalize(12),
      marginLeft: 8,
    },

    // Toast
    toastContainer: {
      position: "absolute",
      left: P,
      right: P,
      bottom: P * 2.5,
      alignItems: "center",
      justifyContent: "center",
    },
    toastInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(15,23,42,0.95)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    toastText: {
      marginLeft: 8,
      fontSize: normalize(12),
      fontWeight: "700",
      color: "#F9FAFB",
      flexShrink: 1,
    },
    toastSuccess: {
      backgroundColor: "#16A34A",
    },
    toastError: {
      backgroundColor: "#DC2626",
    },
    toastInfo: {
      backgroundColor: "#0F172A",
    },
    toastIcon: {
      fontSize: normalize(14),
      color: "#F9FAFB",
    },
  });
