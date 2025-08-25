import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Alert,
  SafeAreaView,
  Image,
  Dimensions,
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
import CustomHeader from "@/components/CustomHeader";


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
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");


  const borderColor = isDarkMode ? currentTheme.colors.secondary : "#FF8C00";

  return (
    <View style={{ flex: 1 }}>
      {/* Fond gradient en absolu pour ne pas pousser le layout */}
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <OrbBackground theme={currentTheme} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <CustomHeader title={t("contact.title")} />

        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo rond sans ombre */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/icon2.png")}
              style={styles.logo}
              resizeMode="cover"
              accessibilityLabel={t("contact.logoAlt")}
            />
          </Animated.View>

          {/* Intro */}
          <Animated.View entering={FadeInUp.delay(400)} style={[styles.card, { borderColor }]}>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              <Text
                style={[
                  styles.boldText,
                  { color: isDarkMode ? currentTheme.colors.textPrimary : "#FF8C00" },
                ]}
              >
                {t("appName")}
              </Text>{" "}
              {t("contact.intro")}
            </Text>
          </Animated.View>

          {/* Email */}
          <Animated.View entering={FadeInUp.delay(600)} style={[styles.card, { borderColor }]}>
            <View style={styles.featureItem}>
              <Ionicons
                name="mail-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
                  {t("contact.emailSection")}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("mailto:support@challengeties.app")}
                  accessibilityLabel={t("contact.emailLinkLabel")}
                  testID="email-link"
                >
                  <Text style={[styles.featureText, { color: currentTheme.colors.textSecondary }]}>
                    {t("contact.emailAddress")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Instagram */}
          <Animated.View entering={FadeInUp.delay(1000)} style={[styles.card, { borderColor }]}>
            <View style={styles.featureItem}>
              <Ionicons
                name="logo-instagram"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
                  {t("contact.instagramSection")}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://www.instagram.com/challengeties")}
                  accessibilityLabel={t("contact.instagramLinkLabel")}
                  testID="instagram-link"
                >
                  <Text style={[styles.featureText, { color: currentTheme.colors.textSecondary }]}>
                    {t("contact.instagramHandle")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Facebook */}
          <Animated.View entering={FadeInUp.delay(1200)} style={[styles.card, { borderColor }]}>
            <View style={styles.featureItem}>
              <Ionicons
                name="logo-facebook"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
                  {t("contact.facebookSection")}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://www.facebook.com/challengeties")}
                  accessibilityLabel={t("contact.facebookLinkLabel")}
                  testID="facebook-link"
                >
                  <Text style={[styles.featureText, { color: currentTheme.colors.textSecondary }]}>
                    {t("contact.facebookHandle")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
                style={[
                  styles.footerText,
                  { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
                ]}
              >
                {t("contact.footerMessage")}
              </Text>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },

  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
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

  // Cartes sans grosses ombres
  card: {
    backgroundColor: "transparent",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    marginBottom: SPACING,
    borderWidth: 2,
    // no shadows
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    textDecorationLine: "underline",
  },
  contactTextContainer: {
    flex: 1,
  },

  input: {
    borderWidth: 1,
    padding: SPACING,
    borderRadius: normalizeSize(12),
    marginBottom: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  textArea: {
    height: normalizeSize(110),
    textAlignVertical: "top",
  },
  button: {
    padding: SPACING,
    borderRadius: normalizeSize(16),
    alignItems: "center",
    marginTop: SPACING,
  },
  buttonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
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
