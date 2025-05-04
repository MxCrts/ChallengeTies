import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function History() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
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
            <BackButton color={currentTheme.colors.secondary} />
            <Animated.Text
              entering={FadeInUp.duration(600)}
              style={[styles.title, { color: currentTheme.colors.textPrimary }]}
            >
              {t("history.title")}
            </Animated.Text>
          </View>

          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <LinearGradient
              colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={require("../../assets/images/Challenge.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={t("history.logoAlt")}
              />
            </LinearGradient>
          </Animated.View>

          {/* Introduction */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                {t("appName")}
              </Text>{" "}
              {t("history.intro")}
            </Text>
          </Animated.View>

          {/* Fonctionnalités clés */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history.featuresTitle")}
            </Text>
            <View>
              {[
                {
                  icon: "flame-outline" as const,
                  titleKey: "history.features.specialChallenges.title",
                  descKey: "history.features.specialChallenges.desc",
                },
                {
                  icon: "checkmark-circle-outline" as const,
                  titleKey: "history.features.progressTracking.title",
                  descKey: "history.features.progressTracking.desc",
                },
                {
                  icon: "create-outline" as const,
                  titleKey: "history.features.customChallenges.title",
                  descKey: "history.features.customChallenges.desc",
                },
                {
                  icon: "people-outline" as const,
                  titleKey: "history.features.community.title",
                  descKey: "history.features.community.desc",
                },
              ].map((item, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons
                    name={item.icon}
                    size={normalizeSize(20)}
                    color={currentTheme.colors.secondary}
                    style={styles.featureIcon}
                  />
                  <Text
                    style={[styles.featureText, { color: currentTheme.colors.textSecondary }]}
                  >
                    <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                      {t(item.titleKey)}
                    </Text>
                    {` ${t(item.descKey)}`}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Notre Motivation */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history.motivationTitle")}
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {t("history.motivation")}
            </Text>
          </Animated.View>

          {/* Le Sens du Logo */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history.logoMeaningTitle")}
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {t("history.logoMeaning")}
            </Text>
          </Animated.View>

          {/* Notre Vision */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history.visionTitle")}
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {t("history.vision")}
            </Text>
          </Animated.View>

          {/* Les Débuts */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history beginningsTitle")}
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {t("history.beginnings")}
            </Text>
          </Animated.View>

          {/* L'Engagement Communautaire */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              {t("history.communityEngagementTitle")}
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {t("history.communityEngagement")}
            </Text>
          </Animated.View>

          {/* Message final */}
          <Animated.View entering={FadeInUp.delay(1800)} style={styles.footer}>
            <LinearGradient
              colors={[currentTheme.colors.overlay, currentTheme.colors.border]}
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={[styles.footerText, { color: currentTheme.colors.textPrimary }]}
              >
                <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                  {t("history.finalThanksTitle")}
                </Text>{" "}
                {t("history.finalThanksMessage")}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING,
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
    position: "relative",
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
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
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 8,
    borderWidth: 1,
    borderColor: "transparent",
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
    textAlign: "justify",
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
    marginTop: normalizeSize(2),
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  footer: {
    marginTop: SPACING,
    marginBottom: SPACING * 2,
    borderRadius: normalizeSize(15),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
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