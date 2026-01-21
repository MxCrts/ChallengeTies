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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
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

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "region" | "national" | "global"
  >("global");
  const [locationDisabledMessage, setLocationDisabledMessage] = useState<
    string | null
  >(null);
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
      const primaryText = isDarkMode ? "#FFFFFF" : "#0B0B10";
  const secondaryText = isDarkMode ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.55)";

  // Cards / rows: visible en light, glass en dark
  const cardBg = isDarkMode ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.78)";
  const cardBgMe = isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.88)";
  const rowStroke = isDarkMode
  ? "rgba(255,255,255,0.10)"
  : "rgba(0,0,0,0.08)";
  // Accent "moi" très visible mais premium
const meRingGrad: readonly [ColorValue, ColorValue, ...ColorValue[]] = isDarkMode
  ? ["rgba(255,255,255,0.34)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.22)"]
  : ["rgba(0,0,0,0.18)", "rgba(0,0,0,0.06)", "rgba(0,0,0,0.14)"];


const meHalo = isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  // Accent très léger pour différencier la carte "moi"
const meBg = isDarkMode ? "rgba(255,255,255,0.085)" : "rgba(255,255,255,0.92)";
const meRing = isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
const meRingSoft = isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";


const rowStrokeMe = isDarkMode
  ? "rgba(255,255,255,0.14)"
  : "rgba(0,0,0,0.10)";

const topHighlightOpacity = isDarkMode ? 0.08 : 0.14;


  // Podium score (fix invisible trophies in light)
  const podiumScoreColor = isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.70)";

const { ref: rankShareRef, share: shareRankCard } = useShareCard();
const [rankSharePayload, setRankSharePayload] = useState<{
  username: string;
  rank: number | string;
  trophies?: number;
  avatarUri?: string | null;
} | null>(null);
  // Cache
  const cacheLeaderboard = useCallback(async (players: Player[]) => {
    try {
      await AsyncStorage.setItem("leaderboardCache", JSON.stringify(players));
    } catch (e) {
      console.error("Erreur cache:", e);
    }
  }, []);

  const getCachedLeaderboard = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem("leaderboardCache");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Erreur lecture cache:", e);
      return null;
    }
  }, []);

  // Chargement des données
    const fetchLeaderboard = useCallback(async () => {
      try {
        !refreshing && setLoading(true);
        const cached = await getCachedLeaderboard();
        if (cached) setPlayers(cached);

        const q = query(
          collection(db, "users"),
          orderBy("trophies", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const fetched: Player[] = snapshot.docs.map((d) => ({
          id: d.id,
          username: d.data().username?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
          trophies: d.data().trophies || 0,
          profileImage: d.data().profileImage?.toString?.() || null,
          country: d.data().country?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
          region: d.data().region?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
          isPioneer: !!d.data().isPioneer,
        }));
        setPlayers(fetched);
        cacheLeaderboard(fetched);

        const uid = auth.currentUser?.uid;
        if (uid) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const found = fetched.find((p) => p.id === uid) || {
              id: uid,
              username: data.username?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
              trophies: data.trophies || 0,
              profileImage: data.profileImage?.toString?.() || null,
              country: data.country?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
              region: data.region?.toString?.() || t("leaderboard.unknown", { defaultValue: "Unknown" }),
              isPioneer: !!data.isPioneer,
            };
            setCurrentUser(found);
            setLocationDisabledMessage(
              data.locationEnabled ? null : t("leaderboard.locationDisabled")
            );
          } else {
            setCurrentUser(null);
            setLocationDisabledMessage(t("leaderboard.userNotFound"));
          }
        }
      } catch (e) {
        console.error("Erreur fetch leaderboard:", e);
        setLocationDisabledMessage(t("leaderboard.errorFetch"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [t, cacheLeaderboard, getCachedLeaderboard, refreshing]);

    useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const shareMyRankCard = useCallback(async () => {
  if (!currentUser) return;
  const basis = selectedTab === "global" ? players : filteredPlayers;
  const myIndex = basis.findIndex((p) => p.id === currentUser.id);
  const myRank = myIndex >= 0 ? myIndex + 1 : "—";
try { await Haptics.selectionAsync(); } catch {}
  // 1) on prépare la payload → la carte cachée se rend
  setRankSharePayload({
    username: currentUser.username ?? "me",
    rank: myRank,
    trophies: currentUser.trophies ?? 0,
    avatarUri: currentUser.profileImage ?? null,
  });

  // 2) laisser React “peindre” la vue invisible
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // 3) capture + partage (PNG) via le hook
  await shareRankCard(
    `ct-rank-${currentUser.id}-${Date.now()}.png`,
 t("leaderboard.shareDialogTitle", { defaultValue: "Partager mon rang" })
  );

  // 4) cleanup optionnel
  setRankSharePayload(null);
}, [currentUser, players, filteredPlayers, selectedTab, shareRankCard, t]);


  // Filtrage
  useEffect(() => {
  if (!currentUser) {
    setFilteredPlayers([]);
    return;
  }

  let base = players;

  const hasText = (v?: string) => typeof v === "string" && v.trim().length > 0;
 if (selectedTab === "region") {
   base = players.filter((p) => hasText(p.region) && hasText(currentUser.region) && p.region === currentUser.region);
 } else if (selectedTab === "national") {
   base = players.filter((p) => hasText(p.country) && hasText(currentUser.country) && p.country === currentUser.country);
 }

  // ⚠️ éviter de muter `players` par accident
  const list = base.slice().sort((a, b) => b.trophies - a.trophies).slice(0, 20);
  setFilteredPlayers(list);
}, [selectedTab, players, currentUser]);

const podium = useMemo(() => topN(filteredPlayers, 3), [filteredPlayers]);

const podiumBadge = (slotIndex: number) => {
  // slotIndex correspond à l’ordre rendu: [second, first, third]
  if (slotIndex === 1) return "👑"; // first
  if (slotIndex === 0) return "🥈"; // second
  return "🥉"; // third
};

  // Podium
  const renderTopThree = useCallback(() => {
       if (podium.length < 3) {
      return (
        <Text
          style={[
            styles.noPlayersText,
            { color: currentTheme.colors.textSecondary },
            {
              writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
              textAlign: "center",
            },
          ]}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {t("leaderboard.notEnough")}
        </Text>
      );
    }

    const [first, second, third] = podium;
    return (
      <Animated.View
        entering={FadeInUp.delay(200)}
        style={styles.topThreeContainer}
      >
        {[second, first, third].map((player, idx) => {
          const isFirst = idx === 1;
          const Icon = isFirst ? "crown" : "medal";
          const size = normalizeSize(isFirst ? 34 : 26);
          return (
            <Animated.View
  key={player.id}
  entering={ZoomIn.delay(idx * 90)}
  style={[styles.podiumItem, isFirst && styles.podiumItemFirst]}
>
  <View
  style={[
    styles.podiumHalo,
    { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
  ]}
  pointerEvents="none"
/>

<View
  style={[
    styles.podiumTopBadge,
    isFirst && styles.podiumTopBadgeFirst,
    {
      backgroundColor: isDarkMode
        ? "rgba(255,255,255,0.10)"
        : "rgba(255,255,255,0.70)",
      borderColor: isDarkMode
        ? "rgba(255,255,255,0.18)"
        : "rgba(0,0,0,0.08)",
    },
  ]}
>
  <Text style={[styles.podiumBadgeEmoji, isFirst && styles.podiumBadgeEmojiFirst]}>
    {podiumBadge(idx)}
  </Text>
</View>


  <View style={[styles.podiumAvatarWrap, isFirst && styles.podiumAvatarWrapFirst]}>
    <LinearGradient
      colors={
  isFirst
    ? ["rgba(255,215,0,0.95)", "rgba(255,165,0,0.45)", "rgba(255,235,160,0.35)"]
    : idx === 0
    ? ["rgba(235,235,245,0.85)", "rgba(160,160,175,0.28)"]
    : ["rgba(205,127,50,0.85)", "rgba(130,75,35,0.28)"]
}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.podiumRing}
    />

    <Image
      source={
        player.profileImage
          ? { uri: player.profileImage }
          : require("../assets/images/default-profile.webp")
      }
      style={[styles.podiumAvatar, isFirst && styles.podiumAvatarFirst]}
      defaultSource={require("../assets/images/default-profile.webp")}
      accessibilityRole="image"
      accessibilityLabel={
        (player.isPioneer ? "Pioneer · " : "") +
        t("leaderboard.profileOf", { name: player.username })
      }
    />


  </View>

  <Text
    style={[
      styles.podiumName,
      { color: isDarkMode ? "#FFFFFF" : "#0B0B10" },
      { writingDirection: I18nManager.isRTL ? "rtl" : "ltr", textAlign: "center" },
    ]}
    numberOfLines={1}
    adjustsFontSizeToFit
  >
    {player.username}
  </Text>

  <Text
  style={[styles.podiumScore, { color: podiumScoreColor }]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {Number(player.trophies || 0).toLocaleString(i18n.language)}{" "}
  <Text style={styles.podiumTrophy}>🏆</Text>
</Text>


  <Text
  style={[
    styles.handle,
    { color: secondaryText },
    { writingDirection: "ltr", textAlign: "center" },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  @{(player.username || "").toLocaleLowerCase("en-US")}
</Text>

</Animated.View>

          );
        })}
      </Animated.View>
    );
  }, [podium, currentTheme, t, isDarkMode, i18n.language]);

  // Joueur
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
    borderColor: item.id === currentUser?.id ? rowStrokeMe : rowStroke,
    borderWidth: StyleSheet.hairlineWidth,     // ✅ ultra fin
    shadowOpacity: 0,                          // ✅ plus d’ombre iOS
    elevation: 0,                               // ✅ plus d’ombre Android
  },
]}

>
  <View
  pointerEvents="none"
  style={[
    styles.rowInnerHighlight,
    { opacity: isDarkMode ? 0.10 : 0.18 },
  ]}
/>


  <View style={styles.leftSection}>
    <View style={styles.avatarWrap}>
      <Image
        source={
          item.profileImage
            ? { uri: item.profileImage }
            : require("../assets/images/default-profile.webp")
        }
        defaultSource={require("../assets/images/default-profile.webp")}
        style={[styles.avatar, item.id === currentUser?.id && styles.avatarMe]}
        accessibilityRole="image"
        accessibilityLabel={
          (item.isPioneer ? "Pioneer · " : "") +
          t("leaderboard.profileOf", { name: item.username })
        }
      />
    </View>

    <View style={styles.playerInfo}>
      <Text
  style={[
    styles.name,
    { color: primaryText },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {item.username}
</Text>


      <Text
  style={[
    styles.handle,
    { color: secondaryText },
    { writingDirection: "ltr" },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  @{(item.username || "").toLocaleLowerCase("en-US")}
</Text>

    </View>
  </View>

  <View style={styles.rightSection}>
  <View
    style={[
      styles.trophyChip,
      {
        backgroundColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
        borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
      },
    ]}
  >
    <Text style={[styles.trophyIcon, { color: isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.70)" }]}>
      🏆
    </Text>
    <Text
      style={[
        styles.score,
        { color: isDarkMode ? "rgba(255,255,255,0.96)" : "#0B0B10" },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
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

  // Liste des joueurs
  const listPlayers = useMemo(() => {
    const basis = selectedTab === "global" ? players : filteredPlayers;
    const slice = filteredPlayers.slice(3, 20);
    const idx = basis.findIndex((p) => p.id === currentUser?.id);
    if (currentUser && idx > 19) {
      slice.push({ ...currentUser, rank: idx + 1 });
    }
    return slice;
  }, [filteredPlayers, players, currentUser, selectedTab]);


  const MyRankCard = useMemo(() => {
    if (!currentUser) return null;
    const basis = selectedTab === "global" ? players : filteredPlayers;
    const myIndex = basis.findIndex((p) => p.id === currentUser.id);
    const myRank = myIndex >= 0 ? myIndex + 1 : undefined;
    return (
  <View style={styles.myRankOuter}>
    {/* ✅ Gradient ring = différenciation immédiate */}
    <LinearGradient
      colors={meRingGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.myRankRing}
    >
      {/* ✅ Halo soft interne (zéro shadow, juste un glow propre) */}
      <View pointerEvents="none" style={[styles.myRankHalo, { backgroundColor: meHalo }]} />

      {/* ✅ Card content */}
      <View
        style={[
          styles.myRankCard,
          {
            backgroundColor: isDarkMode
              ? "rgba(255,255,255,0.09)"
              : "rgba(255,255,255,0.95)",
            borderWidth: 0, // important : le ring fait le job
          },
        ]}
      >
        {/* ✅ Sheen diagonal (reflet Keynote) */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            "transparent",
            isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.myRankSheen}
        />

        <View style={styles.myRankLeft}>
          <Image
            source={
              currentUser.profileImage
                ? { uri: currentUser.profileImage }
                : require("../assets/images/default-profile.webp")
            }
            style={[
              styles.myRankAvatar,
              {
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.28)"
                  : "rgba(0,0,0,0.14)",
              },
            ]}
            accessibilityRole="image"
          />

          <View style={{ marginLeft: 10 }}>
            <Text
              style={[
                styles.myRankName,
                { color: primaryText },
                {
                  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                  textAlign: I18nManager.isRTL ? "right" : "left",
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currentUser.username || t("leaderboard.unknown", { defaultValue: "Unknown" })}
            </Text>

            <View
              style={[
                styles.myRankSubRow,
                {
                  flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
                  justifyContent: I18nManager.isRTL ? "flex-end" : "flex-start",
                },
              ]}
            >
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
          style={[
            styles.myRankShareBtn,
            {
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.10)",
            },
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("leaderboard.share")}
          accessibilityHint={t("leaderboard.shareHint", { defaultValue: "Partage ta carte de rang" })}
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

// --- Skeleton (podium x3 + rows x5) ---
  if (loading) {
    return (
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
          currentTheme.colors.primary + "22",
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <CustomHeader title={t("leaderboard.title")} />
          <View style={{ paddingHorizontal: SPACING, marginTop: SPACING * 2 }}>
            {/* Podium placeholders */}
            <View style={[styles.topThreeContainer, { opacity: 0.9 }]}>
              {[0, 1, 2].map((i) => (
                <LinearGradient
                  key={i}
                  colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
                  style={
                    i === 1 ? styles.circleFirst : i === 0 ? styles.circleSecond : styles.circleThird
                  }
                />
              ))}
            </View>
            {/* Rows placeholders */}
            <View style={styles.listContainer}>
              {[...Array(5)].map((_, i) => (
                <View
                  key={i}
                  style={styles.skelRow}

                >
                  <View style={styles.leftSection}>
                    <View
                      style={{
                        width: normalizeSize(60),
                        height: normalizeSize(60),
                        borderRadius: normalizeSize(30),
                        backgroundColor: currentTheme.colors.background + "55",
                      }}
                    />
                    <View style={{ marginLeft: SPACING }}>
                      <View
                        style={{
                          width: normalizeSize(120),
                          height: normalizeSize(16),
                          borderRadius: 8,
                          backgroundColor: currentTheme.colors.background + "55",
                          marginBottom: 6,
                        }}
                      />
                      <View
                        style={{
                          width: normalizeSize(80),
                          height: normalizeSize(12),
                          borderRadius: 6,
                          backgroundColor: currentTheme.colors.background + "40",
                        }}
                      />
                    </View>
                  </View>
                  <View
                    style={{
                      width: normalizeSize(70),
                      height: normalizeSize(24),
                      borderRadius: 8,
                      backgroundColor: currentTheme.colors.background + "55",
                    }}
                  />
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
  <LinearGradient
    colors={[
      currentTheme.colors.background,
      currentTheme.colors.cardBackground,
      currentTheme.colors.primary + "22",
    ]}
    style={styles.gradientContainer}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
  >
    {/* === Orbes décoratives en arrière-plan (purement visuel) === */}
    <LinearGradient
      pointerEvents="none"
      colors={[currentTheme.colors.primary + "33", "transparent"]}
      style={styles.bgOrbTop}
    />
    <LinearGradient
      pointerEvents="none"
      colors={[currentTheme.colors.secondary + "33", "transparent"]}
      style={styles.bgOrbBottom}
    />
      <SafeAreaView style={[styles.safeArea]}>
        <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
          <CustomHeader title={t("leaderboard.title")} />
        <Animated.View entering={FadeInUp.delay(100)} style={styles.tabsContainer}>
  <BlurView
    intensity={28}
    tint={isDarkMode ? "dark" : "light"}
    style={styles.tabsBlur}
  >
    {(["region", "national", "global"] as const).map((tab) => {
      const active = selectedTab === tab;
      return (
        <Animated.View
          key={tab}
          entering={ZoomIn.delay(
            100 * (["region", "national", "global"].indexOf(tab) + 1)
          )}
          style={styles.tabWrap}
        >
          <TouchableOpacity
            onPress={() => setSelectedTab(tab)}
            activeOpacity={0.85}
            accessibilityLabel={t(`leaderboard.filter.${tab}`)}
            accessibilityHint={t(`leaderboard.filterHint.${tab}`)}
            accessibilityRole="button"
            testID={`tab-${tab}`}
            style={[styles.tab, active && styles.tabActive]}
          >
            {/* Fond dégradé derrière le label quand actif */}
            {active && (
              <LinearGradient
                colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tabGradientBg}
              />
            )}
            <Text
              style={[
                styles.tabText,
                { color: active ? "#FFFFFF" : isDarkMode ? "#EAEAEA" : "#111111" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t(`leaderboard.tab.${tab}`)}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      );
    })}
  </BlurView>
</Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: normalizeSize(80) }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.colors.secondary}
              colors={[currentTheme.colors.secondary]}
              progressViewOffset={SPACING}
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
                  renderItem={({ item, index }) => (
                    <PlayerItem item={item} index={index} />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  getItemLayout={(_, index) => ({
                    length: normalizeSize(80),
                    offset: normalizeSize(80) * index,
                    index,
                  })}
                  accessibilityRole="list"
                  accessibilityLabel={t("leaderboard.listLabel")}
                />
              </View>
            </>
                    ) : (
            <Text
              style={[
                styles.noPlayersText,
                { color: currentTheme.colors.textSecondary },
                {
                  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                  textAlign: "center",
                },
              ]}
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {t("leaderboard.noPlayers")}
            </Text>
          )}

          {locationDisabledMessage && (
            <Animated.View
              entering={FadeInUp.delay(200)}
              style={styles.errorContainer}
            >
              <Text
                style={[
                  styles.errorText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {locationDisabledMessage}
              </Text>
               <TouchableOpacity
                style={[
                  styles.settingsButton,
                  { backgroundColor: currentTheme.colors.primary, marginBottom: SPACING },
                ]}
                onPress={onRefresh}
                accessibilityLabel={t("leaderboard.retry", { defaultValue: "Réessayer" })}
              >
                <Text
                  style={[
                    styles.settingsButtonText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("leaderboard.retry", { defaultValue: "Réessayer" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.settingsButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={() => router.push("/settings")}
                accessibilityLabel={t("leaderboard.enableLocation")}
                accessibilityHint={t("leaderboard.enableLocationHint")}
              >
                <Text
                  style={[
                    styles.settingsButtonText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("leaderboard.enableLocation")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: 0 },
  gradientContainer: { flex: 1 },

  // --- Background orbs (keep, but calmer) ---
  bgOrbTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.28,
    right: -SCREEN_WIDTH * 0.22,
    width: SCREEN_WIDTH * 0.86,
    height: SCREEN_WIDTH * 0.86,
    borderRadius: SCREEN_WIDTH * 0.43,
    opacity: 0.42,
    transform: [{ rotate: "18deg" }],
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.30,
    left: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_WIDTH * 0.95,
    borderRadius: SCREEN_WIDTH * 0.475,
    opacity: 0.40,
    transform: [{ rotate: "-10deg" }],
  },
    // --- Skeleton podium circles (placeholders only) ---
  circleFirst: {
    width: normalizeSize(108),
    height: normalizeSize(108),
    borderRadius: normalizeSize(54),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  circleSecond: {
    width: normalizeSize(96),
    height: normalizeSize(96),
    borderRadius: normalizeSize(48),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  circleThird: {
    width: normalizeSize(96),
    height: normalizeSize(96),
    borderRadius: normalizeSize(48),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
podiumBadgeEmoji: {
  fontSize: normalizeFont(16),
  includeFontPadding: false,
},
podiumBadgeEmojiFirst: {
  fontSize: normalizeFont(20),
},
  tabsContainer: {
    paddingHorizontal: SPACING,
    marginTop: SPACING * 1.2,
    marginBottom: SPACING * 0.6,
  },
podiumTopBadge: {
  alignSelf: "center",
  marginBottom: normalizeSize(8),
  paddingHorizontal: normalizeSize(10),
  height: normalizeSize(26),
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.55)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(0,0,0,0.08)",
},
podiumTopBadgeFirst: {
  height: normalizeSize(28),
  paddingHorizontal: normalizeSize(12),
  backgroundColor: "rgba(255,215,0,0.18)",
  borderColor: "rgba(255,165,0,0.22)",
},
rowInnerHighlight: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "48%",
  borderRadius: normalizeSize(16),  // ✅ arrondi complet
  backgroundColor: "rgba(255,255,255,1)",
},
  tabsBlur: {
    flexDirection: "row",
    borderRadius: normalizeSize(16),
    padding: 5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tabWrap: { flex: 1 },
  tab: {
    height: normalizeSize(40),
    borderRadius: normalizeSize(13),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  trophyChip: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: normalizeSize(10),
  paddingVertical: normalizeSize(6),
  borderRadius: 999,
  borderWidth: 1,
},

trophyIcon: {
  fontSize: normalizeFont(13),
  marginRight: 6,
  includeFontPadding: false,
},

// MyRank inline trophies
myRankTrophiesInline: {
  flexDirection: "row",
  alignItems: "center",
},
myRankTrophyIcon: {
  fontSize: normalizeFont(12),
  marginRight: 5,
  includeFontPadding: false,
},
myRankTrophyText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeFont(12),
  includeFontPadding: false,
},
myRankOuter: {
  marginHorizontal: SPACING,
  marginTop: SPACING * 0.8,
  borderRadius: normalizeSize(18),
},
myRankRing: {
  borderRadius: normalizeSize(18),
  padding: normalizeSize(2), // ✅ stable iOS/Android
  overflow: "hidden",
},
myRankHalo: {
  position: "absolute",
  top: -normalizeSize(18),
  right: -normalizeSize(22),
  width: normalizeSize(90),
  height: normalizeSize(90),
  borderRadius: 999,
  opacity: 0.9,
},
myRankSheen: {
  position: "absolute",
  top: -normalizeSize(22),
  left: -normalizeSize(40),
  width: "140%",
  height: normalizeSize(70),
  transform: [{ rotate: "-12deg" }],
  opacity: 0.9,
},
  tabGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(13),
    opacity: 0.55,
  },
  tabText: {
    fontSize: normalizeFont(13.5),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    includeFontPadding: false,
  },
  scrollContent: { paddingBottom: normalizeSize(90) },
  listContainer: { paddingHorizontal: SPACING, marginTop: SPACING * 1.0 },

  // --- Podium (clean, no borders, no glow spam) ---
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginTop: SPACING * 1.0,
    marginBottom: SPACING * 0.8,
    paddingHorizontal: SPACING,
  },
  myRankSubRow: {
  marginTop: 2,
  alignItems: "center",
  flexWrap: "nowrap",
},
  podiumItem: {
    alignItems: "center",
    flex: 1,
    maxWidth: normalizeSize(112),
    paddingVertical: 6,
  },
  podiumItemFirst: { transform: [{ translateY: -6 }] },
  podiumHalo: {
    position: "absolute",
    top: 10,
    width: "92%",
    height: normalizeSize(88),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    opacity: 0.55,
  },
  podiumAvatarWrap: {
    width: normalizeSize(92),
    height: normalizeSize(92),
    borderRadius: normalizeSize(46),
    alignItems: "center",
    justifyContent: "center",
  },
  podiumAvatarWrapFirst: {
    width: normalizeSize(108),
    height: normalizeSize(108),
    borderRadius: normalizeSize(54),
  },
  podiumRing: {
    position: "absolute",
    inset: 0,
    borderRadius: 999,
  },
  podiumAvatar: {
    width: normalizeSize(78),
    height: normalizeSize(78),
    borderRadius: normalizeSize(39),
  },
  myRankInnerRing: {
  position: "absolute",
  top: 1,
  left: 1,
  right: 1,
  bottom: 1,
  borderRadius: normalizeSize(15), // un poil moins que card
  borderWidth: StyleSheet.hairlineWidth,
},
  podiumAvatarFirst: {
    width: normalizeSize(92),
    height: normalizeSize(92),
    borderRadius: normalizeSize(46),
  },
  podiumIconChip: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: normalizeSize(30),
    height: normalizeSize(30),
    borderRadius: normalizeSize(15),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,14,0.55)",
  },
  podiumIconChipFirst: {
    width: normalizeSize(34),
    height: normalizeSize(34),
    borderRadius: normalizeSize(17),
    backgroundColor: "rgba(10,10,14,0.60)",
  },
  podiumPioneer: {
    position: "absolute",
    left: -normalizeSize(6),
    bottom: -normalizeSize(6),
  },
  podiumScore: {
  marginTop: 4,
  fontSize: normalizeFont(13.5),
  fontFamily: "Comfortaa_700Bold",
  // color: "rgba(255,255,255,0.92)", // <-- enlève ça
  includeFontPadding: false,
},

  podiumName: {
    fontSize: normalizeFont(15.5),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginTop: SPACING * 0.65,
    includeFontPadding: false,
  },
  podiumTrophy: { fontSize: normalizeFont(12.5) },

  // --- Rows (sheet-like, no card frame) ---
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(16),
    marginVertical: normalizeSize(6),
    overflow: "hidden",
  },
  rowMe: {
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  leftSection: { flexDirection: "row", alignItems: "center", flex: 1 },
  rightSection: {
  alignItems: "flex-end",
  justifyContent: "center",
  marginLeft: 10,
  gap: normalizeSize(6), // ✅ petit spacing
},


  avatarWrap: { position: "relative" },
  avatar: {
    width: normalizeSize(48),
    height: normalizeSize(48),
    borderRadius: normalizeSize(24),
  },
  avatarMe: {
    transform: [{ scale: 1.03 }],
  },
  pioneerMini: {
    position: "absolute",
    left: -normalizeSize(6),
    bottom: -normalizeSize(6),
  },

  playerInfo: { marginLeft: normalizeSize(12), flex: 1 },
  name: {
    fontSize: normalizeFont(15.5),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
  handle: {
    marginTop: 3,
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
  },

  score: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
    color: "rgba(255,255,255,0.96)",
    includeFontPadding: false,
  },
  rank: {
    marginTop: 3,
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
    opacity: 0.9,
  },
myRankCard: {
  width: "100%",
  paddingVertical: normalizeSize(12),
  paddingHorizontal: normalizeSize(12),
  borderRadius: normalizeSize(16),
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  overflow: "hidden",
},
  myRankLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  myRankAvatar: {
  width: normalizeSize(44),
  height: normalizeSize(44),
  borderRadius: normalizeSize(22),
  borderWidth: StyleSheet.hairlineWidth,
},
 myRankName: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeFont(14.5),
  includeFontPadding: false,
},
myRankSub: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeFont(12),
  marginTop: 2,
  includeFontPadding: false,
},

  myRankShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
    paddingVertical: normalizeSize(9),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  myRankShareText: {
    color: "#fff",
    marginLeft: 6,
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeFont(12),
    includeFontPadding: false,
  },

  // --- Skeleton rows (no border/frames) ---
  skelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(16),
    marginVertical: normalizeSize(6),
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },

  // --- Empty / error ---
  noPlayersText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    padding: SPACING * 1.5,
  },
  errorContainer: { alignItems: "center", padding: SPACING * 2.5 },
  errorText: {
    fontSize: normalizeFont(15),
    textAlign: "center",
    marginBottom: SPACING * 1.5,
  },
  settingsButton: {
    paddingVertical: SPACING * 1.1,
    paddingHorizontal: SPACING * 2.2,
    borderRadius: normalizeSize(999),
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  settingsButtonText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
  },
});

