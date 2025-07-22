import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  Image,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import designSystem, { Theme } from "@/theme/designSystem";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import CustomHeader from "@/components/CustomHeader";
import { query, collection, where, getDocs } from "firebase/firestore";
import type { ChallengeHelperContent } from "@/services/helperService";

const SPACING = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface ChallengeMetadata {
  title: string;
}

export default function ChallengeHelperScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const [loading, setLoading] = useState(true);
  const [helperData, setHelperData] = useState<ChallengeHelperContent | null>(null);
  const [metadata, setMetadata] = useState<ChallengeMetadata>({ title: "" });

 useEffect(() => {
  const loadContent = async () => {
    try {
      if (typeof id !== "string") return;

      console.log("🔍 Chargement du helper pour chatId:", id);

      // Étape 1 : récupérer le helper lié à ce chatId
      const helperQuery = query(
        collection(db, "challenge-helpers"),
        where("chatId", "==", id)
      );
      const helperSnapshot = await getDocs(helperQuery);

      if (helperSnapshot.empty) {
        console.warn("⚠️ Aucun helper trouvé pour le chatId:", id);
        return;
      }

      const helperDoc = helperSnapshot.docs[0];
      const helperData = helperDoc.data() as ChallengeHelperContent;
      setHelperData(helperData);
      console.log("✅ Données helper récupérées:", helperData);

      // Étape 2 : récupérer le challenge qui a ce chatId
      const challengeQuery = query(
        collection(db, "challenges"),
        where("chatId", "==", id)
      );
      const challengeSnapshot = await getDocs(challengeQuery);

      if (challengeSnapshot.empty) {
        console.warn("⚠️ Aucun challenge trouvé avec chatId:", id);
        return;
      }

      const challengeData = challengeSnapshot.docs[0].data();
      const title =
        typeof challengeData.title === "string" ? challengeData.title : "Sans titre";
      const imageURL =
        typeof challengeData.imageUrl === "string" ? challengeData.imageUrl : "";

      setMetadata({ title });
      console.log("✅ Titre du challenge:", title);
console.log("🖼️ imageHelper:", helperData?.imageHelper);

    } catch (error) {
      console.error("❌ Erreur chargement contenu challenge-helper:", error);
    } finally {
      setLoading(false);
    }
  };

  loadContent();
}, [id]);


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  if (!helperData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>
          {t("challengeHelper.noData")}
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <CustomHeader title={metadata.title || "..."} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {helperData?.imageHelper ? (
  <Image
  source={{ uri: helperData.imageHelper }}
  style={styles.image}
  resizeMode="cover"
/>
) : null}

          <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { backgroundColor: currentTheme.colors.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary }]}>🎓 {t("challengeHelper.explanation")}</Text>
            <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>{helperData.miniCours}</Text>
          </Animated.View>

          {helperData.exemples?.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[styles.card, { backgroundColor: currentTheme.colors.cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary }]}>💡 {t("challengeHelper.examples")}</Text>
              {helperData.exemples.map((ex, i) => (
                <Text key={i} style={[styles.text, { color: currentTheme.colors.textSecondary, marginBottom: 8 }]}>• {ex}</Text>
              ))}
            </Animated.View>
          )}

          {helperData.ressources?.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(500)} style={[styles.card, { backgroundColor: currentTheme.colors.cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary }]}>🔗 {t("challengeHelper.resources")}</Text>
              {helperData.ressources.map((res, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(res.url)}>
                  <Text style={[styles.linkText, { color: currentTheme.colors.secondary }]}>• {res.title}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}>📩 {t("challengeHelper.suggestion")}</Text>
            <Text style={[styles.footerLink, { color: currentTheme.colors.secondary }]} onPress={() => Linking.openURL("mailto:support@challengeties.app")}>support@challengeties.app</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: SPACING,
    paddingBottom: 100,
  },
  image: {
  width: "100%",
  height: 240,
  marginBottom: SPACING * 1.4,
  resizeMode: "cover", 
},
  card: {
    borderRadius: 18,
    padding: SPACING,
    marginBottom: SPACING * 1.4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: normalizeFont(21),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 12,
  },
  text: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalizeFont(24),
  },
  linkText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
    marginVertical: 6,
  },
  errorText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    paddingHorizontal: SPACING * 2,
  },
  footer: {
    marginTop: SPACING * 2,
    alignItems: "center",
  },
  footerText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 6,
    textAlign: "center",
  },
  footerLink: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
