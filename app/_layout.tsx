// app/_layout.tsx
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, usePathname } from "expo-router";
import { StyleSheet, AppState } from "react-native";
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
import { useAuth } from "../context/AuthProvider";
import { AuthProvider } from "../context/AuthProvider";
import * as SplashScreen from "expo-splash-screen";
import { FeatureFlagsProvider, useFlags } from "../src/constants/featureFlags";
import * as Linking from "expo-linking";
import { AdsVisibilityProvider } from "../src/context/AdsVisibilityContext";
import mobileAds from "react-native-google-mobile-ads";
import {
  ensureAndroidChannelAsync,
  scheduleDailyNotifications,
} from "@/services/notificationService";
import * as TrackingTransparency from "expo-tracking-transparency";
import { Platform } from "react-native";
import {
  RequestConfiguration,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";
import { VisitorProvider } from "@/context/VisitorContext";
import { useVisitor } from "@/context/VisitorContext";


// =========================
// AppNavigator : redirection initiale + Splash
// =========================
const AppNavigator: React.FC = () => {
const { user, loading, checkingAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isGuest, hydrated } = useVisitor();

  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });

  useEffect(() => {
    // ⛔️ tant que Auth/Fonts/Visitor pas prêts → ne route pas
if (loading || checkingAuth || !fontsLoaded || !hydrated) return;
    if (pathname !== "/") {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

  if (user) {
      router.replace("/(tabs)");
    } else if (isGuest) {
  router.replace("/(tabs)"); // Home (tabs) en visiteur
    } else {
      router.replace("/login");
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [user, loading, pathname, router, isGuest, fontsLoaded, hydrated]);


  // Laisse le Splash tant que auth ou fonts ne sont pas prêtes
if (loading || checkingAuth || !fontsLoaded || !hydrated) return null;
  return null;
};

// =========================
// FlagsGate : bloque le rendu tant que les flags ne sont pas prêts
// =========================
const FlagsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady } = useFlags();
  if (!isReady) return null; // Splash toujours visible
  return <>{children}</>;
};

// =========================
// ConsentGate: ATT -> init Ads accordingly
// =========================
const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        let trackingGranted = true;

        if (Platform.OS === "ios") {
          const { status: current } = await TrackingTransparency.getTrackingPermissionsAsync();
          let s = current;
          if (current === "undetermined") {
            const { status: asked } = await TrackingTransparency.requestTrackingPermissionsAsync();
            s = asked;
          }
          trackingGranted = s === "granted";
        }

        // Flag global pour les requêtes d’annonces
        (globalThis as any).__NPA__ = trackingGranted ? false : true;

        const requestConfig: RequestConfiguration = {
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          maxAdContentRating: MaxAdContentRating.PG,
        };
        await mobileAds().setRequestConfiguration(requestConfig);
        await mobileAds().initialize();
      } finally {
        setReady(true);
      }
    };
    run();
  }, []);

  if (!ready) return null; // Splash reste visible
  return <>{children}</>;
};



// =========================
// DeepLinkManager : actif seulement si enableDeepLinks = true
// =========================
const DeepLinkManager: React.FC = () => {
  const router = useRouter();
  const { flags } = useFlags();

  useEffect(() => {
    if (!flags.enableDeepLinks) return;

    const handleDeepLink = ({ url }: { url: string }) => {
      let challengeId: string | undefined;
      let inviteId: string | null | undefined;

      if (
        url.startsWith("myapp://challenge/") ||
        url.startsWith("https://challengeme-d7fef.web.app/challenge/")
      ) {
        const parsedUrl = new URL(url);
        challengeId = parsedUrl.pathname.split("/challenge/")[1]?.split("?")[0];
        inviteId = parsedUrl.searchParams.get("invite");
      }

      if (challengeId && inviteId) {
        router.push({
          pathname: "profile/notifications",
          params: { challengeId, invite: inviteId },
        });
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink({ url });
      })
      .catch(() => {});

    return () => {
      subscription.remove();
    };
  }, [router, flags.enableDeepLinks]);

  return null;
};

const NotificationsBootstrap: React.FC = () => {
  const { user } = useAuth();

  // Canal Android dès que possible (safe no-op iOS)
  useEffect(() => {
  if (Platform.OS === "android") {
    ensureAndroidChannelAsync().catch(() => {});
  }
}, []);

  // À la connexion, NE DEMANDE PAS — juste (re)planifie proprement
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (Platform.OS === "android") {
  await ensureAndroidChannelAsync();
}
// scheduleDailyNotifications() ne pop pas (lit l'état existant)
await scheduleDailyNotifications();

    })();
  }, [user]);

  // Replanifie quand l'app redevient active (fus. horaire/DST)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user) {
        scheduleDailyNotifications().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [user]);

  return null;
};


// =========================
// RootLayout
// =========================
export default function RootLayout() {
  // On garde le Splash jusqu’à masquage explicite
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

 return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <FeatureFlagsProvider>
      <FlagsGate>
        <AuthProvider>
          <AdsVisibilityProvider>
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
                                <VisitorProvider>
                                  {/* GATE consent -> rien d'init avant */}
                                  <ConsentGate>
                                    <DeepLinkManager />
                                    {/* <AdsManager />  <-- removed */}
                                    <NotificationsBootstrap />

                                    <Stack
                                      screenOptions={{
                                        headerShown: false,
                                        animation: "fade",
                                        animationDuration: 400,
                                      }}
                                    >
                                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                      <Stack.Screen name="login" />
                                      <Stack.Screen name="register" />
                                      <Stack.Screen name="forgot-password" />
                                      <Stack.Screen name="profile/notifications" />
                                      <Stack.Screen name="handleInvite" />
                                    </Stack>

                                    <AppNavigator />
                                    <TrophyModal challengeId="" selectedDays={0} />
                                  </ConsentGate>
                                </VisitorProvider>
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
          </AdsVisibilityProvider>
        </AuthProvider>
      </FlagsGate>
    </FeatureFlagsProvider>
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
