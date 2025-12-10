import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
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
import type { TFunction } from "i18next";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, db } from "../constants/firebase-config";
import * as Haptics from "expo-haptics";
import { Image as RNImage } from "react-native";

// Toast premium
import { useToast } from "../src/ui/Toast";

// 🔥 Hook dédié pour l'interstitiel de CreateChallenge
function useCreateChallengeInterstitial(showInterstitials: boolean, npa: boolean) {
  const interstitialAdUnitId =
    __DEV__
      ? TestIds.INTERSTITIAL
      : Platform.select({
          ios: "ca-app-pub-4725616526467159/3625641580",
          android: "ca-app-pub-4725616526467159/1602005670",
        })!;

  const interstitialRef = useRef<InterstitialAd | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  // Cooldown spécifique à la création
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

  // Initialisation + gestion des listeners
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

    const onLoaded = ad.addAdEventListener(AdEventType.LOADED, () =>
      setAdLoaded(true)
    );
    const onError = ad.addAdEventListener(AdEventType.ERROR, () =>
      setAdLoaded(false)
    );

    ad.load();

    return () => {
      onLoaded();
      onError();
      interstitialRef.current = null;
      setAdLoaded(false);
    };
  }, [showInterstitials, interstitialAdUnitId, npa]);

  // Fonction à appeler au bon moment (après création)
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

  return { tryShowCreateInterstitial };
}


/* -------- Constantes UI -------- */
const SPACING = 20;
const RADIUS = 18;
const FIELD_HEIGHT = 52;

const DRAFT_KEY = "create_challenge_draft_v1";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const scoreQuality = (title: string, desc: string) => {
  let s = 0;
  const t = title.trim();
  const d = desc.trim();
  if (t.length >= 6) s += 0.35;
  if (/[A-Za-zÀ-ÿ]/.test(t)) s += 0.1;
  if (/^[A-ZÀ-Ÿ]/.test(t)) s += 0.05;
  if (d.length >= 40) s += 0.3;
  if (/[.!?]$/.test(d)) s += 0.05;
  if (/(par jour|quotidien|minutes?|jours?)/i.test(d)) s += 0.1; // concret/actionnable
  return Math.min(1, s);
};

const describeIssues = (t: TFunction, title: string, desc: string) => {
  const issues: string[] = [];
  if (title.trim().length < 6)
    issues.push(t("challengeC.validation.titleTooShort"));
  if (desc.trim().length < 20)
    issues.push(t("challengeC.validation.descTooShort"));
  if (!/[A-Za-zÀ-ÿ]/.test(title))
    issues.push(t("challengeC.validation.titleInvalidChars"));
  return issues;
};

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
type CategoryLabel = (typeof defaultCategories)[number];

// Cohérent avec Explore (fallback côté liste)
const DEFAULT_DAYS_OPTIONS = [3, 7, 14, 21, 30, 60, 90, 180, 365];

/* -------- Limites de saisie (UX) -------- */
const TITLE_MAX = 60;
const DESC_MAX = 240;
// ✅ règles minimales de validation (cohérentes avec le calcul deterministe)
const MIN_TITLE = 6;
const MIN_DESC = 20;

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
  const { show } = useToast();
  const { showInterstitials } = useAdsVisibility();

  const { tryShowCreateInterstitial } = useCreateChallengeInterstitial(
    showInterstitials,
    npa
  );


  const scrollRef = useRef<ScrollView | null>(null);

  const softHaptic = useCallback(
    async (type: "success" | "error" | "warning" = "success") => {
      try {
        if (type === "error") {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );
        } else if (type === "warning") {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
        } else {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        }
      } catch {}
    },
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<CategoryLabel>(
    defaultCategories[0]
  );
  const [issues, setIssues] = useState<string[]>([]);
  const submittingRef = useRef(false);



    // gradient memo pour éviter recréation d'array à chaque render
  const gradientColors = useMemo<[string, string]>(
    () => [current.colors.background, current.colors.cardBackground],
    [current.colors.background, current.colors.cardBackground]
  );


  // draft sauvegardé (debounce)
  const draftTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (draftTimeout.current) clearTimeout(draftTimeout.current);
    };
  }, []);

  const saveDraft = useCallback(
    (next: {
      title?: string;
      description?: string;
      imageUri?: string | null;
      category?: CategoryLabel;
    }) => {
      const payload = {
        title,
        description,
        imageUri,
        category,
        ...next,
      };
      if (draftTimeout.current) clearTimeout(draftTimeout.current);
      draftTimeout.current = setTimeout(() => {
        AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload)).catch(() => {});
      }, 300);
    },
    [title, description, imageUri, category]
  );

  // Restaurer le brouillon
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          setTitle(draft.title ?? "");
          setDescription(draft.description ?? "");
          setImageUri(draft.imageUri ?? null);
          setCategory(draft.category ?? defaultCategories[0]);
          show(
            t("draft.restored", {
              defaultValue: "Brouillon restauré ✅",
            }),
            "info"
          );
          softHaptic("success");
        }
      } catch {}
    })();
  }, [t, show, softHaptic]);

  
  /* ====== Image picker ====== */
  const pickImage = useCallback(async () => {
    try {
      const { canceled, assets } =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.9,
        });
      if (!canceled && assets?.[0]?.uri) {
        setImageUri(assets[0].uri);
        saveDraft({ imageUri: assets[0].uri });
      }
    } catch {
      show(
        t("imagePickFailed", {
          defaultValue: "Impossible d’ouvrir la galerie.",
        }),
        "error"
      );
      softHaptic("error");
    }
  }, [t, saveDraft, show, softHaptic]);

  type UploadResult = { url: string | null; rejected: boolean };


  /* ====== Upload vers Storage (si image) ====== */
    /* ====== Upload vers Storage (si image) ====== */
  const uploadImageIfNeeded = useCallback(
    async (localUri: string | null, nameHint: string): Promise<UploadResult> => {
      // Pas d'image → rien à uploader, mais pas une "rejection"
      if (!localUri) return { url: null, rejected: false };

      try {
        let reject = false;

        // Taille approximative
        try {
          const res = await fetch(localUri);
          const buf = await res.blob();
          if (buf.size > IMAGE_MAX_BYTES) {
            show(
              t("imageTooBig", {
                mb: 5,
                defaultValue: "Image trop lourde (>5MB).",
              }),
              "error"
            );
            reject = true;
            softHaptic("error");
          }
        } catch {
          // si on n'arrive pas à lire la taille, on ne bloque pas ici
        }

        // Dimensions minimales (ex: 600x400)
        await new Promise<void>((resolve) => {
          RNImage.getSize(
            localUri,
            (w, h) => {
              if (w < 600 || h < 400) {
                show(
                  t("imageTooSmall", {
                    defaultValue: "Image trop petite (min 600x400).",
                  }),
                  "error"
                );
                reject = true;
                softHaptic("error");
              }
              resolve();
            },
            () => resolve()
          );
        });

        // 🔒 Cas "rejet dur" → on bloque la création
        if (reject) {
          return { url: null, rejected: true };
        }

        // Upload normal (si tout est ok)
        const resp = await fetch(localUri);
        const blob = await resp.blob();

        const storage = getStorage();
        const safeName =
          nameHint
            .trim()
            .toLowerCase()
            .replace(/[^\w]+/g, "_")
            .slice(0, 40) || "challenge";
        const fileName = `${safeName}_${Date.now()}.jpg`;
        const ref = storageRef(storage, `Challenges-Image/${fileName}`);

        await uploadBytes(ref, blob, { contentType: "image/jpeg" });
        const url = await getDownloadURL(ref);

        return { url, rejected: false };
      } catch {
        // ⚠️ Problème réseau / storage → on NE BLOQUE PAS la création,
        // on renverra juste null, rejected:false
        return { url: null, rejected: false };
      }
    },
    [t, show, softHaptic]
  );


  /* ====== Validation & Création ====== */
  const titleLeft = TITLE_MAX - title.length;
  const descLeft = DESC_MAX - description.length;

  const titleOK = useMemo(
    () => title.trim().length >= MIN_TITLE && /[A-Za-zÀ-ÿ]/.test(title),
    [title]
  );
  const descOK = useMemo(
    () => description.trim().length >= MIN_DESC,
    [description]
  );
  const categoryOK = !!category;
  const imageOK = !!imageUri;

  const REQUIRED_COUNT = 4; // titre, description, catégorie, image
  const completeness = useMemo(() => {
    const count = [titleOK, descOK, categoryOK, imageOK].filter(Boolean)
      .length;
    return count / REQUIRED_COUNT;
  }, [titleOK, descOK, categoryOK, imageOK]);

  // Messages helper/erreur
  const titleTooShort =
    title.trim().length > 0 && title.trim().length < MIN_TITLE;
  const titleNoLetters =
    title.trim().length > 0 && !/[A-Za-zÀ-ÿ]/.test(title.trim());
  const titleError =
    titleTooShort || titleNoLetters
      ? [
          titleTooShort
            ? t("challengeC.hint.titleMin", {
                min: MIN_TITLE,
                defaultValue: `Au moins ${MIN_TITLE} caractères.`,
              })
            : null,
          !titleTooShort && titleNoLetters
            ? t("challengeC.hint.titleLetters", {
                defaultValue: "Doit contenir des lettres.",
              })
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  const titleHelper =
    title.length === 0
      ? t("challengeC.hint.titleHelper", {
          min: MIN_TITLE,
          defaultValue: `Titre clair (≥ ${MIN_TITLE} caractères).`,
        })
      : null;

  const descError =
    description.length > 0 && !descOK
      ? t("challengeC.hint.descMin", {
          min: MIN_DESC,
          defaultValue: `Description ≥ ${MIN_DESC} caractères.`,
        })
      : null;
  const descHelper =
    description.length === 0
      ? t("challengeC.hint.descHelper", {
          min: MIN_DESC,
          defaultValue: `Explique concrètement (≥ ${MIN_DESC} caractères).`,
        })
      : null;

  // Score de qualité
  const qualityScore = useMemo(
    () => scoreQuality(title, description),
    [title, description]
  );
  const qualityPct = Math.round(qualityScore * 100);

  useEffect(() => {
    setIssues(describeIssues(t, title, description));
  }, [t, title, description]);

  const isValid = titleOK && descOK && categoryOK;

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      show(
        t("allFieldsRequired", {
          defaultValue: "Titre et description requis.",
        }),
        "error"
      );
      softHaptic("warning");
      return;
    }

    const currentIssues = describeIssues(t, title, description);
    if (currentIssues.length) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      show(currentIssues[0], "error");
      softHaptic("warning");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      show(
        t("loginRequired", {
          defaultValue: "Connecte-toi pour créer un défi.",
        }),
        "error"
      );
      softHaptic("error");
      return;
    }

    if (submitting || submittingRef.current) return;
    setSubmitting(true);
    submittingRef.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      // 1) Upload image si fournie
            // 1) Upload image si fournie
      const { url: uploadedUrl, rejected } = await uploadImageIfNeeded(
        imageUri,
        title
      );

      // 🔥 Si l'image a été REJETÉE (trop petite / trop lourde),
      // on arrête là : les toasts sont déjà affichés.
      if (rejected) {
        return;
      }


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
        lastCreatedChallengeAt: serverTimestamp(),
      });

      // 4) Interstitiel (non-premium)
      await tryShowCreateInterstitial();

      // 5) Confirmation + navigation
      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch {}

      show(
        t("challengeSubmittedForReview", {
          defaultValue:
            "Défi soumis 🎉 Il sera visible après validation.",
        }),
        "success"
      );
      softHaptic("success");
      try {
        (router as any).dismiss?.();
      } catch {}
      setTimeout(() => router.replace("/focus"), 250);
    } catch (e: any) {
      console.error("Create challenge error:", e?.message ?? e);
      show(
        t("createChallengeFailed", {
          defaultValue:
            "Impossible de créer le défi. Réessaie plus tard.",
        }),
        "error"
      );
      softHaptic("error");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
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
    show,
    softHaptic,
  ]);

  /* ====== UI handlers ====== */
  const onChangeTitle = (v: string) => {
    const nv = v.slice(0, TITLE_MAX);
    setTitle(nv);
    saveDraft({ title: nv });
  };
  const onChangeDescription = (v: string) => {
    const nv = v.slice(0, DESC_MAX);
    setDescription(nv);
    saveDraft({ description: nv });
  };

  const completionLabel =
    completeness < 1
      ? t("quality.fillRequired", {
          defaultValue:
            "Remplis titre, description (≥ 20 caractères), catégorie et image pour atteindre 100%.",
        })
      : t("quality.hintGreat", {
          defaultValue: "Parfait ! Tu peux créer ton défi.",
        });

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: current.colors.background },
      ]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <CustomHeader title={t("createYourChallenge")} />

        {/* Bandeau progression */}
        <View
          style={[
            styles.progressWrap,
            { backgroundColor: isDark ? "#202022" : "#ffffff" },
          ]}
        >
          <Text
            style={[
              styles.progressText,
              { color: current.colors.textSecondary },
            ]}
          >
            {t("completionLabel", { defaultValue: "Complétion" })}
          </Text>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: isDark ? "#2b2b30" : "#EFEFEF",
              },
            ]}
          >
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
          <Text
            style={[
              styles.progressPct,
              { color: current.colors.textSecondary },
            ]}
          >
            {Math.round(completeness * 100)}%
          </Text>
        </View>

        <Text
          style={[
            styles.hintText,
            {
              marginTop: 6,
              color: current.colors.textSecondary,
              paddingHorizontal: SPACING,
            },
          ]}
        >
          {completionLabel}
        </Text>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Carte verre + halo */}
            <View style={styles.cardShadow}>
              <View
                style={[
                  styles.halo,
                  {
                    backgroundColor: isDark
                      ? "#7b5cff22"
                      : "#ffb70022",
                  },
                ]}
              />
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
                  <View
                    style={[
                      styles.iconBadge,
                      { borderColor: current.colors.secondary },
                    ]}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={22}
                      color={current.colors.secondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.heroTagline,
                      { color: current.colors.textSecondary },
                    ]}
                  >
                    {t("inspireOthers")}
                  </Text>
                </View>

                {/* Titre */}
                <Field
                  label={t("challengeTitle")}
                  value={title}
                  onChangeText={onChangeTitle}
                  placeholder={
                    t("exTitle") || "Ex: 30 jours de lecture"
                  }
                  max={TITLE_MAX}
                  leftIcon="text-outline"
                  theme={current}
                  isDark={isDark}
                  t={t}
                  helper={titleHelper}
                  error={titleError}
                />

                {/* Description */}
                <Field
                  label={t("challengeDescription")}
                  value={description}
                  onChangeText={onChangeDescription}
                  placeholder={
                    t("exDescription") ||
                    "Ex: Lire 10 pages par jour, partager ses notes..."
                  }
                  max={DESC_MAX}
                  multiline
                  numberOfLines={5}
                  leftIcon="document-text-outline"
                  theme={current}
                  isDark={isDark}
                  t={t}
                  helper={descHelper}
                  error={descError}
                />

                {/* Catégorie */}
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: current.colors.textSecondary },
                  ]}
                >
                  {t("category")}
                </Text>
                <View
                  style={[
                    styles.dropdownWrap,
                    { backgroundColor: current.colors.background },
                  ]}
                >
                  <Picker
                    selectedValue={category}
                    onValueChange={(v) => {
                      const val = v as CategoryLabel;
                      setCategory(val);
                      saveDraft({ category: val });
                    }}
                    style={{
                      color: isDark
                        ? current.colors.textPrimary
                        : "#111",
                      height: FIELD_HEIGHT,
                    }}
                    itemStyle={{
                      height: FIELD_HEIGHT,
                      fontSize: 16,
                      color: isDark
                        ? current.colors.textPrimary
                        : "#111",
                    }}
                    dropdownIconColor={
                      isDark
                        ? current.colors.textPrimary
                        : current.colors.secondary
                    }
                    mode={
                      Platform.OS === "ios" ? "dialog" : "dropdown"
                    }
                  >
                    {defaultCategories.map((opt) => (
                      <Picker.Item
                        key={opt}
                        value={opt}
                        label={t(`categories.${opt}`, {
                          defaultValue: opt,
                        })}
                        color={
                          isDark
                            ? current.colors.textPrimary
                            : "#111"
                        }
                      />
                    ))}
                  </Picker>
                </View>

                {/* Image */}
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: current.colors.textSecondary },
                  ]}
                >
                  {t("coverImage") ||
                    "Image de couverture (optionnel)"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.imageBox,
                    { backgroundColor: current.colors.background },
                  ]}
                  onPress={pickImage}
                  activeOpacity={0.9}
                >
                  {imageUri ? (
                    <>
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.imagePreview}
                      />
                      <View style={styles.imageOverlay}>
                        <Ionicons
                          name="pencil"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.imageOverlayText}>
                          {t("edit") || "Modifier"}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.imageEmpty}>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={28}
                        color={current.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.imageHint,
                          { color: current.colors.textSecondary },
                        ]}
                      >
                        {t("pickAnImage") || "Choisir une image"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Aperçu live */}
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: current.colors.textSecondary,
                      marginTop: 4,
                    },
                  ]}
                >
                  {t("livePreview") || "Aperçu"}
                </Text>
                <View
                  style={[
                    styles.previewCard,
                    { backgroundColor: current.colors.background },
                  ]}
                >
                  {imageUri && (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                    />
                  )}
                  <View style={styles.previewContent}>
                    <View
                      style={[
                        styles.catBadge,
                        { backgroundColor: current.colors.secondary },
                      ]}
                    >
                      <Text style={styles.catBadgeText}>
                        {t(`categories.${category}`, {
                          defaultValue: category,
                        })}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.previewTitle,
                        { color: current.colors.textPrimary },
                      ]}
                    >
                      {title ||
                        t("yourTitleHere") ||
                        "Ton titre ici"}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.previewDesc,
                        { color: current.colors.textSecondary },
                      ]}
                    >
                      {description ||
                        t("yourDescriptionHere") ||
                        "Ta description ici…"}
                    </Text>
                  </View>
                </View>

                {/* Score qualité */}
                <View style={styles.qualityRow}>
                  <Ionicons
                    name="star-outline"
                    size={16}
                    color={current.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.hintText,
                      { color: current.colors.textSecondary },
                    ]}
                  >
                    {t("quality.scoreLabel", {
                      defaultValue: "Qualité du défi",
                    })}
                    : {qualityPct}%
                  </Text>
                </View>

                {issues.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    {issues.map((it, idx) => (
                      <Text
                        key={idx}
                        style={[
                          styles.hintText,
                          {
                            color: "#ffb3b3",
                            fontFamily: "Comfortaa_500Medium",
                          },
                        ]}
                      >
                        • {it}
                      </Text>
                    ))}
                  </View>
                )}

                {/* CTA */}
                <TouchableOpacity
                  disabled={!isValid || submitting}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  style={{
                    opacity: !isValid || submitting ? 0.6 : 1,
                    marginTop: SPACING,
                  }}
                  accessibilityLabel={t("createChallengeButton")}
                  accessibilityHint={t("inspireOthers")}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[
                      current.colors.primary,
                      current.colors.secondary,
                    ]}
                    style={styles.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons
                      name="rocket-outline"
                      size={18}
                      color="#111"
                    />
                    <Text
                      style={[styles.ctaText, { color: "#111" }]}
                    >
                      {submitting
                        ? t("pleaseWait", {
                            defaultValue: "Patiente...",
                          })
                        : t("createChallengeButton")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {submitting && (
                  <View
                    style={{
                      marginTop: 10,
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator
                      color={current.colors.secondary}
                    />
                  </View>
                )}
              </BlurView>
            </View>

            {/* Notes d’aide */}
            <View style={styles.hintRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={current.colors.textSecondary}
              />
              <Text
                style={[
                  styles.hintText,
                  {
                    color: current.colors.textSecondary,
                    flex: 1,
                  },
                ]}
              >
                {t("reviewNote") ||
                  "Chaque défi est vérifié. Les images trop floues ou sans rapport sont rejetées."}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  helper,
  error,
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
  helper?: string | null;
  error?: string | null;
}) => {
  const left = max ? Math.max(0, max - value.length) : undefined;

  return (
    <View style={{ marginBottom: SPACING }}>
      <Text
        style={[
          styles.sectionLabel,
          { color: theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.colors.background,
            borderColor:
              Platform.OS === "ios" ? "transparent" : "#00000010",
          },
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIcon}>
            <Ionicons
              name={leftIcon as any}
              size={18}
              color={theme.colors.textSecondary}
            />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              color: isDark ? theme.colors.textPrimary : "#111",
              height: multiline ? 120 : FIELD_HEIGHT,
            },
          ]}
          placeholder={placeholder || label}
          placeholderTextColor={
            isDark ? theme.colors.textSecondary : "#666"
          }
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={multiline ? "sentences" : "words"}
          autoCorrect
          returnKeyType={multiline ? "default" : "done"}
          blurOnSubmit={!multiline}
          accessibilityLabel={label}
          accessibilityHint={t("a11y.typeHere")}
        />
      </View>

      <View style={styles.helperRow}>
        {!!error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.helperText, { color: "#ff6b6b" }]}
          >
            {error}
          </Text>
        ) : !!helper ? (
          <Text
            style={[
              styles.helperText,
              { color: theme.colors.textSecondary },
            ]}
          >
            {helper}
          </Text>
        ) : (
          <View />
        )}

        {typeof left === "number" && (
          <Text
            style={[
              styles.counter,
              {
                color:
                  left < 10
                    ? theme.colors.secondary
                    : theme.colors.textSecondary,
              },
            ]}
          >
            {t("charsRemaining", { count: left })}
          </Text>
        )}
      </View>
    </View>
  );
};

/* =========================================
   Styles
========================================= */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android"
        ? StatusBar.currentHeight ?? SPACING
        : 0,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Comfortaa_500Medium",
  },
  progressPct: {
    marginLeft: "auto",
    fontSize: 12,
    fontFamily: "Comfortaa_500Medium",
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },

  helperRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helperText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginRight: 8,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },

  /* carte verre */
  cardShadow: {
    marginTop: SPACING,
    marginBottom: SPACING,
    alignSelf: "center",
    width: "100%",
    maxWidth: 720,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  halo: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: RADIUS + 10,
    opacity: 0.9,
    // filter web seulement
    ...(Platform.OS === "web"
      ? { filter: "blur(32px)" as any }
      : null),
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
    marginTop: 0,
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
  },

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
  imageOverlayText: {
    color: "#fff",
    fontFamily: "Comfortaa_600SemiBold",
    fontSize: 12,
  },
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
  catBadgeText: {
    color: "#0e0e12",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 11,
  },
  previewTitle: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },
  previewDesc: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Comfortaa_400Regular",
  },

  /* CTA */
  cta: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },

  /* hints */
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: SPACING,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
  },
});
