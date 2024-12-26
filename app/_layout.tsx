import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SavedChallengesProvider } from "../context/SavedChallengesContext";
import { CurrentChallengesProvider } from "../context/CurrentChallengesContext";
import { ChatProvider } from "../context/ChatContext"; // Import ChatProvider
import { useAuthInit } from "../context/useAuthInit";
import { ThemeProvider } from "../context/ThemeContext"; // Import ThemeProvider
import SplashScreen from "../components/SplashScreen";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";

export default function RootLayout() {
  const { user, initializing } = useAuthInit();
  const [isAppReady, setIsAppReady] = useState(false); // Splash screen control

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsAppReady(true); // App is considered ready after the splash screen
    }, 3000);

    return () => clearTimeout(splashTimer);
  }, []);

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

  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.authMessageContainer}>
          <Text style={styles.authMessageText}>
            Unable to authenticate. Please restart the app.
          </Text>
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
  authMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  authMessageText: {
    marginTop: 10,
    fontSize: 16,
    color: "#ff0000",
    textAlign: "center",
  },
});
