import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

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

  // 📥 Charger les défis sauvegardés depuis le document utilisateur
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

  // ➕ Ajouter un défi à `SavedChallenges` dans le document utilisateur
  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);

      // Ajouter le défi dans l'array `SavedChallenges`
      await updateDoc(userRef, {
        SavedChallenges: arrayUnion(challenge),
      });

      // Ajouter localement
      setSavedChallenges((prev) => [...prev, challenge]);

      console.log("Challenge sauvegardé !");
    } catch (error) {
      console.error("Erreur lors de l'ajout du défi :", error);
    }
  };

  // ❌ Retirer un défi de `SavedChallenges`
  const removeChallenge = async (id: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);

      // Récupérer l'utilisateur pour filtrer correctement l'objet à supprimer
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedChallenges = (userData.SavedChallenges || []).filter(
          (challenge: Challenge) => challenge.id !== id
        );

        // Mettre à jour la base de données avec la nouvelle liste filtrée
        await updateDoc(userRef, {
          SavedChallenges: updatedChallenges,
        });

        // Mettre à jour localement
        setSavedChallenges(updatedChallenges);

        console.log("Challenge retiré !");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du défi :", error);
    }
  };

  // ✅ Vérifier si un défi est déjà sauvegardé
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
