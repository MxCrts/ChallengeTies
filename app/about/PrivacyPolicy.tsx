import React, { useMemo, memo, ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Linking,
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
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  const clamped = Math.min(Math.max(scale, 0.7), 1.9);
  return Math.round(size * clamped);
};

// ⚠️ Date de dernière mise à jour – à mettre à jour MANUELLEMENT
const LAST_UPDATED = "29/11/2025";

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
    | "swap-horizontal-outline"
    | "phone-portrait-outline";
  key: string;
}

/** Fond orbe léger, non interactif */
const OrbBackground = memo(function OrbBackground({ theme }: { theme: Theme }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Orbe en haut à gauche */}
      <LinearGradient
        colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
        style={[
          styles.orb,
          {
            width: SCREEN_WIDTH * 0.8,
            height: SCREEN_WIDTH * 0.8,
            borderRadius: (SCREEN_WIDTH * 0.8) / 2,
            top: -SCREEN_WIDTH * 0.35,
            left: -SCREEN_WIDTH * 0.25,
          },
        ]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      />

      {/* Orbe en bas à droite */}
      <LinearGradient
        colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
        style={[
          styles.orb,
          {
            width: SCREEN_WIDTH * 0.9,
            height: SCREEN_WIDTH * 0.9,
            borderRadius: (SCREEN_WIDTH * 0.9) / 2,
            bottom: -SCREEN_WIDTH * 0.45,
            right: -SCREEN_WIDTH * 0.25,
          },
        ]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
      />

      {/* Voile très léger pour fusionner les orbes */}
      <LinearGradient
        colors={[theme.colors.background + "00", theme.colors.background + "66"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const insets = useSafeAreaInsets();

  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  const borderColor = isDarkMode ? currentTheme.colors.secondary : "#FF8C00";

  // ⚙️ Listes alignées avec ce que fait l’app (Firebase, analytics, pubs, notifs, etc.)
  const dataCollectedItems: ListItem[] = [
    { icon: "person-outline", key: "nameEmail" },
    { icon: "image-outline", key: "profilePhoto" },
    { icon: "trophy-outline", key: "progress" },
    { icon: "heart-outline", key: "interests" },
    { icon: "time-outline", key: "browsingHistory" },
    // Données techniques (Firebase / AdMob / analytics)
    { icon: "phone-portrait-outline", key: "deviceInfo" },
    { icon: "analytics-outline", key: "usageAnalytics" },
  ];

  const dataUsageItems: ListItem[] = [
    { icon: "star-outline", key: "personalize" },
    { icon: "analytics-outline", key: "analyze" },
    { icon: "notifications-outline", key: "notify" },
    { icon: "settings-outline", key: "improve" },
    // pubs + mesure de performance
    { icon: "construct-outline", key: "adsAndMonetization" },
  ];

  const dataSharingItems: ListItem[] = [
    { icon: "construct-outline", key: "techPartners" }, // Firebase, hébergeurs, analytics, AdMob
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

  // Helper pour toutes les cartes (gradient + fond verre dépoli)
  const renderCard = (delay: number, children: ReactNode) => (
    <Animated.View entering={FadeInUp.delay(delay)} style={styles.cardOuter}>
      <LinearGradient
        colors={[
          currentTheme.colors.secondary + "D0",
          currentTheme.colors.primary + "B0",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View
          style={[
            styles.cardInner,
            { backgroundColor: currentTheme.colors.cardBackground + "F2" },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const openUrlSafe = (url: string | undefined) => {
    if (!url) return;
    try {
      Linking.openURL(url);
    } catch {
      // soft fail
    }
  };

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <OrbBackground theme={currentTheme} />

      <SafeAreaView
        style={[styles.safeArea, { paddingTop: insets.top + SPACING * 0.5 }]}
      >
        <StatusBar style={isDarkMode ? "light" : "dark"} />
        <CustomHeader title={t("privacyPolicy.title")} />

        <ScrollView
          contentContainerStyle={[
            styles.contentContainer,
            { maxWidth: 720, alignSelf: "center" },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t("privacyPolicy.screenA11yLabel", {
            defaultValue: "Politique de confidentialité de ChallengeTies",
          })}
        >
          {/* Logo sans cadre (cercle parfait, pas d'ombre) */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/icon2.png")}
              style={styles.logo}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
              accessibilityLabel={t("privacyPolicy.logoAlt")}
              accessibilityRole="image"
            />
          </Animated.View>

          {/* Last updated */}
          <SmallBadge
            text={t("privacyPolicy.lastUpdated", { date: LAST_UPDATED })}
            color={borderColor}
          />

          {/* Intro */}
          {renderCard(
            400,
            <>
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
            </>
          )}

          {/* Données collectées */}
          {renderCard(
            600,
            <>
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
              {dataCollectedItems.map((it, i) => (
                <BulletItem
                  key={i}
                  icon={it.icon}
                  text={t(`privacyPolicy.dataCollectedItems.${it.key}`)}
                  color={currentTheme.colors.secondary}
                  textColor={currentTheme.colors.textSecondary}
                />
              ))}
            </>
          )}

          {/* Utilisation des données */}
          {renderCard(
            800,
            <>
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
              {dataUsageItems.map((it, i) => (
                <BulletItem
                  key={i}
                  icon={it.icon}
                  text={t(`privacyPolicy.dataUsageItems.${it.key}`)}
                  color={currentTheme.colors.secondary}
                  textColor={currentTheme.colors.textSecondary}
                />
              ))}
            </>
          )}

          {/* Partage des données */}
          {renderCard(
            1000,
            <>
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
              {dataSharingItems.map((it, i) => (
                <BulletItem
                  key={i}
                  icon={it.icon}
                  text={t(`privacyPolicy.dataSharingItems.${it.key}`)}
                  color={currentTheme.colors.secondary}
                  textColor={currentTheme.colors.textSecondary}
                />
              ))}
            </>
          )}

          {/* Sécurité */}
          {renderCard(
            1200,
            <>
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
              {securityItems.map((it, i) => (
                <BulletItem
                  key={i}
                  icon={it.icon}
                  text={t(`privacyPolicy.securityItems.${it.key}`)}
                  color={currentTheme.colors.secondary}
                  textColor={currentTheme.colors.textSecondary}
                />
              ))}
            </>
          )}

          {/* Droits des utilisateurs */}
          {renderCard(
            1400,
            <>
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
              {userRightsItems.map((it, i) => (
                <BulletItem
                  key={i}
                  icon={it.icon}
                  text={t(`privacyPolicy.userRightsItems.${it.key}`)}
                  color={currentTheme.colors.secondary}
                  textColor={currentTheme.colors.textSecondary}
                />
              ))}
            </>
          )}

          {/* Base légale, conservation, transferts, enfants */}
          <Section
            currentTheme={currentTheme}
            delay={1500}
            title={t("privacyPolicy.legalBasisTitle")}
            text={t("privacyPolicy.legalBasisText")}
          />
          <Section
            currentTheme={currentTheme}
            delay={1600}
            title={t("privacyPolicy.retentionTitle")}
            text={t("privacyPolicy.retentionText")}
          />
          <Section
            currentTheme={currentTheme}
            delay={1700}
            title={t("privacyPolicy.transfersTitle")}
            text={t("privacyPolicy.transfersText")}
          />
          <Section
            currentTheme={currentTheme}
            delay={1800}
            title={t("privacyPolicy.childrenTitle")}
            text={t("privacyPolicy.childrenText")}
          />

          {/* Cookies & traceurs (inclure UMP / AdMob dans les textes i18n) */}
          {renderCard(
            1900,
            <>
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
              <Text
                style={[
                  styles.link,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#FF8C00",
                  },
                ]}
                accessibilityRole="link"
                onPress={() =>
                  openUrlSafe(t("privacyPolicy.manageCookiesUrl") as string)
                }
              >
                {t("privacyPolicy.manageCookiesCta")}
              </Text>
            </>
          )}

          {/* Mises à jour */}
          <Section
            currentTheme={currentTheme}
            delay={2000}
            title={t("privacyPolicy.updatesTitle")}
            text={t("privacyPolicy.updatesText")}
          />

          {/* Contact & autorité de contrôle (CNIL etc.) */}
          {renderCard(
            2100,
            <>
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
                selectable
              >
                {t("privacyPolicy.contactEmail")}
              </Text>
              <Text
                style={[
                  styles.link,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#FF8C00",
                  },
                ]}
                accessibilityRole="link"
                onPress={() =>
                  openUrlSafe(
                    t("privacyPolicy.supervisoryAuthorityUrl") as string
                  )
                }
              >
                {t("privacyPolicy.supervisoryAuthorityCta")}
              </Text>
            </>
          )}

          {/* Message final */}
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

// ==== UI mini-composants (perf & propreté) ====
const SmallBadge = memo(function SmallBadge({
  text,
  color,
}: {
  text: string;
  color: string;
}) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Ionicons name="time-outline" size={14} color="#111" />
      <Text style={styles.badgeTxt}>{text}</Text>
    </View>
  );
});

const BulletItem = memo(function BulletItem({
  icon,
  text,
  color,
  textColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.featureItem}>
      <Ionicons
        name={icon}
        size={normalizeSize(20)}
        color={color}
        style={styles.featureIcon}
      />
      <Text style={[styles.featureText, { color: textColor }]}>{text}</Text>
    </View>
  );
});

const Section = memo(function Section({
  title,
  text,
  currentTheme,
  delay = 1500,
}: {
  title: string;
  text: string;
  currentTheme: Theme;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay)} style={styles.cardOuter}>
      <LinearGradient
        colors={[
          currentTheme.colors.secondary + "D0",
          currentTheme.colors.primary + "B0",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View
          style={[
            styles.cardInner,
            { backgroundColor: currentTheme.colors.cardBackground + "F2" },
          ]}
        >
          <Text
            style={[
              styles.subtitle,
              { color: currentTheme.colors.secondary },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.paragraph,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {text}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  safeArea: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },

  // ===== Logo (cercle, pas de bord ni ombre) =====
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
  },
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: (SCREEN_WIDTH * 0.4) / 2,
    overflow: "hidden",
  },

  // mini badge
  badge: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: "#FFF1C9",
    marginBottom: SPACING * 1.5,
  },
  badgeTxt: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    color: "#111",
  },

  link: {
    marginTop: 8,
    textDecorationLine: "underline",
    fontFamily: "Comfortaa_400Regular",
  },

  // ===== Card (outer + gradient + inner) =====
  cardOuter: {
    marginBottom: SPACING,
    borderRadius: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(10),
    elevation: 8,
  },
  cardGradient: {
    borderRadius: normalizeSize(20),
    padding: 1.5,
  },
  cardInner: {
    borderRadius: normalizeSize(18),
    padding: SPACING,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.06)",
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
    marginTop: SPACING / 1.5,
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

  // ===== Orbes =====
  orb: {
    position: "absolute",
    opacity: 0.9,
  },
});
