import React from "react";
import {
  StyleSheet,
  Dimensions,
  ViewStyle,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import type { Insets } from "react-native";

export interface BackButtonProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: Insets;
  onPress?: () => void;
}

const normalizeSize = (size: number) => {
  const scale = Math.min(Dimensions.get("window").width, 414) / 375;
  return Math.round(size * scale);
};

const BUTTON_SIDE = normalizeSize(44);

const BackButton: React.FC<BackButtonProps> = ({
  color,
  size = 24,
  style,
  accessibilityLabel = "Retour",
  accessibilityHint = "Revenir à l'écran précédent",
  testID,
  hitSlop = { top: 8, right: 8, bottom: 8, left: 8 },
  onPress,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const iconColor =
    color ?? (isDarkMode ? currentTheme.colors.secondary : currentTheme.colors.primary);

  const rippleColor = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const baseBg = "transparent";
  const pressedBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const hairline = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      hitSlop={hitSlop}
      android_ripple={{
        color: rippleColor,
        radius: BUTTON_SIDE / 1.6,
        borderless: true,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? pressedBg : baseBg,
          borderColor: hairline,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={normalizeSize(size)} color={iconColor} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIDE,
    height: BUTTON_SIDE,
    borderRadius: BUTTON_SIDE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,

    // ✅ aucune ombre nulle part
    ...(Platform.OS === "ios"
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 0 }),
  },
});

export default BackButton;
