import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { Alert } from "react-native";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { useTranslation } from "react-i18next";

export interface Challenge {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  daysOptions?: number[];
  chatId?: string;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const { t, i18n } = useTranslation();
  const isActiveRef = useRef(true); // Bloque les callbacks

  useEffect(() => {
    console.log(
      "Initialisation de onAuthStateChanged pour SavedChallengesContext"
    ); // Log
    let unsubscribeSnapshot: (() => void) | null = null; // Stocker unsubscribe
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      console.log(
        "onAuthStateChanged SavedChallenges, user:",
        user?.uid || "null"
      ); // Log
      if (!user) {
        console.log("Aucun utilisateur connecté, réinitialisation des défis"); // Log
        isActiveRef.current = false; // Bloquer onSnapshot
        if (unsubscribeSnapshot) {
          console.log("Désabonnement onSnapshot SavedChallenges immédiat"); // Log
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setSavedChallenges([]);
        setIsInitialized(true);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      unsubscribeSnapshot = onSnapshot(
        userRef,
        (docSnap) => {
          if (!isActiveRef.current || !auth.currentUser) {
            console.log(
              "onSnapshot SavedChallenges ignoré: inactif ou déconnecté"
            ); // Log
            return;
          }
          console.log("onSnapshot déclenché pour userId:", user.uid); // Log
          if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log(
              "Données brutes de SavedChallenges:",
              userData.SavedChallenges
            ); // Log
            const challenges = userData.SavedChallenges || [];
            const validChallenges = challenges.map((challenge: any) => ({
              id: challenge.id || "unknown",
              title: challenge.title || "Sans titre",
              category: challenge.category || null,
              description: challenge.description || null,
              imageUrl: challenge.imageUrl || null,
              daysOptions:
                Array.isArray(challenge.daysOptions) &&
                challenge.daysOptions.length > 0
                  ? challenge.daysOptions
                  : [7],
              chatId: challenge.chatId || `chat_${challenge.id}`,
            }));
            console.log("Défis valides via onSnapshot:", validChallenges); // Log
            setSavedChallenges(validChallenges);
            setIsInitialized(true);
          } else {
            console.log("Document utilisateur introuvable, réinitialisation"); // Log
            setSavedChallenges([]);
            setIsInitialized(true);
          }
        },
        (error) => {
          console.error(
            "Erreur dans onSnapshot SavedChallenges:",
            error.message
          ); // Log
          if (error.code === "permission-denied" && !auth.currentUser) {
            console.log("Permission refusée, déconnecté, ignoré"); // Log
            setSavedChallenges([]);
            setIsInitialized(true);
          } else {
            console.error("Erreur inattendue:", error); // Log
          }
        }
      );
    });

    return () => {
      console.log("Arrêt de onAuthStateChanged pour SavedChallengesContext"); // Log
      isActiveRef.current = false;
      if (unsubscribeSnapshot) {
        console.log("Désabonnement onSnapshot SavedChallenges final"); // Log
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, []);

  const loadSavedChallenges = async () => {
    if (isInitialized) {
      console.log("Défis déjà initialisés, chargement ignoré.");
      return;
    }
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("Aucun utilisateur connecté pour charger les défis.");
      return;
    }
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log(
          "Données brutes de SavedChallenges (load) :",
          userData.SavedChallenges
        );
        const challenges = userData.SavedChallenges || [];
        const validChallenges = challenges.map((challenge: any) => ({
          id: challenge.id || "unknown",
          title: challenge.title || "Sans titre",
          category: challenge.category || null,
          description: challenge.description || null,
          imageUrl: challenge.imageUrl || null,
          daysOptions:
            Array.isArray(challenge.daysOptions) &&
            challenge.daysOptions.length > 0
              ? challenge.daysOptions
              : [7],
          chatId: challenge.chatId || `chat_${challenge.id}`,
        }));
        console.log("Chargement initial des défis :", validChallenges);
        setSavedChallenges(validChallenges);
        setIsInitialized(true);
      } else {
        console.log("Document utilisateur introuvable.");
        setSavedChallenges([]);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des défis sauvegardés :", error);
      setIsInitialized(true);
      throw error;
    }
  };

  const addChallenge = async (challenge: Challenge) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("Aucun utilisateur connecté pour sauvegarder le défi.");
      throw new Error("Vous devez être connecté pour sauvegarder un défi.");
    }
    try {
      const userRef = doc(db, "users", userId);
      const challengeData = {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category || null,
        description: challenge.description || null,
        imageUrl: challenge.imageUrl || null,
        daysOptions:
          challenge.daysOptions && challenge.daysOptions.length > 0
            ? challenge.daysOptions
            : [7],
        chatId: challenge.chatId || `chat_${challenge.id}`,
      };
      setSavedChallenges((prev) => [...prev, challengeData]);
      await updateDoc(userRef, {
        SavedChallenges: arrayUnion(challengeData),
        saveChallenge: increment(1),
      });
      console.log("Challenge sauvegardé avec succès :", challengeData);
      await checkForAchievements(userId);
    } catch (error) {
      console.error("Erreur lors de l'ajout du défi :", error);
      setSavedChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
      throw error;
    }
  };

  const removeChallenge = async (id: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("Aucun utilisateur connecté pour supprimer le défi.");
      throw new Error("Vous devez être connecté pour supprimer un défi.");
    }
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedChallenges = (userData.SavedChallenges || []).filter(
          (challenge: Challenge) => challenge.id !== id
        );
        setSavedChallenges(updatedChallenges);
        await updateDoc(userRef, {
          SavedChallenges: updatedChallenges,
          saveChallenge:
            userData.saveChallenge > 0 ? userData.saveChallenge - 1 : 0,
        });
        console.log("Challenge retiré avec succès :", id);
        await checkForAchievements(userId);
      } else {
        console.log("Document utilisateur introuvable.");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du défi :", error);
      await loadSavedChallenges();
      throw error;
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
