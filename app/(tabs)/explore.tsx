import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Keyboard,
  InteractionManager,
} from "react-native";
import { Image as RNImage } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import BannerSlot from "@/components/BannerSlot";
import { useTutorial } from "../../context/TutorialContext";
import TutorialModal from "../../components/TutorialModal";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useGateForGuest from "@/hooks/useGateForGuest";
import RequireAuthModal from "@/components/RequireAuthModal";

// ---------- Helpers globaux (UX / erreurs) ----------

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Hauteur item stable pour getItemLayout (évite les re-calculs)
const ITEM_HEIGHT =
  SPACING * 1.5 + 180 /* image normalized base */ + 12 /* paddings approx */;

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

const normalizeText = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// true si tous les tokens du query matchent un début de mot
const tokensMatchWordStarts = (text: string, query: string) => {
  const t = normalizeText(text);
  const q = normalizeText(query).trim();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const words = t.split(/[^a-z0-9]+/i).filter(Boolean);
  return tokens.every((token) => words.some((w) => w.startsWith(token)));
};

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Alerte d’erreur centralisée (UX premium + i18n + haptics)
const showErrorAlert = (
  t: (key: string, opts?: Record<string, any>) => string,
  messageKey: string,
  fallbackMessage: string
) => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  } catch {
    // ignore
  }

  Alert.alert(
    t("error", { defaultValue: "Oups..." }),
    t(messageKey, { defaultValue: fallbackMessage })
  );
};

// ---------- Types ----------

interface Challenge {
  id: string;
  title: string;
  description: string;
  rawCategory: string;
  category: string;
  imageUrl?: string;
  approved?: boolean;
  participantsCount?: number;
  creatorId?: string;
  daysOptions: number[];
  chatId: string;
}

interface ChallengeRaw {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string | null;
  participantsCount?: number;
  creatorId?: string | null;
  daysOptions?: number[];
  chatId?: string | null;
  approved?: boolean;
}

// ---------- Styles dynamiques dépendants du thème ----------

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  searchContainer: {
    borderColor: isDarkMode ? currentTheme.colors.secondary : "#FF8C00",
    backgroundColor: currentTheme.colors.cardBackground,
  },
  searchInput: {
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
  },
  filterButton: {
    backgroundColor: currentTheme.colors.secondary,
  },
  filterText: {
    color: isDarkMode ? "#000000" : currentTheme.colors.textPrimary,
  },
  resetButton: {
    backgroundColor: currentTheme.colors.primary,
  },
  resetText: {
    color: currentTheme.colors.textPrimary,
  },
  modalOverlay: {
    backgroundColor: currentTheme.colors.overlay,
  },
  modalTitle: {
    color: currentTheme.colors.textPrimary,
  },
  modalItemText: {
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
  },
  cardGradient: {
    borderColor: isDarkMode ? currentTheme.colors.secondary : "#FF8C00",
  },
  cardTitle: {
    color: currentTheme.colors.textPrimary,
  },
  cardCategory: {
    color: currentTheme.colors.trophy,
  },
  cardParticipants: {
    color: currentTheme.colors.trophy,
  },
  bookmarkButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  emptyTitle: {
    color: currentTheme.colors.textPrimary,
  },
  emptySubtitle: {
    color: currentTheme.colors.textSecondary,
  },
  tutorialModalContent: {
    backgroundColor: currentTheme.colors.cardBackground,
  },
  tutorialTitle: {
    color: currentTheme.colors.textPrimary,
  },
  tutorialDescription: {
    color: currentTheme.colors.textSecondary,
  },
  tutorialButton: {
    backgroundColor: currentTheme.colors.primary,
  },
  tutorialButtonText: {
    color: currentTheme.colors.textPrimary,
  },
});

// ---------- Header (search + filtres) ----------

const ExploreHeader = React.memo(
  ({
    searchQuery,
    categoryFilter,
    originFilter,
    availableCategories,
    onSearchChange,
    onResetFilters,
    onCategorySelect,
    onOriginToggle,
    onToggleCategoryModal,
    isCategoryModalVisible,
    onCloseCategoryModal,
    currentTheme,
    isDarkMode,
    inputRef,
  }: {
    searchQuery: string;
    categoryFilter: string;
    originFilter: string;
    availableCategories: string[];
    onSearchChange: (text: string) => void;
    onResetFilters: () => void;
    onCategorySelect: (cat: string) => void;
    onOriginToggle: () => void;
    onToggleCategoryModal: () => void;
    isCategoryModalVisible: boolean;
    onCloseCategoryModal: () => void;
    currentTheme: Theme;
    isDarkMode: boolean;
    inputRef: React.RefObject<TextInput>;
  }) => {
    const { t } = useTranslation();
    const dynamicStyles = useMemo(
      () => getDynamicStyles(currentTheme, isDarkMode),
      [currentTheme, isDarkMode]
    );

    return (
      <Animated.View entering={FadeInUp.delay(100)} style={styles.headerWrapper}>
        {/* Barre de recherche */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <LinearGradient
            colors={[currentTheme.colors.cardBackground, currentTheme.colors.cardBackground + "F0"]}
            style={[styles.searchContainer, dynamicStyles.searchContainer]}
          >
            <Ionicons
              name="search"
              size={normalizeSize(20)}
              color={currentTheme.colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, dynamicStyles.searchInput]}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={searchQuery}
              onChangeText={onSearchChange}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={Keyboard.dismiss}
              autoCapitalize="none"
              blurOnSubmit={false}
              enterKeyHint="search"
              keyboardAppearance={isDarkMode ? "dark" : "light"}
              onFocus={() => {
                inputRef.current?.focus();
              }}
              accessibilityLabel={t("searchPlaceholder")}
            />
            {!!searchQuery && (
              <TouchableOpacity
                onPress={() => {
                  onSearchChange("");
                  Keyboard.dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("clearSearch")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle"
                  size={normalizeSize(20)}
                  color={currentTheme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            onPress={onOriginToggle}
            style={[styles.filterButton, dynamicStyles.filterButton]}
            accessibilityRole="button"
            accessibilityLabel={t("origin.filter")}
          >
            <Ionicons
              name="options-outline"
              size={normalizeSize(18)}
              color={isDarkMode ? "#000000" : currentTheme.colors.textPrimary}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterText, dynamicStyles.filterText]}>
              {originFilter === "Existing"
                ? t("origin.existing")
                : originFilter === "Created"
                ? t("origin.created")
                : t("origin.all")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onToggleCategoryModal}
            style={[styles.filterButton, dynamicStyles.filterButton]}
            accessibilityRole="button"
            accessibilityLabel={t("chooseCategory")}
          >
            <Ionicons
              name="filter-outline"
              size={normalizeSize(18)}
              color={isDarkMode ? "#000000" : currentTheme.colors.textPrimary}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterText, dynamicStyles.filterText]}>
              {categoryFilter === "All"
                ? t("category")
                : t(`categories.${categoryFilter}`, {
                    defaultValue: capitalize(categoryFilter),
                  })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bouton reset */}
        <TouchableOpacity
          onPress={onResetFilters}
          style={[styles.resetButton, dynamicStyles.resetButton]}
          accessibilityRole="button"
          accessibilityLabel={t("resetFilters")}
        >
          <Ionicons
            name="refresh-outline"
            size={normalizeSize(18)}
            color={currentTheme.colors.textPrimary}
            style={styles.resetIcon}
          />
          <Text style={[styles.resetText, dynamicStyles.resetText]}>
            {t("resetFilters")}
          </Text>
        </TouchableOpacity>

        {/* Modal des catégories */}
        <Modal
          visible={isCategoryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={onCloseCategoryModal}
        >
          <TouchableOpacity
            style={[styles.modalOverlay, dynamicStyles.modalOverlay]}
            activeOpacity={1}
            onPressOut={onCloseCategoryModal}
          >
            <LinearGradient
              colors={[currentTheme.colors.cardBackground, currentTheme.colors.cardBackground + "F0"]}
              style={styles.modalContainer}
            >
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>
                {t("chooseCategory")}
              </Text>
              <ScrollView>
                {availableCategories.map((rawCat) => {
                  const label =
                    rawCat === "All"
                      ? t("category")
                      : t(`categories.${rawCat}`, {
                          defaultValue: capitalize(rawCat),
                        });

                  return (
                    <TouchableOpacity
                      key={rawCat}
                      onPress={() => {
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                        onCategorySelect(rawCat);
                      }}
                      style={[
                        styles.modalItem,
                        {
                          borderBottomColor: withAlpha(
                            currentTheme.colors.border,
                            isDarkMode ? 0.6 : 0.4
                          ),
                        },
                      ]}
                    >
                      <Ionicons
                        name="pricetag-outline"
                        size={normalizeSize(18)}
                        color={currentTheme.colors.secondary}
                        style={styles.modalIcon}
                      />
                      <Text
                        style={[
                          styles.modalItemText,
                          dynamicStyles.modalItemText,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </LinearGradient>
          </TouchableOpacity>
        </Modal>
      </Animated.View>
    );
  }
);

// ---------- Card séparée (memo + anim) ----------

const ChallengeCard = React.memo(function ChallengeCard({
  item,
  index,
  onPress,
  onToggleSaved,
  saved,
  pending,
  theme,
  isDark,
  t,
}: {
  item: Challenge;
  index: number;
  onPress: () => void;
  onToggleSaved: () => void;
  saved: boolean;
  pending: boolean;
  theme: Theme;
  isDark: boolean;
  t: (k: string, o?: any) => string;
}) {
  const scale = useSharedValue(1);
  const rStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: scale.value }],
    }),
    []
  );
  const dynamicStyles = useMemo(
    () => getDynamicStyles(theme, isDark),
    [theme, isDark]
  );

  const onPressBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = 0.94;
    scale.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.7 });
    onToggleSaved();
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(120 + index * 35)}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.cardContainer}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <LinearGradient
          colors={[theme.colors.cardBackground, theme.colors.cardBackground + "F0"]}
          style={[styles.cardGradient, dynamicStyles.cardGradient]}
        >
          <RNImage
            source={
              item.imageUrl
                ? { uri: item.imageUrl }
                : require("../../assets/images/chalkboard.png")
            }
            defaultSource={require("../../assets/images/chalkboard.png")}
            style={styles.cardImage}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={[withAlpha(theme.colors.overlay, 0.1), withAlpha("#000", 0.8)]}
            style={styles.cardOverlay}
          >
            <Text
              style={[styles.cardTitle, dynamicStyles.cardTitle]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.cardCategory, dynamicStyles.cardCategory]}
              numberOfLines={1}
            >
              {item.category}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="people"
                size={normalizeSize(14)}
                color={theme.colors.trophy}
                style={{ marginRight: 4 }}
              />
              <Text
  style={[
    styles.cardParticipants,
    getDynamicStyles(theme, isDark).cardParticipants,
  ]}
>
  {t("participantsLabel", { defaultValue: "Participants" })} :{" "}
  {item.participantsCount ?? 0}
</Text>

            </View>
          </LinearGradient>
          <TouchableOpacity
            onPress={onPressBookmark}
            disabled={pending}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.bookmarkButton,
              dynamicStyles.bookmarkButton,
            ]}
            accessibilityRole="button"
            accessibilityLabel={saved ? t("removeFromSaved") : t("saveChallenge")}
          >
            <Animated.View style={rStyle}>
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={normalizeSize(22)}
                color={saved ? theme.colors.secondary : theme.colors.textPrimary}
              />
            </Animated.View>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ---------- Screen principal ----------

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const searchRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Challenge>>(null);
  const [rawChallenges, setRawChallenges] = useState<ChallengeRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [originFilter, setOriginFilter] = useState<"Existing" | "Created" | "All">("Existing");
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [optimisticSaved, setOptimisticSaved] = useState<Set<string>>(new Set());

  const router = useRouter();
  const { isSaved, addChallenge, removeChallenge } = useSavedChallenges();
  const { theme } = useTheme();
  const { tutorialStep, setTutorialStep, skipTutorial, isTutorialActive } = useTutorial();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [adHeight, setAdHeight] = useState(0);
  const unmountedRef = useRef(false);

  const listBottomPadding =
    (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom + normalizeSize(20);

  const { gate, modalVisible, closeGate } = useGateForGuest();

  const shouldAnimateItems =
    !searchQuery && categoryFilter === "All" && originFilter === "All";

  const dynamicStyles = useMemo(
    () => getDynamicStyles(currentTheme, isDarkMode),
    [currentTheme, isDarkMode]
  );

  const safeNavigate = (path: string) => {
    if (path.startsWith("/challenge-details")) {
      if (gate()) router.push(path);
      return;
    }
    router.push(path);
  };

  // Firestore fetch
  useEffect(() => {
    const q = query(
      collection(db, "challenges"),
      where("approved", "==", true),
      orderBy("participantsCount", "desc"),
      orderBy("createdAt", "desc")
    );
    unmountedRef.current = false;

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const fetched: ChallengeRaw[] = querySnapshot.docs.map((snap) => {
          const d = snap.data() as any;
          return {
            id: snap.id,
            chatId: d.chatId ?? snap.id,
            title: d.title,
            description: d.description,
            category: d.category ?? "Miscellaneous",
            imageUrl: d.imageUrl ?? null,
            participantsCount: d.participantsCount ?? 0,
            creatorId: d.creatorId ?? null,
            daysOptions: d.daysOptions ?? [7, 14, 21, 30, 60, 90, 180, 365],
            approved: true,
          };
        });

        if (!unmountedRef.current) {
          setRawChallenges(fetched);
          setLoading(false);
        }

        InteractionManager.runAfterInteractions(() => {
          const urls = Array.from(
            new Set(fetched.map((c) => c.imageUrl).filter(Boolean) as string[])
          ).slice(0, 20);
          urls.forEach((u) => RNImage.prefetch(u).catch(() => {}));
        });
      },
      (error) => {
        console.error(error);
        if (!unmountedRef.current) {
          setLoading(false);
          showErrorAlert(
            t,
            "loadChallengesFailed",
            "Impossible de charger les défis. Réessaie dans un instant."
          );
        }
      }
    );
    return () => {
      unmountedRef.current = true;
      unsubscribe();
    };
  }, [t]);

  // Projection vue traduite
  const challenges: Challenge[] = useMemo(() => {
    return rawChallenges.map((r) => {
      const rawCat = r.category ?? "Miscellaneous";
      return {
        id: r.id,
        chatId: r.chatId ?? r.id,
        rawCategory: rawCat,
        category: t(`categories.${rawCat}`, { defaultValue: rawCat }),
        title: (r.chatId
          ? t(`challenges.${r.chatId}.title`, { defaultValue: r.title })
          : r.title) as string,
        description:
          (r.chatId
            ? t(`challenges.${r.chatId}.description`, {
                defaultValue: r.description,
              })
            : r.description) || (t("noDescription") as string),
        imageUrl: r.imageUrl ?? undefined,
        participantsCount: r.participantsCount ?? 0,
        creatorId: r.creatorId ?? undefined,
        daysOptions: r.daysOptions ?? [7, 14, 21, 30, 60, 90, 180, 365],
        approved: true,
      };
    });
  }, [rawChallenges, t, i18n.language]);

  const availableCategories = useMemo(() => {
    const raws = rawChallenges.map((c) => c.category ?? "Miscellaneous");
    return ["All", ...Array.from(new Set(raws))];
  }, [rawChallenges]);

  const filteredChallenges = useMemo(() => {
    const base =
      !searchQuery && categoryFilter === "All" && originFilter === "All"
        ? challenges
        : challenges.filter((c) => {
            const matchesSearch = tokensMatchWordStarts(
              `${c.title} ${c.description}`,
              searchQuery
            );
            const matchesCategory =
              categoryFilter === "All" || c.rawCategory === categoryFilter;
            const matchesOrigin =
              originFilter === "All" ||
              (originFilter === "Existing" ? !c.creatorId : !!c.creatorId);
            return matchesSearch && matchesCategory && matchesOrigin;
          });

    if (!searchQuery) {
      return base
        .slice()
        .sort(
          (a, b) =>
            (b.participantsCount ?? 0) - (a.participantsCount ?? 0)
        );
    }

    const q = normalizeText(searchQuery).trim();
    const tokens = q.split(/\s+/).filter(Boolean);

    const score = (c: Challenge) => {
      const titleN = normalizeText(c.title);
      const descN = normalizeText(c.description);
      let s = 0;
      for (const token of tokens) {
        if (titleN.startsWith(token)) s += 120;
        else if (
          titleN
            .split(/[^a-z0-9]+/i)
            .some((w) => w.startsWith(token))
        )
          s += 100;
        else if (titleN.includes(token)) s += 40;

        if (
          descN
            .split(/[^a-z0-9]+/i)
            .some((w) => w.startsWith(token))
        )
          s += 30;
        else if (descN.includes(token)) s += 10;
      }
      s += Math.min(50, (c.participantsCount ?? 0) * 0.1);
      return s;
    };

    return base.slice().sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sb !== sa) return sb - sa;
      const pa = a.participantsCount ?? 0;
      const pb = b.participantsCount ?? 0;
      if (pb !== pa) return pb - pa;
      return a.title.localeCompare(b.title);
    });
  }, [challenges, searchQuery, categoryFilter, originFilter]);

  const toggleSaved = useCallback(
    (ch: Challenge) => {
      if (!gate()) return;

      const id = ch.id;
      const was = isSaved(id);

      setOptimisticSaved((prev) => {
        const next = new Set(prev);
        if (was) next.delete(id);
        else next.add(id);
        return next;
      });

      const p = was
        ? removeChallenge(id)
        : addChallenge({
            id: ch.id,
            title: ch.title,
            category: ch.category,
            description: ch.description,
            imageUrl: ch.imageUrl,
            daysOptions: ch.daysOptions,
            chatId: ch.chatId,
          });

      p.catch((err) => {
        console.error(err);
        showErrorAlert(
          t,
          "toggleFavoriteFailed",
          "Impossible de mettre à jour tes favoris. Réessaie dans un instant."
        );
        setOptimisticSaved((prev) => {
          const next = new Set(prev);
          if (was) next.add(id);
          else next.delete(id);
          return next;
        });
      });
    },
    [gate, isSaved, addChallenge, removeChallenge, t]
  );

  const onSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("All");
    setOriginFilter("Existing");
  }, []);

  const selectCategory = useCallback((cat: string) => {
    setCategoryFilter(cat);
    setIsCategoryModalVisible(false);
  }, []);

  const toggleCategoryModal = useCallback(
    () => setIsCategoryModalVisible((v) => !v),
    []
  );

  const closeCategoryModal = useCallback(
    () => setIsCategoryModalVisible(false),
    []
  );

  const toggleOrigin = useCallback(
    () =>
      setOriginFilter((o) =>
        o === "Existing" ? "Created" : o === "Created" ? "All" : "Existing"
      ),
    []
  );

  const scrollTop = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, []);

  useEffect(() => {
    scrollTop();
  }, [searchQuery, categoryFilter, originFilter, scrollTop]);

  const keyExtractor = useCallback((item: Challenge) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => (
      <ChallengeCard
        item={item}
        index={shouldAnimateItems ? index : 0}
        theme={currentTheme}
        isDark={isDarkMode}
        saved={optimisticSaved.has(item.id) ? true : isSaved(item.id)}
        pending={false}
        onPress={() =>
          safeNavigate(
            `/challenge-details/${item.id}?title=${encodeURIComponent(
              item.title
            )}&category=${encodeURIComponent(
              item.category
            )}&description=${encodeURIComponent(item.description)}`
          )
        }
        onToggleSaved={() => toggleSaved(item)}
        t={t}
      />
    ),
    [currentTheme, isDarkMode, optimisticSaved, isSaved, toggleSaved, t, shouldAnimateItems]
  );

  if (loading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
            withAlpha(currentTheme.colors.primary, 0.13),
          ]}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: SPACING,
          }}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={{
              color: currentTheme.colors.textPrimary,
              marginTop: normalizeSize(20),
              fontSize: normalizeSize(18),
              fontFamily: "Comfortaa_400Regular",
              textAlign: "center",
            }}
          >
            {t("loadingChallenges")}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={tabBarHeight}
      >
        <CustomHeader title={t("exploreChallenges")} />
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
            withAlpha(currentTheme.colors.primary, 0.12),
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

          <FlatList
            ref={listRef}
            data={filteredChallenges}
            keyExtractor={keyExtractor}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={30}
            key={`${categoryFilter}-${originFilter}-${!!searchQuery}`}
            windowSize={12}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={false}
            extraData={{
              optimisticSaved,
              searchQuery,
              categoryFilter,
              originFilter,
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: listBottomPadding,
              paddingHorizontal: SPACING / 2,
            }}
            ListHeaderComponent={
              <ExploreHeader
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                originFilter={originFilter}
                availableCategories={availableCategories}
                onSearchChange={onSearchChange}
                onResetFilters={resetFilters}
                onCategorySelect={selectCategory}
                onOriginToggle={toggleOrigin}
                onToggleCategoryModal={toggleCategoryModal}
                isCategoryModalVisible={isCategoryModalVisible}
                onCloseCategoryModal={closeCategoryModal}
                currentTheme={currentTheme}
                isDarkMode={isDarkMode}
                inputRef={searchRef}
              />
            }
            ListEmptyComponent={
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "F0",
                ]}
                style={styles.emptyContainer}
              >
                <Animated.View
                  entering={FadeInUp.delay(200)}
                  style={styles.emptyContent}
                >
                  <Ionicons
                    name="search-outline"
                    size={normalizeSize(60)}
                    color={currentTheme.colors.textSecondary}
                    accessibilityLabel={t("noChallengesIcon")}
                  />
                  <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>
                    {t("noChallengesFound")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      dynamicStyles.emptySubtitle,
                    ]}
                  >
                    {t("tryDifferentSearch")}
                  </Text>
                </Animated.View>
              </LinearGradient>
            }
            renderItem={renderItem}
          />
        </LinearGradient>
      </KeyboardAvoidingView>

      {showBanners && !isTutorialActive && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: tabBarHeight + insets.bottom,
            alignItems: "center",
            zIndex: 9999,
            backgroundColor: "transparent",
            paddingBottom: 6,
          }}
          pointerEvents="box-none"
        >
          <BannerSlot onHeight={(h) => setAdHeight(h)} />
        </View>
      )}

      {isTutorialActive && tutorialStep >= 4 && (
        <TutorialModal
          step={tutorialStep}
          onNext={() => setTutorialStep(5)}
          onStart={() => {}}
          onSkip={skipTutorial}
          onFinish={() => {
            skipTutorial();
            setTutorialStep(0);
          }}
        />
      )}

      <RequireAuthModal visible={modalVisible} onClose={closeGate} />
    </GlobalLayout>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING * 1.5,
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: normalizeSize(12),
    paddingHorizontal: SPACING,
    borderWidth: 2.5,
    borderRadius: normalizeSize(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.28,
    shadowRadius: normalizeSize(8),
    minHeight: normalizeSize(48),
    elevation: 8,
    paddingRight: normalizeSize(8),
  },
  searchIcon: {
    marginRight: normalizeSize(8),
  },
  searchInput: {
    flex: 1,
    paddingVertical: normalizeSize(12),
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  filtersContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: normalizeSize(12),
    marginHorizontal: SPACING / 4,
    borderRadius: normalizeSize(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.25,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  filterIcon: {
    marginRight: normalizeSize(6),
  },
  filterText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  resetButton: {
    alignSelf: "center",
    marginTop: normalizeSize(12),
    paddingHorizontal: normalizeSize(20),
    paddingVertical: normalizeSize(10),
    borderRadius: normalizeSize(20),
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(3) },
    shadowOpacity: 0.22,
    shadowRadius: normalizeSize(6),
    elevation: 6,
  },
  resetIcon: {
    marginRight: normalizeSize(6),
  },
  resetText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING,
  },
  modalContainer: {
    borderRadius: normalizeSize(20),
    padding: SPACING,
    maxHeight: SCREEN_HEIGHT * 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  modalTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(8),
  },
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
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(12),
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalIcon: {
    marginRight: normalizeSize(8),
  },
  modalItemText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  cardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.32,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  cardContainer: {
    borderRadius: normalizeSize(20),
    overflow: "hidden",
  },
  cardGradient: {
    borderWidth: 2.5,
    borderRadius: normalizeSize(20),
  },
  cardImage: {
    width: "100%",
    height: normalizeSize(180),
    resizeMode: "cover",
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: normalizeSize(12),
  },
  cardTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(6),
  },
  cardCategory: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  cardParticipants: {
    fontSize: normalizeSize(14),
    marginTop: normalizeSize(4),
    fontFamily: "Comfortaa_400Regular",
  },
  bookmarkButton: {
    position: "absolute",
    top: normalizeSize(12),
    right: normalizeSize(12),
    padding: normalizeSize(8),
    borderRadius: normalizeSize(20),
  },
  emptyContainer: {
    marginTop: normalizeSize(50),
    marginHorizontal: SPACING,
    padding: SPACING,
    borderRadius: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.32,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: normalizeSize(12),
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(6),
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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
  tutorialModal: {
    margin: SPACING,
    width: SCREEN_WIDTH * 0.8,
  },
  tutorialModalContent: {
    padding: normalizeSize(20),
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  tutorialTitle: {
    fontSize: normalizeSize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(12),
    textAlign: "center",
  },
  tutorialDescription: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalizeSize(20),
    textAlign: "center",
  },
  tutorialButton: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(24),
    borderRadius: normalizeSize(16),
    alignItems: "center",
  },
  tutorialButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
});
