import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import CustomHeader from "@/components/CustomHeader";
import { Image } from "expo-image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeFont = (size: number) => {
  const base = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / base, 0.7), 1.8);
  return Math.round(size * scale);
};

/** Fond orbe premium, non interactif */
const OrbBackground = ({ theme }: { theme: Theme }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Orbe haut-gauche */}
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_WIDTH * 0.95,
          borderRadius: (SCREEN_WIDTH * 0.95) / 2,
          top: -SCREEN_WIDTH * 0.45,
          left: -SCREEN_WIDTH * 0.28,
        },
      ]}
    />

    {/* Orbe bas-droite */}
    <LinearGradient
      colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.1,
          height: SCREEN_WIDTH * 1.1,
          borderRadius: (SCREEN_WIDTH * 1.1) / 2,
          bottom: -SCREEN_WIDTH * 0.55,
          right: -SCREEN_WIDTH * 0.35,
        },
      ]}
    />

    {/* Voile léger pour fusionner */}
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const SPACING = 16;

const getTransString = (tFn: any, key: string, fallback = ""): string => {
  const val = tFn(key, { defaultValue: fallback });
  // si la clé n'existe pas, i18n renvoie souvent la clé elle-même
  if (!val || val === key) return fallback;
  return String(val);
};

const getTransArray = <T = any>(
  tFn: any,
  key: string,
  fallback: T[] = []
): T[] => {
  const val = tFn(key, { returnObjects: true, defaultValue: fallback });
  // si la clé n'existe pas, on obtient souvent 'key' (string) -> pas un array
  return Array.isArray(val) ? (val as T[]) : fallback;
};

export default function ChallengeHelperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // 1) Charger le titre brut de Firestore
  const [docTitle, setDocTitle] = useState("");
  const [loadingTitleDoc, setLoadingTitleDoc] = useState(true);
  useEffect(() => {
    if (!id) return;
    (async () => {
      const q = query(collection(db, "challenges"), where("chatId", "==", id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setDocTitle(typeof data.title === "string" ? data.title : "");
      }
      setLoadingTitleDoc(false);
    })();
  }, [id]);

  // 2) Charger helperData
  const [helperData, setHelperData] = useState<any>(null);
  const [loadingHelper, setLoadingHelper] = useState(true);
  useEffect(() => {
    if (!id) return;
    (async () => {
      const q2 = query(
        collection(db, "challenge-helpers"),
        where("chatId", "==", id)
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        setHelperData(snap2.docs[0].data());
      }
      setLoadingHelper(false);
    })();
  }, [id]);

  // 3) Récupérer le titre traduit depuis le namespace "challenges"
  //    avec fallback sur docTitle
 const title = getTransString(t, `challenges.${id}.title`, docTitle);

  // 4) Contenu traduits
 const miniCours = getTransString(t, `${id}.miniCours`, helperData?.miniCours || "");

const exemples = getTransArray<string>(t, `${id}.exemples`, helperData?.exemples || []);

const ressources = getTransArray<{ title: string; url: string; type?: string }>(
  t,
  `${id}.ressources`,
  helperData?.ressources || []
);

  // 5) Loader global
  const missingMiniCours = miniCours === `${id}.miniCours`;
  if (
    loadingTitleDoc ||
    loadingHelper ||
    !title ||
    missingMiniCours ||
    !helperData
  ) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  // 6) Cache‑bust de l’image
  const rawImage = helperData.imageHelper as string | undefined;
  const imageUri = rawImage
    ? `${rawImage}${rawImage.includes("?") ? "&" : "?"}t=${Date.now()}`
    : null;

  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <OrbBackground theme={currentTheme} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDark ? "light-content" : "dark-content"}
        />
        <CustomHeader title={title} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              cachePolicy="none"
            />
          )}

          {/* Mini‑cours */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            style={[
  styles.card,
  {
    backgroundColor: isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.04)",
    borderColor: isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
  },
]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.primary },
              ]}
            >
              🎓 {t("challengeHelper.explanation")}
            </Text>
            <Text
              style={[styles.text, { color: currentTheme.colors.textSecondary }]}
            >
              {miniCours}
            </Text>
          </Animated.View>

          {/* Exemples */}
          {Array.isArray(exemples) && exemples.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(500)}
              style={[
  styles.card,
  {
    backgroundColor: isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.04)",
    borderColor: isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
  },
]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary },
                ]}
              >
                💡 {t("challengeHelper.examples")}
              </Text>
              {exemples.map((ex, i) => (
                <Text
                  key={i}
                  style={[
                    styles.text,
                    {
                      color: currentTheme.colors.textSecondary,
                      marginBottom: 8,
                    },
                  ]}
                >
                  • {ex}
                </Text>
              ))}
            </Animated.View>
          )}

          {/* Ressources */}
          {Array.isArray(ressources) && ressources.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(400).duration(500)}
              style={[
  styles.card,
  {
    backgroundColor: isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.04)",
    borderColor: isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
  },
]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary },
                ]}
              >
                🔗 {t("challengeHelper.resources")}
              </Text>
              {ressources.map((r, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(r.url)}>
                  <Text
                    style={[
                      styles.linkText,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    • {r.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Suggestion */}
          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              📩 {t("challengeHelper.suggestion")}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL("mailto:support@challengeties.app")}
            >
              <Text
                style={[
                  styles.footerLink,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                support@challengeties.app
              </Text>
            </TouchableOpacity>
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
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },
  scrollContent: {
    padding: SPACING,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
    // Orbes
  orb: {
    position: "absolute",
    opacity: 0.9,
  },

  // Card : fond “glass”, on coupe les grosses ombres (on les gère via la bordure subtile)
  card: {
    borderRadius: 18,
    padding: SPACING,
    marginBottom: SPACING * 1.4,
    // kill heavy shadows
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  image: {
    width: "100%",
    height: 240,
    borderRadius: 18,
    marginBottom: SPACING * 1.4,
    backgroundColor: "#ccc",
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
