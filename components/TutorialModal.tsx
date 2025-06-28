import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
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
import TutorialIcon from "./TutorialIcon"; // ajuste le chemin si besoin

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
      default:
        return { title: "", description: "" };
    }
  };

  const { title, description } = getModalContent();

  return (
    <Animated.View
      entering={FadeInUp.duration(600).springify()}
      style={[styles.modalContainer, { borderColor: "#FFD700" }]}
    >
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 20, 20, 0.98)", "rgba(45, 45, 45, 0.92)"]
            : ["rgba(255, 255, 255, 0.97)", "rgba(245, 245, 245, 0.9)"]
        }
        style={[
          styles.gradientBackground,
          {
            borderWidth: 1,
            borderColor: isDarkMode
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.05)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
          },
        ]}
      >
        <TutorialIcon step={step} />
        <Animated.Text
          entering={FadeInUp.delay(150)}
          style={[styles.modalTitle, { color: currentTheme.colors.primary }]}
        >
          {title}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(250)}
          style={[
            styles.modalDescription,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {description}
        </Animated.Text>
        {step === 0 ? (
          <View style={styles.buttonContainer}>
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={buttonAnimatedStyle}
            >
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
            <Animated.View entering={FadeInUp.delay(300)}>
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
            </Animated.View>
          </View>
        ) : step < 4 ? (
          <Animated.View style={buttonAnimatedStyle}>
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
        ) : (
          <Animated.View style={buttonAnimatedStyle}>
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
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: "90%",
    maxWidth: normalize(400),
    marginHorizontal: SPACING,
    borderRadius: normalize(24),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 1,
    shadowRadius: normalize(10),
    elevation: 10,
    borderWidth: normalize(0.5),
    alignSelf: "center",
    marginTop: normalize(20),
    marginBottom: normalize(20),
  },
  gradientBackground: {
    padding: SPACING * 2,
    alignItems: "center",
    minHeight: normalize(250),
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: normalize(26),
    fontFamily: "Comfortaa_700Bold",
    color: "#ed8f03",
    textAlign: "center", // 🟢 Centrage horizontal
    marginBottom: normalize(8),
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalDescription: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING * 2,
    lineHeight: normalize(26),
    maxWidth: "95%",
    opacity: 0.9,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: SPACING,
  },
  gradientButton: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(24),
    borderRadius: normalize(30),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
  },
  skipButton: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(24),
  },
  skipButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
});

export default TutorialModal;
