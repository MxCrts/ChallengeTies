// components/DebugHUD.tsx
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

export default function DebugHUD({ data }: { data: Record<string, any> }) {

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {Object.entries(data).map(([k, v]) => (
        <Text key={k} style={styles.row} numberOfLines={1}>
          {k}: {String(v)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 10,
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 999999,
  },
  row: { color: "white", fontSize: 12, marginBottom: 2 },
});
