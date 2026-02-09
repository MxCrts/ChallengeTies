import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  Modal,
  StatusBar,
  StyleSheet,
  Platform,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import type { ListRenderItem } from "react-native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";

// Dimensions & responsivité
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18;
const ITEM_WIDTH = Math.min(SCREEN_WIDTH * 0.92, 420);
const ITEM_HEIGHT = Math.max(SCREEN_WIDTH * 0.40, 150);
const IS_COMPACT = SCREEN_HEIGHT < 720;


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
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return `rgba(0,0,0,${a})`;
};

interface CompletedHistoryEntry {
  completedAt: string;
  selectedDays: number;
}

interface CompletedChallenge {
  id: string;
  chatId?: string;
  title: string;
  imageUrl?: string;
  completedAt: string;
  category?: string;
  description?: string;
  selectedDays: number;
  history?: CompletedHistoryEntry[];
}

const normalizeHistory = (history: any): CompletedHistoryEntry[] => {
  if (Array.isArray(history)) return history;

  if (history && typeof history === "object") {
    // Cas Firestore: objet { "0": {...}, "1": {...} }
    return Object.values(history) as CompletedHistoryEntry[];
  }

  return [];
};

export default function CompletedChallenges() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();

  // ✅ Safe: certains écrans sont rendus hors Tabs (Stack push, deeplink, etc.)
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

  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{
    title: string;
    history: CompletedHistoryEntry[];
  } | null>(null);

  // Format date localisée robuste
  const formatDate = useCallback(
    (isoLike: string) => {
      const d = new Date(isoLike);
      if (Number.isNaN(d.getTime())) return isoLike ?? "";
      try {
        return new Intl.DateTimeFormat(i18n.language || "en", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    },
    [i18n.language]
  );

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      setCompletedChallenges([]);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCompletedChallenges([]);
          setIsLoading(false);
          return;
        }

        const raw = snapshot.data()?.CompletedChallenges;
        const array = Array.isArray(raw) ? raw : [];

        const challenges: CompletedChallenge[] = array
          .map((c: any): CompletedChallenge => ({
            id: String(c.id ?? c.challengeId ?? ""),
            chatId: c.chatId,
            title: String(
              c.chatId
                ? t(`challenges.${c.chatId}.title`, {
                    defaultValue: c.title || "",
                  })
                : c.title || t("challengeSaved")
            ),
            description: String(
              c.chatId
                ? t(`challenges.${c.chatId}.description`, {
                    defaultValue: c.description || "",
                  })
                : c.description || ""
            ),
            category: String(
              c.category
                ? t(`categories.${c.category}`, { defaultValue: c.category })
                : t("noCategory")
            ),
            imageUrl: c.imageUrl || "",
            completedAt: c.completedAt || "",
            selectedDays: c.selectedDays || 0,
            history: normalizeHistory(c.history),
          }))
          .filter((c) => !!c.id) // évite les entrées corrompues
          .sort((a, b) => {
            const da = new Date(a.completedAt).getTime() || 0;
            const db = new Date(b.completedAt).getTime() || 0;
            return db - da;
          });

        setCompletedChallenges(challenges);
        setIsLoading(false);
      },
      (error) => {
        console.error(error);
        Alert.alert(
          String(t("error")),
          String(t("errorLoadingCompletedChallenges"))
        );
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t, i18n.language]);

  const navigateToChallengeDetails = useCallback(
    (item: CompletedChallenge) => {
      const route =
        `/challenge-details/${encodeURIComponent(item.id)}` +
        `?title=${encodeURIComponent(item.title)}` +
        `&selectedDays=${item.selectedDays}` +
        `&completedDays=${item.selectedDays}` +
        `&category=${encodeURIComponent(item.category || String(t("noCategory")))}` +
        `&description=${encodeURIComponent(item.description || "")}` +
        `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;

      router.push(route as any);
    },
    [router, t]
  );

  const openHistoryModal = useCallback((item: CompletedChallenge) => {
    setSelectedHistory({
      title: item.title,
      history: item.history || [],
    });
    setHistoryModalVisible(true);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const renderChallenge: ListRenderItem<CompletedChallenge> = useCallback(
    ({ item, index }) => {
      const percentLabel = "100%";

      return (
        <Animated.View
          entering={FadeInUp.delay(index * 80)}
          style={styles.cardWrapper}
        >
          <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => navigateToChallengeDetails(item)}
            activeOpacity={0.9}
            accessibilityLabel={String(
              t("viewChallengeDetails", { title: item.title })
            )}
            accessibilityHint={String(t("viewDetails"))}
            testID={`challenge-card-${item.id}`}
          >
            {/* Glow subtil haut de carte */}
            <View style={styles.cardGlow} />

            <LinearGradient
              colors={[
                withAlpha(currentTheme.colors.cardBackground, 0.98),
                withAlpha(currentTheme.colors.cardBackground, 0.86),
              ]}
              style={[
                styles.card,
                {
                  borderColor: isDarkMode
  ? withAlpha("#FFFFFF", 0.14)
  : withAlpha("#000000", 0.08),

                },
              ]}
            >
              {item.imageUrl ? (
                <ExpoImage
                  source={{ uri: item.imageUrl }}
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
              ) : (
                <View
                  style={[
                    styles.placeholderImage,
                    { backgroundColor: currentTheme.colors.overlay },
                  ]}
                >
                  <Ionicons
                    name="image-outline"
                    size={normalizeSize(30)}
                    color={currentTheme.colors.textSecondary}
                  />
                </View>
              )}

              <View style={styles.cardContent}>
                {/* Ligne haute : catégorie + pill "Terminé" */}
                <View style={styles.cardTopRow}>
                  <View style={styles.categoryPill}>
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

                  <View style={styles.completedPill}>
                    <Ionicons
                      name="checkmark-done-outline"
                      size={normalizeSize(13)}
                      color="#0b1120"
                    />
                    <Text style={styles.completedPillText} numberOfLines={1}>
                      {t("completedShort", { defaultValue: "Terminé" })}
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
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.title}
                </Text>

                {!!item.description && (
                  <Text
                    style={[
                      styles.challengeDescription,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    
                  >
                    {item.description}
                  </Text>
                )}

                {/* Ligne méta : date + jours + chip 100% */}
                <View style={styles.metaRow}>
                  <View style={styles.metaLeft}>
                    <View style={styles.metaRowLine}>
                      <Ionicons
                        name="calendar-outline"
                        size={normalizeSize(13)}
                        color={currentTheme.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.challengeDate,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {t("completedOn")} {formatDate(item.completedAt)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.challengeCategory,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.selectedDays}/{item.selectedDays}{" "}
                      {String(t("days"))}
                    </Text>
                  </View>

                  <View style={styles.progressChip}>
                    <Ionicons
                      name="flame-outline"
                      size={normalizeSize(13)}
                      color={currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.progressChipText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {percentLabel}
                    </Text>
                  </View>
                </View>

               {/* Footer responsive : bouton principal + action compacte */}
                <View style={styles.footerRow}>
                  {/* Action compacte "Historique" (si dispo) */}
                  {item.history && item.history.length > 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.historyIconButton,
                        {
                          borderColor: isDarkMode
                            ? withAlpha("#FFFFFF", 0.14)
                            : withAlpha("#000000", 0.10),
                          backgroundColor: isDarkMode
                            ? withAlpha("#FFFFFF", 0.06)
                            : withAlpha("#000000", 0.04),
                        },
                      ]}
                      onPress={() => openHistoryModal(item)}
                      accessibilityLabel={String(t("history"))}
                      accessibilityHint={String(t("viewHistoryHint"))}
                      accessibilityRole="button"
                      testID={`history-button-${item.id}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={normalizeSize(16)}
                        color={currentTheme.colors.secondary}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.historyIconPlaceholder} />
                  )}

                  {/* Bouton principal : Voir détails (toujours) */}
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => navigateToChallengeDetails(item)}
                    accessibilityLabel={String(
                      t("viewChallengeDetails", { title: item.title })
                    )}
                    accessibilityHint={String(t("viewDetails"))}
                    accessibilityRole="button"
                    testID={`view-details-${item.id}`}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                      style={styles.viewButtonGradient}
                    >
                      <View style={styles.viewButtonContent}>
                        <Text style={[styles.viewButtonText, { color: "#0b1120" }]} numberOfLines={1}>
                          {t("viewDetails")}
                        </Text>
                        <Ionicons name="chevron-forward" size={normalizeSize(14)} color="#0b1120" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [
      navigateToChallengeDetails,
      openHistoryModal,
      currentTheme,
      t,
      isDarkMode,
      formatDate,
    ]
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
            {String(t("loadingCompletedChallenges") || t("loadingProfile"))}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (completedChallenges.length === 0) {
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
          {/* Orbes */}
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
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

          <CustomHeader
            title={String(t("completedChallengesScreenTitle"))}
            backgroundColor="transparent"
            useBlur={false}
            showHairline={false}
          />

          <View style={styles.noChallengesContainer}>
            <Animated.View
              entering={FadeInUp.delay(100)}
              style={styles.noChallengesContent}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={normalizeSize(60)}
                color={currentTheme.colors.textSecondary}
                accessibilityLabel={String(t("noCompletedChallengesIcon"))}
              />
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
                {String(t("noCompletedChallenges"))}
              </Text>
              <Text
                style={[
                  styles.noChallengesSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {String(t("completeChallengesToSeeHere"))}
              </Text>
            </Animated.View>
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
        {/* Orbes */}
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
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

        <CustomHeader
          title={String(t("completedChallengesScreenTitle"))}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <View style={styles.container}>
          <FlatList
            data={completedChallenges}
            renderItem={renderChallenge}
            keyExtractor={(item) => `${item.id}_${item.completedAt}`}
            contentContainerStyle={[
              styles.listContent,
              { flexGrow: 1, paddingBottom: bottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            getItemLayout={(_, index) => ({
              length: normalizeSize(ITEM_HEIGHT + SPACING * 1.5),
              offset: normalizeSize(ITEM_HEIGHT + SPACING * 1.5) * index,
              index,
            })}
            contentInset={{ top: SPACING, bottom: 0 }}
          />

          {selectedHistory && (
            <Modal
              visible={historyModalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setHistoryModalVisible(false)}
            >
              <View
                style={[
                  styles.modalContainer,
                  {
                    backgroundColor: withAlpha(
                      currentTheme.colors.overlay,
                      0.7
                    ),
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    withAlpha(currentTheme.colors.cardBackground, 0.98),
                    withAlpha(currentTheme.colors.cardBackground, 0.92),
                  ]}
                  style={styles.modalContent}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      {
                        color: isDarkMode
                          ? currentTheme.colors.textPrimary
                          : "#000000",
                      },
                    ]}
                  >
                    {String(t("historyOf"))} {selectedHistory.title}
                  </Text>

                  <FlatList
                    data={selectedHistory.history}
                    keyExtractor={(_, i) => `${i}`}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <Animated.View
                        entering={FadeInUp.delay(80)}
                        style={[
                          styles.historyItem,
                          {
                            borderBottomColor: withAlpha(
                              currentTheme.colors.textSecondary,
                              0.22
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyText,
                            {
                              color: isDarkMode
                                ? currentTheme.colors.textPrimary
                                : "#000000",
                            },
                          ]}
                        >
                          {String(t("completedOnDate"))}{" "}
                          {formatDate(item.completedAt)} - {item.selectedDays}{" "}
                          {String(t("days"))}
                        </Text>
                      </Animated.View>
                    )}
                  />

                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setHistoryModalVisible(false)}
                    accessibilityLabel={String(t("closeModal"))}
                    accessibilityHint={String(t("closeModalHint"))}
                    accessibilityRole="button"
                    testID="close-modal-button"
                  >
                    <LinearGradient
                      colors={[
                        currentTheme.colors.secondary,
                        currentTheme.colors.primary,
                      ]}
                      style={styles.closeButtonGradient}
                    >
                      <Text
                        style={[
                          styles.closeButtonText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        {String(t("close"))}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </Modal>
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
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  container: {
    flex: 1,
  },
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
  bgOrbBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: SCREEN_WIDTH * 0.55,
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
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    position: "relative",
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingBottom: normalizeSize(80),
  },
  cardWrapper: {
  marginBottom: SPACING * 1.15,
  borderRadius: normalizeSize(24),
  shadowColor: "#000",
  shadowOffset: { width: 0, height: normalizeSize(10) },
  shadowOpacity: Platform.OS === "ios" ? 0.14 : 0,
  shadowRadius: normalizeSize(18),
  elevation: Platform.OS === "android" ? 3 : 0,
},
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    alignSelf: "center",
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
  card: {
  flexDirection: "row",
  alignItems: "center",
  padding: normalizeSize(IS_COMPACT ? 14 : 16),
  borderRadius: normalizeSize(24),
  borderWidth: StyleSheet.hairlineWidth,
  minHeight: ITEM_HEIGHT,
},
 cardImage: {
  width: normalizeSize(72),
  height: normalizeSize(72),
  borderRadius: normalizeSize(18),
  marginRight: SPACING * 1.05,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
},
placeholderImage: {
  width: normalizeSize(72),
  height: normalizeSize(72),
  borderRadius: normalizeSize(18),
  justifyContent: "center",
  alignItems: "center",
  marginRight: SPACING * 1.05,
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
  completedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: normalizeSize(8),
    paddingVertical: normalizeSize(3),
    borderRadius: 999,
    backgroundColor: "#BBF7D0",
  },
  completedPillText: {
    fontSize: normalizeSize(11),
    fontFamily: "Comfortaa_700Bold",
    color: "#0b1120",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  challengeTitle: {
    fontSize: normalizeSize(17),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  challengeDescription: {
    fontSize: normalizeSize(13.5),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalizeSize(6),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: normalizeSize(2),
    marginBottom: normalizeSize(6),
  },
  metaLeft: {
    flex: 1,
  },
  metaRowLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: normalizeSize(2),
  },
  challengeDate: {
    fontSize: normalizeSize(12.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  challengeCategory: {
    fontSize: normalizeSize(12.5),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  progressChip: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: normalizeSize(8),
  paddingVertical: normalizeSize(3),
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.08)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
},
progressChipText: {
  fontSize: normalizeSize(11.5),
  fontFamily: "Comfortaa_700Bold",
  marginLeft: 4,
  includeFontPadding: false,
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: I18nManager.isRTL ? "right" : "left",
},
 footerRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: normalizeSize(10),
  marginTop: normalizeSize(8),
},

  historyButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(13),
    includeFontPadding: false,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  viewButton: {
  borderRadius: normalizeSize(18),
  overflow: "hidden",
  flex: 1,
  minWidth: normalizeSize(140),
},
historyIconButton: {
  width: normalizeSize(40),
  height: normalizeSize(40),
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
  flexShrink: 0,
},
historyIconPlaceholder: {
  width: normalizeSize(40),
  height: normalizeSize(40),
  flexShrink: 0,
},
  viewButtonGradient: {
    paddingVertical: normalizeSize(9),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  viewButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14.5),
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
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  noChallengesContainer: {
    flex: 1,
  },
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: SPACING,
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: normalizeSize(25),
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  modalTitle: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  historyItem: {
    paddingVertical: SPACING / 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  closeButton: {
    marginTop: SPACING,
    borderRadius: normalizeSize(18),
    overflow: "hidden",
  },
  closeButtonGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  closeButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
});
