// services/usernameService.ts
//
// ── Username uniqueness — bulletproof atomic approach ──────────────────────────
//
// Collection Firestore : usernames/{username_lowercase}
// Doc structure        : { uid: string, createdAt: Timestamp }
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/constants/firebase-config";

// ─── Normalisation ─────────────────────────────────────────────────────────────
export const normalizeUsername = (raw: string) =>
  raw.trim().toLowerCase().replace(/\s+/g, "_");

// ─── Validation format ─────────────────────────────────────────────────────────
export type UsernameFormatError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | null;

export function validateUsernameFormat(username: string): UsernameFormatError {
  const cleaned = username.trim();
  if (cleaned.length < 2) return "too_short";
  if (cleaned.length > 30) return "too_long";
  // Le @ est interdit → bloque directement les emails comme "user@gmail.com"
  // Seuls lettres, chiffres, underscore, tiret, point sont autorisés
  if (!/^[a-zA-Z0-9_\-.]+$/.test(cleaned)) return "invalid_chars";
  return null;
}

// ─── Check disponibilité (lecture simple — pour feedback temps réel) ───────────
//
// ⚠️ On NE catch PAS silencieusement l'erreur.
// Si Firestore rejette la lecture (règles manquantes, réseau coupé),
// on laisse l'erreur remonter pour que le caller la gère proprement
// et affiche "checking" / "idle" — jamais un faux "disponible".
//
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const key = normalizeUsername(username);
  if (!key) return false;
  const snap = await getDoc(doc(db, "usernames", key));
  return !snap.exists();
}

// ─── Générateur de suggestions ──────────────────────────────────────────────────
function rand2(): string {
  return String(Math.floor(Math.random() * 90) + 10);
}

function rand4(): string {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

const YEAR = new Date().getFullYear().toString().slice(2); // "26"

function buildCandidates(base: string): string[] {
  const b = base.toLowerCase().replace(/[^a-z0-9_\-.]/g, "").slice(0, 24);
  return [
    `${b}${rand2()}`,
    `${b}_${rand2()}`,
    `${b}${YEAR}`,
    `${b}_${rand4()}`,
    `${b}.${rand2()}`,
    `${b}${rand2()}`,
    `${b}_pro`,
    `${b}_real`,
  ].filter((v, i, arr) => arr.indexOf(v) === i);
}

export async function getUsernameSuggestions(
  base: string,
  count = 3
): Promise<string[]> {
  const candidates = buildCandidates(base);
  const checks = await Promise.allSettled(
    candidates.map(async (c) => {
      try {
        const available = await isUsernameAvailable(c);
        return available ? c : null;
      } catch {
        return null;
      }
    })
  );
  return checks
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is string => !!v)
    .slice(0, count);
}

// ─── Réservation atomique ──────────────────────────────────────────────────────
export type ReserveUsernameResult =
  | { success: true }
  | { success: false; reason: "taken" | "error"; message?: string };

export async function reserveUsernameAtomic(
  userId: string,
  username: string,
  writeUserDoc: (tx: Parameters<Parameters<typeof runTransaction>[1]>[0]) => void
): Promise<ReserveUsernameResult> {
  const key = normalizeUsername(username);
  if (!key) return { success: false, reason: "error", message: "empty_key" };

  const usernameRef = doc(db, "usernames", key);
  const userRef     = doc(db, "users", userId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(usernameRef);

      if (snap.exists()) {
        const existingUid = snap.data()?.uid;
        if (existingUid && existingUid !== userId) {
          throw Object.assign(new Error("username_taken"), { code: "username_taken" });
        }
      } else {
        tx.set(usernameRef, { uid: userId, createdAt: serverTimestamp() });
      }

      writeUserDoc(tx);
    });

    return { success: true };
  } catch (e: any) {
    if (e?.code === "username_taken" || e?.message === "username_taken") {
      return { success: false, reason: "taken" };
    }
    console.error("[usernameService] reserveUsernameAtomic error:", e);
    return { success: false, reason: "error", message: e?.message };
  }
}

// ─── Libération ───────────────────────────────────────────────────────────────
export async function releaseUsername(
  userId: string,
  username: string
): Promise<void> {
  const key = normalizeUsername(username);
  if (!key) return;
  try {
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "usernames", key);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data()?.uid === userId) {
        tx.delete(ref);
      }
    });
  } catch (e) {
    console.error("[usernameService] releaseUsername error:", e);
  }
}
