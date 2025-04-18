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

const normalizeFont = (size: number) => {
  const { width } = Dimensions.get("window");
  const scale = width / 375; // Référence iPhone X
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Palette de couleurs
const BACKGROUND_COLOR = "#FFF8E7"; // crème
const PRIMARY_COLOR = "#FFB800"; // orange
const TEXT_COLOR = "#333"; // texte foncé
const BUTTON_COLOR = "#FFFFFF"; // bouton blanc

// Taille du cercle décoratif et position verticale centrée
const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const circleTop = SCREEN_HEIGHT * 0.38;
const waveCount = 4;

// Composant Wave (centré horizontalement)
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

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Initialiser les vagues une seule fois pour éviter leur réinitialisation
  const wavesRef = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? 5 : 2,
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
      setErrorMessage("Veuillez renseigner votre email et votre mot de passe.");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrorMessage("Veuillez saisir un email valide.");
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
        "auth/user-not-found": "Aucun compte trouvé pour cet email.",
        "auth/wrong-password": "Mot de passe incorrect.",
        "auth/invalid-email": "Format d'email invalide.",
        "auth/too-many-requests":
          "Trop de tentatives. Veuillez réessayer plus tard.",
      };
      setErrorMessage(
        errorMessages[firebaseError.code] || "Une erreur est survenue."
      );
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar hidden />
      <ScrollView
        style={styles.flexContainer}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vagues de fond */}
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

        {/* Header : Titre et slogan */}
        <View style={styles.headerContainer}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            accessibilityLabel="Titre de l'application"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text
            style={styles.tagline}
            accessibilityLabel="Slogan de l'application"
          >
            La meilleure façon de prédire votre avenir est de le créer
          </Text>
        </View>

        {/* Formulaire : Champs de saisie centrés */}
        <View style={styles.formContainer}>
          {errorMessage !== "" && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}
          <TextInput
            placeholder="tony.stark@example.com"
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Mot de passe"
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel="Mot de passe"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={
                showPassword
                  ? "Cacher le mot de passe"
                  : "Afficher le mot de passe"
              }
              style={styles.passwordIcon}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push("/forgot-password")}>
            <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer : Bouton et lien */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityLabel="Se connecter"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Se Connecter</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.signupText} accessibilityLabel="Inscription">
            Pas encore de compte ?{" "}
            <Text
              style={styles.signupLink}
              onPress={() => router.push("/register")}
              accessibilityRole="link"
            >
              Inscris-toi ici
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
    justifyContent: "center",
    paddingVertical: 30,
  },
  headerContainer: {
    position: "absolute",
    top: 100,
    width: "90%",
    alignItems: "center",
  },
  formContainer: {
    width: "80%",
    alignItems: "center",
    marginVertical: 30,
    alignSelf: "center",
    top: 50,
  },
  footerContainer: {
    position: "absolute",
    bottom: 80,
    width: "100%",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: normalizeFont(34),
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    maxWidth: "90%",
  },
  highlight: { color: PRIMARY_COLOR, fontSize: normalizeFont(50) },
  tagline: {
    fontSize: 17,
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Comfortaa_400Regular",
  },
  errorText: {
    color: "#FF4B4B",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginVertical: 10,
    width: "100%",
  },
  input: {
    width: "100%",
    height: 55,
    backgroundColor: "rgba(245,245,245,0.8)",
    color: "#111",
    fontSize: 18,
    paddingHorizontal: 15,
    borderRadius: 25,
    textAlign: "center",
    marginVertical: 6,
    fontWeight: "500",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
  passwordContainer: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: { paddingRight: 45 },
  passwordIcon: {
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -12 }],
  },
  forgotPassword: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 10,
    textAlign: "center",
  },
  loginButton: {
    width: "80%",
    backgroundColor: BUTTON_COLOR,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: TEXT_COLOR,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
  signupText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
    marginTop: 10,
  },
  signupLink: {
    color: PRIMARY_COLOR,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
});
