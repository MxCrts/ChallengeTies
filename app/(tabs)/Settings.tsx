import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
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

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("fr");
  const isDarkMode = theme === "dark";

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      Alert.alert(
        "Notifications désactivées",
        "Vous ne recevrez plus de notifications."
      );
    } else {
      Alert.alert("Notifications activées", "Vérifiez vos autorisations.");
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert(
        "Cache vidé",
        "Toutes les données temporaires ont été supprimées."
      );
    } catch (error) {
      Alert.alert("Erreur", "Échec du vidage du cache.");
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
              Alert.alert("Déconnecté", "Vous avez été déconnecté.");
              router.replace("/login");
            } catch (error) {
              Alert.alert("Erreur", "Échec de la déconnexion.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Suppression du compte",
      "Êtes-vous sûr ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (user) {
                await user.delete();
                Alert.alert(
                  "Compte supprimé",
                  "Votre compte a été supprimé avec succès."
                );
                router.replace("/login");
              } else {
                Alert.alert("Erreur", "Aucun utilisateur connecté.");
              }
            } catch (error) {
              Alert.alert("Erreur", "Échec de la suppression du compte.");
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1E293B", "#0F172A"] : ["#E3F2FD", "#FFFFFF"]}
      style={styles.container}
    >
      <Animated.View
        entering={FadeInUp.duration(800)}
        style={styles.headerContainer}
      >
        <Text style={styles.header}>Paramètres ⚙️</Text>
      </Animated.View>

      {/* 🔔 Notifications & Thème */}
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
        />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Mode sombre</Text>
        <Switch value={theme === "dark"} onValueChange={toggleTheme} />
      </View>

      {/* 🌍 Sélection de la Langue */}
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Langue</Text>
        <Picker
          selectedValue={selectedLanguage}
          style={styles.languagePicker}
          onValueChange={(itemValue) => setSelectedLanguage(itemValue)}
        >
          <Picker.Item label="Français" value="fr" />
          <Picker.Item label="English" value="en" />
          <Picker.Item label="Español" value="es" />
        </Picker>
      </View>

      {/* 👤 Compte */}
      <Text style={styles.sectionHeader}>Compte</Text>
      <TouchableOpacity
        style={styles.accountButton}
        onPress={() => router.push("/profile/UserInfo")}
      >
        <Ionicons name="person-outline" size={20} color="#007bff" />
        <Text style={styles.accountButtonText}>Modifier mon profil</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.accountButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#dc3545" />
        <Text style={[styles.accountButtonText, { color: "#dc3545" }]}>
          Se déconnecter
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.accountButton}
        onPress={handleDeleteAccount}
      >
        <Ionicons name="trash-outline" size={20} color="#dc3545" />
        <Text style={[styles.accountButtonText, { color: "#dc3545" }]}>
          Supprimer mon compte
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.accountButton} onPress={clearCache}>
        <Ionicons name="trash-bin-outline" size={20} color="#ffa500" />
        <Text style={[styles.accountButtonText, { color: "#ffa500" }]}>
          Vider le cache
        </Text>
      </TouchableOpacity>

      {/* 📜 À Propos */}
      <Text style={styles.sectionHeader}>À Propos</Text>
      <TouchableOpacity onPress={() => router.push("/about/History")}>
        <Text style={styles.aboutLink}>À propos de ChallengeTies</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/about/PrivacyPolicy")}>
        <Text style={styles.aboutLink}>Politique de confidentialité</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/about/Contact")}>
        <Text style={styles.aboutLink}>Nous contacter</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL("https://example.com")}>
        <Text style={styles.aboutLink}>Visitez Notre Site Web</Text>
      </TouchableOpacity>

      <Text style={styles.appVersion}>Version de l'application: 1.0.0</Text>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerContainer: { alignItems: "center", marginBottom: 20 },
  header: { fontSize: 28, fontWeight: "bold", color: "#007bff" },
  sectionHeader: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
    color: "#333",
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
  settingLabel: { fontSize: 16, color: "#333" },
  languagePicker: { width: 140, height: 40, color: "#333" },
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
  accountButtonText: { fontSize: 14, marginLeft: 10, color: "#333" },
  aboutLink: {
    fontSize: 14,
    color: "#007bff",
    marginVertical: 5,
    textAlign: "center",
  },
  appVersion: {
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },
});
