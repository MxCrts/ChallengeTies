import config from "../config";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import {
  initializeUserInFirestore,
  initializeLeaderboardEntry,
} from "../services/userService";

interface AuthState {
  user: {
    uid: string;
    isAnonymous: boolean;
  } | null;
  initializing: boolean;
}

export function useAuthInit(): AuthState {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (config.DEVELOPMENT_MODE) {
      // For testing purposes, simulate a logged-out state
      setUser(null);
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("Authenticated user:", firebaseUser);
        try {
          // Use placeholder email and username if they are not available
          const email = firebaseUser.email || "anonymous@noemail.com";
          const username = firebaseUser.displayName || "Anonymous";

          await initializeUserInFirestore(firebaseUser.uid, email, username);
          await initializeLeaderboardEntry(firebaseUser.uid, username);

          setUser({
            uid: firebaseUser.uid,
            isAnonymous: firebaseUser.isAnonymous,
          });
        } catch (error) {
          console.error(
            "Error initializing Firestore user or leaderboard entry:",
            error
          );
        }
      } else {
        try {
          console.log("Signing in anonymously...");
          const result = await signInAnonymously(auth);
          console.log("Anonymous user signed in:", result.user);

          // Provide default values for anonymous users
          await initializeUserInFirestore(
            result.user.uid,
            "anonymous@noemail.com",
            "Anonymous"
          );
          await initializeLeaderboardEntry(result.user.uid, "Anonymous");

          setUser({
            uid: result.user.uid,
            isAnonymous: result.user.isAnonymous,
          });
        } catch (error) {
          console.error(
            "Error signing in anonymously or initializing data:",
            error
          );
        }
      }

      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, initializing };
}
