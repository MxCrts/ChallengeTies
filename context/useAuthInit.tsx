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
        // Initialize the user in Firestore
        try {
          await initializeUserInFirestore(firebaseUser.uid);
          setUser({
            uid: firebaseUser.uid,
            isAnonymous: firebaseUser.isAnonymous,
          });
        } catch (error) {
          console.error("Failed to initialize user in Firestore:", error);
        }
      } else {
        // No user is signed in; create an anonymous user
        try {
          const result = await signInAnonymously(auth);
          await initializeUserInFirestore(result.user.uid);
          setUser({
            uid: result.user.uid,
            isAnonymous: result.user.isAnonymous,
          });
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
        }
      }

      // Mark initialization complete
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, initializing };
}
