import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndSaveUserLocation } from "../services/locationService";
import { db } from "../constants/firebase-config";
import { collection, query, where, onSnapshot, doc, runTransaction, getDoc, } from "firebase/firestore";
import { increment } from "firebase/firestore";
import { setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { AppState, Platform  } from "react-native";
import {
  ensureAndroidChannelAsync,
  requestNotificationPermissions,
  registerForPushNotificationsAsync,
  sendReferralNewChildPush,
  sendInvitationNotification,
} from "@/services/notificationService";

import { logEvent } from "@/src/analytics";
import * as Linking from "expo-linking";
import { handleReferralUrl } from "@/services/referralLinking";
import { getDisplayUsername } from "@/services/invitationService";
import {
  checkAndGrantPioneerIfEligible,
  checkAndGrantAmbassadorRewards,
  checkAndGrantAmbassadorMilestones,
  checkAndNotifyReferralMilestones,
} from "../src/referral/pioneerChecker";



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
const REFERRAL_TROPHY_BONUS = 50; 
// 🔧 Mets ici le nombre de trophées que tu donnes réellement pour 1 filleul activé


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

            // 🔔 Notif parrain : "Vous êtes désormais le parrain de X"
            // 🔔 Notif parrain : "Vous êtes désormais le parrain de X"
try {
  const childUsername =
    (await getDisplayUsername(firebaseUser.uid)) ||
    firebaseUser.displayName ||
    (firebaseUser.email
      ? firebaseUser.email.split("@")[0]
      : "New user");

  const pushRes = await sendReferralNewChildPush({
    sponsorId: cleanRef,
    childUsername,
  });

  console.log(
    "[referral] sendReferralNewChildPush result:",
    pushRes
  );
} catch (e) {
  console.log(
    "[referral] sendReferralNewChildPush error (exception):",
    (e as any)?.message ?? e
  );
}

          }

        } catch (e) {
          console.log("[referral] activation post-login error:", e);
        }
      })();

// 🔥 Lancer tous les checks referral en tâche de fond
  (async () => {
    try {
      await Promise.all([
        checkAndGrantAmbassadorRewards(),
        checkAndGrantAmbassadorMilestones(),
        checkAndNotifyReferralMilestones(), // 🆕 nudge palier basé sur claimedMilestones
      ]);
    } catch (e) {
      console.log("[referral] global checks error:", e);
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

  // 💡 Pas de setup push sur web
  if (Platform.OS === "web") {
    console.log("🌐 Web environment → skip push setup");
    return;
  }

  let unsubAppState: (() => void) | undefined;
  let mounted = true;

  (async () => {
    try {
      // 1) Channel Android + permissions
      if (Platform.OS === "android") {
        await ensureAndroidChannelAsync();
      }

      const granted = await requestNotificationPermissions();
      console.log("🔔 Permission notifications (AuthProvider):", granted);

      if (!granted) {
        // On documente clairement le refus (optionnel)
        try {
          await updateDoc(doc(db, "users", uid), {
            notificationsEnabled: false,
            debugAuthProviderLastToken: null,
            expoPushToken: null,
          });
        } catch (e) {
          console.warn("⚠️ Impossible d'écrire le refus de notif:", e);
        }
        return;
      }

      // 2) Récupérer le token (idempotent) et l’écrire en base
      const token = await registerForPushNotificationsAsync();
      if (!mounted) return;

      console.log("🔔 Token from AuthProvider effect:", token);

      if (token) {
        await setDoc(
          doc(db, "users", uid),
          {
            expoPushToken: token,
            notificationsEnabled: true,
            expoPushUpdatedAt: new Date(),
            debugAuthProviderLastToken: token,
          },
          { merge: true }
        );
      }

      // 🔎 Vérification immédiate dans Firestore pour ce user
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : null;
        console.log("🔎 Firestore user push snapshot (AuthProvider):", {
          exists: snap.exists(),
          expoPushToken: data?.expoPushToken ?? null,
          notificationsEnabled: data?.notificationsEnabled ?? null,
        });
      } catch (e) {
        console.warn("⚠️ Impossible de relire le doc user après set token:", e);
      }

      // 3) Rafraîchir le token à chaque retour au foreground
      const sub = AppState.addEventListener("change", async (state) => {
        if (state !== "active") return;
        try {
          const refreshed = await registerForPushNotificationsAsync();
          console.log("🔁 Foreground refresh token:", refreshed);

          if (refreshed) {
            await updateDoc(doc(db, "users", uid), {
              expoPushToken: refreshed,
              notificationsEnabled: true,
              expoPushUpdatedAt: new Date(),
              debugAuthProviderLastToken: refreshed,
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
    try {
      unsubAppState?.();
    } catch {}
  };
}, [user?.uid]);

useEffect(() => {
  if (!user) return;
  const inviterId = user.uid;

  // 👉 L’invitateur écoute SES invitations ACCEPTÉES
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

      try {
        // 2️⃣ Notif locale immédiate pour l’invitateur (fallback simple)
        // On réutilise les mêmes clés i18n que pour le push distant :
        // notificationsPush.inviteAccepted.title / .body
        await sendInvitationNotification(inviterId, {
          titleKey: "notificationsPush.inviteAccepted.title",
          bodyKey: "notificationsPush.inviteAccepted.body",
          params: {
            username: data.inviteeUsername || "",
            // challengeTitle non stocké dans l’invitation → optionnel
            title: data.challengeTitle || "",
          },
          type: "invite-status",
        });
      } catch (e) {
        console.error(
          "❌ sendInvitationNotification (accepted) failed:",
          (e as any)?.message ?? e
        );
      }
    }
  });

  return () => unsubscribe();
}, [user?.uid]);

useEffect(() => {
  if (!user) return;
  const inviterId = user.uid;

  // 👉 L’invitateur écoute SES invitations REFUSÉES
  const qInvRefused = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("status", "==", "refused")
  );

  const treatedRefused = new Set<string>();

  const unsubscribe = onSnapshot(qInvRefused, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      const id = change.doc.id;
      const data = change.doc.data() as any;

      if (treatedRefused.has(id)) continue;

      treatedRefused.add(id);

      try {
        // Notif locale immédiate pour informer que l’invitation a été refusée
        await sendInvitationNotification(inviterId, {
          titleKey: "notificationsPush.inviteRefused.title",
          bodyKey: "notificationsPush.inviteRefused.body",
          params: {
            username: data.inviteeUsername || "",
            title: data.challengeTitle || "",
          },
          type: "invite-status",
        });
      } catch (e) {
        console.error(
          "❌ sendInvitationNotification (refused) failed:",
          (e as any)?.message ?? e
        );
      }
    }
  });

  return () => unsubscribe();
}, [user?.uid]);

useEffect(() => {
  if (!user) return;
  const uid = user.uid;

  const userRef = doc(db, "users", uid);

  let initialized = false;
  let prevActivatedCount: number | null = null;

  const unsubscribe = onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() as any;

    const activatedCount = Number(data?.referral?.activatedCount ?? 0);

    // 🧊 Premier snapshot : on initialise, PAS de notif
    if (!initialized) {
      initialized = true;
      prevActivatedCount = activatedCount;
      return;
    }

    // 1️⃣ Nouveau filleul activé (activatedCount ↑)
    if (
      prevActivatedCount === null ||
      activatedCount > prevActivatedCount
    ) {
      prevActivatedCount = activatedCount;

      try {
        await sendInvitationNotification(uid, {
          titleKey: "referral.notif.newChild.title",
          bodyKey: "referral.notif.newChild.body",
          params: {
            bonus: REFERRAL_TROPHY_BONUS,
            activatedCount,
          },
          type: "referral_new_child",
        });
      } catch (e) {
        console.error(
          "❌ sendInvitationNotification (newChild) failed:",
          (e as any)?.message ?? e
        );
      }
    } else {
      prevActivatedCount = activatedCount;
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
  if (!Number.isInteger(selectedDays) || selectedDays <= 0) return;

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
    const uniqueKey = `${challengeId}_${selectedDays}_${pair}`;

    const idx = list.findIndex((c: any) => {
      const cid = c?.challengeId ?? c?.id;
      return (c?.uniqueKey && c.uniqueKey === uniqueKey) || cid === challengeId;
    });

    const currentEntry = idx >= 0 ? list[idx] : null;

    const alreadyDuo =
      !!currentEntry?.duo &&
      (currentEntry?.duoPartnerId === inviteeId || !currentEntry?.duoPartnerId) &&
      (currentEntry?.selectedDays === selectedDays || !currentEntry?.selectedDays);

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
      selectedDays,
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
