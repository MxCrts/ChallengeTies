import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  Linking,
} from "react-native";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasCompletedTutorial = await AsyncStorage.getItem(
        "hasCompletedTutorialAfterSignup"
      );
      const isFirst = !hasCompletedTutorial;
      setIsFirstLaunch(isFirst);
      console.log(
        "isFirstLaunch:",
        isFirst,
        "hasCompletedTutorial:",
        hasCompletedTutorial
      );
    };
    checkFirstLaunch();
  }, []);

  useEffect(() => {
    mobileAds()
      .initialize()
      .then((status) => {
        console.log("AdMob initialized:", status);
      });
  }, []);

  // Gestion des deep links
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log("📲 Deep link reçu:", url);
      let challengeId, inviteId;
      if (
        url.startsWith("myapp://challenge/") ||
        url.startsWith("https://challengeme-d7fef.web.app/challenge/")
      ) {
        const parsedUrl = new URL(url);
        challengeId = parsedUrl.pathname.split("/challenge/")[1]?.split("?")[0];
        inviteId = parsedUrl.searchParams.get("invite");
      }
      if (challengeId && inviteId) {
        console.log("🚀 Navigation vers profile/notifications:", {
          challengeId,
          inviteId,
        });
        router.push({
          pathname: "profile/notifications",
          params: { challengeId, invite: inviteId },
        });
      } else {
        console.log("⚠️ Paramètres manquants:", { challengeId, inviteId });
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Ajouter l'écouteur et stocker l'abonnement

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
                        <TutorialProvider isFirstLaunch={isFirstLaunch}>
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              animation: "fade",
                              animationDuration: 400,
                            }}
                          >
                            <Stack.Screen name="index" />
                            <Stack.Screen name="profile" />
                            <Stack.Screen name="focus" />
                            <Stack.Screen name="explore" />
                            <Stack.Screen name="onboarding" />
                            <Stack.Screen name="handleInvite" />
                            <Stack.Screen name="profile/Notifications" />
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
