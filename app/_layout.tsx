import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { ProfileUpdateProvider } from "../context/ProfileUpdateContext";
import { TrophyProvider } from "../context/TrophyContext";
import { SavedChallengesProvider } from "../context/SavedChallengesContext";
import { CurrentChallengesProvider } from "../context/CurrentChallengesContext";
import { ChatProvider } from "../context/ChatContext";
import { ThemeProvider } from "../context/ThemeContext";
import { LanguageProvider } from "../context/LanguageContext";
import { TutorialProvider } from "../context/TutorialContext";
import TrophyModal from "../components/TrophyModal";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import mobileAds from "react-native-google-mobile-ads";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });

  // Initialisation AdMob
  useEffect(() => {
    mobileAds()
      .initialize()
      .then((status) => {
        console.log("AdMob initialized:", status);
      });
  }, []);

  // Pendant le chargement des polices
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <PaperProvider>
              <ProfileUpdateProvider>
                <TrophyProvider>
                  <SavedChallengesProvider>
                    <CurrentChallengesProvider>
                      <ChatProvider>
                        <TutorialProvider isFirstLaunch={false}>
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="index" />
                            <Stack.Screen name="profile" />
                            <Stack.Screen name="focus" />
                            <Stack.Screen name="explore" />
                            <Stack.Screen name="onboarding" />{" "}
                          </Stack>
                          <TrophyModal challengeId="" selectedDays={0} />
                        </TutorialProvider>
                      </ChatProvider>
                    </CurrentChallengesProvider>
                  </SavedChallengesProvider>
                </TrophyProvider>
              </ProfileUpdateProvider>
            </PaperProvider>
          </ThemeProvider>
        </I18nextProvider>
      </LanguageProvider>
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
