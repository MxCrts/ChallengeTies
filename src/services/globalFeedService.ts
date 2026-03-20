// src/services/globalFeedService.ts
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type FeedEventType = "completion" | "daily_mark" | "milestone";

export type FeedReactions = {
  fire: number;
  muscle: number;
  fireBy: string[];
  muscleBy: string[];
};

export type FeedEvent = {
  id: string;
  uid: string;
  username: string;
  avatarUrl: string | null;
  type: FeedEventType;
  challengeId: string;
  challengeTitle: string;
  payload: FeedPayload;
  createdAt: Date;
  feedPublic: boolean;
  reactions: FeedReactions;
};

export type FeedPayload = {
  // daily_mark
  streak?: number;
  completedDays?: number;
  selectedDays?: number;
  // milestone
  milestoneName?: string; // "day_7" | "day_30" | "day_100" | "pct_50" | "last_N"
  milestoneLabel?: string; // texte i18n-ready côté client
  // completion
  totalDays?: number;
  isDuo?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                            Storage keys                                    */
/* -------------------------------------------------------------------------- */

const FEED_OPT_OUT_KEY = "feed.optOut.v1"; // "1" = user has opted out

/* -------------------------------------------------------------------------- */
/*                          Opt-in / Opt-out                                  */
/* -------------------------------------------------------------------------- */

/** Retourne true si l'user partage sur le feed (défaut = OUI) */
export async function isFeedEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(FEED_OPT_OUT_KEY);
    return v !== "1";
  } catch {
    return true; // défaut = activé
  }
}

/** Désactive la participation au feed */
export async function disableFeed(): Promise<void> {
  await AsyncStorage.setItem(FEED_OPT_OUT_KEY, "1");
}

/** Réactive la participation au feed */
export async function enableFeed(): Promise<void> {
  await AsyncStorage.removeItem(FEED_OPT_OUT_KEY);
}

/* -------------------------------------------------------------------------- */
/*                       Anti-spam — 1 event / type / challenge / jour        */
/* -------------------------------------------------------------------------- */

const inFlightKeys = new Set<string>();

function feedSpamKey(type: FeedEventType, challengeId: string): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `feed.sent.${type}.${challengeId}.${day}`;
}

async function hasAlreadySentToday(
  type: FeedEventType,
  challengeId: string
): Promise<boolean> {
  const key = feedSpamKey(type, challengeId);
  // 1) mémoire
  if (inFlightKeys.has(key)) return true;
  // 2) persistant
  try {
    const v = await AsyncStorage.getItem(key);
    return v === "1";
  } catch {
    return false;
  }
}

async function markSentToday(
  type: FeedEventType,
  challengeId: string
): Promise<void> {
  const key = feedSpamKey(type, challengeId);
  inFlightKeys.add(key);
  try {
    await AsyncStorage.setItem(key, "1");
  } catch {}
}

/* -------------------------------------------------------------------------- */
/*                        Publish — fonction principale                        */
/* -------------------------------------------------------------------------- */

type PublishParams = {
  type: FeedEventType;
  challengeId: string;
  challengeTitle: string;
  payload: FeedPayload;
  /** Username résolu côté appelant (déjà dans le user doc Firestore) */
  username: string;
  /** URL avatar (peut être null) */
  avatarUrl?: string | null;
};

/**
 * Publie un événement dans le feed communautaire global.
 *
 * Appelé en `defer()` depuis CurrentChallengesContext — ne casse jamais le flow.
 *
 * Garde-fous :
 * - Opt-out global respecté
 * - 1 event / type / challenge / jour (anti-spam AsyncStorage)
 * - Pas de throw — toutes les erreurs sont silencieuses
 */
export async function publishToGlobalFeed(params: PublishParams): Promise<void> {
  try {
    
    const uid = auth.currentUser?.uid;
    if (!uid) { console.log("[globalFeed] ABORT: no uid"); return; }

    const enabled = await isFeedEnabled();
    if (!enabled) return;

    const already = await hasAlreadySentToday(params.type, params.challengeId);
    if (already) return;

    // Résolution du titre
    let finalTitle = params.challengeTitle;
    if (!finalTitle && params.challengeId) {
      try {
        const cSnap = await getDoc(doc(db, "challenges", params.challengeId));
        if (cSnap.exists()) finalTitle = String(cSnap.data().title || "");
      } catch (e) { console.log("[globalFeed] title resolve error:", e); }
    }
    if (!finalTitle) { console.log("[globalFeed] ABORT: no title"); return; }

    // Marque AVANT l'écriture (lock mémoire immédiat)
    const spamKey = feedSpamKey(params.type, params.challengeId);
    inFlightKeys.add(spamKey);

    await addDoc(collection(db, "globalFeed"), {
      uid,
      username:       params.username,
      avatarUrl:      params.avatarUrl ?? null,
      type:           params.type,
      challengeId:    params.challengeId,
      challengeTitle: finalTitle,
      payload:        params.payload,
      feedPublic:     true,
      createdAt:      serverTimestamp(),
      reactions:      { fire: 0, muscle: 0, fireBy: [], muscleBy: [] },
    });

    // Marque en persistant (après succès Firestore)
    try {
      await AsyncStorage.setItem(spamKey, "1");
    } catch {}

  } catch (e) {
    __DEV__ && console.warn("[globalFeed] publish error:", e);
    // Silencieux — ne casse jamais le flow markToday/completeChallenge
  }
}

/* -------------------------------------------------------------------------- */
/*                           Read — infinite scroll                            */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                         Réactions (🔥 / 💪)                                */
/* -------------------------------------------------------------------------- */

export type ReactionType = "fire" | "muscle";

/**
 * Ajoute ou retire une réaction sur un event du feed.
 * Toggle : si déjà voté → retire. Sinon → ajoute.
 * Retourne le nouveau state local (optimistic update côté UI).
 */
export async function addReaction(
  eventId: string,
  reaction: ReactionType,
  eventOwnerId: string,
  onReacted?: (ownerId: string, reaction: ReactionType, fromUid: string) => void,
): Promise<FeedReactions | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const ref = doc(db, "globalFeed", eventId);

  try {
    let newReactions: FeedReactions | null = null;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      const existing: FeedReactions = data.reactions ?? {
        fire: 0, muscle: 0, fireBy: [], muscleBy: [],
      };

      const byKey   = reaction === "fire" ? "fireBy"   : "muscleBy";
      const countKey = reaction === "fire" ? "fire"     : "muscle";
      const already = (existing[byKey] as string[]).includes(uid);

      const newBy = already
        ? (existing[byKey] as string[]).filter((u) => u !== uid)
        : [...(existing[byKey] as string[]), uid];

      newReactions = {
        ...existing,
        [byKey]:    newBy,
        [countKey]: Math.max(0, already ? existing[countKey] - 1 : existing[countKey] + 1),
      };

      tx.update(ref, { reactions: newReactions });
    });

    // Notif push à l'owner si c'est un ajout (pas un retrait) et ce n'est pas soi-même
    if (newReactions && uid !== eventOwnerId && onReacted) {
      const byKey = reaction === "fire" ? "fireBy" : "muscleBy";
      const isAdd = (newReactions[byKey] as string[]).includes(uid);
      if (isAdd) {
        onReacted(eventOwnerId, reaction, uid);
      }
    }

    return newReactions;
  } catch (e) {
    __DEV__ && console.warn("[globalFeed] addReaction error:", e);
    return null;
  }
}

const PAGE_SIZE = 20;

export type FeedPage = {
  events: FeedEvent[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

/**
 * Charge la première page du feed (ordre anti-chronologique).
 */
export async function fetchFeedPage(
  after?: QueryDocumentSnapshot<DocumentData> | null
): Promise<FeedPage> {
  const ref = collection(db, "globalFeed");
  const q = after
    ? query(ref, orderBy("createdAt", "desc"), startAfter(after), limit(PAGE_SIZE))
    : query(ref, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

  const snap = await getDocs(q);
  const events: FeedEvent[] = snap.docs.map((d) => docToFeedEvent(d));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;

  return {
    events,
    lastDoc,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

function docToFeedEvent(d: QueryDocumentSnapshot<DocumentData>): FeedEvent {
  const data = d.data();
  const r = data.reactions ?? {};
  return {
    id:             d.id,
    uid:            String(data.uid || ""),
    username:       String(data.username || ""),
    avatarUrl:      data.avatarUrl ?? null,
    type:           data.type as FeedEventType,
    challengeId:    String(data.challengeId || ""),
    challengeTitle: String(data.challengeTitle || ""),
    payload:        (data.payload as FeedPayload) || {},
    createdAt:      data.createdAt?.toDate?.() ?? new Date(),
    feedPublic:     !!data.feedPublic,
    reactions: {
      fire:     Number(r.fire   ?? 0),
      muscle:   Number(r.muscle ?? 0),
      fireBy:   Array.isArray(r.fireBy)   ? r.fireBy   : [],
      muscleBy: Array.isArray(r.muscleBy) ? r.muscleBy : [],
    },
  };
}