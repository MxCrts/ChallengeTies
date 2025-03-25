import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { achievementsList } from "../helpers/achievementsConfig";

interface ProfileUpdateContextProps {
  triggerProfileUpdate: () => Promise<void>;
  profileUpdated: boolean;
}

const ProfileUpdateContext = createContext<
  ProfileUpdateContextProps | undefined
>(undefined);

export const ProfileUpdateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [profileUpdated, setProfileUpdated] = useState(false);

  const triggerProfileUpdate = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    console.log("📢 Firestore Data (Avant update) :", userData);
    console.log("📢 Succès déjà obtenus :", userData.achievements);
    console.log("📢 Succès en attente :", userData.newAchievements);

    // Récupère les nouveaux succès via la vérification
    let newAchievements: string[] = await checkForAchievements(userId);

    // Forcer "first_connection" si non présent
    if (
      !userData.achievements?.includes("first_connection") &&
      !userData.newAchievements?.includes("first_connection")
    ) {
      newAchievements.push("first_connection");
    }

    // Forcer "profile_completed" si le profil semble complet
    // On s'assure ici que les champs attendus sont présents et, pour interests, qu'il s'agit d'un tableau non vide
    if (
      userData.bio &&
      userData.location &&
      userData.profileImage &&
      Array.isArray(userData.interests) &&
      userData.interests.length > 0 &&
      !userData.achievements?.includes("profile_completed") &&
      !userData.newAchievements?.includes("profile_completed")
    ) {
      newAchievements.push("profile_completed");
    }

    if (newAchievements.length === 0) return;

    // Si "first_connection" n'est pas déjà dans newAchievements, l'ajouter manuellement (optionnel)
    if (!userData.newAchievements?.includes("first_connection")) {
      await updateDoc(userRef, {
        newAchievements: arrayUnion("first_connection"),
      });
      console.log("🔥 Ajout manuel de 'first_connection' à Firestore !");
    }

    // Calcul du nombre total de trophées gagnés
    let totalTrophies = newAchievements.reduce((acc, achievementKey) => {
      Object.entries(achievementsList).forEach(([key, value]) => {
        if (typeof value === "object" && "name" in value && "points" in value) {
          if (achievementKey === key) {
            acc += value.points;
          }
        } else {
          Object.entries(value).forEach(([threshold, achievementData]) => {
            if (`${key}-${threshold}` === achievementKey) {
              acc += (achievementData as { name: string; points: number })
                .points;
            }
          });
        }
      });
      return acc;
    }, 0);

    // Met à jour Firestore avec les nouveaux succès et incrémente les trophées
    await updateDoc(userRef, {
      newAchievements: arrayUnion(...newAchievements),
      achievements: arrayUnion(...newAchievements),
      trophies: increment(totalTrophies),
    });

    console.log(
      `✅ Succès ajoutés: ${newAchievements.join(
        ", "
      )} | Trophées gagnés: ${totalTrophies}`
    );
    setProfileUpdated((prev) => !prev);
  };

  return (
    <ProfileUpdateContext.Provider
      value={{ triggerProfileUpdate, profileUpdated }}
    >
      {children}
    </ProfileUpdateContext.Provider>
  );
};

export const useProfileUpdate = () => {
  const context = useContext(ProfileUpdateContext);
  if (!context) {
    throw new Error(
      "❌ useProfileUpdate doit être utilisé à l'intérieur de ProfileUpdateProvider."
    );
  }
  return context;
};
