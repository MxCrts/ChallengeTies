import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../constants/firebase-config";
import { awardTrophiesAndCheckAchievements } from "../helpers/trophiesHelpers";

/**
 * Initializes a user record in Firestore with default fields.
 * If it's brand-new, also awards a “first connection” bonus.
 *
 * @param {string} uid - The user's unique ID.
 * @param {string} email - User's email address.
 * @param {string} username - User's chosen username.
 */
export const initializeUserInFirestore = async (uid, email, username) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Create a new user document with default fields
      await setDoc(userDocRef, {
        email: email || "No email provided",
        username: username || "Anonymous",
        bio: "",
        location: "",
        profileImage: "",
        challengesTaken: [],
        challengesSaved: [],
        achievements: [],
        trophies: 0,
        completedChallengesCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Award "first connection" bonus
      await awardTrophiesAndCheckAchievements({
        action: "firstConnection",
        trophiesToAdd: 10, // Example
      });
    }
  } catch (error) {
    console.error("Error initializing user in Firestore:", error);
    throw error;
  }
};

/**
 * Initializes a leaderboard entry for a new user.
 *
 * @param {string} uid - The user's unique ID.
 * @param {string} username - The user's chosen username.
 */
export const initializeLeaderboardEntry = async (uid, username) => {
  try {
    const leaderboardDocRef = doc(db, "leaderboard", uid);
    const leaderboardDoc = await getDoc(leaderboardDocRef);

    if (!leaderboardDoc.exists()) {
      await setDoc(leaderboardDocRef, {
        username: username || "Anonymous",
        points: 0,
      });
    }
  } catch (error) {
    console.error("Error initializing leaderboard entry:", error);
    throw error;
  }
};

/**
 * Updates user information in Firestore.
 *
 * @param {string} uid - The user's unique ID.
 * @param {object} updates - Fields to update (e.g., bio, location).
 */
export const updateUserProfile = async (uid, updates) => {
  try {
    const userDocRef = doc(db, "users", uid);

    await updateDoc(userDocRef, updates);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

/**
 * Fetches user data from Firestore.
 *
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<object | null>} - The user data or null if not found.
 */
export const getUserData = async (uid) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
};
