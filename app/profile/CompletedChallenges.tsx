import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  Modal,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface CompletedChallenge {
  id: string;
  chatId?: string;
  title: string;
  imageUrl?: string;
  completedAt: string;
  category?: string;
  description?: string;
  selectedDays: number;
  history?: { completedAt: string; selectedDays: number }[];
}

export default function CompletedChallenges() {
  const { t, i18n } = useTranslation();
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{
    title: string;
    history: { completedAt: string; selectedDays: number }[];
  } | null>(null);
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

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
          const mappedChallenges: CompletedChallenge[] = challenges.map((c: any) => {
            // traductions
            const titleTrans = c.chatId
              ? t(`challenges.${c.chatId}.title`, { defaultValue: c.title })
              : c.title || t("challengeSaved");
            const descTrans = c.chatId
              ? t(`challenges.${c.chatId}.description`, { defaultValue: c.description || "" })
              : c.description || "";
            const catTrans = c.category
              ? t(`categories.${c.category}`, { defaultValue: c.category })
              : t("noCategory");

            return {
              id: c.id,
              chatId: c.chatId,
              title: titleTrans,
              imageUrl: c.imageUrl || null,
              completedAt: c.completedAt || "",
              category: catTrans,
              description: descTrans,
              selectedDays: c.selectedDays || 0,
              history: c.history || [],
            };
          });
          setCompletedChallenges(mappedChallenges);
        } else {
          setCompletedChallenges([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error(error);
        Alert.alert(t("error"), t("errorLoadingCompletedChallenges"));
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
        `&category=${encodeURIComponent(item.category || t("noCategory"))}` +
        `&description=${encodeURIComponent(item.description || "")}` +
        `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
      router.push(route as any);
    },
    [router, t]
  );

  const openHistoryModal = useCallback((item: CompletedChallenge) => {
    setSelectedHistory({ title: item.title, history: item.history! });
    setHistoryModalVisible(true);
  }, []);

  const renderChallenge = useCallback(
    ({ item, index }: { item: CompletedChallenge; index: number }) => (
      <Animated.View entering={FadeInUp.delay(index * 100)} style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigateToChallengeDetails(item)}
          activeOpacity={0.9}
          accessibilityLabel={t("viewChallenge", { title: item.title })}
        >
          <LinearGradient
            colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.cardImage}
                accessibilityLabel={t("challengeImage", { title: item.title })}
              />
            ) : (
              <View
                style={[styles.placeholderImage, { backgroundColor: currentTheme.colors.overlay }]}
              >
                <Ionicons
                  name="image-outline"
                  size={normalizeSize(30)}
                  color={currentTheme.colors.textSecondary}
                />
              </View>
            )}
            <View style={styles.cardContent}>
              <Text
                style={[styles.challengeTitle, { color: currentTheme.colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.challengeDate, { color: currentTheme.colors.textSecondary }]}
              >
                {t("completedOn")} {new Date(item.completedAt).toLocaleDateString()}
              </Text>
              <Text
                style={[styles.challengeCategory, { color: currentTheme.colors.textSecondary }]}
              >
                {item.category}
              </Text>
              <View style={styles.progressContainer}>
                <Text style={[styles.progressText, { color: currentTheme.colors.secondary }]}>
                  {item.selectedDays}/{item.selectedDays} {t("days")}
                </Text>
              </View>
              {item.history && item.history.length > 0 && (
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => openHistoryModal(item)}
                  accessibilityLabel={t("history")}
                >
                  <LinearGradient
                    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                    style={styles.historyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text
                      style={[styles.historyButtonText, { color: currentTheme.colors.textPrimary }]}
                    >
                      {t("historyOf")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [navigateToChallengeDetails, openHistoryModal, currentTheme, t]
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
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}>
            {t("loadingProfile")}
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
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.noChallengesContainer}
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.noChallengesContent}>
            <Ionicons
              name="checkmark-done-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
            />
            <Text style={[styles.noChallengesText, { color: currentTheme.colors.textPrimary }]}>
              {t("noCompletedChallenges")}
            </Text>
            <Text style={[styles.noChallengesSubtext, { color: currentTheme.colors.textSecondary }]}>
              {t("completeChallengesToSeeHere")}
            </Text>
          </Animated.View>
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
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
        style={styles.container}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("completedChallengesScreenTitle")} />
        </View>
        <FlatList
          data={completedChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => `${item.id}_${item.completedAt}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={5}
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
                { backgroundColor: `${currentTheme.colors.overlay}80` },
              ]}
            >
              <LinearGradient
                colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
                style={styles.modalContent}
              >
                <Text style={[styles.modalTitle, { color: currentTheme.colors.textPrimary }]}>
                  {t("historyOf")} {selectedHistory.title}
                </Text>
                <FlatList
                  data={selectedHistory.history}
                  keyExtractor={(_, i) => `${i}`}
                  renderItem={({ item }) => (
                    <Animated.View
                      entering={FadeInUp.delay(100)}
                      style={[styles.historyItem, { borderBottomColor: currentTheme.colors.border }]}
                    >
                      <Text style={[styles.historyText, { color: currentTheme.colors.textPrimary }]}>
                        {t("completedOnDate")}{" "}
                        {new Date(item.completedAt).toLocaleDateString()} - {item.selectedDays}{" "}
                        {t("days")}
                      </Text>
                    </Animated.View>
                  )}
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setHistoryModalVisible(false)}
                >
                  <LinearGradient
                    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                    style={styles.closeButtonGradient}
                  >
                    <Text style={[styles.closeButtonText, { color: currentTheme.colors.textPrimary }]}>
                      {t("close")}
                    </Text>
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
    marginTop: SPACING,
    marginBottom: SPACING,
    paddingHorizontal: SPACING,
  },
  listContent: {
    paddingHorizontal: SPACING,
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
    padding: SPACING,
    borderRadius: normalizeSize(20),
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    marginRight: SPACING,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  placeholderImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING,
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
  },
  challengeDate: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(2),
  },
  challengeCategory: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(2),
    textTransform: "capitalize",
  },
  progressContainer: {
    marginVertical: SPACING / 2,
  },
  progressText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
  },
  historyButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: SPACING / 2,
  },
  historyButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: SPACING,
    alignItems: "center",
  },
  historyButtonText: {
    fontFamily: "Comfortaa_700Bold",
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
    marginTop: SPACING,
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
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
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: normalizeSize(20),
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  modalTitle: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
  },
  historyItem: {
    paddingVertical: SPACING / 2,
    borderBottomWidth: 1,
  },
  historyText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  closeButton: {
    marginTop: SPACING,
    borderRadius: normalizeSize(12),
    overflow: "hidden",
  },
  closeButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: SPACING,
    alignItems: "center",
  },
  closeButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});