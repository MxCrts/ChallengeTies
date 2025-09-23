import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
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

interface TutorialModalProps {
  step: number;
  onNext: () => void;
  onStart: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

const SPACING = normalize(15);

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

  const scale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const getModalContent = () => {
    switch (step) {
      case 0:
        return {
          title: t("tutorial.welcome.title"),
          description: t("tutorial.welcome.description"),
        };
      case 1:
        return {
          title: t("tutorial.index.title"),
          description: t("tutorial.index.description"),
        };
      case 2:
        return {
          title: t("tutorial.profile.title"),
          description: t("tutorial.profile.description"),
        };
      case 3:
        return {
          title: t("tutorial.focus.title"),
          description: t("tutorial.focus.description"),
        };
      case 4:
        return {
          title: t("tutorial.explore.title"),
          description: t("tutorial.explore.description"),
        };
      case 5:
        return {
          title: t("tutorial.videoStep.title"),
          description: t("tutorial.videoStep.description"),
        };
      default:
        return { title: "", description: "" };
    }
  };

  const { title, description } = getModalContent();

  return (
    <TutorialVideoWrapper
      step={step}
     title={
  <Animated.View entering={FadeInUp.delay(150)}>
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
  <Animated.View entering={FadeInUp.delay(250)}>
    <Text
      style={[
       styles.modalDescription,
       { color: "#fff" }, // 👈 toujours blanc
     ]}
      allowFontScaling={false}
      {...(Platform.OS === "android"
        ? { textBreakStrategy: "simple" as const }
        : {})}
    >
      {description}
    </Text>
  </Animated.View>
}


      icon={<TutorialIcon step={step} />}
    >
      {step === 0 && (
        <View style={styles.centeredButtonContainer}>
          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={onStart}
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
            onPress={onSkip}
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

      {step > 0 && step <= 4 && (
        <Animated.View style={[buttonAnimatedStyle, styles.bottomButton]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onNext}
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
                size={normalize(24)}
                color={currentTheme.colors.textPrimary}
              />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {step === 5 && (
        <Animated.View style={[buttonAnimatedStyle, styles.bottomButton]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onFinish}
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
   ...(Platform.OS === "android" ? { textBreakStrategy: "simple" } : null),
 textAlignVertical: "center", 
 maxWidth: "92%",
   alignSelf: "center",
  },
  modalDescription: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    opacity: 0.85,
    marginBottom: normalize(12),
    lineHeight: Math.round(normalize(14) * 1.55), // ≈ 21
 maxWidth: "92%",
 includeFontPadding: true,
 textAlignVertical: "center",
 ...(Platform.OS === "android" ? { textBreakStrategy: "simple" as const } : null),
 paddingTop: normalize(2),
   paddingBottom: normalize(2),
  },
  centeredButtonContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalize(10),
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
   ...(Platform.OS === "android" ? { textBreakStrategy: "simple" } : null),
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
   marginTop: normalize(10),
  },
});

export default TutorialModal;
