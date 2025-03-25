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
import { Alert } from "react-native";
import {
  checkForAchievements,
  deductTrophies,
} from "../helpers/trophiesHelpers";

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
  streak?: number; // Suivi du streak
  uniqueKey?: string; // Pour garantir l'unicité
  completionDates?: string[]; // Dates de complétion au format "YYYY-MM-DD"
}

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  removeChallenge: (id: string, selectedDays: number) => Promise<void>;
  markToday: (id: string, selectedDays: number) => Promise<void>;
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
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (Array.isArray(userData.CurrentChallenges)) {
          // Déduplication par uniqueKey
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

      // Mise à jour du document challenge
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
    const today = new Date().toDateString();
    const uniqueKey = `${id}_${selectedDays}`;
    const challenge = currentChallenges.find(
      (ch) => ch.uniqueKey === uniqueKey
    );
    if (!challenge) return false;
    return challenge.lastMarkedDate === today;
  };

  const markToday = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const today = new Date().toDateString();
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
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };

      // Vérifier si déjà marqué aujourd'hui
      if (
        challengeToMark.completionDates &&
        challengeToMark.completionDates.includes(today)
      ) {
        Alert.alert(
          "Déjà marqué",
          "Tu as déjà marqué ce challenge aujourd'hui."
        );
        return;
      }

      // Calcul du nombre total de jours écoulés depuis le premier marquage
      let firstMarkDate: Date;
      if (
        challengeToMark.completionDates &&
        challengeToMark.completionDates.length > 0
      ) {
        firstMarkDate = new Date(challengeToMark.completionDates[0]);
      } else {
        firstMarkDate = new Date(today);
      }
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - firstMarkDate.getTime();
      const totalDaysInChallenge = Math.floor(diffTime / 86400000) + 1;
      const newCompletedDays = challengeToMark.completedDays + 1;
      const missedDays = totalDaysInChallenge - newCompletedDays;

      if (missedDays < 2) {
        // Cas normal : on incrémente le streak normalement
        challengeToMark.streak = (challengeToMark.streak || 0) + 1;
        challengeToMark.completionDates = challengeToMark.completionDates || [];
        challengeToMark.completionDates.push(today);
        challengeToMark.completedDays = newCompletedDays;
        challengeToMark.lastMarkedDate = today;

        const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
          idx === challengeIndex ? challengeToMark : challenge
        );
        // Mise à jour optimiste : on met à jour l'UI immédiatement
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
      } else {
        // Options en cas de jours manqués
        Alert.alert(
          "Challenge non continué",
          "Tu as manqué 2 jours ou plus. Choisis une option pour continuer :",
          [
            {
              text: "Réinitialiser",
              onPress: async () => {
                challengeToMark.streak = 1;
                challengeToMark.completionDates.push(today);
                challengeToMark.completedDays = newCompletedDays;
                challengeToMark.lastMarkedDate = today;
                const updatedChallenges = currentChallengesArray.map(
                  (challenge, idx) =>
                    idx === challengeIndex ? challengeToMark : challenge
                );
                setCurrentChallenges(updatedChallenges);
                await updateDoc(userRef, {
                  CurrentChallenges: updatedChallenges,
                });
                Alert.alert(
                  "Streak réinitialisé",
                  "Ton streak a été remis à 1."
                );
                await checkForAchievements(userId);
              },
            },
            {
              text: "Regarder une pub",
              onPress: async () => {
                challengeToMark.streak = (challengeToMark.streak || 0) + 1;
                challengeToMark.completionDates.push(today);
                challengeToMark.completedDays = newCompletedDays;
                challengeToMark.lastMarkedDate = today;
                const updatedChallenges = currentChallengesArray.map(
                  (challenge, idx) =>
                    idx === challengeIndex ? challengeToMark : challenge
                );
                setCurrentChallenges(updatedChallenges);
                await updateDoc(userRef, {
                  CurrentChallenges: updatedChallenges,
                });
                Alert.alert(
                  "Pub regardée",
                  "Challenge marqué, ton streak continue normalement."
                );
                await checkForAchievements(userId);
              },
            },
            {
              text: "Utiliser des trophées",
              onPress: async () => {
                const trophyCost = 5;
                const success = await deductTrophies(userId, trophyCost);
                if (!success) {
                  Alert.alert(
                    "Pas assez de trophées",
                    "Tu n'as pas assez de trophées pour cette option."
                  );
                  return;
                }
                challengeToMark.streak = (challengeToMark.streak || 0) + 1;
                challengeToMark.completionDates.push(today);
                challengeToMark.completedDays = newCompletedDays;
                challengeToMark.lastMarkedDate = today;
                const updatedChallenges = currentChallengesArray.map(
                  (challenge, idx) =>
                    idx === challengeIndex ? challengeToMark : challenge
                );
                setCurrentChallenges(updatedChallenges);
                await updateDoc(userRef, {
                  CurrentChallenges: updatedChallenges,
                });
                Alert.alert(
                  "Trophées utilisés",
                  `Challenge marqué, ton streak continue normalement. (${trophyCost} trophées ont été déduits)`
                );
                await checkForAchievements(userId);
              },
            },
          ],
          { cancelable: false }
        );
      }

      // Mise à jour du longest streak si applicable
      const currentLongest = userData.longestStreak || 0;
      if (challengeToMark.streak > currentLongest) {
        await updateDoc(userRef, { longestStreak: challengeToMark.streak });
        console.log(
          `✅ Longest streak mis à jour : ${challengeToMark.streak} (précédent : ${currentLongest})`
        );
      } else {
        console.log(
          `ℹ️ Aucun changement pour longest streak (actuel : ${currentLongest})`
        );
      }

      await checkForAchievements(userId);
    } catch (error) {
      console.error("❌ Erreur lors du marquage :", error);
    }
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
      const today = new Date().toDateString();
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();

      // Récupérer le tableau des défis en cours
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

      // Calcul du bonus de trophées
      const baseBonusTrophies = 5;
      const rewardMultiplier = selectedDays / 7;
      const calculatedReward = Math.round(baseBonusTrophies * rewardMultiplier);
      const finalTrophies = doubleReward
        ? calculatedReward * 2
        : calculatedReward;

      // Récupérer le tableau des défis complétés existants
      let completedChallengesArray: any[] = Array.isArray(
        userData.CompletedChallenges
      )
        ? userData.CompletedChallenges
        : [];

      // Vérifier s'il existe déjà une entrée pour ce challenge (basé sur l'id)
      const existingIndex = completedChallengesArray.findIndex(
        (entry: any) => entry.id === id
      );
      let newCompletedEntry;
      if (existingIndex !== -1) {
        // Si une entrée existe déjà, ajouter l'ancienne complétion dans le champ history
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

      // Mise à jour du document utilisateur :
      // - Retirer le défi des CurrentChallenges
      // - Mettre à jour CompletedChallenges, trophées et compteur global
      await updateDoc(userRef, {
        CurrentChallenges: currentChallengesArray.filter(
          (_, idx) => idx !== challengeIndex
        ),
        CompletedChallenges: completedChallengesArray,
        trophies: increment(finalTrophies),
        completedChallengesCount: increment(1),
      });

      // Mise à jour locale de l'état
      setCurrentChallenges(
        currentChallengesArray.filter((_, idx) => idx !== challengeIndex)
      );

      // Mise à jour du document challenge : retirer l'utilisateur de usersTakingChallenge et décrémenter participantsCount
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
      const today = new Date();
      const completionDates = [];
      for (let i = streakValue - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        completionDates.push(d.toDateString());
      }
      currentChallengesArray[challengeIndex].completionDates = completionDates;
      currentChallengesArray[challengeIndex].completedDays = streakValue;
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
        takeChallenge,
        removeChallenge,
        markToday,
        isMarkedToday,
        completeChallenge,
        simulateStreak,
      }}
    >
      {children}
    </CurrentChallengesContext.Provider>
  );
};

export const useCurrentChallenges = () => {
  const context = useContext(CurrentChallengesContext);
  if (!context) {
    throw new Error(
      "useCurrentChallenges must be used within a CurrentChallengesProvider"
    );
  }
  return context;
};
