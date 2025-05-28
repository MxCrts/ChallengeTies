import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  ScrollView,
  Dimensions,
  StatusBar,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import { auth, db } from "../../constants/firebase-config";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout";
import i18n from "../../i18n";
import { fetchAndSaveUserLocation } from "../../services/locationService";

// Import de SPACING pour cohérence avec index.tsx et profile.tsx
const SPACING = 15;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function Settings() {
  const { t, i18n: i18next } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [_, setLangUpdate] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const isActiveRef = useRef(true); // Contrôle les callbacks

  const [isSubscribed, setIsSubscribed] = useState(true); // Contrôle l'abonnement
  const unsubscribeRef = useRef<(() => void) | null>(null); // Référence pour unsubscribe

  const {
    currentChallenges,
    setCurrentChallenges,
    simulatedToday,
    setSimulatedToday,
  } = useCurrentChallenges();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("permissionDenied"), t("mustAllowNotifications"));
        setNotificationsEnabled(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLangUpdate((prev) => !prev);
    };
    i18next.on("languageChanged", handleLanguageChanged);
    return () => {
      i18next.off("languageChanged", handleLanguageChanged);
    };
  }, [i18next]);

  useEffect(() => {
    console.log("Settings useEffect: Initialisation"); // Log
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("⚠️ Pas d’utilisateur, redirection vers /login"); // Log
      router.replace("/login");
      return;
    }

    console.log("Utilisateur connecté, ID:", userId); // Log
    const userRef = doc(db, "users", userId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!isActiveRef.current || !auth.currentUser) {
          console.log("onSnapshot ignoré: inactif ou déconnecté"); // Log
          return;
        }
        console.log(
          "onSnapshot Settings, données:",
          snapshot.exists() ? snapshot.data() : "null"
        ); // Log
        if (snapshot.exists()) {
          const data = snapshot.data();
          setNotificationsEnabled(data.notificationsEnabled ?? true);
          setLocationEnabled(data.locationEnabled ?? true);
          if (data.language && data.language !== language) {
            console.log("Changement de langue:", data.language); // Log
            setLanguage(data.language);
            i18next.changeLanguage(data.language);
          }
        }
      },
      (error) => {
        console.error("Erreur onSnapshot Settings:", error.message); // Log
        if (error.code === "permission-denied" && !auth.currentUser) {
          console.log("Permission refusée, utilisateur déconnecté"); // Log
        } else {
          Alert.alert(t("error"), t("unknownError"));
        }
      }
    );

    return () => {
      console.log("Désabonnement onSnapshot Settings"); // Log
      isActiveRef.current = false;
      unsubscribe();
    };
  }, [t, language, setLanguage, router]);

  const savePreferences = async (updates: { [key: string]: any }) => {
    const userId = auth.currentUser?.uid;
    if (userId) {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, updates);
      } catch (error) {
        console.error("failedToSavePreferences", error);
        Alert.alert(t("error"), t("failedToSavePreferences"));
      }
    }
  };

  const handleLocationToggle = async (value: boolean) => {
    setLocationEnabled(value);
    await savePreferences({ locationEnabled: value });
    if (value) {
      try {
        await fetchAndSaveUserLocation();
        Alert.alert(t("location.enabled"), t("location.updated"));
      } catch (error) {
        console.error("Erreur localisation:", error);
        Alert.alert(t("error"), t("location.error"));
        setLocationEnabled(false);
        await savePreferences({ locationEnabled: false });
      }
    } else {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await updateDoc(doc(db, "users", userId), {
          country: "Unknown",
          region: "Unknown",
        });
      }
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert(t("cacheCleared"), t("tempDataDeleted"));
    } catch (error) {
      Alert.alert(t("error"), t("failedToClearCache"));
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t("logout"),
      t("logoutConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("logout"),
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Début déconnexion"); // Log
              isActiveRef.current = false; // Bloquer les callbacks
              console.log("Callbacks onSnapshot désactivés"); // Log
              await auth.signOut();
              console.log("Déconnexion réussie"); // Log
              router.replace("/login");
              console.log("Redirection vers /login"); // Log
              Alert.alert(t("loggedOut"), t("disconnected"));
            } catch (error) {
              console.error("Erreur déconnexion:", error); // Log
              Alert.alert(t("error"), t("logoutFailed"));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(t("deleteAccount"), t("deleteAccountConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const user = auth.currentUser;
            if (user) {
              await user.delete();
              Alert.alert(t("accountDeleted"), t("accountDeletedSuccess"));
              router.replace("/login");
            } else {
              Alert.alert(t("error"), t("noUserConnected"));
            }
          } catch (error) {
            Alert.alert(t("error"), t("failedToDeleteAccount"));
          }
        },
      },
    ]);
  };

  const simulateDayPass = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert(t("error"), t("userNotConnected"));
      return;
    }
    if (currentChallenges.length === 0) {
      Alert.alert(t("Aucun défi"), t("Aucun défi en cours à simuler."));
      return;
    }
    try {
      const newSimulatedToday = simulatedToday
        ? new Date(simulatedToday)
        : new Date();
      newSimulatedToday.setDate(newSimulatedToday.getDate() + 1);
      setSimulatedToday(newSimulatedToday);
      await updateDoc(doc(db, "users", userId), {
        simulatedToday: newSimulatedToday.toISOString(),
      });
      Alert.alert(
        t("Simulation réussie"),
        t(
          `La date est maintenant simulée à ${newSimulatedToday.toDateString()}.`
        )
      );
    } catch (error) {
      console.error("❌ Erreur lors de la simulation d’un jour:", error);
      Alert.alert(t("Erreur"), t("Échec de la simulation."));
    }
  };

  const adminUID = "mAEyXdH3J5bcBt6SxZP7lWz0EW43";

  return (
    <GlobalLayout key={language}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("settings")} />
          <BackButton />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Préférences */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <Text
              style={[
                styles.sectionHeader,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("preferences")}
            </Text>
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={[
                styles.card,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              <View style={styles.settingItem}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("notifications")}
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    setNotificationsEnabled(value);
                    savePreferences({ notificationsEnabled: value });
                    if (!value)
                      Notifications.cancelAllScheduledNotificationsAsync();
                  }}
                  trackColor={{
                    false: currentTheme.colors.border,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    notificationsEnabled
                      ? currentTheme.colors.textPrimary
                      : "#d3d3d3"
                  }
                  style={styles.switch}
                  accessibilityLabel={t("handleNotifications")}
                />
              </View>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(250)}
              style={[
                styles.card,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              <View style={styles.settingItem}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("location")}
                </Text>
                <Switch
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  trackColor={{
                    false: currentTheme.colors.border,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    locationEnabled
                      ? currentTheme.colors.textPrimary
                      : "#d3d3d3"
                  }
                  style={styles.switch}
                  accessibilityLabel={t("handleLocation")}
                />
              </View>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(300)}
              style={[
                styles.card,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              <View style={styles.settingItem}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("darkMode")}
                </Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{
                    false: currentTheme.colors.border,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    isDarkMode ? currentTheme.colors.textPrimary : "#d3d3d3"
                  }
                  style={styles.switch}
                  accessibilityLabel={t("handleDarkMode")}
                />
              </View>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(400)}
              style={[
                styles.card,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              <View style={styles.settingItem}>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("language")}
                </Text>
                <Picker
                  selectedValue={language}
                  style={[
                    styles.languagePicker,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                  onValueChange={(itemValue) => {
                    setLanguage(itemValue);
                    i18next.changeLanguage(itemValue);
                    savePreferences({ language: itemValue });
                  }}
                  dropdownIconColor={
                    isDarkMode
                      ? currentTheme.colors.textPrimary
                      : currentTheme.colors.primary
                  }
                  accessibilityLabel={t("language")}
                >
                  <Picker.Item label="Français" value="fr" />
                  <Picker.Item label="English" value="en" />
                  <Picker.Item label="Español" value="es" />
                  <Picker.Item label="Deutsch" value="de" />
                  <Picker.Item label="中文" value="zh" />
                  <Picker.Item label="العربية" value="ar" />
                  <Picker.Item label="हिन्दी" value="hi" />
                </Picker>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Section Compte */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
            <Text
              style={[
                styles.sectionHeader,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("account")}
            </Text>
            <Animated.View entering={FadeInUp.delay(600)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={() => router.push("/profile/UserInfo")}
                accessibilityLabel={t("editProfile")}
                testID="edit-profile-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.primary,
                    currentTheme.colors.secondary,
                  ]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name="person-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("editProfile")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(700)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={clearCache}
                accessibilityLabel={t("clearCache")}
                testID="clear-cache-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.secondary,
                    currentTheme.colors.primary,
                  ]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name="trash-bin-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("clearCache")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(750)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={simulateDayPass}
                accessibilityLabel={t("Simuler un jour")}
                testID="simulate-day-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.secondary,
                    currentTheme.colors.primary,
                  ]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("Simuler un jour")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(800)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={handleLogout}
                accessibilityLabel={t("logout")}
                testID="logout-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.primary,
                    currentTheme.colors.secondary,
                  ]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("logout")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(900)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={handleDeleteAccount}
                accessibilityLabel={t("deleteAccount")}
                testID="delete-account-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.error,
                    currentTheme.colors.error,
                  ]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("deleteAccount")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            {auth.currentUser && auth.currentUser.uid === adminUID && (
              <Animated.View entering={FadeInUp.delay(1000)}>
                <TouchableOpacity
                  style={styles.adminButton}
                  onPress={() => router.push("/AdminFeatures")}
                  accessibilityLabel={t("accessAdmin")}
                  testID="admin-button"
                >
                  <LinearGradient
                    colors={[
                      currentTheme.colors.primary,
                      currentTheme.colors.secondary,
                    ]}
                    style={styles.adminButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text
                      style={[
                        styles.adminButtonText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {t("admin")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>

          {/* Section À Propos */}
          <Animated.View entering={FadeInUp.delay(1100)} style={styles.section}>
            <Text
              style={[
                styles.sectionHeader,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("about")}
            </Text>
            {["/about/History", "/about/PrivacyPolicy", "/about/Contact"].map(
              (path, index) => (
                <Animated.View
                  entering={FadeInUp.delay(1200 + index * 100)}
                  key={index}
                >
                  <TouchableOpacity
                    onPress={() => router.push(path)}
                    accessibilityLabel={t(
                      ["aboutChallengeTies", "privacyPolicyPage", "contactUs"][
                        index
                      ]
                    )}
                    testID={`about-link-${index}`}
                  >
                    <Text
                      style={[
                        styles.aboutLink,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {t(
                        [
                          "aboutChallengeTies",
                          "privacyPolicyPage",
                          "contactUs",
                        ][index]
                      )}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            )}
            <Animated.View entering={FadeInUp.delay(1500)}>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://example.com")}
                accessibilityLabel={t("visitWebsite")}
                testID="website-link"
              >
                <Text
                  style={[
                    styles.aboutLink,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("visitWebsite")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(1600)}>
              <Text
                style={[
                  styles.appVersion,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("appVersion")} 1.0.0
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  headerWrapper: {
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  section: {
    marginBottom: SPACING * 2,
  },
  sectionHeader: {
    fontSize: normalizeFont(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    borderRadius: normalizeSize(20),
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  settingLabel: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  switch: {
    transform: [{ scale: SCREEN_WIDTH < 400 ? 0.9 : 1 }],
  },
  languagePicker: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_HEIGHT * 0.06,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeFont(14),
  },
  accountButton: {
    borderRadius: normalizeSize(15),
    marginBottom: SPACING,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  accountButtonText: {
    fontSize: normalizeFont(16),
    marginLeft: SPACING,
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  adminButton: {
    borderRadius: normalizeSize(15),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  adminButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 1.5,
    alignItems: "center",
  },
  adminButtonText: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  aboutLink: {
    fontSize: normalizeFont(16),
    marginVertical: SPACING / 2,
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  appVersion: {
    textAlign: "center",
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
});
