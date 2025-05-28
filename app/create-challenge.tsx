import React, { useState, useCallback, useEffect } from "react";
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
import { useTranslation } from "react-i18next";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import BackButton from "../components/BackButton";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// ID interstitiel (remplace par le tien)
const adUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-4725616526467159/6097960289";

const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: false,
});

export default function CreateChallenge() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  // Gestion du cooldown
  const checkAdCooldown = async () => {
    const lastAdTime = await AsyncStorage.getItem("lastInterstitialTime");
    if (!lastAdTime) return true;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    return now - parseInt(lastAdTime) > cooldownMs;
  };

  const markAdShown = async () => {
    await AsyncStorage.setItem("lastInterstitialTime", Date.now().toString());
  };

  useEffect(() => {
    const unsubscribe = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setAdLoaded(true);
        console.log("Interstitiel chargé");
      }
    );
    interstitial.load();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // rien à faire ici, mais on dépend de i18n.language pour re-rendre
  }, [i18n.language]);

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
      Alert.alert(t("error"), t("imagePickFailed"));
    }
  }, [t]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim() || !category) {
      Alert.alert(
        t("error"),
        t("allFieldsRequired", {
          defaultValue:
            "Tous les champs sont requis (l'image est optionnelle).",
        })
      );
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert(
          t("error"),
          t("mustBeLoggedIn", {
            defaultValue: "Vous devez être connecté pour créer un défi.",
          })
        );
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
        usersTakingChallenge: [] as string[],
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

      // Afficher l'interstitiel si cooldown OK
      const canShowAd = await checkAdCooldown();
      if (canShowAd && adLoaded) {
        interstitial.show();
        await markAdShown();
        setAdLoaded(false);
        interstitial.load(); // Recharge pour la prochaine fois
      }

      Alert.alert(
        t("success"),
        t("challengeCreated", { defaultValue: "Votre défi a été créé !" })
      );
      router.push("/explore");
    } catch (error) {
      console.error("Erreur lors de la création du défi :", error);
      Alert.alert(
        t("error"),
        t("challengeCreateFailed", {
          defaultValue: "Impossible de créer le défi.",
        })
      );
    }
  }, [title, description, category, imageUri, adLoaded, router, t]);

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
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
          <BackButton color={currentTheme.colors.textPrimary} />
          <Ionicons
            name="create-outline"
            size={normalizeSize(64)}
            color={currentTheme.colors.secondary}
            style={styles.headerIcon}
          />
          <Text
            style={[
              styles.headerTitle,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("createYourChallenge", {
              defaultValue: "Create Your Challenge",
            })}
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("inspireOthers", {
              defaultValue: "Inspire others with a challenge that excites !",
            })}
          </Text>
        </View>

        <TextInput
          style={[
            styles.input,
            {
              borderColor: currentTheme.colors.border,
              backgroundColor: currentTheme.colors.overlay,
              color: currentTheme.colors.textPrimary,
            },
          ]}
          placeholder={t("challengeTitle", { defaultValue: "Challenge Title" })}
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t("challengeTitle")}
          testID="title-input"
        />

        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              borderColor: currentTheme.colors.border,
              backgroundColor: currentTheme.colors.overlay,
              color: currentTheme.colors.textPrimary,
            },
          ]}
          placeholder={t("challengeDescription", {
            defaultValue: "Description",
          })}
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          accessibilityLabel={t("challengeDescription")}
          testID="description-input"
        />

        <View style={styles.dropdownContainer}>
          <Text
            style={[
              styles.dropdownLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("category")}
          </Text>
          <View
            style={[
              styles.pickerWrapper,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: currentTheme.colors.overlay,
              },
            ]}
          >
            <Picker
              selectedValue={category}
              onValueChange={setCategory}
              style={[
                styles.picker,
                { color: currentTheme.colors.textPrimary },
              ]}
              itemStyle={{ color: currentTheme.colors.textPrimary }}
              accessibilityLabel={t("selectCategory")}
              testID="category-picker"
            >
              {categories.map((cat) => (
                <Picker.Item
                  label={t(`categories.${cat}`, { defaultValue: cat })}
                  value={cat}
                  key={cat}
                />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.imagePickerButton,
            {
              borderColor: currentTheme.colors.border,
              backgroundColor: currentTheme.colors.overlay,
            },
          ]}
          onPress={pickImage}
          accessibilityLabel={t("uploadImage", {
            defaultValue: "Upload Image (optional)",
          })}
          testID="image-picker-button"
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text
              style={[
                styles.imagePickerText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("uploadImageOptional", {
                defaultValue: "Upload Image (Optional)",
              })}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          accessibilityLabel={t("createChallengeButton", {
            defaultValue: "Create Challenge",
          })}
          testID="submit-button"
        >
          <LinearGradient
            colors={[
              currentTheme.colors.primary,
              currentTheme.colors.secondary,
            ]}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text
              style={[
                styles.submitText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("createChallengeButton", { defaultValue: "Create Challenge" })}
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
