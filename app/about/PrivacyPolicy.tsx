import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

// Interface pour les items des listes avec typage précis des icônes
interface ListItem {
  icon:
    | "person-outline"
    | "image-outline"
    | "trophy-outline"
    | "heart-outline"
    | "time-outline"
    | "star-outline"
    | "analytics-outline"
    | "notifications-outline"
    | "settings-outline"
    | "construct-outline"
    | "shield-outline"
    | "lock-closed-outline"
    | "finger-print-outline"
    | "eye-outline"
    | "checkmark-done-outline"
    | "hand-right-outline"
    | "swap-horizontal-outline";
  key: string;
}

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const dataCollectedItems: ListItem[] = [
    { icon: "person-outline", key: "nameEmail" },
    { icon: "image-outline", key: "profilePhoto" },
    { icon: "trophy-outline", key: "progress" },
    { icon: "heart-outline", key: "interests" },
    { icon: "time-outline", key: "browsingHistory" },
  ];

  const dataUsageItems: ListItem[] = [
    { icon: "star-outline", key: "personalize" },
    { icon: "analytics-outline", key: "analyze" },
    { icon: "notifications-outline", key: "notify" },
    { icon: "settings-outline", key: "improve" },
  ];

  const dataSharingItems: ListItem[] = [
    { icon: "construct-outline", key: "techPartners" },
    { icon: "shield-outline", key: "legalAuthorities" },
    { icon: "lock-closed-outline", key: "securityServices" },
  ];

  const securityItems: ListItem[] = [
    { icon: "lock-closed-outline", key: "encryption" },
    { icon: "finger-print-outline", key: "twoFactor" },
    { icon: "eye-outline", key: "monitoring" },
  ];

  const userRightsItems: ListItem[] = [
    { icon: "checkmark-done-outline", key: "accessRectify" },
    { icon: "hand-right-outline", key: "restrictObject" },
    { icon: "swap-horizontal-outline", key: "portability" },
  ];

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header avec BackButton */}
          <View style={styles.headerWrapper}>
            <Animated.View entering={FadeInUp}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityLabel={t("backButton")}
                accessibilityHint={t("backButtonHint")}
                testID="back-button"
              >
                <Ionicons
                  name="arrow-back"
                  size={normalizeSize(24)}
                  color={currentTheme.colors.secondary}
                />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.titleContainer}>
              <Animated.Text
                entering={FadeInUp.duration(600)}
                style={[
                  styles.title,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  },
                ]}
              >
                {t("privacyPolicy.title")}
              </Animated.Text>
            </View>
          </View>

          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/icon2.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={t("privacyPolicy.logoAlt")}
            />
          </Animated.View>

          {/* Introduction */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.introductionTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              <Text
                style={[
                  styles.boldText,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#FF8C00",
                  },
                ]}
              >
                {t("appName")}
              </Text>{" "}
              {t("privacyPolicy.introductionText", {
                appName: "ChallengeTies",
              })}
            </Text>
          </Animated.View>

          {/* Data Collected */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.dataCollectedTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.dataCollectedText")}
            </Text>
            {dataCollectedItems.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color={currentTheme.colors.secondary}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`privacyPolicy.dataCollectedItems.${item.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Data Usage */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.dataUsageTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.dataUsageText")}
            </Text>
            {dataUsageItems.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color={currentTheme.colors.secondary}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`privacyPolicy.dataUsageItems.${item.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Data Sharing */}
          <Animated.View
            entering={FadeInUp.delay(1000)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.dataSharingTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.dataSharingText")}
            </Text>
            {dataSharingItems.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color={currentTheme.colors.secondary}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`privacyPolicy.dataSharingItems.${item.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Security */}
          <Animated.View
            entering={FadeInUp.delay(1200)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.securityTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.securityText")}
            </Text>
            {securityItems.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color={currentTheme.colors.secondary}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`privacyPolicy.securityItems.${item.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* User Rights */}
          <Animated.View
            entering={FadeInUp.delay(1400)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.userRightsTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.userRightsText")}
            </Text>
            {userRightsItems.map((item, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color={currentTheme.colors.secondary}
                  style={styles.featureIcon}
                />
                <Text
                  style={[
                    styles.featureText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(`privacyPolicy.userRightsItems.${item.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Cookies */}
          <Animated.View
            entering={FadeInUp.delay(1600)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.cookiesTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.cookiesText")}
            </Text>
          </Animated.View>

          {/* Updates */}
          <Animated.View
            entering={FadeInUp.delay(1800)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.updatesTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.updatesText")}
            </Text>
          </Animated.View>

          {/* Contact */}
          <Animated.View
            entering={FadeInUp.delay(2000)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("privacyPolicy.contactTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("privacyPolicy.contactText")}
            </Text>
            <Text
              style={[
                styles.contactEmail,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#FF8C00",
                },
              ]}
            >
              {t("privacyPolicy.contactEmail")}
            </Text>
          </Animated.View>

          {/* Final Message */}
          <Animated.View entering={FadeInUp.delay(2200)} style={styles.footer}>
            <LinearGradient
              colors={[currentTheme.colors.overlay, currentTheme.colors.border]}
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={[
                  styles.footerText,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  },
                ]}
              >
                {t("privacyPolicy.finalMessage")}
              </Text>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING / 2,
    position: "relative",
    marginTop: SPACING,
    marginBottom: SPACING,
  },
  titleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
  },
  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
  },
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    // Supprime les ombres et bordures du LinearGradient
  },
  logoGradient: {
    borderRadius: normalizeSize(20),
    padding: SPACING / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },

  card: {
    backgroundColor: "transparent",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    marginBottom: SPACING,
    borderWidth: 1,
  },
  subtitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING,
  },
  featureIcon: {
    marginRight: SPACING,
    marginTop: normalizeSize(3),
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  contactEmail: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: SPACING,
  },
  footer: {
    marginTop: SPACING,
    marginBottom: SPACING * 2,
    borderRadius: normalizeSize(15),
    overflow: "hidden",
  },
  footerGradient: {
    padding: SPACING,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    fontStyle: "italic",
    textAlign: "center",
  },
});
