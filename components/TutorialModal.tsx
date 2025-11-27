// components/TutorialModal.tsx
import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  AccessibilityInfo,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeInUp,
  withTiming,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { normalize } from "../utils/normalize";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import TutorialIcon from "./TutorialIcon";
import TutorialVideoWrapper from "./TutorialVideoWrapper";
import { TUTORIAL_STEPS } from "./TutorialSteps";
import * as Haptics from "expo-haptics";

interface TutorialModalProps {
  step: number;
  onNext: () => void;
  onStart: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

const TOTAL_STEPS = TUTORIAL_STEPS.length;

const TutorialModal: React.FC<TutorialModalProps> = ({
  step,
  onNext,
  onStart,
  onSkip,
  onFinish,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const safeStep = Math.min(Math.max(step, 0), TOTAL_STEPS - 1);

  // --- micro-animation CTA
  const scale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePressIn = () =>
    (scale.value = withTiming(0.96, { duration: 90 }));
  const handlePressOut = () =>
    (scale.value = withTiming(1, { duration: 90 }));

  // --- lock pour éviter double navigation
  const lockRef = useRef(false);
  const safeGo = (fn: () => void) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      fn();
    } finally {
      setTimeout(() => (lockRef.current = false), 350);
    }
  };

  // --- a11y: annoncer le titre à chaque step
  useEffect(() => {
    const titleKey = TUTORIAL_STEPS[safeStep]?.titleKey;
    if (titleKey) {
      AccessibilityInfo.announceForAccessibility(t(titleKey));
    }
  }, [safeStep, t]);

  // --- Back Android: skip
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      safeGo(onSkip);
      return true;
    });
    return () => sub.remove();
  }, [onSkip]);

  const title = t(TUTORIAL_STEPS[safeStep]?.titleKey ?? "");
  const description = t(TUTORIAL_STEPS[safeStep]?.descriptionKey ?? "");

  const isWelcome = safeStep === 0;
  const isLast = safeStep === TOTAL_STEPS - 1;

  const progressLabel = useMemo(
    () => `${safeStep + 1} / ${TOTAL_STEPS}`,
    [safeStep]
  );

  return (
    <TutorialVideoWrapper
      step={safeStep}
      title={
        <Animated.View entering={FadeInUp.delay(140)}>
          <Text
            style={[styles.modalTitle, { color: currentTheme.colors.primary }]}
            allowFontScaling={false}
            {...(Platform.OS === "android"
              ? { textBreakStrategy: "simple" as const }
              : {})}
          >
            {title}
          </Text>
        </Animated.View>
      }
      description={
        <Animated.View entering={FadeInUp.delay(230)}>
          <Text
            style={[styles.modalDescription, { color: "#fff" }]}
            allowFontScaling={false}
            {...(Platform.OS === "android"
              ? { textBreakStrategy: "simple" as const }
              : {})}
          >
            {description}
          </Text>
        </Animated.View>
      }
      icon={<TutorialIcon step={safeStep} />}
    >
      {/* ✅ Progress mini label */}
      <Text style={styles.progressText} accessibilityLabel={`Step ${progressLabel}`}>
        {t("tutorial.progress", { defaultValue: "Étape" })} {progressLabel}
      </Text>

      {/* Dots de progression premium */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const active = i === safeStep;
          const passed = i < safeStep;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                active && styles.dotActive,
                passed && styles.dotPassed,
                {
                  backgroundColor: active || passed
                    ? currentTheme.colors.secondary
                    : "rgba(255,255,255,0.22)",
                },
              ]}
            />
          );
        })}
      </View>

      {/* STEP 0 — Welcome */}
      {isWelcome && (
        <View style={styles.centeredButtonContainer}>
          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                safeGo(onStart);
              }}
              accessibilityLabel={t("tutorial.buttons.start")}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.gradientButton}
              >
                <Text style={styles.actionButtonText}>
                  {t("tutorial.buttons.start")}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <TouchableOpacity
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              ).catch(() => {});
              safeGo(onSkip);
            }}
            style={styles.skipButton}
            accessibilityLabel={t("tutorial.buttons.skip")}
          >
            <Text
              style={[
                styles.skipButtonText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("tutorial.buttons.skip")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEPS 1..5 */}
      {!isWelcome && !isLast && (
        <Animated.View style={[buttonAnimatedStyle, styles.bottomButton]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              safeGo(onNext);
            }}
            accessibilityLabel={t("tutorial.buttons.next")}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.primary,
                currentTheme.colors.secondary,
              ]}
              style={styles.gradientButton}
            >
              <Ionicons
                name="chevron-forward"
                size={normalize(22)}
                color={"#fff"}
              />
            </LinearGradient>
          </Pressable>

          <TouchableOpacity
            onPress={() => safeGo(onSkip)}
            style={styles.skipMini}
          >
            <Text style={[styles.skipButtonText, { color: "#e5e7eb" }]}>
              {t("tutorial.buttons.skip")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* STEP 6 — Finish */}
      {isLast && (
        <Animated.View style={[buttonAnimatedStyle, styles.bottomButton]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              ).catch(() => {});
              safeGo(onFinish);
            }}
            accessibilityLabel={t("tutorial.buttons.finish")}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.primary,
                currentTheme.colors.secondary,
              ]}
              style={styles.gradientButton}
            >
              <Text style={styles.actionButtonText}>
                {t("tutorial.buttons.finish")}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </TutorialVideoWrapper>
  );
};

const styles = StyleSheet.create({
  modalTitle: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalize(6),
    includeFontPadding: true,
    textAlignVertical: "center",
    maxWidth: "92%",
    alignSelf: "center",
    ...(Platform.OS === "android"
      ? { textBreakStrategy: "simple" }
      : null),
  },

  modalDescription: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    opacity: 0.88,
    marginBottom: normalize(10),
    lineHeight: Math.round(normalize(14) * 1.55),
    maxWidth: "92%",
    includeFontPadding: true,
    textAlignVertical: "center",
    ...(Platform.OS === "android"
      ? { textBreakStrategy: "simple" as const }
      : null),
  },

  progressText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginBottom: normalize(6),
    textAlign: "center",
  },

  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: normalize(8),
    justifyContent: "center",
    alignItems: "center",
  },

  dot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: 999,
    opacity: 0.7,
    transform: [{ scale: 1 }],
  },
  dotActive: {
    width: normalize(18),
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  dotPassed: {
    opacity: 0.95,
  },

  centeredButtonContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalize(8),
  },

  gradientButton: {
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(20),
    borderRadius: normalize(24),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: normalize(100),
  },

  actionButtonText: {
    fontSize: normalize(15),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    includeFontPadding: true,
    lineHeight: Math.round(normalize(15) * 1.35),
    ...(Platform.OS === "android"
      ? { textBreakStrategy: "simple" }
      : null),
  },

  skipButton: {
    justifyContent: "center",
    paddingHorizontal: normalize(12),
    marginTop: normalize(8),
  },
  skipButtonText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    color: "#ddd",
  },

  bottomButton: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: normalize(6),
  },

  skipMini: {
    marginTop: normalize(8),
    alignSelf: "center",
  },
});

export default TutorialModal;
