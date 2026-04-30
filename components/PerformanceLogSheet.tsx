// components/PerformanceLogSheet.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import * as Haptics from "expo-haptics";

export type PerformanceMood = "perfect" | "good" | "hard";

export type PerformanceLogEntry = {
  savedAt: string;
  mood?: PerformanceMood;
  value?: number;
  note?: string;
};

type Props = {
  visible: boolean;
  challengeId: string;
  uniqueKey: string;
  dateKey: string;
  unit?: string | null;
  targetValue?: number | null;
  isDarkMode: boolean;
  t: (key: string, opts?: any) => string;
  onDismiss: () => void;
  onSaved?: (log: PerformanceLogEntry) => void;
};

const ORANGE = "#F97316";

const ns = (n: number) => {
  const { Dimensions, PixelRatio } = require("react-native");
  const w = Dimensions.get("window").width;
  const scale = Math.min(Math.max(w / 375, 0.78), 1.55);
  return Math.round(PixelRatio.roundToNearestPixel(n * scale));
};

const MOODS: {
  id: PerformanceMood;
  emoji: string;
  labelKey: string;
  labelDefault: string;
  color: string;
  bgDark: string;
  bgLight: string;
}[] = [
  {
    id: "perfect",
    emoji: "🔥",
    labelKey: "perf.mood.perfect",
    labelDefault: "Parfait",
    color: "#F97316",
    bgDark: "rgba(249,115,22,0.14)",
    bgLight: "rgba(249,115,22,0.09)",
  },
  {
    id: "good",
    emoji: "👍",
    labelKey: "perf.mood.good",
    labelDefault: "Bien",
    color: "#22C55E",
    bgDark: "rgba(34,197,94,0.14)",
    bgLight: "rgba(34,197,94,0.09)",
  },
  {
    id: "hard",
    emoji: "😐",
    labelKey: "perf.mood.hard",
    labelDefault: "Difficile",
    color: "#6366F1",
    bgDark: "rgba(99,102,241,0.14)",
    bgLight: "rgba(99,102,241,0.09)",
  },
];

export default function PerformanceLogSheet({
  visible,
  challengeId,
  uniqueKey,
  dateKey,
  unit,
  targetValue,
  isDarkMode,
  t,
  onDismiss,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<PerformanceMood | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Couleurs ───────────────────────────────────────────────────────────────
  const bg = isDarkMode ? "rgba(10,6,2,0.99)" : "rgba(255,251,247,0.99)";
  const textPri = isDarkMode ? "#FFFFFF" : "#1A0800";
  const textSec = isDarkMode ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";
  const borderCol = isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(249,115,22,0.15)";
  const inputBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.04)";
  const inputBorder = isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(249,115,22,0.18)";

  // ─── Animations ─────────────────────────────────────────────────────────────
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animateIn = useCallback(() => {
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { damping: 24, stiffness: 280, mass: 0.8 });
  }, [opacity, translateY]);

  const animateOut = useCallback((cb: () => void) => {
    Keyboard.dismiss();
    opacity.value = withTiming(0, { duration: 160 });
    translateY.value = withTiming(380, { duration: 200 }, (done) => {
      if (done) runOnJS(cb)();
    });
  }, [opacity, translateY]);

  useEffect(() => {
    if (visible) {
      // Reset state
      setMood(null);
      setValue("");
      setNote("");
      setSaving(false);
      animateIn();
    } else {
      opacity.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(380, { duration: 200 });
    }
  }, [visible]);

  // Nettoyage timer au unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { handleDismiss(); return; }

      const numVal = value.trim()
        ? parseFloat(value.replace(",", "."))
        : null;

      const log: Record<string, any> = {
        savedAt: new Date().toISOString(),
      };
      if (mood) log.mood = mood;
      if (Number.isFinite(numVal) && numVal !== null) log.value = numVal;
      if (note.trim()) log.note = note.trim();

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) { handleDismiss(); return; }

      const data = snap.data() as any;
      const arr = Array.isArray(data.CurrentChallenges)
        ? [...data.CurrentChallenges]
        : [];

      const idx = arr.findIndex((c: any) =>
        c?.uniqueKey === uniqueKey ||
        ((c?.challengeId ?? c?.id) === challengeId)
      );

      if (idx !== -1) {
        arr[idx] = {
          ...arr[idx],
          performanceLogs: {
            ...(arr[idx].performanceLogs ?? {}),
            [dateKey]: log,
          },
        };
       await updateDoc(userRef, { CurrentChallenges: arr });
onSaved?.(log as PerformanceLogEntry);
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.warn("[PerformanceLog] save error:", e);
    } finally {
      setSaving(false);
      handleDismiss();
    }
  }, [mood, value, note, saving, challengeId, uniqueKey, dateKey, handleDismiss, onSaved]);

  if (!visible) return null;

  const showNumericField = !!(unit || targetValue);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(0,0,0,0.50)" },
          backdropStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={handleDismiss} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[
            {
              backgroundColor: bg,
              borderTopLeftRadius: ns(28),
              borderTopRightRadius: ns(28),
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: isDarkMode
                ? "rgba(249,115,22,0.20)"
                : "rgba(249,115,22,0.15)",
              paddingBottom: Math.max(insets.bottom + ns(16), ns(28)),
              overflow: "hidden",
            },
            sheetStyle,
          ]}
        >
          {/* Accent strip */}
          <LinearGradient
            colors={["rgba(249,115,22,0.75)", "rgba(249,115,22,0.00)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ height: ns(3) }}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{
              paddingHorizontal: ns(20),
              paddingTop: ns(20),
              paddingBottom: ns(8),
              gap: ns(14),
            }}
          >
            {/* Handle + titre */}
            <View style={{ alignItems: "center", marginBottom: ns(4) }}>
              <View style={{
                width: ns(36),
                height: ns(4),
                borderRadius: ns(2),
                backgroundColor: isDarkMode
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(0,0,0,0.10)",
                marginBottom: ns(16),
              }} />
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(17),
                color: textPri,
                textAlign: "center",
                letterSpacing: -0.3,
              }}>
                {t("perf.sheet.title", { defaultValue: "Comment ça s'est passé ?" })}
              </Text>
              <Text style={{
                fontFamily: "Comfortaa_400Regular",
                fontSize: ns(12),
                color: textSec,
                marginTop: ns(4),
                textAlign: "center",
              }}>
                {t("perf.sheet.sub", { defaultValue: "Tout est facultatif · Enrichit ton historique" })}
              </Text>
            </View>

            {/* ── Mood buttons ── */}
            <View style={{ flexDirection: "row", gap: ns(10) }}>
              {MOODS.map((m) => {
                const selected = mood === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      setMood(mood === m.id ? null : m.id);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: ns(16),
                      paddingVertical: ns(14),
                      alignItems: "center",
                      gap: ns(7),
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? m.color : borderCol,
                      backgroundColor: selected
                        ? (isDarkMode ? m.bgDark : m.bgLight)
                        : inputBg,
                      opacity: pressed ? 0.80 : 1,
                      transform: [{ scale: pressed ? 0.96 : selected ? 1.02 : 1 }],
                    })}
                  >
                    <Text style={{ fontSize: ns(26) }}>{m.emoji}</Text>
                    <Text style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(11),
                      color: selected ? m.color : textSec,
                    }}>
                      {t(m.labelKey, { defaultValue: m.labelDefault })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Valeur numérique (facultatif, toujours visible) ── */}
            <View>
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(11),
                color: textSec,
                marginBottom: ns(7),
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}>
                {unit
                  ? t("perf.sheet.valueLabel", { unit, defaultValue: `Valeur (${unit})` })
                  : t("perf.sheet.valueLabelGeneric", { defaultValue: "Valeur atteinte (facultatif)" })}
              </Text>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: ns(10),
                borderRadius: ns(14),
                borderWidth: 1,
                borderColor: inputBorder,
                backgroundColor: inputBg,
                paddingHorizontal: ns(14),
                paddingVertical: ns(12),
              }}>
                <Ionicons name="analytics-outline" size={ns(18)} color={ORANGE} />
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={
                    targetValue
                      ? t("perf.sheet.valuePlaceholder", {
                          target: targetValue,
                          unit: unit ?? "",
                          defaultValue: `Objectif : ${targetValue}${unit ? ` ${unit}` : ""}`,
                        })
                      : t("perf.sheet.valuePlaceholderGeneric", {
                          defaultValue: "Ex: 8000, 2.5, 45…",
                        })
                  }
                  placeholderTextColor={textSec}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={{
                    flex: 1,
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(14),
                    color: textPri,
                    includeFontPadding: false,
                    paddingVertical: 0,
                  }}
                />
                {unit && (
                  <View style={{
                    paddingHorizontal: ns(8),
                    paddingVertical: ns(4),
                    borderRadius: ns(8),
                    backgroundColor: isDarkMode
                      ? "rgba(249,115,22,0.14)"
                      : "rgba(249,115,22,0.08)",
                  }}>
                    <Text style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(11),
                      color: ORANGE,
                    }}>
                      {unit}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Note libre ── */}
            <View>
              <Text style={{
                fontFamily: "Comfortaa_700Bold",
                fontSize: ns(11),
                color: textSec,
                marginBottom: ns(7),
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}>
                {t("perf.sheet.noteLabel", { defaultValue: "Note (facultatif)" })}
              </Text>
              <View style={{
                borderRadius: ns(14),
                borderWidth: 1,
                borderColor: inputBorder,
                backgroundColor: inputBg,
                paddingHorizontal: ns(14),
                paddingVertical: ns(12),
              }}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={t("perf.sheet.notePlaceholder", {
                    defaultValue: "Ce qui s'est passé, ressenti, contexte…",
                  })}
                  placeholderTextColor={textSec}
                  multiline
                  numberOfLines={3}
                  maxLength={280}
                  returnKeyType="done"
                  blurOnSubmit
                  style={{
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(13),
                    color: textPri,
                    includeFontPadding: false,
                    minHeight: ns(64),
                    textAlignVertical: "top",
                    paddingVertical: 0,
                  }}
                />
                {note.length > 0 && (
                  <Text style={{
                    fontFamily: "Comfortaa_400Regular",
                    fontSize: ns(10),
                    color: textSec,
                    textAlign: "right",
                    marginTop: ns(4),
                  }}>
                    {note.length}/280
                  </Text>
                )}
              </View>
            </View>

            {/* ── CTAs ── */}
            <View style={{ gap: ns(10), marginTop: ns(4) }}>
              {/* Valider — visible seulement si au moins un champ rempli */}
              {(mood || value.trim() || note.trim()) ? (
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={({ pressed }) => ({
                    borderRadius: ns(16),
                    overflow: "hidden",
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.987 : 1 }],
                  })}
                >
                  <LinearGradient
                    colors={["#F97316", "#EA6C0A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: ns(15),
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: ns(16),
                    }}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: ns(16) }]}
                      pointerEvents="none"
                    />
                    <Text style={{
                      fontFamily: "Comfortaa_700Bold",
                      fontSize: ns(15),
                      color: "#0B1120",
                    }}>
                      {saving
                        ? t("commonS.saving", { defaultValue: "Enregistrement…" })
                        : t("perf.sheet.cta", { defaultValue: "Enregistrer" })}
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : null}

              {/* Passer — toujours présent */}
              <Pressable
                onPress={handleDismiss}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: ns(12),
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                <Text style={{
                  fontFamily: "Comfortaa_400Regular",
                  fontSize: ns(13),
                  color: textSec,
                  textDecorationLine: "underline",
                }}>
                  {t("perf.sheet.skip", { defaultValue: "Passer" })}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}