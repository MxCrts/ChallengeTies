import React, {
  useEffect,
  useState,
  useRef,
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
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, {
  FadeInUp,
  FadeOutRight,
  ZoomIn,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
 import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
 import * as Haptics from "expo-haptics";
import { Easing, useSharedValue, useAnimatedStyle, withTiming, withSequence } from "react-native-reanimated";
import { PlatformColor } from "react-native";
import { Audio } from "expo-av";
import { Image as ExpoImage } from "expo-image";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.42;
const ROW_HEIGHT = ITEM_HEIGHT + SPACING * 1.5;
const getItemLayoutConst = (_: any, index: number) => ({
  length: normalizeSize(ROW_HEIGHT),
  offset: normalizeSize(ROW_HEIGHT) * index,
  index,
});

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
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
  chatId?: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  day?: number;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { currentChallenges, markToday, removeChallenge, isMarkedToday } =
    useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const confettiRef = useRef<ConfettiCannon>(null);
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const [markingId, setMarkingId] = useState<string | null>(null);

  // ✅ Hook tab bar height sécurisé (évite le crash hors BottomTabs)
  const useOptionalTabBarHeight = () => {
    try {
      return useBottomTabBarHeight();
    } catch {
      return 0;
    }
  };
  const tabBarHeight = useOptionalTabBarHeight();

  const [adHeight, setAdHeight] = useState(0);

const bottomPadding = useMemo(
    () =>
      normalizeSize(90) +
      (showBanners ? adHeight : 0) +
      tabBarHeight +
      insets.bottom,
    [adHeight, showBanners, tabBarHeight, insets.bottom]
  );

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  // Log pour déboguer
  useEffect(() => {}, [currentChallenges]);

  // 🔊 Son de gain (optionnel, silencieux si le fichier n’existe pas)
  const gainWhooshRef = useRef<Audio.Sound | null>(null);
  const gainDingRef = useRef<Audio.Sound | null>(null);
  const gainSparkleRef = useRef<Audio.Sound | null>(null);
 const isPlayingFxRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1,
          interruptionModeIOS: 1,
        });
        const [{ sound: w }, { sound: d }, { sound: sp }] = await Promise.all([
       Audio.Sound.createAsync(require("../../assets/music/gain_whoosh.wav"), { shouldPlay: false }),
       Audio.Sound.createAsync(require("../../assets/music/gain_ding.wav"),   { shouldPlay: false }),
       Audio.Sound.createAsync(require("../../assets/music/gain_sparkle.wav"),{ shouldPlay: false }),
     ]);
     if (mounted) {
       gainWhooshRef.current = w;
       gainDingRef.current = d;
       gainSparkleRef.current = sp;
       await gainWhooshRef.current.setVolumeAsync(0.55);
       await gainDingRef.current.setVolumeAsync(0.8);
       await gainSparkleRef.current.setVolumeAsync(0.65);
     }
      } catch {
        // Pas de fichier ? Pas grave: on ignore.
      }
    })();
    return () => {
      mounted = false;
      gainWhooshRef.current?.unloadAsync().catch(() => {});
   gainDingRef.current?.unloadAsync().catch(() => {});
   gainSparkleRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

   // 🎵 Stack audio premium (whoosh -> ding -> sparkle) + petit haptic
  const playSuccessFx = useCallback(async () => {
    if (isPlayingFxRef.current) return;
    try {
      isPlayingFxRef.current = true;
      // haptic léger immédiat
      Haptics.selectionAsync().catch(() => {});
      // whoosh tout de suite
      await gainWhooshRef.current?.replayAsync();
      // petit délai puis ding
      setTimeout(() => {
        gainDingRef.current?.replayAsync().catch(() => {});
      }, 90);
      // puis sparkle
      setTimeout(() => {
        gainSparkleRef.current?.replayAsync().catch(() => {});
      }, 180);
    } finally {
      setTimeout(() => { isPlayingFxRef.current = false; }, 380);
    }
  }, []);

  const translatedChallenges = useMemo(() => {
    if (!currentChallenges || !Array.isArray(currentChallenges)) {
      return [];
    }

    // Filtrage assoupli : accepter les challenges avec id
    const validChallenges = currentChallenges.filter((item) => item.id);

    // Déduplication basée sur uniqueKey ou id_selectedDays
    const uniqueChallenges = Array.from(
      new Map(
        validChallenges.map((item) => [
          item.uniqueKey || `${item.id}_${item.selectedDays}`,
          item,
        ])
      ).values()
    ) as Challenge[];

    // Traduction des champs
    return uniqueChallenges.map((item) => ({
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
  }, [currentChallenges, i18n.language, t]);

  useEffect(() => {
    setLocalChallenges(translatedChallenges);
    setIsLoading(false);
  }, [translatedChallenges]);

  const handleMarkToday = useCallback(
    async (id: string, selectedDays: number) => {
      if (markingId) return;
      try {
        setMarkingId(`${id}_${selectedDays}`);
        const result = await markToday(id, selectedDays);
        if (result?.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setConfettiActive(true);
          // 🔊 stack audio premium
         playSuccessFx();
          // 💫 effet mini-gain avec Reanimated
          gainOpacity.value = withSequence(
            withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) })
          );
          gainY.value = withSequence(
            withTiming(-25, { duration: 400, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) })
          );
        }
      } catch (err) {
        console.error("Erreur markToday:", err);
        Alert.alert(t("error"), t("markTodayFailed"));
      } finally {
        setMarkingId(null);
      }
    },
    [markToday, t, markingId, playSuccessFx]
  );

 // 🎯 Animation Reanimated pour le "+1🏆"
  const gainOpacity = useSharedValue(0);
  const gainY = useSharedValue(0);

  const gainStyle = useAnimatedStyle(() => ({
    opacity: gainOpacity.value,
    transform: [{ translateY: gainY.value }],
  }));

  const handleRemove = useCallback(
    (id: string, selectedDays: number, index: number) => {
      Alert.alert(
        t("abandonChallenge"),
        t("abandonChallengeConfirm"),
        [
          {
            text: t("cancel"),
            style: "cancel",
            onPress: () => {
              swipeableRefs.current[index]?.close();
            },
          },
          {
            text: t("continue"),
            style: "destructive",
            onPress: async () => {
              try {
                setLocalChallenges((prev) =>
                  prev.filter(
                    (c) => !(c.id === id && c.selectedDays === selectedDays)
                  )
                );
                await removeChallenge(id, selectedDays);
                // Supprimé : await updateDoc(doc(db, "challenges", id), { participantsCount: increment(-1) });
                Alert.alert(t("abandoned"), t("challengeAbandoned"));
              } catch (err) {
                console.error("Erreur removeChallenge:", err);
                Alert.alert(t("error"), t("failedToAbandonChallenge"));
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

  // Swipe en 2 temps : on prépare l'action à l'ouverture, et on confirme par tap
  const pendingDeleteRef = useRef<null | (() => void)>(null);
  const renderRightActions = useCallback(
    (index: number) => (
      <View
        style={styles.swipeActionsContainer}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.trashButton}
          onPress={() => pendingDeleteRef.current?.()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={String(t("deleteChallenge"))}
          accessibilityHint={String(t("confirmDeletionHint"))}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <LinearGradient
            colors={["#F43F5E", "#DC2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="trash-outline" size={normalizeSize(26)} color="#fff" />
          <Text style={styles.trashLabel}>{t("delete")}</Text>
        </TouchableOpacity>
      </View>
    ),
    [t]
  );

  const navigateToDetail = useCallback(
    (item: Challenge) => {
      const titleParam = encodeURIComponent(item.title);
      const catParam = encodeURIComponent(item.category || "");
      const descParam = encodeURIComponent(item.description || "");
      const imgParam = encodeURIComponent(item.imageUrl || "");
      const route = `/challenge-details/${encodeURIComponent(
        item.id
      )}?title=${titleParam}&selectedDays=${item.selectedDays}&completedDays=${
        item.completedDays
      }&category=${catParam}&description=${descParam}&imageUrl=${imgParam}`;
      Haptics.selectionAsync().finally(() => router.push(route));
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Challenge; index: number }) => {
      const marked = isMarkedToday(item.id, item.selectedDays);
      const progress = Math.max(0, Math.min(1, (item.completedDays || 0) / Math.max(1, item.selectedDays || 1)));
      const key = `${item.id}_${item.selectedDays}`;
      const borderColor = isDarkMode
        ? currentTheme.colors.secondary
        : "#FF8C00";

      const animatedStyle = {
        transform: [{ scale: marked ? 0.98 : 1 }],
        opacity: marked ? 0.9 : 1,
      };

      return (
        <Animated.View
          entering={ZoomIn.delay(index * 40).easing(Easing.out(Easing.exp))}
          exiting={FadeOutRight.duration(250)}
          style={[styles.cardWrapper, animatedStyle]}
        >
          <View
            accessibilityLabel={`${t("challenge")} ${item.title}, ${t(
              "swipeToDelete"
            )}`}
            testID={`challenge-swipe-${key}`}
          >
            <Swipeable
              ref={(ref: any) => {
                swipeableRefs.current[index] = ref;
              }}
              renderRightActions={() => renderRightActions(index)}
              overshootRight={false}
              onSwipeableOpen={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                pendingDeleteRef.current = () => {
                  handleRemove(item.id, item.selectedDays, index);
                  pendingDeleteRef.current = null;
                };
              }}
              onSwipeableClose={() => { pendingDeleteRef.current = null; }}
            >
              <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => navigateToDetail(item)}
                activeOpacity={0.8}
                accessibilityLabel={String(t("viewChallengeDetails", { title: item.title }))}
                accessibilityHint={String(t("viewDetails"))}
                accessibilityRole="button"
                testID={`challenge-card-${key}`}
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.cardBackground,
                    currentTheme.colors.cardBackground + "F0",
                  ]}
                  style={[styles.card, { borderColor }]}
                >
                  <ExpoImage
                    source={{ uri: item.imageUrl || "https://via.placeholder.com/70" }}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={200}
                    placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
                    accessibilityLabel={String(t("challengeImage", { title: item.title }))}
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
                    {item.day !== undefined && (
                      <Text
                        style={[
                          styles.challengeDay,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {String(t("day"))} {item.day}
                      </Text>
                    )}
                    <View style={styles.progressContainer}>
                      <Progress.Bar
                        progress={progress}
                        width={null}
                        height={normalizeSize(6)}
                        borderRadius={normalizeSize(3)}
                        color={currentTheme.colors.secondary}
                        unfilledColor={withAlpha(
                          currentTheme.colors.secondary,
                          0.15
                        )}
                        borderWidth={0}
                        animationType="spring"
                        style={styles.progressBar}
                      />
                      <Text
                        style={[
                          styles.progressText,
                          { color: currentTheme.colors.secondary },
                        ]}
                      >
                        {item.completedDays}/{item.selectedDays} {String(t("days"))}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.markTodayButton,
                        (marked || (markingId === key)) && styles.disabledMarkButton,
                      ]}
                      onPress={() =>
                        handleMarkToday(item.id, item.selectedDays)
                      }
                      disabled={marked || (markingId === key)}
                      accessibilityLabel={
                        marked
                          ? t("alreadyMarkedToday", { title: item.title })
                          : t("markToday", { title: item.title })
                      }
                      accessibilityHint={marked ? String(t("alreadyMarked")) : String(t("markTodayButton"))}
                      accessibilityRole="button"
                      testID={`mark-today-${key}`}
                    >
                      <LinearGradient
                        colors={
                          marked
                            ? isDarkMode
                              ? ["#4A4A4A", "#2A2A2A"]
                              : ["#000000", "#333333"]
                            : [
                                currentTheme.colors.secondary,
                                currentTheme.colors.primary,
                              ]
                        }
                        style={styles.markTodayGradient}
                      >
                        <Text
                          style={[
                            styles.markTodayText,
                            {
                              color: marked
                                ? "#FFFFFF"
                                : currentTheme.colors.textPrimary,
                              textAlign: "center",
                            },
                          ]}
                        >
                          {marked ? t("alreadyMarked") : t("markTodayButton")}
                        </Text>
                         {!marked && (
                          <Animated.View
                            entering={FadeInUp.delay(200)}
                            style={{
                              position: "absolute",
                              top: -8,
                              right: 10,
                              backgroundColor: withAlpha(
                                currentTheme.colors.secondary,
                                0.25
                              ),
                              borderRadius: 999,
                              width: 6,
                              height: 6,
                            }}
                          />
                        )}
                         {marked && (
                          <Animated.View
                            style={[
                              gainStyle,
                              {
                                position: "absolute",
                                top: -28,
                                right: 18,
                                backgroundColor: "transparent",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: currentTheme.colors.secondary,
                                fontSize: normalizeSize(13),
                                fontWeight: "700",
                                textShadowColor: withAlpha(currentTheme.colors.primary, 0.3),
                                textShadowRadius: 6,
                                includeFontPadding: false,
                              }}
                            >
                              +1🏆
                            </Text>
                          </Animated.View>
                        )}
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
      currentTheme,
      isMarkedToday,
      handleMarkToday,
      handleRemove,
      navigateToDetail,
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
          name="hourglass-outline"
          size={normalizeSize(60)}
          color={currentTheme.colors.textSecondary}
          accessibilityLabel={String(t("waitingChallengeIcon"))}
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
          {String(t("noOngoingChallenge"))}
        </Text>
        <Text
          style={[
            styles.noChallengesSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {String(t("startAChallenge"))}
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
            {String(t("loading"))}
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

  {/* Header fusionné (pas de séparation) */}
  <CustomHeader
    title={String(t("ongoingChallenges"))}
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
        renderItem={renderItem}
        keyExtractor={(item) => (item as any).uniqueKey || `current-${item.id}_${item.selectedDays}`}
        contentContainerStyle={[
          styles.listContent,
          { flexGrow: 1, paddingBottom: bottomPadding },
        ]}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        getItemLayout={getItemLayoutConst}
        contentInset={{ top: SPACING, bottom: 0 }}
        accessibilityRole="list"
        accessibilityLabel={String(t("listOfOngoingChallenges"))}
        testID="challenges-list"
      />
    )}
    {confettiActive && (
      <ConfettiCannon
        count={100}
        origin={{ x: -10, y: 0 }}
        autoStart
        fadeOut
        ref={confettiRef}
        onAnimationEnd={() => setConfettiActive(false)}
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

  container: { flex: 1 },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingTop: SPACING * 2.5,
    position: "relative",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareButton: {
    padding: normalizeSize(10),
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SCREEN_WIDTH * 0.025,
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
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
  cardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
    backgroundColor:
      Platform.OS === "ios"
        ? "transparent"
        : PlatformColor("@android:color/background_dark"),
        overflow: "hidden",
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
    padding: normalizeSize(14),
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
  },
  cardImage: {
    width: normalizeSize(62),
    aspectRatio: 1,
    borderRadius: normalizeSize(16),
    marginRight: SPACING * 0.9,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  challengeTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(2),
  },
  challengeDay: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  progressContainer: {
    marginVertical: normalizeSize(8),
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(12.5),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(6),
  },
  markTodayButton: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  disabledMarkButton: {
    opacity: 0.7,
  },
  markTodayGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: SPACING * 1.2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(18),
  },
  markTodayText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14.5),
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
  // --- Swipe delete premium
  swipeActionsContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: normalizeSize(10),
  },
  trashButton: {
    // pill centré verticalement, dimension stable quel que soit le device
    width: Math.min(ITEM_WIDTH * 0.26, 120),
    height: Math.max(normalizeSize(ROW_HEIGHT * 0.72), 64),
    borderTopLeftRadius: normalizeSize(22),
    borderBottomLeftRadius: normalizeSize(22),
    borderTopRightRadius: normalizeSize(18),
    borderBottomRightRadius: normalizeSize(18),
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    // légère ombre premium
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: normalizeSize(6),
  },
  trashLabel: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 0.3,
  },
});
