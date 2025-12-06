import React, { useEffect, useState, useCallback } from "react";
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
  RefreshControl,
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
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Share } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 16;

type HelperResource = { title: string; url: string; type?: string };

function truncate(s: string, n = 180) {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n - 1).trim() + "…" : clean;
}

function buildHelperShare({
  id,
  title,
  mini,
}: {
  id: string;
  title: string;
  mini: string;
}) {
  const url = `https://challengeties.app/challenge-helper/${encodeURIComponent(
    id
  )}?utm_source=app&utm_medium=share&utm_campaign=helper`;
  const tagline = "Got a minute? Get a skill! ⚡";
  const header = `⭐ ${title}`;
  const body = truncate(mini, 220);
  const message = `${header}\n\n${body}\n\n${tagline}\n${url}`;
  return { message, url };
}

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

const getTransString = (tFn: any, key: string, fallback = ""): string => {
  const val = tFn(key, { defaultValue: fallback });
  if (!val || val === key) return fallback;
  return String(val);
};

// On garde le helper générique même si on ne l’utilise plus pour exemples/ressources
const getTransArray = <T = any>(
  tFn: any,
  key: string,
  fallback: T[] = []
): T[] => {
  const val = tFn(key, { returnObjects: true, defaultValue: fallback });
  return Array.isArray(val) ? (val as T[]) : fallback;
};

export default function ChallengeHelperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [docTitle, setDocTitle] = useState("");
  const [helperData, setHelperData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [softError, setSoftError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setSoftError(null);
    try {
      const q = query(collection(db, "challenges"), where("chatId", "==", id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as any;
        setDocTitle(typeof data?.title === "string" ? data.title : "");
      } else {
        setDocTitle("");
      }

      const q2 = query(
        collection(db, "challenge-helpers"),
        where("chatId", "==", id)
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        setHelperData(snap2.docs[0].data());
      } else {
        setHelperData(null);
      }
    } catch (e) {
      setSoftError("load_failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchAll();
  }, [id, fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const title = getTransString(t, `challenges.${id}.title`, docTitle);

  // miniCours : on garde ta logique actuelle (fallback Firestore si pas de clé i18n)
   // miniCours : on garde ta logique actuelle (fallback Firestore si pas de clé i18n)
  const miniCours = getTransString(
    t,
    `${id}.miniCours`,
    helperData?.miniCours || ""
  );

    // ✅ EXEMPLES — priorité i18n, fallback Firestore
  const buildExemples = (): string[] => {
    // 1. Essai direct : tableau / objet complet (cas normal i18n)
    const raw = t(`${id}.exemples`, {
      returnObjects: true,
    }) as unknown;

    if (Array.isArray(raw)) {
      return raw.map((v) => String(v));
    }

    if (raw && typeof raw === "object") {
      return Object.values(raw).map((v) => String(v));
    }

    // 2. Cas où i18next a "applati" en id.exemples.0, id.exemples.1, etc.
    const collected: string[] = [];
    for (let i = 0; i < 10; i++) {
      const val = t(`${id}.exemples.${i}`, {
        defaultValue: "",
      }) as string;

      if (!val || val === `${id}.exemples.${i}`) {
        break;
      }
      collected.push(val);
    }

    if (collected.length > 0) {
      return collected;
    }

    // 3. Dernier recours : Firestore (FR)
    if (Array.isArray(helperData?.exemples)) {
      return helperData.exemples as string[];
    }

    return [];
  };

    // ✅ RESSOURCES — priorité i18n, fallback Firestore
   // ✅ RESSOURCES — utilise UNIQUEMENT la langue courante (sans fallback i18n)
    // ✅ RESSOURCES — utilise la langue courante, puis sa base (it-IT → it), sans fallback FR
  const buildRessources = (): HelperResource[] => {
    // Namespace principal (souvent "translation")
    const nsOption = i18n.options?.defaultNS || i18n.options?.ns || "translation";
    const ns = Array.isArray(nsOption) ? nsOption[0] : nsOption;

    // On teste d'abord la langue exacte (ex: "it-IT"), puis sa base ("it")
    const langCandidates: string[] = [];
    if (i18n.language) langCandidates.push(i18n.language);
    const base = i18n.language?.split?.("-")?.[0];
    if (base && base !== i18n.language) langCandidates.push(base);

    let raw: unknown = undefined;

    for (const lang of langCandidates) {
      const res = i18n.getResource(lang, ns as string, `${id}.ressources`);
      if (res) {
        raw = res;
        break;
      }
    }

    let items: any[] = [];

    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === "object") {
      // Cas objet indexé { "0": {...}, "1": {...} }
      items = Object.values(raw);
    }

    const mapped: HelperResource[] = items
      .map((item) => {
        if (!item) return null;

        // Sécurité si un jour c'est juste une string
        if (typeof item === "string") {
          return {
            title: item,
            url: item,
          } as HelperResource;
        }

        const title = String((item as any).title ?? "").trim();
        const url = String((item as any).url ?? "").trim();
        const type = (item as any).type
          ? String((item as any).type)
          : undefined;

        if (!url) return null;

        return { title, url, type };
      })
      .filter(Boolean) as HelperResource[];

    // ✅ Si on a trouvé des ressources dans la langue courante / base → on les utilise
    if (mapped.length > 0) {
      return mapped;
    }

    // ♻️ Fallback final : Firestore (ancienne source FR)
    if (Array.isArray(helperData?.ressources)) {
      return helperData.ressources as HelperResource[];
    }

    return [];
  };


  const exemples: string[] = buildExemples();

  // ✅ RESSOURCES — on laisse Firestore tranquille (FR/EN OK pour toi)
  const ressources: HelperResource[] = buildRessources();


  const missingMiniCours = !miniCours || !miniCours.trim();



  if (loading || !title || missingMiniCours || !helperData) {
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.colors.primary}
              colors={[currentTheme.colors.primary]}
              progressBackgroundColor={
                isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"
              }
            />
          }
        >
          {imageUri && (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => {});
                if (await Linking.canOpenURL(imageUri)) Linking.openURL(imageUri);
              }}
              accessibilityRole="imagebutton"
              accessibilityLabel={t("challengeHelper.openImage", {
                defaultValue: "Ouvrir l’illustration",
              })}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                contentFit="cover"
                transition={200}
                cachePolicy="none"
              />
            </TouchableOpacity>
          )}

          {/* Actions rapides */}
          <View style={styles.actionsRow}>
            {/* Partager (message + lien profond) */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { borderColor: currentTheme.colors.primary },
              ]}
              onPress={async () => {
                Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Medium
                ).catch(() => {});
                const payload = buildHelperShare({
                  id,
                  title,
                  mini: miniCours,
                });
                try {
                  await Share.share({
                    message: payload.message,
                    url: payload.url,
                    title: `Partager • ${title}`,
                  });
                } catch {}
              }}
              accessibilityLabel={t("challengeHelper.share", {
                defaultValue: "Partager",
              })}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={currentTheme.colors.primary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: currentTheme.colors.primary },
                ]}
              >
                {t("challengeHelper.share", { defaultValue: "Partager" })}
              </Text>
            </TouchableOpacity>

            {/* Copier le mini-cours */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { borderColor: currentTheme.colors.secondary },
              ]}
              onPress={async () => {
                await Clipboard.setStringAsync(miniCours);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                ).catch(() => {});
              }}
              accessibilityLabel={t("challengeHelper.copySummary", {
                defaultValue: "Copier le mini-cours",
              })}
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color={currentTheme.colors.secondary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {t("challengeHelper.copy", { defaultValue: "Copier" })}
              </Text>
            </TouchableOpacity>
          </View>

          {softError && (
            <View
              style={[
                styles.errorBanner,
                { borderColor: currentTheme.colors.error },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={currentTheme.colors.error}
              />
              <Text
                style={[
                  styles.errorText,
                  { color: currentTheme.colors.error },
                ]}
              >
                {t("common.loadError", {
                  defaultValue:
                    "Impossible de rafraîchir. Balaye vers le bas pour réessayer.",
                })}
              </Text>
            </View>
          )}

          {/* Mini-cours */}
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
            <View style={styles.sectionHeaderRow}>
              <View
                style={[
                  styles.sectionAccent,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
              />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.primary },
                ]}
              >
                🎓{" "}
                {t("challengeHelper.explanation", {
                  defaultValue: "Explication du mini-cours",
                })}
              </Text>
            </View>
            <Text
              style={[
                styles.text,
                { color: currentTheme.colors.textSecondary },
              ]}
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
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionAccent,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  💡{" "}
                  {t("challengeHelper.examples", {
                    defaultValue: "Exemples concrets",
                  })}
                </Text>
              </View>
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
          {Array.isArray(ressources) && ressources.some((r) => !!r?.url) && (
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
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionAccent,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  🔗{" "}
                  {t("challengeHelper.resources", {
                    defaultValue: "Ressources utiles",
                  })}
                </Text>
              </View>
              {ressources
                .filter((r) => !!r?.url)
                .map((r, i) => {
                  const url = String(r.url);
                  const isYT = /youtu\.?be/.test(url);
                  const isPDF = /\.pdf(\?|$)/i.test(url);
                  const icon: keyof typeof Ionicons.glyphMap = isYT
                    ? "logo-youtube"
                    : isPDF
                    ? "document-text-outline"
                    : "open-outline";
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.resourceRow}
                      onPress={async () => {
                        Haptics.selectionAsync().catch(() => {});
                        if (await Linking.canOpenURL(url)) Linking.openURL(url);
                      }}
                      accessibilityRole="link"
                      accessibilityLabel={r.title}
                    >
                      <Ionicons
                        name={icon}
                        size={18}
                        color={currentTheme.colors.secondary}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.linkText,
                          { color: currentTheme.colors.secondary },
                        ]}
                        numberOfLines={2}
                      >
                        {r.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
              📩{" "}
              {t("challengeHelper.suggestion", {
                defaultValue:
                  "Une idée pour améliorer ce mini-cours ? Écris-nous :",
              })}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("mailto:support@challengeties.app").catch(
                  () => {}
                )
              }
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
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: SPACING * 1.4,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeFont(14),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: SPACING * 1.2,
    backgroundColor: "transparent",
  },
  errorText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeFont(13),
  },
  sectionAccent: {
    width: 6,
    height: 20,
    borderRadius: 6,
    opacity: 0.9,
  },
  card: {
    borderRadius: 18,
    padding: SPACING,
    marginBottom: SPACING * 1.4,
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
