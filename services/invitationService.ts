// services/invitationService.ts
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
  runTransaction,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";


/* =========================
 * Types
 * ========================= */
export type InvitationStatus = "pending" | "accepted" | "refused" | "cancelled";
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
  kind: InvitationKind;              // "open" | "direct"
  refusedBy?: string[];              // liste d’uid (OPEN soft refuse)
}

/* =========================
 * Helpers
 * ========================= */
const concreteExpiry = (hours = 48) =>
  Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));

async function hasActiveInvite(params: {
  inviterId: string;
  challengeId: string;
  selectedDays: number;
}): Promise<boolean> {
  const baseQ = query(
    collection(db, "invitations"),
    where("inviterId", "==", params.inviterId),
    where("challengeId", "==", params.challengeId),
    where("selectedDays", "==", params.selectedDays),
    where("status", "==", "pending")
  );
  const snap = await getDocs(baseQ);
  return !snap.empty;
}

async function isUserAlreadyInActiveDuoForChallenge(userId: string, challengeId: string): Promise<boolean> {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;
  const arr: any[] = Array.isArray(snap.data()?.CurrentChallenges) ? snap.data()!.CurrentChallenges : [];
  const found = arr.find((c) => {
    const cid = c?.challengeId ?? c?.id;
    const match = cid === challengeId || c?.uniqueKey?.startsWith?.(challengeId + "_");
    if (!match || !c?.duo) return false;
    const sel = Number(c?.selectedDays ?? 0);
    const done = Number(c?.completedDays ?? 0);
    return !sel || done < sel; // actif si pas d’info ou pas terminé
  });
  return !!found;
}


/* =========================
 * CREATE — DIRECT
 * ========================= */

export function isInvitationExpired(inv?: { expiresAt?: Timestamp | null }) {
  if (!inv?.expiresAt) return false;
  const ms = inv.expiresAt instanceof Timestamp ? inv.expiresAt.toMillis() : Number(inv.expiresAt);
  return Number.isFinite(ms) && ms < Date.now();
}

export async function createDirectInvitation(opts: {
  challengeId: string;
  selectedDays: number;
  inviteeId: string;
  inviteeUsername?: string | null;
}): Promise<{ id: string }> {
  const inviterId = auth.currentUser?.uid;
  if (!inviterId) throw new Error("utilisateur non connecté");
  if (!opts.challengeId || !Number.isInteger(opts.selectedDays) || opts.selectedDays <= 0) {
    throw new Error("params_invalid");
  }
  if (opts.inviteeId === inviterId) throw new Error("auto_invite");

  // anti-dup pour l’inviteur
  if (await hasActiveInvite({ inviterId, challengeId: opts.challengeId, selectedDays: opts.selectedDays })) {
    throw new Error("invitation_already_active");
  }

  // ❗ garde-fou : l’invité n’est pas déjà en duo actif sur ce challenge
  if (await isUserAlreadyInActiveDuoForChallenge(opts.inviteeId, opts.challengeId)) {
    throw new Error("invitee_already_in_duo");
  }

  const ref = await addDoc(collection(db, "invitations"), {
    challengeId: opts.challengeId,
    inviterId,
    inviteeId: opts.inviteeId,
    inviteeUsername: opts.inviteeUsername ?? null,
    selectedDays: opts.selectedDays,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: concreteExpiry(48),
    kind: "direct",
    refusedBy: [],
  } satisfies Invitation);

  return { id: ref.id };
}


/* =========================
 * CREATE — OPEN (+ lien universel)
 * ========================= */
export async function createOpenInvitationAndLink(opts: {
  challengeId: string;
  selectedDays: number;
  lang?: string;       // pour construire l’URL seulement
  title?: string;      // pour construire l’URL seulement
}): Promise<{ id: string; universalUrl: string }> {
  const inviterId = auth.currentUser?.uid;
  if (!inviterId) throw new Error("utilisateur non connecté");
  if (!opts.challengeId || !Number.isInteger(opts.selectedDays) || opts.selectedDays <= 0) {
    throw new Error("params_invalid");
  }

  // anti-dup open/direct pending
  if (await hasActiveInvite({ inviterId, challengeId: opts.challengeId, selectedDays: opts.selectedDays })) {
    throw new Error("invitation_already_active");
  }

  const ref = await addDoc(collection(db, "invitations"), {
    challengeId: opts.challengeId,
    inviterId,
    inviteeId: null,
    inviteeUsername: null,
    selectedDays: opts.selectedDays,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: concreteExpiry(48),
    kind: "open",
    refusedBy: [],
  } satisfies Invitation);

  // Lien universel (ne s’écrit PAS en base — juste retourné)
  const base = "https://europe-west1-challengeme-d7fef.cloudfunctions.net/dl";
  const params = new URLSearchParams({
    id: opts.challengeId,
    invite: ref.id,
    days: String(opts.selectedDays),
    lang: (opts.lang || "fr").toLowerCase(),
    v: String(Date.now()),
  });
  const universalUrl = `${base}?${params.toString()}`;

  return { id: ref.id, universalUrl };
}

/* =========================
 * ACCEPT
 * - Respecte les rules:
 *   - OPEN: assigne inviteeId = me + status=accepted
 *   - DIRECT: status=accepted (invitee doit être me)
 *   - users/{me}: +1 CurrentChallenges (seulement me)
 *   - challenges/{id}: append self + participantsCount+1
 * ========================= */
export async function acceptInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const invitationRef = doc(db, "invitations", inviteId);
  const invSnap = await getDoc(invitationRef);
  if (!invSnap.exists()) throw new Error("invitation_introuvable");

  const inv = invSnap.data() as Invitation;

  // Statut & expiration
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  if (isInvitationExpired(inv)) throw new Error("expired");

  // Autorisation logique
  if (inv.kind === "direct" && inv.inviteeId !== me) throw new Error("non_autorise");
  if (inv.kind === "open" && inv.inviterId === me) throw new Error("auto_invite");

  const inviterId = inv.inviterId;
  const inviteeId = inv.kind === "open" ? me : (inv.inviteeId as string);
  if (!inviteeId) throw new Error("invitee_invalide");

  // Garde-fous (lecture autorisée par tes rules)
  if (await isUserAlreadyInActiveDuoForChallenge(inviteeId, inv.challengeId)) {
    throw new Error("invitee_already_in_duo");
  }
  if (await isUserAlreadyInActiveDuoForChallenge(inviterId, inv.challengeId)) {
    // on empêche l’acceptation : l’inviteur est déjà en duo actif
    throw new Error("inviter_already_in_duo");
  }

  const challengeRef = doc(db, "challenges", inv.challengeId);
  const meRef = doc(db, "users", me);

  await runTransaction(db, async (tx) => {
    const chSnap = await tx.get(challengeRef);
    if (!chSnap.exists()) throw new Error("challenge_introuvable");
    const ch = chSnap.data() as any;

    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) throw new Error("user_introuvable");
    const meData = meSnap.data() as any;

    // 1) Invitation → accepted (+ OPEN: set inviteeId = me)
    const invUpdate: any = {
      status: "accepted",
      updatedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
    };
    if (inv.kind === "open" && !inv.inviteeId) {
      invUpdate.inviteeId = me;
    }
    tx.update(invitationRef, invUpdate);

    // 2) users/{me} → SOLO cleanup + DUO entry (miroir pour l’inviteur sera fait par son app)
    const meCurrent: any[] = Array.isArray(meData?.CurrentChallenges) ? meData.CurrentChallenges : [];
    const filtered = meCurrent.filter((c: any) => {
      const cid = c?.challengeId ?? c?.id;
      return cid !== inv.challengeId; // supprime SOLO/ancien pour ce challenge
    });

    // uniqueKey déterministe (pair triée) pour aider le miroir côté inviteur
    const pair = [inviterId, inviteeId].sort().join("-");
    const uniqueKey = `${inv.challengeId}_${inv.selectedDays}_${pair}`;

    const duoEntry = {
      challengeId: inv.challengeId,
      id: inv.challengeId,
      title: ch.title || "Challenge",
      description: ch.description || "",
      imageUrl: ch.imageUrl || "",
      chatId: ch.chatId || inv.challengeId,
      selectedDays: inv.selectedDays,
      completedDays: 0,
      completionDates: [],
      lastMarkedDate: null,
      streak: 0,
      duo: true,
      duoPartnerId: inviterId,  // partenaire = l’inviteur
      uniqueKey,
    };

    tx.update(meRef, {
      CurrentChallenges: [...filtered, duoEntry],
      updatedAt: serverTimestamp(),
    });

    // 3) challenges/{id} → append self uniquement (tes rules l’exigent)
    tx.update(challengeRef, {
      participantsCount: increment(1),
      usersTakingChallenge: arrayUnion(me),
      updatedAt: serverTimestamp(),
    });
  });
}


/* =========================
 * REFUSE — DIRECT (invitee)
 * ========================= */
export async function refuseInvitationDirect(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "direct") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  if (inv.inviteeId !== me) throw new Error("non_autorise");

  await updateDoc(ref, {
    status: "refused",
    updatedAt: serverTimestamp(),
  });
}

/* =========================
 * REFUSE — OPEN (soft) : refusedBy += me
 * ========================= */
export async function softRefuseOpenInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "open") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
  // rule 4) OPEN soft refuse: update { refusedBy: [...], updatedAt }
  await updateDoc(ref, {
    refusedBy: arrayUnion(me),
    updatedAt: serverTimestamp(),
  });
}

/* =========================
 * REFUSE — OPEN (explicite) : set inviteeId = me + status=refused
 * ========================= */
export async function refuseOpenInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  const inv = snap.data() as Invitation;

  if (inv.kind !== "open") throw new Error("type_incorrect");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");

  await updateDoc(ref, {
    inviteeId: me,       // conforme à la règle 1) OPEN accept/refuse
    status: "refused",
    updatedAt: serverTimestamp(),
  });
}

/* =========================
 * CANCEL — par l’inviter
 * ========================= */
export async function cancelInvitationByInviter(inviteId: string): Promise<void> {
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
export async function getInvitation(inviteId: string): Promise<Invitation> {
  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("invitation_introuvable");
  return snap.data() as Invitation;
}
