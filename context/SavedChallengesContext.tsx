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
  updateDoc,
  increment,
} from "firebase/firestore";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  daysOptions: number[];
  chatId: string;
  participantsCount?: number;
}

interface CurrentChallenge extends Challenge {
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

interface SavedChallengesContextType {
  savedChallenges: Challenge[];
  currentChallenges: CurrentChallenge[];
  addChallenge: (challenge: Challenge) => Promise<void>;
  removeChallenge: (id: string) => Promise<void>;
  loadSavedChallenges: () => Promise<void>;
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  markToday: (id: string, selectedDays: number) => Promise<void>;
  completeChallenge: (id: string, selectedDays: number) => Promise<void>;
  isSaved: (id: string) => boolean;
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
      const savedChallengesRef = collection(db, "savedChallenges");
      const q = query(savedChallengesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);

      const loadedSavedChallenges = querySnapshot.docs.map((doc) => ({
        id: doc.id.replace(`${userId}_`, ""),
        ...doc.data(),
      })) as Challenge[];
      setSavedChallenges(loadedSavedChallenges);
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
      await loadSavedChallenges();
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
      await loadSavedChallenges();
    } catch (error) {
      console.error("Error removing challenge:", error);
    }
  };

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

      const challengeSnap = await getDocs(challengeRef);
      if (challengeSnap.exists()) {
        const challenge = challengeSnap.data() as CurrentChallenge;

        if (challenge.lastMarkedDate === today) return;

        const newCompletedDays = Math.min(
          challenge.completedDays + 1,
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

  const completeChallenge = async (id: string, selectedDays: number) => {
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
      console.error("Error completing challenge:", error);
    }
  };

  const isSaved = (id: string) =>
    savedChallenges.some((challenge) => challenge.id === id);

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
        isSaved,
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
