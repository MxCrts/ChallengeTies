import React, { useEffect, useState } from "react";
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
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";

// Constante SPACING pour cohérence avec new-features.tsx
const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalizeFont = (size: number) => Math.round(size * (SCREEN_WIDTH / 375));
const normalizeSize = (size: number) => Math.round(size * (SCREEN_WIDTH / 375));

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

  const cacheLeaderboard = async (players: Player[]) => {
    try {
      await AsyncStorage.setItem("leaderboardCache", JSON.stringify(players));
    } catch (e) {
      console.error("Erreur cache:", e);
    }
  };

  const getCachedLeaderboard = async () => {
    try {
      const cached = await AsyncStorage.getItem("leaderboardCache");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Erreur lecture cache:", e);
      return null;
    }
  };

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

            if (!data.locationEnabled) {
              setLocationDisabledMessage(t("leaderboard.locationDisabled"));
            } else {
              setLocationDisabledMessage(null);
            }
          } else {
            console.warn(t("leaderboard.userNotFound"));
            setCurrentUser(null);
            setLocationDisabledMessage(t("leaderboard.userNotFound"));
          }
        }
      } catch (e) {
        console.error(t("leaderboard.errorFetch"), e);
        setLocationDisabledMessage(t("leaderboard.errorFetch"));
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [t]);

  useEffect(() => {
    if (!currentUser) {
      setFilteredPlayers([]);
      return;
    }
    let list = players;
    if (selectedTab === "region") {
      // Filtrer les joueurs avec une région valide
      list = players.filter((p) => p.region && p.region !== "Unknown");
    } else if (selectedTab === "national") {
      // Filtrer les joueurs avec un pays valide
      list = players.filter((p) => p.country && p.country !== "Unknown");
    }
    list = list.sort((a, b) => b.trophies - a.trophies).slice(0, 20);
    setFilteredPlayers(list);
  }, [selectedTab, players, currentUser]);

  const renderTopThree = () => {
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
          const colors = isFirst
            ? ["#FFD700", "#FFA500"]
            : idx === 0
            ? ["#C0C0C0", "#A9A9A9"]
            : ["#CD7F32", "#8B4513"];
          const Icon = isFirst ? "crown" : "medal";
          const size = normalizeSize(isFirst ? 34 : 26);
          return (
            <View key={player.id} style={styles.podiumItem}>
              <LinearGradient
                colors={
                  isFirst
                    ? (["#FFD700", "#FFA500"] as [string, string])
                    : idx === 0
                    ? (["#C0C0C0", "#A9A9A9"] as [string, string])
                    : (["#CD7F32", "#8B4513"] as [string, string])
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
                  accessibilityLabel={t("leaderboard.profileOf", {
                    name: player.username,
                  })}
                />
                <MaterialCommunityIcons
                  name={Icon}
                  size={size}
                  color={colors[0]}
                  style={isFirst ? styles.crownIcon : styles.medalIcon}
                />
              </LinearGradient>
              <Text
                style={[
                  styles.podiumName,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {player.username}
              </Text>
              <Text
                style={[
                  styles.podiumTrophies,
                  { color: currentTheme.colors.trophy },
                ]}
              >
                {player.trophies} 🏆
              </Text>
              <Text
                style={[
                  styles.handle,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                @{(player.username || "").toLowerCase()}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    );
  };

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => {
    const rank = item.rank ?? index + 4;
    return (
      <Animated.View
        entering={FadeInUp.delay(300 + index * 50)}
        style={[
          styles.playerRow,
          {
            backgroundColor: currentTheme.colors.cardBackground,
            borderColor: currentTheme.colors.border,
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
                { color: currentTheme.colors.textPrimary },
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
              @{(item.username || "").toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text
            style={[
              styles.playerTrophies,
              { color: currentTheme.colors.trophy },
            ]}
          >
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
  };

  const listPlayers = (() => {
    const slice = filteredPlayers.slice(3, 20); // 17 après podium
    const idx = players.findIndex((p) => p.id === currentUser?.id);
    if (currentUser && idx > 19) {
      slice.push({ ...currentUser, rank: idx + 1 });
    }
    return slice;
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          `${currentTheme.colors.cardBackground}F0`,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("leaderboard.title")} />
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.tabsContainer}
        >
          {(["region", "national", "global"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                { backgroundColor: `${currentTheme.colors.cardBackground}90` },
                selectedTab === tab && [
                  { backgroundColor: currentTheme.colors.secondary },
                  styles.activeTab,
                ],
              ]}
              onPress={() => setSelectedTab(tab)}
              accessibilityLabel={t(`leaderboard.filter.${tab}`)}
              testID={`tab-${tab}`}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: currentTheme.colors.textPrimary },
                  selectedTab === tab && styles.activeTabText,
                ]}
              >
                {t(`leaderboard.tab.${tab}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredPlayers.length > 0 ? (
            <>
              {renderTopThree()}
              <View style={styles.listContainer}>
                <FlatList
                  data={listPlayers}
                  renderItem={renderPlayer}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  initialNumToRender={10}
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
                onPress={() => router.push("/settings")}
                style={[
                  styles.settingsButton,
                  { backgroundColor: currentTheme.colors.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.settingsButtonText,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("leaderboard.enableLocation")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  tab: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(25),
    marginHorizontal: SPACING / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  activeTab: {
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
  },
  tabText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    marginVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  podiumItem: {
    alignItems: "center",
    width: SCREEN_WIDTH * 0.3, // Ajusté pour responsivité
  },
  circleFirst: {
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: normalizeSize(60),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING,
    position: "relative",
    borderWidth: 2,
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
    width: normalizeSize(80),
    height: normalizeSize(80),
    borderRadius: normalizeSize(40),
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileImageFirst: {
    width: normalizeSize(95),
    height: normalizeSize(95),
    borderRadius: normalizeSize(47.5),
    borderWidth: 3,
    borderColor: "#FFF",
  },
  crownIcon: {
    position: "absolute",
    top: -normalizeSize(30),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(4),
  },
  medalIcon: {
    position: "absolute",
    top: -normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(4),
  },
  podiumName: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginTop: SPACING / 2,
  },
  podiumTrophies: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING / 2,
    textAlign: "center",
  },
  handle: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
  },
  scrollContent: {
    paddingBottom: SPACING * 2, // Réduit pour responsivité
  },
  listContainer: {
    paddingHorizontal: SPACING,
    marginTop: SPACING,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING,
    marginVertical: SPACING / 2,
    borderRadius: normalizeSize(15),
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: normalizeSize(6),
    elevation: 4,
    borderWidth: 1,
  },
  highlight: {
    borderWidth: 2,
    borderColor: "#FACC15",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerImage: {
    width: normalizeSize(50),
    height: normalizeSize(50),
    borderRadius: normalizeSize(25),
    borderWidth: 2,
  },
  playerInfo: {
    marginLeft: SPACING,
  },
  playerName: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
  },
  rightSection: {
    alignItems: "flex-end",
  },
  playerTrophies: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_700Bold",
  },
  rankText: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING,
  },
  noPlayersText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    padding: SPACING,
  },
  errorContainer: { alignItems: "center", padding: SPACING * 2 },
  errorText: {
    fontSize: normalizeFont(16),
    textAlign: "center",
    marginBottom: SPACING,
  },
  settingsButton: { padding: SPACING, borderRadius: 10 },
  settingsButtonText: { fontSize: normalizeFont(16), fontWeight: "600" },
});
