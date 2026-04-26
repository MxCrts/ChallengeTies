// components/ForgeIntentionModal.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import * as Haptics from "expo-haptics";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (text: string) => void;
}

export default function ForgeIntentionModal({ visible, onDismiss, onSubmit }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [text, setText] = useState("");
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { setText(""); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 85, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSubmit(trimmed);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)", opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        </Animated.View>

        <View style={s.centerer} pointerEvents="box-none">
          <Animated.View style={[s.card, {
            backgroundColor: isDark ? "rgba(13,17,27,0.97)" : "rgba(255,255,255,0.98)",
            borderColor: isDark ? "rgba(249,115,22,0.20)" : "rgba(249,115,22,0.15)",
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          }]}>
            {/* Header */}
            <View style={s.header}>
              <LinearGradient
                colors={["#C2410C", "#F97316"]}
                style={s.headerIcon}
              >
                <Text style={{ fontSize: 18 }}>🔥</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: isDark ? "#fff" : "#0B1120" }]}>
                  {t("forge.step1.modal.title", { defaultValue: "Pose ton intention" })}
                </Text>
                <Text style={[s.subtitle, { color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }]}>
                  {t("forge.step1.modal.subtitle", { defaultValue: "Pourquoi tu veux tenir ce défi ?" })}
                </Text>
              </View>
            </View>

            {/* Input */}
            <TextInput
              style={[s.input, {
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                color: isDark ? "#fff" : "#0B1120",
              }]}
              placeholder={t("forge.step1.modal.placeholder", {
                defaultValue: "Ex: Pour me prouver que je peux tenir 30 jours..."
              })}
              placeholderTextColor={isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)"}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={200}
              autoFocus
              returnKeyType="done"
              blurOnSubmit
            />

            <Text style={[s.counter, { color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)" }]}>
              {text.length}/200
            </Text>

            {/* CTAs */}
            <View style={s.ctas}>
              <TouchableOpacity onPress={close} style={[s.btnSecondary, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              }]}>
                <Text style={[s.btnSecondaryText, { color: isDark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.50)" }]}>
                  {t("common.cancel", { defaultValue: "Annuler" })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={text.trim().length === 0}
                style={[s.btnPrimary, { opacity: text.trim().length === 0 ? 0.45 : 1 }]}
              >
                <LinearGradient
                  colors={["#C2410C", "#F97316"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.btnPrimaryGrad}
                >
                  <Text style={s.btnPrimaryText}>
                    {t("forge.step1.modal.cta", { defaultValue: "Valider" })}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  centerer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: "#F97316", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 24 },
      android: { elevation: 16 },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: "top",
  },
  counter: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: -8,
  },
  ctas: {
    flexDirection: "row",
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 14,
  },
  btnPrimary: {
    flex: 1.6,
    borderRadius: 14,
    overflow: "hidden",
  },
  btnPrimaryGrad: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
  },
  btnPrimaryText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 14,
    color: "#fff",
  },
});