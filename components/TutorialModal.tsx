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
        <Animated.View
          entering={FadeInUp.delay(140)}
          style={styles.titleWrapper}
        >
          <Text
            style={[
              styles.modalTitle,
              { color: currentTheme.colors.primary },
            ]}
            allowFontScaling={false}
            accessibilityRole="header"
            {...(Platform.OS === "android"
              ? { textBreakStrategy: "simple" as const }
              : {})}
          >
            {title}
          </Text>
        </Animated.View>
      }
      description={
        <Animated.View
          entering={FadeInUp.delay(230)}
          style={styles.descriptionWrapper}
        >
          {/* Description principale */}
          <Text
            style={styles.modalDescription}
            allowFontScaling={false}
            {...(Platform.OS === "android"
              ? { textBreakStrategy: "simple" as const }
              : {})}
          >
            {description}
          </Text>

          {/* Tagline uniquement sur le welcome */}
          {isWelcome && (
            <Animated.View entering={FadeInUp.delay(260)}>
              <Text style={styles.welcomeTagline}>
                {t("tutorial.welcomeTagline", {
                  defaultValue: "Ton voyage commence ici.",
                })}
              </Text>
            </Animated.View>
          )}

          {/* Progression (étape + dots) */}
          <Animated.View
            entering={FadeInUp.delay(280)}
            style={styles.progressBlock}
          >
            <Text
              style={styles.progressText}
              accessibilityLabel={t("tutorial.progressA11y", {
                current: safeStep + 1,
                total: TOTAL_STEPS,
              })}
              allowFontScaling={false}
            >
              {t("tutorial.progress", { defaultValue: "Étape" })}{" "}
              {progressLabel}
            </Text>

            <View style={styles.dotsRow}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
                const active = i === safeStep;
                const passed = i < safeStep;
                const localScale = active ? 1.2 : passed ? 1.05 : 1;
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      active && styles.dotActive,
                      passed && styles.dotPassed,
                      {
                        backgroundColor:
                          active || passed
                            ? currentTheme.colors.secondary
                            : "rgba(255,255,255,0.22)",
                        transform: [{ scale: localScale }],
                      },
                    ]}
                  />
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      }
      icon={<TutorialIcon step={safeStep} />}
    >
      {/* 👉 CHILDREN = uniquement les boutons, placés en bas par TutorialVideoWrapper */}

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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
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

      {/* STEPS 1..(last-1) */}
      {!isWelcome && !isLast && (
        <Animated.View
          style={[buttonAnimatedStyle, styles.bottomButtonRow]}
        >
          <TouchableOpacity
            onPress={() => safeGo(onSkip)}
            style={styles.skipMini}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          >
            <Text
              style={[styles.skipButtonText, { color: "#e5e7eb" }]}
            >
              {t("tutorial.buttons.skip")}
            </Text>
          </TouchableOpacity>

          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              safeGo(onNext);
            }}
            accessibilityLabel={t("tutorial.buttons.next")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.primary,
                currentTheme.colors.secondary,
              ]}
              style={styles.roundIconButton}
            >
              <Ionicons
                name="chevron-forward"
                size={normalize(22)}
                color={"#fff"}
              />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {/* STEP LAST — Finish (bouton centré + passer en dessous) */}
      {isLast && (
        <Animated.View
          style={[buttonAnimatedStyle, styles.bottomLastContainer]}
        >
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

          <TouchableOpacity
            onPress={() => safeGo(onSkip)}
            style={styles.skipLast}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          >
            <Text
              style={[styles.skipButtonText, { color: "#e5e7eb" }]}
            >
              {t("tutorial.buttons.skip")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </TutorialVideoWrapper>
  );
};

const styles = StyleSheet.create({
  titleWrapper: {
    width: "100%",
    maxWidth: normalize(420),
    alignSelf: "center",
    paddingHorizontal: normalize(16),
  },
  buttonMasterContainer: {
    width: "100%",
    paddingHorizontal: normalize(20),
    alignItems: "center",
  },

  // Welcome
  welcomeButtons: {
    width: "100%",
    alignItems: "center",
    gap: normalize(16),
  },
  mainCta: {
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(32),
    borderRadius: normalize(30),
    minWidth: normalize(200),
    alignItems: "center",
  },
  mainCtaText: {
    fontSize: normalize(17),
    fontWeight: "800",
    color: "#fff",
  },
  skipWelcome: {
    padding: normalize(8),
  },

  // Étapes intermédiaires
  intermediateButtons: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: normalize(10),
  },
  nextArrow: {
    width: normalize(56),
    height: normalize(56),
    borderRadius: normalize(28),
    justifyContent: "center",
    alignItems: "center",
  },

  // Dernière étape
  finalButtons: {
    width: "100%",
    alignItems: "center",
  },
  finishCta: {
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(36),
    borderRadius: normalize(30),
    minWidth: normalize(220),
  },

  skipText: {
    fontSize: normalize(15),
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  descriptionWrapper: {
    width: "100%",
    maxWidth: normalize(420),
    alignSelf: "center",
    paddingHorizontal: normalize(16),
  },

  modalTitle: {
    fontSize: normalize(19),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalize(4),
    includeFontPadding: true,
    textAlignVertical: "center",
    maxWidth: "100%",
    ...(Platform.OS === "android"
      ? { textBreakStrategy: "simple" }
      : null),
  },
  modalDescription: {
    fontSize: normalize(13.5),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    opacity: 0.9,
    marginBottom: normalize(2),
    lineHeight: Math.round(normalize(14) * 1.5),
    maxWidth: "100%",
    color: "#ffffff",
    includeFontPadding: true,
    textAlignVertical: "center",
    ...(Platform.OS === "android"
      ? { textBreakStrategy: "simple" as const }
      : null),
  },
  welcomeTagline: {
    fontSize: normalize(12.5),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginBottom: normalize(3),
  },

  progressBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(2),
    width: "100%",
  },
  progressText: {
    fontSize: normalize(11.5),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginBottom: normalize(2),
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: normalize(0),
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: 999,
    opacity: 0.7,
  },
  dotActive: {
    width: normalize(18),
    opacity: 1,
  },
  dotPassed: {
    opacity: 0.95,
  },

  centeredButtonContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalize(4),
  },
  gradientButton: {
    paddingVertical: normalize(9),
    paddingHorizontal: normalize(18),
    borderRadius: normalize(24),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: normalize(120),
  },
  roundIconButton: {
    width: normalize(52),
    height: normalize(52),
    borderRadius: normalize(26),
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: normalize(6),
  },
  skipButtonText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    color: "#ddd",
  },

  // 🔥 Boutons bas (flèche + passer) sur les steps 1..(last-1)
  bottomButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: normalize(420),
  },
  skipMini: {
    paddingVertical: normalize(4),
    paddingHorizontal: normalize(4),
  },

  // 🔥 Dernière étape : bouton Terminer centré + Passer en dessous
  bottomLastContainer: {
    width: "100%",
    maxWidth: normalize(420),
    alignItems: "center",
    justifyContent: "center",
  },
  skipLast: {
    marginTop: normalize(6),
  },
});

export default TutorialModal;
