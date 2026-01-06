import React, { useEffect, useState, useMemo, useCallback, useRef, memo   } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  I18nManager,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import { useShareCard } from "@/hooks/useShareCard";
import WeeklyTrophiesCard from "@/components/WeeklyTrophiesCard";
import { StatsShareCard } from "@/components/ShareCards";

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

/** Util pour ajouter une alpha sans casser les gradients */
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);
  

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};

// ====== Safe TabBar Height (aucun crash hors Bottom Tabs) ======
function useTabBarHeightSafe(): number {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}

interface Stat {
  name: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  accessibilityHint: string;
}

interface UserDoc {
  longestStreak?: number;
  trophies?: number;
  achievements?: string[];
}

interface Challenge {
  id: string;
  selectedDays: number;
  completedDays?: number;
}

export default function UserStats() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );
const insets = useSafeAreaInsets();
const tabBarHeight = useTabBarHeightSafe();
 const [adHeight, setAdHeight] = useState(0);
  const { showBanners } = useAdsVisibility();
  const bottomPadding = useMemo(
    () => normalizeSize(80) + (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom,
    [adHeight, insets.bottom, showBanners, tabBarHeight]
  );

  // —— share card (hidden) ——
  const { ref: shareRef, share } = useShareCard();
  const [sharePayload, setSharePayload] = useState<null | {
    username?: string | null;
    avatarUri?: string | null;
    stats: {
      saved: number;
      ongoing: number;
      completed: number;
      successRatePct: number;
      longestStreak: number;
      trophies: number;
      achievements: number;
    };
  }>(null);

  // évite setState après unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        if (!mountedRef.current) return;
        setUserDoc(snapshot.exists() ? (snapshot.data() as UserDoc) : null);
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur onSnapshot:", error);
        if (mountedRef.current) setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // —— Données numériques (pour la carte) sans dépendre des libellés traduits
  const numericStats = useMemo(() => {
    if (!userDoc) {
      return {
        saved: 0,
        ongoing: 0,
        completed: 0,
        successRatePct: 0,
        longestStreak: 0,
        trophies: 0,
        achievements: 0,
      };
    }
    const uniqueOngoing = new Map(
      currentChallenges.map((ch: any) => [`${ch.id}_${ch.selectedDays}`, ch])
    );
    const totalSaved = savedChallenges.length;
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (ch: any) => ch.completedDays === ch.selectedDays
    ).length;
    const successRatePct = totalOngoing + totalCompleted > 0
      ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
      : 0;
    return {
      saved: totalSaved,
      ongoing: totalOngoing,
      completed: totalCompleted,
      successRatePct,
      longestStreak: userDoc.longestStreak || 0,
      trophies: userDoc.trophies || 0,
      achievements: userDoc.achievements?.length || 0,
    };
  }, [savedChallenges, currentChallenges, userDoc]);

  // Calcul des stats (cartes UI) basé sur numericStats → une seule source de vérité
  const computedStats: Stat[] = useMemo(() => {
    if (!userDoc) return [];

    const { saved, ongoing, completed, successRatePct, longestStreak, trophies, achievements } =
      numericStats;

    // Helpers de formatage localisé
    const nf = (n: number) => Number(n || 0).toLocaleString(i18n.language);
    const daysLabel = t("days"); // ex: "jours"

    return [
      {
        name: t("savedChallenges"),
        value: nf(saved),
        icon: "bookmark-outline",
        accessibilityLabel: t("savedChallenges"),
        accessibilityHint: t("statDescription.savedChallenges"),
      },
      {
        name: t("ongoingChallenges"),
        value: nf(ongoing),
        icon: "hourglass-outline",
        accessibilityLabel: t("ongoingChallenges"),
        accessibilityHint: t("statDescription.ongoingChallenges"),
      },
      {
        name: t("completedChallenges"),
        value: nf(completed),
        icon: "trophy-outline",
        accessibilityLabel: t("completedChallenges"),
        accessibilityHint: t("statDescription.completedChallenges"),
      },
      {
        name: t("successRate"),
        value: `${nf(successRatePct)}%`,
        icon: "stats-chart-outline",
        accessibilityLabel: t("successRate"),
        accessibilityHint: t("statDescription.successRate"),
      },
      {
        name: t("trophies"),
        value: nf(trophies),
        icon: "medal-outline",
        accessibilityLabel: t("trophies"),
        accessibilityHint: t("statDescription.trophies"),
      },
      {
        name: t("unlockedAchievements"),
        value: nf(achievements),
        icon: "ribbon-outline",
        accessibilityLabel: t("unlockedAchievements"),
        accessibilityHint: t("statDescription.unlockedAchievements"),
      },
      {
        name: t("longestStreak"),
        value: `${nf(longestStreak)} ${daysLabel}`,
        icon: "flame-outline",
        accessibilityLabel: t("longestStreak"),
        accessibilityHint: t("statDescription.longestStreak"),
      },
    ];
  }, [numericStats, t, i18n.language, userDoc]);
  
// ==== Carte stat ultra-perf (memo) ====
  const StatCard = memo(({ item, index }: { item: Stat; index: number }) => (
  <Animated.View
    entering={ZoomIn.delay(index * 40)}
    style={styles.statCardWrapper}
    accessibilityRole="summary"
  >
    <LinearGradient
      colors={[
        currentTheme.colors.cardBackground,
        currentTheme.colors.cardBackground + "F0",
      ]}
      style={[
        styles.statCard,
        {
          borderColor: isDarkMode
            ? currentTheme.colors.secondary
            : "#FF8C00",
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: currentTheme.colors.secondary + "1A" },
        ]}
      >
        <Ionicons
          // fallback défensif si jamais
          name={(item.icon as any) || "stats-chart-outline"}
          size={normalizeSize(36)}
          color={currentTheme.colors.secondary}
          accessibilityLabel={item.accessibilityLabel}
          accessibilityHint={item.accessibilityHint}
        />
      </View>
      <View style={styles.statContent}>
        <Text
          style={[
            styles.statName,
            {
              color: isDarkMode
                ? currentTheme.colors.textPrimary
                : "#000000",
              writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
              textAlign: I18nManager.isRTL ? "right" : "left",
            },
          ]}
          accessibilityLabel={item.accessibilityLabel}
          accessibilityHint={item.accessibilityHint}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.name}
        </Text>
        <Text
          style={[
            styles.statValue,
            {
              color: currentTheme.colors.secondary,
              writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
              textAlign: I18nManager.isRTL ? "right" : "left",
            },
          ]}
          accessibilityLabel={`${item.accessibilityLabel} value`}
          accessibilityHint={item.accessibilityHint}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {item.value}
        </Text>
      </View>
    </LinearGradient>
  </Animated.View>
));


  // (Optionnel) afficher un displayName utile en debug
  (StatCard as any).displayName = "StatCard";

  // Partage des stats
  const handleShareStats = useCallback(async () => {
    try {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

      // Récupère username et avatar si présents dans le doc user
      const username = (userDoc as any)?.displayName ?? null;
      const avatarUri = (userDoc as any)?.profileImage ?? null;

      setSharePayload({ username, avatarUri, stats: numericStats });
      // Laisse le temps au composant caché de se monter
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await share(
        `ct-stats-${auth.currentUser?.uid ?? "anon"}-${Date.now()}.png`,
        t("shareStatsMessage")
      );
      setSharePayload(null);
    } catch (error) {
      console.error("Erreur lors du partage :", error);
    }
  }, [t, numericStats, userDoc, share]);

  if (isLoading) {
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
            {t("loadingProfile")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!userDoc) {
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
          style={styles.emptyContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)}>
            <Ionicons
              name="alert-circle-outline"
              size={normalizeSize(40)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.emptyText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("profileLoadError")}
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("tryAgain")}
            </Text>
          </Animated.View>
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
    withAlpha(currentTheme.colors.background, 1),
    withAlpha(currentTheme.colors.cardBackground, 1),
    withAlpha(currentTheme.colors.primary, 0.13),
  ]}
  style={styles.gradientContainer}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
  {/* Orbes premium en arrière-plan */}
  <LinearGradient
    pointerEvents="none"
    colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
    style={styles.bgOrbTop}
    start={{ x: 0.2, y: 0 }}
    end={{ x: 1, y: 1 }}
  />
  <LinearGradient
    pointerEvents="none"
    colors={[withAlpha(currentTheme.colors.secondary, 0.25), "transparent"]}
    style={styles.bgOrbBottom}
    start={{ x: 1, y: 0 }}
    end={{ x: 0, y: 1 }}
  />
    <CustomHeader
      title={t("statistics")}
      backgroundColor="transparent"
      useBlur={false}
      showHairline={false}
      rightIcon={
    <Ionicons
      name="share-outline"
      size={normalizeSize(22)}
      color={currentTheme.colors.secondary}
      accessibilityLabel={t("share")}
    />
  }
  onRightPress={handleShareStats}
/>

    <FlatList
      ListHeaderComponent={
        <View style={styles.headerCardWrap} accessibilityRole="summary">
          <WeeklyTrophiesCard />
        </View>
      }
      data={computedStats}
      renderItem={({ item, index }) => <StatCard item={item} index={index} />}
      keyExtractor={(item, index) => `${item.name}-${index}`}
      contentContainerStyle={[
        styles.listContainer,
        { flexGrow: 1, paddingBottom: bottomPadding }
      ]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      getItemLayout={(_, index) => {
        const H = normalizeSize(100) + SPACING * 1.5; // carte + marge verticale
        return { length: H, offset: H * index, index };
      }}
      contentInset={{ top: SPACING, bottom: 0 }}
    />
    {showBanners && (
   <View
     style={{
       position: "absolute",
       left: 0,
       right: 0,
       bottom: tabBarHeight + insets.bottom,
       alignItems: "center",
       backgroundColor: "transparent",
       paddingBottom: 6,
       zIndex: 9999,
     }}
     pointerEvents="box-none"
   >
     <BannerSlot onHeight={(h) => setAdHeight(h)} />
   </View>
 )}
  </LinearGradient>
{/* —— Carte de partage invisible (capture) —— */}
      {sharePayload && (
        <View style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>
          <StatsShareCard
            ref={shareRef}
            username={sharePayload.username ?? null}
            avatarUri={sharePayload.avatarUri ?? null}
            // On passe directement les libellés traduits ➜ plus de coupe
            items={[
              { label: t("completedChallenges"), value: String(sharePayload.stats.completed) },
              { label: t("successRate"), value: `${sharePayload.stats.successRatePct}%` },
              { label: t("longestStreak"), value: `${sharePayload.stats.longestStreak} ${t("daysShort", { defaultValue: "j" })}` },
              { label: t("trophies"), value: String(sharePayload.stats.trophies) },
            ]}
            i18n={{
              kickerWhenNoUser: t("myStats", { defaultValue: "Mes stats" }),
              subtitleWhenUser: t("myCTStats", { defaultValue: "Mes stats ChallengeTies" }),
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
  flex: 1,
  paddingTop: 0,
  backgroundColor: "transparent",
},
  container: {
    flex: 1,
    paddingHorizontal: SPACING,
    paddingTop: SPACING / 2,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    position: "relative",
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
  shareButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    right: SPACING,
    padding: SPACING / 2,
  },
  listContainer: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SPACING / 2,
  },
  headerCardWrap: {
    paddingHorizontal: SPACING,
    marginTop: SPACING,
   marginBottom: SPACING * 1.2,
  },
  statCardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(20),
    paddingHorizontal: normalizeSize(18),
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    borderWidth: 2.5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  iconContainer: {
    width: normalizeSize(60),
    height: normalizeSize(60),
    borderRadius: normalizeSize(30),
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING * 1.2,
    backgroundColor: "#FFDD95" + "20",
  },
  statContent: {
    flex: 1,
  },
  statName: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalizeSize(4),
    textAlign: "left",
  },
  statValue: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "left",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING * 2,
  },
  emptyText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  emptySubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    opacity: 0.8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  gradientContainer: {
  flex: 1,
  // pas de padding ici; garde ton padding dans styles.container
},
bgOrbTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.25,
  left: -SCREEN_WIDTH * 0.2,
  width: SCREEN_WIDTH * 0.9,
  height: SCREEN_WIDTH * 0.9,
  borderRadius: SCREEN_WIDTH * 0.45,
},
bgOrbBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.3,
  right: -SCREEN_WIDTH * 0.25,
  width: SCREEN_WIDTH * 1.1,
  height: SCREEN_WIDTH * 1.1,
  borderRadius: SCREEN_WIDTH * 0.55,
},

});
