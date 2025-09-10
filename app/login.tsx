import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TextInput,
  PixelRatio,
  ActivityIndicator,
  Platform,
  ScrollView,
  Keyboard,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useVisitor } from "@/context/VisitorContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Constantes de style
const COLORS = {
  background: "#FFF8E7",
  primary: "#FFB800",
  text: "#333",
  button: "#FFFFFF",
  error: "#FF4B4B",
  inputBg: "rgba(245,245,245,0.8)",
  inputText: "#111",
  placeholder: "rgba(50,50,50,0.5)",
};
const SPACING = normalize(15);
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.85;
const CIRCLE_TOP = SCREEN_HEIGHT * 0.35;
const WAVE_COUNT = 4;

// Composant Wave optimisé
const Wave = React.memo(({ opacity, scale, borderWidth, size, top }: any) => (
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
        left: (SCREEN_WIDTH - size) / 2,
      },
    ]}
    accessibilityElementsHidden
  />
));

// 🧠 Spacer clavier premium: gère iOS/Android, respecte le safe-area, évite la bande grise
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
        duration: Platform.OS === "ios" ? e?.duration ?? 250 : 150,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e: any) => {
      Animated.timing(pad, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e?.duration ?? 250 : 150,
        useNativeDriver: false,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [insets.bottom, pad]);

  return <Animated.View style={{ height: pad }} />;
});

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
const { setGuest  } = useVisitor();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Animation des vagues
  const waves = useRef(
    Array.from({ length: WAVE_COUNT }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  ).current;

  useEffect(() => {
    const animations = waves.map((wave, index) =>
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
    animations.forEach((anim) => anim.start());
    return () => animations.forEach((anim) => anim.stop());
  }, []);

  const isValidEmail = useCallback(
    (emailStr: string) => /\S+@\S+\.\S+/.test(emailStr),
    []
  );

  const handleLogin = useCallback(async () => {
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage(t("fillEmailPassword"));
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage(t("invalidEmail"));
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      setGuest(false); 
      router.replace("/");
    } catch (error: any) {
      const errorCode = error.code;
      const invalidCredentialsCodes = ["auth/user-not-found", "auth/wrong-password"];
      if (invalidCredentialsCodes.includes(errorCode)) {
        setErrorMessage(t("invalidCredentials"));
      } else {
        const errorMessages: Record<string, string> = {
          "auth/invalid-email": t("invalidEmailFormat"),
          "auth/too-many-requests": t("tooManyRequests"),
        };
        setErrorMessage(errorMessages[errorCode] || t("unknownError"));
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, t, router, isValidEmail]);

  // Auto-dismiss erreur
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ExpoStatusBar style="dark" backgroundColor={COLORS.background} />

      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // garantit qu'on remplit tout l'écran, même après hide du clavier
            minHeight: SCREEN_HEIGHT - insets.top - insets.bottom,
            paddingBottom: SPACING * 2, // de base; le KeyboardPadding ajoutera le reste
          },
        ]}
        contentInsetAdjustmentBehavior="always"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Animation de fond */}
        {waves.map((wave, index) => (
          <Wave
            key={`wave-${index}`}
            opacity={wave.opacity}
            scale={wave.scale}
            borderWidth={wave.borderWidth}
            size={CIRCLE_SIZE}
            top={CIRCLE_TOP}
          />
        ))}

        {/* Header */}
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
          <Text style={styles.tagline} accessibilityLabel={t("appTagline")}>
            {t("appTagline")}
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formContainer}>
          {errorMessage ? (
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
              testID="error-message"
            >
              {errorMessage}
            </Text>
          ) : null}

          <TextInput
            placeholder={t("emailPlaceholder")}
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel={t("emailPlaceholder")}
            testID="email-input"
            returnKeyType="next"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor={COLORS.placeholder}
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              accessibilityLabel={t("passwordPlaceholder")}
              testID="password-input"
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.passwordIcon}
              accessibilityLabel={showPassword ? t("hidePassword") : t("showPassword")}
              testID="toggle-password-visibility"
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={normalize(24)}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            accessibilityLabel={t("forgotPassword")}
            accessibilityRole="link"
            testID="forgot-password-link"
          >
            <Text style={styles.forgotPassword}>{t("forgotPassword")}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t("login")}
            testID="login-button"
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.loginButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {t("login")}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.signupText}>
            {t("noAccount")}{" "}
            <Text
              style={styles.signupLink}
              onPress={() => router.push("/register")}
              accessibilityRole="link"
              accessibilityLabel={t("signupHere")}
              testID="signup-link"
            >
              {t("signupHere")}
            </Text>
          </Text>
          {/* Bouton mode visiteur (en dehors du <Text>) */}
 <TouchableOpacity
   style={styles.guestButton}
   onPress={() => {
     setGuest(true);        // ✅ active le mode visiteur
     router.replace("/");   // ✅ va sur la Home
   }}
   accessibilityRole="button"
   accessibilityLabel={t("continueAsGuest") || "Continuer en tant que visiteur"}
 >
   <Text style={styles.guestButtonText}>
     {t("continueAsGuest") || "Continuer en tant que visiteur"}
   </Text>
 </TouchableOpacity>
        </View>

        {/* ✅ Espace animé lié au clavier — supprime la “bande grise” */}
        <KeyboardPadding />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING * 2,
    paddingHorizontal: SPACING,
  },
  wave: { position: "absolute" },
  headerContainer: {
    width: "90%",
    maxWidth: normalize(600),
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.1,
  },
  formContainer: {
    width: "90%",
    maxWidth: normalize(400),
    alignItems: "center",
    marginVertical: SPACING * 2,
  },
  footerContainer: {
    width: "90%",
    maxWidth: normalize(600),
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.1,
  },
  brandTitle: {
    fontSize: normalize(34),
    color: COLORS.text,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    maxWidth: "100%",
  },
  highlight: { color: COLORS.primary, fontSize: normalize(50) },
  tagline: {
    fontSize: normalize(16),
    color: COLORS.text,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
    maxWidth: "90%",
  },
  errorText: {
    color: COLORS.error,
    fontSize: normalize(14),
    fontWeight: "600",
    textAlign: "center",
    marginVertical: SPACING,
    width: "100%",
    fontFamily: "Comfortaa_400Regular",
  },
  input: {
    width: "100%",
    maxWidth: normalize(400),
    height: normalize(55),
    backgroundColor: "rgba(245,245,245,0.8)",
    color: "#111",
    fontSize: normalize(14),
    paddingHorizontal: SPACING,
    borderRadius: normalize(20),
    textAlign: "center",
    marginVertical: SPACING / 2,
    fontWeight: "500",
    borderWidth: normalize(2),
    borderColor: "#FFB800",
    fontFamily: "Comfortaa_400Regular",
  },
  passwordContainer: { width: "100%", position: "relative" },
  passwordInput: { paddingRight: normalize(45) },
  passwordIcon: {
    position: "absolute",
    right: SPACING,
    top: "50%",
    transform: [{ translateY: -normalize(12) }],
  },
  forgotPassword: {
    color: COLORS.primary,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  loginButton: {
    width: "100%",
    maxWidth: normalize(400),
    backgroundColor: COLORS.button,
    paddingVertical: normalize(12),
    borderRadius: normalize(20),
    alignItems: "center",
    marginTop: SPACING,
    borderWidth: normalize(2),
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(5),
    elevation: 5,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: COLORS.text,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  guestButton: {
  width: "100%",
  maxWidth: normalize(400),
  backgroundColor: "transparent",
  paddingVertical: normalize(12),
  borderRadius: normalize(20),
  alignItems: "center",
  marginTop: SPACING,
  borderWidth: normalize(2),
  borderColor: COLORS.primary,
},
guestButtonText: {
  color: COLORS.primary,
  fontSize: normalize(16),
  fontFamily: "Comfortaa_400Regular",
},
  signupText: {
    color: COLORS.text,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  signupLink: { color: COLORS.primary, fontFamily: "Comfortaa_400Regular" },
});
