import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleRegister = async () => {
    if (!email || !username || !password || password !== confirmPassword) {
      setErrorMessage("Please fill all fields correctly.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      const userId = user.uid;

      const userDoc = {
        uid: userId,
        email,
        username,
        bio: "",
        location: "",
        profilePicture: "",
        interests: [],
        achievements: [],
        trophies: 0,
        completedChallengesCount: 0,
        CompletedChallenges: [],
        CurrentChallenges: [],
        SavedChallenges: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", userId), userDoc);

      Alert.alert("Success", "Account created successfully!");
      router.replace("/onboarding");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../assets/images/earth.webp")}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.innerContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          <Animated.Text
            style={[styles.bigTitle, { transform: [{ scale: scaleAnim }] }]}
          >
            Join the Challenge!
          </Animated.Text>

          {errorMessage !== "" && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#bbb"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#bbb"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setErrorMessage("");
            }}
            autoCapitalize="none"
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

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#bbb"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage("");
            }}
            secureTextEntry={!showPassword}
          />

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={styles.registerButton}
          >
            <LinearGradient
              colors={["#ff8008", "#007bff"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradientButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>🚀 Sign Up</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.loginLink}>
              Already have an account?{" "}
              <Text style={styles.loginHighlight}>Login here</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  innerContainer: {
    width: "90%",
    alignItems: "center",
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
  },
  bigTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    textShadowColor: "rgba(255, 255, 255, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
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
    borderWidth: 1,
    borderColor: "#ff8008", // 🔥 Ajoute une légère lueur pour l'effet premium
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
  registerButton: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  gradientButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  registerButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  loginLink: {
    color: "#ddd",
    fontSize: 16,
    textAlign: "center",
  },
  loginHighlight: {
    color: "#ff9800",
    fontWeight: "bold",
  },
});
