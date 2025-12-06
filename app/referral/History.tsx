import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "@/constants/firebase-config";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";

type Row = {
  id: string;
  username?: string;
  email?: string;
  activated?: boolean;
  createdAt?: any;
  activatedAt?: any;
};

type FilterKey = "all" | "activated" | "pending";
const P = 16;

/** Fond orbes premium, non interactif (mémoïsé) */
const OrbBackgroundBase = ({
  theme,
  width,
}: {
  theme: Theme;
  width: number;
}) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={{
        position: "absolute",
        opacity: 0.9,
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: (width * 0.9) / 2,
        top: -width * 0.4,
        left: -width * 0.25,
      }}
    />
    <LinearGradient
      colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={{
        position: "absolute",
        opacity: 0.9,
        width: width * 1.1,
        height: width * 1.1,
        borderRadius: (width * 1.1) / 2,
        bottom: -width * 0.55,
        right: -width * 0.35,
      }}
    />
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const OrbBackground = memo(OrbBackgroundBase);

export default function ReferralHistory() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const textPrimary = isDarkMode
    ? currentTheme.colors.textPrimary
    : "#111827"; // noir lisible en light

  const textSecondary = isDarkMode
    ? currentTheme.colors.textSecondary
    : "rgba(15,23,42,0.7)";

  const { width } = useWindowDimensions();
  const router = useRouter();
  const me = auth.currentUser?.uid ?? null;

  const normalize = useCallback(
    (size: number) => {
      const baseWidth = 375;
      const scale = Math.min(Math.max(width / baseWidth, 0.7), 1.8);
      return Math.round(size * scale);
    },
    [width]
  );

  const styles = useMemo(() => makeStyles(normalize), [normalize]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!me) {
      // Pas connecté → pas de subscription Firestore
      if (isMountedRef.current) {
        setRows([]);
        setLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
    }

    const baseQ = query(
  collection(db, "users"),
  where("referrerId", "==", me)
  // on trie côté client, ça évite les problèmes d'index / champs manquants
);


    const unsub = onSnapshot(
      baseQ,
      (snap) => {
        if (!isMountedRef.current) return;

        const list: Row[] = [];
        snap.forEach((d) => {
  const data = d.data() as any;

  // ✅ Cohérent avec ShareAndEarn : activated ou referralActivated
  const activatedFlag =
    data?.activated === true || data?.referralActivated === true;

  // ✅ Dates : on essaye d'utiliser activatedAt, sinon createdAt
  const createdAt = data?.createdAt ?? null;
  const activatedAt =
    data?.activatedAt ??
    data?.referralActivatedAt ??
    (activatedFlag ? createdAt : null);

  list.push({
    id: d.id,
    username: data?.username,
    email: data?.email,
    activated: activatedFlag,
    createdAt,
    activatedAt,
  });
});

// Tri côté client : plus récent en premier, fallback propre
list.sort((a, b) => {
  const getDate = (row: Row) => {
    const raw = row.activatedAt || row.createdAt;
    return raw?.toDate?.() ?? new Date(0);
  };
  return getDate(b).getTime() - getDate(a).getTime();
});

setRows(list);
setLoading(false);

        setLoading(false);
      },
      (err) => {
        console.log("[referral/history] error:", err?.message || err);
        if (!isMountedRef.current) return;
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [me]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "activated") return rows.filter((r) => r.activated);
    return rows.filter((r) => !r.activated);
  }, [rows, filter]);

  const countActivated = useMemo(
    () => rows.filter((r) => r.activated).length,
    [rows]
  );

  const headerColors: [string, string] = useMemo(
    () => [currentTheme.colors.primary, currentTheme.colors.secondary],
    [currentTheme.colors.primary, currentTheme.colors.secondary]
  );

    const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      const when = item.activated
        ? item.activatedAt?.toDate?.()
        : item.createdAt?.toDate?.();

      // ✅ Date simple, type 05/12/2025
      const whenTxt = when ? dayjs(when).format("DD/MM/YYYY") : null;

      // ✅ Label i18n + fallback
      const baseLabel = item.activated
        ? t("referral.history.activatedOnLabel", {
            defaultValue: "Activated on",
          })
        : t("referral.history.invitedOnLabel", {
            defaultValue: "Invited on",
          });

      // ✅ Si pas de date → juste le label, sinon label + date
      const metaText = whenTxt ? `${baseLabel} ${whenTxt}` : baseLabel;

      const isActivated = !!item.activated;
      const displayName =
        item.username || item.email || item.id.slice(0, 6) || "—";

      return (
        <View
          style={[
            styles.row,
            {
              backgroundColor: isActivated
                ? isDarkMode
                  ? "#022C22"
                  : "#F0FDF4"
                : isDarkMode
                ? "rgba(0,0,0,0.6)"
                : "#FFFFFF",
              borderColor: isActivated
                ? "#22C55E"
                : currentTheme.colors.primary,
            },
          ]}
          accessible
          accessibilityLabel={`${displayName}. ${metaText}. ${
            isActivated
              ? t("referral.history.status.activated")
              : t("referral.history.status.pending")
          }`}
        >
          <View style={styles.avatarCircle}>
            <Ionicons
              name={isActivated ? "checkmark-circle" : "time-outline"}
              size={normalize(24)}
              color={isActivated ? "#22C55E" : currentTheme.colors.primary}
            />
          </View>

          <View style={styles.rowTextBlock}>
            <Text
              style={[styles.name, { color: textPrimary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>

            <Text
              style={[styles.meta, { color: textSecondary }]}
              numberOfLines={1}
            >
              {metaText}
            </Text>
          </View>

          <View
            style={[
              styles.badgeBase,
              isActivated ? styles.badgeOk : styles.badgePending,
            ]}
          >
            <Text
              style={[
                styles.badgeTxtBase,
                isActivated ? styles.badgeTxtOk : styles.badgeTxtPending,
              ]}
            >
              {isActivated
                ? t("referral.history.status.activated")
                : t("referral.history.status.pending")}
            </Text>
          </View>
        </View>
      );
    },
    [
      currentTheme.colors.primary,
      isDarkMode,
      normalize,
      styles,
      t,
      textPrimary,
      textSecondary,
    ]
  );


  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground + "F0",
      ]}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
    >
      <OrbBackground theme={currentTheme} width={width} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <LinearGradient
          colors={headerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerRow}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel={t("common.back", { defaultValue: "Retour" })}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-back"
              size={normalize(20)}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.title} numberOfLines={1}>
              {t("referral.history.title")}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {t("referral.history.subtitle", {
                total: rows.length,
                activated: countActivated,
              })}
            </Text>
          </View>

          <View style={styles.headerRightSpacer} />
        </LinearGradient>

        {/* Stat chip */}
        <View style={styles.statsCardWrapper}>
          <View
            style={[
              styles.statsCard,
              {
                backgroundColor: isDarkMode
                  ? "rgba(0,0,0,0.45)"
                  : "rgba(255,255,255,0.9)",
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Ionicons
                  name="people-outline"
                  size={normalize(18)}
                  color={currentTheme.colors.secondary}
                />
                <Text
                  style={[
                    styles.statsLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("referral.history.stats.invited", {
                    defaultValue: "Invités",
                  })}
                </Text>
                <Text
                  style={[
                    styles.statsValue,
                    {
                      color: textPrimary,
                    },
                  ]}
                >
                  {rows.length}
                </Text>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.statsItem}>
                <Ionicons
                  name="sparkles-outline"
                  size={normalize(18)}
                  color="#22C55E"
                />
                <Text
                  style={[
                    styles.statsLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("referral.history.stats.activated", {
                    defaultValue: "Activés",
                  })}
                </Text>
                <Text style={[styles.statsValue, { color: "#22C55E" }]}>
                  {countActivated}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filters}>
          {(["all", "activated", "pending"] as FilterKey[]).map((f) => {
            const label =
              f === "all"
                ? t("referral.history.filters.all")
                : f === "activated"
                ? t("referral.history.filters.activated")
                : t("referral.history.filters.pending");

            const active = filter === f;

            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  {
                    borderColor: active
                      ? currentTheme.colors.primary
                      : isDarkMode
                      ? "rgba(255,255,255,0.26)"
                      : "rgba(0,0,0,0.08)",
                    backgroundColor: active
                      ? currentTheme.colors.primary + "EE"
                      : isDarkMode
                      ? "rgba(0,0,0,0.4)"
                      : "rgba(255,255,255,0.9)",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.chipTxt,
                    {
                      color: active
                        ? "#FFFFFF"
                        : isDarkMode
                        ? currentTheme.colors.textPrimary
                        : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contenu */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={currentTheme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("referral.history.loading", {
                defaultValue: "Chargement de ton historique…",
              })}
            </Text>
          </View>
        ) : !me ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="lock-closed-outline"
              size={normalize(40)}
              color={currentTheme.colors.secondary}
            />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              {t("referral.history.notLoggedInTitle", {
                defaultValue: "Connecte-toi pour voir ton historique",
              })}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("referral.history.notLoggedInBody", {
                defaultValue:
                  "Crée un compte ou connecte-toi pour suivre les personnes que tu as invitées.",
              })}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="gift-outline"
              size={normalize(40)}
              color={currentTheme.colors.secondary}
            />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              {t("referral.history.emptyTitle", {
                defaultValue: "Aucun invité pour le moment",
              })}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("referral.history.empty", {
                defaultValue:
                  "Partage ton lien de parrainage et regarde ton historique se remplir ✨",
              })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            updateCellsBatchingPeriod={40}
            accessibilityLabel={t("referral.history.listLabel", {
              defaultValue: "Historique des filleuls",
            })}
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Styles factory pour pouvoir utiliser normalize sans erreur */
const makeStyles = (normalize: (n: number) => number) =>
  StyleSheet.create({
    root: { flex: 1 },
    safeArea: {
      flex: 1,
      paddingHorizontal: P,
      paddingTop: P / 2,
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 20,
      paddingHorizontal: P,
      paddingVertical: P * 0.9,
      marginBottom: P,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    backBtn: {
      width: normalize(36),
      height: normalize(36),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    headerCenter: {
      flex: 1,
      marginHorizontal: P * 0.8,
    },
    headerRightSpacer: {
      width: normalize(36),
    },
    title: {
      fontSize: normalize(18),
      fontFamily: "Comfortaa_700Bold",
      marginBottom: 4,
      color: "#FFFFFF",
    },
    subtitle: {
      fontSize: normalize(12),
      fontFamily: "Comfortaa_400Regular",
      color: "rgba(255,255,255,0.9)",
    },

    statsCardWrapper: { marginBottom: P * 0.75 },
    statsCard: {
      borderRadius: 18,
      paddingHorizontal: P,
      paddingVertical: P * 0.75,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statsItem: { flex: 1, alignItems: "center" },
    statsLabel: {
      fontSize: normalize(11),
      fontFamily: "Comfortaa_400Regular",
      marginTop: 4,
    },
    statsValue: {
      fontSize: normalize(18),
      fontFamily: "Comfortaa_700Bold",
      marginTop: 2,
    },
    statsDivider: {
      width: 1,
      height: 32,
      backgroundColor: "rgba(0,0,0,0.08)",
      opacity: 0.4,
    },

    filters: {
      flexDirection: "row",
      marginTop: 6,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      marginRight: 8,
    },
    chipTxt: {
      fontSize: normalize(12),
      fontFamily: "Comfortaa_700Bold",
    },

    loadingWrap: {
      marginTop: P * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      marginTop: 8,
      fontSize: normalize(13),
      fontFamily: "Comfortaa_400Regular",
    },

    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: P * 2,
    },
    emptyTitle: {
      fontSize: normalize(17),
      fontFamily: "Comfortaa_700Bold",
      marginTop: 12,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: normalize(13),
      fontFamily: "Comfortaa_400Regular",
      marginTop: 6,
      textAlign: "center",
    },

    listContent: {
      paddingVertical: 8,
      paddingBottom: P * 2,
    },

    row: {
      borderRadius: 16,
      padding: P,
      borderWidth: 1.5,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: normalize(40),
      height: normalize(40),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: "rgba(0,0,0,0.04)",
    },
    rowTextBlock: { flex: 1 },
    name: {
      fontSize: normalize(15),
      fontFamily: "Comfortaa_700Bold",
    },
    meta: {
      fontSize: normalize(12),
      fontFamily: "Comfortaa_400Regular",
      marginTop: 2,
    },

    badgeBase: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1.2,
    },
    badgeOk: {
      borderColor: "#22C55E",
      backgroundColor: "#DCFCE7",
    },
    badgePending: {
      borderColor: "#7C5800",
      backgroundColor: "#FFF1C9",
    },
    badgeTxtBase: {
      fontSize: normalize(11),
      fontFamily: "Comfortaa_700Bold",
    },
    badgeTxtOk: { color: "#14532D" },
    badgeTxtPending: { color: "#7C5800" },
  });
