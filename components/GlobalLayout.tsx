import React from "react";
import { StyleSheet } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../context/ThemeContext";
import { lightTheme, darkTheme } from "../theme/designSystem";

interface GlobalLayoutProps {
  children: React.ReactNode;
}

export default function GlobalLayout({ children }: GlobalLayoutProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const currentTheme = theme === "light" ? lightTheme : darkTheme;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: currentTheme.colors.background,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar
        hidden={false}
        backgroundColor={currentTheme.colors.background}
        style={theme === "light" ? "dark" : "light"}
      />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Le padding horizontal et vertical pourra être ajouté dans le design system ou au niveau des composants.
  },
});
