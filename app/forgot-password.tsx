import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Text, TextInput, Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const floatAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(floatAnimation, {
      toValue: 1,
      duration: 9000, // ✅ 3 rotations en 4.5 secondes
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  const rotateAnimation = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1080deg"], // ✅ 3 rotations complètes
  });

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorMessage("Veuillez entrer votre adresse e-mail.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage(
        "Un lien de réinitialisation a été envoyé à votre e-mail."
      );
      setErrorMessage(""); // Réinitialise le message d'erreur
    } catch (error) {
      setErrorMessage(
        "Échec de l'envoi du lien de réinitialisation. Réessayez."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ✅ Logo animé avec rotation 3D */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { rotateY: rotateAnimation }, // ✅ Rotation 3D
              { perspective: 1000 }, // ✅ Profondeur 3D
            ],
          },
        ]}
      >
        <Image
          source={require("../assets/images/logoFinal.png")}
          style={styles.logo}
        />
      </Animated.View>

      <Text style={styles.title}>Réinitialisation du mot de passe</Text>
      <Text style={styles.subtitle}>
        Entrez votre email pour recevoir un lien de réinitialisation
      </Text>

      {errorMessage !== "" && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
      {successMessage !== "" && (
        <Text style={styles.successText}>{successMessage}</Text>
      )}

      <TextInput
        label="Adresse e-mail"
        mode="outlined"
        style={styles.input}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setErrorMessage("");
          setSuccessMessage("");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        textColor="#FFF"
        theme={{
          colors: {
            primary: "#FACC15",
            text: "#FFF",
            placeholder: "#FACC15",
            background: "transparent",
          },
        }}
      />

      <View style={styles.resetButtonContainer}>
        <LinearGradient
          colors={["#FACC15", "#3B82F6"]} // 🔥❄️ Dégradé ultra propre
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resetButtonGradient}
        >
          <TouchableOpacity onPress={handleResetPassword} disabled={loading}>
            <Text style={styles.resetButtonText}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.backToLogin}>Retour à la connexion</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: "contain",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 20,
    textAlign: "center",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  successText: {
    color: "limegreen",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#1F2D3D",
  },
  resetButtonContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  resetButtonGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  backToLogin: {
    color: "#FACC15",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    fontWeight: "bold",
  },
});
