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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileUpdate } from "../../context/ProfileUpdateContext";
import { useTheme } from "../../context/ThemeContext"; // Ajout de useTheme
import { Theme } from "../../theme/designSystem"; // Import de l'interface Theme
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp } from "react-native-reanimated";
import GlobalLayout from "../../components/GlobalLayout"; // Ajout de GlobalLayout
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { profileUpdated } = useProfileUpdate();
  const { theme } = useTheme(); // Ajout de useTheme
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme; // Typage avec Theme

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const userRef = doc(db, "users", userId);
    setIsLoading(true);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [profileUpdated]);

  if (isLoading) {
    return (
      <GlobalLayout>
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

  const sections = [
    {
      name: "Modifier le profil",
      icon: "person-circle-outline",
      navigateTo: "profile/UserInfo",
    },
    {
      name: "Statistiques",
      icon: "stats-chart-outline",
      navigateTo: "profile/UserStats",
    },
    {
      name: "Défis en cours",
      icon: "flag-outline",
      navigateTo: "profile/CurrentChallenges",
    },
    {
      name: "Favoris",
      icon: "bookmark-outline",
      navigateTo: "profile/SavedChallenges",
    },
    {
      name: "Défis complétés",
      icon: "checkmark-done-outline",
      navigateTo: "profile/CompletedChallenges",
    },
    {
      name: "Récompenses",
      icon: "medal-outline",
      navigateTo: "profile/Achievements",
    },
    {
      name: "Mes challenges",
      icon: "create-outline",
      navigateTo: "profile/MyChallenges",
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
            <CustomHeader title="Ton Profil" />
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
              ]} // Gradient dynamique
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
                  {userData?.bio || "Ajoute une bio stylée !"}
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
                    {userData?.location || "Lieu inconnu"}
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
                  >
                    <LinearGradient
                      colors={[
                        currentTheme.colors.cardBackground,
                        currentTheme.colors.border,
                      ]} // Gradient dynamique pour les boutons
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
      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: normalizeSize(15),
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  profileCardWrapper: {
    marginBottom: normalizeSize(20),
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
    fontFamily: "Comfortaa_700Bold", // Typographie dynamique possible si besoin
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
    marginTop: normalizeSize(10),
  },
  rowContainer: {
    flexDirection: "row",
    marginBottom: normalizeSize(15),
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
  },
  sectionGradient: {
    paddingVertical: normalizeSize(20),
    alignItems: "center",
    borderRadius: normalizeSize(15),
    borderWidth: 1,
    borderColor: "rgba(255, 98, 0, 0.2)", // Légère teinte dynamique possible
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
});
