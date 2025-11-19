import React, { memo, useMemo } from "react";
import { ViewStyle, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";

type BadgeSize = "tiny" | "mini" | "small" | "medium";

interface Props {
  size?: BadgeSize;
  label?: string;
  hideLabel?: boolean;
  style?: ViewStyle;
  elevated?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
  tone?: "gold" | "aqua" | "emerald" | "violet";
  outline?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
}

// 👇 Ensures grad is a tuple (2 or 3 colors)
type Palette = {
  grad: readonly [string, string] | readonly [string, string, string];
  text: string;
  border: string;
  outlineBg: string;
  outlineBorder: string;
};

const SIZE_PRESETS: Record<
  BadgeSize,
  { padV: number; padH: number; radius: number; icon: number; font: number; gap: number }
> = {
  tiny:   { padV: 3,  padH: 6,  radius: 10, icon: 10, font: 10, gap: 4 },
  mini:   { padV: 4,  padH: 8,  radius: 12, icon: 11, font: 11, gap: 6 },
  small:  { padV: 5,  padH: 10, radius: 14, icon: 12, font: 12, gap: 6 },
  medium: { padV: 6,  padH: 12, radius: 16, icon: 14, font: 13, gap: 8 },
};

const PioneerBadge = memo(({
  size = "small",
  label = "Pioneer",
  hideLabel = false,
  style,
  elevated = true,
  compact = false,
  accessibilityLabel,
  tone = "gold",
  outline = false,
  iconName = "sparkles",
}: Props) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const s = SIZE_PRESETS[size] ?? SIZE_PRESETS.small;
  const showText = !(hideLabel || compact || size === "tiny");

  const palette = useMemo<Palette>(() => {
    switch (tone) {
      case "aqua":
        return {
          grad: ["#DFFBFF", "#8BE9F4", "#22D3EE"] as const,
          text: "#052126",
          border: "rgba(0,0,0,0.12)",
          outlineBg: isDarkMode ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.10)",
          outlineBorder: isDarkMode ? "rgba(34,211,238,0.55)" : "rgba(34,211,238,0.5)",
        };
      case "emerald":
        return {
          grad: ["#E6FFF2", "#6EE7B7", "#10B981"] as const,
          text: "#082414",
          border: "rgba(0,0,0,0.12)",
          outlineBg: isDarkMode ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)",
          outlineBorder: isDarkMode ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.5)",
        };
      case "violet":
        return {
          grad: ["#F5E8FF", "#C084FC", "#8B5CF6"] as const,
          text: "#1E0B33",
          border: "rgba(0,0,0,0.12)",
          outlineBg: isDarkMode ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.10)",
          outlineBorder: isDarkMode ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.5)",
        };
      case "gold":
      default:
        return {
          grad: ["#FEEBC8", "#F6AD55", "#DD6B20"] as const,
          text: "#2D1600",
          border: "rgba(0,0,0,0.15)",
          outlineBg: isDarkMode ? "rgba(255,215,0,0.18)" : "rgba(255,215,0,0.12)",
          outlineBorder: isDarkMode ? "rgba(255,215,0,0.55)" : "rgba(221,107,32,0.6)",
        };
    }
  }, [tone, isDarkMode]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingVertical: s.padV,
        paddingHorizontal: s.padH,
        borderRadius: s.radius,
        borderColor: palette.border,
      },
      elevated ? styles.elevated : null,
      style,
    ],
    [s.padV, s.padH, s.radius, palette.border, elevated, style]
  );

  const textStyle = useMemo(
    () => [
      styles.text,
      {
        fontSize: s.font,
        marginLeft: s.gap,
        color: palette.text,
      },
    ],
    [s.font, s.gap, palette.text]
  );

  if (outline) {
    return (
      <LinearGradient
        colors={[palette.outlineBg, palette.outlineBg] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[...containerStyle as any, { borderWidth: 1, borderColor: palette.outlineBorder }]}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? (showText ? label : "Pioneer")}
        pointerEvents="none"
      >
        <Ionicons name={iconName} size={s.icon} color={palette.text} />
        {showText && (
          <Text style={textStyle} numberOfLines={1}>
            {label}
          </Text>
        )}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={palette.grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (showText ? label : "Pioneer")}
      pointerEvents="none"
    >
      <Ionicons name={iconName} size={s.icon} color={palette.text} />
      {showText && (
        <Text style={textStyle} numberOfLines={1}>
          {label}
        </Text>
      )}
    </LinearGradient>
  );
});

PioneerBadge.displayName = "PioneerBadge";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: Platform.OS === "android" ? 2 : 3 },
    shadowOpacity: 0.18,
    shadowRadius: 3.5,
    elevation: 3,
  },
  text: {
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
});

export default PioneerBadge;
