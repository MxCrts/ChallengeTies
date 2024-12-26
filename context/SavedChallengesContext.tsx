import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config";
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
  description?: string;
  imageUrl?: string; // Challenge image
  participantsCount?: number; // Number of participants
}

interface CurrentChallenge extends Challenge {
  completedDays: number; // Tracks the progress of the challenge
  lastMarkedDate?: string | null; // Allow null
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
    if (!userId) {
      console.warn("No user ID found. Cannot load saved challenges.");
      return;
    }

    try {
      console.log(`Loading saved challenges for user: ${userId}`);
      const q = query(
        collection(db, "savedChallenges"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn("No saved challenges found for the current user.");
        setSavedChallenges([]); // Clear the array if no data exists.
      } else {
        const challenges = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Challenge[];
        console.log(`Fetched ${challenges.length} saved challenges.`);
        setSavedChallenges(challenges);
      }
    } catch (error) {
      console.error("Error loading saved challenges:", error);
    }
  };

  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("No user ID found. Cannot add challenge.");
      return;
    }

    try {
      console.log(`Adding challenge: ${challenge.title}`);
      const savedChallengeRef = doc(
        db,
        "savedChallenges",
        `${userId}_${challenge.id}`
      );
      await setDoc(savedChallengeRef, { userId, ...challenge });
      await loadSavedChallenges();
    } catch (error) {
      console.error("Error adding challenge:", error);
    }
  };

  const removeChallenge = async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("No user ID found. Cannot remove challenge.");
      return;
    }

    try {
      console.log(`Removing challenge with ID: ${id}`);
      const savedChallengeRef = doc(db, "savedChallenges", `${userId}_${id}`);
      await deleteDoc(savedChallengeRef);
      await loadSavedChallenges();
    } catch (error) {
      console.error("Error removing challenge:", error);
    }
  };

  const takeChallenge = (challenge: Challenge) => {
    if (currentChallenges.some((c) => c.id === challenge.id)) {
      console.warn(`Challenge "${challenge.title}" already taken.`);
      return;
    }

    console.log(`Taking challenge: ${challenge.title}`);
    setCurrentChallenges((prev) => [
      ...prev,
      { ...challenge, completedDays: 0, lastMarkedDate: null },
    ]);
  };

  const markToday = (id: string) => {
    setCurrentChallenges((prev) =>
      prev.map((challenge) => {
        if (challenge.id === id) {
          const today = new Date().toDateString();
          if (challenge.lastMarkedDate === today) {
            console.log(`Challenge with ID ${id} already marked today.`);
            return challenge;
          }

          const newCompletedDays = Math.min(
            (challenge.completedDays || 0) + 1,
            challenge.totalDays || 30
          );

          console.log(`Marking challenge with ID ${id} as completed today.`);
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
    console.log(`Completing challenge with ID ${id}`);
    setCurrentChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  useEffect(() => {
    loadSavedChallenges();
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
