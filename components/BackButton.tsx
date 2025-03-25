import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface BackButtonProps {
  color?: string;
  size?: number;
  style?: object;
}

const BackButton: React.FC<BackButtonProps> = ({
  color = "#000000",
  size = 28,
  style = {},
}) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={() => router.back()}
    >
      <Ionicons name="arrow-back-outline" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 8,
  },
});

export default BackButton;
