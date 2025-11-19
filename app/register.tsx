import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  PixelRatio,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  InteractionManager,
  AppState,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { askPermissionsOnceAfterSignup } from "../services/permissionsOnboarding";
import * as HapticsModule from "expo-haptics";
import { useNavGuard } from "@/hooks/useNavGuard";
import i18n from "../i18n";
import { logEvent } from "../src/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import { Easing as RNEasing } from "react-native";
import { useRouter } from "expo-router";


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

const PRIMARY_COLOR = "#FFB800";
const TEXT_COLOR = "#333";
const BUTTON_COLOR = "#FFFFFF";

const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.85;
const circleTop = SCREEN_HEIGHT * 0.35;
const waveCount = 4;
const SPACING = normalize(15);
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
      // ⚠️ Empêche la pruning et toute interaction
      collapsable={false}
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
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


export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const nav = useNavGuard(router);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const isFocused = useIsFocused();
 const appStateRef = useRef(AppState.currentState);
 const animsRef = useRef<Animated.CompositeAnimation[]>([]);
 const formOpacity = useRef(new Animated.Value(0)).current;
 const formTranslate = useRef(new Animated.Value(12)).current;
 const ctaScale = useRef(new Animated.Value(1)).current;
 const ctaPulse = useRef(new Animated.Value(1)).current;
 const emailRef = useRef<TextInput | null>(null);
 const usernameRef = useRef<TextInput | null>(null);
 const passwordRef = useRef<TextInput | null>(null);
 const confirmRef = useRef<TextInput | null>(null);
  
  // ✅ DANS LE COMPOSANT
const shakeAnim = useRef(new Animated.Value(0)).current;

// Validation identique login
 const isValidEmail = React.useCallback((e: string) => /\S+@\S+\.\S+/.test(e), []);
 const formValid = React.useMemo(
   () =>
     isValidEmail(email.trim()) &&
     username.trim().length >= 2 &&
     password.trim().length >= 6 &&
     confirmPassword.trim() === password.trim(),
   [email, username, password, confirmPassword, isValidEmail]
 );

 // Press feedback CTA
 const pressIn = () => {
   // pas d'anim si bouton désactivé (accessibilité/cohérence)
   if (disabledCTA) return;
   Animated.timing(ctaScale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
 };
 const pressOut = () =>
  Animated.timing(ctaScale, {
    toValue: 1,
    duration: 120,
    easing: RNEasing.out(RNEasing.quad),
    useNativeDriver: true,
  }).start();


const triggerShake = React.useCallback(() => {
  shakeAnim.setValue(0);
  Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
  ]).start();
}, [shakeAnim]);
 
// évite setState après unmount
const isMountedRef = useRef(true);
// on stocke nos timeouts pour les nettoyer
const clearErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const submittingRef = useRef(false);


// helper sécurisé pour afficher/effacer un message d’erreur
const showError = React.useCallback((msg: string) => {
  // stoppe un éventuel ancien timer
  if (clearErrorTimeoutRef.current) {
    clearTimeout(clearErrorTimeoutRef.current);
    clearErrorTimeoutRef.current = null;
  }
  if (isMountedRef.current) {
    setErrorMessage(msg);
    triggerShake();
  }
  // on efface après 5s si toujours monté
  clearErrorTimeoutRef.current = setTimeout(() => {
    if (isMountedRef.current) {
      setErrorMessage("");
    }
    clearErrorTimeoutRef.current = null;
  }, 5000);
}, [triggerShake]);

// helper haptics safe
const safeHapticsError = React.useCallback(async () => {
  try {
    await HapticsModule.notificationAsync(
      HapticsModule.NotificationFeedbackType.Error
    );
  } catch {
    // on ignore silencieusement si indisponible
  }
}, []);

  const wavesRef = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  );
  const waves = wavesRef.current;

  useEffect(() => {
    const buildAnims = () =>
      waves.map((wave, index) =>
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(wave.opacity, {
                toValue: 0.1,
                duration: 2000 + index * 200,
                useNativeDriver: true,
              }),
              Animated.timing(wave.opacity, {
                toValue: 0.3 - index * 0.05,
                duration: 2000 + index * 200,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(wave.scale, {
                toValue: 1.2 + index * 0.2,
                duration: 2200 + index * 250,
                useNativeDriver: true,
              }),
              Animated.timing(wave.scale, {
                toValue: 1,
                duration: 2200 + index * 250,
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

    if (isFocused) start(); else stop();

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

 // Réseau : bannière offline
 useEffect(() => {
   const sub = NetInfo.addEventListener((s) => {
     const off = s.isConnected === false || s.isInternetReachable === false;
     setIsOffline(!!off);
   });
   return () => sub && sub();
 }, []);

 useEffect(() => {
   let loop: Animated.CompositeAnimation | null = null;
   if (formValid && !loading) {
     loop = Animated.loop(
       Animated.sequence([
         Animated.timing(ctaPulse, { toValue: 1.02, duration: 650, useNativeDriver: true }),
         Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
       ])
     );
     loop.start();
   }
   return () => loop?.stop();
 }, [formValid, loading, ctaPulse]);

 // Accessibilité : réduire animations
 useEffect(() => {
   let mounted = true;
   AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
     if (mounted) setReduceMotion(!!enabled);
   });
   const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
     setReduceMotion(!!enabled);
   });
   return () => {
     mounted = false;
     // @ts-ignore RN <= 0.72 compat
     sub?.remove?.();
   };
 }, []);


  useEffect(() => {
  return () => {
    isMountedRef.current = false;
    if (clearErrorTimeoutRef.current) {
      clearTimeout(clearErrorTimeoutRef.current);
      clearErrorTimeoutRef.current = null;
    }
  };
}, []);

useEffect(() => {
   const task = InteractionManager.runAfterInteractions(() => {
     Animated.parallel([
       Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
 Animated.timing(formTranslate, { toValue: 0, duration: 300, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }),
     ]).start();
   });
   return () => task.cancel();
 }, []);

  const handleRegister = async () => {
    if (submittingRef.current || loading) return;
submittingRef.current = true;
    // reset propre sans timer direct
if (isMountedRef.current) setErrorMessage("");

if (!email.trim() || !username.trim() || !password || !confirmPassword) {
    showError(t("fillAllFields"));
    safeHapticsError();
    submittingRef.current = false;          // 👈 libère le garde
    return;
  }
if (password !== confirmPassword) {
    showError(t("passwordsDoNotMatch"));
    safeHapticsError();
    submittingRef.current = false;          // 👈 libère le garde
    return;
  }
 if (password.trim().length < 6) {
   showError(t("weakPassword"));
   safeHapticsError();
   submittingRef.current = false;
   return;
 }

 if (isOffline) {
    showError(t("networkError") || "Problème réseau. Réessaie.");
    safeHapticsError();
    submittingRef.current = false;
    return;
  }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );
      try { await HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType.Success); } catch {}
      const user = userCredential.user;
      const userId = user.uid;
      // Mettre à jour le displayName (blindé)
try {
  await updateProfile(user, { displayName: username.trim() });
} catch { /* on ignore, on ne bloque pas le flow */ }

// Récupérer et sauvegarder la localisation (non bloquant)
try {
  await askPermissionsOnceAfterSignup();
} catch { /* on ignore proprement */ }


      // Sauvegarder les données utilisateur dans Firestore
      await setDoc(doc(db, "users", userId), {
        uid: userId,
        email: email.trim(),
        username: username.trim(),
        bio: "",
        location: "",
        profileImage: "",
        interests: [],
        achievements: [],
        newAchievements: ["first_connection"],
        trophies: 0,
        completedChallengesCount: 0,
        CompletedChallenges: [],
        SavedChallenges: [],
        customChallenges: [],
        CurrentChallenges: [],
        longestStreak: 0,
        shareChallenge: 0,
        voteFeature: 0,
        language: i18n.language,
        locationEnabled: true,
        notificationsEnabled: true,
        country: "Unknown",
        region: "Unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPioneer: false, // 👈 ajouté
  pioneerRewardGranted: false,
      });
try {
  const referrerId = await AsyncStorage.getItem("ties_referrer_id");
  if (referrerId && referrerId !== userId) {
    // Attache le parrain à ce nouvel utilisateur
    await updateDoc(doc(db, "users", userId), {
      referrerId,
      updatedAt: serverTimestamp(),
    });
    await logEvent("ref_attributed", { referrerId });
    await AsyncStorage.removeItem("ties_referrer_id");
  }
} catch (e) {
  console.log("[referral] attribution error:", (e as any)?.message ?? e);
}

      await logEvent("register_success");
      

InteractionManager.runAfterInteractions(() => {
  if (isMountedRef.current) {
    nav.replace("/screen/onboarding/Screen1");
  }
});

    } catch (error: any) {
      const errorMessages: Record<string, string> = {
        "auth/email-already-in-use": t("emailAlreadyInUse"),
        "auth/invalid-email": t("invalidEmailFormat"),
        "auth/weak-password": t("weakPassword"),
        "auth/network-request-failed": t("networkError"),
      };
      showError(errorMessages[error.code] || t("unknownError"));
safeHapticsError();
    } finally {
     submittingRef.current = false;
if (isMountedRef.current) setLoading(false);
    }
  };

// navigation protégée pendant un submit/chargement
const guarded = <T extends (...args: any[]) => any>(fn: T) => (...args: Parameters<T>) => {
  if (loading || submittingRef.current) return;
  return fn(...args);
};
const goLogin = guarded(() => nav.replace("/login"));

// état désactivé du CTA (offline inclus)
const disabledCTA = loading || !formValid || isOffline;

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? normalize(60) : 0}
    >
      <ExpoStatusBar style="dark" backgroundColor="transparent" />
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

      <ScrollView
  style={[styles.flexContainer, { backgroundColor: "transparent" }]}
  contentContainerStyle={[styles.container, { minHeight: SCREEN_HEIGHT, paddingBottom: SPACING * 2 }]}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  removeClippedSubviews={false}
>
        <View style={styles.headerContainer}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            accessibilityLabel={t("appTitle")}
            accessibilityRole="header"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("joinUsAndChallenge")}</Text>
        </View>
        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color="#111827" />
            <Text style={styles.offlineText}>
              {t("networkError") || "Connexion réseau indisponible"}
            </Text>
          </View>
        )}

        <Animated.View
          style={[styles.card, { opacity: formOpacity, transform: [{ translateY: formTranslate }] }]}
          accessibilityLabel={t("registrationForm")}
          accessible
        >
          {!!errorMessage && (
            <Animated.View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.errorBanner, { transform: [{ translateX: shakeAnim }] }]}
            >
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </Animated.View>
          )}

          {/* Email */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
            <TextInput
              ref={emailRef}
              autoFocus
            placeholder={t("emailPlaceholder")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel={t("email")}
            autoComplete="email"
            autoCorrect={false}
            testID="email-input"
            maxLength={100}
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            blurOnSubmit={false}
          />
          {!!email && (
            <TouchableOpacity onPress={() => setEmail("")} style={styles.trailingBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.35)" />
            </TouchableOpacity>
          )}
          </View>

          {/* Username */}
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
            <TextInput
              ref={usernameRef}
            placeholder={t("username")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            accessibilityLabel={t("username")}
            autoComplete="username"
            testID="username-input"
            autoCorrect={false}
            autoCapitalize="none"
             maxLength={40}
            textContentType="username"
          returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
            <TextInput
              ref={passwordRef}
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel={t("password")}
              autoComplete="new-password"
              testID="password-input"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={
                showPassword ? t("hidePassword") : t("showPassword")
              }
              style={styles.trailingBtn}
              hitSlop={{ top:10,bottom:10,left:10,right:10 }}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
          {/* Confirm Password */}
          <View style={styles.inputWrap}>
            <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
            <TextInput
              ref={confirmRef}
              placeholder={t("confirmPassword")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              accessibilityLabel={t("confirmPassword")}
              autoComplete="new-password"
              testID="confirm-password-input"
              textContentType="newPassword"
              maxLength={100}
             returnKeyType="done"
              onSubmitEditing={formValid ? handleRegister : undefined}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              accessibilityLabel={
                showConfirmPassword ? t("hidePassword") : t("showPassword")
              }
             style={styles.trailingBtn}
              hitSlop={{ top:10,bottom:10,left:10,right:10 }}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

          <Animated.View style={{ transform: [{ scale: Animated.multiply(ctaScale, ctaPulse) }] }}>
          <TouchableOpacity
            style={[styles.registerButton, disabledCTA && styles.disabledButton]}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={!disabledCTA ? handleRegister : undefined}
            disabled={disabledCTA}
            accessibilityRole="button"
            accessibilityLabel={t("signup")}
            accessibilityHint={t("createAccountHint") || undefined}
            accessibilityState={{ disabled: disabledCTA }}
            testID="register-button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <Text style={styles.registerButtonText}>{t("signup")}</Text>
            )}
          </TouchableOpacity>
          </Animated.View>
          <Text style={styles.loginText} accessibilityLabel={t("login")}>
            {t("alreadyHaveAccount")}{" "}
            <Text
              style={styles.loginLink}
              onPress={goLogin}
              accessibilityRole="link"
            >
              {t("loginHere")}
            </Text>
          </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING * 2,
    paddingHorizontal: SPACING,
  },
  headerContainer: {
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.08, // Dynamique selon la taille de l'écran
  },
  card: {
    width: Math.min(420, SCREEN_WIDTH - SPACING * 2),
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: normalize(22),
    padding: SPACING,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
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

  // Banner d’erreur (identique login)
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

  // Inputs avec icônes (alignement login)
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  leadingIcon: { marginRight: 8, opacity: 0.9 },
  trailingBtn: { marginLeft: 8, padding: 4 },
  footerContainer: {
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.08, // Dynamique
  },
  brandTitle: {
    fontSize: normalize(34),
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    maxWidth: "100%",
  },
  highlight: {
    color: PRIMARY_COLOR,
    fontSize: normalize(50),
  },
  tagline: {
    fontSize: normalize(16),
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
    maxWidth: "90%",
  },
  errorText: {
    color: "#FF4B4B",
    fontSize: normalize(14),
    fontWeight: "600",
    textAlign: "center",
    marginVertical: SPACING,
    width: "100%",
  },
  input: {
    flex: 1,
    height: normalize(52),
    color: "#111",
    fontSize: normalize(15),
    fontFamily: "Comfortaa_400Regular",
  },
  registerButton: {
    width: Math.min(420, SCREEN_WIDTH - SPACING * 2),
    backgroundColor: BUTTON_COLOR,
    minHeight: normalize(52),
    paddingVertical: normalize(12),
    borderRadius: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACING,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(5),
  },
  disabledButton: { opacity: 0.5 },
  registerButtonText: {
    color: TEXT_COLOR,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  loginText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
    marginBottom: SPACING*2, // + air pour éviter d’être coupé
  },
  loginLink: {
    color: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
});
