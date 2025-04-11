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
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { lightTheme } = designSystem;
const currentTheme = lightTheme;
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
            <Text style={styles.subHeaderText}>
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
                    <Text style={styles.tipTitle}>{conseil.title}</Text>
                    <Text
                      style={styles.tipDescription}
                      numberOfLines={expandedTip === conseil.id ? 0 : 2}
                    >
                      {conseil.description}
                    </Text>
                    <TouchableOpacity
                      style={styles.readMoreButton}
                      onPress={() => toggleTip(conseil.id)}
                    >
                      <Text style={styles.readMoreText}>
                        {expandedTip === conseil.id ? "Réduire" : "Lire plus"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(1000)} style={styles.footer}>
            <Text style={styles.footerText}>
              Plus de questions ou besoin d'une aide personnalisée ?{" "}
              <Text
                style={styles.footerLink}
                onPress={() =>
                  Linking.openURL("mailto:support@challengeme.com")
                }
              >
                Contactez-nous
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() =>
                Linking.openURL(
                  "sms:&body=Check out these awesome tips from ChallengeTies!"
                )
              }
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color="#fff"
              />
              <Text style={styles.shareButtonText}>Partager les astuces</Text>
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
    marginTop: SCREEN_HEIGHT * 0.04, // Descend légèrement le CustomHeader
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
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
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
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: normalizeSize(15),
    padding: normalizeSize(16),
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
    borderColor: currentTheme.colors.border || "#e3e2e9",
  },
  tipCardExpanded: {
    backgroundColor: `${currentTheme.colors.cardBackground}F0`, // Légère transparence pour effet premium
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
    fontFamily: currentTheme.typography.title.fontFamily,
    color: currentTheme.colors.secondary,
    marginBottom: normalizeSize(6),
  },
  tipDescription: {
    fontSize: normalizeFont(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    lineHeight: normalizeFont(20),
  },
  readMoreButton: {
    marginTop: normalizeSize(8),
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontSize: normalizeFont(12),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.primary,
    textDecorationLine: "underline",
  },
  footer: {
    marginTop: SCREEN_HEIGHT * 0.03,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
    textAlign: "center",
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  footerLink: {
    color: currentTheme.colors.secondary,
    fontFamily: currentTheme.typography.title.fontFamily,
    textDecorationLine: "underline",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: currentTheme.colors.primary,
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
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#fff",
    marginLeft: normalizeSize(8),
  },
});
