// components/TutorialIcon.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ZoomIn } from "react-native-reanimated";
import { normalize } from "../utils/normalize";

const CIRCLE_SIZE = normalize(55);

const iconMap: Record<number, keyof typeof Ionicons.glyphMap> = {
  0: "sparkles",
  1: "home-outline",
  2: "person-outline",
  3: "flash-outline",
  4: "compass-outline",
};

export default function TutorialIcon({ step }: { step: number }) {
  const iconName = iconMap[step] || "star";

  return (
    <Animated.View entering={ZoomIn.duration(500)} style={styles.container}>
      <View style={styles.circle}>
        <Ionicons name={iconName} size={normalize(30)} color="#fff" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: normalize(10),
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#ed8f03",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
});
