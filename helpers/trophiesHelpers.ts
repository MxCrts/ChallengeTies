import { runTransaction, doc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

type TrophyAction =
  | "finishChallenge"
  | "selectChallengeDays"
  | "streakProgress"
  | "challengeCreated"
  | "messageSent"
  | "shareChallenge"
  | "inviteFriend"
  | "saveChallenge"
  | "profileCompleted"
  | "voteFeature"
  | "watchAdBoost"
  | "loginStreak"
  | "friendRequestSent"
  | "challengeCommented"
  | "challengeLiked"
  | "challengeJoined"
  | "other";

interface AwardOptions {
  action: TrophyAction;
  additionalParams?: { [key: string]: any };
  onTrophyEarned?: (achievement: string) => void;
}

/**
 * ✅ Ajoute un succès à l'utilisateur sans lui attribuer immédiatement les trophées.
 * 🔥 Il devra réclamer les trophées depuis l'UI (via le bouton "Réclamer").
 */
export async function addAchievement(options: AwardOptions) {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User doc not found.");

      const userData = userDoc.data() || {};
      let achievements: Set<string> = new Set(userData.achievements || []);
      let newAchievements: Set<string> = new Set(
        userData.newAchievements || []
      );

      let achievementUnlocked: string | undefined;

      switch (options.action) {
        case "challengeCreated":
          if (!achievements.has("challengeCreated")) {
            achievementUnlocked = "challengeCreated";
          }
          break;

        case "messageSent":
          if (!achievements.has("messageSent")) {
            achievementUnlocked = "messageSent";
          }
          break;

        case "profileCompleted":
          if (!achievements.has("profileCompleted")) {
            achievementUnlocked = "profileCompleted";
          }
          break;

        case "voteFeature":
          if (!achievements.has("voteFeature")) {
            achievementUnlocked = "voteFeature";
          }
          break;

        case "watchAdBoost":
          if (!achievements.has("watchAdBoost")) {
            achievementUnlocked = "watchAdBoost";
          }
          break;
      }

      if (achievementUnlocked) {
        newAchievements.add(achievementUnlocked);
        if (options.onTrophyEarned) options.onTrophyEarned(achievementUnlocked);
      }

      transaction.update(userRef, {
        achievements: Array.from(achievements),
        newAchievements: Array.from(newAchievements),
      });
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'ajout du succès :", err);
  }
}

/**
 * ✅ Permet de réclamer un succès et ses trophées après validation.
 */
export async function claimAchievement(
  achievementId: string,
  trophies: number
) {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User doc not found.");

      const userData = userDoc.data() || {};
      let trophiesTotal = userData.trophies || 0;
      let achievements: Set<string> = new Set(userData.achievements || []);
      let newAchievements: Set<string> = new Set(
        userData.newAchievements || []
      );

      // ✅ Vérifier si le succès peut être réclamé
      if (!newAchievements.has(achievementId)) return;

      // ✅ Ajouter le succès aux succès obtenus
      achievements.add(achievementId);
      newAchievements.delete(achievementId);
      trophiesTotal += trophies;

      transaction.update(userRef, {
        trophies: trophiesTotal,
        achievements: Array.from(achievements),
        newAchievements: Array.from(newAchievements),
      });
    });
  } catch (err) {
    console.error("❌ Erreur lors de la réclamation du succès :", err);
  }
}
