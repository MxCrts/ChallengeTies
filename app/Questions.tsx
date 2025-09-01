// app/Questions.tsx
import React, { useMemo, useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "@/theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQItem = {
  key: string;          // identifiant unique
  q: string;            // question (déjà traduite)
  a: string;            // réponse (déjà traduite)
  icon?: keyof typeof Ionicons.glyphMap;
  tag?: string;         // pour la recherche
};

export default function FAQScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  // Données FAQ (Top 10) — tout passe par i18n
  const data: FAQItem[] = useMemo(
    () => [
      {
        key: "whatIs",
        q: t("questions.q.whatIs"),
        a: t("questions.a.whatIs"),
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
        q: t("questions.q.contact"),
        a: t("questions.a.contact"),
        icon: "mail-open-outline",
        tag: "support help contact",
      },
    ],
    [t]
  );

  const filtered = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    if (!qLower) return data;
    return data.filter(
      (it) =>
        it.q.toLowerCase().includes(qLower) ||
        it.a.toLowerCase().includes(qLower) ||
        (it.tag ?? "").toLowerCase().includes(qLower)
    );
  }, [query, data]);

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Optionnel: ouvrir le 1er item par défaut
  useEffect(() => {
    if (filtered.length && Object.keys(openKeys).length === 0) {
      setOpenKeys({ [filtered[0].key]: true });
    }
  }, [filtered]);

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
          title={t("questions.title")}
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
            placeholder={t("questions.searchPlaceholder")}
            placeholderTextColor={isDark ? current.colors.textSecondary : "#666"}
            style={[styles.searchInput, { color: isDark ? current.colors.textPrimary : "#111" }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={current.colors.textSecondary} />
            </TouchableOpacity>
          )}
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
            <Text style={[styles.overviewTitle, { color: isDark ? "#fff" : "#000" }]}>
              {t("questions.overview.title")}
            </Text>
          </View>
          <Text style={[styles.overviewText, { color: current.colors.textSecondary }]}>
            {t("questions.overview.body")}
          </Text>
        </LinearGradient>

        {/* Accordions */}
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
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
              >
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggle(item.key)}
                  activeOpacity={0.9}
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
                        { color: isDark ? current.colors.textPrimary : "#111" },
                      ]}
                    >
                      {item.q}
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
                        { color: isDark ? current.colors.textSecondary : "#333" },
                      ]}
                    >
                      {item.a}
                    </Text>

                    {/* CTA vers Contact si c’est l’item contact */}
                    {item.key === "contact" && (
                      <TouchableOpacity
                        onPress={() => {
                          // Navigue vers ta page Contact si tu l’as: /about/Contact
                          // Ajuste le path si besoin.
                          // @ts-ignore
                          const { useRouter } = require("expo-router");
                          const r = useRouter();
                          r.push("/about/Contact");
                        }}
                        style={styles.contactBtn}
                        activeOpacity={0.9}
                      >
                        <LinearGradient
                          colors={[current.colors.secondary, current.colors.primary]}
                          style={styles.contactBtnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="mail-outline" size={16} color="#111" />
                          <Text style={styles.contactBtnText}>{t("questions.contactCta")}</Text>
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
              <Text style={[styles.emptyText, { color: current.colors.textSecondary }]}>
                {t("questions.noResult")}
              </Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#00000012",
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === "ios" ? 10 : 6 },
  overviewCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#00000010",
    marginBottom: 12,
  },
  overviewRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  overviewTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 15 },
  overviewText: { fontFamily: "Comfortaa_400Regular", fontSize: 13, lineHeight: 18 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  qRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  qText: { fontFamily: "Comfortaa_700Bold", fontSize: 14 },
  answerWrap: { paddingHorizontal: 14, paddingBottom: 14 },
  aText: { fontFamily: "Comfortaa_400Regular", fontSize: 13, lineHeight: 19, marginTop: 6 },

  contactBtn: { marginTop: 10, borderRadius: 12, overflow: "hidden" },
  contactBtnGrad: {
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  contactBtnText: { color: "#111", fontFamily: "Comfortaa_700Bold", fontSize: 14 },

  emptyWrap: { alignItems: "center", paddingVertical: 24, gap: 6 },
  emptyText: { fontFamily: "Comfortaa_400Regular", fontSize: 13 },
});
