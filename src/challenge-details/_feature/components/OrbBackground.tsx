import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Theme } from "../../../../theme/designSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OrbBackground({ theme }: { theme: Theme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[
          styles.orb,
          {
            width: SCREEN_WIDTH * 0.95,
            height: SCREEN_WIDTH * 0.95,
            borderRadius: (SCREEN_WIDTH * 0.95) / 2,
            top: -SCREEN_WIDTH * 0.45,
            left: -SCREEN_WIDTH * 0.28,
          },
        ]}
      />
      <LinearGradient
        colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={[
          styles.orb,
          {
            width: SCREEN_WIDTH * 1.1,
            height: SCREEN_WIDTH * 1.1,
            borderRadius: (SCREEN_WIDTH * 1.1) / 2,
            bottom: -SCREEN_WIDTH * 0.55,
            right: -SCREEN_WIDTH * 0.35,
          },
        ]}
      />
      <LinearGradient
        colors={[theme.colors.background + "00", theme.colors.background + "66"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    opacity: 0.95,
  },
});
