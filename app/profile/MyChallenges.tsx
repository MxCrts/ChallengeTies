import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { Image as ExpoImage } from "expo-image";
import type { ListRenderItem } from "react-native";
import * as Haptics from "expo-haptics";

const SPACING = 18; // Déjà aligné avec CompletedChallenges.tsx et Achievements.tsx
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9; // Conservé
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const ROW_HEIGHT = ITEM_HEIGHT + SPACING * 1.5;
const getItemLayoutConst = (_: any, index: number) => ({
  length: normalizeSize(ROW_HEIGHT),
  offset: normalizeSize(ROW_HEIGHT) * index,
  index,
});

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8); // Limite l'échelle
  return Math.round(size * scale);
};


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
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  participantsCount: number;
  chatId?: string;
  approved: boolean;
  updatedAt?: any;
}

export default function MyChallenges() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(() => (
    isDarkMode ? designSystem.darkTheme : designSystem.lightTheme
  ), [isDarkMode]);
  const { showBanners } = useAdsVisibility();
const insets = useSafeAreaInsets();
  // Safe: support écran hors BottomTabs
  const tabBarHeight = (() => { try { return useBottomTabBarHeight(); } catch { return 0; } })();
  const [adHeight, setAdHeight] = useState(0);
  const bottomPadding = useMemo(
    () => normalizeSize(90) + (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom,
    [adHeight, showBanners, tabBarHeight, insets.bottom]
  );


  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const { createdChallenges = [] } = snapshot.data() || {};
          if (!Array.isArray(createdChallenges) || createdChallenges.length === 0) {
            setMyChallenges([]);
            setIsLoading(false);
            return;
          }

          const raw = await Promise.all(
            createdChallenges.map(async ({ id, ...rest }) => {
              try {
                const snap = await getDoc(doc(db, "challenges", id));
                const data = snap.exists() ? snap.data() : {};
                return {
                  id,
                  ...rest,
                  participantsCount: data.participantsCount || 0,
                  ...data,
                };
              } catch (error) {
                console.error(`Erreur getDoc pour challenge ${id}:`, error);
                return null;
              }
            })
          );

          const translated = raw
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map((item) => ({
              ...item,
              title: item.chatId
                ? t(`challenges.${item.chatId}.title`, {
                    defaultValue: item.title,
                  })
                : item.title,
              description: item.chatId
                ? t(`challenges.${item.chatId}.description`, {
                    defaultValue: item.description || "",
                  })
                : item.description,
              category: item.category
                ? t(`categories.${item.category}`, {
                    defaultValue: item.category,
                  })
                : t("noCategory"),
            }))
            .filter((c) => c.approved)
            // Tri: d'abord par popularité, puis par date (si dispo), puis alpha
            .sort((a, b) => {
              const p = (b.participantsCount || 0) - (a.participantsCount || 0);
              if (p !== 0) return p;
              const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const dbb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              if (dbb !== da) return dbb - da;
              return String(a.title || "").localeCompare(String(b.title || ""));
            });

          setMyChallenges(translated);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur onSnapshot:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t, i18n.language]);

  const navigateToChallengeDetails = useCallback(
    (item: Challenge) => {
      const params = new URLSearchParams({
        title: item.title,
        category: item.category || "",
        description: item.description || "",
        imageUrl: item.imageUrl || "",
      }).toString();
      Haptics.selectionAsync().catch(() => {});
      router.push(`/challenge-details/${encodeURIComponent(item.id)}?${params}`);
    },
    [router]
  );

  const renderChallenge: ListRenderItem<Challenge> = useCallback(
    ({ item, index }) => (
      <Animated.View
        entering={ZoomIn.delay(index * 100)}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigateToChallengeDetails(item)}
          activeOpacity={0.8} // Aligné avec CompletedChallenges.tsx
          accessibilityLabel={t("viewChallengeDetails", { title: item.title })}
          accessibilityHint={t("viewDetails")}
          accessibilityRole="button"
          testID={`challenge-${item.id}`}
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
            ]} // Bordure dynamique
          >
            {item.imageUrl ? (
              <ExpoImage
                source={{ uri: item.imageUrl }}
                style={styles.cardImage}
                contentFit="cover"
                transition={200}
                placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
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
                  accessibilityLabel={t("noImage")}
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
                  styles.challengeCategory,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {item.category}
              </Text>
              {typeof item.participantsCount === "number" && item.participantsCount > 0 && (
                <Text
                  style={[
                    styles.participantsText,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t(
                    item.participantsCount > 1 ? "participants" : "participant",
                    { count: item.participantsCount }
                  )}
                </Text>
              )}
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => navigateToChallengeDetails(item)}
                accessibilityLabel={t("viewDetails")}
                accessibilityRole="button"
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
      </Animated.View>
    ),
    [currentTheme, navigateToChallengeDetails, t, isDarkMode]
  );

  const renderEmptyState = useCallback(
  () => (
    <View style={styles.noChallengesContainer}>
      <Animated.View entering={FadeInUp.delay(100)} style={styles.noChallengesContent}>
        <Ionicons
          name="create-outline"
          size={normalizeSize(60)}
          color={currentTheme.colors.textSecondary}
          accessibilityLabel={t("noChallengesCreated")}
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
          {t("noChallengesCreated")}
        </Text>
        <Text
          style={[
            styles.noChallengesSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("createFirstChallenge")}
        </Text>
      </Animated.View>
    </View>
  ),
  [currentTheme, t, isDarkMode]
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
            {t("loadingChallenges")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />

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

      <CustomHeader
        title={t("myChallenges")}
        backgroundColor="transparent"
        useBlur={false}
        showHairline={false}
      />

      <View style={styles.container}>
        {myChallenges.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={myChallenges}
            renderItem={renderChallenge}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { flexGrow: 1, paddingBottom: bottomPadding }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            getItemLayout={getItemLayoutConst}
            contentInset={{ top: SPACING, bottom: 0 }}
          />
        )}
      </View>
      {showBanners && (
  <View
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: tabBarHeight + insets.bottom,
      alignItems: "center",
      backgroundColor: "transparent",
      paddingBottom: 6,
      zIndex: 9999,
    }}
    pointerEvents="box-none"
  >
    <BannerSlot onHeight={(h) => setAdHeight(h)} />
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
},

  container: {
    flex: 1,
  },
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
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    marginRight: SPACING * 1.2,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
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
  participantsText: {
    fontSize: normalizeSize(14),
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
    fontSize: normalizeSize(16), // Aligné avec CompletedChallenges.tsx
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
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
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
    fontSize: normalizeSize(22), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(18), // Aligné avec CompletedChallenges.tsx
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75, // Responsive
  },
});
