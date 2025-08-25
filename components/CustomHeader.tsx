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

interface CustomHeaderProps {
  title: string;
  showBackButton?: boolean;
  rightIcon?: React.ReactNode;
  showHairline?: boolean;

  // Options UI (facultatives)
  containerStyle?: ViewStyle;   // override du wrapper
  titleColor?: string;          // couleur du titre
  backgroundColor?: string;     // fond (sinon transparent)
  useBlur?: boolean;            // active un blur premium
  blurIntensity?: number;       // 0-100 (default 30)
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = Math.min(Math.max(SCREEN_WIDTH / 375, 0.8), 1.6);
  return Math.round(size * scale);
};

export default function CustomHeader({
  title,
  showBackButton = true,
  rightIcon,
  containerStyle,
  titleColor,
  showHairline = true,
  backgroundColor, // si non fourni => transparent
  useBlur = false,
  blurIntensity = 30,
}: CustomHeaderProps) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Couleur du titre (noir en light comme demandé)
  const resolvedTitleColor =
    titleColor ?? (isDarkMode ? currentTheme.colors.textPrimary : "#000000");

  // Taille/lineHeight adaptatives selon longueur
  const isLong = title.length > 25;
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
              ? StatusBar.currentHeight ?? SPACING
              : SPACING,
        },
        containerStyle,
      ]}
    >
      {/* Blur premium en fond si demandé */}
      {useBlur && (
        <BlurView
          intensity={blurIntensity}
          tint={isDarkMode ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Hairline subtile */}
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
                backgroundColor: isDarkMode
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.06)",
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <BackButton
              color={currentTheme.colors.secondary}
              size={24}
              accessibilityLabel="Retour"
              accessibilityHint="Revenir à l'écran précédent"
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            />
          </View>
        ) : (
          // placeholder pour garder le titre centré
          <View
            style={{ width: normalizeSize(24), height: normalizeSize(24) }}
          />
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
          {title}
        </Text>
      </View>

      {/* RIGHT */}
      <View style={styles.sideWrapper}>
        {rightIcon ?? (
          <View
            style={{ width: normalizeSize(24), height: normalizeSize(24) }}
          />
        )}
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
    overflow: "visible", // évite le clipping du halo
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  sideWrapper: {
    minWidth: normalizeSize(56), // plus large pour le halo
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
    borderWidth: 0,                // pas de bord
    backgroundColor: "transparent",// pas de fond qui “bave”
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
