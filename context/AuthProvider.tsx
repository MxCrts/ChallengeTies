import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndSaveUserLocation } from "../services/locationService";
import { db } from "@/constants/firebase-config";
import { collection, query, where, onSnapshot, doc, runTransaction, getDoc, serverTimestamp, setDoc  } from "firebase/firestore";
import { increment } from "firebase/firestore";
import { updateDoc, arrayUnion } from "firebase/firestore";
import { AppState, Platform  } from "react-native";
import {
  ensureAndroidChannelAsync,
  requestNotificationPermissions,
  registerForPushNotificationsAsync,
  scheduleDailyNotifications,
  scheduleLateReminderIfNeeded,
  rescheduleLateIfNeeded,
  rescheduleNextDailyIfNeeded,
} from "@/services/notificationService";
import { logEvent } from "@/src/analytics";
import { getDisplayUsername } from "@/services/invitationService";


// ✅ helpers (TOP LEVEL) : empêche la création d'un doc user "partiel"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForUserDoc(uid: string, tries = 60, delayMs = 300) {
  const ref = doc(db, "users", uid);
  for (let i = 0; i < tries; i++) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return true;
    } catch {}
    await sleep(delayMs);
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  checkingAuth: boolean;
  logout: () => Promise<void>;
  userDocReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userDocReady, setUserDocReady] = useState(false);
  // ✅ Dedupe refs (must be top-level hooks)
  const treatedAcceptedInvitesRef = useRef<Set<string>>(new Set());
  const treatedRefusedInvitesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
const authFailsafe = setTimeout(() => {
  if (!alive) return;
  setLoading(false);
  setCheckingAuth(false);
}, 3500);
  const unsubscribe = onAuthStateChanged(auth,async  (firebaseUser) => {
    clearTimeout(authFailsafe);
    if (firebaseUser) {
  console.log("✅ Utilisateur connecté:", firebaseUser.email);

  const uid = firebaseUser.uid;
  const userRef = doc(db, "users", uid);

  // ✅ IMPORTANT : on expose l'user tout de suite (évite freeze routing)
  setUser(firebaseUser);
  setUserDocReady(false);

  // ✅ On vérifie le doc en arrière-plan
  (async () => {
    try {
      let snap = await getDoc(userRef);

      if (!snap.exists()) {
        console.log("⏳ AuthProvider: userDoc absent → wait (register create)...");
        const ok = await waitForUserDoc(uid);

        if (!ok) {
          // ✅ FALLBACK : doc absent après timeout → on le crée plutôt que déconnecter
          console.log("⚠️ AuthProvider: doc absent après timeout → création fallback");
          try {
            await setDoc(doc(db, "users", uid), {
              uid,
              email: firebaseUser.email ?? "",
              username: firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "user",
              bio: "",
              location: "",
              profileImage: "",
              interests: [],
              achievements: [],
              newAchievements: ["first_connection"],
              trophies: 0,
              totalTrophies: 0,
              completedChallengesCount: 0,
              CompletedChallenges: [],
              SavedChallenges: [],
              customChallenges: [],
              CurrentChallenges: [],
              longestStreak: 0,
              language: "fr",
              locationEnabled: true,
              notificationsEnabled: false,
              country: "Unknown",
              region: "Unknown",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              isPioneer: false,
              pioneerRewardGranted: false,
            });
            console.log("✅ AuthProvider: doc fallback créé avec succès");
          } catch (fallbackErr) {
            // ✅ Si même le fallback échoue → là seulement on déconnecte
            console.log("❌ AuthProvider: fallback setDoc failed → logout:", fallbackErr);
            try { await signOut(auth); } catch {}
            if (!alive) return;
            setUser(null);
            setUserDocReady(false);
            return;
          }
        }

        snap = await getDoc(userRef);
      }

      if (!alive) return;

// ✅ MIGRATION HARD-SAFE : doc existe mais uid manquant → on le répare.
const data = (snap.data?.() ?? {}) as any;
if (!data?.uid) {
  try {
    await updateDoc(userRef, {
      uid,
      updatedAt: serverTimestamp(),
    });
    console.log("✅ AuthProvider: patched missing uid in userDoc.");
  } catch (e) {
    // fallback ultra safe (merge) si update refusé
    try {
      await setDoc(
        userRef,
        { uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
      console.log("✅ AuthProvider: patched missing uid via setDoc merge.");
    } catch (e2) {
      console.log("⚠️ AuthProvider: failed to patch missing uid:", e2);
    }
  }
}

console.log("👍 AuthProvider: userDoc détecté → OK.");
setUserDocReady(true);


      // ✅ À partir de là seulement : features “écriture” / heavy stuff
      // (referral / pioneer / location) en fond, sans bloquer UI
      setTimeout(() => {
        if (!alive) return;

        // --- Location (background)
        fetchAndSaveUserLocation().catch(() => {});
      }, 0);
    } catch (e) {
      console.log("⚠️ AuthProvider userDoc check error:", e);
      if (!alive) return;
      setUserDocReady(false);
      // on ne bloque pas l'app
    }
  })();
} else {
  console.log("🔴 Aucun utilisateur connecté. Redirection vers login...");
  setUser(null);
  setUserDocReady(false);

  AsyncStorage.removeItem("user").catch(() => {});
}
    // ✅ On passe loading à false TOUT DE SUITE !
    setLoading(false);
    setCheckingAuth(false);

  });

  return () => {
  alive = false;
  clearTimeout(authFailsafe);
  unsubscribe();
};
}, []);

// en haut du composant AuthProvider
const pushSetupUidRef = useRef<string | null>(null);

useEffect(() => {
  const uid = user?.uid;
  if (!uid) return;
  if (!userDocReady) return;
  if (Platform.OS === "web") {
    console.log("🌐 Web environment → skip push setup");
    return;
  }

  if (pushSetupUidRef.current === uid) return;
   pushSetupUidRef.current = uid;

  let mounted = true;
  let unsubAppState: (() => void) | undefined;

  const setupOnce = async () => {
    try {
      if (Platform.OS === "android") {
        await ensureAndroidChannelAsync();
      }

      const granted = await requestNotificationPermissions();
      console.log("🔔 Permission notifications (AuthProvider):", granted);

      if (!granted) {
        try {
          await updateDoc(doc(db, "users", uid), {
            notificationsEnabled: false,
            expoPushToken: null,
            expoPushTokens: [],
            expoPushUpdatedAt: new Date(),
          });
        } catch {}
        return;
      }

      // ✅ Token expo (idempotent)
      await registerForPushNotificationsAsync();
      if (!mounted) return;

      // ✅ Daily schedule (idempotent)
      await scheduleDailyNotifications();
      await scheduleLateReminderIfNeeded();

      // ✅ Foreground upkeep : daily safety ONLY
      const sub = AppState.addEventListener("change", async (state) => {
        if (state !== "active") return;

        try {
          await rescheduleNextDailyIfNeeded();
          await rescheduleLateIfNeeded();
          // 🔻 optionnel : évite de refresh token à chaque "active"
          // await registerForPushNotificationsAsync();
        } catch (e) {
          console.warn("⚠️ Foreground notifications upkeep failed:", e);
        }
      });

      unsubAppState = () => sub.remove();
    } catch (e) {
      console.warn("⚠️ ensure push setup failed:", e);
    }
  };

  setupOnce();

  return () => {
    mounted = false;
    try {
      unsubAppState?.();
    } catch {}
    if (pushSetupUidRef.current === uid) pushSetupUidRef.current = null;
  };
}, [user?.uid, userDocReady]);


useEffect(() => {
  if (!user) return;
  const inviterId = user.uid;

  // reset when user changes
  treatedAcceptedInvitesRef.current = new Set();

  // 👉 L’invitateur écoute SES invitations ACCEPTÉES
  const qInv = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("status", "==", "accepted")
  );

  const unsubscribe = onSnapshot(qInv, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added") continue;
      const id = change.doc.id;
      const data = change.doc.data() as any;

      if (treatedAcceptedInvitesRef.current.has(id)) continue;

      // sécurité : une invitation acceptée DOIT avoir un inviteeId
      if (!data.inviteeId) continue;

      treatedAcceptedInvitesRef.current.add(id);

      try {
        // 1️⃣ On s’assure que le duo est bien créé côté invitateur
        await ensureDuoMirrorForInviter({
          inviterId,
          challengeId: data.challengeId,
          inviteeId: data.inviteeId,
          selectedDays: data.selectedDays,
        });
      } catch (e) {
        console.error("❌ ensureDuoMirrorForInviter failed:", e);
      }

      // ❌ Plus AUCUNE notification locale ici.
      // ✅ Les notifs accept/refuse sont gérées uniquement par sendInviteStatusPush (Expo Push),
      //    déjà idempotent via AsyncStorage.
    }
  });

  return () => unsubscribe();
}, [user?.uid]);

useEffect(() => {
  if (!user) return;
  const inviterId = user.uid;

  treatedRefusedInvitesRef.current = new Set();

  // 👉 L’invitateur écoute SES invitations REFUSÉES
  const qInvRefused = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("status", "==", "refused")
  );

  const unsubscribe = onSnapshot(qInvRefused, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
       if (change.type !== "added") continue;
      const id = change.doc.id;
      const data = change.doc.data() as any;

      if (treatedRefusedInvitesRef.current.has(id)) continue;
       treatedRefusedInvitesRef.current.add(id);

      // ❌ On ne déclenche plus de notification locale ici.
      // Le push "refused" est déjà géré par sendInviteStatusPush côté invitee.
    }
  });

  return () => unsubscribe();
}, [user?.uid]);

// Remplace/insère l’entrée locale de l’invitateur par une entrée DUO propre et idempotente.
// - Si une entrée SOLO existe pour ce challenge => elle est remplacée
// - Si une entrée DUO existe déjà => on ne duplique pas
// - On maintient usersTakingChallenge/participantsCount de façon sûre (avec updatedAt pour coller aux rules)
const ensureDuoMirrorForInviter = async (opts: {
  inviterId: string;
  challengeId: string;
  inviteeId: string;
  selectedDays: number;
}) => {
  const { inviterId, challengeId, inviteeId, selectedDays } = opts;

  if (!inviterId || !challengeId || !inviteeId) return;
  if (inviterId === inviteeId) return;
  const days = Number(selectedDays);
if (!Number.isFinite(days) || !Number.isInteger(days) || days <= 0) return;


  // ✅ On récupère le username AVANT la transaction
  const partnerUsername = (await getDisplayUsername(inviteeId)) ?? null;

  const userRef = doc(db, "users", inviterId);
  const challengeRef = doc(db, "challenges", challengeId);

  await runTransaction(db, async (tx) => {
    const [uSnap, cSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(challengeRef),
    ]);
    if (!uSnap.exists() || !cSnap.exists()) {
      throw new Error("user/challenge introuvable");
    }

    const uData = uSnap.data() as any;
    const cData = cSnap.data() as any;

    const list: any[] = Array.isArray(uData?.CurrentChallenges)
      ? uData.CurrentChallenges
      : [];

    const pair = [inviterId, inviteeId].sort().join("-");
    const uniqueKey = `${challengeId}_${days}_${pair}`;

    const idx = list.findIndex((c: any) => {
      const cid = c?.challengeId ?? c?.id;
      return (c?.uniqueKey && c.uniqueKey === uniqueKey) || cid === challengeId;
    });

    const currentEntry = idx >= 0 ? list[idx] : null;

    const alreadyDuo =
      !!currentEntry?.duo &&
      (currentEntry?.duoPartnerId === inviteeId || !currentEntry?.duoPartnerId) &&
      (currentEntry?.selectedDays === days || !currentEntry?.selectedDays);

    if (alreadyDuo) {
      return;
    }

    const duoEntry = {
      challengeId,
      id: challengeId,
      title: cData.title || "Challenge",
      description: cData.description || "",
      imageUrl: cData.imageUrl || "",
      chatId: cData.chatId || challengeId,
      selectedDays: days,
      completedDays: 0,
      completionDates: [],
      completionDateKeys: [],
      lastMarkedDate: null,
      lastMarkedKey: null,
      streak: 0,
      duo: true,
      duoPartnerId: inviteeId,
      duoPartnerUsername: partnerUsername,
      uniqueKey,
    };

    let next: any[];
    if (idx >= 0) {
      next = [...list];
      next[idx] = { ...duoEntry };
    } else {
      next = [...list, duoEntry];
    }

    tx.update(userRef, {
      CurrentChallenges: next,
      updatedAt: new Date(),
    });

    const users: string[] = Array.isArray(cData?.usersTakingChallenge)
      ? cData.usersTakingChallenge
      : [];
    const inviterAlreadyIn = users.includes(inviterId);

    if (!inviterAlreadyIn) {
      tx.update(challengeRef, {
        usersTakingChallenge: arrayUnion(inviterId),
        participantsCount: increment(1),
        updatedAt: new Date(),
      });
    } else {
      tx.update(challengeRef, { updatedAt: new Date() });
    }
  });
};



  // Fonction de déconnexion
  const logout = async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      // On évite d’envoyer des push à cet appareil après déconnexion
      try {
        await updateDoc(doc(db, "users", uid), { expoPushToken: null,
          expoPushTokens: [],
         });
      } catch (e) {
        console.warn("⚠️ Impossible de nettoyer expoPushToken avant logout:", e);
      }
    }

    await signOut(auth);
    await AsyncStorage.removeItem("user");
    setUser(null);
  } catch (error) {
    console.error("❌ Erreur lors de la déconnexion:", error);
  }
};


  return (
  <AuthContext.Provider value={{ user, setUser, loading, checkingAuth, logout, userDocReady }}>
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
