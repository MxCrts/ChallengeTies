import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndSaveUserLocation } from "../services/locationService";
import { db } from "../constants/firebase-config";
import { collection, query, where, onSnapshot, doc, runTransaction } from "firebase/firestore";
import { increment } from "firebase/firestore";
import { setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { AppState, Platform  } from "react-native";
import {
  ensureAndroidChannelAsync,
  requestNotificationPermissions,
  registerForPushNotificationsAsync,
} from "@/services/notificationService";
import { logEvent } from "@/src/analytics";
import * as Linking from "expo-linking";
import { handleReferralUrl } from "@/services/referralLinking";
import { getDisplayUsername } from "@/services/invitationService";


// ✅ Ne laisse passer ici QUE les liens referral
const isReferralUrl = (url?: string | null) => {
  if (!url) return false;
  const u = url.toLowerCase();
  // adapte aux patterns exacts de tes referrals
  return (
    u.includes("/ref/") ||          // ex: challengeties.app/ref/xxx
    u.includes("refuid=") ||        // ex: ?refUid=xxx
    u.includes("ref=") ||           // ex: ?ref=xxx
    u.includes("ties_ref=")         // au cas où tu as un param custom
  );
};


const REFERRER_KEY = "ties_referrer_id";
const REFERRER_SRC_KEY = "ties_referrer_src";
const REFERRER_TS_KEY = "ties_referrer_ts";
const REFERRAL_JUST_ACTIVATED_KEY = "ties_referral_just_activated";

async function consumePendingReferrer(uid: string) {
  const [[, referrerId], [, src], [, ts]] = await AsyncStorage.multiGet([
    REFERRER_KEY,
    REFERRER_SRC_KEY,
    REFERRER_TS_KEY,
  ]);

  const cleanRef = String(referrerId ?? "").trim();
  const cleanSrc = String(src ?? "").trim() || "share";
  const cleanTs = Number(ts ?? 0);

  return { cleanRef, cleanSrc, cleanTs };
}

async function clearPendingReferrer() {
  await AsyncStorage.multiRemove([
    REFERRER_KEY,
    REFERRER_SRC_KEY,
    REFERRER_TS_KEY,
  ]);
}


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
    const referralHandledOnce = useRef(false);

      // ✅ Capture globale des liens referral (cold + warm start)
  useEffect(() => {
    if (referralHandledOnce.current) return;
    referralHandledOnce.current = true;

    let sub: any;

        (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log("🧊 [referral] initialUrl =", initialUrl);
        if (isReferralUrl(initialUrl)) {
          await handleReferralUrl(initialUrl);
        }

        sub = Linking.addEventListener("url", async ({ url }) => {
          console.log("🔥 [referral] event url =", url);
          if (isReferralUrl(url)) {
            await handleReferralUrl(url);
          }
        });
      } catch (e) {
        console.log("❌ [referral] global link capture error:", e);
      }
    })();


    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, []);


  useEffect(() => {
    let alive = true;
const authFailsafe = setTimeout(() => {
  if (!alive) return;
  setLoading(false);
  setCheckingAuth(false);
}, 3500);
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    clearTimeout(authFailsafe);
    if (firebaseUser) {
      console.log("✅ Utilisateur connecté:", firebaseUser.email);
      setUser(firebaseUser);

            // ✅ Referral activation post-login (flow principal)
      (async () => {
        try {
          const uid = firebaseUser.uid;
          const { cleanRef, cleanSrc } = await consumePendingReferrer(uid);

          if (!cleanRef) return; // pas de ref pending

          // ignore self-ref
          if (cleanRef === uid) {
            await clearPendingReferrer();
            return;
          }

          const userRef = doc(db, "users", uid);

          const activated = await runTransaction(db, async (tx) => {
            const uSnap = await tx.get(userRef);
            if (!uSnap.exists()) {
              // doc pas encore créé (peut arriver juste après register)
              // on laisse register créer le doc puis on retentera au prochain login
              return false;
            }

            const data = uSnap.data() as any;

            const alreadyHasReferrer =
              !!data?.referrerId ||
              !!data?.referral?.referrerId;

            const alreadyActivated =
              data?.activated === true ||
              data?.referralActivated === true;

            if (alreadyHasReferrer || alreadyActivated) {
              return false;
            }

            tx.update(userRef, {
              referrerId: cleanRef,
              activated: true,
              referralActivated: true, // tolérance compat fallback
              referral: {
                referrerId: cleanRef,
                src: cleanSrc,
                activatedAt: new Date(),
              },
              updatedAt: new Date(),
            });

            return true;
          });

          await clearPendingReferrer();

          if (activated) {
            // petit flag local si tu veux afficher un toast / reward UI
            await AsyncStorage.setItem(REFERRAL_JUST_ACTIVATED_KEY, "1");

            try {
              await logEvent("referral_activated", {
                referrerId: cleanRef,
                src: cleanSrc,
              });
            } catch {}
          }
        } catch (e) {
          console.log("[referral] activation post-login error:", e);
        }
      })();


      (async () => {
  try {
    const userRef = doc(db, "users", firebaseUser.uid);
    const counterRef = doc(db, "meta", "pioneerStats"); // ⚠️ lowercase 'pioneerStats'
    let pioneerJustGranted = false;

    await runTransaction(db, async (tx) => {
      const [cSnap, uSnap] = await Promise.all([tx.get(counterRef), tx.get(userRef)]);
      const already = uSnap.exists() && uSnap.data()?.pioneerRewardGranted === true;
      if (already) return;

      // IMPORTANT : ne JAMAIS faire "create puis update" dans la même transaction
      if (!cSnap.exists()) {
        // On initialise juste à 0 et on sort. Le prochain utilisateur déclenchera l'incrément.
        tx.set(counterRef, { count: 0 });
        return;
      }

      const current = cSnap.data()?.count ?? 0;
      const isPioneer = current < 1000;

      // Écritures utilisateur — doivent se faire en UNE seule écriture (conforme à tes rules)
      tx.set(
  userRef,
  {
    isPioneer: isPioneer,
    pioneerRewardGranted: isPioneer,
    trophies: isPioneer ? increment(50) : increment(0),
    updatedAt: new Date(),
  },
  { merge: true }
);

      if (isPioneer) {
        tx.update(counterRef, { count: current + 1 });
        pioneerJustGranted = true;
      }
    });

    if (pioneerJustGranted) {
      await AsyncStorage.setItem("pioneerJustGranted", "1");
    }
  } catch (err) {
    console.error("⚠️ Erreur attribution pionnier:", err);
  }
})();



     // ⚡️ LANCE EN FOND ➜ on ne bloque pas le Splash ! (version sérialisée)
AsyncStorage.setItem(
  "user",
  JSON.stringify({
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? null,
    displayName: firebaseUser.displayName ?? null,
  })
).catch((error) => {
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
    setCheckingAuth(false);

  });

  return () => {
  alive = false;
  clearTimeout(authFailsafe);
  unsubscribe();
};
}, []);

useEffect(() => {
  const uid = user?.uid;
  if (!uid) return;

  let unsubAppState: (() => void) | undefined;
  let mounted = true;

  (async () => {
    try {
      // 1) S’assurer du channel Android + permission
if (Platform.OS === "android") {
  await ensureAndroidChannelAsync();
}
      const granted = await requestNotificationPermissions();
      console.log("🔔 Permission notifications (AuthProvider):", granted);

      if (!granted) {
        // On ne force pas notificationsEnabled si refusé
        return;
      }

      // 2) Récupérer le token (idempotent) et l’écrire en base
      const token = await registerForPushNotificationsAsync();
if (!mounted) return;

// 🔎 DEBUG
console.log("🔔 Token from AuthProvider effect:", token);

if (token) {
  await setDoc(
    doc(db, "users", uid),
    {
      expoPushToken: token,
      notificationsEnabled: true,
      expoPushUpdatedAt: new Date(),
      debugAuthProviderLastToken: token, // 👈 trace debug
    },
    { merge: true }
  );
}


      // 3) Rafraîchir le token à chaque retour au foreground
      const sub = AppState.addEventListener("change", async (state) => {
        if (state !== "active") return;
        try {
          const refreshed = await registerForPushNotificationsAsync();
          console.log("🔁 Foreground refresh token:", refreshed); // 👈 DEBUG

if (refreshed) {
  await updateDoc(doc(db, "users", uid), {
    expoPushToken: refreshed,
    notificationsEnabled: true,
    expoPushUpdatedAt: new Date(),
    debugAuthProviderLastToken: refreshed, // 👈 trace debug
  });
}

        } catch (e) {
          console.warn("⚠️ Refresh expo token failed:", e);
        }
      });

      unsubAppState = () => sub.remove();
    } catch (e) {
      console.warn("ensure push setup failed:", e);
    }
  })();

  return () => {
    mounted = false;
    try { unsubAppState?.(); } catch {}
  };
}, [user?.uid]);

useEffect(() => {
  if (!user) return;
  const inviterId = user.uid;

  // 👉 L’invitateur écoute désormais SES invitations acceptées
  const qInv = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("status", "==", "accepted")
  );

  const treated = new Set<string>();

  const unsubscribe = onSnapshot(qInv, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      const id = change.doc.id;
      const data = change.doc.data() as any;

      if (treated.has(id)) continue;

      // sécurité : une invitation acceptée DOIT avoir un inviteeId
      if (!data.inviteeId) continue;

      treated.add(id);

      try {
        await ensureDuoMirrorForInviter({
          inviterId,
          challengeId: data.challengeId,
          inviteeId: data.inviteeId,
          selectedDays: data.selectedDays,
        });
      } catch (e) {
        console.error("❌ ensureDuoMirrorForInviter failed:", e);
      }
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

  // 🛡️ Sécurité absolue : on ne crée jamais un duo avec soi-même
  if (!inviterId || !challengeId || !inviteeId) return;
  if (inviterId === inviteeId) return;
  if (!Number.isInteger(selectedDays) || selectedDays <= 0) return;

  const userRef = doc(db, "users", inviterId);
  const challengeRef = doc(db, "challenges", challengeId);

  await runTransaction(db, async (tx) => {
    const [uSnap, cSnap] = await Promise.all([tx.get(userRef), tx.get(challengeRef)]);
    if (!uSnap.exists() || !cSnap.exists()) throw new Error("user/challenge introuvable");

    const uData = uSnap.data() as any;
    const cData = cSnap.data() as any;

    const list: any[] = Array.isArray(uData?.CurrentChallenges) ? uData.CurrentChallenges : [];
    const pair = [inviterId, inviteeId].sort().join("-");
const uniqueKey = `${challengeId}_${selectedDays}_${pair}`;

    // 1) État actuel côté inviter
    const idx = list.findIndex((c: any) => {
  const cid = c?.challengeId ?? c?.id;
  return (c?.uniqueKey && c.uniqueKey === uniqueKey) || cid === challengeId;
});

    const currentEntry = idx >= 0 ? list[idx] : null;
    const alreadyDuo =
      !!currentEntry?.duo &&
      (currentEntry?.duoPartnerId === inviteeId || !currentEntry?.duoPartnerId) &&
      (currentEntry?.selectedDays === selectedDays || !currentEntry?.selectedDays);

      // ✅ Si déjà DUO correct → on sort sans écrire (évite conflits)
    if (alreadyDuo) {
      return;
    }

    // 2) Construire l’entrée DUO cible
    const duoEntry = {
  challengeId,
  id: challengeId,
  title: cData.title || "Challenge",
  description: cData.description || "",
  imageUrl: cData.imageUrl || "",
  chatId: cData.chatId || challengeId,
  selectedDays,
  completedDays: 0,
  completionDates: [],
  lastMarkedDate: null,
  streak: 0,
  duo: true,
  duoPartnerId: inviteeId,
  duoPartnerUsername: await getDisplayUsername(inviteeId), // ⭐ OBLIGATOIRE
  uniqueKey,
};


    // 3) Prépare la nouvelle liste: remplace SOLO/ancienne entrée par DUO, ou append si absent
    let next: any[];
    if (idx >= 0) {
      next = [...list];
      next[idx] = { ...duoEntry };
    } else {
      next = [...list, duoEntry];
   }

    // 4) users/{inviterId}: n’écrit que si nécessaire (réduit les conflits + coûts)
    const mustWriteUser = next !== list;
    if (mustWriteUser) {
      tx.update(userRef, {
        CurrentChallenges: next,
        updatedAt: new Date(),
      });
    }

    // 5) challenges/{challengeId}: ajoute l’inviter dans usersTakingChallenge si manquant + count
    const users: string[] = Array.isArray(cData?.usersTakingChallenge) ? cData.usersTakingChallenge : [];
    const inviterAlreadyIn = users.includes(inviterId);

    if (!inviterAlreadyIn) {
      tx.update(challengeRef, {
        usersTakingChallenge: arrayUnion(inviterId),
        participantsCount: increment(1),
        updatedAt: new Date(),
      });
    } else {
      // on garde la cohérence des règles avec updatedAt sans toucher au reste
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
        await updateDoc(doc(db, "users", uid), { expoPushToken: null });
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
  <AuthContext.Provider value={{ user, setUser, loading, checkingAuth, logout }}>
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
