import config from "../config";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import {
  initializeUserInFirestore,
  initializeLeaderboardEntry,
} from "../services/userService";

interface AuthState {
  user: { uid: string } | null;
  initializing: boolean;
}

export function useAuthInit(): AuthState {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (config.DEVELOPMENT_MODE) {
      setUser(null);
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("Authenticated user:", firebaseUser);
        try {
          const email = firebaseUser.email || "unknown@noemail.com";
          const username = firebaseUser.displayName || "User";

          await initializeUserInFirestore(firebaseUser.uid, email, username);
          await initializeLeaderboardEntry(firebaseUser.uid, username);

          setUser({ uid: firebaseUser.uid });
        } catch (error) {
          console.error("Error initializing Firestore user:", error);
        }
      } else {
        setUser(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, initializing };
}
