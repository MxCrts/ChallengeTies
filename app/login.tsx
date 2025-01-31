import React, { useState, useEffect, useRef } from "react";
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
  Image,
  Animated,
  Easing,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
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

  // Tilting effect
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const { dx, dy } = gesture;
        tiltX.setValue(dy / 50);
        tiltY.setValue(dx / 50);
      },
      onPanResponderRelease: () => {
        Animated.spring(tiltX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 5,
        }).start();
        Animated.spring(tiltY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 5,
        }).start();
      },
    })
  ).current;

  // Floating effect
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
      router.replace("/");
    } catch (error) {
      let message = "An error occurred. Please try again.";

      if (error.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password. Try again.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many login attempts. Try again later.";
      }

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#141E30", "#243B55"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.innerContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.logoContainer,
            {
              transform: [
                { perspective: 1000 },
                {
                  rotateY: tiltY.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ["-15deg", "15deg"],
                  }),
                },
                {
                  rotateX: tiltX.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ["10deg", "-10deg"],
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

        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Log in to continue your journey</Text>

        {errorMessage !== "" && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#bbb"
          value={identifier}
          onChangeText={(text) => {
            setIdentifier(text);
            setErrorMessage("");
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Password"
            placeholderTextColor="#bbb"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrorMessage("");
            }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowPassword((prev) => !prev)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={24}
              color="#bbb"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={() => router.push("/forgot-password")}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={styles.loginButton}
        >
          <LinearGradient
            colors={["#ff8000", "#ff3d00", "#007bff", "#0044cc"]} // 🔥 Combat intense entre le feu et la glace
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.gradientButton, { opacity: loading ? 0.7 : 1 }]} // Légère opacité en loading
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}> Login </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.registerLink}>
            Don’t have an account?{" "}
            <Text style={styles.registerHighlight}>Register Here</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  innerContainer: {
    width: "100%",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "#1f2d3d",
    borderRadius: 10,
    padding: 15,
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#1f2d3d",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 16,
  },
  inputPassword: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 10,
  },
  showPasswordButton: {
    padding: 10,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 10,
    paddingVertical: 5,
  },
  forgotPasswordText: {
    color: "#ff9800",
    fontSize: 14,
    fontWeight: "bold",
  },
  loginButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  gradientButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff8000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)", // Effet de bord lumineux
  },

  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)", // Effet de profondeur sur le texte
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  registerLink: {
    color: "#ddd",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
  registerHighlight: {
    color: "#ff9800",
    fontWeight: "bold",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 50,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  logo: {
    width: 240,
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
});
