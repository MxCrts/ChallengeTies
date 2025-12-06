import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Dimensions,
  Pressable,
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
import * as Clipboard from "expo-clipboard";
import { tap, success } from "@/src/utils/haptics";
import { useToast } from "@/src/ui/Toast";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

/** Fond orbe discret, non interactif */
const OrbBackground = ({ theme }: { theme: Theme }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Orbe haut-gauche */}
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

      {/* Orbe bas-droit */}
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

      {/* Voile léger pour fusionner */}
      <LinearGradient
        colors={[theme.colors.background + "00", theme.colors.background + "66"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

export default function Contact() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = theme === "dark";
  const { show: showToast } = useToast();

  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  const openUrl = useCallback(
    async (url: string) => {
      try {
        tap();
        const can = await Linking.canOpenURL(url);
        if (!can) {
          throw new Error("cannot_open");
        }
        await Linking.openURL(url);
        success();
      } catch {
        showToast(
          t("linkOpenFailed", {
            defaultValue: "Impossible d’ouvrir ce lien.",
          }),
          "error"
        );
      }
    },
    [t, showToast]
  );

  const copyToClipboard = useCallback(
    async (text: string) => {
      tap();
      try {
        await Clipboard.setStringAsync(text);
        success();
        showToast(
          t("copiedToClipboard", {
            defaultValue: "Copié dans le presse-papiers ✅",
          }),
          "success"
        );
      } catch {
        showToast(
          t("failedToCopy", {
            defaultValue: "Impossible de copier le texte.",
          }),
          "error"
        );
      }
    },
    [t, showToast]
  );

  const renderCard = (delay: number, children: React.ReactNode) => (
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

  const screenA11yLabel =
    t("contact.screenA11yLabel", {
      defaultValue: "Écran de contact ChallengeTies",
    }) || "Contact";

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <OrbBackground theme={currentTheme} />

      <SafeAreaView
        style={[
          styles.safeArea,
          { paddingTop: insets.top + SPACING * 0.5 },
        ]}
      >
        <StatusBar style={isDarkMode ? "light" : "dark"} />
        <CustomHeader title={t("contact.title")} />

        <ScrollView
          contentContainerStyle={[
            styles.contentContainer,
            { maxWidth: 720, alignSelf: "center" },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
          accessible
          accessibilityLabel={screenA11yLabel}
        >
          {/* Logo rond sans ombre */}
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
              accessibilityLabel={t("contact.logoAlt")}
            />
          </Animated.View>

          {/* Intro */}
          {renderCard(
            400,
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
              {t("contact.intro")}
            </Text>
          )}

          {/* Email */}
          {renderCard(
            600,
            <LinkRow
              icon="mail-outline"
              title={t("contact.emailSection")}
              value={t("contact.emailAddress")}
              onOpen={() => openUrl("mailto:support@challengeties.app")}
              onCopy={() => copyToClipboard("support@challengeties.app")}
              currentTheme={currentTheme}
              isDarkMode={isDarkMode}
            />
          )}

          {/* Instagram */}
          {renderCard(
            900,
            <LinkRow
              icon="logo-instagram"
              title={t("contact.instagramSection")}
              value={t("contact.instagramHandle")}
              onOpen={() => openUrl("https://www.instagram.com/challengeties")}
              onCopy={() =>
                copyToClipboard("https://www.instagram.com/challengeties")
              }
              currentTheme={currentTheme}
              isDarkMode={isDarkMode}
              testID="instagram-link"
            />
          )}

          {/* Facebook */}
          {renderCard(
            1100,
            <LinkRow
              icon="logo-facebook"
              title={t("contact.facebookSection")}
              value={t("contact.facebookHandle")}
              onOpen={() => openUrl("https://www.facebook.com/challengeties")}
              onCopy={() =>
                copyToClipboard("https://www.facebook.com/challengeties")
              }
              currentTheme={currentTheme}
              isDarkMode={isDarkMode}
              testID="facebook-link"
            />
          )}

          {/* Message final */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.footer}>
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
                {t("contact.footerMessage")}
              </Text>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ========= Premium Link Row (pressable + copy pill) =========
const LinkRow = React.memo(function LinkRow({
  icon,
  title,
  value,
  onOpen,
  onCopy,
  currentTheme,
  isDarkMode,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  onOpen: () => void;
  onCopy: () => void;
  currentTheme: Theme;
  isDarkMode: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();

  const trailingIconColor = isDarkMode
    ? currentTheme.colors.textPrimary
    : "#111111";

  const copyBg = isDarkMode ? "rgba(255,241,201,0.9)" : "#FFF1C9";
  const copyBorder = isDarkMode ? "rgba(255,184,0,0.9)" : "#FFB800";
  const copyTextColor = isDarkMode ? "#000000" : "#111111";

  return (
    <View style={styles.linkRowWrap}>
      <Pressable
        onPress={onOpen}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={t("contact.accessibility.openLinkHint", {
          defaultValue: "Ouvre le lien de contact associé.",
        })}
        style={styles.linkRowPressable}
        android_ripple={{ color: "#00000010", borderless: false }}
        hitSlop={8}
      >
        <Ionicons
          name={icon}
          size={normalizeSize(22)}
          color={currentTheme.colors.secondary}
          style={styles.featureIcon}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.subtitle,
              { color: currentTheme.colors.secondary, marginBottom: 4 },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.featureText,
              { color: currentTheme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
        <Ionicons name="open-outline" size={18} color={trailingIconColor} />
      </Pressable>

      <View style={{ height: 8 }} />

      <TouchableOpacity
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={t("share.copy", { defaultValue: "Copier" })}
        accessibilityHint={t("contact.accessibility.copyHint", {
          defaultValue: "Copie ces informations dans le presse-papiers.",
        })}
        hitSlop={8}
        style={[
          styles.copyBtn,
          {
            backgroundColor: copyBg,
            borderColor: copyBorder,
          },
        ]}
      >
        <Ionicons name="copy-outline" size={16} color={copyTextColor} />
        <Text
          style={[
            styles.copyTxt,
            {
              color: copyTextColor,
            },
          ]}
        >
          {t("share.copy", { defaultValue: "Copier" })}
        </Text>
      </TouchableOpacity>
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
    paddingBottom: SCREEN_HEIGHT * 0.14, // espace pub / bottom safe-area
    rowGap: SPACING,
  },

  // Logo rond et clean
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

  // Cartes premium (outer + gradient + inner)
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
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING / 2,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },

  featureIcon: {
    marginRight: SPACING,
    marginTop: normalizeSize(3),
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(15),
    lineHeight: normalizeSize(22),
    fontFamily: "Comfortaa_400Regular",
  },

  linkRowWrap: {},
  linkRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 2,
  },

  copyBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  copyTxt: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
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

  // Orbes
  orb: {
    position: "absolute",
    opacity: 0.9,
  },
});
