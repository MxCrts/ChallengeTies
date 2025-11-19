import React, { useMemo, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

export default function History() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const insets = useSafeAreaInsets();

  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground + "F0",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Orbes décoratifs en arrière-plan */}
      <View
        style={styles.orbsContainer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {/* Orbe principal */}
        <LinearGradient
          colors={[
            currentTheme.colors.secondary + "66",
            currentTheme.colors.primary + "22",
          ]}
          style={[
            styles.orb,
            styles.orbLg,
            { top: -SCREEN_WIDTH * 0.25, left: -SCREEN_WIDTH * 0.15 },
            Platform.OS === "web" ? ({ filter: "blur(12px)" } as any) : null,
          ]}
        />
        {/* Orbe secondaire */}
        <LinearGradient
          colors={[
            currentTheme.colors.primary + "55",
            currentTheme.colors.secondary + "11",
          ]}
          style={[
            styles.orb,
            styles.orbMd,
            { top: SCREEN_HEIGHT * 0.15, right: -SCREEN_WIDTH * 0.25 },
            Platform.OS === "web" ? ({ filter: "blur(12px)" } as any) : null,
          ]}
        />
        {/* Orbe tertiaire */}
        <LinearGradient
          colors={[
            currentTheme.colors.secondary + "44",
            currentTheme.colors.primary + "11",
          ]}
          style={[
            styles.orb,
            styles.orbSm,
            { bottom: -SCREEN_WIDTH * 0.1, left: SCREEN_WIDTH * 0.15 },
            Platform.OS === "web" ? ({ filter: "blur(12px)" } as any) : null,
          ]}
        />
      </View>

      <SafeAreaView
        style={[
          styles.safeArea,
          { paddingTop: insets.top + SPACING * 0.5 },
        ]}
      >
        <StatusBar style={isDarkMode ? "light" : "dark"} />

        <CustomHeader title={t("history.title")} />

        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(600)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/icon2.png")}
              style={styles.logo}
              contentFit="contain"
              transition={120}
              cachePolicy="memory-disk"
              accessibilityLabel={t("history.logoAlt")}
            />
          </Animated.View>

          {/* Intro */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={250}>
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
              {t("history.intro")}
            </Text>
          </Card>

          {/* Fonctionnalités clés */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={350}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.featuresTitle")}
            </Text>

            <View style={styles.sectionAccentWrapper}>
              <LinearGradient
                colors={[
                  currentTheme.colors.secondary,
                  currentTheme.colors.primary,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionAccent}
              />
            </View>

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
            ].map((item, idx) => (
              <FeatureItem
                key={idx}
                icon={item.icon}
                title={t(item.titleKey)}
                desc={t(item.descKey)}
                currentTheme={currentTheme}
                isDarkMode={isDarkMode}
              />
            ))}
          </Card>

          {/* Motivation */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={450}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.motivationTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("history.motivation")}
            </Text>
          </Card>

          {/* Sens du logo */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={550}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.logoMeaningTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("history.logoMeaning")}
            </Text>
          </Card>

          {/* Vision */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={650}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.visionTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("history.vision")}
            </Text>
          </Card>

          {/* Débuts */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={750}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.beginningsTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("history.beginnings")}
            </Text>
          </Card>

          {/* Engagement communautaire */}
          <Card currentTheme={currentTheme} isDarkMode={isDarkMode} delay={850}>
            <Text
              style={[
                styles.subtitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("history.communityEngagementTitle")}
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("history.communityEngagement")}
            </Text>
          </Card>

          {/* Message final */}
          <Animated.View
            entering={FadeInUp.delay(950)}
            style={styles.footer}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.overlay,
                currentTheme.colors.border,
              ]}
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
                <Text
                  style={[
                    styles.boldText,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000000",
                    },
                  ]}
                >
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

const Card = memo(function Card({
  children,
  currentTheme,
  isDarkMode,
  delay = 200,
}: {
  children: React.ReactNode;
  currentTheme: Theme;
  isDarkMode: boolean;
  delay?: number;
}) {
  const borderPrimary = currentTheme.colors.primary;
  const borderSecondary = currentTheme.colors.secondary;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay)}
      style={styles.cardOuter}
    >
      <LinearGradient
        colors={[borderSecondary + "CC", borderPrimary + "AA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View
          style={[
            styles.cardInner,
            {
              backgroundColor: currentTheme.colors.cardBackground + "E6",
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

const FeatureItem = memo(function FeatureItem({
  icon,
  title,
  desc,
  currentTheme,
  isDarkMode,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  desc: string;
  currentTheme: Theme;
  isDarkMode: boolean;
}) {
  return (
    <View style={styles.featureItem}>
      <LinearGradient
        colors={[
          currentTheme.colors.secondary + "EE",
          currentTheme.colors.primary + "CC",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featureIconWrapper}
      >
        <Ionicons
          name={icon}
          size={normalizeSize(18)}
          color={isDarkMode ? "#000" : "#fff"}
          accessibilityLabel={title}
        />
      </LinearGradient>

      <Text
        style={[
          styles.featureText,
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
          {title}
        </Text>
        {` ${desc}`}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  safeArea: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: normalizeSize(120),
    maxWidth: 720,
    alignSelf: "center",
  },

  // --- ORBS ---
  orbsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.9,
  },
  orbLg: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
  },
  orbMd: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: (SCREEN_WIDTH * 0.7) / 2,
  },
  orbSm: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: (SCREEN_WIDTH * 0.45) / 2,
  },

  // --- Logo ---
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING * 1.5,
  },
  logo: {
    width: SCREEN_WIDTH * 0.38,
    height: SCREEN_WIDTH * 0.38,
    borderRadius: (SCREEN_WIDTH * 0.38) / 2,
    overflow: "hidden",
  },

  // --- Cards ---
  cardOuter: {
    marginBottom: SPACING,
    borderRadius: normalizeSize(22),
    // Ombre douce premium
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(10),
    elevation: 8,
  },
  cardGradient: {
    borderRadius: normalizeSize(22),
    padding: 1.5,
  },
  cardInner: {
    borderRadius: normalizeSize(20),
    padding: SPACING,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.06)",
    backdropFilter: Platform.OS === "web" ? ("blur(8px)" as any) : undefined,
  },

  subtitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING * 0.8,
    textAlign: "left",
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },

  sectionAccentWrapper: {
    marginBottom: SPACING * 0.8,
  },
  sectionAccent: {
    height: 3,
    borderRadius: 999,
    opacity: 0.9,
  },

  // --- Features ---
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING,
  },
  featureIconWrapper: {
    width: normalizeSize(34),
    height: normalizeSize(34),
    borderRadius: normalizeSize(17),
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING * 0.8,
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },

  // --- Footer ---
  footer: {
    marginTop: SPACING,
    marginBottom: SPACING * 2,
    borderRadius: normalizeSize(18),
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
