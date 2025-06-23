import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
  Animated as RNAnimated,
  Share,
  StatusBar,
  Platform,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  doc,
  onSnapshot,
  runTransaction,
  getDoc,
  updateDoc,
  increment,
  query,
  collection,
  where,
} from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import ChallengeCompletionModal from "../../components/ChallengeCompletionModal";
import DurationSelectionModal from "../../components/DurationSelectionModal";
import StatsModal from "../../components/StatsModal";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import BackButton from "../../components/BackButton";
import { useTranslation } from "react-i18next";
import { createInvitation } from "../../services/invitationService"; // NEW: Import createInvitation
import InvitationModal from "../../components/InvitationModal";
import share from "react-native-share";

import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;
const BANNER_HEIGHT = 50;
const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const dayIcons: Record<
  number,
  | "sunny-outline"
  | "flash-outline"
  | "timer-outline"
  | "calendar-outline"
  | "speedometer-outline"
  | "trending-up-outline"
  | "barbell-outline"
  | "rocket-outline"
> = {
  7: "sunny-outline",
  14: "flash-outline",
  21: "timer-outline",
  30: "calendar-outline",
  60: "speedometer-outline",
  90: "trending-up-outline",
  180: "barbell-outline",
  365: "rocket-outline",
};

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

export default function ChallengeDetails() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    category?: string;
    description?: string;
    selectedDays?: string;
    completedDays?: string;
  }>();
  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const id = params.id || "";

  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const {
    currentChallenges,
    takeChallenge,
    removeChallenge: removeCurrentChallenge,
    markToday,
    isMarkedToday,
    completeChallenge,
    simulateStreak,
  } = useCurrentChallenges();

  const currentChallenge = currentChallenges.find(
    (ch) => ch.id === id && ch.uniqueKey === `${id}_${ch.selectedDays}`
  );
  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-4725616526467159/3887969618";

  const [loading, setLoading] = useState(true);
  const [userHasTaken, setUserHasTaken] = useState(false);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([
    7, 14, 21, 30, 60, 90, 180, 365,
  ]);
  const [routeTitle, setRouteTitle] = useState(
    params.title || t("challengeDetails.untitled")
  );
  const [routeCategory, setRouteCategory] = useState(
    params.category || t("challengeDetails.uncategorized")
  );
  const [routeDescription, setRouteDescription] = useState(
    params.description || t("challengeDetails.noDescription")
  );
  const [localSelectedDays, setLocalSelectedDays] = useState<number>(10);
  const [finalSelectedDays, setFinalSelectedDays] = useState<number>(0);
  const [finalCompletedDays, setFinalCompletedDays] = useState<number>(0);
  const [userCount, setUserCount] = useState(0);
  const [stats, setStats] = useState<Stat[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [baseTrophyAmount, setBaseTrophyAmount] = useState(0);
  const [pendingFavorite, setPendingFavorite] = useState<boolean | null>(null);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!id) return;
    const challengeRef = doc(db, "challenges", id);
    const unsubscribe = onSnapshot(
      challengeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("📊 Données du défi :", data); // Log pour débogage
          setChallengeImage(data.imageUrl || null);
          setDaysOptions(data.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365]);
          setUserHasTaken(
            (data.usersTakingChallenge || []).includes(auth.currentUser?.uid)
          );
          setUserCount(data.participantsCount || 0);
          // Ajoute les données pour l’UI
          setRouteTitle(data.title || t("challengeDetails.untitled"));
          setRouteCategory(
            data.category || t("challengeDetails.uncategorized")
          );
          setRouteDescription(
            data.description || t("challengeDetails.noDescription")
          );
        } else {
          console.warn("⚠️ Défi non trouvé pour ID :", id);
        }
        setLoading(false);
      },
      (error) => {
        console.error("❌ Erreur récupération défi :", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [id, t]);

  useEffect(() => {
    if (!auth.currentUser || !id) return;

    const q = query(
      collection(db, "invitations"),
      where("inviteeId", "==", auth.currentUser.uid),
      where("challengeId", "==", id),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const inviteDoc = snapshot.docs[0];
          console.log("✅ INVITATION TROUVÉE :", inviteDoc.id);
          setInvitation({ id: inviteDoc.id });
          setTimeout(() => {
            setInvitationModalVisible(true); // pour éviter bug de navigation trop rapide
          }, 300);
        } else {
          console.log("❌ Aucune invitation en attente");
          setInvitation(null);
          setInvitationModalVisible(false);
        }
      },
      (error) => {
        console.error("🔥 Erreur onSnapshot invitation :", error);
      }
    );

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const found = currentChallenges.find((ch: any) => ch.id === id);
    if (found) {
      setFinalSelectedDays(found.selectedDays);
      setFinalCompletedDays(found.completedDays > 0 ? found.completedDays : 0);
    }
  }, [currentChallenges, id]);

  useEffect(() => {
    const exists = currentChallenges.find((ch) => ch.id === id);
    if (!exists) {
      setUserHasTaken(false);
      setFinalSelectedDays(0);
      setFinalCompletedDays(0);
    }
  }, [currentChallenges, id]);

  useEffect(() => {
    if (!userHasTaken) return;
    const totalSaved = savedChallenges.length;
    const uniqueOngoing = new Map(
      currentChallenges.map((ch: any) => [`${ch.id}_${ch.selectedDays}`, ch])
    );
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (challenge) => challenge.completedDays === challenge.selectedDays
    ).length;
    const successRate =
      totalOngoing + totalCompleted > 0
        ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
        : 0;
    const longestStreak = 0;
    const trophies = 0;
    const achievementsUnlocked = 0;

    const newStats: Stat[] = [
      { name: "Challenges Saved", value: totalSaved, icon: "bookmark-outline" },
      {
        name: "Ongoing Challenges",
        value: totalOngoing,
        icon: "hourglass-outline",
      },
      {
        name: "Challenges Completed",
        value: totalCompleted,
        icon: "trophy-outline",
      },
      {
        name: "Success Rate",
        value: `${successRate}%`,
        icon: "stats-chart-outline",
      },
      { name: "Trophies", value: trophies, icon: "medal-outline" },
      {
        name: "Achievements Unlocked",
        value: achievementsUnlocked,
        icon: "ribbon-outline",
      },
      {
        name: "Longest Streak",
        value: `${longestStreak} days`,
        icon: "flame-outline",
      },
    ];
    setStats(newStats);
  }, [savedChallenges, currentChallenges, userHasTaken]);

  const isSavedChallenge = (challengeId: string) =>
    savedChallenges.some((ch) => ch.id === challengeId);

  const formatDate = (date: Date) => date.toDateString();

  const getCalendarDays = (): (null | {
    day: number;
    date: Date;
    completed: boolean;
  })[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const completions: string[] = currentChallenge?.completionDates || [];
    const calendar: (null | { day: number; date: Date; completed: boolean })[] =
      [];
    for (let i = 0; i < firstDayIndex; i++) {
      calendar.push(null);
    }
    for (let day = 1; day <= numDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = formatDate(dateObj);
      const completed = completions.includes(dateStr);
      calendar.push({ day, date: dateObj, completed });
    }
    return calendar;
  };

  const calendarDays = getCalendarDays();

  const goToPrevMonth = () => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );
    setCurrentMonth(newMonth);
  };

  const monthName = currentMonth.toLocaleString(i18n.language, {
    month: "long",
  });
  const currentYearNum = currentMonth.getFullYear();

  const alreadyMarkedToday = currentChallenge
    ? currentChallenge.completionDates?.includes(new Date().toDateString())
    : false;

  const showCompleteButton =
    userHasTaken &&
    finalSelectedDays > 0 &&
    finalCompletedDays >= finalSelectedDays;
  const progressPercent =
    finalSelectedDays > 0
      ? Math.min(1, finalCompletedDays / finalSelectedDays)
      : 0;

  const handleTakeChallenge = useCallback(async () => {
    if (userHasTaken || !id) return;
    try {
      setLoading(true);
      const challengeRef = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) {
        Alert.alert(t("alerts.error"), t("challengeDetails.fetchError"));
        return;
      }
      const challengeData = challengeSnap.data();
      await takeChallenge(
        {
          id,
          title: challengeData.title || "Untitled Challenge",
          category: challengeData.category || "Uncategorized",
          description: challengeData.description || "No description available",
          daysOptions: challengeData.daysOptions || [
            7, 14, 21, 30, 60, 90, 180, 365,
          ],
          chatId: challengeData.chatId || id,
          imageUrl: challengeData.imageUrl || "",
        },
        localSelectedDays
      );
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const uid = auth.currentUser?.uid;
        const updatedUsers = currentUsers.includes(uid)
          ? currentUsers
          : currentUsers.concat([uid]);
        transaction.update(challengeRef, {
          participantsCount: currentCount + 1,
          usersTakingChallenge: updatedUsers,
        });
      });
      setUserHasTaken(true);
      setModalVisible(false);
      setFinalSelectedDays(localSelectedDays);
      setFinalCompletedDays(0);
    } catch (err) {
      Alert.alert(
        t("alerts.error"),
        err instanceof Error ? err.message : t("challengeDetails.joinError")
      );
    } finally {
      setLoading(false);
    }
  }, [id, userHasTaken, localSelectedDays, takeChallenge]);

  const handleSaveChallenge = useCallback(async () => {
    if (!id) return;
    setPendingFavorite(!isSavedChallenge(id));
    try {
      const challengeRef = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) {
        Alert.alert(t("alerts.error"), t("challengeDetails.fetchError"));
        setPendingFavorite(null);
        return;
      }
      const challengeData = challengeSnap.data();
      const challengeObj = {
        id,
        title: challengeData.title || "Untitled Challenge",
        category: challengeData.category || "Uncategorized",
        description: challengeData.description || "No description available",
        daysOptions: challengeData.daysOptions || [
          7, 14, 21, 30, 60, 90, 180, 365,
        ],
        chatId: challengeData.chatId || id,
        imageUrl: challengeData.imageUrl || "",
      };
      if (isSavedChallenge(id)) {
        await removeChallenge(id);
      } else {
        await addChallenge(challengeObj);
      }
      setPendingFavorite(null);
    } catch (err) {
      Alert.alert(
        t("alerts.error"),
        err instanceof Error ? err.message : t("challengeDetails.saveError")
      );
      setPendingFavorite(null);
    }
  }, [id, savedChallenges, addChallenge, removeChallenge]);

  const handleShowCompleteModal = useCallback(() => {
    setBaseTrophyAmount(finalSelectedDays);
    setCompletionModalVisible(true);
  }, [finalSelectedDays]);

  const handleClaimTrophiesWithoutAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, false);
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge]);

  const handleClaimTrophiesWithAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, true);
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge]);

  const handleNavigateToChat = useCallback(() => {
    if (!userHasTaken) {
      Alert.alert(
        t("alerts.accessDenied"),
        t("challengeDetails.chatAccessDenied")
      );
      return;
    }
    router.push(
      `/challenge-chat/${id}?title=${encodeURIComponent(routeTitle)}`
    );
  }, [id, userHasTaken, routeTitle, router]);

  const handleShareChallenge = useCallback(async () => {
    try {
      const inviteLink = await createInvitation(id as string);
      const shareOptions = {
        title: t("challengeDetails.invite"),
        message: `Rejoins mon défi "${routeTitle}" sur ChallengeTies ! ${inviteLink}`,
      };
      const result = await Share.share(shareOptions);
      if (result.action === Share.sharedAction) {
        const userId = auth.currentUser?.uid;
        if (userId) {
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            shareChallenge: increment(1),
          });
          console.log("Compteur de partage incrémenté.");
          await checkForAchievements(userId);
        }
        console.log("Challenge partagé:", inviteLink);
      } else if (result.action === Share.dismissedAction) {
        console.log("Partage annulé");
      }
    } catch (error: any) {
      Alert.alert(t("alerts.shareError"), error.message);
    }
  }, [id, routeTitle]);

  const handleViewStats = useCallback(() => {
    if (!userHasTaken) return;
    setStatsModalVisible(true);
  }, [userHasTaken]);

  if (loading) {
    return (
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.loadingContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View entering={FadeInUp}>
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("challengeDetails.loading")}
          </Text>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false}
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BANNER_HEIGHT + SPACING * 2 }} // Ajoute un padding bottom pour dépasser la bannière
      >
        <View style={styles.headerWrapper}>
          <Animated.View entering={FadeInUp} style={styles.backButtonContainer}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, styles.backButtonOverlay]}
              accessibilityLabel={t("backButton")}
              accessibilityHint={t("backButtonHint")}
              testID="back-button"
            >
              <Ionicons
                name="arrow-back"
                size={normalizeSize(24)}
                color={isDarkMode ? "#FFD700" : currentTheme.colors.secondary}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
        <View style={styles.carouselContainer}>
          <LinearGradient
            colors={[
              currentTheme.colors.primary,
              currentTheme.colors.secondary,
            ]}
            style={styles.imageContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {challengeImage ? (
              <Image
                source={{ uri: challengeImage }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  { backgroundColor: currentTheme.colors.overlay },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={normalizeSize(80)}
                  color={currentTheme.colors.textPrimary}
                />
                <Text
                  style={[
                    styles.noImageText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  Image non disponible
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.infoRecipeContainer}
        >
          <Text
            style={[
              styles.infoRecipeName,
              {
                color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
              }, // Couleur dynamique
            ]}
          >
            {routeTitle}
          </Text>
          <Text
            style={[styles.category, { color: currentTheme.colors.secondary }]}
          >
            {routeCategory.toUpperCase()}
          </Text>
          <View style={styles.infoContainer}>
            <Ionicons
              name="people-outline"
              size={normalizeSize(20)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.infoRecipe,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {userCount}{" "}
              {t(`challengeDetails.participant${userCount > 1 ? "s" : ""}`)}
            </Text>
          </View>
          {!userHasTaken && (
            <TouchableOpacity
              style={styles.takeChallengeButton}
              onPress={() => setModalVisible(true)}
              accessibilityLabel="Prendre le défi"
              testID="take-challenge-button"
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.takeChallengeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  style={[
                    styles.takeChallengeButtonText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("challengeDetails.takeChallenge")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {userHasTaken &&
            !(
              finalSelectedDays > 0 && finalCompletedDays >= finalSelectedDays
            ) && (
              <Animated.View entering={FadeInUp.delay(200)}>
                <Text
                  style={[
                    styles.inProgressText,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {t("challengeDetails.inProgress")}
                </Text>
                <View
                  style={[
                    styles.progressBarBackground,
                    { backgroundColor: currentTheme.colors.border },
                  ]}
                >
                  <LinearGradient
                    colors={
                      isDarkMode
                        ? ["#FFD700", "#FFD700"] // Gold uni en dark mode
                        : [
                            currentTheme.colors.primary,
                            currentTheme.colors.secondary,
                          ]
                    }
                    style={[
                      styles.progressBarFill,
                      { width: progressPercent * normalizeSize(200) },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </View>
                <Text
                  style={[
                    styles.progressText,
                    { color: currentTheme.colors.secondary },
                  ]}
                >
                  {finalCompletedDays}/{finalSelectedDays}{" "}
                  {t("challengeDetails.daysCompleted")}
                </Text>
                <TouchableOpacity
                  style={styles.markTodayButton}
                  onPress={() => {
                    if (!isMarkedToday(id, finalSelectedDays)) {
                      setFinalCompletedDays((prev) => prev + 1);
                      markToday(id, finalSelectedDays);
                    }
                  }}
                  disabled={isMarkedToday(id, finalSelectedDays)}
                  accessibilityLabel={
                    isMarkedToday(id, finalSelectedDays)
                      ? t("challengeDetails.alreadyMarked")
                      : t("challengeDetails.markToday")
                  }
                  testID="mark-today-button"
                >
                  {isMarkedToday(id, finalSelectedDays) ? (
                    <View
                      style={[
                        styles.markTodayButtonGradient,
                        { backgroundColor: "#808080" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.markTodayButtonText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        {t("challengeDetails.alreadyMarked")}
                      </Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[
                        currentTheme.colors.primary,
                        currentTheme.colors.secondary,
                      ]}
                      style={styles.markTodayButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text
                        style={[
                          styles.markTodayButtonText,
                          { color: currentTheme.colors.textPrimary },
                        ]}
                      >
                        {t("challengeDetails.markToday")}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          <Text
            style={[
              styles.infoDescriptionRecipe,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {routeDescription}
          </Text>
          {userHasTaken &&
            finalSelectedDays > 0 &&
            finalCompletedDays >= finalSelectedDays && (
              <TouchableOpacity
                style={styles.completeChallengeButton}
                onPress={handleShowCompleteModal}
                accessibilityLabel="Terminer le défi"
                testID="complete-challenge-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.primary,
                    currentTheme.colors.secondary,
                  ]}
                  style={styles.completeChallengeButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={[
                      styles.completeChallengeButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("challengeDetails.completeChallenge")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          <Animated.View
            entering={FadeInUp.delay(300)}
            style={styles.actionIconsContainer}
          >
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleNavigateToChat}
              accessibilityLabel={t("challengeDetails.chatA11y")}
              testID="chat-button"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={normalizeSize(22)} // Taille réduite pour compacité
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("challengeDetails.chat")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleSaveChallenge}
              accessibilityLabel={
                isSavedChallenge(id)
                  ? t("challengeDetails.removeSavedA11y")
                  : t("challengeDetails.saveA11y")
              }
              testID="save-button"
            >
              <Ionicons
                name={
                  pendingFavorite !== null
                    ? pendingFavorite
                      ? "bookmark"
                      : "bookmark-outline"
                    : isSavedChallenge(id)
                    ? "bookmark"
                    : "bookmark-outline"
                }
                size={normalizeSize(22)} // Taille réduite
                color={
                  pendingFavorite !== null
                    ? pendingFavorite
                      ? currentTheme.colors.secondary
                      : currentTheme.colors.textSecondary
                    : isSavedChallenge(id)
                    ? currentTheme.colors.secondary
                    : currentTheme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {pendingFavorite !== null
                  ? pendingFavorite
                    ? t("challengeDetails.saved")
                    : t("challengeDetails.save")
                  : isSavedChallenge(id)
                  ? t("challengeDetails.saved")
                  : t("challengeDetails.save")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleShareChallenge}
              accessibilityLabel={t("challengeDetails.shareA11y")}
              testID="share-button"
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(22)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("challengeDetails.share")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionIcon, { opacity: userHasTaken ? 1 : 0.5 }]}
              onPress={userHasTaken ? handleViewStats : undefined}
              accessibilityLabel={t("challengeDetails.statsA11y")}
              testID="stats-button"
              disabled={!userHasTaken}
            >
              <Ionicons
                name="stats-chart-outline"
                size={normalizeSize(22)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("challengeDetails.stats")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={async () => {
                try {
                  const inviteLink = await createInvitation(id as string);
                  await share.open({
                    message: `Rejoins mon défi sur ChallengeTies ! Clique ici : ${inviteLink}`,
                    title: t("challengeDetails.invite"),
                    url: inviteLink,
                  });
                  console.log("📩 Invitation partagée:", inviteLink);

                  const userId = auth.currentUser?.uid;
                  if (userId) {
                    const userRef = doc(db, "users", userId);
                    await updateDoc(userRef, {
                      shareChallenge: increment(1),
                    });
                    await checkForAchievements(userId);
                  }
                } catch (error: any) {
                  // Ne rien faire si l'utilisateur annule
                  if (
                    error.message?.includes("User did not share") ||
                    error.message?.includes("cancelled")
                  ) {
                    console.log("ℹ️ Partage annulé par l'utilisateur.");
                  } else {
                    console.error("❌ Erreur partage invitation:", error);
                    Alert.alert(
                      t("alerts.error"),
                      t("challengeDetails.inviteError")
                    );
                  }
                }
              }}
              accessibilityLabel={t("challengeDetails.inviteA11y")}
              testID="invite-button"
            >
              <Ionicons
                name="person-add-outline"
                size={normalizeSize(22)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("challengeDetails.invite")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <DurationSelectionModal
        visible={modalVisible}
        daysOptions={daysOptions}
        selectedDays={localSelectedDays}
        onSelectDays={setLocalSelectedDays}
        onConfirm={handleTakeChallenge}
        onCancel={() => setModalVisible(false)}
        dayIcons={dayIcons}
      />

      {completionModalVisible && (
        <ChallengeCompletionModal
          visible={completionModalVisible}
          challengeId={id}
          selectedDays={finalSelectedDays}
          onClose={() => setCompletionModalVisible(false)}
        />
      )}

      <StatsModal
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        monthName={monthName}
        currentYearNum={currentYearNum}
        calendarDays={calendarDays}
        goToPrevMonth={goToPrevMonth}
        goToNextMonth={goToNextMonth}
      />
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
        <InvitationModal
          visible={invitationModalVisible}
          inviteId={invitation?.id || null}
          challengeId={id as string}
          onClose={() => setInvitationModalVisible(false)}
        />
      </View>
      <InvitationModal
        visible={invitationModalVisible}
        inviteId={invitation?.id || null}
        challengeId={id as string}
        onClose={() => setInvitationModalVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: BANNER_HEIGHT + SPACING * 2, // Ajoute un padding bottom au conteneur principal
  },
  carouselContainer: {
    height: SCREEN_HEIGHT * 0.3,
    zIndex: 10, // Réduit le zIndex pour que le back button passe au-dessus
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.3,
    borderBottomLeftRadius: normalizeSize(30),
    borderBottomRightRadius: normalizeSize(30),
    overflow: "hidden",
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1, // Assure que la bannière reste au-dessus mais ne coupe pas
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: SCREEN_HEIGHT * 0.3,
  },
  backButtonContainer: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 20, // Augmente le zIndex pour être au-dessus de l'image et du gradient
  },
  backButton: {
    padding: SPACING / 2,
  },
  backButtonOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay semi-transparent
    borderRadius: normalizeSize(20),
    padding: SPACING / 2,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    marginTop: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  infoRecipeContainer: {
    flex: 1,
    padding: SPACING,
    paddingTop: SPACING,
    alignItems: "center", // Déjà présent, juste pour confirmer
    justifyContent: "center", // Ajoute pour centrage vertical
  },
  infoRecipeName: {
    fontSize: normalizeSize(28),
    marginVertical: SPACING / 4,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  category: {
    fontSize: normalizeSize(14),
    marginVertical: SPACING / 2,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: SPACING / 2,
  },
  infoRecipe: {
    fontSize: normalizeSize(14),
    marginLeft: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  takeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  takeChallengeButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
  },
  takeChallengeButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  inProgressText: {
    fontSize: normalizeSize(16),
    marginTop: SPACING,
    fontFamily: "Comfortaa_700Bold",
  },
  markTodayButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  markTodayButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(25), // Ajoute pour cohérence
  },
  markTodayButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  progressText: {
    fontSize: normalizeSize(14),
    marginBottom: SPACING,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  progressBarBackground: {
    width: normalizeSize(250),
    height: normalizeSize(10),
    borderRadius: normalizeSize(5),
    overflow: "hidden",
    alignSelf: "center", // Déjà présent
    marginTop: SPACING,
  },
  progressBarFill: {
    height: "100%",
  },
  completeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  completeChallengeButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
  },
  completeChallengeButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  infoDescriptionRecipe: {
    textAlign: "center",
    fontSize: normalizeSize(16),
    marginTop: SPACING * 2,
    marginHorizontal: SPACING,
    lineHeight: normalizeSize(22),
    fontFamily: "Comfortaa_400Regular",
  },
  actionIconsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SPACING * 2,
    minWidth: "100%",
    paddingHorizontal: SPACING / 2,
    paddingBottom: BANNER_HEIGHT + SPACING, // Ajoute un padding bottom pour plus d’espace
  },
  actionIcon: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: normalizeSize(8),
    marginVertical: normalizeSize(12), // Augmente l’espacement vertical pour un look premium
    width: normalizeSize(70),
    minHeight: normalizeSize(80), // Augmente la hauteur minimale pour que le texte soit bien visible
  },
  actionIconLabel: {
    marginTop: normalizeSize(4),
    fontSize: normalizeSize(12), // Augmente légèrement la taille pour lisibilité
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
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
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING / 2,
    position: "relative",
    marginTop: SPACING,
    marginBottom: SPACING,
  },
});
