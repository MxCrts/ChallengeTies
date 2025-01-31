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
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Text, TextInput, Button, ActivityIndicator } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const floatAnimation = useRef(new Animated.Value(0)).current;

  // Animation d'inclinaison
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimation, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimation, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, identifier, password);
      router.replace("/"); // ✅ Redirection après connexion
    } catch (error) {
      let message = "An error occurred. Please try again.";
      if (error.code === "auth/user-not-found") message = "No account found.";
      else if (error.code === "auth/wrong-password")
        message = "Incorrect password.";
      else if (error.code === "auth/invalid-email")
        message = "Invalid email format.";
      else if (error.code === "auth/too-many-requests")
        message = "Too many attempts. Try later.";

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
      {/* Logo animé */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { perspective: 1000 },
              {
                translateY: floatAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-5, 5],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require("../assets/images/logoFinal.png")}
          style={styles.logo}
        />
      </Animated.View>

      <Text variant="headlineMedium" style={styles.title}>
        Welcome Back!
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Log in to continue your journey
      </Text>

      {/* Message d'erreur */}
      {errorMessage !== "" && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      {/* Champs de connexion avec Paper */}
      <TextInput
        label="Email"
        mode="outlined"
        style={styles.input}
        value={identifier}
        onChangeText={(text) => {
          setIdentifier(text);
          setErrorMessage("");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        label="Password"
        mode="outlined"
        style={styles.input}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setErrorMessage("");
        }}
        secureTextEntry={!showPassword}
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword((prev) => !prev)}
          />
        }
      />

      {/* Lien Forgot Password */}
      <Text
        style={styles.forgotPassword}
        onPress={() => router.push("/forgot-password")}
      >
        Forgot Password?
      </Text>

      {/* Bouton Login avec Paper */}
      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        style={styles.loginButton}
        contentStyle={styles.buttonContent}
      >
        {loading ? "Logging in..." : "Login"}
      </Button>

      {/* Lien vers Register */}
      <Text
        style={styles.registerLink}
        onPress={() => router.push("/register")}
      >
        Don’t have an account?{" "}
        <Text style={styles.registerHighlight}>Register Here</Text>
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#141E30",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 210,
    height: 240,
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
    color: "#bbb",
    marginBottom: 20,
    textAlign: "center",
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#1f2d3d",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    color: "#ff9800",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  loginButton: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  registerLink: {
    color: "#ddd",
    fontSize: 16,
    textAlign: "center",
  },
  registerHighlight: {
    color: "#ff9800",
    fontWeight: "bold",
  },
});
