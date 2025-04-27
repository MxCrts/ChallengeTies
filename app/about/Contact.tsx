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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function Contact() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const gradientColors: readonly [string, string] = [
    currentTheme.colors.background,
    currentTheme.colors.cardBackground,
  ] as const;

  // États du formulaire
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = useCallback(() => {
    if (!name || !email || !message) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    // Ici, intégrer l'envoi effectif du message via une API si nécessaire
    Alert.alert(
      "Message envoyé",
      "Nous vous répondrons dans les plus brefs délais !"
    );
    setName("");
    setEmail("");
    setMessage("");
  }, [name, email, message]);

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
          <BackButton
            color={currentTheme.colors.secondary}
          />
          {/* Entête avec logo */}
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

          {/* Titre principal */}
          <Animated.Text
            entering={FadeInUp.delay(200)}
            style={[styles.title, { color: currentTheme.colors.textPrimary }]}
          >
            Contactez-nous 📩
          </Animated.Text>

          {/* Introduction */}
          <Animated.Text
            entering={FadeInUp.delay(300)}
            style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}
          >
            Une question ? Un problème ? Une suggestion ? Nous sommes là pour vous
            aider. N’hésitez pas à nous contacter via les canaux ci-dessous ou à
            nous envoyer un message directement.
          </Animated.Text>

          {/* Email */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={[styles.contactCard, { backgroundColor: currentTheme.colors.cardBackground }]}
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
                Email
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("mailto:support@challengeties.com")}
                accessibilityLabel="Envoyer un email à support@challengeties.com"
                testID="email-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  support@challengeties.com
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Téléphone */}
          <Animated.View
            entering={FadeInUp.delay(500)}
            style={[styles.contactCard, { backgroundColor: currentTheme.colors.cardBackground }]}
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
                Téléphone
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("tel:+33123456789")}
                accessibilityLabel="Appeler le +33 1 23 45 67 89"
                testID="phone-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  +33 1 23 45 67 89
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Instagram */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={[styles.contactCard, { backgroundColor: currentTheme.colors.cardBackground }]}
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
                Instagram
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("https://www.instagram.com/challengeties")
                }
                accessibilityLabel="Visiter notre page Instagram @challengeties"
                testID="instagram-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  @challengeties
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Facebook */}
          <Animated.View
            entering={FadeInUp.delay(700)}
            style={[styles.contactCard, { backgroundColor: currentTheme.colors.cardBackground }]}
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
                Facebook
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("https://www.facebook.com/challengeties")
                }
                accessibilityLabel="Visiter notre page Facebook @challengeties"
                testID="facebook-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  @challengeties
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* WhatsApp */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={[styles.contactCard, { backgroundColor: currentTheme.colors.cardBackground }]}
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
                WhatsApp
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://wa.me/123456789")}
                accessibilityLabel="Nous contacter via WhatsApp"
                testID="whatsapp-link"
              >
                <Text
                  style={[styles.link, { color: currentTheme.colors.secondary }]}
                >
                  Nous contacter sur WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Formulaire de contact */}
          <Animated.View
            entering={FadeInUp.delay(1000)}
            style={[styles.contactForm, { backgroundColor: currentTheme.colors.overlay }]}
          >
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}
            >
              Envoyez-nous un message
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
              placeholder="Votre nom"
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Champ pour votre nom"
              accessibilityHint="Entrez votre nom complet"
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
              placeholder="Votre email"
              placeholderTextColor={currentTheme.colors.textSecondary}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Champ pour votre email"
              accessibilityHint="Entrez votre adresse email"
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
              placeholder="Votre message"
              placeholderTextColor={currentTheme.colors.textSecondary}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
              accessibilityLabel="Champ pour votre message"
              accessibilityHint="Entrez votre message ou question"
              testID="message-input"
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.secondary }]}
              onPress={handleSendMessage}
              accessibilityLabel="Envoyer le message"
              testID="send-button"
            >
              <Text
                style={[styles.buttonText, { color: currentTheme.colors.textPrimary }]}
              >
                Envoyer
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Message final */}
          <Animated.View
            entering={FadeInUp.delay(1100)}
            style={[styles.footer, { backgroundColor: currentTheme.colors.overlay }]}
          >
            <Text
              style={[styles.footerText, { color: currentTheme.colors.textPrimary }]}
            >
              Nous vous répondrons dans les plus brefs délais. Merci de faire
              confiance à{" "}
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                ChallengeTies
              </Text>{" "}
              ! 🚀
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