import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { auth, db } from "@/constants/firebase-config";
import {
   doc,
   updateDoc,
   getDoc,
   onSnapshot,
   arrayUnion,
 } from "firebase/firestore";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { useTranslation } from "react-i18next";
import { incStat } from "@/src/services/metricsService";

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
  const isActiveRef = useRef(true); 
  const inFlightAdd = useRef<Set<string>>(new Set());
 const inFlightRemove = useRef<Set<string>>(new Set());

 // ✅ Ref miroir pour éviter le "stale state" dans add/remove
  const savedChallengesRef = useRef<Challenge[]>([]);
  useEffect(() => {
    savedChallengesRef.current = savedChallenges;
  }, [savedChallenges]);

  // 🔔 Coalescer achievements (évite spam)
  const achTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achUserRef = useRef<string | null>(null);
  const scheduleAchievementsCheck = (uid?: string | null, delay = 500) => {
    if (!uid) return;
    achUserRef.current = uid;
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
    achTimerRef.current = setTimeout(() => {
      const u = achUserRef.current;
      if (!u) return;
      checkForAchievements(u).catch(() => {});
      achTimerRef.current = null;
    }, delay);
  };

  useEffect(() => {
    console.log(
      "Initialisation de onAuthStateChanged pour SavedChallengesContext"
    ); // Log
    let unsubscribeSnapshot: (() => void) | null = null; // Stocker unsubscribe
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Si on switche d'utilisateur, on nettoie l'ancien onSnapshot
   if (unsubscribeSnapshot) {
     unsubscribeSnapshot();
     unsubscribeSnapshot = null;
   }
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
// Réactive l’écoute si user connecté
    isActiveRef.current = true;
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
            
            const challenges = Array.isArray(userData.SavedChallenges) ? userData.SavedChallenges : [];
            // normalisation + DÉDUP strict par id (Map)
            const normalized = challenges.map((challenge: any) => ({
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
            const validChallenges = Array.from(
              new Map(normalized.map((c: Challenge) => [c.id, c])).values()
            );
            
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

      if (achTimerRef.current) {
        clearTimeout(achTimerRef.current);
        achTimerRef.current = null;
      }
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
    // anti double tap local
   if (inFlightAdd.current.has(challenge.id)) return;
    inFlightAdd.current.add(challenge.id);

    let optimisticallyAdded = false;
    try {
      const userRef = doc(db, "users", userId);
      // Vérifie côté serveur pour éviter d'incrémenter les stats si déjà présent
      const snap = await getDoc(userRef);
      const snapData = snap.exists() ? snap.data() : null;
      const serverList: Challenge[] = Array.isArray(snapData?.SavedChallenges)
        ? (snapData!.SavedChallenges as Challenge[])
        : [];
     if (serverList.some((c: any) => c?.id === challenge.id)) {
       // Miroir local si besoin
       if (!savedChallengesRef.current.some((c) => c.id === challenge.id)) {
         setSavedChallenges((prev) => [...prev, {
           id: challenge.id,
           title: challenge.title,
           category: challenge.category || null,
           description: challenge.description || null,
           imageUrl: challenge.imageUrl || null,
           daysOptions: (challenge.daysOptions?.length ? challenge.daysOptions : [7]),
           chatId: challenge.chatId || `chat_${challenge.id}`,
         }]);
       }
       return; // idempotent: pas d'incStat
     }
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
      // 🔒 MàJ locale optimiste + dédup + typage strict
 let nextLen = 0;
      setSavedChallenges((prev) => {
        const m = new Map<string, Challenge>(prev.map((c) => [c.id, c]));
        m.set(challengeData.id, challengeData);
        const arr = Array.from(m.values());
        nextLen = arr.length;
        return arr;
      });
      optimisticallyAdded = true;

      // 🗄️ Persistance (arrayUnion est idempotent côté Firestore si l'objet est identique)
      await updateDoc(userRef, { SavedChallenges: arrayUnion(challengeData) });

      // 📊 Buckets succès
      // 1) cumulatif (ne JAMAIS décrémenter) → déclenche les paliers achievements.saveChallenge
      try { await incStat(userId, "saveChallenge.total", 1); } catch {}
      // 2) courant (miroir du nombre actuel) → utile analytics/UI
      try { await updateDoc(userRef, { "stats.saveChallenge.current": nextLen }); } catch {}
      console.log("Challenge sauvegardé avec succès :", challengeData);
      scheduleAchievementsCheck(userId);
    } catch (error) {
      console.error("Erreur lors de l'ajout du défi :", error);
      // rollback seulement si on a optimistiquement ajouté
      if (optimisticallyAdded) {
        setSavedChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
      }
      throw error;
      } finally {
     inFlightAdd.current.delete(challenge.id);
    }
  };

  const removeChallenge = async (id: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("Aucun utilisateur connecté pour supprimer le défi.");
      throw new Error("Vous devez être connecté pour supprimer un défi.");
    }
    if (inFlightRemove.current.has(id)) return;
    inFlightRemove.current.add(id);
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedChallenges = (userData.SavedChallenges || []).filter(
          (challenge: Challenge) => challenge.id !== id
        );
        await updateDoc(userRef, { SavedChallenges: updatedChallenges });

        // ❌ On ne touche PAS au cumulatif (saveChallenge.total)
        // ✅ On met à jour seulement le courant (miroir)
        try {
          await updateDoc(userRef, {
            "stats.saveChallenge.current": updatedChallenges.length,
          });
        } catch {}
        console.log("Challenge retiré avec succès :", id);
        // MàJ locale immédiate
       const deduped: Challenge[] = Array.from(
   new Map((updatedChallenges as Challenge[]).map((c) => [c.id, c])).values()
 );
 setSavedChallenges(deduped);
      } else {
        console.log("Document utilisateur introuvable.");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du défi :", error);
      await loadSavedChallenges();
      throw error;
      } finally {
     inFlightRemove.current.delete(id);
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
