import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndSaveUserLocation } from "../services/locationService";
import { db } from "../constants/firebase-config";
import { collection, query, where, onSnapshot, doc, getDoc, runTransaction } from "firebase/firestore";
import { increment } from "firebase/firestore";


interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  checkingAuth: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      console.log("✅ Utilisateur connecté:", firebaseUser.email);
      setUser(firebaseUser);

      // ⚡️ LANCE EN FOND ➜ on ne bloque pas le Splash !
      AsyncStorage.setItem("user", JSON.stringify(firebaseUser)).catch((error) => {
        console.error("⚠️ Erreur sauvegarde AsyncStorage:", error);
      });

      fetchAndSaveUserLocation().catch((error) => {
        console.error("⚠️ Erreur localisation:", error);
      });
    } else {
      console.log("🔴 Aucun utilisateur connecté. Redirection vers login...");
      setUser(null);

      AsyncStorage.removeItem("user").catch((error) => {
        console.error("⚠️ Erreur retrait AsyncStorage:", error);
      });
    }

    // ✅ On passe loading à false TOUT DE SUITE !
    setLoading(false);
  });

  return () => unsubscribe();
}, []);

useEffect(() => {
  if (!user) return;

  const userId = user.uid;

  const invitationsQuery = query(
    collection(db, "invitations"),
    where("inviterId", "==", userId)
  );
  const treatedInvitations = new Set<string>();


  const unsubscribe = onSnapshot(invitationsQuery, async (snapshot) => {
  for (const docChange of snapshot.docChanges()) {
    const docId = docChange.doc.id;
    const data = docChange.doc.data();

    // ✅ On traite uniquement si statut devenu 'accepted' et jamais traité
    if (data.status === "accepted" && !treatedInvitations.has(docId)) {
      treatedInvitations.add(docId);

      const challengeId = data.challengeId;
      const inviteeId = data.inviteeId;
      const selectedDays = data.selectedDays;

      const alreadyExists = await checkChallengeAlreadyExists(userId, challengeId);
      if (!alreadyExists) {
        await addChallengeToUser(userId, challengeId, true, inviteeId, selectedDays);
        console.log("✅ Challenge duo injecté pour A (inviter).");
      }
    }
  }
});

  return () => unsubscribe();
}, [user]);


const checkChallengeAlreadyExists = async (userId: string, challengeId: string): Promise<boolean> => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const currentChallenges = userSnap.data()?.CurrentChallenges || [];
  return currentChallenges.some((c: any) => c.challengeId === challengeId);
};

const addChallengeToUser = async (
  userId: string,
  challengeId: string,
  isDuo: boolean,
  duoPartnerId: string,
  selectedDays: number
): Promise<void> => {
  const userRef = doc(db, "users", userId);
  const challengeRef = doc(db, "challenges", challengeId);

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    const challengeSnap = await tx.get(challengeRef);

    if (!userSnap.exists() || !challengeSnap.exists()) {
      throw new Error("Utilisateur ou challenge introuvable");
    }

    const userData = userSnap.data();
    const currentChallenges = userData.CurrentChallenges || [];

    const challengeData = challengeSnap.data();

    const fullChallengeData = {
      challengeId,
      id: challengeId,
      title: challengeData.title || "Challenge",
      description: challengeData.description || "",
      imageUrl: challengeData.imageUrl || "",
      chatId: challengeData.chatId || "",
      selectedDays,
      completedDays: 0,
      completionDates: [],
      lastMarkedDate: null,
      streak: 0,
      duo: isDuo,
      duoPartnerId,
      uniqueKey: `${challengeId}_${selectedDays}`,
    };

    // 🔁 Ajout ou update des challenges côté user
    tx.update(userRef, {
      CurrentChallenges: [...currentChallenges, fullChallengeData],
    });

    // 🔁 Ajout user dans usersTakingChallenge + incrément participantsCount si pas déjà dedans
    const currentUsers: string[] = challengeData.usersTakingChallenge || [];
    if (!currentUsers.includes(userId)) {
      tx.update(challengeRef, {
        usersTakingChallenge: [...currentUsers, userId],
        participantsCount: increment(1),
      });
    }
  });
};

  // Fonction de déconnexion
  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("❌ Erreur lors de la déconnexion:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, checkingAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
