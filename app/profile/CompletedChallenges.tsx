import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;

const currentTheme = {
  ...designSystem.lightTheme,
  colors: {
    ...designSystem.lightTheme.colors,
    primary: "#ED8F03", // Orange
    cardBackground: "#FFFFFF",
  },
};

const normalizeSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface CompletedChallenge {
  id: string;
  title: string;
  imageUrl?: string;
  completedAt: string;
  category?: string;
  description?: string;
  selectedDays: number;
  history?: { completedAt: string; selectedDays: number }[];
}

export default function CompletedChallenges() {
  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{
    title: string;
    history: { completedAt: string; selectedDays: number }[];
  } | null>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() || {};
          const challenges = Array.isArray(userData.CompletedChallenges)
            ? userData.CompletedChallenges
            : [];
          const mappedChallenges = challenges.map((c: any) => ({
            id: c.id,
            title: c.title || "Défi sans titre",
            imageUrl: c.imageUrl || null,
            completedAt: c.completedAt || "Date inconnue",
            category: c.category || "Non catégorisé",
            description: c.description || "Pas de description",
            selectedDays: c.selectedDays || 0,
            history: c.history || [],
          }));
          setCompletedChallenges(mappedChallenges);
        } else {
          setCompletedChallenges([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur lors du chargement :", error);
        Alert.alert("Erreur", "Impossible de charger les défis complétés.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const navigateToChallengeDetails = (item: CompletedChallenge) => {
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&selectedDays=${item.selectedDays}` +
      `&completedDays=${item.selectedDays}` + // Tous les jours sont complétés
      `&category=${encodeURIComponent(item.category || "Uncategorized")}` +
      `&description=${encodeURIComponent(item.description || "")}` +
      `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const renderChallenge = ({
    item,
    index,
  }: {
    item: CompletedChallenge;
    index: number;
  }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => navigateToChallengeDetails(item)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#FFFFFF", "#FFE0B2"]}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons
                name="image-outline"
                size={normalizeSize(30)}
                color="#b0bec5"
              />
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.challengeTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.challengeDate}>
              Complété le{" "}
              {new Date(item.completedAt).toLocaleDateString("fr-FR")}
            </Text>
            <Text style={styles.challengeCategory}>
              {item.category || "Non catégorisé"}
            </Text>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {item.selectedDays}/{item.selectedDays} jours
              </Text>
            </View>
            {item.history && item.history.length > 0 && (
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => {
                  setSelectedHistory({
                    title: item.title,
                    history: item.history!,
                  });
                  setHistoryModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={["#FF6200", "#FF8C00"]}
                  style={styles.historyButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.historyButtonText}>Historique</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ActivityIndicator size="large" color="#FF6200" />
          <Text style={styles.loadingText}>Chargement en cours...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (completedChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.noChallengesContent}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={normalizeSize(60)}
              color="#B0BEC5"
            />
            <Text style={styles.noChallengesText}>Aucun défi complété !</Text>
            <Text style={styles.noChallengesSubtext}>
              Terminez des défis pour les voir ici.
            </Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title="Défis Complétés" />
        </View>
        <FlatList
          data={completedChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => `${item.id}_${item.completedAt}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        {selectedHistory && (
          <Modal
            visible={historyModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setHistoryModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <LinearGradient
                colors={["#FFFFFF", "#FFE0B2"]}
                style={styles.modalContent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.modalTitle}>
                  Historique de {selectedHistory.title}
                </Text>
                <FlatList
                  data={selectedHistory.history}
                  keyExtractor={(item, index) => `${index}`}
                  renderItem={({ item }) => (
                    <Animated.View
                      entering={FadeInUp.delay(100)}
                      style={styles.historyItem}
                    >
                      <Text style={styles.historyText}>
                        Complété le{" "}
                        {new Date(item.completedAt).toLocaleDateString("fr-FR")}{" "}
                        - {item.selectedDays} jours
                      </Text>
                    </Animated.View>
                  )}
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setHistoryModalVisible(false)}
                >
                  <LinearGradient
                    colors={["#FF6200", "#FF8C00"]}
                    style={styles.closeButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.closeButtonText}>Fermer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Modal>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  listContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  cardWrapper: {
    marginBottom: CARD_MARGIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    alignSelf: "center",
  },
  card: {
    flexDirection: "row",
    padding: normalizeSize(15),
    borderRadius: normalizeSize(20),
    borderWidth: 1,
    borderColor: "#FF620030",
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    marginRight: normalizeSize(15),
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  placeholderImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: normalizeSize(15),
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    color: "#333333",
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  challengeDate: {
    fontSize: normalizeSize(14),
    color: "#777777",
    fontFamily: currentTheme.typography.body.fontFamily,
    marginTop: normalizeSize(2),
  },
  challengeCategory: {
    fontSize: normalizeSize(14),
    color: "#777777",
    fontFamily: currentTheme.typography.body.fontFamily,
    marginTop: normalizeSize(2),
    textTransform: "capitalize",
  },
  progressContainer: {
    marginVertical: normalizeSize(10),
  },
  progressText: {
    fontSize: normalizeSize(12),
    color: "#FF6200",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  historyButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  historyButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(15),
    alignItems: "center",
  },
  historyButtonText: {
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontSize: normalizeSize(14),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesContent: {
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: normalizeSize(20),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333333",
    marginTop: normalizeSize(15),
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#777777",
    textAlign: "center",
    marginTop: normalizeSize(10),
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: normalizeSize(20),
    padding: normalizeSize(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  modalTitle: {
    fontSize: normalizeSize(20),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333333",
    marginBottom: normalizeSize(15),
    textAlign: "center",
  },
  historyItem: {
    paddingVertical: normalizeSize(10),
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  historyText: {
    fontSize: normalizeSize(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#555555",
  },
  closeButton: {
    marginTop: normalizeSize(20),
    borderRadius: normalizeSize(12),
    overflow: "hidden",
  },
  closeButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(15),
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontSize: normalizeSize(16),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
