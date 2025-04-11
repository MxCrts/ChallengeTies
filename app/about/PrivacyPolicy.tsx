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
import BackButton from "../../components/BackButton";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

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
    | "swap-horizontal-outline";
  text: string;
}

export default function PrivacyPolicy() {
  return (
    <LinearGradient
      colors={["#e3e2e9", "#f5f5f5"] as const}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header avec BackButton */}
          <View style={styles.headerWrapper}>
            <BackButton color="#e3701e" />
            <Animated.Text
              entering={FadeInUp.duration(600)}
              style={styles.title}
            >
              Politique de Confidentialité
            </Animated.Text>
          </View>

          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <LinearGradient
              colors={["#e3701e", "#f59e0b"] as const}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={require("../../assets/images/Challenge.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </LinearGradient>
          </Animated.View>

          {/* INTRODUCTION */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.card}>
            <Text style={styles.sectionTitle}>Introduction</Text>
            <Text style={styles.paragraph}>
              Chez <Text style={styles.boldText}>ChallengeTies</Text>, la
              protection de votre vie privée est primordiale. Cette politique
              décrit comment nous collectons, utilisons, protégeons et
              partageons vos données personnelles, en respectant scrupuleusement
              le <Text style={styles.boldText}>RGPD</Text>.
            </Text>
          </Animated.View>

          {/* DONNÉES COLLECTÉES */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text style={styles.sectionTitle}>Données collectées</Text>
            <Text style={styles.paragraph}>
              Pour vous offrir une expérience personnalisée, nous collectons
              notamment :
            </Text>
            {[
              {
                icon: "person-outline" as const,
                text: "Nom et adresse e-mail",
              },
              { icon: "image-outline" as const, text: "Photo de profil" },
              {
                icon: "trophy-outline" as const,
                text: "Progression dans vos défis & succès",
              },
              {
                icon: "heart-outline" as const,
                text: "Centres d’intérêt et préférences",
              },
              {
                icon: "time-outline" as const,
                text: "Historique de navigation",
              },
            ].map((item: ListItem, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color="#e3701e"
                  style={styles.listIcon}
                />
                <Text style={styles.listText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* UTILISATION DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text style={styles.sectionTitle}>Utilisation des données</Text>
            <Text style={styles.paragraph}>Vos données servent à :</Text>
            {[
              {
                icon: "star-outline" as const,
                text: "Personnaliser votre expérience",
              },
              {
                icon: "analytics-outline" as const,
                text: "Analyser votre progression",
              },
              {
                icon: "notifications-outline" as const,
                text: "Vous envoyer des notifications utiles",
              },
              {
                icon: "settings-outline" as const,
                text: "Améliorer nos services",
              },
            ].map((item: ListItem, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color="#e3701e"
                  style={styles.listIcon}
                />
                <Text style={styles.listText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* PARTAGE DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text style={styles.sectionTitle}>Partage des données</Text>
            <Text style={styles.paragraph}>
              Vos informations restent strictement confidentielles et ne sont
              partagées qu’avec :
            </Text>
            {[
              {
                icon: "construct-outline" as const,
                text: "Nos partenaires techniques",
              },
              {
                icon: "shield-outline" as const,
                text: "Les autorités légales, si nécessaire",
              },
              {
                icon: "lock-closed-outline" as const,
                text: "Des services de sécurité",
              },
            ].map((item: ListItem, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color="#e3701e"
                  style={styles.listIcon}
                />
                <Text style={styles.listText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* SÉCURITÉ DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text style={styles.sectionTitle}>Sécurité des données</Text>
            <Text style={styles.paragraph}>
              Nous mettons en œuvre des mesures avancées pour protéger vos
              données :
            </Text>
            {[
              {
                icon: "lock-closed-outline" as const,
                text: "Chiffrement des données sensibles",
              },
              {
                icon: "finger-print-outline" as const,
                text: "Authentification renforcée",
              },
              { icon: "eye-outline" as const, text: "Surveillance continue" },
            ].map((item: ListItem, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color="#e3701e"
                  style={styles.listIcon}
                />
                <Text style={styles.listText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* DROITS DES UTILISATEURS */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text style={styles.sectionTitle}>Vos droits</Text>
            <Text style={styles.paragraph}>
              Conformément au RGPD, vous disposez notamment des droits suivants
              :
            </Text>
            {[
              {
                icon: "checkmark-done-outline" as const,
                text: "Accès, rectification et suppression",
              },
              {
                icon: "hand-right-outline" as const,
                text: "Limitation et opposition",
              },
              {
                icon: "swap-horizontal-outline" as const,
                text: "Portabilité des données",
              },
            ].map((item: ListItem, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons
                  name={item.icon}
                  size={normalizeSize(20)}
                  color="#e3701e"
                  style={styles.listIcon}
                />
                <Text style={styles.listText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* COOKIES */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text style={styles.sectionTitle}>Utilisation des cookies</Text>
            <Text style={styles.paragraph}>
              Les cookies nous aident à améliorer votre navigation et à analyser
              l’utilisation de la plateforme. Vous pouvez les gérer via les
              paramètres de votre appareil.
            </Text>
          </Animated.View>

          {/* MISES À JOUR DE LA POLITIQUE */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text style={styles.sectionTitle}>
              Mises à jour de la politique
            </Text>
            <Text style={styles.paragraph}>
              Cette politique de confidentialité peut être modifiée pour
              refléter les évolutions de nos pratiques ou de la législation en
              vigueur. Nous vous informerons de toute mise à jour majeure.
            </Text>
          </Animated.View>

          {/* CONTACT */}
          <Animated.View entering={FadeInUp.delay(1800)} style={styles.card}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.paragraph}>
              Pour toute question relative à la gestion de vos données
              personnelles ou à cette politique, contactez-nous à :
            </Text>
            <Text style={styles.contactEmail}>
              📧 privacy@challengeties.com
            </Text>
          </Animated.View>

          {/* MESSAGE FINAL */}
          <Animated.View entering={FadeInUp.delay(2000)} style={styles.footer}>
            <LinearGradient
              colors={["#E5E7EB", "#D1D5DB"] as const}
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.footerText}>
                <Text style={styles.boldText}>
                  Merci de faire confiance à ChallengeTies.
                </Text>{" "}
                Votre confidentialité reste notre priorité absolue.
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SCREEN_HEIGHT * 0.03,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    position: "relative",
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: "Comfortaa_700Bold",
    color: "#060606",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  contentContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  logoGradient: {
    borderRadius: normalizeSize(20),
    padding: normalizeSize(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: normalizeSize(20),
    padding: normalizeSize(20),
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(227, 226, 233, 0.5)",
  },
  sectionTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    color: "#e3701e",
    marginBottom: normalizeSize(15),
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
    color: "#4B5563",
    textAlign: "justify",
    marginBottom: normalizeSize(10),
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
    color: "#060606",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: normalizeSize(10),
  },
  listIcon: {
    marginRight: normalizeSize(10),
    marginTop: normalizeSize(2),
  },
  listText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
    color: "#4B5563",
  },
  contactEmail: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    color: "#e3701e",
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: normalizeSize(10),
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  footer: {
    marginTop: SCREEN_HEIGHT * 0.03,
    marginBottom: SCREEN_HEIGHT * 0.05,
    borderRadius: normalizeSize(15),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  footerGradient: {
    padding: normalizeSize(20),
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    color: "#333",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});
