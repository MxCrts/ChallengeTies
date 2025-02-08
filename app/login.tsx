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
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Text, TextInput, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { fetchAndSaveUserLocation } from "../services/locationService"; // ✅ Import ajouté

const { width } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const logoAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(logoAnimation, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spinAnimation = logoAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleLogin = async () => {
    if (!email.trim() || !motDePasse.trim()) {
      setErrorMessage("Veuillez saisir votre e-mail et votre mot de passe.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
      await fetchAndSaveUserLocation();

      router.replace("/");
    } catch (error) {
      let message = "Une erreur est survenue. Veuillez réessayer.";
      if (error.code === "auth/user-not-found")
        message = "Aucun compte trouvé pour cet e-mail.";
      else if (error.code === "auth/wrong-password")
        message = "Mot de passe incorrect.";
      else if (error.code === "auth/invalid-email")
        message = "Format d'e-mail invalide.";
      else if (error.code === "auth/too-many-requests")
        message = "Trop de tentatives. Veuillez réessayer plus tard.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ rotate: spinAnimation }],
          },
        ]}
      >
        <Image
          source={require("../assets/images/logoFinal.png")}
          style={styles.logo}
        />
      </Animated.View>

      <Text style={styles.title}>Bon retour !</Text>
      <Text style={styles.subtitle}>
        Connectez-vous pour continuer votre aventure
      </Text>

      {errorMessage !== "" && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      <TextInput
        label="E-mail"
        mode="outlined"
        style={styles.input}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setErrorMessage("");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        textColor="#FFF"
        theme={{
          colors: {
            primary: "#FF7F00",
            text: "#FFF",
            placeholder: "#FF7F00",
            background: "transparent",
          },
        }}
      />

      <TextInput
        label="Mot de passe"
        mode="outlined"
        style={styles.input}
        value={motDePasse}
        onChangeText={(text) => {
          setMotDePasse(text);
          setErrorMessage("");
        }}
        secureTextEntry={!showPassword}
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword((prev) => !prev)}
          />
        }
        textColor="#FFF"
        theme={{
          colors: {
            primary: "#FF7F00",
            text: "#FFF",
            placeholder: "#FF7F00",
            background: "transparent",
          },
        }}
      />

      <TouchableOpacity onPress={() => router.push("/forgot-password")}>
        <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        disabled={loading}
      >
        <LinearGradient
          colors={["#FF7F00", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loginButtonGradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.loginButtonText}>Connexion</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text style={styles.registerLink}>
          Vous n'avez pas de compte ?{" "}
          <Text style={styles.registerHighlight}>Inscrivez-vous ici</Text>
        </Text>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.2,
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
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#1F2D3D",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  loginButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  loginButtonGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  registerLink: {
    color: "#ddd",
    fontSize: 16,
    textAlign: "center",
  },
  registerHighlight: {
    color: "#FF7F00",
    fontWeight: "bold",
  },
});
