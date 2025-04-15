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
  StyleSheet,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Challenge {
  id: string;
  title: string;
  description: string;
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
  }) => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.headerContent}>
      <View style={styles.headerWrapper}>
        <CustomHeader title="Explore les Défis" />
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
          size={normalizeFont(20)}
          color={currentTheme.colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchBar, { color: currentTheme.colors.textPrimary }]}
          placeholder="Rechercher un défi..."
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          autoCorrect={false}
          blurOnSubmit={false}
        />
      </View>
      <View style={styles.filtersWrapper}>
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={onOriginToggle}
          >
            <Ionicons
              name="options-outline"
              size={normalizeFont(18)}
              color={currentTheme.colors.textPrimary}
            />
            <Text
              style={[
                styles.filterButtonText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {originFilter}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={onToggleCategoryModal}
          >
            <Ionicons
              name="filter-outline"
              size={normalizeFont(18)}
              color={currentTheme.colors.textPrimary}
            />
            <Text
              style={[
                styles.filterButtonText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {categoryFilter === "All"
                ? "Catégorie"
                : capitalize(categoryFilter)}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.resetButton,
            { backgroundColor: currentTheme.colors.primary },
          ]}
          onPress={onResetFilters}
        >
          <Ionicons
            name="refresh-outline"
            size={normalizeFont(20)}
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
            { backgroundColor: currentTheme.colors.overlay },
          ]}
          activeOpacity={1}
          onPressOut={onCloseCategoryModal}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: currentTheme.colors.cardBackground },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                Choisir une catégorie
              </Text>
              <TouchableOpacity onPress={onCloseCategoryModal}>
                <Ionicons
                  name="close-outline"
                  size={normalizeFont(24)}
                  color={currentTheme.colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.modalItem,
                    { borderBottomColor: currentTheme.colors.border },
                  ]}
                  onPress={() => onCategorySelect(cat)}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={normalizeFont(18)}
                    color={currentTheme.colors.secondary}
                    style={styles.modalItemIcon}
                  />
                  <Text
                    style={[
                      styles.modalItemText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {capitalize(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  )
);

export default function ExploreScreen() {
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
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetchedChallenges: Challenge[] = querySnapshot.docs.map(
          (doc) => ({
            id: doc.id,
            title: doc.data().title || "Défi sans titre",
            description:
              doc.data().description || "Aucune description disponible",
            category: doc.data().category || "Divers",
            imageUrl: doc.data().imageUrl || null,
            participantsCount: doc.data().participantsCount || 0,
            creatorId: doc.data().creatorId || null,
            daysOptions: doc.data().daysOptions || [
              7, 14, 21, 30, 60, 90, 180, 365,
            ],
            chatId: doc.data().chatId || doc.id,
          })
        );
        setChallenges(fetchedChallenges);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur de chargement :", error);
        Alert.alert("Erreur", "Impossible de charger les défis.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const availableCategories = useMemo(() => {
    const cats = challenges.map((challenge) => challenge.category);
    return ["All", ...Array.from(new Set(cats))];
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      const matchesSearch = challenge.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "All" || challenge.category === categoryFilter;
      const matchesOrigin =
        originFilter === "Existing"
          ? !challenge.creatorId
          : originFilter === "Created"
          ? challenge.creatorId
          : true;
      return matchesSearch && matchesCategory && matchesOrigin;
    });
  }, [challenges, searchQuery, categoryFilter, originFilter]);

  const toggleSavedChallenge = useCallback(
    async (challenge: Challenge) => {
      const challengeId = challenge.id;
      const isCurrentlySaved = isSaved(challengeId);
      setPendingFavorites((prev) => ({
        ...prev,
        [challengeId]: !isCurrentlySaved,
      }));

      try {
        if (isCurrentlySaved) {
          await removeChallenge(challengeId);
        } else {
          await addChallenge({
            id: challenge.id,
            title: challenge.title,
            category: challenge.category || null,
            description: challenge.description || null,
            imageUrl: challenge.imageUrl || null,
            daysOptions: challenge.daysOptions,
            chatId: challenge.chatId,
          });
        }
        setPendingFavorites((prev) => ({
          ...prev,
          [challengeId]: undefined,
        }));
      } catch (error) {
        console.error("Erreur lors de la mise à jour du favori :", error);
        Alert.alert(
          "Erreur",
          "Impossible de sauvegarder/désauvegarder le défi."
        );
        setPendingFavorites((prev) => ({
          ...prev,
          [challengeId]: isCurrentlySaved,
        }));
      }
    },
    [isSaved, addChallenge, removeChallenge]
  );

  const handleSearchChange = useCallback(
    (text: string) => setSearchQuery(text),
    []
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("All");
    setOriginFilter("Existing");
  }, []);

  const handleCategorySelect = useCallback((cat: string) => {
    setCategoryFilter(cat);
    setIsCategoryModalVisible(false);
  }, []);

  const toggleCategoryModal = useCallback(
    () => setIsCategoryModalVisible((prev) => !prev),
    []
  );

  const closeCategoryModal = useCallback(
    () => setIsCategoryModalVisible(false),
    []
  );

  const handleOriginToggle = useCallback(
    () =>
      setOriginFilter((prev) => (prev === "Existing" ? "Created" : "Existing")),
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
            Chargement des défis...
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
                      )}` +
                        `&category=${encodeURIComponent(item.category)}` +
                        `&description=${encodeURIComponent(item.description)}`
                    )
                  }
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.challengeImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.challengeImagePlaceholder,
                        { backgroundColor: currentTheme.colors.border },
                      ]}
                    >
                      <Ionicons
                        name="image-outline"
                        size={normalizeFont(40)}
                        color={currentTheme.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.challengeImagePlaceholderText,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Image
                      </Text>
                    </View>
                  )}
                  <LinearGradient
                    colors={[currentTheme.colors.overlay, "rgba(0,0,0,0.9)"]}
                    style={styles.cardOverlay}
                  >
                    <Text
                      style={[
                        styles.challengeTitle,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.challengeCategory,
                        { color: currentTheme.colors.trophy },
                      ]}
                    >
                      {capitalize(item.category)}
                    </Text>
                    <Text
                      style={[
                        styles.challengeParticipants,
                        { color: currentTheme.colors.trophy },
                      ]}
                    >
                      <Ionicons
                        name="people"
                        size={normalizeFont(14)}
                        color={currentTheme.colors.trophy}
                      />{" "}
                      {item.participantsCount || 0}{" "}
                      {(item.participantsCount || 0) <= 1
                        ? "participant"
                        : "participants"}
                    </Text>
                  </LinearGradient>
                  <TouchableOpacity
                    style={styles.saveIconContainer}
                    onPress={() => toggleSavedChallenge(item)}
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
                      size={normalizeFont(24)}
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
                onSearchChange={handleSearchChange}
                onResetFilters={resetFilters}
                onCategorySelect={handleCategorySelect}
                onOriginToggle={handleOriginToggle}
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
                  size={normalizeFont(60)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.noChallengesText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  Aucun défi trouvé !
                </Text>
                <Text
                  style={[
                    styles.noChallengesSubtext,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Essayez une autre recherche ou filtre.
                </Text>
              </Animated.View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </LinearGradient>
      </KeyboardAvoidingView>
    </GlobalLayout>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  listContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.05,
  },
  headerContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.03,
  },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.025,
    marginBottom: SCREEN_HEIGHT * 0.02,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    paddingHorizontal: SCREEN_WIDTH * 0.03,
    marginHorizontal: SCREEN_WIDTH * 0.05,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
  },
  searchIcon: { marginRight: SCREEN_WIDTH * 0.02 },
  searchBar: {
    flex: 1,
    height: SCREEN_WIDTH * 0.12,
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  filtersWrapper: { alignItems: "center" },
  filtersContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: SCREEN_WIDTH * 0.9,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_WIDTH * 0.025,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    width: SCREEN_WIDTH * 0.42,
  },
  filterButtonText: {
    marginLeft: SCREEN_WIDTH * 0.015,
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  resetButton: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.06,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  modalContent: {
    borderRadius: 20,
    padding: SCREEN_WIDTH * 0.05,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  modalTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SCREEN_WIDTH * 0.025,
    borderBottomWidth: 1,
  },
  modalItemIcon: { marginRight: SCREEN_WIDTH * 0.02 },
  modalItemText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  challengeCard: {
    borderRadius: 20,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    overflow: "hidden",
  },
  challengeImage: {
    width: "100%",
    height: SCREEN_WIDTH * 0.5,
    resizeMode: "cover",
  },
  challengeImagePlaceholder: {
    width: "100%",
    height: SCREEN_WIDTH * 0.5,
    justifyContent: "center",
    alignItems: "center",
  },
  challengeImagePlaceholderText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SCREEN_WIDTH * 0.02,
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: SCREEN_WIDTH * 0.04,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  challengeCategory: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SCREEN_WIDTH * 0.01,
    textAlign: "center",
  },
  challengeParticipants: {
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: SCREEN_WIDTH * 0.01,
    textAlign: "center",
  },
  saveIconContainer: {
    position: "absolute",
    top: SCREEN_WIDTH * 0.03,
    right: SCREEN_WIDTH * 0.03,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 15,
    padding: SCREEN_WIDTH * 0.015,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingBackground: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SCREEN_HEIGHT * 0.02,
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  noChallengesContent: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SCREEN_HEIGHT * 0.05,
  },
  noChallengesText: {
    fontSize: normalizeFont(20),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SCREEN_HEIGHT * 0.02,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SCREEN_HEIGHT * 0.01,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
});
