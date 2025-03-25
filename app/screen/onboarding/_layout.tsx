// app/screen/onboarding/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import OnboardingMusicProvider from "../../../components/OnboardingMusicProvider"; // Vérifiez le chemin

export default function OnboardingLayout() {
  return (
    <OnboardingMusicProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Screen1" />
        <Stack.Screen name="Screen2" />
        <Stack.Screen name="Screen3" />
        <Stack.Screen name="Screen4" />
        <Stack.Screen name="Screen5" />
        <Stack.Screen name="Screen6" />
        <Stack.Screen name="Screen7" />
        <Stack.Screen name="Screen8" />
      </Stack>
    </OnboardingMusicProvider>
  );
}
