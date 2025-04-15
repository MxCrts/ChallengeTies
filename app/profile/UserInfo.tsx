import React, { useState, useEffect, useCallback } from "react";
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
  Alert,
  Dimensions,
  Text,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "../../constants/firebase-config";
import * as ImagePicker from "expo-image-picker";
import { TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import BackButton from "../../components/BackButton";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp } from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface User {
  uid: string;
  displayName?: string;
  bio?: string;
  profileImage?: string | null;
  location?: string;
  interet?: string;
}

export default function UserInfo() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [interet, setInteret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Utilisateur non authentifié.");
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
          setInteret(userData.interet || "");
        }
      } catch (error) {
        Alert.alert("Erreur", "Impossible de charger vos informations.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Vous devez autoriser l'accès aux photos."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled && result.assets && result.assets[0].uri) {
        const uri = result.assets[0].uri;
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert("Erreur", "Utilisateur non authentifié.");
          return;
        }
        const filename = `profileImages/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        const response = await fetch(uri);
        const blob = await response.blob();
        const uploadTask = uploadBytesResumable(storageRef, blob, {
          contentType: "image/jpeg",
        });
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Progression de l'upload: ${progress.toFixed(2)}%`);
          },
          (error) => {
            console.error("Erreur lors de l'upload:", error);
            Alert.alert(
              "Erreur d'upload",
              `Le téléversement a échoué. Détails: ${error.message}`
            );
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setProfileImage(downloadURL);
              Alert.alert("Succès", "Image de profil mise à jour !");
            } catch (urlError: any) {
              console.error(
                "Erreur lors de la récupération de l'URL:",
                urlError
              );
              Alert.alert(
                "Erreur",
                `Impossible de récupérer l'URL de l'image. Détails: ${urlError.message}`
              );
            }
          }
        );
      } else {
        Alert.alert("Annulé", "Aucune image sélectionnée.");
      }
    } catch (error: any) {
      console.error("Erreur lors de la sélection de l'image:", error);
      Alert.alert(
        "Erreur",
        `Impossible de téléverser l’image. Détails: ${error.message}`
      );
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Erreur", "Utilisateur introuvable.");
      return;
    }
    setIsLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
        profileImage,
        location,
        interet,
      });
      await checkForAchievements(user.uid);
      Alert.alert("Succès", "Votre profil a été mis à jour !");
      router.push("/(tabs)/profile");
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      Alert.alert("Erreur", "Échec de la mise à jour du profil.");
    } finally {
      setIsLoading(false);
    }
  }, [user, displayName, bio, profileImage, location, interet, router]);

  // Fonction pour obtenir le style dynamique de fieldGradient
  const getFieldGradientStyle = () => ({
    ...styles.fieldGradient,
    borderColor: isDarkMode ? "#FFDD9533" : "#e3701e33",
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
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
          >
            Chargement en cours...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerWrapper}>
              <CustomHeader title="Modifie Ton Profil" />
            </View>

            {/* Image de profil */}
            <Animated.View
              entering={FadeInUp.delay(100)}
              style={styles.imageContainer}
            >
              <TouchableOpacity onPress={pickImage}>
                <LinearGradient
                  colors={[
                    currentTheme.colors.secondary,
                    currentTheme.colors.primary,
                  ]}
                  style={styles.imageGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View
                    style={[
                      styles.imageOverlay,
                      { backgroundColor: `${currentTheme.colors.overlay}80` },
                    ]}
                  >
                    {profileImage ? (
                      <Image
                        source={{ uri: profileImage }}
                        style={styles.profileImage}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.addImageText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        Ajouter une photo
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Champs de saisie stylés */}
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={styles.inputWrapper}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  `${currentTheme.colors.cardBackground}F0`,
                ]}
                style={getFieldGradientStyle()} // Style dynamique
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <TextInput
                  label="Nom"
                  mode="outlined"
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  textColor={currentTheme.colors.textPrimary}
                  activeOutlineColor={currentTheme.colors.secondary}
                  outlineColor={currentTheme.colors.border}
                  theme={{
                    colors: {
                      primary: currentTheme.colors.secondary,
                      text: currentTheme.colors.textPrimary,
                      placeholder: currentTheme.colors.textSecondary,
                      background: "transparent",
                    },
                  }}
                />
              </LinearGradient>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(300)}
              style={styles.inputWrapper}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  `${currentTheme.colors.cardBackground}F0`,
                ]}
                style={getFieldGradientStyle()} // Style dynamique
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <TextInput
                  label="Bio"
                  mode="outlined"
                  style={[styles.input, styles.multilineInput]}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  textColor={currentTheme.colors.textPrimary}
                  activeOutlineColor={currentTheme.colors.secondary}
                  outlineColor={currentTheme.colors.border}
                  theme={{
                    colors: {
                      primary: currentTheme.colors.secondary,
                      text: currentTheme.colors.textPrimary,
                      placeholder: currentTheme.colors.textSecondary,
                      background: "transparent",
                    },
                  }}
                />
              </LinearGradient>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(400)}
              style={styles.inputWrapper}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  `${currentTheme.colors.cardBackground}F0`,
                ]}
                style={getFieldGradientStyle()} // Style dynamique
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <TextInput
                  label="Localisation"
                  mode="outlined"
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  textColor={currentTheme.colors.textPrimary}
                  activeOutlineColor={currentTheme.colors.secondary}
                  outlineColor={currentTheme.colors.border}
                  theme={{
                    colors: {
                      primary: currentTheme.colors.secondary,
                      text: currentTheme.colors.textPrimary,
                      placeholder: currentTheme.colors.textSecondary,
                      background: "transparent",
                    },
                  }}
                />
              </LinearGradient>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(500)}
              style={styles.inputWrapper}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  `${currentTheme.colors.cardBackground}F0`,
                ]}
                style={getFieldGradientStyle()} // Style dynamique
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <TextInput
                  label="Intérêts"
                  mode="outlined"
                  style={styles.input}
                  value={interet}
                  onChangeText={setInteret}
                  textColor={currentTheme.colors.textPrimary}
                  activeOutlineColor={currentTheme.colors.secondary}
                  outlineColor={currentTheme.colors.border}
                  theme={{
                    colors: {
                      primary: currentTheme.colors.secondary,
                      text: currentTheme.colors.textPrimary,
                      placeholder: currentTheme.colors.textSecondary,
                      background: "transparent",
                    },
                  }}
                />
              </LinearGradient>
            </Animated.View>

            {/* Bouton Sauvegarder */}
            <Animated.View
              entering={FadeInUp.delay(600)}
              style={styles.saveButtonWrapper}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.secondary,
                  currentTheme.colors.primary,
                ]}
                style={styles.saveButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <TouchableOpacity onPress={handleSave}>
                  <Text
                    style={[
                      styles.saveButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    Sauvegarder
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradientContainer: { flex: 1 },
  container: { flex: 1 },
  contentContainer: {
    padding: normalizeSize(20),
    alignItems: "center",
    paddingBottom: SCREEN_HEIGHT * 0.15,
  },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    width: "100%",
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
  imageContainer: {
    marginBottom: normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  imageGradient: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: SCREEN_WIDTH * 0.2,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  imageOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: SCREEN_WIDTH * 0.38,
    height: SCREEN_WIDTH * 0.38,
    borderRadius: SCREEN_WIDTH * 0.19,
  },
  addImageText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  fieldGradient: {
    borderRadius: normalizeSize(15),
    padding: normalizeSize(5),
    borderWidth: 1,
  },
  input: {
    width: "100%",
    backgroundColor: "transparent",
    fontFamily: "Comfortaa_400Regular",
    borderRadius: normalizeSize(10),
  },
  multilineInput: {
    minHeight: normalizeSize(100),
  },
  saveButtonWrapper: {
    width: "100%",
    marginTop: normalizeSize(20),
  },
  saveButton: {
    paddingVertical: normalizeSize(15),
    paddingHorizontal: normalizeSize(30),
    borderRadius: normalizeSize(25),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  saveButtonText: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
