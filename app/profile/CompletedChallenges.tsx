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
  Platform,
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

// Dimensions & responsivité
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18; // Aligné avec CurrentChallenges.tsx et SavedChallenges.tsx
const ITEM_WIDTH = SCREEN_WIDTH * 0.9; // Conservé, aligné
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45; // Conservé, aligné

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle pour responsivité
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
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
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

    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCompletedChallenges([]);
          setIsLoading(false);
          return;
        }

        const raw = snapshot.data()?.CompletedChallenges || [];
        const challenges: CompletedChallenge[] = raw.map((c: any) => ({
          id: c.id,
          chatId: c.chatId,
          title: c.chatId
            ? t(`challenges.${c.chatId}.title`, { defaultValue: c.title })
            : c.title || t("challengeSaved"),
          description: c.chatId
            ? t(`challenges.${c.chatId}.description`, {
                defaultValue: c.description || "",
              })
            : c.description || "",
          category: c.category
            ? t(`categories.${c.category}`, { defaultValue: c.category })
            : t("noCategory"),
          imageUrl: c.imageUrl || "",
          completedAt: c.completedAt || "",
          selectedDays: c.selectedDays || 0,
          history: c.history || [],
        }));

        setCompletedChallenges(challenges);
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
      <Animated.View
        entering={FadeInUp.delay(index * 100)}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigateToChallengeDetails(item)}
          activeOpacity={0.8} // Aligné avec CurrentChallenges.tsx
          accessibilityLabel={t("viewChallenge", { title: item.title })}
          accessibilityHint={t("viewDetails")} // Aligné avec CurrentChallenges.tsx
          testID={`challenge-card-${item.id}`}
        >
          <LinearGradient
            colors={[
              currentTheme.colors.cardBackground,
              currentTheme.colors.cardBackground + "F0",
            ]}
            style={[
              styles.card,
              {
                borderColor: isDarkMode
                  ? currentTheme.colors.secondary
                  : "#FF8C00",
              },
            ]}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.cardImage}
                accessibilityLabel={t("challengeImage", { title: item.title })}
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
              <Text
                style={[
                  styles.challengeTitle,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.challengeDate,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("completedOn")}{" "}
                {new Date(item.completedAt).toLocaleDateString()}
              </Text>
              <Text
                style={[
                  styles.challengeCategory,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {item.category}
              </Text>
              <View style={styles.progressContainer}>
                <Text
                  style={[
                    styles.progressText,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {item.selectedDays}/{item.selectedDays} {t("days")}
                </Text>
              </View>
              {item.history && item.history.length > 0 && (
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => openHistoryModal(item)}
                  accessibilityLabel={t("history")}
                  accessibilityHint={t("viewHistoryHint")} // Aligné avec CurrentChallenges.tsx
                  testID={`history-button-${item.id}`}
                >
                  <LinearGradient
                    colors={[
                      currentTheme.colors.secondary,
                      currentTheme.colors.primary,
                    ]}
                    style={styles.historyButtonGradient}
                  >
                    <Text
                      style={[
                        styles.historyButtonText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
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
    [navigateToChallengeDetails, openHistoryModal, currentTheme, t, isDarkMode]
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
            currentTheme.colors.background,
            currentTheme.colors.cardBackground + "F0",
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
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={styles.noChallengesContainer}
        >
          <View style={styles.headerWrapper}>
            <Animated.View entering={FadeInUp}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityLabel={t("goBack")}
                accessibilityHint={t("backButtonHint")} // Aligné avec CurrentChallenges.tsx
                testID="back-button"
              >
                <Ionicons
                  name="arrow-back"
                  size={normalizeSize(24)}
                  color={currentTheme.colors.secondary}
                />
              </TouchableOpacity>
            </Animated.View>
            <CustomHeader title={t("completedChallengesScreenTitle")} />
          </View>
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.noChallengesContent}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
              accessibilityLabel={t("noCompletedChallengesIcon")}
            />
            <Text
              style={[
                styles.noChallengesText,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : currentTheme.colors.textSecondary,
                },
                ,
              ]}
            >
              {t("noCompletedChallenges")}
            </Text>
            <Text
              style={[
                styles.noChallengesSubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
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
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground + "F0",
        ]}
        style={styles.container}
      >
        <View style={styles.headerWrapper}>
          <Animated.View entering={FadeInUp}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel={t("goBack")}
              accessibilityHint={t("backButtonHint")} // Aligné avec CurrentChallenges.tsx
              testID="back-button"
            >
              <Ionicons
                name="arrow-back"
                size={normalizeSize(24)}
                color={currentTheme.colors.secondary}
              />
            </TouchableOpacity>
          </Animated.View>
          <CustomHeader title={t("completedChallengesScreenTitle")} />
        </View>
        <FlatList
          data={completedChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => `${item.id}_${item.completedAt}`}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={5}
          contentInset={{ top: SPACING, bottom: normalizeSize(100) }} // Responsivité
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
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "F0",
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
                  {t("historyOf")} {selectedHistory.title}
                </Text>
                <FlatList
                  data={selectedHistory.history}
                  keyExtractor={(_, i) => `${i}`}
                  renderItem={({ item }) => (
                    <Animated.View
                      entering={FadeInUp.delay(100)}
                      style={[
                        styles.historyItem,
                        { borderBottomColor: currentTheme.colors.border },
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
                        {t("completedOnDate")}{" "}
                        {new Date(item.completedAt).toLocaleDateString()} -{" "}
                        {item.selectedDays} {t("days")}
                      </Text>
                    </Animated.View>
                  )}
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setHistoryModalVisible(false)}
                  accessibilityLabel={t("closeModal")} // Aligné avec CurrentChallenges.tsx
                  accessibilityHint={t("closeModalHint")} // Aligné avec CurrentChallenges.tsx
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
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Exactement comme CurrentChallenges.tsx et SavedChallenges.tsx
    borderRadius: normalizeSize(20),
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5, // Aligné avec CurrentChallenges.tsx
    position: "relative",
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingBottom: normalizeSize(80), // Aligné avec CurrentChallenges.tsx
  },
  cardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    alignSelf: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(18),
    borderRadius: normalizeSize(25),
    borderWidth: 2.5, // Bordure premium
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(16), // Aligné avec CurrentChallenges.tsx
    marginRight: SPACING * 1.2,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)", // Bordure premium
  },
  placeholderImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(16),
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING * 1.2,
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between", // Aligné avec CurrentChallenges.tsx
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  challengeDate: {
    fontSize: normalizeSize(16), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  challengeCategory: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  progressContainer: {
    marginVertical: normalizeSize(10),
  },
  progressText: {
    fontSize: normalizeSize(14), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
  },
  historyButton: {
    borderRadius: normalizeSize(18), // Aligné avec CurrentChallenges.tsx
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  historyButtonGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  historyButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16), // Aligné avec CurrentChallenges.tsx
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  noChallengesContainer: {
    flex: 1,
  },
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85, // Responsivité
    paddingHorizontal: SPACING,
  },
  noChallengesText: {
    fontSize: normalizeSize(22), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75, // Responsivité
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: normalizeSize(25), // Aligné avec CurrentChallenges.tsx
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
  },
  modalTitle: {
    fontSize: normalizeSize(22), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
    textAlign: "center",
  },
  historyItem: {
    paddingVertical: SPACING / 2,
    borderBottomWidth: 1,
  },
  historyText: {
    fontSize: normalizeSize(16), // Aligné avec CurrentChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
  },
  closeButton: {
    marginTop: SPACING,
    borderRadius: normalizeSize(18), // Aligné avec CurrentChallenges.tsx
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
  },
});
