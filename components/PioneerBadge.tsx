import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type BadgeSize = "tiny" | "mini" | "small" | "medium";

interface Props {
  size?: BadgeSize;
  label?: string;
  hideLabel?: boolean;
  style?: ViewStyle;
  /** Ajoute une ombre douce (désactivé par défaut pour rester discret) */
  elevated?: boolean;
  /** Force un rendu compact (équivaut à hideLabel sur tiny/mini) */
  compact?: boolean;
  /** Pour l’accessibilité : remplace le label automatique */
  accessibilityLabel?: string;
}

const SIZE_PRESETS: Record<BadgeSize, {
  padV: number;
  padH: number;
  radius: number;
  icon: number;
  font: number;
  gap: number;
}> = {
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
}: Props) => {
  const s = SIZE_PRESETS[size] ?? SIZE_PRESETS.small;
  const showText = !(hideLabel || compact || size === "tiny");

  const containerStyle = useMemo(() => ([
    styles.container,
    {
      paddingVertical: s.padV,
      paddingHorizontal: s.padH,
      borderRadius: s.radius,
    },
    elevated ? styles.elevated : null,
    style,
  ]), [s, elevated, style]);

  return (
    <LinearGradient
      colors={["#FEEBC8", "#F6AD55", "#DD6B20"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (showText ? label : "Pioneer")}
    >
      <Ionicons name="sparkles" size={s.icon} color="#2D1600" />
      {showText && (
        <Text
          style={[
            styles.text,
            { fontSize: s.font, marginLeft: s.gap },
          ]}
          numberOfLines={1}
        >
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
    borderColor: "rgba(0,0,0,0.15)",
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  text: {
    color: "#2D1600",
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
});

export default PioneerBadge;
