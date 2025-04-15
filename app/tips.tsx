import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
  SafeAreaView,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext"; // Ajout de useTheme
import { Theme } from "../theme/designSystem"; // Import de l'interface Theme
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
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
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const { theme } = useTheme(); // Ajout de useTheme
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const toggleTip = (id: string) => {
    setExpandedTip(expandedTip === id ? null : id);
  };

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerWrapper}>
          <CustomHeader title="Astuces" />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.headerContainer}
          >
            <Image
              source={require("../assets/images/Challenge.png")}
              style={styles.logo}
            />
            <Text
              style={[
                styles.subHeaderText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Des conseils pratiques pour rester inspiré, atteindre vos
              objectifs et remporter des trophées !
            </Text>
          </Animated.View>

          <View style={styles.tipsContainer}>
            {conseils.map((conseil, index) => (
              <Animated.View
                key={conseil.id}
                entering={FadeInUp.delay(200 + index * 100)}
              >
                <TouchableOpacity
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: currentTheme.colors.cardBackground,
                      borderColor: currentTheme.colors.border,
                    },
                    expandedTip === conseil.id && styles.tipCardExpanded,
                  ]}
                  onPress={() => toggleTip(conseil.id)}
                >
                  <Ionicons
                    name={conseil.icon as keyof typeof Ionicons.glyphMap}
                    size={normalizeSize(32)}
                    color={currentTheme.colors.secondary}
                    style={styles.tipIcon}
                  />
                  <View style={styles.tipContent}>
                    <Text
                      style={[
                        styles.tipTitle,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {conseil.title}
                    </Text>
                    <Text
                      style={[
                        styles.tipDescription,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                      numberOfLines={expandedTip === conseil.id ? 0 : 2}
                    >
                      {conseil.description}
                    </Text>
                    <TouchableOpacity
                      style={styles.readMoreButton}
                      onPress={() => toggleTip(conseil.id)}
                    >
                      <Text
                        style={[
                          styles.readMoreText,
                          { color: currentTheme.colors.primary },
                        ]}
                      >
                        {expandedTip === conseil.id ? "Réduire" : "Lire plus"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(1000)} style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Plus de questions ou besoin d'une aide personnalisée ?{" "}
              <Text
                style={[
                  styles.footerLink,
                  { color: currentTheme.colors.secondary },
                ]}
                onPress={() =>
                  Linking.openURL("mailto:support@challengeme.com")
                }
              >
                Contactez-nous
              </Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() =>
                Linking.openURL(
                  "sms:&body=Check out these awesome tips from ChallengeTies!"
                )
              }
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary} // Texte blanc pour contraste
              />
              <Text
                style={[
                  styles.shareButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                Partager les astuces
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.08,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  logo: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    resizeMode: "contain",
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  subHeaderText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular", // Remplace par la fonte directe
    textAlign: "center",
    marginHorizontal: SCREEN_WIDTH * 0.05,
    lineHeight: normalizeFont(22),
  },
  tipsContainer: {
    marginVertical: SCREEN_HEIGHT * 0.02,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(15),
    padding: normalizeSize(16),
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
  },
  tipCardExpanded: {
    opacity: 0.95, // Légère transparence pour effet premium
  },
  tipIcon: {
    marginRight: normalizeSize(14),
    marginTop: normalizeSize(2),
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold", // Remplace par la fonte directe
    marginBottom: normalizeSize(6),
  },
  tipDescription: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular", // Remplace par la fonte directe
    lineHeight: normalizeFont(20),
  },
  readMoreButton: {
    marginTop: normalizeSize(8),
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular", // Remplace par la fonte directe
    textDecorationLine: "underline",
  },
  footer: {
    marginTop: SCREEN_HEIGHT * 0.03,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular", // Remplace par la fonte directe
    textAlign: "center",
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  footerLink: {
    fontFamily: "Comfortaa_700Bold", // Remplace par la fonte directe
    textDecorationLine: "underline",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(20),
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(5),
    elevation: 5,
  },
  shareButtonText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold", // Remplace par la fonte directe
    marginLeft: normalizeSize(8),
  },
});
