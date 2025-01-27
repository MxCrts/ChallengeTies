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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore"; // <-- Notice runTransaction here
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validateInputs = () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      return "All fields are required.";
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Please enter a valid email address.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    return null;
  };

  const handleRegister = async () => {
    const errorMessage = validateInputs();
    if (errorMessage) {
      Alert.alert("Error", errorMessage);
      return;
    }

    setLoading(true);

    try {
      // 1) Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      const userId = user.uid;

      // 2) Run a transaction to claim the username and create the user doc
      await runTransaction(db, async (transaction) => {
        const usernameLower = username.trim().toLowerCase();

        // A) Check if doc in 'usernames/{usernameLower}' exists
        const usernameRef = doc(db, "usernames", usernameLower);
        const usernameSnap = await transaction.get(usernameRef);

        if (usernameSnap.exists()) {
          throw new Error("Username is already taken.");
        }

        // B) Create the username doc
        transaction.set(usernameRef, {
          userId: userId,
          // you can store the original or lowercased username, or a timestamp, etc.
        });

        // C) Create the user doc in "users/{userId}"
        const userRef = doc(db, "users", userId);
        transaction.set(userRef, {
          uid: userId,
          email,
          username, // keep the original case or use usernameLower
          createdAt: serverTimestamp(),
          profilePicture: "",
          bio: "",
          location: "",
          challengesTaken: [],
          challengesSaved: [],
          achievements: [],
          trophies: 0,
          CompletedChallenges: [],
          completedChallengesCount: 0,
        });
      });

      // 3) If the transaction succeeds, set onboarding and alert success
      await AsyncStorage.setItem("hasSeenOnboarding", "false");
      Alert.alert("Success", "Account created successfully!");

      // 4) Redirect to onboarding
      router.replace("/onboarding");
    } catch (error) {
      console.error("Error during registration:", error);
      Alert.alert(
        "Registration Failed",
        error.message || "An error occurred. Please try again."
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
        <View style={styles.header}>
          <Ionicons name="person-add-outline" size={64} color="#fff" />
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>
            Join ChallengeTies and start your journey!
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#aaa"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.registerButtonText}>
            {loading ? "Registering..." : "Register"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/login")}>
          <Text style={styles.loginLink}>
            Already have an account?{" "}
            <Text style={{ color: "#8bc34a", fontWeight: "bold" }}>Log In</Text>
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
  registerButton: {
    width: "100%",
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  registerButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  loginLink: {
    color: "#ccc",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
  },
});
