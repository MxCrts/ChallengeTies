import React, { useState, useCallback } from "react";
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
  StatusBar,
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
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import BackButton from "../components/BackButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Health");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = useCallback(async () => {
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
  }, []);

  const handleSubmit = useCallback(async () => {
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

      const chatId = title.trim().toLowerCase().replace(/\s+/g, "_");

      const challengeData = {
        title: title.trim(),
        description: description.trim(),
        category,
        daysOptions: defaultDaysOptions,
        imageUrl: imageUri || "https://via.placeholder.com/150",
        participantsCount: 0,
        createdAt: new Date(),
        creatorId: currentUser.uid,
        chatId,
        usersTakingChallenge: [],
      };

      const challengeRef = await addDoc(
        collection(db, "challenges"),
        challengeData
      );
      const challengeId = challengeRef.id;

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        createdChallenges: arrayUnion({ id: challengeId, ...challengeData }),
      });

      await checkForAchievements(currentUser.uid);

      Alert.alert("Succès", "Votre défi a été créé !");
      router.push("/explore");
    } catch (error) {
      console.error("Erreur lors de la création du défi :", error);
      Alert.alert("Erreur", "Impossible de créer le défi.");
    }
  }, [title, description, category, imageUri, router]);

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <BackButton
            color={currentTheme.colors.textPrimary}
          />
          <Ionicons
            name="create-outline"
            size={normalizeSize(64)}
            color={currentTheme.colors.secondary}
            style={styles.headerIcon}
          />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.textPrimary }]}>
            Create Your Challenge
          </Text>
          <Text style={[styles.headerSubtitle, { color: currentTheme.colors.textSecondary }]}>
            Inspire others with a challenge that excites!
          </Text>
        </View>

        <TextInput
          style={[styles.input, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.overlay, color: currentTheme.colors.textPrimary }]}
          placeholder="Challenge Title"
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          accessibilityLabel="Titre du défi"
          accessibilityHint="Entrez le titre de votre défi"
          testID="title-input"
        />

        <TextInput
          style={[styles.input, styles.textArea, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.overlay, color: currentTheme.colors.textPrimary }]}
          placeholder="Description"
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          accessibilityLabel="Description du défi"
          accessibilityHint="Entrez la description de votre défi"
          testID="description-input"
        />

        <View style={styles.dropdownContainer}>
          <Text style={[styles.dropdownLabel, { color: currentTheme.colors.textSecondary }]}>
            Category
          </Text>
          <View style={[styles.pickerWrapper, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.overlay }]}>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={[styles.picker, { color: currentTheme.colors.textPrimary }]}
              itemStyle={{
                fontFamily: "Comfortaa_400Regular",
                color: currentTheme.colors.textPrimary,
              }}
              accessibilityLabel="Sélectionner une catégorie"
              testID="category-picker"
            >
              {categories.map((cat) => (
                <Picker.Item label={cat} value={cat} key={cat} />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.imagePickerButton, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.overlay }]}
          onPress={pickImage}
          accessibilityLabel="Télécharger une image"
          accessibilityHint="Sélectionnez une image pour le défi (optionnel)"
          testID="image-picker-button"
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text style={[styles.imagePickerText, { color: currentTheme.colors.textSecondary }]}>
              Upload Image (Optional)
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          accessibilityLabel="Créer le défi"
          testID="submit-button"
        >
          <LinearGradient
            colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={[styles.submitText, { color: currentTheme.colors.textPrimary }]}>
              Create Challenge
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    padding: SPACING,
    alignItems: "center",
    paddingBottom: SPACING * 2,
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING,
    width: "100%",
  },
  headerIcon: {
    marginBottom: SPACING,
    marginTop: SPACING,
  },
  headerTitle: {
    fontSize: normalizeSize(26),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: normalizeSize(16),
    textAlign: "center",
    marginBottom: SPACING,
    lineHeight: normalizeSize(22),
    fontFamily: "Comfortaa_400Regular",
  },
  input: {
    width: "100%",
    borderRadius: normalizeSize(12),
    padding: SPACING,
    marginBottom: SPACING,
    fontSize: normalizeSize(16),
    borderWidth: 1,
    fontFamily: "Comfortaa_400Regular",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  textArea: {
    height: normalizeSize(100),
    textAlignVertical: "top",
  },
  dropdownContainer: {
    width: "100%",
    marginBottom: SPACING,
  },
  dropdownLabel: {
    marginBottom: SPACING / 2,
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  pickerWrapper: {
    borderRadius: normalizeSize(12),
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  picker: {
    width: "100%",
  },
  imagePickerButton: {
    padding: SPACING,
    borderRadius: normalizeSize(12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    borderWidth: 1,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  imagePickerText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  imagePreview: {
    width: "100%",
    height: normalizeSize(150),
    borderRadius: normalizeSize(12),
  },
  submitButton: {
    width: "100%",
    borderRadius: normalizeSize(12),
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  submitGradient: {
    padding: SPACING,
    borderRadius: normalizeSize(12),
    alignItems: "center",
  },
  submitText: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
  },
});