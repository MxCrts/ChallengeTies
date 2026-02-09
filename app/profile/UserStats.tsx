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
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_COMPACT = SCREEN_HEIGHT < 720;
const V_SPACING = IS_COMPACT ? 12 : 15;


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
  CompletedChallenges?: any[];
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
   const totalCompleted = Array.isArray(userDoc.CompletedChallenges)
  ? userDoc.CompletedChallenges.length
  : 0;

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
    withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.74 : 0.92),
    withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.58 : 0.82),
  ]}
  style={[
    styles.statCard,
    {
      borderColor: isDarkMode
        ? withAlpha("#FFFFFF", 0.14)
        : withAlpha("#000000", 0.08),
    },
  ]}
>
  {/* sheen diagonal */}
  <LinearGradient
    pointerEvents="none"
    colors={[
      "transparent",
      isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)",
      "transparent",
    ]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.cardSheen}
  />

  <View
    style={[
      styles.iconContainer,
      {
        backgroundColor: isDarkMode
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)",
        borderColor: isDarkMode
          ? withAlpha("#FFFFFF", 0.14)
          : withAlpha("#000000", 0.08),
      },
    ]}
  >
    <Ionicons
      name={(item.icon as any) || "stats-chart-outline"}
      size={normalizeSize(28)}
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
  <View style={styles.headerStack} accessibilityRole="summary">
    {/* ===== HERO (NO REDUNDANT LABELS) ===== */}
<Animated.View entering={FadeInUp.delay(60)} style={styles.heroWrap}>
  <LinearGradient
    colors={[
      withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.78 : 0.94),
      withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.60 : 0.86),
    ]}
    style={[
      styles.heroCard,
      {
        borderColor: isDarkMode
          ? withAlpha("#FFFFFF", 0.14)
          : withAlpha("#000000", 0.08),
      },
    ]}
  >
    <LinearGradient
      pointerEvents="none"
      colors={[
        "transparent",
        isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)",
        "transparent",
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroSheen}
    />
    <View
      pointerEvents="none"
      style={[
        styles.heroGlow,
        {
          backgroundColor: withAlpha(
            currentTheme.colors.secondary,
            isDarkMode ? 0.16 : 0.10
          ),
        },
      ]}
    />

    {/* Title row */}
    <View style={styles.heroTopRow}>
      <View style={styles.heroIdentity}>
        <Text
          style={[styles.heroKicker, { color: currentTheme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {t("myCTStats", { defaultValue: "Mes stats ChallengeTies" })}
        </Text>

        <Text
          style={[
            styles.heroTitle,
            { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {(userDoc as any)?.displayName ||
            t("statistics", { defaultValue: "Statistiques" })}
        </Text>
      </View>

      <View
        style={[
          styles.heroAvatarPill,
          {
            borderColor: isDarkMode
              ? withAlpha("#FFFFFF", 0.14)
              : withAlpha("#000000", 0.08),
            backgroundColor: isDarkMode
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)",
          },
        ]}
      >
        <Ionicons
          name="share-outline"
          size={normalizeSize(16)}
          color={currentTheme.colors.secondary}
          accessibilityLabel={t("share")}
        />
      </View>
    </View>

    {/* Pills row: ICON + VALUE only (no translated labels => no cuts) */}
    <View style={styles.heroPillsRow}>
      <View style={styles.heroPill}>
        <Ionicons
          name="trophy-outline"
          size={normalizeSize(14)}
          color={currentTheme.colors.secondary}
        />
        <Text
          style={[
            styles.heroPillValue,
            { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {String(numericStats.completed)}
        </Text>
      </View>

      <View style={styles.heroPill}>
        <Ionicons
          name="stats-chart-outline"
          size={normalizeSize(14)}
          color={currentTheme.colors.secondary}
        />
        <Text
          style={[
            styles.heroPillValue,
            { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {String(numericStats.successRatePct)}%
        </Text>
      </View>

      <View style={styles.heroPill}>
        <Ionicons
          name="flame-outline"
          size={normalizeSize(14)}
          color={currentTheme.colors.secondary}
        />
        <Text
          style={[
            styles.heroPillValue,
            { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {String(numericStats.longestStreak)}
          <Text style={[styles.heroPillUnit, { color: currentTheme.colors.textSecondary }]}>
            {" "}
            {t("daysShort", { defaultValue: "j" })}
          </Text>
        </Text>
      </View>

      <View style={styles.heroPill}>
        <Ionicons
          name="medal-outline"
          size={normalizeSize(14)}
          color={currentTheme.colors.secondary}
        />
        <Text
          style={[
            styles.heroPillValue,
            { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {String(numericStats.trophies)}
        </Text>
      </View>
    </View>
  </LinearGradient>
</Animated.View>


    {/* ===== Weekly Card (existing) ===== */}
    <View style={styles.headerCardWrap} accessibilityRole="summary">
      <WeeklyTrophiesCard />
    </View>
  </View>
}

      data={computedStats}
      renderItem={({ item, index }) => <StatCard item={item} index={index} />}
      keyExtractor={(item, index) => `${item.name}-${index}`}
      contentContainerStyle={[
  styles.listContainer,
  { flexGrow: 1, paddingBottom: bottomPadding },
]}
      showsVerticalScrollIndicator={false}
     removeClippedSubviews={Platform.OS === "android"}
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
  paddingTop: V_SPACING,
  paddingHorizontal: SPACING,
  paddingBottom: normalizeSize(40),
},
headerCardWrap: {
  paddingHorizontal: SPACING,
  marginTop: V_SPACING,
  marginBottom: V_SPACING * 1.1,
},
statCardWrapper: {
  marginBottom: V_SPACING,
  borderRadius: normalizeSize(22),
  shadowColor: "#000",
  shadowOffset: { width: 0, height: normalizeSize(10) },
  shadowOpacity: Platform.OS === "ios" ? 0.14 : 0,
  shadowRadius: normalizeSize(18),
  elevation: Platform.OS === "android" ? 3 : 0,
},
statCard: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: normalizeSize(IS_COMPACT ? 14 : 16),
  paddingHorizontal: normalizeSize(16),
  borderRadius: normalizeSize(22),
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
},
iconContainer: {
  width: normalizeSize(IS_COMPACT ? 50 : 54),
  height: normalizeSize(IS_COMPACT ? 50 : 54),
  borderRadius: 999,
  justifyContent: "center",
  alignItems: "center",
  marginRight: normalizeSize(12),
  borderWidth: StyleSheet.hairlineWidth,
},
  statContent: {
    flex: 1,
  },
  statName: {
  fontSize: normalizeSize(14.5),
  fontFamily: "Comfortaa_400Regular",
  marginBottom: normalizeSize(4),
  opacity: 0.9,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
},
headerStack: {
  paddingTop: V_SPACING,
},

heroWrap: {
  paddingHorizontal: SPACING,
  marginBottom: V_SPACING,
},

heroCard: {
  borderRadius: normalizeSize(22),
  paddingVertical: normalizeSize(IS_COMPACT ? 14 : 16),
  paddingHorizontal: normalizeSize(16),
  borderWidth: StyleSheet.hairlineWidth,
  overflow: "hidden",
},

heroSheen: {
  position: "absolute",
  top: -normalizeSize(28),
  left: -normalizeSize(70),
  width: "170%",
  height: normalizeSize(92),
  transform: [{ rotate: "-12deg" }],
  opacity: 0.85,
},

heroGlow: {
  position: "absolute",
  top: -normalizeSize(18),
  right: -normalizeSize(18),
  width: normalizeSize(120),
  height: normalizeSize(120),
  borderRadius: 999,
  opacity: 1,
},
heroPillsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: normalizeSize(10),
},

heroPill: {
  flexGrow: 1,
  minWidth: "47%",
  borderRadius: normalizeSize(16),
  paddingVertical: normalizeSize(10),
  paddingHorizontal: normalizeSize(12),
  borderWidth: StyleSheet.hairlineWidth,
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(8),
  backgroundColor: IS_COMPACT ? "rgba(255,255,255,0.04)" : "transparent",
  borderColor: withAlpha("#000000", 0.06),
},

heroPillValue: {
  fontSize: normalizeSize(16),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
  flexShrink: 1,
},

heroPillUnit: {
  fontSize: normalizeSize(12.5),
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},
heroTopRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: normalizeSize(12),
},

heroIdentity: {
  flex: 1,
  paddingRight: normalizeSize(10),
},

heroKicker: {
  fontSize: normalizeSize(12.5),
  fontFamily: "Comfortaa_400Regular",
  opacity: 0.9,
  marginBottom: normalizeSize(4),
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
},

heroTitle: {
  fontSize: normalizeSize(18),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
},

heroAvatarPill: {
  width: normalizeSize(38),
  height: normalizeSize(38),
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
},

heroChipsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: normalizeSize(10),
},

heroChip: {
  flexGrow: 1,
  minWidth: "47%",
  borderRadius: normalizeSize(16),
  paddingVertical: normalizeSize(10),
  paddingHorizontal: normalizeSize(12),
  borderWidth: StyleSheet.hairlineWidth,
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(8),
},

heroChipValue: {
  fontSize: normalizeSize(16),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},

heroChipLabel: {
  flex: 1,
  fontSize: normalizeSize(12.5),
  fontFamily: "Comfortaa_400Regular",
  opacity: 0.9,
},
statValue: {
  fontSize: normalizeSize(22),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
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
  top: -SCREEN_WIDTH * (IS_COMPACT ? 0.28 : 0.25),
  left: -SCREEN_WIDTH * (IS_COMPACT ? 0.22 : 0.2),
  width: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
  height: SCREEN_WIDTH * (IS_COMPACT ? 0.85 : 0.9),
  borderRadius: SCREEN_WIDTH * 0.45,
},
cardSheen: {
  position: "absolute",
  top: -normalizeSize(28),
  left: -normalizeSize(60),
  width: "160%",
  height: normalizeSize(86),
  transform: [{ rotate: "-12deg" }],
  opacity: 0.85,
},
bgOrbBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * (IS_COMPACT ? 0.32 : 0.3),
  right: -SCREEN_WIDTH * (IS_COMPACT ? 0.27 : 0.25),
  width: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
  height: SCREEN_WIDTH * (IS_COMPACT ? 1.05 : 1.1),
  borderRadius: SCREEN_WIDTH * 0.55,
},
});
