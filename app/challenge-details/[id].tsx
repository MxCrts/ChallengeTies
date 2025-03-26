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
  Animated,
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
import designSystem from "../../theme/designSystem";

const { width: viewportWidth } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;
const normalizeFont = (size: number) => {
  const scale = viewportWidth / 375;
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

  // Récupération des infos du défi depuis la collection "challenges"
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

  // Synchronisation avec currentChallenges
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

  // Exemple de calcul de stats
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FACC15" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false}
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <View style={styles.carouselContainer}>
        <View style={styles.imageContainer}>
          {challengeImage ? (
            <Image
              source={{ uri: challengeImage }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={80} color="#ccc" />
              <Text style={styles.noImageText}>Image non disponible</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={normalizeFont(28)} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.infoRecipeContainer}>
        <Text style={styles.infoRecipeName}>{routeTitle}</Text>
        <Text style={styles.category}>{routeCategory.toUpperCase()}</Text>
        <View style={styles.infoContainer}>
          <Ionicons name="people-outline" size={20} color="#ed8f03" />
          <Text style={styles.infoRecipe}>
            {userCount} {userCount === 1 ? "participant" : "participants"}
          </Text>
        </View>
        {!userHasTaken && (
          <TouchableOpacity
            style={styles.takeChallengeButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.takeChallengeButtonText}>Prendre le défi</Text>
          </TouchableOpacity>
        )}
        {userHasTaken &&
          !(
            finalSelectedDays > 0 && finalCompletedDays >= finalSelectedDays
          ) && (
            <>
              <Text style={styles.inProgressText}>Défi en cours</Text>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: progressPercent * 250 },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {finalCompletedDays}/{finalSelectedDays} jours complétés
              </Text>
              <TouchableOpacity
                style={[
                  styles.markTodayButton,
                  isMarkedToday(id, finalSelectedDays) &&
                    styles.markTodayButtonDisabled,
                ]}
                onPress={() => {
                  if (!isMarkedToday(id, finalSelectedDays)) {
                    setFinalCompletedDays((prev) => prev + 1);
                    markToday(id, finalSelectedDays);
                  }
                }}
                disabled={isMarkedToday(id, finalSelectedDays)}
              >
                <Text style={styles.markTodayButtonText}>
                  {isMarkedToday(id, finalSelectedDays)
                    ? "Déjà marqué"
                    : "Marquer aujourd'hui"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        <Text style={styles.infoDescriptionRecipe}>{routeDescription}</Text>
        {userHasTaken &&
          finalSelectedDays > 0 &&
          finalCompletedDays >= finalSelectedDays && (
            <TouchableOpacity
              style={styles.completeChallengeButton}
              onPress={handleShowCompleteModal}
            >
              <Text style={styles.completeChallengeButtonText}>
                Terminer le défi
              </Text>
            </TouchableOpacity>
          )}

        <View style={[styles.infoContainer, { marginTop: 30 }]}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={handleNavigateToChat}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={28}
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
              size={28}
              color={isSavedChallenge(id) ? "#666" : "#333"}
            />
            <Text style={styles.actionIconLabel}>
              {isSavedChallenge(id) ? "Sauvegardé" : "Sauvegarder"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={handleShareChallenge}
          >
            <Ionicons name="share-social-outline" size={28} color="#333" />
            <Text style={styles.actionIconLabel}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionIcon, { opacity: userHasTaken ? 1 : 0.5 }]}
            onPress={userHasTaken ? handleViewStats : undefined}
          >
            <Ionicons name="stats-chart-outline" size={28} color="#333" />
            <Text style={styles.actionIconLabel}>Stats</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Composant pour la sélection de durée */}
      <DurationSelectionModal
        visible={modalVisible}
        daysOptions={daysOptions}
        selectedDays={localSelectedDays}
        onSelectDays={setLocalSelectedDays}
        onConfirm={handleTakeChallenge}
        onCancel={() => setModalVisible(false)}
        dayIcons={dayIcons}
      />

      {/* Composant pour la finalisation du défi */}
      {completionModalVisible && (
        <ChallengeCompletionModal
          visible={completionModalVisible}
          challengeId={id}
          selectedDays={finalSelectedDays}
          onClose={() => setCompletionModalVisible(false)}
        />
      )}

      {/* Composant pour afficher les stats */}
      <StatsModal
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        monthName={monthName}
        currentYearNum={currentYearNum}
        calendarDays={calendarDays}
        goToPrevMonth={goToPrevMonth}
        goToNextMonth={goToNextMonth}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  carouselContainer: { height: 250 },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    width: viewportWidth,
    height: 250,
  },
  image: { ...StyleSheet.absoluteFillObject, width: "100%", height: 250 },
  backButton: { position: "absolute", top: 40, left: 20, zIndex: 2 },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ccc",
  },
  noImageText: {
    color: "#777",
    marginTop: 10,
    fontFamily: "Comfortaa_400Regular",
  },
  infoRecipeContainer: {
    flex: 1,
    margin: 25,
    marginTop: 20,
    alignItems: "center",
  },
  infoRecipeName: {
    fontSize: 28,
    margin: 10,
    color: "black",
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  category: {
    fontSize: 14,
    margin: 5,
    color: currentTheme.colors.primary,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  infoRecipe: {
    fontSize: 14,
    marginLeft: 5,
    color: "#333",
    fontFamily: "Comfortaa_700Bold",
  },
  infoDescriptionRecipe: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 30,
    marginHorizontal: 15,
    color: "#555",
    lineHeight: 22,
    fontFamily: "Comfortaa_400Regular",
  },
  takeChallengeButton: {
    backgroundColor: "#ed8f03",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 30,
    marginTop: 15,
  },
  takeChallengeButtonText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
  },
  inProgressText: {
    fontSize: 16,
    color: "#ed8f03",
    marginTop: 10,
    fontFamily: "Comfortaa_700Bold",
  },
  markTodayButton: {
    backgroundColor: "#ed8f03",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 30,
    marginTop: 10,
  },
  markTodayButtonDisabled: { backgroundColor: "#aaa" },
  markTodayButtonText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
  },
  progressText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
    marginTop: 5,
    fontFamily: "Comfortaa_400Regular",
  },
  progressBarBackground: {
    width: 250,
    height: 10,
    backgroundColor: "#ddd",
    borderRadius: 5,
    overflow: "hidden",
    alignSelf: "center",
    marginTop: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ed8f03",
  },
  completeChallengeButton: {
    backgroundColor: "#FFC107",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 30,
    marginTop: 15,
  },
  completeChallengeButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Comfortaa_700Regular",
  },
  actionIcon: { alignItems: "center", marginHorizontal: 10 },
  actionIconLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#333",
    fontFamily: "Comfortaa_400Regular",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#444",
    fontFamily: "Comfortaa_400Regular",
  },
});
