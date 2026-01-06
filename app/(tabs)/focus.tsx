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
  AccessibilityInfo,
  BackHandler,   
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

type ToastType = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
};

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

  // —— TOAST PREMIUM —— //
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });
  const toastTimeoutRef = useRef<TimeoutId | null>(null);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      if (!reduceMotion) {
        if (type === "error") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
        } else if (type === "success") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        } else {
          Haptics.selectionAsync().catch(() => {});
        }
      }

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      setToast({
        visible: true,
        type,
        title,
        message,
      });

      toastTimeoutRef.current = setTimeout(() => {
        hideToast();
      }, 3500);
    },
    [hideToast, reduceMotion]
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

        if (res?.success !== false) {
          if (!reduceMotion) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            ).catch(() => {});
          }

          showToast(
            "success",
            t("dayValidatedTitle", { defaultValue: "Bien joué 🎉" }),
            t("dayValidatedBody", {
              defaultValue: "Ta progression a bien été enregistrée pour aujourd’hui.",
            })
          );
        }

        setTimeout(() => confettiRef.current?.start?.(), 100);
      } catch (e) {
        console.error("❌ Focus markToday error:", e);

        showToast(
          "error",
          t("error", { defaultValue: "Erreur" }),
          t("markTodayFailed", {
            defaultValue: "Impossible d’enregistrer aujourd’hui. Réessaie dans un instant.",
          })
        );

        setLocallyMarkedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } finally {
        setMarkingKey(null);
      }
    },
    [markToday, markingKey, locallyMarkedKeys, reduceMotion, t, showToast]
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

  const renderTopItem = ({ item }: { item: CurrentChallengeExtended }) => {
    const key = item.uniqueKey || `${item.id}_${item.selectedDays}`;
    const marked =
      isMarkedToday(item.lastMarkedDate) || locallyMarkedKeys.has(key);
    const busy = markingKey === key;

    const participants =
      typeof item.participants === "number" && item.participants > 0
        ? item.participants
        : undefined;

    return (
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
              <Text
                style={[
                  styles.markTodayButtonText,
                  {
                    color: isDarkMode
                      ? "#000000"
                      : currentTheme.colors.textPrimary,
                  },
                ]}
              >
                {t("markToday")}
              </Text>
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

  const toastBg = (() => {
    switch (toast.type) {
      case "success":
        return withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.95 : 0.9);
      case "error":
        return withAlpha("#ef4444", 0.96);
      case "info":
      default:
        return withAlpha(currentTheme.colors.cardBackground, 0.98);
    }
  })();

  const toastIconName = (() => {
    switch (toast.type) {
      case "success":
        return "checkmark-circle-outline";
      case "error":
        return "alert-circle-outline";
      case "info":
      default:
        return "information-circle-outline";
    }
  })();

  const toastIconColor = (() => {
    switch (toast.type) {
      case "success":
        return isDarkMode ? "#022c22" : "#064e3b";
      case "error":
        return isDarkMode ? "#450a0a" : "#7f1d1d";
      case "info":
      default:
        return isDarkMode ? "#0f172a" : "#0f172a";
    }
  })();

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

        {/* TOAST GLOBAL */}
        {toast.visible && (
          <View pointerEvents="box-none" style={styles.toastWrapper}>
            <Animated.View
              entering={FadeInUp.duration(220)}
              style={[
                styles.toastContainer,
                {
                  backgroundColor: toastBg,
                  borderColor: withAlpha(currentTheme.colors.border, 0.35),
                },
              ]}
              accessibilityLiveRegion="polite"
              accessible
            >
              <View style={styles.toastIconWrapper}>
                <Ionicons
                  name={toastIconName as any}
                  size={normalizeSize(20)}
                  color={toastIconColor}
                />
              </View>
              <View style={styles.toastTextWrapper}>
                <Text
                  style={[
                    styles.toastTitle,
                    {
                      color:
                        toast.type === "error"
                          ? "#fef2f2"
                          : isDarkMode
                          ? currentTheme.colors.textPrimary
                          : "#020617",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {toast.title}
                </Text>
                {!!toast.message && (
                  <Text
                    style={[
                      styles.toastMessage,
                      {
                        color:
                          toast.type === "error"
                            ? "#fee2e2"
                            : isDarkMode
                            ? currentTheme.colors.textSecondary
                            : "#1e293b",
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {toast.message}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={hideToast}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t("close", { defaultValue: "Fermer" })}
              >
                <Ionicons
                  name="close-outline"
                  size={normalizeSize(20)}
                  color={
                    isDarkMode
                      ? currentTheme.colors.textSecondary
                      : "#0f172a"
                  }
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

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
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : currentTheme.colors.secondary,
                  },
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
              defaultValue: `Lancer Focus ${focusMinutes}:00`,
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
  {`${String(focusMinutes).padStart(2, "0")}:00 ${t("focusShort", {
    defaultValue: "Focus",
  })}`}
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
              numberOfLines={1}              // 🆕
    adjustsFontSizeToFit           // 🆕
    minimumFontScale={0.75} 
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

                    {/* Confettis (uniquement si au moins un challenge) */}
          {hasAnyChallenge && (
            <ConfettiCannon
              ref={confettiRef}
              autoStart={false}
              count={180}
              origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
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
  justifyContent: "center",          // 🆕 centre horizontalement la rangée
  alignItems: "center",              // 🆕 verticalement propre
  gap: normalizeSize(10),
  paddingHorizontal: SPACING,
  marginTop: normalizeSize(10),
  flexWrap: "wrap",                  // 🆕 si l’écran est petit, ça passe sur 2 lignes proprement
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
  // —— Toast —— //
  toastWrapper: {
    position: "absolute",
    top: normalizeSize(40),
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(999),
    maxWidth: SCREEN_WIDTH * 0.92,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
    borderWidth: 1,
  },
  toastIconWrapper: {
    width: normalizeSize(26),
    height: normalizeSize(26),
    borderRadius: normalizeSize(13),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.08)",
    marginRight: normalizeSize(10),
  },
  toastTextWrapper: {
    flexShrink: 1,
    marginRight: normalizeSize(6),
  },
  toastTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
  },
  toastMessage: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(11.5),
    marginTop: normalizeSize(2),
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
