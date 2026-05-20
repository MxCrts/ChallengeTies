import React, {
  useRef,
  useState,
  useEffect,
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
  Pressable,
  Platform,
  AccessibilityInfo,
  I18nManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  FadeInUp,
  FadeOutRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { Image as ExpoImage } from "expo-image";
import type { ListRenderItem } from "react-native";
import { translateChallenge } from "../../services/translationService";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;

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

interface Challenge {
  id: string;
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  daysOptions?: number[];
  creatorId?: string | null;
}

type SwipeableHandle = { close: () => void } | null;

type ToastType = "success" | "error" | "info";

interface ToastState {
  type: ToastType;
  message: string;
}

const TOAST_DURATION = 2000;

export default function SavedChallengesScreen() {
  const { t, i18n } = useTranslation();
  const { savedChallenges, removeChallenge } = useSavedChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const router = useRouter();
  const swipeableRefs = useRef<SwipeableHandle[]>([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const tabBarHeight = (() => {
    try {
      return useBottomTabBarHeight();
    } catch {
      return 0;
    }
  })();
  const [adHeight, setAdHeight] = useState(0);
  const bottomPadding =
    normalizeSize(90) + (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom;

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(-10);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [userChallengeTranslations, setUserChallengeTranslations] = useState<Record<string, { title?: string; description?: string }>>({});

const translatingRef = useRef<Set<string>>(new Set());

useEffect(() => {
  const userCreated = savedChallenges.filter((c: any) => !!c.creatorId);
  if (!userCreated.length) return;
  const lang = i18n.language;
  userCreated.forEach(async (c: any) => {
    const key = `${c.id}:${lang}`;
    if (translatingRef.current.has(key)) return;
    translatingRef.current.add(key);
    const result = await translateChallenge(c.id, lang);
    if (!result) { translatingRef.current.delete(key); return; }
    setUserChallengeTranslations(prev => ({
      ...prev,
      [key]: { title: result.title, description: result.description },
    }));
  });
}, [savedChallenges, i18n.language]);

  // Respect reduce motion
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

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastTranslateY.value }],
  }));

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      setToast({ type, message });
      toastOpacity.value = 0;
      toastTranslateY.value = -10;

      toastOpacity.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
        withDelay(
          TOAST_DURATION,
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
        )
      );

      toastTranslateY.value = withSequence(
        withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) }),
        withDelay(
          TOAST_DURATION,
          withTiming(-10, { duration: 300, easing: Easing.in(Easing.ease) })
        )
      );

      if (!reduceMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      setTimeout(() => {
        setToast((current) =>
          current && current.message === message ? null : current
        );
      }, TOAST_DURATION + 400);
    },
    [reduceMotion, toastOpacity, toastTranslateY]
  );

  // Dédup + traduction
  const translatedChallenges = useMemo(() => {
    if (!savedChallenges || !Array.isArray(savedChallenges)) {
      return [];
    }

    const uniqueArr = Array.from(
      new Map(
        savedChallenges
          .filter((item) => item.id)
          .map((item) => [item.id, item as Challenge])
      ).values()
    );

   return uniqueArr.map((item) => {
  const isUserCreated = !!(item as any).creatorId;
  const tKey = `${item.id}:${i18n.language}`;
  const trans = isUserCreated ? userChallengeTranslations[tKey] : null;

  return {
    ...item,
    title: isUserCreated
      ? (trans?.title || item.title)
      : (item.chatId
          ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
          : item.title),
    description: isUserCreated
      ? (trans?.description || item.description || "")
      : (item.chatId
          ? t(`challenges.${item.chatId}.description`, { defaultValue: item.description || "" })
          : item.description || ""),
    category: item.category
      ? t(`categories.${item.category}`, { defaultValue: item.category })
      : t("miscellaneous"),
  };
});
  }, [savedChallenges, i18n.language, userChallengeTranslations, t]);

  useEffect(() => {
    setLocalChallenges(translatedChallenges);
    setIsLoading(false);
  }, [translatedChallenges]);

  const navigateToChallengeDetails = useCallback(
    (item: Challenge) => {
      const titleParam = encodeURIComponent(item.title);
      const catParam = encodeURIComponent(item.category || "");
      const descParam = encodeURIComponent(item.description || "");
      const imgParam = encodeURIComponent(item.imageUrl || "");
      const selectedDays = item.daysOptions?.[0] || 7;

      const route = `/challenge-details/${encodeURIComponent(
        item.id
      )}?title=${titleParam}&selectedDays=${selectedDays}&completedDays=0&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;

      router.push(route);
    },
    [router]
  );

  const handleRemoveChallenge = useCallback(
    async (id: string, index: number) => {
      const prev = localChallenges;
      // Optimistic UI
      setLocalChallenges((current) => current.filter((c) => c.id !== id));
      try {
        await removeChallenge(id);
        swipeableRefs.current[index]?.close();
        showToast("success", String(t("challengeDeletedSuccess")));
      } catch (err) {
        console.error("Erreur removeChallenge:", err);
        // rollback UI
        setLocalChallenges(prev);
        swipeableRefs.current[index]?.close();
        showToast("error", String(t("failedToDeleteChallenge")));
      }
    },
    [localChallenges, removeChallenge, t, showToast]
  );

  // Swipe en 2 temps + pill premium (swipe + tap sur poubelle)
  const pendingDeleteRef = useRef<(() => void) | null>(null);
  const renderRightActions = useCallback(
    (_index: number) => (
      <View style={styles.swipeActionsContainer} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.trashButton}
          onPress={() => pendingDeleteRef.current?.()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("deleteChallenge")}
          accessibilityHint={t("confirmDeletionHint")}
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
    [t]
  );

  const renderChallengeItem = useCallback<ListRenderItem<Challenge>>(
    ({ item, index }) => {
      const borderColor = isDarkMode
  ? withAlpha("#FFFFFF", 0.16)
  : withAlpha("#000000", 0.10);

const ringGrad = isDarkMode
  ? (["rgba(255,255,255,0.22)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.14)"] as const)
  : (["rgba(0,0,0,0.14)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.10)"] as const);


      return (
        <Animated.View
          entering={ZoomIn.delay(index * 50)}
          exiting={FadeOutRight.duration(260)}
          style={styles.cardWrapper}
        >
          <View
            accessibilityLabel={`${t("challengeS")} ${item.title}, ${t(
              "swipeToDelete"
            )}`}
            testID={`challenge-swipe-${item.id}`}
          >
            <Swipeable
              ref={(ref) => {
                swipeableRefs.current[index] =
                  (ref as unknown as SwipeableHandle) ?? null;
              }}
              renderRightActions={() => renderRightActions(index)}
              overshootRight={false}
              onSwipeableOpen={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {}
                );
                pendingDeleteRef.current = () => {
                  handleRemoveChallenge(item.id, index);
                  pendingDeleteRef.current = null;
                };
              }}
              onSwipeableClose={() => {
                pendingDeleteRef.current = null;
              }}
            >
              <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => navigateToChallengeDetails(item)}
                activeOpacity={0.9}
                accessibilityLabel={t("viewChallengeDetails", {
                  title: item.title,
                })}
                accessibilityHint={t("viewDetails")}
                accessibilityRole="button"
                testID={`challenge-card-${item.id}`}
              >

                {/* ✅ Android fake shadow */}
  {Platform.OS === "android" && (
    <View style={{
      position: "absolute",
      bottom: -3, left: 6, right: 6,
      height: "100%",
      borderRadius: normalizeSize(26),
      backgroundColor: withAlpha("#F97316", 0.10),
    }} pointerEvents="none" />
  )}
                {/* Glow subtil top */}
                {/* ✅ Ring gradient premium */}
<LinearGradient
  colors={ringGrad}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.cardRing}
>
  {/* ✅ Halo soft */}
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

  <LinearGradient
    colors={[
      withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.92 : 0.96),
      withAlpha(currentTheme.colors.cardBackground, isDarkMode ? 0.78 : 0.90),
    ]}
    style={[styles.card, { borderColor }]}
  >
    {/* ✅ Sheen diagonal */}
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
                    accessibilityLabel={t("challengeImage", {
                      title: item.title,
                    })}
                  />

                  <View style={styles.cardContent}>
                    {/* Ligne haute : catégorie + badge "Enregistré" */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.categoryPill}>
                        <Text
                          style={[
                            styles.categoryText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.category || t("miscellaneous")}
                        </Text>
                      </View>
                      <View
  style={[
    styles.savedPill,
    {
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
      borderColor: isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)",
    },
  ]}
>

                        <Ionicons
                          name="bookmark-outline"
                          size={normalizeSize(13)}
                          color={isDarkMode ? "#F9FAFB" : "#0B0B10"}
                        />
                        <Text style={[
  styles.savedPillText,
  { color: isDarkMode ? "#F9FAFB" : "#0B0B10" },
]}
 numberOfLines={1}>
                          {t("savedShort", { defaultValue: "Enregistré" })}
                        </Text>
                      </View>
                    </View>

                    {/* Titre + description courte */}
                    <Text
                      style={[
                        styles.challengeTitle,
                        {
                          color: isDarkMode
                            ? currentTheme.colors.textPrimary
                            : "#000000",
                          writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                          textAlign: I18nManager.isRTL ? "right" : "left",
                        },
                      ]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                    >
                      {item.title}
                    </Text>

                                        {!!item.description && (
                      <Text
                        style={[
                          styles.challengeDescription,
                          {
                            color: currentTheme.colors.textSecondary,
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.description}
                      </Text>
                    )}

                    {/* CTA Voir les détails */}
                    <View style={styles.footerRow}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => navigateToChallengeDetails(item)}
                        accessibilityLabel={t("viewChallengeDetails", {
                          title: item.title,
                        })}
                        accessibilityHint={t("viewDetails")}
                        accessibilityRole="button"
                        testID={`view-details-${item.id}`}
                      >
                        <LinearGradient
                          colors={[
                            currentTheme.colors.secondary,
                            currentTheme.colors.primary,
                          ]}
                          style={styles.viewButtonGradient}
                        >
                          <View style={styles.viewButtonContent}>
                            <Text
                              style={[
                                styles.viewButtonText,
                                { color: "#0b1120" },
                              ]}
                            >
                              {t("viewDetails")}
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={normalizeSize(14)}
                              color="#0b1120"
                            />
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
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
      navigateToChallengeDetails,
      handleRemoveChallenge,
      currentTheme,
      t,
      isDarkMode,
    ]
  );

  const renderEmptyState = useCallback(
  () => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.noChallengesContent}>

      {/* Illustration SVG */}
      <View style={{ width: normalizeSize(120), height: normalizeSize(120), marginBottom: normalizeSize(24), alignItems: "center", justifyContent: "center" }}>
        <LinearGradient
          colors={[withAlpha(currentTheme.colors.primary, 0.15), withAlpha(currentTheme.colors.primary, 0.05)]}
          style={{ position: "absolute", width: normalizeSize(120), height: normalizeSize(120), borderRadius: normalizeSize(60) }}
        />
        <Svg width={normalizeSize(72)} height={normalizeSize(72)} viewBox="0 0 72 72" fill="none">
          {/* Cercle fond */}
          <Circle cx="36" cy="36" r="34" stroke={withAlpha(currentTheme.colors.primary, 0.25)} strokeWidth="1.5" strokeDasharray="4 3" />
          {/* Bookmark stylisé */}
          <Path d="M24 18H48C49.1 18 50 18.9 50 20V56L36 46L22 56V20C22 18.9 22.9 18 24 18Z"
            fill={withAlpha(currentTheme.colors.primary, isDarkMode ? 0.20 : 0.12)}
            stroke={currentTheme.colors.primary} strokeWidth="1.5" strokeLinejoin="round"
          />
          {/* Étoile inside */}
          <Path d="M36 26L38.5 31.5H44.5L39.5 35L41.5 41L36 37.5L30.5 41L32.5 35L27.5 31.5H33.5Z"
            fill={currentTheme.colors.primary} opacity="0.90"
          />
        </Svg>
      </View>

      <Text style={[styles.noChallengesText, {
        color: isDarkMode ? currentTheme.colors.textPrimary : "#1A0800",
        fontSize: normalizeSize(22),
        marginBottom: normalizeSize(8),
      }]}>
        {t("emptyState.saved.title", { defaultValue: "Rien de sauvegardé." })}
      </Text>

      <Text style={[styles.noChallengesSubtext, { color: currentTheme.colors.textSecondary, textAlign: "center" }]}>
        {t("emptyState.saved.sub", { defaultValue: "Explore les défis et marque\nceux qui t'inspirent." })}
      </Text>

      {/* CTA */}
      <Pressable
        onPress={() => router.push("/explore")}
        style={({ pressed }) => ({
          marginTop: normalizeSize(24),
          borderRadius: normalizeSize(999),
          overflow: "hidden",
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <LinearGradient
          colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingVertical: normalizeSize(13), paddingHorizontal: normalizeSize(28), flexDirection: "row", alignItems: "center", gap: normalizeSize(8) }}
        >
          <Ionicons name="compass-outline" size={normalizeSize(18)} color="#0B1120" />
          <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(14), color: "#0B1120" }}>
            {t("emptyState.saved.cta", { defaultValue: "Explorer les défis" })}
          </Text>
        </LinearGradient>
      </Pressable>

    </Animated.View>
  ),
  [currentTheme, t, isDarkMode, router]
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
            {t("loading")}
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
        {/* Orbes premium */}
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
          title={t("savedChallengesScreenTitle")}
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
              renderItem={renderChallengeItem}
              keyExtractor={(item) => `saved-${item.id}`}
              contentContainerStyle={[
                styles.listContent,
                { flexGrow: 1, paddingBottom: bottomPadding },
              ]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              getItemLayout={(_, index) => ({
                length: normalizeSize(ITEM_HEIGHT + SPACING * 1.5),
                offset: normalizeSize(ITEM_HEIGHT + SPACING * 1.5) * index,
                index,
              })}
              contentInset={{ top: SPACING, bottom: 0 }}
              accessibilityRole="list"
              accessibilityLabel={t("listOfSavedChallenges")}
              testID="saved-challenges-list"
            />
          )}
        </View>

        {/* Toast premium */}
        {toast && (
          <Animated.View
            pointerEvents="box-none"
            style={[styles.toastContainer, toastStyle]}
          >
            <View
              style={[
                styles.toastInner,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "error" && styles.toastError,
                toast.type === "info" && styles.toastInfo,
              ]}
            >
              <Ionicons
                name={
                  toast.type === "success"
                    ? "checkmark-circle-outline"
                    : toast.type === "error"
                    ? "alert-circle-outline"
                    : "information-circle-outline"
                }
                size={normalizeSize(18)}
                color="#0b1120"
              />
              <Text style={styles.toastText} numberOfLines={2}>
                {toast.message}
              </Text>
            </View>
          </Animated.View>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
    backgroundColor: "transparent",
  },
  container: { flex: 1 },

  gradientContainer: {
    flex: 1,
  },
  bgOrbTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.25,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
  },
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
  padding: normalizeSize(2),
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
  elevation: Platform.OS === "android" ? 6 : 0,
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

  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: SCREEN_WIDTH * 0.55,
  },

  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },

  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingBottom: normalizeSize(80),
  },
  cardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: normalizeSize(24),
    opacity: 0.25,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  cardImage: {
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    marginRight: SPACING * 0.95,
    borderWidth: StyleSheet.hairlineWidth,
borderColor: "rgba(255,255,255,0.20)",
backgroundColor: "rgba(255,255,255,0.06)",
width: normalizeSize(80),

  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalizeSize(4),
  },
  categoryPill: {
    paddingHorizontal: normalizeSize(8),
    paddingVertical: normalizeSize(3),
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    maxWidth: "70%",
  },
  categoryText: {
    fontSize: normalizeSize(11.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  savedPill: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: normalizeSize(10),
  paddingVertical: normalizeSize(4),
  borderRadius: 999,

  backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.16)",
},
savedPillText: {
  fontSize: normalizeSize(11.5),
  fontFamily: "Comfortaa_700Bold",
  color: "#F9FAFB",
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
},
  challengeTitle: {
    fontSize: normalizeSize(17),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  challengeDescription: {
    fontSize: normalizeSize(13.5),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalizeSize(6),
  },
  footerRow: {
    marginTop: normalizeSize(2),
    alignItems: "flex-end",
  },
  viewButton: {
  borderRadius: normalizeSize(999),
  overflow: "hidden",
  alignSelf: "flex-end",
},
  viewButtonGradient: {
  paddingVertical: normalizeSize(8),
  paddingHorizontal: normalizeSize(14),
  alignItems: "center",
  justifyContent: "center",
  borderRadius: normalizeSize(999),
},
viewButtonText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13.5),
  letterSpacing: 0.2,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
},
  viewButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
  },
  noChallengesText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  swipeActionsContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: normalizeSize(10),
  },
  trashButton: {
    width: Math.min(ITEM_WIDTH * 0.26, 120),
    height: Math.max(normalizeSize(ITEM_HEIGHT * 0.72), 64),
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
    gap: normalizeSize(6),
  },
  trashLabel: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 0.3,
  },

  // Toast premium
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: SPACING * 2.4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingVertical: normalizeSize(10),
    borderRadius: normalizeSize(20),
    backgroundColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    gap: normalizeSize(8),
  },
  toastSuccess: {
    backgroundColor: "#BBF7D0",
  },
  toastError: {
    backgroundColor: "#FECACA",
  },
  toastInfo: {
    backgroundColor: "#E0F2FE",
  },
  toastText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
    color: "#0b1120",
    flexShrink: 1,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
});
