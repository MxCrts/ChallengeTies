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
import { useAuthInit } from "../../context/useAuthInit";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // Language selection

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      Alert.alert(
        "Notifications Disabled",
        "You will no longer receive notifications."
      );
    } else {
      Alert.alert(
        "Notifications Enabled",
        "Notifications are now active. Ensure permissions are granted."
      );
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert("Cache Cleared", "All cached data has been cleared.");
    } catch (error) {
      Alert.alert("Error", "Failed to clear cache. Please try again.");
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
              Alert.alert("Logged Out", "You have been logged out.");
              router.replace("/login");
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (user) {
                await user.delete();
                Alert.alert(
                  "Account Deleted",
                  "Your account has been successfully deleted."
                );
                router.replace("/login");
              } else {
                Alert.alert("Error", "No user is logged in.");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete account. Try again.");
              console.error("Error deleting account:", error);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.container,
        theme === "dark" ? styles.darkContainer : styles.lightContainer,
      ]}
    >
      <Text
        style={[
          styles.header,
          theme === "dark" ? styles.darkText : styles.lightText,
        ]}
      >
        Settings
      </Text>

      {/* Notifications Toggle */}
      <View style={styles.settingItem}>
        <Text
          style={[
            styles.settingLabel,
            theme === "dark" ? styles.darkText : styles.lightText,
          ]}
        >
          Enable Notifications
        </Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
        />
      </View>

      {/* Dark Mode */}
      <View style={styles.settingItem}>
        <Text
          style={[
            styles.settingLabel,
            theme === "dark" ? styles.darkText : styles.lightText,
          ]}
        >
          Dark Mode
        </Text>
        <Switch value={theme === "dark"} onValueChange={toggleTheme} />
      </View>

      {/* Language Selection */}
      <View style={styles.settingItem}>
        <Text
          style={[
            styles.settingLabel,
            theme === "dark" ? styles.darkText : styles.lightText,
          ]}
        >
          Language
        </Text>
        <Picker
          selectedValue={selectedLanguage}
          style={styles.languagePicker}
          onValueChange={(itemValue) => setSelectedLanguage(itemValue)}
        >
          <Picker.Item label="English" value="en" />
          <Picker.Item label="Français" value="fr" />
          <Picker.Item label="Español" value="es" />
        </Picker>
      </View>

      {/* Account Section */}
      <Text
        style={[
          styles.sectionHeader,
          theme === "dark" ? styles.darkText : styles.lightText,
        ]}
      >
        Account
      </Text>
      <TouchableOpacity
        style={styles.accountButton}
        onPress={() => router.push("/profile/UserInfo")}
      >
        <Ionicons name="person-outline" size={20} color="#007bff" />
        <Text style={styles.accountButtonText}>Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.accountButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#dc3545" />
        <Text style={[styles.accountButtonText, { color: "#dc3545" }]}>
          Log Out
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.accountButton}
        onPress={handleDeleteAccount}
      >
        <Ionicons name="trash-outline" size={20} color="#dc3545" />
        <Text style={[styles.accountButtonText, { color: "#dc3545" }]}>
          Delete Account
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.accountButton} onPress={clearCache}>
        <Ionicons name="trash-bin-outline" size={20} color="#ffa500" />
        <Text style={[styles.accountButtonText, { color: "#ffa500" }]}>
          Clear Cache
        </Text>
      </TouchableOpacity>

      {/* About Section */}
      <Text
        style={[
          styles.sectionHeader,
          theme === "dark" ? styles.darkText : styles.lightText,
        ]}
      >
        About
      </Text>
      <TouchableOpacity onPress={() => router.push("/about/History")}>
        <Text style={styles.aboutLink}>About ChallengeTies</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/about/PrivacyPolicy")}>
        <Text style={styles.aboutLink}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/about/Contact")}>
        <Text style={styles.aboutLink}>Contact Us</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL("https://example.com")}>
        <Text style={styles.aboutLink}>Visit Our Website</Text>
      </TouchableOpacity>

      {/* App Info */}
      <Text style={styles.appVersion}>App Version: 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  sectionHeader: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
    color: "#007bff",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  settingLabel: { fontSize: 16 },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  languagePicker: {
    width: 150,
    height: 50,
    color: "#007bff",
  },
  appVersion: {
    textAlign: "center",
    color: "#666",
    marginTop: 20,
    fontSize: 12,
  },
  accountButtonText: { fontSize: 16, color: "#007bff", marginLeft: 10 },
  aboutLink: { fontSize: 14, color: "#007bff", marginVertical: 5 },
  lightContainer: { backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#121212" },
  lightText: { color: "#000" },
  darkText: { color: "#fff" },
});
