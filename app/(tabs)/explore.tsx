import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  PixelRatio,
  StyleSheet,
} from "react-native";
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
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Fonction de normalisation des tailles pour la responsivité
const normalize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Constante pour les espacements
const SPACING = normalize(15);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const adUnitId = __DEV__
  ? TestIds.BANNER
  : "ca-app-pub-4725616526467159/3887969618";

interface Challenge {
  id: string;
  title: string;
  description: string;
  rawCategory: string;
  category: string;
  imageUrl?: string;
  participantsCount?: number;
  creatorId?: string;
  daysOptions: number[];
  chatId: string;
}

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
  }) => {
    const { t, i18n } = useTranslation();
    // force re-render on language change
    useEffect(() => {}, [i18n.language]);

    return (
      <Animated.View
        entering={FadeInUp.delay(100)}
        style={styles.headerContent}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("exploreChallenges")} />
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: currentTheme.colors.cardBackground,
              borderColor: currentTheme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={normalize(20)}
            color={currentTheme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchBar,
              { color: currentTheme.colors.textPrimary },
            ]}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCorrect={false}
            blurOnSubmit={false}
            accessibilityLabel={t("searchPlaceholder")}
            testID="search-input"
          />
        </View>

        <View style={styles.filtersWrapper}>
          <View style={styles.filtersContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: currentTheme.colors.secondary,
                },
              ]}
              onPress={onOriginToggle}
              accessibilityLabel={t("filterByOrigin", {
                origin: t(originFilter),
              })}
              testID="origin-filter-button"
            >
              <Ionicons
                name="options-outline"
                size={normalize(18)}
                color={currentTheme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t(originFilter)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: currentTheme.colors.secondary,
                },
              ]}
              onPress={onToggleCategoryModal}
              accessibilityLabel={t("chooseCategory")}
              testID="category-filter-button"
            >
              <Ionicons
                name="filter-outline"
                size={normalize(18)}
                color={currentTheme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {categoryFilter === "All"
                  ? t("category")
                  : t(`categories.${categoryFilter}`, {
                      defaultValue: capitalize(categoryFilter),
                    })}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.resetButton,
              {
                backgroundColor: currentTheme.colors.primary,
              },
            ]}
            onPress={onResetFilters}
            accessibilityLabel={t("resetFilters")}
            testID="reset-filters-button"
          >
            <Ionicons
              name="refresh-outline"
              size={normalize(20)}
              color={currentTheme.colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <Modal
          visible={isCategoryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={onCloseCategoryModal}
        >
          <TouchableOpacity
            style={[
              styles.modalOverlay,
              {
                backgroundColor: currentTheme.colors.overlay,
              },
            ]}
            activeOpacity={1}
            onPressOut={onCloseCategoryModal}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: currentTheme.colors.cardBackground,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: currentTheme.colors.textPrimary,
                    },
                  ]}
                >
                  {t("chooseCategory")}
                </Text>
                <TouchableOpacity
                  onPress={onCloseCategoryModal}
                  accessibilityLabel={t("closeModal")}
                  testID="close-modal-button"
                >
                  <Ionicons
                    name="close-outline"
                    size={normalize(24)}
                    color={currentTheme.colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {availableCategories.map((rawCat) => {
                  // Détermine le label traduit, avec fallback sur la version capitalisée
                  const label =
                    rawCat === "All"
                      ? t("category")
                      : t(`categories.${rawCat}`, {
                          defaultValue: capitalize(rawCat),
                        });

                  return (
                    <TouchableOpacity
                      key={rawCat}
                      style={[
                        styles.modalItem,
                        { borderBottomColor: currentTheme.colors.border },
                      ]}
                      onPress={() => onCategorySelect(rawCat)}
                      accessibilityLabel={t("selectCategory", {
                        category: label,
                      })}
                      testID={`category-item-${rawCat}`}
                    >
                      <Ionicons
                        name="pricetag-outline"
                        size={normalize(18)}
                        color={currentTheme.colors.secondary}
                        style={styles.modalItemIcon}
                      />
                      <Text
                        style={[
                          styles.modalItemText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
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
  const router = useRouter();
  const { isSaved, addChallenge, removeChallenge } = useSavedChallenges();
  const { theme } = useTheme();
  const { tutorialStep, setTutorialStep, skipTutorial, isTutorialActive } =
    useTutorial();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // re-render on language change
  useEffect(() => {}, [i18n.language]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetched: Challenge[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const rawCat = data.category || "Miscellaneous"; // la clé brute
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
            daysOptions: data.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365],
          };
        });
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
      setPendingFavorites((p) => ({
        ...p,
        [id]: !was,
      }));
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
        setPendingFavorites((p) => ({
          ...p,
          [id]: undefined!,
        }));
      } catch (err) {
        console.error(err);
        Alert.alert(t("error"), t("toggleFavoriteFailed"));
        setPendingFavorites((p) => ({
          ...p,
          [id]: was,
        }));
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

  if (loading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingBackground}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.select({ ios: 100, android: 20 })!}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.gradientContainer}
        >
          <FlatList
            data={filteredChallenges}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInUp.delay(200 + index * 100)}>
                <TouchableOpacity
                  style={[
                    styles.challengeCard,
                    {
                      backgroundColor: currentTheme.colors.cardBackground,
                      borderColor: currentTheme.colors.secondary,
                    },
                  ]}
                  onPress={() =>
                    router.push(
                      `/challenge-details/${item.id}?title=${encodeURIComponent(
                        item.title
                      )}&category=${encodeURIComponent(
                        item.category
                      )}&description=${encodeURIComponent(item.description)}`
                    )
                  }
                  accessibilityLabel={t("viewChallengeDetails", {
                    title: item.title,
                  })}
                  testID={`challenge-card-${index}`}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.challengeImage}
                    />
                  ) : (
                    <Image
                      source={require("../../assets/images/chalkboard.png")}
                      style={styles.challengeImage}
                    />
                  )}
                  <LinearGradient
                    colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
                    style={styles.cardOverlay}
                  >
                    <Text
                      style={[
                        styles.challengeTitle,
                        {
                          color: currentTheme.colors.textPrimary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.challengeCategory,
                        {
                          color: currentTheme.colors.trophy,
                        },
                      ]}
                    >
                      {item.category}
                    </Text>
                    <Text
                      style={[
                        styles.challengeParticipants,
                        {
                          color: currentTheme.colors.trophy,
                        },
                      ]}
                    >
                      <Ionicons
                        name="people"
                        size={normalize(14)}
                        color={currentTheme.colors.trophy}
                      />{" "}
                      {item.participantsCount || 0}{" "}
                      {item.participantsCount === 1
                        ? t("participant", {
                            count: 1,
                          })
                        : t("participant", {
                            count: item.participantsCount,
                          })}
                    </Text>
                  </LinearGradient>
                  <TouchableOpacity
                    style={styles.saveIconContainer}
                    onPress={() => toggleSaved(item)}
                    accessibilityLabel={
                      isSaved(item.id)
                        ? t("removeFavorite", {
                            title: item.title,
                          })
                        : t("addFavorite", {
                            title: item.title,
                          })
                    }
                    testID={`save-button-${item.id}`}
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
                      size={normalize(24)}
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
                </TouchableOpacity>
              </Animated.View>
            )}
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
              />
            }
            ListEmptyComponent={
              <Animated.View
                entering={FadeInUp.delay(200)}
                style={styles.noChallengesContent}
              >
                <Ionicons
                  name="search-outline"
                  size={normalize(60)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.noChallengesText,
                    {
                      color: currentTheme.colors.textPrimary,
                    },
                  ]}
                >
                  {t("noChallengesFound")}
                </Text>
                <Text
                  style={[
                    styles.noChallengesSubtext,
                    {
                      color: currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {t("tryDifferentSearch")}
                </Text>
              </Animated.View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            windowSize={5}
          />
        </LinearGradient>
      </KeyboardAvoidingView>
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdLoaded={() => console.log("Bannière chargée")}
          onAdFailedToLoad={(err) =>
            console.error("Échec chargement bannière", err)
          }
        />
      </View>
      {isTutorialActive && tutorialStep === 4 && (
        <BlurView intensity={50} style={styles.blurView}>
          <Animated.View entering={FadeInUp} style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t("explorePageTitle")}</Text>
            <Text style={styles.modalDescription}>
              {t("explorePageDescription", {
                challenges: "nouveaux défis",
                communities: "communautés",
              })}
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setTutorialStep(0); // Retour à Index
                skipTutorial(); // Ferme le tutoriel
              }}
            >
              <Text style={styles.actionButtonText}>{t("finish")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </BlurView>
      )}
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  headerContent: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING,
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  headerWrapper: {
    marginTop: SPACING,
    marginBottom: SPACING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: normalize(12),
    paddingHorizontal: SPACING / 2,
    marginHorizontal: SPACING / 2,
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(6),
    elevation: 5,
    borderWidth: normalize(1),
    maxWidth: normalize(600),
  },
  searchIcon: { marginRight: SPACING / 2 },
  searchBar: {
    flex: 1,
    height: normalize(48),
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  filtersWrapper: { alignItems: "center" },
  filtersContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: normalize(400),
    marginBottom: SPACING / 2,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING,
    paddingVertical: normalize(10),
    borderRadius: normalize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(4),
    elevation: 5,
    width: "48%",
  },
  filterButtonText: {
    marginLeft: SPACING / 2,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  resetButton: {
    width: normalize(48),
    height: normalize(48),
    borderRadius: normalize(24),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.4,
    shadowRadius: normalize(5),
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING,
  },
  modalContent: {
    borderRadius: normalize(20),
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(6),
    elevation: 5,
    maxHeight: SCREEN_HEIGHT * 0.6,
    minHeight: normalize(200),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 2,
    borderBottomWidth: normalize(1),
  },
  modalItemIcon: { marginRight: SPACING / 2 },
  modalItemText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  challengeCard: {
    borderRadius: normalize(16),
    marginBottom: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(8),
    elevation: 8,
    borderWidth: normalize(2),
    overflow: "hidden",
    width: SCREEN_WIDTH - SPACING * 2, // Largeur ajustée pour occuper presque tout l’écran
  },
  challengeImage: {
    width: "100%",
    height: SCREEN_WIDTH * 0.5, // Hauteur restaurée pour des images visibles
    resizeMode: "cover",
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: SPACING / 2,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: normalize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: normalize(3),
  },
  challengeCategory: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 4,
    textAlign: "center",
  },
  challengeParticipants: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SPACING / 4,
    textAlign: "center",
  },
  saveIconContainer: {
    position: "absolute",
    top: SPACING / 2,
    right: SPACING / 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: normalize(15),
    padding: SPACING / 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(4),
    elevation: 5,
  },
  loadingBackground: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING,
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  noChallengesContent: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING * 2,
  },
  noChallengesText: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: normalize(300),
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: "#FFB800",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  actionButtonText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
  },
});
