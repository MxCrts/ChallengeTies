// components/LoadingOverlay.tsx
import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";

type Props = {
  visible: boolean;
  label?: string;
  color?: string;
};

const LoadingOverlay: React.FC<Props> = ({ visible, label, color }) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color={color || "#fbbf24"} />
        {label ? <Text style={styles.text}>{label}</Text> : null}
      </View>
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
    zIndex: 999,
  },
  box: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.98)",
    alignItems: "center",
    minWidth: 180,
  },
  text: {
    marginTop: 8,
    color: "#e5e7eb",
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
});
