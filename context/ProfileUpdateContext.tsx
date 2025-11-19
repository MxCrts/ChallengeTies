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
import { serverTimestamp, type FieldValue } from "firebase/firestore";

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

  const parseInterests = (v: any): string[] =>
    Array.isArray(v)
      ? v.map((s) => String(s).trim()).filter(Boolean)
      : String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const isProfileCompleteServerSide = (userData: any): boolean => {
    const nameOk = String(userData?.displayName || "").trim().length >= 2;
    const bioOk = String(userData?.bio || "").trim().length >= 10;
    const locOk = String(userData?.location || "").trim().length >= 2;
    const picOk = !!String(userData?.profileImage || "").trim();
    const ints = parseInterests(userData?.interests);
    const interestOk = ints.length > 0;
    return nameOk && bioOk && locOk && picOk && interestOk;
  };

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

    // ✅ "profile_completed" robuste (accepte interests string/array + mini longueurs)
    const canMarkProfileCompleted = isProfileCompleteServerSide(userData);
    const alreadyProfileCompleted =
      userData?.achievements?.includes("profile_completed") ||
      userData?.newAchievements?.includes("profile_completed") ||
      userData?.profileCompleted === true ||
      userData?.stats?.profile?.completed === true;
    if (canMarkProfileCompleted && !alreadyProfileCompleted) {
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
    const patch: any = {
      newAchievements: arrayUnion(...newAchievements),
      achievements: arrayUnion(...newAchievements),
      trophies: increment(totalTrophies),
    };
    // 🏁 Pose aussi les flags "profil complet" si applicable (idempotent)
    if (canMarkProfileCompleted) {
      patch.profileCompleted = true;
      patch["stats.profile.completed"] = true;
      if (!userData?.profileCompletedAt) {
        patch.profileCompletedAt = serverTimestamp();
      }
    }
    await updateDoc(userRef, patch);

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
