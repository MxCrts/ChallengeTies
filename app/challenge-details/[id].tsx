import React, { useState, useEffect, useRef } from "react";
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
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const currentTheme = {
  ...designSystem.lightTheme,
  colors: {
    ...designSystem.lightTheme.colors,
    primary: "#ED8F03", // Orange
    cardBackground: "#FFFFFF",
  },
};

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
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    category?: string;
    description?: string;
    selectedDays?: string;
    completedDays?: string;
  }>();

  const id = params.id || "";
  const routeTitle = params.title || "Untitled Challenge";
  const routeCategory = params.category || "Uncategorized";
  const routeDescription = params.description || "No description available";

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

  const [loading, setLoading] = useState(true);
  const [userHasTaken, setUserHasTaken] = useState(false);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([
    7, 14, 21, 30, 60, 90, 180, 365,
  ]);
  const [localSelectedDays, setLocalSelectedDays] = useState<number>(10);
  const [finalSelectedDays, setFinalSelectedDays] = useState<number>(0);
  const [finalCompletedDays, setFinalCompletedDays] = useState<number>(0);
  const [userCount, setUserCount] = useState(0);
  const [stats, setStats] = useState<Stat[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [baseTrophyAmount, setBaseTrophyAmount] = useState(0);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!id) return;
    const challengeRef = doc(db, "challenges", id);
    const unsubscribe = onSnapshot(challengeRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChallengeImage(data.imageUrl || null);
        setDaysOptions(data.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365]);
        setUserHasTaken(
          (data.usersTakingChallenge || []).includes(auth.currentUser?.uid)
        );
        setUserCount(data.participantsCount || 0);
      }
      setLoading(false);
    });
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

  const monthName = currentMonth.toLocaleString("default", { month: "long" });
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

  const handleTakeChallenge = async () => {
    if (userHasTaken || !id) return;
    try {
      setLoading(true);
      const challengeRef = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) {
        Alert.alert("Erreur", "Impossible de récupérer le challenge.");
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
        "Erreur",
        err instanceof Error
          ? err.message
          : "Impossible de rejoindre le défi. Réessayez."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChallenge = async () => {
    if (!id) return;
    try {
      const challengeRef = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) {
        Alert.alert("Erreur", "Impossible de récupérer le challenge.");
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
    } catch (err) {
      Alert.alert(
        "Erreur",
        err instanceof Error
          ? err.message
          : "Impossible de sauvegarder/dé-sauvegarder le défi."
      );
    }
  };

  const handleShowCompleteModal = () => {
    setBaseTrophyAmount(finalSelectedDays);
    setCompletionModalVisible(true);
  };

  const handleClaimTrophiesWithoutAd = async () => {
    try {
      await completeChallenge(id, finalSelectedDays, false);
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert("Erreur", "La finalisation du défi a échoué.");
    }
  };

  const handleClaimTrophiesWithAd = async () => {
    try {
      await completeChallenge(id, finalSelectedDays, true);
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert("Erreur", "La finalisation du défi a échoué.");
    }
  };

  const handleNavigateToChat = () => {
    if (!userHasTaken) {
      Alert.alert(
        "Accès refusé",
        "Vous devez prendre le défi pour accéder au chat."
      );
      return;
    }
    router.push(
      `/challenge-chat/${id}?title=${encodeURIComponent(routeTitle)}`
    );
  };

  const handleShareChallenge = async () => {
    try {
      const shareOptions = {
        title: routeTitle,
        message: `${routeTitle}\n\n${routeDescription}\n\nRelevez ce défi sur ChallengeTies !`,
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
        console.log("Challenge partagé");
      } else if (result.action === Share.dismissedAction) {
        console.log("Partage annulé");
      }
    } catch (error: any) {
      Alert.alert("Erreur de partage", error.message);
    }
  };

  const handleViewStats = () => {
    if (!userHasTaken) return;
    setStatsModalVisible(true);
  };

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
          <ActivityIndicator size="large" color="#FF6200" />
          <Text style={styles.loadingText}>Chargement en cours...</Text>
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
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false}
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.carouselContainer}>
          <LinearGradient
            colors={["#FF6200", "#FF8C00"]}
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
              <View style={styles.imagePlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={normalizeSize(80)}
                  color="#FFFFFF"
                />
                <Text style={styles.noImageText}>Image non disponible</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons
                name="arrow-back"
                size={normalizeSize(28)}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.infoRecipeContainer}
        >
          <Text style={styles.infoRecipeName}>{routeTitle}</Text>
          <Text style={styles.category}>{routeCategory.toUpperCase()}</Text>
          <View style={styles.infoContainer}>
            <Ionicons
              name="people-outline"
              size={normalizeSize(20)}
              color="#FF6200"
            />
            <Text style={styles.infoRecipe}>
              {userCount} {userCount <= 1 ? "participant" : "participants"}
            </Text>
          </View>
          {!userHasTaken && (
            <TouchableOpacity
              style={styles.takeChallengeButton}
              onPress={() => setModalVisible(true)}
            >
              <LinearGradient
                colors={["#FF6200", "#FF8C00"]}
                style={styles.takeChallengeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.takeChallengeButtonText}>
                  Prendre le défi
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {userHasTaken &&
            !(
              finalSelectedDays > 0 && finalCompletedDays >= finalSelectedDays
            ) && (
              <Animated.View entering={FadeInUp.delay(200)}>
                <Text style={styles.inProgressText}>Défi en cours</Text>
                <View style={styles.progressBarBackground}>
                  <LinearGradient
                    colors={["#FF6200", "#FF8C00"]}
                    style={[
                      styles.progressBarFill,
                      { width: progressPercent * normalizeSize(250) },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </View>
                <Text style={styles.progressText}>
                  {finalCompletedDays}/{finalSelectedDays} jours complétés
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
                >
                  <LinearGradient
                    colors={
                      isMarkedToday(id, finalSelectedDays)
                        ? ["#D3D3D3", "#A3A3A3"]
                        : ["#FF6200", "#FF8C00"]
                    }
                    style={[
                      styles.markTodayButtonGradient,
                      { alignItems: "center", justifyContent: "center" }, // Centrage ajouté
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.markTodayButtonText}>
                      {isMarkedToday(id, finalSelectedDays)
                        ? "Déjà marqué"
                        : "Marquer aujourd'hui"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          <Text style={styles.infoDescriptionRecipe}>{routeDescription}</Text>
          {userHasTaken &&
            finalSelectedDays > 0 &&
            finalCompletedDays >= finalSelectedDays && (
              <TouchableOpacity
                style={styles.completeChallengeButton}
                onPress={handleShowCompleteModal}
              >
                <LinearGradient
                  colors={["#FFD700", "#FFC107"]}
                  style={styles.completeChallengeButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.completeChallengeButtonText}>
                    Terminer le défi
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
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={normalizeSize(28)}
                color="#333"
              />
              <Text style={styles.actionIconLabel}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleSaveChallenge}
            >
              <Ionicons
                name={isSavedChallenge(id) ? "bookmark" : "bookmark-outline"}
                size={normalizeSize(28)}
                color={isSavedChallenge(id) ? "#FF6200" : "#333"}
              />
              <Text style={styles.actionIconLabel}>
                {isSavedChallenge(id) ? "Sauvegardé" : "Sauvegarder"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleShareChallenge}
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(28)}
                color="#333"
              />
              <Text style={styles.actionIconLabel}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionIcon, { opacity: userHasTaken ? 1 : 0.5 }]}
              onPress={userHasTaken ? handleViewStats : undefined}
            >
              <Ionicons
                name="stats-chart-outline"
                size={normalizeSize(28)}
                color="#333"
              />
              <Text style={styles.actionIconLabel}>Stats</Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  carouselContainer: { height: SCREEN_HEIGHT * 0.3 },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.3,
    borderBottomLeftRadius: normalizeSize(30),
    borderBottomRightRadius: normalizeSize(30),
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: SCREEN_HEIGHT * 0.3,
  },
  backButton: {
    position: "absolute",
    top: normalizeSize(40),
    left: normalizeSize(20),
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: normalizeSize(20),
    padding: normalizeSize(5),
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  noImageText: {
    color: "#FFFFFF",
    marginTop: normalizeSize(10),
    fontFamily: currentTheme.typography.body.fontFamily,
    fontSize: normalizeSize(16),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoRecipeContainer: {
    flex: 1,
    padding: normalizeSize(25),
    paddingTop: normalizeSize(20),
    alignItems: "center",
  },
  infoRecipeName: {
    fontSize: normalizeSize(28),
    marginVertical: normalizeSize(10),
    color: "#333333",
    textAlign: "center",
    fontFamily: currentTheme.typography.title.fontFamily,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  category: {
    fontSize: normalizeSize(14),
    marginVertical: normalizeSize(5),
    color: "#FF6200",
    textAlign: "center",
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: normalizeSize(6),
  },
  infoRecipe: {
    fontSize: normalizeSize(14),
    marginLeft: normalizeSize(5),
    color: "#777777",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  takeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: normalizeSize(15),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  takeChallengeButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(30),
  },
  takeChallengeButtonText: {
    fontSize: normalizeSize(16),
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inProgressText: {
    fontSize: normalizeSize(16),
    color: "#FF6200",
    marginTop: normalizeSize(10),
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  markTodayButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: normalizeSize(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  markTodayButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(30),
  },
  markTodayButtonText: {
    fontSize: normalizeSize(16),
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressText: {
    fontSize: normalizeSize(14),
    color: "#FF6200",
    marginBottom: normalizeSize(8),
    textAlign: "center",
    marginTop: normalizeSize(5),
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  progressBarBackground: {
    width: normalizeSize(250),
    height: normalizeSize(10),
    backgroundColor: "#E0E0E0",
    borderRadius: normalizeSize(5),
    overflow: "hidden",
    alignSelf: "center",
    marginTop: normalizeSize(10),
  },
  progressBarFill: {
    height: "100%",
  },
  completeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: normalizeSize(15),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  completeChallengeButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(30),
  },
  completeChallengeButtonText: {
    fontSize: normalizeSize(16),
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoDescriptionRecipe: {
    textAlign: "center",
    fontSize: normalizeSize(16),
    marginTop: normalizeSize(30),
    marginHorizontal: normalizeSize(15),
    color: "#555555",
    lineHeight: normalizeSize(22),
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  actionIconsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: normalizeSize(30),
    width: "100%",
  },
  actionIcon: {
    alignItems: "center",
    marginHorizontal: normalizeSize(10),
  },
  actionIconLabel: {
    marginTop: normalizeSize(4),
    fontSize: normalizeSize(12),
    color: "#333333",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    color: "#777777",
    fontFamily: currentTheme.typography.body.fontFamily,
  },
});
