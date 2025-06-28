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

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface User {
  uid: string;
  displayName?: string;
  bio?: string;
  profileImage?: string | null;
  location?: string;
  interests?: string;
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

  // États de focus pour chaque champ
  const [isDisplayNameFocused, setIsDisplayNameFocused] = useState(false);
  const [isBioFocused, setIsBioFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isInterestsFocused, setIsInterestsFocused] = useState(false);

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
          setInterests(userData.interests || "");
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
    if (!displayName.trim()) {
      Alert.alert(t("error"), t("displayNameRequired"));
      return;
    }
    setIsLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        profileImage,
        location: location.trim(),
        interests: interests.trim(),
      });
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
      title: t("editProfile.title"),
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
        colors={
          isDarkMode
            ? [
                currentTheme.colors.background,
                currentTheme.colors.cardBackground,
              ]
            : ["#FFFFFF", "#FFE4B5"]
        }
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.contentContainer, { flexGrow: 1 }]}
            showsVerticalScrollIndicator={false}
            contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
          >
            <View style={styles.headerWrapper}>
              <Animated.View entering={FadeInUp}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                  accessibilityLabel={t("accessibility.backButton.label")}
                  accessibilityHint={t("accessibility.backButton.hint")}
                  testID="back-button"
                >
                  <Ionicons
                    name="arrow-back"
                    size={normalizeSize(24)}
                    color={currentTheme.colors.secondary}
                  />
                </TouchableOpacity>
              </Animated.View>
              <CustomHeader title={t("yourProfile")} />
            </View>

            {/* Image de profil */}
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

            {/* Champs de saisie */}
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.3)"
                    : "rgba(255, 255, 255, 0.2)",
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
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
                textColor={
                  isDarkMode ? currentTheme.colors.textPrimary : "#000000"
                }
                underlineColor="transparent"
                activeUnderlineColor={currentTheme.colors.secondary}
                placeholderTextColor={
                  isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary
                }
                theme={{
                  colors: {
                    background: "transparent",
                    text: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                    primary: isDarkMode
                      ? "#FFEC8B"
                      : currentTheme.colors.secondary,
                    placeholder: isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary,
                    onSurface: isDarkMode
                      ? !isDisplayNameFocused
                        ? "#FFD700"
                        : currentTheme.colors.textPrimary
                      : currentTheme.colors.textSecondary,
                  },
                  fonts: {
                    regular: { fontFamily: "Comfortaa_400Regular" },
                  },
                }}
                dense={true}
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
                  backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.3)"
                    : "rgba(255, 255, 255, 0.2)",
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
                },
              ]}
            >
              <TextInput
                label={t("bio")}
                mode="flat"
                style={[
                  styles.input,
                  styles.multilineInput,
                  { fontSize: normalizeSize(14) },
                ]}
                value={bio}
                onChangeText={setBio}
                onFocus={() => setIsBioFocused(true)}
                onBlur={() => setIsBioFocused(false)}
                multiline
                textColor={
                  isDarkMode ? currentTheme.colors.textPrimary : "#000000"
                }
                underlineColor="transparent"
                activeUnderlineColor={currentTheme.colors.secondary}
                placeholderTextColor={
                  isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary
                }
                theme={{
                  colors: {
                    background: "transparent",
                    text: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                    primary: isDarkMode
                      ? "#FFEC8B"
                      : currentTheme.colors.secondary,
                    placeholder: isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary,
                    onSurface: isDarkMode
                      ? !isBioFocused
                        ? "#FFD700"
                        : currentTheme.colors.textPrimary
                      : currentTheme.colors.textSecondary,
                  },
                  fonts: {
                    regular: { fontFamily: "Comfortaa_400Regular" },
                  },
                }}
                dense={true}
                accessibilityLabel={t("accessibility.bioField.label")}
                accessibilityHint={t("accessibility.bioField.hint")}
                testID="input-bio"
              />
            </Animated.View>

            {/* Location */}
            <Animated.View
              entering={FadeInUp.delay(400)}
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.3)"
                    : "rgba(255, 255, 255, 0.2)",
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
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
                textColor={
                  isDarkMode ? currentTheme.colors.textPrimary : "#000000"
                }
                underlineColor="transparent"
                activeUnderlineColor={currentTheme.colors.secondary}
                placeholderTextColor={
                  isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary
                }
                theme={{
                  colors: {
                    background: "transparent",
                    text: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                    primary: isDarkMode
                      ? "#FFEC8B"
                      : currentTheme.colors.secondary,
                    placeholder: isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary,
                    onSurface: isDarkMode
                      ? !isLocationFocused
                        ? "#FFD700"
                        : currentTheme.colors.textPrimary
                      : currentTheme.colors.textSecondary,
                  },
                  fonts: {
                    regular: { fontFamily: "Comfortaa_400Regular" },
                  },
                }}
                dense={true}
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
                  backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.3)"
                    : "rgba(255, 255, 255, 0.2)",
                  borderColor: isDarkMode
                    ? currentTheme.colors.secondary
                    : "#FFB800",
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
                textColor={
                  isDarkMode ? currentTheme.colors.textPrimary : "#000000"
                }
                underlineColor="transparent"
                activeUnderlineColor={currentTheme.colors.secondary}
                placeholderTextColor={
                  isDarkMode ? "#FFD700" : currentTheme.colors.textSecondary
                }
                theme={{
                  colors: {
                    background: "transparent",
                    text: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                    primary: isDarkMode
                      ? "#FFEC8B"
                      : currentTheme.colors.secondary,
                    placeholder: isDarkMode
                      ? "#FFD700"
                      : currentTheme.colors.textSecondary,
                    onSurface: isDarkMode
                      ? !isInterestsFocused
                        ? "#FFD700"
                        : currentTheme.colors.textPrimary
                      : currentTheme.colors.textSecondary,
                  },
                  fonts: {
                    regular: { fontFamily: "Comfortaa_400Regular" },
                  },
                }}
                dense={true}
                accessibilityLabel={t("accessibility.interestsField.label")}
                accessibilityHint={t("accessibility.interestsField.hint")}
                testID="input-interests"
              />
            </Animated.View>

            {/* Bouton Sauvegarder */}
            <Animated.View
              entering={ZoomIn.delay(600)}
              style={styles.saveButtonWrapper}
            >
              <TouchableOpacity
                onPress={handleSave}
                accessibilityLabel={t("accessibility.saveProfileChanges.label")}
                accessibilityHint={t("accessibility.saveProfileChanges.hint")}
                accessibilityRole="button"
                testID="save-button"
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={
                    isDarkMode
                      ? [
                          currentTheme.colors.secondary,
                          currentTheme.colors.primary,
                        ]
                      : ["#FF8C00", "#FFA500"]
                  }
                  style={[
                    styles.saveButton,
                    {
                      borderWidth: isDarkMode ? 1 : 2,
                      borderColor: isDarkMode
                        ? currentTheme.colors.secondary
                        : "#FFB800",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      { color: isDarkMode ? "#FFFFFF" : "#333333" },
                    ]}
                  >
                    {t("save")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING,
    alignItems: "center",
    paddingBottom: normalizeSize(60),
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
  imageContainer: {
    marginBottom: SPACING * 2,
    borderRadius: normalizeSize(70),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  imageGradient: {
    width: normalizeSize(140),
    aspectRatio: 1,
    borderRadius: normalizeSize(70),
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
  },
  profileImage: {
    width: normalizeSize(132),
    aspectRatio: 1,
    borderRadius: normalizeSize(66),
    resizeMode: "cover",
  },
  addImageText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    paddingHorizontal: SPACING * 1.5,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(18),
    borderWidth: 2,
    overflow: "hidden",
  },
  input: {
    width: "100%",
    fontFamily: "Comfortaa_400Regular",
    paddingHorizontal: SPACING * 1.2,
    paddingVertical: normalizeSize(12),
    backgroundColor: "transparent",
    borderRadius: normalizeSize(18),
  },
  multilineInput: {
    minHeight: normalizeSize(100),
    textAlignVertical: "top",
    paddingTop: normalizeSize(12),
  },
  saveButtonWrapper: {
    width: "100%",
    marginTop: SPACING * 2.5,
    alignItems: "center",
  },
  saveButton: {
    paddingVertical: normalizeSize(16),
    paddingHorizontal: normalizeSize(35),
    borderRadius: normalizeSize(30),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  saveButtonText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
  },
});
