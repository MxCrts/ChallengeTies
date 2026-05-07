import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
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
import Animated, {
  FadeInUp,
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { useShareCard } from "@/hooks/useShareCard";
import { RankShareCard } from "@/components/ShareCards";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";

const SPACING = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ns = (size: number) => {
  const scale = Math.min(Math.max(SCREEN_WIDTH / 375, 0.72), 1.7);
  return Math.round(size * scale);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  username: string;
  trophies: number;
  profileImage?: string;
  country?: string;
  region?: string;
  rank?: number;
  isPioneer?: boolean;
  weeklyTrophies?: number; // trophées gagnés cette semaine (weekly tab)
}

type Tab = "global" | "national" | "regional" | "weekly";

// ─── Podium config ────────────────────────────────────────────────────────────

const PODIUM = {
  1: {
    h: ns(80), avatarSize: ns(88), pad: ns(5),
    medal: "👑",
    ring: ["#FFD700", "#FFA500", "#FFE066"] as const,
    glow: "rgba(255,215,0,0.18)",
    label: ns(15.5), score: ns(12.5), medalSize: ns(30),
  },
  2: {
    h: ns(56), avatarSize: ns(72), pad: ns(4),
    medal: "🥈",
    ring: ["rgba(200,210,230,0.9)", "rgba(150,160,180,0.5)"] as const,
    glow: "transparent",
    label: ns(14), score: ns(12), medalSize: ns(24),
  },
  3: {
    h: ns(42), avatarSize: ns(66), pad: ns(4),
    medal: "🥉",
    ring: ["rgba(195,115,45,0.9)", "rgba(120,70,30,0.5)"] as const,
    glow: "transparent",
    label: ns(14), score: ns(12), medalSize: ns(24),
  },
} as const;

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  // ── State ──────────────────────────────────────────────────────────────────
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [weeklyPlayers, setWeeklyPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [tab, setTab] = useState<Tab>("global");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);

  const { ref: rankShareRef, share: shareRankCard } = useShareCard();
  const [rankSharePayload, setRankSharePayload] = useState<{
    username: string; rank: number | string; trophies?: number; avatarUri?: string | null;
  } | null>(null);

  // ── Colors ─────────────────────────────────────────────────────────────────
  const C = useMemo(() => ({
    text:        isDark ? "#F0F0F5" : "#0B0B10",
    textMuted:   isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)",
    cardBg:      isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.82)",
    cardBgMe:    isDark ? "rgba(255,255,255,0.10)"  : "rgba(255,255,255,0.96)",
    stroke:      isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)",
    strokeMe:    isDark ? "rgba(255,255,255,0.16)"  : "rgba(0,0,0,0.10)",
    orange:      "#F97316",
    orangeLight: isDark ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.08)",
    orangeBorder:isDark ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.22)",
    podiumScore: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.55)",
  }), [isDark]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // Cache
      const cached = await AsyncStorage.getItem("lb_cache_v2");
      if (cached) setAllPlayers(JSON.parse(cached));

      // Global leaderboard
      const gq = query(collection(db, "users"), orderBy("trophies", "desc"), limit(20));
      const gSnap = await getDocs(gq);
      const global: Player[] = gSnap.docs.map((d) => ({
        id: d.id,
        username: d.data().username ?? "?",
        trophies: d.data().trophies ?? 0,
        profileImage: d.data().profileImage ?? undefined,
        country: d.data().country ?? "",
        region: d.data().region ?? "",
        isPioneer: !!d.data().isPioneer,
      }));
      setAllPlayers(global);
      AsyncStorage.setItem("lb_cache_v2", JSON.stringify(global)).catch(() => {});

      // Weekly leaderboard
      const wq = query(collection(db, "leaderboard_weekly"), orderBy("trophies", "desc"), limit(20));
      const wSnap = await getDocs(wq);
      const weekly: Player[] = wSnap.docs.map((d) => ({
        id: d.id,
        username: d.data().username ?? "?",
        trophies: d.data().trophies ?? 0,         // trophées gagnés cette semaine
        profileImage: d.data().profileImage ?? undefined,
        country: d.data().country ?? "",
        region: d.data().region ?? "",
        isPioneer: !!d.data().isPioneer,
        weeklyTrophies: d.data().trophies ?? 0,
      }));
      setWeeklyPlayers(weekly);

      // Current user
      const uid = auth.currentUser?.uid;
      if (uid) {
        const uSnap = await getDoc(doc(db, "users", uid));
        if (uSnap.exists()) {
          const d = uSnap.data();
          const found = global.find((p) => p.id === uid) ?? {
            id: uid,
            username: d.username ?? "?",
            trophies: d.trophies ?? 0,
            profileImage: d.profileImage ?? undefined,
            country: d.country ?? "",
            region: d.region ?? "",
            isPioneer: !!d.isPioneer,
          };
          setCurrentUser(found);
          if (!d.locationEnabled) setLocationMsg(t("leaderboard.locationDisabled"));
        }
      }
    } catch {
      setLocationMsg(t("leaderboard.errorFetch"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Filtered players ────────────────────────────────────────────────────────
  const displayPlayers = useMemo((): Player[] => {
    if (tab === "weekly") return weeklyPlayers;
    let base = allPlayers;
    if (tab === "national" && currentUser?.country) {
      base = allPlayers.filter(
        (p) => p.country?.toLowerCase().trim() === currentUser.country?.toLowerCase().trim()
      );
    } else if (tab === "regional" && currentUser?.region) {
      base = allPlayers.filter(
        (p) => p.region?.toLowerCase().trim() === currentUser.region?.toLowerCase().trim()
      );
    }
    return base.slice().sort((a, b) => b.trophies - a.trophies).slice(0, 20);
  }, [tab, allPlayers, weeklyPlayers, currentUser]);

  const podium = useMemo(() => displayPlayers.slice(0, 3), [displayPlayers]);
  const listRows = useMemo(() => {
    const rows = displayPlayers.slice(3, 20);
    if (currentUser) {
      const idx = displayPlayers.findIndex((p) => p.id === currentUser.id);
      if (idx > 19) rows.push({ ...currentUser, rank: idx + 1 });
    }
    return rows;
  }, [displayPlayers, currentUser]);

  // ── Share ───────────────────────────────────────────────────────────────────
  const shareMyRank = useCallback(async () => {
    if (!currentUser) return;
    const idx = displayPlayers.findIndex((p) => p.id === currentUser.id);
    const rank = idx >= 0 ? idx + 1 : "—";
    try { await Haptics.selectionAsync(); } catch {}
    setRankSharePayload({
      username: currentUser.username,
      rank,
      trophies: currentUser.trophies,
      avatarUri: currentUser.profileImage ?? null,
    });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await shareRankCard(`ct-rank-${currentUser.id}-${Date.now()}.png`, t("leaderboard.shareDialogTitle", { defaultValue: "Mon rang" }));
    setRankSharePayload(null);
  }, [currentUser, displayPlayers, shareRankCard, t]);

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
        style={S.flex}
      >
        <SafeAreaView style={S.flex}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <CustomHeader title={t("leaderboard.title")} />
          <SkeletonLoader isDark={isDark} C={C} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={[currentTheme.colors.background, currentTheme.colors.cardBackground, currentTheme.colors.primary + "18"]}
      style={S.flex}
      start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
    >
      <SafeAreaView style={S.flex}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <CustomHeader title={t("leaderboard.title")} />

        {/* ── Tabs ── */}
        <Animated.View entering={FadeInUp.delay(60).duration(280)} style={S.tabsRow}>
          <BlurView
            intensity={isDark ? 22 : 16}
            tint={isDark ? "dark" : "light"}
            style={S.tabsBlur}
          >
            {(["global", "national", "regional"] as const).map((t_) => {
              const active = tab === t_;
              return (
                <TouchableOpacity
                  key={t_}
                  onPress={() => setTab(t_)}
                  style={[S.tab, active && { backgroundColor: C.orange }]}
                  activeOpacity={0.82}
                >
                  <Text style={[S.tabText, { color: active ? "#FFF" : C.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                    {t(`leaderboard.tab.${t_}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </BlurView>

          {/* Weekly toggle */}
          <TouchableOpacity
            onPress={() => setTab((prev) => prev === "weekly" ? "global" : "weekly")}
            style={[
              S.weeklyToggle,
              {
                backgroundColor: tab === "weekly" ? C.orangeLight : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
                borderColor: tab === "weekly" ? C.orangeBorder : C.stroke,
              },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="calendar-outline"
              size={ns(13)}
              color={tab === "weekly" ? C.orange : C.textMuted}
            />
            <Text style={[S.weeklyToggleText, { color: tab === "weekly" ? C.orange : C.textMuted }]}>
              {t("leaderboard.tab.weekly", { defaultValue: "Cette semaine" })}
            </Text>
            {tab === "weekly" && (
              <Ionicons name="checkmark-circle" size={ns(12)} color={C.orange} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── Weekly header info ── */}
        {tab === "weekly" && (
          <Animated.View entering={FadeIn.duration(220)} style={[S.weeklyInfoBanner, { backgroundColor: C.orangeLight, borderColor: C.orangeBorder }]}>
            <Ionicons name="flame-outline" size={ns(14)} color={C.orange} />
            <Text style={[S.weeklyInfoText, { color: C.orange }]}>
              {t("leaderboard.weeklyInfo", { defaultValue: "Trophées gagnés cette semaine — reset chaque lundi" })}
            </Text>
          </Animated.View>
        )}

        {/* ── Main list ── */}
        <ScrollView
          contentContainerStyle={S.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.orange}
              colors={[C.orange]}
            />
          }
        >
          {displayPlayers.length >= 3 ? (
            <>
              <PodiumSection
                podium={podium}
                isDark={isDark}
                C={C}
                i18nLang={i18n.language}
                tab={tab}
                t={t}
              />

              {/* My rank card */}
              {currentUser && (
                <MyRankCard
                  currentUser={currentUser}
                  displayPlayers={displayPlayers}
                  tab={tab}
                  isDark={isDark}
                  C={C}
                  i18nLang={i18n.language}
                  onShare={shareMyRank}
                  t={t}
                />
              )}

              {/* Rows 4-20 */}
              {listRows.length > 0 && (
                <View style={S.listWrap}>
                  {listRows.map((item, index) => (
                    <PlayerRow
                      key={item.id}
                      item={item}
                      index={index}
                      rank={item.rank ?? index + 4}
                      isMe={item.id === currentUser?.id}
                      isDark={isDark}
                      C={C}
                      i18nLang={i18n.language}
                      tab={tab}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <EmptyState isDark={isDark} C={C} tab={tab} weeklyPlayers={weeklyPlayers} t={t} />
          )}

          {locationMsg && (
            <View style={S.locationMsgWrap}>
              <Text style={[S.locationMsg, { color: C.textMuted }]}>{locationMsg}</Text>
              <TouchableOpacity style={[S.retryBtn, { backgroundColor: C.orange }]} onPress={onRefresh}>
                <Text style={S.retryBtnText}>{t("leaderboard.retry", { defaultValue: "Réessayer" })}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {rankSharePayload && (
        <View style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>
          <RankShareCard
            ref={rankShareRef}
            username={rankSharePayload.username}
            rank={rankSharePayload.rank}
            trophies={rankSharePayload.trophies}
            avatarUri={rankSharePayload.avatarUri}
          />
        </View>
      )}
    </LinearGradient>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumSection({
  podium, isDark, C, i18nLang, tab, t,
}: {
  podium: Player[]; isDark: boolean; C: any; i18nLang: string; tab: Tab;
  t: (k: string, o?: any) => string;
}) {
  if (podium.length < 3) return null;

  const [first, second, third] = podium;
  const slots = [
    { player: second, rank: 2 as const, delay: 80  },
    { player: first,  rank: 1 as const, delay: 0   },
    { player: third,  rank: 3 as const, delay: 160 },
  ];

  return (
    <Animated.View
      key={podium.map((p) => p.id).join("-")}
      entering={FadeInUp.delay(100).duration(340)}
      style={S.podiumScene}
    >
      {slots.map(({ player, rank, delay }) => {
        const cfg = PODIUM[rank];
        const avatarSize = cfg.avatarSize;
        const ringSize   = avatarSize + cfg.pad * 2;
        const isFirst    = rank === 1;
        const trophyVal  = tab === "weekly" ? (player.weeklyTrophies ?? player.trophies) : player.trophies;

        return (
          <Animated.View
            key={`${rank}-${player.id}`}
            entering={ZoomIn.delay(delay).duration(360)}
            style={[S.podiumSlot, { zIndex: isFirst ? 3 : 1 }]}
          >
            {/* Avatar zone */}
            <View style={S.podiumAvatarZone}>
              {isFirst && (
                <View style={[S.podiumGlow, {
                  width: ringSize + ns(28), height: ringSize + ns(28),
                  borderRadius: (ringSize + ns(28)) / 2,
                  backgroundColor: cfg.glow,
                  top: -(ns(14)), left: -(ns(14)),
                }]} pointerEvents="none" />
              )}
              <LinearGradient
                colors={cfg.ring}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2, alignItems: "center", justifyContent: "center" }}
              >
                <Image
                  source={player.profileImage ? { uri: player.profileImage } : require("../assets/images/default-profile.webp")}
                  defaultSource={require("../assets/images/default-profile.webp")}
                  style={{
                    width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
                    borderWidth: isFirst ? ns(2.5) : ns(2),
                    borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
                  }}
                />
              </LinearGradient>

              {/* Medal chip */}
              <View style={[S.medalChip, {
                width: cfg.medalSize, height: cfg.medalSize, borderRadius: cfg.medalSize / 2,
                bottom: isFirst ? -ns(6) : -ns(5), right: isFirst ? -ns(4) : -ns(3),
                backgroundColor: isDark ? "rgba(12,14,22,0.90)" : "rgba(255,255,255,0.94)",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)",
              }]}>
                <Text style={{ fontSize: isFirst ? ns(17) : ns(13), includeFontPadding: false }}>
                  {cfg.medal}
                </Text>
              </View>
            </View>

            {/* Name */}
            <Text
              style={[S.podiumName, { fontSize: cfg.label, color: C.text }]}
              numberOfLines={1} adjustsFontSizeToFit
            >
              {player.username}
            </Text>

            {/* Score */}
            <View style={S.podiumScoreRow}>
              <Text style={{ fontSize: ns(isFirst ? 12 : 10.5), marginRight: ns(2) }}>🏆</Text>
              <Text style={[S.podiumScore, { fontSize: cfg.score, color: C.podiumScore }]} numberOfLines={1}>
                {Number(trophyVal).toLocaleString(i18nLang)}
              </Text>
            </View>

            {/* Pedestal */}
            <View style={[S.pedestal, {
              height: cfg.h,
              borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
            }]}>
              <Text style={[S.pedestalRank, {
                fontSize: isFirst ? ns(22) : ns(16),
                color: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)",
              }]}>
                {rank}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

// ─── My Rank Card ─────────────────────────────────────────────────────────────

function MyRankCard({
  currentUser, displayPlayers, tab, isDark, C, i18nLang, onShare, t,
}: {
  currentUser: Player; displayPlayers: Player[]; tab: Tab;
  isDark: boolean; C: any; i18nLang: string;
  onShare: () => void; t: (k: string, o?: any) => string;
}) {
  const idx   = displayPlayers.findIndex((p) => p.id === currentUser.id);
  const myRank = idx >= 0 ? idx + 1 : undefined;
  const trophyVal = tab === "weekly"
    ? (currentUser.weeklyTrophies ?? 0)
    : currentUser.trophies;

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.012, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View
      entering={FadeInUp.delay(260).duration(300)}
      style={[S.myRankWrap, pulseStyle]}
    >
      <LinearGradient
        colors={isDark
          ? ["rgba(249,115,22,0.28)", "rgba(249,115,22,0.10)", "rgba(249,115,22,0.18)"]
          : ["rgba(249,115,22,0.18)", "rgba(249,115,22,0.06)", "rgba(249,115,22,0.12)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={S.myRankRing}
      >
        <View style={[S.myRankCard, {
          backgroundColor: isDark ? "rgba(15,10,5,0.92)" : "rgba(255,255,255,0.96)",
        }]}>
          {/* Left */}
          <View style={S.myRankLeft}>
            <Image
              source={currentUser.profileImage ? { uri: currentUser.profileImage } : require("../assets/images/default-profile.webp")}
              style={[S.myRankAvatar, { borderColor: isDark ? "rgba(255,255,255,0.20)" : "rgba(249,115,22,0.30)" }]}
            />
            <View style={{ marginLeft: ns(10), flex: 1 }}>
              <Text style={[S.myRankName, { color: C.text }]} numberOfLines={1}>
                {currentUser.username}
              </Text>
              <View style={S.myRankSubRow}>
                <Text style={[S.myRankSub, { color: C.orange }]}>
                  {myRank ? `#${myRank.toLocaleString(i18nLang)}` : "—"}
                </Text>
                <Text style={[S.myRankDot, { color: C.textMuted }]}> · </Text>
                <Text style={[S.myRankSub, { color: C.textMuted }]}>
                  🏆 {Number(trophyVal).toLocaleString(i18nLang)}
                </Text>
                {tab === "weekly" && (
                  <Text style={[S.myRankWeeklyBadge, { color: C.orange }]}>
                    {" "}cette semaine
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Share btn */}
          <TouchableOpacity
            onPress={onShare}
            style={[S.shareBtn, { backgroundColor: C.orangeLight, borderColor: C.orangeBorder }]}
            activeOpacity={0.82}
          >
            <Ionicons name="share-social-outline" size={ns(15)} color={C.orange} />
            <Text style={[S.shareBtnText, { color: C.orange }]}>
              {t("leaderboard.share")}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({
  item, index, rank, isMe, isDark, C, i18nLang, tab,
}: {
  item: Player; index: number; rank: number; isMe: boolean;
  isDark: boolean; C: any; i18nLang: string; tab: Tab;
}) {
  const trophyVal = tab === "weekly" ? (item.weeklyTrophies ?? item.trophies) : item.trophies;
  const rankColor = rank === 4 ? "#FFD700" : rank === 5 ? "#C0C0C0" : rank === 6 ? "#CD7F32" : C.textMuted;

  return (
    <Animated.View
      entering={FadeInUp.delay(180 + index * 35).duration(260)}
      style={[
        S.row,
        {
          backgroundColor: isMe ? C.cardBgMe : C.cardBg,
          borderColor: isMe ? C.strokeMe : C.stroke,
          borderWidth: isMe ? 1 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Rank */}
      <View style={S.rowRank}>
        <Text style={[S.rowRankText, { color: rankColor, fontFamily: "Comfortaa_700Bold" }]} numberOfLines={1}>
          #{rank}
        </Text>
      </View>

      {/* Avatar */}
      <View style={S.rowAvatarWrap}>
        <Image
          source={item.profileImage ? { uri: item.profileImage } : require("../assets/images/default-profile.webp")}
          defaultSource={require("../assets/images/default-profile.webp")}
          style={[S.rowAvatar, isMe && { borderWidth: 1.5, borderColor: C.orange }]}
        />
        {item.isPioneer && (
          <View style={[S.pioneerDot, { backgroundColor: "#FFD700" }]} />
        )}
      </View>

      {/* Info */}
      <View style={S.rowInfo}>
        <Text style={[S.rowName, { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {item.username}
          {isMe && (
            <Text style={{ color: C.orange, fontSize: ns(10) }}> ◀ toi</Text>
          )}
        </Text>
        {item.isPioneer && (
          <Text style={[S.pioneerLabel, { color: "#FFD700" }]}>Pioneer</Text>
        )}
      </View>

      {/* Trophy chip */}
      <View style={[S.trophyChip, {
        backgroundColor: isDark ? "rgba(249,115,22,0.10)" : "rgba(249,115,22,0.06)",
        borderColor: isDark ? "rgba(249,115,22,0.20)" : "rgba(249,115,22,0.14)",
      }]}>
        <Text style={{ fontSize: ns(12), marginRight: ns(3) }}>🏆</Text>
        <Text style={[S.trophyChipText, { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {Number(trophyVal).toLocaleString(i18nLang)}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ isDark, C, tab, weeklyPlayers, t }: {
  isDark: boolean; C: any; tab: Tab; weeklyPlayers: Player[];
  t: (k: string, o?: any) => string;
}) {
  const msg = tab === "weekly" && weeklyPlayers.length === 0
    ? t("leaderboard.weeklyEmpty", { defaultValue: "Pas encore de données cette semaine.\nReviens lundi après une semaine active !" })
    : t("leaderboard.noPlayers");

  return (
    <Animated.View entering={FadeIn.duration(300)} style={S.emptyWrap}>
      <Ionicons name="trophy-outline" size={ns(52)} color={C.orange} style={{ opacity: 0.6, marginBottom: ns(14) }} />
      <Text style={[S.emptyText, { color: C.textMuted }]}>{msg}</Text>
    </Animated.View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonLoader({ isDark, C }: { isDark: boolean; C: any }) {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, []);
  const skelStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const bg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  return (
    <View style={{ paddingHorizontal: SPACING, marginTop: SPACING * 1.5 }}>
      {/* Podium skeleton */}
      <Animated.View style={[S.podiumScene, skelStyle]}>
        {[{ h: ns(56), av: ns(72) }, { h: ns(80), av: ns(88) }, { h: ns(42), av: ns(66) }].map((c, i) => (
          <View key={i} style={S.podiumSlot}>
            <View style={{ width: c.av + 10, height: c.av + 10, borderRadius: (c.av + 10) / 2, backgroundColor: bg, marginBottom: ns(8) }} />
            <View style={{ width: ns(64), height: ns(11), borderRadius: 6, backgroundColor: bg, marginBottom: ns(5) }} />
            <View style={{ width: ns(40), height: ns(10), borderRadius: 5, backgroundColor: bg, marginBottom: ns(8) }} />
            <View style={{ width: "80%", height: c.h, borderRadius: ns(8), backgroundColor: bg }} />
          </View>
        ))}
      </Animated.View>
      {/* Row skeletons */}
      {[...Array(6)].map((_, i) => (
        <Animated.View key={i} style={[S.row, skelStyle, { backgroundColor: bg, borderColor: "transparent", marginBottom: ns(7) }]}>
          <View style={{ width: ns(30), height: ns(14), borderRadius: 4, backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)", marginRight: ns(10) }} />
          <View style={{ width: ns(44), height: ns(44), borderRadius: ns(22), backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" }} />
          <View style={{ flex: 1, marginLeft: ns(10) }}>
            <View style={{ width: "55%", height: ns(13), borderRadius: 5, backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)", marginBottom: ns(5) }} />
            <View style={{ width: "35%", height: ns(10), borderRadius: 4, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }} />
          </View>
          <View style={{ width: ns(70), height: ns(28), borderRadius: ns(12), backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" }} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  flex:          { flex: 1 },
  scroll:        { paddingBottom: ns(100), paddingTop: ns(4) },

  // Tabs
  tabsRow:       { paddingHorizontal: SPACING, marginTop: ns(12), marginBottom: ns(8), gap: ns(8) },
  tabsBlur:      { flexDirection: "row", borderRadius: ns(14), padding: ns(4), overflow: "hidden", gap: ns(4) },
  tab:           { flex: 1, height: ns(38), borderRadius: ns(11), alignItems: "center", justifyContent: "center", paddingHorizontal: ns(4) },
  tabText:       { fontSize: ns(12.5), fontFamily: "Comfortaa_700Bold", textAlign: "center", includeFontPadding: false },
  weeklyToggle:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ns(6), paddingVertical: ns(9), paddingHorizontal: ns(14), borderRadius: ns(11), borderWidth: StyleSheet.hairlineWidth },
  weeklyToggleText: { fontSize: ns(12.5), fontFamily: "Comfortaa_700Bold" },
  weeklyInfoBanner: { marginHorizontal: SPACING, marginBottom: ns(10), flexDirection: "row", alignItems: "center", gap: ns(8), paddingVertical: ns(9), paddingHorizontal: ns(14), borderRadius: ns(12), borderWidth: StyleSheet.hairlineWidth },
  weeklyInfoText: { flex: 1, fontSize: ns(11.5), fontFamily: "Comfortaa_400Regular" },

  // Podium
  podiumScene:   { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", paddingHorizontal: SPACING, marginTop: ns(12), marginBottom: ns(6), columnGap: ns(4) },
  podiumSlot:    { flex: 1, alignItems: "center", maxWidth: ns(120) },
  podiumAvatarZone: { alignItems: "center", justifyContent: "center", position: "relative", marginBottom: ns(8) },
  podiumGlow:    { position: "absolute" },
  medalChip:     { position: "absolute", borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
  podiumName:    { fontFamily: "Comfortaa_700Bold", textAlign: "center", includeFontPadding: false, paddingHorizontal: ns(2), maxWidth: "100%", marginBottom: ns(2) },
  podiumScoreRow:{ flexDirection: "row", alignItems: "center", marginBottom: ns(8) },
  podiumScore:   { fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  pedestal:      { width: "88%", borderTopLeftRadius: ns(8), borderTopRightRadius: ns(8), borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, alignItems: "center", justifyContent: "flex-end", paddingBottom: ns(7), overflow: "hidden" },
  pedestalRank:  { fontFamily: "Comfortaa_700Bold", includeFontPadding: false },

  // My rank card
  myRankWrap:    { marginHorizontal: SPACING, marginTop: ns(8), marginBottom: ns(4), borderRadius: ns(18) },
  myRankRing:    { borderRadius: ns(18), padding: ns(2), overflow: "hidden" },
  myRankCard:    { borderRadius: ns(16), paddingVertical: ns(12), paddingHorizontal: ns(14), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  myRankLeft:    { flexDirection: "row", alignItems: "center", flex: 1 },
  myRankAvatar:  { width: ns(44), height: ns(44), borderRadius: ns(22), borderWidth: StyleSheet.hairlineWidth },
  myRankName:    { fontFamily: "Comfortaa_700Bold", fontSize: ns(14.5), includeFontPadding: false },
  myRankSubRow:  { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", marginTop: ns(2) },
  myRankSub:     { fontSize: ns(12), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  myRankDot:     { fontSize: ns(12), fontFamily: "Comfortaa_400Regular", includeFontPadding: false },
  myRankWeeklyBadge: { fontSize: ns(10), fontFamily: "Comfortaa_400Regular", includeFontPadding: false },
  shareBtn:      { flexDirection: "row", alignItems: "center", gap: ns(5), paddingHorizontal: ns(12), paddingVertical: ns(9), borderRadius: ns(999), borderWidth: 1 },
  shareBtnText:  { fontSize: ns(12), fontFamily: "Comfortaa_700Bold" },

  // Rows
  listWrap:      { paddingHorizontal: SPACING, marginTop: ns(6) },
  row:           { flexDirection: "row", alignItems: "center", borderRadius: ns(16), paddingVertical: ns(11), paddingHorizontal: ns(12), marginBottom: ns(6), overflow: "hidden" },
  rowRank:       { width: ns(34), alignItems: "center" },
  rowRankText:   { fontSize: ns(12), includeFontPadding: false },
  rowAvatarWrap: { position: "relative" },
  rowAvatar:     { width: ns(46), height: ns(46), borderRadius: ns(23) },
  pioneerDot:    { position: "absolute", bottom: 0, right: 0, width: ns(10), height: ns(10), borderRadius: ns(5), borderWidth: 1.5, borderColor: "#FFF" },
  rowInfo:       { flex: 1, marginLeft: ns(10) },
  rowName:       { fontSize: ns(14.5), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  pioneerLabel:  { fontSize: ns(10), fontFamily: "Comfortaa_700Bold", marginTop: ns(1), includeFontPadding: false },
  trophyChip:    { flexDirection: "row", alignItems: "center", paddingHorizontal: ns(10), paddingVertical: ns(6), borderRadius: ns(999), borderWidth: 1, marginLeft: ns(8) },
  trophyChipText:{ fontSize: ns(13.5), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },

  // Empty
  emptyWrap:     { alignItems: "center", paddingVertical: ns(60), paddingHorizontal: SPACING * 2 },
  emptyText:     { fontSize: ns(15), fontFamily: "Comfortaa_400Regular", textAlign: "center", lineHeight: ns(22) },

  // Error/location
  locationMsgWrap:{ alignItems: "center", paddingVertical: ns(20), paddingHorizontal: SPACING * 2 },
  locationMsg:   { fontSize: ns(14), fontFamily: "Comfortaa_400Regular", textAlign: "center", marginBottom: ns(12) },
  retryBtn:      { paddingVertical: ns(11), paddingHorizontal: ns(24), borderRadius: ns(999) },
  retryBtnText:  { fontSize: ns(14), fontFamily: "Comfortaa_700Bold", color: "#FFF" },
});
