import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";

const { lightTheme } = designSystem; // On applique uniquement le thème light
const currentTheme = lightTheme;

const { width } = Dimensions.get("window");
const normalizeFont = (size: number) => {
  const scale = width / 375;
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

export default function ExploreScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [originFilter, setOriginFilter] = useState("Existing");
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const router = useRouter();

  const { isSaved, addChallenge, removeChallenge } = useSavedChallenges();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "challenges"),
      (querySnapshot) => {
        const fetchedChallenges = querySnapshot.docs.map((doc) => ({
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
        })) as Challenge[];
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

  // Calcul des catégories disponibles
  const availableCategories = useMemo(() => {
    const cats = challenges.map((challenge) => challenge.category);
    return ["All", ...Array.from(new Set(cats))];
  }, [challenges]);

  const filteredChallenges = challenges.filter((challenge) => {
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

  const toggleSavedChallenge = async (challenge: Challenge) => {
    if (isSaved(challenge.id)) {
      await removeChallenge(challenge.id);
    } else {
      await addChallenge(challenge);
    }
    setChallenges([...challenges]);
  };

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
    >
      <BackButton color={currentTheme.colors.primary} />
      <View style={styles.header}>
        <Text style={[styles.pageTitle]}>Explorer les défis</Text>
      </View>

      <View style={styles.content}>
        {/* Barre de recherche */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: currentTheme.colors.cardBackground },
          ]}
        >
          <Ionicons
            name="search"
            size={22}
            color={currentTheme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchBar, { color: "#000000" }]}
            placeholder="Rechercher un défi..."
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: currentTheme.colors.primary },
            ]}
            onPress={() =>
              setOriginFilter(
                originFilter === "Existing" ? "Created" : "Existing"
              )
            }
          >
            <Ionicons name="options-outline" size={22} color="#FFF" />
            <Text style={styles.filterButtonText}>Type: {originFilter}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: currentTheme.colors.primary },
            ]}
            onPress={() => setIsCategoryModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={22} color="#FFF" />
            <Text style={styles.filterButtonText}>
              Catégorie: {capitalize(categoryFilter)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.resetButton,
              { backgroundColor: currentTheme.colors.error },
            ]}
            onPress={() => {
              setSearchQuery("");
              setCategoryFilter("All");
              setOriginFilter("Existing");
            }}
          >
            <Ionicons name="refresh-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Modal
          visible={isCategoryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsCategoryModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setIsCategoryModalVisible(false)}
          >
            <View
              style={[
                styles.modalContent,
                { backgroundColor: currentTheme.colors.cardBackground },
              ]}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setIsCategoryModalVisible(false)}
                >
                  <Ionicons
                    name="close-outline"
                    size={24}
                    color={currentTheme.colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.modalItem}
                  onPress={() => {
                    setCategoryFilter(cat);
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={currentTheme.colors.textPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.modalItemText}>{capitalize(cat)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Liste des défis */}
        {loading ? (
          <ActivityIndicator size="large" color={currentTheme.colors.trophy} />
        ) : filteredChallenges.length > 0 ? (
          <FlatList
            data={filteredChallenges}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Animated.View entering={FadeInUp} style={styles.challengeCard}>
                <TouchableOpacity
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
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.challengeImage}
                    />
                  ) : (
                    <View style={styles.challengeImagePlaceholder}>
                      <Text style={styles.challengeImagePlaceholderText}>
                        Image
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.challengeTitle, { color: "#000000" }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.challengeCategory,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {capitalize(item.category)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveIconContainer}
                  onPress={() => toggleSavedChallenge(item)}
                >
                  <Ionicons
                    name={isSaved(item.id) ? "bookmark" : "bookmark-outline"}
                    size={24}
                    color={
                      isSaved(item.id)
                        ? currentTheme.colors.textSecondary
                        : currentTheme.colors.textPrimary
                    }
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        ) : (
          <Text style={styles.noResults}>Aucun défi trouvé.</Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, alignItems: "center" },
  pageTitle: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  content: { flex: 1, paddingHorizontal: 20 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchBar: {
    flex: 1,
    height: 40,
    fontSize: normalizeFont(14),
    fontFamily: "Comfortaa_400Regular",
  },
  filtersContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  filterButtonText: {
    color: "#FFF",
    marginLeft: 4,
    fontSize: normalizeFont(12),
    fontFamily: "Comfortaa_400Regular",
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  modalItemText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  challengeCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: currentTheme.colors.cardBackground,
    marginBottom: 16,
    position: "relative",
    shadowColor: "#000",
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4.65,
    elevation: 3,
  },
  challengeImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
  },
  challengeImagePlaceholder: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  challengeImagePlaceholderText: {
    fontSize: normalizeFont(16),
    fontFamily: "Comfortaa_400Regular",
  },
  challengeTitle: {
    fontSize: normalizeFont(18),
    marginTop: 8,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  challengeCategory: {
    fontSize: normalizeFont(14),
    marginTop: 4,
    fontFamily: "Comfortaa_400Regular",
  },
  noResults: {
    fontSize: normalizeFont(16),
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  saveIconContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 4,
  },
});
