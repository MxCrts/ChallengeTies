import React from "react";
import { TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";

interface BackButtonProps {
  color?: string;
  size?: number;
  style?: object;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  color,
  size = 28,
  style = {},
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={() => router.back()}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      testID={testID}
      activeOpacity={0.7}
    >
      <Ionicons
        name="arrow-back-outline"
        size={normalizeSize(size)}
        color={color || currentTheme.colors.textPrimary}
      />
    </TouchableOpacity>
  );
};

const normalizeSize = (size: number) => {
  const scale = Math.min(Dimensions.get("window").width, 414) / 375;
  return Math.round(size * scale);
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    left: normalizeSize(20),
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: normalizeSize(10),
    padding: normalizeSize(8),
  },
});

export default BackButton;
