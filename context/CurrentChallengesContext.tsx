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
  setDoc,
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

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  loadCurrentChallenges: () => Promise<void>;
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  removeChallenge: (id: string, selectedDays: number) => Promise<void>;
  markToday: (id: string, selectedDays: number) => Promise<void>;
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);

  const loadCurrentChallenges = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const q = query(
        collection(db, "currentChallenges"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const challenges = querySnapshot.docs.map((doc) => {
        const [_, challengeId, selectedDays] = doc.id.split("_");
        const baseChallenge = doc.data() as Omit<
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
    } catch (error) {
      console.error("Error loading current challenges:", error);
    }
  }, []);

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

      console.log("Preparing to save challenge data:", challengeData);

      await runTransaction(db, async (transaction) => {
        const globalChallengeDoc = await transaction.get(challengeRef);
        if (!globalChallengeDoc.exists()) {
          throw new Error("Challenge does not exist.");
        }

        const globalData = globalChallengeDoc.data();
        const currentParticipants = globalData?.participantsCount || 0;

        // Update global challenge data
        transaction.update(challengeRef, {
          participantsCount: currentParticipants + 1,
          usersTakingChallenge: arrayUnion(userId),
        });

        // Save to currentChallenges collection
        transaction.set(currentChallengeRef, challengeData);
      });

      // Update local state
      setCurrentChallenges((prev) => [
        ...prev,
        { ...challenge, selectedDays, completedDays: 0, lastMarkedDate: null },
      ]);

      console.log("Challenge successfully saved to Firestore and local state.");
    } catch (error) {
      console.error("Error taking challenge:", error);
      Alert.alert("Error", "Failed to take challenge. Please try again.");
    }
  };

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

        // Update global challenge data
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentParticipants - 1, 0),
          usersTakingChallenge: arrayRemove(userId),
        });

        // Remove from currentChallenges collection
        transaction.delete(currentChallengeRef);
      });

      // Update local state
      setCurrentChallenges((prev) =>
        prev.filter((c) => !(c.id === id && c.selectedDays === selectedDays))
      );

      console.log(
        "Challenge successfully removed from Firestore and local state."
      );
    } catch (error) {
      console.error("Error removing challenge:", error);
      Alert.alert("Error", "Failed to remove challenge. Please try again.");
    }
  };

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
