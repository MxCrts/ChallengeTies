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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";

export default function Contact() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (!name || !email || !message) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    Alert.alert(
      "Message envoyé",
      "Nous vous répondrons dans les plus brefs délais !"
    );
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1E293B", "#0F172A"] : ["#F8FAFC", "#E2E8F0"]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* ✅ TITRE PRINCIPAL */}
        <Animated.Text entering={FadeInUp.duration(800)} style={styles.title}>
          Contactez-nous 📩
        </Animated.Text>

        <Animated.Text entering={FadeInUp.delay(200)} style={styles.paragraph}>
          Une question ? Un problème ? Une suggestion ? Nous sommes à votre
          écoute ! N’hésitez pas à nous contacter via les moyens suivants :
        </Animated.Text>

        {/* ✅ EMAIL */}
        <Animated.View
          entering={FadeInUp.delay(400)}
          style={styles.contactCard}
        >
          <Ionicons name="mail-outline" size={28} color="#2563EB" />
          <View style={styles.contactTextContainer}>
            <Text style={styles.sectionTitle}>Email</Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("mailto:support@challengeties.com")
              }
            >
              <Text style={styles.link}>support@challengeties.com</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ✅ TÉLÉPHONE */}
        <Animated.View
          entering={FadeInUp.delay(600)}
          style={styles.contactCard}
        >
          <Ionicons name="call-outline" size={28} color="#34D399" />
          <View style={styles.contactTextContainer}>
            <Text style={styles.sectionTitle}>Téléphone</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL("tel:+33123456789")}
            >
              <Text style={styles.link}>+33 1 23 45 67 89</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ✅ RÉSEAUX SOCIAUX */}
        <Animated.View
          entering={FadeInUp.delay(800)}
          style={styles.contactCard}
        >
          <Ionicons name="logo-instagram" size={28} color="#E4405F" />
          <View style={styles.contactTextContainer}>
            <Text style={styles.sectionTitle}>Instagram</Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://www.instagram.com/challengeties")
              }
            >
              <Text style={styles.link}>@challengeties</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(1000)}
          style={styles.contactCard}
        >
          <Ionicons name="logo-facebook" size={28} color="#2563EB" />
          <View style={styles.contactTextContainer}>
            <Text style={styles.sectionTitle}>Facebook</Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://www.facebook.com/challengeties")
              }
            >
              <Text style={styles.link}>@challengeties</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(1000)}
          style={styles.contactCard}
        >
          <Ionicons name="logo-whatsapp" size={28} color="#34D399" />
          <View style={styles.contactTextContainer}>
            <Text style={styles.sectionTitle}>WhatsApp</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL("https://wa.me/123456789")}
            >
              <Text style={styles.link}>Nous contacter sur WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ✅ FORMULAIRE DE CONTACT */}
        <Animated.View
          entering={FadeInUp.delay(1200)}
          style={styles.contactForm}
        >
          <Text style={styles.sectionTitle}>Envoyez-nous un message</Text>

          <TextInput
            style={styles.input}
            placeholder="Votre nom"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Votre email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Votre message"
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity style={styles.button} onPress={handleSendMessage}>
            <Text style={styles.buttonText}>Envoyer</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ✅ MESSAGE FINAL */}
        <Animated.View entering={FadeInUp.delay(1400)} style={styles.footer}>
          <Text style={styles.footerText}>
            Nous vous répondrons dans les plus brefs délais. Merci de faire
            confiance à **ChallengeTies** ! 🚀
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
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
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#2563EB" },
  link: { fontSize: 16, color: "#2563EB", textDecorationLine: "underline" },
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
  },
  textArea: { height: 100, textAlignVertical: "top" },
  button: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  footer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    alignItems: "center",
  },
  footerText: { fontSize: 16, fontStyle: "italic", textAlign: "center" },
});
