import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Text, TextInput, Button, ActivityIndicator } from "react-native-paper";

const { width } = Dimensions.get("window");

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("A password reset link has been sent to your email.");
      setErrorMessage(""); // Reset error message
    } catch (error) {
      setErrorMessage("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Logo */}
      <Image
        source={require("../assets/images/logoFinal.png")}
        style={styles.logo}
      />

      {/* Titre */}
      <Text variant="headlineMedium" style={styles.title}>
        Reset Your Password
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Enter your email to receive a reset link
      </Text>

      {/* Messages */}
      {errorMessage !== "" && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
      {successMessage !== "" && (
        <Text style={styles.successText}>{successMessage}</Text>
      )}

      {/* Champ Email */}
      <TextInput
        label="Email Address"
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
      />

      {/* Bouton Reset */}
      <Button
        mode="contained"
        onPress={handleResetPassword}
        loading={loading}
        style={styles.resetButton}
        contentStyle={styles.buttonContent}
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>

      {/* Lien vers Login */}
      <Text style={styles.backToLogin} onPress={() => router.push("/login")}>
        Back to Login
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
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
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
  successText: {
    color: "limegreen",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#1f2d3d",
  },
  resetButton: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  backToLogin: {
    color: "#ddd",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
});
