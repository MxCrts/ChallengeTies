import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import BackButton from "./BackButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CustomHeaderProps {
  title: string;
  showBackButton?: boolean;
  rightIcon?: React.ReactNode;   // peut être string, number, élément, etc.
  showHairline?: boolean;

  // Options UI
  containerStyle?: ViewStyle;
  titleColor?: string;
  backgroundColor?: string;
  useBlur?: boolean;
  blurIntensity?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = Math.min(Math.max(SCREEN_WIDTH / 375, 0.8), 1.6);
  return Math.round(size * scale);
};

// Rend en toute sécurité le contenu "rightIcon" : string/number -> <Text>, élément -> tel quel, sinon placeholder
function SafeRightContent({
  node,
  placeholderSize = 24,
}: {
  node: React.ReactNode | React.ReactNode[];
  placeholderSize?: number;
}) {
  if (Array.isArray(node)) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {node.map((child, idx) => {
          if (typeof child === "string" || typeof child === "number") {
            return (
              <Text
                key={idx}
                style={{ fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(14) }}
              >
                {String(child)}
              </Text>
            );
          }
          return React.isValidElement(child) ? (
            React.cloneElement(child, { key: idx })
          ) : (
            <View key={idx} />
          );
        })}
      </View>
    );
  }
  if (typeof node === "string" || typeof node === "number") {
    return (
      <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(14) }}>
        {String(node)}
      </Text>
    );
  }
  if (React.isValidElement(node)) {
    return node;
  }
  // null/undefined/booleans etc. => placeholder pour garder la mise en page stable
  return <View style={{ width: normalizeSize(placeholderSize), height: normalizeSize(placeholderSize) }} />;
}

export default function CustomHeader({
  title,
  showBackButton = true,
  rightIcon,
  containerStyle,
  titleColor,
  showHairline = true,
  backgroundColor,
  useBlur = false,
  blurIntensity = 30,
}: CustomHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const resolvedTitleColor = titleColor ?? (isDarkMode ? currentTheme.colors.textPrimary : "#000000");

  const isLong = (title ?? "").length > 25;
  const fontSize = normalizeSize(isLong ? 17 : 20);
  const lineHeight = normalizeSize(isLong ? 22 : 26);

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: backgroundColor ?? "transparent",
          paddingTop:
            Platform.OS === "android"
              ? (StatusBar.currentHeight ?? SPACING)
              : insets.top + Math.round(SPACING * 0.5),
        },
        containerStyle,
      ]}
    >
      {useBlur && (
        <BlurView
          intensity={blurIntensity}
          tint={isDarkMode ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {showHairline && (
        <View
          pointerEvents="none"
          style={[
            styles.hairline,
            { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
          ]}
        />
      )}

      {/* LEFT */}
      <View style={styles.sideWrapper}>
        {showBackButton ? (
          <View
            style={[
              styles.backHalo,
              {
                backgroundColor: "transparent",
                borderColor: "transparent",
                marginTop: Platform.OS === "ios" ? 12 : 0, // ⬅️ décale franchement vers le bas sur iOS
                alignSelf: "flex-start",
              },
            ]}
          >
            <BackButton
              color={currentTheme.colors.secondary}
              size={24}
              accessibilityLabel="Retour"
              accessibilityHint="Revenir à l'écran précédent"
              hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
            />
          </View>
        ) : (
          <View style={{ width: normalizeSize(24), height: normalizeSize(24) }} />
        )}
      </View>

      {/* TITLE */}
      <View style={styles.titleWrapper}>
        <Text
          style={[
            styles.title,
            {
              color: resolvedTitleColor,
              fontSize,
              lineHeight,
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {String(title ?? "")}
        </Text>
      </View>

      {/* RIGHT */}
      <View style={styles.sideWrapper}>
        <SafeRightContent node={rightIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING,
    marginBottom: normalizeSize(10),
    width: "100%",
    overflow: "visible",
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  sideWrapper: {
    minWidth: normalizeSize(56),
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: normalizeSize(2),
  },
  titleWrapper: {
    flex: 1,
    paddingHorizontal: normalizeSize(8),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  backHalo: {
    padding: normalizeSize(6),
    borderRadius: normalizeSize(14),
    borderWidth: 0,
    backgroundColor: "transparent",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
