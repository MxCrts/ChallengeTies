// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";

const { width } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email/username and password.");
      return;
    }

    try {
      setLoading(true);

      let email = identifier;

      // Check if identifier is a username
      if (!identifier.includes("@")) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", identifier));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          email = querySnapshot.docs[0].data().email;
        } else {
          throw new Error("Invalid username.");
        }
      }

      // Sign in with email and password
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert("Success", "Logged in successfully!");
      router.replace("/"); // Navigate to the home page after login
    } catch (error: any) {
      console.error("Error during login:", error);
      Alert.alert(
        "Login Failed",
        error.message || "Incorrect credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1c1c1e", "#262629"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="log-in-outline" size={64} color="#fff" />
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>
            Keep crushing those challenges. Log in to continue!
          </Text>
        </View>

        {/* Inputs */}
        <TextInput
          style={styles.input}
          placeholder="Username or Email"
          placeholderTextColor="#aaa"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowPassword((prev) => !prev)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#aaa"
            />
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? "Logging in..." : "Login"}
          </Text>
        </TouchableOpacity>

        {/* Link to Register */}
        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.registerLink}>
            Don’t have an account?{" "}
            <Text style={{ color: "#8bc34a", fontWeight: "bold" }}>
              Register Here
            </Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#aaa",
    marginTop: 5,
    marginBottom: 20,
    textAlign: "center",
    maxWidth: width * 0.8,
    lineHeight: 22,
  },
  input: {
    width: "100%",
    backgroundColor: "#2c2c2e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: "#fff",
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  inputPassword: {
    flex: 1,
    backgroundColor: "#2c2c2e",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 15,
  },
  showPasswordButton: {
    position: "absolute",
    right: 15,
    padding: 10,
  },
  loginButton: {
    width: "100%",
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerLink: {
    color: "#ccc",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
  },
});
