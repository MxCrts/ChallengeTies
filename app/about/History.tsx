import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  SafeAreaView,
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

export default function History() {
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
          <BackButton color={currentTheme.colors.secondary} />
            <Animated.Text
              entering={FadeInUp.duration(600)}
              style={[styles.title, { color: currentTheme.colors.textPrimary }]}
            >
              Notre Histoire
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

          {/* Introduction */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                ChallengeTies
              </Text>{" "}
              est né d'une vision puissante : unir les individus dans un élan collectif pour
              se surpasser et atteindre leurs objectifs. Dans un monde saturé de
              distractions, nous avons créé une plateforme inspirante où chaque défi est une
              opportunité de devenir plus fort, plus résilient et de découvrir son potentiel
              caché.
            </Text>
          </Animated.View>

          {/* Fonctionnalités clés */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              Nos Fonctionnalités Clés 🔥
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              {[
                {
                  icon: "flame-outline" as const,
                  text: "Défis Spéciaux : Des challenges uniques qui stimulent votre détermination, comme '30 jours sans sucre' ou 'Méditation quotidienne'.",
                },
                {
                  icon: "checkmark-circle-outline" as const,
                  text: "Suivi de Progression : Des outils interactifs pour visualiser et célébrer chaque étape de votre parcours.",
                },
                {
                  icon: "create-outline" as const,
                  text: "Défis Personnalisés : La possibilité de créer vos propres challenges, adaptés à vos aspirations.",
                },
                {
                  icon: "people-outline" as const,
                  text: "Communauté Engagée : Un réseau de personnes partageant les mêmes valeurs, toujours prêtes à vous soutenir.",
                },
              ].map((item, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons
                    name={item.icon}
                    size={normalizeSize(20)}
                    color={currentTheme.colors.secondary}
                    style={styles.featureIcon}
                  />
                  <Text
                    style={[styles.featureText, { color: currentTheme.colors.textSecondary }]}
                  >
                    <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                      {item.text.split(":")[0]}
                    </Text>
                    : {item.text.split(":")[1]}
                  </Text>
                </View>
              ))}
            </Text>
          </Animated.View>

          {/* Notre Motivation */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              Notre Motivation 🚀
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Nous croyons fermement que chaque individu possède un potentiel
              extraordinaire. ChallengeTies fournit les outils et l'inspiration nécessaires
              pour oser se lancer, surmonter les obstacles et transformer les rêves en
              réalité. Ensemble, nous formons une communauté soudée où chaque victoire,
              petite ou grande, est célébrée.
            </Text>
          </Animated.View>

          {/* Le Sens du Logo */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              Le Sens du Logo 🎨
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Le logo{" "}
              <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                ChallengeTies
              </Text>{" "}
              incarne l'union, la croissance et l'énergie. Ses formes dynamiques illustrent
              les parcours multiples et interconnectés des challenges, tandis que ses
              couleurs vibrantes symbolisent la passion et l'action. Il représente non
              seulement l'identité de l'application, mais aussi l'ambition collective de se
              dépasser.
            </Text>
          </Animated.View>

          {/* Notre Vision */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              Notre Vision 🌍
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Nous ne sommes pas uniquement une application, nous sommes un mouvement.
              ChallengeTies rassemble une communauté passionnée où chaque défi rapproche
              chacun de la meilleure version de soi-même. Ensemble, nous créons un avenir
              où la réussite est partagée et chaque victoire inspire de nouvelles
              ambitions.
            </Text>
          </Animated.View>

          {/* Les Débuts */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              Les Débuts 📅
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              L'aventure ChallengeTies a commencé modestement, avec une petite équipe
              passionnée et une idée simple : transformer les obstacles quotidiens en
              opportunités de croissance. Des discussions animées, des premières
              itérations et des tests sur le terrain ont posé les bases d'une plateforme
              qui révolutionne l'approche des défis personnels.
            </Text>
          </Animated.View>

          {/* L'Engagement Communautaire */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.secondary }]}>
              L'Engagement Communautaire 🤝
            </Text>
            <Text style={[styles.paragraph, { color: currentTheme.colors.textSecondary }]}>
              Dès le départ, la force de ChallengeTies a été sa communauté. Des milliers
              d'utilisateurs se sont réunis pour se soutenir mutuellement, partager leurs
              réussites et relever ensemble de nouveaux défis. Cet engagement collectif est
              le moteur de notre évolution et continue d'inspirer chaque innovation.
            </Text>
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
                style={[styles.footerText, { color: currentTheme.colors.textPrimary }]}
              >
                <Text style={[styles.boldText, { color: currentTheme.colors.textPrimary }]}>
                  Merci de faire partie de cette aventure !
                </Text>{" "}
                ChallengeTies est votre allié pour transformer chaque défi en une victoire.
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
  subtitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
  },
  paragraph: {
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "justify",
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
    marginTop: normalizeSize(2),
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
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