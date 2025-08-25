import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  StatusBar,
  StyleProp
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "../../constants/firebase-config";
import * as ImagePicker from "expo-image-picker";
import { TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { ViewStyle } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";

const SPACING = 15;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Auto-compact on small screens (e.g., iPhone SE / older Androids)
const IS_COMPACT = SCREEN_HEIGHT < 720;

// Slightly tighter scaler on compact screens
const n = (size: number) => Math.round(normalizeSize(IS_COMPACT ? size * 0.9 : size));

// Vertical rhythm tuned for compact
const V_SPACING = IS_COMPACT ? 10 : 15;



const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const BANNER_HEIGHT = normalizeSize(50);

/** Util pour ajouter une alpha sans casser les gradients */
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};


// 👇 Normalise n'importe quelle valeur "profil" en string d'affichage
const toDisplayString = (v: any): string => {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (v === null || v === undefined) return "";
  return String(v);
};

// 👇 Trim sécurisé: retourne toujours une string trimée
const safeTrim = (v: any): string => toDisplayString(v).trim();


interface User {
  uid: string;
  displayName?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  location?: string | null;
  interests?: string | string[] | null; // 👈 peut arriver en array depuis la base
}


export default function UserInfo() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );
  const { showBanners } = useAdsVisibility();
 const bottomPadding = showBanners ? BANNER_HEIGHT + n(40) : n(40);

  const GlassCard: React.FC<{ style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ style, children }) => (
  <View style={[styles.glassWrap, style]}>
    {/* Blur natif */}
    <BlurView
      intensity={45}
      tint={isDarkMode ? "dark" : "light"}
      experimentalBlurMethod="dimezisBlurView"
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={
        isDarkMode
          ? [withAlpha("#FFFFFF", 0.03), withAlpha("#FFFFFF", 0.02)]
          : [withAlpha("#FFFFFF", 0.6), withAlpha("#FFF5E6", 0.4)]
      }
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <View style={styles.glassInner}>{children}</View>
  </View>
);


  // États de focus pour chaque champ
  const [isDisplayNameFocused, setIsDisplayNameFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isInterestsFocused, setIsInterestsFocused] = useState(false);

  // ✅ Y a-t-il au moins une vraie modification par rapport aux valeurs en base ?
const hasChanges = useMemo(() => {
  if (!user) return false;

  const baseDisplay = safeTrim(user.displayName);
  const baseBio = safeTrim(user.bio);
  const baseLocation = safeTrim(user.location);
  const baseInterests = safeTrim(user.interests);
  const baseProfileImage = user.profileImage || null;

  const cleanDisplay = safeTrim(displayName);
  const cleanBio = safeTrim(bio);
  const cleanLocation = safeTrim(location);
  const cleanInterests = safeTrim(interests);
  const nextProfileImage = profileImage || null;

  return (
    (cleanDisplay && cleanDisplay !== baseDisplay) ||
    (cleanBio && cleanBio !== baseBio) ||
    (nextProfileImage !== baseProfileImage) ||
    (cleanLocation && cleanLocation !== baseLocation) ||
    (cleanInterests && cleanInterests !== baseInterests)
  );
}, [user, displayName, bio, profileImage, location, interests]);



  // Chargement des données utilisateur
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error(t("userNotAuthenticated"));
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
          setInterests(toDisplayString(userData.interests));
        } else {
          throw new Error(t("profileNotFound"));
        }
      } catch (error: any) {
        Alert.alert(
          t("error"),
          t("errorFetchingProfile") + `: ${error.message}`
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [t]);

  // Sélection de l'image
  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("permissionDenied"), t("photoPermissionDenied"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert(t("error"), t("userNotAuthenticated"));
          return;
        }
        setIsLoading(true);
        const filename = `profileImages/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        const response = await fetch(uri);
        const blob = await response.blob();
        const uploadTask = uploadBytesResumable(storageRef, blob, {
          contentType: "image/jpeg",
        });

        uploadTask.on(
          "state_changed",
          null,
          (error) => {
            setIsLoading(false);
            Alert.alert(
              t("uploadError"),
              t("uploadFailed") + `: ${error.message}`
            );
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setProfileImage(downloadURL);
              setIsLoading(false);
              Alert.alert(t("success"), t("profileImageUpdated"));
            } catch (urlError: any) {
              setIsLoading(false);
              Alert.alert(
                t("error"),
                t("uploadFailed") + `: ${urlError.message}`
              );
            }
          }
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert(t("error"), t("uploadFailed") + `: ${error.message}`);
    }
  }, [t]);

  // Sauvegarde des modifications
  const handleSave = useCallback(async () => {
  if (!user?.uid) {
    Alert.alert(t("error"), t("userNotFound"));
    return;
  }

  // ✅ On construit dynamiquement ce qui change VRAIMENT (et non vide)
  const updateData: Partial<User> = {};

const cleanDisplay = safeTrim(displayName);
const cleanBio = safeTrim(bio);
const cleanLocation = safeTrim(location);
const cleanInterests = safeTrim(interests);

if (cleanDisplay && cleanDisplay !== safeTrim(user.displayName)) {
  updateData.displayName = cleanDisplay;
}
if (cleanBio && cleanBio !== safeTrim(user.bio)) {
  updateData.bio = cleanBio;
}
if ((profileImage || null) !== (user.profileImage || null)) {
  updateData.profileImage = profileImage || null;
}
if (cleanLocation && cleanLocation !== safeTrim(user.location)) {
  updateData.location = cleanLocation;
}
if (cleanInterests && cleanInterests !== safeTrim(user.interests)) {
  // 📝 on stocke en string; si tu veux un tableau en DB,
  // remplace par: cleanInterests.split(",").map(s => s.trim()).filter(Boolean)
  updateData.interests = cleanInterests;
}


  // Rien de pertinent à mettre à jour → on informe et on sort
  if (Object.keys(updateData).length === 0) {
    Alert.alert(t("info"), t("noChangesDetected"));
    return;
  }

  setIsLoading(true);
  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, updateData);
    await checkForAchievements(user.uid);
    Alert.alert(t("success"), t("profileUpdateSuccess"));
    router.push("/(tabs)/profile");
  } catch (error: any) {
    Alert.alert(t("error"), t("profileUpdateFailed") + `: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
}, [user, displayName, bio, profileImage, location, interests, router, t]);



  // Métadonnées SEO
  const metadata = useMemo(
    () => ({
      title: t("yourProfile"),
      description: t("editProfile.description"),
      url: `https://challengeme.com/profile/edit/${auth.currentUser?.uid}`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: t("editProfile.title"),
        description: t("editProfile.description"),
      },
    }),
    [t]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={
            isDarkMode
              ? [
                  currentTheme.colors.background,
                  currentTheme.colors.cardBackground,
                ]
              : ["#FFFFFF", "#FFE4B5"]
          }
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
            {t("loadingProfile")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
  <StatusBar
    translucent
    backgroundColor="transparent"
    barStyle={isDarkMode ? "light-content" : "dark-content"}
  />

  <LinearGradient
  colors={[
    withAlpha(currentTheme.colors.background, 1),
    withAlpha(currentTheme.colors.cardBackground, 1),
    withAlpha(currentTheme.colors.primary, 0.13),
  ]}
  style={styles.gradientContainer}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
  <LinearGradient
  pointerEvents="none"
  colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
  style={styles.bgOrbTop}
  start={{ x: 0.2, y: 0 }}
  end={{ x: 1, y: 1 }}
/>
<LinearGradient
  pointerEvents="none"
  colors={[withAlpha(currentTheme.colors.secondary, 0.25), "transparent"]}
  style={styles.bgOrbBottom}
  start={{ x: 1, y: 0 }}
  end={{ x: 0, y: 1 }}
/>
    <CustomHeader
      title={t("yourProfile")}
      backgroundColor="transparent"
      useBlur={false}
      showHairline={false}
    />
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  bounces={false}
          >

            <Animated.View
              entering={ZoomIn.delay(100)}
              style={styles.imageContainer}
            >
              <TouchableOpacity
                onPress={pickImage}
                accessibilityLabel={t("accessibility.editProfileImage.label")}
                accessibilityHint={t("accessibility.editProfileImage.hint")}
                accessibilityRole="button"
                testID="profile-image-button"
              >
                <LinearGradient
                  colors={
                    isDarkMode
                      ? [
                          currentTheme.colors.background + "80",
                          currentTheme.colors.cardBackground + "80",
                        ]
                      : [
                          currentTheme.colors.secondary + "80",
                          currentTheme.colors.primary + "80",
                        ]
                  }
                  style={[
                    styles.imageGradient,
                    {
                      borderColor: isDarkMode
                        ? currentTheme.colors.secondary
                        : "#FFFFFF",
                    },
                  ]}
                >
                  {profileImage ? (
                    <Image
                      source={{ uri: profileImage }}
                      style={styles.profileImage}
                      accessibilityLabel={t(
                        "accessibility.currentProfileImage.label"
                      )}
                      defaultSource={require("../../assets/images/default-profile.webp")}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.addImageText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {t("addProfilePhoto")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
<GlassCard
  style={[styles.formCard, { borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800" }]}
>
  {/* Nom */}
  <Animated.View
    entering={FadeInUp.delay(200)}
    style={[
      styles.inputWrapper,
      {
        backgroundColor: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
        borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800",
      },
    ]}
  >
    <TextInput
      label={t("name")}
      mode="flat"
      style={[styles.input, { fontSize: normalizeSize(14) }]}
      value={displayName}
      onChangeText={setDisplayName}
      onFocus={() => setIsDisplayNameFocused(true)}
      onBlur={() => setIsDisplayNameFocused(false)}
      textColor={isDarkMode ? currentTheme.colors.textPrimary : "#000"}
      underlineColor="transparent"
      activeUnderlineColor={currentTheme.colors.secondary}
      placeholderTextColor={isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary}
      theme={{
        colors: {
          background: "transparent",
          text: isDarkMode ? currentTheme.colors.textPrimary : "#000",
          primary: isDarkMode ? "#FFEC8B" : currentTheme.colors.secondary,
          placeholder: isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary,
          onSurface: isDarkMode ? (!isDisplayNameFocused ? "#FFD700" : currentTheme.colors.textPrimary) : currentTheme.colors.textSecondary,
        },
        fonts: { regular: { fontFamily: "Comfortaa_400Regular" } },
      }}
      dense
      accessibilityLabel={t("accessibility.usernameField.label")}
      accessibilityHint={t("accessibility.usernameField.hint")}
      testID="input-displayName"
    />
  </Animated.View>

  {/* Bio */}
  <Animated.View
    entering={FadeInUp.delay(300)}
    style={[
      styles.inputWrapper,
      {
        backgroundColor: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
        borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800",
      },
    ]}
  >
    <TextInput
      label={t("bio")}
      mode="flat"
      style={[styles.input, styles.multilineInput, { fontSize: normalizeSize(14) }]}
      value={bio}
      onChangeText={setBio}
      onFocus={() => setIsBioFocused(true)}
      onBlur={() => setIsBioFocused(false)}
      multiline
      numberOfLines={3}
      textColor={isDarkMode ? currentTheme.colors.textPrimary : "#000"}
      underlineColor="transparent"
      activeUnderlineColor={currentTheme.colors.secondary}
      placeholderTextColor={isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary}
      theme={{
        colors: {
          background: "transparent",
          text: isDarkMode ? currentTheme.colors.textPrimary : "#000",
          primary: isDarkMode ? "#FFEC8B" : currentTheme.colors.secondary,
          placeholder: isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary,
          onSurface: isDarkMode ? (!isBioFocused ? "#FFD700" : currentTheme.colors.textPrimary) : currentTheme.colors.textSecondary,
        },
        fonts: { regular: { fontFamily: "Comfortaa_400Regular" } },
      }}
      dense
      accessibilityLabel={t("accessibility.bioField.label")}
      accessibilityHint={t("accessibility.bioField.hint")}
      testID="input-bio"
    />
  </Animated.View>

  {/* Localisation */}
  <Animated.View
    entering={FadeInUp.delay(400)}
    style={[
      styles.inputWrapper,
      {
        backgroundColor: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
        borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800",
      },
    ]}
  >
    <TextInput
      label={t("location")}
      mode="flat"
      style={[styles.input, { fontSize: normalizeSize(14) }]}
      value={location}
      onChangeText={setLocation}
      onFocus={() => setIsLocationFocused(true)}
      onBlur={() => setIsLocationFocused(false)}
      textColor={isDarkMode ? currentTheme.colors.textPrimary : "#000"}
      underlineColor="transparent"
      activeUnderlineColor={currentTheme.colors.secondary}
      placeholderTextColor={isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary}
      theme={{
        colors: {
          background: "transparent",
          text: isDarkMode ? currentTheme.colors.textPrimary : "#000",
          primary: isDarkMode ? "#FFEC8B" : currentTheme.colors.secondary,
          placeholder: isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary,
          onSurface: isDarkMode ? (!isLocationFocused ? "#FFD700" : currentTheme.colors.textPrimary) : currentTheme.colors.textSecondary,
        },
        fonts: { regular: { fontFamily: "Comfortaa_400Regular" } },
      }}
      dense
      accessibilityLabel={t("accessibility.locationField.label")}
      accessibilityHint={t("accessibility.locationField.hint")}
      testID="input-location"
    />
  </Animated.View>

  {/* Intérêts */}
  <Animated.View
    entering={FadeInUp.delay(500)}
    style={[
      styles.inputWrapper,
      {
        backgroundColor: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
        borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800",
      },
    ]}
  >
    <TextInput
      label={t("interests")}
      mode="flat"
      style={[styles.input, { fontSize: normalizeSize(14) }]}
      value={interests}
      onChangeText={setInterests}
      onFocus={() => setIsInterestsFocused(true)}
      onBlur={() => setIsInterestsFocused(false)}
      textColor={isDarkMode ? currentTheme.colors.textPrimary : "#000"}
      underlineColor="transparent"
      activeUnderlineColor={currentTheme.colors.secondary}
      placeholder={t("interestsPlaceholder")}
      placeholderTextColor={isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary}
      theme={{
        colors: {
          background: "transparent",
          text: isDarkMode ? currentTheme.colors.textPrimary : "#000",
          primary: isDarkMode ? "#FFEC8B" : currentTheme.colors.secondary,
          placeholder: isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary,
          onSurface: isDarkMode ? (!isInterestsFocused ? "#FFD700" : currentTheme.colors.textPrimary) : currentTheme.colors.textSecondary,
        },
        fonts: { regular: { fontFamily: "Comfortaa_400Regular" } },
      }}
      dense
      accessibilityLabel={t("accessibility.interestsField.label")}
      accessibilityHint={t("accessibility.interestsField.hint")}
      testID="input-interests"
    />
  </Animated.View>
</GlassCard>

            {/* Bouton Sauvegarder */}
            <Animated.View
              entering={ZoomIn.delay(600)}
              style={styles.saveButtonWrapper}
            >
              <TouchableOpacity
  onPress={handleSave}
  disabled={!hasChanges || isLoading}
  activeOpacity={0.7}
  accessibilityLabel={t("accessibility.saveProfileChanges.label")}
  accessibilityHint={t("accessibility.saveProfileChanges.hint")}
  accessibilityRole="button"
  testID="save-button"
>
  <LinearGradient
    colors={
      isDarkMode
        ? [currentTheme.colors.secondary, currentTheme.colors.primary]
        : ["#FF8C00", "#FFA500"]
    }
    style={[
      styles.saveButton,
      {
        borderWidth: isDarkMode ? 1 : 2,
        borderColor: isDarkMode ? currentTheme.colors.secondary : "#FFB800",
        opacity: !hasChanges || isLoading ? 0.6 : 1, // 👈 feedback visuel
      },
    ]}
  >
    {isLoading ? (
      <ActivityIndicator color={isDarkMode ? "#FFFFFF" : "#333333"} />
    ) : (
      <Text
        style={[
          styles.saveButtonText,
          { color: isDarkMode ? "#FFFFFF" : "#333333" },
        ]}
      >
        {t("save")}
      </Text>
    )}
  </LinearGradient>
</TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
        {showBanners && (
   <View style={styles.bannerContainer}>
     <BannerAd
       unitId={adUnitIds.banner}
       size={BannerAdSize.BANNER}
       requestOptions={{ requestNonPersonalizedAdsOnly: false }}
       onAdFailedToLoad={(err) =>
         console.error("Échec chargement bannière (UserInfo):", err)
       }
     />
   </View>
 )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
  flex: 1,
  paddingTop: 0,
},
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: V_SPACING,
    alignItems: "center",
    paddingBottom: n(40),
  },

  imageContainer: {
    marginBottom: V_SPACING * 1.2,
    borderRadius: n(60),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: n(4) },
    shadowOpacity: 0.28,
    shadowRadius: n(7),
    elevation: 8,
  },
  headerWrapper: {
    width: "100%",
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  imageGradient: {
    width: n(IS_COMPACT ? 120 : 136),
    aspectRatio: 1,
    borderRadius: n(IS_COMPACT ? 60 : 68),
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
  },
  profileImage: {
    width: n(IS_COMPACT ? 114 : 128),
    aspectRatio: 1,
    borderRadius: n(IS_COMPACT ? 57 : 64),
    resizeMode: "cover",
  },
  bannerContainer: {
   width: "100%",
   alignItems: "center",
   paddingVertical: SPACING / 2,
   backgroundColor: "transparent",
   position: "absolute",
   bottom: 0,
   left: 0,
   right: 0,
 },
  addImageText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    paddingHorizontal: SPACING * 1.5,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: V_SPACING, // tighter
    borderRadius: n(14),
    borderWidth: 1.5,
    overflow: "hidden",
  },

  input: {
    width: "100%",
    fontFamily: "Comfortaa_400Regular",
    paddingHorizontal: V_SPACING,
    paddingVertical: n(10),          // tighter field height
    backgroundColor: "transparent",
    borderRadius: n(14),
    minHeight: n(44),                // consistent height
  },
  formCard: {
  width: "100%",
  borderWidth: 1.5,
  borderRadius: normalizeSize(18),
  marginBottom: SPACING,
  overflow: "hidden",
},

glassWrap: {
  borderRadius: normalizeSize(18),
  overflow: "hidden",
  borderWidth: 1.5,
  // ✅ aucune ombre, aucun elevation
},

glassInner: {
  paddingVertical: SPACING,
  paddingHorizontal: SPACING,
},
  multilineInput: {
    minHeight: n(IS_COMPACT ? 76 : 88), // denser bio
    textAlignVertical: "top",
    paddingTop: n(10),
  },

  saveButtonWrapper: {
    width: "100%",
    marginTop: V_SPACING * 1.4,
    alignItems: "center",
  },

  saveButton: {
    paddingVertical: n(14),
    paddingHorizontal: n(26),
    borderRadius: n(26),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: n(4) },
    shadowOpacity: 0.28,
    shadowRadius: n(7),
    elevation: 9,
  },
  saveButtonText: {
    fontSize: n(18),
    fontFamily: "Comfortaa_700Bold",
  },

  // Background orbs keep as-is but adapt to compact
  bgOrbTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * (IS_COMPACT ? 0.28 : 0.25),
    left: -SCREEN_WIDTH * (IS_COMPACT ? 0.22 : 0.2),
    width: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
    height: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
    borderRadius: SCREEN_WIDTH * 0.45,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * (IS_COMPACT ? 0.32 : 0.3),
    right: -SCREEN_WIDTH * (IS_COMPACT ? 0.27 : 0.25),
    width: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
    height: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
    borderRadius: SCREEN_WIDTH * 0.55,
  },
});
