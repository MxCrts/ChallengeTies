import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config"; // Adjust the path if needed
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  totalDays?: number; // Total duration of the challenge in days
}

interface CurrentChallenge extends Challenge {
  completedDays: number; // Tracks the progress of the challenge
  lastMarkedDate?: string; // Keeps track of the last date the challenge was marked
}

interface SavedChallengesContextType {
  savedChallenges: Challenge[];
  currentChallenges: CurrentChallenge[];
  addChallenge: (challenge: Challenge) => Promise<void>;
  removeChallenge: (id: string) => Promise<void>;
  loadSavedChallenges: () => Promise<void>;
  takeChallenge: (challenge: Challenge) => void;
  markToday: (id: string) => void;
  completeChallenge: (id: string) => void;
}

const SavedChallengesContext = createContext<SavedChallengesContextType | null>(
  null
);

export const SavedChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);

  const loadSavedChallenges = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const q = query(
        collection(db, "savedChallenges"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const challenges = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Challenge[];

      setSavedChallenges(challenges);
    } catch (error) {
      console.error("Error loading saved challenges:", error);
    }
  };

  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const savedChallengeRef = doc(
        db,
        "savedChallenges",
        `${userId}_${challenge.id}`
      );
      await setDoc(savedChallengeRef, { userId, ...challenge });
      await loadSavedChallenges(); // Sync state after Firestore update
    } catch (error) {
      console.error("Error adding challenge:", error);
    }
  };

  const removeChallenge = async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const savedChallengeRef = doc(db, "savedChallenges", `${userId}_${id}`);
      await deleteDoc(savedChallengeRef);
      await loadSavedChallenges(); // Sync state after Firestore update
    } catch (error) {
      console.error("Error removing challenge:", error);
    }
  };

  const takeChallenge = (challenge: Challenge) => {
    if (currentChallenges.some((c) => c.id === challenge.id)) return;

    setCurrentChallenges((prev) => [
      ...prev,
      { ...challenge, completedDays: 0, lastMarkedDate: undefined },
    ]);
  };

  const markToday = (id: string) => {
    setCurrentChallenges((prev) =>
      prev.map((challenge) => {
        if (challenge.id === id) {
          const today = new Date().toDateString();
          if (challenge.lastMarkedDate === today) return challenge;

          const newCompletedDays = Math.min(
            (challenge.completedDays || 0) + 1,
            challenge.totalDays || 30
          );

          return {
            ...challenge,
            completedDays: newCompletedDays,
            lastMarkedDate: today,
          };
        }
        return challenge;
      })
    );
  };

  const completeChallenge = (id: string) => {
    setCurrentChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  useEffect(() => {
    loadSavedChallenges(); // Load saved challenges when context initializes
  }, []);

  return (
    <SavedChallengesContext.Provider
      value={{
        savedChallenges,
        currentChallenges,
        addChallenge,
        removeChallenge,
        loadSavedChallenges,
        takeChallenge,
        markToday,
        completeChallenge,
      }}
    >
      {children}
    </SavedChallengesContext.Provider>
  );
};

export const useSavedChallenges = () => {
  const context = useContext(SavedChallengesContext);
  if (!context) {
    throw new Error(
      "useSavedChallenges must be used within a SavedChallengesProvider"
    );
  }
  return context;
};
