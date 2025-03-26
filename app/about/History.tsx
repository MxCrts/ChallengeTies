import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";

const { width } = Dimensions.get("window");

export default function History() {
  const { theme } = useTheme();
  const currentTheme =
    theme === "dark" ? designSystem.darkTheme : designSystem.lightTheme;
  // Typage explicite pour garantir que le tableau contient au moins deux couleurs.
  const gradientColors: readonly [string, string] = [
    currentTheme.colors.background,
    currentTheme.colors.cardBackground,
  ];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <BackButton color={currentTheme.colors.primary} />
          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.duration(800)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../assets/images/Challenge.png")}
              style={[styles.logo, { width: width * 0.4, height: width * 0.4 }]}
            />
          </Animated.View>

          {/* Titre */}
          <Animated.Text
            entering={FadeInUp.delay(200)}
            style={[
              styles.title,
              { color: currentTheme.colors.textPrimary || "#1F2937" },
            ]}
          >
            Notre Histoire 📖
          </Animated.Text>

          {/* Texte principal */}
          <Text
            style={[
              styles.paragraph,
              { color: currentTheme.colors.textSecondary || "#4B5563" },
            ]}
          >
            <Text style={styles.boldText}>ChallengeTies</Text> est né d'une
            vision puissante : unir les individus dans un élan collectif pour se
            surpasser et atteindre leurs objectifs. Dans un monde saturé de
            distractions, nous avons créé une plateforme inspirante où chaque
            défi est une opportunité de devenir plus fort, plus résilient et de
            découvrir son potentiel caché.
          </Text>

          {/* Fonctionnalités clés */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              Nos Fonctionnalités Clés 🔥
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              ✅ <Text style={styles.boldText}>Défis Spéciaux</Text> : Des
              challenges uniques qui stimulent votre détermination, comme "30
              jours sans sucre" ou "Méditation quotidienne".{"\n"}✅{" "}
              <Text style={styles.boldText}>Suivi de Progression</Text> : Des
              outils interactifs pour visualiser et célébrer chaque étape de
              votre parcours.{"\n"}✅{" "}
              <Text style={styles.boldText}>Défis Personnalisés</Text> : La
              possibilité de créer vos propres challenges, adaptés à vos
              aspirations.{"\n"}✅{" "}
              <Text style={styles.boldText}>Communauté Engagée</Text> : Un
              réseau de personnes partageant les mêmes valeurs, toujours prêtes
              à vous soutenir.
            </Text>
          </Animated.View>

          {/* Notre Motivation */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              Notre Motivation 🚀
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Nous croyons fermement que chaque individu possède un potentiel
              extraordinaire. ChallengeTies fournit les outils et l'inspiration
              nécessaires pour oser se lancer, surmonter les obstacles et
              transformer les rêves en réalité. Ensemble, nous formons une
              communauté soudée où chaque victoire, petite ou grande, est
              célébrée.
            </Text>
          </Animated.View>

          {/* Le Sens du Logo */}
          <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              Le Sens du Logo 🎨
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Le logo <Text style={styles.boldText}>ChallengeTies</Text> incarne
              l'union, la croissance et l'énergie. Ses formes dynamiques
              illustrent les parcours multiples et interconnectés des
              challenges, tandis que ses couleurs vibrantes symbolisent la
              passion et l'action. Il représente non seulement l'identité de
              l'application, mais aussi l'ambition collective de se dépasser.
            </Text>
          </Animated.View>

          {/* Notre Vision */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              Notre Vision 🌍
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Nous ne sommes pas uniquement une application, nous sommes un
              mouvement. ChallengeTies rassemble une communauté passionnée où
              chaque défi rapproche chacun de la meilleure version de soi-même.
              Ensemble, nous créons un avenir où la réussite est partagée et
              chaque victoire inspire de nouvelles ambitions.
            </Text>
          </Animated.View>

          {/* Les Débuts */}
          <Animated.View entering={FadeInUp.delay(1100)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              Les Débuts 📅
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              L'aventure ChallengeTies a commencé modestement, avec une petite
              équipe passionnée et une idée simple : transformer les obstacles
              quotidiens en opportunités de croissance. Des discussions animées,
              des premières itérations et des tests sur le terrain ont posé les
              bases d'une plateforme qui révolutionne l'approche des défis
              personnels.
            </Text>
          </Animated.View>

          {/* L'Engagement Communautaire */}
          <Animated.View entering={FadeInUp.delay(1300)} style={styles.card}>
            <Text
              style={[styles.subtitle, { color: currentTheme.colors.primary }]}
            >
              L'Engagement Communautaire 🤝
            </Text>
            <Text
              style={[
                styles.paragraph,
                { color: currentTheme.colors.textSecondary || "#4B5563" },
              ]}
            >
              Dès le départ, la force de ChallengeTies a été sa communauté. Des
              milliers d'utilisateurs se sont rassemblés pour se soutenir
              mutuellement, partager leurs réussites et relever ensemble de
              nouveaux défis. Cet engagement collectif est le moteur de notre
              évolution et continue d'inspirer chaque innovation.
            </Text>
          </Animated.View>

          {/* Message final */}
          <Animated.View entering={FadeInUp.delay(1500)} style={styles.footer}>
            <Text style={styles.footerText}>
              <Text style={styles.boldText}>
                Merci de faire partie de cette aventure !
              </Text>{" "}
              ChallengeTies est votre allié pour transformer chaque défi en une
              victoire.
            </Text>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    resizeMode: "contain",
  },
  title: {
    fontSize: 28,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: 15,
  },
  subtitle: {
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
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
