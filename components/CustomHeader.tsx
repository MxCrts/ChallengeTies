import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import BackButton from "../components/BackButton";

interface CustomHeaderProps {
  title: string;
}

export default function CustomHeader({ title }: CustomHeaderProps) {
  const { theme } = useTheme();
  const currentTheme =
    theme === "light" ? designSystem.lightTheme : designSystem.darkTheme;

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text
          style={[
            styles.header,
            {
              color:
                theme === "light"
                  ? "#000000" // noir en light
                  : currentTheme.colors.textPrimary, // gold en dark
            },
          ]}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  titleContainer: {
    flex: 1,
    marginVertical: 20,
    marginBottom: 30,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
});
