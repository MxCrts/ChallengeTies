import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { checkForAchievements } from "../helpers/trophiesHelpers";

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

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const challenges = userData.SavedChallenges || [];
          setSavedChallenges(challenges);
        } else {
          setSavedChallenges([]);
        }
      },
      (error) => {
        console.error("Erreur dans onSnapshot :", error);
        setSavedChallenges([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadSavedChallenges = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setSavedChallenges(userData.SavedChallenges || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des défis sauvegardés :", error);
    }
  };

  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        SavedChallenges: arrayUnion({
          id: challenge.id,
          title: challenge.title,
          category: challenge.category || null,
          description: challenge.description || null,
          imageUrl: challenge.imageUrl || null,
          daysOptions: challenge.daysOptions,
          chatId: challenge.chatId,
        }),
        saveChallenge: increment(1),
      });
      console.log("Challenge sauvegardé !");
      await checkForAchievements(userId);
    } catch (error) {
      console.error("Erreur lors de l'ajout du défi :", error);
    }
  };

  const removeChallenge = async (id: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedChallenges = (userData.SavedChallenges || []).filter(
          (challenge: Challenge) => challenge.id !== id
        );
        const currentCount = userData.saveChallenge || 0;
        await updateDoc(userRef, {
          SavedChallenges: updatedChallenges,
          saveChallenge: currentCount > 0 ? currentCount - 1 : 0,
        });
        console.log("Challenge retiré !");
        await checkForAchievements(userId);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du défi :", error);
    }
  };

  const isSaved = (id: string): boolean =>
    savedChallenges.some((challenge) => challenge.id === id);

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
