// helpers/trophiesHelpers.ts

import { runTransaction, doc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

/**
 * The possible actions for awarding trophies
 */
type TrophyAction =
  | "finishChallenge"
  | "firstConnection"
  | "challengeCreated"
  | "mark3DayStreak"
  | "share"
  | "invite"
  | "saveChallenge"
  | "firstChatMessage"
  | "other"; // Expand as needed

interface AwardOptions {
  action: TrophyAction;
  trophiesToAdd: number;
  additionalParams?: {
    selectedDays?: number;
    [key: string]: any;
  };
}

/**
 * Awards trophies and checks achievements in a single Firestore transaction.
 *
 * Steps:
 * 1) Adds `trophiesToAdd` to the user's current trophy count.
 * 2) Depending on the `action`, awards bonus trophies & achievements.
 * 3) Cleans up duplicates and writes back to the user doc.
 */
export async function awardTrophiesAndCheckAchievements(
  options: AwardOptions
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.warn("No authenticated user. Aborting awarding trophies.");
    return;
  }

  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User doc not found.");
      }

      const userData = userDoc.data() || {};
      let trophies: number = userData.trophies || 0;
      let achievements: string[] = Array.isArray(userData.achievements)
        ? [...userData.achievements]
        : [];
      let completedChallengesCount: number =
        userData.completedChallengesCount || 0;

      // Always add the base trophies first
      trophies += options.trophiesToAdd;

      switch (options.action) {
        case "finishChallenge": {
          // “First challenge completed”
          if (!achievements.includes("First challenge completed")) {
            achievements.push("First challenge completed");
            trophies += 10;
          }
          // Increase completed challenge count
          completedChallengesCount += 1;

          // If it's a 30-day challenge => “30-day finisher”
          const days = options.additionalParams?.selectedDays || 0;
          if (days === 30 && !achievements.includes("30-day finisher")) {
            achievements.push("30-day finisher");
            trophies += 15;
          }

          // If completedChallengesCount === 10 => “10 challenges completed”
          if (
            completedChallengesCount === 10 &&
            !achievements.includes("10 challenges completed")
          ) {
            achievements.push("10 challenges completed");
            trophies += 20;
          }
          break;
        }

        case "firstConnection": {
          // If brand-new user => “First connection”
          if (!achievements.includes("First connection")) {
            achievements.push("First connection");
            trophies += 10;
          }
          break;
        }

        case "challengeCreated": {
          // “First challenge created”
          if (!achievements.includes("First challenge created")) {
            achievements.push("First challenge created");
            trophies += 5;
          }
          break;
        }

        case "mark3DayStreak": {
          // “3-day streak”
          if (!achievements.includes("3-day streak")) {
            achievements.push("3-day streak");
            trophies += 5;
          }
          break;
        }

        case "share": {
          // “Shared on Social” awarding
          if (!achievements.includes("Shared on Social")) {
            achievements.push("Shared on Social");
            trophies += 5;
          }
          break;
        }

        case "invite": {
          // awarding user for inviting friend
          trophies += 10;
          if (!achievements.includes("First friend invited")) {
            achievements.push("First friend invited");
          }
          break;
        }

        case "saveChallenge": {
          // “First challenge saved”
          if (!achievements.includes("First challenge saved")) {
            achievements.push("First challenge saved");
            trophies += 5;
          }
          break;
        }

        case "firstChatMessage": {
          if (!achievements.includes("First chat message")) {
            achievements.push("First chat message");
            trophies += 5; // or any amount you prefer
          }
          break;
        }

        case "other":
        default:
          // No additional achievements
          break;
      }

      // Remove duplicates from achievements array
      achievements = [...new Set(achievements)];

      // Write updated values back
      transaction.update(userRef, {
        trophies,
        achievements,
        completedChallengesCount,
      });
    });
  } catch (err) {
    console.error("Error awarding trophies:", err);
    throw err;
  }
}
