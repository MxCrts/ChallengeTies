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
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
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

interface Challenge {
  id: string;
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: string;
  participantsCount?: number;
}

export default function MyChallenges() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        const challengeRefs = Array.isArray(userData.createdChallenges)
          ? userData.createdChallenges
          : [];

        const raw = await Promise.all(
          challengeRefs.map(async (challenge: any) => {
            const snap = await getDoc(doc(db, "challenges", challenge.id));
            const participantsCount = snap.exists()
              ? snap.data().participantsCount
              : undefined;
            return {
              ...challenge,
              participantsCount,
            };
          })
        );

        // Traduction dynamique
        const translated = raw.map((item) => {
          const title = item.chatId
            ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
            : item.title;
          const description = item.chatId
            ? t(`challenges.${item.chatId}.description`, { defaultValue: item.description || "" })
            : item.description;
          const category = item.category
            ? t(`categories.${item.category}`, { defaultValue: item.category })
            : t("noCategory");
          return {
            ...item,
            title,
            description,
            category,
          };
        });

        setMyChallenges(translated);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [t, i18n.language]);

  const navigateToChallengeDetails = useCallback(
    (item: Challenge) => {
      const route =
        `/challenge-details/${encodeURIComponent(item.id)}` +
        `?title=${encodeURIComponent(item.title)}` +
        `&category=${encodeURIComponent(item.category || "")}` +
        `&description=${encodeURIComponent(item.description || "")}` +
        `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
      router.push(route);
    },
    [router]
  );

  const renderChallenge = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => (
      <Animated.View entering={FadeInUp.delay(index * 100)} style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigateToChallengeDetails(item)}
          activeOpacity={0.9}
          accessibilityLabel={t("viewChallengeDetails", { title: item.title })}
          testID={`challenge-${item.id}`}
        >
          <LinearGradient
            colors={[currentTheme.colors.cardBackground, currentTheme.colors.background]}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
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
                style={[styles.challengeCategory, { color: currentTheme.colors.textSecondary }]}
              >
                {item.category || t("noCategory")}
              </Text>
              {item.participantsCount !== undefined && (
                <Text
                  style={[styles.participantsText, { color: currentTheme.colors.secondary }]}
                >
                  {item.participantsCount <= 1
                    ? t("participant", { count: item.participantsCount })
                    : t("participants", { count: item.participantsCount })}
                </Text>
              )}
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => navigateToChallengeDetails(item)}
                accessibilityLabel={t("viewChallengeDetails", { title: item.title })}
                testID={`view-details-${item.id}`}
              >
                <LinearGradient
                  colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                  style={styles.viewButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={[styles.viewButtonText, { color: currentTheme.colors.textPrimary }]}
                  >
                    {t("viewDetails")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [currentTheme, navigateToChallengeDetails, t]
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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}>
            {t("loadingChallenges")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (myChallenges.length === 0) {
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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View entering={FadeInUp.delay(100)} style={styles.noChallengesContent}>
            <Ionicons
              name="create-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
            />
            <Text style={[styles.noChallengesText, { color: currentTheme.colors.textPrimary }]}>
              {t("noChallengesCreated")}
            </Text>
            <Text style={[styles.noChallengesSubtext, { color: currentTheme.colors.textSecondary }]}>
              {t("createFirstChallenge")}
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
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("myChallenges")} />
        </View>
        <FlatList
          data={myChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={5}
        />
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
  challengeCategory: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(2),
    textTransform: "capitalize",
  },
  participantsText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(5),
  },
  viewButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: SPACING,
  },
  viewButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: SPACING * 1.5,
    alignItems: "center",
  },
  viewButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
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
});