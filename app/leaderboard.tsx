import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ColorValue } from "react-native";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import PioneerBadge from "@/components/PioneerBadge";
import { useShareCard } from "@/hooks/useShareCard";
import { RankShareCard } from "@/components/ShareCards";
import * as Haptics from "expo-haptics";
import { I18nManager } from "react-native";

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = Math.min(Math.max(SCREEN_WIDTH / 375, 0.7), 1.8);
  return Math.round(size * scale);
};
const normalizeSize = (size: number) => {
  const scale = Math.min(Math.max(SCREEN_WIDTH / 375, 0.7), 1.8);
  return Math.round(size * scale);
};

interface Player {
  id: string;
  username?: string;
  trophies: number;
  profileImage?: string;
  country?: string;
  region?: string;
  rank?: number;
  isPioneer?: boolean;
}

const topN = (arr: Player[], n: number) => arr.slice(0, n);

// ─── Config visuelle par rang ──────────────────────────────────────────────
const SLOT_CONFIG = {
  1: {
    pedestalH:    (s: typeof normalizeSize) => s(72),
    avatarSize:   (s: typeof normalizeSize) => s(88),
    ringPad:      (s: typeof normalizeSize) => s(5),
    nameSize:     (f: typeof normalizeFont) => f(15.5),
    scoreSize:    (f: typeof normalizeFont) => f(12.5),
    medal:        "👑",
    ringColors:   ["rgba(255,215,0,1)", "rgba(255,180,0,0.75)", "rgba(255,245,160,0.5)"] as const,
    glowColor:    "rgba(255,215,0,0.22)",
    pedestalTop:  "rgba(255,215,0,0.22)",
    pedestalMid:  "rgba(255,165,0,0.08)",
    medalSize:    (s: typeof normalizeSize) => s(32),
  },
  2: {
    pedestalH:    (s: typeof normalizeSize) => s(50),
    avatarSize:   (s: typeof normalizeSize) => s(72),
    ringPad:      (s: typeof normalizeSize) => s(4),
    nameSize:     (f: typeof normalizeFont) => f(14),
    scoreSize:    (f: typeof normalizeFont) => f(12),
    medal:        "🥈",
    ringColors:   ["rgba(225,228,240,0.92)", "rgba(158,165,185,0.55)"] as const,
    glowColor:    "transparent",
    pedestalTop:  "rgba(200,210,230,0.16)",
    pedestalMid:  "rgba(160,165,185,0.05)",
    medalSize:    (s: typeof normalizeSize) => s(26),
  },
  3: {
    pedestalH:    (s: typeof normalizeSize) => s(38),
    avatarSize:   (s: typeof normalizeSize) => s(66),
    ringPad:      (s: typeof normalizeSize) => s(4),
    nameSize:     (f: typeof normalizeFont) => f(14),
    scoreSize:    (f: typeof normalizeFont) => f(12),
    medal:        "🥉",
    ringColors:   ["rgba(205,127,50,0.92)", "rgba(130,75,35,0.50)"] as const,
    glowColor:    "transparent",
    pedestalTop:  "rgba(205,127,50,0.16)",
    pedestalMid:  "rgba(130,75,35,0.05)",
    medalSize:    (s: typeof normalizeSize) => s(26),
  },
} as const;

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [selectedTab, setSelectedTab] = useState<"region" | "national" | "global" | "weekly">("global");
  const [weeklyPlayers, setWeeklyPlayers] = useState<Player[]>([]);
  const [locationDisabledMessage, setLocationDisabledMessage] = useState<string | null>(null);

  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const primaryText   = isDarkMode ? "#FFFFFF" : "#0B0B10";
  const secondaryText = isDarkMode ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.55)";
  const cardBg        = isDarkMode ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.78)";
  const cardBgMe      = isDarkMode ? "rgba(255,255,255,0.09)"  : "rgba(255,255,255,0.88)";
  const rowStroke     = isDarkMode ? "rgba(255,255,255,0.10)"  : "rgba(0,0,0,0.08)";
  const rowStrokeMe   = isDarkMode ? "rgba(255,255,255,0.14)"  : "rgba(0,0,0,0.10)";
  const podiumScoreColor = isDarkMode ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.60)";

  const meRingGrad: readonly [ColorValue, ColorValue, ...ColorValue[]] = isDarkMode
    ? ["rgba(255,255,255,0.34)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.22)"]
    : ["rgba(0,0,0,0.18)", "rgba(0,0,0,0.06)", "rgba(0,0,0,0.14)"];
  const meHalo = isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  const { ref: rankShareRef, share: shareRankCard } = useShareCard();
  const [rankSharePayload, setRankSharePayload] = useState<{
    username: string; rank: number | string; trophies?: number; avatarUri?: string | null;
  } | null>(null);

  // ─── Cache ────────────────────────────────────────────────────────────────
  const cacheLeaderboard = useCallback(async (data: Player[]) => {
    try { await AsyncStorage.setItem("leaderboardCache", JSON.stringify(data)); } catch {}
  }, []);

  const getCachedLeaderboard = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem("leaderboardCache");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  }, []);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    try {
      !refreshing && setLoading(true);
      const cached = await getCachedLeaderboard();
      if (cached) setPlayers(cached);

      const q = query(collection(db, "users"), orderBy("trophies", "desc"), limit(20));
      const snapshot = await getDocs(q);
      const fetched: Player[] = snapshot.docs.map((d) => ({
        id: d.id,
        username:     d.data().username?.toString?.()     || t("leaderboard.unknown", { defaultValue: "Unknown" }),
        trophies:     d.data().trophies || 0,
        profileImage: d.data().profileImage?.toString?.() || null,
        country:      d.data().country?.toString?.()      || t("leaderboard.unknown", { defaultValue: "Unknown" }),
        region:       d.data().region?.toString?.()       || t("leaderboard.unknown", { defaultValue: "Unknown" }),
        isPioneer:    !!d.data().isPioneer,
      }));
      setPlayers(fetched);
      cacheLeaderboard(fetched);

      // ── Leaderboard hebdomadaire ──────────────────────────────────────────
      try {
        const wq = query(collection(db, "leaderboard_weekly"), orderBy("trophies", "desc"), limit(20));
        const wsnap = await getDocs(wq);
        const wfetched: Player[] = wsnap.docs.map((d) => ({
          id: d.id,
          username:     d.data().username?.toString?.()     || t("leaderboard.unknown", { defaultValue: "Unknown" }),
          trophies:     d.data().trophies || 0,
          profileImage: d.data().profileImage?.toString?.() || null,
          country:      d.data().country?.toString?.()      || "",
          region:       d.data().region?.toString?.()       || "",
          isPioneer:    !!d.data().isPioneer,
        }));
        setWeeklyPlayers(wfetched);
      } catch {}

      const uid = auth.currentUser?.uid;
      if (uid) {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const found = fetched.find((p) => p.id === uid) || {
            id: uid,
            username:     data.username?.toString?.()     || t("leaderboard.unknown", { defaultValue: "Unknown" }),
            trophies:     data.trophies || 0,
            profileImage: data.profileImage?.toString?.() || null,
            country:      data.country?.toString?.()      || t("leaderboard.unknown", { defaultValue: "Unknown" }),
            region:       data.region?.toString?.()       || t("leaderboard.unknown", { defaultValue: "Unknown" }),
            isPioneer:    !!data.isPioneer,
          };
          setCurrentUser(found);
          setLocationDisabledMessage(data.locationEnabled ? null : t("leaderboard.locationDisabled"));
        } else {
          setCurrentUser(null);
          setLocationDisabledMessage(t("leaderboard.userNotFound"));
        }
      }
    } catch {
      setLocationDisabledMessage(t("leaderboard.errorFetch"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, cacheLeaderboard, getCachedLeaderboard, refreshing]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchLeaderboard(); }, [fetchLeaderboard]);

  // ─── Share ────────────────────────────────────────────────────────────────
  const shareMyRankCard = useCallback(async () => {
    if (!currentUser) return;
    const basis = selectedTab === "global" ? players : filteredPlayers;
    const myIndex = basis.findIndex((p) => p.id === currentUser.id);
    const myRank = myIndex >= 0 ? myIndex + 1 : "—";
    try { await Haptics.selectionAsync(); } catch {}
    setRankSharePayload({ username: currentUser.username ?? "me", rank: myRank, trophies: currentUser.trophies ?? 0, avatarUri: currentUser.profileImage ?? null });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await shareRankCard(`ct-rank-${currentUser.id}-${Date.now()}.png`, t("leaderboard.shareDialogTitle", { defaultValue: "Partager mon rang" }));
    setRankSharePayload(null);
  }, [currentUser, players, filteredPlayers, selectedTab, shareRankCard, t]);

  // ─── Filtrage ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) { setFilteredPlayers([]); return; }
    const hasText = (v?: string) => typeof v === "string" && v.trim().length > 0;

    // ── Onglet weekly : on utilise directement weeklyPlayers ────────────────
    if (selectedTab === "weekly") {
      setFilteredPlayers(weeklyPlayers.slice(0, 20));
      return;
    }

    let base = players;
    if (selectedTab === "region") {
  base = players.filter((p) => 
    hasText(p.region) && 
    hasText(currentUser.region) && 
    p.region.toLowerCase().trim() === currentUser.region.toLowerCase().trim()
  );
} else if (selectedTab === "national") {
  base = players.filter((p) => 
    hasText(p.country) && 
    hasText(currentUser.country) && 
    p.country.toLowerCase().trim() === currentUser.country.toLowerCase().trim()
  );
}
    setFilteredPlayers(base.slice().sort((a, b) => b.trophies - a.trophies).slice(0, 20));
  }, [selectedTab, players, currentUser]);

  const podium = useMemo(() => topN(filteredPlayers, 3), [filteredPlayers]);

  // ─── ✅ NOUVEAU PODIUM CINÉMATIQUE ──────────────────────────────────────
  const renderTopThree = useCallback(() => {
    if (podium.length < 3) {
      return (
        <Text
          style={[styles.noPlayersText, { color: currentTheme.colors.textSecondary }, { textAlign: "center" }]}
          numberOfLines={3} adjustsFontSizeToFit
        >
          {t("leaderboard.notEnough")}
        </Text>
      );
    }

    const [first, second, third] = podium;
    const slots = [
      { player: second, rank: 2 as const, delay: 100 },
      { player: first,  rank: 1 as const, delay: 0   },
      { player: third,  rank: 3 as const, delay: 180 },
    ];

    return (
      <Animated.View
  key={podium.map(p => p.id).join("-")}  // ✅ force re-render complet quand podium change
  entering={FadeInUp.delay(80).duration(360)}
  style={styles.podiumScene}
      >
        {/* Sol */}
        <View
          style={[
            styles.podiumFloor,
            { backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" },
          ]}
        />

        {slots.map(({ player, rank, delay }) => {
          const cfg = SLOT_CONFIG[rank];
          const isFirst = rank === 1;
          const avatarSize  = cfg.avatarSize(normalizeSize);
          const ringPad     = cfg.ringPad(normalizeSize);
          const ringSize    = avatarSize + ringPad * 2;
          const pedestalH   = cfg.pedestalH(normalizeSize);
          const medalSize   = cfg.medalSize(normalizeSize);

          return (
            <Animated.View
              key={`${rank}-${player.id}`}
              entering={ZoomIn.delay(delay).duration(400)}
              style={[styles.podiumSlot, { zIndex: isFirst ? 3 : rank === 2 ? 2 : 1 }]}
            >

              {/* ── Zone avatar ─────────────────────────────────── */}
              <View style={[styles.podiumAvatarZone, { marginBottom: normalizeSize(isFirst ? 10 : 8) }]}>

                {/* Halo doré (1er uniquement) */}
                {isFirst && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.podiumGoldHalo,
                      {
                        width:  ringSize + normalizeSize(24),
                        height: ringSize + normalizeSize(24),
                        borderRadius: (ringSize + normalizeSize(24)) / 2,
                        backgroundColor: cfg.glowColor,
                      },
                    ]}
                  />
                )}

                {/* Ring gradient */}
                <LinearGradient
                  colors={cfg.ringColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    source={
                      player.profileImage
                        ? { uri: player.profileImage }
                        : require("../assets/images/default-profile.webp")
                    }
                    defaultSource={require("../assets/images/default-profile.webp")}
                    style={{
                      width:        avatarSize,
                      height:       avatarSize,
                      borderRadius: avatarSize / 2,
                      borderWidth:  isFirst ? normalizeSize(2.5) : normalizeSize(2),
                      borderColor:  isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.85)",
                    }}
                    accessibilityRole="image"
                    accessibilityLabel={t("leaderboard.profileOf", { name: player.username })}
                  />
                </LinearGradient>

                {/* Médaille chip */}
                <View
                  style={[
                    styles.podiumMedalChip,
                    {
                      width:        medalSize,
                      height:       medalSize,
                      borderRadius: medalSize / 2,
                      bottom: -normalizeSize(isFirst ? 5 : 4),
                      right:  -normalizeSize(isFirst ? 3 : 2),
                      backgroundColor: isDarkMode ? "rgba(12,14,22,0.88)" : "rgba(255,255,255,0.92)",
                      borderColor:     isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                    },
                  ]}
                >
                  <Text style={{ fontSize: isFirst ? normalizeFont(17) : normalizeFont(13), includeFontPadding: false }}>
                    {cfg.medal}
                  </Text>
                </View>
              </View>

              {/* ── Nom ─────────────────────────────────────────── */}
              <Text
                style={[
                  styles.podiumSlotName,
                  {
                    fontSize: cfg.nameSize(normalizeFont),
                    color: isDarkMode
                      ? isFirst ? "#FFFFFF" : "rgba(255,255,255,0.90)"
                      : "#0B0B10",
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {player.username}
              </Text>

              {/* ── Score ───────────────────────────────────────── */}
              <View style={styles.podiumSlotScoreRow}>
                <Text style={{ fontSize: normalizeFont(isFirst ? 12 : 11), includeFontPadding: false, marginRight: normalizeSize(3) }}>
                  🏆
                </Text>
                <Text
                  style={[
                    styles.podiumSlotScore,
                    { fontSize: cfg.scoreSize(normalizeFont), color: podiumScoreColor },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {Number(player.trophies || 0).toLocaleString(i18n.language)}
                </Text>
              </View>

              {/* ── Socle ───────────────────────────────────────── */}
              <View
                style={[
                  styles.podiumPedestal,
                  {
                    height: pedestalH,
                    borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
                  },
                ]}
              >
                {/* Fond gradient du socle */}
                <LinearGradient
                  colors={[cfg.pedestalTop, cfg.pedestalMid, "transparent"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.60)",
                      borderTopLeftRadius: normalizeSize(8),
                      borderTopRightRadius: normalizeSize(8),
                    },
                  ]}
                />
                {/* Numéro dans le socle */}
                <Text
                  style={[
                    styles.podiumPedestalRank,
                    {
                      fontSize: isFirst ? normalizeFont(22) : normalizeFont(17),
                      color: isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)",
                    },
                  ]}
                >
                  {rank}
                </Text>
              </View>

            </Animated.View>
          );
        })}
      </Animated.View>
    );
  }, [podium, currentTheme, t, isDarkMode, i18n.language, podiumScoreColor]);

  // ─── PlayerItem (inchangé) ────────────────────────────────────────────────
  const PlayerItem = useMemo(
    () =>
      React.memo(({ item, index }: { item: Player; index: number }) => {
        const rank = item.rank ?? index + 4;
        return (
          <Animated.View
            entering={FadeInUp.delay(220 + index * 40)}
            style={[
              styles.row,
              {
                backgroundColor: item.id === currentUser?.id ? cardBgMe : cardBg,
                borderColor:     item.id === currentUser?.id ? rowStrokeMe : rowStroke,
                borderWidth: StyleSheet.hairlineWidth,
                shadowOpacity: 0,
                elevation: 0,
              },
            ]}
          >
            <View pointerEvents="none" style={[styles.rowInnerHighlight, { opacity: isDarkMode ? 0.10 : 0.18 }]} />

            <View style={styles.leftSection}>
              <View style={styles.avatarWrap}>
                <Image
                  source={item.profileImage ? { uri: item.profileImage } : require("../assets/images/default-profile.webp")}
                  defaultSource={require("../assets/images/default-profile.webp")}
                  style={[styles.avatar, item.id === currentUser?.id && styles.avatarMe]}
                  accessibilityRole="image"
                  accessibilityLabel={(item.isPioneer ? "Pioneer · " : "") + t("leaderboard.profileOf", { name: item.username })}
                />
              </View>
              <View style={styles.playerInfo}>
                <Text
                  style={[styles.name, { color: primaryText }, { writingDirection: I18nManager.isRTL ? "rtl" : "ltr", textAlign: I18nManager.isRTL ? "right" : "left" }]}
                  numberOfLines={1} adjustsFontSizeToFit
                >
                  {item.username}
                </Text>
                <Text style={[styles.handle, { color: secondaryText }, { writingDirection: "ltr" }]} numberOfLines={1} adjustsFontSizeToFit>
                  @{(item.username || "").toLocaleLowerCase("en-US")}
                </Text>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={[styles.trophyChip, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)" }]}>
                <Text style={[styles.trophyIcon, { color: isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.70)" }]}>🏆</Text>
                <Text style={[styles.score, { color: isDarkMode ? "rgba(255,255,255,0.96)" : "#0B0B10" }]} numberOfLines={1} adjustsFontSizeToFit>
                  {Number(item.trophies || 0).toLocaleString(i18n.language)}
                </Text>
              </View>
              <Text style={[styles.rank, { color: secondaryText }]} numberOfLines={1}>
                #{typeof rank === "number" ? rank.toLocaleString(i18n.language) : rank}
              </Text>
            </View>
          </Animated.View>
        );
      }),
    [currentTheme, currentUser, t, isDarkMode, i18n.language]
  );

  // ─── listPlayers (inchangé) ───────────────────────────────────────────────
  const listPlayers = useMemo(() => {
    const basis = selectedTab === "global" ? players : filteredPlayers;
    const slice = filteredPlayers.slice(3, 20);
    const idx = basis.findIndex((p) => p.id === currentUser?.id);
    if (currentUser && idx > 19) slice.push({ ...currentUser, rank: idx + 1 });
    return slice;
  }, [filteredPlayers, players, currentUser, selectedTab, weeklyPlayers]);

  // ─── MyRankCard (inchangé) ────────────────────────────────────────────────
  const MyRankCard = useMemo(() => {
    if (!currentUser) return null;
    const basis = selectedTab === "global" ? players : filteredPlayers;
    const myIndex = basis.findIndex((p) => p.id === currentUser.id);
    const myRank = myIndex >= 0 ? myIndex + 1 : undefined;
    return (
      <View style={styles.myRankOuter}>
        <LinearGradient colors={meRingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.myRankRing}>
          <View pointerEvents="none" style={[styles.myRankHalo, { backgroundColor: meHalo }]} />
          <View style={[styles.myRankCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.95)", borderWidth: 0 }]}>
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)", "transparent"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.myRankSheen}
            />
            <View style={styles.myRankLeft}>
              <Image
                source={currentUser.profileImage ? { uri: currentUser.profileImage } : require("../assets/images/default-profile.webp")}
                style={[styles.myRankAvatar, { borderColor: isDarkMode ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.14)" }]}
                accessibilityRole="image"
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.myRankName, { color: primaryText }]} numberOfLines={1} adjustsFontSizeToFit>
                  {currentUser.username || t("leaderboard.unknown", { defaultValue: "Unknown" })}
                </Text>
                <View style={[styles.myRankSubRow, { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" }]}>
                  <Text style={[styles.myRankSub, { color: secondaryText }]} numberOfLines={1} adjustsFontSizeToFit>
                    {myRank ? `#${myRank.toLocaleString(i18n.language)}` : "—"}
                  </Text>
                  <Text style={[styles.myRankSub, { color: secondaryText }]}> · </Text>
                  <Text style={[styles.myRankSub, { color: secondaryText }]}>🏆 </Text>
                  <Text style={[styles.myRankTrophyText, { color: secondaryText }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Number(currentUser.trophies || 0).toLocaleString(i18n.language)}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={shareMyRankCard}
              style={[styles.myRankShareBtn, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)", borderWidth: StyleSheet.hairlineWidth, borderColor: isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.10)" }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("leaderboard.share")}
            >
              <Ionicons name="share-social-outline" size={18} color={isDarkMode ? "#fff" : "#0B0B10"} />
              <Text style={[styles.myRankShareText, { color: isDarkMode ? "#fff" : "#0B0B10" }]}>
                {t("leaderboard.share")}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }, [currentUser, players, filteredPlayers, selectedTab, shareMyRankCard, t, i18n.language]);

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground, currentTheme.colors.primary + "22"]}
        style={styles.gradientContainer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden />
          <CustomHeader title={t("leaderboard.title")} />
          <View style={{ paddingHorizontal: SPACING, marginTop: SPACING * 2 }}>
            {/* Podium skeleton — mêmes proportions que le vrai */}
            <View style={[styles.podiumScene, { opacity: 0.7 }]}>
              {[
                { h: normalizeSize(50), av: normalizeSize(72) },
                { h: normalizeSize(72), av: normalizeSize(88) },
                { h: normalizeSize(38), av: normalizeSize(66) },
              ].map((cfg, i) => (
                <View key={i} style={[styles.podiumSlot]}>
                  <View style={[styles.podiumAvatarZone, { marginBottom: normalizeSize(8) }]}>
                    <LinearGradient
                      colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
                      style={{ width: cfg.av + 10, height: cfg.av + 10, borderRadius: (cfg.av + 10) / 2 }}
                    />
                  </View>
                  <View style={{ width: normalizeSize(60), height: normalizeSize(12), borderRadius: 6, backgroundColor: currentTheme.colors.background + "55", marginBottom: 6 }} />
                  <View style={{ width: normalizeSize(40), height: normalizeSize(10), borderRadius: 5, backgroundColor: currentTheme.colors.background + "40", marginBottom: normalizeSize(8) }} />
                  <LinearGradient
                    colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
                    style={[styles.podiumPedestal, { height: cfg.h, borderColor: "transparent" }]}
                  />
                </View>
              ))}
            </View>
            {/* Row skeletons */}
            <View style={styles.listContainer}>
              {[...Array(5)].map((_, i) => (
                <View key={i} style={styles.skelRow}>
                  <View style={styles.leftSection}>
                    <View style={{ width: normalizeSize(48), height: normalizeSize(48), borderRadius: normalizeSize(24), backgroundColor: currentTheme.colors.background + "55" }} />
                    <View style={{ marginLeft: SPACING }}>
                      <View style={{ width: normalizeSize(120), height: normalizeSize(14), borderRadius: 7, backgroundColor: currentTheme.colors.background + "55", marginBottom: 6 }} />
                      <View style={{ width: normalizeSize(80),  height: normalizeSize(11), borderRadius: 5, backgroundColor: currentTheme.colors.background + "40" }} />
                    </View>
                  </View>
                  <View style={{ width: normalizeSize(70), height: normalizeSize(28), borderRadius: 14, backgroundColor: currentTheme.colors.background + "55" }} />
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground, currentTheme.colors.primary + "22"]}
      style={styles.gradientContainer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <LinearGradient pointerEvents="none" colors={[currentTheme.colors.primary + "33", "transparent"]} style={styles.bgOrbTop} />
      <LinearGradient pointerEvents="none" colors={[currentTheme.colors.secondary + "33", "transparent"]} style={styles.bgOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <CustomHeader title={t("leaderboard.title")} />

        {/* Tabs */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.tabsContainer}>
          <BlurView intensity={28} tint={isDarkMode ? "dark" : "light"} style={styles.tabsBlur}>
            {(["region", "national", "global"] as const).map((tab) => {
              const active = selectedTab === tab;
              return (
                <Animated.View key={tab} entering={ZoomIn.delay(100 * (["region", "national", "global"].indexOf(tab) + 1))} style={styles.tabWrap}>
                  <TouchableOpacity
                    onPress={() => setSelectedTab(tab)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t(`leaderboard.filter.${tab}`)}
                    testID={`tab-${tab}`}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    {active && (
                      <LinearGradient
                        colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.tabGradientBg}
                      />
                    )}
                    <Text style={[styles.tabText, { color: active ? "#FFFFFF" : isDarkMode ? "#EAEAEA" : "#111111" }]} numberOfLines={1} adjustsFontSizeToFit>
                      {t(`leaderboard.tab.${tab}`)}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </BlurView>
        </Animated.View>

        {/* ── Toggle Cette semaine ───────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(160)} style={{ paddingHorizontal: SPACING, marginBottom: SPACING * 0.8 }}>
          <TouchableOpacity
            onPress={() => setSelectedTab(prev => prev === "weekly" ? "global" : "weekly")}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: normalizeSize(8),
              paddingVertical: normalizeSize(10),
              paddingHorizontal: normalizeSize(16),
              borderRadius: normalizeSize(12),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: selectedTab === "weekly"
                ? (isDarkMode ? "rgba(249,115,22,0.55)" : "rgba(249,115,22,0.40)")
                : (isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"),
              backgroundColor: selectedTab === "weekly"
                ? (isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)")
                : (isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
            }}
          >
            <Ionicons
              name="calendar-outline"
              size={normalizeSize(14)}
              color={selectedTab === "weekly" ? "#F97316" : (isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.40)")}
            />
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: normalizeFont(13),
              color: selectedTab === "weekly" ? "#F97316" : (isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"),
            }}>
              {t("leaderboard.tab.weekly", { defaultValue: "Cette semaine" })}
            </Text>
            {selectedTab === "weekly" && (
              <Ionicons name="checkmark-circle" size={normalizeSize(14)} color="#F97316" />
            )}
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing} onRefresh={onRefresh}
              tintColor={currentTheme.colors.secondary}
              colors={[currentTheme.colors.secondary]}
            />
          }
        >
          {filteredPlayers.length > 0 ? (
            <>
              {renderTopThree()}
              {MyRankCard}
              <View style={styles.listContainer}>
                <FlatList
                  data={listPlayers}
                  renderItem={({ item, index }) => <PlayerItem item={item} index={index} />}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  getItemLayout={(_, index) => ({ length: normalizeSize(72), offset: normalizeSize(72) * index, index })}
                  accessibilityRole="list"
                  accessibilityLabel={t("leaderboard.listLabel")}
                />
              </View>
            </>
          ) : (
            <Text style={[styles.noPlayersText, { color: currentTheme.colors.textSecondary, textAlign: "center" }]} numberOfLines={3} adjustsFontSizeToFit>
              {t("leaderboard.noPlayers")}
            </Text>
          )}

          {locationDisabledMessage && (
            <Animated.View entering={FadeInUp.delay(200)} style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: currentTheme.colors.textSecondary }]}>
                {locationDisabledMessage}
              </Text>
              <TouchableOpacity style={[styles.settingsButton, { backgroundColor: currentTheme.colors.primary, marginBottom: SPACING }]} onPress={onRefresh} accessibilityLabel={t("leaderboard.retry", { defaultValue: "Réessayer" })}>
                <Text style={[styles.settingsButtonText, { color: currentTheme.colors.textPrimary }]}>{t("leaderboard.retry", { defaultValue: "Réessayer" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.settingsButton, { backgroundColor: currentTheme.colors.primary }]} onPress={() => router.push("/settings")} accessibilityLabel={t("leaderboard.enableLocation")}>
                <Text style={[styles.settingsButtonText, { color: currentTheme.colors.textPrimary }]}>{t("leaderboard.enableLocation")}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {rankSharePayload && (
        <View style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>
          <RankShareCard ref={rankShareRef} username={rankSharePayload.username} rank={rankSharePayload.rank} trophies={rankSharePayload.trophies} avatarUri={rankSharePayload.avatarUri} />
        </View>
      )}
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:           { flex: 1, paddingTop: 0 },
  gradientContainer:  { flex: 1 },

  bgOrbTop: {
    position: "absolute", top: -SCREEN_WIDTH * 0.28, right: -SCREEN_WIDTH * 0.22,
    width: SCREEN_WIDTH * 0.86, height: SCREEN_WIDTH * 0.86,
    borderRadius: SCREEN_WIDTH * 0.43, opacity: 0.42,
    transform: [{ rotate: "18deg" }],
  },
  bgOrbBottom: {
    position: "absolute", bottom: -SCREEN_WIDTH * 0.30, left: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.95, height: SCREEN_WIDTH * 0.95,
    borderRadius: SCREEN_WIDTH * 0.475, opacity: 0.40,
    transform: [{ rotate: "-10deg" }],
  },

  // ── ✅ Nouveau podium ──────────────────────────────────────────────────────
  podiumScene: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: SPACING * 0.5,
    marginTop: SPACING * 1.2,
    marginBottom: SPACING * 0.2,
    // gap entre slots
    columnGap: normalizeSize(4),
  },

  podiumFloor: {
    position: "absolute",
    bottom: 0,
    left: SPACING * 2,
    right: SPACING * 2,
    height: StyleSheet.hairlineWidth,
  },

  podiumSlot: {
    flex: 1,
    alignItems: "center",
    maxWidth: normalizeSize(118),
  },

  podiumAvatarZone: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  podiumGoldHalo: {
    position: "absolute",
    // width/height/borderRadius dynamiques inline
  },

  podiumMedalChip: {
    position: "absolute",
    // bottom/right/width/height/borderRadius dynamiques inline
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 4,
    elevation: 4,
  },

  podiumSlotName: {
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    includeFontPadding: false,
    paddingHorizontal: normalizeSize(4),
    maxWidth: "100%",
    marginBottom: normalizeSize(2),
  },

  podiumSlotScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: normalizeSize(8),
  },

  podiumSlotScore: {
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },

  podiumPedestal: {
    width: "86%",
    borderTopLeftRadius:  normalizeSize(8),
    borderTopRightRadius: normalizeSize(8),
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: normalizeSize(7),
    overflow: "hidden",
  },

  podiumPedestalRank: {
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
  // ── fin podium ─────────────────────────────────────────────────────────────

  // Tabs
  tabsContainer: { paddingHorizontal: SPACING, marginTop: SPACING * 1.2, marginBottom: SPACING * 0.6 },
  tabsBlur: { flexDirection: "row", borderRadius: normalizeSize(16), padding: 5, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" },
  tabWrap:  { flex: 1 },
  tab:      { height: normalizeSize(40), borderRadius: normalizeSize(13), alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "transparent" },
  tabActive:{ backgroundColor: "rgba(255,255,255,0.10)" },
  tabGradientBg: { ...StyleSheet.absoluteFillObject, borderRadius: normalizeSize(13), opacity: 0.55 },
  tabText:  { fontSize: normalizeFont(13.5), fontFamily: "Comfortaa_700Bold", textAlign: "center", includeFontPadding: false },

  // Scroll
  scrollContent: { paddingBottom: normalizeSize(90) + SPACING },
  listContainer: { paddingHorizontal: SPACING, marginTop: SPACING * 0.8 },

  // Row
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: normalizeSize(12), paddingHorizontal: normalizeSize(12), borderRadius: normalizeSize(16), marginVertical: normalizeSize(5), overflow: "hidden" },
  rowInnerHighlight: { position: "absolute", top: 0, left: 0, right: 0, height: "48%", borderRadius: normalizeSize(16), backgroundColor: "rgba(255,255,255,1)" },
  leftSection:  { flexDirection: "row", alignItems: "center", flex: 1 },
  rightSection: { alignItems: "flex-end", justifyContent: "center", marginLeft: 10, gap: normalizeSize(6) },
  avatarWrap:   { position: "relative" },
  avatar:       { width: normalizeSize(48), height: normalizeSize(48), borderRadius: normalizeSize(24) },
  avatarMe:     { transform: [{ scale: 1.03 }] },
  playerInfo:   { marginLeft: normalizeSize(12), flex: 1 },
  name:         { fontSize: normalizeFont(15.5), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  handle:       { marginTop: 3, fontSize: normalizeFont(12), fontFamily: "Comfortaa_400Regular", includeFontPadding: false },
  score:        { fontSize: normalizeFont(15), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  rank:         { marginTop: 3, fontSize: normalizeFont(12), fontFamily: "Comfortaa_400Regular", includeFontPadding: false, opacity: 0.9 },
  trophyChip:   { flexDirection: "row", alignItems: "center", paddingHorizontal: normalizeSize(10), paddingVertical: normalizeSize(6), borderRadius: 999, borderWidth: 1 },
  trophyIcon:   { fontSize: normalizeFont(13), marginRight: 6, includeFontPadding: false },

  // MyRankCard
  myRankOuter:  { marginHorizontal: SPACING, marginTop: SPACING * 0.8, borderRadius: normalizeSize(18) },
  myRankRing:   { borderRadius: normalizeSize(18), padding: normalizeSize(2), overflow: "hidden" },
  myRankHalo:   { position: "absolute", top: -normalizeSize(18), right: -normalizeSize(22), width: normalizeSize(90), height: normalizeSize(90), borderRadius: 999, opacity: 0.9 },
  myRankSheen:  { position: "absolute", top: -normalizeSize(22), left: -normalizeSize(40), width: "140%", height: normalizeSize(70), transform: [{ rotate: "-12deg" }], opacity: 0.9 },
  myRankCard:   { width: "100%", paddingVertical: normalizeSize(12), paddingHorizontal: normalizeSize(12), borderRadius: normalizeSize(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden" },
  myRankLeft:   { flexDirection: "row", alignItems: "center", flex: 1 },
  myRankAvatar: { width: normalizeSize(44), height: normalizeSize(44), borderRadius: normalizeSize(22), borderWidth: StyleSheet.hairlineWidth },
  myRankName:   { fontFamily: "Comfortaa_700Bold", fontSize: normalizeFont(14.5), includeFontPadding: false },
  myRankSubRow: { marginTop: 2, alignItems: "center", flexWrap: "nowrap" },
  myRankSub:    { fontFamily: "Comfortaa_400Regular", fontSize: normalizeFont(12), marginTop: 2, includeFontPadding: false },
  myRankTrophyText: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeFont(12), includeFontPadding: false },
  myRankShareBtn:   { flexDirection: "row", alignItems: "center", paddingHorizontal: normalizeSize(12), paddingVertical: normalizeSize(9), borderRadius: 999 },
  myRankShareText:  { marginLeft: 6, fontFamily: "Comfortaa_700Bold", fontSize: normalizeFont(12), includeFontPadding: false },

  // Skeleton
  skelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: normalizeSize(12), paddingHorizontal: normalizeSize(12), borderRadius: normalizeSize(16), marginVertical: normalizeSize(5), backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" },

  // Empty / error
  noPlayersText: { fontSize: normalizeFont(16), fontFamily: "Comfortaa_400Regular", textAlign: "center", padding: SPACING * 1.5 },
  errorContainer: { alignItems: "center", padding: SPACING * 2.5 },
  errorText: { fontSize: normalizeFont(15), textAlign: "center", marginBottom: SPACING * 1.5 },
  settingsButton: { paddingVertical: SPACING * 1.1, paddingHorizontal: SPACING * 2.2, borderRadius: normalizeSize(999), backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  settingsButtonText: { fontSize: normalizeFont(14), fontFamily: "Comfortaa_700Bold" },
});
