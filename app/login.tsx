// app/login.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  TextInput,
  PixelRatio,
  ActivityIndicator,
  Platform,
  ScrollView,
  Keyboard,
  InteractionManager,
  AppState,
  AccessibilityInfo,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVisitor } from "@/context/VisitorContext";
import { useNavGuard } from "@/hooks/useNavGuard";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import {
  checkAndGrantPioneerIfEligible,
  checkAndGrantAmbassadorRewards,
  checkAndGrantAmbassadorMilestones,
} from "@/src/referral/pioneerChecker";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Palette
const COLORS = {
  background: "#FFF8E7",
  primary: "#FFB800",
  primaryDark: "#E5A700",
  text: "#1F2937",
  textMuted: "rgba(0,0,0,0.6)",
  button: "#FFFFFF",
  error: "#FF4B4B",
  inputBg: "rgba(255,255,255,0.75)",
  inputText: "#111",
  placeholder: "rgba(0,0,0,0.45)",
  border: "rgba(0,0,0,0.08)",
};

const SPACING = normalize(16);
const CARD_W = Math.min(420, SCREEN_WIDTH - SPACING * 2);
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const CIRCLE_TOP = SCREEN_HEIGHT * 0.36;
const WAVE_COUNT = 3;

// ——— Back waves (plus soft)
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
      style={[
        styles.wave,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
          borderWidth,
          borderColor: COLORS.primary,
          top,
          backfaceVisibility: "hidden",
          left: (SCREEN_WIDTH - size) / 2,
        },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      importantForAccessibility="no-hide-descendants"
    />
  )
);

// ——— Keyboard spacer
const KeyboardPadding = React.memo(() => {
  const insets = useSafeAreaInsets();
  const pad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(pad, {
        toValue: Math.max(h - insets.bottom, 0),
        duration: Platform.OS === "ios" ? e?.duration ?? 220 : 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(pad, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e?.duration ?? 220 : 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    };

    const subA = Keyboard.addListener(showEvt, onShow);
    const subB = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subA.remove();
      subB.remove();
    };
  }, [insets.bottom, pad]);

  return <Animated.View style={{ height: pad }} />;
});

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const nav = useNavGuard(router);
  const insets = useSafeAreaInsets();
  const { setGuest } = useVisitor();
  const isFocused = useIsFocused();

  const appStateRef = useRef(AppState.currentState);
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);
  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false); // toggle
  const [peekPressed, setPeekPressed] = useState(false); // press & hold
  const [isOffline, setIsOffline] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const ctaPulse = useRef(new Animated.Value(1)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  // ——— Prefill last email
  useEffect(() => {
    (async () => {
      try {
        const last = await AsyncStorage.getItem("login.lastEmail");
        if (last) setEmail(last);
      } catch {}
    })();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ——— Network status
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const explicitlyOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(!!explicitlyOffline);
    });
    return () => sub && sub();
  }, []);

  // ——— Accessibility: reduce motion
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(!!enabled);
      }
    );
    return () => {
      mounted = false;
      // @ts-ignore RN <=0.72 compat
      sub?.remove?.();
    };
  }, []);

  // ——— Background waves
  const waves = useRef(
    Array.from({ length: WAVE_COUNT }, (_, index) => ({
      opacity: new Animated.Value(0.18 - index * 0.04),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  ).current;

  useEffect(() => {
    const buildAnims = () =>
      waves.map((wave, index) =>
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(wave.opacity, {
                toValue: 0.08,
                duration: 2400 + index * 260,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(wave.opacity, {
                toValue: 0.18 - index * 0.04,
                duration: 2400 + index * 260,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(wave.scale, {
                toValue: 1.12 + index * 0.12,
                duration: 2600 + index * 280,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(wave.scale, {
                toValue: 1,
                duration: 2600 + index * 280,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      );

    const start = () => {
      if (!isFocused || appStateRef.current !== "active" || reduceMotion) return;
      animsRef.current = buildAnims();
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

  // ——— Card entrance
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => task.cancel();
  }, []);

  // ——— Error banner shake
  const shake = useRef(new Animated.Value(0)).current;
  const triggerShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 6,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shake]);

  // ——— Validation
  const isValidEmail = useCallback((e: string) => /\S+@\S+\.\S+/.test(e), []);
  const formValid = useMemo(
    () => isValidEmail(email.trim()) && password.trim().length >= 6,
    [email, password, isValidEmail]
  );

  // ——— CTA press feedback
  const pressIn = () => {
    if (!formValid || loading || isOffline || reduceMotion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(ctaScale, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = () =>
    Animated.timing(ctaScale, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  // ——— Login handler
  const handleLogin = useCallback(async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setErrorMessage("");

    const e = email.trim();
    const p = password.trim();

    if (isOffline) {
      if (isMountedRef.current) {
        setErrorMessage(
          t("networkError") || "Problème réseau. Réessaie."
        );
        if (!reduceMotion) {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
        }
        triggerShake();
      }
      submittingRef.current = false;
      return;
    }

    if (!e || !p) {
      if (isMountedRef.current) {
        setErrorMessage(t("fillEmailPassword"));
        if (!reduceMotion) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
        }
        triggerShake();
      }
      submittingRef.current = false;
      return;
    }
    if (!isValidEmail(e)) {
      if (isMountedRef.current) {
        setErrorMessage(t("invalidEmail"));
        if (!reduceMotion) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
        }
        triggerShake();
      }
      submittingRef.current = false;
      return;
    }

    try {
      if (isMountedRef.current) setLoading(true);
      await signInWithEmailAndPassword(auth, e, p);
if (!reduceMotion) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }

      AsyncStorage.setItem("login.lastEmail", e).catch(() => {});
      setGuest(false);
// ✅ REFERRAL FAST-TRACK : validation immédiate après login
      // (si B vient d’un lien ref, pioneerChecker va :
      //  - attribuer B
      //  - récompenser B
      //  - récompenser A + notif + Share&Earn)
      try {
        await checkAndGrantPioneerIfEligible();
        await checkAndGrantAmbassadorRewards();
        await checkAndGrantAmbassadorMilestones();
      } catch {}
  

// ✅ Si un deeplink pending existe → on route DIRECT vers la cible
try {
  const pendingRaw = await AsyncStorage.getItem("ties_pending_link");
  if (pendingRaw) {
    await AsyncStorage.removeItem("ties_pending_link");
    const pending = JSON.parse(pendingRaw);

    const challengeId =
      typeof pending?.challengeId === "string" ? pending.challengeId : null;
    const inviteId =
      typeof pending?.inviteId === "string" ? pending.inviteId : null;

    if (challengeId && inviteId) {
      InteractionManager.runAfterInteractions(() => {
        if (!isMountedRef.current) return;
        router.replace({
          pathname: "/profile/notifications",
          params: { challengeId, invite: inviteId },
        });
      });
      return; // ⛔️ très important: stop ici
    }

    if (challengeId) {
      InteractionManager.runAfterInteractions(() => {
        if (!isMountedRef.current) return;
        router.replace(`/challenge-details/${challengeId}`);
      });
      return; // ⛔️ stop ici
    }
  }
} catch {}

// ✅ Sinon, flow normal → on passe par "/" pour laisser AppNavigator décider
InteractionManager.runAfterInteractions(() => {
  if (isMountedRef.current) router.replace("/");
});

    } catch (error: any) {
      const errorCode = error?.code;
      const invalidCredentials = [
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/invalid-credential",
      ];
      if (invalidCredentials.includes(errorCode)) {
        if (isMountedRef.current)
          setErrorMessage(t("invalidCredentials"));
      } else {
        const map: Record<string, string> = {
          "auth/invalid-email": t("invalidEmailFormat"),
          "auth/too-many-requests": t("tooManyRequests"),
          "auth/network-request-failed":
            t("networkError") || "Problème réseau. Réessaie.",
        };
        if (isMountedRef.current)
          setErrorMessage(map[errorCode] || t("unknownError"));
      }
      if (!reduceMotion) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
      }
      triggerShake();
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    email,
    password,
    t,
    router,
    isValidEmail,
    loading,
    setGuest,
    triggerShake,
    isOffline,
    reduceMotion,
  ]);

  // Auto-dismiss error after 5s
  useEffect(() => {
    if (errorMessage) {
      const id = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(id);
    }
  }, [errorMessage]);

  // ——— CTA pulse (désactivé si reduceMotion ou offline)
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (formValid && !loading && !isOffline && !reduceMotion) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, {
            toValue: 1.02,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(ctaPulse, {
            toValue: 1.0,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [formValid, loading, isOffline, reduceMotion, ctaPulse]);

  const goSignUp = () => nav.replace("/register");
  const goForgot = () => nav.push("/forgot-password");

  const guarded =
    <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) => {
      if (loading || submittingRef.current) return;
      return fn(...args);
    };

  const goSignUpGuarded = guarded(goSignUp);
  const goForgotGuarded = guarded(goForgot);

  const disabledCTA = !formValid || loading || isOffline;
  const passwordVisible = showPassword || peekPressed;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ExpoStatusBar style="dark" backgroundColor={COLORS.background} />

      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight:
              SCREEN_HEIGHT - insets.top - insets.bottom,
            paddingBottom: SPACING * 2,
          },
        ]}
        contentInsetAdjustmentBehavior="always"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* BACKGROUND WAVES */}
        {waves.map((w, i) => (
          <Wave
            key={`wave-${i}`}
            opacity={w.opacity}
            scale={w.scale}
            borderWidth={w.borderWidth}
            size={CIRCLE_SIZE}
            top={CIRCLE_TOP}
          />
        ))}

        {/* BRAND */}
        <View style={styles.headerContainer}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="header"
            accessibilityLabel="ChallengeTies"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text
            style={styles.tagline}
            accessibilityLabel={t("appTagline")}
          >
            {t("appTagline")}
          </Text>
        </View>

        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color="#111827"
            />
            <Text style={styles.offlineText}>
              {t("networkError") ||
                "Connexion réseau indisponible"}
            </Text>
          </View>
        )}

        {/* FORM CARD */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslate }],
            },
          ]}
        >
          {/* Error banner */}
          {errorMessage ? (
            <Animated.View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                styles.errorBanner,
                { transform: [{ translateX: shake }] },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color="#fff"
              />
              <Text style={styles.errorBannerText}>
                {errorMessage}
              </Text>
            </Animated.View>
          ) : null}

          {/* E-mail */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={COLORS.primaryDark}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={emailRef}
              placeholder={t("emailPlaceholder")}
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={100}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel={t("emailPlaceholder")}
              returnKeyType="next"
              onSubmitEditing={() =>
                passwordRef.current?.focus()
              }
              blurOnSubmit={false}
              autoFocus
            />
            {!!email && (
              <TouchableOpacity
                onPress={() => setEmail("")}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10,
                }}
                accessibilityLabel={t("clear") || "Effacer"}
                style={styles.trailingBtn}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(0,0,0,0.35)"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={COLORS.primaryDark}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={passwordRef}
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              value={password}
              maxLength={100}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoComplete="password"
              textContentType="password"
              accessibilityLabel={t("passwordPlaceholder")}
              returnKeyType="done"
              onSubmitEditing={
                !disabledCTA ? handleLogin : undefined
              }
            />
            {/* Peek (press&hold) */}
            <TouchableOpacity
              onPressIn={() => setPeekPressed(true)}
              onPressOut={() => setPeekPressed(false)}
              onPress={() => setShowPassword((v) => !v)}
              style={styles.trailingBtn}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              accessibilityLabel={
                passwordVisible
                  ? t("hidePassword")
                  : t("showPassword")
              }
            >
              <Ionicons
                name={passwordVisible ? "eye-off" : "eye"}
                size={20}
                color={COLORS.primaryDark}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot */}
          <TouchableOpacity
            onPress={goForgotGuarded}
            accessibilityLabel={t("forgotPassword")}
            accessibilityRole="link"
          >
            <Text style={styles.forgotPassword}>
              {t("forgotPassword")}
            </Text>
          </TouchableOpacity>

          {/* CTA */}
          <Animated.View
            style={{
              transform: [
                {
                  scale: Animated.multiply(
                    ctaScale,
                    ctaPulse
                  ),
                },
              ],
            }}
          >
            <Pressable
              style={[
                styles.loginButton,
                disabledCTA && styles.disabledButton,
              ]}
              onPressIn={pressIn}
              onPressOut={pressOut}
              android_ripple={{
                color: "rgba(0,0,0,0.06)",
                borderless: false,
              }}
              onPress={
                !disabledCTA ? handleLogin : undefined
              }
              disabled={disabledCTA}
              accessibilityRole="button"
              accessibilityLabel={t("login")}
              accessibilityState={{ disabled: disabledCTA }}
            >
              {loading ? (
                <ActivityIndicator
                  color={COLORS.text}
                  size="small"
                />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Ionicons
                    name="log-in-outline"
                    size={18}
                    color={COLORS.text}
                  />
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.loginButtonText}
                  >
                    {t("login")}
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>
              {t("or") || "ou"}
            </Text>
            <View style={styles.divider} />
          </View>

          {/* Guest */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={async () => {
              await AsyncStorage.removeItem(
                "pendingTutorial"
              );
              setGuest(true);
              InteractionManager.runAfterInteractions(() => {
                if (isMountedRef.current) router.replace("/");
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={
              t("continueAsGuest") ||
              "Continuer en tant que visiteur"
            }
          >
            <Ionicons
              name="walk-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.guestButtonText}>
              {t("continueAsGuest") ||
                "Continuer en tant que visiteur"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* SIGN UP LINK */}
        <View style={styles.footerInline}>
          <Text style={styles.signupText}>
            {t("noAccount")}{" "}
            <Text
              style={styles.signupLink}
              onPress={goSignUpGuarded}
              accessibilityRole="link"
              accessibilityLabel={t("signupHere")}
            >
              {t("signupHere")}
            </Text>
          </Text>
        </View>

        {/* Keyboard spacer */}
        <KeyboardPadding />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING * 2,
    paddingHorizontal: SPACING,
  },
  wave: { position: "absolute" },

  headerContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.08,
    marginBottom: SPACING,
  },
  brandTitle: {
    fontSize: normalize(34),
    color: COLORS.text,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    maxWidth: "100%",
  },
  highlight: { color: COLORS.primary, fontSize: normalize(48) },
  tagline: {
    fontSize: normalize(17),
    color: "rgba(0,0,0,0.65)",
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
    maxWidth: "90%",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE68A",
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  offlineText: {
    color: "#111827",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
  },

  // Card
  card: {
    width: CARD_W,
    backgroundColor: COLORS.inputBg,
    borderRadius: normalize(22),
    padding: SPACING,
    paddingTop: SPACING,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backdropFilter: "blur(8px)" as any, // iOS only
  },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E11D48",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  errorBannerText: {
    color: "#fff",
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    flexShrink: 1,
  },

  // Inputs
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  leadingIcon: { marginRight: 8, opacity: 0.9 },
  trailingBtn: { marginLeft: 8, padding: 4 },
  input: {
    flex: 1,
    height: normalize(52),
    color: COLORS.inputText,
    fontSize: normalize(15),
    fontFamily: "Comfortaa_400Regular",
  },

  forgotPassword: {
    alignSelf: "flex-end",
    color: COLORS.primary,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: 4,
    marginBottom: 6,
  },

  // CTA
  loginButton: {
    width: "100%",
    maxWidth: CARD_W,
    backgroundColor: COLORS.button,
    paddingVertical: normalize(12),
    borderRadius: normalize(16),
    alignItems: "center",
    marginTop: SPACING / 2,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(5),
    elevation: 5,
  },
  loginBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  disabledButton: { opacity: 0.5 },
  loginButtonText: {
    color: COLORS.text,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 10,
  },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    fontFamily: "Comfortaa_400Regular",
    color: COLORS.textMuted,
    fontSize: normalize(12),
  },

  // Guest
  guestButton: {
    width: "100%",
    backgroundColor: "transparent",
    paddingVertical: normalize(12),
    borderRadius: normalize(16),
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  guestButtonText: {
    color: COLORS.primary,
    fontSize: normalize(15),
    fontFamily: "Comfortaa_700Bold",
  },

  // Footer inline
  footerInline: {
    width: "100%",
    alignItems: "center",
    marginTop: SPACING,
  },
  signupText: {
    color: COLORS.text,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  signupLink: {
    color: COLORS.primary,
    fontFamily: "Comfortaa_700Bold",
  },
});
