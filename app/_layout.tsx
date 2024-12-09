import React from "react";
import { Stack } from "expo-router";
import { SavedChallengesProvider } from "../context/SavedChallengesContext"; // Adjust path if necessary

export default function RootLayout() {
  return (
    <SavedChallengesProvider>
      <Stack
        screenOptions={{
          headerShown: false, // Hides the global header
        }}
      />
    </SavedChallengesProvider>
  );
}
