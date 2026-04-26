import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  Text,
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
import { useAuth } from "../../context/AuthProvider";

/* ─── Responsive ─────────────────────────────────────── */
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const scale = clamp(SCREEN_WIDTH / 375, 0.7, 1.8);
  return Math.round(size * scale);
};
const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const short = Math.min(width, height);
  const isTablet = Math.max(width, height) >= 900 && Math.max(width, height) / short < 1.6;
  const scale = clamp(short / 375, 0.85, 1.25);
  const n = (s: number) => Math.round(s * scale);
  return { width, height, isTablet, n, scale };
};

type IconName = "home" | "person" | "scroll" | "compass" | "settings";

/* ─── Icône animée standard ──────────────────────────── */
const AnimatedTabIcon = ({
  name, focused, color, size, reduceMotion,
}: {
  name: IconName; focused: boolean; color: string; size: number; reduceMotion: boolean;
}) => {
  const rotation = useSharedValue(0);
  const scale    = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) { rotation.value = 0; scale.value = 1; return; }
    if (focused) {
      scale.value = withSpring(1.14, { damping: 12, stiffness: 150 });
      if (name === "compass")  rotation.value = withTiming(360, { duration: 900, easing: Easing.inOut(Easing.ease) });
      else if (name === "settings") rotation.value = withTiming(90, { duration: 450, easing: Easing.out(Easing.ease) });
      else rotation.value = 0;
    } else {
      rotation.value = withTiming(0, { duration: 250 });
      scale.value    = withSpring(1, { damping: 16, stiffness: 180 });
    }
  }, [focused, name, reduceMotion]);

  const rotateStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const scaleStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={scaleStyle}>
      <Animated.View style={rotateStyle}>
        <Ionicons
          name={(focused ? name : `${name}-outline`) as any}
          size={size} color={color}
        />
      </Animated.View>
    </Animated.View>
  );
};

/* ─── Wrapper pill pour icônes avec indicateur actif ─── */
const PillIcon = ({
  name, focused, activeColor, inactiveColor, size, reduceMotion, isDarkMode,
}: {
  name: IconName; focused: boolean;
  activeColor: string; inactiveColor: string;
  size: number; reduceMotion: boolean; isDarkMode: boolean;
}) => {
  const bgScale   = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      bgScale.value   = withSpring(1, { damping: 14, stiffness: 160 });
      bgOpacity.value = withTiming(1, { duration: 180 });
    } else {
      bgScale.value   = withSpring(0.7, { damping: 18, stiffness: 200 });
      bgOpacity.value = withTiming(0, { duration: 160 });
    }
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
    opacity: bgOpacity.value,
  }));

  return (
    <View style={styles.pillWrap}>
      {/* Pill fond actif */}
      <Animated.View style={[styles.pillBg, pillStyle, {
        backgroundColor: isDarkMode
          ? "rgba(249,115,22,0.18)"
          : "rgba(249,115,22,0.12)",
      }]} />
      <AnimatedTabIcon
        name={name} focused={focused}
        color={focused ? activeColor : inactiveColor}
        size={size} reduceMotion={reduceMotion}
      />
    </View>
  );
};

/* ─── Bouton flamme central ──────────────────────────── */
const FlameButton = ({
  focused, theme, isDarkMode, diameter, reduceMotion,
}: {
  focused: boolean; theme: Theme; isDarkMode: boolean; diameter: number; reduceMotion?: boolean;
}) => {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) { scale.value = 1; return; }
    if (focused) {
      scale.value = withSpring(1.12, { damping: 10, stiffness: 100 });
      glow.value  = withTiming(1, { duration: 300 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      glow.value  = withTiming(0, { duration: 200 });
    }
  }, [focused, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.55 }));

  const iconSize = Math.round(diameter * 0.46);
  const lift     = -(diameter * 0.38);

  return (
    <Animated.View style={[{ marginTop: lift }, animStyle]}>
      {/* Shadow glow orange */}
      <Animated.View pointerEvents="none" style={[styles.flameGlow, glowStyle, {
        width: diameter + 20, height: diameter + 20,
        borderRadius: (diameter + 20) / 2,
        marginLeft: -10, marginTop: -10,
      }]} />

      {/* Ring externe */}
      <View style={[styles.flameRing, {
        width: diameter + 8, height: diameter + 8,
        borderRadius: (diameter + 8) / 2,
        marginLeft: -4, marginTop: -4,
        borderColor: focused
          ? "rgba(249,115,22,0.45)"
          : isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      }]} />

      <LinearGradient
        colors={focused
          ? ["#F97316", "#EA6C0A"]
          : isDarkMode
          ? ["#1E293B", "#0F172A"]
          : ["#FFF3E0", "#FFE1C2"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          width: diameter, height: diameter,
          borderRadius: diameter / 2,
          alignItems: "center", justifyContent: "center",
          borderWidth: focused ? 0 : 1.5,
          borderColor: focused ? "transparent" : isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)",
        }}
      >
        {/* Shine top */}
        <LinearGradient
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.00)"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: diameter / 2 }]}
          pointerEvents="none"
        />
        <Ionicons
          name="journal"
          size={iconSize}
          color={focused ? "#FFFFFF" : isDarkMode ? "#94A3B8" : "#F97316"}
        />
      </LinearGradient>
    </Animated.View>
  );
};

/* ─── Layout principal ───────────────────────────────── */
const TabsLayout = () => {
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, reduceMotion = false } = useTheme() as { theme: "dark"|"light"; reduceMotion?: boolean };
  const isDarkMode    = theme === "dark";
  const currentTheme  = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const { isTablet, n, width } = useResponsive();

  const [hasUnclaimed, setHasUnclaimed] = useState(false);
  const { isTutorialActive } = useTutorial();
  const { gate, modalVisible, closeGate } = useGateForGuest();
  const { isGuest }  = useVisitor();
  const { claimable } = useReferralStatus();
  const iconSize = isTablet ? n(28) : n(26);
  const flameDiameter = isTablet ? n(66) : n(60);

  // Couleurs
  const activeColor   = "#F97316";
  const inactiveColor = isDarkMode ? "rgba(226,232,240,0.75)" : "rgba(30,41,59,0.65)";


  useEffect(() => {
    if (isGuest) { setHasUnclaimed(false); return; }
    const uid = user?.uid;
    if (!uid) { setHasUnclaimed(false); return; }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) { setHasUnclaimed(false); return; }
      const data = snap.data() as any;
      const pending = Array.isArray(data?.newAchievements) ? data.newAchievements : [];
      setHasUnclaimed(pending.length > 0);
    });
    return () => unsub();
  }, [user?.uid, isGuest]);

  // Fond tab bar
  const tabBarBackground = useMemo(() => (
    <View style={{ flex: 1 }}>
      <BlurView
        tint={isDarkMode ? "dark" : "light"}
        intensity={Platform.OS === "ios" ? 40 : 28}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={isDarkMode
          ? ["rgba(15,23,42,0.96)", "rgba(2,6,23,0.98)"]
          : ["rgba(255,255,255,0.97)", "rgba(255,247,237,0.96)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ligne top avec accent orange */}
      <LinearGradient
        colors={["rgba(249,115,22,0.00)", "rgba(249,115,22,0.45)", "rgba(249,115,22,0.00)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 1,
        }}
      />
    </View>
  ), [isDarkMode]);

  const barHeight = (isTablet ? n(70) : n(58)) + Math.max(insets.bottom, n(10));
  const padBottom = Math.max(insets.bottom, n(8));

  const tabBarStyleBase = useMemo(() => ({
    position: "absolute" as const,
    left: 0, right: 0, bottom: 0,
    height: barHeight,
    paddingBottom: padBottom,
    paddingTop: n(6),
    borderTopWidth: 0,
    borderTopLeftRadius: n(22),
    borderTopRightRadius: n(22),
    backgroundColor: "transparent",
    overflow: "visible" as const,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -8 } },
      android: { elevation: 24 },
      default: {},
    }),
  }), [barHeight, padBottom, n]);

  const tabBarStyleHidden = useMemo(() => ({
    ...tabBarStyleBase,
    bottom: -barHeight, height: 0, paddingTop: 0, paddingBottom: 0, opacity: 0,
    pointerEvents: "none" as const,
  }), [barHeight, tabBarStyleBase]);

  const tabBarItemStyleHidden: any = useMemo(() => ({
    height: 0, paddingVertical: 0, margin: 0,
  }), []);

  const labelStyle = useMemo(() => ({
    fontSize: n(10.5),
    fontFamily: "Comfortaa_700Bold",
    lineHeight: n(13),
    marginTop: 1,
    textAlign: "center" as const,
  }), [n]);

  return (
    <TrophyProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: false,
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: inactiveColor,
          tabBarLabelStyle: labelStyle,
          overflow: "visible",
          tabBarItemStyle: isTutorialActive
  ? tabBarItemStyleHidden
  : { paddingVertical: n(8) },
          tabBarStyle: isTutorialActive ? tabBarStyleHidden : tabBarStyleBase,
          tabBarBackground: isTutorialActive ? undefined : () => tabBarBackground,
          tabBarButton: (props) => (
            <Pressable
              disabled={isTutorialActive}
              android_ripple={{ color: isDarkMode ? "#ffffff15" : "#00000008", borderless: false }}
              {...props}
            />
          ),
        }}
      >

        {/* ── Accueil ─────────────────────────────────────── */}
        <Tabs.Screen
          name="index"
          options={{
            tabBarTestID: "tab-home",
            tabBarLabel: t("homeX"),
            tabBarAccessibilityLabel: t("homeX"),
            tabBarIcon: ({ focused }) => (
              <PillIcon
                name="home" focused={focused}
                activeColor={activeColor} inactiveColor={inactiveColor}
                size={iconSize} reduceMotion={!!reduceMotion} isDarkMode={isDarkMode}
              />
            ),
          }}
        />

        {/* ── Profil ──────────────────────────────────────── */}
        <Tabs.Screen
          name="profile"
          options={{
            tabBarTestID: "tab-profile",
            tabBarLabel: t("profile"),
            tabBarAccessibilityLabel: t("profile"),
            tabBarIcon: ({ focused }) => (
  <View style={styles.badgeWrap}>
    <PillIcon
      name="person"
      focused={focused}
      activeColor={activeColor}
      inactiveColor={inactiveColor}
      size={iconSize}
      reduceMotion={!!reduceMotion}
      isDarkMode={isDarkMode}
    />
    {hasUnclaimed && <View style={styles.badgeDot} />}
  </View>
),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/profile") && props.onPress?.()}
                android_ripple={{ color: isDarkMode ? "#ffffff15" : "#00000008", borderless: false }}
              />
            ),
          }}
        />

        {/* ── Focus / Flamme central ───────────────────────── */}
        <Tabs.Screen
          name="focus"
          options={{
            tabBarLabel: "",
            tabBarTestID: "tab-focus",
            tabBarAccessibilityLabel: t("exploits", { defaultValue: "Exploits" }),
            tabBarIcon: ({ focused }) => (
  <FlameButton
    focused={focused}
    theme={currentTheme}
    isDarkMode={isDarkMode}
    diameter={flameDiameter}
    reduceMotion={!!reduceMotion}
  />
),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/focus") && props.onPress?.()}
                android_ripple={{ color: isDarkMode ? "#ffffff15" : "#00000008", borderless: false }}
              />
            ),
          }}
        />

        {/* ── Explorer ────────────────────────────────────── */}
        <Tabs.Screen
          name="explore"
          options={{
            tabBarTestID: "tab-explore",
            tabBarLabel: t("explore"),
            tabBarAccessibilityLabel: t("explore"),
            tabBarIcon: ({ focused }) => (
              <PillIcon
                name="compass" focused={focused}
                activeColor={activeColor} inactiveColor={inactiveColor}
                size={iconSize} reduceMotion={!!reduceMotion} isDarkMode={isDarkMode}
              />
            ),
          }}
        />

        {/* ── Paramètres ──────────────────────────────────── */}
        <Tabs.Screen
          name="Settings"
          options={{
            tabBarTestID: "tab-settings",
            tabBarLabel: t("settings"),
            tabBarAccessibilityLabel: t("settings"),
            tabBarIcon: ({ focused }) => (
              <View style={styles.badgeWrap}>
                <PillIcon
                  name="settings" focused={focused}
                  activeColor={activeColor} inactiveColor={inactiveColor}
                  size={iconSize} reduceMotion={!!reduceMotion} isDarkMode={isDarkMode}
                />
                {claimable.length > 0 && <View style={styles.badgeDotSettings} />}
              </View>
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={() => gate("/(tabs)/Settings") && props.onPress?.()}
                android_ripple={{ color: isDarkMode ? "#ffffff15" : "#00000008", borderless: false }}
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
  // Pill icône active
  pillWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pillBg: {
  position: "absolute",
  width: normalizeSize(46),
  height: normalizeSize(30),
  borderRadius: normalizeSize(15),
},

  // Flamme
  flameGlow: {
    position: "absolute",
    backgroundColor: "#F97316",
  },
  flameRing: {
    position: "absolute",
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },

  // Badges
  badgeWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  badgeDot: {
    position: "absolute", top: -3, right: -7,
    backgroundColor: "#EF4444",
    width: normalizeSize(9), height: normalizeSize(9),
    borderRadius: normalizeSize(4.5),
    borderWidth: 1.5, borderColor: "#FFFFFF",
  },
  badgeDotSettings: {
    position: "absolute", top: -3, right: -7,
    backgroundColor: "#EF4444",
    width: normalizeSize(9), height: normalizeSize(9),
    borderRadius: normalizeSize(4.5),
    borderWidth: 1.5, borderColor: "#FFFFFF",
  },
});

export default TabsLayout;
