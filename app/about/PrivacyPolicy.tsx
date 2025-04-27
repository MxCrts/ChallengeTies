import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
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
            <BackButton
              color={currentTheme.colors.secondary}
            />
            <Animated.Text
              entering={FadeInUp.duration(600)}
              style={[styles.title, { color: currentTheme.colors.textPrimary }]}
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
              colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
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
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Introduction
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Chez{" "}
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                ChallengeTies
              </Text>
              , la protection de votre vie privée est primordiale. Cette politique décrit
              comment nous collectons, utilisons, protégeons et partageons vos données
              personnelles, en respectant scrupuleusement le{" "}
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                RGPD
              </Text>
              .
            </Text>
          </Animated.View>

          {/* DONNÉES COLLECTÉES */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Données collectées
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Pour vous offrir une expérience personnalisée, nous collectons notamment :
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
                  color={currentTheme.colors.secondary}
                  style={styles.listIcon}
                />
                <Text
                  style={[styles.listText, { color: currentTheme.colors.textSecondary }]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* UTILISATION DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Utilisation des données
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Vos données servent à :
            </Text>
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
                  color={currentTheme.colors.secondary}
                  style={styles.listIcon}
                />
                <Text
                  style={[styles.listText, { color: currentTheme.colors.textSecondary }]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* PARTAGE DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Partage des données
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Vos informations restent strictement confidentielles et ne sont partagées
              qu’avec :
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
                  color={currentTheme.colors.secondary}
                  style={styles.listIcon}
                />
                <Text
                  style={[styles.listText, { color: currentTheme.colors.textSecondary }]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* SÉCURITÉ DES DONNÉES */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Sécurité des données
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Nous mettons en œuvre des mesures avancées pour protéger vos données :
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
                  color={currentTheme.colors.secondary}
                  style={styles.listIcon}
                />
                <Text
                  style={[styles.listText, { color: currentTheme.colors.textSecondary }]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* DROITS DES UTILISATEURS */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Vos droits
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Conformément au RGPD, vous disposez notamment des droits suivants :
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
                  color={currentTheme.colors.secondary}
                  style={styles.listIcon}
                />
                <Text
                  style={[styles.listText, { color: currentTheme.colors.textSecondary }]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* COOKIES */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Utilisation des cookies
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Les cookies nous aident à améliorer votre navigation et à analyser
              l’utilisation de la plateforme. Vous pouvez les gérer via les paramètres
              de votre appareil.
            </Text>
          </Animated.View>

          {/* MISES À JOUR DE LA POLITIQUE */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Mises à jour de la politique
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Cette politique de confidentialité peut être modifiée pour refléter les
              évolutions de nos pratiques ou de la législation en vigueur. Nous vous
              informerons de toute mise à jour majeure.
            </Text>
          </Animated.View>

          {/* CONTACT */}
          <Animated.View entering={FadeInUp.delay(1800)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.secondary }]}>
              Contact
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Pour toute question relative à la gestion de vos données personnelles ou
              à cette politique, contactez-nous à :
            </Text>
            <Text
              style={[styles.contactEmail, { color: currentTheme.colors.secondary }]}
            >
              📧 privacy@challengeties.com
            </Text>
          </Animated.View>

          {/* MESSAGE FINAL */}
          <Animated.View entering={FadeInUp.delay(2000)} style={styles.footer}>
            <LinearGradient
              colors={[currentTheme.colors.overlay, currentTheme.colors.border]}
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={[styles.footerText, { color: currentTheme.colors.textPrimary }]}
              >
                <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
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
    marginTop: SPACING,
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
    position: "relative",
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  contentContainer: {
    paddingHorizontal: SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
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
  logo: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sectionTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "justify",
    marginBottom: SPACING,
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING,
  },
  listIcon: {
    marginRight: SPACING,
    marginTop: normalizeSize(2),
  },
  listText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
  },
  contactEmail: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: SPACING,
  },
  footer: {
    marginTop: SPACING,
    marginBottom: SPACING * 2,
    borderRadius: normalizeSize(15),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
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