import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  runTransaction,
  increment,
} from "firebase/firestore";
import { Alert, StyleSheet, View } from "react-native";
import {
  checkForAchievements,
  deductTrophies,
} from "../helpers/trophiesHelpers";
import MissedChallengeModal from "../components/MissedChallengeModal";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  daysOptions: number[];
  chatId: string;
}

export interface CurrentChallenge extends Challenge {
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
  streak?: number;
  uniqueKey?: string;
  completionDates?: string[];
}

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  setCurrentChallenges: React.Dispatch<
    React.SetStateAction<CurrentChallenge[]>
  >;
  simulatedToday: Date | null;
  setSimulatedToday: React.Dispatch<React.SetStateAction<Date | null>>;
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  removeChallenge: (id: string, selectedDays: number) => Promise<void>;
  markToday: (
    id: string,
    selectedDays: number
  ) => Promise<{
    success: boolean;
    missedDays?: number;
  }>;
  isMarkedToday: (id: string, selectedDays: number) => boolean;
  completeChallenge: (
    id: string,
    selectedDays: number,
    doubleReward?: boolean
  ) => Promise<void>;
  simulateStreak: (
    id: string,
    selectedDays: number,
    streakValue?: number
  ) => Promise<void>;
  showMissedChallengeModal: (id: string, selectedDays: number) => void;
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);
  const [simulatedToday, setSimulatedToday] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<{
    id: string;
    selectedDays: number;
  } | null>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (Array.isArray(userData.CurrentChallenges)) {
          const uniqueChallenges = Array.from(
            new Map(
              userData.CurrentChallenges.map((ch: CurrentChallenge) => [
                ch.uniqueKey,
                ch,
              ])
            ).values()
          );
          setCurrentChallenges(uniqueChallenges);
        } else {
          setCurrentChallenges([]);
        }
        console.log("🔥 Données utilisateur récupérées :", userData);
      } else {
        console.log("❌ Aucune donnée trouvée pour cet utilisateur.");
      }
    });
    return () => unsubscribe();
  }, []);

  const getToday = () => simulatedToday || new Date();

  const takeChallenge = async (challenge: Challenge, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${challenge.id}_${selectedDays}`;
    if (currentChallenges.find((ch) => ch.uniqueKey === uniqueKey)) {
      console.log("Défi déjà pris");
      return;
    }
    try {
      const userRef = doc(db, "users", userId);
      const challengeData: CurrentChallenge = {
        ...challenge,
        selectedDays,
        completedDays: 0,
        lastMarkedDate: null,
        streak: 0,
        uniqueKey,
        completionDates: [],
      };
      await updateDoc(userRef, {
        CurrentChallenges: arrayUnion(challengeData),
      });
      setCurrentChallenges((prev) => [...prev, challengeData]);
      console.log("✅ Défi ajouté à CurrentChallenges !");
      await checkForAchievements(userId);
    } catch (error) {
      console.error("❌ Erreur lors de l'ajout du défi :", error);
    }
  };

  const removeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();
      const updatedChallenges = (userData.CurrentChallenges || []).filter(
        (challenge: CurrentChallenge) => challenge.uniqueKey !== uniqueKey
      );
      await updateDoc(userRef, {
        CurrentChallenges: updatedChallenges,
      });
      setCurrentChallenges(updatedChallenges);
      console.log("✅ Défi retiré du user document !");

      const challengeRef = doc(db, "challenges", id);
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const updatedUsers = currentUsers.filter(
          (uid: string) => uid !== userId
        );
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentCount - 1, 0),
          usersTakingChallenge: updatedUsers,
        });
      });
      console.log("✅ Document challenge mis à jour après suppression !");
    } catch (error) {
      console.error("❌ Erreur lors de la suppression du défi :", error);
    }
  };

  const isMarkedToday = (id: string, selectedDays: number): boolean => {
    const today = getToday().toDateString();
    const uniqueKey = `${id}_${selectedDays}`;
    const challenge = currentChallenges.find(
      (ch) => ch.uniqueKey === uniqueKey
    );
    if (!challenge) return false;
    return challenge.lastMarkedDate === today;
  };

  const markToday = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false };
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const today = getToday();
      const todayString = today.toDateString();
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return { success: false };
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        Alert.alert("Erreur", "Challenge non trouvé.");
        return { success: false };
      }
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };

      // Vérifier si déjà marqué aujourd'hui
      if (
        challengeToMark.completionDates &&
        challengeToMark.completionDates.includes(todayString)
      ) {
        Alert.alert(
          "Déjà marqué",
          "Tu as déjà marqué ce challenge aujourd'hui."
        );
        return { success: false };
      }

      // Calculer les jours manqués depuis la dernière date marquée
      let missedDays = 0;
      if (challengeToMark.lastMarkedDate) {
        const lastMarked = new Date(challengeToMark.lastMarkedDate);
        const diffTime = today.getTime() - lastMarked.getTime();
        missedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else {
        // Si c'est le premier marquage, pas de jours manqués
        missedDays = 0;
      }

      if (missedDays < 2) {
        // Marquage normal si moins de 2 jours manqués
        challengeToMark.streak = (challengeToMark.streak || 0) + 1;
        challengeToMark.completionDates = challengeToMark.completionDates || [];
        challengeToMark.completionDates.push(todayString);
        challengeToMark.completedDays = challengeToMark.completedDays + 1;
        challengeToMark.lastMarkedDate = todayString;

        const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
          idx === challengeIndex ? challengeToMark : challenge
        );
        setCurrentChallenges(updatedChallenges);
        await updateDoc(userRef, { CurrentChallenges: updatedChallenges });

        if (challengeToMark.completedDays >= challengeToMark.selectedDays) {
          Alert.alert(
            "Félicitations !",
            "Ce défi est maintenant terminé. Veuillez finaliser pour recevoir vos trophées."
          );
        } else {
          Alert.alert(
            "Bravo !",
            "Challenge marqué comme complété pour aujourd'hui."
          );
        }

        const currentLongest = userData.longestStreak || 0;
        if (challengeToMark.streak > currentLongest) {
          await updateDoc(userRef, { longestStreak: challengeToMark.streak });
          console.log(
            `✅ Longest streak mis à jour : ${challengeToMark.streak}`
          );
        }
        await checkForAchievements(userId);
        return { success: true };
      } else {
        // Afficher le modal si 2 jours ou plus manqués
        showMissedChallengeModal(id, selectedDays);
        return { success: false, missedDays };
      }
    } catch (error) {
      console.error("❌ Erreur lors du marquage :", error);
      return { success: false };
    }
  };

  const handleReset = async () => {
    if (!selectedChallenge) return;
    const { id, selectedDays } = selectedChallenge;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    let currentChallengesArray: CurrentChallenge[] = Array.isArray(
      userData.CurrentChallenges
    )
      ? userData.CurrentChallenges
      : [];
    const challengeIndex = currentChallengesArray.findIndex(
      (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
    );
    const challengeToMark = { ...currentChallengesArray[challengeIndex] };
    const today = getToday().toDateString();

    challengeToMark.streak = 1;
    challengeToMark.completionDates = [today];
    challengeToMark.completedDays = 1;
    challengeToMark.lastMarkedDate = today;
    const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
      idx === challengeIndex ? challengeToMark : challenge
    );
    setCurrentChallenges(updatedChallenges);
    await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
    Alert.alert("Streak réinitialisé", "Ton streak a été remis à 1.");
    await checkForAchievements(userId);
    setModalVisible(false);
  };

  const handleWatchAd = async () => {
    if (!selectedChallenge) return;
    const { id, selectedDays } = selectedChallenge;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    let currentChallengesArray: CurrentChallenge[] = Array.isArray(
      userData.CurrentChallenges
    )
      ? userData.CurrentChallenges
      : [];
    const challengeIndex = currentChallengesArray.findIndex(
      (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
    );
    const challengeToMark = { ...currentChallengesArray[challengeIndex] };
    const today = getToday().toDateString();
    const newCompletedDays = challengeToMark.completedDays + 1;

    challengeToMark.streak = (challengeToMark.streak || 0) + 1;
    challengeToMark.completionDates.push(today);
    challengeToMark.completedDays = newCompletedDays;
    challengeToMark.lastMarkedDate = today;
    const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
      idx === challengeIndex ? challengeToMark : challenge
    );
    setCurrentChallenges(updatedChallenges);
    await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
    Alert.alert(
      "Pub regardée",
      "Challenge marqué, ton streak continue normalement."
    );
    await checkForAchievements(userId);
    setModalVisible(false);
  };

  const handleUseTrophies = async () => {
    if (!selectedChallenge) return;
    const { id, selectedDays } = selectedChallenge;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    let currentChallengesArray: CurrentChallenge[] = Array.isArray(
      userData.CurrentChallenges
    )
      ? userData.CurrentChallenges
      : [];
    const challengeIndex = currentChallengesArray.findIndex(
      (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
    );
    const challengeToMark = { ...currentChallengesArray[challengeIndex] };
    const today = getToday().toDateString();
    const newCompletedDays = challengeToMark.completedDays + 1;
    const trophyCost = 5;

    const success = await deductTrophies(userId, trophyCost);
    if (!success) {
      Alert.alert(
        "Pas assez de trophées",
        "Tu n'as pas assez de trophées pour cette option."
      );
      setModalVisible(false);
      return;
    }

    challengeToMark.streak = (challengeToMark.streak || 0) + 1;
    challengeToMark.completionDates.push(today);
    challengeToMark.completedDays = newCompletedDays;
    challengeToMark.lastMarkedDate = today;
    const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
      idx === challengeIndex ? challengeToMark : challenge
    );
    setCurrentChallenges(updatedChallenges);
    await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
    Alert.alert(
      "Trophées utilisés",
      `Challenge marqué, ton streak continue normalement. (${trophyCost} trophées ont été déduits)`
    );
    await checkForAchievements(userId);
    setModalVisible(false);
  };

  const showMissedChallengeModal = (id: string, selectedDays: number) => {
    setSelectedChallenge({ id, selectedDays });
    setModalVisible(true);
  };

  const completeChallenge = async (
    id: string,
    selectedDays: number,
    doubleReward: boolean = false
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const today = getToday().toDateString();
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();

      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        Alert.alert("Erreur", "Challenge non trouvé.");
        return;
      }
      const challengeToComplete = { ...currentChallengesArray[challengeIndex] };

      const baseBonusTrophies = 5;
      const rewardMultiplier = selectedDays / 7;
      const calculatedReward = Math.round(baseBonusTrophies * rewardMultiplier);
      const finalTrophies = doubleReward
        ? calculatedReward * 2
        : calculatedReward;

      let completedChallengesArray: any[] = Array.isArray(
        userData.CompletedChallenges
      )
        ? userData.CompletedChallenges
        : [];
      const existingIndex = completedChallengesArray.findIndex(
        (entry: any) => entry.id === id
      );
      let newCompletedEntry;
      if (existingIndex !== -1) {
        const oldEntry = completedChallengesArray[existingIndex];
        const history = oldEntry.history ? [...oldEntry.history] : [];
        history.push({
          completedAt: oldEntry.completedAt,
          selectedDays: oldEntry.selectedDays,
        });
        newCompletedEntry = {
          ...challengeToComplete,
          completedAt: today,
          history: history,
        };
        completedChallengesArray[existingIndex] = newCompletedEntry;
      } else {
        newCompletedEntry = {
          ...challengeToComplete,
          completedAt: today,
          history: [],
        };
        completedChallengesArray.push(newCompletedEntry);
      }

      await updateDoc(userRef, {
        CurrentChallenges: currentChallengesArray.filter(
          (_, idx) => idx !== challengeIndex
        ),
        CompletedChallenges: completedChallengesArray,
        trophies: increment(finalTrophies),
        completedChallengesCount: increment(1),
      });

      setCurrentChallenges(
        currentChallengesArray.filter((_, idx) => idx !== challengeIndex)
      );

      const challengeRef = doc(db, "challenges", id);
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const updatedUsers = currentUsers.filter(
          (uid: string) => uid !== userId
        );
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentCount - 1, 0),
          usersTakingChallenge: updatedUsers,
        });
      });

      Alert.alert(
        "Félicitations !",
        `Challenge terminé ! Tu gagnes ${finalTrophies} trophées 🎖️ !`
      );
      await checkForAchievements(userId);
    } catch (error) {
      console.error("❌ Erreur lors de la finalisation du défi :", error);
    }
  };

  const simulateStreak = async (
    id: string,
    selectedDays: number,
    streakValue: number = 3
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const uniqueKey = `${id}_${selectedDays}`;
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        Alert.alert("Erreur", "Challenge non trouvé pour simulation.");
        return;
      }
      currentChallengesArray[challengeIndex].streak = streakValue;
      const today = getToday();
      const completionDates = [];
      for (let i = streakValue - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        completionDates.push(d.toDateString());
      }
      currentChallengesArray[challengeIndex].completionDates = completionDates;
      currentChallengesArray[challengeIndex].completedDays = streakValue;
      currentChallengesArray[challengeIndex].lastMarkedDate =
        completionDates[completionDates.length - 1];
      await updateDoc(userRef, {
        CurrentChallenges: currentChallengesArray,
      });
      await checkForAchievements(userId);
      Alert.alert("Simulation", `Streak simulé à ${streakValue} jours.`);
    } catch (error) {
      console.error("❌ Erreur lors de la simulation du streak :", error);
    }
  };

  return (
    <CurrentChallengesContext.Provider
      value={{
        currentChallenges,
        setCurrentChallenges,
        simulatedToday,
        setSimulatedToday,
        takeChallenge,
        removeChallenge,
        markToday,
        isMarkedToday,
        completeChallenge,
        simulateStreak,
        showMissedChallengeModal,
      }}
    >
      <View style={styles.providerContainer}>
        {children}
        {modalVisible && (
          <MissedChallengeModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onReset={handleReset}
            onWatchAd={handleWatchAd}
            onUseTrophies={handleUseTrophies}
            trophyCost={5}
          />
        )}
      </View>
    </CurrentChallengesContext.Provider>
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
    position: "relative",
  },
});

export const useCurrentChallenges = () => {
  const context = useContext(CurrentChallengesContext);
  if (!context) {
    throw new Error(
      "useCurrentChallenges must be used within a CurrentChallengesProvider"
    );
  }
  return context;
};
