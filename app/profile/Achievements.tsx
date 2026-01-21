// AchievementsScreen.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  I18nManager,
  Platform,
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
import { db, auth } from "@/constants/firebase-config";
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
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_COMPACT = SCREEN_HEIGHT < 720;
const V_SPACING = IS_COMPACT ? 12 : 16;

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
  level?: number;
  baseKey?: string;
}
interface AchievementSection {
  title: string;
  data: Achievement[];
  index: number;
}

/** ====== group mapping ====== */
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

const descendingGroups = new Set(["defisTermines", "engagement", "serieDeFeu", "creation", "discipline"]);

const parseIdentifierLevel = (identifier: string) => {
  const m = identifier.match(/^(.*)_(\d+)$/);
  if (!m) return { baseKey: identifier, level: undefined as number | undefined };
  return { baseKey: m[1], level: parseInt(m[2], 10) };
};

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
  const [disableAnimations, setDisableAnimations] = useState(false);
  const hasSeenFirstSnapshot = useRef(false);

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
    normalizeSize(92) + (showBanners ? adHeight : 0) + (tabBarHeight || 0) + insets.bottom;

  /** Progress bar anim (EXISTING LOGIC) */
  const progressSV = useSharedValue(0);
  const progressAnimatedStyle = useAnimatedStyle(() => {
    const ratio = Math.max(0, Math.min(progressSV.value, 1));
    return { width: `${Math.round(ratio * 100)}%` };
  });

  /** Firestore (LOGIC UNCHANGED) */
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
          data.sort((a, b) => {
            if (a.level != null && b.level != null) {
              const dir = descendingGroups.has(title) ? -1 : 1;
              return dir * (a.level - b.level);
            }
            if (descendingGroups.has(title)) {
              if (b.trophies !== a.trophies) return b.trophies - a.trophies;
            } else {
              if (a.trophies !== b.trophies) return a.trophies - b.trophies;
            }
            return String(t(a.identifier)).localeCompare(String(t(b.identifier)));
          });

          return { title, data, index: idx };
        });

        secs.sort((a, b) => {
          const ia = sectionOrder.indexOf(a.title);
          const ib = sectionOrder.indexOf(b.title);
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          return String(t(`sections.${a.title}`)).localeCompare(String(t(`sections.${b.title}`)));
        });

        setSections(secs);
        setLoading(false);

        if (!hasSeenFirstSnapshot.current) {
          hasSeenFirstSnapshot.current = true;
        } else if (!disableAnimations) {
          setDisableAnimations(true);
        }

        const totalNow = secs.reduce((s, sec) => s + sec.data.length, 0);
        const doneNow = secs.reduce((s, sec) => s + sec.data.filter((x) => x.isCompleted).length, 0);
        progressSV.value = withTiming(totalNow ? doneNow / totalNow : 0, { duration: 650 });
      },
      (error) => {
        console.error("Erreur onSnapshot achievements:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [t, setTrophyData, progressSV, disableAnimations]);

  const total = useMemo(() => sections.reduce((sum, s) => sum + s.data.length, 0), [sections]);
  const done = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.filter((a) => a.isCompleted).length, 0),
    [sections]
  );

  const heroCounts = useMemo(() => {
  const claimable = sections.reduce(
    (s, sec) => s + sec.data.filter((a) => a.isClaimable && !a.isCompleted).length,
    0
  );
  const fresh = sections.reduce(
    (s, sec) => s + sec.data.filter((a) => a.isNew && !a.isCompleted).length,
    0
  );

  // si c'est identique (souvent le cas), on n'affiche qu'UN seul
  return {
    claimable,
    fresh,
    showFresh: fresh > 0 && fresh !== claimable,
  };
}, [sections]);


  // PURE DERIVED (UI ONLY)
  const percentAll = useMemo(() => (total ? Math.round((done / total) * 100) : 0), [done, total]);
  const claimableCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.filter((a) => a.isClaimable && !a.isCompleted).length, 0),
    [sections]
  );
  const newCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.filter((a) => !!a.isNew && !a.isCompleted).length, 0),
    [sections]
  );

  /** palette */
  const pageBgTop = isDarkMode ? "#050B17" : "#F6F7FB";
  const pageBgBottom = isDarkMode ? currentTheme.colors.cardBackground : "#FFFFFF";
  const cardBg = isDarkMode ? withAlpha(currentTheme.colors.cardBackground, 0.96) : "#FFFFFF";
  const borderSoft = isDarkMode ? withAlpha(currentTheme.colors.border, 0.55) : "rgba(17,24,39,0.12)";
  const textPrimary = isDarkMode ? currentTheme.colors.textPrimary : "#0B0F1C";
  const textSecondary = isDarkMode ? currentTheme.colors.textSecondary : "rgba(11,15,28,0.7)";

  /** Section header */
  const renderSectionHeader = useCallback(
    ({ section }: { section: AchievementSection }) => {
      const completedCount = section.data.filter((a) => a.isCompleted).length;
      const ratio = section.data.length ? completedCount / section.data.length : 0;
      const percent = Math.round(ratio * 100);

      return (
        <Animated.View
          entering={disableAnimations ? undefined : FadeInUp.delay(section.index * 80)}
          style={styles.sectionHeaderWrap}
        >
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: withAlpha(cardBg, isDarkMode ? 0.62 : 0.92),
                borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.10) : withAlpha("#000000", 0.07),
              },
            ]}
          >
            {/* subtle gradient accent */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                withAlpha(currentTheme.colors.primary, isDarkMode ? 0.18 : 0.14),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sectionAccent}
            />

            <View style={styles.sectionLeft}>
              <View
                style={[
                  styles.sectionIconPill,
                  {
                    backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
                  },
                ]}
              >
                <Ionicons
                  name={getIconForGroup(section.title)}
                  size={normalizeSize(16)}
                  color={currentTheme.colors.secondary}
                />
              </View>

              <Text
                style={[
                  styles.sectionTitle,
                  { color: textPrimary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
              >
                {String(t(`sections.${section.title}`))}
              </Text>
            </View>

            <View style={styles.sectionRight}>
              <Text
                style={[styles.sectionCount, { color: textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {String(t("sectionCount", { completed: completedCount, total: section.data.length }))}
              </Text>

              {/* percent pill (no long text => never cut) */}
              <View
                style={[
                  styles.sectionPercentPill,
                  {
                    borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
                    backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  },
                ]}
              >
                <Text style={[styles.sectionPercentText, { color: currentTheme.colors.secondary }]}>
                  {percent}%
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      );
    },
    [t, currentTheme, disableAnimations, cardBg, isDarkMode, textPrimary, textSecondary]
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

  /** Card component (UI only) */
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

      // claimable glow (existing behaviour, more keynote)
      const glowSV = useSharedValue(0);
      useEffect(() => {
        if (!isClaimable || isActivated) return;
        glowSV.value = withRepeat(
          withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
          -1,
          true
        );
      }, [isClaimable, isActivated]);

      const glowStyle = useAnimatedStyle(() => {
        const o = 0.06 + glowSV.value * 0.16;
        const s = 1 + glowSV.value * 0.015;
        return { opacity: o, transform: [{ scale: s }] };
      });

      return (
        <Animated.View
          entering={!disableAnimations && index < 18 ? ZoomIn.delay(index * 45) : undefined}
          style={styles.cardWrapper}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onPressAchievement(item)}
            accessibilityRole="button"
            accessibilityLabel={String(t(item.identifier))}
            accessibilityHint={
              isClaimable ? String(t("claim")) : isActivated ? String(t("unlocked")) : String(t("inProgress"))
            }
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: isActivated
                    ? withAlpha("#22C55E", 0.75)
                    : isClaimable
                    ? withAlpha(currentTheme.colors.primary, 0.85)
                    : borderSoft,
                },
              ]}
            >
              {/* glass sheen */}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  "transparent",
                  isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardSheen}
              />

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

              {/* left badge */}
              <View style={styles.leftCol}>
                <View
                  style={[
                    styles.trophyBadge,
                    {
                      backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
                    },
                  ]}
                >
                  <Ionicons
                    name={isActivated ? "trophy" : "trophy-outline"}
                    size={normalizeSize(30)}
                    color={trophyColor}
                  />
                </View>

                {/* points explained visually (no long labels) */}
                <View
                  style={[
                    styles.pointsPill,
                    {
                      borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
                      backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    },
                  ]}
                >
                  <Ionicons name="sparkles" size={normalizeSize(12)} color={trophyColor} />
                  <Text style={[styles.pointsText, { color: trophyColor }]} numberOfLines={1}>
                    {item.trophies}
                  </Text>
                </View>

                {!!item.isNew && !isActivated && (
                  <View style={styles.newDot} accessibilityLabel={String(t("new"))} />
                )}
              </View>

              {/* content */}
              <View style={styles.details}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: titleColor },
                    isActivated && styles.completedTitle,
                    isClaimable && styles.claimableTitle,
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.92}
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

              {/* right status chip (shrinks, never overflows) */}
              <View style={styles.action}>
                {isClaimable ? (
                  <LinearGradient
                    colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                    style={styles.chip}
                  >
                    <Ionicons name="gift-outline" size={normalizeSize(14)} color="#FFFFFF" />
                    <Text
                      style={styles.chipText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {String(t("claim"))}
                    </Text>
                  </LinearGradient>
                ) : isActivated ? (
                  <View style={[styles.chip, styles.chipOk]}>
                    <Ionicons name="checkmark-circle" size={normalizeSize(14)} color="#14532D" />
                    <Text
                      style={[styles.chipText, styles.chipOkText]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {String(t("unlocked"))}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.chip, styles.chipPending]}>
                    <Ionicons name="lock-closed-outline" size={normalizeSize(14)} color={textSecondary} />
                    <Text
                      style={[styles.chipText, { color: textSecondary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {String(t("inProgress"))}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [cardBg, borderSoft, currentTheme, onPressAchievement, t, textPrimary, textSecondary, disableAnimations, isDarkMode]
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

  /** HERO header (UI only) */
  const ListHeader = useMemo(() => {
    return (
      <View style={styles.headerStack} accessibilityRole="summary">
        <Animated.View entering={FadeInUp.delay(60)} style={styles.heroWrap}>
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.78 : 0.94),
              withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.58 : 0.86),
            ]}
            style={[
              styles.heroCard,
              {
                borderColor: isDarkMode ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.07),
              },
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[
                "transparent",
                isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
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
                { backgroundColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.14 : 0.10) },
              ]}
            />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIdentity}>
                <Text style={[styles.heroKicker, { color: textSecondary }]} numberOfLines={1}>
                  {String(t("yourAchievements"))}
                </Text>
                <Text
                  style={[styles.heroTitle, { color: textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}
                >
                  {percentAll}%
                </Text>
              </View>

              {/* pills: icon + value only -> no text cut in any language */}
              <View style={styles.heroPillsRow}>
  {heroCounts.claimable > 0 && (() => {
  const pillTextColor = isDarkMode ? "#FFFFFF" : "#0B0F1C";
  const pillSubColor = isDarkMode ? "rgba(255,255,255,0.82)" : "rgba(11,15,28,0.72)";
  const pillBg = isDarkMode ? "rgba(255,140,0,0.22)" : "rgba(255,140,0,0.18)";
  const pillBorder = isDarkMode ? "rgba(255,140,0,0.35)" : "rgba(255,140,0,0.28)";

  return (
    <View style={[styles.heroPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
      <Ionicons name="gift-outline" size={normalizeSize(14)} color={pillTextColor} />

      <Text style={[styles.heroPillValue, { color: pillTextColor }]} numberOfLines={1}>
        {heroCounts.claimable}
      </Text>

      <Text style={[styles.heroPillLabel, { color: pillSubColor }]} numberOfLines={1}>
        {String(t("toClaim", { defaultValue: "À réclamer" }))}
      </Text>
    </View>
  );
})()}


  {heroCounts.showFresh && (
    <View style={styles.heroPill}>
      <Ionicons
        name="flash-outline"
        size={normalizeSize(14)}
        color={currentTheme.colors.primary}
      />
      <Text
        style={[styles.heroPillValue, { color: textPrimary }]}
        numberOfLines={1}
      >
        {heroCounts.fresh}
      </Text>
      <Text style={styles.heroPillLabel} numberOfLines={1}>
        {String(t("new", { defaultValue: "Nouveau" }))}
      </Text>
    </View>
  )}
</View>

            </View>

            {/* progress bar (moved into hero -> no duplicated block) */}
            <View style={styles.heroProgressBlock}>
              <View
                style={[
                  styles.progressBarBackground,
                  { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    progressAnimatedStyle,
                    { backgroundColor: currentTheme.colors.secondary },
                  ]}
                />
              </View>

              <Text style={[styles.progressText, { color: currentTheme.colors.secondary }]} numberOfLines={1}>
                {String(t("trophiesProgress", { completed: done, total }))}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.headerDivider} pointerEvents="none" />
      </View>
    );
  }, [
    t,
    currentTheme,
    isDarkMode,
    textPrimary,
    textSecondary,
    percentAll,
    done,
    total,
    claimableCount,
    newCount,
    progressAnimatedStyle,
  ]);

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
            <View
              style={{ position: "absolute", left: 0, right: 0, bottom: (tabBarHeight || 0) + insets.bottom, alignItems: "center", paddingBottom: 6, zIndex: 9999 }}
              pointerEvents="box-none"
            >
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

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}

          initialNumToRender={14}
          maxToRenderPerBatch={20}
          windowSize={12}

          removeClippedSubviews={Platform.OS === "android"}

          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.colors.primary}
            />
          }
        />

        {showBanners && (
          <View
            style={{ position: "absolute", left: 0, right: 0, bottom: tabBarHeight + insets.bottom, alignItems: "center", paddingBottom: 6, zIndex: 9999 }}
            pointerEvents="box-none"
          >
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
  heroPillsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: normalizeSize(10),
  paddingHorizontal: SPACING,
  marginTop: normalizeSize(10),
},

heroPill: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(8),
  paddingVertical: normalizeSize(8),
  paddingHorizontal: normalizeSize(12),
  borderRadius: 999,
  borderWidth: StyleSheet.hairlineWidth,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderColor: "rgba(255,255,255,0.14)",
},
heroPillPrimary: {
  backgroundColor: "rgba(255,140,0,0.22)",
  borderColor: "rgba(255,140,0,0.35)",
},
heroPillValue: {
  fontSize: normalizeSize(13.5),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},
heroPillLabel: {
  fontSize: normalizeSize(12),
  fontFamily: "Comfortaa_400Regular",
  opacity: 0.95,
},
  loadingText: {
    marginTop: normalizeSize(16),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
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
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  emptySubtitle: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  listContent: {
    paddingTop: V_SPACING,
    paddingHorizontal: SPACING,
  },

  /* ===== HERO ===== */
  headerStack: { paddingTop: V_SPACING },
  heroWrap: { paddingHorizontal: SPACING, marginBottom: V_SPACING },
  heroCard: {
    borderRadius: normalizeSize(22),
    paddingVertical: normalizeSize(IS_COMPACT ? 14 : 16),
    paddingHorizontal: normalizeSize(16),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroSheen: {
    position: "absolute",
    top: -normalizeSize(26),
    left: -normalizeSize(70),
    width: "175%",
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
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: normalizeSize(10),
    marginBottom: normalizeSize(12),
  },
  heroIdentity: { flex: 1, paddingRight: normalizeSize(6) },
  heroKicker: {
    fontSize: normalizeSize(12.5),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.92,
    marginBottom: normalizeSize(4),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroTitle: {
    fontSize: normalizeSize(26),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroPillsCol: {
    alignItems: "flex-end",
    gap: normalizeSize(8),
  },
  heroProgressBlock: {
    marginTop: normalizeSize(2),
    alignItems: "flex-start",
  },

  headerDivider: {
    height: 1,
    marginHorizontal: SPACING,
    marginBottom: V_SPACING,
    backgroundColor: "rgba(148,163,184,0.18)",
  },

  /* progress bar (reused) */
  progressBarBackground: {
    width: "100%",
    height: normalizeSize(9),
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: normalizeSize(8),
  },
  progressBarFill: { height: "100%" },
  progressText: {
    fontSize: normalizeSize(13),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "left",
  },

  /* ===== SECTION HEADER ===== */
  sectionHeaderWrap: {
    marginTop: V_SPACING,
    marginBottom: normalizeSize(10),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(16),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  sectionAccent: {
    position: "absolute",
    top: -normalizeSize(22),
    left: -normalizeSize(18),
    width: normalizeSize(140),
    height: normalizeSize(140),
    borderRadius: 999,
    opacity: 1,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: normalizeSize(10) },
  sectionIconPill: {
    width: normalizeSize(34),
    height: normalizeSize(34),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  sectionRight: { alignItems: "flex-end", gap: normalizeSize(6), marginLeft: 10 },
  sectionCount: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  sectionPercentPill: {
    paddingHorizontal: normalizeSize(10),
    paddingVertical: normalizeSize(6),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionPercentText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
  },

  /* ===== CARD ===== */
  cardWrapper: {
    marginBottom: V_SPACING,
    borderRadius: normalizeSize(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(10) },
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0,
    shadowRadius: normalizeSize(16),
    elevation: Platform.OS === "android" ? 3 : 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(14),
    borderRadius: normalizeSize(18),
    borderWidth: 1.25,
    minHeight: normalizeSize(106),
    overflow: "hidden",
  },
  cardSheen: {
    position: "absolute",
    top: -normalizeSize(30),
    left: -normalizeSize(70),
    width: "175%",
    height: normalizeSize(90),
    transform: [{ rotate: "-12deg" }],
    opacity: 0.75,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: normalizeSize(18),
  },

  leftCol: {
    width: normalizeSize(78),
    alignItems: "center",
    justifyContent: "center",
    gap: normalizeSize(8),
  },
  trophyBadge: {
    width: normalizeSize(54),
    height: normalizeSize(54),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pointsText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  newDot: {
    width: normalizeSize(8),
    height: normalizeSize(8),
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },

  details: { flex: 1, paddingHorizontal: 10 },
  cardTitle: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  completedTitle: { textDecorationLine: "line-through", opacity: 0.7 },
  claimableTitle: { fontStyle: "italic" },
  cardDescription: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
    lineHeight: normalizeSize(16),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },

  action: { alignItems: "flex-end", justifyContent: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    justifyContent: "center",
    minWidth: normalizeSize(92),
    maxWidth: normalizeSize(140),
  },
  chipText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
    flexShrink: 1,
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
    borderColor: "rgba(148,163,184,0.45)",
  },
});
