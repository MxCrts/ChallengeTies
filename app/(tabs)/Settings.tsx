import React, { useState, useEffect } from "react";
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
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import { auth, db } from "../../constants/firebase-config";
import { doc, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout"; // Ajout de GlobalLayout

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
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("Permission refusée"),
          t("Vous devez autoriser les notifications pour recevoir des alertes.")
        );
        setNotificationsEnabled(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    console.log("🔍 Settings rendu avec thème :", theme);
  }, [theme]);

  const clearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert(
        t("Cache vidé"),
        t("Toutes les données temporaires ont été supprimées.")
      );
    } catch (error) {
      Alert.alert(t("Erreur"), t("Échec du vidage du cache."));
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t("Déconnexion"),
      t("Êtes-vous sûr de vouloir vous déconnecter ?"),
      [
        { text: t("Annuler"), style: "cancel" },
        {
          text: t("Déconnexion"),
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
              Alert.alert(t("Déconnecté"), t("Vous avez été déconnecté."));
              router.replace("/login");
            } catch (error) {
              Alert.alert(t("Erreur"), t("Échec de la déconnexion."));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("Suppression du compte"),
      t("Êtes-vous sûr ? Cette action est irréversible."),
      [
        { text: t("Annuler"), style: "cancel" },
        {
          text: t("Supprimer"),
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (user) {
                await user.delete();
                Alert.alert(
                  t("Compte supprimé"),
                  t("Votre compte a été supprimé avec succès.")
                );
                router.replace("/login");
              } else {
                Alert.alert(t("Erreur"), t("Aucun utilisateur connecté."));
              }
            } catch (error) {
              Alert.alert(t("Erreur"), t("Échec de la suppression du compte."));
            }
          },
        },
      ]
    );
  };

  const simulateDayPass = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert(t("Erreur"), t("Utilisateur non connecté."));
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
      Alert.alert(
        t("Simulation réussie"),
        t(
          `La date est maintenant simulée à ${newSimulatedToday.toDateString()}.`
        )
      );
      console.log("⏳ Nouveau jour simulé:", newSimulatedToday);
    } catch (error) {
      console.error("❌ Erreur lors de la simulation d’un jour:", error);
      Alert.alert(t("Erreur"), t("Échec de la simulation."));
    }
  };

  const {
    currentChallenges,
    setCurrentChallenges,
    simulatedToday,
    setSimulatedToday,
  } = useCurrentChallenges();
  const adminUID = "mAEyXdH3J5bcBt6SxZP7lWz0EW43";

  return (
    <GlobalLayout>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          isDarkMode ? currentTheme.colors.cardBackground : "#f5f5f5",
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("Paramètres")} />
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
              {t("Préférences")}
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
                  {t("Notifications")}
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    setNotificationsEnabled(value);
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
                  {t("Mode sombre")}
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
                  {t("Langue")}
                </Text>
                <Picker
                  selectedValue={language}
                  style={[
                    styles.languagePicker,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                  onValueChange={(itemValue) => setLanguage(itemValue)}
                  dropdownIconColor={
                    isDarkMode
                      ? currentTheme.colors.textPrimary
                      : currentTheme.colors.primary
                  }
                >
                  <Picker.Item label="Français" value="fr" />
                  <Picker.Item label="English" value="en" />
                  <Picker.Item label="Español" value="es" />
                  <Picker.Item label="Deutsch" value="de" />
                  <Picker.Item label="中文" value="zh" />
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
              {t("Compte")}
            </Text>
            <Animated.View entering={FadeInUp.delay(600)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={() => router.push("/profile/UserInfo")}
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
                    {t("Modifier mon profil")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(700)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={clearCache}
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
                    {t("Vider le cache")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(750)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={simulateDayPass}
              >
                <LinearGradient
                  colors={["#4CAF50", "#388E3C"]}
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
                    {t("Se déconnecter")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(900)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={handleDeleteAccount}
              >
                <LinearGradient
                  colors={[currentTheme.colors.error, "#b02a37"]}
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
                    {t("Supprimer mon compte")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            {auth.currentUser && auth.currentUser.uid === adminUID && (
              <Animated.View entering={FadeInUp.delay(1000)}>
                <TouchableOpacity
                  style={styles.adminButton}
                  onPress={() => router.push("/AdminFeatures")}
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
                      {t("Administration")}
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
              {t("À Propos")}
            </Text>
            {["/about/History", "/about/PrivacyPolicy", "/about/Contact"].map(
              (path, index) => (
                <Animated.View
                  entering={FadeInUp.delay(1200 + index * 100)}
                  key={index}
                >
                  <TouchableOpacity onPress={() => router.push(path)}>
                    <Text
                      style={[
                        styles.aboutLink,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {t(
                        [
                          "À propos de ChallengeTies",
                          "Politique de confidentialité",
                          "Nous contacter",
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
              >
                <Text
                  style={[
                    styles.aboutLink,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("Visitez Notre Site Web")}
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
                {t("Version de l'application")}: 1.0.0
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
    marginTop: SCREEN_HEIGHT * 0.03,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scrollContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  section: {
    marginBottom: SCREEN_HEIGHT * 0.04,
  },
  sectionHeader: {
    fontSize: normalizeFont(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SCREEN_HEIGHT * 0.02,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    borderRadius: normalizeSize(20),
    marginBottom: SCREEN_HEIGHT * 0.02,
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
    paddingVertical: SCREEN_WIDTH * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
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
    marginBottom: SCREEN_HEIGHT * 0.02,
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
    paddingVertical: SCREEN_WIDTH * 0.035,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  accountButtonText: {
    fontSize: normalizeFont(16),
    marginLeft: SCREEN_WIDTH * 0.03,
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  adminButton: {
    borderRadius: normalizeSize(15),
    overflow: "hidden",
    marginTop: SCREEN_HEIGHT * 0.02,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  adminButtonGradient: {
    paddingVertical: SCREEN_WIDTH * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
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
    marginVertical: SCREEN_HEIGHT * 0.015,
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
    marginTop: SCREEN_HEIGHT * 0.03,
  },
});
