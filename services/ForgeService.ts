// services/ForgeService.ts
// ═══════════════════════════════════════════════════════════════
// La Forge — logique métier complète
// 3 engagements sur 3 jours pendant l'attente duo
// Récompense partielle ou complète selon progression
// ═══════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";

export type ForgeStep = 1 | 2 | 3;

export interface ForgeState {
  invitationId: string;       // ID de l'invitation pending
  startedAt: string;          // ISO date de début
  completedSteps: ForgeStep[]; // [1], [1,2], [1,2,3]
  intentionText?: string;     // texte du J1
  rewardClaimed: boolean;     // récompense déjà attribuée
  expired: boolean;           // >3 jours mais pas accepté (bloquée à J3)
}

export interface ForgeReward {
  trophies: number;
  badge: boolean; // badge "Forgé" si 3 jours complets
}

// ─── Storage key ──────────────────────────────────────────────
const forgeKey = (invitationId: string) =>
  `forge.state.${invitationId}`;

// ─── Trophées au prorata ──────────────────────────────────────
export function computeForgeReward(completedSteps: ForgeStep[]): ForgeReward {
  const n = completedSteps.length;
  if (n === 0) return { trophies: 0, badge: false };
  if (n === 1) return { trophies: 4, badge: false };
  if (n === 2) return { trophies: 7, badge: false };
  return { trophies: 10, badge: true }; // 3 jours complets = badge "Forgé"
}

// ─── Helpers jour ─────────────────────────────────────────────
function dayKeyLocal(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function diffDaysLocal(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── API publique ─────────────────────────────────────────────

/** Charge l'état Forge depuis AsyncStorage */
export async function loadForgeState(
  invitationId: string
): Promise<ForgeState | null> {
  try {
    const raw = await AsyncStorage.getItem(forgeKey(invitationId));
    if (!raw) return null;
    return JSON.parse(raw) as ForgeState;
  } catch {
    return null;
  }
}

/** Crée ou retourne l'état Forge pour une invitation */
export async function initForge(
  invitationId: string
): Promise<ForgeState> {
  const existing = await loadForgeState(invitationId);
  if (existing) return existing;

  const state: ForgeState = {
    invitationId,
    startedAt: new Date().toISOString(),
    completedSteps: [],
    rewardClaimed: false,
    expired: false,
  };
  await saveForgeState(state);
  return state;
}

export async function saveForgeState(state: ForgeState): Promise<void> {
  // 1. Persiste localement (toujours)
  try {
    await AsyncStorage.setItem(
      forgeKey(state.invitationId),
      JSON.stringify(state)
    );
  } catch {}

  // 2. Sync Firestore (pour que la Cloud Function puisse lire)
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const forgeRef = doc(
      db,
      "users", uid,
      "forge", state.invitationId
    );

    await updateDoc(forgeRef, {
      invitationId: state.invitationId,
      startedAt: state.startedAt,
      completedSteps: state.completedSteps,
      intentionText: state.intentionText ?? null,
      rewardClaimed: state.rewardClaimed,
      expired: state.expired,
      updatedAt: new Date().toISOString(),
    }).catch(async () => {
      // Doc n'existe pas encore → setDoc
      const { setDoc } = await import("firebase/firestore");
      await setDoc(forgeRef, {
        invitationId: state.invitationId,
        startedAt: state.startedAt,
        completedSteps: state.completedSteps,
        intentionText: state.intentionText ?? null,
        rewardClaimed: state.rewardClaimed,
        expired: state.expired,
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (e) {
    console.warn("[ForgeService] saveForgeState Firestore sync failed:", e);
  }
}

/** Retourne le step disponible aujourd'hui (ou null si déjà fait / trop tôt) */
export function getAvailableStep(state: ForgeState): ForgeStep | null {
  const done = state.completedSteps;
  const daysSinceStart = diffDaysLocal(state.startedAt, new Date().toISOString());

  // Step 1 : J0 (jour du démarrage ou J+0)
  if (!done.includes(1) && daysSinceStart >= 0) return 1;
  // Step 2 : J1+
  if (done.includes(1) && !done.includes(2) && daysSinceStart >= 1) return 2;
  // Step 3 : J2+
  if (done.includes(2) && !done.includes(3) && daysSinceStart >= 2) return 3;

  return null; // tous faits ou pas encore le bon jour
}

/** Calcul de l'état "expired" (>3 jours, forge bloquée à J3) */
export function computeForgeExpired(state: ForgeState): boolean {
  if (state.completedSteps.length >= 3) return false; // complète, pas expirée
  const days = diffDaysLocal(state.startedAt, new Date().toISOString());
  return days > 3;
}

/** Complète un step */
export async function completeForgeStep(
  state: ForgeState,
  step: ForgeStep,
  extra?: { intentionText?: string }
): Promise<ForgeState> {
  if (state.completedSteps.includes(step)) return state; // idempotent

  const next: ForgeState = {
    ...state,
    completedSteps: [...state.completedSteps, step] as ForgeStep[],
    intentionText: extra?.intentionText ?? state.intentionText,
    expired: false,
  };
  await saveForgeState(next);
  return next;
}

/**
 * Attribue la récompense Forge à l'user (trophées + badge éventuel).
 * Idempotent — ne fait rien si rewardClaimed=true.
 */
export async function claimForgeReward(state: ForgeState): Promise<ForgeReward> {
  if (state.rewardClaimed) {
    return computeForgeReward(state.completedSteps);
  }

  const reward = computeForgeReward(state.completedSteps);
  if (reward.trophies === 0) return reward;

  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return reward;

    const userRef = doc(db, "users", uid);
    const updates: Record<string, any> = {
      trophies: increment(reward.trophies),
    };
    if (reward.badge) {
      updates["badges.forge"] = true;
      updates["badges.forgeEarnedAt"] = new Date().toISOString();
    }
    await updateDoc(userRef, updates);

    // Marque comme claimed
    const next: ForgeState = { ...state, rewardClaimed: true };
    await saveForgeState(next);
  } catch (e) {
    console.warn("[ForgeService] claimForgeReward error:", e);
  }

  return reward;
}

/** Nettoie la Forge (invitation acceptée ou annulée) */
export async function clearForge(invitationId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(forgeKey(invitationId));
  } catch {}
}