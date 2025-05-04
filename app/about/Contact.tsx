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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
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

export default function Contact() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const gradientColors: readonly [string, string] = [
    currentTheme.colors.background,
    currentTheme.colors.cardBackground,
  ] as const;

  // form state
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
    <LinearGradient colors={gradientColors} style={styles.container}>
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
          <BackButton color={currentTheme.colors.secondary} />

          {/* logo */}
          <Animated.View
            entering={FadeInUp.duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/Challenge.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* title */}
          <Animated.Text
            entering={FadeInUp.delay(200)}
            style={[styles.title, { color: currentTheme.colors.textPrimary }]}
          >
            {t("contact.title")}
          </Animated.Text>

          {/* intro */}
          <Animated.Text
            entering={FadeInUp.delay(300)}
            style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}
          >
            {t("contact.intro")}
          </Animated.Text>

          {/* Email */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={[
              styles.contactCard,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={normalizeSize(28)}
              color={currentTheme.colors.secondary}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
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
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  {t("contact.emailAddress")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Phone */}
          <Animated.View
            entering={FadeInUp.delay(500)}
            style={[
              styles.contactCard,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name="call-outline"
              size={normalizeSize(28)}
              color={currentTheme.colors.secondary}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
              >
                {t("contact.phoneSection")}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("tel:+33123456789")}
                accessibilityLabel={t("contact.phoneLinkLabel")}
                testID="phone-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  {t("contact.phoneNumber")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Instagram */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={[
              styles.contactCard,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name="logo-instagram"
              size={normalizeSize(28)}
              color={currentTheme.colors.secondary}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
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
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  {t("contact.instagramHandle")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Facebook */}
          <Animated.View
            entering={FadeInUp.delay(700)}
            style={[
              styles.contactCard,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name="logo-facebook"
              size={normalizeSize(28)}
              color={currentTheme.colors.secondary}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
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
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  {t("contact.facebookHandle")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* WhatsApp */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={[
              styles.contactCard,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name="logo-whatsapp"
              size={normalizeSize(28)}
              color={currentTheme.colors.secondary}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
              >
                {t("contact.whatsappSection")}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://wa.me/123456789")}
                accessibilityLabel={t("contact.whatsappLinkLabel")}
                testID="whatsapp-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  {t("contact.whatsappText")}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Contact Form */}
          <Animated.View
            entering={FadeInUp.delay(1000)}
            style={[styles.contactForm, { backgroundColor: currentTheme.colors.overlay }]}
          >
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
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
              style={[styles.button, { backgroundColor: currentTheme.colors.secondary }]}
              onPress={handleSendMessage}
              accessibilityLabel={t("contact.sendButtonA11y")}
              testID="send-button"
            >
              <Text
                style={[styles.buttonText, { color: currentTheme.colors.textPrimary }]}
              >
                {t("contact.sendButton")}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Final message */}
          <Animated.View
            entering={FadeInUp.delay(1100)}
            style={[styles.footer, { backgroundColor: currentTheme.colors.overlay }]}
          >
            <Text
              style={[styles.footerText, { color: currentTheme.colors.textPrimary }]}
            >
              {t("contact.footerMessage")}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: {
    padding: SPACING,
    paddingBottom: SPACING * 2,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING,
  },
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    textAlign: "center",
    marginBottom: SPACING,
    fontFamily: "Comfortaa_400Regular",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: normalizeSize(12),
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(5),
    elevation: 6,
  },
  contactTextContainer: {
    marginLeft: SPACING,
  },
  sectionTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(5),
  },
  link: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },
  contactForm: {
    marginTop: SPACING,
    padding: SPACING,
    borderRadius: normalizeSize(12),
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
    padding: SPACING,
    borderRadius: normalizeSize(12),
    alignItems: "center",
    marginBottom: SPACING,
  },
  footerText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    fontStyle: "italic",
    textAlign: "center",
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },
});