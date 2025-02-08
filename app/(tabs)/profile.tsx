import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNewAchievements, setHasNewAchievements] = useState(false); // ✅ Correction badge succès

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
        const data = snapshot.data();
        setUserData(data);

        // ✅ Vérifier s'il y a des succès non réclamés dans `newAchievements`
        const hasPendingAchievements = (data.newAchievements || []).length > 0;
        setHasNewAchievements(hasPendingAchievements);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FACC15" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  const sections = [
    {
      name: "Modifier Profil",
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
      name: "Défis sauvegardés",
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
      hasBadge: hasNewAchievements, // ✅ Ajout du badge dynamique
    },
    {
      name: "Mes Challenges",
      icon: "create-outline",
      navigateTo: "profile/MyChallenges",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ✅ HEADER */}
      <LinearGradient colors={["#2563EB", "#9333EA"]} style={styles.header}>
        <View style={styles.headerContent}>
          {/* ✅ AVATAR */}
          <Image
            source={
              userData?.profileImage
                ? { uri: userData.profileImage }
                : require("../../assets/images/default-profile.jpg")
            }
            style={styles.avatar}
          />

          {/* ✅ INFOS UTILISATEUR */}
          <View style={styles.userInfo}>
            <Text style={styles.username}>
              {userData?.displayName || "Utilisateur"}
            </Text>
            <Text style={styles.bio}>
              {userData?.bio || "Ajoutez une bio ici"}
            </Text>

            {/* ✅ TROPHÉES */}
            <View style={styles.trophiesContainer}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.trophiesText}>
                {userData?.trophies || 0} Trophées
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ✅ SECTIONS */}
      <FlatList
        data={sections}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(item.navigateTo)}
            style={styles.sectionBubble}
          >
            <View>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={35}
                color="#FACC15"
              />
              {item.hasBadge && ( // ✅ Afficher le badge si succès non réclamés
                <View style={styles.badge} />
              )}
            </View>

            <Text style={styles.sectionText}>{item.name}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.navigateTo}
        numColumns={2}
        columnWrapperStyle={styles.sectionRow}
        contentContainerStyle={styles.sectionsContainer}
      />
    </SafeAreaView>
  );
}

// 🎨 STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  header: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#FACC15",
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  username: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
  },
  bio: {
    fontSize: 14,
    color: "#D1D5DB",
    marginVertical: 5,
  },
  trophiesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  trophiesText: {
    fontSize: 14,
    color: "#FFD700",
    fontWeight: "bold",
    marginLeft: 5,
  },
  sectionsContainer: {
    paddingHorizontal: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  sectionBubble: {
    flex: 1,
    alignItems: "center",
    margin: 10,
    backgroundColor: "#1E293B",
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 4,
  },
  sectionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FACC15",
    textAlign: "center",
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FACC15",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF0000",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
