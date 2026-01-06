import React, { useEffect, useMemo, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  I18nManager,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { TrophyProvider } from "../../context/TrophyContext";
import { auth, db } from "@/constants/firebase-config";
import { doc, onSnapshot } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTheme } from "../../context/ThemeContext";
import designSystem, { Theme } from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useTutorial } from "../../context/TutorialContext";
import useGateForGuest from "@/hooks/useGateForGuest";
import RequireAuthModal from "@/components/RequireAuthModal";
import { useReferralStatus } from "@/src/referral/useReferralStatus";
import { useVisitor } from "@/context/VisitorContext";

/* ----------------- Responsive helpers ----------------- */
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const isTablet = long / short < 1.6 && Math.max(width, height) >= 900;
  const base = 375;
  const scale = clamp(short / base, 0.85, 1.25);
  const n = (s: number) => Math.round(s * scale);
  return { width, height, isTablet, n, scale };
};

type IconName = "home" | "person" | "flame" | "compass" | "settings";

/* ----------------- Animated Tab Icon ----------------- */
const AnimatedTabIcon = ({
  name,
  focused,
  color,
  size,
  reduceMotion,
}: {
  name: IconName;
  focused: boolean;
  color: string;
  size: number;
  reduceMotion: boolean;
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      rotation.value = 0;
      scale.value = 1;
      return;
    }

    if (focused) {
      scale.value = withSpring(1.16, { damping: 12, stiffness: 150 });

      if (name === "compass") {
        rotation.value = withTiming(360, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        });
      } else if (name === "settings") {
        rotation.value = withTiming(90, {
          duration: 450,
          easing: Easing.out(Easing.ease),
        });
      } else {
        rotation.value = 0;
      }
    } else {
      rotation.value = withTiming(0, { duration: 250 });
      scale.value = withSpring(1, { damping: 16, stiffness: 180 });
    }
  }, [focused, name, reduceMotion, rotation, scale]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={scaleStyle}>
      <Animated.View style={rotateStyle}>
        <Ionicons
          name={(focused ? name : (`${name}-outline` as IconName)) as any}
          size={size}
          color={color}
        />
      </Animated.View>
    </Animated.View>
  );
};

/* ----------------- Center Flame Button ----------------- */
const FocusTabIcon = ({
  focused,
  theme,
  isDarkMode,
  diameter = normalizeSize(64),
  reduceMotion = false,
}: {
  focused: boolean;
  theme: Theme;
  isDarkMode: boolean;
  diameter?: number;
  reduceMotion?: boolean;
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = focused
      ? withSpring(1.1, { damping: 10, stiffness: 100 })
      : withSpring(1, { damping: 15, stiffness: 150 });
  }, [focused, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconSize = Math.round(diameter * 0.52);

  return (
    <Animated.View style={[{ marginTop: -diameter * 0.35 }, animatedStyle]}>
      <LinearGradient
        colors={
          focused
            ? [theme.colors.primary, theme.colors.secondary]
            : isDarkMode
            ? ["#2E2E33", "#444444"]
            : ["#FFF3E0", "#FFE1C2"]
        }
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: focused ? 0 : 1.5,
          borderColor: focused
            ? "transparent"
            : isDarkMode
            ? "rgba(255,255,255,0.25)"
            : "rgba(0,0,0,0.15)",
          shadowColor: "#000",
          shadowOpacity: focused ? 0.35 : 0.25,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 8,
          elevation: focused ? 10 : 6,
        }}
      >
        <Ionicons name="flame" size={iconSize} color="#FFFFFF" />
      </LinearGradient>
    </Animated.View>
  );
};

const TabsLayout = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    theme,
    reduceMotion = false,
  } = useTheme() as { theme: "dark" | "light"; reduceMotion?: boolean };
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const { isTablet, n, width } = useResponsive();
  const [hasUnclaimed, setHasUnclaimed] = useState(false);
  const { isTutorialActive } = useTutorial();
  const { gate, modalVisible, closeGate } = useGateForGuest();
  const { claimable } = useReferralStatus();

  const iconSize = isTablet ? n(26) : n(22);
  const focusDiameter = isTablet ? n(70) : n(64);
  const showLabels = width >= 360;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) {
        setHasUnclaimed(false);
        return;
      }
      const data = snap.data() as any;
      const pending = Array.isArray(data?.newAchievements)
        ? data.newAchievements
        : [];
      setHasUnclaimed(pending.length > 0);
    });
    return () => unsub();
  }, []);

  const tabBarBackground = useMemo(
    () => (
      <View style={{ flex: 1 }}>
        <BlurView
          tint={isDarkMode ? "dark" : "light"}
          intensity={Platform.OS === "ios" ? 30 : 22}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={
            isDarkMode
              ? [
                  currentTheme.colors.cardBackground + "F2",
                  currentTheme.colors.background + "E6",
                ]
              : ["#FFFFFFF2", "#FFF7F0F0"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: isDarkMode
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.06)",
          }}
        />
      </View>
    ),
    [currentTheme.colors.background, currentTheme.colors.cardBackground, isDarkMode]
  );

  const labelStyle = useMemo(
    () => ({
      fontSize: n(11),
      fontFamily: "Comfortaa_700Bold",
      lineHeight: n(13),
      marginTop: 2,
      textAlign: "center" as const,
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    }),
    [n]
  );

  const barHeight = (isTablet ? n(70) : n(60)) + Math.max(insets.bottom, n(12));
  const padBottom = Math.max(insets.bottom, n(10));

  const tabBarStyleBase = useMemo(
    () => ({
      position: "absolute" as const,
      left: 0,
      right: 0,
      bottom: 0,
      height: barHeight,
      paddingBottom: padBottom,
      paddingTop: n(6),
      borderTopWidth: 0,
      borderTopLeftRadius: n(18),
      borderTopRightRadius: n(18),
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor: "transparent",
      overflow: "visible" as const,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -6 },
        },
        android: { elevation: 22 },
        default: {},
      }),
    }),
    [barHeight, padBottom, n]
  );

  const tabBarStyleHidden = useMemo(
    () => ({
      ...tabBarStyleBase,
      bottom: -barHeight,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      opacity: 0,
      pointerEvents: "none" as const,
    }),
    [barHeight, tabBarStyleBase]
  );

  const tabBarItemStyleHidden: any = useMemo(
    () => ({
      height: 0,
      paddingVertical: 0,
      margin: 0,
    }),
    []
  );

  return (
    <TrophyProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: showLabels,
          tabBarActiveTintColor: isDarkMode
            ? "#FFDD95"
            : currentTheme.colors.primary,
          tabBarInactiveTintColor: isDarkMode
            ? "#D9D9D9"
            : currentTheme.colors.textSecondary,
          tabBarLabelStyle: labelStyle,
          overflow: "visible",
          tabBarItemStyle: isTutorialActive
            ? tabBarItemStyleHidden
            : { paddingVertical: n(4) },
          tabBarStyle: isTutorialActive ? tabBarStyleHidden : tabBarStyleBase,
          tabBarBackground: isTutorialActive
            ? undefined
            : () => tabBarBackground,
          tabBarButton: (props) => (
            <Pressable
              disabled={isTutorialActive}
              android_ripple={{
                color: isDarkMode ? "#ffffff22" : "#00000011",
                borderless: false,
              }}
              {...props}
            />
          ),
        }}
      >
        {/* Home */}
        <Tabs.Screen
          name="index"
          options={{
            tabBarTestID: "tab-home",
            tabBarLabel: t("home"),
            tabBarAccessibilityLabel: t("home"),
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name="home"
                focused={focused}
                color={color}
                size={iconSize}
                reduceMotion={!!reduceMotion}
              />
            ),
          }}
        />

        {/* Profile + badge succès */}
        <Tabs.Screen
          name="profile"
          options={{
            tabBarTestID: "tab-profile",
            tabBarLabel: t("profile"),
            tabBarAccessibilityLabel: t("profile"),
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.badgeWrap}>
                <AnimatedTabIcon
                  name="person"
                  focused={focused}
                  color={color}
                  size={iconSize}
                  reduceMotion={!!reduceMotion}
                />
                {hasUnclaimed && <View style={styles.badgeDot} />}
              </View>
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/profile") && props.onPress?.()}
                android_ripple={{
                  color: isDarkMode ? "#ffffff22" : "#00000011",
                  borderless: false,
                }}
              />
            ),
          }}
        />

        {/* Focus central */}
        <Tabs.Screen
          name="focus"
          options={{
            tabBarLabel: "",
            tabBarTestID: "tab-focus",
            tabBarAccessibilityLabel: t("focus"),
            tabBarIcon: ({ focused }) => (
              <FocusTabIcon
                focused={focused}
                theme={currentTheme}
                isDarkMode={isDarkMode}
                diameter={focusDiameter}
                reduceMotion={!!reduceMotion}
              />
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/focus") && props.onPress?.()}
                android_ripple={{
                  color: isDarkMode ? "#ffffff22" : "#00000011",
                  borderless: false,
                }}
              />
            ),
          }}
        />

        {/* Explore */}
        <Tabs.Screen
          name="explore"
          options={{
            tabBarTestID: "tab-explore",
            tabBarLabel: t("explore"),
            tabBarAccessibilityLabel: t("explore"),
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name="compass"
                focused={focused}
                color={color}
                size={iconSize}
                reduceMotion={!!reduceMotion}
              />
            ),
          }}
        />

        {/* Settings + badge parrainage */}
        <Tabs.Screen
          name="Settings"
          options={{
            tabBarTestID: "tab-settings",
            tabBarLabel: t("settings"),
            tabBarAccessibilityLabel: t("settings"),
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.badgeWrap}>
                <AnimatedTabIcon
                  name="settings"
                  focused={focused}
                  color={color}
                  size={iconSize}
                  reduceMotion={!!reduceMotion}
                />
                {claimable.length > 0 && (
                  <View style={styles.badgeDotSettings} />
                )}
              </View>
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/Settings") && props.onPress?.()}
                android_ripple={{
                  color: isDarkMode ? "#ffffff22" : "#00000011",
                  borderless: false,
                }}
              />
            ),
          }}
        />
      </Tabs>
      <RequireAuthModal visible={modalVisible} onClose={closeGate} />
    </TrophyProvider>
  );
};

const styles = StyleSheet.create({
  badgeWrap: { position: "relative" },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: "#FF4D4F",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  badgeDotSettings: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: "#FF4D4F",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});

export default TabsLayout;
