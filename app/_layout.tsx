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
import config from "../config"; // Import the config file

export default function RootLayout() {
  const { user, initializing } = useAuthInit();
  const router = useRouter();
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsAppReady(true); // App is considered ready after the splash screen
    }, 3000);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (!isAppReady || initializing) return;

    // Redirect logic based on development mode or user state
    if (config.DEVELOPMENT_MODE) {
      router.replace("/login"); // Always show the login page in development
    } else if (!user) {
      router.replace("/login"); // For non-authenticated users
    } else {
      router.replace("/"); // Navigate to the home page for authenticated users
    }
  }, [isAppReady, initializing, user]);

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
