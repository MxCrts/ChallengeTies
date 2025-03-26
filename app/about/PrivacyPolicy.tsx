import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";

const { width } = Dimensions.get("window");

export default function PrivacyPolicy() {
  const { theme } = useTheme();
  const currentTheme =
    theme === "dark" ? designSystem.darkTheme : designSystem.lightTheme;
  const gradientColors: readonly [string, string] = [
    currentTheme.colors.background,
    currentTheme.colors.cardBackground,
  ] as const;

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
            Politique de Confidentialité 🔒
          </Animated.Text>

          {/* INTRODUCTION */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Introduction
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Chez <Text style={styles.boldText}>ChallengeTies</Text>, la
              protection de votre vie privée est primordiale. Cette politique
              décrit comment nous collectons, utilisons, protégeons et
              partageons vos données personnelles, en respectant scrupuleusement
              le <Text style={styles.boldText}>RGPD</Text>.
            </Text>
          </Animated.View>

          {/* DONNÉES COLLECTÉES */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Données collectées
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Pour vous offrir une expérience personnalisée, nous collectons
              notamment :
            </Text>
            <Text style={styles.listItem}>✅ Nom et adresse e-mail</Text>
            <Text style={styles.listItem}>✅ Photo de profil</Text>
            <Text style={styles.listItem}>
              ✅ Progression dans vos défis & succès
            </Text>
            <Text style={styles.listItem}>
              ✅ Centres d’intérêt et préférences
            </Text>
            <Text style={styles.listItem}>✅ Historique de navigation</Text>
          </Animated.View>

          {/* UTILISATION DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Utilisation des données
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Vos données servent à :
            </Text>
            <Text style={styles.listItem}>
              🔹 Personnaliser votre expérience
            </Text>
            <Text style={styles.listItem}>🔹 Analyser votre progression</Text>
            <Text style={styles.listItem}>
              🔹 Vous envoyer des notifications utiles
            </Text>
            <Text style={styles.listItem}>🔹 Améliorer nos services</Text>
          </Animated.View>

          {/* PARTAGE DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Partage des données
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Vos informations restent strictement confidentielles et ne sont
              partagées qu'avec :
            </Text>
            <Text style={styles.listItem}>🔹 Nos partenaires techniques</Text>
            <Text style={styles.listItem}>
              🔹 Les autorités légales, si nécessaire
            </Text>
            <Text style={styles.listItem}>🔹 Des services de sécurité</Text>
          </Animated.View>

          {/* SÉCURITÉ DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Sécurité des données
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Nous mettons en œuvre des mesures avancées pour protéger vos
              données :
            </Text>
            <Text style={styles.listItem}>
              🔐 Chiffrement des données sensibles
            </Text>
            <Text style={styles.listItem}>🔐 Authentification renforcée</Text>
            <Text style={styles.listItem}>🔐 Surveillance continue</Text>
          </Animated.View>

          {/* DROITS DES UTILISATEURS */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Vos droits
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Conformément au RGPD, vous disposez notamment des droits suivants
              :
            </Text>
            <Text style={styles.listItem}>
              ✔️ Accès, rectification et suppression
            </Text>
            <Text style={styles.listItem}>✔️ Limitation et opposition</Text>
            <Text style={styles.listItem}>✔️ Portabilité des données</Text>
          </Animated.View>

          {/* COOKIES */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Utilisation des cookies
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Les cookies nous aident à améliorer votre navigation et à analyser
              l'utilisation de la plateforme. Vous pouvez les gérer via les
              paramètres de votre appareil.
            </Text>
          </Animated.View>

          {/* MISES À JOUR DE LA POLITIQUE */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Mises à jour de la politique
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Cette politique de confidentialité peut être modifiée pour
              refléter les évolutions de nos pratiques ou de la législation en
              vigueur. Nous vous informerons de toute mise à jour majeure.
            </Text>
          </Animated.View>

          {/* CONTACT */}
          <Animated.View entering={FadeInUp.delay(1800)} style={styles.card}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary || "#2563EB" },
              ]}
            >
              Contact
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Pour toute question relative à la gestion de vos données
              personnelles ou à cette politique, contactez-nous à :
            </Text>
            <Text style={styles.contactEmail}>
              📧 privacy@challengeties.com
            </Text>
          </Animated.View>

          {/* MESSAGE FINAL */}
          <Animated.View entering={FadeInUp.delay(2000)} style={styles.footer}>
            <Text style={styles.footerText}>
              <Text style={styles.boldText}>
                Merci de faire confiance à ChallengeTies.
              </Text>{" "}
              Votre confidentialité reste notre priorité absolue.
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
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "justify",
    marginBottom: 10,
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
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
    fontFamily: "Comfortaa_400Regular",
    color: "#4B5563",
    marginBottom: 5,
  },
  contactEmail: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    color: "#2563EB",
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: 10,
  },
  footer: {
    marginTop: 20,
    marginBottom: 30,
    padding: 15,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    fontStyle: "italic",
    textAlign: "center",
  },
});
