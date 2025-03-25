import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
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
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";

const { width } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { profileUpdated } = useProfileUpdate();

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
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: currentTheme.colors.background },
        ]}
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
      </SafeAreaView>
    );
  }

  // Définition des sections de navigation (pour la grille, inchangé)
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

  // Découpage en lignes de 2 boutons pour une grille responsive
  const rows = [];
  for (let i = 0; i < sections.length; i += 2) {
    rows.push(sections.slice(i, i + 2));
  }

  const interests: string[] = Array.isArray(userData?.interests)
    ? userData.interests
    : [];

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <BackButton color={currentTheme.colors.primary} />

        {/* Titre identique à UserStats */}
        <Text style={styles.header}>Votre Profil</Text>

        {/* Carte de profil */}
        <LinearGradient
          colors={[
            currentTheme.colors.primary,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.profileCard}
        >
          <Image
            source={
              userData?.profileImage
                ? { uri: userData.profileImage }
                : require("../../assets/images/default-profile.jpg")
            }
            style={styles.avatar}
          />
          <Text
            style={[
              styles.username,
              { color: currentTheme.typography.title.color },
            ]}
          >
            {userData?.username || "Utilisateur"}
          </Text>
          <Text
            style={[styles.bio, { color: currentTheme.colors.textSecondary }]}
          >
            {userData?.bio || "Ajoutez une bio ici"}
          </Text>
          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={currentTheme.colors.primary}
            />
            <Text
              style={[styles.location, { color: currentTheme.colors.primary }]}
            >
              {userData?.location || "Lieu inconnu"}
            </Text>
          </View>
          {interests.length > 0 && (
            <View style={styles.interestsContainer}>
              {interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text
                    style={[
                      styles.interestText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {interest}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.trophiesContainer}>
            <Ionicons
              name="trophy"
              size={20}
              color={currentTheme.colors.trophy}
            />
            <Text
              style={[
                styles.trophiesText,
                { color: currentTheme.colors.trophy },
              ]}
            >
              {userData?.trophies || 0} Trophées
            </Text>
          </View>
        </LinearGradient>

        {/* Grille des sections */}
        <View style={styles.sectionsContainer}>
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.rowContainer,
                {
                  justifyContent: row.length === 1 ? "center" : "space-between",
                },
              ]}
            >
              {row.map((section, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.sectionButton,
                    currentTheme.components.challengeCard,
                  ]}
                  onPress={() => router.push(section.navigateTo)}
                >
                  <Ionicons
                    name={section.icon as keyof typeof Ionicons.glyphMap}
                    size={30}
                    color={currentTheme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.sectionText,
                      { color: currentTheme.colors.primary },
                    ]}
                  >
                    {section.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    backgroundColor: currentTheme.colors.background,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
  },
  username: {
    fontSize: 26,
    fontFamily: "Comfortaa_700Bold",
    marginTop: 12,
  },
  bio: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  location: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    marginLeft: 5,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    justifyContent: "center",
  },
  interestTag: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    margin: 4,
  },
  interestText: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
  },
  trophiesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  trophiesText: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    marginLeft: 6,
  },
  sectionsContainer: {
    marginTop: 10,
  },
  rowContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  sectionButton: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 15,
    width: "48%",
    paddingVertical: 20,
    alignItems: "center",
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  sectionText: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
    marginTop: 10,
    textAlign: "center",
  },
});
