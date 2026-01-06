import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Easing,
  AppState,
  PixelRatio,
  AccessibilityInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalize = (size: number) =>
  Math.round(
    PixelRatio.roundToNearestPixel(
      size * (Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375)
    )
  );

const BACKGROUND_COLOR = "#FFF8E7";
const PRIMARY_COLOR = "#FFB800";
const TEXT_COLOR = "#333";
const BUTTON_COLOR = "#FFFFFF";

const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const circleTop = SCREEN_HEIGHT * 0.36;
const waveCount = 4;
const SPACING = normalize(16);

const Wave = React.memo(
  ({
    opacity,
    scale,
    borderWidth,
    size,
    top,
  }: {
    opacity: Animated.Value;
    scale: Animated.Value;
    borderWidth: number;
    size: number;
    top: number;
  }) => (
    <Animated.View
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        transform: [{ scale }],
        borderWidth,
        borderColor: PRIMARY_COLOR,
        position: "absolute",
        top,
        backfaceVisibility: "hidden",
        left: (SCREEN_WIDTH - size) / 2,
      }}
    />
  )
);

export default function ForgotPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Anim: shake pour les messages
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Vagues de fond (pausées hors focus/app)
  const appStateRef = useRef(AppState.currentState);
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);
  const waves = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  ).current;

  useEffect(() => {
    const build = () =>
      waves.map((wave, index) =>
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(wave.opacity, {
                toValue: 0.1,
                duration: 2000 + index * 200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(wave.opacity, {
                toValue: 0.3 - index * 0.05,
                duration: 2000 + index * 200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(wave.scale, {
                toValue: 1.2 + index * 0.2,
                duration: 2200 + index * 250,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(wave.scale, {
                toValue: 1,
                duration: 2200 + index * 250,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      );

    const start = () => {
      if (!isFocused || appStateRef.current !== "active" || reduceMotion) return;
      animsRef.current = build();
      animsRef.current.forEach((a) => a.start());
    };
    const stop = () => {
      animsRef.current.forEach((a) => a.stop());
      animsRef.current = [];
    };

    if (isFocused) start();
    else stop();

    const sub = AppState.addEventListener("change", (s) => {
      appStateRef.current = s;
      if (s === "active" && isFocused) start();
      else stop();
    });

    return () => {
      sub.remove();
      stop();
    };
  }, [isFocused, waves, reduceMotion]);

  // Validation
  const isValidEmail = useCallback((e: string) => /\S+@\S+\.\S+/.test(e), []);
  const formValid = useMemo(() => isValidEmail(email.trim()), [email, isValidEmail]);
  const disabledCTA = loading || !formValid || isOffline;

  // Timed message clear
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!msg) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMsg(null), 5000);
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = null;
    };
  }, [msg]);

  useEffect(() => {
    const netSub = NetInfo.addEventListener((s) => {
      const off = s.isConnected === false || s.isInternetReachable === false;
      setIsOffline(!!off);
    });
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const reduceSub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(!!enabled);
      }
    );
    return () => {
      netSub && netSub();
      mounted = false;
      // @ts-ignore RN <=0.72 compat
      reduceSub?.remove?.();
    };
  }, []);

  // CTA feedback (scale + pulse)
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (formValid && !loading && !isOffline) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.02, duration: 650, useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [formValid, loading, isOffline, ctaPulse]);
  const pressIn = () => {
    if (disabledCTA) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(ctaScale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
  };
  const pressOut = () =>
    Animated.timing(ctaScale, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const handleResetPassword = async () => {
    // reset message
    if (msg) setMsg(null);

    const e = email.trim();
    if (!e || !isValidEmail(e)) {
      setMsg({ type: "error", text: t("invalidEmailFormat") });
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    if (isOffline) {
      setMsg({
        type: "error",
        text: t("networkError") || "Problème réseau. Réessaie.",
      });
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, e);
      setMsg({ type: "success", text: t("resetLinkSent") });
      setEmail(""); // ✅ on clear le champ après succès
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      const code = error?.code as string | undefined;
      const map: Record<string, string> = {
        "auth/invalid-email": t("invalidEmailFormat"),
        "auth/network-request-failed": t("networkError"),
      };

      if (code === "auth/user-not-found") {
        // ✅ On ne leak pas l’existence du compte, mais on reste en “succès”
        setMsg({ type: "success", text: t("resetLinkSent") });
        setEmail("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setMsg({
          type: "error",
          text: map[code || ""] || t("unknownError"),
        });
        triggerShake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ExpoStatusBar style="dark" backgroundColor={BACKGROUND_COLOR} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="always"
        keyboardDismissMode="on-drag"
      >
        {/* Vagues */}
        {waves.map((wave, index) => (
          <Wave
            key={index}
            opacity={wave.opacity}
            scale={wave.scale}
            borderWidth={wave.borderWidth}
            size={circleSize}
            top={circleTop}
          />
        ))}

        {/* Back */}
        <Pressable
          style={styles.backButton}
          onPress={() => !loading && router.back()}
          accessibilityLabel={t("backToLogin")}
          accessibilityRole="button"
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        >
          <Ionicons name="arrow-back" size={normalize(28)} color={TEXT_COLOR} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={t("appTitle")}
            accessibilityRole="header"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("enterEmailToResetPassword")}</Text>
        </View>

        {/* Offline banner */}
        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color="#111827" />
            <Text style={styles.offlineText}>
              {t("networkError") || "Connexion réseau indisponible"}
            </Text>
          </View>
        )}

        {/* Email */}
        <View
          style={styles.inputContainer}
          accessibilityLabel={t("resetForm")}
          accessible
        >
          <TextInput
            placeholder={t("yourEmailAddress")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (msg) setMsg(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={100}
            accessibilityLabel={t("email")}
            returnKeyType="send"
            autoFocus
            onSubmitEditing={disabledCTA ? undefined : handleResetPassword}
          />
          {!!email && (
            <TouchableOpacity
              onPress={() => setEmail("")}
              style={styles.trailingBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t("clear") || "Effacer"}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color="rgba(0,0,0,0.35)"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Messages */}
        {msg && (
          <Animated.Text
            style={[
              msg.type === "error" ? styles.errorText : styles.successText,
              { transform: [{ translateX: shakeAnim }] },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {msg.text}
          </Animated.Text>
        )}

        {/* CTA */}
<Animated.View
  style={[
    styles.ctaWrapper,
    { transform: [{ scale: Animated.multiply(ctaScale, ctaPulse) }] },
  ]}
>
  <Pressable
    style={[styles.resetButton, disabledCTA && styles.disabledButton]}
    onPressIn={pressIn}
    onPressOut={pressOut}
    android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
    onPress={!disabledCTA ? handleResetPassword : undefined}
    disabled={disabledCTA}
    accessibilityLabel={t("sendResetLink")}
    accessibilityHint={t("sendResetLinkHint") || undefined}
    accessibilityRole="button"
    accessibilityState={{ disabled: disabledCTA }}
  >
    {loading ? (
      <ActivityIndicator color={TEXT_COLOR} size="small" />
    ) : (
      <View style={styles.btnRow}>
        <Ionicons
          name="mail-open-outline"
          size={18}
          color={TEXT_COLOR}
        />
        <Text style={styles.resetButtonText}>{t("sendLink")}</Text>
      </View>
    )}
  </Pressable>
</Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING,
    paddingVertical: SPACING * 2,
  },
  backButton: {
    position: "absolute",
    top: normalize(20),
    left: normalize(20),
  },
  header: {
    position: "absolute",
    top: "10%",
    alignItems: "center",
    width: "90%",
  },
  brandTitle: {
    fontSize: normalize(42),
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  highlight: { color: PRIMARY_COLOR, fontSize: normalize(60) },
  tagline: {
    fontSize: normalize(17),
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Comfortaa_400Regular",
  },
  errorText: {
    color: "#FF4B4B",
    fontSize: normalize(16),
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
    fontFamily: "Comfortaa_700Bold",
  },
  successText: {
    color: "#059669",
    fontSize: normalize(16),
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
    fontFamily: "Comfortaa_700Bold",
  },
  inputContainer: {
    position: "absolute",
    top: "52%",
    width: "90%",
    alignItems: "center",
    flexDirection: "row",
  },
  ctaWrapper: {
  position: "absolute",
  bottom: "12%",
  left: 0,
  right: 0,
  alignItems: "center",
},
  input: {
    flex: 1,
    height: normalize(55),
    backgroundColor: BUTTON_COLOR,
    color: TEXT_COLOR,
    fontSize: normalize(16),
    paddingHorizontal: normalize(15),
    borderRadius: normalize(25),
    textAlign: "center",
    textAlignVertical: "center",
    marginBottom: 12,
    fontWeight: "500",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
  trailingBtn: { marginLeft: 8, padding: 4 },
  resetButton: {
  width: "90%",
  backgroundColor: BUTTON_COLOR,
  paddingVertical: normalize(14),
  borderRadius: normalize(25),
  alignItems: "center",
  borderWidth: 2,
  borderColor: PRIMARY_COLOR,
  shadowColor: PRIMARY_COLOR,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
},
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  disabledButton: { opacity: 0.5 },
  resetButtonText: {
    color: TEXT_COLOR,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  offlineBanner: {
    position: "absolute",
    top: "20%",
    left: "5%",
    right: "5%", // ✅ centré & safe sur tous les écrans
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE68A",
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  offlineText: {
    color: "#111827",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
  },
});
