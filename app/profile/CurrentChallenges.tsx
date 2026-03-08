import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  AccessibilityInfo,
  I18nManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, {
  FadeInUp,
  FadeOutRight,
  ZoomIn,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { Image as ExpoImage } from "expo-image";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.92;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.44;
const ROW_HEIGHT = ITEM_HEIGHT + SPACING * 1.5;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const getItemLayoutConst = (_: any, index: number) => ({
  length: normalizeSize(ROW_HEIGHT),
  offset: normalizeSize(ROW_HEIGHT) * index,
  index,
});

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

interface Challenge {
  id: string;
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  day?: number;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
  duo?: boolean;
  duoPartnerId?: string;
  duoPartnerUsername?: string;
  uniqueKey?: string;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { currentChallenges, markToday, removeChallenge, isMarkedToday } =
    useCurrentChallenges();

  const [isLoading, setIsLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const confettiRef = useRef<ConfettiCannon>(null);
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [gainKey, setGainKey] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tabBarHeight = useTabBarHeightSafe();
  const [adHeight, setAdHeight] = useState(0);

  // ✅ FIX iOS — swipe → tap non intentionnel
  // Quand le Swipeable s'ouvre/ferme, on bloque onPress pendant 350ms
  // pour éviter que le relâchement du doigt soit capturé comme un tap.
  const swipingRef = useRef(false);
  const swipeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomPadding = useMemo(
    () =>
      normalizeSize(90) +
      (showBanners ? adHeight : 0) +
      tabBarHeight +
      insets.bottom,
    [adHeight, showBanners, tabBarHeight, insets.bottom]
  );

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  // 🔊 Sons de gain
  const gainWhooshRef = useRef<Audio.Sound | null>(null);
  const gainDingRef = useRef<Audio.Sound | null>(null);
  const gainSparkleRef = useRef<Audio.Sound | null>(null);
  const isPlayingFxRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1,
          interruptionModeIOS: 1,
        });
        const [{ sound: w }, { sound: d }, { sound: sp }] = await Promise.all([
          Audio.Sound.createAsync(
            require("../../assets/music/gain_whoosh.wav"),
            { shouldPlay: false }
          ),
          Audio.Sound.createAsync(
            require("../../assets/music/gain_ding.wav"),
            { shouldPlay: false }
          ),
          Audio.Sound.createAsync(
            require("../../assets/music/gain_sparkle.wav"),
            { shouldPlay: false }
          ),
        ]);
        if (mounted) {
          gainWhooshRef.current = w;
          gainDingRef.current = d;
          gainSparkleRef.current = sp;
          await gainWhooshRef.current.setVolumeAsync(0.55);
          await gainDingRef.current.setVolumeAsync(0.8);
          await gainSparkleRef.current.setVolumeAsync(0.65);
        }
      } catch {
        // Pas de fichier ? On ignore.
      }
    })();
    return () => {
      mounted = false;
      gainWhooshRef.current?.unloadAsync().catch(() => {});
      gainDingRef.current?.unloadAsync().catch(() => {});
      gainSparkleRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ✅ Respect Reduce Motion
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

  // Nettoyage timeout swipe au démontage
  useEffect(() => {
    return () => {
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
    };
  }, []);

  // 🎵 Stack audio premium (whoosh → ding → sparkle)
  const playSuccessFx = useCallback(async () => {
    if (isPlayingFxRef.current) return;
    try {
      isPlayingFxRef.current = true;
      if (!reduceMotion) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
      await gainWhooshRef.current?.replayAsync();
      setTimeout(() => {
        gainDingRef.current?.replayAsync().catch(() => {});
      }, 90);
      setTimeout(() => {
        gainSparkleRef.current?.replayAsync().catch(() => {});
      }, 180);
    } finally {
      setTimeout(() => {
        isPlayingFxRef.current = false;
      }, 380);
    }
  }, [reduceMotion]);

  // Challenges localisés + dédupliqués
  const translatedChallenges = useMemo(() => {
    if (!currentChallenges || !Array.isArray(currentChallenges)) {
      return [];
    }
    const validChallenges = currentChallenges.filter((item: any) => item.id);
    const uniqueChallenges = Array.from(
      new Map(
        validChallenges.map((item: any) => [
          item.uniqueKey || `${item.id}_${item.selectedDays}`,
          item,
        ])
      ).values()
    ) as Challenge[];
    return uniqueChallenges.map((item) => ({
      ...item,
      title: item.chatId
        ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
        : item.title,
      description: item.chatId
        ? t(`challenges.${item.chatId}.description`, {
            defaultValue: item.description || "",
          })
        : item.description || "",
      category: item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("miscellaneous"),
    }));
  }, [currentChallenges, i18n.language, t]);

  useEffect(() => {
    setLocalChallenges(translatedChallenges);
    setIsLoading(false);
  }, [translatedChallenges]);

  // 🎯 Animation Reanimated pour le "+1🏆"
  const gainOpacity = useSharedValue(0);
  const gainY = useSharedValue(0);
  const gainStyle = useAnimatedStyle(() => ({
    opacity: gainOpacity.value,
    transform: [{ translateY: gainY.value }],
  }));

  // 💣 Confirmation abandon challenge
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    selectedDays: number;
    index: number;
    title?: string;
  } | null>(null);

  const handleMarkToday = useCallback(
    async (id: string, selectedDays: number) => {
      const key = `${id}_${selectedDays}`;
      if (markingId) return;
      try {
        setMarkingId(key);
        const result = await markToday(id, selectedDays);
        if (result?.success) {
          setConfettiActive(true);
          await playSuccessFx();
          setGainKey(key);
          gainOpacity.value = withSequence(
            withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
          );
          gainY.value = withSequence(
            withTiming(-25, {
              duration: 400,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) })
          );
          setTimeout(() => setGainKey(null), 900);
        }
      } catch (err) {
        console.error("Erreur markToday:", err);
        if (!reduceMotion) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          ).catch(() => {});
        }
      } finally {
        setMarkingId(null);
      }
    },
    [markToday, t, markingId, playSuccessFx, gainOpacity, gainY, reduceMotion]
  );

  // Tokens design adaptatifs dark/light
  const chipBg = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const chipBorder = isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
  const chipText = isDarkMode ? "rgba(255,255,255,0.92)" : "#0B0B10";

  const handleRemove = useCallback(
    (id: string, selectedDays: number, index: number, title?: string) => {
      setPendingRemoval({ id, selectedDays, index, title });
      if (!reduceMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    },
    [reduceMotion]
  );

  const confirmRemove = useCallback(async () => {
    if (!pendingRemoval) return;
    const { id, selectedDays, index } = pendingRemoval;
    try {
      setLocalChallenges((prev) =>
        prev.filter((c) => !(c.id === id && c.selectedDays === selectedDays))
      );
      await removeChallenge(id, selectedDays);
      swipeableRefs.current[index]?.close();
    } catch (err) {
      console.error("Erreur removeChallenge:", err);
      swipeableRefs.current[index]?.close();
    } finally {
      setPendingRemoval(null);
    }
  }, [pendingRemoval, removeChallenge]);

  const cancelRemove = useCallback(() => {
    if (pendingRemoval) {
      const { index } = pendingRemoval;
      swipeableRefs.current[index]?.close();
    }
    setPendingRemoval(null);
  }, [pendingRemoval]);

  const renderRightActions = useCallback(
    (item: Challenge, index: number) => (
      <View style={styles.swipeActionsContainer} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.trashButton}
          onPress={() =>
            handleRemove(item.id, item.selectedDays, index, item.title)
          }
          accessible
          accessibilityRole="button"
          accessibilityLabel={String(t("deleteChallenge"))}
          accessibilityHint={String(t("confirmDeletionHint"))}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <LinearGradient
            colors={["#F43F5E", "#DC2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="trash-outline" size={normalizeSize(26)} color="#fff" />
          <Text style={styles.trashLabel}>{t("delete")}</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleRemove, t]
  );

  const navigateToDetail = useCallback(
    (item: Challenge) => {
      // ✅ FIX iOS swipe → tap : on bloque la navigation si un swipe
      // vient de se terminer (flag actif 350ms après la fin du gesture)
      if (swipingRef.current) return;

      const titleParam = encodeURIComponent(item.title);
      const catParam = encodeURIComponent(item.category || "");
      const descParam = encodeURIComponent(item.description || "");
      const imgParam = encodeURIComponent(item.imageUrl || "");
      const route = `/challenge-details/${encodeURIComponent(
        item.id
      )}?title=${titleParam}&selectedDays=${item.selectedDays}&completedDays=${
        item.completedDays
      }&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;
      Haptics.selectionAsync()
        .catch(() => {})
        .finally(() => router.push(route));
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => {
      const key = item.uniqueKey || `${item.id}_${item.selectedDays}`;
      const marked = isMarkedToday(item.id, item.selectedDays);
      const progress = Math.max(
        0,
        Math.min(
          1,
          (item.completedDays || 0) / Math.max(1, item.selectedDays || 1)
        )
      );
      const percentLabel = `${Math.round(progress * 100)}%`;
      const isDuo = !!item.duo;
      const partnerName = item.duoPartnerUsername;

      const borderColor = isDarkMode
        ? withAlpha("#FFFFFF", 0.14)
        : withAlpha("#000000", 0.08);

      const ringGrad = isDarkMode
        ? (["rgba(255,255,255,0.20)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.12)"] as const)
        : (["rgba(0,0,0,0.12)", "rgba(0,0,0,0.03)", "rgba(0,0,0,0.08)"] as const);

      const animatedStyle = {
        transform: [{ scale: marked ? 0.98 : 1 }],
        opacity: marked ? 0.9 : 1,
      };

      return (
        <Animated.View
          entering={ZoomIn.delay(index * 40).easing(Easing.out(Easing.exp))}
          exiting={FadeOutRight.duration(250)}
          style={[styles.cardWrapper, animatedStyle]}
        >
          <View
            accessibilityLabel={`${t("challengeS")} ${item.title}, ${t(
              "swipeToDelete"
            )}`}
            testID={`challenge-swipe-${key}`}
          >
            <Swipeable
              ref={(ref: any) => {
                swipeableRefs.current[index] = ref;
              }}
              renderRightActions={() => renderRightActions(item, index)}
              overshootRight={false}
              // ✅ FIX iOS : on lève le flag dès que le gesture commence
              // à ouvrir ou fermer — et on le maintient 350ms après
              // la fin pour absorber le tap fantôme du relâchement.
              onSwipeableWillOpen={() => {
                swipingRef.current = true;
                if (swipeTimeoutRef.current)
                  clearTimeout(swipeTimeoutRef.current);
              }}
              onSwipeableOpen={() => {
                if (!reduceMotion) {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                }
                swipeTimeoutRef.current = setTimeout(() => {
                  swipingRef.current = false;
                }, 350);
              }}
              onSwipeableWillClose={() => {
                swipingRef.current = true;
                if (swipeTimeoutRef.current)
                  clearTimeout(swipeTimeoutRef.current);
              }}
              onSwipeableClose={() => {
                swipeTimeoutRef.current = setTimeout(() => {
                  swipingRef.current = false;
                }, 350);
              }}
            >
              <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => navigateToDetail(item)}
                activeOpacity={0.92}
                accessibilityLabel={String(
                  t("viewChallengeDetails", { title: item.title })
                )}
                accessibilityHint={String(t("viewDetails"))}
                accessibilityRole="button"
                testID={`challenge-card-${key}`}
              >
                {/* ── Ring gradient (bordure subtile premium) ── */}
                <LinearGradient
                  colors={ringGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardRing}
                >
                  {/* Halo coloré positionné coin haut-droit */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.cardHalo,
                      {
                        backgroundColor: withAlpha(
                          currentTheme.colors.primary,
                          isDarkMode ? 0.10 : 0.06
                        ),
                      },
                    ]}
                  />

                  {/* ── Card principale ── */}
                  <LinearGradient
                    colors={[
                      withAlpha(
                        currentTheme.colors.cardBackground,
                        isDarkMode ? 0.93 : 0.97
                      ),
                      withAlpha(
                        currentTheme.colors.cardBackground,
                        isDarkMode ? 0.78 : 0.90
                      ),
                    ]}
                    style={[styles.card, { borderColor }]}
                  >
                    {/* Sheen diagonal façon Keynote */}
                    <LinearGradient
                      pointerEvents="none"
                      colors={[
                        "transparent",
                        isDarkMode
                          ? "rgba(255,255,255,0.09)"
                          : "rgba(255,255,255,0.55)",
                        "transparent",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardSheen}
                    />

                    {/* ── Image + badge % ── */}
                    <View style={styles.imageWrapper}>
                      <ExpoImage
                        source={{
                          uri:
                            item.imageUrl ||
                            "https://via.placeholder.com/70?text=Challenge",
                        }}
                        style={styles.cardImage}
                        contentFit="cover"
                        transition={200}
                        placeholder={{
                          blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
                        }}
                        accessibilityLabel={String(
                          t("challengeImage", { title: item.title })
                        )}
                      />
                      {/* Badge % progression superposé */}
                      <View
                        style={[
                          styles.imageBadge,
                          {
                            backgroundColor:
                              isDarkMode
                                ? "rgba(0,0,0,0.75)"
                                : "rgba(0,0,0,0.58)",
                          },
                        ]}
                      >
                        <Text style={styles.imageBadgeText}>
                          {percentLabel}
                        </Text>
                      </View>
                    </View>

                    {/* ── Contenu droite ── */}
                    <View style={styles.cardContent}>
                      {/* Ligne haute : catégorie + tag duo */}
                      <View style={styles.cardTopRow}>
                        <View
                          style={[
                            styles.categoryPill,
                            {
                              backgroundColor: isDarkMode
                                ? "rgba(255,255,255,0.09)"
                                : "rgba(0,0,0,0.06)",
                              borderColor: isDarkMode
                                ? "rgba(255,255,255,0.12)"
                                : "rgba(0,0,0,0.07)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.category}
                          </Text>
                        </View>
                        {isDuo && (
                          <View style={styles.duoPill}>
                            <Ionicons
                              name="people-outline"
                              size={normalizeSize(13)}
                              color="#0b1120"
                            />
                            <Text style={styles.duoPillText} numberOfLines={1}>
                              {t("duoModeShort", { defaultValue: "Duo" })}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Titre + méta jour / partenaire */}
                      <View style={styles.cardTitleBlock}>
                        <Text
                          style={[
                            styles.challengeTitle,
                            {
                              color: isDarkMode
                                ? currentTheme.colors.textPrimary
                                : "#000000",
                              writingDirection: I18nManager.isRTL
                                ? "rtl"
                                : "ltr",
                              textAlign: I18nManager.isRTL ? "right" : "left",
                            },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          adjustsFontSizeToFit
                        >
                          {item.title}
                        </Text>
                        <View style={styles.metaRow}>
                          {item.day !== undefined && (
                            <Text
                              style={[
                                styles.challengeDay,
                                { color: currentTheme.colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {String(t("day"))} {item.day}
                            </Text>
                          )}
                          {isDuo && partnerName && (
                            <Text
                              style={[
                                styles.partnerLabel,
                                { color: currentTheme.colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {t("withUser", {
                                defaultValue: "avec {{username}}",
                                username: partnerName,
                              })}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* ── Barre de progression ── */}
                      <View style={styles.progressRow}>
                        <View style={styles.progressContainer}>
                          <View
                            pointerEvents="none"
                            style={[
                              styles.progressTrack,
                              {
                                borderColor: isDarkMode
                                  ? "rgba(255,255,255,0.14)"
                                  : "rgba(0,0,0,0.08)",
                              },
                            ]}
                          />
                          <Progress.Bar
                            progress={progress}
                            width={null}
                            height={normalizeSize(6)}
                            borderRadius={normalizeSize(999)}
                            color={currentTheme.colors.secondary}
                            unfilledColor="transparent"
                            borderWidth={0}
                            animationType="spring"
                            style={styles.progressBar}
                          />
                        </View>
                        <View style={styles.progressMeta}>
                          <View
                            style={[
                              styles.progressChip,
                              {
                                backgroundColor: chipBg,
                                borderColor: chipBorder,
                              },
                            ]}
                          >
                            <Ionicons
                              name="flame-outline"
                              size={normalizeSize(13)}
                              color={currentTheme.colors.secondary}
                            />
                            <Text
                              style={[
                                styles.progressChipText,
                                { color: chipText },
                              ]}
                              numberOfLines={1}
                              allowFontScaling
                            >
                              {percentLabel}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.progressText,
                              {
                                color: isDarkMode
                                  ? withAlpha(
                                      currentTheme.colors.textSecondary,
                                      0.92
                                    )
                                  : withAlpha("#0B0B10", 0.62),
                              },
                            ]}
                          >
                            {item.completedDays}/{item.selectedDays}{" "}
                            {String(t("days"))}
                          </Text>
                        </View>
                      </View>

                      {/* ── Bouton Marquer aujourd'hui ── */}
                      <TouchableOpacity
                        style={[
                          styles.markTodayButton,
                          (marked || markingId === key) &&
                            styles.disabledMarkButton,
                        ]}
                        onPress={() =>
                          handleMarkToday(item.id, item.selectedDays)
                        }
                        disabled={marked || markingId === key}
                        accessibilityLabel={
                          marked
                            ? t("alreadyMarkedToday", { title: item.title })
                            : t("markToday", { title: item.title })
                        }
                        accessibilityHint={
                          marked
                            ? String(t("alreadyMarked"))
                            : String(t("markTodayButton"))
                        }
                        accessibilityRole="button"
                        testID={`mark-today-${key}`}
                      >
                        <LinearGradient
                          colors={
                            marked || markingId === key
                              ? isDarkMode
                                ? ["#4B5563", "#1F2937"]
                                : ["#E5E7EB", "#D1D5DB"]
                              : [
                                  currentTheme.colors.secondary,
                                  currentTheme.colors.primary,
                                ]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.markTodayGradient}
                        >
                          {/* Shine top quand actif */}
                          {!marked && markingId !== key && (
                            <LinearGradient
                              pointerEvents="none"
                              colors={[
                                "rgba(255,255,255,0.22)",
                                "transparent",
                              ]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={StyleSheet.absoluteFillObject}
                            />
                          )}
                          <View style={styles.markTodayContent}>
                            <Ionicons
                              name={
                                marked || markingId === key
                                  ? "checkmark-done-outline"
                                  : "sparkles-outline"
                              }
                              size={normalizeSize(16)}
                              color={
                                marked || markingId === key
                                  ? isDarkMode
                                    ? "#F9FAFB"
                                    : "#111827"
                                  : "#0b1120"
                              }
                            />
                            <Text
                              style={[
                                styles.markTodayText,
                                {
                                  color:
                                    marked || markingId === key
                                      ? isDarkMode
                                        ? "#F9FAFB"
                                        : "#111827"
                                      : "#0b1120",
                                },
                              ]}
                            >
                              {marked
                                ? t("alreadyMarked")
                                : markingId === key
                                ? t("markingInProgress", {
                                    defaultValue: "Enregistrement…",
                                  })
                                : t("markTodayButton")}
                            </Text>
                          </View>

                          {/* Petit point lumineux quand non marqué */}
                          {!marked && markingId !== key && (
                            <Animated.View
                              entering={FadeInUp.delay(200)}
                              style={[
                                styles.markTodayDot,
                                {
                                  backgroundColor: withAlpha(
                                    currentTheme.colors.secondary,
                                    0.35
                                  ),
                                },
                              ]}
                            />
                          )}

                          {/* +1🏆 animé après validation */}
                          {gainKey === key && (
                            <Animated.View
                              style={[gainStyle, styles.gainTrophyContainer]}
                            >
                              <Text
                                style={{
                                  color: currentTheme.colors.secondary,
                                  fontSize: normalizeSize(13),
                                  fontWeight: "700",
                                  textShadowColor: withAlpha(
                                    currentTheme.colors.primary,
                                    0.3
                                  ),
                                  textShadowRadius: 6,
                                  includeFontPadding: false,
                                }}
                              >
                                +1🏆
                              </Text>
                            </Animated.View>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </LinearGradient>
              </TouchableOpacity>
            </Swipeable>
          </View>
        </Animated.View>
      );
    },
    [
      currentTheme,
      isMarkedToday,
      handleMarkToday,
      navigateToDetail,
      t,
      isDarkMode,
      gainStyle,
      markingId,
      gainKey,
      reduceMotion,
      chipBg,
      chipBorder,
      chipText,
    ]
  );

  const renderEmptyState = useCallback(
    () => (
      <Animated.View
        entering={FadeInUp.delay(100)}
        style={styles.noChallengesContent}
      >
        <View style={styles.emptyIconWrapper}>
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.secondary, 0.15),
              "transparent",
            ]}
            style={styles.emptyIconGlow}
          />
          <Ionicons
            name="hourglass-outline"
            size={normalizeSize(60)}
            color={currentTheme.colors.textSecondary}
            accessibilityLabel={String(t("waitingChallengeIcon"))}
          />
        </View>
        <Text
          style={[
            styles.noChallengesText,
            {
              color: isDarkMode
                ? currentTheme.colors.textPrimary
                : currentTheme.colors.textSecondary,
            },
          ]}
        >
          {String(t("noOngoingChallenge"))}
        </Text>
        <Text
          style={[
            styles.noChallengesSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {String(t("startAChallenge"))}
        </Text>
      </Animated.View>
    ),
    [currentTheme, t, isDarkMode]
  );

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
            withAlpha(currentTheme.colors.background, 1),
            withAlpha(currentTheme.colors.cardBackground, 1),
            withAlpha(currentTheme.colors.primary, 0.13),
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {String(t("loading"))}
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
          colors={[withAlpha(currentTheme.colors.primary, 0.26), "transparent"]}
          style={styles.bgOrbTop}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(currentTheme.colors.secondary, 0.22),
            "transparent",
          ]}
          style={styles.bgOrbBottom}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <CustomHeader
          title={String(t("ongoingChallenges"))}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <View style={styles.container}>
          {localChallenges.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={localChallenges}
              renderItem={renderItem}
              keyExtractor={(item) =>
                item.uniqueKey || `current-${item.id}_${item.selectedDays}`
              }
              contentContainerStyle={[
                styles.listContent,
                { flexGrow: 1, paddingBottom: bottomPadding },
              ]}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              getItemLayout={getItemLayoutConst}
              contentInset={{ top: SPACING, bottom: 0 }}
              accessibilityRole="list"
              accessibilityLabel={String(t("listOfOngoingChallenges"))}
              testID="challenges-list"
            />
          )}
          {confettiActive && (
            <ConfettiCannon
              count={100}
              origin={{ x: -10, y: 0 }}
              autoStart
              fadeOut
              ref={confettiRef}
              onAnimationEnd={() => setConfettiActive(false)}
            />
          )}
        </View>

        {/* ✅ Modal de confirmation d'abandon */}
        {pendingRemoval && (
          <View style={styles.confirmOverlay} pointerEvents="auto">
            <Animated.View
              entering={ZoomIn.duration(200)}
              style={styles.confirmCardWrapper}
            >
              <LinearGradient
                colors={[
                  withAlpha(currentTheme.colors.cardBackground, 0.98),
                  withAlpha(currentTheme.colors.cardBackground, 0.92),
                ]}
                style={styles.confirmCard}
              >
                <View style={styles.confirmIconWrapper}>
                  <LinearGradient
                    colors={["#F97373", "#DC2626"]}
                    style={styles.confirmIconCircle}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={normalizeSize(26)}
                      color="#F9FAFB"
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[
                    styles.confirmTitle,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#000000",
                    },
                  ]}
                >
                  {String(t("abandonChallenge"))}
                </Text>

                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity
                    style={styles.confirmSecondaryButton}
                    onPress={cancelRemove}
                    accessibilityRole="button"
                    accessibilityLabel={String(t("cancel"))}
                  >
                    <Text
                      style={[
                        styles.confirmSecondaryText,
                        {
                          color: isDarkMode
                            ? currentTheme.colors.textPrimary
                            : "#0B0B10",
                        },
                      ]}
                    >
                      {String(t("cancel"))}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmPrimaryButton}
                    onPress={confirmRemove}
                    accessibilityRole="button"
                    accessibilityLabel={String(t("continue"))}
                  >
                    <LinearGradient
                      colors={["#F97373", "#DC2626"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.confirmPrimaryGradient}
                    >
                      <Text style={styles.confirmPrimaryText}>
                        {String(t("continue"))}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        )}

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
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  gradientContainer: {
    flex: 1,
  },

  // ── Orbes background ──────────────────────────────────────────────────────
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

  container: { flex: 1 },

  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  cardWrapper: {
    marginBottom: SPACING * 1.2,
    borderRadius: normalizeSize(26),
    backgroundColor: "transparent",
    overflow: "visible",
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(26),
    overflow: "visible",
    alignSelf: "center",
  },
  cardRing: {
    borderRadius: normalizeSize(26),
    padding: normalizeSize(1.5),
  },
  cardHalo: {
    position: "absolute",
    top: -normalizeSize(18),
    right: -normalizeSize(26),
    width: normalizeSize(110),
    height: normalizeSize(110),
    borderRadius: 999,
    opacity: 0.95,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(14),
    borderRadius: normalizeSize(24),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === "ios" ? 0.10 : 0,
    shadowRadius: 18,
    elevation: Platform.OS === "android" ? 2 : 0,
  },
  cardSheen: {
    position: "absolute",
    top: -normalizeSize(26),
    left: -normalizeSize(50),
    width: "150%",
    height: normalizeSize(82),
    transform: [{ rotate: "-12deg" }],
    opacity: 0.85,
  },

  // ── Image + badge ─────────────────────────────────────────────────────────
  imageWrapper: {
    position: "relative",
    marginRight: SPACING * 0.9,
  },
  cardImage: {
    width: normalizeSize(62),
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.20)",
  },
  imageBadge: {
    position: "absolute",
    bottom: -normalizeSize(6),
    right: -normalizeSize(6),
    paddingHorizontal: normalizeSize(5),
    paddingVertical: normalizeSize(2),
    borderRadius: normalizeSize(8),
    minWidth: normalizeSize(28),
    alignItems: "center",
  },
  imageBadgeText: {
    color: "#FFFFFF",
    fontSize: normalizeSize(9.5),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalizeSize(4),
    gap: normalizeSize(6),
  },
  categoryPill: {
    paddingHorizontal: normalizeSize(8),
    paddingVertical: normalizeSize(3),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "68%",
    flexShrink: 1,
  },
  categoryText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  duoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(5),
    paddingHorizontal: normalizeSize(9),
    paddingVertical: normalizeSize(4),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    flexShrink: 0,
  },
  duoPillText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_700Bold",
    color: "#0B0B10",
  },
  cardTitleBlock: {
    marginBottom: normalizeSize(5),
  },
  challengeTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(2),
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: normalizeSize(7),
  },
  challengeDay: {
    fontSize: normalizeSize(13),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  partnerLabel: {
    fontSize: normalizeSize(12.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },

  // ── Progress ──────────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: normalizeSize(4),
  },
  progressContainer: {
    flex: 1,
    marginRight: normalizeSize(10),
    justifyContent: "center",
    position: "relative",
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: normalizeSize(6),
    borderRadius: normalizeSize(999),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "transparent",
  },
  progressBar: {
    width: "100%",
    alignSelf: "stretch",
  },
  progressMeta: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalizeSize(8),
    paddingVertical: normalizeSize(3),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: normalizeSize(4),
  },
  progressChipText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  progressText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },

  // ── Mark Today ────────────────────────────────────────────────────────────
  markTodayButton: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  disabledMarkButton: {
    opacity: 0.9,
  },
  markTodayGradient: {
    paddingVertical: normalizeSize(9),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  markTodayContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalizeSize(8),
  },
  markTodayText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14.5),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    includeFontPadding: false,
  },
  markTodayDot: {
    position: "absolute",
    top: -normalizeSize(8),
    right: normalizeSize(10),
    borderRadius: 999,
    width: normalizeSize(7),
    height: normalizeSize(7),
  },
  gainTrophyContainer: {
    position: "absolute",
    top: -normalizeSize(28),
    right: normalizeSize(18),
    backgroundColor: "transparent",
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: SPACING * 2,
  },
  emptyIconWrapper: {
    width: normalizeSize(100),
    height: normalizeSize(100),
    borderRadius: normalizeSize(50),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
    overflow: "hidden",
  },
  emptyIconGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  noChallengesText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: SPACING / 2,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    maxWidth: SCREEN_WIDTH * 0.75,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  // ── Loading ───────────────────────────────────────────────────────────────
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

  // ── Swipe delete ──────────────────────────────────────────────────────────
  swipeActionsContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: normalizeSize(10),
  },
  trashButton: {
    width: Math.min(ITEM_WIDTH * 0.26, 120),
    height: Math.max(normalizeSize(ROW_HEIGHT * 0.72), 64),
    borderTopLeftRadius: normalizeSize(22),
    borderBottomLeftRadius: normalizeSize(22),
    borderTopRightRadius: normalizeSize(18),
    borderBottomRightRadius: normalizeSize(18),
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: normalizeSize(4),
  },
  trashLabel: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 0.3,
  },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99998,
  },
  confirmCardWrapper: {
    width: SCREEN_WIDTH * 0.85,
  },
  confirmCard: {
    borderRadius: normalizeSize(22),
    paddingHorizontal: SPACING,
    paddingTop: SPACING * 1.5,
    paddingBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  confirmIconWrapper: {
    alignItems: "center",
    marginBottom: SPACING,
  },
  confirmIconCircle: {
    width: normalizeSize(52),
    height: normalizeSize(52),
    borderRadius: normalizeSize(26),
    justifyContent: "center",
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalizeSize(14),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  confirmSubtitle: {
    fontSize: normalizeSize(14.5),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  confirmButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING,
  },
  confirmSecondaryButton: {
    flex: 1,
    borderRadius: normalizeSize(16),
    borderWidth: 1,
    borderColor: withAlpha("#9CA3AF", 0.6),
    paddingVertical: normalizeSize(10),
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSecondaryText: {
    fontSize: normalizeSize(14.5),
    fontFamily: "Comfortaa_700Bold",
  },
  confirmPrimaryButton: {
    flex: 1,
    borderRadius: normalizeSize(16),
    overflow: "hidden",
  },
  confirmPrimaryGradient: {
    paddingVertical: normalizeSize(10),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(16),
  },
  confirmPrimaryText: {
    fontSize: normalizeSize(14.5),
    fontFamily: "Comfortaa_700Bold",
    color: "#F9FAFB",
  },
});
