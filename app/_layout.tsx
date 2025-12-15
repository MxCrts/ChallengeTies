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
import { PremiumProvider } from "@/src/context/PremiumContext";
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
} from "react-native-google-mobile-ads";

import { VisitorProvider, useVisitor } from "@/context/VisitorContext";
import { logEvent } from "../src/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  checkAndGrantPioneerIfEligible,
  checkAndGrantAmbassadorRewards,
  checkAndGrantAmbassadorMilestones,
} from "@/src/referral/pioneerChecker";

import { bumpCounterAndMaybeReview } from "@/src/services/reviewService";

import * as Notifications from "expo-notifications";

import {
  startNotificationResponseListener,
  stopNotificationResponseListener,
  ensureAndroidChannelAsync,
  scheduleDailyNotifications,
} from "@/services/notificationService";
import { handleReferralUrl } from "@/services/referralLinking";


// Toast
import { ToastProvider, useToast } from "../src/ui/Toast";

const FORCE_ADS_DEBUG = true;

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

  // ✅ FAILSAFE hydration visiteur non bloquante après hardReady
  const [hardReady, setHardReady] = React.useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHardReady(true), 3500);
    return () => clearTimeout(t);
  }, []);

  // Analytics + review gentle ping
  useEffect(() => {
    logEvent("app_open" as any).catch(() => {});
    bumpCounterAndMaybeReview("app_open", 7).catch(() => {});
  }, []);

  useEffect(() => {
    // ⛔️ tant que Auth / Fonts pas prêts → ne route pas
   if (loading || checkingAuth || (!fontsLoaded && !hardReady) || (!hydrated && !hardReady)) {
  return;
}

// ✅ Si un deep link challenge a été détecté, on laisse DeepLinkManager gérer.
    if ((globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ === true) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    // Si on n'est pas sur "/" on ne force pas une redirection,
    // mais on cache le splash quand même.
    if (pathname !== "/") {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    if (user || isGuest) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }

    SplashScreen.hideAsync().catch(() => {});
  }, [
    user,
    loading,
    checkingAuth,
    pathname,
    router,
    isGuest,
    fontsLoaded,
    hydrated,
    hardReady,
  ]);

  // Parrainage (Pioneer / Ambassador) uniquement user connecté
  useEffect(() => {
    if (loading || checkingAuth || !fontsLoaded || (!hydrated && !hardReady))
      return;
    if (!user) return;

    checkAndGrantPioneerIfEligible().catch(() => {});
    checkAndGrantAmbassadorRewards().catch(() => {});
    checkAndGrantAmbassadorMilestones().catch(() => {});
  }, [user, loading, checkingAuth, fontsLoaded, hydrated, hardReady]);

  // On ne rend rien : seulement redirection + splash
  if (loading || checkingAuth || !fontsLoaded || (!hydrated && !hardReady))
    return null;
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
// ConsentGate : UMP (AdsConsent) + MobileAds (NON BLOQUANT)
// =========================
const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("🧩 [ConsentGate] UMP via AdsConsent + MobileAds…");
        (globalThis as any).__ADS_READY__ = false;
        (globalThis as any).__NPA__ = true;
        (globalThis as any).__CAN_REQUEST_ADS__ = true; // valeur safe par défaut

        // 1) UMP / consent
        await AdsConsent.requestInfoUpdate();
        const info = await AdsConsent.getConsentInfo();
        console.log("[UMP] consentInfo:", info);

        if (
          info.isConsentFormAvailable &&
          (info.status === AdsConsentStatus.REQUIRED ||
            info.status === AdsConsentStatus.UNKNOWN)
        ) {
          await AdsConsent.loadAndShowConsentFormIfRequired();
        }

        // 2) Re-lecture après éventuel formulaire
        const consentInfo = await AdsConsent.getConsentInfo();
        const canRequestAds = consentInfo.canRequestAds === true;

        // 3) Calcul NPA
        let npa = true;
        try {
          const choices = await AdsConsent.getUserChoices();
          const personalisedAllowed =
            choices?.selectPersonalisedAds === true;
          npa = !personalisedAllowed;
        } catch {
          // en cas d'erreur → NPA true (safe)
          npa = true;
        }

        // 🔧 En mode debug, on NE BLOQUE JAMAIS les requêtes d’ads,
        // même si canRequestAds === false. On garde juste NPA pour rester safe.
        const finalCanRequestAds = FORCE_ADS_DEBUG ? true : canRequestAds;

        (globalThis as any).__NPA__ = npa;
        (globalThis as any).__CAN_REQUEST_ADS__ = finalCanRequestAds;

        console.log("[Ads][ConsentGate] globals set:", {
          canRequestAds,
          finalCanRequestAds,
          npa,
        });

        // 4) Config + init MobileAds

        // 4) Config + init MobileAds
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
        }
      } catch (e) {
        console.log("❌ [ConsentGate] Erreur init:", e);

        // 🔁 Fallback : on essaie quand même d'initialiser MobileAds
        try {
          const requestConfig: RequestConfiguration = {
            tagForChildDirectedTreatment: false,
            tagForUnderAgeOfConsent: false,
            maxAdContentRating: MaxAdContentRating.PG,
          };
          await mobileAds().setRequestConfiguration(requestConfig);
          await mobileAds().initialize();
        } catch (e2) {
          console.log(
            "⚠️ [ConsentGate] Fallback MobileAds init failed:",
            e2
          );
        }

                if (!cancelled) {
          // ✅ Fallback safe : on autorise les requêtes,
          // on garde NPA = true, et on déverrouille ADS_READY.
          // En mode debug on force aussi canRequestAds à true.
          const finalCanRequestAds = FORCE_ADS_DEBUG ? true : true;

          (globalThis as any).__NPA__ = true;
          (globalThis as any).__CAN_REQUEST_ADS__ = finalCanRequestAds;
          (globalThis as any).__ADS_READY__ = true;

          console.log("[Ads][ConsentGate] fallback globals set:", {
            finalCanRequestAds,
          });
        }

      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
};


// =========================
// DeepLinkManager : SAFE, idempotent, auth-aware
// =========================
const DeepLinkManager: React.FC = () => {
  const router = useRouter();
  const { flags } = useFlags();
  const { user, loading, checkingAuth } = useAuth();

  // Dédup local + global (si remount)
  const lastUrlRef = React.useRef<string | null>(null);
  const handledInitialRef = React.useRef(false);

  const getGlobalLast = () =>
    (globalThis as any).__DL_LAST_URL__ as string | undefined;
  const setGlobalLast = (u: string) => {
    (globalThis as any).__DL_LAST_URL__ = u;
  };

  const handleDeepLink = React.useCallback(
    async (url: string) => {
      if (!url) return;

      // ✅ dedupe global
      const globalLast = getGlobalLast();
      if (globalLast === url) return;
      setGlobalLast(url);

      // ✅ dedupe local
      if (lastUrlRef.current === url) return;
      lastUrlRef.current = url;

      // ✅ parsing robuste Expo
      const parsed = Linking.parse(url);
      const path = parsed.path || "";
      const qp = (parsed.queryParams || {}) as Record<string, any>;

           // -------------------------
      // 1) REFERRAL LINKS
      // -------------------------
      const refFromQuery = typeof qp.ref === "string" ? qp.ref : null;
      const refFromPath =
        path.startsWith("ref/") ? path.split("ref/")[1] : null;

      const refUid = refFromQuery || refFromPath;

      if (refUid) {
        try {
          // 🧠 On délègue TOUT à handleReferralUrl :
          // - parse robuste (ref / refUid / referrerId / path / query)
          // - ignore self-ref
          // - écrit REFERRER_KEY, REFERRER_SRC_KEY, REFERRER_TS_KEY
          await handleReferralUrl(url);

          __DEV__ &&
            console.log("[DeepLink] referral handled via handleReferralUrl:", {
              refUid,
            });
        } catch (e) {
          console.log("❌ [DeepLink] referral handle error:", e);
        }

        // ❗️Très important : pour un lien de parrainage, on ne navigue pas.
        // On laisse le flow normal (login/register → index) gérer.
        return;
      }


      // -------------------------
      // 2) CHALLENGE / INVITE LINKS
      // -------------------------
      let challengeId: string | undefined;
      let inviteId: string | undefined;
      let selectedDays: number | undefined;

      // ✅ 2.1 Universal links: /i?id=CHALLENGE&invite=INVITE&days=N
      const idFromQuery = typeof qp.id === "string" ? qp.id : undefined;
      const inviteFromQuery = typeof qp.invite === "string" ? qp.invite : undefined;
      const daysFromQuery =
        typeof qp.days === "string" || typeof qp.days === "number"
          ? Number(qp.days)
          : undefined;

      if (idFromQuery) {
        challengeId = idFromQuery;
        inviteId = inviteFromQuery;
        if (Number.isFinite(daysFromQuery) && (daysFromQuery as number) > 0) {
          selectedDays = daysFromQuery as number;
        }
      }

      // ✅ 2.2 Legacy paths
      if (!challengeId) {
        if (path.startsWith("challenge/")) {
          challengeId = path.split("challenge/")[1]?.split("/")[0];
          inviteId = inviteFromQuery;
        } else if (path.startsWith("challenge-details/")) {
          challengeId = path.split("challenge-details/")[1]?.split("/")[0];
          inviteId = inviteFromQuery;
        } else if (path === "i" && idFromQuery) {
          // sécurité si Expo parse path "i"
          challengeId = idFromQuery;
          inviteId = inviteFromQuery;
        }
      }

      if (!challengeId) return;

      // ✅ on bloque le redirect root (AppNavigator) dès qu'on a un DL challenge
      (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = true;

      // ✅ Si pas connecté OU auth pas prête → on stocke, on laisse AppNavigator aller login
      if (!user || loading || checkingAuth) {
        try {
          await AsyncStorage.setItem(
            "ties_pending_link",
            JSON.stringify({
              challengeId,
              inviteId: inviteId || null,
              selectedDays: selectedDays || null,
              t: Date.now(),
            })
          );
          __DEV__ &&
            console.log("🕓 [DeepLink] pending stored:", {
              challengeId,
              inviteId,
            });
        } catch {}
        return;
      }

      // ✅ User ready → navigation propre
      router.push({
        pathname: `/challenge-details/${challengeId}`,
        params: inviteId
          ? {
              invite: inviteId,
              days: selectedDays ? String(selectedDays) : undefined,
            }
          : {},
      });
    },
    [router, user, loading, checkingAuth]
  );

  useEffect(() => {
    if (!flags.enableDeepLinks) return;

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    if (!handledInitialRef.current) {
      handledInitialRef.current = true;
      Linking.getInitialURL()
        .then((url) => {
          if (url) handleDeepLink(url);
        })
        .catch(() => {});
    }

    return () => sub.remove();
  }, [flags.enableDeepLinks, handleDeepLink]);

  // ✅ Consomme un pending link après login
  useEffect(() => {
    if (!flags.enableDeepLinks) return;
    if (!user || loading || checkingAuth) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem("ties_pending_link");
        if (!raw) return;
        const parsed = JSON.parse(raw || "{}");
        const challengeId = parsed?.challengeId;
        const inviteId = parsed?.inviteId;
        const selectedDays = parsed?.selectedDays;
        if (!challengeId) return;

        await AsyncStorage.removeItem("ties_pending_link");
        (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = true;

        router.push({
          pathname: `/challenge-details/${String(challengeId)}`,
          params: inviteId
            ? {
                invite: String(inviteId),
                days: selectedDays ? String(selectedDays) : undefined,
              }
            : {},
        });
      } catch {}
    })();
  }, [flags.enableDeepLinks, user, loading, checkingAuth, router]);

  return null;
};


// =========================
// NotificationsBootstrap : notifs locales + push + navigation
// =========================
const NotificationsBootstrap: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { show } = useToast();

  // Channel Android au boot
  useEffect(() => {
    if (Platform.OS === "android") {
      ensureAndroidChannelAsync().catch(() => {});
    }
  }, []);

  // Daily notifications (idempotent, seulement si user connecté)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if (Platform.OS === "android") await ensureAndroidChannelAsync();
        await scheduleDailyNotifications();
      } catch {}
    })();
  }, [user]);

  // Quand l’app redevient active → on s’assure que les daily notifs sont bien en place (toujours idempotent)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user) {
        scheduleDailyNotifications().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [user]);

  // Listener global (app déjà ouverte / en background)
  useEffect(() => {
    startNotificationResponseListener(
      (path) => router.push(path),
      (text) => show(text, "success")
    );

    // Cold start : l’app est ouverte via un tap sur une notif alors que le listener
    // n’était pas encore attaché → on consomme "la dernière réponse"
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data: any = last?.notification?.request?.content?.data || null;
        if (!data) return;

        // Navigation cohérente avec notificationService
        handleNotificationNavigation(router, data);

        // Petit toast contextuel (optionnel mais sympa)
        const tSafe = (key: string, options?: Record<string, any>) => {
          const res = i18n.t(key, {
            ...(options || {}),
            returnObjects: false,
          });
          return typeof res === "string" ? res : String(res ?? "");
        };

        const type = String(data?.type || data?.__tag || "").toLowerCase();

        if (type === "duo-nudge") {
          show(tSafe("notificationsPush.duoNudgeOpened"), "success");
        } else if (
          type === "invite-status" ||
          type === "daily-reminder" ||
          type.startsWith("referral")
        ) {
          show(tSafe("notificationsPush.opened"), "info");
        }
      } catch {}
    })().catch(() => {});

    return () => {
      stopNotificationResponseListener();
    };
  }, [router, show]);

  return null;
};

// =========================
// RootLayout (UNIQUE export)
// =========================
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});

    // ✅ failsafe global : quoi qu’il arrive, on sort du splash
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);

    return () => clearTimeout(t);
  }, []);


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
                                    <ConsentGate>
                                      <PremiumProvider>
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
                                          <Stack.Screen
                                            name="(tabs)"
                                            options={{ headerShown: false }}
                                          />
                                          <Stack.Screen name="login" />
                                          <Stack.Screen name="register" />
                                          <Stack.Screen name="forgot-password" />
                                        </Stack>

                                        <AppNavigator />
                                        <TrophyModal />

                                      </AdsVisibilityProvider>
                                      </PremiumProvider>
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

// Helper générique : navigation alignée sur notificationService
function handleNotificationNavigation(
  router: ReturnType<typeof useRouter>,
  data: any
) {
  const type = String(data?.type || data?.__tag || "").toLowerCase();
  const challengeId: string | undefined = data?.challengeId;

  // ✅ Daily reminders → home / index
  if (type === "daily-reminder") {
    router.push("/");
    return;
  }

  // ✅ Statut d’invitation (acceptée / refusée)
  if (type === "invite-status") {
    if (challengeId) {
      router.push(`/challenge-details/${String(challengeId)}`);
    } else {
      router.push("/(tabs)");
    }
    return;
  }

  // ✅ Nudge duo : va idéalement sur le défi, sinon sur la liste des challenges
  if (type === "duo-nudge") {
    if (challengeId) {
      router.push(`/challenge-details/${String(challengeId)}`);
    } else {
      router.push("/current-challenges");
    }
    return;
  }

  // ✅ Referral — milestones & nouveaux filleuls
  if (type === "referral_milestone_unlocked" || type === "referral_new_child") {
    router.push("/referral/ShareAndEarn");
    return;
  }

  // ✅ Fallback avec challengeId → page du défi
  if (challengeId) {
    router.push(`/challenge-details/${String(challengeId)}`);
    return;
  }

  // ✅ Fallback global → onglets
  router.push("/(tabs)");
}
