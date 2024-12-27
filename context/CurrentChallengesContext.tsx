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
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  increment,
} from "firebase/firestore";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  participantsCount?: number;
  daysOptions: number[]; // Days choices: e.g., [10, 30, 60]
  chatId: string; // Shared chat ID
}

interface CurrentChallenge extends Challenge {
  selectedDays: number; // User-selected duration
  completedDays: number; // Progress tracking
  lastMarkedDate?: string | null; // Last date marked as completed
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
      const challenges = querySnapshot.docs.map((doc) => ({
        id: doc.id.split("_")[1], // Extract challenge ID
        selectedDays: parseInt(doc.id.split("_")[2]), // Extract selectedDays
        ...doc.data(),
      })) as CurrentChallenge[];

      setCurrentChallenges(challenges);
    } catch (error) {
      console.error("Error loading current challenges:", error);
    }
  }, []);

  const takeChallenge = async (challenge: Challenge, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const challengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${challenge.id}_${selectedDays}`
      );
      const globalChallengeRef = doc(db, "challenges", challenge.id);

      await setDoc(challengeRef, {
        userId,
        ...challenge,
        selectedDays,
        completedDays: 0,
        lastMarkedDate: null,
      });

      await updateDoc(globalChallengeRef, {
        participantsCount: increment(1),
      });

      setCurrentChallenges((prev) => [
        ...prev,
        { ...challenge, selectedDays, completedDays: 0, lastMarkedDate: null },
      ]);
    } catch (error) {
      console.error("Error taking challenge:", error);
    }
  };

  const removeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const challengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${id}_${selectedDays}`
      );
      const globalChallengeRef = doc(db, "challenges", id);

      await deleteDoc(challengeRef);

      await updateDoc(globalChallengeRef, {
        participantsCount: increment(-1),
      });

      setCurrentChallenges((prev) =>
        prev.filter((c) => !(c.id === id && c.selectedDays === selectedDays))
      );
    } catch (error) {
      console.error("Error removing challenge:", error);
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
