import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import BackButton from "./BackButton";

interface CustomHeaderProps {
  title: string;
  showBackButton?: boolean;
  rightIcon?: React.ReactNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function CustomHeader({
  title,
  showBackButton = true,
  rightIcon,
}: CustomHeaderProps) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  return (
    <View
      style={[
        styles.headerContainer,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <View style={styles.sideWrapper}>
        {showBackButton && (
          <BackButton
            color={currentTheme.colors.secondary}
            size={24}
            accessibilityLabel="Retour"
            accessibilityHint="Revenir à l'écran précédent"
          />
        )}
      </View>

      <View style={styles.titleWrapper}>
  <Text
    style={[
      styles.title,
      {
        color: isDarkMode ? "#FFFFFF" : "#000000",
        fontSize: normalizeSize(title.length > 25 ? 17 : 20),
        lineHeight: normalizeSize(title.length > 25 ? 22 : 26),
      },
    ]}
    numberOfLines={2}
    adjustsFontSizeToFit
  >
    {title}
  </Text>
</View>

      <View style={styles.sideWrapper}>
        {rightIcon || <View style={{ width: normalizeSize(24) }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    paddingHorizontal: SPACING,
    marginBottom: normalizeSize(10),
    width: "100%",
  },
  sideWrapper: {
  width: normalizeSize(44), // au lieu de 40
  alignItems: "center",
  justifyContent: "center",
},
  titleWrapper: {
    flex: 1,
    paddingHorizontal: normalizeSize(8),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    lineHeight: normalizeSize(24),
  },
});
