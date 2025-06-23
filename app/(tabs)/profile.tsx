import React, { useState, useEffect, useMemo } from "react";
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
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import TutorialModal from "../../components/TutorialModal";
import { normalize } from "../../utils/normalize";

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
      {
        name: t("activity"),
        icon: "notifications-outline",
        navigateTo: "profile/Notifications",
        testID: "activity-button",
        accessibilityLabel: t("access.activity.label"),
        accessibilityHint: t("access.activity.hint"),
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

  const interests = useMemo(
    () => (Array.isArray(userData?.interests) ? userData.interests : []),
    [userData]
  );

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
            {t("profile.loading")}
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
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView
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
                  : ["#FFFFFF", "#FFE4B5"] // Dégradé blanc vers orange clair en light
              }
              style={[
                styles.profileCard,
                {
                  borderWidth: 2,
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary // Couleur icônes en dark
                    : "#FFB800", // Orange en light
                },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Avatar + badge */}
              <View style={styles.avatarContainer}>
                <Image
                  source={
                    userData?.profileImage
                      ? { uri: userData.profileImage }
                      : require("../../assets/images/default-profile.jpg")
                  }
                  defaultSource={require("../../assets/images/default-profile.jpg")}
                  style={[
                    styles.avatar,
                    {
                      borderColor: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#FFB800", // Orange en light
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

              {/* Infos utilisateur */}
              <Animated.View
                entering={FadeInUp.delay(200)}
                style={styles.userInfo}
              >
                <Text
                  style={{
                    ...styles.username,
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  }}
                >
                  {userData?.username ?? "Utilisateur"}
                </Text>
                <Text
                  style={{
                    ...styles.bio,
                    color: isDarkMode
                      ? currentTheme.colors.textSecondary
                      : "#333333",
                  }}
                >
                  {userData?.bio ?? t("addBioHere")}
                </Text>
              </Animated.View>

              {/* Détails */}
              <Animated.View
                entering={FadeInUp.delay(400)}
                style={styles.detailsContainer}
              >
                <View style={styles.infoRow}>
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
                    }}
                  >
                    {userData?.location ?? t("unknownLocation")}
                  </Text>
                </View>

                {/* Intérêts */}
                {interests.length > 0 && (
                  <View
                    style={[
                      styles.interestsContainer,
                      {
                        backgroundColor: isDarkMode
                          ? `${currentTheme.colors.overlay}80`
                          : "#FFE4B5",
                      },
                    ]}
                  >
                    {interests.slice(0, 3).map((interest, index) => (
                      <Text
                        key={index}
                        style={{
                          ...styles.interestText,
                          color: isDarkMode
                            ? currentTheme.colors.textPrimary
                            : "#333333",
                        }}
                        accessibilityLabel={t("profile.interest", { interest })}
                      >
                        {interest}
                      </Text>
                    ))}
                    {interests.length > 3 && (
                      <Text
                        style={{
                          ...styles.moreInterests,
                          color: isDarkMode
                            ? currentTheme.colors.textPrimary
                            : "#333333",
                        }}
                        accessibilityLabel={t("profile.moreInterests", {
                          count: interests.length - 3,
                        })}
                      >
                        +{interests.length - 3}
                      </Text>
                    )}
                  </View>
                )}
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
                  justifyContent: row.length === 1 ? "center" : "space-between",
                }}
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
                    >
                      <LinearGradient
                        colors={
                          isDarkMode
                            ? [
                                currentTheme.colors.cardBackground,
                                currentTheme.colors.background,
                              ]
                            : ["#FFFFFF", "#FFF5E6"] // Dégradé subtil en light
                        }
                        style={[
                          styles.sectionGradient,
                          {
                            borderWidth: isDarkMode ? 1 : 2,
                            borderColor: isDarkMode
                              ? currentTheme.colors.secondary // Couleur icônes en dark
                              : "#FFB800", // Orange en light
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

        {/* Bannière pub */}
        <Animated.View
          entering={FadeInUp.delay(300)}
          style={styles.bannerContainer}
        >
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => console.log("Bannière chargée")}
            onAdFailedToLoad={(err) =>
              console.error("Échec chargement bannière:", err)
            }
          />
        </Animated.View>

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
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    padding: SPACING,
    paddingBottom: SPACING * 3, // assez mais pas excessif
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
  },

  username: {
    fontSize: normalizeSize(26),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: SHADOW_COLOR,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  bio: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(8),
    paddingHorizontal: normalizeSize(20),
  },

  detailsContainer: {
    marginTop: normalizeSize(15),
    alignItems: "center",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
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
    shadowOpacity: 0.1, // Ombre très légère
    shadowRadius: normalizeSize(4),
    elevation: 3,
    minHeight: normalizeSize(100),
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
    position: "absolute",
    bottom: Platform.OS === "android" ? SPACING * 2 : SPACING, // Décalage pour éviter les tabs
    width: SCREEN_WIDTH,
    alignItems: "center",
    paddingBottom: Platform.OS === "android" ? SPACING * 2 : 0, // Ajustement pour Android
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
