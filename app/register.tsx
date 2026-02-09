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
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { askPermissionsOnceAfterSignup } from "../services/permissionsOnboarding";
import * as HapticsModule from "expo-haptics";
import { useNavGuard } from "@/hooks/useNavGuard";
import i18n from "../i18n";
import { logEvent } from "../src/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import { Easing as RNEasing } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Localization from "expo-localization";

async function readPendingReferral() {
  const entries = await AsyncStorage.multiGet([
    "ties_referrer_id",
    "ties_referrer_src",
    "ties_referrer_ts",
    "referrer_id",
    "referrer_src",
    "referrer_ts",
  ]);

  const map = Object.fromEntries(entries);

  const referrerId = String(
    (map["ties_referrer_id"] ?? map["referrer_id"] ?? "") || ""
  ).trim();

  const src = String(
    (map["ties_referrer_src"] ?? map["referrer_src"] ?? "share") || "share"
  ).trim();

  const tsRaw = String(
    (map["ties_referrer_ts"] ?? map["referrer_ts"] ?? "") || ""
  ).trim();

  const ts = tsRaw ? Number(tsRaw) : null;

  return { referrerId, src, ts };
}

async function consumePendingReferral() {
  await AsyncStorage.multiRemove([
    "ties_referrer_id",
    "ties_referrer_src",
    "ties_referrer_ts",
    "referrer_id",
    "referrer_src",
    "referrer_ts",
  ]);
}

const SUPPORTED_LANGS = new Set([
  "fr","en","es","de","it","pt","zh","ja","ko","ar","hi","ru","nl",
]);

function resolveDeviceLanguage(): string {
 // expo-localization (API actuelle) : on se base sur getLocales()
  // languageTag peut être "fr-FR", "en-US", etc.
  const locales =
    (typeof Localization.getLocales === "function"
      ? Localization.getLocales()
      : []) as Array<{ languageTag?: string; languageCode?: string }>;

  const first = locales?.[0];
  const rawTag = String(first?.languageTag || "").trim();
  const rawCode = String(first?.languageCode || "").trim();

  const base =
    (rawTag ? rawTag.split("-")[0] : rawCode)?.toLowerCase() || "";

  return SUPPORTED_LANGS.has(base) ? base : "en";
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

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

const Wave = React.memo(
  ({
    opacity,
    scale,
    borderWidth,
    size,
    top,
  }: {
    opacity: Animated.Value;
    scale: Animated.Value;
    borderWidth: number;
    size: number;
    top: number;
  }) => (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        transform: [{ scale }],
        borderWidth,
        borderColor: PRIMARY_COLOR,
        position: "absolute",
        top,
        backfaceVisibility: "hidden",
        left: (SCREEN_WIDTH - size) / 2,
      }}
    />
  )
);

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const nav = useNavGuard(router);
  // ✅ Purge de sécurité : évite qu’un vieux referrer traîne
 useEffect(() => {
  (async () => {
    try {
      const { referrerId } = await readPendingReferral();
      if (!referrerId) await consumePendingReferral();
    } catch {}
  })();
}, []);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [focusedField, setFocusedField] = useState<
    "email" | "username" | "password" | "confirm" | null
  >(null);

 const passwordRules = useMemo(() => {
    const p = password || "";
    const minOk = p.trim().length >= 6; // 🔁 cohérent avec ton formValid actuel
    // Si tu veux “top monde”, monte à 8 et ajoute 1 maj + 1 chiffre (je te laisse le switch)
    return { minOk, min: 6 };
  }, [password]);

  const focusHint = useMemo(() => {
    if (focusedField === "password") {
 return t("passwordHint", {
        min: passwordRules.min,
        defaultValue: `Min ${passwordRules.min} caractères.`,
      }) as string;
    }
    if (focusedField === "confirm") {
      return t("confirmPasswordHint", {
        defaultValue: "Doit être identique au mot de passe.",
      }) as string;
    }
    if (focusedField === "username") {
      return t("usernameHint", {
        defaultValue: "2 caractères minimum.",
      }) as string;
    }
    return "";
  }, [focusedField, t, passwordRules.min]);

  const isFocused = useIsFocused();
  const appStateRef = useRef(AppState.currentState);
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(12)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  const emailRef = useRef<TextInput | null>(null);
  const usernameRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmRef = useRef<TextInput | null>(null);

  // Shake pour la bannière d’erreur
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // évite setState après unmount
  const isMountedRef = useRef(true);
  const clearErrorTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  

  // Helpers
  const isValidEmail = useCallback(
    (e: string) => /\S+@\S+\.\S+/.test(e),
    []
  );

  const formValid = useMemo(
    () =>
      isValidEmail(email.trim()) &&
      username.trim().length >= 2 &&
      password.trim().length >= 6 &&
      confirmPassword.trim() === password.trim(),
    [email, username, password, confirmPassword, isValidEmail]
  );

  

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

 const showError = useCallback(
    (msg: string) => {
      if (clearErrorTimeoutRef.current) {
        clearTimeout(clearErrorTimeoutRef.current);
        clearErrorTimeoutRef.current = null;
      }
      if (isMountedRef.current) {
        setErrorMessage(msg);
        triggerShake();
      }
      clearErrorTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setErrorMessage("");
        }
        clearErrorTimeoutRef.current = null;
      }, 5000);
    },
    [triggerShake]
  );

  const safeHapticsError = useCallback(async () => {
    if (reduceMotion) return;
    try {
      await HapticsModule.notificationAsync(
        HapticsModule.NotificationFeedbackType.Error
      );
   } catch {}
  }, [reduceMotion]);

  // Vagues de fond
  const wavesRef = useRef(
    Array.from({ length: waveCount }, (_, index) => ({
      opacity: new Animated.Value(0.3 - index * 0.05),
      scale: new Animated.Value(1),
      borderWidth: index === 0 ? normalize(5) : normalize(2),
    }))
  );
  const waves = wavesRef.current;

  

  useEffect(() => {
    const buildAnims = () =>
      waves.map((wave, index) =>
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(wave.opacity, {
                toValue: 0.1,
                duration: 2000 + index * 200,
                useNativeDriver: true,
              }),
              Animated.timing(wave.opacity, {
                toValue: 0.3 - index * 0.05,
                duration: 2000 + index * 200,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(wave.scale, {
                toValue: 1.2 + index * 0.2,
                duration: 2200 + index * 250,
                useNativeDriver: true,
              }),
              Animated.timing(wave.scale, {
                toValue: 1,
                duration: 2200 + index * 250,
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      );

    const start = () => {
      if (!isFocused || appStateRef.current !== "active" || reduceMotion)
        return;
      animsRef.current = buildAnims();
      animsRef.current.forEach((a) => a.start());
    };
    const stop = () => {
      animsRef.current.forEach((a) => a.stop());
      animsRef.current = [];
    };

    if (isFocused) start();
    else stop();

    const sub = AppState.addEventListener("change", (s) => {
      appStateRef.current = s;
      if (s === "active" && isFocused) start();
      else stop();
    });

    return () => {
      sub.remove();
      stop();
    };
  }, [isFocused, waves, reduceMotion]);

  // Réseau : bannière offline
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      const off =
        s.isConnected === false ||
        s.isInternetReachable === false;
      setIsOffline(!!off);
    });
    return () => sub && sub();
  }, []);

  // Pulse CTA (respect reduceMotion + offline)
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (formValid && !loading && !isOffline && !reduceMotion) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, {
            toValue: 1.02,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(ctaPulse, {
            toValue: 1.0,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [formValid, loading, isOffline, reduceMotion, ctaPulse]);

  // Accessibilité : réduire animations
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(!!enabled);
      }
    );
    return () => {
      mounted = false;
      // @ts-ignore RN <= 0.72 compat
      sub?.remove?.();
    };
  }, []);

  // Clean unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (clearErrorTimeoutRef.current) {
        clearTimeout(clearErrorTimeoutRef.current);
        clearErrorTimeoutRef.current = null;
      }
    };
  }, []);

  // Entrée du card / form
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslate, {
          toValue: 0,
          duration: 300,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => task.cancel();
  }, []);

  // Press feedback CTA
  const disabledCTA = loading || !formValid || isOffline;

    


  const getBlockingReason = useCallback(() => {
    if (isOffline) return t("networkError") || "Connexion réseau indisponible";
    if (!email.trim()) return t("fillEmail") || "Entre ton email";
    if (!isValidEmail(email.trim()))
      return t("invalidEmailFormat") || "Email invalide";
    if (!username.trim())
      return t("fillUsername") || "Choisis un nom d’utilisateur";
    if (username.trim().length < 2)
      return t("usernameTooShort") || "Nom d’utilisateur trop court";
    if (!password) return t("fillPassword") || "Entre un mot de passe";
    if (!passwordRules.minOk)
      return (
        t("passwordMinChars", { count: passwordRules.min }) ||
        `Mot de passe: ${passwordRules.min} caractères minimum`
      );
    if (!confirmPassword) return t("confirmPassword") || "Confirme le mot de passe";
    if (confirmPassword.trim() !== password.trim())
      return t("passwordsDoNotMatch") || "Les mots de passe ne correspondent pas";
    return "";
  }, [
    isOffline,
    t,
    email,
    username,
    password,
    confirmPassword,
    isValidEmail,
    passwordRules.minOk,
    passwordRules.min,
  ]);

 const disabledHint = useMemo(() => {
    // On n’affiche pas un hint tant que l’utilisateur n’a rien touché
    const touched = !!email || !!username || !!password || !!confirmPassword;
    if (!touched) return "";
    if (!disabledCTA) return "";
    // Pendant loading => pas d’hint
    if (loading) return "";
    return getBlockingReason();
  }, [
    email,
    username,
    password,
    confirmPassword,
    disabledCTA,
    loading,
    getBlockingReason,
  ]);

  const pressIn = () => {
    if (disabledCTA) return;
    if (!reduceMotion) {
      HapticsModule.impactAsync(
      HapticsModule.ImpactFeedbackStyle.Medium
     ).catch(() => {});
    }
    Animated.timing(ctaScale, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = () =>
    Animated.timing(ctaScale, {
      toValue: 1,
      duration: 120,
      easing: RNEasing.out(RNEasing.quad),
      useNativeDriver: true,
    }).start();

  const handleRegister = async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;

    if (isMountedRef.current) setErrorMessage("");

    if (
      !email.trim() ||
      !username.trim() ||
      !password ||
      !confirmPassword
    ) {
      showError(t("fillAllFields"));
      safeHapticsError();
      submittingRef.current = false;
      return;
    }
    if (password !== confirmPassword) {
      showError(t("passwordsDoNotMatch"));
      safeHapticsError();
      submittingRef.current = false;
      return;
    }
    if (password.trim().length < 6) {
      showError(t("weakPassword"));
      safeHapticsError();
      submittingRef.current = false;
      return;
    }
    if (isOffline) {
      showError(
        t("networkError") ||
          "Problème réseau. Réessaie."
      );
      safeHapticsError();
      submittingRef.current = false;
      return;
    }

    setLoading(true);
    try {
      const resolvedLang = resolveDeviceLanguage();
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password.trim()
        );

      try {
        if (!reduceMotion) {
         await HapticsModule.notificationAsync(
           HapticsModule.NotificationFeedbackType.Success
          );
        }
      } catch {}

      const user = userCredential.user;
      const userId = user.uid;

      // displayName
      try {
        await updateProfile(user, {
          displayName: username.trim(),
        });
      } catch {}

            // Permissions & localisation (non bloquant)
      let notificationsGranted = false;
      try {
        await askPermissionsOnceAfterSignup();

        // On lit l'état réel système juste après le flow de permissions
        const { status } = await Notifications.getPermissionsAsync();
        notificationsGranted = status === "granted";
      } catch {
        // En cas d'erreur, on laisse notificationsGranted à false
        notificationsGranted = false;
      }


      // User doc Firestore (compatible avec les rules + AuthProvider)
      const userRef = doc(db, "users", userId);

      let existingSnap;
      try {
        existingSnap = await getDoc(userRef);
      } catch (e) {
        console.log("[register] getDoc users error:", e);
      }

      if (!existingSnap || !existingSnap.exists()) {
        // 👉 Doc n'existe pas encore : on peut faire un create complet (rules: allow create)
        await setDoc(userRef, {
          uid: userId,
          email: email.trim(),
          username: username.trim(),
          bio: "",
          location: "",
          profileImage: "",
          interests: [],
          achievements: [],
          newAchievements: ["first_connection"],
          trophies: 0,
          completedChallengesCount: 0,
          CompletedChallenges: [],
          SavedChallenges: [],
          customChallenges: [],
          CurrentChallenges: [],
          longestStreak: 0,
          shareChallenge: 0,
          voteFeature: 0,
          language: resolvedLang,
          locationEnabled: true,
          notificationsEnabled: notificationsGranted,
          country: "Unknown",
          region: "Unknown",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isPioneer: false,
          pioneerRewardGranted: false,
        });

      } else {
        try {
          const data = existingSnap.data() || {};
          const patch: any = {
            updatedAt: serverTimestamp(),
          };

          // Champs de base jamais mis par AuthProvider
          if (!data.email) patch.email = email.trim();
          if (!data.username) patch.username = username.trim();

          if (!data.bio) patch.bio = "";
          if (!data.location) patch.location = "";
          if (!data.profileImage) patch.profileImage = "";

          if (!data.interests) patch.interests = [];
          if (!data.achievements) patch.achievements = [];
          if (!data.newAchievements) patch.newAchievements = ["first_connection"];

          // Ne touche jamais les trophées si AuthProvider les a déjà mis
          if (data.trophies === undefined) patch.trophies = 0;

          // Listes challenges
          if (!data.CompletedChallenges) patch.CompletedChallenges = [];
          if (!data.SavedChallenges) patch.SavedChallenges = [];
          if (!data.customChallenges) patch.customChallenges = [];
          if (!data.CurrentChallenges) patch.CurrentChallenges = [];

          if (data.longestStreak === undefined) patch.longestStreak = 0;
          if (data.shareChallenge === undefined) patch.shareChallenge = 0;
          if (data.voteFeature === undefined) patch.voteFeature = 0;
          if (!data.language) patch.language = resolvedLang;

          // Localisation & permissions
          if (!data.country) patch.country = "Unknown";
          if (!data.region) patch.region = "Unknown";
          patch.locationEnabled = data.locationEnabled ?? true;
          patch.notificationsEnabled = notificationsGranted;

          // Referral baseline si inexistant
          if (!data.referral) {
            patch.referral = {
              activatedCount: 0,
              claimedMilestones: [],
              pendingMilestones: [],
            };
          }

          await updateDoc(userRef, patch);

        } catch (e) {
          console.log("[register] safePatch update error:", e);
        }
      }

            // 🔹 Analytics non bloquant : ne JAMAIS casser le register à cause d'un event
            // 🔹 Analytics non bloquant
      // 🔹 Analytics non bloquant : ne JAMAIS casser le register à cause d'un event
logEvent("register_success").catch((e: any) => {
  console.log(
    "[analytics] register_success failed:",
    e?.code || e?.message || e
  );
});

// ✅ KPI #1 : signup_complete (standard Firebase funnel)
logEvent("signup_complete", {
  method: "email",
}).catch((e: any) => {
  console.log(
    "[analytics] signup_complete failed:",
    e?.code || e?.message || e
  );
});


      try {
        await AsyncStorage.setItem(
        "login.lastEmail",
          email.trim()
        );
      } catch {}

      InteractionManager.runAfterInteractions(() => {
        if (isMountedRef.current) {
          nav.replace("/screen/onboarding/Screen1");
        }
      });


       } catch (error: any) {
      const code = error?.code ?? "unknown";
      const message = error?.message ?? "";

      console.log(
        "🔥 register error:",
        code,
        message,
        JSON.stringify(error ?? {}, null, 2)
      );

      const errorMessages: Record<string, string> = {
        "auth/email-already-in-use": t("emailAlreadyInUse") || "Cet email est déjà utilisé.",
        "auth/invalid-email": t("invalidEmailFormat") || "Format d'email invalide.",
        "auth/weak-password": t("weakPassword") || "Mot de passe trop faible.",
        "auth/network-request-failed": t("networkError") || "Problème réseau. Réessaie.",
        // 🔹 cas très fréquents non mappés chez toi
        "auth/too-many-requests":
          t("tooManyRequests") || "Trop de tentatives, réessaie plus tard.",
        "permission-denied":
          t("permissionDenied") || "Accès refusé, vérifie ta connexion ou réessaie.",
        "auth/operation-not-allowed":
          t("operationNotAllowed") ||
          "Cette opération n'est pas autorisée sur ce projet.",
      };

      // En dev, on affiche aussi le code d'erreur pour debug précis
      const baseMessage =
        errorMessages[code] || t("unknownError") || "Une erreur inconnue est survenue.";
      const finalMessage =
        __DEV__ && code !== "unknown"
          ? `${baseMessage} (${code})`
          : baseMessage;

      showError(finalMessage);
      safeHapticsError();
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }

  };

  // navigation protégée pendant un submit / chargement
  const guarded =
    <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) => {
      if (loading || submittingRef.current) return;
      return fn(...args);
    };
  const goLogin = guarded(() => nav.replace("/login"));

  return (
    <KeyboardAvoidingView
      style={[
        styles.flexContainer,
        { backgroundColor: BACKGROUND_COLOR },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios" ? normalize(60) : 0
      }
    >
      <ExpoStatusBar
        style="dark"
        backgroundColor={BACKGROUND_COLOR}
      />

      {/* Vagues de fond */}
      {waves.map((wave, index) => (
        <Wave
          key={index}
          opacity={wave.opacity}
          scale={wave.scale}
          borderWidth={wave.borderWidth}
          size={circleSize}
          top={circleTop}
        />
      ))}

      <ScrollView
        style={[
          styles.flexContainer,
          { backgroundColor: "transparent" },
        ]}
        contentContainerStyle={[
          styles.container,
          {
            minHeight: SCREEN_HEIGHT,
            paddingBottom: SPACING * 2,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
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
          <Text style={styles.tagline}>
            {t("joinUsAndChallenge")}
          </Text>
        </View>

        {/* Bannière offline */}
        {isOffline && (
          <View
            style={styles.offlineBanner}
            accessibilityRole="alert"
          >
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color="#111827"
            />
            <Text style={styles.offlineText}>
              {t("networkError") ||
                "Connexion réseau indisponible"}
            </Text>
          </View>
        )}

        {/* Card form */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: formOpacity,
              transform: [{ translateY: formTranslate }],
            },
          ]}
          accessibilityLabel={t("registrationForm")}
          accessible
        >
          {!!errorMessage && (
            <Animated.View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                styles.errorBanner,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color="#fff"
              />
              <Text style={styles.errorBannerText}>
                {errorMessage}
              </Text>
            </Animated.View>
          )}

          {/* Email */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={PRIMARY_COLOR}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={emailRef}
              autoFocus
              placeholder={t("emailPlaceholder")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={email}
              onChangeText={(v) => {
  setEmail(v);
  if (errorMessage) setErrorMessage("");
}}
onFocus={() => setFocusedField("email")}
onBlur={() => setFocusedField((f) => (f === "email" ? null : f))}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel={t("email")}
              autoComplete="email"
              autoCorrect={false}
              testID="email-input"
              maxLength={100}
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() =>
                usernameRef.current?.focus()
              }
              blurOnSubmit={false}
            />
            {!!email && (
              <TouchableOpacity
                onPress={() => setEmail("")}
                style={styles.trailingBtn}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10,
                }}
                accessibilityLabel={t("clear") || "Effacer"}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(0,0,0,0.35)"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Username */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="person-outline"
              size={18}
              color={PRIMARY_COLOR}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={usernameRef}
              placeholder={t("username")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={username}
              onChangeText={(v) => {
  setUsername(v);
  if (errorMessage) setErrorMessage("");
}}
onFocus={() => setFocusedField("username")}
onBlur={() => setFocusedField((f) => (f === "username" ? null : f))}
              accessibilityLabel={t("username")}
              autoComplete="username"
              testID="username-input"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={40}
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() =>
                passwordRef.current?.focus()
              }
              blurOnSubmit={false}
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={PRIMARY_COLOR}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={passwordRef}
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={password}
              onChangeText={(v) => {
  setPassword(v);
  if (errorMessage) setErrorMessage("");
}}
onFocus={() => setFocusedField("password")}
onBlur={() => setFocusedField((f) => (f === "password" ? null : f))}
              secureTextEntry={!showPassword}
              accessibilityLabel={t("password")}
              autoComplete="new-password"
              testID="password-input"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() =>
                confirmRef.current?.focus()
              }
            />
            <TouchableOpacity
              onPress={() =>
                setShowPassword((prev) => !prev)
              }
              accessibilityLabel={
                showPassword
                  ? t("hidePassword")
                  : t("showPassword")
              }
              style={styles.trailingBtn}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={PRIMARY_COLOR}
              style={styles.leadingIcon}
            />
            <TextInput
              ref={confirmRef}
              placeholder={t("confirmPassword")}
              placeholderTextColor="rgba(50,50,50,0.5)"
              style={styles.input}
              value={confirmPassword}
              onChangeText={(v) => {
  setConfirmPassword(v);
  if (errorMessage) setErrorMessage("");
}}
onFocus={() => setFocusedField("confirm")}
onBlur={() => setFocusedField((f) => (f === "confirm" ? null : f))}
              secureTextEntry={!showConfirmPassword}
              accessibilityLabel={t("confirmPassword")}
              autoComplete="new-password"
              testID="confirm-password-input"
              textContentType="newPassword"
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={
                formValid ? handleRegister : undefined
              }
            />
            <TouchableOpacity
              onPress={() =>
                setShowConfirmPassword((prev) => !prev)
              }
              accessibilityLabel={
                showConfirmPassword
                  ? t("hidePassword")
                  : t("showPassword")
              }
              style={styles.trailingBtn}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
                    {!!focusHint && (
            <View
              style={styles.hintRow}
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="rgba(0,0,0,0.55)"
              />
              <Text style={styles.hintText}>{focusHint}</Text>
            </View>
          )}

        </Animated.View>

                {!!disabledHint && (
  <View
    style={styles.disabledHintBanner}
    accessibilityLiveRegion="polite"
    accessible
  >
    <Ionicons
      name="alert-circle-outline"
      size={16}
      color="#111827"
    />
    <Text style={styles.disabledHintText}>{disabledHint}</Text>
  </View>
)}

        {/* CTA Register */}
        <Animated.View
          style={{
            transform: [
              {
                scale: Animated.multiply(
                  ctaScale,
                  ctaPulse
                ),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={[
              styles.registerButton,
              disabledCTA && styles.disabledButton,
            ]}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={!disabledCTA ? handleRegister : undefined}
            disabled={disabledCTA}
            accessibilityRole="button"
            accessibilityLabel={t("signup")}
            accessibilityHint={
              t("createAccountHint") || undefined
            }
            accessibilityState={{ disabled: disabledCTA }}
            testID="register-button"
          >
            {loading ? (
              <ActivityIndicator
                color={TEXT_COLOR}
                size="small"
              />
            ) : (
              <Text style={styles.registerButtonText}>
                {t("signup")}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Lien login */}
        <Text
          style={styles.loginText}
          accessibilityLabel={t("login")}
        >
          {t("alreadyHaveAccount")}{" "}
          <Text
            style={styles.loginLink}
            onPress={goLogin}
            accessibilityRole="link"
          >
            {t("loginHere")}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    marginTop: SCREEN_HEIGHT * 0.08,
  },
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

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE68A",
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  offlineText: {
    color: "#111827",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
  },

  // Banner d’erreur (identique login)
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E11D48",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
    hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  hintText: {
    flex: 1,
    color: "rgba(17,24,39,0.78)",
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
    lineHeight: normalize(16),
  },
  disabledHintBanner: {
    width: Math.min(420, SCREEN_WIDTH - SPACING * 2),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE68A",
    borderColor: "rgba(0,0,0,0.10)",
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: SPACING,
    marginBottom: 6,
  },
  disabledHintText: {
    flex: 1,
    color: "#111827",
    fontSize: normalize(12.5),
    fontFamily: "Comfortaa_700Bold",
    lineHeight: normalize(16),
  },
  errorBannerText: {
    color: "#fff",
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    flexShrink: 1,
  },

  // Inputs
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  leadingIcon: { marginRight: 8, opacity: 0.9 },
  trailingBtn: { marginLeft: 8, padding: 4 },

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
    fontSize: normalize(16),
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
    maxWidth: "90%",
  },

  input: {
    flex: 1,
    height: normalize(52),
    color: "#111",
    fontSize: normalize(15),
    fontFamily: "Comfortaa_400Regular",
  },

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
    color: TEXT_COLOR,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },

  loginText: {
    color: TEXT_COLOR,
    textAlign: "center",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
    marginBottom: SPACING * 2,
  },
  loginLink: {
    color: PRIMARY_COLOR,
    fontFamily: "Comfortaa_400Regular",
  },
});
