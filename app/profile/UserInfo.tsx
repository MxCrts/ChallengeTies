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
  Alert,
  Dimensions,
  Text,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import * as ImagePicker from "expo-image-picker";
import { TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface User {
  uid: string;
  displayName?: string;
  bio?: string;
  profileImage?: string | null;
  location?: string;
  interests?: string;
}

export default function UserInfo() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("User is not authenticated.");

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
          setInterests(userData.interests || "");
        }
      } catch (error) {
        Alert.alert("Erreur", "Impossible de charger les informations.");
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
        Alert.alert("Permission refusée", "Autorisation requise.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sélectionner l’image.");
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
        interests,
      });

      Alert.alert("Succès", "Profil mis à jour !");
      router.push("/(tabs)/profile");
    } catch (error) {
      Alert.alert("Erreur", "Échec de la mise à jour du profil.");
    } finally {
      setIsLoading(false);
    }
  }, [user, displayName, bio, profileImage, location, interests]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
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
        <Text style={styles.title}>Modifier votre profil</Text>

        {/* Image de profil */}
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <Text style={styles.addImageText}>Ajouter une photo</Text>
          )}
        </TouchableOpacity>

        {/* Champs de saisie */}
        <TextInput
          label="Nom"
          mode="outlined"
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          textColor="#FFF"
          theme={{
            colors: {
              primary: "#FACC15",
              text: "#FFF",
              placeholder: "#FACC15",
              background: "transparent",
            },
          }}
        />
        <TextInput
          label="Bio"
          mode="outlined"
          style={styles.input}
          value={bio}
          onChangeText={setBio}
          multiline
          textColor="#FFF"
          theme={{
            colors: {
              primary: "#FACC15",
              text: "#FFF",
              placeholder: "#FACC15",
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
          textColor="#FFF"
          theme={{
            colors: {
              primary: "#FACC15",
              text: "#FFF",
              placeholder: "#FACC15",
              background: "transparent",
            },
          }}
        />
        <TextInput
          label="Intérêts"
          mode="outlined"
          style={styles.input}
          value={interests}
          onChangeText={setInterests}
          textColor="#FFF"
          theme={{
            colors: {
              primary: "#FACC15",
              text: "#FFF",
              placeholder: "#FACC15",
              background: "transparent",
            },
          }}
        />

        {/* Bouton Sauvegarde Feu & Glace */}
        <LinearGradient
          colors={["#FACC15", "#3B82F6"]}
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
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 60,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#FACC15",
  },
  addImageText: {
    marginTop: 8,
    color: "#FACC15",
    fontSize: 14,
    textAlign: "center",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#1F2D3D",
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A", // ✅ Fond propre pendant le chargement
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FACC15",
    marginBottom: 20,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
