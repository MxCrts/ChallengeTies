import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileUpdate } from "../../context/ProfileUpdateContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useSharedValue, withTiming, useAnimatedStyle } from "react-native-reanimated";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import TutorialModal from "../../components/TutorialModal";
import { runOnJS } from 'react-native-reanimated';
import { useFocusEffect } from "@react-navigation/native";


const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BORDER_COLOR_LIGHT = "rgba(255, 255, 255, 0.2)";
const SHADOW_COLOR = "#000";

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface UserData {
  username?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  profileImage?: string;
  trophies?: number;
  newAchievements?: string[];
}

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const fadeAnim = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: fadeAnim.value,
  }));
  const scrollViewRef = useRef<ScrollView>(null);
  const { profileUpdated } = useProfileUpdate();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { t } = useTranslation();
  const {
    tutorialStep,
    isTutorialActive,
    startTutorial,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();

  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-4725616526467159/3887969618";

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
    // remonte vertical en haut
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [])
);

  useEffect(() => {
  fadeAnim.value = withTiming(1, { duration: 300 });
  setIsNavigating(false);
}, []);


  // Sections
  const sections = useMemo(() => {
    return [
      {
        name: t("editProfile"),
        icon: "person-circle-outline",
        navigateTo: "profile/UserInfo",
        testID: "edit-profile-button",
        accessibilityLabel: t("access.editProfile.label"),
        accessibilityHint: t("access.editProfile.hint"),
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
        name: t("ongoingChallenges"),
        icon: "flag-outline",
        navigateTo: "profile/CurrentChallenges",
        testID: "current-challenges-button",
        accessibilityLabel: t("access.ongoingChallenges.label"),
        accessibilityHint: t("access.ongoingChallenges.hint"),
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
        name: t("completedChallenges"),
        icon: "checkmark-done-outline",
        navigateTo: "profile/CompletedChallenges",
        testID: "completed-challenges-button",
        accessibilityLabel: t("access.completedChallenges.label"),
        accessibilityHint: t("access.completedChallenges.hint"),
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
        name: t("myChallenges"),
        icon: "create-outline",
        navigateTo: "profile/MyChallenges",
        testID: "my-challenges-button",
        accessibilityLabel: t("access.myChallenges.label"),
        accessibilityHint: t("access.myChallenges.hint"),
      },
    ];
  }, [t, userData]);

  // Grille des sections
  const rows = useMemo<Array<typeof sections>>(() => {
    const split: Array<typeof sections> = [];
    for (let i = 0; i < sections.length; i += 2) {
      split.push(sections.slice(i, i + 2));
    }
    return split;
  }, [sections]);

  const interests = userData?.interests
    ? Array.isArray(userData.interests)
      ? userData.interests.join(", ")
      : userData.interests
    : "";

  // Métadonnées SEO
  const metadata = useMemo(
    () => ({
      title: t("yourProfile"),
      description: t("profile.description", {
        username: userData?.username || "Utilisateur",
      }),
      url: `https://challengeme.com/profile/${auth.currentUser?.uid}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: userData?.username || "Utilisateur",
        description: userData?.bio || t("addBioHere"),
      },
    }),
    [t, userData]
  );

  const navigateWithFade = (path: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    // fade-out
    fadeAnim.value = withTiming(0, { duration: 300 }, (isFinished) => {
      if (isFinished) {
        // on navigue depuis le thread JS
        runOnJS(router.replace)(path);
        // on réinitialise l’opacité
        fadeAnim.value = 1;
        runOnJS(setIsNavigating)(false);
      }
    });
  };


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
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
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
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
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
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
            <Animated.View style={animatedStyle}>

      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
          ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
          >
            {/* Header */}
            <View style={styles.headerWrapper}>
              <CustomHeader title={t("yourProfile")} />
            </View>

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
                    accessibilityLabel={t("profile.avatar", {
                      username: userData?.username ?? "Utilisateur",
                    })}
                  />
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

                {/* Détails */}
                <Animated.View
                  entering={FadeInUp.delay(400)}
                  style={[
                    styles.detailsContainer,
                    { alignItems: "flex-start" },
                  ]}
                >
                  {/* 1. Bio */}
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="person-outline"
                      size={normalizeSize(16)}
                      color={
                        isDarkMode ? currentTheme.colors.textPrimary : "#333333"
                      }
                    />
                    <Text
                      style={{
                        ...styles.location,
                        color: isDarkMode
                          ? currentTheme.colors.textSecondary
                          : "#333333",
                        marginLeft: normalizeSize(8),
                        flex: 1,
                      }}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                    >
                      {userData?.bio ?? t("addBioHere")}
                    </Text>
                  </View>

                  {/* 2. Location */}
                  <View
                    style={[styles.infoRow, { marginTop: normalizeSize(10) }]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={normalizeSize(16)}
                      color={
                        isDarkMode ? currentTheme.colors.textPrimary : "#333333"
                      }
                    />
                    <Text
                      style={{
                        ...styles.location,
                        color: isDarkMode
                          ? currentTheme.colors.textSecondary
                          : "#333333",
                        marginLeft: normalizeSize(8),
                        flex: 1,
                      }}
                    >
                      {userData?.location ?? t("unknownLocation")}
                    </Text>
                  </View>

                  {/* 3. Interests */}
                  <View
                    style={[styles.infoRow, { marginTop: normalizeSize(10) }]}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={normalizeSize(16)}
                      color={
                        isDarkMode ? currentTheme.colors.textPrimary : "#333333"
                      }
                    />
                    <Text
                      style={{
                        ...styles.location, // on réutilise le même style
                        color: isDarkMode
                          ? currentTheme.colors.textSecondary
                          : "#333333",
                        marginLeft: normalizeSize(8),
                        flex: 1,
                      }}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                    >
                      {interests || t("noInterests")}
                    </Text>
                  </View>
                </Animated.View>
              </LinearGradient>
            </Animated.View>

            {/* Sections / Boutons */}
            <View style={styles.sectionsContainer}>
              {rows.map((row, rowIndex) => (
                <Animated.View
                  key={rowIndex}
                  entering={FadeInUp.delay(500 + rowIndex * 100)}
                  style={{
                    ...styles.rowContainer,
                    justifyContent:
                      row.length === 1 ? "center" : "space-between",
                  }}
                >
                  {row.map((section, index) => (
                    <Animated.View
                      key={index}
                      entering={ZoomIn.delay(200 + index * 50)}
                      style={styles.sectionButton}
                    >
                      <TouchableOpacity
                        onPress={() => navigateWithFade(section.navigateTo)}
                        accessibilityLabel={section.accessibilityLabel}
                        accessibilityHint={section.accessibilityHint}
                        accessibilityRole="button"
                        testID={section.testID}
                        activeOpacity={0.7}
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
                            {section.unclaimedCount > 0 && (
                              <Animated.View
                                entering={ZoomIn}
                                style={styles.badgeDot}
                              >
                                {section.unclaimedCount > 1 && (
                                  <Text style={styles.badgeText}>
                                    {section.unclaimedCount}
                                  </Text>
                                )}
                              </Animated.View>
                            )}
                          </View>
                          <Text
                            style={{
                              ...styles.sectionText,
                              color: isDarkMode
                                ? currentTheme.colors.textPrimary
                                : "#333333",
                            }}
                            numberOfLines={1}
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
        </SafeAreaView>
        {/* Bannière pub */}
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdFailedToLoad={(err) =>
              console.error("Échec chargement bannière:", err)
            }
          />
        </View>

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
      </LinearGradient>
      </Animated.View>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    padding: SPACING,
    paddingBottom: normalizeSize(140),
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

  rowContainer: {
    flexDirection: "row",
    marginBottom: SPACING,
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
    minHeight: normalizeSize(100),
    marginBottom: SPACING,
  },

  sectionGradient: {
    flex: 1,
    width: "100%",
    paddingVertical: normalizeSize(20),
    alignItems: "center",
    justifyContent: "center",
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
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: SPACING / 2,
    backgroundColor: "transparent",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
