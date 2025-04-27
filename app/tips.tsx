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
  StatusBar,
  Share,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

// Constante SPACING pour cohérence avec focus.tsx
const SPACING = 15;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

// Typage des icônes pour éviter keyof typeof
type IconName =
  | "checkmark-circle-outline"
  | "time-outline"
  | "analytics-outline"
  | "people-outline"
  | "gift-outline"
  | "flask-outline"
  | "person-add-outline"
  | "eye-outline"
  | "sunny-outline";

interface Conseil {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

const conseils: Conseil[] = [
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const toggleTip = (id: string) => {
    setExpandedTip(expandedTip === id ? null : id);
  };

  const handleContact = async () => {
    const url = "mailto:support@challengeme.com";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn("Impossible d'ouvrir l'application mail");
      }
    } catch (error) {
      console.error("Erreur lors de l'ouverture du mail:", error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: "Check out these awesome tips from ChallengeTies!",
      });
    } catch (error) {
      console.error("Erreur lors du partage:", error);
    }
  };

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerWrapper}>
          <CustomHeader title="Astuces" />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: SPACING }}
          accessibilityRole="list"
          accessibilityLabel="Liste des astuces"
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.headerContainer}
          >
            {require("../assets/images/Challenge.png") ? (
              <Image
                source={require("../assets/images/Challenge.png")}
                style={styles.logo}
              />
            ) : (
              <LinearGradient
                colors={[currentTheme.colors.border, currentTheme.colors.overlay]}
                style={styles.logoPlaceholder}
              >
                <Ionicons
                  name="image-outline"
                  size={normalizeSize(60)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[styles.placeholderText, { color: currentTheme.colors.textSecondary }]}
                >
                  Image non disponible
                </Text>
              </LinearGradient>
            )}
            <Text
              style={[styles.subHeaderText, { color: currentTheme.colors.textSecondary }]}
            >
              Des conseils pratiques pour rester inspiré, atteindre vos objectifs et
              remporter des trophées !
            </Text>
          </Animated.View>

          <View style={styles.tipsContainer}>
            {conseils.map((conseil, index) => (
              <Animated.View
                key={conseil.id}
                entering={FadeInUp.delay(200 + index * 50)} // Délai réduit pour fluidité
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
                  accessibilityLabel={`Afficher les détails de l'astuce ${conseil.title}`}
                  testID={`tip-card-${conseil.id}`}
                >
                  <Ionicons
                    name={conseil.icon}
                    size={normalizeSize(32)}
                    color={currentTheme.colors.secondary}
                    style={styles.tipIcon}
                  />
                  <View style={styles.tipContent}>
                    <Text
                      style={[styles.tipTitle, { color: currentTheme.colors.secondary }]}
                    >
                      {conseil.title}
                    </Text>
                    <Text
                      style={[styles.tipDescription, { color: currentTheme.colors.textSecondary }]}
                      numberOfLines={expandedTip === conseil.id ? 0 : 2}
                    >
                      {conseil.description}
                    </Text>
                    <TouchableOpacity
                      style={styles.readMoreButton}
                      onPress={() => toggleTip(conseil.id)}
                      accessibilityLabel={
                        expandedTip === conseil.id
                          ? `Réduire l'astuce ${conseil.title}`
                          : `Lire plus sur l'astuce ${conseil.title}`
                      }
                      testID={`read-more-${conseil.id}`}
                    >
                      <Text
                        style={[styles.readMoreText, { color: currentTheme.colors.primary }]}
                      >
                        {expandedTip === conseil.id ? "Réduire" : "Lire plus"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.footer}>
            <Text
              style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}
            >
              Plus de questions ou besoin d'une aide personnalisée ?{" "}
              <Text
                style={[styles.footerLink, { color: currentTheme.colors.secondary }]}
                onPress={handleContact}
                accessibilityLabel="Contacter le support"
                testID="contact-link"
              >
                Contactez-nous
              </Text>
            </Text>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleShare}
              accessibilityLabel="Partager les astuces"
              testID="share-button"
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary}
              />
              <Text
                style={[styles.shareButtonText, { color: currentTheme.colors.textPrimary }]}
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
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
  },
  logo: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    resizeMode: "contain",
    marginBottom: SPACING,
  },
  logoPlaceholder: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
  },
  placeholderText: {
    marginTop: SPACING,
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  subHeaderText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginHorizontal: SPACING,
    lineHeight: normalizeFont(22),
  },
  tipsContainer: {
    marginVertical: SPACING,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(15),
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
  },
  tipCardExpanded: {
    opacity: 0.95,
  },
  tipIcon: {
    marginRight: SPACING,
    marginTop: normalizeSize(2),
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(6),
  },
  tipDescription: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalizeFont(20),
  },
  readMoreButton: {
    marginTop: SPACING / 2,
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },
  footer: {
    marginTop: SPACING * 2,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING,
  },
  footerLink: {
    fontFamily: "Comfortaa_700Bold",
    textDecorationLine: "underline",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 1.5,
    paddingHorizontal: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(5),
    elevation: 5,
  },
  shareButtonText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: SPACING / 2,
  },
});