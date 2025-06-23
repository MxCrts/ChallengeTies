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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
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
const FocusTabIcon = ({ focused }: { focused: boolean }) => {
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
        colors={focused ? ["#ED8F03", "#F59E0B"] : ["#FFE8D6", "#FFDAB9"]}
        style={styles.focusGradient}
      >
        <Ionicons name="flame" size={normalizeSize(32)} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
};

const TabsLayout = () => {
  const [hasUnclaimedAchievements, setHasUnclaimedAchievements] =
    useState(false);
  const insets = useSafeAreaInsets();

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
            backgroundColor: "#FFFFFF",
            height: normalizeSize(70) + insets.bottom,
            paddingBottom: insets.bottom,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowOffset: { width: 0, height: -3 },
            shadowRadius: 12,
            borderTopWidth: 1,
            borderTopColor: "rgba(227, 226, 233, 0.5)",
          },
          tabBarLabelStyle: {
            fontSize: normalizeSize(12),
            fontFamily: "Comfortaa_700Bold",
            marginBottom: normalizeSize(5),
          },
          tabBarIconStyle: {
            marginBottom: normalizeSize(-5),
          },
          tabBarActiveTintColor: "#ED8F03",
          tabBarInactiveTintColor: "#A0AEC0",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: "Home",
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
            tabBarLabel: "Profile",
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
            tabBarIcon: ({ focused }) => <FocusTabIcon focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="explore"
          options={{
            tabBarLabel: "Explore",
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
          name="settings"
          options={{
            tabBarLabel: "Settings",
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
