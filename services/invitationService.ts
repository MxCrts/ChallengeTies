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
  runTransaction,
  arrayUnion,
  increment,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { sendInvitationNotification } from "./notificationService";

/* =========================
 * Types & helpers de typage
 * ========================= */
type ServerTs = ReturnType<typeof serverTimestamp>;
type FireTs = Timestamp | ServerTs;

export interface Invitation {
  challengeId: string;
  inviterId: string;
  // open-invite: pas de destinataire avant acceptation
  inviteeId?: string | null;
  inviteeUsername?: string | null;
  selectedDays: number;
  status: "pending" | "accepted" | "refused";
  createdAt: FireTs | null;
  expiresAt: FireTs | null;
  acceptedAt?: FireTs | null;
  updatedAt?: FireTs | null;
  /** "open" = lien public ; "direct" = ancien modèle (rétro-compat) */
  kind?: "open" | "direct";
  /** Pour open-invite: trace optionnelle de refus "soft" par des utilisateurs */
  refusedBy?: string[];
}

interface Progress {
  userId: string;
  username: string;
  profileImage: string;
  progress: number;
  selectedDays: number;
}

type LangCode = "ar" | "de" | "es" | "en" | "fr" | "hi" | "it" | "ru" | "zh";

/* =========================
 * Constantes Deep Links
 * ========================= */
const CF_BASE = "https://europe-west1-challengeme-d7fef.cloudfunctions.net/dl";
const APP_SCHEME = "myapp";

/* =========================
 * Helpers
 * ========================= */
const invitationTTLdays = 7;

const nowTs = () => Timestamp.now();
const plusDays = (ts: Timestamp, days: number) =>
  Timestamp.fromMillis(ts.toMillis() + days * 24 * 60 * 60 * 1000);

const toStr = (v: unknown) => (v == null ? "" : String(v));
const isTs = (v: any): v is Timestamp =>
  !!v && typeof v?.toMillis === "function";

export function isInvitationExpired(inv: Invitation): boolean {
  if (!inv?.expiresAt) return true;
  // expiresAt peut être un FieldValue si tout juste écrit → on considère non expiré
  if (!isTs(inv.expiresAt)) return false;
  return inv.expiresAt.toMillis() < Timestamp.now().toMillis();
}

/** L’utilisateur a-t-il déjà ce challenge (entrée CurrentChallenges) ? */
async function userHasChallenge(userId: string, challengeId: string) {
  const uRef = doc(db, "users", userId);
  const uSnap = await getDoc(uRef);
  const current = (uSnap.data()?.CurrentChallenges ?? []) as any[];
  return current.some(
    (c) => c?.challengeId === challengeId || c?.id === challengeId
  );
}

/** Existe-t-il déjà une open-invite active pour (inviter, challenge) ? */
async function hasActiveOpenInvitationForInviter(
  challengeId: string,
  inviterId: string
): Promise<boolean> {
  const qy = query(
    collection(db, "invitations"),
    where("challengeId", "==", challengeId),
    where("inviterId", "==", inviterId),
    where("kind", "==", "open"),
    where("status", "in", ["pending", "accepted"])
  );
  const snap = await getDocs(qy);
  if (snap.empty) return false;
  return snap.docs.some((d) => {
    const data = d.data() as Invitation;
    return !isInvitationExpired(data);
  });
}

/* =========================
 * Liens universels (CF /dl)
 * ========================= */
export function buildUniversalInviteLink(opts: {
  challengeId: string;
  inviteId: string;
  selectedDays: number;
  lang?: LangCode;
  title?: string; // pour enrichir l’OG (anti-cache)
}) {
  const { challengeId, inviteId, selectedDays, lang = "fr", title = "" } = opts;
  const params = new URLSearchParams({
    id: challengeId,
    invite: inviteId,
    days: String(selectedDays),
    lang,
    v: String(Date.now()),
  });
  if (title) params.set("title", title);

  const universalUrl = `${CF_BASE}?${params.toString()}`;
  const appUrl = `${APP_SCHEME}://challenge-details/${encodeURIComponent(
    challengeId
  )}?invite=${encodeURIComponent(inviteId)}&days=${encodeURIComponent(
    String(selectedDays)
  )}`;

  return { universalUrl, appUrl };
}

/* =========================
 * API — Open Invites only
 * ========================= */

/** ➕ Crée une OPEN invite (pas de destinataire)
 *  NOTE: l’inviteur peut être en SOLO → autorisé.
 */
export async function createOpenInvitation(
  challengeId: string,
  selectedDays: number
): Promise<string> {
  const inviterId = auth.currentUser?.uid;
  if (!inviterId) throw new Error("Utilisateur non connecté");

  // Idempotence: une open-invite active par (inviter, challenge)
  if (await hasActiveOpenInvitationForInviter(challengeId, inviterId)) {
    throw new Error("invitation_already_active");
  }

  // Période de validité
  const created = nowTs();
  const expires = plusDays(created, invitationTTLdays);

  const ref = await addDoc(collection(db, "invitations"), {
    challengeId,
    inviterId,
    inviteeId: null,
    inviteeUsername: null,
    selectedDays,
    status: "pending",
    createdAt: serverTimestamp(),
    expiresAt: expires,
    kind: "open",
    refusedBy: [],
  } as Invitation);

  console.log("✅ Open invite créée :", ref.id);
  return ref.id;
}

/** ➕ Crée une OPEN invite + renvoie les liens prêts à partager */
export async function createOpenInvitationAndLink(opts: {
  challengeId: string;
  selectedDays: number;
  lang?: LangCode;
  title?: string;
}) {
  const { challengeId, selectedDays, lang = "fr", title = "" } = opts;

  const inviteId = await createOpenInvitation(challengeId, selectedDays);

  // Optionnel: enrichir l’OG avec le titre
  let ogTitle = title;
  if (!ogTitle) {
    try {
      const chSnap = await getDoc(doc(db, "challenges", challengeId));
      ogTitle = toStr(chSnap.data()?.title || "");
    } catch {
      /* ignore */
    }
  }

  const links = buildUniversalInviteLink({
    challengeId,
    inviteId,
    selectedDays,
    lang,
    title: ogTitle,
  });

  return { inviteId, ...links };
}

// ✅ Compat: alias pour l’UI existante (SendInvitationModal)
export async function createInvitationAndLink(opts: {
  challengeId: string;
  selectedDays: number;
  inviteeUsername?: string; // ignoré en "open"
  lang?: LangCode;
  title?: string;
}) {
  const { challengeId, selectedDays, lang = "fr", title = "" } = opts;
  return await createOpenInvitationAndLink({ challengeId, selectedDays, lang, title });
}

// ✅ Compat: certains écrans importent resetInviteeChallenge; on l’aligne sur le nom réel
export const resetInviteeChallenge = resetInviteeChallengeByUsername;

/** 🔎 Récupérer une invitation */
export async function getInvitation(inviteId: string): Promise<Invitation> {
  const ref = doc(db, "invitations", inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Invitation non trouvée");
  return snap.data() as Invitation;
}

/**
 * ✅ Accepter une invite (open ou direct ancien modèle)
 * - Vérifie expiration, auto-invite, droits (direct), etc.
 * - ⚠️ Solo → Duo : on reset **inviteur** et **invité** à 0 et on écrit une **entrée DUO** pour chacun,
 *   avec selectedDays = invitation.selectedDays et duoPartnerId réciproque.
 */
export async function acceptInvitation(inviteId: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Utilisateur non connecté");

  const invitationRef = doc(db, "invitations", inviteId);
  const invSnap = await getDoc(invitationRef);
  if (!invSnap.exists()) throw new Error("Invitation non trouvée");

  const invitation = invSnap.data() as Invitation;
  if (invitation.status !== "pending") throw new Error("déjà traitée");

  // Expiration → on marque refusée, puis on notifie erreur
  if (isInvitationExpired(invitation)) {
    await updateDoc(invitationRef, {
      status: "refused",
      updatedAt: serverTimestamp(),
    });
    throw new Error("expirée");
  }

  // Auto-invite interdit (l’inviteur ne peut pas accepter sa propre invite)
  if (invitation.inviterId === userId) {
    throw new Error("auto_invite");
  }

  // Direct (legacy) : seul l'invitee officiel peut accepter
  if (invitation.kind === "direct" && invitation.inviteeId && invitation.inviteeId !== userId) {
    throw new Error("non autorisé");
  }

  const inviteeRef = doc(db, "users", userId);
  const inviterRef = doc(db, "users", invitation.inviterId);
  const challengeRef = doc(db, "challenges", invitation.challengeId);

  await runTransaction(db, async (tx) => {
    // Challenge
    const chSnap = await tx.get(challengeRef);
    if (!chSnap.exists()) throw new Error("Challenge introuvable");
    const chData = chSnap.data();

    // Inviter user
    const inviterSnap = await tx.get(inviterRef);
    if (!inviterSnap.exists()) throw new Error("Inviteur introuvable");
    const inviterData = inviterSnap.data() as any;

    // Invitee user
    const inviteeSnap = await tx.get(inviteeRef);
    if (!inviteeSnap.exists()) throw new Error("Invité introuvable");
    const inviteeData = inviteeSnap.data() as any;

    // Helper: construit une entrée DUO propre
    const makeDuoEntry = (partnerId: string) => ({
      challengeId: invitation.challengeId,
      id: invitation.challengeId,
      title: chData.title || "Challenge",
      description: chData.description || "",
      imageUrl: chData.imageUrl || "",
      chatId: chData.chatId || "",
      selectedDays: invitation.selectedDays,
      completedDays: 0,
      completionDates: [],
      lastMarkedDate: null,
      streak: 0,
      duo: true,
      duoPartnerId: partnerId,
      uniqueKey: `${invitation.challengeId}_${invitation.selectedDays}`,
    });

    // Nettoie toute entrée existante (SOLO ou autre) pour ce challenge chez inviter & invitee
    const filterOutChallenge = (arr: any[] = []) =>
      (arr || []).filter(
        (c: any) => c?.challengeId !== invitation.challengeId && c?.id !== invitation.challengeId
      );

    const inviterCurrent = filterOutChallenge(inviterData?.CurrentChallenges);
    const inviteeCurrent = filterOutChallenge(inviteeData?.CurrentChallenges);

    // Nouvelles entrées DUO
    const inviterDuo = makeDuoEntry(userId);
    const inviteeDuo = makeDuoEntry(invitation.inviterId);

    // Participants: on ajoute les 2 si absents et on incrémente de façon exacte
    const prevUsers: string[] = Array.isArray((chData as any).usersTakingChallenge)
      ? (chData as any).usersTakingChallenge
      : [];
    const toAdd = [invitation.inviterId, userId].filter((uid) => !prevUsers.includes(uid));
    tx.update(challengeRef, {
      usersTakingChallenge: arrayUnion(invitation.inviterId, userId),
      participantsCount: increment(toAdd.length),
    });

    // Invitation → accepted (+ assignation pour open-invite)
    const patch: Partial<Invitation> = {
      status: "accepted",
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (invitation.kind === "open" && !invitation.inviteeId) {
      // on fige l’invité au moment de l’acceptation
      const inviteeUsername =
        (inviteeData?.username as string | undefined) || null;
      (patch as any).inviteeId = userId;
      (patch as any).inviteeUsername = inviteeUsername;
    }
    tx.update(invitationRef, patch);

    // Écritures profils — on écrase l’ancien SOLO par une seule entrée DUO propre
    tx.update(inviterRef, {
      CurrentChallenges: [...inviterCurrent, inviterDuo],
    });
    tx.update(inviteeRef, {
      invitedChallenges: arrayUnion(inviteId),
      CurrentChallenges: [...inviteeCurrent, inviteeDuo],
    });
  });

  // Notifier l’inviteur (si activé)
  try {
    const inviteeDoc = await getDoc(doc(db, "users", userId));
    const name =
      (inviteeDoc.exists() && (inviteeDoc.data() as any)?.username) ||
      "Quelqu’un";
    const inviterDoc = await getDoc(doc(db, "users", invitation.inviterId));
    if (
      inviterDoc.exists() &&
      (inviterDoc.data() as any)?.notificationsEnabled
    ) {
      await sendInvitationNotification(
        invitation.inviterId,
        `${name} a accepté ton invitation Duo !`
      );
    }
  } catch {
    /* noop */
  }

  console.log("✅ Invitation acceptée (reset solo → duo pour les 2).");
}

/**
 * ❌ Refuser une invite
 * - DIRECT (ancien modèle): on marque refusée + on peut supprimer.
 * - OPEN: on *n’efface pas* l’invite (elle peut être utilisée par quelqu’un d’autre) ;
 *         on enregistre juste un refus “soft” (refusedBy[]) et on notifie l’inviteur si tu veux.
 */
export async function refuseInvitation(inviteId: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Utilisateur non connecté");

  const invitationRef = doc(db, "invitations", inviteId);
  const invSnap = await getDoc(invitationRef);
  if (!invSnap.exists()) throw new Error("Invitation non trouvée");

  const invitation = invSnap.data() as Invitation;

  // Ancien modèle direct : seul le destinataire “officiel” peut refuser
  if (invitation.kind === "direct") {
    if (invitation.status !== "pending") throw new Error("déjà traitée");
    if (invitation.inviteeId !== userId) throw new Error("non autorisé");

    await updateDoc(invitationRef, {
      status: "refused",
      updatedAt: serverTimestamp(),
    });

    // Ici on supprime pour nettoyer (comportement existant)
    await deleteDoc(invitationRef);

    // Notif à l’inviteur
    try {
      const inviteeDoc = await getDoc(doc(db, "users", userId));
      const name =
        (inviteeDoc.exists() && (inviteeDoc.data() as any)?.username) ||
        "Quelqu’un";
      const inviterDoc = await getDoc(doc(db, "users", invitation.inviterId));
      if (
        inviterDoc.exists() &&
        (inviterDoc.data() as any)?.notificationsEnabled
      ) {
        await sendInvitationNotification(
          invitation.inviterId,
          `${name} a refusé ton invitation Duo.`
        );
      }
    } catch {
      /* noop */
    }

    console.log("❌ Invitation directe refusée :", { inviteId, userId });
    return;
  }

  // OPEN INVITE : refus “soft” (ne supprime pas l’invitation)
  await updateDoc(invitationRef, {
    refusedBy: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });

  console.log("ℹ️ Refus soft sur open-invite (conservée) :", {
    inviteId,
    userId,
  });
}

/** 📊 Progress DUO (uniquement invitations acceptées) */
export async function getInvitationProgress(
  inviteId: string
): Promise<Progress[]> {
  const invitationRef = doc(db, "invitations", inviteId);
  const snap = await getDoc(invitationRef);
  if (!snap.exists()) return [];
  const invitation = snap.data() as Invitation;
  if (invitation.status !== "accepted") return [];

  const progress: Progress[] = [];

  const add = async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    const data = userDoc.data() as any;
    const challenge = (data?.CurrentChallenges || []).find(
      (c: any) => c.challengeId === invitation.challengeId
    );
    progress.push({
      userId: uid,
      username: data?.username || "Inconnu",
      profileImage: data?.profileImage || "",
      progress: challenge?.completedDays || 0,
      selectedDays: challenge?.selectedDays || 0,
    });
  };

  await add(invitation.inviterId);
  const invitee = invitation.inviteeId || "";
  if (invitee) await add(invitee);

  console.log("📊 Progress DUO :", progress);
  return progress;
}

/* =========================
 * (Compat facultative) reset solo par username
 * ========================= */
export async function resetInviteeChallengeByUsername(
  challengeId: string,
  inviteeUsername: string
) {
  const qy = query(
    collection(db, "users"),
    where("username", "==", inviteeUsername.trim())
  );
  const snap = await getDocs(qy);
  if (snap.empty) throw new Error("Invité introuvable");
  const inviteeId = snap.docs[0].id;

  const userRef = doc(db, "users", inviteeId);
  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) return;
    const data = uSnap.data() as any;
    const filtered = (data.CurrentChallenges || []).filter(
      (c: any) => c.challengeId !== challengeId && c.id !== challengeId
    );
    tx.update(userRef, { CurrentChallenges: filtered });
  });
  console.log("✅ Reset solo (compat) pour", inviteeUsername);
}
