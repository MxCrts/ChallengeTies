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
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function Contact() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = useCallback(() => {
    if (!name || !email || !message) {
      Alert.alert(t("contact.errorTitle"), t("contact.errorMessage"));
      return;
    }
    Alert.alert(t("contact.successTitle"), t("contact.successMessage"));
    setName("");
    setEmail("");
    setMessage("");
  }, [name, email, message, t]);

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
                {t("contact.title")}
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
              accessibilityLabel={t("contact.logoAlt")}
            />
          </Animated.View>

          {/* Intro */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
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
          </Animated.View>

          {/* Email */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <View style={styles.featureItem}>
              <Ionicons
                name="mail-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("contact.emailSection")}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("mailto:support@challengeties.com")
                  }
                  accessibilityLabel={t("contact.emailLinkLabel")}
                  testID="email-link"
                >
                  <Text
                    style={[
                      styles.featureText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("contact.emailAddress")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Phone */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <View style={styles.featureItem}>
              <Ionicons
                name="call-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("contact.phoneSection")}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("tel:+33123456789")}
                  accessibilityLabel={t("contact.phoneLinkLabel")}
                  testID="phone-link"
                >
                  <Text
                    style={[
                      styles.featureText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("contact.phoneNumber")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Instagram */}
          <Animated.View
            entering={FadeInUp.delay(1000)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <View style={styles.featureItem}>
              <Ionicons
                name="logo-instagram"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("contact.instagramSection")}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://www.instagram.com/challengeties")
                  }
                  accessibilityLabel={t("contact.instagramLinkLabel")}
                  testID="instagram-link"
                >
                  <Text
                    style={[
                      styles.featureText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("contact.instagramHandle")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Facebook */}
          <Animated.View
            entering={FadeInUp.delay(1200)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <View style={styles.featureItem}>
              <Ionicons
                name="logo-facebook"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("contact.facebookSection")}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://www.facebook.com/challengeties")
                  }
                  accessibilityLabel={t("contact.facebookLinkLabel")}
                  testID="facebook-link"
                >
                  <Text
                    style={[
                      styles.featureText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("contact.facebookHandle")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* WhatsApp */}
          <Animated.View
            entering={FadeInUp.delay(1400)}
            style={[
              styles.card,
              { borderColor: isDarkMode ? "#FFD700" : "#FF8C00" },
            ]}
          >
            <View style={styles.featureItem}>
              <Ionicons
                name="logo-whatsapp"
                size={normalizeSize(20)}
                color={currentTheme.colors.secondary}
                style={styles.featureIcon}
              />
              <View style={styles.contactTextContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("contact.whatsappSection")}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://wa.me/123456789")}
                  accessibilityLabel={t("contact.whatsappLinkLabel")}
                  testID="whatsapp-link"
                >
                  <Text
                    style={[
                      styles.featureText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("contact.whatsappText")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Contact Form */}
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
              {t("contact.formTitle")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: currentTheme.colors.border,
                  backgroundColor: currentTheme.colors.cardBackground,
                  color: currentTheme.colors.textPrimary,
                },
              ]}
              placeholder={t("contact.namePlaceholder")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              accessibilityLabel={t("contact.nameA11y")}
              testID="name-input"
            />
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: currentTheme.colors.border,
                  backgroundColor: currentTheme.colors.cardBackground,
                  color: currentTheme.colors.textPrimary,
                },
              ]}
              placeholder={t("contact.emailPlaceholder")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              accessibilityLabel={t("contact.emailA11y")}
              testID="email-input"
            />
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  borderColor: currentTheme.colors.border,
                  backgroundColor: currentTheme.colors.cardBackground,
                  color: currentTheme.colors.textPrimary,
                },
              ]}
              placeholder={t("contact.messagePlaceholder")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
              accessibilityLabel={t("contact.messageA11y")}
              testID="message-input"
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: currentTheme.colors.secondary },
              ]}
              onPress={handleSendMessage}
              accessibilityLabel={t("contact.sendButtonA11y")}
              testID="send-button"
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: isDarkMode ? "#000000" : "#000000",
                  },
                ]}
              >
                {t("contact.sendButton")}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Final message */}
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
    textDecorationLine: "underline",
  },
  contactTextContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    padding: SPACING,
    borderRadius: normalizeSize(8),
    marginBottom: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  textArea: {
    height: normalizeSize(100),
    textAlignVertical: "top",
  },
  button: {
    padding: SPACING,
    borderRadius: normalizeSize(8),
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
});
