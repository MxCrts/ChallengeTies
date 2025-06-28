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

// Constants
const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

// Types

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
  {
    id: "1",
    title: "tips.smartGoals.title",
    description: "tips.smartGoals.description",
    icon: "checkmark-circle-outline",
  },
  {
    id: "2",
    title: "tips.beConsistent.title",
    description: "tips.beConsistent.description",
    icon: "time-outline",
  },
  {
    id: "3",
    title: "tips.trackEverything.title",
    description: "tips.trackEverything.description",
    icon: "analytics-outline",
  },
  {
    id: "4",
    title: "tips.findSupport.title",
    description: "tips.findSupport.description",
    icon: "people-outline",
  },
  {
    id: "5",
    title: "tips.rewardYourself.title",
    description: "tips.rewardYourself.description",
    icon: "gift-outline",
  },
  {
    id: "6",
    title: "tips.switchItUp.title",
    description: "tips.switchItUp.description",
    icon: "flask-outline",
  },
  {
    id: "7",
    title: "tips.inviteAFriend.title",
    description: "tips.inviteAFriend.description",
    icon: "person-add-outline",
  },
  {
    id: "8",
    title: "tips.visualizeSuccess.title",
    description: "tips.visualizeSuccess.description",
    icon: "eye-outline",
  },
  {
    id: "9",
    title: "tips.stayPositive.title",
    description: "tips.stayPositive.description",
    icon: "sunny-outline",
  },
  {
    id: "10",
    title: "tips.takeBreaks.title",
    description: "tips.takeBreaks.description",
    icon: "time-outline",
  },
  {
    id: "11",
    title: "tips.stayHydrated.title",
    description: "tips.stayHydrated.description",
    icon: "water-outline",
  },
  {
    id: "12",
    title: "tips.celebrateWins.title",
    description: "tips.celebrateWins.description",
    icon: "trophy-outline",
  },
];

export default function Conseils() {
  const { t } = useTranslation();
  const router = useRouter();
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const toggleTip = (id: string) => {
    setExpandedTip(expandedTip === id ? null : id);
  };

  const handleContact = async () => {
    try {
      await Linking.openURL("mailto:support@challengeme.com");
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
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={styles.backButton}
          accessibilityLabel={t("tips.goBack")}
          testID="back-button"
        >
          <Ionicons
            name="arrow-back"
            size={normalizeSize(24)}
            color={
              isDarkMode
                ? currentTheme.colors.secondary
                : currentTheme.colors.secondary
            }
          />
        </TouchableOpacity>
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("tips.title")} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
          accessibilityRole="list"
          accessibilityLabel={t("tips.listAccessibility")}
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.headerContainer}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={t("tips.logoAlt")}
            />
            <Text
              style={[
                styles.subHeaderText,
                {
                  color: isDarkMode
                    ? "#FFF"
                    : currentTheme.colors.textSecondary,
                },
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
                  accessibilityLabel={t("tips.toggleTip", {
                    title: t(conseil.title),
                  })}
                  accessibilityHint={
                    expandedTip === conseil.id
                      ? t("tips.showLessHint")
                      : t("tips.readMoreHint")
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandedTip === conseil.id }}
                  testID={`tip-card-${conseil.id}`}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={conseil.icon}
                    size={normalizeSize(32)}
                    color={currentTheme.colors.secondary}
                    style={styles.tipIcon}
                  />
                  <View style={styles.tipContent}>
                    <Text
                      style={[
                        styles.tipTitle,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {t(conseil.title)}
                    </Text>
                    <Text
                      style={[
                        styles.tipDescription,
                        { color: currentTheme.colors.textSecondary },
                      ]}
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
                      <Text
                        style={[
                          styles.readMoreText,
                          { color: currentTheme.colors.primary },
                        ]}
                      >
                        {expandedTip === conseil.id
                          ? t("tips.showLess")
                          : t("tips.readMore")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("tips.footerQuery")}{" "}
              <Text
                style={[
                  styles.footerLink,
                  { color: currentTheme.colors.secondary },
                ]}
                onPress={handleContact}
                accessibilityRole="link"
                testID="contact-link"
              >
                {t("tips.contactUs")}
              </Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={handleShare}
              accessibilityRole="button"
              testID="share-button"
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.shareButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {" "}
                {t("tips.shareTips")}{" "}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
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
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
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
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(18),
    padding: SPACING * 1.2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 6,
    borderWidth: 1.5,
    marginBottom: SPACING,
  },
  tipCardExpanded: { opacity: 0.95 },
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
    marginTop: SPACING * 10,
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
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 1.2,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  shareButtonText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: SPACING / 1.5,
  },
});
