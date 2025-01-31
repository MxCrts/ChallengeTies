import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ImageBackground,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Text, TextInput, Button, ActivityIndicator } from "react-native-paper";

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

      router.replace("/onboarding");
    } catch (error) {
      setErrorMessage("Failed to create account. Try again.");
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

          {/* Champ Email */}
          <TextInput
            label="Email"
            mode="outlined"
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Champ Username */}
          <TextInput
            label="Username"
            mode="outlined"
            style={styles.input}
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setErrorMessage("");
            }}
            autoCapitalize="none"
          />

          {/* Champ Password */}
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
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {/* Champ Confirm Password */}
          <TextInput
            label="Confirm Password"
            mode="outlined"
            style={styles.input}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage("");
            }}
            secureTextEntry={!showPassword}
          />

          {/* Bouton Register */}
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
            contentStyle={styles.buttonContent}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </Button>

          {/* Lien vers Login */}
          <Text style={styles.loginLink} onPress={() => router.push("/login")}>
            Already have an account?{" "}
            <Text style={styles.loginHighlight}>Login here</Text>
          </Text>
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
    paddingHorizontal: 20,
    backgroundColor: "#141E30",
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
    marginBottom: 16,
    backgroundColor: "#1f2d3d",
  },
  registerButton: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
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
