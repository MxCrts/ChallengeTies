import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { serverTimestamp } from "firebase/firestore";

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
    let userData: any = null;
    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return;
      userData = userDoc.data();
      __DEV__ && console.log("📢 Firestore Data (Avant update) :", userData);
      __DEV__ && console.log("📢 Succès déjà obtenus :", userData.achievements);
      __DEV__ && console.log("📢 Succès en attente :", userData.newAchievements);
    } catch (e: any) {
      __DEV__ && console.warn("[ProfileUpdate] getDoc error:", e?.message ?? e);
      return;
    }

    // 1) Détection standard (défensive + idempotente)
    //    checkForAchievements gère déjà first_connection / profile_completed
    //    et n'ajoute que dans newAchievements (pending).
    let unlockedByCheck: string[] = [];
    try {
      unlockedByCheck = await checkForAchievements(userId);
    } catch (e: any) {
      __DEV__ && console.warn("[ProfileUpdate] checkForAchievements error:", e?.message ?? e);
    }

    // 2) Forçage de garde (au cas où un champ serait manquant côté check)
    const achieved = new Set<string>(Array.isArray(userData.achievements) ? userData.achievements : []);
    const pending = new Set<string>(Array.isArray(userData.newAchievements) ? userData.newAchievements : []);
    const forced: string[] = [];

    if (!achieved.has("first_connection") && !pending.has("first_connection")) {
      forced.push("first_connection");
    }

    // ✅ "profile_completed" robuste (accepte interests string/array + mini longueurs)
    const canMarkProfileCompleted = isProfileCompleteServerSide(userData);
    const alreadyProfileCompleted =
      achieved.has("profile_completed") ||
      pending.has("profile_completed") ||
      userData?.profileCompleted === true ||
      userData?.stats?.profile?.completed === true;
    if (canMarkProfileCompleted && !alreadyProfileCompleted) {
      forced.push("profile_completed");
    }

    if (forced.length) {
      const patch: any = {
        newAchievements: arrayUnion(...forced),
      };

      // 🏁 Pose aussi les flags "profil complet" si applicable (idempotent)
      if (canMarkProfileCompleted) {
        patch.profileCompleted = true;
        patch["stats.profile.completed"] = true;
        if (!userData?.profileCompletedAt) {
          patch.profileCompletedAt = serverTimestamp();
        }
      }

      try {
        await updateDoc(userRef, patch);
        __DEV__ && console.log(`🔥 Succès forcés en pending : ${forced.join(", ")}`);
      } catch (e: any) {
        __DEV__ && console.warn("[ProfileUpdate] updateDoc forced error:", e?.message ?? e);
      }
    }

    // 3) Rien à claim ici.
    //    Les trophées sont crédités UNIQUEMENT via claimAchievement()
    //    dans TrophyModal pour éviter double attribution.
    if (unlockedByCheck.length || forced.length) {
      setProfileUpdated((prev) => !prev);
    }
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
