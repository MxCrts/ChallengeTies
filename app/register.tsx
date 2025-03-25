import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

// Composant Wave (identique à Login)
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Initialisation des vagues (animation continue)
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

  const handleRegister = async () => {
    setErrorMessage("");
    if (!email.trim() || !username.trim() || !password || !confirmPassword) {
      setErrorMessage("Veuillez renseigner tous les champs.");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace("/screen/onboarding/Screen1");
    } catch (error: any) {
      const errorMessages = {
        "auth/email-already-in-use": "Cet e-mail est déjà utilisé.",
        "auth/invalid-email": "Format d'e-mail invalide.",
        "auth/weak-password":
          "Mot de passe trop faible. Choisissez-en un plus fort.",
      };
      setErrorMessage(
        errorMessages[error.code] ||
          "Une erreur est survenue. Veuillez réessayer."
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
          <Text style={styles.tagline}>Rejoins-nous et relève des défis !</Text>
        </View>

        {/* Formulaire : Champs de saisie */}
        <View
          style={styles.formContainer}
          accessibilityLabel="Formulaire d'inscription"
        >
          {errorMessage !== "" && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errorMessage}
            </Text>
          )}
          <TextInput
            placeholder="Votre e-mail"
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Adresse e-mail"
          />
          <TextInput
            placeholder="Nom d'utilisateur"
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            accessibilityLabel="Nom d'utilisateur"
          />
          {/* Champ: Mot de passe */}
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
          {/* Champ: Confirmer le mot de passe */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Confirmer le mot de passe"
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={[styles.input, styles.passwordInput]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              accessibilityLabel="Confirmer le mot de passe"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              accessibilityLabel={
                showConfirmPassword
                  ? "Cacher le mot de passe"
                  : "Afficher le mot de passe"
              }
              style={styles.passwordIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={24}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer : Bouton d'inscription et lien vers la connexion */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityLabel="S'inscrire"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <Text style={styles.registerButtonText}>S'inscrire</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.loginText} accessibilityLabel="Connexion">
            Déjà un compte ?{" "}
            <Text
              style={styles.loginLink}
              onPress={() => router.push("/login")}
              accessibilityRole="link"
            >
              Connecte-toi ici
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
    top: 70,
    width: "90%",
    alignItems: "center",
  },
  formContainer: {
    position: "absolute",
    top: "42%",
    width: "90%",
    alignItems: "center",
  },
  footerContainer: {
    position: "absolute",
    bottom: 60,
    width: "90%",
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
    fontSize: normalizeFont(14),
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
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
  registerButton: {
    width: "90%",
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
  registerButtonText: {
    color: TEXT_COLOR,
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_400Regular",
  },
  loginText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 10,
  },
  loginLink: {
    color: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
});
