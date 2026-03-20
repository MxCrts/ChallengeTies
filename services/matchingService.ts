// services/matchingService.ts
// ✅ Matching Feature — Service Firestore top 1 mondial
// Push via Cloud Function (même pattern que sendDuoNudge)

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, auth, app } from "@/constants/firebase-config";
import { logEvent } from "@/src/analytics";
import { isInvitationExpired } from "./invitationService";
import { dayKeyUTC } from "@/hooks/useTrophiesEconomy";

const REGION = "europe-west1";

/* =========================
 * Types
 * ========================= */

export interface MatchingPoolEntry {
  uid: string;
  username: string;
  profileImage: string | null;
  region: string | null;
  completedChallengesCount: number;
  currentChallengeIds: string[];
  currentChallengeCategories: string[];
  challengeCategories: string[];
  duoAvailable: boolean;
  updatedAt: any;
}

export interface MatchCandidate {
  uid: string;
  username: string;
  profileImage: string | null;
  region: string | null;
  completedChallengesCount: number;
  matchScore: number;         // 3 = même challenge, 2 = même catégorie, 1 = dispo
  sharedCategory: string | null;
  hasSameChallenge: boolean;
}

export interface MatchingInvitation {
  challengeId: string;
  challengeTitle: string;
  selectedDays: number;
  inviterId: string;
  inviterUsername: string;
  inviterProfileImage: string | null;
  inviteeId: string;
  status: "pending" | "accepted" | "refused" | "cancelled";
  kind: "matching";
  createdAt: any;
  updatedAt: any;
  expiresAt: Timestamp;
}

/* =========================
 * Helpers internes
 * ========================= */

const concreteExpiry = (hours = 72) =>
  Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));

function extractSoloChallenges(currentChallenges: any[]): {
  ids: string[];
  categories: string[];
} {
  if (!Array.isArray(currentChallenges)) return { ids: [], categories: [] };
  const ids: string[] = [];
  const cats = new Set<string>();
  for (const c of currentChallenges) {
    const cid = c?.challengeId ?? c?.id;
    if (!cid || c?.duo) continue;
    const sel = Number(c?.selectedDays ?? 0);
    const done = Number(c?.completedDays ?? 0);
    if (sel > 0 && done >= sel) continue;
    ids.push(String(cid));
    if (c?.category) cats.add(String(c.category));
  }
  return { ids, categories: Array.from(cats) };
}

function countCompletedChallenges(
  currentChallenges: any[],
  completedChallenges: any[]
): number {
  let count = 0;
  if (Array.isArray(completedChallenges)) count += completedChallenges.length;
  if (Array.isArray(currentChallenges)) {
    for (const c of currentChallenges) {
      const sel = Number(c?.selectedDays ?? 0);
      const done = Number(c?.completedDays ?? 0);
      if (sel > 0 && done >= sel) count++;
    }
  }
  return count;
}

/* =========================
 * Cloud Function push
 * Même pattern que sendDuoNudge
 * ========================= */

type MatchingPushParams = {
  type: "matching_invite_received" | "matching_invite_accepted" | "matching_invite_refused";
  inviteeId: string;
  inviterId: string;
  inviterUsername: string;
  challengeTitle: string;
  challengeId: string;
  selectedDays: number;
  inviteId: string;
};

type MatchingPushResult = {
  ok: boolean;
  deduped?: boolean;
  reason?: string;
};

async function sendMatchingPush(params: MatchingPushParams): Promise<void> {
  try {
    const functions = getFunctions(app, REGION);
    const callable = httpsCallable<MatchingPushParams, MatchingPushResult>(
      functions,
      "sendMatchingPush"
    );
    await callable(params);
  } catch (e) {
    // Non-bloquant — la push n'est jamais critique
    console.warn("sendMatchingPush failed (non-bloquant):", e);
  }
}

/* =========================
 * UPDATE MATCHING POOL
 * Appelé quand : toggle duoAvailable, prise de challenge, fin de challenge
 * ========================= */
export async function updateMatchingPool(uid: string): Promise<void> {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return;

    const data = userSnap.data() as any;
    const { ids, categories } = extractSoloChallenges(data?.CurrentChallenges || []);
    const completedCount = countCompletedChallenges(
      data?.CurrentChallenges || [],
      data?.CompletedChallenges || []
    );

    const entry: Record<string, any> = {
      uid,
      username: data?.username || data?.displayName || "User",
      profileImage: data?.profileImage || null,
      region: data?.region || null,
      completedChallengesCount: completedCount,
      currentChallengeIds: ids,
      currentChallengeCategories: categories,
      challengeCategories: Array.isArray(data?.challengeCategories)
        ? data.challengeCategories
        : [],
      duoAvailable: data?.duoAvailable === true,
      updatedAt: serverTimestamp(),
    };

    // setDoc merge:true = upsert sans erreur si le doc n'existe pas
    await setDoc(doc(db, "matching_pool", uid), entry, { merge: true });
  } catch (e) {
    console.warn("updateMatchingPool failed (non-bloquant):", e);
  }
}

/* =========================
 * SET DUO AVAILABLE
 * Toggle dans le profil
 * ========================= */
export async function setDuoAvailable(uid: string, available: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    duoAvailable: available,
    updatedAt: serverTimestamp(),
  });
  await updateMatchingPool(uid);
}

/* =========================
 * FIND MATCHES
 * Algo 3 niveaux : même challengeId > même catégorie > même préférences
 * ========================= */
export async function findMatches(opts: {
  challengeId: string;
  challengeCategory: string | null;
  selectedDays: number;
  limit?: number;
}): Promise<MatchCandidate[]> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const limit = opts.limit ?? 10;

  const mySnap = await getDoc(doc(db, "users", me));
  const myData = mySnap.exists() ? (mySnap.data() as any) : {};
  const myCats: string[] = Array.isArray(myData?.challengeCategories)
    ? myData.challengeCategories
    : [];

  const poolSnap = await getDocs(
    query(collection(db, "matching_pool"), where("duoAvailable", "==", true))
  );

  const candidates: MatchCandidate[] = [];

  for (const poolDoc of poolSnap.docs) {
      const pool = poolDoc.data() as MatchingPoolEntry;
  if (pool.uid === me) continue;

  let score = 1; // ✅ TOUT LE MONDE est candidat par défaut
  let sharedCategory: string | null = null;
  let hasSameChallenge = false;

  if (pool.currentChallengeIds.includes(opts.challengeId)) {
    score = 3;
    hasSameChallenge = true;
    sharedCategory = opts.challengeCategory;
  } else if (
    opts.challengeCategory &&
    pool.currentChallengeCategories.includes(opts.challengeCategory)
  ) {
    score = 2;
    sharedCategory = opts.challengeCategory;
  } else if (
    opts.challengeCategory &&
    pool.challengeCategories.includes(opts.challengeCategory)
  ) {
    score = 1;
    sharedCategory = opts.challengeCategory;
  } else if (myCats.some((c) => pool.challengeCategories.includes(c))) {
    score = 1;
    sharedCategory = myCats.find((c) => pool.challengeCategories.includes(c)) || null;
  }

 candidates.push({
    uid: pool.uid,
    username: pool.username,
    profileImage: pool.profileImage,
    region: pool.region,
    completedChallengesCount: pool.completedChallengesCount,
    matchScore: score,
    sharedCategory,
    hasSameChallenge,
  });
}

  candidates.sort((a, b) =>
    b.matchScore !== a.matchScore
      ? b.matchScore - a.matchScore
      : b.completedChallengesCount - a.completedChallengesCount
  );

  return candidates.slice(0, limit);
}

/* =========================
 * SEND MATCHING INVITATION
 * Rate limit : 5/jour
 * Push vers l'invité via Cloud Function
 * ========================= */
export async function sendMatchingInvitation(opts: {
  inviteeId: string;
  challengeId: string;
  challengeTitle: string;
  selectedDays: number;
}): Promise<{ id: string }> {
  try {
    const me = auth.currentUser?.uid;
    if (!me) throw new Error("utilisateur non connecté");
    if (opts.inviteeId === me) throw new Error("auto_invite");

    const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0)));
    const rateLimitSnap = await getDocs(
      query(
        collection(db, "matching_invitations"),
        where("inviterId", "==", me),
        where("createdAt", ">=", todayStart)
      )
    );
    if (rateLimitSnap.size >= 5) throw new Error("rate_limit_exceeded");

    const existingSnap = await getDocs(
      query(
        collection(db, "matching_invitations"),
        where("inviterId", "==", me),
        where("inviteeId", "==", opts.inviteeId),
        where("challengeId", "==", opts.challengeId),
        where("status", "==", "pending")
      )
    );
    for (const d of existingSnap.docs) {
      const inv = d.data() as MatchingInvitation;
      if (!isInvitationExpired({ expiresAt: inv.expiresAt })) return { id: d.id };
    }

    const mySnap = await getDoc(doc(db, "users", me));
    const myData = mySnap.exists() ? (mySnap.data() as any) : {};
    const inviterUsername = myData?.username || myData?.displayName || "User";
    const inviterProfileImage = myData?.profileImage || null;

    const ref = await addDoc(collection(db, "matching_invitations"), {
      challengeId: opts.challengeId,
      challengeTitle: opts.challengeTitle,
      selectedDays: opts.selectedDays,
      inviterId: me,
      inviterUsername,
      inviterProfileImage,
      inviteeId: opts.inviteeId,
      status: "pending",
      kind: "matching",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: concreteExpiry(72),
    });

    sendMatchingPush({
      type: "matching_invite_received",
      inviteeId: opts.inviteeId,
      inviterId: me,
      inviterUsername,
      challengeTitle: opts.challengeTitle,
      challengeId: opts.challengeId,
      selectedDays: opts.selectedDays,
      inviteId: ref.id,
    }).catch(() => {});

    try {
      await logEvent("matching_invite_sent", {
        inviteId: ref.id,
        challengeId: opts.challengeId,
        inviteeId: opts.inviteeId,
      });
    } catch {}

    return { id: ref.id };

  } catch (e: any) {
    // ✅ LOG ICI — le vrai catch
    console.log("MATCHING SEND ERROR:", e?.message, e?.code, JSON.stringify(e));
    throw e;
  }
}

/* =========================
 * ACCEPT MATCHING INVITATION
 * Crée le duo pour les deux users (batch atomique)
 * ========================= */
export async function acceptMatchingInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const functions = getFunctions(app, "europe-west1");
  const callable = httpsCallable<{ inviteId: string }, { ok: boolean; reason?: string }>(
    functions,
    "acceptMatchingInvitation"
  );

  const result = await callable({ inviteId });

  if (!result.data?.ok) {
    const reason = result.data?.reason || "unknown";

    // Mapper les codes d'erreur vers des messages lisibles
    if (reason === "invitation_deja_traitee") throw new Error("invitation_deja_traitee");
    if (reason === "non_autorise") throw new Error("non_autorise");
    if (reason === "expired") throw new Error("expired");
    if (reason === "invitation_introuvable") throw new Error("invitation_introuvable");

    throw new Error(reason);
  }

  try {
    await logEvent("matching_invite_accepted", { inviteId });
  } catch {}
}

/* =========================
 * REFUSE MATCHING INVITATION
 * ========================= */
export async function refuseMatchingInvitation(inviteId: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error("utilisateur non connecté");

  const invRef = doc(db, "matching_invitations", inviteId);
  const snap = await getDoc(invRef);
  if (!snap.exists()) throw new Error("invitation_introuvable");

  const inv = snap.data() as MatchingInvitation;
  if (inv.inviteeId !== me) throw new Error("non_autorise");
  if (inv.status !== "pending") throw new Error("invitation_deja_traitee");

  await updateDoc(invRef, {
    status: "refused",
    updatedAt: serverTimestamp(),
  });

  try {
    await logEvent("matching_invite_refused", { inviteId, challengeId: inv.challengeId });
  } catch {}
}

/* =========================
 * GET INCOMING MATCHING INVITATIONS
 * Pour l'inbox dans le profil
 * ========================= */
export async function getIncomingMatchingInvitations(): Promise<
  Array<MatchingInvitation & { id: string }>
> {
  const me = auth.currentUser?.uid;
  if (!me) return [];

  const snap = await getDocs(
    query(
      collection(db, "matching_invitations"),
      where("inviteeId", "==", me),
      where("status", "==", "pending")
    )
  );

  return snap.docs
    .map((d) => ({ ...(d.data() as MatchingInvitation), id: d.id }))
    .filter((inv) => !isInvitationExpired({ expiresAt: inv.expiresAt }));
}
