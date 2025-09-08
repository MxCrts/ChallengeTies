import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import { BlurView } from "expo-blur";
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
// en haut du fichier, avec les imports
import type { TFunction } from "i18next";


/* -------- Firebase (inchangé) -------- */
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

/* -------- Constantes UI -------- */
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 20;
const RADIUS = 18;
const FIELD_HEIGHT = 52;

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
] as const;
type CategoryLabel = typeof defaultCategories[number];

// Cohérent avec Explore (fallback côté liste)
const DEFAULT_DAYS_OPTIONS = [3, 7, 14, 21, 30, 60, 90, 180, 365];

/* -------- Limites de saisie (UX) -------- */
const TITLE_MAX = 60;
const DESC_MAX = 240;

/* =========================================
   CreateChallenge (logique conservée)
========================================= */
export default function CreateChallenge() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const router = useRouter();
const npa = (globalThis as any).__NPA__ === true;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<CategoryLabel>(defaultCategories[0]);


  /* ====== Interstitiel (non premium) — inchangé ====== */
  const { showInterstitials } = useAdsVisibility();
  const interstitialAdUnitId = __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({
        ios: "ca-app-pub-4725616526467159/4942270608",
        android: "ca-app-pub-4725616526467159/6097960289",
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
  requestNonPersonalizedAdsOnly: npa,
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
    await AsyncStorage.setItem("lastInterstitialTime_create", Date.now().toString());
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

  /* ====== Image picker ====== */
  const pickImage = useCallback(async () => {
    try {
      const { canceled, assets } = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9,
      });
      if (!canceled && assets?.[0]?.uri) setImageUri(assets[0].uri);
    } catch {
      Alert.alert(t("error"), t("imagePickFailed"));
    }
  }, [t]);

  /* ====== Upload vers Storage (si image) ====== */
  const uploadImageIfNeeded = useCallback(async (localUri: string | null, nameHint: string) => {
    if (!localUri) return null;
    try {
      const resp = await fetch(localUri);
      const blob = await resp.blob();

      const storage = getStorage();
      const safeName =
        nameHint.trim().toLowerCase().replace(/[^\w]+/g, "_").slice(0, 40) || "challenge";
      const fileName = `${safeName}_${Date.now()}.jpg`;
      const ref = storageRef(storage, `Challenges-Image/${fileName}`);

      await uploadBytes(ref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref);
      return url;
    } catch {
      return null; // on ne bloque pas la création si l’upload échoue
    }
  }, []);

  /* ====== Validation & Création ====== */
  const titleLeft = TITLE_MAX - title.length;
  const descLeft = DESC_MAX - description.length;

  const completeness = useMemo(() => {
    let score = 0;
    if (title.trim().length >= 3) score += 0.34;
    if (description.trim().length >= 10) score += 0.33;
    if (imageUri) score += 0.33;
    return Math.min(1, score);
  }, [title, description, imageUri]);

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
        imageUrl: uploadedUrl || null,
        participantsCount: 0,
        usersTakingChallenge: [] as string[],
        creatorId: user.uid,
        createdAt: serverTimestamp(),
        approved: false,
        daysOptions: DEFAULT_DAYS_OPTIONS,
        category,
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
        [{ text: t("ok", { defaultValue: "OK" }), onPress: () => router.push("/explore") }]
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

  /* ====== UI ====== */
  const onChangeTitle = (v: string) => setTitle(v.slice(0, TITLE_MAX));
  const onChangeDescription = (v: string) => setDescription(v.slice(0, DESC_MAX));

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

        {/* Bandeau progression */}
        <View style={[styles.progressWrap, { backgroundColor: isDark ? "#202022" : "#ffffff" }]}>
          <Text style={[styles.progressText, { color: current.colors.textSecondary }]}>
  {t("completionLabel", { defaultValue: "Complétion" })}
</Text>
          <View style={[styles.progressBar, { backgroundColor: isDark ? "#2b2b30" : "#EFEFEF" }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(completeness * 100)}%`,
                  backgroundColor: current.colors.secondary,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressPct, { color: current.colors.textSecondary }]}>
            {Math.round(completeness * 100)}%
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Carte verre + halo */}
          <View style={styles.cardShadow}>
            <View style={[styles.halo, { backgroundColor: isDark ? "#7b5cff22" : "#ffb70022" }]} />
            <BlurView
              intensity={40}
              tint={isDark ? "dark" : "light"}
              style={styles.glassCard}
            >
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]
                    : ["rgba(255,255,255,0.6)", "rgba(255,245,230,0.35)"]
                }
                style={StyleSheet.absoluteFill}
              />

              {/* Icône + tagline */}
              <View style={styles.heroRow}>
                <View style={[styles.iconBadge, { borderColor: current.colors.secondary }]}>
                  <Ionicons name="flash-outline" size={22} color={current.colors.secondary} />
                </View>
                <Text style={[styles.heroTagline, { color: current.colors.textSecondary }]}>
                  {t("inspireOthers")}
                </Text>
              </View>

              {/* Titre */}
              <Field
  label={t("challengeTitle")}
  value={title}
  onChangeText={onChangeTitle}
  placeholder={t("exTitle") || "Ex: 30 jours de lecture"}
  max={TITLE_MAX}
  leftIcon="text-outline"
  theme={current}
  isDark={isDark}
  t={t}
/>

<Field
  label={t("challengeDescription")}
  value={description}
  onChangeText={onChangeDescription}
  placeholder={t("exDescription") || "Ex: Lire 10 pages par jour, partager ses notes..."}
  max={DESC_MAX}
  multiline
  numberOfLines={5}
  leftIcon="document-text-outline"
  theme={current}
  isDark={isDark}
  t={t}
/>


              {/* Catégorie (chips + picker accessible) */}
              <Text style={[styles.sectionLabel, { color: current.colors.textSecondary }]}>
                {t("category")}
              </Text>
              <View style={[styles.dropdownWrap, { backgroundColor: current.colors.background }]}>
                <Picker
  selectedValue={category}
  onValueChange={(v) => setCategory(v as CategoryLabel)}
  style={{
    color: isDark ? current.colors.textPrimary : "#111",
    height: FIELD_HEIGHT,
  }}
  itemStyle={{
    // iOS: améliore le centrage vertical et la lisibilité
    height: FIELD_HEIGHT,
    fontSize: 16,
    color: isDark ? current.colors.textPrimary : "#111",
  }}
  dropdownIconColor={isDark ? current.colors.textPrimary : current.colors.secondary}
  mode={Platform.OS === "ios" ? "dialog" : "dropdown"}
>
  {defaultCategories.map((opt) => (
    <Picker.Item
      key={opt}
      value={opt}
      label={t(`categories.${opt}`, { defaultValue: opt })}
      color={isDark ? current.colors.textPrimary : "#111"} // Android
    />
  ))}
</Picker>
              </View>

              {/* Image */}
              <Text style={[styles.sectionLabel, { color: current.colors.textSecondary }]}>
                {t("coverImage") || "Image de couverture (optionnel)"}
              </Text>
              <TouchableOpacity style={[styles.imageBox, { backgroundColor: current.colors.background }]} onPress={pickImage}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <View style={styles.imageOverlay}>
                      <Ionicons name="pencil" size={18} color="#fff" />
                      <Text style={styles.imageOverlayText}>{t("edit") || "Modifier"}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.imageEmpty}>
                    <Ionicons name="cloud-upload-outline" size={28} color={current.colors.textSecondary} />
                    <Text style={[styles.imageHint, { color: current.colors.textSecondary }]}>
                      {t("pickAnImage") || "Choisir une image"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Aperçu en direct */}
              <Text style={[styles.sectionLabel, { color: current.colors.textSecondary, marginTop: 4 }]}>
                {t("livePreview") || "Aperçu"}
              </Text>
              <View style={[styles.previewCard, { backgroundColor: current.colors.background }]}>
                {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}
                <View style={styles.previewContent}>
                  <View style={[styles.catBadge, { backgroundColor: current.colors.secondary }]}>
                    <Text style={styles.catBadgeText}>
  {t(`categories.${category}`, { defaultValue: category })}
</Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.previewTitle, { color: current.colors.textPrimary }]}
                  >
                    {title || (t("yourTitleHere") || "Ton titre ici")}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.previewDesc, { color: current.colors.textSecondary }]}
                  >
                    {description || (t("yourDescriptionHere") || "Ta description ici…")}
                  </Text>
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity
                disabled={!isValid || submitting}
                onPress={handleSubmit}
                accessibilityRole="button"
                style={{ opacity: !isValid || submitting ? 0.6 : 1, marginTop: SPACING }}
              >
                <LinearGradient
                  colors={[current.colors.primary, current.colors.secondary]}
                  style={styles.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="rocket-outline" size={18} color={isDark ? "#111" : "#111"} />
                  <Text style={[styles.ctaText, { color: "#111" }]}>
                    {submitting
                      ? t("pleaseWait", { defaultValue: "Patiente..." })
                      : t("createChallengeButton")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {submitting && (
                <View style={{ marginTop: 10, alignItems: "center" }}>
                  <ActivityIndicator color={current.colors.secondary} />
                </View>
              )}
            </BlurView>
          </View>

          {/* Petites notes d’aide */}
          <View style={styles.hintRow}>
            <Ionicons name="information-circle-outline" size={16} color={current.colors.textSecondary} />
            <Text style={[styles.hintText, { color: current.colors.textSecondary }]}>
              {t("reviewNote") || "Chaque défi est vérifié. Les images trop floues ou sans rapport sont rejetées."}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

/* =========================================
   Champs réutilisables
========================================= */

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  max,
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  theme,
  isDark,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  max?: number;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: string;
  theme: any;
  isDark: boolean;
  t: TFunction;
}) => {
  const left = max ? Math.max(0, max - value.length) : undefined;

  return (
    <View style={{ marginBottom: SPACING }}>
      <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{label}</Text>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.colors.background,
            borderColor: Platform.OS === "ios" ? "transparent" : "#00000010",
          },
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIcon}>
            <Ionicons name={leftIcon as any} size={18} color={theme.colors.textSecondary} />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              color: isDark ? theme.colors.textPrimary : "#111",   // ← texte bien noir en light
              height: multiline ? 120 : FIELD_HEIGHT,
            },
          ]}
          placeholder={placeholder || label}
          placeholderTextColor={isDark ? theme.colors.textSecondary : "#666"} // ← placeholder foncé en light
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>

      {typeof left === "number" && (
        <Text
          style={[
            styles.counter,
            { color: left < 10 ? theme.colors.secondary : theme.colors.textSecondary },
          ]}
        >
          {t("charsRemaining", { count: left })}   {/* ← i18n pluriel */}
        </Text>
      )}
    </View>
  );
};


/* =========================================
   Styles
========================================= */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? SPACING) : 0,
  },
  gradient: { flex: 1 },

  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 3,
  },

  /* progression */
  progressWrap: {
    marginHorizontal: SPACING,
    marginBottom: SPACING / 2,
    marginTop: 8,
    borderRadius: RADIUS,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressText: { fontSize: 12, fontFamily: "Comfortaa_500Medium" },
  progressPct: { marginLeft: "auto", fontSize: 12, fontFamily: "Comfortaa_500Medium" },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },

  /* carte verre */
  cardShadow: {
    marginTop: SPACING,
    marginBottom: SPACING,
  },
  halo: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: RADIUS + 10,
    filter: Platform.OS === "web" ? "blur(32px)" : undefined,
    opacity: 0.9,
  },
  glassCard: {
    borderRadius: RADIUS,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    padding: SPACING,
  },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING * 0.75,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  heroTagline: {
    fontSize: 14,
    fontFamily: "Comfortaa_500Medium",
  },

  sectionLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontFamily: "Comfortaa_500Medium",
  },

  /* field */
  inputWrap: {
    borderRadius: RADIUS,
    borderWidth: Platform.OS === "ios" ? 0 : 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  leftIcon: { marginRight: 8, width: 20, alignItems: "center" },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
  },
  counter: {
    marginTop: 6,
    alignSelf: "flex-end",
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
  },

  /* chips */
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontFamily: "Comfortaa_500Medium" },
  dropdownWrap: {
    borderRadius: RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#00000012",
    marginBottom: SPACING,
  },

  /* image */
  imageBox: {
    width: "100%",
    height: 160,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: "#00000012",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: SPACING,
  },
  imagePreview: { width: "100%", height: "100%" },
  imageOverlay: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  imageOverlayText: { color: "#fff", fontFamily: "Comfortaa_600SemiBold", fontSize: 12 },
  imageEmpty: { alignItems: "center", gap: 8 },
  imageHint: { fontSize: 13, fontFamily: "Comfortaa_400Regular" },

  /* preview */
  previewCard: {
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: "#00000012",
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: 120 },
  previewContent: { padding: 12 },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  catBadgeText: { color: "#0e0e12", fontFamily: "Comfortaa_700Bold", fontSize: 11 },
  previewTitle: { fontSize: 16, fontFamily: "Comfortaa_700Bold" },
  previewDesc: { marginTop: 4, fontSize: 13, fontFamily: "Comfortaa_400Regular" },

  /* CTA */
  cta: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: { fontSize: 16, fontFamily: "Comfortaa_700Bold" },

  /* hints */
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: SPACING,
  },
  hintText: { fontSize: 12, fontFamily: "Comfortaa_400Regular" },
});
