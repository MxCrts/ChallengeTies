import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeOutRight,
  ZoomIn,
} from "react-native-reanimated";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
 import { adUnitIds } from "@/constants/admob";
 import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";

const SPACING = 18; // Aligné avec CurrentChallenges.tsx
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9; // Aligné avec CurrentChallenges.tsx
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45; // Aligné avec CurrentChallenges.tsx

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const BANNER_HEIGHT = normalizeSize(50);

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
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};


interface Challenge {
  id: string;
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  daysOptions?: number[];
}

export default function SavedChallengesScreen() {
  const { t, i18n } = useTranslation();
  const { savedChallenges, removeChallenge } = useSavedChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const router = useRouter();
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );
  const npa = (globalThis as any).__NPA__ === true;
   const { showBanners } = useAdsVisibility();
   const bottomPadding = showBanners ? BANNER_HEIGHT + normalizeSize(90) : normalizeSize(90);

  const translatedChallenges = useMemo(() => {
    if (!savedChallenges || !Array.isArray(savedChallenges)) {
      return [];
    }

    // Dédupliquer
    const uniqueArr = Array.from(
      new Map(
        savedChallenges
          .filter((item) => item.id)
          .map((item) => [item.id, item as Challenge])
      ).values()
    );

    // Traduction de chaque champ
    return uniqueArr.map((item) => ({
      ...item,
      title: item.chatId
        ? t(`challenges.${item.chatId}.title`, { defaultValue: item.title })
        : item.title,
      description: item.chatId
        ? t(`challenges.${item.chatId}.description`, {
            defaultValue: item.description || "",
          })
        : item.description || "",
      category: item.category
        ? t(`categories.${item.category}`, { defaultValue: item.category })
        : t("miscellaneous"),
    }));
  }, [savedChallenges, i18n.language, t]);

  useEffect(() => {
    setLocalChallenges(translatedChallenges);
    setIsLoading(false);
  }, [translatedChallenges]);

  const navigateToChallengeDetails = useCallback(
    (item: Challenge) => {
      const titleParam = encodeURIComponent(item.title);
      const catParam = encodeURIComponent(item.category || "");
      const descParam = encodeURIComponent(item.description || "");
      const imgParam = encodeURIComponent(item.imageUrl || "");
      const selectedDays = item.daysOptions?.[0] || 7;
      const route = `/challenge-details/${encodeURIComponent(
        item.id
      )}?title=${titleParam}&selectedDays=${selectedDays}&completedDays=0&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;
      router.push(route);
    },
    [router, t]
  );

  const handleRemoveChallenge = useCallback(
    (id: string, index: number) => {
      Alert.alert(
        t("deleteChallenge"),
        t("deleteChallengeConfirm"),
        [
          {
            text: t("cancel"),
            style: "cancel",
            onPress: () => swipeableRefs.current[index]?.close(),
          },
          {
            text: t("continue"),
            style: "destructive",
            onPress: async () => {
              try {
                setLocalChallenges((prev) => prev.filter((c) => c.id !== id));
                await removeChallenge(id);
                Alert.alert(t("deleted"), t("challengeDeletedSuccess"));
              } catch (err) {
                console.error("Erreur removeChallenge:", err);
                Alert.alert(t("error"), t("failedToDeleteChallenge"));
                swipeableRefs.current[index]?.close();
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [removeChallenge, t]
  );

  const renderChallengeItem = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => {
      const borderColor = isDarkMode
        ? currentTheme.colors.secondary
        : "#FF8C00"; // Aligné avec CurrentChallenges.tsx

      return (
        <Animated.View
          entering={ZoomIn.delay(index * 50)}
          exiting={FadeOutRight.duration(300)}
          style={styles.cardWrapper}
        >
          <View
            accessibilityLabel={`${t("challenge")} ${item.title}, ${t(
              "swipeToDelete"
            )}`}
            testID={`challenge-swipe-${item.id}`}
          >
            <Swipeable
              ref={(ref) => {
                swipeableRefs.current[index] = ref;
              }}
              renderRightActions={() => (
                <View style={styles.swipeActionsContainer}>
                  <LinearGradient
                    colors={["#EF4444", "#B91C1C"]}
                    style={styles.trashButton}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={normalizeSize(28)}
                      color="#fff"
                      accessibilityLabel={t("deleteChallenge")}
                    />
                  </LinearGradient>
                </View>
              )}
              overshootRight={false}
              onSwipeableOpen={() => handleRemoveChallenge(item.id, index)}
            >
              <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => navigateToChallengeDetails(item)}
                activeOpacity={0.8}
                accessibilityLabel={t("viewChallengeDetails", {
                  title: item.title,
                })}
                accessibilityHint={t("viewDetails")}
                accessibilityRole="button"
                testID={`challenge-card-${item.id}`}
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.cardBackground,
                    currentTheme.colors.cardBackground + "F0",
                  ]}
                  style={[styles.card, { borderColor }]}
                >
                  <Image
                    source={{
                      uri: item.imageUrl || "https://via.placeholder.com/70",
                    }}
                    style={styles.cardImage}
                    accessibilityLabel={t("challengeImage", {
                      title: item.title,
                    })}
                  />
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
                        styles.challengeCategory,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      {item.category || t("miscellaneous")}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => navigateToChallengeDetails(item)}
                      accessibilityLabel={t("viewChallengeDetails", {
                        title: item.title,
                      })}
                      accessibilityHint={t("viewDetails")}
                      accessibilityRole="button"
                      testID={`view-details-${item.id}`}
                    >
                      <LinearGradient
                        colors={[
                          currentTheme.colors.secondary,
                          currentTheme.colors.primary,
                        ]}
                        style={styles.viewButtonGradient}
                      >
                        <Text
                          style={[
                            styles.viewButtonText,
                            { color: currentTheme.colors.textPrimary },
                          ]}
                        >
                          {t("viewDetails")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Swipeable>
          </View>
        </Animated.View>
      );
    },
    [
      navigateToChallengeDetails,
      handleRemoveChallenge,
      currentTheme,
      t,
      isDarkMode,
    ]
  );

  const renderEmptyState = useCallback(
    () => (
      <Animated.View
        entering={FadeInUp.delay(100)}
        style={styles.noChallengesContent}
      >
        <Ionicons
          name="bookmark-outline"
          size={normalizeSize(60)}
          color={currentTheme.colors.textSecondary}
          accessibilityLabel={t("noSavedChallengesIcon")}
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
          {t("noSavedChallenges")}
        </Text>
        <Text
          style={[
            styles.noChallengesSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("saveChallengesHere")}
        </Text>
      </Animated.View>
    ),
    [currentTheme, t]
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
            {t("loading")}
          </Text>
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
  {/* Orbes premium en arrière-plan */}
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

  {/* Header sans séparation */}
  <CustomHeader
    title={t("savedChallengesScreenTitle")}
    backgroundColor="transparent"
    useBlur={false}
    showHairline={false}
  />

  {/* Contenu */}
  <View style={styles.container}>
    {localChallenges.length === 0 ? (
      renderEmptyState()
    ) : (
      <FlatList
        data={localChallenges}
        renderItem={renderChallengeItem}
        keyExtractor={(item) => `saved-${item.id}`}
        contentContainerStyle={[styles.listContent, { flexGrow: 1, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: normalizeSize(ITEM_HEIGHT + SPACING * 1.5),
          offset: normalizeSize(ITEM_HEIGHT + SPACING * 1.5) * index,
          index,
        })}
        contentInset={{ top: SPACING, bottom: 0 }}
        accessibilityRole="list"
        accessibilityLabel={t("listOfSavedChallenges")}
        testID="saved-challenges-list"
      />
    )}
  </View>
  {showBanners && (
     <View style={styles.bannerContainer}>
       <BannerAd
  unitId={adUnitIds.banner}
  size={BannerAdSize.BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: npa }}
  onAdFailedToLoad={(err) =>
    console.error("Échec chargement bannière (SavedChallenges):", err)
  }
/>

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
  backgroundColor: "transparent",
},
bannerContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: SPACING / 2,
    backgroundColor: "transparent",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: { flex: 1 },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5,
    position: "relative",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay premium
    borderRadius: normalizeSize(20),
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingBottom: normalizeSize(80),
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
    borderWidth: 2.5,
  },
  cardImage: {
    width: normalizeSize(70),
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    marginRight: SPACING * 1.2,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  challengeCategory: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  viewButton: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  viewButtonGradient: {
    paddingVertical: normalizeSize(12),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  viewButtonText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
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
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  noChallengesContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
  },
  noChallengesText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  swipeActionsContainer: {
    width: SCREEN_WIDTH * 0.2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING,
  },
  trashButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: normalizeSize(25),
  },
});
