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
} from "firebase/firestore";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  totalDays?: number;
  description?: string;
  completedDays?: number;
  lastMarkedDate?: string | null; // Allow null
}

interface CurrentChallengesContextType {
  currentChallenges: Challenge[];
  loadCurrentChallenges: () => Promise<void>;
  takeChallenge: (challenge: Challenge) => Promise<void>;
  removeChallenge: (id: string) => Promise<void>;
  markToday: (id: string) => Promise<void>;
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<Challenge[]>([]);

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
        id: doc.id,
        ...doc.data(),
      })) as Challenge[];

      setCurrentChallenges(challenges);
    } catch (error) {
      console.error("Error loading current challenges:", error);
    }
  }, []);

  const takeChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const challengeRef = doc(
        db,
        "currentChallenges",
        `${userId}_${challenge.id}`
      );

      // Add challenge to Firestore
      await setDoc(challengeRef, {
        userId,
        ...challenge,
        completedDays: 0,
        lastMarkedDate: null,
      });

      // Reload currentChallenges from Firestore
      await loadCurrentChallenges();
    } catch (error) {
      console.error("Error taking challenge:", error);
    }
  };

  const removeChallenge = async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const challengeRef = doc(db, "currentChallenges", `${userId}_${id}`);
      await deleteDoc(challengeRef);
      await loadCurrentChallenges();
    } catch (error) {
      console.error("Error removing challenge:", error);
    }
  };

  const markToday = async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const today = new Date().toDateString();
      const challengeRef = doc(db, "currentChallenges", `${userId}_${id}`);
      const challengeSnap = await getDoc(challengeRef);

      if (challengeSnap.exists()) {
        const challenge = challengeSnap.data() as Challenge;

        if (challenge.lastMarkedDate === today) {
          console.log("Challenge already marked for today.");
          return;
        }

        const newCompletedDays = Math.min(
          (challenge.completedDays || 0) + 1,
          challenge.totalDays || 30
        );

        await updateDoc(challengeRef, {
          completedDays: newCompletedDays,
          lastMarkedDate: today,
        });

        await loadCurrentChallenges();
      }
    } catch (error) {
      console.error("Error marking challenge for today:", error);
    }
  };

  useEffect(() => {
    loadCurrentChallenges(); // Call only once
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
