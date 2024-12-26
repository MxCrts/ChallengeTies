import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import { initializeUserInFirestore } from "../services/userService";

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("Authenticated user:", firebaseUser);
        try {
          await initializeUserInFirestore(firebaseUser.uid);
          setUser({
            uid: firebaseUser.uid,
            isAnonymous: firebaseUser.isAnonymous,
          });
        } catch (error) {
          console.error("Error initializing Firestore user:", error);
        }
      } else {
        try {
          console.log("Signing in anonymously...");
          const result = await signInAnonymously(auth);
          console.log("Anonymous user signed in:", result.user);
          await initializeUserInFirestore(result.user.uid);
          setUser({
            uid: result.user.uid,
            isAnonymous: result.user.isAnonymous,
          });
        } catch (error) {
          console.error("Error signing in anonymously:", error);
        }
      }

      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, initializing };
}
