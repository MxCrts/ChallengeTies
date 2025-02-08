import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";

export default function PrivacyPolicy() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1E293B", "#0F172A"] : ["#F8FAFC", "#E2E8F0"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ TITRE PRINCIPAL */}
        <Animated.Text entering={FadeInUp.duration(800)} style={styles.title}>
          Politique de Confidentialité 🔒
        </Animated.Text>

        {/* ✅ INTRODUCTION */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.card}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            Chez **ChallengeTies**, la protection de votre vie privée est notre
            priorité. Cette politique explique **comment** nous collectons,
            utilisons et sécurisons vos données personnelles, en conformité avec
            le **RGPD (Règlement Général sur la Protection des Données)**.
          </Text>
        </Animated.View>

        {/* ✅ DONNÉES COLLECTÉES */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
          <Text style={styles.sectionTitle}>Données collectées</Text>
          <Text style={styles.paragraph}>
            Nous collectons certaines informations essentielles pour améliorer
            votre expérience sur ChallengeTies :
          </Text>
          <Text style={styles.listItem}>✅ Nom et adresse e-mail</Text>
          <Text style={styles.listItem}>✅ Photo de profil</Text>
          <Text style={styles.listItem}>
            ✅ Progression dans vos défis & succès
          </Text>
          <Text style={styles.listItem}>
            ✅ Centres d’intérêt et préférences
          </Text>
          <Text style={styles.listItem}>✅ Interactions sociales</Text>
        </Animated.View>

        {/* ✅ UTILISATION DES DONNÉES */}
        <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
          <Text style={styles.sectionTitle}>Utilisation des données</Text>
          <Text style={styles.paragraph}>
            Nous utilisons vos informations uniquement pour :
          </Text>
          <Text style={styles.listItem}>
            🔹 Personnaliser votre expérience utilisateur
          </Text>
          <Text style={styles.listItem}>
            🔹 Suivre votre progression et vos défis
          </Text>
          <Text style={styles.listItem}>
            🔹 Vous envoyer des notifications et rappels
          </Text>
          <Text style={styles.listItem}>
            🔹 Améliorer les fonctionnalités de l’application
          </Text>
        </Animated.View>

        {/* ✅ PARTAGE DES DONNÉES */}
        <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
          <Text style={styles.sectionTitle}>Partage des données</Text>
          <Text style={styles.paragraph}>
            Vos données restent **confidentielles** et ne sont pas vendues à des
            tiers. Elles peuvent être partagées uniquement avec :
          </Text>
          <Text style={styles.listItem}>🔹 Nos partenaires techniques</Text>
          <Text style={styles.listItem}>
            🔹 Les autorités légales si nécessaire
          </Text>
          <Text style={styles.listItem}>🔹 Des services de sécurité</Text>
        </Animated.View>

        {/* ✅ SÉCURITÉ DES DONNÉES */}
        <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
          <Text style={styles.sectionTitle}>Sécurité des données</Text>
          <Text style={styles.paragraph}>
            Nous utilisons des **mesures de sécurité avancées** pour protéger
            vos informations :
          </Text>
          <Text style={styles.listItem}>🔐 Chiffrement des données</Text>
          <Text style={styles.listItem}>
            🔐 Authentification renforcée & vérification
          </Text>
          <Text style={styles.listItem}>
            🔐 Protection contre les intrusions
          </Text>
        </Animated.View>

        {/* ✅ DROITS DES UTILISATEURS */}
        <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
          <Text style={styles.sectionTitle}>Vos droits</Text>
          <Text style={styles.paragraph}>
            Conformément au **RGPD**, vous disposez des droits suivants :
          </Text>
          <Text style={styles.listItem}>
            ✔️ Accès et modification de vos données
          </Text>
          <Text style={styles.listItem}>✔️ Suppression de votre compte</Text>
          <Text style={styles.listItem}>
            ✔️ Portabilité de vos informations
          </Text>
          <Text style={styles.listItem}>
            ✔️ Opposition et limitation du traitement
          </Text>
        </Animated.View>

        {/* ✅ COOKIES */}
        <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
          <Text style={styles.sectionTitle}>Utilisation des cookies</Text>
          <Text style={styles.paragraph}>
            Nous utilisons des **cookies** pour améliorer votre navigation et
            analyser les tendances d'utilisation. Vous pouvez les gérer via les
            paramètres de votre appareil.
          </Text>
        </Animated.View>

        {/* ✅ CONTACT */}
        <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.paragraph}>
            Pour toute question relative à vos données personnelles,
            contactez-nous à :
          </Text>
          <Text style={styles.contactEmail}>📧 privacy@challengeties.com</Text>
        </Animated.View>

        {/* ✅ MESSAGE FINAL */}
        <Animated.View entering={FadeInUp.delay(1800)} style={styles.footer}>
          <Text style={styles.footerText}>
            **Merci de faire confiance à ChallengeTies.** Votre confidentialité
            est notre priorité. 🔒✨
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2563EB",
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4B5563",
    textAlign: "justify",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  listItem: {
    fontSize: 16,
    color: "#4B5563",
    marginBottom: 5,
  },
  contactEmail: {
    fontSize: 16,
    color: "#2563EB",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  footer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#1F2937",
    textAlign: "center",
  },
});
