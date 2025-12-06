import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Text,
  StatusBar,
  StyleProp,
  Keyboard,
  I18nManager,
  AccessibilityInfo,
} from "react-native";
import { useRouter } from "expo-router";
import {
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  arrayUnion,
  type FieldValue,
} from "firebase/firestore";
import { auth, db, storage } from "../../constants/firebase-config";
import * as ImagePicker from "expo-image-picker";
import { TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, {
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import type { ViewStyle } from "react-native";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// 🔼 Déclare normalizeSize AVANT de l’utiliser dans n()
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

// Auto-compact on small screens (e.g., iPhone SE / older Androids)
const IS_COMPACT = SCREEN_HEIGHT < 720;
// Slightly tighter scaler on compact screens
const n = (size: number) =>
  Math.round(normalizeSize(IS_COMPACT ? size * 0.9 : size));
// Vertical rhythm tuned for compact
const V_SPACING = IS_COMPACT ? 10 : 15;

/** Util pour ajouter une alpha sans casser les gradients */
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) =>
    Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};

// 👇 Normalise n'importe quelle valeur "profil" en string d'affichage
const toDisplayString = (v: any): string => {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (v === null || v === undefined) return "";
  return String(v);
};

// 👇 Trim sécurisé: retourne toujours une string trimée
const safeTrim = (v: any): string => toDisplayString(v).trim();

// 👇 Parse robuste: accepte string "a, b" ou array ["a","b"]
const parseInterests = (v: any): string[] =>
  Array.isArray(v)
    ? v.map((s) => String(s).trim()).filter(Boolean)
    : String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

// 👇 Détermine si le profil est complet côté client (idempotent)
const isProfileCompleteLocal = (data: {
  displayName?: any;
  bio?: any;
  location?: any;
  profileImage?: any;
  interests?: any;
}): boolean => {
  const hasName = safeTrim(data.displayName).length >= 2; // mini lisible
  const hasBio = safeTrim(data.bio).length >= 10; // mini utile
  const hasLoc = safeTrim(data.location).length >= 2;
  const hasPic = !!safeTrim(data.profileImage);
  const ints = parseInterests(data.interests);
  const hasInterests = ints.length > 0;
  return hasName && hasBio && hasLoc && hasPic && hasInterests;
};

// ========= Safe TabBar Height (évite le crash hors Tabs) =========
function useTabBarHeightSafe(): number {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}

// ==== GlassCard (défini au module scope) ====
type GlassCardProps = {
  isDarkMode: boolean;
  overlayLightColor: string;
  overlayLightColor2: string;
  overlayDarkColor: string;
  overlayDarkColor2: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const GlassCard: React.FC<GlassCardProps> = ({
  isDarkMode,
  overlayLightColor,
  overlayLightColor2,
  overlayDarkColor,
  overlayDarkColor2,
  style,
  children,
}) => {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView
        intensity={45}
        tint={isDarkMode ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDarkMode
            ? [overlayDarkColor, overlayDarkColor2]
            : [overlayLightColor, overlayLightColor2]
        }
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.glassInner}>{children}</View>
    </View>
  );
};

interface User {
  uid: string;
  displayName?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  location?: string | null;
  interests?: string | string[] | null;

  // ➕ pour ne pas réécrire inutilement profileCompletedAt
  profileCompleted?: boolean | null;
  profileCompletedAt?: any;
}

type ToastType = "success" | "error" | "info";

interface ToastState {
  type: ToastType;
  message: string;
}

const TOAST_DURATION = 2200;

export default function UserInfo() {
  const { t } = useTranslation();
  const router = useRouter();

  // 🔒 Limites & règles UX
  const MAX_NAME = 32;
  const MAX_BIO = 240;
  const MAX_LOCATION = 60;
  const MAX_INTERESTS = 160;

  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState("");
  const [isFetching, setIsFetching] = useState(true); // chargement initial du profil
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const isDarkMode = theme === "dark";
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeightSafe();
  const [adHeight, setAdHeight] = useState(0);
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );
  const navigatedRef = useRef(false);
  const { showBanners } = useAdsVisibility();
  const bottomPadding = useMemo(
    () => n(40) + (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom,
    [adHeight, insets.bottom, showBanners, tabBarHeight]
  );

  // États de focus pour chaque champ
  const [isDisplayNameFocused, setIsDisplayNameFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isInterestsFocused, setIsInterestsFocused] = useState(false);

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(-10);
  const [reduceMotion, setReduceMotion] = useState(false);

  // ✅ Y a-t-il au moins une vraie modification par rapport aux valeurs en base ?
  const hasChanges = useMemo(() => {
    if (!user) return false;

    const baseDisplay = safeTrim(user.displayName);
    const baseBio = safeTrim(user.bio);
    const baseLocation = safeTrim(user.location);
    const baseInterests = safeTrim(user.interests);
    const baseProfileImage = user.profileImage || null;

    const cleanDisplay = safeTrim(displayName);
    const cleanBio = safeTrim(bio);
    const cleanLocation = safeTrim(location);
    const cleanInterests = safeTrim(interests);
    const nextProfileImage = profileImage || null;

    return (
      (cleanDisplay && cleanDisplay !== baseDisplay) ||
      (cleanBio && cleanBio !== baseBio) ||
      (nextProfileImage !== baseProfileImage) ||
      (cleanLocation && cleanLocation !== baseLocation) ||
      (cleanInterests && cleanInterests !== baseInterests)
    );
  }, [user, displayName, bio, profileImage, location, interests]);

  // Reduce motion
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      // @ts-ignore compat RN
      sub?.remove?.();
    };
  }, []);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastTranslateY.value }],
  }));

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      setToast({ type, message });

      toastOpacity.value = 0;
      toastTranslateY.value = -10;

      toastOpacity.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
        withDelay(
          TOAST_DURATION,
          withTiming(0, { duration: 320, easing: Easing.in(Easing.ease) })
        )
      );

      toastTranslateY.value = withSequence(
        withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) }),
        withDelay(
          TOAST_DURATION,
          withTiming(-10, { duration: 320, easing: Easing.in(Easing.ease) })
        )
      );

      if (!reduceMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      setTimeout(() => {
        setToast((current) =>
          current && current.message === message ? null : current
        );
      }, TOAST_DURATION + 450);
    },
    [reduceMotion, toastOpacity, toastTranslateY]
  );

  // Chargement des données utilisateur
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error(String(t("userNotAuthenticated")));
        const userId = currentUser.uid;
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as Omit<User, "uid">;
          setUser({ uid: userId, ...userData });
          setDisplayName(userData.displayName || "");
          setBio(userData.bio || "");
          setProfileImage(userData.profileImage || null);
          setLocation(userData.location || "");
          setInterests(toDisplayString(userData.interests));
        } else {
          throw new Error(String(t("profileNotFound")));
        }
      } catch (error: any) {
        console.error("Error fetching profile:", error);
        showToast(
          "error",
          `${t("errorFetchingProfile")}: ${error?.message ?? ""}`
        );
      } finally {
        setIsFetching(false);
      }
    };
    fetchUserData();
  }, [t, showToast]);

  // Sélection de l'image
  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast("error", String(t("photoPermissionDenied")));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const currentUser = auth.currentUser;
        if (!currentUser) {
          showToast("error", String(t("userNotAuthenticated")));
          return;
        }
        setIsLoading(true);
        const filename = `profileImages/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        const response = await fetch(uri);
        const blob = await response.blob();
        const uploadTask = uploadBytesResumable(storageRef, blob, {
          contentType: "image/jpeg",
        });

        uploadTask.on(
          "state_changed",
          null,
          (error) => {
            setIsLoading(false);
            console.error("Upload error:", error);
            showToast(
              "error",
              `${t("uploadFailed")}: ${error?.message ?? ""}`
            );
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(
                uploadTask.snapshot.ref
              );
              setProfileImage(downloadURL);
              setIsLoading(false);
              showToast("success", String(t("profileImageUpdated")));
            } catch (urlError: any) {
              setIsLoading(false);
              console.error("URL error:", urlError);
              showToast(
                "error",
                `${t("uploadFailed")}: ${urlError?.message ?? ""}`
              );
            }
          }
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error("pickImage error:", error);
      showToast("error", `${t("uploadFailed")}: ${error?.message ?? ""}`);
    }
  }, [t, showToast]);

  // Sauvegarde des modifications
  const handleSave = useCallback(async () => {
    // 🔍 Validations front rapides avant write
    const tooLong =
      displayName.trim().length > MAX_NAME ||
      bio.trim().length > MAX_BIO ||
      location.trim().length > MAX_LOCATION ||
      interests.trim().length > MAX_INTERESTS;
    if (tooLong) {
      showToast(
        "error",
        t("profileFieldTooLong", {
          defaultValue:
            "Certains champs dépassent la longueur autorisée. Réduis un peu le texte et réessaie.",
        }) as string
      );
      return;
    }
    if (!user?.uid) {
      showToast("error", String(t("userNotFound")));
      return;
    }

    // ✅ On construit dynamiquement ce qui change VRAIMENT (et non vide)
    const updateData: Partial<
      User & {
        profileCompleted?: boolean;
        profileCompletedAt?: FieldValue | Date;
        "stats.profile.completed"?: boolean;
      }
    > = {};

    const cleanDisplay = safeTrim(displayName);
    const cleanBio = safeTrim(bio);
    const cleanLocation = safeTrim(location);
    // Normalise les intérêts
    const interestsArray = parseInterests(interests);
    const cleanInterests = interestsArray.join(", ");

    if (cleanDisplay && cleanDisplay !== safeTrim(user.displayName)) {
      updateData.displayName = cleanDisplay;
    }
    if (cleanBio && cleanBio !== safeTrim(user.bio)) {
      updateData.bio = cleanBio;
    }
    if ((profileImage || null) !== (user.profileImage || null)) {
      updateData.profileImage = profileImage || null;
    }

    if (cleanLocation && cleanLocation !== safeTrim(user.location)) {
      updateData.location = cleanLocation;
    }
    if (
      interestsArray.length > 0 &&
      cleanInterests !== safeTrim(user.interests)
    ) {
      updateData.interests = interestsArray as any;
    }

    // ✅ prospective complet (on mélange next + base)
    const prospective = {
      displayName: cleanDisplay || user.displayName,
      bio: cleanBio || user.bio,
      location: cleanLocation || user.location,
      profileImage: (profileImage || user.profileImage) ?? "",
      interests: interestsArray.length > 0 ? interestsArray : user.interests,
    };

    const willBeComplete = isProfileCompleteLocal(prospective);
    const wasComplete = !!(user as any)?.profileCompleted;
    // ✅ On ne "stamp" la complétion qu'une seule fois
    if (willBeComplete && !wasComplete) {
      (updateData as any).profileCompleted = true;
      (updateData as any).profileCompletedAt = serverTimestamp();
      (updateData as any)["stats.profile.completed"] = true;
    }

    // On met toujours à jour updatedAt
    (updateData as any).updatedAt = serverTimestamp();

    // Rien de pertinent à mettre à jour → on informe et on sort
    if (Object.keys(updateData).length === 0) {
      showToast("info", String(t("noChangesDetected")));
      return;
    }

    setIsLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
await updateDoc(userRef, updateData);

// 🔁 Relecture Firestore + garde "profile_completed" ultra robuste
try {
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const fresh = snap.data() as any;

    const parseInterestsServer = (v: any): string[] =>
      Array.isArray(v)
        ? v.map((s) => String(s).trim()).filter(Boolean)
        : String(v || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const nameOk = String(fresh?.displayName || "").trim().length >= 2;
    const bioOk = String(fresh?.bio || "").trim().length >= 10;
    const locOk = String(fresh?.location || "").trim().length >= 2;
    const picOk = !!String(fresh?.profileImage || "").trim();
    const ints = parseInterestsServer(fresh?.interests);
    const interestsOk = ints.length > 0;

    const canMarkProfileCompleted =
      nameOk && bioOk && locOk && picOk && interestsOk;

    const achievements: string[] = Array.isArray(fresh.achievements)
      ? fresh.achievements
      : [];
    const pending: string[] = Array.isArray(fresh.newAchievements)
      ? fresh.newAchievements
      : [];

    const alreadyProfileCompleted =
      achievements.includes("profile_completed") ||
      pending.includes("profile_completed") ||
      fresh?.profileCompleted === true ||
      fresh?.stats?.profile?.completed === true;

    if (canMarkProfileCompleted && !alreadyProfileCompleted) {
      await updateDoc(userRef, {
        newAchievements: arrayUnion("profile_completed"),
        profileCompleted: true,
        "stats.profile.completed": true,
        profileCompletedAt:
          fresh.profileCompletedAt || serverTimestamp(),
      } as any);

      __DEV__ &&
        console.log("🔥 profile_completed forcé après édition du profil");
    }
  }
} catch (e: any) {
  __DEV__ &&
    console.warn(
      "[UserInfo] post-save profile_completed guard error:",
      e?.message ?? e
    );
}

// ✅ Achievements généraux (au cas où d'autres succès se débloquent)
try {
  await checkForAchievements(user.uid);
} catch (e) {
  __DEV__ &&
    console.warn(
      "[achievements] check profile save:",
      (e as any)?.message ?? e
    );
}


      Keyboard.dismiss();
      navigatedRef.current = true;
      setIsLoading(false);
      showToast("success", String(t("profileUpdatedSuccess")));
      // petit délai pour laisser le toast s'afficher
      setTimeout(() => {
        router.back();
      }, 450);
      return;
    } catch (error: any) {
      console.error("profile update error:", error);
      showToast(
        "error",
        `${t("profileUpdateFailed")}: ${error?.message ?? ""}`
      );
    } finally {
      if (!navigatedRef.current) setIsLoading(false);
    }
  }, [
    user,
    displayName,
    bio,
    profileImage,
    location,
    interests,
    router,
    t,
    showToast,
  ]);

  if (isFetching) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={
            isDarkMode
              ? [
                  currentTheme.colors.background,
                  currentTheme.colors.cardBackground,
                ]
              : ["#FFFFFF", "#FFE4B5"]
          }
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {t("loadingProfile")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />

      <LinearGradient
        colors={[
          withAlpha(currentTheme.colors.background, 1),
          withAlpha(currentTheme.colors.cardBackground, 1),
          withAlpha(currentTheme.colors.primary, 0.13),
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
          style={styles.bgOrbTop}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.secondary, 0.25),
            "transparent",
          ]}
          style={styles.bgOrbBottom}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <CustomHeader
          title={t("yourProfile", { defaultValue: "Ton profil" })}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: bottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            accessibilityRole="scrollbar"
           accessibilityLabel={t("userInfo.formScrollA11y", {
             defaultValue: "Formulaire d’édition du profil et bouton de sauvegarde",
           })}
          >
            <Animated.View
              entering={ZoomIn.delay(100)}
              style={styles.imageContainer}
            >
              <TouchableOpacity
                onPress={pickImage}
                accessibilityLabel={t(
                  "accessibility.editProfileImage.label"
                )}
                accessibilityHint={t("accessibility.editProfileImage.hint")}
                accessibilityRole="button"
                testID="profile-image-button"
              >
                <LinearGradient
                  colors={
                    isDarkMode
                      ? [
                          currentTheme.colors.background + "80",
                          currentTheme.colors.cardBackground + "80",
                        ]
                      : [
                          currentTheme.colors.secondary + "80",
                          currentTheme.colors.primary + "80",
                        ]
                  }
                  style={[
                    styles.imageGradient,
                    {
                      borderColor: isDarkMode
                        ? currentTheme.colors.secondary
                        : "#FFFFFF",
                    },
                  ]}
                >
                  {profileImage ? (
                    <Image
                      source={{ uri: profileImage }}
                      style={styles.profileImage}
                      accessibilityLabel={t(
                        "accessibility.currentProfileImage.label"
                      )}
                      defaultSource={require("../../assets/images/default-profile.webp")}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.addImageText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                    >
                      {t("addProfilePhoto")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <GlassCard
              isDarkMode={isDarkMode}
              overlayLightColor={withAlpha("#FFFFFF", 0.6)}
              overlayLightColor2={withAlpha("#FFF5E6", 0.4)}
              overlayDarkColor={withAlpha("#FFFFFF", 0.03)}
              overlayDarkColor2={withAlpha("#FFFFFF", 0.02)}
              style={[
                styles.formCard,
                {
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
                },
              ]}
            >
              {/* Nom */}
              <Animated.View
                entering={FadeInUp.delay(200)}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(0,0,0,0.3)"
                      : "rgba(255,255,255,0.2)",
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FFB800",
                  },
                ]}
              >
                <TextInput
                  label={t("name")}
                  mode="flat"
                  style={[styles.input, { fontSize: normalizeSize(14) }]}
                  value={displayName}
                  onChangeText={(v) => setDisplayName(v.slice(0, MAX_NAME))}
                  onFocus={() => setIsDisplayNameFocused(true)}
                  onBlur={() => setIsDisplayNameFocused(false)}
                  textColor={
                    isDarkMode ? currentTheme.colors.textPrimary : "#000"
                  }
                  underlineColor="transparent"
                  activeUnderlineColor={currentTheme.colors.secondary}
                  placeholderTextColor={
                    isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary
                  }
                  theme={{
                    colors: {
                      background: "transparent",
                      text: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000",
                      primary: isDarkMode
                        ? "#FFEC8B"
                        : currentTheme.colors.secondary,
                      placeholder: isDarkMode
                        ? "#FFD700"
                        : currentTheme.colors.textSecondary,
                      onSurface: isDarkMode
                        ? !isDisplayNameFocused
                          ? "#FFD700"
                          : currentTheme.colors.textPrimary
                        : currentTheme.colors.textSecondary,
                    },
                    fonts: {
                      regular: { fontFamily: "Comfortaa_400Regular" },
                    },
                  }}
                  dense
                  accessibilityLabel={t(
                    "accessibility.usernameField.label"
                  )}
                  accessibilityHint={t("accessibility.usernameField.hint")}
                  testID="input-displayName"
                />
              </Animated.View>

              {/* Bio */}
              <Animated.View
                entering={FadeInUp.delay(300)}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(0,0,0,0.3)"
                      : "rgba(255,255,255,0.2)",
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FFB800",
                  },
                ]}
              >
                <TextInput
                  label={t("bio")}
                  mode="flat"
                  style={[
                    styles.input,
                    styles.multilineInput,
                    { fontSize: normalizeSize(14) },
                  ]}
                  value={bio}
                  onChangeText={(v) => setBio(v.slice(0, MAX_BIO))}
                  onFocus={() => setIsBioFocused(true)}
                  onBlur={() => setIsBioFocused(false)}
                  multiline
                  numberOfLines={3}
                  textColor={
                    isDarkMode ? currentTheme.colors.textPrimary : "#000"
                  }
                  underlineColor="transparent"
                  activeUnderlineColor={currentTheme.colors.secondary}
                  placeholderTextColor={
                    isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary
                  }
                  theme={{
                    colors: {
                      background: "transparent",
                      text: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000",
                      primary: isDarkMode
                        ? "#FFEC8B"
                        : currentTheme.colors.secondary,
                      placeholder: isDarkMode
                        ? "#FFD700"
                        : currentTheme.colors.textSecondary,
                      onSurface: isDarkMode
                        ? !isBioFocused
                          ? "#FFD700"
                          : currentTheme.colors.textPrimary
                        : currentTheme.colors.textSecondary,
                    },
                    fonts: {
                      regular: { fontFamily: "Comfortaa_400Regular" },
                    },
                  }}
                  dense
                  accessibilityLabel={t("accessibility.bioField.label")}
                  accessibilityHint={t("accessibility.bioField.hint")}
                  testID="input-bio"
                />
              </Animated.View>

              {/* Localisation */}
              <Animated.View
                entering={FadeInUp.delay(400)}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(0,0,0,0.3)"
                      : "rgba(255,255,255,0.2)",
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FFB800",
                  },
                ]}
              >
                <TextInput
                  label={t("location")}
                  mode="flat"
                  style={[styles.input, { fontSize: normalizeSize(14) }]}
                  value={location}
                  onChangeText={(v) => setLocation(v.slice(0, MAX_LOCATION))}
                  onFocus={() => setIsLocationFocused(true)}
                  onBlur={() => setIsLocationFocused(false)}
                  textColor={
                    isDarkMode ? currentTheme.colors.textPrimary : "#000"
                  }
                  underlineColor="transparent"
                  activeUnderlineColor={currentTheme.colors.secondary}
                  placeholderTextColor={
                    isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary
                  }
                  theme={{
                    colors: {
                      background: "transparent",
                      text: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000",
                      primary: isDarkMode
                        ? "#FFEC8B"
                        : currentTheme.colors.secondary,
                      placeholder: isDarkMode
                        ? "#FFD700"
                        : currentTheme.colors.textSecondary,
                      onSurface: isDarkMode
                        ? !isLocationFocused
                          ? "#FFD700"
                          : currentTheme.colors.textPrimary
                        : currentTheme.colors.textSecondary,
                    },
                    fonts: {
                      regular: { fontFamily: "Comfortaa_400Regular" },
                    },
                  }}
                  dense
                  accessibilityLabel={t(
                    "accessibility.locationField.label"
                  )}
                  accessibilityHint={t(
                    "accessibility.locationField.hint"
                  )}
                  testID="input-location"
                />
              </Animated.View>

              {/* Intérêts */}
              <Animated.View
                entering={FadeInUp.delay(500)}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(0,0,0,0.3)"
                      : "rgba(255,255,255,0.2)",
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FFB800",
                  },
                ]}
              >
                <TextInput
                  label={t("interests")}
                  mode="flat"
                  style={[styles.input, { fontSize: normalizeSize(14) }]}
                  value={interests}
                  onChangeText={(v) => setInterests(v.slice(0, MAX_INTERESTS))}
                  onFocus={() => setIsInterestsFocused(true)}
                  onBlur={() => setIsInterestsFocused(false)}
                  textColor={
                    isDarkMode ? currentTheme.colors.textPrimary : "#000"
                  }
                  underlineColor="transparent"
                  activeUnderlineColor={currentTheme.colors.secondary}
                  placeholder={t("interestsPlaceholder")}
                  placeholderTextColor={
                    isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary
                  }
                  theme={{
                    colors: {
                      background: "transparent",
                      text: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000",
                      primary: isDarkMode
                        ? "#FFEC8B"
                        : currentTheme.colors.secondary,
                      placeholder: isDarkMode
                        ? "#FFD700"
                        : currentTheme.colors.textSecondary,
                      onSurface: isDarkMode
                        ? !isInterestsFocused
                          ? "#FFD700"
                          : currentTheme.colors.textPrimary
                        : currentTheme.colors.textSecondary,
                    },
                    fonts: {
                      regular: { fontFamily: "Comfortaa_400Regular" },
                    },
                  }}
                  dense
                  accessibilityLabel={t(
                    "accessibility.interestsField.label"
                  )}
                  accessibilityHint={t(
                    "accessibility.interestsField.hint"
                  )}
                  testID="input-interests"
                />
              </Animated.View>
            </GlassCard>

            {/* Bouton Sauvegarder */}
            <Animated.View
              entering={ZoomIn.delay(600)}
              style={styles.saveButtonWrapper}
            >
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasChanges || isLoading}
                activeOpacity={0.7}
                accessibilityLabel={t(
                  "accessibility.saveProfileChanges.label"
                )}
                accessibilityHint={t(
                  "accessibility.saveProfileChanges.hint"
                )}
                accessibilityRole="button"
                testID="save-button"
              >
                <LinearGradient
                  colors={
                    isDarkMode
                      ? [
                          currentTheme.colors.secondary,
                          currentTheme.colors.primary,
                        ]
                      : ["#FF8C00", "#FFA500"]
                  }
                  style={[
                    styles.saveButton,
                    {
                      borderWidth: isDarkMode ? 1 : 2,
                      borderColor: isDarkMode
                        ? currentTheme.colors.secondary
                        : "#FFB800",
                      opacity: !hasChanges || isLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      color={isDarkMode ? "#FFFFFF" : "#333333"}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.saveButtonText,
                        { color: isDarkMode ? "#FFFFFF" : "#333333" },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t("save")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Toast premium */}
        {toast && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastContainer,
              {
                bottom:
                  showBanners && adHeight
                    ? tabBarHeight + insets.bottom + adHeight + SPACING
                    : SPACING * 2.4,
              },
              toastStyle,
            ]}
          >
            <View
              style={[
                styles.toastInner,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "error" && styles.toastError,
                toast.type === "info" && styles.toastInfo,
              ]}
            >
              <Text>
                {
                  {
                    success: "✅",
                    error: "⚠️",
                    info: "ℹ️",
                  }[toast.type]
                }
              </Text>
              <Text
                style={styles.toastText}
                numberOfLines={3}
               adjustsFontSizeToFit
              >
                {toast.message}
              </Text>
            </View>
          </Animated.View>
        )}

        {showBanners ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom,
              alignItems: "center",
              backgroundColor: "transparent",
              paddingBottom: 6,
              zIndex: 9999,
            }}
            pointerEvents="box-none"
          >
            <BannerSlot onHeight={(h) => setAdHeight(h)} />
          </View>
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: V_SPACING,
    alignItems: "center",
    paddingBottom: n(40),
  },

  imageContainer: {
    marginBottom: V_SPACING * 1.2,
    borderRadius: n(60),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: n(4) },
    shadowOpacity: 0.28,
    shadowRadius: n(7),
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  imageGradient: {
    width: n(IS_COMPACT ? 120 : 136),
    aspectRatio: 1,
    borderRadius: n(IS_COMPACT ? 60 : 68),
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
  },
  profileImage: {
    width: n(IS_COMPACT ? 114 : 128),
    aspectRatio: 1,
    borderRadius: n(IS_COMPACT ? 57 : 64),
    resizeMode: "cover",
  },
  addImageText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    paddingHorizontal: SPACING * 1.5,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  inputWrapper: {
    width: "100%",
    marginBottom: V_SPACING,
    borderRadius: n(14),
    borderWidth: 1.5,
    overflow: "hidden",
  },

  input: {
    width: "100%",
    fontFamily: "Comfortaa_400Regular",
    paddingHorizontal: V_SPACING,
    paddingVertical: n(10),
    backgroundColor: "transparent",
    borderRadius: n(14),
    minHeight: n(44),
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  formCard: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: normalizeSize(18),
    marginBottom: SPACING,
    overflow: "hidden",
  },

  glassWrap: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    borderWidth: 1.5,
  },

  glassInner: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },

  multilineInput: {
    minHeight: n(IS_COMPACT ? 76 : 88),
    textAlignVertical: "top",
    paddingTop: n(10),
  },

  saveButtonWrapper: {
    width: "100%",
    marginTop: V_SPACING * 1.4,
    alignItems: "center",
  },

  saveButton: {
    paddingVertical: n(14),
    paddingHorizontal: n(26),
    borderRadius: n(26),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: n(4) },
    shadowOpacity: 0.28,
    shadowRadius: n(7),
    elevation: 9,
  },
  saveButtonText: {
    fontSize: n(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  // Background orbs
  bgOrbTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * (IS_COMPACT ? 0.28 : 0.25),
    left: -SCREEN_WIDTH * (IS_COMPACT ? 0.22 : 0.2),
    width: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
    height: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
    borderRadius: SCREEN_WIDTH * 0.45,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * (IS_COMPACT ? 0.32 : 0.3),
    right: -SCREEN_WIDTH * (IS_COMPACT ? 0.27 : 0.25),
    width: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
    height: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
    borderRadius: SCREEN_WIDTH * 0.55,
  },

  // Toast premium
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingVertical: n(10),
    borderRadius: n(20),
    backgroundColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    gap: normalizeSize(8),
  },
  toastSuccess: {
    backgroundColor: "#BBF7D0",
  },
  toastError: {
    backgroundColor: "#FECACA",
  },
  toastInfo: {
    backgroundColor: "#E0F2FE",
  },
  toastText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
    color: "#0b1120",
    flexShrink: 1,
    marginLeft: 4,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
});
