import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";

// 🔥 Firebase
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "../constants/firebase-config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 20;
const BORDER_RADIUS = 16;

const defaultCategories = [
  "Santé",
  "Fitness",
  "Finance",
  "Mode de Vie",
  "Éducation",
  "Créativité",
  "Carrière",
  "Social",
  "Productivité",
  "Écologie",
  "Motivation",
  "Développement Personnel",
  "Discipline",
  "État d'esprit",
  "Autres",
];

// Cohérent avec Explore (fallback côté liste)
const DEFAULT_DAYS_OPTIONS = [3, 7, 14, 21, 30, 60, 90, 180, 365];

export default function CreateChallenge() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const router = useRouter();


  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategories[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ====== Interstitiel (non premium) ======
  const { showInterstitials } = useAdsVisibility();
  const interstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({
      ios: "ca-app-pub-4725616526467159/4942270608",     // Interstit-Create-iOS
      android: "ca-app-pub-4725616526467159/6097960289", // Interstit-Create (Android)
    })!;
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
  if (!showInterstitials) {
    interstitialRef.current = null;
    setAdLoaded(false);
    return;
  }

  const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });
  interstitialRef.current = ad;

  const onLoaded = ad.addAdEventListener(AdEventType.LOADED, () => setAdLoaded(true));
  const onError  = ad.addAdEventListener(AdEventType.ERROR,  () => setAdLoaded(false));

  ad.load();

  return () => {
    onLoaded();
    onError();
    interstitialRef.current = null;
    setAdLoaded(false);
  };
}, [showInterstitials, interstitialAdUnitId]);


  const checkAdCooldownCreate = useCallback(async () => {
    const last = await AsyncStorage.getItem("lastInterstitialTime_create");
    if (!last) return true;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 min
    return now - parseInt(last, 10) > cooldownMs;
  }, []);

  const markAdShownCreate = useCallback(async () => {
    await AsyncStorage.setItem(
      "lastInterstitialTime_create",
      Date.now().toString()
    );
  }, []);

  const tryShowCreateInterstitial = useCallback(async () => {
    if (!showInterstitials) return;
    const okCooldown = await checkAdCooldownCreate();
    if (!okCooldown) return;
    if (adLoaded && interstitialRef.current) {
      try {
        await interstitialRef.current.show();
        await markAdShownCreate();
        setAdLoaded(false);
        interstitialRef.current.load();
      } catch {
        // no-op
      }
    }
  }, [showInterstitials, adLoaded, checkAdCooldownCreate, markAdShownCreate]);

  // ====== Image picker ======
  const pickImage = useCallback(async () => {
    try {
      const { canceled, assets } = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!canceled && assets?.[0]?.uri) setImageUri(assets[0].uri);
    } catch {
      Alert.alert(t("error"), t("imagePickFailed"));
    }
  }, [t]);

  // ====== Upload image vers Storage (si fournie) ======
  const uploadImageIfNeeded = useCallback(async (localUri: string | null, nameHint: string) => {
    if (!localUri) return null;
    try {
      const resp = await fetch(localUri);
      const blob = await resp.blob();

      const storage = getStorage();
      const safeName =
        nameHint.trim().toLowerCase().replace(/[^\w]+/g, "_").slice(0, 40) ||
        "challenge";
      const fileName = `${safeName}_${Date.now()}.jpg`;
      const ref = storageRef(storage, `Challenges-Image/${fileName}`);

      await uploadBytes(ref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref);
      return url;
    } catch (e) {
      return null; // on ne bloque pas la création si l’upload échoue
    }
  }, []);

  // ====== Validation & Création ======
  const isValid = !!title.trim() && !!description.trim();

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert(t("error"), t("allFieldsRequired"));
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert(t("error"), t("loginRequired"));
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      // 1) Upload image si fournie
      const uploadedUrl = await uploadImageIfNeeded(imageUri, title);

      // 2) Créer le document challenge (approved:false)
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category || "Autres",
        imageUrl: uploadedUrl || null,
        participantsCount: 0,
        usersTakingChallenge: [] as string[],
        creatorId: user.uid,
        createdAt: serverTimestamp(),
        approved: false,
        // Compat avec Explore : si non fourni, Explore fallback déjà géré
        daysOptions: DEFAULT_DAYS_OPTIONS,
        // Pas de chatId pour les créations user (Explore gère fallback)
      };

      const ref = await addDoc(collection(db, "challenges"), payload);

      // 3) Ajouter l’entrée dans users/{uid}.createdChallenges
      await updateDoc(doc(db, "users", user.uid), {
        createdChallenges: arrayUnion({ id: ref.id, approved: false }),
      });

      // 4) Interstitiel (non-premium)
      await tryShowCreateInterstitial();

      // 5) Confirmation + navigation
      Alert.alert(
        t("success", { defaultValue: "Succès" }),
        t("challengeSubmittedForReview", {
          defaultValue:
            "Ton défi a été soumis et sera visible dès qu’un admin l’aura approuvé.",
        }),
        [
          {
            text: t("ok", { defaultValue: "OK" }),
            onPress: () => router.push("/explore"),
          },
        ]
      );
    } catch (e: any) {
      console.error("Create challenge error:", e?.message ?? e);
      Alert.alert(
        t("error"),
        t("createChallengeFailed", {
          defaultValue:
            "Impossible de créer le défi pour le moment. Réessaie plus tard.",
        })
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    description,
    category,
    imageUri,
    t,
    router,
    uploadImageIfNeeded,
    tryShowCreateInterstitial,
    submitting,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[current.colors.background, current.colors.cardBackground]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <CustomHeader title={t("createYourChallenge")} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: SPACING * 4 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ionicons
              name="create-outline"
              size={48}
              color={current.colors.secondary}
              style={{ marginBottom: 8 }}
            />
            <Text
              style={[styles.subtitle, { color: current.colors.textSecondary }]}
            >
              {t("inspireOthers")}
            </Text>
          </View>

          <View
            style={[styles.form, { backgroundColor: current.colors.cardBackground }]}
          >
            <Input
              label={t("challengeTitle")}
              value={title}
              onChange={setTitle}
              theme={current}
            />
            <Input
              label={t("challengeDescription")}
              value={description}
              onChange={setDescription}
              multiline
              numberOfLines={4}
              theme={current}
            />

            <Dropdown
              label={t("category")}
              options={defaultCategories}
              selected={category}
              onSelect={setCategory}
              theme={current}
            />

            <ImageUpload uri={imageUri} onPick={pickImage} theme={current} />

            <Button
              label={
                submitting
                  ? t("pleaseWait", { defaultValue: "Patiente..." })
                  : t("createChallengeButton")
              }
              onPress={handleSubmit}
              disabled={!isValid || submitting}
              theme={current}
            />
            {submitting && (
              <View style={{ marginTop: 12, alignItems: "center" }}>
                <ActivityIndicator color={current.colors.secondary} />
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ======================
// Reusable Components
// ======================

const Input = ({
  label,
  value,
  onChange,
  multiline = false,
  numberOfLines = 1,
  theme,
}: any) => (
  <View style={{ marginBottom: SPACING }}>
    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
      {label}
    </Text>
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.background,
          color: theme.colors.textPrimary,
          height: multiline ? 100 : 48,
        },
      ]}
      placeholder={label}
      placeholderTextColor={theme.colors.textSecondary}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={numberOfLines}
    />
  </View>
);

const Dropdown = ({ label, options, selected, onSelect, theme }: any) => (
  <View style={{ marginBottom: SPACING }}>
    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
      {label}
    </Text>
    <View style={[styles.dropdown, { backgroundColor: theme.colors.background }]}>
      <Picker
        selectedValue={selected}
        onValueChange={onSelect}
        style={{ color: theme.colors.textPrimary }}
      >
        {options.map((opt: string) => (
          <Picker.Item key={opt} label={opt} value={opt} />
        ))}
      </Picker>
    </View>
  </View>
);

const ImageUpload = ({ uri, onPick, theme }: any) => (
  <TouchableOpacity
    style={[styles.imageBox, { backgroundColor: theme.colors.background }]}
    onPress={onPick}
  >
    {uri ? (
      <Image source={{ uri }} style={styles.imagePreview} />
    ) : (
      <Ionicons
        name="cloud-upload-outline"
        size={32}
        color={theme.colors.textSecondary}
      />
    )}
  </TouchableOpacity>
);

const Button = ({ label, onPress, disabled, theme }: any) => (
  <TouchableOpacity
    disabled={disabled}
    onPress={onPress}
    style={{ opacity: disabled ? 0.5 : 1 }}
  >
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.button}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={[styles.buttonText, { color: theme.colors.textPrimary }]}>
        {label}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
);

// ======================
// Styles
// ======================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },
  gradient: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 4,
    alignItems: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: SPACING,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  form: {
    width: "100%",
    borderRadius: BORDER_RADIUS,
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: { marginBottom: 6, fontSize: 14, fontFamily: "Comfortaa_500Medium" },
  input: {
    width: "100%",
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: SPACING,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
  },
  dropdown: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  imageBox: {
    width: "100%",
    height: 150,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: "#DDD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: "100%" },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
  },
  buttonText: { fontSize: 18, fontFamily: "Comfortaa_700Bold" },
});
