import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  AccessibilityInfo,
  Dimensions,
  BackHandler,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native"; // 🆕
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
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
const IMG_BLURHASH = "LEHLk~WB2yk8pyo0adR*.7kCMdnj";

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const normalizeSize = (size: number) => {
  const { width } = Dimensions.get("window");
  const base = 375;
  const scale = clamp(width / base, 0.82, 1.35);
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

interface CurrentChallengeExtended {
  id: string;
  title: string;
  challengeId?: string;
  docId?: string;
  chatId?: string;
  imageUrl?: string;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: any;
  participants?: number;
  category?: string;
  description?: string;
  uniqueKey?: string;
}

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isMarkedToday = (lastMarkedRaw: any): boolean => {
  if (!lastMarkedRaw) return false;

  let d: Date | null = null;

  if (lastMarkedRaw?.toDate && typeof lastMarkedRaw.toDate === "function") {
    d = lastMarkedRaw.toDate();
  } else if (lastMarkedRaw instanceof Date) {
    d = lastMarkedRaw;
  } else if (typeof lastMarkedRaw === "string") {
    const parsed = new Date(lastMarkedRaw);
    if (!isNaN(parsed.getTime())) d = parsed;
  } else if (
    typeof lastMarkedRaw === "object" &&
    typeof lastMarkedRaw.seconds === "number"
  ) {
    d = new Date(lastMarkedRaw.seconds * 1000);
  }

  if (!d) return false;
  const now = new Date();
  return isSameCalendarDay(d, now);
};

type IntervalId = ReturnType<typeof setInterval>;
type TimeoutId = ReturnType<typeof setTimeout>;

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
  const { width: W, height: H } = useWindowDimensions();

  const IS_TINY = W < 360;
  const IS_TABLET = W >= 700;

  // largeur “safe” des sections (Apple keynote = jamais full edge sur grand écran)
  const CONTENT_W = useMemo(() => {
    const side = IS_TABLET ? 28 : 18;
    return Math.min(W - side * 2, IS_TABLET ? 620 : 520);
  }, [W, IS_TABLET]);

  const topItemW = useMemo(() => Math.round(CONTENT_W * (IS_TABLET ? 0.74 : 0.86)), [CONTENT_W, IS_TABLET]);
  const bottomItemW = useMemo(() => Math.round(CONTENT_W * (IS_TABLET ? 0.58 : 0.68)), [CONTENT_W, IS_TABLET]);
  const topItemH = useMemo(() => Math.round(clamp(H * 0.33, 240, IS_TABLET ? 320 : 300)), [H, IS_TABLET]);
  const bottomItemH = useMemo(() => Math.round(clamp(H * 0.22, 170, IS_TABLET ? 230 : 210)), [H, IS_TABLET]);

  const EFFECTIVE_TOP_ITEM_WIDTH = topItemW + SPACING;
  const EFFECTIVE_BOTTOM_ITEM_WIDTH = bottomItemW + SPACING;
  const SPACER_TOP = Math.max(0, (W - topItemW) / 2);
  const SPACER_BOTTOM = Math.max(0, (W - bottomItemW) / 2);

  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [isLoading, setIsLoading] = useState(true);
  const [userTrophies, setUserTrophies] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [locallyMarkedKeys, setLocallyMarkedKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  // Focus timer (Pomodoro)
  const [focusVisible, setFocusVisible] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusLabel, setFocusLabel] = useState<"FOCUS" | "BREAK">("FOCUS");

  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(focusMinutes * 60);
  const savedFocusSecondsRef = useRef<number | null>(null);

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

  // ✅ Respect Reduce Motion (haptics)
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      // @ts-ignore compat RN
      sub?.remove?.();
    };
  }, []);

    const uniqueChallenges = useMemo(
    () =>
      Array.from(
        new Map(
          currentChallenges.map((ch: any) => [
            ch.uniqueKey || ch.id,
            ch,
          ])
        ).values()
      ) as CurrentChallengeExtended[],
    [currentChallenges]
  );

  const translatedChallenges = useMemo(
    () =>
      uniqueChallenges.map((item) => {
        const key = item.chatId || item.id;
        return {
          ...item,
          title: t(`challenges.${key}.title`, { defaultValue: item.title }),
          description: t(`challenges.${key}.description`, {
            defaultValue: item.description || "",
          }),
          category: item.category
            ? t(`categories.${item.category}`, {
                defaultValue: item.category,
              })
            : t("miscellaneous"),
        };
      }),
    [uniqueChallenges, t]
  );

  const enrichedChallenges = useMemo(
    () =>
      translatedChallenges.map((item) => ({
        ...item,
        docId: (item as any).challengeId || item.chatId || item.id,
      })),
    [translatedChallenges]
  );

  const notMarkedToday = useMemo(
    () =>
      enrichedChallenges.filter((ch) => !isMarkedToday(ch.lastMarkedDate)),
    [enrichedChallenges]
  );

  const markedToday = useMemo(
    () =>
      enrichedChallenges.filter((ch) => isMarkedToday(ch.lastMarkedDate)),
    [enrichedChallenges]
  );


 const kpis = useMemo(() => {
    const remaining = notMarkedToday.length;
    const completed = markedToday.length;
    const total = enrichedChallenges.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { remaining, completed, total, pct };
  }, [notMarkedToday.length, markedToday.length, enrichedChallenges.length]);

  const hasAnyChallenge = useMemo(
    () => enrichedChallenges.length > 0,
    [enrichedChallenges.length]
  ); // 🆕

  const pctLabel = useMemo(
    () => `${kpis.completed}/${kpis.total} • ${kpis.pct}%`,
    [kpis.completed, kpis.total, kpis.pct]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  }, []);

  // ✅ Action: marquer aujourd'hui (toast + confetti + haptics)
  const safeMarkToday = useCallback(
    async (item: CurrentChallengeExtended) => {
      const key = item.uniqueKey || `${item.id}_${item.selectedDays}`;
      if (markingKey === key) return;
      if (isMarkedToday(item.lastMarkedDate) || locallyMarkedKeys.has(key)) return;

      setMarkingKey(key);
      try {
        if (!reduceMotion) {
          Haptics.selectionAsync().catch(() => {});
        }

        const res = await markToday(item.id, item.selectedDays);

        setLocallyMarkedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });

        setTimeout(() => confettiRef.current?.start?.(), 100);
      } catch (e) {
        console.error("❌ Focus markToday error:", e);

        setLocallyMarkedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } finally {
        setMarkingKey(null);
      }
    },
    [markToday, markingKey, locallyMarkedKeys, reduceMotion, t]
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

          if (focusLabel === "BREAK") {
            if (savedFocusSecondsRef.current != null) {
              const remaining = savedFocusSecondsRef.current;
              savedFocusSecondsRef.current = null;
              setFocusLabel("FOCUS");
              setFocusSecondsLeft(remaining);
              setFocusRunning(true);
              return remaining;
            }

            setFocusLabel("FOCUS");
            const nextFocus = focusMinutes * 60;
            setFocusSecondsLeft(nextFocus);
            setFocusRunning(true);
            return nextFocus;
          }

          setFocusLabel("BREAK");
          const nextBreak = breakMinutes * 60;
          setFocusSecondsLeft(nextBreak);
          setFocusRunning(true);
          return nextBreak;
        }

        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [focusRunning, focusLabel, focusMinutes, breakMinutes]);

  const openFocus = useCallback(() => {
    savedFocusSecondsRef.current = null;
    setFocusVisible(true);
    setFocusLabel("FOCUS");
    setFocusSecondsLeft(focusMinutes * 60);
    setFocusRunning(false);
  }, [focusMinutes]);

  const resetFocus = useCallback(() => {
    savedFocusSecondsRef.current = null;
    setFocusRunning(false);
    setFocusLabel("FOCUS");
    setFocusSecondsLeft(focusMinutes * 60);
  }, [focusMinutes]);

  const closeFocus = useCallback(() => {
    setFocusVisible(false);
    setFocusRunning(false);
  }, []);

  const toggleFocus = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (focusLabel === "FOCUS" && focusRunning) {
      savedFocusSecondsRef.current = focusSecondsLeft;
      setFocusLabel("BREAK");
      setFocusSecondsLeft(breakMinutes * 60);
      setFocusRunning(true);
      return;
    }

    if (focusLabel === "BREAK" && focusRunning) {
      const remaining = savedFocusSecondsRef.current ?? focusMinutes * 60;
      savedFocusSecondsRef.current = null;
      setFocusLabel("FOCUS");
      setFocusSecondsLeft(remaining);
      setFocusRunning(false);
      return;
    }

    setFocusRunning((r) => !r);
  }, [focusLabel, focusRunning, focusSecondsLeft, breakMinutes, focusMinutes]);

  const formatTime = useCallback((total: number) => {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }, []);

   useFocusEffect(
    useCallback(() => {
      startTopAutoScroll();
      startBottomAutoScroll();

      return () => {
        if (topAutoScrollRef.current) {
          clearInterval(topAutoScrollRef.current);
          topAutoScrollRef.current = null;
        }
        if (bottomAutoScrollRef.current) {
          clearInterval(bottomAutoScrollRef.current);
          bottomAutoScrollRef.current = null;
        }
      };
    }, [startTopAutoScroll, startBottomAutoScroll])
  );

    useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // 1) Si le timer Focus est ouvert → on ferme le modal
        if (focusVisible) {
          closeFocus();
          return true;
        }

        // 2) Si le tuto est actif sur cette étape → on le skip
        if (isTutorialActive && tutorialStep === 3) {
          skipTutorial();
          return true;
        }

        // 3) Sinon on laisse le navigateur gérer le back
        return false;
      };

      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => sub.remove();
    }, [focusVisible, closeFocus, isTutorialActive, tutorialStep, skipTutorial])
  );


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

  const renderTopItem = ({
  item,
  index,
}: {
  item: CurrentChallengeExtended;
  index: number;
}) => {

    const key = item.uniqueKey || `${item.id}_${item.selectedDays}`;
    const marked =
      isMarkedToday(item.lastMarkedDate) || locallyMarkedKeys.has(key);
    const busy = markingKey === key;

    const participants =
      typeof item.participants === "number" && item.participants > 0
        ? item.participants
        : undefined;

    return (
      <RNAnimated.View
  style={[
    styles.topItemWrapper,
    !reduceMotion && {
      transform: [
        {
          scale: scrollXTop.interpolate({
            inputRange: [
              (index - 1) * EFFECTIVE_TOP_ITEM_WIDTH,
              index * EFFECTIVE_TOP_ITEM_WIDTH,
              (index + 1) * EFFECTIVE_TOP_ITEM_WIDTH,
            ],
            outputRange: [0.96, 1, 0.96],
            extrapolate: "clamp",
          }),
        },
      ],
    },
  ]}
>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.topItemContainer,
            {
              width: topItemW,
              height: topItemH,
              borderRadius: normalizeSize(IS_TABLET ? 28 : 26),
            },
          ]}
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
                borderRadius: normalizeSize(IS_TABLET ? 28 : 26),
                borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.55 : 0.45),
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
              style={[
                styles.topItemOverlay,
                { padding: normalizeSize(14) },
              ]}
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

              {participants && participants > 0 && (
                <Text
                  style={[
                    styles.topItemParticipants,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("participantsCount", {
                    count: participants,
                    defaultValue:
                      participants > 1
                        ? `${participants} participants`
                        : "1 participant",
                  })}
                </Text>
              )}
            </LinearGradient>
          </LinearGradient>
        </TouchableOpacity>

        {!marked && (
          <TouchableOpacity
            style={[
              styles.markTodayButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={() => safeMarkToday(item)}
            disabled={busy}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={t("markToday")}
            testID={`mark-today-${item.uniqueKey || item.id}`}
          >
            {busy ? (
              <ActivityIndicator color={isDarkMode ? "#000" : "#fff"} />
            ) : (
              <View style={styles.markTodayInner}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={normalizeSize(18)}
                  color={isDarkMode ? "#000" : "#0b1120"}
                />
                <Text
                  style={[
                    styles.markTodayButtonText,
                    { color: isDarkMode ? "#000" : "#0b1120" },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {t("markToday")}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </RNAnimated.View>
    );
  };

  const renderBottomItem = ({ item }: { item: CurrentChallengeExtended }) => {
    const participants =
      typeof item.participants === "number" && item.participants > 0
        ? item.participants
        : undefined;

    return (
      <RNAnimated.View style={styles.bottomItemWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.bottomItemContainer,
            {
              width: bottomItemW,
              height: bottomItemH,
              borderRadius: normalizeSize(IS_TABLET ? 26 : 24),
            },
          ]}
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
                borderRadius: normalizeSize(IS_TABLET ? 26 : 24),
                borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.50 : 0.42),
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

              {participants && participants > 0 && (
                <Text
                  style={[
                    styles.bottomItemParticipants,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("participantsCount", {
                    count: participants,
                    defaultValue:
                      participants > 1
                        ? `${participants} participants`
                        : "1 participant",
                  })}
                </Text>
              )}
            </LinearGradient>
          </LinearGradient>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  };

   const renderTop = useCallback(
    renderTopItem,
    [currentTheme, isDarkMode, safeMarkToday, locallyMarkedKeys, markingKey]
  );

  const renderBottom = useCallback(
    renderBottomItem,
    [currentTheme, isDarkMode]
  );


  const getTopLayout = useCallback(
    (_: any, index: number) => ({
      length: EFFECTIVE_TOP_ITEM_WIDTH,
      offset: EFFECTIVE_TOP_ITEM_WIDTH * index,
      index,
    }),
    [EFFECTIVE_TOP_ITEM_WIDTH]
  );
  const getBottomLayout = useCallback(
    (_: any, index: number) => ({
      length: EFFECTIVE_BOTTOM_ITEM_WIDTH,
      offset: EFFECTIVE_BOTTOM_ITEM_WIDTH * index,
      index,
    }),
    [EFFECTIVE_BOTTOM_ITEM_WIDTH]
  );

  const primaryBtnLabel = useMemo(() => {
    if (focusLabel === "BREAK") {
      return focusRunning
        ? t("resumeFocus", { defaultValue: "Reprendre Focus" })
        : t("resumeBreak", { defaultValue: "Reprendre Pause" });
    }
    return focusRunning
      ? t("pause", { defaultValue: "Pause" })
      : t("start", { defaultValue: "Démarrer" });
  }, [focusLabel, focusRunning, t]);

  const primaryBtnIcon = useMemo(() => {
    if (focusLabel === "BREAK") {
      return "play-forward-circle-outline";
    }
    return focusRunning ? "pause-circle-outline" : "play-circle-outline";
  }, [focusLabel, focusRunning]);

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
        {/* BG orbs */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.primary, 0.28),
            "transparent",
          ]}
         style={[
            styles.bgOrbTop,
            {
              top: -W * 0.25,
              left: -W * 0.18,
              width: W * 0.92,
              height: W * 0.92,
              borderRadius: (W * 0.92) / 2,
            },
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.secondary, 0.25),
            "transparent",
          ]}
          style={[
            styles.bgOrbBottom,
            {
              bottom: -W * 0.30,
              right: -W * 0.22,
              width: W * 1.08,
              height: W * 1.08,
              borderRadius: (W * 1.08) / 2,
            },
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Hero (Apple keynote) */}
         <View style={[styles.headerWrapper, { paddingHorizontal: SPACING, maxWidth: CONTENT_W + SPACING * 2, alignSelf: "center", width: "100%" }]}>
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.60 : 0.92),
              withAlpha(currentTheme.colors.background, isDarkMode ? 0.40 : 0.86),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.heroCard,
              { borderColor: withAlpha(currentTheme.colors.border, isDarkMode ? 0.35 : 0.22) },
            ]}
          >
            {/* Top row */}
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                style={[
                  styles.trophyContainer,
                  {
                    backgroundColor: withAlpha(currentTheme.colors.background, isDarkMode ? 0.45 : 0.55),
                    borderColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.30 : 0.22),
                  },
                ]}
                onPress={() => router.push("/profile")}
                accessibilityRole="button"
                accessibilityLabel={t("openProfile")}
                testID="open-profile"
                activeOpacity={0.85}
              >
                <Ionicons
                  name="trophy-outline"
                  size={normalizeSize(20)}
                  color={currentTheme.colors.trophy}
                />
                <Text style={[styles.trophyText, { color: currentTheme.colors.trophy }]}>
                  {userTrophies}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.plusButton,
                  {
                    backgroundColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.95 : 0.92),
                    borderColor: withAlpha("#000", isDarkMode ? 0.22 : 0),
                  },
                ]}
                onPress={() => router.push("/create-challenge")}
                accessibilityRole="button"
                accessibilityLabel={t("createChallenge")}
                testID="create-challenge"
                activeOpacity={0.9}
              >
                <Ionicons
                  name="add"
                  size={normalizeSize(20)}
                  color={isDarkMode ? "#000" : "#0b1120"}
                />
              </TouchableOpacity>
            </View>

            {/* Title + KPI */}
            <View style={styles.heroTitleRow}>
              <View style={{ flex: 1 }}>
                <Text
    style={[
      styles.heroTitle,
      { color: isDarkMode ? currentTheme.colors.textPrimary : "#0b1120" },
    ]}
    numberOfLines={1}
  >
                  {t("focus", { defaultValue: "Focus" })}
                </Text>
                <Text
                  style={[styles.heroSub, { color: withAlpha(currentTheme.colors.textSecondary, 0.85) }]}
                  numberOfLines={2}
                >
                  {t("remainingToday", { defaultValue: "À faire aujourd’hui" })} : {kpis.remaining}
                </Text>
              </View>

              <View
                style={[
                  styles.heroPctPill,
                  { borderColor: withAlpha(currentTheme.colors.secondary, 0.45) },
                ]}
                accessibilityRole="summary"
              >
                <Text style={[styles.heroPctText, { color: currentTheme.colors.secondary }]}>
                  {kpis.pct}%
                </Text>
                <Text style={[styles.heroPctSub, { color: withAlpha(currentTheme.colors.textSecondary, 0.85) }]}>
                  {kpis.completed}/{kpis.total}
                </Text>
              </View>
            </View>

            <View style={{ height: normalizeSize(6) }} />

            {/* Progress */}
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: withAlpha(currentTheme.colors.textSecondary, isDarkMode ? 0.18 : 0.12) },
              ]}
              accessibilityRole="progressbar"
              accessibilityValue={{ now: kpis.pct, min: 0, max: 100 }}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${kpis.pct}%`, backgroundColor: currentTheme.colors.secondary },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: withAlpha(currentTheme.colors.textSecondary, 0.85) }]}>
              {pctLabel}
            </Text>

            <View style={{ height: normalizeSize(6) }} />

            {/* Quick actions (integrées dans le Hero) */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                onPress={openFocus}
                activeOpacity={0.9}
                style={[styles.actionBtn, { backgroundColor: currentTheme.colors.secondary }]}
                accessibilityRole="button"
                accessibilityLabel={t("startFocus", { defaultValue: `Lancer Focus ${focusMinutes}:00` })}
                testID="cta-start-focus"
              >
                <Ionicons name="timer-outline" size={normalizeSize(18)} color={isDarkMode ? "#000" : "#0b1120"} />
                <Text style={[styles.actionBtnText, { color: isDarkMode ? "#000" : "#0b1120" }]}>
                  {`${String(focusMinutes).padStart(2, "0")}:00 ${t("focusShort", { defaultValue: "Focus" })}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/explore")}
                activeOpacity={0.9}
                style={[
                  styles.actionBtnGhost,
                  { borderColor: withAlpha(currentTheme.colors.secondary, 0.55) },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("discoverChallenges", { defaultValue: "Découvrir des défis" })}
                testID="cta-discover"
              >
                <Ionicons name="compass-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
                <Text
                  style={[styles.actionBtnGhostText, { color: currentTheme.colors.secondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {t("discover", { defaultValue: "Découvrir" })}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
            <View style={[styles.sectionHeaderRow, { maxWidth: CONTENT_W + SPACING * 2, alignSelf: "center", width: "100%" }]}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" }]}>
                {t("dailyChallenges")}
              </Text>
              <View
                style={[
                  styles.sectionCountPill,
                  { borderColor: withAlpha(currentTheme.colors.border, 0.35) },
                ]}
              >
                <Text style={[styles.sectionCountText, { color: withAlpha(currentTheme.colors.textSecondary, 0.9) }]}>
                  {notMarkedToday.length}
                </Text>
              </View>
            </View>

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
                  contentContainerStyle={{
  paddingHorizontal: SPACER_TOP,
  paddingBottom: normalizeSize(8),
}}
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
                    height: topItemH + normalizeSize(34),
                    borderWidth: 1.5,
                    borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.55 : 0.45),
                    borderRadius: normalizeSize(IS_TABLET ? 28 : 26),
                    maxWidth: CONTENT_W,
                    alignSelf: "center",
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
            <View style={[styles.sectionHeaderRow, { maxWidth: CONTENT_W + SPACING * 2, alignSelf: "center", width: "100%" }]}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" }]}>
                {t("completedChallengesScreenTitle")} {t("today")}
              </Text>
              <View
                style={[
                  styles.sectionCountPill,
                  { borderColor: withAlpha(currentTheme.colors.border, 0.35) },
                ]}
              >
                <Text style={[styles.sectionCountText, { color: withAlpha(currentTheme.colors.textSecondary, 0.9) }]}>
                  {markedToday.length}
                </Text>
              </View>
            </View>

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
  paddingHorizontal: SPACER_TOP,
 paddingBottom: normalizeSize(6),
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

                    {/* Confettis (uniquement si au moins un challenge) */}
          {hasAnyChallenge && (
            <ConfettiCannon
              ref={confettiRef}
              autoStart={false}
              count={180}
               origin={{ x: W / 2, y: 0 }}
              fadeOut
              explosionSpeed={820}
              fallSpeed={3200}
            />
          )}

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
                  width: Math.min(W * 0.92, IS_TABLET ? 520 : 440),
                  backgroundColor: withAlpha(
                    currentTheme.colors.cardBackground,
                    0.96
                  ),
                  borderColor: currentTheme.colors.border,
                },
              ]}
            >
              {/* Durées Focus / Pause */}
              {!focusRunning && focusLabel === "FOCUS" && (
                <View style={styles.durationBlock}>
                  <Text
                    style={[
                      styles.durationTitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("focusDuration", { defaultValue: "Durée Focus" })}
                  </Text>

                  <View style={styles.durationRow}>
                    {[15, 25, 45, 60].map((m) => {
                      const active = focusMinutes === m;
                      return (
                        <TouchableOpacity
                          key={`focus-${m}`}
                          onPress={() => {
                            setFocusMinutes(m);
                            setFocusSecondsLeft(m * 60);
                          }}
                          style={[
                            styles.durationPill,
                            {
                              backgroundColor: active
                                ? currentTheme.colors.secondary
                                : isDarkMode
                                ? withAlpha(
                                    currentTheme.colors.cardBackground,
                                    0.6
                                  )
                                : "rgba(15, 23, 42, 0.06)",
                              borderColor: active
                                ? withAlpha(
                                    currentTheme.colors.secondary,
                                    0.9
                                  )
                                : withAlpha(
                                    currentTheme.colors.border,
                                    0.6
                                  ),
                            },
                          ]}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={`${m} minutes`}
                        >
                          <Text
                            style={[
                              styles.durationPillText,
                              {
                                color: active
                                  ? "#0b1120"
                                  : isDarkMode
                                  ? currentTheme.colors.textPrimary
                                  : "#0b1120",
                              },
                            ]}
                          >
                            {m}m
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.durationStepper}>
                    <TouchableOpacity
                      onPress={() => {
                        const next = Math.max(5, focusMinutes - 5);
                        setFocusMinutes(next);
                        setFocusSecondsLeft(next * 60);
                      }}
                      style={styles.stepBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t("decreaseTime", {
                        defaultValue: "Réduire le temps",
                      })}
                    >
                      <Ionicons
                        name="remove"
                        size={normalizeSize(18)}
                        color={currentTheme.colors.textPrimary}
                      />
                    </TouchableOpacity>

                    <Text
                      style={[
                        styles.stepValue,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {focusMinutes} min
                    </Text>

                    <TouchableOpacity
                      onPress={() => {
                        const next = Math.min(180, focusMinutes + 5);
                        setFocusMinutes(next);
                        setFocusSecondsLeft(next * 60);
                      }}
                      style={styles.stepBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t("increaseTime", {
                        defaultValue: "Augmenter le temps",
                      })}
                    >
                      <Ionicons
                        name="add"
                        size={normalizeSize(18)}
                        color={currentTheme.colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[
                      styles.durationTitle,
                      {
                        color: currentTheme.colors.textSecondary,
                        marginTop: normalizeSize(8),
                      },
                    ]}
                  >
                    {t("breakDuration", { defaultValue: "Durée Pause" })}
                  </Text>
                  <View style={styles.durationRow}>
                    {[3, 5, 10, 15].map((m) => {
                      const active = breakMinutes === m;
                      return (
                        <TouchableOpacity
                          key={`break-${m}`}
                          onPress={() => setBreakMinutes(m)}
                          style={[
                            styles.durationPill,
                            {
                              backgroundColor: active
                                ? currentTheme.colors.secondary
                                : isDarkMode
                                ? withAlpha(
                                    currentTheme.colors.cardBackground,
                                    0.6
                                  )
                                : "rgba(15, 23, 42, 0.06)",
                              borderColor: active
                                ? withAlpha(
                                    currentTheme.colors.trophy,
                                    0.9
                                  )
                                : withAlpha(
                                    currentTheme.colors.border,
                                    0.6
                                  ),
                            },
                          ]}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={`${m} minutes`}
                        >
                          <Text
                            style={[
                              styles.durationPillText,
                              {
                                color: active
                                  ? "#0b1120"
                                  : isDarkMode
                                  ? currentTheme.colors.textPrimary
                                  : "#0b1120",
                              },
                            ]}
                          >
                            {m}m
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

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

              {/* Cercle visuel pour améliorer le contraste du timer */}
              <View style={styles.focusTimerWrapper}>
                <View
                  style={[
                    styles.focusTimerCircle,
                    {
                      width: normalizeSize(IS_TINY ? 132 : 150),
                      height: normalizeSize(IS_TINY ? 132 : 150),
                      borderRadius: normalizeSize(IS_TINY ? 66 : 75),
                      borderColor: withAlpha(
                        currentTheme.colors.secondary,
                        0.45
                      ),
                      backgroundColor: withAlpha(
                        isDarkMode ? "#020617" : "#f9fafb",
                        0.94
                      ),
                    },
                  ]}
                >
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
                </View>
              </View>

              <View style={styles.focusButtons}>
                <TouchableOpacity
                  onPress={toggleFocus}
                  style={[
                    styles.focusPrimary,
                    { backgroundColor: currentTheme.colors.secondary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={primaryBtnLabel}
                  accessibilityHint={t("startFocus", {
                    defaultValue:
                      "Lancer ou mettre en pause le minuteur.",
                  })}
                >
                  <Ionicons
                    name={primaryBtnIcon as any}
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
                        color: isDarkMode
                          ? "#000000"
                          : currentTheme.colors.textPrimary,
                      },
                    ]}
                  >
                    {primaryBtnLabel}
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
   paddingTop: SPACING * 1.6,
   paddingBottom: normalizeSize(10),
   position: "relative",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroCard: {
    paddingVertical: normalizeSize(18), // au lieu de ~14 implicite
  paddingHorizontal: normalizeSize(16),
   width: "100%",
   borderRadius: normalizeSize(22),
   borderWidth: 1,
   padding: normalizeSize(14),
   overflow: "hidden",
   shadowColor: "#000",
   shadowOffset: { width: 0, height: normalizeSize(10) },
   shadowOpacity: 0.10,
   shadowRadius: normalizeSize(22),
   elevation: 5,
 },
 heroTopRow: {
   flexDirection: "row",
   alignItems: "center",
   justifyContent: "space-between",
 },
  trophyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
   paddingVertical: normalizeSize(8),
   borderRadius: normalizeSize(999),
   borderWidth: 1,
   gap: normalizeSize(6),
  },
  trophyText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  plusButton: {
     width: normalizeSize(42),
   height: normalizeSize(42),
   borderRadius: normalizeSize(21),
   alignItems: "center",
   justifyContent: "center",
   borderWidth: 1,
  },
  heroTitleRow: {
   flexDirection: "row",
   alignItems: "flex-end",
   justifyContent: "space-between",
   marginTop: normalizeSize(10),
   gap: normalizeSize(10),
 },
 heroTitle: {
   fontFamily: "Comfortaa_700Bold",
   fontSize: normalizeSize(20),
   letterSpacing: -0.2,
 },
 heroSub: {
   marginTop: normalizeSize(3),
   fontFamily: "Comfortaa_400Regular",
   fontSize: normalizeSize(12.5),
   lineHeight: normalizeSize(16),
 },
 heroPctPill: {
  minWidth: normalizeSize(64),
  paddingVertical: normalizeSize(6),
  paddingHorizontal: normalizeSize(10),
  borderRadius: 999,
  alignItems: "center",
   borderWidth: 1,
   justifyContent: "center",
   backgroundColor: "rgba(255,255,255,0.06)",
 },
 heroPctText: {
   fontFamily: "Comfortaa_700Bold",
   fontSize: normalizeSize(18),
 },
 heroPctSub: {
   fontFamily: "Comfortaa_400Regular",
   fontSize: normalizeSize(11),
  marginTop: -2,
 },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: normalizeSize(80),
    paddingTop: normalizeSize(8),
  },
  sectionTitle: {
    fontSize: normalizeSize(18),
 fontFamily: "Comfortaa_700Bold",
  letterSpacing: 0.2,
   textAlign: "left",
   marginVertical: 0,
  },
  sectionHeaderRow: {
   flexDirection: "row",
   alignItems: "center",
   justifyContent: "space-between",
   paddingHorizontal: SPACING,
   marginTop: normalizeSize(14),
   marginBottom: normalizeSize(10),
 },
 sectionCountPill: {
   minWidth: normalizeSize(34),
   height: normalizeSize(28),
   borderRadius: normalizeSize(14),
   borderWidth: 1,
   alignItems: "center",
   justifyContent: "center",
   paddingHorizontal: normalizeSize(10),
   backgroundColor: "rgba(255,255,255,0.06)",
 },
 sectionCountText: {
   fontFamily: "Comfortaa_700Bold",
   fontSize: normalizeSize(12.5),
   includeFontPadding: false,
   textAlignVertical: "center",
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
   marginTop: normalizeSize(10),
  },
  dot: {
    width: normalizeSize(6),
   height: normalizeSize(6),
   borderRadius: normalizeSize(999),
   marginHorizontal: normalizeSize(5),
  },
  durationBlock: {
    width: "100%",
    marginTop: normalizeSize(6),
    marginBottom: normalizeSize(12),
  },
  durationTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12.5),
    textAlign: "center",
    marginBottom: normalizeSize(6),
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: normalizeSize(8),
    justifyContent: "center",
    marginBottom: normalizeSize(8),
  },
  durationPill: {
    paddingVertical: normalizeSize(6),
    paddingHorizontal: normalizeSize(12),
    borderRadius: 999,
    borderWidth: 1,
  },
  durationPillText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12.5),
  },
  durationStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalizeSize(12),
    marginBottom: normalizeSize(6),
  },
  stepBtn: {
    width: normalizeSize(36),
    height: normalizeSize(36),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  stepValue: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
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
    height: normalizeSize(10),
    borderRadius: normalizeSize(999),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  progressFill: {
    height: "100%",
    borderRadius: normalizeSize(999),
  },
  progressLabel: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
    textAlign: "left",
   marginTop: normalizeSize(8),
  },
  topCarouselContainer: {
    marginBottom: normalizeSize(20),
  },
  topItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  topItemContainer: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(12) },
  shadowOpacity: 0.16,
   shadowRadius: normalizeSize(22),
   elevation: 9,
  },
  topItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(26),
   borderWidth: 1.2,
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
    padding: normalizeSize(14),
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
   paddingHorizontal: normalizeSize(14),
   borderRadius: normalizeSize(999),
    alignSelf: "center",
    shadowColor: "#000",
   shadowOffset: { width: 0, height: 8 },
   shadowOpacity: 0.18,
   shadowRadius: 12,
   elevation: 10,
  },
  markTodayButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
  },
  markTodayInner: {
   flexDirection: "row",
   alignItems: "center",
   justifyContent: "center",
   gap: normalizeSize(8),
 },
  bgOrbTop: {
    position: "absolute",
  },
  bgOrbBottom: {
    position: "absolute",
  },
  bottomCarouselContainer: {
    marginBottom: normalizeSize(30),
  },
  bottomItemWrapper: {
    marginHorizontal: SPACING / 2,
    alignItems: "center",
  },
  bottomItemContainer: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(10) },
   shadowOpacity: 0.14,
   shadowRadius: normalizeSize(20),
   elevation: 8,
  },
  bottomItemGradient: {
    flex: 1,
    borderRadius: normalizeSize(24),
   borderWidth: 1.1,
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
   borderRadius: normalizeSize(26),
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
    maxWidth: "75%",
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
  justifyContent: "space-between",         // 🆕 centre horizontalement la rangée
  alignItems: "center",              // 🆕 verticalement propre
  gap: normalizeSize(10),
  marginTop: normalizeSize(12),
  flexWrap: "wrap",                  // 🆕 si l’écran est petit, ça passe sur 2 lignes proprement
},
  actionBtn: {
    flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: normalizeSize(6),
  paddingVertical: normalizeSize(12),
  borderRadius: normalizeSize(16),
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
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
    flexShrink: 1,  
  },
  actionBtnGhostText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  flexShrink: 1,                 // 🆕 le texte se compresse au lieu de déborder
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
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING,
  },
  focusCard: {
    borderRadius: normalizeSize(24),
    borderWidth: 1,
    padding: normalizeSize(20),
    alignItems: "center",
    shadowColor: "#000",
   shadowOffset: { width: 0, height: 14 },
   shadowOpacity: 0.28,
   shadowRadius: 20,
   elevation: 18,
  },
  focusLabel: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
    letterSpacing: 1.2,
  },
  focusTimerWrapper: {
    marginTop: normalizeSize(8),
    marginBottom: normalizeSize(4),
  },
  focusTimerCircle: {
    width: normalizeSize(150),
    height: normalizeSize(150),
    borderRadius: normalizeSize(75),
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
  },
  focusTimer: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(40),
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
   width: "80%",
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
