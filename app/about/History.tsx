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
import BackButton from "../../components/BackButton";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function History() {
  return (
    <LinearGradient
      colors={["#e3e2e9", "#f5f5f5"] as const} // Typage inline corrigé
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
              Notre Histoire
            </Animated.Text>
          </View>

          {/* Logo animé */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.logoContainer}
          >
            <LinearGradient
              colors={["#e3701e", "#f59e0b"] as const} // Typage inline
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
            <Text style={styles.paragraph}>
              <Text style={styles.boldText}>ChallengeTies</Text> est né d'une
              vision puissante : unir les individus dans un élan collectif pour
              se surpasser et atteindre leurs objectifs. Dans un monde saturé de
              distractions, nous avons créé une plateforme inspirante où chaque
              défi est une opportunité de devenir plus fort, plus résilient et
              de découvrir son potentiel caché.
            </Text>
          </Animated.View>

          {/* Fonctionnalités clés */}
          <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
            <Text style={styles.subtitle}>Nos Fonctionnalités Clés 🔥</Text>
            <Text style={styles.paragraph}>
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
                    color="#e3701e"
                    style={styles.featureIcon}
                  />
                  <Text style={styles.featureText}>
                    <Text style={styles.boldText}>
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
            <Text style={styles.subtitle}>Notre Motivation 🚀</Text>
            <Text style={styles.paragraph}>
              Nous croyons fermement que chaque individu possède un potentiel
              extraordinaire. ChallengeTies fournit les outils et l'inspiration
              nécessaires pour oser se lancer, surmonter les obstacles et
              transformer les rêves en réalité. Ensemble, nous formons une
              communauté soudée où chaque victoire, petite ou grande, est
              célébrée.
            </Text>
          </Animated.View>

          {/* Le Sens du Logo */}
          <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
            <Text style={styles.subtitle}>Le Sens du Logo 🎨</Text>
            <Text style={styles.paragraph}>
              Le logo <Text style={styles.boldText}>ChallengeTies</Text> incarne
              l'union, la croissance et l'énergie. Ses formes dynamiques
              illustrent les parcours multiples et interconnectés des
              challenges, tandis que ses couleurs vibrantes symbolisent la
              passion et l'action. Il représente non seulement l'identité de
              l'application, mais aussi l'ambition collective de se dépasser.
            </Text>
          </Animated.View>

          {/* Notre Vision */}
          <Animated.View entering={FadeInUp.delay(1200)} style={styles.card}>
            <Text style={styles.subtitle}>Notre Vision 🌍</Text>
            <Text style={styles.paragraph}>
              Nous ne sommes pas uniquement une application, nous sommes un
              mouvement. ChallengeTies rassemble une communauté passionnée où
              chaque défi rapproche chacun de la meilleure version de soi-même.
              Ensemble, nous créons un avenir où la réussite est partagée et
              chaque victoire inspire de nouvelles ambitions.
            </Text>
          </Animated.View>

          {/* Les Débuts */}
          <Animated.View entering={FadeInUp.delay(1400)} style={styles.card}>
            <Text style={styles.subtitle}>Les Débuts 📅</Text>
            <Text style={styles.paragraph}>
              L'aventure ChallengeTies a commencé modestement, avec une petite
              équipe passionnée et une idée simple : transformer les obstacles
              quotidiens en opportunités de croissance. Des discussions animées,
              des premières itérations et des tests sur le terrain ont posé les
              bases d'une plateforme qui révolutionne l'approche des défis
              personnels.
            </Text>
          </Animated.View>

          {/* L'Engagement Communautaire */}
          <Animated.View entering={FadeInUp.delay(1600)} style={styles.card}>
            <Text style={styles.subtitle}>L'Engagement Communautaire 🤝</Text>
            <Text style={styles.paragraph}>
              Dès le départ, la force de ChallengeTies a été sa communauté. Des
              milliers d'utilisateurs se sont réunis pour se soutenir
              mutuellement, partager leurs réussites et relever ensemble de
              nouveaux défis. Cet engagement collectif est le moteur de notre
              évolution et continue d'inspirer chaque innovation.
            </Text>
          </Animated.View>

          {/* Message final */}
          <Animated.View entering={FadeInUp.delay(1800)} style={styles.footer}>
            <LinearGradient
              colors={["#E5E7EB", "#D1D5DB"] as const} // Typage inline
              style={styles.footerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.footerText}>
                <Text style={styles.boldText}>
                  Merci de faire partie de cette aventure !
                </Text>{" "}
                ChallengeTies est votre allié pour transformer chaque défi en
                une victoire.
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
  subtitle: {
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
  },
  boldText: {
    fontFamily: "Comfortaa_700Bold",
    color: "#060606",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: normalizeSize(10),
  },
  featureIcon: {
    marginRight: normalizeSize(10),
    marginTop: normalizeSize(2),
  },
  featureText: {
    flex: 1,
    fontSize: normalizeSize(16),
    lineHeight: normalizeSize(24),
    fontFamily: "Comfortaa_400Regular",
    color: "#4B5563",
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
