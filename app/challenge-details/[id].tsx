import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
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
import InvitationModal from "../../components/InvitationModal";
import share from "react-native-share";
import {
  createInvitation,
  getInvitationProgress,
} from "../../services/invitationService";
import * as Notifications from "expo-notifications";

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

interface DuoUser {
  id: string;
  name: string;
  avatar: string;
  completedDays: number;
  selectedDays: number;
}

interface DuoChallengeData {
  duo: boolean;
  duoUser: DuoUser;
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
    invite?: string; // 👈 ADD THIS
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
  const [duoChallengeData, setDuoChallengeData] =
    useState<DuoChallengeData | null>(null);

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
  const [isCurrentUserInviter, setIsCurrentUserInviter] = useState(false);

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
          setChallengeImage(data.imageUrl || null);
          setDaysOptions(data.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365]);
          const isUserInChallenge = (data.usersTakingChallenge || []).includes(
            auth.currentUser?.uid
          );
          setUserHasTaken(isUserInChallenge);

          if (data.duo && data.duoUsers) {
            const otherUser = data.duoUsers.find(
              (u: any) => u.uid !== auth.currentUser?.uid
            );
            if (otherUser) {
              setDuoChallengeData({
                duo: true,
                duoUser: {
                  id: otherUser.uid,
                  name: otherUser.name,
                  avatar: otherUser.avatar,
                  completedDays: otherUser.completedDays || 0,
                  selectedDays: otherUser.selectedDays || 0,
                },
              });
            }
          }
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
    if (!id || !auth.currentUser?.uid) return;

    const challengeRef = doc(db, "challenges", id);
    getDoc(challengeRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isInviter = data?.inviterId === auth.currentUser?.uid;
        setIsCurrentUserInviter(isInviter);
      }
    });
  }, [id]);

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

          // Si l’invitation est déjà affichée, on ne fait rien
          if (invitation?.id !== inviteDoc.id) {
            setInvitation({ id: inviteDoc.id });
            setTimeout(() => {
              setInvitationModalVisible(true);
            }, 300);
          }
        } else {
        }
      },
      (error) => {
        console.error("🔥 Erreur onSnapshot invitation :", error);
      }
    );

    return () => unsubscribe();
  }, [id, invitation]);

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

  useEffect(() => {
    if (!auth.currentUser || !id) return;

    const q = query(
      collection(db, "invitations"),
      where("inviterId", "==", auth.currentUser.uid),
      where("challengeId", "==", id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        if (data.status === "refused") {
          Notifications.scheduleNotificationAsync({
            content: {
              title: t("notifications.title"),
              body: t("notifications.invitationRefused", {
                username: data.inviteeUsername || "L'utilisateur",
              }),
            },
            trigger: null,
          });
        }

        if (data.status === "accepted") {
          Notifications.scheduleNotificationAsync({
            content: {
              title: t("notifications.title"),
              body: t("notifications.invitationAccepted", {
                username: data.inviteeUsername || "L'utilisateur",
              }),
            },
            trigger: null,
          });
        }
      });
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (params.invite) {
      setInvitation({ id: params.invite });
      setTimeout(() => {
        setInvitationModalVisible(true);
      }, 300); // délai pour éviter bugs si navigation trop rapide
    }
  }, [params.invite]);

  useEffect(() => {
    if (!auth.currentUser?.uid || !id || !isCurrentUserInviter) return;

    const q = query(
      collection(db, "invitations"),
      where("inviterId", "==", auth.currentUser.uid),
      where("challengeId", "==", id)
    );

    let lastStatusByInviteId: Record<string, string> = {};

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const inviteId = docSnap.id;

        const previousStatus = lastStatusByInviteId[inviteId];
        if (data.status !== previousStatus) {
          lastStatusByInviteId[inviteId] = data.status;

          if (data.status === "refused") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: t("notifications.title"),
                body: t("notifications.invitationRefused", {
                  username: data.inviteeUsername || "L'utilisateur",
                }),
              },
              trigger: null,
            });
          }

          if (data.status === "accepted") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: t("notifications.title"),
                body: t("notifications.invitationAccepted", {
                  username: data.inviteeUsername || "L'utilisateur",
                }),
              },
              trigger: null,
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [id, isCurrentUserInviter, t]);

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
    const completions = useMemo(
      () => currentChallenge?.completionDates || [],
      [currentChallenge?.completionDates]
    );
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
    // 👇 Ici ton lien vers l'app ou la page du challenge dans l'app
    const appLink = `https://challengeties.app/challenge-details/${encodeURIComponent(id)}`;

    const shareOptions = {
      title: t("challengeDetails.share"),
      message: `${t("challengeDetails.shareMessage", { title: routeTitle })}\n${appLink}`,
    };

    const result = await Share.share(shareOptions);

    if (result.action === Share.sharedAction) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          shareChallenge: increment(1),
        });
        await checkForAchievements(userId);
      }
    }
  } catch (error: any) {
    console.error("❌ handleShareChallenge error:", error);
    Alert.alert(t("alerts.shareError"), error.message);
  }
}, [id, routeTitle, t]);


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
     <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false}
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <Animated.View entering={FadeInUp} style={styles.backButtonContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, styles.backButtonOverlay]}
          accessibilityLabel={t("backButton")}
          accessibilityHint={t("backButtonHint")}
          accessibilityRole="button"
          testID="back-button"
        >
          <Ionicons
            name="arrow-back"
            size={normalizeSize(24)}
            color={isDarkMode ? "#FFD700" : currentTheme.colors.secondary}
          />
        </TouchableOpacity>
      </Animated.View>
      <View style={styles.imageContainer}>
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
          </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BANNER_HEIGHT + SPACING * 2 }} 
      >
        <View style={styles.carouselContainer}>
          
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
              accessibilityRole="button"
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
                {duoChallengeData?.duo && duoChallengeData.duoUser && (
                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={[
                        styles.inProgressText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {t("challengeDetails.partnerProgress")}
                    </Text>
                    <View style={styles.duoProgressWrapper}>
                      <Image
                        source={{ uri: duoChallengeData?.duoUser?.avatar }}
                        style={styles.duoAvatar}
                      />
                      <View
                        style={[
                          styles.progressBarBackground,
                          {
                            flex: 1,
                            marginLeft: 10,
                            backgroundColor: currentTheme.colors.border,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={
                            isDarkMode
                              ? ["#00FFFF", "#00FFFF"]
                              : [
                                  currentTheme.colors.secondary,
                                  currentTheme.colors.primary,
                                ]
                          }
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(
                                100,
                                (duoChallengeData?.duoUser?.completedDays /
                                  duoChallengeData?.duoUser?.selectedDays) *
                                  100
                              )}%`,
                            },
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                      </View>
                      <Text
                        style={[
                          styles.progressText,
                          {
                            marginLeft: 10,
                            color: currentTheme.colors.secondary,
                          },
                        ]}
                      >
                        {duoChallengeData?.duoUser?.completedDays}/
                        {duoChallengeData?.duoUser?.selectedDays}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.markTodayButton}
                  accessibilityRole="button"
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
                accessibilityRole="button"
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
              accessibilityRole="button"
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
              accessibilityRole="button"
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
              accessibilityRole="button"
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
              accessibilityRole="button"
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
          onAdFailedToLoad={(err) =>
            console.error("Échec chargement bannière", err)
          }
        />
      </View>
      <InvitationModal
        visible={invitationModalVisible}
        inviteId={invitation?.id || null}
        challengeId={id}
        onClose={() => setInvitationModalVisible(false)}
        clearInvitation={() => setInvitation(null)} // 👈 ICI
      />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: BANNER_HEIGHT + SPACING * 2, // Ajoute un padding bottom au conteneur principal
  },
  carouselContainer: {
    position: "relative",
    height: SCREEN_HEIGHT * 0.3,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.35,
    borderBottomLeftRadius: normalizeSize(30),
    borderBottomRightRadius: normalizeSize(30),
    overflow: 'hidden',
    zIndex: 1,
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
    width: "100%",
    height: "100%",
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
    paddingHorizontal: SPACING * 1.5,
    paddingTop: SCREEN_HEIGHT * 0.05 ,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRecipeName: {
    fontSize: normalizeSize(28),
    marginTop: SPACING * 0.2,
    marginBottom: SPACING,
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
    justifyContent: "space-between", 
    alignItems: "center",
    marginTop: SPACING * 2,
    minWidth: "100%",
    paddingHorizontal: SPACING / 2
  },
   actionIcon: {
     alignItems: "center",
     justifyContent: "center",
    marginHorizontal: 0,
    width: '50%',
     minHeight: normalizeSize(90),
   },
  actionIconLabel: {
    marginTop: normalizeSize(6),
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    includeFontPadding: false,     // compacte le text verticalement
    lineHeight: normalizeSize(18),
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
  duoProgressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING,
  },
  duoAvatar: {
    width: normalizeSize(36),
    height: normalizeSize(36),
    borderRadius: normalizeSize(18),
    borderWidth: 2,
    borderColor: "#FFD700",
  },
});
