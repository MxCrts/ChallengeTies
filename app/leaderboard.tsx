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
    let list = players;
    if (selectedTab === "region") {
      list = players.filter((p) => p.region && p.region !== "Unknown");
    } else if (selectedTab === "national") {
      list = players.filter((p) => p.country && p.country !== "Unknown");
    }
    list = list.sort((a, b) => b.trophies - a.trophies).slice(0, 20);
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
                  accessibilityLabel={t("leaderboard.profileOf", {
                    name: player.username,
                  })}
                />
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
                  { color: isDarkMode ? "#FFFFFF" : "#000000" }, // Blanc en dark, noir en light
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
                  : currentTheme.colors.primary, // ↘️ même couleur que l’onglet actif en dark
                borderWidth: 2,
              },
              item.id === currentUser?.id && styles.highlight,
            ]}
          >
            <View style={styles.leftSection}>
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
                accessibilityLabel={t("leaderboard.profileOf", {
                  name: item.username,
                })}
              />
              <View style={styles.playerInfo}>
                <Text
                  style={[
                    styles.playerName,
                    { color: isDarkMode ? "#FFFFFF" : "#000000" }, // Blanc en dark, noir en light
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
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={styles.backButton}
          accessibilityLabel={t("leaderboard.goBack")}
          testID="back-button"
        >
          <Ionicons
            name="arrow-back"
            size={normalizeSize(24)}
            color={currentTheme.colors.secondary}
          />
        </TouchableOpacity>
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("leaderboard.title")} />
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.tabsContainer}
        >
          {(["region", "national", "global"] as const).map((tab) => (
            <Animated.View
              key={tab}
              entering={ZoomIn.delay(
                100 * (["region", "national", "global"].indexOf(tab) + 1)
              )}
            >
              <TouchableOpacity
                style={[
                  styles.tab,
                  {
                    backgroundColor:
                      selectedTab === tab
                        ? currentTheme.colors.secondary
                        : isDarkMode
                        ? currentTheme.colors.cardBackground + "80"
                        : "#FFFFFF", // light → plus de fond blanc derrière le texte
                  },
                  selectedTab === tab && styles.activeTab,
                ]}
                onPress={() => setSelectedTab(tab)}
                accessibilityLabel={t(`leaderboard.filter.${tab}`)}
                accessibilityHint={t(`leaderboard.filterHint.${tab}`)}
                accessibilityRole="button"
                testID={`tab-${tab}`}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isDarkMode
                        ? selectedTab === tab
                          ? "#000000" // Noir pour onglet sélectionné en dark
                          : "#FFFFFF" // Blanc pour onglets non sélectionnés en dark
                        : selectedTab === tab
                        ? "#FFFFFF" // Blanc pour onglet sélectionné en light
                        : "#000000", // Noir pour onglets non sélectionnés en light
                    },
                  ]}
                >
                  {t(`leaderboard.tab.${tab}`)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
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
                  onLayout={(event) =>
                    console.log("FlatList Layout:", event.nativeEvent.layout)
                  }
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
    justifyContent: "space-around", // Répartit équitablement les onglets
    alignItems: "center",
    marginVertical: SPACING * 1.5,
    paddingHorizontal: SPACING,
    width: "100%", // Prend toute la largeur pour un alignement propre
    maxWidth: SCREEN_WIDTH - SPACING * 2, // Limite à la largeur utilisable
  },
  tab: {
    paddingVertical: SPACING * 1.2,
    paddingHorizontal: SPACING * 1.2, // Compact mais élégant
    borderRadius: normalizeSize(30),
    backgroundColor: "transparent",
    elevation: 4,
    minWidth: normalizeSize(100), // Taille minimale garantie
    flex: 0, // Désactive la flexibilité pour contrôle précis
    maxWidth: normalizeSize(140), // Limite max pour éviter l'étirement
  },
  activeTab: {
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(6),
    elevation: 6,
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
    width: "30%",
  },
  circleFirst: {
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: normalizeSize(60),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    position: "relative",
    borderWidth: 3,
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
    borderWidth: 2,
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
    borderWidth: 2,
    borderColor: "#CD7F32",
  },
  profileImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(35),
    borderWidth: 2.5,
    borderColor: "#FFF",
  },
  profileImageFirst: {
    width: normalizeSize(90),
    height: normalizeSize(90),
    borderRadius: normalizeSize(45),
    borderWidth: 3.5,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay premium
    borderRadius: normalizeSize(20),
  },
});
