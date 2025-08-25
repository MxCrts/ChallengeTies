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
import designSystem, { Theme } from "../../theme/designSystem";

import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout";
import i18n from "../../i18n";
import { fetchAndSaveUserLocation } from "../../services/locationService";
import { Link } from "expo-router"; 
import { useFocusEffect } from "@react-navigation/native";


const SPACING = 18; // Aligné avec ExploreScreen.tsx, Notifications.tsx, etc.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle
  return Math.round(size * scale);
};

// rgba helper (hex/rgb -> rgba avec alpha)
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r="0", g="0", b="0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};


const SHOW_PREMIUM = false as const;

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  gradientContainer: {
    backgroundColor: currentTheme.colors.background,
  },
  sectionHeader: {
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
  },
  card: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderColor: isDarkMode ? currentTheme.colors.border : "#FF8C00",
  },
  settingLabel: {
    color: currentTheme.colors.textSecondary,
  },
  switch: {
    trackColor: {
      false: currentTheme.colors.border,
      true: isDarkMode
        ? currentTheme.colors.secondary
        : currentTheme.colors.primary,
    },
    thumbColor: isDarkMode ? currentTheme.colors.textPrimary : "#fff",
  },
  languagePicker: {
    color: currentTheme.colors.textSecondary,
    dropdownIconColor: isDarkMode
      ? currentTheme.colors.textPrimary
      : currentTheme.colors.primary,
  },
  buttonGradient: {
    colors: [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ] as const,
  },
  accountButtonText: {
    color: currentTheme.colors.textPrimary,
  },
  adminButtonGradient: {
    colors: [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ] as const,
  },
  adminButtonText: {
    color: currentTheme.colors.textPrimary,
  },
  deleteButtonGradient: {
    colors: [currentTheme.colors.error, currentTheme.colors.error] as const,
  },
  aboutLink: {
    color: currentTheme.colors.secondary,
  },
  appVersion: {
    color: currentTheme.colors.textSecondary,
  },
});

export default function Settings() {
  const { t, i18n: i18next } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [_, setLangUpdate] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const isActiveRef = useRef(true);

  const [isSubscribed, setIsSubscribed] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
const scrollRef = useRef<ScrollView>(null);
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

 useFocusEffect(
    React.useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      router.replace("/login");
      return;
    }

    const userRef = doc(db, "users", userId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!isActiveRef.current || !auth.currentUser) {
          return;
        }

        if (snapshot.exists()) {
          const data = snapshot.data();
          setNotificationsEnabled(data.notificationsEnabled ?? true);
          setLocationEnabled(data.locationEnabled ?? true);
          if (data.language && data.language !== language) {
            setLanguage(data.language);
            i18next.changeLanguage(data.language);
          }
        }
      },
      (error) => {
        console.error("Erreur onSnapshot Settings:", error.message);
        if (error.code === "permission-denied" && !auth.currentUser) {
        } else {
          Alert.alert(t("error"), t("unknownError"));
        }
      }
    );

    return () => {
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

  const [saving, setSaving] = useState<{notif?: boolean; loc?: boolean}>({});

const handleNotificationsToggle = async (value: boolean) => {
  if (saving.notif) return;
  setSaving((s) => ({ ...s, notif: true }));
  const prev = notificationsEnabled;
  setNotificationsEnabled(value);

  try {
    if (value) {
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (finalStatus !== "granted") {
        const req = await Notifications.requestPermissionsAsync();
        finalStatus = req.status;
      }
      if (finalStatus !== "granted") {
        setNotificationsEnabled(false);
        Alert.alert(
          t("permissionDenied"),
          t("mustAllowNotifications"),
          [
            { text: t("cancel"), style: "cancel" },
            { text: t("openSettings"), onPress: () => Linking.openSettings?.() },
          ],
          { cancelable: true }
        );
        await savePreferences({ notificationsEnabled: false });
        return;
      }
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    await savePreferences({ notificationsEnabled: value });
  } catch (e) {
    console.error(e);
    setNotificationsEnabled(prev);
    Alert.alert(t("error"), t("failedToSavePreferences"));
  } finally {
    setSaving((s) => ({ ...s, notif: false }));
  }
};

const handleLocationToggle = async (value: boolean) => {
  if (saving.loc) return;
  setSaving((s) => ({ ...s, loc: true }));
  const prev = locationEnabled;
  setLocationEnabled(value);
  try {
    await savePreferences({ locationEnabled: value });
    if (value) {
      try {
        await fetchAndSaveUserLocation();
        Alert.alert(t("settingsPage.enabled"), t("settingsPage.updated"));
      } catch (err) {
        console.error("Erreur localisation:", err);
        setLocationEnabled(false);
        await savePreferences({ locationEnabled: false });
        Alert.alert(
          t("error"),
          t("settingsPage.error"),
          [
            { text: t("cancel"), style: "cancel" },
            { text: t("openSettings"), onPress: () => Linking.openSettings?.() },
          ],
          { cancelable: true }
        );
      }
    } else {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await updateDoc(doc(db, "users", userId), { country: "Unknown", region: "Unknown" });
      }
    }
  } catch (e) {
    console.error(e);
    setLocationEnabled(prev);
    Alert.alert(t("error"), t("failedToSavePreferences"));
  } finally {
    setSaving((s) => ({ ...s, loc: false }));
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
              isActiveRef.current = false;
              await auth.signOut();
              router.replace("/login");
              Alert.alert(t("loggedOut"), t("disconnected"));
            } catch (error) {
              console.error("Erreur déconnexion:", error);
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

  const adminUID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2";

  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);

  return (
    <GlobalLayout key={language}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <CustomHeader title={t("settings")} />
      <LinearGradient
  colors={[
    withAlpha(currentTheme.colors.background, 1),
    withAlpha(currentTheme.colors.cardBackground, 1),
    withAlpha(currentTheme.colors.primary, 0.12),
  ]}
  style={[styles.gradientContainer, dynamicStyles.gradientContainer]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
  <LinearGradient
  pointerEvents="none"
  colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
  style={styles.bgOrbTop}
/>
<LinearGradient
  pointerEvents="none"
  colors={[withAlpha(currentTheme.colors.secondary, 0.25), "transparent"]}
  style={styles.bgOrbBottom}
/>
        <ScrollView
        ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Préférences */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
              {t("preferences")}
            </Text>
            <LinearGradient
    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.sectionAccent}
  />
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={[styles.card, dynamicStyles.card]}
            >
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>
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
                  trackColor={dynamicStyles.switch.trackColor}
                  thumbColor={dynamicStyles.switch.thumbColor}
                  style={styles.switch}
                  accessibilityLabel={t("handleNotifications")}
                />
              </View>
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(250)}
              style={[styles.card, dynamicStyles.card]}
            >
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>
                  {t("location")}
                </Text>
                <Switch
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  trackColor={dynamicStyles.switch.trackColor}
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
              style={[styles.card, dynamicStyles.card]}
            >
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>
                  {t("darkMode")}
                </Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={dynamicStyles.switch.trackColor}
                  thumbColor={dynamicStyles.switch.thumbColor}
                  style={styles.switch}
                  accessibilityLabel={t("handleDarkMode")}
                />
              </View>
            </Animated.View>
            <Animated.View
  entering={FadeInUp.delay(300)}
  style={[styles.card, dynamicStyles.card]}
>
  <View style={styles.settingItem}>
    <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>
      {t("language")}
    </Text>
    {/* NOUVEAU wrapper pour donner du flex au Picker */}
   <View style={styles.pickerContainer}>
  <Picker
    selectedValue={language}
    mode="dropdown"
    dropdownIconColor={isDarkMode ? currentTheme.colors.textPrimary : currentTheme.colors.primary}
    prompt={t("chooseLanguage")}
    style={[styles.languagePicker, dynamicStyles.languagePicker]}
    itemStyle={{
      fontSize: normalizeSize(18),
      height: normalizeSize(60),
      textAlignVertical: "center",
      lineHeight: normalizeSize(24),
    }}
    onValueChange={(itemValue) => {
      setLanguage(itemValue);
      i18next.changeLanguage(itemValue);
      savePreferences({ language: itemValue });
    }}
    accessibilityLabel={t("language")}
  >
    <Picker.Item label="العربية" value="ar" />
    <Picker.Item label="Deutsch" value="de" />
    <Picker.Item label="English" value="en" />
    <Picker.Item label="Español" value="es" />
    <Picker.Item label="Français" value="fr" />
    <Picker.Item label="हिन्दी" value="hi" />
    <Picker.Item label="Italiano" value="it" />
    <Picker.Item label="Русский" value="ru" />
    <Picker.Item label="中文" value="zh" />
  </Picker>
</View>

  </View>
</Animated.View>

          </Animated.View>

          {/* === Section Premium === */}
{SHOW_PREMIUM && (
  <Animated.View entering={FadeInUp.delay(420)} style={styles.section}>
    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
      {t("premium.title", { defaultValue: "Premium" })}
    </Text>

    <LinearGradient
      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.sectionAccent}
    />

    <View style={[styles.premiumCard, dynamicStyles.card]}>
      <View style={styles.premiumHeaderRow}>
        <View style={styles.premiumTitleRow}>
          <Ionicons
            name="trophy-outline"
            size={normalizeSize(22)}
            color={currentTheme.colors.secondary}
          />
          <Text style={[styles.premiumTitle]}>
            {t("premium.header", { defaultValue: "ChallengeTies Premium" })}
          </Text>
        </View>

        <View
          style={[
            styles.premiumBadge,
            {
              backgroundColor: isSubscribed
                ? "rgba(34,197,94,0.18)"
                : "rgba(255,140,0,0.15)",
              borderColor: isSubscribed ? "#22C55E" : "#FF8C00",
            },
          ]}
        >
          <Ionicons
            name={isSubscribed ? "checkmark-circle-outline" : "sparkles-outline"}
            size={normalizeSize(16)}
            color={isSubscribed ? "#22C55E" : "#FF8C00"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.premiumBadgeText,
              { color: isSubscribed ? "#22C55E" : "#FF8C00" },
            ]}
          >
            {isSubscribed
              ? t("premium.active", { defaultValue: "Actif" })
              : t("premium.discover", { defaultValue: "Découvrir" })}
          </Text>
        </View>
      </View>

      <Text style={[styles.premiumDesc, { color: currentTheme.colors.textSecondary }]}>
        {t("premium.subtitle", {
          defaultValue:
            "Supprime les pubs, débloque le mode Duo illimité, les stats avancées, et d’autres bonus exclusifs.",
        })}
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/about/Settings-premium")}
        accessibilityLabel={t("premium.open", { defaultValue: "Voir Premium" })}
        testID="open-premium"
        activeOpacity={0.9}
        style={styles.premiumCta}
      >
        <LinearGradient
          colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumGradient}
        >
          <Ionicons name="diamond-outline" size={normalizeSize(18)} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.premiumCtaText}>
            {isSubscribed
              ? t("premium.manage", { defaultValue: "Gérer mon Premium" })
              : t("premium.get", { defaultValue: "Découvrir Premium" })}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.premiumBullets}>
        {[
          t("premium.benefit.noAds", { defaultValue: "Aucune publicité" }),
          t("premium.benefit.duo", { defaultValue: "Duo illimité" }),
          t("premium.benefit.stats", { defaultValue: "Statistiques avancées" }),
          t("premium.benefit.support", { defaultValue: "Support prioritaire" }),
        ].map((label, idx) => (
          <View key={idx} style={styles.premiumBulletRow}>
            <Ionicons
              name="checkmark-done-outline"
              size={normalizeSize(16)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.premiumBulletText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  </Animated.View>
)}


          {/* Section Compte */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
            <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
              {t("account")}
            </Text>
            <LinearGradient
    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.sectionAccent}
  />
            <Animated.View entering={FadeInUp.delay(600)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={() => router.push("/profile/UserInfo")}
                accessibilityLabel={t("editProfile")}
                testID="edit-profile-button"
              >
                <LinearGradient
                  colors={dynamicStyles.buttonGradient.colors}
                  style={styles.buttonGradient}
                  start={{ x: 1, y: 1 }}
                  end={{ x: 0, y: 0 }}
                >
                  <Ionicons
                    name="person-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      dynamicStyles.accountButtonText,
                    ]}
                  >
                    {t("editProfile")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(650)}>
  <TouchableOpacity
    style={styles.accountButton}
    onPress={() => router.push("/userAccount")}
    accessibilityLabel={t("account")}
    testID="user-account-button"
  >
    <LinearGradient
      colors={dynamicStyles.buttonGradient.colors}
      style={styles.buttonGradient}
      start={{ x: 1, y: 1 }}
      end={{ x: 0, y: 0 }}
    >
      <Ionicons
        name="shield-outline"
        size={normalizeSize(20)}
        color={currentTheme.colors.textPrimary}
      />
      <Text
        style={[
          styles.accountButtonText,
          dynamicStyles.accountButtonText,
        ]}
      >
        {t("account")}
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
                  colors={dynamicStyles.buttonGradient.colors}
                  style={styles.buttonGradient}
                  start={{ x: 1, y: 1 }}
                  end={{ x: 0, y: 0 }}
                >
                  <Ionicons
                    name="trash-bin-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      dynamicStyles.accountButtonText,
                    ]}
                  >
                    {t("clearCache")}
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
                  colors={dynamicStyles.buttonGradient.colors}
                  style={styles.buttonGradient}
                  start={{ x: 1, y: 1 }}
                  end={{ x: 0, y: 0 }}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={normalizeSize(20)}
                    color={currentTheme.colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.accountButtonText,
                      dynamicStyles.accountButtonText,
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
                  colors={dynamicStyles.deleteButtonGradient.colors}
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
                      dynamicStyles.accountButtonText,
                    ]}
                  >
                    {t("deleteAccount")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            {auth.currentUser && auth.currentUser.uid === adminUID && (
              <>
                <Animated.View entering={FadeInUp.delay(1000)}>
                  <Link href="/AdminFeatures" asChild>
                    <TouchableOpacity
                      style={styles.adminButton}
                      accessibilityLabel={t("accessAdmin")}
                      testID="admin-button"
                    >
                      <LinearGradient
                        colors={dynamicStyles.adminButtonGradient.colors}
                        style={styles.adminButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text
                          style={[
                            styles.adminButtonText,
                            dynamicStyles.adminButtonText,
                          ]}
                        >
                          {t("admin")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Link>
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(1050)}>
                  <Link href="/AdminModerateChallenges" asChild>
                    <TouchableOpacity
                      style={styles.adminButton}
                      accessibilityLabel={t("moderateChallenges")}
                      testID="admin-moderate-challenges-button"
                    >
                      <LinearGradient
                        colors={dynamicStyles.adminButtonGradient.colors}
                        style={styles.adminButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text
                          style={[
                            styles.adminButtonText,
                            dynamicStyles.adminButtonText,
                          ]}
                        >
                          {t("moderateChallenges")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Link>
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(1100)}>
                  <Link href="/AdminModerateChats" asChild>
                    <TouchableOpacity
                      style={styles.adminButton}
                      accessibilityLabel={t("moderateChats")}
                      testID="admin-moderate-chats-button"
                    >
                      <LinearGradient
                        colors={dynamicStyles.adminButtonGradient.colors}
                        style={styles.adminButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text
                          style={[
                            styles.adminButtonText,
                            dynamicStyles.adminButtonText,
                          ]}
                        >
                          {t("moderateChats")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Link>
                </Animated.View>
              </>
            )}
          </Animated.View>

          {/* Section À Propos */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.section}>
            <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
              {t("about")}
            </Text>
            <LinearGradient
    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.sectionAccent}
  />
            {["/about/History", "/about/PrivacyPolicy", "/about/Contact"].map(
              (path, index) => (
                <Animated.View
                  entering={FadeInUp.delay(1300 + index * 50)}
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
                    <Text style={[styles.aboutLink, dynamicStyles.aboutLink]}>
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

            <Animated.View entering={FadeInUp.delay(1700)}>
              <Text style={[styles.appVersion, dynamicStyles.appVersion]}>
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
    marginBottom: SPACING * 1.5,
    paddingHorizontal: SPACING,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: SPACING / 2,
    paddingBottom: normalizeSize(100),
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  section: {
    marginBottom: SPACING * 2,
  },
  sectionHeader: {
    fontSize: normalizeSize(24),
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
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: normalizeSize(14),
    paddingHorizontal: SPACING,
  },
  pickerContainer: {
   flex: 1,
   overflow: "hidden",
   justifyContent: "center",      // on garde le centrage vertical
    alignItems: "flex-end", 
 },
  settingLabel: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
  },
  switch: {
    transform: [{ scale: SCREEN_WIDTH < 360 ? 0.85 : 1 }],
  },
  languagePicker: {
   width: SCREEN_WIDTH * 0.4,         // largeur fixe pour éviter la coupure
    height: normalizeSize(60),
    textAlignVertical: "center",
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(20),
    paddingVertical: normalizeSize(2),
},
  accountButton: {
    borderRadius: normalizeSize(16),
    marginBottom: SPACING,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: normalizeSize(14),
    paddingHorizontal: normalizeSize(20),
  },
  accountButtonText: {
    fontSize: normalizeSize(18),
    marginLeft: normalizeSize(10),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  adminButton: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  bgOrbTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.25,
  left: -SCREEN_WIDTH * 0.2,
  width: SCREEN_WIDTH * 0.9,
  height: SCREEN_WIDTH * 0.9,
  borderRadius: SCREEN_WIDTH * 0.45,
},
bgOrbBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.3,
  right: -SCREEN_WIDTH * 0.25,
  width: SCREEN_WIDTH * 1.1,
  height: SCREEN_WIDTH * 1.1,
  borderRadius: SCREEN_WIDTH * 0.55,
},
  adminButtonGradient: {
    paddingVertical: normalizeSize(14),
    paddingHorizontal: SPACING * 1.5,
    alignItems: "center",
  },
  adminButtonText: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  aboutLink: {
    fontSize: normalizeSize(18),
    marginVertical: normalizeSize(8),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  appVersion: {
    textAlign: "center",
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
    premiumCard: {
    borderRadius: normalizeSize(20),
    paddingVertical: normalizeSize(16),
    paddingHorizontal: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  premiumHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalizeSize(10),
  },
  premiumTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  premiumTitle: {
    fontSize: normalizeSize(18),
    marginLeft: normalizeSize(8),
    fontFamily: "Comfortaa_700Bold",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(10),
    paddingVertical: normalizeSize(6),
    borderRadius: normalizeSize(999),
    borderWidth: 1,
  },
  premiumBadgeText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
  },
  sectionAccent: {
  height: 3,
  borderRadius: 3,
  marginTop: 4,
  marginBottom: SPACING * 0.8,
  opacity: 0.9,
},

  premiumDesc: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(6),
    marginBottom: normalizeSize(12),
  },
  premiumCta: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  premiumGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(16),
    borderRadius: normalizeSize(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCtaText: {
    color: "#fff",
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  premiumBullets: {
    marginTop: normalizeSize(14),
    gap: normalizeSize(8),
  },
  premiumBulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(8),
  },
  premiumBulletText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
  },

});
