import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  collection,
  addDoc,
  updateDoc,
  arrayUnion,
  doc,
} from "firebase/firestore";
import { auth, db } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { checkForAchievements } from "../helpers/trophiesHelpers";

const { width } = Dimensions.get("window");

const defaultDaysOptions = [7, 15, 21, 30, 60, 90, 180, 365];

const categories = [
  "Health",
  "Fitness",
  "Finance",
  "Productivity",
  "Creativity",
  "Education",
  "Career",
  "Lifestyle",
  "Social",
  "Miscellaneous",
];

export default function CreateChallenge() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Health");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const router = useRouter();

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets[0].uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Erreur lors de la sélection d'image:", error);
      Alert.alert("Erreur", "Impossible de sélectionner l'image.");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category) {
      Alert.alert(
        "Erreur",
        "Tous les champs sont requis (l'image est optionnelle)."
      );
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Erreur", "Vous devez être connecté pour créer un défi.");
        return;
      }

      // Générer un chatId simple basé sur le titre
      const chatId = title.trim().toLowerCase().replace(/\s+/g, "_");

      const challengeData = {
        title: title.trim(),
        description: description.trim(),
        category,
        daysOptions: defaultDaysOptions,
        // Note : Le créateur ne choisit pas la durée ici.
        imageUrl: imageUri || "https://via.placeholder.com/150",
        participantsCount: 0,
        createdAt: new Date(),
        creatorId: currentUser.uid,
        chatId,
        usersTakingChallenge: [],
      };

      // 1️⃣ Ajouter le défi dans la collection "challenges"
      const challengeRef = await addDoc(
        collection(db, "challenges"),
        challengeData
      );
      const challengeId = challengeRef.id;

      // 2️⃣ Ajouter ce défi dans "createdChallenges" du document utilisateur
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        createdChallenges: arrayUnion({ id: challengeId, ...challengeData }),
      });

      // Lancer la vérification des succès (challengeCreated)
      await checkForAchievements(currentUser.uid);

      Alert.alert("Succès", "Votre défi a été créé !");
      router.push("/explore");
    } catch (error) {
      console.error("Erreur lors de la création du défi :", error);
      Alert.alert("Erreur", "Impossible de créer le défi.");
    }
  };

  return (
    <LinearGradient colors={["#1F1C2C", "#928DAB"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Ionicons
            name="create-outline"
            size={64}
            color="#fff"
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>Create Your Challenge</Text>
          <Text style={styles.headerSubtitle}>
            Inspire others with a challenge that excites!
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Challenge Title"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          placeholderTextColor="#aaa"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>Category</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={styles.picker}
            >
              {categories.map((cat) => (
                <Picker.Item label={cat} value={cat} key={cat} />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text style={styles.imagePickerText}>Upload Image (Optional)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <LinearGradient
            colors={["#FF512F", "#DD2476"]}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>Create Challenge</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerIcon: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  dropdownContainer: {
    width: "100%",
    marginBottom: 15,
  },
  dropdownLabel: {
    color: "#ccc",
    marginBottom: 5,
    fontSize: 14,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  picker: {
    width: "100%",
  },
  imagePickerButton: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    width: "100%",
  },
  imagePickerText: {
    color: "#777",
    fontSize: 16,
  },
  imagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 12,
  },
  submitButton: {
    width: "100%",
    borderRadius: 12,
    marginTop: 10,
  },
  submitGradient: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
