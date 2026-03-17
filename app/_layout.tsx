// app/_layout.tsx
// ✅ RootInviteBootOverlay refonte "top monde" — 3 phases animées + i18n complet
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  interpolate,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, usePathname } from "expo-router";
import {
  StyleSheet,
  Platform,
  AppState,
  View,
  Text,
  InteractionManager,
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
import { logEvent, logEventDaily } from "../src/analytics";
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
import { faLogEvent } from "@/src/firebaseAnalytics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TiktokBusiness from 'react-native-tiktok-business';

const FORCE_ADS_DEBUG = false;

// ─── Share sheet helpers (inchangés) ───────────────────────────────────────
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
    delete (globalThis as any).__AFTER_SHARE_INTENT__;
    return it.path as string;
  }
  delete (globalThis as any).__AFTER_SHARE_INTENT__;
  return null;
};

const consumeShareSheetFlagIfExpired = (maxMs = 20000) => {
  const ts = getShareSheetTs();
  if (!ts) return false;
  const age = Date.now() - ts;
  if (age < 0) return false;
  if (age <= maxMs) return true;
  delete (globalThis as any).__FROM_SHARE_SHEET__;
  return false;
};

// ─── AsyncStorage keys (inchangés) ────────────────────────────────────────
const FIRST_LAUNCH_KEY = "ties.firstLaunch.v1";
const GUEST_KEY = "ties.guest.enabled.v1";
const EXPLICIT_LOGOUT_KEY = "ties.explicitLogout.v1";
const HOME_PENDING_INVITE_KEY = "ties_home_pending_invite_v1";

async function getHomePendingInviteId() {
  try {
    const v = await AsyncStorage.getItem(HOME_PENDING_INVITE_KEY);
    return v ? String(v) : null;
  } catch {
    return null;
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
    return v !== "0";
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

// =========================
// AppNavigator (LOGIQUE INCHANGÉE)
// =========================
const AppNavigator: React.FC = () => {
  const { user, loading, checkingAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isGuest, hydrated } = useVisitor();

  const [explicitLogout, setExplicitLogout] = React.useState<boolean | null>(null);
  const [firstLaunch, setFirstLaunch] = React.useState<boolean | null>(null);
  const [guestEnabled, setGuestEnabled] = React.useState<boolean | null>(null);
  const [homePendingInviteId, setHomePendingInviteId] = React.useState<string | null>(null);
  const guestNavLockRef = React.useRef(0);

  const consumeGuestJustEnabled = () => {
    const ts = (globalThis as any).__GUEST_JUST_ENABLED__ as number | undefined;
    if (!ts) return false;
    if (Date.now() - ts <= 2500) {
      delete (globalThis as any).__GUEST_JUST_ENABLED__;
      return true;
    }
    delete (globalThis as any).__GUEST_JUST_ENABLED__;
    return false;
  };

  const effectiveGuest = !!isGuest || !!guestEnabled;

  useEffect(() => {
    let mounted = true;
    isFirstLaunch().then((v) => mounted && setFirstLaunch(v)).catch(() => mounted && setFirstLaunch(true));
    getGuestFlag().then((v) => mounted && setGuestEnabled(v)).catch(() => mounted && setGuestEnabled(false));
    getHomePendingInviteId().then((v) => mounted && setHomePendingInviteId(v)).catch(() => mounted && setHomePendingInviteId(null));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getGuestFlag().then((v) => alive && setGuestEnabled(v)).catch(() => alive && setGuestEnabled(false));
    return () => { alive = false; };
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
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    getExplicitLogoutFlag().then((v) => mounted && setExplicitLogout(v)).catch(() => mounted && setExplicitLogout(false));
    return () => { mounted = false; };
  }, []);

  const lastStablePathRef = React.useRef<string>("/");
  useEffect(() => {
    if (pathname && pathname !== "/") {
      lastStablePathRef.current = pathname;
      (globalThis as any).__LAST_STABLE_PATH__ = pathname;
    }
  }, [pathname]);

  const [fontsLoaded, fontError] = useFonts({ Comfortaa_400Regular, Comfortaa_700Bold });
const [hardReady, setHardReady] = React.useState(false);
useEffect(() => {
  // ✅ Si les fonts chargent (succès ou erreur), on débloque immédiatement
  // Le failsafe 3500ms reste pour les cas où useFonts ne répond jamais
  if (fontsLoaded || fontError) {
    setHardReady(true);
    return;
  }
  const t = setTimeout(() => setHardReady(true), 3500);
  return () => clearTimeout(t);
}, [fontsLoaded, fontError]);

  const [attTick, setAttTick] = React.useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const id = setInterval(() => {
      if ((globalThis as any).__ATT_DONE__ === true) { clearInterval(id); setAttTick((x) => x + 1); }
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canLog = Platform.OS !== "ios" || (globalThis as any).__ATT_DONE__ === true;
    if (!canLog) return;
    faLogEvent("app_open", { from: "boot" }).catch(() => {});
    logEvent("app_open" as any).catch(() => {});
    logEventDaily("dau", "daily_active").catch(() => {});
    bumpCounterAndMaybeReview("app_open", 7).catch(() => {});
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") logEventDaily("dau", "daily_active").catch(() => {});
    });
    return () => sub.remove();
  }, [attTick]);

  useEffect(() => {
    if (
      loading || checkingAuth || explicitLogout === null || firstLaunch === null ||
      guestEnabled === null || (!fontsLoaded && !hardReady) || (!hydrated && !hardReady)
    ) return;

    let nextRoute: string | null = null;

    const afterSharePath = consumeAfterShareIntentIfFresh(25000);
    if (afterSharePath) nextRoute = afterSharePath;

    if (!nextRoute && consumeShareSheetFlagIfExpired(20000)) {
      const pendingAfter = getAfterShareIntent();
      nextRoute = pendingAfter?.path || (globalThis as any).__LAST_STABLE_PATH__ || lastStablePathRef.current || "/";
    }

    const dlBlock = (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ === true;
    const notifBlock = (globalThis as any).__NOTIF_BLOCK_ROOT_REDIRECT__ === true;
    if (!nextRoute && (dlBlock || notifBlock) && user && pathname !== "/") {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    if (user && (pathname === "/login" || pathname === "/register")) {
      clearExplicitLogoutFlag().catch(() => {});
      const target = pathname === "/register" ? "/first-pick" : "/(tabs)";
      requestAnimationFrame(() => router.replace(target));
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    if (!user && (pathname === "/login" || pathname === "/register")) {
      const justEnabled = consumeGuestJustEnabled();
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

    if (pathname !== "/") {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    const forceAuth = (globalThis as any).__FORCE_AUTH_FLOW__ === true;
    if (forceAuth && !user) {
      (globalThis as any).__FORCE_AUTH_FLOW__ = false;
      nextRoute = "/login";
    }

    if (!nextRoute) {
      if (user) {
        clearExplicitLogoutFlag().catch(() => {});
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
        setGuestEnabled(false);
        nextRoute = "/(tabs)";
      } else if (effectiveGuest) {
        nextRoute = "/(tabs)";
      } else {
        nextRoute = "/login";
      }
    }

    if (nextRoute && pathname !== nextRoute) requestAnimationFrame(() => router.replace(nextRoute!));
    SplashScreen.hideAsync().catch(() => {});
  }, [user, loading, checkingAuth, pathname, fontsLoaded, hydrated, hardReady, explicitLogout, firstLaunch, guestEnabled, isGuest]);

  useEffect(() => {
   if (loading || checkingAuth || (!fontsLoaded && !fontError) || (!hydrated && !hardReady)) return;
    if (!user) return;
    checkAndGrantPioneerIfEligible().catch(() => {});
    checkAndGrantAmbassadorRewards().catch(() => {});
    checkAndGrantAmbassadorMilestones().catch(() => {});
  }, [user, loading, checkingAuth, fontsLoaded, hydrated, hardReady]);

  if (loading || explicitLogout === null || (!fontsLoaded && !fontError && !hardReady) || (!hydrated && !hardReady)) return null;
  return null;
};

// =========================
// FlagsGate (inchangé)
// =========================
const FLAGS_FAILSAFE_MS = 1800;
const FlagsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady } = useFlags();
  const [forceOpen, setForceOpen] = React.useState(false);
  useEffect(() => {
    if (isReady) return;
    const t = setTimeout(() => { setForceOpen(true); }, FLAGS_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, [isReady]);
  if (!isReady && !forceOpen) return null;
  return <>{children}</>;
};

// =========================
// ConsentGate (inchangé)
// =========================
const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        (globalThis as any).__ADS_READY__ = false;
        (globalThis as any).__NPA__ = true;
        (globalThis as any).__CAN_REQUEST_ADS__ = true;
        await AdsConsent.requestInfoUpdate();
        const info = await AdsConsent.getConsentInfo();
        if (info.isConsentFormAvailable && (info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN)) {
          await AdsConsent.loadAndShowConsentFormIfRequired();
        }
        const consentInfo = await AdsConsent.getConsentInfo();
        const canRequestAds = consentInfo.canRequestAds === true;
        let npa = true;
        try {
          const choices = await AdsConsent.getUserChoices();
          npa = !(choices?.selectPersonalisedAds === true);
        } catch { npa = true; }
        const finalCanRequestAds = FORCE_ADS_DEBUG ? true : canRequestAds;
        (globalThis as any).__NPA__ = npa;
        (globalThis as any).__CAN_REQUEST_ADS__ = finalCanRequestAds;
        const waitForATT = async (maxMs = 12000) => {
          if (Platform.OS !== "ios") return;
          const start = Date.now();
          while (!(globalThis as any).__ATT_DONE__ && Date.now() - start < maxMs) {
            await new Promise((r) => setTimeout(r, 50));
          }
        };
        await waitForATT(6000);
        const requestConfig: RequestConfiguration = { tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: MaxAdContentRating.PG };
        await mobileAds().setRequestConfiguration(requestConfig);
        await mobileAds().initialize();
        if (!cancelled) (globalThis as any).__ADS_READY__ = true;
      } catch {
        try {
          const requestConfig: RequestConfiguration = { tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: MaxAdContentRating.PG };
          await mobileAds().setRequestConfiguration(requestConfig);
          await mobileAds().initialize();
        } catch {}
        if (!cancelled) {
          (globalThis as any).__NPA__ = true;
          (globalThis as any).__CAN_REQUEST_ADS__ = true;
          (globalThis as any).__ADS_READY__ = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return <>{children}</>;
};

// =========================
// ATTBootstrap (inchangé)
// =========================
const ATTBootstrap: React.FC = () => {
  const pathname = usePathname();
  const startedRef = React.useRef(false);
  const doneRef = React.useRef(false);
  useEffect(() => {
    (globalThis as any).__ATT_DONE__ = (globalThis as any).__ATT_DONE__ ?? false;
    (globalThis as any).__ATT_STATUS__ = (globalThis as any).__ATT_STATUS__ ?? "unknown";
  }, []);
  useEffect(() => {
    if (Platform.OS !== "ios") {
      (globalThis as any).__ATT_STATUS__ = "not-ios";
      (globalThis as any).__ATT_DONE__ = true;
      doneRef.current = true;
      return;
    }
    const isStable = pathname === "/login" || pathname === "/register" || pathname === "/(tabs)" || (typeof pathname === "string" && pathname.startsWith("/(tabs)/"));
    if (!isStable || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    const run = async () => {
      try {
        if (AppState.currentState !== "active") {
          await new Promise<void>((resolve) => {
            const sub = AppState.addEventListener("change", (s) => { if (s === "active") { sub.remove(); resolve(); } });
          });
        }
        await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
        await new Promise((r) => setTimeout(r, 900));
        const cur = await getTrackingPermissionsAsync();
        if (cancelled) return;
        const status = cur?.status as string | undefined;
        if (status === "undetermined") {
          const req = await requestTrackingPermissionsAsync();
          (globalThis as any).__ATT_STATUS__ = (req?.status as any) ?? "unknown";
        } else {
          (globalThis as any).__ATT_STATUS__ = status ?? "unknown";
        }
      } catch {
        (globalThis as any).__ATT_STATUS__ = "error";
      } finally {
        if (!cancelled) { (globalThis as any).__ATT_DONE__ = true; doneRef.current = true; }
      }
    };
    run();
    const t = setTimeout(() => { if (!doneRef.current) (globalThis as any).__ATT_DONE__ = true; }, 12000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pathname]);
  return null;
};

// =========================
// DeepLinkManager (inchangé, utilise inviteBootOn/Off globaux)
// =========================
const DeepLinkManager: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { flags } = useFlags();
  const { user, loading, checkingAuth } = useAuth();
  const lastUrlRef = React.useRef<string | null>(null);
  const handledInitialRef = React.useRef(false);

  const getGlobalLast = () => (globalThis as any).__DL_LAST_URL__ as string | undefined;
  const setGlobalLast = (u: string) => { (globalThis as any).__DL_LAST_URL__ = u; };
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
      const globalLast = getGlobalLast();
      if (globalLast === url) return;
      setGlobalLast(url);
      if (lastUrlRef.current === url) return;
      lastUrlRef.current = url;

      const parsed = Linking.parse(url);
      const path = parsed.path || "";
      const qp = (parsed.queryParams || {}) as Record<string, any>;

      // 1) REFERRAL
      const refFromQuery = typeof qp.ref === "string" ? qp.ref : null;
      const refFromPath = path.startsWith("ref/") ? path.split("ref/")[1] : null;
      const refUid = refFromQuery || refFromPath;
      if (refUid) {
        try {
          setDLBlock(false);
          (globalThis as any).__FORCE_AUTH_FLOW__ = true;
          const cleanRef = String(refUid).trim();
          const cleanSrc = typeof qp.src === "string" ? String(qp.src).trim() : "share";
          if (!cleanRef) return;
          const target = `/ref/${cleanRef}?src=${encodeURIComponent(cleanSrc)}`;
          if (pathname !== target) router.replace(target);
        } catch {}
        return;
      }

      // 2) CHALLENGE / INVITE
      let challengeId: string | undefined;
      let inviteId: string | undefined;
      let selectedDays: number | undefined;

      const idFromQuery = typeof qp.id === "string" ? qp.id : undefined;
      const inviteFromQuery = typeof qp.invite === "string" ? qp.invite : undefined;
      const daysFromQuery = typeof qp.days === "string" || typeof qp.days === "number" ? Number(qp.days) : undefined;

      if (idFromQuery) {
        try { challengeId = decodeURIComponent(idFromQuery); } catch { challengeId = idFromQuery; }
        inviteId = inviteFromQuery;
        if (Number.isFinite(daysFromQuery) && (daysFromQuery as number) > 0) selectedDays = daysFromQuery as number;
      }

      if (!challengeId) {
        if (path.startsWith("challenge/")) {
          const raw = path.split("challenge/")[1]?.split("/")[0];
          if (raw) { try { challengeId = decodeURIComponent(raw); } catch { challengeId = raw; } }
          inviteId = inviteFromQuery;
        } else if (path.startsWith("challenge-details/")) {
          const raw = path.split("challenge-details/")[1]?.split("/")[0];
          if (raw) { try { challengeId = decodeURIComponent(raw); } catch { challengeId = raw; } }
          inviteId = inviteFromQuery;
        } else if (path === "i" && idFromQuery) {
          try { challengeId = decodeURIComponent(idFromQuery); } catch { challengeId = idFromQuery; }
          inviteId = inviteFromQuery;
        }
      }

      if (!challengeId) return;
      setDLBlock(true);

      if (!user || loading || checkingAuth) {
        try {
          await AsyncStorage.setItem("ties_pending_link", JSON.stringify({ challengeId, inviteId: inviteId || null, selectedDays: selectedDays || null, t: Date.now() }));
        } catch {}
        setDLBlock(false);
        (globalThis as any).__FORCE_AUTH_FLOW__ = true;
        return;
      }

      // ✅ Allume l'overlay AVANT de router → zéro flash blanc
      if (inviteId) inviteBootOn(String(inviteId));

      router.replace({
        pathname: "/challenge-details/[id]",
        params: inviteId
          ? { id: String(challengeId), invite: String(inviteId), days: selectedDays ? String(selectedDays) : undefined }
          : { id: String(challengeId) },
      });
      setTimeout(() => inviteBootOff(), 6500);
      setTimeout(() => { try { setDLBlock(false); } catch {} }, 1800);
    },
    [router, user, loading, checkingAuth, pathname]
  );

  useEffect(() => {
    if (!flags.enableDeepLinks) return;
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    if (!handledInitialRef.current) {
      handledInitialRef.current = true;
      Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); }).catch(() => {});
    }
    return () => sub.remove();
  }, [flags.enableDeepLinks, handleDeepLink]);

  useEffect(() => {
    if (!flags.enableDeepLinks || !user || loading || checkingAuth) return;
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
        if (inviteId) inviteBootOn(String(inviteId));
        router.replace({
          pathname: "/challenge-details/[id]",
          params: inviteId
            ? { id: String(challengeId), invite: String(inviteId), days: selectedDays ? String(selectedDays) : undefined }
            : { id: String(challengeId) },
        });
        setTimeout(() => inviteBootOff(), 6500);
        setTimeout(() => { try { setDLBlock(false); } catch {} }, 1800);
      } catch {}
    })();
  }, [flags.enableDeepLinks, user, loading, checkingAuth, router]);

  useEffect(() => {
    if (!pathname) return;
    clearDLBlockIfStale(4500);
    if (pathname.startsWith("/challenge-details/")) {
      const t = setTimeout(() => { try { setDLBlock(false); } catch {} }, 400);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return null;
};

// =========================
// NotificationsBootstrap (inchangé)
// =========================
const NotificationsBootstrap: React.FC = () => {
  const router = useRouter();
  const { show } = useToast();
  const lastNavRef = React.useRef<{ path: string; ts: number } | null>(null);
  const lastToastRef = React.useRef<{ text: string; ts: number } | null>(null);

  const safeNavigate = React.useCallback((path: string) => {
    if (!path) return;
    const now = Date.now();
    const last = lastNavRef.current;
    if (last && last.path === path && now - last.ts < 1200) return;
    lastNavRef.current = { path, ts: now };
    (globalThis as any).__NOTIF_BLOCK_ROOT_REDIRECT__ = true;
    router.push(path);
  }, [router]);

  const safeToast = React.useCallback((text: string, kind: "success" | "info" | "error" = "info") => {
    const t = String(text || "").trim();
    if (!t) return;
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.text === t && now - last.ts < 1200) return;
    lastToastRef.current = { text: t, ts: now };
    show(t, kind);
  }, [show]);

  useEffect(() => {
    if (Platform.OS === "android") ensureAndroidChannelAsync().catch(() => {});
  }, []);

  useEffect(() => {
    startNotificationResponseListener((path) => safeNavigate(path), () => {});
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data: any = last?.notification?.request?.content?.data || null;
        if (!data) return;
        markNotifHandledOnColdStart();
        const path = getPathFromNotificationData(data);
        safeNavigate(path);
        const type = String(data?.type || data?.__tag || "").toLowerCase();
        if (type === "daily-reminder") rescheduleNextDailyIfNeeded().catch(() => {});
      } catch {}
    })().catch(() => {});
    return () => stopNotificationResponseListener();
  }, [safeNavigate, safeToast]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notif) => {
      const data: any = notif?.request?.content?.data || {};
      if (data?.type === "daily-reminder") rescheduleNextDailyIfNeeded().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  return null;
};

// =========================
// ✅ RootInviteBoot API globale — SOURCE DE VÉRITÉ
// =========================

export type InviteBootPhase = 0 | 1 | 2 | 3;
// 0 = idle/off
// 1 = step 1 active  (vérification invitation)
// 2 = step 1 done, step 2 active  (chargement défi)
// 3 = step 1&2 done, step 3 active  (prêt)

type InviteBootState = {
  on: boolean;
  token: string | null;
  ts: number;
  phase: InviteBootPhase;
};

const INVITE_BOOT_WATCHDOG_MS = 8000;

const ensureInviteBootAPI = () => {
  const g = globalThis as any;
  if (!g.__INVITE_BOOT__) {
    g.__INVITE_BOOT__ = { on: false, token: null, ts: 0, phase: 0 } as InviteBootState;
  }
  if (typeof g.__INVITE_BOOT_ON__ !== "function") {
    g.__INVITE_BOOT_ON__ = (token?: string) => {
      const safeToken = typeof token === "string" && token.trim().length > 0 ? token.trim() : "boot";
      g.__INVITE_BOOT__ = { on: true, token: safeToken, ts: Date.now(), phase: 1 } as InviteBootState;
    };
  }
  if (typeof g.__INVITE_BOOT_OFF__ !== "function") {
    g.__INVITE_BOOT_OFF__ = () => {
      g.__INVITE_BOOT__ = { on: false, token: null, ts: 0, phase: 0 } as InviteBootState;
    };
  }
  // ✅ Avance la phase (pilotable depuis challenge-details)
  if (typeof g.__INVITE_BOOT_SET_PHASE__ !== "function") {
    g.__INVITE_BOOT_SET_PHASE__ = (phase: InviteBootPhase) => {
      if (!g.__INVITE_BOOT__?.on) return;
      g.__INVITE_BOOT__ = { ...(g.__INVITE_BOOT__ as InviteBootState), phase };
    };
  }
};

/** Allume l'overlay et démarre en phase 1 */
export const inviteBootOn = (token?: string) => {
  try { ensureInviteBootAPI(); (globalThis as any).__INVITE_BOOT_ON__?.(token); } catch {}
};

/** Éteint l'overlay */
export const inviteBootOff = () => {
  try { ensureInviteBootAPI(); (globalThis as any).__INVITE_BOOT_OFF__?.(); } catch {}
};

/** Avance la phase (1→2→3) depuis challenge-details */
export const inviteBootSetPhase = (phase: InviteBootPhase) => {
  try { ensureInviteBootAPI(); (globalThis as any).__INVITE_BOOT_SET_PHASE__?.(phase); } catch {}
};

// =========================
// BootStep — un pas animé (checkmark / dot / idle)
// =========================
type BootStepState = "idle" | "active" | "done";

const BootStep = React.memo(function BootStep({
  label,
  doneLabel,
  state,
  entryDelay,
}: {
  label: string;
  doneLabel: string;
  state: BootStepState;
  entryDelay: number;
}) {
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const dotGlow = useSharedValue(0);
  const rowOpacity = useSharedValue(state === "idle" ? 0.28 : 1);
  const prevStateRef = useRef<BootStepState>(state);

  useEffect(() => {
    if (prevStateRef.current === state) return;
    prevStateRef.current = state;

    if (state === "active") {
      rowOpacity.value = withTiming(1, { duration: 260 });
      dotGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(0.4, { duration: 700, easing: Easing.in(Easing.quad) })
        ),
        -1, false
      );
    } else if (state === "done") {
      dotGlow.value = withTiming(0, { duration: 180 });
      rowOpacity.value = withTiming(1, { duration: 200 });
      checkScale.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 280 }));
      checkOpacity.value = withDelay(80, withTiming(1, { duration: 180 }));
    }
  }, [state]);

  // init si déjà done au montage (cas remount)
  useEffect(() => {
    if (state === "done") {
      checkScale.value = 1;
      checkOpacity.value = 1;
    }
  }, []);

  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.value }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dotGlow.value, [0, 1], [0.5, 1]),
    transform: [{ scale: interpolate(dotGlow.value, [0, 1], [0.85, 1.1]) }],
    shadowOpacity: interpolate(dotGlow.value, [0, 1], [0.3, 0.9]),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const isDone = state === "done";
  const isActive = state === "active";

  return (
    <Animated.View
      entering={FadeInUp.delay(entryDelay).duration(260)}
      style={[stylesOverlay.stepRow, rowStyle]}
    >
      <View style={stylesOverlay.stepIconBox}>
        {isDone ? (
          <Animated.View style={[stylesOverlay.checkCircle, checkStyle]}>
            <Text style={stylesOverlay.checkMark}>✓</Text>
          </Animated.View>
        ) : isActive ? (
          <Animated.View style={[stylesOverlay.activeDot, dotStyle]} />
        ) : (
          <View style={stylesOverlay.idleDot} />
        )}
      </View>

      <Text
        style={[
          stylesOverlay.stepLabel,
          isDone && stylesOverlay.stepLabelDone,
          isActive && stylesOverlay.stepLabelActive,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {isDone ? doneLabel : label}
      </Text>
    </Animated.View>
  );
});

// =========================
// ✅ RootInviteBootOverlay — TOP MONDE
// Cinématique, 3 phases, i18n, zéro freeze
// =========================
const RootInviteBootOverlay: React.FC = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [boot, setBoot] = React.useState<InviteBootState>(() => {
    ensureInviteBootAPI();
    return ((globalThis as any).__INVITE_BOOT__ || { on: false, token: null, ts: 0, phase: 0 }) as InviteBootState;
  });

  // ─── Animations partagées ────────────────────────────────────────────────
  const logoScale = useSharedValue(0.82);
  const logoBorderOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-100);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(10);

  // ─── Poll global state ───────────────────────────────────────────────────
  useEffect(() => {
    ensureInviteBootAPI();
    let mounted = true;
    const read = () => {
      const cur = (globalThis as any).__INVITE_BOOT__ as InviteBootState | undefined;
      const next: InviteBootState = cur || { on: false, token: null, ts: 0, phase: 0 };
      setBoot((prev) => {
        if (prev.on === next.on && prev.token === next.token && prev.ts === next.ts && prev.phase === next.phase) return prev;
        return { ...next };
      });
    };
    read();
    const id = setInterval(() => mounted && read(), 100);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // ─── Coupe si hors challenge-details ─────────────────────────────────────
  useEffect(() => {
    if (!boot.on) return;
    const allowed = typeof pathname === "string" && pathname.startsWith("/challenge-details/");
    if (!allowed) inviteBootOff();
  }, [boot.on, pathname]);

  // ─── Watchdog 8s ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!boot.on) return;
    const id = setTimeout(() => {
      const g = globalThis as any;
      const cur = g.__INVITE_BOOT__ as InviteBootState | undefined;
      if (cur?.on && Date.now() - (cur.ts || 0) >= INVITE_BOOT_WATCHDOG_MS) {
        g.__INVITE_BOOT_OFF__?.();
      }
    }, INVITE_BOOT_WATCHDOG_MS + 100);
    return () => clearTimeout(id);
  }, [boot.on, boot.ts]);

  // ─── Entrée : animations cinématiques ─────────────────────────────────────
  useEffect(() => {
    if (!boot.on) return;

    // Logo pop
    logoScale.value = 0.82;
    logoScale.value = withSpring(1, { damping: 14, stiffness: 180 });
    logoBorderOpacity.value = withTiming(1, { duration: 380 });

    // Ring pulse externe
    ringOpacity.value = 0;
    ringScale.value = 1;
    ringOpacity.value = withDelay(200, withTiming(0.6, { duration: 300 }));
    ringScale.value = withDelay(200, withRepeat(
      withSequence(
        withTiming(1.28, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1000, easing: Easing.in(Easing.quad) })
      ),
      -1, false
    ));
    ringOpacity.value = withDelay(500, withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1100 }),
        withTiming(0.16, { duration: 1000 })
      ),
      -1, false
    ));

    // Shimmer en boucle
    shimmerX.value = -120;
    shimmerX.value = withRepeat(
      withTiming(120, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1, false
    );

    // Titre fade-in
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 350 }));
    titleY.value = withDelay(100, withSpring(0, { damping: 18, stiffness: 180 }));
  }, [boot.on]);

  // ─── Animated styles ──────────────────────────────────────────────────────
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));
  const logoBorderStyle = useAnimatedStyle(() => ({
    opacity: logoBorderOpacity.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  // ─── Phases → états des steps ─────────────────────────────────────────────
  const step1: BootStepState = boot.phase <= 0 ? "idle" : boot.phase === 1 ? "active" : "done";
  const step2: BootStepState = boot.phase <= 1 ? "idle" : boot.phase === 2 ? "active" : "done";
  const step3: BootStepState = boot.phase <= 2 ? "idle" : "active";

  if (!boot.on) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(240)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, stylesOverlay.root]}
    >
      {/* ── Fond gradient cinématique ────────────────────────────────── */}
      <LinearGradient
        colors={["#04060F", "#080C18", "#050810"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Halo ambiant doré centré, très subtil */}
      <View style={stylesOverlay.ambientHalo} pointerEvents="none" />

      {/* ── Corps centré ─────────────────────────────────────────────── */}
      <View
        style={[
          stylesOverlay.inner,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >

        {/* Zone logo */}
        <View style={stylesOverlay.logoZone}>
          {/* Ring externe pulsant */}
          <Animated.View style={[stylesOverlay.logoRingOuter, ringStyle]} />
          {/* Ring intermédiaire fixe */}
          <Animated.View style={[stylesOverlay.logoRingInner, logoBorderStyle]} />

          {/* Logo pill avec shimmer */}
          <Animated.View style={[stylesOverlay.logoPill, logoStyle]}>
            {/* Shimmer animé */}
            <View style={stylesOverlay.shimmerClip} pointerEvents="none">
              <Animated.View style={[stylesOverlay.shimmerBeam, shimmerStyle]} />
            </View>
            <Text style={stylesOverlay.logoText}>TIES</Text>
          </Animated.View>
        </View>

        {/* Titre animé */}
        <Animated.Text style={[stylesOverlay.title, titleStyle]} numberOfLines={2}>
          {t("invite.bootTitle", { defaultValue: "Préparation de ton invitation…" })}
        </Animated.Text>

        {/* Divider doré */}
        <Animated.View
          entering={FadeInUp.delay(140).duration(280)}
          style={stylesOverlay.divider}
        />

        {/* Steps 1 / 2 / 3 */}
        <View style={stylesOverlay.stepsContainer}>
          <BootStep
            entryDelay={0}
            state={step1}
            label={t("invite.bootStep1", { defaultValue: "Vérification de l'invitation" })}
            doneLabel={t("invite.bootStep1Done", { defaultValue: "Invitation vérifiée" })}
          />
          <BootStep
            entryDelay={80}
            state={step2}
            label={t("invite.bootStep2", { defaultValue: "Chargement du défi" })}
            doneLabel={t("invite.bootStep2Done", { defaultValue: "Défi chargé" })}
          />
          <BootStep
            entryDelay={160}
            state={step3}
            label={t("invite.bootStep3", { defaultValue: "Prêt à démarrer" })}
            doneLabel={t("invite.bootStep3Done", { defaultValue: "C'est parti !" })}
          />
        </View>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeInUp.delay(260).duration(280)}
          style={stylesOverlay.subtitle}
          numberOfLines={2}
        >
          {t("invite.bootSubtitle", { defaultValue: "Ne ferme pas l'app, on prépare ton défi." })}
        </Animated.Text>

      </View>
    </Animated.View>
  );
};

// =========================
// Styles overlay
// =========================
const stylesOverlay = StyleSheet.create({
  root: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  ambientHalo: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    top: "50%",
    left: "50%",
    marginTop: -210,
    marginLeft: -210,
    backgroundColor: "rgba(255,215,0,0.055)",
  },

  inner: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingHorizontal: 36,
  },

  // ── Logo ────────────────────────────────────────────────────────────────
  logoZone: {
    width: 124,
    height: 124,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },

  logoRingOuter: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.22)",
  },

  logoRingInner: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },

  logoPill: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",

    // Ombre iOS
    shadowColor: "rgba(255,215,0,0.6)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },

  shimmerClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: "hidden",
  },

  shimmerBeam: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: "rgba(255,255,255,0.09)",
    transform: [{ skewX: "-20deg" }],
  },

  logoText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 21,
    letterSpacing: 1.4,
    opacity: 0.97,
  },

  // ── Title ────────────────────────────────────────────────────────────────
  title: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    opacity: 0.96,
    marginBottom: 20,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    width: 36,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(255,215,0,0.42)",
    marginBottom: 26,
  },

  // ── Steps ─────────────────────────────────────────────────────────────────
  stepsContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 28,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  stepIconBox: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 5,
  },

  idleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },

  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,215,0,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  checkMark: {
    color: "#FFD700",
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
    lineHeight: 14,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },

  stepLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.48)",
    fontFamily: "Comfortaa_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },

  stepLabelActive: {
    color: "rgba(255,255,255,0.94)",
    fontFamily: "Comfortaa_700Bold",
  },

  stepLabelDone: {
    color: "rgba(255,215,0,0.78)",
  },

  // ── Subtitle ──────────────────────────────────────────────────────────────
  subtitle: {
    color: "rgba(255,255,255,0.36)",
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 6,
  },
});

// =========================
// RootLayout
// =========================
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
    ensureInviteBootAPI();
    (globalThis as any).__ATT_DONE__ = false;
    (globalThis as any).__ATT_STATUS__ = "unknown";
    const t = setTimeout(() => { (globalThis as any).__ATT_DONE__ = true; }, 15000);

    // ✅ TikTok SDK init
    TiktokBusiness.identify(
      undefined,
      undefined,
      undefined,
      undefined
    );

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
                                      <ATTBootstrap />
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
                                              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                              <Stack.Screen name="login" />
                                              <Stack.Screen name="register" />
                                              <Stack.Screen name="forgot-password" />
                                            </Stack>
                                            <AppNavigator />
                                            <TrophyModal />
                                            {/* ✅ Overlay invite boot — top-level absolu */}
                                            <RootInviteBootOverlay />
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
