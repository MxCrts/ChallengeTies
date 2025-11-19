// app/_layout.tsx
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, usePathname } from "expo-router";
import { StyleSheet, AppState, Platform } from "react-native";
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
import mobileAds, {
  MaxAdContentRating,
  RequestConfiguration,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
} from "react-native-google-mobile-ads";
import { VisitorProvider } from "@/context/VisitorContext";
import { useVisitor } from "@/context/VisitorContext";
import { logEvent } from "../src/analytics"; 
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  checkAndGrantPioneerIfEligible,
  checkAndGrantAmbassadorRewards,
  checkAndGrantAmbassadorMilestones,
} from "@/src/referral/pioneerChecker";
import { bumpCounterAndMaybeReview } from "@/src/services/reviewService";
import * as Notifications from "expo-notifications";
import { useIncomingInvite } from "../hooks/useIncomingInvite";
import {
  startNotificationResponseListener,
  stopNotificationResponseListener,
  ensureAndroidChannelAsync,
  scheduleDailyNotifications,
} from "@/services/notificationService";
// en haut de app/_layout.tsx
import { ToastProvider, useToast } from "../src/ui/Toast";


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
  logEvent("app_open");
}, []);

useEffect(() => { bumpCounterAndMaybeReview("app_open", 7).catch(()=>{}); }, []);


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

 useEffect(() => {
  if (loading || checkingAuth || !fontsLoaded || !hydrated) return;
  if (!user) return;

  checkAndGrantPioneerIfEligible().catch(() => {});
  checkAndGrantAmbassadorRewards().catch(() => {});
  checkAndGrantAmbassadorMilestones().catch(() => {});
}, [user, loading, checkingAuth, fontsLoaded, hydrated]);


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
// ConsentGate : UMP (AdsConsent) + MobileAds
// =========================
const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("🧩 [ConsentGate] UMP via AdsConsent + MobileAds…");
        (globalThis as any).__ADS_READY__ = false;
        (globalThis as any).__NPA__ = true; // par défaut

        // 1) UMP: met à jour l’info de consentement
        await AdsConsent.requestInfoUpdate();

        // 2) Si un formulaire est nécessaire/disponible, l’afficher
        const info = await AdsConsent.getConsentInfo();
        console.log("[UMP] consentInfo:", info);

        // Montre le formulaire si requis
        if (
          info.isConsentFormAvailable &&
          (info.status === AdsConsentStatus.REQUIRED ||
            info.status === AdsConsentStatus.UNKNOWN)
        ) {
          await AdsConsent.loadAndShowConsentFormIfRequired();
        }

        // Re-lis l’état après affichage éventuel
        const consentInfo = await AdsConsent.getConsentInfo();
        const canRequestAds = consentInfo.canRequestAds === true;

        // 3) Détermine NPA à partir des choix (si disponibles)
        let npa = true;
        try {
          const choices = await AdsConsent.getUserChoices();
          const personalisedAllowed = choices?.selectPersonalisedAds === true;
          npa = !personalisedAllowed;
        } catch {
          // si pas de choix explicites → rester en NPA par défaut (true)
        }

        (globalThis as any).__NPA__ = npa;

        // 4) Configure et initialise le SDK MobileAds
        const requestConfig: RequestConfiguration = {
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          maxAdContentRating: MaxAdContentRating.PG,
        };
        await mobileAds().setRequestConfiguration(requestConfig);
        await mobileAds().initialize();

        if (!cancelled) {
          (globalThis as any).__ADS_READY__ = true;
          console.log(
            "[Ads] Initialized after UMP → canRequestAds =",
            canRequestAds,
            " NPA =",
            npa
          );
          setReady(true);
        }
      } catch (e) {
        console.log("❌ [ConsentGate] Erreur init:", e);
        if (!cancelled) setReady(true); // on ne bloque pas l’UI
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
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
  // --- EXISTANT (challenge) ---
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

  // --- NOUVEAU : referral ---
  try {
    const parsed = new URL(url);

    // myapp://ref/<uid>
    if (url.startsWith("myapp://ref/")) {
      const refUid = parsed.pathname.split("/ref/")[1];
      if (refUid) {
        void AsyncStorage.setItem("ties_referrer_id", refUid);
      }
    }

    // https web function: .../r?ref=<uid>
    const refParam = parsed.searchParams.get("ref");
    if (refParam) {
      void AsyncStorage.setItem("ties_referrer_id", refParam);
    }
  } catch {
    // ignore
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
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    if (Platform.OS === "android") {
      ensureAndroidChannelAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (Platform.OS === "android") {
        await ensureAndroidChannelAsync();
      }
      await scheduleDailyNotifications();
    })();
  }, [user]);

   useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user) {
        scheduleDailyNotifications().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    startNotificationResponseListener(
      (path) => router.push(path),
      (text) => show(text, "success") // ⬅️ feedback visuel
    );

    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      const data: any = last?.notification?.request?.content?.data || null;
      if (!data) return;

      const type = String(data?.type || data?.__tag || "").toLowerCase();
      if (type === "invite-status" && data?.challengeId) {
        show(i18n.t("notificationsPush.opened"), "info"); // petit hint optionnel
        router.push(`/challenge-details/${String(data.challengeId)}`);
      } else if (type === "duo-nudge") {
        show(i18n.t("notificationsPush.opened"), "info");
        router.push("/profile/notifications");
      } else if (type === "daily_morning_v1" || type === "daily_evening_v1") {
        router.push("/(tabs)");
      } else if (data?.challengeId) {
        router.push({
          pathname: "profile/notifications",
          params: { challengeId: String(data.challengeId), invite: String(data.invite || "") },
        });
      } else {
        router.push("/(tabs)");
      }
    })().catch(() => {});

    return () => {
      stopNotificationResponseListener();
    };
  }, [router, show]);


  return null;
};

// =========================
 // RootLayout
// =========================
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

  // ✅ Active l’autocapture des liens d’invitation dès le boot (no-op si rien à traiter)
  useIncomingInvite(true);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
      <FeatureFlagsProvider>
        <FlagsGate>
          <AuthProvider>
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
                                  {/* ✅ GATE UMP + Ads en premier */}
                                  <ConsentGate>
  {/* ✅ Monte le provider APRÈS UMP/Ads */}
  <AdsVisibilityProvider>
    <DeepLinkManager />
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
  </AdsVisibilityProvider>
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
          </AuthProvider>
        </FlagsGate>
      </FeatureFlagsProvider>
      </ToastProvider>
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

function handleNotificationNavigation(router: ReturnType<typeof useRouter>, data: any) {
  const type = String(data?.type || data?.__tag || "").toLowerCase();

  if (type === "invite-status" && data?.challengeId) {
    router.push(`/challenge-details/${String(data.challengeId)}`);
    return;
  }

  if (type === "duo-nudge") {
    router.push("/profile/notifications");
    return;
  }

  if (type === "daily_morning_v1" || type === "daily_evening_v1") {
    router.push("/(tabs)");
    return;
  }

  if (type.includes("referral")) {
    router.push("/referral/ShareAndEarn");
    return;
  }

  if (data?.challengeId) {
    router.push({
      pathname: "profile/notifications",
      params: {
        challengeId: String(data.challengeId),
        invite: String(data.invite || ""),
      },
    });
    return;
  }

  router.push("/(tabs)");
}


