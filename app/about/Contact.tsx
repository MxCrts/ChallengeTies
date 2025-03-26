import React, { useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";

const { width } = Dimensions.get("window");

export default function Contact() {
  const { theme } = useTheme();
  const currentTheme =
    theme === "dark" ? designSystem.darkTheme : designSystem.lightTheme;
  const gradientColors: readonly [string, string] = [
    currentTheme.colors.background,
    currentTheme.colors.cardBackground,
  ] as const;

  // États du formulaire
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (!name || !email || !message) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    // Ici vous pouvez intégrer l'envoi effectif du message via une API
    Alert.alert(
      "Message envoyé",
      "Nous vous répondrons dans les plus brefs délais !"
    );
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <BackButton color={currentTheme.colors.primary} />
          {/* Entête avec logo */}
          <Animated.View
            entering={FadeInUp.duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/Challenge.png")}
              style={[styles.logo, { width: width * 0.4, height: width * 0.4 }]}
            />
          </Animated.View>

          {/* Titre principal */}
          <Animated.Text
            entering={FadeInUp.delay(200)}
            style={[
              styles.title,
              { color: currentTheme.colors.textPrimary || "#1F2937" },
            ]}
          >
            Contactez-nous 📩
          </Animated.Text>

          {/* Introduction */}
          <Animated.Text
            entering={FadeInUp.delay(300)}
            style={[
              styles.paragraph,
              { color: currentTheme.colors.textSecondary || "#4B5563" },
            ]}
          >
            Une question ? Un problème ? Une suggestion ? Nous sommes là pour
            vous aider. N’hésitez pas à nous contacter via les canaux ci-dessous
            ou à nous envoyer un message directement.
          </Animated.Text>

          {/* Email */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={styles.contactCard}
          >
            <Ionicons
              name="mail-outline"
              size={28}
              color={currentTheme.colors.primary || "#2563EB"}
            />
            <View style={styles.contactTextContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary || "#2563EB" },
                ]}
              >
                Email
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("mailto:support@challengeties.com")
                }
              >
                <Text style={styles.link}>support@challengeties.com</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Téléphone */}
          <Animated.View
            entering={FadeInUp.delay(500)}
            style={styles.contactCard}
          >
            <Ionicons name="call-outline" size={28} color="#34D399" />
            <View style={styles.contactTextContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary || "#2563EB" },
                ]}
              >
                Téléphone
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("tel:+33123456789")}
              >
                <Text style={styles.link}>+33 1 23 45 67 89</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Instagram */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={styles.contactCard}
          >
            <Ionicons name="logo-instagram" size={28} color="#E4405F" />
            <View style={styles.contactTextContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary || "#2563EB" },
                ]}
              >
                Instagram
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("https://www.instagram.com/challengeties")
                }
              >
                <Text style={styles.link}>@challengeties</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Facebook */}
          <Animated.View
            entering={FadeInUp.delay(700)}
            style={styles.contactCard}
          >
            <Ionicons name="logo-facebook" size={28} color="#2563EB" />
            <View style={styles.contactTextContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary || "#2563EB" },
                ]}
              >
                Facebook
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("https://www.facebook.com/challengeties")
                }
              >
                <Text style={styles.link}>@challengeties</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* WhatsApp */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={styles.contactCard}
          >
            <Ionicons name="logo-whatsapp" size={28} color="#34D399" />
            <View style={styles.contactTextContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary || "#2563EB" },
                ]}
              >
                WhatsApp
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://wa.me/123456789")}
              >
                <Text style={styles.link}>Nous contacter sur WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Formulaire de contact */}
          <Animated.View
            entering={FadeInUp.delay(1000)}
            style={styles.contactForm}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Envoyez-nous un message
            </Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: currentTheme.colors.border || "#ddd" },
              ]}
              placeholder="Votre nom"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[
                styles.input,
                { borderColor: currentTheme.colors.border || "#ddd" },
              ]}
              placeholder="Votre email"
              placeholderTextColor="#666"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { borderColor: currentTheme.colors.border || "#ddd" },
              ]}
              placeholder="Votre message"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: currentTheme.colors.primary || "#2563EB" },
              ]}
              onPress={handleSendMessage}
            >
              <Text style={styles.buttonText}>Envoyer</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Message final */}
          <Animated.View entering={FadeInUp.delay(1100)} style={styles.footer}>
            <Text style={styles.footerText}>
              Nous vous répondrons dans les plus brefs délais. Merci de faire
              confiance à <Text style={styles.boldText}>ChallengeTies</Text> !
              🚀
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
  contentContainer: { padding: 20, paddingBottom: 40 },
  logoContainer: { alignItems: "center", marginBottom: 20 },
  logo: { resizeMode: "contain" },
  title: {
    fontSize: 28,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  contactTextContainer: { marginLeft: 15 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 5,
  },
  link: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    color: "#2563EB",
    textDecorationLine: "underline",
  },
  contactForm: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 16,
  },
  footer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    fontStyle: "italic",
    textAlign: "center",
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },
});
