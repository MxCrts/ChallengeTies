import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { Alert } from "react-native";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
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
  completedTodayChallenges: CurrentChallenge[];
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
  const [completedTodayChallenges, setCompletedTodayChallenges] = useState<
    CurrentChallenge[]
  >([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();

        // ✅ Vérifier et initialiser en tableau si Firebase ne retourne rien
        setCurrentChallenges(
          Array.isArray(userData.CurrentChallenges)
            ? userData.CurrentChallenges
            : []
        );
        setCompletedTodayChallenges(
          Array.isArray(userData.CompletedTodayChallenges)
            ? userData.CompletedTodayChallenges
            : []
        );

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

    try {
      const userRef = doc(db, "users", userId);
      const challengeData: CurrentChallenge = {
        ...challenge,
        selectedDays,
        completedDays: 0,
        lastMarkedDate: null,
      };

      await updateDoc(userRef, {
        CurrentChallenges: arrayUnion(challengeData),
      });

      setCurrentChallenges((prev) => [...prev, challengeData]);
      console.log("✅ Défi ajouté à CurrentChallenges !");
    } catch (error) {
      console.error("❌ Erreur lors de l'ajout du défi :", error);
    }
  };

  const removeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const updatedCurrentChallenges = (
        userData.CurrentChallenges || []
      ).filter(
        (challenge: CurrentChallenge) =>
          !(challenge.id === id && challenge.selectedDays === selectedDays)
      );

      const updatedCompletedTodayChallenges = (
        userData.CompletedTodayChallenges || []
      ).filter(
        (challenge: CurrentChallenge) =>
          !(challenge.id === id && challenge.selectedDays === selectedDays)
      );

      await updateDoc(userRef, {
        CurrentChallenges: updatedCurrentChallenges,
        CompletedTodayChallenges: updatedCompletedTodayChallenges,
      });

      setCurrentChallenges(updatedCurrentChallenges);
      setCompletedTodayChallenges(updatedCompletedTodayChallenges);
      console.log(
        "✅ Défi retiré de CurrentChallenges et CompletedTodayChallenges !"
      );
    } catch (error) {
      console.error("❌ Erreur lors de la suppression du défi :", error);
    }
  };

  const markToday = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const today = new Date().toDateString();
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      let updatedChallenges = Array.isArray(userData.CurrentChallenges)
        ? userData.CurrentChallenges
        : [];
      let updatedCompletedTodayChallenges = Array.isArray(
        userData.CompletedTodayChallenges
      )
        ? userData.CompletedTodayChallenges
        : [];

      // 🛠️ Supprime le challenge de `CurrentChallenges`
      updatedChallenges = updatedChallenges.filter(
        (challenge: CurrentChallenge) => challenge.id !== id
      );

      // ✅ Ajouter le challenge marqué aujourd'hui dans `CompletedTodayChallenges`
      const markedChallenge = userData.CurrentChallenges.find(
        (challenge: CurrentChallenge) => challenge.id === id
      );

      if (markedChallenge) {
        markedChallenge.completedDays += 1;
        markedChallenge.lastMarkedDate = today;
        updatedCompletedTodayChallenges.push(markedChallenge);
      }

      await updateDoc(userRef, {
        CurrentChallenges: updatedChallenges,
        CompletedTodayChallenges: updatedCompletedTodayChallenges,
        trophies: (userData.trophies || 0) + 5, // Bonus trophées 🎖️
      });

      setCurrentChallenges(updatedChallenges);
      setCompletedTodayChallenges(updatedCompletedTodayChallenges);

      console.log("✅ Journée marquée comme complétée !");
      Alert.alert("Bravo !", "Tu gagnes 5 trophées 🎖️ !");
    } catch (error) {
      console.error("❌ Erreur lors du marquage :", error);
    }
  };

  return (
    <CurrentChallengesContext.Provider
      value={{
        currentChallenges,
        completedTodayChallenges,
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

  return {
    ...context,
    currentChallenges: Array.isArray(context.currentChallenges)
      ? context.currentChallenges
      : [],
    completedTodayChallenges: Array.isArray(context.completedTodayChallenges)
      ? context.completedTodayChallenges
      : [],
  };
};
