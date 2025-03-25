import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PaperProvider } from "react-native-paper";
import { auth } from "../constants/firebase-config";
import { onAuthStateChanged, User } from "firebase/auth";
import { ProfileUpdateProvider } from "../context/ProfileUpdateContext";
import { TrophyProvider } from "../context/TrophyContext";
import { SavedChallengesProvider } from "../context/SavedChallengesContext";
import { CurrentChallengesProvider } from "../context/CurrentChallengesContext";
import { ChatProvider } from "../context/ChatContext";
import TrophyModal from "../components/TrophyModal";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import { LanguageProvider } from "../context/LanguageContext";

// L'appel à setShouldThrowOnError a été retiré car il n'existe plus.

const RootLayout = () => {
  const router = useRouter();
  const [isAppReady, setIsAppReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem(
          "hasSeenOnboarding"
        );
        if (!hasSeenOnboarding) {
          router.replace("/screen/onboarding/Screen1");
        }
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
      } finally {
        setIsAppReady(true);
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (authChecked && isAppReady && !navigationReady && fontsLoaded) {
      setNavigationReady(true);
    }
  }, [authChecked, isAppReady, navigationReady, fontsLoaded]);

  useEffect(() => {
    if (navigationReady) {
      if (!user) {
        router.replace("/login");
      }
    }
  }, [navigationReady, user]);

  if (!navigationReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <LanguageProvider>
          <ProfileUpdateProvider>
            <TrophyProvider>
              <SavedChallengesProvider>
                <CurrentChallengesProvider>
                  <ChatProvider>
                    <>
                      <Stack screenOptions={{ headerShown: false }} />
                      <TrophyModal />
                    </>
                  </ChatProvider>
                </CurrentChallengesProvider>
              </SavedChallengesProvider>
            </TrophyProvider>
          </ProfileUpdateProvider>
        </LanguageProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;

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
