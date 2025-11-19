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
import { logEvent } from "../src/analytics";

/* =========================
 * Types
 * ========================= */

// NOTE: logique d'unicité
// - 1 seule invitation PENDING non expirée par (inviterId, challengeId)
// - Si OPEN PENDING non expirée existe → on la RÉUTILISE (idempotence)
// - Si seules des PENDING expirées existent → on les "cancelled" puis on crée une nouvelle OPEN
// - Si une DIRECT PENDING non expirée existe → on bloque (invitation_already_active)

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
  // Pas de transaction nécessaire ici; best-effort.
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

async function getDisplayUsername(userId: string): Promise<string | null> {
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
 * CREATE — DIRECT
 * ========================= */

export function isInvitationExpired(inv?: { expiresAt?: Timestamp | null }) {
  if (!inv?.expiresAt) return false;
  const ms = inv.expiresAt instanceof Timestamp ? inv.expiresAt.toMillis() : Number(inv.expiresAt);
  return Number.isFinite(ms) && ms < Date.now();
}

/* =========================
 * GET OR CREATE — OPEN (idempotent)
 * - Réutilise une OPEN PENDING non expirée si présente
 * - Annule les PENDING expirées trouvées
 * - S'il existe une DIRECT PENDING non expirée, lève "invitation_already_active"
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

  // Cherche toutes les PENDING (OPEN/DIRECT) pour l'inviteur sur ce challenge
  const qPend = query(
    collection(db, "invitations"),
    where("inviterId", "==", inviterId),
    where("challengeId", "==", challengeId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(qPend);

  let reusableOpen: string | null = null;
  let hasDirectPending = false;
  const expiredPendingIds: string[] = [];

  snap.forEach((d) => {
    const inv = d.data() as Invitation;
    const expired = isInvitationExpired(inv);
    if (expired) {
      expiredPendingIds.push(d.id);
      return;
    }
    if (inv.kind === "direct") {
      hasDirectPending = true;
    } else if (inv.kind === "open" && !reusableOpen) {
      // Première OPEN valide trouvée → réutilisable
      reusableOpen = d.id;
    }
  });

  // Annule les expirées opportunément
  for (const id of expiredPendingIds) {
    try {
      await updateDoc(doc(db, "invitations", id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    } catch {}
  }

  // Cas bloquant : une DIRECT valide existe déjà
  if (hasDirectPending) {
    throw new Error("invitation_already_active");
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
  const ref = await addDoc(collection(db, "invitations"), {
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
  } satisfies Invitation);

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
  if (await hasActiveInvite({ inviterId, challengeId: opts.challengeId })) {
    throw new Error("invitation_already_active");
  }

  // ❗ garde-fou : l’invité n’est pas déjà en duo actif sur ce challenge
  if (await isUserAlreadyInActiveDuoForChallenge(opts.inviteeId, opts.challengeId)) {
    throw new Error("invitee_already_in_duo");
  }

  const inviteeUsername =
  opts.inviteeUsername ?? (await getDisplayUsername(opts.inviteeId));

const ref = await addDoc(collection(db, "invitations"), {
  challengeId: opts.challengeId,
  inviterId,
  inviteeId: opts.inviteeId,
  inviteeUsername: inviteeUsername ?? null,   // 👈 toujours set si possible
  selectedDays: opts.selectedDays,
  status: "pending",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  expiresAt: concreteExpiry(48),
  kind: "direct",
  refusedBy: [],
} satisfies Invitation);


   try {
    await logEvent("invite_sent", {
      inviteId: ref.id,
      challengeId: opts.challengeId,
      selectedDays: opts.selectedDays,
      kind: "direct",
    });
  } catch (e) {
    console.log("[analytics] invite_sent (direct) error:", (e as any)?.message ?? e);
  }

  return { id: ref.id };
}

/* =========================
 * CREATE — OPEN (share-link) — API SIMPLE
 * ========================= */
export async function createInvitation(
  challengeId: string,
  selectedDays: number
): Promise<{ id: string }> {
  const inviterId = auth.currentUser?.uid;
  if (!inviterId) throw new Error("utilisateur non connecté");
  if (!challengeId || !Number.isInteger(selectedDays) || selectedDays <= 0) {
    throw new Error("params_invalid");
  }
  // anti-dup: une seule invite "pending" par challenge tant que non traitée
  if (await hasActiveInvite({ inviterId, challengeId })) {
    throw new Error("invitation_already_active");
  }

  const ref = await addDoc(collection(db, "invitations"), {
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
  } satisfies Invitation);

  try {
    await logEvent("invite_sent", {
      inviteId: ref.id,
      challengeId,
      selectedDays,
      kind: "open",
    });
  } catch (e) {
    console.log("[analytics] invite_sent (open) error:", (e as any)?.message ?? e);
  }

  return { id: ref.id };
}

/* =========================
 * LINK BUILDER — URL universelle propre
 * ========================= */
export function buildUniversalLink(opts: {
  challengeId: string;
  inviteId: string;
  selectedDays: number;
  lang?: string;
  title?: string; // non requis; utile si tu veux l’ajouter à l’URL plus tard
}): string {
  const base = "https://links.challengeties.app/i";
  const params = new URLSearchParams();
  params.set("id", opts.challengeId);
  params.set("invite", opts.inviteId);
  params.set("days", String(opts.selectedDays));
  params.set("lang", (opts.lang || "fr").toLowerCase());
  params.set("v", String(Date.now())); // cache-bust (previews)
  return `${base}?${params.toString()}`;
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
  // Back-compat wrapper (déconseillé) : utilise la nouvelle API
  const { id } = await createInvitation(opts.challengeId, opts.selectedDays);
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
 *   - DIRECT: status=accepted (invitee doit être me)
 *   - users/{me}: +1 CurrentChallenges (seulement me)
 *   - challenges/{id}: append self + participantsCount+1
 * ========================= */
export async function acceptInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const invitationRef = doc(db, "invitations", inviteId);

  await runTransaction(db, async (tx) => {
    // Re-lire dans la transaction (idempotence)
    const invSnap = await tx.get(invitationRef);
    if (!invSnap.exists()) throw new Error("invitation_introuvable");
    const inv = invSnap.data() as Invitation;

    // Statut & expiration (dans TX)
    if (inv.status !== "pending") throw new Error("invitation_deja_traitee");
    if (isInvitationExpired(inv)) throw new Error("expired");

    // Autorisation logique
    if (inv.kind === "direct" && inv.inviteeId !== me) throw new Error("non_autorise");
    if (inv.kind === "open" && inv.inviterId === me) throw new Error("auto_invite");

    const inviterId = inv.inviterId;
    const inviteeId = inv.kind === "open" ? me : (inv.inviteeId as string);
    if (!inviteeId) throw new Error("invitee_invalide");

    // Garde-fous duo actifs
    const inviterRef = doc(db, "users", inviterId);
    const inviteeRef = doc(db, "users", inviteeId);
    const challengeRef = doc(db, "challenges", inv.challengeId);

    const [chSnap, inviterSnap, inviteeSnap] = await Promise.all([
      tx.get(challengeRef),
      tx.get(inviterRef),
      tx.get(inviteeRef),
    ]);
    if (!chSnap.exists()) throw new Error("challenge_introuvable");
    if (!inviterSnap.exists()) throw new Error("user_inviter_introuvable");
    if (!inviteeSnap.exists()) throw new Error("user_invitee_introuvable");

    const ch = chSnap.data() as any;

    // Re-check duo actifs (côté lecture TX)
    const isAlreadyDuo = (snap: any) => {
      const arr: any[] = Array.isArray(snap?.CurrentChallenges) ? snap.CurrentChallenges : [];
      return !!arr.find((c: any) => {
        const cid = c?.challengeId ?? c?.id;
        const match = cid === inv.challengeId || c?.uniqueKey?.startsWith?.(inv.challengeId + "_");
        if (!match || !c?.duo) return false;
        const sel = Number(c?.selectedDays ?? 0);
        const done = Number(c?.completedDays ?? 0);
        return !sel || done < sel;
      });
    };
    const inviterData = inviterSnap.data();
    const inviteeData = inviteeSnap.data();
    if (isAlreadyDuo(inviterData)) throw new Error("inviter_already_in_duo");
    if (isAlreadyDuo(inviteeData)) throw new Error("invitee_already_in_duo");

    // Username pour notif & doc
    const inviteeUsername =
      inviteeData?.username ||
      inviteeData?.displayName ||
      (typeof inviteeData?.email === "string" ? inviteeData.email.split("@")[0] : null) ||
      null;

    // 1) Invitation -> accepted (+ OPEN: set inviteeId) (+ inviteeUsername si manquant)
    const invUpdate: any = {
      status: "accepted",
      updatedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
    };
    if (inv.kind === "open" && !inv.inviteeId) invUpdate.inviteeId = inviteeId;
    if (!inv.inviteeUsername && inviteeUsername) invUpdate.inviteeUsername = inviteeUsername;
    tx.update(invitationRef, invUpdate);

    // 2) uniqueKey stable
    const pairKey = [inviterId, inviteeId].sort().join("-");
    const uniqueKey = `${inv.challengeId}_${inv.selectedDays}_${pairKey}`;

    const makeDuoEntry = (selfId: string, partnerId: string) => ({
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
      duoPartnerId: partnerId,
      uniqueKey,
    });

    // 3) pour chaque user (reset solo/ancienne duo -> ajoute duo)
    for (const [selfRef, selfSnap, partnerId] of [
      [inviterRef, inviterSnap, inviteeId],
      [inviteeRef, inviteeSnap, inviterId],
    ] as const) {
      const data = selfSnap.data() as any;
      const list: any[] = Array.isArray(data?.CurrentChallenges) ? data.CurrentChallenges : [];
      const filtered = list.filter((c: any) => {
        const cid = c?.challengeId ?? c?.id;
        return cid !== inv.challengeId;
      });
      filtered.push(makeDuoEntry(selfRef.id, partnerId));
      tx.update(selfRef, {
        CurrentChallenges: filtered,
        updatedAt: serverTimestamp(),
      });
    }

    // 4) challenge global : n’ajoute que l’accepteur
    tx.update(challengeRef, {
      participantsCount: increment(1),
      usersTakingChallenge: arrayUnion(inviteeId),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    const finalInv = await getDoc(doc(db, "invitations", inviteId));
    const inv = finalInv.data() as Invitation;
    await logEvent("invite_accepted", {
      inviteId,
      challengeId: inv.challengeId,
      selectedDays: inv.selectedDays,
      kind: inv.kind,
      inviterId: inv.inviterId,
      inviteeId: inv.inviteeId ?? me,
    });
  } catch (e) {
    console.log("[analytics] invite_accepted error:", (e as any)?.message ?? e);
  }
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

  const inviteeUsername = inv.inviteeUsername ?? (await getDisplayUsername(me));

  await updateDoc(ref, {
    status: "refused",
    updatedAt: serverTimestamp(),
    ...(inviteeUsername ? { inviteeUsername } : {}),
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

  const inviteeUsername = inv.inviteeUsername ?? (await getDisplayUsername(me));

  await updateDoc(ref, {
    inviteeId: me,
    inviteeUsername: inviteeUsername ?? null,
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
