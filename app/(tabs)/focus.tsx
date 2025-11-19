import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated as RNAnimated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import Animated, { FadeInUp } from "react-native-reanimated";
import TutorialModal from "../../components/TutorialModal";
import * as Haptics from "expo-haptics";
import { Modal } from "react-native";
import { Image } from "expo-image";

const SPACING = 18;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMG_BLURHASH = "LEHLk~WB2yk8pyo0adR*.7kCMdnj";

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

// util couleur -> rgba avec alpha
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) =>
    Math.min(Math.max(n, min), max);
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

const TOP_ITEM_WIDTH = SCREEN_WIDTH * 0.8;
const BOTTOM_ITEM_WIDTH = SCREEN_WIDTH * 0.6;
const TOP_ITEM_HEIGHT = normalizeSize(280);
const BOTTOM_ITEM_HEIGHT = normalizeSize(200);

const EFFECTIVE_TOP_ITEM_WIDTH = TOP_ITEM_WIDTH + SPACING;
const EFFECTIVE_BOTTOM_ITEM_WIDTH = BOTTOM_ITEM_WIDTH + SPACING;

const SPACER_TOP = (SCREEN_WIDTH - TOP_ITEM_WIDTH) / 2;
const SPACER_BOTTOM = (SCREEN_WIDTH - BOTTOM_ITEM_WIDTH) / 2;

interface CurrentChallengeExtended {
  id: string;
  title: string;
  challengeId?: string;
  docId?: string;
  chatId?: string;
  imageUrl?: string;
  selectedDays: number;
  completedDays: number;
  // peut être string, Date, Timestamp Firestore...
  lastMarkedDate?: any;
  participants?: number;
  category?: string;
  description?: string;
  uniqueKey?: string;
}

// 🔍 Normalisation de la date "marqué aujourd'hui" (string / Date / Timestamp)
const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isMarkedToday = (lastMarkedRaw: any): boolean => {
  if (!lastMarkedRaw) return false;

  let d: Date | null = null;

  // Firestore Timestamp
  if (lastMarkedRaw?.toDate && typeof lastMarkedRaw.toDate === "function") {
    d = lastMarkedRaw.toDate();
  } else if (lastMarkedRaw instanceof Date) {
    d = lastMarkedRaw;
  } else if (typeof lastMarkedRaw === "string") {
    // gère ISO, toDateString, etc.
    const parsed = new Date(lastMarkedRaw);
    if (!isNaN(parsed.getTime())) d = parsed;
  } else if (
    typeof lastMarkedRaw === "object" &&
    typeof lastMarkedRaw.seconds === "number"
  ) {
    // autre format de timestamp { seconds, nanoseconds }
    d = new Date(lastMarkedRaw.seconds * 1000);
  }

  if (!d) return false;
  const now = new Date();
  return isSameCalendarDay(d, now);
};

type IntervalId = ReturnType<typeof setInterval>;

export default function FocusScreen() {
  const { t } = useTranslation();
  const {
    tutorialStep,
    isTutorialActive,
    skipTutorial,
    setTutorialStep,
  } = useTutorial();
  const router = useRouter();
  const { currentChallenges, markToday } = useCurrentChallenges();
  const { theme } = useTheme();

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [isLoading, setIsLoading] = useState(true);
  const [userTrophies, setUserTrophies] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Focus timer (Pomodoro)
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(25 * 60);
  const [focusLabel, setFocusLabel] = useState<"FOCUS" | "BREAK">("FOCUS");

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const scrollXTop = useRef(new RNAnimated.Value(0)).current;
  const scrollXBottom = useRef(new RNAnimated.Value(0)).current;

  const flatListTopRef = useRef<RNAnimated.FlatList<any>>(null);
  const flatListBottomRef = useRef<RNAnimated.FlatList<any>>(null);

  const topAutoScrollRef = useRef<IntervalId | null>(null);
  const bottomAutoScrollRef = useRef<IntervalId | null>(null);

  const topIndexRef = useRef(0);
  const bottomIndexRef = useRef(0);

  // 🔄 Loading selon les challenges courants
  useEffect(() => {
    setIsLoading(false);
  }, [currentChallenges]);

  // 🔥 Récupération live des trophées utilisateur
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const trophies =
          typeof data?.trophies === "number" ? data.trophies : 0;
        setUserTrophies(trophies);
      }
    });

    return () => unsub();
  }, []);

  const today = new Date().toDateString();

  const uniqueChallenges = Array.from(
    new Map(currentChallenges.map((ch: any) => [ch.uniqueKey, ch])).values()
  ) as CurrentChallengeExtended[];

  const translatedChallenges = uniqueChallenges.map((item) => {
    const key = item.chatId || item.id;
    return {
      ...item,
      title: t(`challenges.${key}.title`, { defaultValue: item.title }),
      description: t(`challenges.${key}.description`, {
        defaultValue: item.description || "",
      }),
      category: item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("miscellaneous"),
    };
  });

  const enrichedChallenges = translatedChallenges.map((item) => ({
    ...item,
    docId: (item as any).challengeId || item.chatId || item.id,
  }));

  const notMarkedToday = enrichedChallenges.filter(
    (ch) => !isMarkedToday(ch.lastMarkedDate)
  );
  const markedToday = enrichedChallenges.filter((ch) =>
    isMarkedToday(ch.lastMarkedDate)
  );

  const kpis = useMemo(() => {
    const remaining = notMarkedToday.length;
    const completed = markedToday.length;
    const total = enrichedChallenges.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { remaining, completed, total, pct };
  }, [notMarkedToday.length, markedToday.length, enrichedChallenges.length]);

  const pctLabel = useMemo(
    () => `${kpis.completed}/${kpis.total} • ${kpis.pct}%`,
    [kpis.completed, kpis.total, kpis.pct]
  );

  // Pull-to-refresh visuel (données driven par Firestore)
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  }, []);

  // ✅ Action: marquer aujourd'hui (confettis + haptics)
  const safeMarkToday = useCallback(
    async (item: CurrentChallengeExtended) => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      try {
        await markToday(item.id, item.selectedDays);
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } catch {}
        setTimeout(() => {
          if (confettiRef.current?.start) {
            confettiRef.current.start();
          }
        }, 120);
      } catch (e) {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );
        } catch {}
      }
    },
    [markToday]
  );

  const handleNavigateToDetails = (item: CurrentChallengeExtended) => {
    router.push({
      pathname: "/challenge-details/[id]",
      params: {
        id: item.id,
        title: item.title,
        selectedDays: item.selectedDays,
        completedDays: item.completedDays,
        category: item.category || t("uncategorized"),
        description: item.description || t("noDescriptionAvailable"),
        imageUrl: item.imageUrl,
      },
    });
  };

  const startTopAutoScroll = useCallback(() => {
    if (notMarkedToday.length <= 1) return;
    if (topAutoScrollRef.current) clearInterval(topAutoScrollRef.current);
    topAutoScrollRef.current = setInterval(() => {
      let nextIndex = topIndexRef.current + 1;
      if (nextIndex >= notMarkedToday.length) nextIndex = 0;
      topIndexRef.current = nextIndex;
      flatListTopRef.current?.scrollToOffset({
        offset: nextIndex * EFFECTIVE_TOP_ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [notMarkedToday]);

  const startBottomAutoScroll = useCallback(() => {
    if (markedToday.length <= 1) return;
    if (bottomAutoScrollRef.current) clearInterval(bottomAutoScrollRef.current);
    bottomAutoScrollRef.current = setInterval(() => {
      let nextIndex = bottomIndexRef.current + 1;
      if (nextIndex >= markedToday.length) nextIndex = 0;
      bottomIndexRef.current = nextIndex;
      flatListBottomRef.current?.scrollToOffset({
        offset: nextIndex * EFFECTIVE_BOTTOM_ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [markedToday]);

  // ——— Focus timer tick ———
  useEffect(() => {
    if (!focusRunning) return;
    const id = setInterval(() => {
      setFocusSecondsLeft((s) => {
        if (s <= 1) {
          try {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } catch {}
          setFocusRunning(false);
          setTimeout(() => confettiRef.current?.start?.(), 80);

          if (focusLabel === "FOCUS") {
            setFocusLabel("BREAK");
            setFocusSecondsLeft(5 * 60);
          } else {
            setFocusLabel("FOCUS");
            setFocusSecondsLeft(25 * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [focusRunning, focusLabel]);

  const openFocus = useCallback(() => {
    setFocusVisible(true);
    setFocusLabel("FOCUS");
    setFocusSecondsLeft(25 * 60);
    setFocusRunning(false);
  }, []);

  const closeFocus = useCallback(() => {
    setFocusVisible(false);
    setFocusRunning(false);
  }, []);

  const toggleFocus = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setFocusRunning((r) => !r);
  }, []);

  const resetFocus = useCallback(() => {
    setFocusRunning(false);
    setFocusLabel("FOCUS");
    setFocusSecondsLeft(25 * 60);
  }, []);

  const formatTime = useCallback((total: number) => {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  useEffect(() => {
    startTopAutoScroll();
    startBottomAutoScroll();
    return () => {
      if (topAutoScrollRef.current) clearInterval(topAutoScrollRef.current);
      if (bottomAutoScrollRef.current)
        clearInterval(bottomAutoScrollRef.current);
    };
  }, [notMarkedToday, markedToday, startTopAutoScroll, startBottomAutoScroll]);

  const handleScrollBeginDragTop = () => {
    if (topAutoScrollRef.current) {
      clearInterval(topAutoScrollRef.current);
      topAutoScrollRef.current = null;
    }
  };

  const handleScrollBeginDragBottom = () => {
    if (bottomAutoScrollRef.current) {
      clearInterval(bottomAutoScrollRef.current);
      bottomAutoScrollRef.current = null;
    }
  };

  const handleMomentumScrollEndTop = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_TOP_ITEM_WIDTH);
    topIndexRef.current = index;
    flatListTopRef.current?.scrollToOffset({
      offset: index * EFFECTIVE_TOP_ITEM_WIDTH,
      animated: true,
    });
    if (!topAutoScrollRef.current) {
      setTimeout(() => startTopAutoScroll(), 2000);
    }
  };

  const handleMomentumScrollEndBottom = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / EFFECTIVE_BOTTOM_ITEM_WIDTH);
    bottomIndexRef.current = index;
    flatListBottomRef.current?.scrollToOffset({
      offset: index * EFFECTIVE_BOTTOM_ITEM_WIDTH,
      animated: true,
    });
    if (!bottomAutoScrollRef.current) {
      setTimeout(() => startBottomAutoScroll(), 2000);
    }
  };

  const renderTopItem = ({ item }: { item: CurrentChallengeExtended }) => (
    <RNAnimated.View style={styles.topItemWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.topItemContainer}
        onPress={() => handleNavigateToDetails(item)}
        accessibilityRole="button"
        accessibilityLabel={t("openChallengeDetails")}
        testID={`top-card-${item.uniqueKey || item.id}`}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[
            styles.topItemGradient,
            {
              borderColor: isDarkMode
                ? currentTheme.colors.secondary
                : "#FF8C00",
            },
          ]}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.topItemImage}
              contentFit="cover"
              placeholder={{ blurhash: IMG_BLURHASH }}
              transition={250}
              cachePolicy="memory-disk"
              accessible
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: currentTheme.colors.border },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={normalizeSize(60)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("imageNotAvailable")}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.overlay, 0.25),
              withAlpha("#000000", 0.85),
            ]}
            style={styles.topItemOverlay}
          >
            <Text
              style={[
                styles.topItemTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {item.title}
            </Text>
            
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>

      {!isMarkedToday(item.lastMarkedDate) && (
        <TouchableOpacity
          style={[
            styles.markTodayButton,
            { backgroundColor: currentTheme.colors.secondary },
          ]}
          onPress={() => safeMarkToday(item)}
          accessibilityRole="button"
          accessibilityLabel={t("markToday")}
          testID={`mark-today-${item.uniqueKey || item.id}`}
        >
          <Text
            style={[
              styles.markTodayButtonText,
              {
                color: isDarkMode ? "#000000" : currentTheme.colors.textPrimary,
              },
            ]}
          >
            {t("markToday")}
          </Text>
        </TouchableOpacity>
      )}
    </RNAnimated.View>
  );

  const renderBottomItem = ({ item }: { item: CurrentChallengeExtended }) => (
    <RNAnimated.View style={styles.bottomItemWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.bottomItemContainer}
        onPress={() => handleNavigateToDetails(item)}
        accessibilityRole="button"
        accessibilityLabel={t("openChallengeDetails")}
        testID={`bottom-card-${item.uniqueKey || item.id}`}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[
            styles.bottomItemGradient,
            {
              borderColor: isDarkMode
                ? currentTheme.colors.secondary
                : "#FF8C00",
            },
          ]}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.bottomItemImage}
              contentFit="cover"
              placeholder={{ blurhash: IMG_BLURHASH }}
              transition={250}
              cachePolicy="memory-disk"
              accessible
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: currentTheme.colors.border },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={normalizeSize(40)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.noImageText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("imageNotAvailable")}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.overlay, 0.25),
              withAlpha("#000000", 0.85),
            ]}
            style={styles.bottomItemOverlay}
          >
            <Text
              style={[
                styles.bottomItemTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </RNAnimated.View>
  );

  const renderTop = useCallback(renderTopItem, [
    currentTheme,
    isDarkMode,
  ]);
  const renderBottom = useCallback(renderBottomItem, [
    currentTheme,
    isDarkMode,
  ]);
  const getTopLayout = useCallback(
    (_: any, index: number) => ({
      length: EFFECTIVE_TOP_ITEM_WIDTH,
      offset: EFFECTIVE_TOP_ITEM_WIDTH * index,
      index,
    }),
    []
  );
  const getBottomLayout = useCallback(
    (_: any, index: number) => ({
      length: EFFECTIVE_BOTTOM_ITEM_WIDTH,
      offset: EFFECTIVE_BOTTOM_ITEM_WIDTH * index,
      index,
    }),
    []
  );

  if (isLoading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            withAlpha(currentTheme.colors.background, 1),
            withAlpha(currentTheme.colors.cardBackground, 1),
            withAlpha(currentTheme.colors.primary, 0.13),
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.primary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("loadingChallenges")}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
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
        {/* Orbes décoratives */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.primary, 0.28),
            "transparent",
          ]}
          style={styles.bgOrbTop}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.secondary, 0.25),
            "transparent",
          ]}
          style={styles.bgOrbBottom}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Header trophées + création */}
        <View style={styles.headerWrapper}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={[
                styles.trophyContainer,
                {
                  backgroundColor: isDarkMode
                    ? currentTheme.colors.cardBackground
                    : "#FF8C00",
                  borderColor: isDarkMode
                    ? currentTheme.colors.border
                    : "#FFF",
                },
              ]}
              onPress={() => router.push("/profile")}
              accessibilityRole="button"
              accessibilityLabel={t("openProfile")}
              testID="open-profile"
            >
              <Ionicons
                name="trophy-outline"
                size={normalizeSize(28)}
                color={
                  isDarkMode ? currentTheme.colors.trophy : "#FFFFFF"
                }
              />
              <Text
                style={[
                  styles.trophyText,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.trophy
                      : "#FFFFFF",
                  },
                ]}
              >
                {userTrophies}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.plusButton,
                { backgroundColor: currentTheme.colors.secondary },
              ]}
              onPress={() => router.push("/create-challenge")}
              accessibilityRole="button"
              accessibilityLabel={t("createChallenge")}
              testID="create-challenge"
            >
              <Ionicons
                name="add-circle-outline"
                size={normalizeSize(28)}
                color={
                  isDarkMode
                    ? "#000000"
                    : currentTheme.colors.textPrimary
                }
              />
            </TouchableOpacity>
          </View>

          {/* KPI strip */}
          <View style={styles.kpiStrip}>
            <View
              style={[
                styles.kpiPill,
                {
                  borderColor: withAlpha(
                    currentTheme.colors.secondary,
                    0.6
                  ),
                  alignSelf: "center",
                },
              ]}
              accessibilityRole="summary"
              accessibilityLabel={t("remainingToday", {
                defaultValue: "À faire aujourd’hui",
              })}
            >
              <Ionicons
                name="flash-outline"
                size={normalizeSize(16)}
                color={currentTheme.colors.secondary}
              />
              <Text
                style={[
                  styles.kpiText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("remainingToday", {
                  defaultValue: "À faire aujourd’hui",
                })}
                : {kpis.remaining}
              </Text>
            </View>
          </View>

          {/* Progression du jour */}
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: withAlpha(
                  currentTheme.colors.textSecondary,
                  0.15
                ),
              },
            ]}
            accessibilityRole="progressbar"
            accessibilityValue={{ now: kpis.pct, min: 0, max: 100 }}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${kpis.pct}%`,
                  backgroundColor: currentTheme.colors.secondary,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.progressLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {pctLabel}
          </Text>
        </View>

        {/* —— Barre d'actions rapides —— */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            onPress={openFocus}
            activeOpacity={0.9}
            style={[
              styles.actionBtn,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("startFocus", {
              defaultValue: "Lancer Focus 25:00",
            })}
            testID="cta-start-focus"
          >
            <Ionicons
              name="timer-outline"
              size={normalizeSize(18)}
              color={
                isDarkMode ? "#000000" : currentTheme.colors.textPrimary
              }
            />
            <Text
              style={[
                styles.actionBtnText,
                {
                  color: isDarkMode
                    ? "#000000"
                    : currentTheme.colors.textPrimary,
                },
              ]}
            >
              25:00 Focus
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/explore")}
            activeOpacity={0.9}
            style={[
              styles.actionBtnGhost,
              {
                borderColor: withAlpha(
                  currentTheme.colors.secondary,
                  0.6
                ),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("discoverChallenges", {
              defaultValue: "Découvrir des défis",
            })}
            testID="cta-discover"
          >
            <Ionicons
              name="compass-outline"
              size={normalizeSize(18)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.actionBtnGhostText,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("discover", { defaultValue: "Découvrir" })}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            // @ts-ignore
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.colors.secondary}
              colors={[currentTheme.colors.secondary]}
              progressBackgroundColor={withAlpha(
                currentTheme.colors.cardBackground,
                1
              )}
            />
          }
        >
          {/* === Carrousel haut : défis à faire === */}
          <View style={styles.topCarouselContainer}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000",
                },
              ]}
            >
              {t("dailyChallenges")}
            </Text>

            {notMarkedToday.length > 0 ? (
              <>
                <RNAnimated.FlatList
                  ref={flatListTopRef}
                  data={notMarkedToday}
                  keyExtractor={(item, index) =>
                    String(
                      item.uniqueKey || item.docId || item.id || index
                    )
                  }
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  bounces={false}
                  snapToInterval={EFFECTIVE_TOP_ITEM_WIDTH}
                  snapToAlignment="center"
                  contentContainerStyle={{ paddingHorizontal: SPACER_TOP }}
                  onScroll={RNAnimated.event(
                    [
                      {
                        nativeEvent: {
                          contentOffset: { x: scrollXTop },
                        },
                      },
                    ],
                    { useNativeDriver: true }
                  )}
                  scrollEventThrottle={16}
                  onScrollBeginDrag={handleScrollBeginDragTop}
                  onMomentumScrollEnd={handleMomentumScrollEndTop}
                  renderItem={renderTop}
                  getItemLayout={getTopLayout}
                  initialNumToRender={3}
                  windowSize={5}
                  removeClippedSubviews
                  accessibilityLabel={t("dailyChallenges")}
                />
                <View style={styles.pagination}>
                  {notMarkedToday.map((_, index) => (
                    <RNAnimated.View
                      key={index}
                      style={[
                        styles.dot,
                        { backgroundColor: currentTheme.colors.secondary },
                        {
                          opacity: scrollXTop.interpolate({
                            inputRange: [
                              (index - 1) * EFFECTIVE_TOP_ITEM_WIDTH,
                              index * EFFECTIVE_TOP_ITEM_WIDTH,
                              (index + 1) * EFFECTIVE_TOP_ITEM_WIDTH,
                            ],
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: "clamp",
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "F0",
                ]}
                style={[
                  styles.emptyTopContainer,
                  {
                    borderWidth: 2.5,
                    borderColor: isDarkMode
                      ? currentTheme.colors.secondary
                      : "#FF8C00",
                  },
                ]}
              >
                <Animated.View entering={FadeInUp.delay(100)}>
                  <Ionicons
                    name="create-outline"
                    size={normalizeSize(60)}
                    color={currentTheme.colors.textSecondary}
                    accessibilityLabel={t("noChallengesIcon")}
                  />
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("noOngoingChallenge")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("createPrompt")}
                  </Text>
                  <View style={styles.emptyList}>
                    <Text
                      style={[
                        styles.emptyItem,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      • {t("clickIconTopRight")}
                    </Text>
                    <Text
                      style={[
                        styles.emptyItem,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      •{" "}
                      <Text
                        style={[
                          styles.linkText,
                          { color: currentTheme.colors.secondary },
                        ]}
                        onPress={() => router.push("/explore")}
                      >
                        {t("orJoinChallenge")}
                      </Text>
                    </Text>
                  </View>
                </Animated.View>
              </LinearGradient>
            )}
          </View>

          {/* === Carrousel bas : défis complétés aujourd’hui === */}
          <View style={styles.bottomCarouselContainer}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000000",
                },
              ]}
            >
              {t("completedChallengesScreenTitle")} {t("today")}
            </Text>

            {markedToday.length > 0 ? (
              <>
                <RNAnimated.FlatList
                  ref={flatListBottomRef}
                  data={markedToday}
                  keyExtractor={(item, index) =>
                    String(
                      item.uniqueKey || item.docId || item.id || index
                    )
                  }
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  bounces={false}
                  snapToInterval={EFFECTIVE_BOTTOM_ITEM_WIDTH}
                  snapToAlignment="center"
                  contentContainerStyle={{
                    paddingHorizontal: SPACER_BOTTOM,
                  }}
                  onScroll={RNAnimated.event(
                    [
                      {
                        nativeEvent: {
                          contentOffset: { x: scrollXBottom },
                        },
                      },
                    ],
                    { useNativeDriver: true }
                  )}
                  scrollEventThrottle={16}
                  onScrollBeginDrag={handleScrollBeginDragBottom}
                  onMomentumScrollEnd={handleMomentumScrollEndBottom}
                  renderItem={renderBottom}
                  getItemLayout={getBottomLayout}
                  initialNumToRender={3}
                  windowSize={5}
                  removeClippedSubviews
                  accessibilityLabel={t(
                    "completedChallengesScreenTitle"
                  )}
                />
                <View style={styles.pagination}>
                  {markedToday.map((_, index) => (
                    <RNAnimated.View
                      key={index}
                      style={[
                        styles.dot,
                        { backgroundColor: currentTheme.colors.secondary },
                        {
                          opacity: scrollXBottom.interpolate({
                            inputRange: [
                              (index - 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
                              index * EFFECTIVE_BOTTOM_ITEM_WIDTH,
                              (index + 1) * EFFECTIVE_BOTTOM_ITEM_WIDTH,
                            ],
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: "clamp",
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text
                style={[
                  styles.noChallenges,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("noCompletedChallenges")}
              </Text>
            )}
          </View>

          {/* Confettis */}
          <ConfettiCannon
            ref={confettiRef}
            autoStart={false}
            count={180}
            origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
            fadeOut
            explosionSpeed={820}
            fallSpeed={3200}
          />
        </ScrollView>

        {/* —— Focus Timer Modal —— */}
        <Modal
          visible={focusVisible}
          transparent
          animationType="fade"
          onRequestClose={closeFocus}
        >
          <View style={styles.focusBackdrop}>
            <View
              style={[
                styles.focusCard,
                {
                  backgroundColor: withAlpha(
                    currentTheme.colors.cardBackground,
                    0.96
                  ),
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.focusLabel,
                  {
                    color:
                      focusLabel === "FOCUS"
                        ? currentTheme.colors.secondary
                        : currentTheme.colors.trophy,
                  },
                ]}
              >
                {focusLabel === "FOCUS"
                  ? t("focus", { defaultValue: "FOCUS" })
                  : t("break", { defaultValue: "PAUSE" })}
              </Text>
              <Text
                style={[
                  styles.focusTimer,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#111111",
                  },
                ]}
                accessibilityLabel={formatTime(focusSecondsLeft)}
              >
                {formatTime(focusSecondsLeft)}
              </Text>
              <View style={styles.focusButtons}>
                <TouchableOpacity
                  onPress={toggleFocus}
                  style={[
                    styles.focusPrimary,
                    { backgroundColor: currentTheme.colors.secondary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    focusRunning
                      ? t("pause", { defaultValue: "Pause" })
                      : t("start", { defaultValue: "Démarrer" })
                  }
                  accessibilityHint={t("startFocus", {
                    defaultValue:
                      "Lancer ou mettre en pause le minuteur.",
                  })}
                >
                  <Ionicons
                    name={
                      focusRunning
                        ? "pause-circle-outline"
                        : "play-circle-outline"
                    }
                    size={normalizeSize(24)}
                    color={
                      isDarkMode
                        ? "#000000"
                        : currentTheme.colors.textPrimary
                    }
                  />
                  <Text
                    style={[
                      styles.focusPrimaryText,
                      {
                        color:
                          isDarkMode
                            ? "#000000"
                            : currentTheme.colors.textPrimary,
                      },
                    ]}
                  >
                    {focusRunning
                      ? t("pause", { defaultValue: "Pause" })
                      : t("start", { defaultValue: "Démarrer" })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={resetFocus}
                  style={[
                    styles.focusSecondary,
                    {
                      borderColor: withAlpha(
                        currentTheme.colors.secondary,
                        0.6
                      ),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("reset", {
                    defaultValue: "Réinitialiser",
                  })}
                  accessibilityHint={t("resetTimerHint", {
                    defaultValue: "Réinitialise à 25:00 Focus.",
                  })}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={normalizeSize(22)}
                    color={currentTheme.colors.secondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeFocus}
                  style={[
                    styles.focusSecondary,
                    {
                      borderColor: withAlpha(
                        currentTheme.colors.textSecondary,
                        0.5
                      ),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("close", {
                    defaultValue: "Fermer",
                  })}
                >
                  <Ionicons
                    name="close-outline"
                    size={normalizeSize(22)}
                    color={currentTheme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.focusHint,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("focusHint", {
                  defaultValue:
                    "Astuce : verrouille ton écran pour éviter les distractions.",
                })}
              </Text>
            </View>
          </View>
        </Modal>

        {/* === Tuto étape 3 === */}
        {isTutorialActive && tutorialStep === 3 && (
          <BlurView intensity={50} style={styles.blurView}>
            <TutorialModal
              step={tutorialStep}
              onNext={() => setTutorialStep(4)}
              onStart={() => {}}
              onSkip={skipTutorial}
              onFinish={skipTutorial}
            />
          </BlurView>
        )}
      </LinearGradient>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5,
    position: "relative",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trophyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
    paddingVertical: normalizeSize(8),
    borderRadius: normalizeSize(20),
    borderWidth: 1,
  },
  trophyText: {
    fontSize: normalizeSize(20),
    marginLeft: normalizeSize(8),
    fontFamily: "Comfortaa_700Bold",
  },
  plusButton: {
    borderRadius: normalizeSize(50),
    padding: normalizeSize(8),
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: normalizeSize(80),
    paddingTop: normalizeSize(10),
  },
  sectionTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginVertical: normalizeSize(12),
  },
  noChallenges: {
    fontSize: normalizeSize(18),
    textAlign: "center",
    marginVertical: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: normalizeSize(12),
  },
  dot: {
    width: normalizeSize(8),
    height: normalizeSize(8),
    borderRadius: normalizeSize(4),
    marginHorizontal: normalizeSize(6),
  },
  kpiStrip: {
    marginTop: normalizeSize(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(999),
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  kpiText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
  },
  progressTrack: {
    height: normalizeSize(8),
    borderRadius: normalizeSize(999),
    overflow: "hidden",
    marginTop: normalizeSize(8),
    marginHorizontal: SPACING,
  },
  progressFill: {
    height: "100%",
    borderRadius: normalizeSize(999),
  },
  progressLabel: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
    textAlign: "right",
    marginTop: normalizeSize(6),
    marginRight: SPACING,
  },
  topCarouselContainer: {
    marginBottom: normalizeSize(20),
  },
  topItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  topItemContainer: {
    width: TOP_ITEM_WIDTH,
    height: TOP_ITEM_HEIGHT,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  topItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
    overflow: "hidden",
  },
  topItemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  topItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: normalizeSize(12),
    alignItems: "center",
  },
  topItemTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  topItemParticipants: {
    fontSize: normalizeSize(14),
    marginTop: normalizeSize(6),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  markTodayButton: {
    marginTop: normalizeSize(12),
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(16),
    borderRadius: normalizeSize(18),
    alignSelf: "center",
  },
  markTodayButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
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
  bottomCarouselContainer: {
    marginBottom: normalizeSize(30),
  },
  bottomItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  bottomItemContainer: {
    width: BOTTOM_ITEM_WIDTH,
    height: BOTTOM_ITEM_HEIGHT,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  bottomItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
    overflow: "hidden",
  },
  bottomItemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bottomItemOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: normalizeSize(10),
    alignItems: "center",
  },
  bottomItemTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomItemParticipants: {
    fontSize: normalizeSize(12),
    marginTop: normalizeSize(6),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    marginTop: normalizeSize(8),
    fontSize: normalizeSize(12),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  emptyTopContainer: {
    height: TOP_ITEM_HEIGHT + normalizeSize(30),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
    borderRadius: normalizeSize(25),
  },
  emptyTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(6),
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  emptyList: {
    alignSelf: "center",
    marginTop: normalizeSize(8),
  },
  emptyItem: {
    fontSize: normalizeSize(16),
    marginBottom: normalizeSize(4),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  linkText: {
    textDecorationLine: "underline",
    fontFamily: "Comfortaa_700Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  quickActions: {
    flexDirection: "row",
    gap: normalizeSize(10),
    paddingHorizontal: SPACING,
    marginTop: normalizeSize(10),
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: normalizeSize(999),
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(14),
  },
  actionBtnText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
  },
  actionBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: normalizeSize(999),
    paddingVertical: normalizeSize(8),
    paddingHorizontal: normalizeSize(14),
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  actionBtnGhostText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  // —— Focus modal —— 
  focusBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING,
  },
  focusCard: {
    width: Math.min(SCREEN_WIDTH * 0.9, 420),
    borderRadius: normalizeSize(24),
    borderWidth: 1,
    padding: normalizeSize(20),
    alignItems: "center",
  },
  focusLabel: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
    letterSpacing: 1.2,
  },
  focusTimer: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(64),
    marginTop: normalizeSize(6),
  },
  focusButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(10),
    marginTop: normalizeSize(14),
  },
  focusPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(14),
  },
  focusPrimaryText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
  },
  focusSecondary: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(14),
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  focusHint: {
    marginTop: normalizeSize(10),
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
    textAlign: "center",
  },
  blurView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: normalizeSize(25),
    padding: normalizeSize(20),
    width: SCREEN_WIDTH * 0.8,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: normalizeSize(24),
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginBottom: normalizeSize(12),
    textAlign: "center",
  },
  modalDescription: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    color: "#333333",
    textAlign: "center",
    marginBottom: normalizeSize(20),
  },
  nextButton: {
    position: "absolute",
    bottom: normalizeSize(20),
    right: normalizeSize(20),
  },
});
