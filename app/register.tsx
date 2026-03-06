import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  PixelRatio,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  InteractionManager,
  AppState,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/constants/firebase-config";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { askPermissionsOnceAfterSignup } from "../services/permissionsOnboarding";
import * as HapticsModule from "expo-haptics";
import { useNavGuard } from "@/hooks/useNavGuard";
import { logEvent } from "@/src/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import { Easing as RNEasing } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Localization from "expo-localization";
import {
  isUsernameAvailable,
  getUsernameSuggestions,
  reserveUsernameAtomic,
  validateUsernameFormat,
  normalizeUsername,
} from "../services/usernameService";

// ─── Referral helpers ────────────────────────────────────────────────────────

async function readPendingReferral() {
  const entries = await AsyncStorage.multiGet([
    "ties_referrer_id", "ties_referrer_src", "ties_referrer_ts",
    "referrer_id", "referrer_src", "referrer_ts",
  ]);
  const map = Object.fromEntries(entries);
  const referrerId = String((map["ties_referrer_id"] ?? map["referrer_id"] ?? "") || "").trim();
  const src = String((map["ties_referrer_src"] ?? map["referrer_src"] ?? "share") || "share").trim();
  const tsRaw = String((map["ties_referrer_ts"] ?? map["referrer_ts"] ?? "") || "").trim();
  const ts = tsRaw ? Number(tsRaw) : null;
  return { referrerId, src, ts };
}

async function consumePendingReferral() {
  await AsyncStorage.multiRemove([
    "ties_referrer_id", "ties_referrer_src", "ties_referrer_ts",
    "referrer_id", "referrer_src", "referrer_ts",
  ]);
}

// ─── Language detection ───────────────────────────────────────────────────────

const SUPPORTED_LANGS = new Set([
  "fr","en","es","de","it","pt","zh","ja","ko","ar","hi","ru","nl",
]);

function resolveDeviceLanguage(): string {
  const locales = (
    typeof Localization.getLocales === "function" ? Localization.getLocales() : []
  ) as Array<{ languageTag?: string; languageCode?: string }>;
  const first = locales?.[0];
  const rawTag = String(first?.languageTag || "").trim();
  const rawCode = String(first?.languageCode || "").trim();
  const base = (rawTag ? rawTag.split("-")[0] : rawCode)?.toLowerCase() || "";
  return SUPPORTED_LANGS.has(base) ? base : "en";
}

// ─── Pioneer ─────────────────────────────────────────────────────────────────

const PIONEER_LIMIT = 1000;

async function grantPioneerIfAvailable() {
  const statsRef = doc(db, "meta", "pioneerStats");
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef);
    if (!snap.exists()) return { granted: false, pioneerNumber: null as number | null, limit: PIONEER_LIMIT, reason: "pioneerStats_missing" };
    const data = snap.data() as any;
    const count = Number(data?.count ?? 0);
    if (!Number.isFinite(count) || count < 0) return { granted: false, pioneerNumber: null as number | null, limit: PIONEER_LIMIT, reason: "pioneerStats_corrupt" };
    if (count >= PIONEER_LIMIT) return { granted: false, pioneerNumber: null as number | null, limit: PIONEER_LIMIT, reason: "cap_reached" };
    const pioneerNumber = count + 1;
    tx.update(statsRef, { count: pioneerNumber, updatedAt: serverTimestamp() });
    return { granted: true, pioneerNumber, limit: PIONEER_LIMIT };
  });
}

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

const BACKGROUND_COLOR = "#FFF8E7";
const PRIMARY_COLOR = "#FFB800";
const TEXT_COLOR = "#333";
const BUTTON_COLOR = "#FFFFFF";
const circleSize = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.85;
const circleTop = SCREEN_HEIGHT * 0.35;
const waveCount = 4;
const SPACING = normalize(15);

// ─── Username availability status ────────────────────────────────────────────

type UsernameStatus =
  | "idle"        // champ vide ou pas encore tapé
  | "checking"    // debounce en cours / requête Firestore
  | "available"   // ✅ dispo
  | "taken"       // ❌ pris
  | "invalid";    // format invalide

// ─── Wave background ──────────────────────────────────────────────────────────

const Wave = React.memo(({
  opacity, scale, borderWidth, size, top,
}: {
  opacity: Animated.Value; scale: Animated.Value;
  borderWidth: number; size: number; top: number;
}) => (
  <Animated.View
    collapsable={false}
    pointerEvents="none"
    renderToHardwareTextureAndroid
    shouldRasterizeIOS
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{
      width: size, height: size, borderRadius: size / 2,
      opacity, transform: [{ scale }],
      borderWidth, borderColor: PRIMARY_COLOR,
      position: "absolute", top,
      backfaceVisibility: "hidden",
      left: (SCREEN_WIDTH - size) / 2,
    }}
  />
));

// ─── Register Component ───────────────────────────────────────────────────────

type RegisterStep = 1 | 2;

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const nav = useNavGuard(router);

  // ── Referral purge ──
  useEffect(() => {
    (async () => {
      try {
        const { referrerId } = await readPendingReferral();
        if (!referrerId) await consumePendingReferral();
      } catch {}
    })();
  }, []);

  // ── Step state ──
  const [step, setStep] = useState<RegisterStep>(1);

  // ── Form state ──
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername]             = useState("");

  // ── Username availability ──
  const [usernameStatus, setUsernameStatus]       = useState<UsernameStatus>("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef      = useRef<string>("");        // évite les re-checks inutiles

  // ── UI state ──
  const [loading, setLoading]                     = useState(false);
  const [errorMessage, setErrorMessage]           = useState("");
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOffline, setIsOffline]                 = useState(false);
  const [reduceMotion, setReduceMotion]           = useState(false);
  const [focusedField, setFocusedField]           = useState<"email" | "password" | "confirm" | "username" | null>(null);

  // ── Refs ──
  const emailRef       = useRef<TextInput | null>(null);
  const passwordRef    = useRef<TextInput | null>(null);
  const confirmRef     = useRef<TextInput | null>(null);
  const usernameRef    = useRef<TextInput | null>(null);
  const isMountedRef   = useRef(true);
  const submittingRef  = useRef(false);
  const clearErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef    = useRef(AppState.currentState);
  const animsRef       = useRef<Animated.CompositeAnimation[]>([]);

  // ── Animated values ──
  const formOpacity    = useRef(new Animated.Value(0)).current;
  const formTranslate  = useRef(new Animated.Value(12)).current;
  const ctaScale       = useRef(new Animated.Value(1)).current;
  const ctaPulse       = useRef(new Animated.Value(1)).current;
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const stepOpacity    = useRef(new Animated.Value(1)).current;
  const stepTranslate  = useRef(new Animated.Value(0)).current;

  const isFocused = useIsFocused();

  // ── Password rules ──
  const passwordRules = useMemo(() => {
    const minOk = password.trim().length >= 6;
    return { minOk, min: 6 };
  }, [password]);

  // ── Validation ──
  const isValidEmail = useCallback((e: string) => /\S+@\S+\.\S+/.test(e), []);

  const step1Valid = useMemo(() =>
    isValidEmail(email.trim()) &&
    password.trim().length >= 6 &&
    confirmPassword.trim() === password.trim(),
    [email, password, confirmPassword, isValidEmail]
  );

  // Step 2 valid : format ok + statut dispo (ou idle si pas encore vérifié)
  const step2Valid = useMemo(() =>
    username.trim().length >= 2 &&
    validateUsernameFormat(username) === null &&
    (usernameStatus === "available" || usernameStatus === "idle"),
    [username, usernameStatus]
  );

  // ── Focus hint ──
  const focusHint = useMemo(() => {
    if (focusedField === "password")
      return t("passwordHint", { min: passwordRules.min, defaultValue: `Min ${passwordRules.min} caractères.` }) as string;
    if (focusedField === "confirm")
      return t("confirmPasswordHint", { defaultValue: "Doit être identique au mot de passe." }) as string;
    if (focusedField === "username") {
      const fmt = validateUsernameFormat(username);
      if (fmt === "invalid_chars")
        return t("usernameInvalidChars", { defaultValue: "Lettres, chiffres, _, - et . uniquement." }) as string;
      if (fmt === "too_long")
        return t("usernameTooLong", { defaultValue: "30 caractères maximum." }) as string;
      return t("usernameHint", { defaultValue: "2 à 30 caractères. Visible par les autres." }) as string;
    }
    return "";
  }, [focusedField, t, passwordRules.min, username]);

  // ── Waves ──
  const wavesRef = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  );
  const waves = wavesRef.current;

  // ── Wave animation ──
  useEffect(() => {
    const buildAnims = () => waves.map((wave, index) =>
      Animated.loop(Animated.parallel([
        Animated.sequence([
          Animated.timing(wave.opacity, { toValue: 0.1, duration: 2000 + index * 200, useNativeDriver: true }),
          Animated.timing(wave.opacity, { toValue: 0.3 - index * 0.05, duration: 2000 + index * 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wave.scale, { toValue: 1.2 + index * 0.2, duration: 2200 + index * 250, useNativeDriver: true }),
          Animated.timing(wave.scale, { toValue: 1, duration: 2200 + index * 250, useNativeDriver: true }),
        ]),
      ]))
    );
    const start = () => {
      if (!isFocused || appStateRef.current !== "active" || reduceMotion) return;
      animsRef.current = buildAnims();
      animsRef.current.forEach((a) => a.start());
    };
    const stop = () => { animsRef.current.forEach((a) => a.stop()); animsRef.current = []; };
    if (isFocused) start(); else stop();
    const sub = AppState.addEventListener("change", (s) => {
      appStateRef.current = s;
      if (s === "active" && isFocused) start(); else stop();
    });
    return () => { sub.remove(); stop(); };
  }, [isFocused, waves, reduceMotion]);

  // ── Network ──
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      setIsOffline(s.isConnected === false || s.isInternetReachable === false);
    });
    return () => sub && sub();
  }, []);

  // ── CTA pulse ──
  useEffect(() => {
    const valid = step === 1 ? step1Valid : step2Valid;
    let loop: Animated.CompositeAnimation | null = null;
    if (valid && !loading && !isOffline && !reduceMotion) {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1.02, duration: 650, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
    }
    return () => loop?.stop();
  }, [step1Valid, step2Valid, step, loading, isOffline, reduceMotion, ctaPulse]);

  // ── Accessibility ──
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduceMotion(!!v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => { setReduceMotion(!!v); });
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  // ── Unmount cleanup ──
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (clearErrorTimeoutRef.current) clearTimeout(clearErrorTimeoutRef.current);
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, []);

  // ── Form entrance anim ──
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(formTranslate, { toValue: 0, duration: 300, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return () => task.cancel();
  }, []);

  // ─── Username availability check (debounced, temps réel) ──────────────────
  const checkUsernameAvailability = useCallback(async (value: string) => {
    const trimmed = value.trim();

    // Reset si vide
    if (trimmed.length < 2) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    // Validation format d'abord (local, instantané)
    const formatError = validateUsernameFormat(trimmed);
    if (formatError) {
      setUsernameStatus("invalid");
      setUsernameSuggestions([]);
      return;
    }

    // Évite une requête inutile si même valeur déjà vérifiée
    const key = normalizeUsername(trimmed);
    if (key === lastCheckedRef.current && usernameStatus !== "idle") return;

    setUsernameStatus("checking");
    setUsernameSuggestions([]);

    try {
      const available = await isUsernameAvailable(trimmed);
      if (!isMountedRef.current) return;

      lastCheckedRef.current = key;

      if (available) {
        setUsernameStatus("available");
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus("taken");
        // Génère des suggestions en background
        getUsernameSuggestions(trimmed, 3)
          .then((suggestions) => {
            if (isMountedRef.current) setUsernameSuggestions(suggestions);
          })
          .catch(() => {});
      }
    } catch {
      if (isMountedRef.current) setUsernameStatus("idle");
    }
  }, [usernameStatus]);

  // Handler onChange username avec debounce 600ms
  const handleUsernameChange = useCallback((value: string) => {
    setUsername(value);
    if (errorMessage) setErrorMessage("");

    // Reset statut immédiatement pour feedback
    if (value.trim().length < 2) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      lastCheckedRef.current = "";
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
      return;
    }

    setUsernameStatus("checking");

    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 600);
  }, [errorMessage, checkUsernameAvailability]);

  // Tap sur une suggestion → remplit le champ + vérifie dispo
  const handleSuggestionTap = useCallback((suggestion: string) => {
    setUsername(suggestion);
    setUsernameSuggestions([]);
    lastCheckedRef.current = "";
    checkUsernameAvailability(suggestion);
    HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Light).catch(() => {});
  }, [checkUsernameAvailability]);

  // ── Helpers ──
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showError = useCallback((msg: string) => {
    if (clearErrorTimeoutRef.current) { clearTimeout(clearErrorTimeoutRef.current); clearErrorTimeoutRef.current = null; }
    if (isMountedRef.current) { setErrorMessage(msg); triggerShake(); }
    clearErrorTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) setErrorMessage("");
      clearErrorTimeoutRef.current = null;
    }, 5000);
  }, [triggerShake]);

  const safeHapticsError = useCallback(async () => {
    if (reduceMotion) return;
    try { await HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType.Error); } catch {}
  }, [reduceMotion]);

  // ── Step transition ──
  const animateStepTransition = useCallback((direction: "next" | "prev") => {
    if (reduceMotion) return;
    stepOpacity.setValue(0);
    stepTranslate.setValue(direction === "next" ? 18 : -18);
    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 1, duration: 240, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }),
      Animated.timing(stepTranslate, { toValue: 0, duration: 240, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, stepOpacity, stepTranslate]);

  // ── Press feedback ──
  const disabledCTA = loading || (step === 1 ? !step1Valid : !step2Valid) || isOffline;

  const pressIn = () => {
    if (disabledCTA) return;
    if (!reduceMotion) HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(ctaScale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
  };
  const pressOut = () =>
    Animated.timing(ctaScale, { toValue: 1, duration: 120, easing: RNEasing.out(RNEasing.quad), useNativeDriver: true }).start();

  // ── Step 1 → Step 2 ──
  const handleStep1Continue = useCallback(() => {
    if (submittingRef.current || loading) return;

    if (isOffline) { showError(t("networkError") || "Problème réseau. Réessaie."); safeHapticsError(); return; }
    if (!email.trim()) { showError(t("fillEmail") || "Entre ton email"); safeHapticsError(); return; }
    if (!isValidEmail(email.trim())) { showError(t("invalidEmailFormat") || "Email invalide"); safeHapticsError(); return; }
    if (!password) { showError(t("fillPassword") || "Entre un mot de passe"); safeHapticsError(); return; }
    if (!passwordRules.minOk) { showError(t("weakPassword") || "Mot de passe trop faible."); safeHapticsError(); return; }
    if (password !== confirmPassword) { showError(t("passwordsDoNotMatch") || "Les mots de passe ne correspondent pas."); safeHapticsError(); return; }

    if (isMountedRef.current) setErrorMessage("");
    setStep(2);
    animateStepTransition("next");
    setTimeout(() => { usernameRef.current?.focus(); }, 280);
  }, [loading, isOffline, email, password, confirmPassword, passwordRules.minOk, isValidEmail, showError, safeHapticsError, animateStepTransition, t]);

  // ── Step 2 → Firebase ──
  const handleRegister = useCallback(async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    if (isMountedRef.current) setErrorMessage("");

    const trimmedUsername = username.trim();

    // Validation format
    const formatError = validateUsernameFormat(trimmedUsername);
    if (formatError === "too_short") {
      showError(t("usernameTooShort") || "Nom d'utilisateur trop court.");
      safeHapticsError(); submittingRef.current = false; return;
    }
    if (formatError === "too_long") {
      showError(t("usernameTooLong") || "Nom d'utilisateur trop long (30 max).");
      safeHapticsError(); submittingRef.current = false; return;
    }
    if (formatError === "invalid_chars") {
      showError(t("usernameInvalidChars") || "Caractères invalides dans le nom d'utilisateur.");
      safeHapticsError(); submittingRef.current = false; return;
    }

    // Bloque si "taken" déjà connu côté client
    if (usernameStatus === "taken") {
      showError(t("usernameTaken") || "Ce nom d'utilisateur est déjà pris.");
      safeHapticsError(); submittingRef.current = false; return;
    }

    // Bloque si encore en train de vérifier
    if (usernameStatus === "checking") {
      showError(t("usernameStillChecking") || "Vérification en cours, réessaie dans un instant.");
      safeHapticsError(); submittingRef.current = false; return;
    }

    setLoading(true);
    try {
      const resolvedLang = resolveDeviceLanguage();
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());

      try {
        if (!reduceMotion) await HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType.Success);
      } catch {}

      const user   = userCredential.user;
      const userId = user.uid;

      try { await updateProfile(user, { displayName: trimmedUsername }); } catch {}

      // Permissions
      let notificationsGranted = false;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === "undetermined") {
          const { status: asked } = await Notifications.requestPermissionsAsync();
          notificationsGranted = asked === "granted";
        } else {
          notificationsGranted = status === "granted";
        }
      } catch { notificationsGranted = false; }

      // Pioneer check
      const userRef = doc(db, "users", userId);
      let existingSnap;
      try { existingSnap = await getDoc(userRef); } catch (e) { console.log("[register] getDoc error:", e); }

      const existingData = existingSnap?.exists() ? (existingSnap.data() as any) : null;
      const alreadyDecided = existingData?.pioneerRewardGranted === true || existingData?.isPioneer === true;

      let pioneer = { granted: false, pioneerNumber: null as number | null, limit: 1000 };
      if (!alreadyDecided) {
        try { pioneer = await grantPioneerIfAvailable(); } catch (e: any) {
          console.log("[register] pioneer transaction failed:", e?.code || e?.message || e);
        }
      }
      const isPioneerGrantedNow = pioneer.granted === true;

      // ── Réservation atomique username + écriture users/ ─────────────────
      //
      // On passe une fonction callback qui reçoit la transaction Firestore.
      // reserveUsernameAtomic s'occupe de :
      //   1. Vérifier usernames/{key} n'existe pas
      //   2. Créer usernames/{key}
      //   3. Appeler notre callback pour écrire users/{uid}
      //
      const result = await reserveUsernameAtomic(
        userId,
        trimmedUsername,
        (tx) => {
          if (!existingSnap || !existingSnap.exists()) {
            tx.set(userRef, {
              uid: userId,
              email: email.trim(),
              username: trimmedUsername,
              bio: "", location: "", profileImage: "",
              interests: [], achievements: [],
              newAchievements: ["first_connection"],
              trophies: isPioneerGrantedNow ? 50 : 0,
              totalTrophies: isPioneerGrantedNow ? 50 : 0,
              completedChallengesCount: 0,
              CompletedChallenges: [], SavedChallenges: [],
              customChallenges: [], CurrentChallenges: [],
              longestStreak: 0, shareChallenge: 0, voteFeature: 0,
              language: resolvedLang,
              locationEnabled: true,
              notificationsEnabled: notificationsGranted,
              country: "Unknown", region: "Unknown",
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
              isPioneer: isPioneerGrantedNow,
              pioneerRewardGranted: isPioneerGrantedNow,
              pioneerNumber: pioneer.pioneerNumber ?? null,
              pioneerGrantedAt: isPioneerGrantedNow ? serverTimestamp() : null,
            });
          } else {
            const data = existingData || {};
            const patch: any = { updatedAt: serverTimestamp(), username: trimmedUsername };
            if (!data.email) patch.email = email.trim();
            if (!data.bio) patch.bio = "";
            if (!data.location) patch.location = "";
            if (!data.profileImage) patch.profileImage = "";
            if (!data.interests) patch.interests = [];
            if (!data.achievements) patch.achievements = [];
            if (!data.newAchievements) patch.newAchievements = ["first_connection"];
            if (data.trophies === undefined) patch.trophies = 0;
            if (!data.CompletedChallenges) patch.CompletedChallenges = [];
            if (!data.SavedChallenges) patch.SavedChallenges = [];
            if (!data.customChallenges) patch.customChallenges = [];
            if (!data.CurrentChallenges) patch.CurrentChallenges = [];
            if (data.longestStreak === undefined) patch.longestStreak = 0;
            if (data.shareChallenge === undefined) patch.shareChallenge = 0;
            if (data.voteFeature === undefined) patch.voteFeature = 0;
            if (!data.language) patch.language = resolvedLang;
            if (!data.country) patch.country = "Unknown";
            if (!data.region) patch.region = "Unknown";
            patch.locationEnabled = data.locationEnabled ?? true;
            patch.notificationsEnabled = notificationsGranted;
            if (!data.referral) patch.referral = { activatedCount: 0, claimedMilestones: [], pendingMilestones: [] };
            if (isPioneerGrantedNow) {
              const currentTrophies = Number(data?.trophies ?? 0);
              const currentTotal = Number(data?.totalTrophies ?? currentTrophies);
              patch.isPioneer = true;
              patch.pioneerRewardGranted = true;
              patch.pioneerNumber = pioneer.pioneerNumber ?? null;
              patch.pioneerGrantedAt = serverTimestamp();
              patch.trophies = Math.max(0, Math.floor(currentTrophies)) + 50;
              patch.totalTrophies = Math.max(0, Math.floor(currentTotal)) + 50;
            }
            tx.update(userRef, patch);
          }
        }
      );

      // ── Username pris au moment du submit (race condition) ──────────────
      if (!result.success) {
        const failResult = result as Extract<typeof result, { success: false }>;
        if (failResult.reason === "taken") {
          setUsernameStatus("taken");
          // Suggestions
          getUsernameSuggestions(trimmedUsername, 3)
            .then((s) => { if (isMountedRef.current) setUsernameSuggestions(s); })
            .catch(() => {});

          showError(
            t("usernameTakenRace") ||
            "Ce nom vient d'être pris par quelqu'un d'autre. Choisis-en un autre."
          );
          safeHapticsError();
          // Retour step 2 (on y est déjà) pour re-saisie
          submittingRef.current = false;
          setLoading(false);
          return;
        }
        throw new Error(failResult.message || "reserve_failed");
      }

      // ✅ Permissions post-signup
      try { await askPermissionsOnceAfterSignup(); } catch {}

      // Analytics
      logEvent("register_success").catch(() => {});
      logEvent("signup_complete", { method: "email" }).catch(() => {});

      try { await AsyncStorage.setItem("login.lastEmail", email.trim()); } catch {}

      InteractionManager.runAfterInteractions(() => {
        if (isMountedRef.current) nav.replace("/first-pick");
      });

    } catch (error: any) {
      const code = error?.code ?? "unknown";
      console.log("🔥 register error:", code, error?.message);
      const errorMessages: Record<string, string> = {
        "auth/email-already-in-use": t("emailAlreadyInUse") || "Cet email est déjà utilisé.",
        "auth/invalid-email": t("invalidEmailFormat") || "Format d'email invalide.",
        "auth/weak-password": t("weakPassword") || "Mot de passe trop faible.",
        "auth/network-request-failed": t("networkError") || "Problème réseau. Réessaie.",
        "auth/too-many-requests": t("tooManyRequests") || "Trop de tentatives, réessaie plus tard.",
        "permission-denied": t("permissionDenied") || "Accès refusé, vérifie ta connexion ou réessaie.",
        "auth/operation-not-allowed": t("operationNotAllowed") || "Cette opération n'est pas autorisée sur ce projet.",
      };
      const baseMessage = errorMessages[code] || t("unknownError") || "Une erreur inconnue est survenue.";
      const finalMessage = __DEV__ && code !== "unknown" ? `${baseMessage} (${code})` : baseMessage;

      if (code.startsWith("auth/")) {
        setStep(1);
        animateStepTransition("prev");
        setTimeout(() => emailRef.current?.focus(), 280);
      }

      showError(finalMessage);
      safeHapticsError();
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    loading, username, email, password, reduceMotion, usernameStatus,
    showError, safeHapticsError, t, nav, animateStepTransition,
  ]);

  // ── Back to step 1 ──
  const goBackToStep1 = useCallback(() => {
    if (loading) return;
    setStep(1);
    animateStepTransition("prev");
    setTimeout(() => emailRef.current?.focus(), 280);
  }, [loading, animateStepTransition]);

  // ── Navigation ──
  const guarded = <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) => { if (loading || submittingRef.current) return; return fn(...args); };
  const goLogin = guarded(() => nav.replace("/login"));

  // ── Progress indicator ──
  const progressText = step === 1 ? "1/2" : "2/2";

  // ── Username status UI ────────────────────────────────────────────────────
  const usernameStatusIcon = useMemo((): { name: keyof typeof Ionicons.glyphMap; color: string } | null => {
    switch (usernameStatus) {
      case "available": return { name: "checkmark-circle", color: "#22C55E" };
      case "taken":     return { name: "close-circle",     color: "#EF4444" };
      case "invalid":   return { name: "warning",          color: "#F59E0B" };
      case "checking":  return null; // ActivityIndicator à la place
      default:          return null;
    }
  }, [usernameStatus]);

  const usernameStatusText = useMemo(() => {
    switch (usernameStatus) {
      case "available": return t("usernameAvailable", { defaultValue: "Disponible !" });
      case "taken":     return t("usernameTaken",     { defaultValue: "Déjà pris" });
      case "invalid":   return "";   // géré par focusHint
      case "checking":  return t("usernameChecking", { defaultValue: "Vérification…" });
      default:          return "";
    }
  }, [usernameStatus, t]);

  const usernameStatusColor = useMemo(() => {
    switch (usernameStatus) {
      case "available": return "#22C55E";
      case "taken":     return "#EF4444";
      case "checking":  return "rgba(0,0,0,0.45)";
      default:          return "transparent";
    }
  }, [usernameStatus]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.flexContainer, { backgroundColor: BACKGROUND_COLOR }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? normalize(60) : 0}
    >
      <ExpoStatusBar style="dark" backgroundColor={BACKGROUND_COLOR} />

      {/* Waves */}
      {waves.map((wave, index) => (
        <Wave key={index} opacity={wave.opacity} scale={wave.scale} borderWidth={wave.borderWidth} size={circleSize} top={circleTop} />
      ))}

      <ScrollView
        style={[styles.flexContainer, { backgroundColor: "transparent" }]}
        contentContainerStyle={[styles.container, { minHeight: SCREEN_HEIGHT, paddingBottom: SPACING * 2 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.topBar}>
            {step === 2 ? (
              <TouchableOpacity
                onPress={goBackToStep1}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t("common.back", { defaultValue: "Retour" }) as string}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={18} color={PRIMARY_COLOR} />
                <Text style={styles.backText}>{t("common.back", { defaultValue: "Retour" })}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 70 }} />
            )}

            <View style={styles.progressPill}>
              <Text style={styles.progressText}>{progressText}</Text>
            </View>

            <View style={{ width: 70 }} />
          </View>

          <Text
            style={styles.brandTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            accessibilityLabel={t("appTitle")}
            accessibilityRole="header"
          >
            <Text style={styles.highlight}>C</Text>hallenge
            <Text style={styles.highlight}>T</Text>ies
          </Text>
          <Text style={styles.tagline}>{t("joinUsAndChallenge")}</Text>
        </View>

        {/* Offline banner */}
        {isOffline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color="#111827" />
            <Text style={styles.offlineText}>{t("networkError") || "Connexion réseau indisponible"}</Text>
          </View>
        )}

        {/* Step animated card */}
        <Animated.View
          style={[
            styles.card,
            { opacity: formOpacity, transform: [{ translateY: formTranslate }] },
          ]}
          accessibilityLabel={t("registrationForm")}
          accessible
        >
          <Animated.View style={{ opacity: stepOpacity, transform: [{ translateY: stepTranslate }] }}>

            {/* Error banner */}
            {!!errorMessage && (
              <Animated.View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.errorBanner, { transform: [{ translateX: shakeAnim }] }]}
              >
                <Ionicons name="alert-circle" size={18} color="#fff" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </Animated.View>
            )}

            {/* ── STEP 1 : Email + Password ── */}
            {step === 1 && (
              <>
                <Text style={styles.stepLabel}>{t("register.step1.label", { defaultValue: "Ton compte" })}</Text>

                {/* Email */}
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
                  <TextInput
                    ref={emailRef}
                    autoFocus
                    placeholder={t("emailPlaceholder")}
                    placeholderTextColor="rgba(50,50,50,0.5)"
                    style={styles.input}
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (errorMessage) setErrorMessage(""); }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField((f) => f === "email" ? null : f)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel={t("email")}
                    autoComplete="email"
                    autoCorrect={false}
                    testID="email-input"
                    maxLength={100}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  {!!email && (
                    <TouchableOpacity onPress={() => setEmail("")} style={styles.trailingBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.35)" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Password */}
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
                  <TextInput
                    ref={passwordRef}
                    placeholder={t("passwordPlaceholder")}
                    placeholderTextColor="rgba(50,50,50,0.5)"
                    style={styles.input}
                    value={password}
                    onChangeText={(v) => { setPassword(v); if (errorMessage) setErrorMessage(""); }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField((f) => f === "password" ? null : f)}
                    secureTextEntry={!showPassword}
                    accessibilityLabel={t("password")}
                    autoComplete="new-password"
                    testID="password-input"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.trailingBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                </View>

                {/* Confirm password */}
                <View style={styles.inputWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
                  <TextInput
                    ref={confirmRef}
                    placeholder={t("confirmPassword")}
                    placeholderTextColor="rgba(50,50,50,0.5)"
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); if (errorMessage) setErrorMessage(""); }}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField((f) => f === "confirm" ? null : f)}
                    secureTextEntry={!showConfirmPassword}
                    accessibilityLabel={t("confirmPassword")}
                    autoComplete="new-password"
                    testID="confirm-password-input"
                    textContentType="newPassword"
                    maxLength={100}
                    returnKeyType="done"
                    onSubmitEditing={step1Valid ? handleStep1Continue : undefined}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword((p) => !p)} style={styles.trailingBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── STEP 2 : Username ── */}
            {step === 2 && (
              <>
                <Text style={styles.stepLabel}>{t("register.step2.label", { defaultValue: "Ton identité" })}</Text>

                <Text style={styles.step2Intro}>
                  {t("register.step2.intro", { defaultValue: "Comment veux-tu qu'on t'appelle ?" })}
                </Text>

                {/* Username input */}
                <View
                  style={[
                    styles.inputWrap,
                    usernameStatus === "available" && styles.inputWrapSuccess,
                    usernameStatus === "taken"     && styles.inputWrapError,
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={PRIMARY_COLOR} style={styles.leadingIcon} />
                  <TextInput
                    ref={usernameRef}
                    placeholder={t("username")}
                    placeholderTextColor="rgba(50,50,50,0.5)"
                    style={styles.input}
                    value={username}
                    onChangeText={handleUsernameChange}
                    onFocus={() => setFocusedField("username")}
                    onBlur={() => setFocusedField((f) => f === "username" ? null : f)}
                    accessibilityLabel={t("username")}
                    autoComplete="username"
                    testID="username-input"
                    autoCorrect={false}
                    autoCapitalize="none"
                    maxLength={30}
                    textContentType="username"
                    returnKeyType="done"
                    onSubmitEditing={step2Valid ? handleRegister : undefined}
                  />

                  {/* Trailing : spinner ou icône statut */}
                  {usernameStatus === "checking" ? (
                    <ActivityIndicator
                      size="small"
                      color={PRIMARY_COLOR}
                      style={styles.trailingBtn}
                    />
                  ) : usernameStatusIcon ? (
                    <Ionicons
                      name={usernameStatusIcon.name}
                      size={20}
                      color={usernameStatusIcon.color}
                      style={styles.trailingBtn}
                    />
                  ) : null}
                </View>

                {/* Status label (Disponible / Déjà pris / Vérification…) */}
                {!!usernameStatusText && (
                  <Text style={[styles.usernameStatusText, { color: usernameStatusColor }]}>
                    {usernameStatusText}
                  </Text>
                )}

                {/* Suggestions si pris */}
                {usernameStatus === "taken" && usernameSuggestions.length > 0 && (
                  <View style={styles.suggestionsWrap}>
                    <Text style={styles.suggestionsLabel}>
                      {t("usernameSuggestionsLabel", { defaultValue: "Suggestions disponibles :" })}
                    </Text>
                    <View style={styles.suggestionsRow}>
                      {usernameSuggestions.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={styles.suggestionPill}
                          onPress={() => handleSuggestionTap(s)}
                          accessibilityRole="button"
                          accessibilityLabel={t("usernameSuggestionTap", { name: s, defaultValue: `Utiliser ${s}` })}
                        >
                          <Text style={styles.suggestionPillText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Social proof micro-copy */}
                <View style={styles.socialProofRow}>
                  <Ionicons name="people-outline" size={14} color="rgba(0,0,0,0.45)" />
                  <Text style={styles.socialProofText}>
                    {t("register.step2.socialProof", { defaultValue: "Rejoins des centaines de personnes qui tiennent leurs défis." })}
                  </Text>
                </View>
              </>
            )}

            {/* Focus hint */}
            {!!focusHint && (
              <View style={styles.hintRow} accessibilityLiveRegion="polite">
                <Ionicons name="information-circle-outline" size={16} color="rgba(0,0,0,0.55)" />
                <Text style={styles.hintText}>{focusHint}</Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: Animated.multiply(ctaScale, ctaPulse) }] }}>
          <TouchableOpacity
            style={[styles.registerButton, disabledCTA && styles.disabledButton]}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={!disabledCTA ? (step === 1 ? handleStep1Continue : handleRegister) : undefined}
            disabled={disabledCTA}
            accessibilityRole="button"
            accessibilityLabel={step === 1 ? t("common.continue", { defaultValue: "Continuer" }) : t("signup")}
            accessibilityState={{ disabled: disabledCTA }}
            testID="register-button"
          >
            {loading ? (
              <ActivityIndicator color={TEXT_COLOR} size="small" />
            ) : (
              <View style={styles.ctaInner}>
                <Text style={styles.registerButtonText}>
                  {step === 1
                    ? t("common.continue", { defaultValue: "Continuer" })
                    : t("signup")}
                </Text>
                <Ionicons
                  name={step === 1 ? "arrow-forward" : "checkmark"}
                  size={18}
                  color={TEXT_COLOR}
                />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Login link */}
        <Text style={styles.loginText} accessibilityLabel={t("login")}>
          {t("alreadyHaveAccount")}{" "}
          <Text style={styles.loginLink} onPress={goLogin} accessibilityRole="link">
            {t("loginHere")}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING * 2,
    paddingHorizontal: SPACING,
  },
  headerContainer: {
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.06,
  },

  // Top bar
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalize(12),
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  backText: {
    fontSize: normalize(13),
    color: PRIMARY_COLOR,
    fontFamily: "Comfortaa_700Bold",
  },
  progressPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,184,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.30)",
  },
  progressText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
    color: PRIMARY_COLOR,
  },

  // Brand
  brandTitle: {
    fontSize: normalize(34),
    color: TEXT_COLOR,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    maxWidth: "100%",
  },
  highlight: {
    color: PRIMARY_COLOR,
    fontSize: normalize(50),
  },
  tagline: {
    fontSize: normalize(15),
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
    maxWidth: "90%",
  },

  // Card
  card: {
    width: Math.min(420, SCREEN_WIDTH - SPACING * 2),
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: normalize(22),
    padding: SPACING,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  // Step label
  stepLabel: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_700Bold",
    color: PRIMARY_COLOR,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: normalize(10),
  },

  // Step 2 intro
  step2Intro: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    color: TEXT_COLOR,
    marginBottom: normalize(16),
    lineHeight: normalize(26),
  },

  // Inputs
  inputWrap: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: normalize(16),
    borderWidth: 1, borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12, marginBottom: 12,
  },
  inputWrapSuccess: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.04)",
  },
  inputWrapError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.04)",
  },
  leadingIcon: { marginRight: 8, opacity: 0.9 },
  trailingBtn: { marginLeft: 8, padding: 4 },
  input: {
    flex: 1, height: normalize(52), color: "#111",
    fontSize: normalize(15), fontFamily: "Comfortaa_400Regular",
  },

  // Username status
  usernameStatusText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
    marginTop: -normalize(6),
    marginBottom: normalize(8),
    marginLeft: normalize(4),
  },

  // Suggestions
  suggestionsWrap: {
    marginBottom: normalize(12),
  },
  suggestionsLabel: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(0,0,0,0.50)",
    marginBottom: normalize(8),
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: normalize(8),
  },
  suggestionPill: {
    backgroundColor: "rgba(255,184,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.35)",
    borderRadius: normalize(999),
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(7),
  },
  suggestionPillText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    color: PRIMARY_COLOR,
  },

  // Social proof
  socialProofRow: {
    flexDirection: "row", alignItems: "center",
    gap: 6, marginTop: 4, marginBottom: 4, paddingHorizontal: 2,
  },
  socialProofText: {
    flex: 1, fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(0,0,0,0.50)", lineHeight: normalize(16),
  },

  // Banners
  offlineBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FDE68A", borderColor: "rgba(0,0,0,0.08)", borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginBottom: 10,
  },
  offlineText: { color: "#111827", fontSize: normalize(12), fontFamily: "Comfortaa_700Bold" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#E11D48", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10,
  },
  errorBannerText: { color: "#fff", fontSize: normalize(13), fontFamily: "Comfortaa_700Bold", flexShrink: 1 },

  // Hint
  hintRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)",
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, marginTop: 2, marginBottom: 4,
  },
  hintText: {
    flex: 1, color: "rgba(17,24,39,0.78)", fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold", lineHeight: normalize(16),
  },

  // CTA
  ctaInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  registerButton: {
    width: Math.min(420, SCREEN_WIDTH - SPACING * 2),
    backgroundColor: BUTTON_COLOR,
    minHeight: normalize(52),
    paddingVertical: normalize(12),
    borderRadius: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACING,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(5),
  },
  disabledButton: { opacity: 0.5 },
  registerButtonText: {
    color: TEXT_COLOR, fontSize: normalize(16), fontFamily: "Comfortaa_700Bold",
  },

  // Login link
  loginText: {
    color: TEXT_COLOR, textAlign: "center", fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular", marginTop: SPACING, marginBottom: SPACING * 2,
  },
  loginLink: { color: PRIMARY_COLOR, fontFamily: "Comfortaa_400Regular" },
});
