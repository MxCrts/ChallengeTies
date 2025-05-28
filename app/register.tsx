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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { fetchAndSaveUserLocation } from "../services/locationService";
import {
  requestNotificationPermissions,
  scheduleDailyNotifications,
} from "../services/notificationService"; // Import notifications
import i18n from "../i18n";

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
  )
);

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleRegister = async () => {
    setErrorMessage("");
    if (!email.trim() || !username.trim() || !password || !confirmPassword) {
      setErrorMessage(t("fillAllFields"));
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("passwordsDoNotMatch"));
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );
      const user = userCredential.user;
      const userId = user.uid;

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
        currentChallenges: [],
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
      });

      // Mettre à jour le displayName
      await updateProfile(user, { displayName: username.trim() });

      // Récupérer et sauvegarder la localisation
      try {
        await fetchAndSaveUserLocation();
      } catch (error) {
        console.error("Erreur localisation lors de l'inscription :", error);
      }

      // Demander permissions notifications
      const notificationsGranted = await requestNotificationPermissions();
      if (notificationsGranted) {
        await scheduleDailyNotifications();
      } else {
        await updateDoc(doc(db, "users", userId), {
          notificationsEnabled: false,
        });
        console.log("🔔 Notifications désactivées (permissions refusées)");
      }

      router.replace("/screen/onboarding/Screen1");
    } catch (error: any) {
      const errorMessages: Record<string, string> = {
        "auth/email-already-in-use": t("emailAlreadyInUse"),
        "auth/invalid-email": t("invalidEmailFormat"),
        "auth/weak-password": t("weakPassword"),
      };
      setErrorMessage(errorMessages[error.code] || t("unknownError"));
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
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            accessibilityLabel={t("appTitle")}
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("joinUsAndChallenge")}</Text>
        </View>

        <View
          style={styles.formContainer}
          accessibilityLabel={t("registrationForm")}
        >
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
            accessibilityLabel={t("email")}
            autoComplete="email"
            testID="email-input"
          />
          <TextInput
            placeholder={t("username")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            accessibilityLabel={t("username")}
            autoComplete="username"
            testID="username-input"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel={t("password")}
              autoComplete="new-password"
              testID="password-input"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={
                showPassword ? t("hidePassword") : t("showPassword")
              }
              style={styles.passwordIcon}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={normalize(24)}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder={t("confirmPassword")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={[styles.input, styles.passwordInput]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              accessibilityLabel={t("confirmPassword")}
              autoComplete="new-password"
              testID="confirm-password-input"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              accessibilityLabel={
                showConfirmPassword ? t("hidePassword") : t("showPassword")
              }
              style={styles.passwordIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={normalize(24)}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityLabel={t("signup")}
            accessibilityRole="button"
            testID="register-button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <Text style={styles.registerButtonText}>{t("signup")}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.loginText} accessibilityLabel={t("login")}>
            {t("alreadyHaveAccount")}{" "}
            <Text
              style={styles.loginLink}
              onPress={() => router.push("/login")}
              accessibilityRole="link"
            >
              {t("loginHere")}
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
    marginTop: SCREEN_HEIGHT * 0.08, // Dynamique selon la taille de l'écran
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
  registerButton: {
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
  registerButtonText: {
    color: TEXT_COLOR,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  loginText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  loginLink: {
    color: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
});
