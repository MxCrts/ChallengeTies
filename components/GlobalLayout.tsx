// GlobalLayout.tsx
import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
      // ✅ IMPORTANT: on enlève le TOP ici, car le header le gère déjà via insets.top
      edges={["left", "right", "bottom"]}
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
  },
});
