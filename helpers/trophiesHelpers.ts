import {
  runTransaction,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../constants/firebase-config";
import { achievementsList } from "./achievementsConfig";

/**
 * Vérifie les succès atteints et les ajoute à `newAchievements` si débloqués.
 */
export async function checkForAchievements(userId: string): Promise<string[]> {
  if (!userId) return [];

  const userRef = doc(db, "users", userId);
  let newAchievements: string[] = [];

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User doc not found.");

      const userData = userDoc.data() || {};
      // On travaille ici avec des identifiants uniques
      const achieved: Set<string> = new Set(userData.achievements || []);
      const pending: Set<string> = new Set(userData.newAchievements || []);

      console.log("📢 Vérification des succès...");

      // Succès immédiats : première connexion
      if (
        !achieved.has("first_connection") &&
        !pending.has("first_connection")
      ) {
        pending.add("first_connection");
        newAchievements.push("first_connection");
      }

      // Succès pour un profil complété
      if (
        userData.bio &&
        userData.location &&
        userData.profileImage &&
        userData.interests?.length > 0 &&
        !achieved.has("profile_completed") &&
        !pending.has("profile_completed")
      ) {
        pending.add("profile_completed");
        newAchievements.push("profile_completed");
      }

      // Vérifier le succès lié aux défis terminés (finishChallenge)
      const finishedCount = Number(userData.completedChallengesCount || 0);
      Object.entries(achievementsList.finishChallenge).forEach(
        ([threshold, config]: [string, { name: string; points: number }]) => {
          const identifier = `finishChallenge_${threshold}`;
          if (
            finishedCount >= Number(threshold) &&
            !achieved.has(identifier) &&
            !pending.has(identifier)
          ) {
            pending.add(identifier);
            newAchievements.push(identifier);
          }
        }
      );

      // Récupérer tous les challenges actifs et terminés aujourd'hui
      const allChallenges = [
        ...(Array.isArray(userData.CurrentChallenges)
          ? userData.CurrentChallenges
          : []),
        ...(Array.isArray(userData.CompletedTodayChallenges)
          ? userData.CompletedTodayChallenges
          : []),
      ];

      // Succès liés à la durée sélectionnée d’un défi
      allChallenges.forEach((challenge: any) => {
        const duration = Number(challenge.selectedDays);
        if (achievementsList.selectChallengeDays.hasOwnProperty(duration)) {
          const identifier = `selectChallengeDays_${duration}`;
          if (!achieved.has(identifier) && !pending.has(identifier)) {
            pending.add(identifier);
            newAchievements.push(identifier);
          }
        }
      });

      // Succès liés aux streaks
      if (allChallenges.length > 0) {
        const maxStreak = Math.max(
          ...allChallenges.map((c: any) => Number(c.streak) || 0)
        );
        Object.entries(achievementsList.streakProgress).forEach(
          ([threshold, config]: [string, { name: string; points: number }]) => {
            const identifier = `streakProgress_${threshold}`;
            if (
              maxStreak >= Number(threshold) &&
              !achieved.has(identifier) &&
              !pending.has(identifier)
            ) {
              pending.add(identifier);
              newAchievements.push(identifier);
            }
          }
        );
      }

      // Vérification des autres catégories d'achievements
      Object.entries(achievementsList).forEach(
        ([category, thresholds]: any) => {
          if (
            category === "selectChallengeDays" ||
            category === "first_connection" ||
            category === "profile_completed" ||
            category === "streakProgress" ||
            category === "finishChallenge"
          )
            return;
          if (category === "challengeCreated") {
            // Pour les défis créés, on compte la longueur du tableau "createdChallenges"
            const createdCount = Array.isArray(userData.createdChallenges)
              ? userData.createdChallenges.length
              : 0;
            Object.entries(thresholds).forEach(([threshold, config]: any) => {
              const identifier = `${category}_${threshold}`;
              if (
                createdCount >= Number(threshold) &&
                !achieved.has(identifier) &&
                !pending.has(identifier)
              ) {
                pending.add(identifier);
                newAchievements.push(identifier);
              }
            });
          } else {
            Object.entries(thresholds).forEach(([threshold, config]: any) => {
              const identifier = `${category}_${threshold}`;
              if (
                userData[category] &&
                userData[category] >= Number(threshold) &&
                !achieved.has(identifier) &&
                !pending.has(identifier)
              ) {
                pending.add(identifier);
                newAchievements.push(identifier);
              }
            });
          }
        }
      );

      console.log("✅ Nouveaux succès détectés :", newAchievements);

      transaction.update(userRef, {
        newAchievements: Array.from(pending),
      });
    });

    return newAchievements;
  } catch (err) {
    console.error("❌ Erreur lors de la vérification des succès :", err);
    return [];
  }
}

/**
 * Ajoute un succès à l'utilisateur sans lui attribuer immédiatement les trophées.
 */
export async function addAchievement(userId: string) {
  if (!userId) return;
  await checkForAchievements(userId);
}

export async function deductTrophies(
  userId: string,
  amount: number
): Promise<boolean> {
  if (!userId) return false;
  const userRef = doc(db, "users", userId);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User doc not found.");
    const userData = userDoc.data();
    const currentTrophies = userData.trophies || 0;
    if (currentTrophies < amount) {
      console.warn("Not enough trophies");
      return false;
    }
    await updateDoc(userRef, {
      trophies: increment(-amount),
    });
    return true;
  } catch (error) {
    console.error("Error deducting trophies:", error);
    return false;
  }
}

/**
 * Permet de réclamer un succès et ses trophées après validation.
 */
export async function claimAchievement(
  userId: string,
  achievementId: string,
  isDoubleReward: boolean = false
) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User doc not found.");

    const userData = userDoc.data() || {};
    const pending: Set<string> = new Set(userData.newAchievements || []);
    const achieved: Set<string> = new Set(userData.achievements || []);

    if (!pending.has(achievementId)) {
      console.log("Succès déjà réclamé ou non disponible.");
      return;
    }

    let trophyPoints = 0;
    Object.entries(achievementsList).forEach(([key, data]: any) => {
      if (data && data.name && data.points) {
        if (key === achievementId) {
          trophyPoints = data.points;
        }
      } else if (typeof data === "object") {
        Object.entries(data).forEach(([threshold, config]: any) => {
          const identifier = `${key}_${threshold}`;
          if (identifier === achievementId) {
            trophyPoints = config.points;
          }
        });
      }
    });

    if (trophyPoints === 0) {
      console.warn(`⚠️ Aucun trophée trouvé pour ${achievementId}`);
    }

    const finalTrophies = isDoubleReward ? trophyPoints * 2 : trophyPoints;

    await updateDoc(userRef, {
      trophies: increment(finalTrophies),
      achievements: arrayUnion(achievementId),
      newAchievements: arrayRemove(achievementId),
    });

    console.log(
      `✅ Succès réclamé: ${achievementId} | Trophées ajoutés: ${finalTrophies}`
    );
  } catch (err) {
    console.error("❌ Erreur lors de la réclamation du succès :", err);
  }
}
