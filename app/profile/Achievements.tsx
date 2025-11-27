import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  ZoomIn,
  FadeInUp,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import { db, auth } from "../../constants/firebase-config";
import { useTrophy } from "../../context/TrophyContext";
import { achievementsList } from "../../helpers/achievementsConfig";
import { useTheme } from "../../context/ThemeContext";
import designSystem, { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import type { SectionListRenderItemInfo } from "react-native";

const SPACING = 18;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

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

interface Achievement {
  id: string;
  identifier: string;
  trophies: number;
  isClaimable: boolean;
  isCompleted: boolean;
  isNew?: boolean;
  // NEW: for logical ordering
  level?: number;
  baseKey?: string;
}
interface AchievementSection {
  title: string;
  data: Achievement[];
  index: number;
}

/** ====== group mapping extended for your new achievements ====== */
const groupAchievements = (identifier: string) => {
  if (identifier === "first_connection" || identifier === "profile_completed") return "débuts";

  if (identifier.startsWith("finishChallenge_")) return "defisTermines";
  if (identifier.startsWith("selectChallengeDays_")) return "engagement";
  if (identifier.startsWith("streakProgress_")) return "serieDeFeu";
  if (identifier.startsWith("messageSent_")) return "communication";
  if (identifier.startsWith("shareChallenge_")) return "partage";
  if (identifier.startsWith("inviteFriend_") || identifier.startsWith("referralsRegistered_")) return "reseau";
  if (identifier.startsWith("voteFeature_")) return "influence";
  if (identifier.startsWith("saveChallenge_")) return "collection";
  if (identifier.startsWith("challengeCreated_") || identifier.startsWith("challengeAdopted_")) return "creation";

  // NEW groups
  if (identifier.startsWith("finishDuoChallenge_") || identifier.startsWith("duoStreak_") || identifier.startsWith("duoMessages_"))
    return "duo";
  if (identifier.startsWith("perfectMonth_") || identifier.startsWith("dailyCompletion_"))
    return "constance";
  if (identifier.startsWith("focusDays_"))
    return "focus";
  if (identifier.startsWith("categoriesMastered_"))
    return "maitrise";
  if (identifier.startsWith("seasonal_"))
    return "events";
  if (identifier.startsWith("zeroMissLongRun_"))
    return "discipline";

  return "divers";
};

const getIconForGroup = (groupKey: string) => {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    débuts: "star",
    defisTermines: "trophy",
    engagement: "calendar",
    serieDeFeu: "flame",
    communication: "chatbubbles",
    partage: "share-social",
    reseau: "people",
    influence: "thumbs-up",
    collection: "bookmark",
    creation: "brush",
    duo: "people-circle",
    constance: "infinite",
    focus: "eye",
    maitrise: "medal",
    discipline: "shield-checkmark",
    events: "sparkles",
    divers: "ribbon",
  };
  return icons[groupKey] || "ribbon";
};

/** Groups where we want DESC ordering by level by default */
const descendingGroups = new Set([
  "defisTermines",
  "engagement",
  "serieDeFeu",
  "creation",
  "discipline",
]);

/** parse identifier => baseKey + numeric level if exists */
const parseIdentifierLevel = (identifier: string) => {
  const m = identifier.match(/^(.*)_(\d+)$/);
  if (!m) return { baseKey: identifier, level: undefined as number | undefined };
  return { baseKey: m[1], level: parseInt(m[2], 10) };
};

/** Stable order of sections (top 3 UX) */
const sectionOrder = [
  "débuts",
  "defisTermines",
  "engagement",
  "serieDeFeu",
  "duo",
  "constance",
  "focus",
  "reseau",
  "communication",
  "partage",
  "collection",
  "influence",
  "creation",
  "maitrise",
  "discipline",
  "events",
  "divers",
];

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<AchievementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { setTrophyData } = useTrophy();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }
  const [adHeight, setAdHeight] = useState(0);

  const bottomPadding =
    normalizeSize(90) +
    (showBanners ? adHeight : 0) +
    (tabBarHeight || 0) +
    insets.bottom;

  /** Progress bar anim */
  const progressSV = useSharedValue(0);
  const progressAnimatedStyle = useAnimatedStyle(() => {
    const ratio = Math.max(0, Math.min(progressSV.value, 1));
    return { width: `${Math.round(ratio * 100)}%` };
  });

  /** Firestore */
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        const obtained = new Set<string>(data.achievements || []);
        const pending = new Set<string>(data.newAchievements || []);

        const formatted: Achievement[] = [];

        Object.entries(achievementsList).forEach(([key, val]) => {
          if ("name" in val && "points" in val) {
            const { baseKey, level } = parseIdentifierLevel(key);
            formatted.push({
              id: key,
              identifier: key,
              trophies: (val as any).points,
              isClaimable: pending.has(key),
              isCompleted: obtained.has(key),
              isNew: pending.has(key) && !obtained.has(key),
              baseKey,
              level,
            });
          } else {
            Object.entries(val as Record<string, { name: string; points: number }>).forEach(
              ([subKey, subVal]) => {
                const id = `${key}_${subKey}`;
                const { baseKey, level } = parseIdentifierLevel(id);
                formatted.push({
                  id,
                  identifier: id,
                  trophies: subVal.points,
                  isClaimable: pending.has(id),
                  isCompleted: obtained.has(id),
                  isNew: pending.has(id) && !obtained.has(id),
                  baseKey,
                  level,
                });
              }
            );
          }
        });

        const grouped: Record<string, Achievement[]> = {};
        for (const ach of formatted) {
          const grp = groupAchievements(ach.identifier);
          (grouped[grp] ||= []).push(ach);
        }

        const secs = Object.entries(grouped).map(([title, data], idx) => {
          // ==== LOGICAL SORT =====
          data.sort((a, b) => {
            // if both have numeric levels => sort by level
            if (a.level != null && b.level != null) {
              const dir = descendingGroups.has(title) ? -1 : 1;
              return dir * (a.level - b.level);
            }
            // else fallback on trophies (desc for descending groups) then label
            if (descendingGroups.has(title)) {
              if (b.trophies !== a.trophies) return b.trophies - a.trophies;
            } else {
              if (a.trophies !== b.trophies) return a.trophies - b.trophies;
            }
            return String(t(a.identifier)).localeCompare(String(t(b.identifier)));
          });

          return { title, data, index: idx };
        });

        // order sections by predefined UX order, else alpha
        secs.sort((a, b) => {
          const ia = sectionOrder.indexOf(a.title);
          const ib = sectionOrder.indexOf(b.title);
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          return String(t(`sections.${a.title}`)).localeCompare(String(t(`sections.${b.title}`)));
        });

        setSections(secs);
        setLoading(false);

        const totalNow = secs.reduce((s, sec) => s + sec.data.length, 0);
        const doneNow = secs.reduce(
          (s, sec) => s + sec.data.filter((x) => x.isCompleted).length,
          0
        );
        progressSV.value = withTiming(totalNow ? doneNow / totalNow : 0, { duration: 650 });
      },
      (error) => {
        console.error("Erreur onSnapshot achievements:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [t, setTrophyData, progressSV]);

  const total = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections]
  );
  const done = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.filter((a) => a.isCompleted).length, 0),
    [sections]
  );

  /** palette */
  const pageBgTop = isDarkMode ? "#050B17" : "#F6F7FB";
  const pageBgBottom = isDarkMode ? currentTheme.colors.cardBackground : "#FFFFFF";
  const cardBg = isDarkMode ? withAlpha(currentTheme.colors.cardBackground, 0.98) : "#FFFFFF";
  const borderSoft = isDarkMode
    ? withAlpha(currentTheme.colors.border, 0.7)
    : "rgba(17,24,39,0.12)";
  const textPrimary = isDarkMode ? currentTheme.colors.textPrimary : "#0B0F1C";
  const textSecondary = isDarkMode ? currentTheme.colors.textSecondary : "rgba(11,15,28,0.7)";

  /** Section header with % */
  const renderSectionHeader = useCallback(
    ({ section }: { section: AchievementSection }) => {
      const completedCount = section.data.filter((a) => a.isCompleted).length;
      const ratio = section.data.length ? completedCount / section.data.length : 0;
      const percent = Math.round(ratio * 100);

      return (
        <Animated.View
          entering={FadeInUp.delay(section.index * 90)}
          style={styles.sectionHeader}
        >
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.primary, 0.9),
              withAlpha(currentTheme.colors.secondary, 0.9),
            ]}
            style={styles.sectionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.sectionLeft}>
              <Ionicons
                name={getIconForGroup(section.title)}
                size={normalizeSize(20)}
                color="#FFFFFF"
              />
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {String(t(`sections.${section.title}`))}
              </Text>
            </View>

            <View style={styles.sectionRight}>
              <Text style={styles.sectionCount}>
                {String(t("sectionCount", { completed: completedCount, total: section.data.length }))}
              </Text>
              <Text style={styles.sectionPercent}>
                {percent}%
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      );
    },
    [t, currentTheme]
  );

  const onPressAchievement = useCallback(
    async (item: Achievement) => {
      if (!item.isClaimable) return;
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      setTrophyData(item.trophies, item.identifier);
    },
    [setTrophyData]
  );

  /** Card component to allow glow hooks safely */
  const AchievementCard = useCallback(
    ({ item, index }: { item: Achievement; index: number }) => {
      const isActivated = item.isCompleted;
      const isClaimable = item.isClaimable;

      const trophyColor = isActivated
        ? currentTheme.colors.secondary
        : isClaimable
        ? currentTheme.colors.primary
        : textSecondary;

      const titleColor = isActivated ? textSecondary : textPrimary;

      // claimable glow
      const glowSV = useSharedValue(0);
      useEffect(() => {
        if (!isClaimable || isActivated) return;
        glowSV.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 900 }),
            withTiming(0, { duration: 900 })
          ),
          -1,
          true
        );
      }, [isClaimable, isActivated]);

      const glowStyle = useAnimatedStyle(() => {
        const o = 0.10 + glowSV.value * 0.18;
        const s = 1 + glowSV.value * 0.02;
        return {
          opacity: o,
          transform: [{ scale: s }],
        };
      });

      return (
        <Animated.View
          entering={ZoomIn.delay(index * 55)}
          style={styles.cardWrapper}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPressAchievement(item)}
            accessibilityRole="button"
            accessibilityLabel={String(t(item.identifier))}
            accessibilityHint={
              isClaimable
                ? String(t("claim"))
                : isActivated
                ? String(t("unlocked"))
                : String(t("inProgress"))
            }
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: isActivated
                    ? withAlpha("#22C55E", 0.9)
                    : isClaimable
                    ? withAlpha(currentTheme.colors.primary, 0.9)
                    : borderSoft,
                },
              ]}
            >
              {/* glow layer */}
              {isClaimable && !isActivated && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.glowLayer,
                    glowStyle,
                    { backgroundColor: withAlpha(currentTheme.colors.primary, 1) },
                  ]}
                />
              )}

              <View style={styles.trophyCol}>
                <Ionicons
                  name={isActivated ? "trophy" : "trophy-outline"}
                  size={normalizeSize(44)}
                  color={trophyColor}
                />
                <Text style={[styles.trophies, { color: trophyColor }]}>
                  {item.trophies}
                </Text>

                {!!item.isNew && !isActivated && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>{String(t("new"))}</Text>
                  </View>
                )}
              </View>

              <View style={styles.details}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: titleColor },
                    isActivated && styles.completedTitle,
                    isClaimable && styles.claimableTitle,
                  ]}
                  numberOfLines={2}
                >
                  {String(t(item.identifier, { defaultValue: item.identifier }))}
                </Text>

                <Text
                  style={[styles.cardDescription, { color: textSecondary }]}
                  numberOfLines={3}
                >
                  {String(
                    t(`descriptions.${item.identifier}`, {
                      defaultValue: String(t(item.identifier)),
                    })
                  )}
                </Text>
              </View>

              <View style={styles.action}>
                {isClaimable ? (
                  <LinearGradient
                    colors={[
                      currentTheme.colors.primary,
                      currentTheme.colors.secondary,
                    ]}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{String(t("claim"))}</Text>
                  </LinearGradient>
                ) : isActivated ? (
                  <View style={[styles.chip, styles.chipOk]}>
                    <Text style={[styles.chipText, styles.chipOkText]}>
                      {String(t("unlocked"))}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.chip, styles.chipPending]}>
                    <Text style={styles.chipText}>{String(t("inProgress"))}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [cardBg, borderSoft, currentTheme, onPressAchievement, t, textPrimary, textSecondary]
  );

  const renderItem = useCallback(
    ({ item, index }: SectionListRenderItemInfo<Achievement, AchievementSection>) => (
      <AchievementCard item={item} index={index} />
    ),
    [AchievementCard]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={[pageBgTop, pageBgBottom]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[styles.loadingText, { color: textPrimary }]}>{String(t("loading"))}</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={[pageBgTop, pageBgBottom]} style={styles.gradientContainer}>
          <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.primary, 0.22), "transparent"]} style={styles.bgOrbTop} />
          <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.secondary, 0.22), "transparent"]} style={styles.bgOrbBottom} />

          <CustomHeader title={String(t("yourAchievements"))} backgroundColor="transparent" useBlur={false} showHairline={false} />

          <View style={styles.emptyContainer}>
            <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyContent}>
              <Ionicons name="trophy-outline" size={normalizeSize(82)} color={currentTheme.colors.primary} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>{String(t("noAchievementsYet"))}</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>{String(t("firstAchievementsPrompt"))}</Text>
            </Animated.View>
          </View>

          {showBanners && (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: (tabBarHeight || 0) + insets.bottom, alignItems: "center", paddingBottom: 6, zIndex: 9999 }} pointerEvents="box-none">
              <BannerSlot onHeight={(h) => setAdHeight(h)} />
            </View>
          )}
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <LinearGradient colors={[pageBgTop, pageBgBottom]} style={styles.gradientContainer}>
        <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.primary, 0.22), "transparent"]} style={styles.bgOrbTop} />
        <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.secondary, 0.22), "transparent"]} style={styles.bgOrbBottom} />

        <CustomHeader title={String(t("yourAchievements"))} backgroundColor="transparent" useBlur={false} showHairline={false} />

        <View style={styles.progressBarWrapper}>
          <View style={[styles.progressBarBackground, { backgroundColor: withAlpha(currentTheme.colors.border, 0.9) }]}>
            <Animated.View style={[styles.progressBarFill, progressAnimatedStyle, { backgroundColor: currentTheme.colors.secondary }]} />
          </View>
          <Text style={[styles.progressText, { color: currentTheme.colors.secondary }]}>
            {String(t("trophiesProgress", { completed: done, total }))}
          </Text>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.colors.primary}
            />
          }
        />

        {showBanners && (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: tabBarHeight + insets.bottom, alignItems: "center", paddingBottom: 6, zIndex: 9999 }} pointerEvents="box-none">
            <BannerSlot onHeight={(h) => setAdHeight(h)} />
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: 0 },
  gradientContainer: { flex: 1 },

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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(16),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },

  emptyContainer: { flex: 1 },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING,
  },
  emptyTitle: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.8,
  },

  progressBarWrapper: {
    alignItems: "center",
    marginTop: SPACING * 0.8,
    marginBottom: SPACING * 0.4,
  },
  progressBarBackground: {
    width: SCREEN_WIDTH * 0.82,
    height: normalizeSize(9),
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: normalizeSize(6),
  },
  progressBarFill: { height: "100%" },
  progressText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
  },

  listContent: {
    paddingTop: SPACING,
    paddingHorizontal: SPACING,
  },

  sectionHeader: {
    marginTop: SPACING * 0.8,
    marginBottom: SPACING * 0.6,
  },
  sectionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(8),
    elevation: 7,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  sectionTitle: {
    marginLeft: 8,
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
  },
  sectionRight: { marginLeft: 8, alignItems: "flex-end" },
  sectionCount: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
    opacity: 0.9,
  },
  sectionPercent: {
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
    opacity: 0.9,
    marginTop: 2,
  },

  cardWrapper: {
    marginBottom: SPACING,
    borderRadius: normalizeSize(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.18,
    shadowRadius: normalizeSize(6),
    elevation: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(14),
    borderRadius: normalizeSize(18),
    borderWidth: 1.5,
    minHeight: normalizeSize(108),
    overflow: "hidden",
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(18),
  },

  trophyCol: {
    width: normalizeSize(74),
    alignItems: "center",
    justifyContent: "center",
  },
  trophies: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    marginTop: 4,
  },
  newBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  newBadgeText: {
    fontSize: normalizeSize(9),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },

  details: { flex: 1, paddingHorizontal: 8 },
  cardTitle: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_700Bold",
  },
  completedTitle: { textDecorationLine: "line-through", opacity: 0.7 },
  claimableTitle: { fontStyle: "italic" },
  cardDescription: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
    lineHeight: normalizeSize(16),
  },

  action: { alignItems: "flex-end", justifyContent: "center" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minWidth: normalizeSize(92),
  },
  chipText: {
    fontSize: normalizeSize(11),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
  },
  chipOk: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  chipOkText: { color: "#14532D" },
  chipPending: {
    backgroundColor: "rgba(148,163,184,0.18)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
  },
});
