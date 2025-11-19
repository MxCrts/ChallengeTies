import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { StatusBar } from "expo-status-bar";
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
import { shareReferralLink } from "@/src/referral/shareReferral";
import * as Application from "expo-application";
import {
  enableNotificationsFromSettings,
  disableNotificationsFromSettings,
} from "../../services/notificationService";
import {
  enableLocationFromSettings,
  disableLocationFromSettings,
} from "../../services/locationService";
import { useReferralStatus } from "@/src/referral/useReferralStatus";
import { nudgeClaimableOnce } from "@/src/referral/nudge";
import { maybeAskForReview, openStoreListing } from "@/src/services/reviewService";
import { tap, success, warning } from "@/src/utils/haptics";
import * as Device from "expo-device";

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
const [deviceName, setDeviceName] = useState<string>("Unknown");
  const [isSubscribed, setIsSubscribed] = useState(true);
const scrollRef = useRef<ScrollView>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
    const { claimable } = useReferralStatus();
const claimableCount = claimable.length;

 // Version réelle de l’app (affiche X.Y.Z (build))
  const appVersion = useMemo(() => {
    const v = Application.nativeApplicationVersion ?? "1.0.0";
    const b = Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : "";
    return `${v}${b}`;
  }, []);

  // Styles dynamiques mémorisés (évite recalculs/re-renders)
  const dynamicStyles = useMemo(
    () => getDynamicStyles(currentTheme, isDarkMode),
    [currentTheme, isDarkMode]
  );

// ✅ Remplace l’ancienne implémentation d’openSupport (deviceName venait de Application)
  const openSupport = useCallback(() => {
    tap();
    const subject = encodeURIComponent("Support ChallengeTies");
    const body = encodeURIComponent(
      `Bonjour,\n\nJ’ai besoin d’aide.\n\n---\nLangue: ${language}\nThème: ${isDarkMode ? "dark" : "light"}\nVersion: ${appVersion}\nUID: ${auth.currentUser?.uid ?? "guest"}\nDevice: ${deviceName}\nApp ID: ${Application.applicationId ?? "Unknown"}\n---`
    );
    Linking.openURL(
      `mailto:support@challengeties.app?subject=${subject}&body=${body}`
    ).catch(() => {
      Alert.alert(
        t("error"),
        t("settingsPage.openMailError", {
          defaultValue: "Impossible d’ouvrir votre application mail.",
        })
      );
    });
  }, [language, isDarkMode, appVersion, deviceName, t]);

    useEffect(() => {
  // envoie une notif locale 1 seule fois par palier claimable
  nudgeClaimableOnce(claimable);
}, [claimable]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") {
          setNotificationsEnabled(false);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLangUpdate((prev) => !prev);
    };
    i18next.on("languageChanged", handleLanguageChanged);
    return () => {
      i18next.off("languageChanged", handleLanguageChanged);
    };
  }, [i18next]);

  // Résolution robuste du nom d’appareil (pas d’API async requise)
  useEffect(() => {
    try {
      const anyDev = Device as any;
      const nameFromProp =
        (typeof anyDev?.deviceName === "string" && anyDev.deviceName) || null;
      const readable =
        nameFromProp ||
        Device.modelName ||
        `${Device.brand ?? "Device"} ${Device.modelName ?? ""}`.trim() ||
        "Unknown";
      setDeviceName(readable);
    } catch {
      setDeviceName(Device.modelName ?? "Unknown");
    }
  }, []);

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

  // --- Actions utilitaires ---
  const openSystemSettings = useCallback(() => {
    try { Linking.openSettings?.(); } catch {}
  }, []);


const handleNotificationsToggle = async (value: boolean) => {
  if (saving.notif) return;
  tap();
  setSaving((s) => ({ ...s, notif: true }));
  setNotificationsEnabled(value);

  try {
    if (value) {
      const ok = await enableNotificationsFromSettings();
      if (!ok) {
        warning();
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
      }
    } else {
      await disableNotificationsFromSettings();
    }
  } catch (e) {
    console.error("❌ handleNotificationsToggle:", e);
    Alert.alert(t("error"), t("failedToSavePreferences"));
    setNotificationsEnabled(!value); // rollback UI
  } finally {
    setSaving((s) => ({ ...s, notif: false }));
  }
};

const handleLocationToggle = async (value: boolean) => {
  if (saving.loc) return;
  tap();
  setSaving((s) => ({ ...s, loc: true }));
  setLocationEnabled(value);

  try {
    if (value) {
      const ok = await enableLocationFromSettings();
      if (!ok) {
        warning();
        setLocationEnabled(false);
        Alert.alert(
          t("permissionDenied"),
          t("settingsPage.error"),
          [
            { text: t("cancel"), style: "cancel" },
            { text: t("openSettings"), onPress: () => Linking.openSettings?.() },
          ],
          { cancelable: true }
        );
      } else {
         success();
        Alert.alert(t("settingsPage.enabled"), t("settingsPage.updated"));
      }
    } else {
      await disableLocationFromSettings();
    }
  } catch (e) {
    console.error("❌ handleLocationToggle:", e);
    Alert.alert(t("error"), t("failedToSavePreferences"));
    setLocationEnabled(!value); // rollback UI
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


  return (
    <GlobalLayout key={language}>
      <StatusBar style={isDarkMode ? "light" : "dark"} translucent />
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
  onValueChange={handleNotificationsToggle}
  trackColor={dynamicStyles.switch.trackColor}
  thumbColor={dynamicStyles.switch.thumbColor}
  style={styles.switch}
  accessibilityLabel={t("handleNotifications")}
/>
              </View>
              {/* Lien vers Réglages système si notifs OFF */}
              {!notificationsEnabled && (
                <TouchableOpacity onPress={openSystemSettings} style={{ paddingHorizontal: SPACING, paddingBottom: normalizeSize(12) }}>
                  <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: normalizeSize(14), color: currentTheme.colors.textSecondary }}>
                    {t("settingsPage.enableInSystem", { defaultValue: "Activez les notifications dans les réglages système." })}
                  </Text>
                </TouchableOpacity>
              )}
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
              {!locationEnabled && (
                <TouchableOpacity onPress={openSystemSettings} style={{ paddingHorizontal: SPACING, paddingBottom: normalizeSize(12) }}>
                  <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: normalizeSize(14), color: currentTheme.colors.textSecondary }}>
                    {t("settingsPage.locationTip", { defaultValue: "Activez la localisation dans les réglages système pour des suggestions proches." })}
                  </Text>
                </TouchableOpacity>
              )}
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
    dropdownIconColor={
      isDarkMode ? currentTheme.colors.textPrimary : currentTheme.colors.primary
    }
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
    <Picker.Item label="日本語" value="ja" />      {/* 🇯🇵 ajouté */}
    <Picker.Item label="한국어" value="ko" />       {/* 🇰🇷 ajouté */}
    <Picker.Item label="Português" value="pt" />  {/* 🇵🇹🇧🇷 ajouté */}
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
  {claimableCount > 0 && (
  <TouchableOpacity
    onPress={() => router.push("/referral/ShareAndEarn")}
    accessibilityLabel={t("referral.banner.open")}
    style={styles.claimBanner}
    activeOpacity={0.9}
  >
    <View style={styles.claimBannerLeft}>
      <Ionicons name="gift-outline" size={normalizeSize(18)} color="#111" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.claimBannerTitle}>
        {t("referral.banner.title")}
      </Text>
      <Text style={styles.claimBannerText}>
        {t("referral.banner.subtitle", { count: claimableCount })}
      </Text>
    </View>
    <View style={styles.claimBannerCta}>
      <Text style={styles.claimBannerCtaText}>{t("referral.banner.cta")}</Text>
    </View>
  </TouchableOpacity>
)}

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
<Animated.View entering={FadeInUp.delay(675)}>
  <TouchableOpacity
    style={styles.accountButton}
    onPress={async () => {
      tap();
      try { await shareReferralLink(); } catch (e) {}
    }}
    accessibilityLabel={t("inviteFriends") || "Inviter des amis"}
    testID="invite-friends-button"
  >
    <LinearGradient
      colors={dynamicStyles.buttonGradient.colors}
      style={styles.buttonGradient}
      start={{ x: 1, y: 1 }}
      end={{ x: 0, y: 0 }}
    >
      <Ionicons name="send-outline" size={normalizeSize(20)} color={currentTheme.colors.textPrimary} />
      <Text style={[styles.accountButtonText, dynamicStyles.accountButtonText]}>
        {t("inviteFriends") || "Inviter des amis"}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>
            <Animated.View entering={FadeInUp.delay(700)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={async () => { tap(); await clearCache(); }}
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
<Animated.View entering={FadeInUp.delay(540)}>
  <TouchableOpacity
    style={styles.accountButton}
    onPress={() => router.push("/referral/ShareAndEarn")}
    accessibilityLabel={t("referral.menu")}
    testID="share-earn-button"
  >
    <LinearGradient
      colors={dynamicStyles.buttonGradient.colors}
      style={styles.buttonGradient}
      start={{ x: 1, y: 1 }}
      end={{ x: 0, y: 0 }}
    >
      <Ionicons
        name="gift-outline"
        size={normalizeSize(20)}
        color={currentTheme.colors.textPrimary}
      />
      <Text
        style={[
          styles.accountButtonText,
          dynamicStyles.accountButtonText,
        ]}
      >
         {t("referral.menu")}
      </Text>

      {/* BADGE si des paliers sont claimables */}
      {claimable.length > 0 && (
        <View
          style={{
            marginLeft: normalizeSize(8),
            paddingHorizontal: normalizeSize(10),
            paddingVertical: normalizeSize(6),
            borderRadius: 999,
            borderWidth: 1.2,
            borderColor: "#111",
            backgroundColor: "#FFB800",
          }}
        >
          <Text style={{ fontWeight: "900", color: "#111", fontSize: normalizeSize(12) }}>
  {t("referral.badge", { defaultValue: "+ Récompense" })}
</Text>
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>


            <Animated.View entering={FadeInUp.delay(800)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={async () => { tap(); await handleLogout(); }}
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

            {/* Support */}
<Animated.View entering={FadeInUp.delay(720)}>
  <TouchableOpacity
    style={styles.accountButton}
    onPress={openSupport}
    accessibilityLabel={t("support")}
    testID="support-button"
  >
    <LinearGradient
      colors={dynamicStyles.buttonGradient.colors}
      style={styles.buttonGradient}
      start={{ x: 1, y: 1 }}
      end={{ x: 0, y: 0 }}
    >
      <Ionicons name="help-buoy-outline" size={normalizeSize(20)} color={currentTheme.colors.textPrimary} />
      <Text style={[styles.accountButtonText, dynamicStyles.accountButtonText]}>
        {t("support")}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>
            {/* Danger Zone */}
            <Animated.View entering={FadeInUp.delay(860)} style={{ marginTop: SPACING }}>
              <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
                {t("dangerZone", { defaultValue: "Zone dangereuse" })}
              </Text>
              <LinearGradient
                colors={[currentTheme.colors.error, withAlpha(currentTheme.colors.error, 0.8)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionAccent}
              />
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(900)}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={async () => { tap(); await handleDeleteAccount(); }}
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
                <Animated.View entering={FadeInUp.delay(1150)}>
  <Link href="/admin/events" asChild>
    <TouchableOpacity
      style={styles.adminButton}
      accessibilityLabel={t("adminEvents", { defaultValue: "Admin Events" })}
      testID="admin-events-button"
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
          {t("adminEvents", { defaultValue: "Admin Events" })}
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
{/* Bouton Noter l’app */}
<Animated.View entering={FadeInUp.delay(1650)}>
  <TouchableOpacity
    onPress={async () => {
      tap();
      const shown = await maybeAskForReview().catch(() => false);
      if (!shown) {
        await openStoreListing().catch(() => {});
      }
    }}
    accessibilityLabel={t("rateUs")}
    testID="rate-app-button"
    style={styles.accountButton}
  >
    <LinearGradient
      colors={dynamicStyles.buttonGradient.colors}
      style={styles.buttonGradient}
      start={{ x: 1, y: 1 }}
      end={{ x: 0, y: 0 }}
    >
      <Ionicons
        name="star-outline"
        size={normalizeSize(20)}
        color={currentTheme.colors.textPrimary}
      />
      <Text
        style={[
          styles.accountButtonText,
          dynamicStyles.accountButtonText,
        ]}
      >
        {t("rateUs")}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>

            <Animated.View entering={FadeInUp.delay(1700)}>
              <Text style={[styles.appVersion, dynamicStyles.appVersion]}>
                {t("appVersion")} {appVersion}
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
  claimBanner: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(10),
  backgroundColor: "#FFF1C9",
  borderColor: "#FFB800",
  borderWidth: 1.5,
  borderRadius: normalizeSize(14),
  paddingVertical: normalizeSize(10),
  paddingHorizontal: normalizeSize(12),
  marginBottom: SPACING,
},
claimBannerLeft: {
  width: normalizeSize(34),
  height: normalizeSize(34),
  borderRadius: normalizeSize(17),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#FFE9A6",
  borderColor: "#FFB800",
  borderWidth: 1,
},
claimBannerTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(14),
  color: "#111",
},
claimBannerText: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(12),
  color: "#7C5800",
  marginTop: 2,
},
claimBannerCta: {
  paddingHorizontal: normalizeSize(10),
  paddingVertical: normalizeSize(6),
  borderRadius: 999,
  borderWidth: 1.2,
  borderColor: "#111",
  backgroundColor: "#FFB800",
},
claimBannerCtaText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  color: "#111",
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
