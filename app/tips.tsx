import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import BackButton from "../components/BackButton";
import designSystem from "../theme/designSystem";

const { lightTheme } = designSystem;
const currentTheme = lightTheme;
const { width } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = width / 375;
  return Math.round(size * scale);
};

const conseils = [
  {
    id: "1",
    title: "Fixez des objectifs SMART",
    description:
      "Des objectifs Spécifiques, Mesurables, Atteignables, Réalistes et Temporels vous permettent de rester concentré et discipliné.",
    icon: "checkmark-circle-outline",
  },
  {
    id: "2",
    title: "Adoptez la régularité",
    description:
      "Consacrez un moment fixe chaque jour à votre objectif. De petites actions quotidiennes mènent à de grands résultats.",
    icon: "time-outline",
  },
  {
    id: "3",
    title: "Suivez tout",
    description:
      "Utilisez le suivi quotidien et les statistiques de ChallengeTies pour surveiller vos progrès, remporter des trophées et maintenir votre élan.",
    icon: "analytics-outline",
  },
  {
    id: "4",
    title: "Trouvez du soutien communautaire",
    description:
      "Connectez-vous avec des personnes partageant les mêmes idées, invitez vos amis, partagez vos expériences et restez motivés ensemble.",
    icon: "people-outline",
  },
  {
    id: "5",
    title: "Récompensez-vous fréquemment",
    description:
      "Célébrez chaque étape — courtes séries, grands succès, nouveaux trophées — pour nourrir votre motivation à long terme.",
    icon: "gift-outline",
  },
  {
    id: "6",
    title: "Variez les plaisirs",
    description:
      "Luttez contre l'ennui en essayant de nouveaux défis, en explorant différentes catégories et en pimentant vos objectifs.",
    icon: "flask-outline",
  },
  {
    id: "7",
    title: "Invitez un ami",
    description:
      "Les défis deviennent plus faciles (et plus amusants) avec un ami. Envoyez des invitations pour atteindre vos objectifs ensemble !",
    icon: "person-add-outline",
  },
  {
    id: "8",
    title: "Visualisez le succès",
    description:
      "Imaginez le résultat final — des indices visuels et des rappels quotidiens gardent votre concentration au top.",
    icon: "eye-outline",
  },
  {
    id: "9",
    title: "Restez positif",
    description:
      "Même en cas d'échec, rappelez-vous que chaque jour est un nouveau départ. Apprenez de vos erreurs et continuez d'avancer.",
    icon: "sunny-outline",
  },
];

export default function Conseils() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bouton Retour */}
        <BackButton />

        {/* En-tête */}
        <View style={styles.headerContainer}>
          <Image
            source={require("../assets/images/Challenge.png")}
            style={styles.logo}
          />
          <Text style={styles.headerText}>Dynamisez votre parcours</Text>
          <Text style={styles.subHeaderText}>
            Des conseils pratiques pour rester inspiré, atteindre vos objectifs
            et remporter des trophées !
          </Text>
        </View>

        {/* Section des conseils */}
        <View style={styles.tipsContainer}>
          {conseils.map((conseil, index) => (
            <Animated.View
              key={conseil.id}
              entering={FadeInUp.delay(index * 100)}
              style={styles.tipCard}
            >
              <Ionicons
                name={conseil.icon as keyof typeof Ionicons.glyphMap}
                size={32}
                color={currentTheme.colors.secondary}
                style={styles.tipIcon}
              />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{conseil.title}</Text>
                <Text style={styles.tipDescription}>{conseil.description}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Plus de questions ou besoin d'une aide personnalisée ?{" "}
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL("mailto:support@challengeme.com")}
            >
              Contactez-nous
            </Text>
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60, // Augmenté pour éviter que le pied de page soit coupé
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
  headerText: {
    fontSize: normalizeFont(26),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.secondary,
    textAlign: "center",
    marginBottom: 5,
  },
  subHeaderText: {
    fontSize: normalizeFont(15),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    textAlign: "center",
    marginHorizontal: 10,
    lineHeight: 20,
  },
  tipsContainer: {
    marginVertical: 10,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  tipIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: normalizeFont(18),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.secondary,
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: normalizeFont(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    textAlign: "center",
  },
  footerLink: {
    color: currentTheme.colors.secondary,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
});
