import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../constants/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Text, TextInput, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const floatAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(floatAnimation, {
      toValue: 1,
      duration: 9000,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  const rotateAnimation = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1080deg"],
  });

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password || !confirmPassword) {
      setErrorMessage("Veuillez remplir tous les champs.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = userCredential.user;
      const userId = user.uid;

      const userDoc = {
        uid: userId,
        email: email.trim(),
        username: username.trim(),
        bio: "",
        location: "",
        profilePicture: "",
        interests: [],
        achievements: [], // ✅ Aucun succès réclamé au début
        newAchievements: ["first_connection"], // ✅ Succès à réclamer
        trophies: 0,
        completedChallengesCount: 0,
        CompletedChallenges: [],
        CurrentChallenges: [],
        SavedChallenges: [],
        customChallenges: [],
        CompletedTodayChallenges: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", userId), userDoc);

      router.replace("/onboarding");
    } catch (error) {
      let message = "Échec de la création du compte. Veuillez réessayer.";
      if (error.code === "auth/email-already-in-use")
        message = "Cet e-mail est déjà utilisé.";
      else if (error.code === "auth/invalid-email")
        message = "Format d'e-mail invalide.";
      else if (error.code === "auth/weak-password")
        message = "Mot de passe trop faible. Choisissez-en un plus fort.";
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
          { transform: [{ rotateY: rotateAnimation }, { perspective: 1000 }] },
        ]}
      >
        <Image
          source={require("../assets/images/logoFinal.png")}
          style={styles.logo}
        />
      </Animated.View>

      <Text style={styles.title}>Rejoignez le Challenge !</Text>

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
        label="Nom d'utilisateur"
        mode="outlined"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
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
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword(!showPassword)}
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

      <TextInput
        label="Confirmer le mot de passe"
        mode="outlined"
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showConfirmPassword}
        right={
          <TextInput.Icon
            icon={showConfirmPassword ? "eye-off" : "eye"}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
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

      <TouchableOpacity
        style={styles.registerButton}
        onPress={handleRegister}
        disabled={loading}
      >
        <LinearGradient
          colors={["#FACC15", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.registerButtonGradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.registerButtonText}>S'inscrire</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.registerLink}>
          Vous avez déjà un compte ?{" "}
          <Text style={styles.registerHighlight}>Connectez-vous ici</Text>
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
  registerButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  registerButtonGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  registerButtonText: {
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
