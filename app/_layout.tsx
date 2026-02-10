// app/_layout.tsx
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, usePathname } from "expo-router";
import { StyleSheet, Platform, AppState, View, Text, ActivityIndicator} from "react-native";
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
  getPathFromNotificationData,
  markNotifHandledOnColdStart,
  rescheduleNextDailyIfNeeded,
} from "@/services/notificationService";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { ToastProvider, useToast } from "../src/ui/Toast";
import MarkToastListener from "@/src/ui/MarkToastListener";


const FORCE_ADS_DEBUG = true;

const getShareSheetTs = () => {
  const v = (globalThis as any).__FROM_SHARE_SHEET__;
  if (!v) return null;
  if (typeof v === "number") return v;
  if (typeof v?.ts === "number") return v.ts;
  return null;
};

const getAfterShareIntent = () => {
  const v = (globalThis as any).__AFTER_SHARE_INTENT__;
  if (!v) return null;
  const ts = typeof v?.ts === "number" ? v.ts : null;
  const path = typeof v?.path === "string" ? v.path : null;
  if (!ts || !path) return null;
  return { ts, path };
};

const consumeAfterShareIntentIfFresh = (maxMs = 25000) => {
  const it = getAfterShareIntent();
  if (!it) return null;
  const age = Date.now() - it.ts;
  if (age < 0) return null;

  if (age <= maxMs) {
    // ✅ on consomme immédiatement (anti double-trigger)
    delete (globalThis as any).__AFTER_SHARE_INTENT__;
    return it.path as string;
  }

  delete (globalThis as any).__AFTER_SHARE_INTENT__;
  return null;
};

const FIRST_LAUNCH_KEY = "ties.firstLaunch.v1"; // "0" quand onboarding terminé
const GUEST_KEY = "ties.guest.enabled.v1"; // "1" uniquement si clic "visiteur"
const EXPLICIT_LOGOUT_KEY = "ties.explicitLogout.v1";
const HOME_PENDING_INVITE_KEY = "ties_home_pending_invite_v1";
const FIRSTPICK_DONE_HARD_KEY = "ties_firstpick_done_hard_v1";
const FIRSTPICK_DONE_HARD_TTL_MS = 5 * 60 * 1000;


async function getHomePendingInviteId() {
  try {
    const v = await AsyncStorage.getItem(HOME_PENDING_INVITE_KEY);
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

async function isFirstPickHardDoneFresh() {
  try {
    const raw = await AsyncStorage.getItem(FIRSTPICK_DONE_HARD_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      await AsyncStorage.removeItem(FIRSTPICK_DONE_HARD_KEY).catch(() => {});
      return false;
    }
    if (Date.now() - ts > FIRSTPICK_DONE_HARD_TTL_MS) {
      await AsyncStorage.removeItem(FIRSTPICK_DONE_HARD_KEY).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}


async function getExplicitLogoutFlag() {
  try {
    const v = await AsyncStorage.getItem(EXPLICIT_LOGOUT_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

async function clearExplicitLogoutFlag() {
  try {
    await AsyncStorage.removeItem(EXPLICIT_LOGOUT_KEY);
  } catch {}
}

async function isFirstLaunch() {
  try {
    const v = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return v !== "0"; // par défaut = true si absent
  } catch {
    return true;
  }
}

async function getGuestFlag() {
  try {
    const v = await AsyncStorage.getItem(GUEST_KEY);
    return v === "1";
  } catch {
    return false;
  }
}



const consumeShareSheetFlagIfExpired = (maxMs = 20000) => {
  const ts = getShareSheetTs();
  if (!ts) return false;
  const age = Date.now() - ts;
  if (age < 0) return false;
  // true = encore actif, on doit bloquer la redirection root
  if (age <= maxMs) return true;
  // expiré → cleanup
  delete (globalThis as any).__FROM_SHARE_SHEET__;
  return false;
};


// =========================
// AppNavigator : redirection initiale + Splash
// =========================
const AppNavigator: React.FC = () => {
  const { user, loading, checkingAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isGuest, hydrated } = useVisitor();

  const [explicitLogout, setExplicitLogout] = React.useState<boolean | null>(
    null
  );

  const [firstLaunch, setFirstLaunch] = React.useState<boolean | null>(null);
const [guestEnabled, setGuestEnabled] = React.useState<boolean | null>(null);
const [homePendingInviteId, setHomePendingInviteId] = React.useState<string | null>(null);

const guestNavLockRef = React.useRef(0);

const consumeGuestJustEnabled = () => {
  const ts = (globalThis as any).__GUEST_JUST_ENABLED__ as number | undefined;
  if (!ts) return false;
  // fenêtre courte : 2.5s
  if (Date.now() - ts <= 2500) {
    delete (globalThis as any).__GUEST_JUST_ENABLED__;
    return true;
  }
  delete (globalThis as any).__GUEST_JUST_ENABLED__;
  return false;
};

// ✅ Vérité unique: state visiteur immédiat OU flag persistant AsyncStorage
  const effectiveGuest = !!isGuest || !!guestEnabled;

useEffect(() => {
  let mounted = true;
  isFirstLaunch()
    .then((v) => mounted && setFirstLaunch(v))
    .catch(() => mounted && setFirstLaunch(true));
  getGuestFlag()
    .then((v) => mounted && setGuestEnabled(v))
    .catch(() => mounted && setGuestEnabled(false));
    getHomePendingInviteId()
    .then((v) => mounted && setHomePendingInviteId(v))
    .catch(() => mounted && setHomePendingInviteId(null));
  return () => {
    mounted = false;
  };
}, []);

// ✅ IMPORTANT: refresh guestEnabled quand on revient sur "/"
// (clic "Continue as guest" fait router.replace("/") + setItem(GUEST_KEY,"1"))
useEffect(() => {
  let alive = true;
  getGuestFlag()
    .then((v) => alive && setGuestEnabled(v))
    .catch(() => alive && setGuestEnabled(false));
  return () => {
    alive = false;
  };
}, [pathname]);

useEffect(() => {
  let alive = true;

  const refresh = async () => {
    const v = await getHomePendingInviteId();
    if (alive) setHomePendingInviteId(v);
  };

  refresh().catch(() => {});

  const sub = AppState.addEventListener("change", (st) => {
    if (st === "active") refresh().catch(() => {});
  });

  return () => {
    alive = false;
    sub.remove();
  };
}, []);


  useEffect(() => {
    let mounted = true;
    getExplicitLogoutFlag()
      .then((v) => mounted && setExplicitLogout(v))
      .catch(() => mounted && setExplicitLogout(false));
    return () => {
      mounted = false;
    };
  }, []);

    // ✅ garde la dernière route "stable" (≠ "/") pour revenir après ShareSheet
  const lastStablePathRef = React.useRef<string>("/(tabs)");

  useEffect(() => {
    if (pathname && pathname !== "/") {
      lastStablePathRef.current = pathname;
      (globalThis as any).__LAST_STABLE_PATH__ = pathname;
    }
  }, [pathname]);


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
  if (
  loading || // ✅ garde dur
  checkingAuth ||
  explicitLogout === null ||
  firstLaunch === null ||
  guestEnabled === null ||
  (!fontsLoaded && !hardReady) ||
  (!hydrated && !hardReady)
) {
  return;
}


  let nextRoute: string | null = null;


  // 1️⃣ After share intent
  const afterSharePath = consumeAfterShareIntentIfFresh(25000);
  if (afterSharePath) {
    nextRoute = afterSharePath;
  }

  // 2️⃣ Share sheet actif → retour stable
  if (!nextRoute && consumeShareSheetFlagIfExpired(20000)) {
    const pendingAfter = getAfterShareIntent();
    nextRoute =
      pendingAfter?.path ||
      (globalThis as any).__LAST_STABLE_PATH__ ||
      lastStablePathRef.current ||
      "/(tabs)";
  }

  // 3️⃣ DeepLink / Notif bloque le root
  const dlBlock = (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ === true;
const notifBlock = (globalThis as any).__NOTIF_BLOCK_ROOT_REDIRECT__ === true;

// ✅ On ne bloque JAMAIS le root redirect si pas connecté.
// Sinon "/" peut rester coincé.
if (!nextRoute && (dlBlock || notifBlock) && user) {
  SplashScreen.hideAsync().catch(() => {});
  return;
}

  // ✅ Exception critique : si user vient de se connecter sur /login ou /register,
// on doit le sortir de là immédiatement.
if (user && (pathname === "/login" || pathname === "/register")) {
  clearExplicitLogoutFlag().catch(() => {});

  // ✅ IMPORTANT: register doit aller vers l'onboarding, pas vers tabs.
  const target =
    pathname === "/register"
      ? "/screen/onboarding/Screen1"
      : "/(tabs)";

  requestAnimationFrame(() => router.replace(target));
  SplashScreen.hideAsync().catch(() => {});
  return;
}


  // ✅ VISITEUR : si on vient juste d'activer "visiteur" depuis /login/register,
  // on sort UNE FOIS vers tabs (sinon tu restes bloqué sur login).
  // Anti-loop: one-shot + lock 600ms.
  if (!user && (pathname === "/login" || pathname === "/register")) {
    const justEnabled = consumeGuestJustEnabled();
    // ✅ IMPORTANT: on ne force PAS le redirect si l'utilisateur est déjà guest
    // et qu'il ouvre /login volontairement pour se connecter.
    if (justEnabled) {
      const now = Date.now();
      if (now - guestNavLockRef.current > 600) {
        guestNavLockRef.current = now;
        requestAnimationFrame(() => router.replace("/(tabs)"));
      }
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
  }

  // ✅ Protection : on ne force une redirection "root" que si on est sur "/"
  // (sinon on laisse les autres screens vivre sans être écrasés)
  if (pathname !== "/") {
    SplashScreen.hideAsync().catch(() => {});
    return;
  }

  // ✅ Referral / intent qui doit forcer le flow auth (pas de visiteur)
// ✅ Referral / intent qui doit forcer le flow auth (pas de visiteur)
const forceAuth = (globalThis as any).__FORCE_AUTH_FLOW__ === true;

// ✅ Si forceAuth est actif et user pas connecté → login PRIORITAIRE (et on consomme)
if (forceAuth && !user) {
  (globalThis as any).__FORCE_AUTH_FLOW__ = false; // consume 1 fois
  nextRoute = "/login";
}

// ✅ Décision standard UNIQUEMENT si nextRoute pas déjà décidé
if (!nextRoute) {
  // ✅ user connecté → nettoie le flag logout et go tabs
  if (user) {
    clearExplicitLogoutFlag().catch(() => {});
    AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
    setGuestEnabled(false);
    nextRoute = "/(tabs)";
  } else if (effectiveGuest) {
    // ✅ visitor doit bypass firstLaunch / explicitLogout
    nextRoute = "/(tabs)";
  } else if (firstLaunch || explicitLogout) {
    nextRoute = "/login";
  } else {
    nextRoute = "/login";
  }
}


  if (nextRoute && pathname !== nextRoute) {
    requestAnimationFrame(() => {
      router.replace(nextRoute!);
    });
  }

  SplashScreen.hideAsync().catch(() => {});
}, [
  user,
  loading,
  checkingAuth,
  pathname,
  fontsLoaded,
  hydrated,
  hardReady,
  explicitLogout,
  firstLaunch,
  guestEnabled,
  isGuest,
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
 if (
  loading ||
  explicitLogout === null ||
  (!fontsLoaded && !hardReady) ||
  (!hydrated && !hardReady)
)
  return null;

  return null;
};

// =========================
// FlagsGate : bloque le rendu tant que les flags ne sont pas prêts
// =========================
const FLAGS_FAILSAFE_MS = 1800;

const FlagsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady } = useFlags();
  const [forceOpen, setForceOpen] = React.useState(false);

  useEffect(() => {
    if (isReady) return;
    const t = setTimeout(() => {
      setForceOpen(true);
      console.log("⚠️ [FlagsGate] failsafe open (isReady=false)");
    }, FLAGS_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, [isReady]);

  if (!isReady && !forceOpen) return null;

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
// InviteHandoff (global overlay)
// =========================
type InviteHandoffState = { visible: boolean; kind: "invite" | null };

const InviteHandoffContext = React.createContext<{
  state: InviteHandoffState;
  showInvite: () => void;
  hide: () => void;
} | null>(null);

const useInviteHandoff = () => {
  const ctx = React.useContext(InviteHandoffContext);
  if (!ctx) throw new Error("useInviteHandoff must be used within InviteHandoffProvider");
  return ctx;
};

const InviteHandoffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<InviteHandoffState>({ visible: false, kind: null });

  const api = React.useMemo(
    () => ({
      state,
      showInvite: () => setState({ visible: true, kind: "invite" }),
      hide: () => setState({ visible: false, kind: null }),
    }),
    [state]
  );

  // ✅ pont global : le screen challenge-details pourra cacher l'overlay
  useEffect(() => {
    (globalThis as any).__HIDE_INVITE_HANDOFF__ = api.hide;
    return () => {
      if ((globalThis as any).__HIDE_INVITE_HANDOFF__ === api.hide) {
        delete (globalThis as any).__HIDE_INVITE_HANDOFF__;
      }
    };
  }, [api.hide]);

  return <InviteHandoffContext.Provider value={api}>{children}</InviteHandoffContext.Provider>;
};

const InviteHandoffOverlay: React.FC = () => {
  const { state } = useInviteHandoff();
  const { t } = useTranslation();

  if (!state.visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      style={{
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: "rgba(0,0,0,0.86)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel={t("deeplink.inviteHandoff.a11y", { defaultValue: "Chargement de l’invitation…" })}
    >
      <View style={{ alignItems: "center" }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text
          style={{
            marginTop: 14,
            fontSize: 16,
            color: "#fff",
            textAlign: "center",
            fontFamily: "Comfortaa_700Bold",
          }}
        >
          {t("deeplink.inviteHandoff.title", { defaultValue: "Connexion au Duo…" })}
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
            fontFamily: "Comfortaa_400Regular",
          }}
        >
          {t("deeplink.inviteHandoff.sub", { defaultValue: "On prépare ton invitation. 1 seconde." })}
        </Text>
      </View>
    </Animated.View>
  );
};


// =========================
// DeepLinkManager : SAFE, idempotent, auth-aware
// =========================
const DeepLinkManager: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { flags } = useFlags();
  const { user, loading, checkingAuth } = useAuth();
  const handoff = useInviteHandoff();

  // Dédup local + global (si remount)
  const lastUrlRef = React.useRef<string | null>(null);
  const handledInitialRef = React.useRef(false);

  const getGlobalLast = () =>
    (globalThis as any).__DL_LAST_URL__ as string | undefined;
  const setGlobalLast = (u: string) => {
    (globalThis as any).__DL_LAST_URL__ = u;
  };

  const setDLBlock = (on: boolean) => {
    (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = on;
    (globalThis as any).__DL_BLOCK_TS__ = on ? Date.now() : 0;
  };

  const clearDLBlockIfStale = (ttlMs = 4500) => {
    const ts = Number((globalThis as any).__DL_BLOCK_TS__ || 0);
    if (!ts) return;
    if (Date.now() - ts > ttlMs) {
      (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = false;
      (globalThis as any).__DL_BLOCK_TS__ = 0;
    }
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
    // ✅ Referral = 1 seule source de vérité : /ref/[refUid]
    // On ne bloque pas le root redirect (ce screen va gérer la sortie vers login/tabs)
    setDLBlock(false);
    // Le referral doit forcer un flow auth (pas de visiteur)
    (globalThis as any).__FORCE_AUTH_FLOW__ = true;

    const cleanRef = String(refUid).trim();
    const cleanSrc =
      typeof qp.src === "string" ? String(qp.src).trim() : "share";

    if (!cleanRef) return;

    const target = `/ref/${cleanRef}?src=${encodeURIComponent(cleanSrc)}`;
    // ✅ replace (pas push) pour éviter une pile chelou + back vers un état invalide
    if (pathname !== target) {
      router.replace(target);
    }
  } catch {}
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
        // ✅ query params peuvent être encodés → on normalise
        try {
          challengeId = decodeURIComponent(idFromQuery);
        } catch {
          challengeId = idFromQuery;
        }
        inviteId = inviteFromQuery;
        if (Number.isFinite(daysFromQuery) && (daysFromQuery as number) > 0) {
          selectedDays = daysFromQuery as number;
        }
      }

      // ✅ 2.2 Legacy paths
      if (!challengeId) {
        if (path.startsWith("challenge/")) {
          const raw = path.split("challenge/")[1]?.split("/")[0];
          if (raw) {
            try {
              challengeId = decodeURIComponent(raw);
            } catch {
              challengeId = raw;
            }
          }
          inviteId = inviteFromQuery;
        } else if (path.startsWith("challenge-details/")) {
          const raw = path.split("challenge-details/")[1]?.split("/")[0];
          if (raw) {
            try {
              challengeId = decodeURIComponent(raw);
            } catch {
              challengeId = raw;
            }
          }
          inviteId = inviteFromQuery;
        } else if (path === "i" && idFromQuery) {
          // sécurité si Expo parse path "i"
          try {
            challengeId = decodeURIComponent(idFromQuery);
          } catch {
            challengeId = idFromQuery;
          }
          inviteId = inviteFromQuery;
        }
      }

      if (!challengeId) return;

      // ✅ on bloque le redirect root (AppNavigator) dès qu'on a un DL challenge
      setDLBlock(true);

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
         // ✅ clé du fix
   // ✅ clé du fix (ne jamais laisser "/" coincé)
        setDLBlock(false);
        (globalThis as any).__FORCE_AUTH_FLOW__ = true;
        return;
      }

      // ✅ User ready → navigation propre
      if (inviteId) {
        // 1 seul loading premium au lieu de 3 spinners/écrans
        handoff.showInvite();
      }
      // ✅ iOS-safe: encode le segment dynamique (accents, espaces, tirets spéciaux…)
      const safeSegment = encodeURIComponent(String(challengeId));

      // ✅ failsafe anti "handoff infini" (si route ne match pas / modal ne s’affiche pas)
      if (inviteId) {
        setTimeout(() => {
          try {
            (globalThis as any).__HIDE_INVITE_HANDOFF__?.();
          } catch {}
        }, 12000);
      }

      router.push({
        pathname: `/challenge-details/${safeSegment}`,
        params: inviteId
          ? {
              invite: inviteId,
              days: selectedDays ? String(selectedDays) : undefined,
            }
          : {},
      });
      // ✅ anti blocage infini sur "/"
      setTimeout(() => {
        try {
          setDLBlock(false);
        } catch {}
      }, 1800);
    },
    [router, user, loading, checkingAuth, handoff, pathname]
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
        setDLBlock(true);

         if (inviteId) {
          handoff.showInvite();
        }

        const safeSegment = encodeURIComponent(String(challengeId));
        router.push({
          pathname: `/challenge-details/${safeSegment}`,
          params: inviteId
            ? {
                invite: String(inviteId),
                days: selectedDays ? String(selectedDays) : undefined,
              }
            : {},
        });
         setTimeout(() => {
          try {
            setDLBlock(false);
          } catch {}
        }, 1800);
      } catch {}
    })();
  }, [flags.enableDeepLinks, user, loading, checkingAuth, router, handoff]);

  // ✅ Dès qu’on est réellement sur challenge-details, on peut couper l’overlay root
  useEffect(() => {
    if (!pathname) return;

    // ✅ purge auto si un block traîne (anti écran blanc "/")
    clearDLBlockIfStale(4500);
    if (pathname.startsWith("/challenge-details/")) {
      const t = setTimeout(() => {
        try {
          setDLBlock(false);
        } catch {}
      }, 400);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return null;
};


// =========================
// NotificationsBootstrap : notifs locales + push + navigation
// =========================
const NotificationsBootstrap: React.FC = () => {
  const router = useRouter();
  const { show } = useToast();

  // ✅ anti double navigation / double toast (cold start + listener peuvent fire)
  const lastNavRef = React.useRef<{ path: string; ts: number } | null>(null);
  const lastToastRef = React.useRef<{ text: string; ts: number } | null>(null);

  const safeNavigate = React.useCallback(
    (path: string) => {
      if (!path) return;
      const now = Date.now();
      const last = lastNavRef.current;

      // ignore même path dans une fenêtre courte
      if (last && last.path === path && now - last.ts < 1200) return;

      lastNavRef.current = { path, ts: now };
      (globalThis as any).__NOTIF_BLOCK_ROOT_REDIRECT__ = true;

      router.push(path);
    },
    [router]
  );

  const safeToast = React.useCallback(
    (text: string, kind: "success" | "info" | "error" = "info") => {
      const t = String(text || "").trim();
      if (!t) return;

      const now = Date.now();
      const last = lastToastRef.current;

      if (last && last.text === t && now - last.ts < 1200) return;

      lastToastRef.current = { text: t, ts: now };
      show(t, kind);
    },
    [show]
  );

  // Channel Android au boot
  useEffect(() => {
    if (Platform.OS === "android") {
      ensureAndroidChannelAsync().catch(() => {});
    }
  }, []);

  // Listener global (app déjà ouverte / en background)
  useEffect(() => {
    startNotificationResponseListener(
  (path) => safeNavigate(path),
  () => {} // ✅ pas de toast "notification ouverte"
);

    // Cold start fallback : l’app ouverte via tap alors que le listener n’était pas encore attaché
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data: any = last?.notification?.request?.content?.data || null;
        if (!data) return;
        // ✅ Important: empêche le listener de re-router immédiatement derrière (double trigger)
         markNotifHandledOnColdStart();

        // ✅ navigation cohérente avec notificationService
        const path = getPathFromNotificationData(data);
        safeNavigate(path);

        // Toast contextuel (anti double intégré)
        const tSafe = (key: string, options?: Record<string, any>) => {
          const res = i18n.t(key, {
            ...(options || {}),
            returnObjects: false,
          });
          return typeof res === "string" ? res : String(res ?? "");
        };

        const type = String(data?.type || data?.__tag || "").toLowerCase();

        // ✅ Plus de toast "notification ouverte" (tu ne le veux jamais)
// Si un jour tu veux un toast spécifique, on le remettra uniquement sur un cas utile.
if (type === "duo-nudge") {
  // safeToast(tSafe("notificationsPush.duoNudgeOpened"), "success");
}

        // ✅ si ouverte via daily → replanifie la prochaine (safe 1x/jour)
        if (type === "daily-reminder") {
          rescheduleNextDailyIfNeeded().catch(() => {});
        }
      } catch {}
    })().catch(() => {});

    return () => {
      stopNotificationResponseListener();
    };
  }, [safeNavigate, safeToast]);

  // ✅ Quand une notif est reçue (même sans tap), on peut replanifier la prochaine daily
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notif) => {
      const data: any = notif?.request?.content?.data || {};
      if (data?.type === "daily-reminder") {
        rescheduleNextDailyIfNeeded().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return null;
};

// =========================
// RootLayout (UNIQUE export)
// =========================
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});

    // ✅ ATT: request at the VERY START of app lifecycle (before any SDK/analytics).
    // Apple review on iPadOS must see the system prompt on first launch when status is "undetermined".
    if (Platform.OS === "ios") {
      (async () => {
        try {
          const cur = await getTrackingPermissionsAsync();
          const status = cur?.status as string | undefined;

          if (status === "undetermined") {
            const req = await requestTrackingPermissionsAsync();
            (globalThis as any).__ATT_STATUS__ =
              (req?.status as string | undefined) ?? status ?? "unknown";
          } else {
            (globalThis as any).__ATT_STATUS__ = status || "unknown";
          }
        } catch (e) {
          (globalThis as any).__ATT_STATUS__ = "error";
        }
      })();
    } else {
      (globalThis as any).__ATT_STATUS__ = "not-ios";
    }
    

    // ✅ failsafe global : quoi qu’il arrive, on sort du splash
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);

    return () => clearTimeout(t);
  }, []);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <View style={{ flex: 1 }}>
        <MarkToastListener />
        <FeatureFlagsProvider>
          <FlagsGate>
            <AuthProvider>
              <I18nextProvider i18n={i18n}>
                 <LanguageProvider>
                  <ThemeProvider>
                    <PaperProvider>
                      <ProfileUpdateProvider>
                        <TrophyProvider>
                          <SavedChallengesProvider>
                            <CurrentChallengesProvider>
                              <ChatProvider>
                                <TutorialProvider>
                                  <VisitorProvider>
                                    <ConsentGate>
                                      <PremiumProvider>
                                      <AdsVisibilityProvider>
                                        <InviteHandoffProvider>
                                        <DeepLinkManager />
                                        <NotificationsBootstrap />
                                        <InviteHandoffOverlay />

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
                                        </InviteHandoffProvider>

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
              </LanguageProvider>
              </I18nextProvider>
            </AuthProvider>
          </FlagsGate>
        </FeatureFlagsProvider>
        </View>
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

