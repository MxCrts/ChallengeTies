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
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

const BACKGROUND_COLOR = "#FFF8E7";
const PRIMARY_COLOR = "#FFB800";
const TEXT_COLOR = "#333";
const BUTTON_COLOR = "#FFFFFF";

const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.85;
const circleTop = SCREEN_HEIGHT * 0.35;
const waveCount = 4;
const SPACING = normalize(15);

const Wave = React.memo(({ opacity, scale, borderWidth, size, top }: any) => (
  <Animated.View
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
      left: (SCREEN_WIDTH - size) / 2,
    }}
  />
));

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const wavesRef = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  );
  const waves = wavesRef.current;

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
  }, [waves]);

  const isValidEmail = useCallback(
    (emailStr: string) => /\S+@\S+\.\S+/.test(emailStr),
    []
  );

  const handleLogin = async () => {
    setErrorMessage("");
    if (!email.trim() || !password.trim()) {
      setErrorMessage(t("fillEmailPassword"));
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrorMessage(t("invalidEmail"));
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      router.replace("/");
    } catch (error) {
      const firebaseError = error as { code: string };
      const errorMessages: Record<string, string> = {
        "auth/user-not-found": t("noAccountFound"),
        "auth/wrong-password": t("wrongPassword"),
        "auth/invalid-email": t("invalidEmailFormat"),
        "auth/too-many-requests": t("tooManyRequests"),
      };
      setErrorMessage(errorMessages[firebaseError.code] || t("unknownError"));
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? normalize(60) : 0}
    >
      <StatusBar hidden />
      <ScrollView
        style={styles.flexContainer}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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

        <View style={styles.headerContainer}>
          <Text style={styles.brandTitle} numberOfLines={1} adjustsFontSizeToFit ellipsizeMode="tail">
            <Text style={styles.highlight}>C</Text>hallenge<Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("appTagline")}</Text>
        </View>

        <View style={styles.formContainer}>
          {errorMessage !== "" && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}
          <TextInput
            placeholder={t("emailPlaceholder")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.passwordIcon}>
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={normalize(24)}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push("/forgot-password")}
            accessibilityLabel={t("forgotPassword")}
          >
            <Text style={styles.forgotPassword}>{t("forgotPassword")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <Text style={styles.loginButtonText}>{t("login")}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.signupText}>
            {t("noAccount")} {" "}
            <Text
              style={styles.signupLink}
              onPress={() => router.push("/register")}
              accessibilityRole="link"
            >
              {t("signupHere")}
            </Text>
          </Text>
        </View>
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
    justifyContent: "space-between",
    paddingVertical: SPACING * 2,
    paddingHorizontal: SPACING,
  },
  headerContainer: {
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.1, // Dynamique selon la taille de l'écran
  },
  formContainer: {
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    marginVertical: SPACING * 2,
  },
  footerContainer: {
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.1, // Dynamique
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
    width: "100%",
    height: normalize(50),
    backgroundColor: "rgba(245,245,245,0.8)",
    color: "#111",
    fontSize: normalize(16),
    paddingHorizontal: SPACING,
    borderRadius: normalize(20),
    textAlign: "center",
    marginVertical: SPACING / 2,
    fontWeight: "500",
    borderWidth: normalize(2),
    borderColor: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
  passwordContainer: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: normalize(45),
  },
  passwordIcon: {
    position: "absolute",
    right: SPACING,
    top: "50%",
    transform: [{ translateY: -normalize(12) }],
  },
  forgotPassword: {
    color: PRIMARY_COLOR,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
    textAlign: "center",
  },
  loginButton: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: BUTTON_COLOR,
    paddingVertical: normalize(12),
    borderRadius: normalize(20),
    alignItems: "center",
    marginTop: SPACING,
    borderWidth: normalize(2),
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(5),
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: TEXT_COLOR,
    fontSize: normalize(16),
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
  signupText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: normalize(14),
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  signupLink: {
    color: PRIMARY_COLOR,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
});