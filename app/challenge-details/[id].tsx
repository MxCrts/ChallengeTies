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
  Modal,
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
    completeChallenge, // Doit être présent ici
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

  const awardTrophiesToUser = async (trophiesToAdd: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User doc not found");
        const userData = userDoc.data();
        const currentTrophies = userData.trophies || 0;
        const newTrophyCount = currentTrophies + trophiesToAdd;
        let achievements = userData.achievements || [];
        if (!achievements.includes("First challenge completed")) {
          achievements.push("First challenge completed");
        }
        const totalCompleted = (userData.completedChallengesCount || 0) + 1;
        if (
          totalCompleted === 10 &&
          !achievements.includes("10 challenges completed")
        ) {
          achievements.push("10 challenges completed");
        }
        transaction.update(userRef, {
          trophies: newTrophyCount,
          achievements,
          completedChallengesCount: totalCompleted,
        });
      });
      confettiRef.current?.start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => confettiRef.current?.stop(), 5000);
      Alert.alert("Succès !", `Vous avez reçu ${baseTrophyAmount} trophées !`);
    } catch (err) {
      Alert.alert(
        "Erreur",
        "La mise à jour des trophées a échoué. Réessayez plus tard."
      );
    }
  };

  const finalizeChallengeRemoval = async () => {
    if (!id) return;
    try {
      const challengeRef = doc(db, "challenges", id);
      await removeCurrentChallenge(id, finalSelectedDays);
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const uid = auth.currentUser?.uid;
        const updatedUsers = currentUsers.filter(
          (user: string) => user !== uid
        );
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentCount - 1, 0),
          usersTakingChallenge: updatedUsers,
        });
      });
    } catch (err) {
      console.error("Error removing challenge:", err);
    }
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
      // Ici, on considère que la logique de l'annonce est traitée ailleurs
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
            onPress={() =>
              router.push(
                `/challenge-chat/${id}?title=${encodeURIComponent(routeTitle)}`
              )
            }
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

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisissez la durée (jours)</Text>
            <View style={styles.daysOptionsContainer}>
              {daysOptions.map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.dayOption,
                    localSelectedDays === days && styles.dayOptionSelected,
                  ]}
                  onPress={() => setLocalSelectedDays(days)}
                >
                  <Ionicons
                    name={dayIcons[days] || "alarm-outline"}
                    size={24}
                    color={localSelectedDays === days ? "#fff" : "#333"}
                  />
                  <Text
                    style={[
                      styles.dayOptionText,
                      localSelectedDays === days && { color: "#fff" },
                    ]}
                  >
                    {days} jours
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleTakeChallenge}
            >
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {completionModalVisible && (
        <ChallengeCompletionModal
          visible={completionModalVisible}
          challengeId={id}
          selectedDays={finalSelectedDays}
          onClose={() => setCompletionModalVisible(false)}
        />
      )}

      <Modal visible={statsModalVisible} transparent animationType="slide">
        <View style={styles.statsModalContainer}>
          <View style={styles.statsModalContent}>
            <View style={styles.statsModalHeader}>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.statsModalTitle}>
                {monthName} {currentYearNum}
              </Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.calendarContainer}>
              <View style={styles.weekDaysContainer}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <Text key={day} style={styles.weekDay}>
                      {day}
                    </Text>
                  )
                )}
              </View>
              <View style={styles.daysContainer}>
                {calendarDays.map((day, index) => (
                  <View key={index} style={styles.dayWrapper}>
                    {day ? (
                      <View
                        style={[
                          styles.dayCircle,
                          day.completed && styles.dayCompleted,
                        ]}
                      >
                        <Text style={styles.dayText}>{day.day}</Text>
                      </View>
                    ) : (
                      <View style={styles.emptyDay} />
                    )}
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.statsModalFooter}>
              <TouchableOpacity
                onPress={goToPrevMonth}
                style={styles.navButton}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={styles.navButton}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  daysOptionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 10,
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
  },
  dayOptionSelected: { backgroundColor: "#2cd18a", borderColor: "#2cd18a" },
  dayOptionText: {
    marginLeft: 6,
    fontSize: 16,
    color: "#333",
    fontFamily: "Comfortaa_400Regular",
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Comfortaa_700Regular",
  },
  daysPicker: { width: "100%", height: 50, marginBottom: 20 },
  confirmButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Regular",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Regular",
  },
  claimButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  claimButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Regular",
  },
  doubleButton: {
    backgroundColor: "#17a2b8",
    padding: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  doubleButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: "Comfortaa_700Regular",
  },
  statsModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statsModalContent: {
    backgroundColor: "#0F172A",
    width: "100%",
    maxWidth: 400,
    borderRadius: 10,
    padding: 20,
  },
  statsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  statsModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    fontFamily: "Comfortaa_700Regular",
  },
  calendarContainer: { marginVertical: 10 },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 5,
  },
  weekDay: { flex: 1, textAlign: "center", color: "#aaa", fontSize: 12 },
  daysContainer: { flexDirection: "row", flexWrap: "wrap" },
  dayWrapper: { width: "14.28%", alignItems: "center", marginVertical: 4 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  dayCompleted: { backgroundColor: "#FACC15" },
  dayText: { color: "#fff", fontSize: 14 },
  emptyDay: { width: 32, height: 32 },
  statsModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  navButton: { padding: 10 },
});
