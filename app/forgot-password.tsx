import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

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

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Initialisation des vagues (animation continue)
  const waves = Array.from({ length: waveCount }, (_, index) => ({
    opacity: new Animated.Value(0.3 - index * 0.05),
    scale: new Animated.Value(1),
    borderWidth: index === 0 ? 5 : 2,
  }));

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

  const handleResetPassword = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!email.trim()) {
      setErrorMessage("Veuillez entrer votre adresse e-mail.");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(
        "Un lien de réinitialisation a été envoyé à votre e-mail."
      );
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      setErrorMessage(
        "Échec de l'envoi du lien de réinitialisation. Vérifiez votre e-mail."
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

        {/* Bouton de retour */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/login")}
          accessibilityLabel="Retour à la connexion"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={30} color={TEXT_COLOR} />
        </TouchableOpacity>

        {/* Header: Titre et slogan */}
        <View style={styles.header}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel="Titre de l'application"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>
            Entrez votre e-mail pour réinitialiser votre mot de passe.
          </Text>
        </View>

        {/* Input: Formulaire de réinitialisation */}
        <View
          style={styles.inputContainer}
          accessibilityLabel="Formulaire de réinitialisation"
        >
          <TextInput
            placeholder="Votre adresse e-mail"
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Adresse e-mail"
          />
        </View>

        {/* Message d'erreur/succès */}
        {(errorMessage || successMessage) !== "" && (
          <Text
            style={errorMessage ? styles.errorText : styles.successText}
            accessibilityRole="alert"
          >
            {errorMessage || successMessage}
          </Text>
        )}

        {/* Bouton de réinitialisation */}
        <TouchableOpacity
          style={[styles.resetButton, loading && styles.disabledButton]}
          onPress={handleResetPassword}
          disabled={loading}
          accessibilityLabel="Envoyer le lien de réinitialisation"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={TEXT_COLOR} size="small" />
          ) : (
            <Text style={styles.resetButtonText}>Envoyer le lien</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  header: {
    position: "absolute",
    top: "12%", // Ajusté pour descendre le header
    alignItems: "center",
    width: "90%",
  },
  brandTitle: {
    fontSize: 42,
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  highlight: { color: PRIMARY_COLOR, fontSize: 60 },
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
    width: "90%",
    marginBottom: 10,
  },
  successText: {
    color: "limegreen",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
  },
  inputContainer: {
    position: "absolute",
    top: "55%",
    width: "90%",
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 55,
    backgroundColor: BUTTON_COLOR,
    color: TEXT_COLOR,
    fontSize: 18,
    paddingHorizontal: 15,
    borderRadius: 25,
    textAlign: "center",
    textAlignVertical: "center",
    marginBottom: 12,
    fontWeight: "500",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
  resetButton: {
    position: "absolute",
    bottom: "12%",
    width: "90%",
    backgroundColor: BUTTON_COLOR,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  disabledButton: { opacity: 0.6 },
  resetButtonText: {
    color: TEXT_COLOR,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
});
