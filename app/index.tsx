// app/index.tsx
import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";

export default function Index() {
  // ✅ Cette route sert de “buffer” pour éviter l’écran blanc
  // pendant que _layout.tsx (AppNavigator / flags / hydration) décide.
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" />
      <Text style={styles.txt}>Préparation…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  txt: { fontSize: 12, opacity: 0.7 },
});
