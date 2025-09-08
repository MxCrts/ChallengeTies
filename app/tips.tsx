import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Share,
  Platform,
} from "react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
 import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
 import { adUnitIds } from "@/constants/admob";
 import { useAdsVisibility } from "../src/context/AdsVisibilityContext";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const BANNER_HEIGHT = normalizeSize(50);

type IconName =
  | "checkmark-circle-outline"
  | "time-outline"
  | "analytics-outline"
  | "people-outline"
  | "gift-outline"
  | "flask-outline"
  | "person-add-outline"
  | "eye-outline"
  | "sunny-outline"
  | "water-outline"
  | "trophy-outline";

interface Conseil {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

const conseils: Conseil[] = [
  { id: "1", title: "tips.smartGoals.title", description: "tips.smartGoals.description", icon: "checkmark-circle-outline" },
  { id: "2", title: "tips.beConsistent.title", description: "tips.beConsistent.description", icon: "time-outline" },
  { id: "3", title: "tips.trackEverything.title", description: "tips.trackEverything.description", icon: "analytics-outline" },
  { id: "4", title: "tips.findSupport.title", description: "tips.findSupport.description", icon: "people-outline" },
  { id: "5", title: "tips.rewardYourself.title", description: "tips.rewardYourself.description", icon: "gift-outline" },
  { id: "6", title: "tips.switchItUp.title", description: "tips.switchItUp.description", icon: "flask-outline" },
  { id: "7", title: "tips.inviteAFriend.title", description: "tips.inviteAFriend.description", icon: "person-add-outline" },
  { id: "8", title: "tips.visualizeSuccess.title", description: "tips.visualizeSuccess.description", icon: "eye-outline" },
  { id: "9", title: "tips.stayPositive.title", description: "tips.stayPositive.description", icon: "sunny-outline" },
  { id: "10", title: "tips.takeBreaks.title", description: "tips.takeBreaks.description", icon: "time-outline" },
  { id: "11", title: "tips.stayHydrated.title", description: "tips.stayHydrated.description", icon: "water-outline" },
  { id: "12", title: "tips.celebrateWins.title", description: "tips.celebrateWins.description", icon: "trophy-outline" },
];

/** ——— Fond orbes premium ——— */
const OrbBackground = ({ theme }: { theme: Theme }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* orbe top-left */}
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 0.9,
          height: SCREEN_WIDTH * 0.9,
          borderRadius: (SCREEN_WIDTH * 0.9) / 2,
          top: -SCREEN_WIDTH * 0.35,
          left: -SCREEN_WIDTH * 0.25,
        },
      ]}
    />
    {/* orbe bottom-right */}
    <LinearGradient
      colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.0,
          height: SCREEN_WIDTH * 1.0,
          borderRadius: (SCREEN_WIDTH * 1.0) / 2,
          bottom: -SCREEN_WIDTH * 0.45,
          right: -SCREEN_WIDTH * 0.25,
        },
      ]}
    />
    {/* voile de fusion */}
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

export default function Conseils() {
  const { t } = useTranslation();
  const router = useRouter();
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
const { showBanners } = useAdsVisibility();
const npa = (globalThis as any).__NPA__ === true;
const bottomPadding = showBanners ? BANNER_HEIGHT + normalizeSize(90) : normalizeSize(90);
  const toggleTip = (id: string) => setExpandedTip(expandedTip === id ? null : id);

  const handleContact = async () => {
    try {
      await Linking.openURL("mailto:support@challengeties.app");
    } catch (error) {
      console.error(t("tips.mailOpenError"), error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t("tips.shareMessage"),
        url: "https://challengeme.com/tips",
        title: t("tips.title"),
      });
    } catch (error) {
      console.error(t("tips.shareError"), error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* fond dégradé + orbes en arrière-plan */}
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        pointerEvents="none"
      />
      <OrbBackground theme={currentTheme} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <CustomHeader title={t("tips.title")} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
           contentInset={{ top: SPACING, bottom: 0 }}
          accessibilityRole="list"
          accessibilityLabel={t("tips.listAccessibility")}
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.headerContainer}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={t("tips.logoAlt")}
            />
            <Text
              style={[
                styles.subHeaderText,
                { color: isDarkMode ? "#FFF" : currentTheme.colors.textSecondary },
              ]}
            >
              {t("tips.subHeader")}
            </Text>
          </Animated.View>

          <View style={styles.tipsContainer} role="list">
            {conseils.map((conseil, index) => (
              <Animated.View
                key={conseil.id}
                entering={FadeInUp.delay(200 + index * 50)}
                layout={Layout.springify()}
                style={{ marginBottom: SPACING }}
              >
                <TouchableOpacity
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: currentTheme.colors.cardBackground,
                      borderColor: currentTheme.colors.border,
                    },
                    expandedTip === conseil.id && styles.tipCardExpanded,
                  ]}
                  onPress={() => toggleTip(conseil.id)}
                  accessibilityLabel={t("tips.toggleTip", { title: t(conseil.title) })}
                  accessibilityHint={expandedTip === conseil.id ? t("tips.showLessHint") : t("tips.readMoreHint")}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandedTip === conseil.id }}
                  testID={`tip-card-${conseil.id}`}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={conseil.icon}
                    size={normalizeSize(32)}
                    color={currentTheme.colors.secondary}
                    style={styles.tipIcon}
                  />
                  <View style={styles.tipContent}>
                    <Text style={[styles.tipTitle, { color: currentTheme.colors.secondary }]}>
                      {t(conseil.title)}
                    </Text>
                    <Text
                      style={[styles.tipDescription, { color: currentTheme.colors.textSecondary }]}
                      numberOfLines={expandedTip === conseil.id ? 0 : 2}
                    >
                      {t(conseil.description)}
                    </Text>
                    <TouchableOpacity
                      style={styles.readMoreButton}
                      onPress={() => toggleTip(conseil.id)}
                      accessibilityLabel={
                        expandedTip === conseil.id
                          ? t("tips.showLess", { title: t(conseil.title) })
                          : t("tips.readMore", { title: t(conseil.title) })
                      }
                      testID={`read-more-${conseil.id}`}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.readMoreText, { color: currentTheme.colors.primary }]}>
                        {expandedTip === conseil.id ? t("tips.showLess") : t("tips.readMore")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.footer}>
            <Text style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}>
              {t("tips.footerQuery")}{" "}
              <Text
                style={[styles.footerLink, { color: currentTheme.colors.secondary }]}
                onPress={handleContact}
                accessibilityRole="link"
                testID="contact-link"
              >
                {t("tips.contactUs")}
              </Text>
            </Text>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleShare}
              accessibilityRole="button"
              testID="share-button"
              activeOpacity={0.9}
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary}
              />
              <Text style={[styles.shareButtonText, { color: currentTheme.colors.textPrimary }]}>
                {" "}{t("tips.shareTips")}{" "}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
        {showBanners && (
          <View style={styles.bannerContainer}>
            <BannerAd
  unitId={adUnitIds.banner}
  size={BannerAdSize.BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: npa }}
  onAdFailedToLoad={(err) =>
    console.error("Échec chargement bannière (Tips):", err)
  }
/>

          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },

  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: normalizeSize(80),
  },

  headerContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
    marginTop: SPACING,
  },
bannerContainer: {
   position: "absolute",
   left: 0,
   right: 0,
   bottom: 0,
   alignItems: "center",
   paddingVertical: SPACING / 2,
   backgroundColor: "transparent",
   width: "100%",
 },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.5, normalizeSize(120)),
    height: Math.min(SCREEN_WIDTH * 0.5, normalizeSize(120)),
    marginBottom: SPACING * 1.5,
    minHeight: normalizeSize(80),
    resizeMode: "contain",
  },

  subHeaderText: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginHorizontal: SPACING * 1.5,
    lineHeight: normalizeFont(24),
  },

  tipsContainer: { marginVertical: SPACING * 1.5 },

  // ——— Card with very subtle shadow (premium) ———
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(18),
    padding: SPACING * 1.2,
    borderWidth: 1.5,
    marginBottom: SPACING,

    // iOS (soft)
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  tipCardExpanded: { opacity: 0.98 },

  tipIcon: { marginRight: SPACING, marginTop: normalizeSize(4) },
  tipContent: { flex: 1 },

  tipTitle: {
    fontSize: normalizeFont(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(8),
  },
  tipDescription: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalizeFont(22),
  },
  readMoreButton: { marginTop: SPACING / 1.5, alignSelf: "flex-start" },
  readMoreText: {
    fontSize: normalizeFont(13),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },

  footer: {
    marginTop: SPACING * 6,
    alignItems: "center",
    paddingBottom: SPACING * 6,
  },
  footerText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING * 1.5,
  },
  footerLink: {
    fontFamily: "Comfortaa_700Bold",
    textDecorationLine: "underline",
  },

  // share button shadow — subtle
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 1.2,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(30),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  shareButtonText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: SPACING / 1.5,
  },

  // orbes
  orb: {
    position: "absolute",
    opacity: 0.9,
  },
});
