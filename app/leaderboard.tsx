import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import PioneerBadge from "@/components/PioneerBadge";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
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

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    "region" | "national" | "global"
  >("global");
  const [locationDisabledMessage, setLocationDisabledMessage] = useState<
    string | null
  >(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

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
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
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
          username: d.data().username || t("leaderboard.unknown"),
          trophies: d.data().trophies || 0,
          profileImage: d.data().profileImage || null,
          country: d.data().country || "Unknown",
          region: d.data().region || "Unknown",
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
              username: data.username || t("leaderboard.unknown"),
              trophies: data.trophies || 0,
              profileImage: data.profileImage || null,
              country: data.country || "Unknown",
              region: data.region || "Unknown",
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
      }
    };
    fetchLeaderboard();
  }, [t, cacheLeaderboard, getCachedLeaderboard]);

  // Filtrage
  useEffect(() => {
  if (!currentUser) {
    setFilteredPlayers([]);
    return;
  }

  let base = players;

  if (selectedTab === "region") {
    base = players.filter(
      (p) =>
        p.region &&
        p.region !== "Unknown" &&
        currentUser.region &&
        p.region === currentUser.region
    );
  } else if (selectedTab === "national") {
    base = players.filter(
      (p) =>
        p.country &&
        p.country !== "Unknown" &&
        currentUser.country &&
        p.country === currentUser.country
    );
  }

  // ⚠️ éviter de muter `players` par accident
  const list = base.slice().sort((a, b) => b.trophies - a.trophies).slice(0, 20);
  setFilteredPlayers(list);
}, [selectedTab, players, currentUser]);


  // Podium
  const renderTopThree = useCallback(() => {
    if (filteredPlayers.length < 3) {
      return (
        <Text
          style={[
            styles.noPlayersText,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("leaderboard.notEnough")}
        </Text>
      );
    }
    const [first, second, third] = filteredPlayers;
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
              entering={ZoomIn.delay(idx * 100)}
              style={styles.podiumItem}
            >
              <LinearGradient
                colors={
                  isFirst
                    ? ["#FFD700", "#FFA500"]
                    : idx === 0
                    ? ["#C0C0C0", "#A9A9A9"]
                    : ["#CD7F32", "#8B4513"]
                }
                style={
                  isFirst
                    ? styles.circleFirst
                    : idx === 0
                    ? styles.circleSecond
                    : styles.circleThird
                }
              >
                <View style={styles.glowRing} pointerEvents="none" />
                <Image
                  source={
                    player.profileImage
                      ? { uri: player.profileImage }
                      : require("../assets/images/default-profile.webp")
                  }
                  style={
                    isFirst ? styles.profileImageFirst : styles.profileImage
                  }
                  defaultSource={require("../assets/images/default-profile.webp")}
                  accessibilityLabel={
  (player.isPioneer ? "Pioneer · " : "") +
  t("leaderboard.profileOf", { name: player.username })
}
                />
                {player.isPioneer && (
                  <PioneerBadge
                    size="mini"
                    label={t("badges.pioneer", { defaultValue: "Pioneer" })}
                    style={{ position: "absolute", bottom: -normalizeSize(8), left: -normalizeSize(8) }}
                  />
                )}
                <MaterialCommunityIcons
                  name={Icon}
                  size={size}
                  color={
                    isFirst ? "#FFD700" : idx === 0 ? "#C0C0C0" : "#CD7F32"
                  }
                  style={isFirst ? styles.crownIcon : styles.medalIcon}
                />
              </LinearGradient>
              <Text
                style={[
                  styles.podiumName,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
                {player.username}
              </Text>
              <Text style={[styles.podiumTrophies, { color: "#FFFFFF" }]}>
                {player.trophies} 🏆
              </Text>
              <Text
                style={[
                  styles.handle,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                @{player.username?.toLowerCase()}
              </Text>
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  }, [filteredPlayers, currentTheme, t, isDarkMode]);

  // Joueur
  const PlayerItem = useMemo(
    () =>
      React.memo(({ item, index }: { item: Player; index: number }) => {
        const rank = item.rank ?? index + 4;
        return (
          <Animated.View
            entering={FadeInUp.delay(300 + index * 50)}
            style={[
              styles.playerRow,
              {
                backgroundColor: currentTheme.colors.cardBackground + "80",
                borderColor: isDarkMode
                  ? currentTheme.colors.secondary
                  : currentTheme.colors.primary,
                borderWidth: 2,
              },
              item.id === currentUser?.id && styles.highlight,
            ]}
          >
            <View style={styles.leftSection}>
              <View style={styles.avatarWrap}>
  <Image
    source={
      item.profileImage
        ? { uri: item.profileImage }
        : require("../assets/images/default-profile.webp")
    }
    defaultSource={require("../assets/images/default-profile.webp")}
    style={[
      styles.playerImage,
      { borderColor: currentTheme.colors.border },
    ]}
    accessibilityLabel={
      (item.isPioneer ? "Pioneer · " : "") +
      t("leaderboard.profileOf", { name: item.username })
    }
  />
  {item.isPioneer && (
    <PioneerBadge
      size="mini"
      label={t("badges.pioneer", { defaultValue: "Pioneer" })}
      style={{ position: "absolute", bottom: -normalizeSize(6), left: -normalizeSize(6) }}
    />
  )}
</View>

              <View style={styles.playerInfo}>
                <Text
                  style={[
                    styles.playerName,
                    { color: isDarkMode ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  {item.username}
                </Text>
                <Text
                  style={[
                    styles.handle,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  @{item.username?.toLowerCase()}
                </Text>
              </View>
            </View>
            <View style={styles.rightSection}>
              <Text style={[styles.playerTrophies, { color: "#FFFFFF" }]}>
                {item.trophies} 🏆
              </Text>
              <Text
                style={[
                  styles.rankText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                #{rank}
              </Text>
            </View>
          </Animated.View>
        );
      }),
    [currentTheme, currentUser, t, isDarkMode]
  );

  // Liste des joueurs
  const listPlayers = useMemo(() => {
    const slice = filteredPlayers.slice(3, 20);
    const idx = players.findIndex((p) => p.id === currentUser?.id);
    if (currentUser && idx > 19) {
      slice.push({ ...currentUser, rank: idx + 1 });
    }
    return slice;
  }, [filteredPlayers, players, currentUser]);

  // Métadonnées SEO
  const metadata = useMemo(
    () => ({
      title: t("leaderboard.title"),
      description: t("leaderboard.description"),
      url: "https://challengeme.com/leaderboard",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: filteredPlayers.map((player, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: player.username || t("leaderboard.unknown"),
          description: `${player.trophies} trophies`,
        })),
      },
    }),
    [t, filteredPlayers]
  );

  if (loading) {
    return (
      
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden={true} />
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("leaderboard.loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
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
            style={[
              styles.tab,
              active ? styles.tabActive : styles.tabInactive,
              {
                borderColor: active
                  ? currentTheme.colors.primary + "66"
                  : "rgba(255,255,255,0.12)",
              },
            ]}
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
        >
          {filteredPlayers.length > 0 ? (
            <>
              {renderTopThree()}
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
              ]}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  container: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  headerWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingVertical: SPACING * 1.5,
    marginTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  shareIcon: {
    padding: SPACING / 2,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: SPACING * 1.5,
    paddingHorizontal: SPACING,
    width: "100%",
    maxWidth: SCREEN_WIDTH - SPACING * 2,
    alignSelf: "center",
  },
  tab: {
    minHeight: normalizeSize(40),
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(10),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  activeTab: {
    borderBottomWidth: normalizeSize(2),       
  shadowOffset: { width: 0, height: normalizeSize(2) },
  shadowOpacity: 0.15,
  shadowRadius: normalizeSize(4),
  elevation: 3,
  },
  tabText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginVertical: SPACING * 1.5,
    paddingHorizontal: SPACING,
  },
  podiumItem: {
    alignItems: "center",
    flex: 1,
    maxWidth: normalizeSize(110), // ✅ meilleur scaling
  },
  circleFirst: {
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: normalizeSize(60),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    position: "relative",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFD700",
  },
  circleSecond: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    position: "relative",
    borderWidth: normalizeSize(1),
    borderColor: "#C0C0C0",
  },
  circleThird: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    position: "relative",
    borderWidth: normalizeSize(1),
    borderColor: "#CD7F32",
  },
  profileImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(35),
    borderWidth: normalizeSize(0.5),
    borderColor: "#FFF",
  },
  profileImageFirst: {
    width: normalizeSize(90),
    height: normalizeSize(90),
    borderRadius: normalizeSize(45),
    borderWidth: normalizeSize(0.5),
    borderColor: "#FFF",
  },
  crownIcon: {
    position: "absolute",
    top: -normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(6),
  },
  medalIcon: {
    position: "absolute",
    top: -normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.4,
    shadowRadius: normalizeSize(6),
  },
  podiumName: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginTop: SPACING / 1.5,
  },
  podiumTrophies: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING / 1.5,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: SPACING / 1.2,
    borderRadius: normalizeSize(8),
    textShadowColor: "#FFF",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  avatarWrap: {
  position: "relative",
},
  handle: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
  },
  scrollContent: {
    paddingBottom: normalizeSize(80),
  },
  listContainer: {
    paddingHorizontal: SPACING,
    marginTop: SPACING * 1.5,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING * 1.2,
    marginVertical: SPACING / 1.5,
    borderRadius: normalizeSize(18),
    justifyContent: "space-between",
    borderWidth: 2,
  },
  highlight: {
    borderWidth: 3,
    borderColor: "#FACC15",
    shadowColor: "#FACC15",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.5,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerImage: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(30),
    borderWidth: 2.5,
  },
  playerInfo: {
    marginLeft: SPACING * 1.2,
  },
  playerName: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
  },
  rightSection: {
    alignItems: "flex-end",
  },
  playerTrophies: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: SPACING / 1.2,
    borderRadius: normalizeSize(8),
    textShadowColor: "#FFF",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  rankText: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 1.5,
  },
    // --- BACKGROUND ORBS ---
  bgOrbTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.25,
    right: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    opacity: 0.55,
    transform: [{ rotate: "15deg" }],
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.25,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    opacity: 0.5,
    transform: [{ rotate: "-12deg" }],
  },

  // --- TABS (frosted glass seg control) ---
  tabsBlur: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: normalizeSize(14),
    padding: 6,
    width: "100%",
    maxWidth: SCREEN_WIDTH - SPACING * 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  tabWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.18,
    shadowRadius: normalizeSize(6),
    elevation: 4,
  },
  tabGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(10),
    opacity: 0.9,
  },

  // --- PODIUM glow ring ---
  glowRing: {
    position: "absolute",
    width: "105%",
    height: "105%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(10),
    opacity: 0.7,
  },

  // --- ROW overlay (glass) ---
  rowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(18),
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_400Bold",
    marginTop: SPACING,
  },
  noPlayersText: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    padding: SPACING * 1.5,
  },
  errorContainer: {
    alignItems: "center",
    padding: SPACING * 2.5,
  },
  errorText: {
    fontSize: normalizeFont(15),
    textAlign: "center",
    marginBottom: SPACING * 1.5,
  },
  settingsButton: {
    paddingVertical: SPACING * 1.2,
    paddingHorizontal: SPACING * 2.5,
    borderRadius: normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(6),
    elevation: 6,
  },
  settingsButtonText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },
});
