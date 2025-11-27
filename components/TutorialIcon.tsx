// components/TutorialIcon.tsx
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ZoomIn, FadeIn } from "react-native-reanimated";
import { normalize } from "../utils/normalize";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";

const CIRCLE_SIZE = normalize(56);

/**
 * ✅ Map parfaitement cohérente avec les 7 étapes du tutoriel:
 * 0 welcome
 * 1 explore tab
 * 2 create challenge
 * 3 focus tab
 * 4 duo invite
 * 5 profile tab
 * 6 vote tab
 */
const iconMap: Record<number, keyof typeof Ionicons.glyphMap> = {
  0: "sparkles-outline",     // Welcome / intro
  1: "compass-outline",      // Explore défis
  2: "add-circle-outline",   // Créer un challenge
  3: "timer-outline",        // Focus / chrono
  4: "people-outline",       // Duo / inviter un ami
  5: "person-circle-outline",// Profil & défis
  6: "thumbs-up-outline",    // Vote new-features
};

export default function TutorialIcon({ step }: { step: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const iconName = iconMap[step] || "star-outline";

  // petite variation de couleur (premium + cohérent avec le thème)
  const circleColor = useMemo(
    () => (isDark ? current.colors.primary : current.colors.secondary),
    [isDark, current.colors.primary, current.colors.secondary]
  );

  return (
    <Animated.View entering={ZoomIn.duration(420)} style={styles.container}>
      {/* halo doux */}
      <Animated.View
        entering={FadeIn.duration(500)}
        style={[
          styles.glow,
          { backgroundColor: circleColor, opacity: isDark ? 0.22 : 0.18 },
        ]}
      />
      <View style={[styles.circle, { backgroundColor: circleColor }]}>
        <Ionicons name={iconName} size={normalize(30)} color="#fff" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: normalize(10),
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: CIRCLE_SIZE + normalize(18),
    height: CIRCLE_SIZE + normalize(18),
    borderRadius: 999,
    transform: [{ scale: 1.05 }],
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
});
