import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import { SavedChallengesProvider } from "../context/SavedChallengesContext";
import { CurrentChallengesProvider } from "../context/CurrentChallengesContext";
import { ChatProvider } from "../context/ChatContext";
import { useAuthInit } from "../context/useAuthInit";
import { ThemeProvider } from "../context/ThemeContext";
import SplashScreen from "../components/SplashScreen";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../config";
import { PaperProvider } from "react-native-paper"; // ✅ Import React Native Paper

export default function RootLayout() {
  const { user, initializing } = useAuthInit();
  const router = useRouter();
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const seen = await AsyncStorage.getItem("hasSeenOnboarding");
        setHasSeenOnboarding(seen === "true");

        setIsAppReady(true);
      } catch (error) {
        console.error("Error during initialization:", error);
        setIsAppReady(true);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const navigate = async () => {
      console.log("Navigation state:", {
        isAppReady,
        initializing,
        hasSeenOnboarding,
        user,
      });

      if (!isAppReady || initializing) return;

      if (!hasSeenOnboarding) {
        console.log("Redirecting to onboarding...");
        router.replace("/onboarding");
      } else if (!user || config.DEVELOPMENT_MODE) {
        console.log("Redirecting to login...");
        router.replace("/login");
      } else {
        console.log("Redirecting to tabs index...");
        router.replace("/(tabs)/index");
      }
    };

    navigate();
  }, [isAppReady, initializing, user, hasSeenOnboarding]);

  if (!isAppReady) {
    return <SplashScreen />;
  }

  if (initializing) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <ThemeProvider>
          <SavedChallengesProvider>
            <CurrentChallengesProvider>
              <ChatProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                />
              </ChatProvider>
            </CurrentChallengesProvider>
          </SavedChallengesProvider>
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#007bff",
    textAlign: "center",
  },
});
