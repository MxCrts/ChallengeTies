import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
  Switch,
  Pressable,
  StatusBar,
  I18nManager,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileUpdate } from "../../context/ProfileUpdateContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation, Trans  } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PioneerBadge from "@/components/PioneerBadge";
import { setDuoAvailable } from "@/services/matchingService";
import { useMatchingInbox } from "@/hooks/useMatchingInbox";
import MatchingInboxModal from "@/components/MatchingInboxModal";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BORDER_COLOR_LIGHT = "rgba(255, 255, 255, 0.2)";
const SHADOW_COLOR = "#000";

let __win = Dimensions.get("window");

// ✅ garde une width/height live (rotation, split-screen, barres, etc.)
Dimensions.addEventListener("change", ({ window }) => {
  __win = window;
});

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const W = __win?.width ?? 375;
  const scale = Math.min(Math.max(W / baseWidth, 0.75), 1.8);
  return Math.round(size * scale);
};


/** Util pour ajouter une alpha sans casser les gradients */
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
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

// helpers d’affichage
const takeInterests = (raw?: string[] | string) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((s) => String(s).trim());
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

interface UserData {
  username?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  profileImage?: string;
  trophies?: number;
  newAchievements?: string[];
  isPioneer?: boolean;
  unreadNotifications?: number;

  // 🆕 inventaire (streak pass & futurs items)
  inventory?: {
    streakPass?: number;
    [key: string]: any;
  };
  duoAvailable?: boolean;
}

interface ProfileSection {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  navigateTo: string;
  testID: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  unclaimedCount?: number; // badge optionnel (notifs, rewards, inventaire…)
}

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profileUpdated } = useProfileUpdate();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
 const insets = useSafeAreaInsets();
const tabBarHeight = useBottomTabBarHeight();
const [adHeight, setAdHeight] = useState(0);
const [duoToggleBusy, setDuoToggleBusy] = useState(false);
const [showPioneerModal, setShowPioneerModal] = useState(false);
const [matchingInboxVisible, setMatchingInboxVisible] = useState(false);
const { items: matchingItems, count: matchingCount } = useMatchingInbox();
const PROFILE_FIRST_SEEN_KEY = "profile.firstSeen.v1";
const firstProfileGateRef = React.useRef(false);

const EXTRA_SCROLL_SPACE = normalizeSize(24); // ✅ petit buffer, pas 90
const bottomContentPadding =
  (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom + EXTRA_SCROLL_SPACE;


// 🆕 total d’objets dans l’inventaire (streakPass + futurs items numériques)
const totalInventoryItems = useMemo(() => {
  const inv = userData?.inventory;
  if (!inv || typeof inv !== "object") return 0;

  return Object.values(inv).reduce((sum, val) => {
    if (typeof val === "number" && isFinite(val)) {
      return sum + val;
    }
    return sum;
  }, 0);
}, [userData]);
const handleAdHeight = useCallback((h:number)=>setAdHeight(h),[]);


   const {
    tutorialStep,
    isTutorialActive,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();


  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Chargement des données
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError(t("noUserConnected"));
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          setUserData(snap.data() as UserData);
          setError(null);
        } else {
          setError(t("profileNotFound"));
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Erreur onSnapshot:", err);
        setError(t("profileLoadError"));
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profileUpdated, t]);

useFocusEffect(
  useCallback(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // ✅ évite double run si React remount / fast refresh / nav glitch
        if (firstProfileGateRef.current) return;
        firstProfileGateRef.current = true;

        const seen = await AsyncStorage.getItem(PROFILE_FIRST_SEEN_KEY);
        if (cancelled) return;

        if (seen !== "1") {
          setShowPioneerModal(true); // ou setShowYourModal(true)
          await AsyncStorage.setItem(PROFILE_FIRST_SEEN_KEY, "1");
        }
      } catch {
        // si AsyncStorage fail, on ne bloque pas l'écran
      }
    };

    // ✅ On attend que le profil soit vraiment prêt (sinon premier focus = loading)
    if (!isLoading && !!userData) {
      run();
    } else {
      // fallback: retente dès que ça devient prêt
      // (pas de timer infini)
    }

    return () => {
      cancelled = true;
    };
  }, [isLoading, userData])
);

const handleDuoToggle = useCallback(async (value: boolean) => {
  const uid = auth.currentUser?.uid;
  if (!uid || duoToggleBusy) return;
  setDuoToggleBusy(true);
  try {
    await setDuoAvailable(uid, value);
    // L'onSnapshot mettra userData à jour automatiquement
  } catch {
    Alert.alert(
      t("alerts.error"),
      t("matching.toggleError", { defaultValue: "Impossible de mettre à jour." })
    );
  } finally {
    setDuoToggleBusy(false);
  }
}, [duoToggleBusy, t]);


    // Sections
  const sections = useMemo<ProfileSection[]>(
  () => [
    {
      name: t("editProfile"),
      icon: "person-circle-outline",
      navigateTo: "profile/UserInfo",
      testID: "edit-profile-button",
      accessibilityLabel: t("access.editProfile.label"),
      accessibilityHint: t("access.editProfile.hint"),
    },
    {
      name: t("ongoingChallenges"),
      icon: "flag-outline",
      navigateTo: "profile/CurrentChallenges",
      testID: "current-challenges-button",
      accessibilityLabel: t("access.ongoingChallenges.label"),
      accessibilityHint: t("access.ongoingChallenges.hint"),
    },
    {
      name: t("completedChallenges"),
      icon: "checkmark-done-outline",
      navigateTo: "profile/CompletedChallenges",
      testID: "completed-challenges-button",
      accessibilityLabel: t("access.completedChallenges.label"),
      accessibilityHint: t("access.completedChallenges.hint"),
    },
    {
      name: t("statistics"),
      icon: "stats-chart-outline",
      navigateTo: "profile/UserStats",
      testID: "stats-button",
      accessibilityLabel: t("access.statistics.label"),
      accessibilityHint: t("access.statistics.hint"),
    },
    {
      name: t("favorites"),
      icon: "bookmark-outline",
      navigateTo: "profile/SavedChallenges",
      testID: "favorites-button",
      accessibilityLabel: t("access.favorites.label"),
      accessibilityHint: t("access.favorites.hint"),
    },
    {
      name: t("rewards"),
      icon: "medal-outline",
      navigateTo: "profile/Achievements",
      testID: "achievements-button",
      unclaimedCount: userData?.newAchievements?.length ?? 0,
      accessibilityLabel: t("access.rewards.label"),
      accessibilityHint: t("access.rewards.hint"),
    },
    {
      name: t("inventory.title"),
      icon: "briefcase-outline",
      navigateTo: "profile/Inventory",
      testID: "inventory-button",
      unclaimedCount: totalInventoryItems,
      accessibilityLabel: t("access.inventory.label", {
        defaultValue: "Ouvrir ton inventaire",
      }),
      accessibilityHint: t("access.inventory.hint", {
        defaultValue: "Voir et gérer tes bonus et protections de série.",
      }),
    },
    {
      name: t("myChallenges"),
      icon: "create-outline",
      navigateTo: "profile/MyChallenges",
      testID: "my-challenges-button",
      accessibilityLabel: t("access.myChallenges.label"),
      accessibilityHint: t("access.myChallenges.hint"),
    },
  ],
  // 🔑 on force le recalcul quand la langue change
  [t, i18n.language, userData, totalInventoryItems]
);



  // Grille des sections (2 par ligne)
  const rows = useMemo<ProfileSection[][]>(() => {
  const split: ProfileSection[][] = [];
  for (let i = 0; i < sections.length; i += 2) {
    split.push(sections.slice(i, i + 2));
  }
  return split;
}, [sections, i18n.language]);

const pioneerTextPrimary = isDarkMode ? currentTheme.colors.textPrimary : "#111";
const pioneerTextSecondary = isDarkMode ? currentTheme.colors.textSecondary : "#2B2B2B";
const pioneerBulletTextColor = isDarkMode ? currentTheme.colors.textPrimary : "#111";



  if (isLoading) {
    return (
      <GlobalLayout>
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
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {t("loadingProfile")}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  if (error || !userData) {
    return (
      <GlobalLayout>
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
          style={styles.loadingContainer}
        >
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={normalizeSize(40)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textSecondary },
              ]}
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {error || t("profileS.noData")}
            </Text>
          </View>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      
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
  {/* Orbes décoratives en arrière-plan */}
  <LinearGradient
    pointerEvents="none"
    colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
    style={styles.bgOrbTop}
    start={{ x: 0.2, y: 0 }}
    end={{ x: 1, y: 1 }}
  />
  <LinearGradient
    pointerEvents="none"
    colors={[withAlpha(currentTheme.colors.secondary, 0.25), "transparent"]}
    style={styles.bgOrbBottom}
    start={{ x: 1, y: 0 }}
    end={{ x: 0, y: 1 }}
  />

  <StatusBar
    translucent
    backgroundColor="transparent"
    barStyle={isDarkMode ? "light-content" : "dark-content"}
  />

  <CustomHeader
    title={t("yourProfile", { defaultValue: "Ton profil" })}
    backgroundColor="transparent"
    useBlur={false}
    showHairline={false}
  />
  <View style={styles.heroHeader}>

    <Text
      style={[
        styles.heroSubtitle,
        { color: withAlpha(currentTheme.colors.textSecondary, isDarkMode ? 0.85 : 0.75) },
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit
    >
      {t("profileS.heroSub", { defaultValue: "Tout ce qui te rend plus fort, au même endroit." })}
    </Text>
  </View>

  <ScrollView
  contentContainerStyle={[
    styles.scrollContent,
    { paddingBottom: bottomContentPadding },
  ]}
  showsVerticalScrollIndicator={false}
  // ✅ iOS only, sinon double padding + glitches en release Android
  contentInset={
    Platform.OS === "ios"
      ? { top: SPACING, bottom: 0 }
      : undefined
  }
  scrollIndicatorInsets={{
    bottom: bottomContentPadding,
  }}
  keyboardShouldPersistTaps="handled"
>

<View style={styles.pageInner}>
            {/* Carte Profil */}
            <Animated.View
              entering={FadeInUp.delay(100)}
              style={styles.profileCardWrapper}
            >
              <LinearGradient
                colors={
                  isDarkMode
                    ? [
                        currentTheme.colors.background,
                        currentTheme.colors.cardBackground,
                      ]
                    : ["#FFFFFF", "#FFE4B5"]
                            }
                            style={[
                  styles.profileCard,
                  {
                    borderWidth: 1,
                    borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.18 : 0.14),
                  },
                ]}

                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <LinearGradient
      pointerEvents="none"
      colors={[
        withAlpha(currentTheme.colors.primary, isDarkMode ? 0.18 : 0.12),
        "transparent",
      ]}
      style={styles.cardHaloTop}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
    <LinearGradient
      pointerEvents="none"
      colors={[
        withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.14 : 0.10),
        "transparent",
      ]}
      style={styles.cardHaloBottom}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
    />
                <View style={styles.avatarContainer}>
                  <Image
                    source={
                      userData?.profileImage
                        ? { uri: userData.profileImage }
                        : require("../../assets/images/default-profile.webp")
                    }
                    defaultSource={require("../../assets/images/default-profile.webp")}
                    style={[
                      styles.avatar,
                      {
                        borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.25 : 0.18),
                      },
                    ]}
                    accessibilityRole="image"
                    accessibilityLabel={
  (userData?.isPioneer ? "Pioneer · " : "") +
  t("profile.avatar", { username: userData?.username ?? "Utilisateur" })
}
                  />
                  {userData?.isPioneer === true && (
                    <PioneerBadge
                      size="mini"
                      label={t("badges.pioneer", { defaultValue: "Pioneer" })}
                      style={{ position: "absolute", bottom: -normalizeSize(10), left: normalizeSize(10) }}
                    />
                  )}
                  <Animated.View
  entering={ZoomIn.delay(260)}
  style={[styles.trophyChipWrap, { top: normalizeSize(10), right: normalizeSize(10) }]}
  pointerEvents="none"
  accessibilityElementsHidden
  importantForAccessibility="no-hide-descendants"
>
  <LinearGradient
    colors={
  isDarkMode
    ? [
        withAlpha(currentTheme.colors.background, 0.62),
        withAlpha(currentTheme.colors.cardBackground, 0.52),
      ]
    : [
        "rgba(255,255,255,0.96)",   // ✅ plus opaque = lisible
        "rgba(255,244,230,0.92)",   // ✅ léger warm premium
      ]
}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[
      styles.trophyChip,
      {
        borderColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.28 : 0.38),
      },
    ]}
  >
    {/* iOS: petit blur propre */}
    {Platform.OS === "ios" && (
      <BlurView
        intensity={28}
        tint={isDarkMode ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    )}

    {/* halo léger */}
    <LinearGradient
      pointerEvents="none"
      colors={[
  withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.22 : 0.32),
  "transparent",
]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.trophyHalo}
    />

    <View style={styles.trophyRow}>
      <View
        style={[
          styles.trophyIconBubble,
          {
            backgroundColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.16 : 0.18),
borderColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.22 : 0.28),
          },
        ]}
      >
        <Ionicons name="trophy" size={normalizeSize(14)} color={currentTheme.colors.trophy} />
      </View>

      <Text
        style={[
          styles.trophyChipText,
          { color: isDarkMode ? "#FFD36A" : "#8A4B00" },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {userData?.trophies ?? 0}
      </Text>
    </View>
  </LinearGradient>
</Animated.View>

                </View>

                {/* Username (manquait) */}
                <View style={styles.userInfo}>
                  <Text
                    style={[
                      styles.username,
                      { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {userData?.username || t("yourProfile")}
                  </Text>
                </View>

                {/* Détails */}
<Animated.View
  entering={FadeInUp.delay(400)}
  style={[styles.detailsContainer, { alignItems: "stretch", width: "100%" }]}
>
  {/* BIO */}
  <View style={styles.infoBlock}>
    <Text
      style={[
        styles.fieldLabel,
        { color: isDarkMode ? currentTheme.colors.textSecondary : "#333" },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {t("profileS.bioLabel", { defaultValue: "Bio" })}
    </Text>

    {userData?.bio?.trim() ? (
      <Text
        style={[
          styles.fieldValue,
          { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" },
        ]}
        numberOfLines={3}
        adjustsFontSizeToFit
      >
        {userData.bio.trim()}
      </Text>
    ) : (
      <TouchableOpacity
        onPress={() => router.push("profile/UserInfo")}
        activeOpacity={0.85}
        style={styles.placeholderChip}
      >
        <Ionicons name="add-circle-outline" size={normalizeSize(14)} color={currentTheme.colors.secondary} />
        <Text style={[styles.placeholderChipText, { color: currentTheme.colors.secondary }]}>
          {t("addBioHere")}
        </Text>
      </TouchableOpacity>
    )}
  </View>

  <View style={styles.softDivider} />

  {/* LOCATION */}
  <View style={styles.infoBlock}>
    <Text
      style={[
        styles.fieldLabel,
        { color: isDarkMode ? currentTheme.colors.textSecondary : "#333" },
      ]}
       numberOfLines={1}
      adjustsFontSizeToFit
    >
      {t("profileS.locationLabel", { defaultValue: "Location" })}
    </Text>

    {userData?.location?.trim() ? (
      <View style={styles.inline}>
        <Ionicons name="location-outline" size={normalizeSize(16)} color={currentTheme.colors.secondary} />
        <Text
          style={[
            styles.fieldValue,
            { marginLeft: 6, color: isDarkMode ? currentTheme.colors.textPrimary : "#111" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {userData.location.trim()}
        </Text>
      </View>
    ) : (
      <TouchableOpacity
        onPress={() => router.push("profile/UserInfo")}
        activeOpacity={0.85}
        style={styles.placeholderChip}
      >
        <Ionicons name="add-circle-outline" size={normalizeSize(14)} color={currentTheme.colors.secondary} />
        <Text style={[styles.placeholderChipText, { color: currentTheme.colors.secondary }]}>
          {t("addLocationHere")}
        </Text>
      </TouchableOpacity>
    )}
  </View>

  <View style={styles.softDivider} />

  {/* INTERESTS */}
  <View style={styles.infoBlock}>
    <Text
      style={[
        styles.fieldLabel,
        { color: isDarkMode ? currentTheme.colors.textSecondary : "#333" },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {t("profileS.interestsLabel", { defaultValue: "Interests" })}
    </Text>

    {takeInterests(userData?.interests).length ? (
      <View style={styles.interestsRow}>
        {takeInterests(userData?.interests).slice(0, 6).map((tag, i) => (
          <View key={`${tag}-${i}`} style={[styles.interestPill, { borderColor: currentTheme.colors.secondary }]}>
            <Text
              style={[
                styles.interestPillText,
                { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {tag}
            </Text>
          </View>
        ))}
        {takeInterests(userData?.interests).length > 6 && (
          <View style={[styles.interestPill, { borderColor: currentTheme.colors.secondary }]}>
            <Text style={[styles.interestPillText, { color: currentTheme.colors.secondary }]}>
              +{takeInterests(userData?.interests).length - 6}
            </Text>
          </View>
        )}
      </View>
    ) : (
      <TouchableOpacity
        onPress={() => router.push("profile/UserInfo")}
        activeOpacity={0.85}
        style={[styles.placeholderChip, { alignSelf: "flex-start" }]}
      >
        <Ionicons name="add-circle-outline" size={normalizeSize(14)} color={currentTheme.colors.secondary} />
        <Text style={[styles.placeholderChipText, { color: currentTheme.colors.secondary }]}>
          {t("addInterestsHere")}
        </Text>
      </TouchableOpacity>
    )}
  </View>

  <View style={styles.softDivider} />

{/* DUO TOGGLE */}
<View style={[styles.infoBlock, { marginBottom: 4 }]}>
  <View style={{
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(6),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(14),
    backgroundColor: isDarkMode
      ? "rgba(0,200,255,0.07)"
      : "rgba(0,160,200,0.06)",
    borderWidth: 1,
    borderColor: isDarkMode
      ? "rgba(0,200,255,0.18)"
      : "rgba(0,160,200,0.14)",
  }}>
    {/* Left: icon + texts */}
    <View style={{ flexDirection: "row", alignItems: "center", gap: normalizeSize(10), flex: 1, minWidth: 0 }}>
      <View style={{
        width: normalizeSize(36),
        height: normalizeSize(36),
        borderRadius: normalizeSize(11),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDarkMode
          ? "rgba(0,200,255,0.16)"
          : "rgba(0,160,200,0.12)",
      }}>
        <Ionicons
          name="people-outline"
          size={normalizeSize(18)}
          color={isDarkMode ? "#00C8FF" : "#0095C2"}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[
          styles.fieldLabel,
          { color: isDarkMode ? "#F8FAFC" : "#0B1220", marginBottom: 0 }
        ]} numberOfLines={1}>
          {t("matching.duoAvailableLabel", { defaultValue: "Disponible pour un duo" })}
        </Text>
        <Text style={{
          fontFamily: "Comfortaa_400Regular",
          fontSize: normalizeSize(11),
          color: isDarkMode ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.42)",
          marginTop: 2,
        }} numberOfLines={1}>
          {userData?.duoAvailable
            ? t("matching.duoAvailableOn", { defaultValue: "Tu apparais dans les matchs" })
            : t("matching.duoAvailableOff", { defaultValue: "Tu n'apparais pas dans les matchs" })}
        </Text>
      </View>
    </View>

    {/* Right: Switch */}
    <Switch
      value={!!userData?.duoAvailable}
      onValueChange={handleDuoToggle}
      disabled={duoToggleBusy}
      trackColor={{
        false: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
        true: "#00C8FF",
      }}
      thumbColor={
        userData?.duoAvailable
          ? (isDarkMode ? "#fff" : "#fff")
          : (isDarkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)")
      }
      ios_backgroundColor={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}
      style={{ marginLeft: normalizeSize(10) }}
    />
  </View>
</View>

{matchingCount > 0 && (
  <>
    <View style={styles.softDivider} />
    <View style={[styles.infoBlock, { marginBottom: 4 }]}>
      <Pressable
        onPress={() => setMatchingInboxVisible(true)}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: normalizeSize(10),
          paddingHorizontal: normalizeSize(12),
          borderRadius: normalizeSize(14),
          backgroundColor: isDarkMode
            ? "rgba(255,159,28,0.10)"
            : "rgba(255,159,28,0.08)",
          borderWidth: 1,
          borderColor: isDarkMode
            ? "rgba(255,159,28,0.28)"
            : "rgba(255,159,28,0.22)",
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: normalizeSize(10), flex: 1 }}>
          <View style={{
            width: normalizeSize(36),
            height: normalizeSize(36),
            borderRadius: normalizeSize(11),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDarkMode ? "rgba(255,159,28,0.20)" : "rgba(255,159,28,0.16)",
          }}>
            <Ionicons name="mail-outline" size={normalizeSize(18)} color="#FF9F1C" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.fieldLabel, { color: isDarkMode ? "#F8FAFC" : "#0B1220", marginBottom: 0 }]} numberOfLines={1}>
              {t("matching.inboxBtnLabel", { defaultValue: "Invitations de binôme" })}
            </Text>
            <Text style={{
              fontFamily: "Comfortaa_400Regular",
              fontSize: normalizeSize(11),
              color: isDarkMode ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.42)",
              marginTop: 2,
            }} numberOfLines={1}>
              {t("matching.inboxBtnSub", {
                count: matchingCount,
                defaultValue: `${matchingCount} en attente`,
              })}
            </Text>
          </View>
        </View>

        {/* Badge count */}
        <View style={{
          minWidth: normalizeSize(22),
          height: normalizeSize(22),
          borderRadius: 999,
          backgroundColor: "#FF9F1C",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: normalizeSize(6),
          marginLeft: normalizeSize(8),
        }}>
          <Text style={{
            fontFamily: "Comfortaa_700Bold",
            fontSize: normalizeSize(11),
            color: "#000",
          }}>
            {matchingCount > 9 ? "9+" : matchingCount}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={normalizeSize(16)}
          color={isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
          style={{ marginLeft: normalizeSize(6) }}
        />
      </Pressable>
    </View>
  </>
)}
</Animated.View>


              </LinearGradient>
            </Animated.View>

            {/* Sections / Boutons */}
            <View key={i18n.language} style={styles.sectionsContainer}>
  {rows.map((row, rowIndex) => (
    <Animated.View
      key={rowIndex}
      entering={FadeInUp.delay(500 + rowIndex * 100)}
      style={styles.rowContainer}
    >
      {row.map((section, index) => (
        <Animated.View
          key={index}
          entering={ZoomIn.delay(200 + index * 50)}
          style={styles.sectionButton}
        >
          <TouchableOpacity
            onPress={() => router.push(section.navigateTo)}
            accessibilityLabel={section.accessibilityLabel}
            accessibilityHint={section.accessibilityHint}
            accessibilityRole="button"
            testID={section.testID}
            activeOpacity={0.7}
            style={styles.sectionTouchable}     
          >
            <LinearGradient
  colors={[
    withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.22 : 0.16),
    withAlpha(currentTheme.colors.primary, isDarkMode ? 0.16 : 0.12),
    withAlpha("#FFFFFF", isDarkMode ? 0.10 : 0.18),
  ]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.sectionCardOuter}
>
  <View
    style={[
      styles.sectionCardInner,
      {
        backgroundColor: withAlpha(
          isDarkMode ? currentTheme.colors.cardBackground : "#FFFFFF",
          isDarkMode ? 0.54 : 0.90
        ),
      },
    ]}
  >
    {/* top highlight (premium) */}
    <LinearGradient
      pointerEvents="none"
      colors={[
        withAlpha("#FFFFFF", isDarkMode ? 0.16 : 0.30),
        "transparent",
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.sectionTopHighlight}
    />

    {/* halo */}
    <LinearGradient
      pointerEvents="none"
      colors={[
        withAlpha(currentTheme.colors.primary, isDarkMode ? 0.14 : 0.10),
        "transparent",
      ]}
      style={styles.sectionHalo}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 1, y: 1 }}
    />

    <View style={styles.sectionTopRow}>
      <View
        style={[
          styles.sectionIconBubble,
          {
            backgroundColor: withAlpha(
              currentTheme.colors.background,
              isDarkMode ? 0.18 : 0.30
            ),
            borderColor: withAlpha(
              currentTheme.colors.secondary,
              isDarkMode ? 0.16 : 0.12
            ),
          },
        ]}
      >
        <Ionicons
          name={section.icon as keyof typeof Ionicons.glyphMap}
          size={normalizeSize(20)}
          color={currentTheme.colors.secondary}
        />

        {(section.unclaimedCount ?? 0) > 0 && (
          <Animated.View entering={ZoomIn} style={styles.badgeDot}>
            {(section.unclaimedCount ?? 0) > 1 && (
              <Text style={styles.badgeText}>
   {section.unclaimedCount > 99 ? "99+" : section.unclaimedCount}
 </Text>
            )}
          </Animated.View>
        )}
      </View>

      <Ionicons
        name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
        size={normalizeSize(16)}
        color={withAlpha(currentTheme.colors.textSecondary, 0.75)}
      />
    </View>

    <Text
      style={[
        styles.sectionText,
        { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" },
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit
    >
      {section.name}
    </Text>
  </View>
</LinearGradient>

          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  ))}
</View>

         <View style={{ height: normalizeSize(10) }} />
          </View>
        </ScrollView>
        {/* Bannière pub */}
        {/* Bannière dockée au-dessus de la TabBar (iOS + Android) */}
{showBanners && (
  <View
  style={{
    position: "absolute",
    left: 0,
    right: 0,
    bottom: tabBarHeight + insets.bottom,
    alignItems: "center",
    zIndex: 50, // ✅ suffisant
    elevation: 50, // ✅ Android
    backgroundColor: "transparent",
    paddingBottom: 6,
  }}
  pointerEvents="box-none"
>

    <BannerSlot onHeight={handleAdHeight} />
  </View>
)}

        {/* 🌟 Modal Pioneer — Apple Keynote glass */}
<Modal
  visible={showPioneerModal}
  transparent
  animationType="fade"
  statusBarTranslucent
  onRequestClose={() => setShowPioneerModal(false)}
  presentationStyle="overFullScreen"
 hardwareAccelerated
>
  <View style={styles.pioneerOverlay} pointerEvents="auto">
    {/* Backdrop blur */}
    <BlurView intensity={55} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />

    {/* Soft dim */}
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDarkMode ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)" },
      ]}
    />

    <Animated.View
   entering={ZoomIn.duration(260)}
   style={[
     styles.pioneerWrap,
     {
       paddingTop: 0,
       paddingBottom: 0,
     },
   ]}
 >
      {/* Card */}
      <LinearGradient
        colors={
          isDarkMode
            ? [
                withAlpha(currentTheme.colors.cardBackground, 0.92),
                withAlpha(currentTheme.colors.background, 0.78),
              ]
            : ["rgba(255,255,255,0.92)", "rgba(255,245,230,0.92)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.pioneerCard,
          {
            borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.35 : 0.45),
            marginTop: insets.top + normalizeSize(10),
            marginBottom: insets.bottom + normalizeSize(10),
          },
        ]}
      >
        {/* Decorative halo */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.primary, isDarkMode ? 0.35 : 0.25),
            "transparent",
          ]}
          style={styles.pioneerHaloTop}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.28 : 0.22),
            "transparent",
          ]}
          style={styles.pioneerHaloBottom}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Content (scrollable si petit écran) */}
        <ScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.pioneerContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Icon ring */}
          <View style={styles.pioneerHero}>
            <LinearGradient
              colors={[
                withAlpha(currentTheme.colors.secondary, 0.95),
                withAlpha(currentTheme.colors.primary, 0.85),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pioneerIconRing}
            >
              <View
                style={[
                  styles.pioneerIconInner,
                  { backgroundColor: withAlpha(currentTheme.colors.background, isDarkMode ? 0.55 : 0.35) },
                ]}
              >
                <Ionicons name="sparkles" size={normalizeSize(28)} color={isDarkMode ? "#FFD36A" : "#FFB800"} />
              </View>
            </LinearGradient>

            <View style={styles.pioneerPillRow}>
              <View
                style={[
                  styles.pioneerPill,
                  { backgroundColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.16 : 0.12), borderColor: withAlpha(currentTheme.colors.secondary, 0.25) },
                ]}
              >
                <Text style={[styles.pioneerPillText, { color: isDarkMode ? currentTheme.colors.secondary : "#C86A00" }]}>
                  {t("pioneerModal.pill", { defaultValue: "1000 premiers" })}
                </Text>
              </View>

              <View
                style={[
                  styles.pioneerPill,
                  { backgroundColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.14 : 0.10), borderColor: withAlpha(currentTheme.colors.trophy, 0.22) },
                ]}
              >
                <Ionicons name="trophy" size={normalizeSize(14)} color={currentTheme.colors.trophy} />
                <Text style={[styles.pioneerPillText, { color: currentTheme.colors.trophy, marginLeft: 6 }]}>
                  +{50} {t("pioneerModal.trophiesShort", { defaultValue: "trophées" })}
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={[
              styles.pioneerTitle,
              { color: pioneerTextPrimary },
            ]}
            numberOfLines={3}
            adjustsFontSizeToFit
          >
            {t("pioneerModal.title", { defaultValue: "Tu fais partie des Pioneers." })}
          </Text>

          <Text style={[styles.pioneerDesc, { color: pioneerTextSecondary }]}>
            <Trans
              i18nKey="pioneerModal.description"
              values={{ first: 1000, trophies: 50 }}
              components={{ b: <Text style={[styles.pioneerBold, { color: isDarkMode ? pioneerTextPrimary : "#FF8A00" }]} />,
              }}
            />
          </Text>

          {/* Micro value props */}
          <View style={styles.pioneerBullets}>
            <View style={styles.pioneerBulletRow}>
              <Ionicons name="shield-checkmark-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
              <Text style={[styles.pioneerBulletText, { color: pioneerBulletTextColor }]}>
                {t("pioneerModal.b1", { defaultValue: "Badge Pioneer visible sur ton profil." })}
              </Text>
            </View>

            <View style={styles.pioneerBulletRow}>
              <Ionicons name="flash-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
              <Text style={[styles.pioneerBulletText, { color: pioneerBulletTextColor }]}>
                {t("pioneerModal.b2", { defaultValue: "Bonus immédiat pour accélérer ta progression." })}
              </Text>
            </View>

            <View style={styles.pioneerBulletRow}>
              <Ionicons name="people-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
              <Text style={[styles.pioneerBulletText, { color: pioneerBulletTextColor }]}>
                {t("pioneerModal.b3", { defaultValue: "Tu fais partie de la toute première vague." })}
              </Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={() => setShowPioneerModal(false)}
            activeOpacity={0.85}
            style={styles.pioneerCtaWrap}
            accessibilityRole="button"
            accessibilityLabel={t("pioneerModal.ctaA11y", { defaultValue: "Continuer" })}
            accessibilityHint={t("pioneerModal.ctaHintA11y", { defaultValue: "Ferme cette fenêtre et continue." })}
          >
            <LinearGradient
              colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pioneerCta}
            >
              <Text style={styles.pioneerCtaText}>
                {t("pioneerModal.cta", { defaultValue: "Let’s go 🚀" })}
              </Text>
              <Ionicons name="arrow-forward" size={normalizeSize(16)} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.pioneerFoot, { color: withAlpha(currentTheme.colors.textSecondary, 0.85) }]}>
            {t("pioneerModal.foot", { defaultValue: "Merci de construire l’aventure avec nous." })}
          </Text>
        </ScrollView>
      </LinearGradient>
    </Animated.View>
  </View>
</Modal>

{/* ✅ Matching Inbox Modal */}
<MatchingInboxModal
  visible={matchingInboxVisible}
  onClose={() => setMatchingInboxVisible(false)}
  items={matchingItems}
  onAccepted={(item) => {
    setMatchingInboxVisible(false);
    // Naviguer vers le challenge-details du duo accepté
    router.push(`/challenge-details/${item.challengeId}`);
  }}
/>


      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    paddingHorizontal: normalizeSize(16),
  paddingTop: normalizeSize(10),
  },
inline: {
  flexDirection: "row",
  alignItems: "center",
},
 pageInner: {
   width: "100%",
   borderRadius: normalizeSize(24),
   padding: normalizeSize(14),
   backgroundColor: "rgba(255,255,255,0.02)",
 },

infoBlock: {               // AVANT: marginBottom: normalizeSize(12)
  marginBottom: normalizeSize(6),
},
fieldLabel: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  opacity: 0.9,
  marginBottom: normalizeSize(6),
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
 textAlign: I18nManager.isRTL ? "right" : "left",
},

fieldValue: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(14),
  lineHeight: normalizeSize(18),
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
 textAlign: I18nManager.isRTL ? "right" : "left",
},
softDivider: {             // AVANT: marginVertical: normalizeSize(8)
  height: 1,
  backgroundColor: "rgba(255,255,255,0.08)",
  marginVertical: normalizeSize(1),
},
interestsRow: {            // AVANT: gap: normalizeSize(8)
  flexDirection: "row",
  flexWrap: "wrap",
  gap: normalizeSize(3),
},
heroHeader: {
  paddingHorizontal: normalizeSize(18),
  paddingTop: normalizeSize(6),
  paddingBottom: normalizeSize(8),
},
heroTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(22),
  letterSpacing: -0.2,
},
heroSubtitle: {
  marginTop: normalizeSize(4),
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
  lineHeight: normalizeSize(18),
},

cardHaloTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.22,
  left: -SCREEN_WIDTH * 0.18,
  width: SCREEN_WIDTH * 0.70,
  height: SCREEN_WIDTH * 0.70,
  borderRadius: SCREEN_WIDTH * 0.35,
},
cardHaloBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.25,
  right: -SCREEN_WIDTH * 0.20,
  width: SCREEN_WIDTH * 0.80,
  height: SCREEN_WIDTH * 0.80,
  borderRadius: SCREEN_WIDTH * 0.40,
},

pioneerOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 0,
},

pioneerWrap: {
  width: "100%",
  paddingHorizontal: normalizeSize(16),
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
},
trophyChipWrap: {
  position: "absolute",
  zIndex: 5,
},

trophyChip: {
  borderWidth: 1,
  borderRadius: normalizeSize(999),
  overflow: "hidden",
  paddingVertical: normalizeSize(6),
  paddingHorizontal: normalizeSize(8),
  minHeight: normalizeSize(28),
  minWidth: normalizeSize(56),
  justifyContent: "center",

  // shadow iOS + elevation Android
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 14,
  shadowOpacity: Platform.OS === "ios" ? 0.18 : 0,
elevation: Platform.OS === "android" ? 12 : 0,
},

trophyHalo: {
  position: "absolute",
  top: -normalizeSize(22),
  left: -normalizeSize(18),
  width: normalizeSize(80),
  height: normalizeSize(80),
  borderRadius: normalizeSize(40),
},

trophyRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(6),
},

trophyIconBubble: {
  width: normalizeSize(20),
  height: normalizeSize(20),
  borderRadius: normalizeSize(10),
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
},

trophyChipText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  letterSpacing: -0.2,

  // ✅ chiffres alignés (iOS)
  fontVariant: ["tabular-nums"],

  // ✅ Android vertical centering clean
  includeFontPadding: false,
  textAlignVertical: "center",
},

pioneerCard: {
  width: "100%",
  maxWidth: 520,
  borderRadius: normalizeSize(24),
  borderWidth: 1,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 18,
  elevation: 12,
},

pioneerHaloTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.2,
  left: -SCREEN_WIDTH * 0.15,
  width: SCREEN_WIDTH * 0.7,
  height: SCREEN_WIDTH * 0.7,
  borderRadius: SCREEN_WIDTH * 0.35,
},

pioneerHaloBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.25,
  right: -SCREEN_WIDTH * 0.2,
  width: SCREEN_WIDTH * 0.85,
  height: SCREEN_WIDTH * 0.85,
  borderRadius: SCREEN_WIDTH * 0.425,
},

pioneerClose: {
  position: "absolute",
  top: normalizeSize(12),
  right: normalizeSize(12),
  width: normalizeSize(36),
  height: normalizeSize(36),
  borderRadius: normalizeSize(18),
  alignItems: "center",
  justifyContent: "center",
  zIndex: 5,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
},

pioneerContent: {
  paddingTop: normalizeSize(28),
  paddingHorizontal: normalizeSize(18),
  paddingBottom: normalizeSize(18),
  alignItems: "center",
},

pioneerHero: {
  alignItems: "center",
  marginBottom: normalizeSize(10),
},

pioneerIconRing: {
  width: normalizeSize(72),
  height: normalizeSize(72),
  borderRadius: normalizeSize(36),
  alignItems: "center",
  justifyContent: "center",
},

pioneerIconInner: {
  width: normalizeSize(56),
  height: normalizeSize(56),
  borderRadius: normalizeSize(28),
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
},

pioneerPillRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: normalizeSize(12),
  gap: normalizeSize(8),
},

pioneerPill: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: normalizeSize(10),
  paddingVertical: normalizeSize(6),
  borderRadius: normalizeSize(999),
  borderWidth: 1,
},

pioneerPillText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
},

pioneerTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(22),
  textAlign: "center",
  marginTop: normalizeSize(6),
},

pioneerDesc: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(14),
  lineHeight: normalizeSize(20),
  textAlign: "center",
  marginTop: normalizeSize(10),
},

pioneerBold: {
  fontFamily: "Comfortaa_700Bold",
},

pioneerBullets: {
  width: "100%",
  marginTop: normalizeSize(14),
  padding: normalizeSize(12),
  borderRadius: normalizeSize(16),
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},

pioneerBulletRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: normalizeSize(10),
  marginBottom: normalizeSize(10),
},

pioneerBulletText: {
  flex: 1,
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
  lineHeight: normalizeSize(18),
},

pioneerCtaWrap: {
  width: "100%",
  marginTop: normalizeSize(14),
},

pioneerCta: {
  width: "100%",
  borderRadius: normalizeSize(16),
  paddingVertical: normalizeSize(12),
  paddingHorizontal: normalizeSize(14),
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: normalizeSize(10),
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius: 12,
  elevation: 10,
},

pioneerCtaText: {
  color: "#fff",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(14),
},

pioneerFoot: {
  marginTop: normalizeSize(12),
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(12),
  textAlign: "center",
},

placeholderChip: {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.16)",
  paddingVertical: normalizeSize(6),
  paddingHorizontal: normalizeSize(10),
  borderRadius: normalizeSize(10),
  backgroundColor: "rgba(255,255,255,0.04)",
},

placeholderChipText: {
  marginLeft: normalizeSize(6),
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
},

interestPill: {
  borderWidth: 1,
  paddingVertical: normalizeSize(6),
  paddingHorizontal: normalizeSize(10),
  borderRadius: normalizeSize(12),
  marginRight: normalizeSize(6),
  marginBottom: normalizeSize(6),
  backgroundColor: "rgba(255,255,255,0.06)",
},

interestPillText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
},

editFab: {
  position: "absolute",
  top: normalizeSize(-8),
  right: normalizeSize(-8),
  borderRadius: normalizeSize(16),
  overflow: "hidden",
  elevation: 6,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
},
modalBold: {
  fontFamily: "Comfortaa_700Bold",
},
editFabInner: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: normalizeSize(8),
  paddingHorizontal: normalizeSize(12),
},

editFabText: {
  color: "#fff",
  marginLeft: normalizeSize(6),
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
},

  headerWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
  },

  profileCardWrapper: {
    marginBottom: SPACING,
  },

  profileCard: {
    borderRadius: normalizeSize(25),
    padding: normalizeSize(20),
    overflow: "hidden",
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: normalizeSize(12) },
  shadowOpacity: 0.10,
  shadowRadius: normalizeSize(26),
  elevation: 2,
  },
  avatarContainer: {
    alignItems: "center",
    position: "relative",
  },
  avatar: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    borderWidth: 4,
  },
  userInfo: {
    marginTop: normalizeSize(15),
    alignItems: "center",
    width: "100%",
  },
  username: {
    fontSize: normalizeSize(26),
    fontFamily: "Comfortaa_700Bold",
    letterSpacing: -0.3,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "center",
  },
  detailsContainer: {
    marginTop: normalizeSize(15),
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: normalizeSize(4),
    maxWidth: SCREEN_WIDTH * 0.8,
  },

  location: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginLeft: normalizeSize(6),
  },

  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: normalizeSize(10),
    padding: normalizeSize(8),
    borderRadius: normalizeSize(15),
  },

  interestText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    paddingVertical: normalizeSize(4),
    paddingHorizontal: normalizeSize(10),
    borderRadius: normalizeSize(12),
    margin: normalizeSize(4),
    backgroundColor: BORDER_COLOR_LIGHT,
  },
  moreInterests: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    paddingVertical: normalizeSize(4),
    paddingHorizontal: normalizeSize(10),
    borderRadius: normalizeSize(12),
    margin: normalizeSize(4),
    backgroundColor: BORDER_COLOR_LIGHT,
  },
  sectionsContainer: {
    marginTop: SPACING,
  },
  sectionTouchable: {
  flex: 1,                  // 👉 le touchable remplit toute la carte
},
  rowContainer: {
    flexDirection: "row",
    marginBottom: SPACING,
    alignItems: "stretch",
    gap: normalizeSize(12),
  },
  sectionButton: {
    flex: 1,
  borderRadius: normalizeSize(18),
    overflow: "hidden",
    shadowColor: "transparent",
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
    minHeight: normalizeSize(112),
  },
 sectionCardOuter: {
   flex: 1,
   borderRadius: normalizeSize(18),
   padding: 1.2,              // stroke fin = premium
 overflow: "hidden",
 shadowColor: "transparent",
 shadowOpacity: 0,
 shadowRadius: 0,
 elevation: 0,
 },
 sectionCardInner: {
   flex: 1,
   borderRadius: normalizeSize(17),
   paddingHorizontal: normalizeSize(12),
   paddingVertical: normalizeSize(12),
   justifyContent: "space-between",
   overflow: "hidden",
   shadowColor: "transparent",
 shadowOpacity: 0,
 shadowRadius: 0,
 elevation: 0,
 },
 sectionTopHighlight: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: normalizeSize(22),
},

  sectionHalo: {
    position: "absolute",
    top: -normalizeSize(34),
    left: -normalizeSize(26),
    width: normalizeSize(110),
    height: normalizeSize(110),
    borderRadius: normalizeSize(55),
  },
  sectionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionIconBubble: {
    width: normalizeSize(42),
    height: normalizeSize(42),
    borderRadius: normalizeSize(21),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
gradientContainer: { flex: 1 },

bgOrbTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.25,
  left: -SCREEN_WIDTH * 0.2,
  width: SCREEN_WIDTH * 0.9,
  height: SCREEN_WIDTH * 0.9,
  borderRadius: SCREEN_WIDTH * 0.45,
},

bgOrbBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.3,
  right: -SCREEN_WIDTH * 0.25,
  width: SCREEN_WIDTH * 1.1,
  height: SCREEN_WIDTH * 1.1,
  borderRadius: SCREEN_WIDTH * 0.55,
},

  sectionGradient: {
    flex: 1,
  width: "100%",
  minHeight: normalizeSize(110),          // même base que sectionButton
  paddingVertical: normalizeSize(14),
  paddingHorizontal: normalizeSize(10),
  alignItems: "center",
  justifyContent: "space-between",        // icon + texte bien respirent
  borderRadius: normalizeSize(15),
  },

  iconContainer: {
    position: "relative",
  },

  sectionText: {
    fontSize: normalizeSize(13),
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalizeSize(8),
    textAlign: I18nManager.isRTL ? "right" : "left",
    maxWidth: "100%",
    flexShrink: 1,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
  },
bannerContainer: {
  width: "100%",
  alignItems: "center",
  backgroundColor: "transparent",
},
  blurView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  modalContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: normalizeSize(20),
    padding: normalizeSize(20),
    width: "80%",
    alignItems: "center",
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
  },

  modalTitle: {
    fontSize: normalizeSize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(10),
    textAlign: "center",
  },

  modalDescription: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: normalizeSize(20),
  },

  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(20),
    backgroundColor: "#FFB800",
  },

  nextButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFF",
    marginRight: normalizeSize(5),
  },

  badgeDot: {
    position: "absolute",
    top: normalizeSize(-4),
    right: normalizeSize(-4),
    minWidth: normalizeSize(18),
   height: normalizeSize(18),
   borderRadius: normalizeSize(999),
    backgroundColor: "#FF4D4F",
    alignItems: "center",
   justifyContent: "center",
   paddingHorizontal: normalizeSize(5),
    borderWidth: 1,
    borderColor: "#FFF",
     overflow: "hidden",
  },

  badgeText: {
    color: "#FFF",
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_700Bold",
    lineHeight: normalizeSize(12),         // ✅ centrage vertical stable
   textAlign: "center",
   includeFontPadding: false,             // ✅ Android: vire le padding fantôme
   textAlignVertical: "center",
  },
});
