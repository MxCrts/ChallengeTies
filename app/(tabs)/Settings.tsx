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
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import { auth } from "../../constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/LanguageContext";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = width / 375;
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

  // Demande de permissions pour les notifications
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

  const adminUID = "mNVrF4ujGGSzSyUf6fhg82IPiai1";

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.background },
      ]} // Ajoute le style dynamique ici
    >
      <BackButton color={currentTheme.colors.primary} />
      <View style={styles.header}>
        <Text
          style={[
            styles.pageTitle,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("Paramètres")}
        </Text>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notifications */}
          <View
            style={[
              styles.settingItem,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
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
            />
          </View>

          {/* Mode Sombre */}
          <View
            style={[
              styles.settingItem,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Text
              style={[
                styles.settingLabel,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("Mode sombre")}
            </Text>
            <Switch value={isDarkMode} onValueChange={toggleTheme} />
          </View>

          {/* Langue */}
          <View
            style={[
              styles.settingItem,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
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
              dropdownIconColor={currentTheme.colors.primary}
            >
              <Picker.Item label="Français" value="fr" />
              <Picker.Item label="English" value="en" />
              <Picker.Item label="Español" value="es" />
              <Picker.Item label="Deutsch" value="de" />
              <Picker.Item label="中文" value="zh" />
            </Picker>
          </View>

          {/* Boutons Compte */}
          <Text
            style={[
              styles.sectionHeader,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("Compte")}
          </Text>

          {/* Modifier profil */}
          <TouchableOpacity
            style={[
              styles.accountButton,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
            onPress={() => router.push("/profile/UserInfo")}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.accountButtonText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("Modifier mon profil")}
            </Text>
          </TouchableOpacity>

          {/* Autres boutons (logout, suppression...) */}
          <TouchableOpacity
            style={[
              styles.accountButton,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color={currentTheme.colors.error}
            />
            <Text
              style={[
                styles.accountButtonText,
                { color: currentTheme.colors.error },
              ]}
            >
              {t("Se déconnecter")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.accountButton,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
            onPress={handleDeleteAccount}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={currentTheme.colors.error}
            />
            <Text
              style={[
                styles.accountButtonText,
                { color: currentTheme.colors.error },
              ]}
            >
              {t("Supprimer mon compte")}
            </Text>
          </TouchableOpacity>

          {/* Vider cache */}
          <TouchableOpacity
            style={[
              styles.accountButton,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
            onPress={clearCache}
          >
            <Ionicons name="trash-bin-outline" size={20} color="#ffa500" />
            <Text style={[styles.accountButtonText, { color: "#ffa500" }]}>
              {t("Vider le cache")}
            </Text>
          </TouchableOpacity>

          {/* Administration */}
          {auth.currentUser && auth.currentUser.uid === adminUID && (
            <TouchableOpacity
              style={[
                styles.adminButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => router.push("/AdminFeatures")}
            >
              <Text
                style={[
                  styles.adminButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("Administration")}
              </Text>
            </TouchableOpacity>
          )}

          {/* À Propos */}
          <Text
            style={[
              styles.sectionHeader,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("À Propos")}
          </Text>

          {/* Liens */}
          {["/about/History", "/about/PrivacyPolicy", "/about/Contact"].map(
            (path, index) => (
              <TouchableOpacity key={index} onPress={() => router.push(path)}>
                <Text
                  style={[
                    styles.aboutLink,
                    { color: currentTheme.colors.primary },
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
            )
          )}

          <TouchableOpacity
            onPress={() => Linking.openURL("https://example.com")}
          >
            <Text
              style={[styles.aboutLink, { color: currentTheme.colors.primary }]}
            >
              {t("Visitez Notre Site Web")}
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.appVersion,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("Version de l'application")}: 1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
    marginTop: 3,
  },
  pageTitle: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
  },
  sectionHeader: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
    color: "#333",
    fontFamily: "Comfortaa_700Bold",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 5,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  settingLabel: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Comfortaa_400Regular",
  },
  languagePicker: {
    width: 140,
    height: 40,
    color: "#333",
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 5,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  accountButtonText: {
    fontSize: 14,
    marginLeft: 10,
    color: "#333",
    fontFamily: "Comfortaa_400Regular",
  },
  adminButton: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  adminButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
  },
  aboutLink: {
    fontSize: 14,
    color: "#007bff",
    marginVertical: 5,
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  appVersion: {
    textAlign: "center",
    color: "#888",
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 20,
  },
});
