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
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

// Constante SPACING pour cohérence avec focus.tsx
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

// Typage des icônes pour éviter keyof typeof
type IconName =
  | "checkmark-circle-outline"
  | "time-outline"
  | "analytics-outline"
  | "people-outline"
  | "gift-outline"
  | "flask-outline"
  | "person-add-outline"
  | "eye-outline"
  | "sunny-outline";

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
    const url = "mailto:support@challengeme.com";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn(t("tips.mailClientError"));
      }
    } catch (error) {
      console.error(t("tips.mailOpenError"), error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t("tips.shareMessage"),
      });
    } catch (error) {
      console.error(t("tips.shareError"), error);
    }
  };

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("tips.title")} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: SPACING }}
          accessibilityRole="list"
          accessibilityLabel={t("tips.listAccessibility")}
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.headerContainer}>
            <Image
              source={require("../assets/images/Challenge.png")}
              style={styles.logo}
              accessibilityLabel={t("tips.logoAlt")}
            />
            <Text style={[styles.subHeaderText, { color: currentTheme.colors.textSecondary }]}>
              {t("tips.subHeader")}
            </Text>
          </Animated.View>

          <View style={styles.tipsContainer}>
            {conseils.map((conseil, index) => (
              <Animated.View key={conseil.id} entering={FadeInUp.delay(200 + index * 50)}>
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
                  testID={`tip-card-${conseil.id}`}
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
                accessibilityLabel={t("tips.contactUs")}
                testID="contact-link"
              >
                {t("tips.contactUs")}
              </Text>
            </Text>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleShare}
              accessibilityLabel={t("tips.shareTips")}
              testID="share-button"
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary}
              />
              <Text style={[styles.shareButtonText, { color: currentTheme.colors.textPrimary }]}>
                {t("tips.shareTips")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
  },
  logo: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    resizeMode: "contain",
    marginBottom: SPACING,
  },
  logoPlaceholder: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
  },
  placeholderText: {
    marginTop: SPACING,
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  subHeaderText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginHorizontal: SPACING,
    lineHeight: normalizeFont(22),
  },
  tipsContainer: {
    marginVertical: SPACING,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(15),
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
  },
  tipCardExpanded: {
    opacity: 0.95,
  },
  tipIcon: {
    marginRight: SPACING,
    marginTop: normalizeSize(2),
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(6),
  },
  tipDescription: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalizeFont(20),
  },
  readMoreButton: {
    marginTop: SPACING / 2,
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },
  footer: {
    marginTop: SPACING * 2,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING,
  },
  footerLink: {
    fontFamily: "Comfortaa_700Bold",
    textDecorationLine: "underline",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 1.5,
    paddingHorizontal: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(5),
    elevation: 5,
  },
  shareButtonText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: SPACING / 2,
  },
});