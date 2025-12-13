// services/invitationService.ts
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { logEvent } from "../src/analytics";
import { sendInviteStatusPush } from "@/services/notificationService";
import { dayKeyUTC, coerceToDayKey } from "@/hooks/useTrophiesEconomy";


/* =========================
 * Types
 * ========================= */

// NOTE: logique actuelle (TOP 3 MONDE - OPEN ONLY côté app)
//
// - L'app NE CRÉE PLUS JAMAIS de "direct" → uniquement des OPEN INVITES via liens
// - Il peut encore rester des documents kind: "direct" dans Firestore (legacy)
//   → on les tolère côté lecture (acceptInvitation / refuseInvitationDirect)
//   → mais on n'en crée plus jamais depuis le front.
//
// Pour OPEN :
// - 1 seule invitation PENDING non expirée par (inviterId, challengeId)
// - Si OPEN PENDING non expirée existe → on la RÉUTILISE (idempotence)
// - Si des PENDING expirées existent → on les passe en "cancelled" avant

export type InvitationStatus = "pending" | "accepted" | "refused" | "cancelled";
// "direct" conservé uniquement pour compatibilité avec d'anciens documents
export type InvitationKind = "open" | "direct";

export interface Invitation {
  challengeId: string;
  inviterId: string;
  inviteeId: string | null;          // nullable pour OPEN
  inviteeUsername: string | null;    // nullable et optionnel
  selectedDays: number;
  status: InvitationStatus;          // "pending" à la création
  createdAt: any;                    // serverTimestamp() autorisé par les rules
  updatedAt?: any;
  acceptedAt?: any;
  expiresAt: Timestamp;              // ⚠️ DOIT être un Timestamp concret (rule)
  kind: InvitationKind;              // "open" | "direct" (legacy)
  refusedBy?: string[];              // liste d’uid (OPEN soft refuse)
}

/* =========================
 * Helpers
 * ========================= */

const concreteExpiry = (hours = 48) =>
  Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));

export function isInvitationExpired(inv?: { expiresAt?: Timestamp | null }) {
  if (!inv?.expiresAt) return false;
  const ms =
    inv.expiresAt instanceof Timestamp
      ? inv.expiresAt.toMillis()
      : Number(inv.expiresAt);
  return Number.isFinite(ms) && ms < Date.now();
}

// Vérifie si l'inviteur a déjà une invite PENDING pour ce challenge
// (OPEN ou DIRECT - utilisé surtout pour le legacy)
async function hasActiveInvite(params: {
  inviterId: string;
  challengeId: string;
}): Promise<boolean> {
  const baseQ = query(
    collection(db, "invitations"),
    where("inviterId", "==", params.inviterId),
    where("challengeId", "==", params.challengeId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(baseQ);
  if (snap.empty) return false;

  let hasNonExpired = false;
  const toCancel: Array<{ id: string }> = [];
  snap.forEach((d) => {
    const data = d.data() as Invitation;
    if (isInvitationExpired(data)) {
      toCancel.push({ id: d.id });
    } else {
      hasNonExpired = true;
    }
  });

  // Nettoyage opportuniste des expirées (les basculer en "cancelled")
  for (const it of toCancel) {
    try {
      await updateDoc(doc(db, "invitations", it.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    } catch {}
  }
  return hasNonExpired;
}

async function isUserAlreadyInActiveDuoForChallenge(
  userId: string,
  challengeId: string
): Promise<boolean> {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;
  const arr: any[] = Array.isArray(snap.data()?.CurrentChallenges)
    ? snap.data()!.CurrentChallenges
    : [];
  const found = arr.find((c) => {
    const cid = c?.challengeId ?? c?.id;
    const match =
      cid === challengeId || c?.uniqueKey?.startsWith?.(challengeId + "_");
    if (!match || !c?.duo) return false;
    const sel = Number(c?.selectedDays ?? 0);
    const done = Number(c?.completedDays ?? 0);
    return !sel || done < sel; // actif si pas d’info ou pas terminé
  });
  return !!found;
}

export async function getDisplayUsername(userId: string): Promise<string | null> {
  try {
    const uref = doc(db, "users", userId);
    const usnap = await getDoc(uref);
    if (!usnap.exists()) return null;
    const u = usnap.data() as any;
    return (
      u?.username ||
      u?.displayName ||
      (typeof u?.email === "string" ? u.email.split("@")[0] : null) ||
      null
    );
  } catch {
    return null;
  }
}

/* =========================
 * GET OR CREATE — OPEN (idempotent)
 *
 * - NE CRÉE JAMAIS DE DIRECT
 * - Réutilise une OPEN PENDING non expirée si présente
 * - Toutes les PENDING expirées (OPEN ou DIRECT) sont passées en "cancelled"
 * - Les DIRECT PENDING non expirées sont aussi annulées (legacy cleanup)
 * ========================= */
export async function getOrCreateOpenInvitation(
  challengeId: string,
  selectedDays: number
): Promise<{ id: string }> {
  const inviterId = auth.currentUser?.uid;
  if (!inviterId) throw new Error("utilisateur non connecté");
  if (!challengeId || !Number.isInteger(selectedDays) || selectedDays <= 0) {
    throw new Error("params_invalid");
  }

  // 🔒 ne pas autoriser d'invitation si déjà en DUO actif sur ce défi
  if (await isUserAlreadyInActiveDuoForChallenge(inviterId, challengeId)) {
    throw new Error("inviter_already_in_duo");
  }

  const qPend = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("challengeId", "==", challengeId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(qPend);

    let reusableOpen: string | null = null;
  const toCancel: string[] = [];

  snap.forEach((d) => {
    const inv = d.data() as Invitation;
    const expired = isInvitationExpired(inv);

    // Tout ce qui est expiré ou legacy DIRECT → on annule
    if (expired || inv.kind === "direct") {
      toCancel.push(d.id);
      return;
    }

    // OPEN encore valide
    if (inv.kind === "open") {
      // Si les selectedDays NE correspondent PAS à la valeur demandée
      // on annule aussi (on ne veut jamais réutiliser une invite 10 j
      // quand l'utilisateur a choisi 30 j, par exemple).
      if (inv.selectedDays !== selectedDays) {
        toCancel.push(d.id);
        return;
      }

      // Sinon, elle matche exactement → candidate à la réutilisation
      if (!reusableOpen) {
        reusableOpen = d.id;
      }
    }
  });


  // Cleanup des PENDING à annuler
  for (const id of toCancel) {
    try {
      await updateDoc(doc(db, "invitations", id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    } catch {}
  }

  // Réutilisation idempotente
  if (reusableOpen) {
    try {
      await logEvent("invite_reused", {
        inviteId: reusableOpen,
        challengeId,
        selectedDays,
        kind: "open",
      });
    } catch {}
    return { id: reusableOpen };
  }

  // Sinon, on crée une nouvelle OPEN
  const ref = await addDoc(
    collection(db, "invitations"),
    {
      challengeId,
      inviterId,
      inviteeId: null,
      inviteeUsername: null,
      selectedDays,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: concreteExpiry(48),
      kind: "open",
      refusedBy: [],
    } satisfies Invitation
  );

  try {
    await logEvent("invite_sent", {
      inviteId: ref.id,
      challengeId,
      selectedDays,
      kind: "open",
    });
  } catch {}

  return { id: ref.id };
}

/* =========================
 * CREATE — DIRECT (LEGACY – NE PLUS UTILISER)
 * ========================= */
/**
 * @deprecated
 * Le système d'invitations est désormais 100 % basé sur des OPEN INVITES
 * via lien. Cette fonction ne doit plus être utilisée. Elle throw pour
 * révéler tout appel oublié dans le code.
 */
export async function createDirectInvitation(_opts: {
  challengeId: string;
  selectedDays: number;
  inviteeId: string;
  inviteeUsername?: string | null;
}): Promise<{ id: string }> {
  throw new Error(
    "createDirectInvitation est deprecated : le système utilise uniquement des invitations 'open'."
  );
}

/* =========================
 * CREATE — OPEN (API SIMPLE)
 * → wrapper propre autour de getOrCreateOpenInvitation
 * ========================= */
export async function createInvitation(
  challengeId: string,
  selectedDays: number
): Promise<{ id: string }> {
  return getOrCreateOpenInvitation(challengeId, selectedDays);
}

/* =========================
 * LINK BUILDER — URL universelle (safe RN/Hermes)
 * ========================= */
export function buildUniversalLink(opts: {
  challengeId: string;
  inviteId: string;
  selectedDays: number;
  lang?: string;
  title?: string; // non requis; utile si tu veux l’ajouter à l’URL plus tard
}): string {
  const base = "https://links.challengeties.app/i";

  const entries: [string, string][] = [
    ["id", opts.challengeId],
    ["invite", opts.inviteId],
    ["days", String(opts.selectedDays)],
    ["lang", (opts.lang || "fr").toLowerCase()],
    ["v", String(Date.now())],
  ];

  const qs = entries
    .filter(([, v]) => typeof v === "string" && v.length > 0)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join("&");

  return `${base}?${qs}`;
}

/* =========================
 * CREATE — OPEN (+ lien universel)
 * ========================= */
export async function createOpenInvitationAndLink(opts: {
  challengeId: string;
  selectedDays: number;
  lang?: string; // pour construire l’URL seulement
  title?: string; // pour construire l’URL seulement
}): Promise<{ id: string; universalUrl: string }> {
  const { id } = await getOrCreateOpenInvitation(
    opts.challengeId,
    opts.selectedDays
  );
  const universalUrl = buildUniversalLink({
    challengeId: opts.challengeId,
    inviteId: id,
    selectedDays: opts.selectedDays,
    lang: opts.lang,
    title: opts.title,
  });
  return { id, universalUrl };
}

/* =========================
 * ACCEPT
 * - Respecte les rules:
 *   - OPEN: assigne inviteeId = me + status=accepted
 *   - DIRECT (legacy): status=accepted (invitee doit être me)
 *   - users/{me}: +1 CurrentChallenges (seulement me)
 *   - challenges/{id}: append self + participantsCount+1 (géré ailleurs)
 *   - + Push à l’inviteur (accepted)
 * ========================= */
export async function acceptInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const invitationRef = doc(db, "invitations", inviteId);

  // 1) Lire l'invitation
  const invSnap = await getDoc(invitationRef);
  if (!invSnap.exists()) throw new Error("invitation_introuvable");
  const inv = invSnap.data() as Invitation;

  // 2) Checks métier de base
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  if (isInvitationExpired(inv)) throw new Error("expired");

  if (inv.kind === "direct" && inv.inviteeId !== me) {
    throw new Error("non_autorise");
  }
  if (inv.kind === "open" && inv.inviterId === me) {
    throw new Error("auto_invite");
  }

  const inviterId = inv.inviterId;
  const inviteeId = inv.kind === "open" ? me : (inv.inviteeId as string);
  if (!inviteeId) throw new Error("invitee_invalide");

  const inviterRef = doc(db, "users", inviterId);
  const inviteeRef = doc(db, "users", inviteeId);
  const challengeRef = doc(db, "challenges", inv.challengeId);

  // 3) Lire user + challenge
  const [chSnap, inviterSnap, inviteeSnap] = await Promise.all([
    getDoc(challengeRef),
    getDoc(inviterRef),
    getDoc(inviteeRef),
  ]);

  if (!chSnap.exists()) throw new Error("challenge_introuvable");
  if (!inviterSnap.exists()) throw new Error("user_inviter_introuvable");
  if (!inviteeSnap.exists()) throw new Error("user_invitee_introuvable");

  const ch = chSnap.data() as any;
  const inviterData = inviterSnap.data() as any;
  const inviteeData = inviteeSnap.data() as any;

  // 4) Re-check duo actifs (côté métier)
  const isAlreadyDuo = (snapData: any) => {
    const arr: any[] = Array.isArray(snapData?.CurrentChallenges)
      ? snapData.CurrentChallenges
      : [];
    return !!arr.find((c: any) => {
      const cid = c?.challengeId ?? c?.id;
      const match =
        cid === inv.challengeId ||
        c?.uniqueKey?.startsWith?.(inv.challengeId + "_");
      if (!match || !c?.duo) return false;
      const sel = Number(c?.selectedDays ?? 0);
      const done = Number(c?.completedDays ?? 0);
      return !sel || done < sel; // actif = pas terminé
    });
  };

  if (isAlreadyDuo(inviterData)) throw new Error("inviter_already_in_duo");
  if (isAlreadyDuo(inviteeData)) throw new Error("invitee_already_in_duo");

  // 5) Usernames pour les deux
  const inviterUsernameFromUser =
    inviterData?.username ||
    inviterData?.displayName ||
    (typeof inviterData?.email === "string"
      ? inviterData.email.split("@")[0]
      : null) ||
    null;

  const inviteeUsernameFromUser =
    inviteeData?.username ||
    inviteeData?.displayName ||
    (typeof inviteeData?.email === "string"
      ? inviteeData.email.split("@")[0]
      : null) ||
    null;

  // 6) UPDATE 1 : invitation -> accepted (+ assignation inviteeId pour OPEN)
  const invUpdate: any = {
    status: "accepted",
    updatedAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
  };

  if (inv.kind === "open" && !inv.inviteeId) {
    invUpdate.inviteeId = inviteeId;
  }
  if (!inv.inviteeUsername && inviteeUsernameFromUser) {
    invUpdate.inviteeUsername = inviteeUsernameFromUser;
  }

  try {
    console.log(
      "[invite] acceptInvitation: tentative update invitation",
      inviteId
    );
    await updateDoc(invitationRef, invUpdate);
    console.log("[invite] acceptInvitation: invitation mise à jour OK");
  } catch (e) {
    console.log(
      "[invite] acceptInvitation: ERREUR update invitation",
      (e as any)?.message ?? e
    );
    throw e;
  }

      // 7) Construire / appliquer l'entrée DUO pour l'INVITÉ
  const baseInviteeList: any[] = Array.isArray(inviteeData?.CurrentChallenges)
    ? inviteeData.CurrentChallenges
    : [];

  // pairKey = toujours la même pour les 2 users, peu importe l'ordre
  const pairKey = [inviterId, inviteeId].sort().join("-");
  const uniqueKey = `${inv.challengeId}_${inv.selectedDays}_${pairKey}`;

  const now = new Date();

  // 🧱 Modèle "référence" DUO (qu'on va merge si une entrée existe déjà)
  const duoTemplate: any = {
    challengeId: inv.challengeId,
    id: inv.challengeId,
    title: ch.title || "Challenge",
    description: ch.description || "",
    imageUrl: ch.imageUrl || "",
    chatId: ch.chatId || inv.challengeId,
    selectedDays: inv.selectedDays,
    // completedDays / streak / dates peuvent être conservés si déjà présents
    completedDays: 0,
    completionDates: [],
    completionDateKeys: [],
    lastMarkedDate: null,
    lastMarkedKey: null,
    streak: 0,
    duo: true,
    duoPartnerId: inviterId,
    duoPartnerUsername: inviterUsernameFromUser ?? null,
    uniqueKey,
    startedAt: now.toISOString(),
    startedKey: dayKeyUTC(now),
    seasonal: !!ch.seasonal,
  };

  if (ch.slug) duoTemplate.slug = ch.slug;
  if (ch.category) duoTemplate.category = ch.category;
  if (ch.categoryId) duoTemplate.categoryId = ch.categoryId;

  // ✅ IMPORTANT: ne jamais matcher "startsWith(challengeId + '_')" car ça supprime aussi
  // d’autres défis dont l’id commence pareil. On supprime UNIQUEMENT le même challenge.
  const filteredInviteeList: any[] = [];
  for (const c of baseInviteeList) {
    const cid = c?.challengeId ?? c?.id;
    if (cid !== inv.challengeId) filteredInviteeList.push(c);
  }

  // ✅ On ajoute 1 seule entrée DUO propre avec uniqueKey "pair" (identique inviter/invitee)
  const finalInviteeChallenges = [...filteredInviteeList, duoTemplate];
  // 8) UPDATE : doc user de l'INVITÉ (toujours en DUO, 100 % sûr)
  try {
    console.log(
      "[invite] acceptInvitation: update CurrentChallenges pour",
      inviteeId
    );
    await updateDoc(inviteeRef, {
      CurrentChallenges: finalInviteeChallenges,
      updatedAt: serverTimestamp(),
    });
    console.log(
      "[invite] acceptInvitation: CurrentChallenges (invité) mis à jour OK"
    );
  } catch (e) {
    console.log(
      "[invite] acceptInvitation: ERREUR update CurrentChallenges invité",
      (e as any)?.message ?? e
    );
    throw e;
  }

// ✅ SAFETY: si une autre logique a ré-écrit derrière (race), on force le flag duo
  // sans toucher au reste (uniquement l’entrée "uniqueKey" qu’on vient d’ajouter).
  try {
    const afterSnap = await getDoc(inviteeRef);
    if (afterSnap.exists()) {
      const arr: any[] = Array.isArray(afterSnap.data()?.CurrentChallenges)
        ? afterSnap.data()!.CurrentChallenges
        : [];
      const idx = arr.findIndex((c) => c?.uniqueKey === uniqueKey);
      if (idx >= 0 && arr[idx]?.duo !== true) {
        const next = [...arr];
        next[idx] = {
          ...next[idx],
          duo: true,
          duoPartnerId: inviterId,
          duoPartnerUsername: inviterUsernameFromUser ?? null,
          uniqueKey,
        };
        await updateDoc(inviteeRef, { CurrentChallenges: next, updatedAt: serverTimestamp() });
      }
    }
  } catch {}

  // 9) Post-traitement : notif + analytics
  try {
    const finalInvSnap = await getDoc(invitationRef);
    const finalInv = finalInvSnap.data() as Invitation;

    let challengeTitle: string | undefined;
    try {
      const chSnap2 = await getDoc(challengeRef);
      if (chSnap2.exists()) {
        const ch2 = chSnap2.data() as any;
        challengeTitle = ch2?.title || undefined;
      }
    } catch {}

    const inviteeIdForNotif = finalInv.inviteeId ?? me;
    const inviteeUsernameFinal =
      finalInv.inviteeUsername ??
      (await getDisplayUsername(inviteeIdForNotif));

// 🔥 Fallback top 3 mondiale
    const safeUsername = inviteeUsernameFinal || "Partner";
    const safeChallengeTitle = challengeTitle || "Challenge";

        try {
            const pushRes = await sendInviteStatusPush({
        inviterId: finalInv.inviterId,
        inviteId, // 🔑 idempotence par invitation
        inviteeId: inviteeIdForNotif,
        status: "accepted",
        challengeId: finalInv.challengeId,
        challengeTitle: safeChallengeTitle,
        inviteeUsername: safeUsername,
      });


      console.log(
        "[notif] sendInviteStatusPush(accepted) result:",
        pushRes
      );
    } catch (e) {
      console.log(
        "[notif] sendInviteStatusPush(accepted) error (exception):",
        (e as any)?.message ?? e
      );
    }


    try {
      await logEvent("invite_accepted", {
        inviteId,
        challengeId: finalInv.challengeId,
        selectedDays: finalInv.selectedDays,
        kind: finalInv.kind,
        inviterId: finalInv.inviterId,
        inviteeId: finalInv.inviteeId ?? me,
      });
    } catch (e) {
      console.log(
        "[analytics] invite_accepted error:",
        (e as any)?.message ?? e
      );
    }
  } catch (e) {
    console.log(
      "[invite] acceptInvitation: erreur post-traitement (notif/analytics)",
      (e as any)?.message ?? e
    );
  }
}




/* =========================
 * REFUSE — DIRECT (invitee) — LEGACY
 * ========================= */
export async function refuseInvitationDirect(
  inviteId: string
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "direct") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  if (inv.inviteeId !== me) throw new Error("non_autorise");

  const inviteeUsername =
  inv.inviteeUsername ?? (await getDisplayUsername(me));

const safeUsername = inviteeUsername || "Partner";

await updateDoc(ref, {
  status: "refused",
  updatedAt: serverTimestamp(),
  ...(inviteeUsername ? { inviteeUsername } : {}),
});

try {
  let challengeTitle: string | undefined;
  try {
    const chSnap = await getDoc(doc(db, "challenges", inv.challengeId));
    if (chSnap.exists()) {
      const ch = chSnap.data() as any;
      challengeTitle = ch?.title || undefined;
    }
  } catch {}

  const safeChallengeTitle = challengeTitle || "Challenge";

   const pushRes = await sendInviteStatusPush({
    inviterId: inv.inviterId,
    inviteId, // 🔑 même id que dans la collection invitations
    inviteeId: me,
    status: "refused",
    challengeId: inv.challengeId,
    challengeTitle: safeChallengeTitle,
    inviteeUsername: safeUsername,
  });



    console.log(
      "[notif] sendInviteStatusPush(refused_direct) result:",
      pushRes
    );

    await logEvent("invite_refused", {
      inviteId,
      challengeId: inv.challengeId,
      kind: inv.kind,
      inviterId: inv.inviterId,
      inviteeId: me,
    });

  } catch (e) {
    console.log(
      "[notif/analytics] refuseInvitationDirect error:",
      (e as any)?.message ?? e
    );
  }
}

/* =========================
 * REFUSE — OPEN (soft) : refusedBy += me
 * ========================= */
export async function softRefuseOpenInvitation(
  inviteId: string
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "open") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  await updateDoc(ref, {
    refusedBy: arrayUnion(me),
    updatedAt: serverTimestamp(),
  });
}

/* =========================
 * REFUSE — OPEN (explicite) : set inviteeId = me + status=refused
 * - + Push à l’inviteur (refused)
 * ========================= */
export async function refuseOpenInvitation(
  inviteId: string
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "open") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");

  const inviteeUsername =
  inv.inviteeUsername ?? (await getDisplayUsername(me));

const safeUsername = inviteeUsername || "Partner";

await updateDoc(ref, {
  inviteeId: me,
  inviteeUsername: inviteeUsername ?? null,
  status: "refused",
  updatedAt: serverTimestamp(),
});

try {
  let challengeTitle: string | undefined;
  try {
    const chSnap = await getDoc(doc(db, "challenges", inv.challengeId));
    if (chSnap.exists()) {
      const ch = chSnap.data() as any;
      challengeTitle = ch?.title || undefined;
    }
  } catch {}

  const safeChallengeTitle = challengeTitle || "Challenge";

    const pushRes = await sendInviteStatusPush({
    inviterId: inv.inviterId,
    inviteId, // 🔑
    inviteeId: me,
    status: "refused",
    challengeId: inv.challengeId,
    challengeTitle: safeChallengeTitle,
    inviteeUsername: safeUsername,
  });



    console.log(
      "[notif] sendInviteStatusPush(refused_open) result:",
      pushRes
    );

    await logEvent("invite_refused", {
      inviteId,
      challengeId: inv.challengeId,
      kind: inv.kind,
      inviterId: inv.inviterId,
      inviteeId: me,
    });

  } catch (e) {
    console.log(
      "[notif/analytics] refuseOpenInvitation error:",
      (e as any)?.message ?? e
    );
  }
}

/* =========================
 * CANCEL — par l’inviter
 * ========================= */
export async function cancelInvitationByInviter(
  inviteId: string
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.inviterId !== me) throw new Error("non_autorise");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");

  await updateDoc(ref, {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
}

/* =========================
 * GET
 * ========================= */
export async function getInvitation(
  inviteId: string
): Promise<Invitation> {
  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  return snap.data() as Invitation;
}
