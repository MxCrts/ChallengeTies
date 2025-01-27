// contexts/CurrentChallengesContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { auth, db } from "../constants/firebase-config";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  arrayRemove,
  arrayUnion,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { Alert } from "react-native";
// Temporarily disable the import to prevent issues
// import { awardTrophiesAndCheckAchievements } from "../helpers/trophiesHelpers";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  participantsCount?: number;
  daysOptions: number[];
  chatId: string;
}

interface CurrentChallenge extends Challenge {
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

interface CompletedChallenge {
  id: string;
  title: string;
  imageUrl?: string;
  dateCompleted: string;
  category?: string;
  description?: string;
  selectedDays: number;
}

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  loadCurrentChallenges: () => Promise<void>;
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  removeChallenge: (id: string, selectedDays: number) => Promise<void>;
  markToday: (id: string, selectedDays: number) => Promise<void>;
  completeChallenge: (id: string, selectedDays: number) => Promise<void>;
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);

  // ===================================
  // LOAD CURRENT CHALLENGES
  // ===================================
  const loadCurrentChallenges = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("User not authenticated. Challenges not loaded.");
      setCurrentChallenges([]);
      return;
    }

    try {
      const q = query(
        collection(db, "currentChallenges"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const challenges = querySnapshot.docs.map((docSnap) => {
        const [_, challengeId, selectedDays] = docSnap.id.split("_");
        const baseChallenge = docSnap.data() as Omit<
          CurrentChallenge,
          "id" | "selectedDays"
        >;
        return {
          id: challengeId,
          selectedDays: parseInt(selectedDays, 10),
          ...baseChallenge,
        };
      });
      setCurrentChallenges(challenges);
      console.log("Loaded current challenges:", challenges);
    } catch (error) {
      console.error("Error loading current challenges:", error);
    }
  }, []);

  // ===================================
  // TAKE CHALLENGE
  // ===================================
  const takeChallenge = async (challenge: Challenge, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("User not authenticated.");
      return;
    }

    try {
      const challengeRef = doc(db, "challenges", challenge.id);
      const currentChallengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${challenge.id}_${selectedDays}`
      );

      const challengeData = {
        userId,
        id: challenge.id,
        title: challenge.title,
        category: challenge.category,
        description: challenge.description,
        imageUrl: challenge.imageUrl,
        chatId: challenge.chatId,
        daysOptions: challenge.daysOptions,
        selectedDays,
        completedDays: 0,
        lastMarkedDate: null,
      };

      await runTransaction(db, async (transaction) => {
        const globalChallengeDoc = await transaction.get(challengeRef);
        if (!globalChallengeDoc.exists()) {
          throw new Error("Challenge does not exist.");
        }

        const globalData = globalChallengeDoc.data();
        const currentParticipants = globalData?.participantsCount || 0;

        transaction.update(challengeRef, {
          participantsCount: currentParticipants + 1,
          usersTakingChallenge: arrayUnion(userId),
        });

        transaction.set(currentChallengeRef, challengeData);
        console.log("Challenge taken and added to currentChallenges.");
      });

      setCurrentChallenges((prev) => [
        ...prev,
        { ...challenge, selectedDays, completedDays: 0, lastMarkedDate: null },
      ]);
    } catch (error) {
      console.error("Error taking challenge:", error);
      Alert.alert("Error", "Failed to take challenge. Please try again.");
    }
  };

  // ===================================
  // REMOVE CHALLENGE
  // ===================================
  const removeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const challengeRef = doc(db, "challenges", id);
      const currentChallengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${id}_${selectedDays}`
      );

      await runTransaction(db, async (transaction) => {
        const globalChallengeDoc = await transaction.get(challengeRef);
        if (!globalChallengeDoc.exists()) {
          throw new Error("Challenge does not exist.");
        }

        const globalData = globalChallengeDoc.data();
        const currentParticipants = globalData?.participantsCount || 0;

        transaction.update(challengeRef, {
          participantsCount: Math.max(currentParticipants - 1, 0),
          usersTakingChallenge: arrayRemove(userId),
        });

        transaction.delete(currentChallengeRef);
        console.log("Challenge removed from currentChallenges.");
      });

      setCurrentChallenges((prev) =>
        prev.filter((c) => !(c.id === id && c.selectedDays === selectedDays))
      );
    } catch (error) {
      console.error("Error removing challenge:", error);
      Alert.alert("Error", "Failed to remove challenge. Please try again.");
    }
  };

  // ===================================
  // MARK TODAY
  // ===================================
  const markToday = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const today = new Date().toDateString();
      const challengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${id}_${selectedDays}`
      );
      const challengeSnap = await getDoc(challengeRef);

      if (challengeSnap.exists()) {
        const challenge = challengeSnap.data() as CurrentChallenge;

        if (challenge.lastMarkedDate === today) {
          console.log("Challenge already marked for today.");
          return;
        }

        const newCompletedDays = Math.min(
          (challenge.completedDays || 0) + 1,
          selectedDays
        );

        await updateDoc(challengeRef, {
          completedDays: newCompletedDays,
          lastMarkedDate: today,
        });
        console.log("Marked today for challenge:", {
          id,
          selectedDays,
          newCompletedDays,
        });

        setCurrentChallenges((prev) =>
          prev.map((c) =>
            c.id === id && c.selectedDays === selectedDays
              ? { ...c, completedDays: newCompletedDays, lastMarkedDate: today }
              : c
          )
        );
      }
    } catch (error) {
      console.error("Error marking challenge for today:", error);
    }
  };

  // ===================================
  // COMPLETE CHALLENGE
  // ===================================
  const completeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const trophiesToAdd = selectedDays;

    try {
      const completionDate = new Date();

      console.log("Starting completeChallenge:", { id, selectedDays, userId });

      await runTransaction(db, async (transaction) => {
        console.log("Transaction started");

        // -- References --
        const currentChallengeRef = doc(
          db,
          "currentChallenges",
          `${userId}_${id}_${selectedDays}`
        );
        const challengeRef = doc(db, "challenges", id);
        const userRef = doc(db, "users", userId);

        // -- Get existing data --
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) {
          throw new Error("Global challenge does not exist.");
        }
        console.log("Fetched challengeDoc");

        const challengeData = challengeDoc.data();

        const userDocSnap = await transaction.get(userRef);
        if (!userDocSnap.exists()) {
          throw new Error("User document does not exist.");
        }
        console.log("Fetched userDoc");

        const userData = userDocSnap.data();

        // -- Prepare completed challenge info --
        const challengeTitle = challengeData?.title || "Untitled Challenge";
        const completedChallengeData: CompletedChallenge = {
          id,
          title: challengeTitle,
          category: challengeData?.category || "Uncategorized",
          description: challengeData?.description || "No description available",
          imageUrl: challengeData?.imageUrl || null,
          dateCompleted: completionDate.toISOString(),
          selectedDays: selectedDays,
        };
        console.log("Prepared completedChallengeData:", completedChallengeData);

        // -- Increment completedChallengesCount --
        const newCompletedCount = (userData?.completedChallengesCount || 0) + 1;
        console.log("New completedChallengesCount:", newCompletedCount);

        // -- Build an achievement string --
        let achievementString: string;
        if (newCompletedCount === 1) {
          achievementString = "First challenge completed";
        } else {
          achievementString = `Challenge completed: ${challengeTitle}`;
        }
        console.log("Achievement string:", achievementString);

        // -- Update user document --
        transaction.update(userRef, {
          completedChallengesCount: newCompletedCount,
          achievements: arrayUnion(achievementString),
          CompletedChallenges: arrayUnion(completedChallengeData),
          trophies: userData?.trophies
            ? userData.trophies + trophiesToAdd
            : trophiesToAdd,
        });
        console.log("User document updated in transaction");

        // -- Remove challenge from currentChallenges --
        transaction.delete(currentChallengeRef);
        console.log("Removed current challenge from currentChallenges");

        // -- Decrement participants in 'challenges/{id}' doc --
        const currentParticipants = challengeData?.participantsCount || 0;
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentParticipants - 1, 0),
          usersTakingChallenge: arrayRemove(userId),
        });
        console.log(
          "Decremented participantsCount and removed user from usersTakingChallenge"
        );
      });

      console.log("Transaction completed successfully");

      // -- Temporarily disable awarding trophies and achievements --
      // await awardTrophiesAndCheckAchievements({
      //   action: "finishChallenge",
      //   trophiesToAdd,
      //   additionalParams: { selectedDays },
      // });
      // console.log("Awarded trophies and checked achievements");

      // -- Update local state --
      setCurrentChallenges((prev) =>
        prev.filter((c) => !(c.id === id && c.selectedDays === selectedDays))
      );
      console.log("Updated local state");

      Alert.alert("Congrats!", `You earned ${trophiesToAdd} trophies!`);
    } catch (error) {
      console.error("Error completing challenge:", error);
      Alert.alert(
        "Error",
        "Failed to complete the challenge. Please try again."
      );
    }
  };

  // ===================================
  // EFFECT: Load current challenges
  // ===================================
  useEffect(() => {
    loadCurrentChallenges();
  }, [loadCurrentChallenges]);

  return (
    <CurrentChallengesContext.Provider
      value={{
        currentChallenges,
        loadCurrentChallenges,
        takeChallenge,
        removeChallenge,
        markToday,
        completeChallenge,
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
