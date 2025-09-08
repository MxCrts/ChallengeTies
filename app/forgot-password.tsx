import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Palette de couleurs
const BACKGROUND_COLOR = "#FFF8E7"; // crème
const PRIMARY_COLOR = "#FFB800"; // orange
const TEXT_COLOR = "#333"; // texte foncé
const BUTTON_COLOR = "#FFFFFF"; // bouton blanc

const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const circleTop = SCREEN_HEIGHT * 0.38;
const waveCount = 4;

const Wave = React.memo(
  ({
    opacity,
    scale,
    borderWidth,
    size,
    top,
  }: {
    opacity: Animated.Value;
    scale: Animated.Value;
    borderWidth: number;
    size: number;
    top: number;
  }) => (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        transform: [{ scale }],
        borderWidth,
        borderColor: PRIMARY_COLOR,
        position: "absolute",
        top,
        left: (SCREEN_WIDTH - size) / 2,
      }}
    />
  )
);

export default function ForgotPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const waves = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? 5 : 2,
    }))
  ).current;

  useEffect(() => {
    const animations = waves.map((wave, index) =>
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wave.opacity, {
              toValue: 0.1,
              duration: 2000 + index * 200,
              useNativeDriver: true,
            }),
            Animated.timing(wave.opacity, {
              toValue: 0.3 - index * 0.05,
              duration: 2000 + index * 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(wave.scale, {
              toValue: 1.2 + index * 0.2,
              duration: 2200 + index * 250,
              useNativeDriver: true,
            }),
            Animated.timing(wave.scale, {
              toValue: 1,
              duration: 2200 + index * 250,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
    );
    animations.forEach((anim) => anim.start());
    return () => animations.forEach((anim) => anim.stop());
  }, []);

  const handleResetPassword = async () => {
    setErrorMessage(t("enterYourEmail"));
    triggerShake();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => setErrorMessage(""), 5000);
    setSuccessMessage("");
    if (!email.trim()) {
      setErrorMessage(t("enterYourEmail"));
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(t("resetLinkSent"));
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar hidden />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vagues de fond */}
        {waves.map((wave, index) => (
          <Wave
            key={index}
            opacity={wave.opacity}
            scale={wave.scale}
            borderWidth={wave.borderWidth}
            size={circleSize}
            top={circleTop}
          />
        ))}

        {/* Bouton retour */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/login")}
          accessibilityLabel={t("backToLogin")}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={30} color={TEXT_COLOR} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={t("appTitle")}
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("enterEmailToResetPassword")}</Text>
        </View>

        {/* Input Email */}
        <View style={styles.inputContainer} accessibilityLabel={t("resetForm")}>
          <TextInput
            placeholder={t("yourEmailAddress")}
            placeholderTextColor="rgba(50,50,50,0.5)"
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel={t("email")}
          />
        </View>

        {/* Messages */}
        {(errorMessage || successMessage) !== "" && (
          <Animated.Text
            style={[
              errorMessage ? styles.errorText : styles.successText,
              { transform: [{ translateX: shakeAnim }] },
            ]}
            accessibilityRole="alert"
          >
            {errorMessage || successMessage}
          </Animated.Text>
        )}
        {/* Bouton envoyer lien */}
        <TouchableOpacity
          style={[styles.resetButton, loading && styles.disabledButton]}
          onPress={handleResetPassword}
          disabled={loading}
          accessibilityLabel={t("sendResetLink")}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={TEXT_COLOR} size="small" />
          ) : (
            <Text style={styles.resetButtonText}>{t("sendLink")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  header: {
    position: "absolute",
    top: "12%",
    alignItems: "center",
    width: "90%",
  },
  brandTitle: {
    fontSize: 42,
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  highlight: { color: PRIMARY_COLOR, fontSize: 60 },
  tagline: {
    fontSize: 17,
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Comfortaa_400Regular",
  },
  errorText: {
    color: "#FF4B4B",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
  },
  successText: {
    color: "limegreen",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    width: "90%",
    marginBottom: 10,
  },
  inputContainer: {
    position: "absolute",
    top: "55%",
    width: "90%",
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 55,
    backgroundColor: BUTTON_COLOR,
    color: TEXT_COLOR,
    fontSize: 18,
    paddingHorizontal: 15,
    borderRadius: 25,
    textAlign: "center",
    textAlignVertical: "center",
    marginBottom: 12,
    fontWeight: "500",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
  resetButton: {
    position: "absolute",
    bottom: "12%",
    width: "90%",
    backgroundColor: BUTTON_COLOR,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  disabledButton: { opacity: 0.6 },
  resetButtonText: {
    color: TEXT_COLOR,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "Comfortaa_400Regular",
  },
});
