import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
  I18nManager,
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
// ✅ à ajouter
import BannerSlot from "@/components/BannerSlot";
// 🆕 Inventaire (résumé)
import InventorySection from "@/components/InventorySection";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import TutorialModal from "../../components/TutorialModal";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PioneerBadge from "@/components/PioneerBadge";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BORDER_COLOR_LIGHT = "rgba(255, 255, 255, 0.2)";
const SHADOW_COLOR = "#000";

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
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
const [showPioneerModal, setShowPioneerModal] = useState(false);

const bottomContentPadding =
  (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom + normalizeSize(90);

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

    const checkPioneerFlag = async () => {
      try {
        const flag = await AsyncStorage.getItem("pioneerJustGranted");
        if (cancelled) return;

        if (flag === "1") {
          setShowPioneerModal(true);

          // ✅ évite tout rebond / re-open même si la nav bug
          await AsyncStorage.multiRemove([
            "pioneerJustGranted",
          ]);
        }
      } catch {}
    };

    // only if user loaded (sinon inutile)
    if (auth.currentUser?.uid) {
      checkPioneerFlag();
    }

    return () => {
      cancelled = true;
    };
  }, [])
);


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
      name: t("notifications"),
      icon: "notifications-outline",
      navigateTo: "profile/notifications",
      testID: "notifications-button",
      unclaimedCount: userData?.unreadNotifications ?? 0,
      accessibilityLabel: t("access.notifications.label"),
      accessibilityHint: t("access.notifications.hint"),
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
              {error || t("profile.noData")}
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

  <ScrollView
    contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomContentPadding }]}
    showsVerticalScrollIndicator={false}
    contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
    keyboardShouldPersistTaps="handled"
   accessibilityRole="summary"
   accessibilityLabel={t("profile.sectionsListA11y", {
     defaultValue: "Contenu du profil et liste des sections",
   })}
  >

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
                    borderWidth: 2,
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FFB800",
                  },
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
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
                        borderColor: isDarkMode
                          ? currentTheme.colors.textPrimary
                          : "#FFB800",
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
                    entering={ZoomIn.delay(300)}
                    style={[
                      styles.trophyBadge,
                      {
                        backgroundColor: isDarkMode
                          ? currentTheme.colors.background
                          : currentTheme.colors.cardBackground,
                        borderColor: currentTheme.colors.trophy,
                      },
                    ]}
                  >
                    <Ionicons
                      name="trophy"
                      size={normalizeSize(20)}
                      color={currentTheme.colors.trophy}
                    />
                    <Text
                      style={[
                        styles.trophyBadgeText,
                        { color: currentTheme.colors.trophy },
                      ]}
                    >
                      {userData?.trophies ?? 0}
                    </Text>
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
</Animated.View>


              </LinearGradient>
            </Animated.View>

            {/* Inventaire (résumé rapide) */}
            <InventorySection
              userData={userData}
              onPressItem={() => router.push("profile/Inventory")}
            />

            {/* Sections / Boutons */}
            <View key={i18n.language} style={styles.sectionsContainer}>
  {rows.map((row, rowIndex) => (
    <Animated.View
      key={rowIndex}
      entering={FadeInUp.delay(500 + rowIndex * 100)}
      style={[
        styles.rowContainer,
        {
          justifyContent: row.length === 1 ? "center" : "space-between",
        },
      ]}
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
            style={styles.sectionTouchable}      // 🆕 important
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? [
                      currentTheme.colors.cardBackground,
                      currentTheme.colors.background,
                    ]
                  : ["#FFFFFF", "#FFF5E6"]
              }
              style={[
                styles.sectionGradient,
                {
                  borderWidth: isDarkMode ? 1 : 2,
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
                },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={
                    section.icon as keyof typeof Ionicons.glyphMap
                  }
                  size={normalizeSize(32)}
                  color={currentTheme.colors.secondary}
                />
                {(section.unclaimedCount ?? 0) > 0 && (
                  <Animated.View
                    entering={ZoomIn}
                    style={styles.badgeDot}
                  >
                    {(section.unclaimedCount ?? 0) > 1 && (
                      <Text style={styles.badgeText}>
                        {section.unclaimedCount}
                      </Text>
                    )}
                  </Animated.View>
                )}
              </View>

              <Text
                style={[
                  styles.sectionText,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#333333",
                  },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {section.name}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  ))}
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
      zIndex: 9999,
      backgroundColor: "transparent",
      paddingBottom: 6,
    }}
    pointerEvents="box-none"
  >
    <BannerSlot onHeight={handleAdHeight} />
  </View>
)}




        {/* Tutoriel actif */}
        {isTutorialActive && tutorialStep === 2 && (
          <BlurView intensity={50} style={styles.blurView}>
            <TutorialModal
              step={tutorialStep}
              onNext={() => setTutorialStep(3)}
              onStart={() => {}}
              onSkip={skipTutorial}
              onFinish={skipTutorial}
            />
          </BlurView>
        )}
        {/* 🌟 Modal Pioneer (1000 premiers) — déclenché uniquement à l’ouverture du profil */}
<Modal
  visible={showPioneerModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowPioneerModal(false)}
>
  <View style={styles.blurView}>
    <View style={styles.modalContainer}>
      <Ionicons name="sparkles" size={normalizeSize(36)} color="#FFB800" />

      <Text style={styles.modalTitle} numberOfLines={2} adjustsFontSizeToFit>
        {t("pioneerModal.title")}
      </Text>

      <Text style={styles.modalDescription}>
  <Trans
    i18nKey="pioneerModal.description"
    values={{ first: 1000, trophies: 50 }}
    components={{
      b: <Text style={styles.modalBold} />,
    }}
  />
</Text>

      <TouchableOpacity
        onPress={() => setShowPioneerModal(false)}
        style={styles.nextButton}
        accessibilityRole="button"
        accessibilityLabel={t("pioneerModal.closeA11y", {
          defaultValue: "Fermer la fenêtre Pioneer",
        })}
      >
        <Text style={styles.nextButtonText}>
          {t("pioneerModal.cta", { defaultValue: "Let's go 🚀" })}
        </Text>
        <Ionicons name="arrow-forward" size={normalizeSize(16)} color="#FFF" />
      </TouchableOpacity>
    </View>
  </View>
</Modal>

      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    padding: SPACING,
    paddingBottom: normalizeSize(140),
  },
inline: {
  flexDirection: "row",
  alignItems: "center",
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
  backgroundColor: "rgba(255,255,255,0.12)",
  marginVertical: normalizeSize(1),
},
interestsRow: {            // AVANT: gap: normalizeSize(8)
  flexDirection: "row",
  flexWrap: "wrap",
  gap: normalizeSize(3),
},

placeholderChip: {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: "rgba(255,255,255,0.35)",
  paddingVertical: normalizeSize(6),
  paddingHorizontal: normalizeSize(10),
  borderRadius: normalizeSize(10),
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
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(6),
    elevation: 5,
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

  trophyBadge: {
    position: "absolute",
    bottom: -normalizeSize(10),
    right: normalizeSize(10),
    borderRadius: normalizeSize(20),
    padding: normalizeSize(6),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
  },

  trophyBadgeText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: normalizeSize(4),
  },

  userInfo: {
    marginTop: normalizeSize(15),
    alignItems: "center",
    width: "100%",
  },

  username: {
    fontSize: normalizeSize(26),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: SHADOW_COLOR,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
  },
  sectionButton: {
    width: "48%",
  borderRadius: normalizeSize(15),
  overflow: "hidden",
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: normalizeSize(2) },
  shadowOpacity: 0.1,
  shadowRadius: normalizeSize(4),
  elevation: 3,
  minHeight: normalizeSize(110),
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
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalizeSize(10),
    textAlign: "center",
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
    minWidth: normalizeSize(16),
    height: normalizeSize(16),
    borderRadius: normalizeSize(8),
    backgroundColor: "#FF4D4F",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFF",
  },

  badgeText: {
    color: "#FFF",
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_700Bold",
  },
});
