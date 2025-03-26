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
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;
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

  const currentTheme = designSystem.lightTheme;

  // Chargement des données utilisateur
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

  // Sélection et téléversement de l'image de profil
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

  // Sauvegarde du profil
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <BackButton color={currentTheme.colors.primary} />
        <Text style={styles.headerTitle}>Modifier votre profil</Text>
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
          <LinearGradient
            colors={[
              currentTheme.colors.primary,
              currentTheme.colors.cardBackground,
            ]}
            style={styles.imageGradient}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <Text style={styles.addImageText}>Ajouter une photo</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TextInput
          label="Nom"
          mode="outlined"
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          textColor={"#000000"}
          activeOutlineColor={currentTheme.colors.primary}
          outlineColor={currentTheme.colors.primary}
          theme={{
            colors: {
              primary: currentTheme.colors.primary,
              text: "#000000",
              placeholder: currentTheme.colors.primary,
              background: "transparent",
            },
          }}
        />
        <TextInput
          label="Bio"
          mode="outlined"
          style={[styles.input, styles.multilineInput]}
          value={bio}
          onChangeText={setBio}
          multiline
          textColor={"#000000"}
          activeOutlineColor={currentTheme.colors.primary}
          outlineColor={currentTheme.colors.primary}
          theme={{
            colors: {
              primary: currentTheme.colors.primary,
              text: "#000000",
              placeholder: currentTheme.colors.primary,
              background: "transparent",
            },
          }}
        />
        <TextInput
          label="Localisation"
          mode="outlined"
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          textColor={"#000000"}
          activeOutlineColor={currentTheme.colors.primary}
          outlineColor={currentTheme.colors.primary}
          theme={{
            colors: {
              primary: currentTheme.colors.primary,
              text: "#000000",
              placeholder: currentTheme.colors.primary,
              background: "transparent",
            },
          }}
        />
        <TextInput
          label="Intérêts"
          mode="outlined"
          style={styles.input}
          value={interet}
          onChangeText={setLocation}
          textColor={"#000000"}
          activeOutlineColor={currentTheme.colors.primary}
          outlineColor={currentTheme.colors.primary}
          theme={{
            colors: {
              primary: currentTheme.colors.primary,
              text: "#000000",
              placeholder: currentTheme.colors.primary,
              background: "transparent",
            },
          }}
        />

        <LinearGradient
          colors={[
            currentTheme.colors.primary,
            currentTheme.colors.cardBackground,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.saveButton}
        >
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveButtonText}>Sauvegarder</Text>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: currentTheme.colors.background },
  contentContainer: { padding: 20, alignItems: "center", paddingBottom: 60 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  headerTitle: {
    fontSize: 25,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  imageContainer: { marginBottom: 20 },
  imageGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  addImageText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  multilineInput: { minHeight: 80 },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
});
