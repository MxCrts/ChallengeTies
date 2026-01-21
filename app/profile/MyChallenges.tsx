import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { Image as ExpoImage } from "expo-image";
import type { ListRenderItem } from "react-native";
import * as Haptics from "expo-haptics";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const ITEM_WIDTH = SCREEN_WIDTH * 0.92;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.46;
const ROW_HEIGHT = ITEM_HEIGHT + SPACING * 1.45;

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

interface Challenge {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  participantsCount: number;
  chatId?: string;
  approved: boolean;
  updatedAt?: any;
}

export default function MyChallenges() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const bottomPadding = useMemo(
    () =>
      normalizeSize(90) +
      (showBanners ? adHeight : 0) +
      tabBarHeight +
      insets.bottom,
    [adHeight, showBanners, tabBarHeight, insets.bottom]
  );

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const { createdChallenges = [] } = snapshot.data() || {};

          if (!Array.isArray(createdChallenges) || createdChallenges.length === 0) {
            setMyChallenges([]);
            setIsLoading(false);
            return;
          }

          const raw = await Promise.all(
            createdChallenges.map(async ({ id, ...rest }) => {
              try {
                const snap = await getDoc(doc(db, "challenges", id));
                const data = snap.exists() ? snap.data() : {};
                return {
                  id,
                  ...rest,
                  participantsCount: data.participantsCount || 0,
                  ...data,
                };
              } catch (error) {
                console.error(`Erreur getDoc pour challenge ${id}:`, error);
                return null;
              }
            })
          );

          const translated = raw
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map((item) => ({
              ...item,
              title: item.chatId
                ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
                : item.title,
              description: item.chatId
                ? t(`challenges.${item.chatId}.description`, {
                    defaultValue: item.description || "",
                  })
                : item.description,
              category: item.category
                ? t(`categories.${item.category}`, { defaultValue: item.category })
                : t("noCategory"),
            }))
            .filter((c) => c.approved)
            .sort((a, b) => {
              const p = (b.participantsCount || 0) - (a.participantsCount || 0);
              if (p !== 0) return p;
              const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const dbb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              if (dbb !== da) return dbb - da;
              return String(a.title || "").localeCompare(String(b.title || ""));
            });

          setMyChallenges(translated);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur onSnapshot:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t, i18n.language]);

  const navigateToChallengeDetails = useCallback(
    (item: Challenge) => {
      const params = new URLSearchParams({
        title: item.title,
        category: item.category || "",
        description: item.description || "",
        imageUrl: item.imageUrl || "",
      }).toString();
      Haptics.selectionAsync().catch(() => {});
      router.push(`/challenge-details/${encodeURIComponent(item.id)}?${params}`);
    },
    [router]
  );

  const renderChallenge: ListRenderItem<Challenge> = useCallback(
    ({ item, index }) => {
      const hasImage = !!item.imageUrl;
      const participants = typeof item.participantsCount === "number" ? item.participantsCount : 0;

      const border = isDarkMode
        ? withAlpha("#FFFFFF", 0.12)
        : withAlpha("#000000", 0.08);

      const cardBg = isDarkMode
        ? withAlpha(currentTheme.colors.cardBackground, 0.62)
        : withAlpha("#FFFFFF", 0.92);

      const softShadow = isDarkMode ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.18)";

      return (
        <Animated.View entering={ZoomIn.delay(index * 70)} style={styles.cardWrapper}>
          <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => navigateToChallengeDetails(item)}
            activeOpacity={0.85}
            accessibilityLabel={String(t("viewChallengeDetails", { title: item.title }))}
            accessibilityHint={String(t("viewDetails"))}
            accessibilityRole="button"
            testID={`challenge-${item.id}`}
          >
            {/* Glass base */}
            <View
              style={[
                styles.cardGlass,
                {
                  backgroundColor: cardBg,
                  borderColor: border,
                  shadowColor: softShadow,
                },
              ]}
            >
              {/* Sheen premium */}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  "transparent",
                  isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.70)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardSheen}
              />

              {/* Accent glow */}
              <View
                pointerEvents="none"
                style={[
                  styles.cardGlow,
                  {
                    backgroundColor: withAlpha(currentTheme.colors.primary, isDarkMode ? 0.16 : 0.10),
                  },
                ]}
              />

              {/* Left media */}
              <View
                style={[
                  styles.mediaWrap,
                  {
                    borderColor: isDarkMode
                      ? withAlpha("#FFFFFF", 0.14)
                      : withAlpha("#000000", 0.08),
                    backgroundColor: isDarkMode
                      ? withAlpha("#FFFFFF", 0.05)
                      : withAlpha("#000000", 0.03),
                  },
                ]}
              >
                {hasImage ? (
                  <ExpoImage
                    source={{ uri: item.imageUrl }}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={220}
                    placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
                    accessibilityLabel={String(t("challengeImage", { title: item.title }))}
                  />
                ) : (
                  <View
                    style={[
                      styles.placeholderImage,
                      { backgroundColor: withAlpha(currentTheme.colors.overlay, isDarkMode ? 0.22 : 0.12) },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={normalizeSize(22)}
                      color={currentTheme.colors.textSecondary}
                      accessibilityLabel={String(t("noImage"))}
                    />
                  </View>
                )}

                {/* Small corner badge if popular */}
                {participants > 0 && (
                  <View
                    style={[
                      styles.cornerBadge,
                      {
                        backgroundColor: isDarkMode
                          ? withAlpha("#000000", 0.35)
                          : withAlpha("#FFFFFF", 0.80),
                        borderColor: isDarkMode
                          ? withAlpha("#FFFFFF", 0.16)
                          : withAlpha("#000000", 0.10),
                      },
                    ]}
                  >
                    <Ionicons
                      name="people-outline"
                      size={normalizeSize(12)}
                      color={currentTheme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.cornerBadgeText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {participants}
                    </Text>
                  </View>
                )}
              </View>

              {/* Right content */}
              <View style={styles.cardContent}>
                <View style={styles.topRow}>
                  <View style={styles.textBlock}>
                    <Text
                      style={[
                        styles.challengeTitle,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.categoryPill,
                          {
                            backgroundColor: isDarkMode
                              ? withAlpha("#FFFFFF", 0.06)
                              : withAlpha("#000000", 0.04),
                            borderColor: isDarkMode
                              ? withAlpha("#FFFFFF", 0.12)
                              : withAlpha("#000000", 0.08),
                          },
                        ]}
                      >
                        <Ionicons
                          name="pricetag-outline"
                          size={normalizeSize(12)}
                          color={currentTheme.colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.challengeCategory,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.category}
                        </Text>
                      </View>

                      {participants > 0 && (
                        <View
                          style={[
                            styles.participantsPill,
                            {
                              backgroundColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.14 : 0.12),
                              borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.26 : 0.22),
                            },
                          ]}
                        >
                          <Ionicons
                            name="sparkles"
                            size={normalizeSize(12)}
                            color={currentTheme.colors.secondary}
                          />
                          <Text
                            style={[
                              styles.participantsText,
                              { color: currentTheme.colors.secondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t(participants > 1 ? "participants" : "participant", { count: participants })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Ionicons
                    name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
                    size={normalizeSize(18)}
                    color={withAlpha(currentTheme.colors.textSecondary, 0.85)}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>

                {/* CTA */}
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => navigateToChallengeDetails(item)}
                  accessibilityLabel={String(t("viewDetails"))}
                  accessibilityRole="button"
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[
                      withAlpha(currentTheme.colors.secondary, 0.95),
                      withAlpha(currentTheme.colors.primary, 0.95),
                    ]}
                    style={styles.viewButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons
                      name="arrow-forward-circle"
                      size={normalizeSize(16)}
                      color={withAlpha("#FFFFFF", isDarkMode ? 0.92 : 0.96)}
                      style={{ marginRight: normalizeSize(8) }}
                    />
                    <Text
                      style={[
                        styles.viewButtonText,
                        { color: withAlpha("#FFFFFF", isDarkMode ? 0.92 : 0.96) },
                      ]}
                      numberOfLines={1}
                    >
                      {String(t("viewDetails"))}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [currentTheme, navigateToChallengeDetails, t, isDarkMode]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.noChallengesContainer}>
        <Animated.View entering={FadeInUp.delay(120)} style={styles.noChallengesContent}>
          <View
            style={[
              styles.emptyIconWrap,
              {
                backgroundColor: isDarkMode
                  ? withAlpha("#FFFFFF", 0.06)
                  : withAlpha("#000000", 0.04),
                borderColor: isDarkMode
                  ? withAlpha("#FFFFFF", 0.12)
                  : withAlpha("#000000", 0.08),
              },
            ]}
          >
            <Ionicons
              name="create-outline"
              size={normalizeSize(34)}
              color={currentTheme.colors.textSecondary}
              accessibilityLabel={String(t("noChallengesCreated"))}
            />
          </View>

          <Text
            style={[
              styles.noChallengesText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {String(t("noChallengesCreated"))}
          </Text>

          <Text
            style={[
              styles.noChallengesSubtext,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {String(t("createFirstChallenge"))}
          </Text>

          <View style={styles.emptyHintRow}>
            <Ionicons
              name="sparkles-outline"
              size={normalizeSize(16)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.emptyHintText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {String(t("common.tip", "Astuce"))} :{" "}
              {String(t("createChallengeHint", "Un bon titre + une image = plus de participants."))}
            </Text>
          </View>
        </Animated.View>
      </View>
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
          <Text style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}>
            {String(t("loadingChallenges"))}
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
        {/* Orbes décoratives */}
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
          title={String(t("myChallenges"))}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <View style={styles.container}>
          {myChallenges.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={myChallenges}
              renderItem={renderChallenge}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { flexGrow: 1, paddingBottom: bottomPadding },
              ]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={getItemLayoutConst}
              contentInset={{ top: SPACING, bottom: 0 }}
            />
          )}
        </View>

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
  safeArea: { flex: 1, paddingTop: 0 },
  container: { flex: 1 },
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

  listContent: {
    paddingVertical: SPACING * 1.2,
    paddingHorizontal: SCREEN_WIDTH * 0.02,
    paddingBottom: normalizeSize(80),
  },

  cardWrapper: {
    marginBottom: SPACING * 1.15,
    borderRadius: normalizeSize(26),
    alignSelf: "center",
  },

  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(26),
    overflow: "visible",
    alignSelf: "center",
  },

  cardGlass: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ITEM_HEIGHT,
    borderRadius: normalizeSize(26),
    borderWidth: StyleSheet.hairlineWidth,
    padding: normalizeSize(14),
    overflow: "hidden",
    shadowOffset: { width: 0, height: normalizeSize(10) },
    shadowOpacity: 0.22,
    shadowRadius: normalizeSize(14),
    elevation: 10,
  },

  cardSheen: {
    position: "absolute",
    top: -normalizeSize(26),
    left: -normalizeSize(70),
    width: "175%",
    height: normalizeSize(86),
    transform: [{ rotate: "-12deg" }],
    opacity: 0.82,
  },

  cardGlow: {
    position: "absolute",
    top: -normalizeSize(26),
    right: -normalizeSize(22),
    width: normalizeSize(120),
    height: normalizeSize(120),
    borderRadius: 999,
  },

  mediaWrap: {
    width: normalizeSize(76),
    height: normalizeSize(76),
    borderRadius: normalizeSize(18),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginRight: normalizeSize(12),
  },

  cardImage: {
    width: "100%",
    height: "100%",
  },

  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  cornerBadge: {
    position: "absolute",
    bottom: normalizeSize(6),
    right: normalizeSize(6),
    borderRadius: 999,
    paddingHorizontal: normalizeSize(7),
    paddingVertical: normalizeSize(3),
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(4),
    borderWidth: StyleSheet.hairlineWidth,
  },

  cornerBadgeText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(10),
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
  },

  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: normalizeSize(76),
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: normalizeSize(10),
  },

  textBlock: {
    flex: 1,
  },

  challengeTitle: {
    fontSize: normalizeSize(17),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(6),
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: normalizeSize(8),
  },

  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(6),
    borderRadius: 999,
    paddingHorizontal: normalizeSize(10),
    paddingVertical: normalizeSize(6),
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },

  challengeCategory: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
    maxWidth: SCREEN_WIDTH * 0.48,
  },

  participantsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(6),
    borderRadius: 999,
    paddingHorizontal: normalizeSize(10),
    paddingVertical: normalizeSize(6),
    borderWidth: StyleSheet.hairlineWidth,
  },

  participantsText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },

  viewButton: {
    marginTop: normalizeSize(12),
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    alignSelf: I18nManager.isRTL ? "flex-start" : "flex-start",
  },

  viewButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: normalizeSize(11),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(16),
  },

  viewButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
    includeFontPadding: false,
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },

  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  noChallengesContainer: { flex: 1 },

  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: SPACING,
  },

  emptyIconWrap: {
    width: normalizeSize(74),
    height: normalizeSize(74),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: normalizeSize(14),
  },

  noChallengesText: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalizeSize(8),
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  noChallengesSubtext: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(8),
    maxWidth: SCREEN_WIDTH * 0.78,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  emptyHintRow: {
    marginTop: normalizeSize(14),
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(8),
    paddingHorizontal: normalizeSize(12),
    paddingVertical: normalizeSize(10),
    borderRadius: normalizeSize(16),
    backgroundColor: withAlpha("#000000", 0.06),
  },

  emptyHintText: {
    flex: 1,
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
});
