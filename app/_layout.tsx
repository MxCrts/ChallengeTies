import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { PaperProvider } from "react-native-paper";
import { auth } from "../constants/firebase-config";
import { ProfileUpdateProvider } from "../context/ProfileUpdateContext";
import { TrophyProvider } from "../context/TrophyContext";
import { SavedChallengesProvider } from "../context/SavedChallengesContext";
import { CurrentChallengesProvider } from "../context/CurrentChallengesContext";
import { ChatProvider } from "../context/ChatContext";
import { ThemeProvider } from "../context/ThemeContext";
import TrophyModal from "../components/TrophyModal";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import { LanguageProvider } from "../context/LanguageContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });

  // Afficher un écran de chargement si les fonts ne sont pas encore chargés
  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Chargement des polices...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  console.log("🔧 RootLayout rendu");

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PaperProvider>
          <LanguageProvider>
            <ProfileUpdateProvider>
              <TrophyProvider>
                <SavedChallengesProvider>
                  <CurrentChallengesProvider>
                    <ChatProvider>
                      <>
                        <Stack screenOptions={{ headerShown: false }} />
                        <TrophyModal challengeId="" selectedDays={0} />
                      </>
                    </ChatProvider>
                  </CurrentChallengesProvider>
                </SavedChallengesProvider>
              </TrophyProvider>
            </ProfileUpdateProvider>
          </LanguageProvider>
        </PaperProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
  },
});
