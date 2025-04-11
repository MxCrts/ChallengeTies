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
        <Text style={styles.header}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", // Place la flèche et le titre sur la même ligne
    alignItems: "center", // Centre verticalement la flèche par rapport au titre
    paddingHorizontal: 16, // Garde l'espacement horizontal
  },
  titleContainer: {
    flex: 1, // Permet au titre de prendre l'espace disponible
    marginVertical: 20, // Marge verticale autour du titre
    marginBottom: 30, // Marge supplémentaire en bas
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    textAlign: "center", // Centre le texte horizontalement
  },
});
