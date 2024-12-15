import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../constants/firebase-config";

/**
 * Ensures a user record exists in Firestore.
 * @param {string} uid - The user's unique ID.
 */
export const initializeUserInFirestore = async (uid) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // If no user document exists, create one with default values
      await setDoc(userDocRef, {
        displayName: "New User",
        bio: "This is my bio!",
        challengesCompleted: 0,
        challengesOngoing: 0,
        savedChallenges: [],
        currentChallenges: [],
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error initializing user in Firestore:", error);
    throw error;
  }
};
