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
  getDoc,
} from "firebase/firestore";

// 1) Import your trophies helper
import { awardTrophiesAndCheckAchievements } from "../helpers/trophiesHelpers";

export interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  daysOptions: number[];
  chatId: string;
}

interface SavedChallengesContextType {
  savedChallenges: Challenge[];
  addChallenge: (challenge: Challenge) => Promise<void>;
  removeChallenge: (id: string) => Promise<void>;
  loadSavedChallenges: () => Promise<void>;
  isSaved: (id: string) => boolean;
}

const SavedChallengesContext = createContext<SavedChallengesContextType | null>(
  null
);

export const SavedChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);

  const loadSavedChallenges = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("User not authenticated.");
      return;
    }

    try {
      const savedChallengesRef = collection(db, "savedChallenges");
      const q = query(savedChallengesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);

      const loadedSavedChallenges = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id.replace(`${userId}_`, ""),
        ...docSnap.data(),
      })) as Challenge[];
      setSavedChallenges(loadedSavedChallenges);
    } catch (error) {
      console.error("Error loading saved challenges:", error);
    }
  };

  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("User not authenticated. Cannot save challenge.");
      return;
    }

    try {
      const savedChallengeRef = doc(
        db,
        "savedChallenges",
        `${userId}_${challenge.id}`
      );
      const existingSnap = await getDoc(savedChallengeRef);

      // 2) If the doc doesn't exist yet => user is saving this challenge for the FIRST TIME
      if (!existingSnap.exists()) {
        // Trigger the "saveChallenge" action in trophiesHelpers
        await awardTrophiesAndCheckAchievements({
          action: "saveChallenge",
          trophiesToAdd: 0, // We'll do the +5 logic in trophiesHelpers
        });
      }

      // Now actually setDoc
      await setDoc(savedChallengeRef, {
        userId,
        ...challenge,
      });

      // Update local state immediately
      setSavedChallenges((prev) => [
        ...prev.filter((c) => c.id !== challenge.id),
        challenge,
      ]);
    } catch (error) {
      console.error("Error adding challenge:", error);
    }
  };

  const removeChallenge = async (id: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("User not authenticated. Cannot remove challenge.");
      return;
    }

    try {
      const savedChallengeRef = doc(db, "savedChallenges", `${userId}_${id}`);
      await deleteDoc(savedChallengeRef);

      // Update local state
      setSavedChallenges((prev) =>
        prev.filter((challenge) => challenge.id !== id)
      );
    } catch (error) {
      console.error("Error removing challenge:", error);
    }
  };

  const isSaved = (id: string): boolean =>
    savedChallenges.some((challenge) => challenge.id === id);

  useEffect(() => {
    loadSavedChallenges();
  }, []);

  return (
    <SavedChallengesContext.Provider
      value={{
        savedChallenges,
        addChallenge,
        removeChallenge,
        loadSavedChallenges,
        isSaved,
      }}
    >
      {children}
    </SavedChallengesContext.Provider>
  );
};

export const useSavedChallenges = (): SavedChallengesContextType => {
  const context = useContext(SavedChallengesContext);
  if (!context) {
    throw new Error(
      "useSavedChallenges must be used within a SavedChallengesProvider"
    );
  }
  return context;
};
