// app/Questions.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  UIManager,
  LayoutAnimation,
  ScrollView,
  StatusBar,
  Dimensions,
  I18nManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "@/theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

let Haptics: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics");
} catch {}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};


type FAQItem = {
  key: string;          // identifiant unique
  q: string;            // question (déjà traduite)
  a: string;            // réponse (déjà traduite)
  icon?: keyof typeof Ionicons.glyphMap;
  tag?: string;         // pour la recherche
};

export default function FAQScreen() {
 const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const router = useRouter();


  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const itemPositionsRef = useRef<Record<string, number>>({});

  // persist/load UI state
  useEffect(() => {
    (async () => {
      try {
        const [savedOpen, savedQuery] = await Promise.all([
          AsyncStorage.getItem("faq_openKeys"),
          AsyncStorage.getItem("faq_query"),
        ]);
        if (savedOpen) setOpenKeys(JSON.parse(savedOpen));
        if (savedQuery) setQuery(savedQuery);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("faq_openKeys", JSON.stringify(openKeys)).catch(() => {});
  }, [openKeys]);
  useEffect(() => {
    AsyncStorage.setItem("faq_query", query).catch(() => {});
  }, [query]);

  // Données FAQ (Top 10) — tout passe par i18n
  const data: FAQItem[] = useMemo(
    () => [
      {
        key: "whatIs",
        q: t("questions.q.whatIs", { defaultValue: "Qu’est-ce que ChallengeMe ?" }),
        a: t("questions.a.whatIs", { defaultValue: "ChallengeMe est ..." }),
        icon: "sparkles-outline",
        tag: "intro discover",
      },
      {
        key: "howToStart",
        q: t("questions.q.howToStart"),
        a: t("questions.a.howToStart"),
        icon: "rocket-outline",
        tag: "start begin first pick onboarding",
      },
      {
        key: "duoMode",
        q: t("questions.q.duoMode"),
        a: t("questions.a.duoMode"),
        icon: "people-outline",
        tag: "duo friend invite username",
      },
      {
        key: "soloMode",
        q: t("questions.q.soloMode"),
        a: t("questions.a.soloMode"),
        icon: "person-outline",
        tag: "solo alone",
      },
      {
        key: "invitations",
        q: t("questions.q.invitations"),
        a: t("questions.a.invitations"),
        icon: "send-outline",
        tag: "invite direct link notification",
      },
      {
        key: "progress",
        q: t("questions.q.progress"),
        a: t("questions.a.progress"),
        icon: "trending-up-outline",
        tag: "progress streak day recap",
      },
      {
        key: "notifications",
        q: t("questions.q.notifications"),
        a: t("questions.a.notifications"),
        icon: "notifications-outline",
        tag: "reminder alerts push",
      },
      {
        key: "community",
        q: t("questions.q.community"),
        a: t("questions.a.community"),
        icon: "chatbubbles-outline",
        tag: "community feed comments",
      },
      {
        key: "privacy",
        q: t("questions.q.privacy"),
        a: t("questions.a.privacy"),
        icon: "shield-checkmark-outline",
        tag: "privacy data",
      },
      {
        key: "contact",
        q: t("questions.q.contact", { defaultValue: "Comment vous contacter ?" }),
        a: t("questions.a.contact", { defaultValue: "Écris-nous depuis la page Contact." }),
        icon: "mail-open-outline",
        tag: "support help contact",
      },
    ],
    [t]
  );

  const filtered = useMemo(() => {
    const qLower = query.trim().toLocaleLowerCase(i18n.language);
    if (!qLower) return data;
    return data.filter(
      (it) =>
        it.q.toLocaleLowerCase(i18n.language).includes(qLower) ||
        it.a.toLocaleLowerCase(i18n.language).includes(qLower) ||
        (it.tag ?? "").toLocaleLowerCase(i18n.language).includes(qLower)
    );
  }, [query, data, i18n.language]);

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
    if (Haptics?.selectionAsync) Haptics.selectionAsync();
    // scroll to opened card
    const y = itemPositionsRef.current[key];
    const willOpen = !openKeys[key];
    if (willOpen && typeof y === "number") {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }, 60);
    }
  };

  // Optionnel: ouvrir le 1er item par défaut
  useEffect(() => {
    if (filtered.length && Object.keys(openKeys).length === 0) {
      setOpenKeys({ [filtered[0].key]: true });
    }
  }, [filtered]);

  // highlight helper
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const renderHighlighted = useCallback(
    (text: string) => {
      const trimmed = query.trim();
      if (!trimmed) return <Text>{text}</Text>;

      const safe = escape(trimmed);
      const regex = new RegExp(`(${safe})`, "ig");
      const lowerQuery = trimmed.toLocaleLowerCase(i18n.language);

      const parts = text.split(regex);
      return (
        <Text>
          {parts.map((p, i) => {
            const isMatch =
              p.toLocaleLowerCase(i18n.language) === lowerQuery;
            return (
              <Text
                key={i}
                style={isMatch ? styles.highlight : undefined}
              >
                {p}
              </Text>
            );
          })}
        </Text>
      );
    },
    [query, i18n.language]
  );

  const expandAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const all: Record<string, boolean> = {};
    data.forEach((d) => (all[d.key] = true));
    setOpenKeys(all);
    if (Haptics?.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const collapseAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys({});
    if (Haptics?.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[current.colors.background, current.colors.cardBackground]}
        style={styles.container}
      >
        <CustomHeader
          title={t("questions.title", { defaultValue: "Questions fréquentes" })}
          showBackButton
          backgroundColor="transparent"
          showHairline
        />

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: isDark ? "#202022" : "#fff" }]}>
          <Ionicons name="search-outline" size={18} color={current.colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("questions.searchPlaceholder", { defaultValue: "Rechercher une question..." })}
           placeholderTextColor={isDark ? current.colors.textSecondary : "#666"}
            style={[
              styles.searchInput,
              {
                color: isDark ? current.colors.textPrimary : "#111",
                textAlign: I18nManager.isRTL ? "right" : "left",
                writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
              },
            ]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("questions.searchA11yLabel", {
              defaultValue: "Rechercher une question dans la FAQ",
            })}
            importantForAccessibility="yes"
            selectionColor={current.colors.primary}
            cursorColor={current.colors.primary}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={current.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* bulk controls */}
        <View style={styles.bulkRow}>
          <TouchableOpacity
            onPress={expandAll}
            style={[styles.bulkBtn, { backgroundColor: current.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={t("questions.expandAll", { defaultValue: "Tout ouvrir" })}
            accessibilityHint={t("questions.expandAllHint", {
              defaultValue: "Ouvre toutes les réponses de la FAQ",
            })}
          >
            <Ionicons name="chevron-down-circle-outline" size={16} color={current.colors.textPrimary} />
            <Text style={[styles.bulkText, { color: current.colors.textPrimary }]}>
              {t("questions.expandAll", { defaultValue: "Tout ouvrir" })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={collapseAll}
            style={[styles.bulkBtn, { backgroundColor: isDark ? "#2b2b30" : "#EEE" }]}
            accessibilityRole="button"
            accessibilityLabel={t("questions.collapseAll", { defaultValue: "Tout fermer" })}
            accessibilityHint={t("questions.collapseAllHint", {
              defaultValue: "Ferme toutes les réponses de la FAQ",
            })}
          >
            <Ionicons name="chevron-up-circle-outline" size={16} color={isDark ? "#fff" : "#111"} />
            <Text style={[styles.bulkText, { color: isDark ? "#fff" : "#111" }]}>
              {t("questions.collapseAll", { defaultValue: "Tout fermer" })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feature overview card */}
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]
              : ["#FFF7E5", "#FFE7BA"]
          }
          style={styles.overviewCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.overviewRow}>
            <Ionicons name="sparkles-outline" size={22} color={current.colors.secondary} />
            <Text
  style={[
    styles.overviewTitle,
    {
      color: isDark ? "#fff" : "#000",
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
>
  {t("questions.overview.title", { defaultValue: "Bienvenue dans la FAQ" })}
</Text>

          </View>
          <Text
  style={[
    styles.overviewText,
    {
      color: current.colors.textSecondary,
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
>
  {t("questions.overview.body", {
    defaultValue:
      "Trouvez rapidement des réponses. Utilisez la recherche, ouvrez tout ou fermez tout, et contactez-nous si besoin.",
  })}
</Text>

        </LinearGradient>

        {/* Accordions */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          accessibilityRole="list"
          accessibilityLabel={t("questions.listA11yLabel", {
            defaultValue: "Liste des questions fréquentes",
          })}
        >
          {filtered.map((item) => {
            const opened = !!openKeys[item.key];
            return (
              <View
                key={item.key}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? "#202022" : "#fff",
                    borderColor: isDark ? "#2b2b30" : "#00000012",
                  },
                ]}
                onLayout={(e) => {
                  itemPositionsRef.current[item.key] = e.nativeEvent.layout.y;
                }}
              >
                
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggle(item.key)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: opened }}
                  accessibilityLabel={item.q}
                  accessibilityHint={
                    opened
                      ? t("questions.collapseOneHint", {
                          defaultValue: "Replier la réponse à cette question",
                        })
                      : t("questions.expandOneHint", {
                          defaultValue: "Déplier la réponse à cette question",
                        })
                  }
                >
                  <View style={styles.qRow}>
                    {item.icon && (
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={current.colors.secondary}
                        style={{ marginRight: 8 }}
                      />
                    )}
                   <Text
  style={[
    styles.qText,
    {
      color: isDark ? current.colors.textPrimary : "#111",
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
>
  {renderHighlighted(item.q)}
</Text>

                  </View>
                  <Ionicons
                    name={opened ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={current.colors.textSecondary}
                  />
                </TouchableOpacity>

                {opened && (
                  <View style={styles.answerWrap}>
                    <Text
  style={[
    styles.aText,
    {
      color: isDark ? current.colors.textSecondary : "#333",
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
>
  {renderHighlighted(item.a)}
</Text>

                    {/* CTA vers Contact si c’est l’item contact */}
                    {item.key === "contact" && (
                      <TouchableOpacity
                        onPress={() => {
  router.push("/about/Contact");
                        }}
                        style={styles.contactBtn}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={t("questions.contactCta", {
                          defaultValue: "Contacter le support",
                        })}
                        accessibilityHint={t("questions.contactCtaHint", {
                          defaultValue: "Ouvre la page de contact du support ChallengeTies",
                        })}
                      >
                        <LinearGradient
                          colors={[current.colors.secondary, current.colors.primary]}
                          style={styles.contactBtnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="mail-outline" size={16} color="#111" />
                          <Text style={styles.contactBtnText}>
                            {t("questions.contactCta", { defaultValue: "Contacter le support" })}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="help-circle-outline" size={22} color={current.colors.textSecondary} />
              <Text
                style={[
                  styles.emptyText,
                  { color: current.colors.textSecondary },
                  {
                    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                    textAlign: I18nManager.isRTL ? "right" : "center",
                  },
                ]}
                numberOfLines={3}
                adjustsFontSizeToFit
              >
                {t("questions.noResult", {
                  defaultValue: "Aucun résultat. Essayez d’autres mots-clés.",
                })}
              </Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  paddingHorizontal: normalizeSize(16),
  paddingBottom: normalizeSize(12),
},
searchWrap: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  borderRadius: normalizeSize(14),
  paddingHorizontal: normalizeSize(12),
  height: normalizeSize(44),
  borderWidth: 1,
  borderColor: "#00000012",
  marginBottom: normalizeSize(12),
},
searchInput: {
  flex: 1,
  fontSize: normalizeSize(15),
  paddingVertical: Platform.OS === "ios" ? normalizeSize(10) : normalizeSize(6),
},
  /* bulk controls */
  bulkRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: normalizeSize(12),
  gap: normalizeSize(10),
},
bulkBtn: {
  flex: 1,
  height: normalizeSize(40),
  borderRadius: normalizeSize(12),
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  gap: 8,
},
bulkText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
},

  /* search highlight */
  highlight: {
  backgroundColor: "rgba(250, 204, 21, 0.35)",
  borderRadius: normalizeSize(4),
  paddingHorizontal: 2,
},
overviewCard: {
  borderRadius: normalizeSize(16),
  padding: normalizeSize(14),
  borderWidth: 1,
  borderColor: "#00000010",
  marginBottom: normalizeSize(12),
},
overviewRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: normalizeSize(6),
  gap: 8,
},
overviewTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(15),
},
overviewText: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
  lineHeight: normalizeSize(18),
},
card: {
  borderRadius: normalizeSize(16),
  borderWidth: 1,
  marginBottom: normalizeSize(10),
  overflow: "hidden",
},
cardHeader: {
  paddingHorizontal: normalizeSize(14),
  paddingVertical: normalizeSize(12),
  flexDirection: "row",
  alignItems: "center",
},
  qRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  qText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(14),
},
answerWrap: {
  paddingHorizontal: normalizeSize(14),
  paddingBottom: normalizeSize(14),
},
aText: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
  lineHeight: normalizeSize(19),
  marginTop: normalizeSize(6),
},
contactBtn: {
  marginTop: normalizeSize(10),
  borderRadius: normalizeSize(12),
  overflow: "hidden",
},
contactBtnGrad: {
  height: normalizeSize(40),
  borderRadius: normalizeSize(12),
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  gap: 8,
  paddingHorizontal: normalizeSize(12),
},
contactBtnText: {
  color: "#111",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(14),
},
emptyWrap: {
  alignItems: "center",
  paddingVertical: normalizeSize(24),
  gap: 6,
},
emptyText: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
},
});
