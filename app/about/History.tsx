import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";

const { width } = Dimensions.get("window");

export default function About() {
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
        {/* ✅ LOGO ANIMÉ */}
        <Animated.View
          entering={FadeInUp.duration(800)}
          style={styles.logoContainer}
        >
          <Image
            source={require("../../assets/images/logoFinal.png")}
            style={styles.logo}
          />
        </Animated.View>

        {/* ✅ NOTRE HISTOIRE */}
        <Animated.Text entering={FadeInUp.delay(200)} style={styles.title}>
          Notre Histoire 📖
        </Animated.Text>
        <Text style={styles.paragraph}>
          **ChallengeTies** est né d'une idée simple mais puissante : permettre
          à chacun d'atteindre ses objectifs grâce à la **force de la
          communauté**. Dans un monde rempli de distractions, nous avons imaginé
          une **plateforme motivante**, où le dépassement de soi et le partage
          sont au cœur de l'expérience. Ce qui a commencé comme un rêve est
          aujourd’hui une **révolution du challenge personnel**.
        </Text>

        {/* ✅ FONCTIONNALITÉS CLÉS */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
          <Text style={styles.subtitle}>Nos Fonctionnalités Clés 🔥</Text>
          <Text style={styles.paragraph}>
            ✅ **Défis Spéciaux** : Relevez des challenges uniques comme "30
            jours sans sucre" ou "Méditation quotidienne".{"\n"}✅ **Suivi de
            Progression** : Analysez vos succès avec des **graphiques
            interactifs** et des statistiques motivantes.{"\n"}✅ **Défis
            Personnalisés** : Créez vos propres défis adaptés à vos objectifs.
            {"\n"}✅ **Communauté Engagée** : Trouvez du soutien et échangez
            avec des challengers du monde entier !
          </Text>
        </Animated.View>

        {/* ✅ NOTRE MOTIVATION */}
        <Animated.View entering={FadeInUp.delay(600)} style={styles.card}>
          <Text style={styles.subtitle}>Notre Motivation 🚀</Text>
          <Text style={styles.paragraph}>
            Nous croyons fermement que **chaque personne possède un potentiel
            incroyable** en elle. ChallengeTies vous offre **les outils et
            l’accompagnement nécessaires** pour que vous **osiez passer à
            l’action**. Ensemble, nous célébrons les **petites victoires**,
            surmontons les **obstacles** et avançons **vers une meilleure
            version de nous-mêmes**.
          </Text>
        </Animated.View>

        {/* ✅ SIGNIFICATION DU LOGO */}
        <Animated.View entering={FadeInUp.delay(800)} style={styles.card}>
          <Text style={styles.subtitle}>Pourquoi ce Logo ? 🎨</Text>
          <Text style={styles.paragraph}>
            Le logo **ChallengeTies** représente **l’union, la croissance et la
            motivation**. Les formes dynamiques illustrent **les chemins
            entrecroisés des challenges**, tandis que les couleurs vives
            symbolisent **l’énergie et l’action**. Ce n'est pas juste un logo,
            c'est un **symbole d'ambition et de réussite**. ✨
          </Text>
        </Animated.View>

        {/* ✅ NOTRE VISION */}
        <Animated.View entering={FadeInUp.delay(1000)} style={styles.card}>
          <Text style={styles.subtitle}>Notre Vision 🌍</Text>
          <Text style={styles.paragraph}>
            Nous ne voulons pas être **juste une application**. Nous voulons
            créer **un mouvement**, une **philosophie de vie** où **challenges
            et accomplissements** vont de pair. ChallengeTies, c'est **un réseau
            où chaque défi vous rapproche de votre potentiel**. **Ensemble, nous
            sommes plus forts. Ensemble, nous allons plus loin.**
          </Text>
        </Animated.View>

        {/* ✅ MESSAGE FINAL */}
        <Animated.View entering={FadeInUp.delay(1200)} style={styles.footer}>
          <Text style={styles.footerText}>
            **Merci de faire partie de cette aventure !** **ChallengeTies est là
            pour vous guider vers votre succès.** 🎯🔥
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
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
    resizeMode: "contain",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 15,
  },
  subtitle: {
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
    marginBottom: 10,
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
