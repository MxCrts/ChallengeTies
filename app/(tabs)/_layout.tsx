import React, { useState, useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Dimensions } from "react-native";
import { TrophyProvider } from "../../context/TrophyContext";
import { auth, db } from "../../constants/firebase-config";
import { doc, onSnapshot } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375; // iPhone X ref
  const scale = SCREEN_WIDTH / baseWidth;
  const newSize = size * scale;

  // Clamp pour éviter que ça soit trop petit ou trop grand
  if (newSize < size * 0.85) return size * 0.85;
  if (newSize > size * 1.25) return size * 1.25;
  return Math.round(newSize);
};

// Interface pour typer les noms d’icônes
type IconName = "home" | "person" | "flame" | "compass" | "settings";

// Composant animé pour chaque icône
const AnimatedTabIcon = ({
  name,
  focused,
  color,
  size,
}: {
  name: IconName;
  focused: boolean;
  color: string;
  size: number;
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.2, { damping: 10, stiffness: 100 });
      if (name === "compass") {
        rotation.value = withTiming(360, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        });
      } else if (name === "settings") {
        rotation.value = withTiming(90, {
          duration: 500,
          easing: Easing.out(Easing.ease),
        });
      } else {
        rotation.value = 0;
      }
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      rotation.value = 0;
    }
  }, [focused, name]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[scaleStyle]}>
      <Animated.View style={[rotateStyle]}>
        <Ionicons
          name={focused ? name : `${name}-outline`}
          size={size}
          color={color}
        />
      </Animated.View>
    </Animated.View>
  );
};

// Composant spécial pour l’icône "focus" (flamme centrale)
const FocusTabIcon = ({
  focused,
  currentTheme,
  isDarkMode,
}: {
  focused: boolean;
  currentTheme: typeof designSystem.lightTheme; // ou ton type Theme si tu l'as exporté
  isDarkMode: boolean;
}) => {
  const scale = useSharedValue(1);
  const flameOpacity = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.1, { damping: 10, stiffness: 100 });
      flameOpacity.value = withTiming(1, { duration: 300 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      flameOpacity.value = withTiming(0.7, { duration: 300 });
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.focusIconContainer, animatedStyle]}>
      <LinearGradient
        colors={
          focused
            ? [currentTheme.colors.primary, currentTheme.colors.secondary]
            : isDarkMode
            ? ["#333", "#444"]
            : ["#FFE8D6", "#FFDAB9"]
        }
        style={styles.focusGradient}
      >
        <Ionicons name="flame" size={normalizeSize(32)} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
};


const TabsLayout = () => {
  const { t } = useTranslation();
  const [hasUnclaimedAchievements, setHasUnclaimedAchievements] =
    useState(false);
  const insets = useSafeAreaInsets();
const { theme } = useTheme();
const isDarkMode = theme === "dark";
const currentTheme = isDarkMode
  ? designSystem.darkTheme
  : designSystem.lightTheme;

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    // écoute en temps réel la collection users/<uid>
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const newAchievements: string[] = data.newAchievements || [];
        setHasUnclaimedAchievements(newAchievements.length > 0);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <TrophyProvider>
      <Tabs
        screenOptions={{
  headerShown: false,
  tabBarStyle: {
    backgroundColor: currentTheme.colors.cardBackground,
    height: normalizeSize(60) + insets.bottom,
    paddingBottom: insets.bottom + normalizeSize(4),
    paddingTop: normalizeSize(4),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(227, 226, 233, 0.5)",
  },
  tabBarLabelStyle: {
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_700Bold",
    flexWrap: "wrap",
    width: "100%",
    textAlign: "center",
    lineHeight: normalizeSize(12),
    paddingBottom: normalizeSize(2),
  },
  tabBarIconStyle: {
    marginBottom: 0,
  },
   tabBarItemStyle: {
    flex: 1, // S’assure que chaque item prend le même espace
    maxWidth: normalizeSize(80), // Évite qu’un bouton soit trop large
    paddingVertical: normalizeSize(4),
    paddingTop: normalizeSize(6),
  },
  tabBarActiveTintColor: isDarkMode
    ? "#FFDD95"
    : currentTheme.colors.primary,
  tabBarInactiveTintColor: isDarkMode
    ? "#FFDD95"
    : currentTheme.colors.textSecondary,
}}
      >
        <Tabs.Screen
          name="index"
          options={{
           tabBarLabel: t("home"),
            tabBarIcon: ({ color, focused, size }) => (
              <AnimatedTabIcon
                name="home"
                focused={focused}
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: t("profile"),
            tabBarIcon: ({ color, focused, size }) => (
              <View style={styles.profileIconContainer}>
                <AnimatedTabIcon
                  name="person"
                  focused={focused}
                  color={color}
                  size={size}
                />
                {hasUnclaimedAchievements && (
                  <View style={styles.notificationDot} />
                )}
              </View>
            ),
          }}
        />

        <Tabs.Screen
  name="focus"
  options={{
    tabBarLabel: "",
    tabBarIcon: ({ focused }) => (
      <FocusTabIcon
        focused={focused}
        currentTheme={currentTheme}
        isDarkMode={isDarkMode}
      />
    ),
  }}
/>

        <Tabs.Screen
          name="explore"
          options={{
            tabBarLabel: t("explore"),
            tabBarIcon: ({ color, focused, size }) => (
              <AnimatedTabIcon
                name="compass"
                focused={focused}
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Settings"
          options={{
             tabBarLabel: t("settings"),
            tabBarIcon: ({ color, focused, size }) => (
              <AnimatedTabIcon
                name="settings"
                focused={focused}
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tabs>
    </TrophyProvider>
  );
};

const styles = StyleSheet.create({
  profileIconContainer: {
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: -normalizeSize(3),
    right: -normalizeSize(3),
    backgroundColor: "red",
    width: normalizeSize(10),
    height: normalizeSize(10),
    borderRadius: normalizeSize(5),
    borderWidth: 1,
    borderColor: "#FFF",
  },
  focusIconContainer: {
    marginTop: -normalizeSize(20),
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowRadius: normalizeSize(5),
    elevation: 5,
  },
  focusGradient: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(30),
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TabsLayout;
