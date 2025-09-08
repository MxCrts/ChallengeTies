import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  PixelRatio,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Image } from "react-native";
import { Image as RNImage } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import TutorialModal from "../../components/TutorialModal";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Dimensions responsives
const SPACING = 18; // Aligné avec Notifications.tsx, FocusScreen.tsx, etc.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle
  return Math.round(size * scale);
};

// rgba helper (hex/rgb -> rgba avec alpha)
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r="0", g="0", b="0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};


const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const BANNER_HEIGHT = normalizeSize(50);

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
  }) => {
    const { t, i18n } = useTranslation();
    const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);

    useEffect(() => {}, [i18n.language]);

    return (
      <Animated.View
        entering={FadeInUp.delay(100)}
        style={styles.headerWrapper}
      >

        {/* Barre de recherche */}
        <LinearGradient
          colors={[
            currentTheme.colors.cardBackground,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={[styles.searchContainer, dynamicStyles.searchContainer]}
        >
          <Ionicons
            name="search"
            size={normalizeSize(20)}
            color={currentTheme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, dynamicStyles.searchInput]}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCorrect={false}
            blurOnSubmit={false}
            accessibilityLabel={t("searchPlaceholder")}
          />
        </LinearGradient>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            onPress={onOriginToggle}
            style={[styles.filterButton, dynamicStyles.filterButton]}
          >
            <Ionicons
              name="options-outline"
              size={normalizeSize(18)}
              color={isDarkMode ? "#000000" : currentTheme.colors.textPrimary}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterText, dynamicStyles.filterText]}>
              {t(originFilter)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onToggleCategoryModal}
            style={[styles.filterButton, dynamicStyles.filterButton]}
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
              colors={[
                currentTheme.colors.cardBackground,
                currentTheme.colors.cardBackground + "F0",
              ]}
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
                      onPress={() => onCategorySelect(rawCat)}
                      style={[
  styles.modalItem,
  { borderBottomColor: withAlpha(currentTheme.colors.border, isDarkMode ? 0.6 : 0.4) },
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

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [originFilter, setOriginFilter] = useState("Existing");
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pendingFavorites, setPendingFavorites] = useState<{
    [key: string]: boolean;
  }>({});
const npa = (globalThis as any).__NPA__ === true;

  const router = useRouter();
  const { isSaved, addChallenge, removeChallenge } = useSavedChallenges();
  const { theme } = useTheme();
  const { tutorialStep, setTutorialStep, skipTutorial, isTutorialActive } =
    useTutorial();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
const { showBanners } = useAdsVisibility();
 const insets = useSafeAreaInsets();
const tabBarHeight = useBottomTabBarHeight();

const bannerHeight = BANNER_HEIGHT;               // ta constante
const bannerLift = tabBarHeight + insets.bottom + normalizeSize(8); // ↑ décale la bannière au-dessus de la TabBar

const listBottomPadding =
  (showBanners ? bannerHeight : 0) + tabBarHeight + insets.bottom + normalizeSize(20);


  // Force re-render sur changement de langue
  useEffect(() => {}, [i18n.language]);

  // Firestore fetch
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetched: Challenge[] = querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            const rawCat = data.category || "Miscellaneous";
            return {
              id: doc.id,
              chatId: data.chatId || doc.id,
              rawCategory: rawCat,
              category: t(`categories.${rawCat}`, { defaultValue: rawCat }),
              title: data.chatId
                ? t(`challenges.${data.chatId}.title`, {
                    defaultValue: data.title,
                  })
                : data.title,
              description: data.chatId
                ? t(`challenges.${data.chatId}.description`, {
                    defaultValue: data.description,
                  })
                : data.description || t("noDescription"),
              imageUrl: data.imageUrl || null,
              participantsCount: data.participantsCount || 0,
              creatorId: data.creatorId || null,
              daysOptions: data.daysOptions || [
                7, 14, 21, 30, 60, 90, 180, 365,
              ],
              approved: data.approved ?? false,
            };
          })
          .filter((challenge) => challenge.approved === true);

        const urls = fetched.map((ch) => ch.imageUrl).filter(Boolean);
        Promise.all(urls.map((url) => RNImage.prefetch(url))).catch((err) =>
          console.log("Erreur de préchargement d'image :", err)
        );
        setChallenges(fetched);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        Alert.alert(t("error"), t("loadChallengesFailed"));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [t]);

  const availableCategories = useMemo(() => {
    const raws = challenges.map((c) => c.rawCategory);
    return ["All", ...Array.from(new Set(raws))];
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const matchesSearch = c.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "All" || c.rawCategory === categoryFilter;
      const matchesOrigin =
        originFilter === "All" ||
        (originFilter === "Existing" ? !c.creatorId : !!c.creatorId);
      return matchesSearch && matchesCategory && matchesOrigin;
    });
  }, [challenges, searchQuery, categoryFilter, originFilter]);

  const toggleSaved = useCallback(
  async (ch: Challenge) => {
    const id = ch.id;
    const was = isSaved(id);
    // Optimistic UI
    setPendingFavorites((p) => ({ ...p, [id]: !was }));
    try {
      if (was) {
        await removeChallenge(id);
      } else {
        await addChallenge({
          id: ch.id,
          title: ch.title,
          category: ch.category,
          description: ch.description,
          imageUrl: ch.imageUrl,
          daysOptions: ch.daysOptions,
          chatId: ch.chatId,
        });
      }
      // Nettoyage de l'état pending
      setPendingFavorites((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error(err);
      Alert.alert(t("error"), t("toggleFavoriteFailed"));
      // rollback
      setPendingFavorites((p) => {
        const copy = { ...p };
        copy[id] = was;
        return copy;
      });
    }
  },
  [isSaved, addChallenge, removeChallenge, t]
);


  const onSearchChange = useCallback(
    (text: string) => setSearchQuery(text),
    []
  );
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
    () => setOriginFilter((o) => (o === "Existing" ? "Created" : "Existing")),
    []
  );

  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);

  if (loading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
    withAlpha(currentTheme.colors.background, 1),
    withAlpha(currentTheme.colors.cardBackground, 1),
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
  keyboardVerticalOffset={tabBarHeight}   // 👈 au lieu d’un nombre fixe
>
         <CustomHeader title={t("exploreChallenges")} />
        <LinearGradient
  colors={[
    withAlpha(currentTheme.colors.background, 1),
    withAlpha(currentTheme.colors.cardBackground, 1),
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
    data={filteredChallenges}
    keyExtractor={(item) => item.id}
    keyboardShouldPersistTaps="handled"
    initialNumToRender={10}
    windowSize={5}
    removeClippedSubviews
    showsVerticalScrollIndicator={false}
    stickyHeaderIndices={[0]}           // 👈 garde la barre de recherche visible
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
                    style={[styles.emptySubtitle, dynamicStyles.emptySubtitle]}
                  >
                    {t("tryDifferentSearch")}
                  </Text>
                </Animated.View>
              </LinearGradient>
            }
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInUp.delay(200 + index * 50)}
                style={styles.cardWrapper}
              >
                <TouchableOpacity
                  style={styles.cardContainer}
                  onPress={() =>
                    router.push(
                      `/challenge-details/${item.id}?title=${encodeURIComponent(
                        item.title
                      )}&category=${encodeURIComponent(
                        item.category
                      )}&description=${encodeURIComponent(item.description)}`
                    )
                  }
                >
                  <LinearGradient
                    colors={[
                      currentTheme.colors.cardBackground,
                      currentTheme.colors.cardBackground + "F0",
                    ]}
                    style={[styles.cardGradient, dynamicStyles.cardGradient]}
                  >
                    <Image
                      source={
                        item.imageUrl
                          ? { uri: item.imageUrl }
                          : require("../../assets/images/chalkboard.png")
                      }
                      style={styles.cardImage}
                    />
                    <LinearGradient
                      colors={[
    withAlpha(currentTheme.colors.overlay, 0.1),
    withAlpha("#000", 0.8),
  ]}
                      style={styles.cardOverlay}
                    >
                      <Text
                        style={[styles.cardTitle, dynamicStyles.cardTitle]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.cardCategory,
                          dynamicStyles.cardCategory,
                        ]}
                      >
                        {item.category}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
  <Ionicons
    name="people"
    size={normalizeSize(14)}
    color={currentTheme.colors.trophy}
    style={{ marginRight: 4 }}
  />
  <Text style={[styles.cardParticipants, dynamicStyles.cardParticipants]}>
    {`${item.participantsCount || 0} ${t("participants", {
      count: item.participantsCount || 0,
    })}`}
  </Text>
</View>
                    </LinearGradient>

                    <TouchableOpacity
                      onPress={() => toggleSaved(item)}
                      style={[
                        styles.bookmarkButton,
                        dynamicStyles.bookmarkButton,
                      ]}
                    >
                      <Ionicons
                        name={
                          pendingFavorites[item.id] !== undefined
                            ? pendingFavorites[item.id]
                              ? "bookmark"
                              : "bookmark-outline"
                            : isSaved(item.id)
                            ? "bookmark"
                            : "bookmark-outline"
                        }
                        size={normalizeSize(22)}
                        color={
                          pendingFavorites[item.id] !== undefined
                            ? pendingFavorites[item.id]
                              ? currentTheme.colors.secondary
                              : currentTheme.colors.textPrimary
                            : isSaved(item.id)
                            ? currentTheme.colors.secondary
                            : currentTheme.colors.textPrimary
                        }
                      />
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        </LinearGradient>
      </KeyboardAvoidingView>

      {showBanners && !isTutorialActive && (
  <View
    style={[
      styles.bannerContainer,
      { position: "absolute", left: 0, right: 0, bottom: bannerLift },
    ]}
    pointerEvents="auto"
  >
    <BannerAd
  unitId={adUnitIds.banner}
  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: npa }}
  onAdFailedToLoad={(err) => console.error("Échec chargement bannière", err)}
/>
  </View>
)}

      {isTutorialActive && tutorialStep >= 4 && (
  <TutorialModal
    step={tutorialStep}
    onNext={() => setTutorialStep(5)} // ← quand on clique sur "suivant" à l'étape 4
    onStart={() => {}}
    onSkip={skipTutorial}
    onFinish={() => {
      skipTutorial();
      setTutorialStep(0); // ← facultatif : reset pour les prochaines fois
    }}
  />
)}
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
  paddingHorizontal: SPACING,
  paddingVertical: SPACING * 1.5,
  backgroundColor: "transparent", // laisse le LinearGradient gérer
  // Optionnel: petite ombre quand sticky
  ...Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
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
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  searchIcon: {
    marginRight: normalizeSize(8),
  },
  searchInput: {
    flex: 1,
    paddingVertical: normalizeSize(10),
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
    shadowOpacity: 0.3,
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
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
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
    borderBottomColor: "#E0E0E0", // Valeur statique, ajustée dynamiquement si besoin
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
    shadowOpacity: 0.35,
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
    shadowOpacity: 0.35,
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
