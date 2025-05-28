import React, { useState, useEffect } from "react";
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
import Animated, { FadeInUp } from "react-native-reanimated";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

// Import de SPACING depuis index.tsx pour cohérence
const SPACING = 15;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

// Typage strict pour userData
interface UserData {
  username?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  profileImage?: string;
  trophies?: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profileUpdated } = useProfileUpdate();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { t } = useTranslation();

  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-4725616526467159/3887969618";

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      setError(t("noUserConnected"));
      return;
    }
    const userRef = doc(db, "users", userId);
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserData(snapshot.data() as UserData);
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
  }, [profileUpdated]);

  if (isLoading) {
    return (
      <GlobalLayout>
        <StatusBar
          translucent={true}
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
            Chargement du profil...
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  if (error) {
    return (
      <GlobalLayout>
        <StatusBar
          translucent={true}
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
            {error}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  const sections = [
    {
      name: t("editProfile"),
      icon: "person-circle-outline",
      navigateTo: "profile/UserInfo",
      accessibilityLabel: t("editProfile"),
      testID: "edit-profile-button",
    },
    {
      name: t("statistics"),
      icon: "stats-chart-outline",
      navigateTo: "profile/UserStats",
      accessibilityLabel: t("statistics"),
      testID: "stats-button",
    },
    {
      name: t("ongoingChallenges"),
      icon: "flag-outline",
      navigateTo: "profile/CurrentChallenges",
      accessibilityLabel: t("ongoingChallenges"),
      testID: "current-challenges-button",
    },
    {
      name: t("favorites"),
      icon: "bookmark-outline",
      navigateTo: "profile/SavedChallenges",
      accessibilityLabel: t("favorites"),
      testID: "favorites-button",
    },
    {
      name: t("completedChallenges"),
      icon: "checkmark-done-outline",
      navigateTo: "profile/CompletedChallenges",
      accessibilityLabel: t("completedChallenges"),
      testID: "completed-challenges-button",
    },
    {
      name: t("rewards"),
      icon: "medal-outline",
      navigateTo: "profile/Achievements",
      accessibilityLabel: t("rewards"),
      testID: "achievements-button",
    },
    {
      name: t("myChallenges"),
      icon: "create-outline",
      navigateTo: "profile/MyChallenges",
      accessibilityLabel: t("myChallenges"),
      testID: "my-challenges-button",
    },
  ];

  const rows = [];
  for (let i = 0; i < sections.length; i += 2) {
    rows.push(sections.slice(i, i + 2));
  }

  const interests: string[] = Array.isArray(userData?.interests)
    ? userData.interests
    : [];

  return (
    <GlobalLayout>
      <StatusBar
        translucent={true}
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerWrapper}>
            <CustomHeader title={t("yourProfile")} />
          </View>

          {/* Carte de profil */}
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.profileCardWrapper}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.secondary,
                currentTheme.colors.background,
              ]}
              style={styles.profileCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View
                style={[
                  styles.overlay,
                  { backgroundColor: currentTheme.colors.overlay },
                ]}
              />
              <View style={styles.avatarContainer}>
                <Image
                  source={
                    userData?.profileImage
                      ? { uri: userData.profileImage }
                      : require("../../assets/images/default-profile.jpg")
                  }
                  style={[
                    styles.avatar,
                    { borderColor: currentTheme.colors.textPrimary },
                  ]}
                />
                <Animated.View
                  entering={FadeInUp.delay(300)}
                  style={[
                    styles.trophyBadge,
                    {
                      backgroundColor: currentTheme.colors.background,
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
                    {userData?.trophies || 0}
                  </Text>
                </Animated.View>
              </View>
              <Animated.View
                entering={FadeInUp.delay(200)}
                style={styles.userInfo}
              >
                <Text
                  style={[
                    styles.username,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {userData?.username || "Utilisateur"}
                </Text>
                <Text
                  style={[
                    styles.bio,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {userData?.bio || t("addBioHere")}
                </Text>
              </Animated.View>
              <Animated.View
                entering={FadeInUp.delay(400)}
                style={styles.detailsContainer}
              >
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={normalizeSize(16)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.location,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {userData?.location || t("unknownLocation")}
                  </Text>
                </View>
                {interests.length > 0 && (
                  <View
                    style={[
                      styles.interestsContainer,
                      { backgroundColor: currentTheme.colors.overlay },
                    ]}
                  >
                    {interests.slice(0, 3).map((interest, index) => (
                      <Text
                        key={index}
                        style={[
                          styles.interestText,
                          {
                            color: currentTheme.colors.secondary,
                            backgroundColor: currentTheme.colors.cardBackground,
                          },
                        ]}
                      >
                        {interest}
                      </Text>
                    ))}
                    {interests.length > 3 && (
                      <Text
                        style={[
                          styles.moreInterests,
                          {
                            color: currentTheme.colors.textPrimary,
                            backgroundColor: currentTheme.colors.secondary,
                          },
                        ]}
                      >
                        +{interests.length - 3}
                      </Text>
                    )}
                  </View>
                )}
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          {/* Grille des sections */}
          <View style={styles.sectionsContainer}>
            {rows.map((row, rowIndex) => (
              <Animated.View
                key={rowIndex}
                entering={FadeInUp.delay(500 + rowIndex * 100)}
                style={[
                  styles.rowContainer,
                  {
                    justifyContent:
                      row.length === 1 ? "center" : "space-between",
                  },
                ]}
              >
                {row.map((section, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.sectionButton}
                    onPress={() => router.push(section.navigateTo)}
                    accessibilityLabel={section.accessibilityLabel}
                    testID={section.testID}
                  >
                    <LinearGradient
                      colors={[
                        currentTheme.colors.cardBackground,
                        currentTheme.colors.border,
                      ]}
                      style={styles.sectionGradient}
                    >
                      <Ionicons
                        name={section.icon as keyof typeof Ionicons.glyphMap}
                        size={normalizeSize(32)}
                        color={currentTheme.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.sectionText,
                          { color: currentTheme.colors.secondary },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {section.name}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            ))}
          </View>
        </ScrollView>
        {/* Bannière fixée en bas */}
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => console.log("Bannière chargée")}
            onAdFailedToLoad={(err) =>
              console.error("Échec chargement bannière", err)
            }
          />
        </View>
      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  headerWrapper: {
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(10),
    elevation: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(25),
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
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
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bio: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(8),
    paddingHorizontal: normalizeSize(20),
    opacity: 0.9,
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
  },
  moreInterests: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    paddingVertical: normalizeSize(4),
    paddingHorizontal: normalizeSize(10),
    borderRadius: normalizeSize(12),
    margin: normalizeSize(4),
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(6),
    elevation: 5,
    minHeight: normalizeSize(100),
    justifyContent: "center",
  },
  sectionGradient: {
    flex: 1, // << à ajouter
    width: "100%", // << à ajouter aussi
    paddingVertical: normalizeSize(20),
    alignItems: "center",
    justifyContent: "center", // << à ajouter
    borderRadius: normalizeSize(15),
    borderWidth: 1,
    borderColor: "rgba(255, 98, 0, 0.2)",
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
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
  },
});
