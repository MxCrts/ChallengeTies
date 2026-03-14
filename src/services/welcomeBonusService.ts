// src/services/welcomeBonusService.ts
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type WelcomeBonusReward =
  | { type: "trophies"; amount: number }
  | { type: "streakPass"; amount: number }
  | { type: "premium"; amount: number };

export type WelcomeBonusState = {
  currentDay: number;      // 0..6 (index récompense du jour)
  completed: boolean;
  canClaimToday: boolean;
  lastClaimDate: string | null; // "YYYY-MM-DD"
};

const WELCOME_REWARDS: WelcomeBonusReward[] = [
  { type: "trophies",   amount: 8  }, // Day 1
  { type: "trophies",   amount: 12 }, // Day 2
  { type: "streakPass", amount: 1  }, // Day 3
  { type: "trophies",   amount: 15 }, // Day 4
  { type: "streakPass", amount: 1  }, // Day 5
  { type: "trophies",   amount: 20 }, // Day 6
  { type: "premium",    amount: 7  }, // Day 7
];

// ✅ UTC day key aligné avec DAY_UTC côté home
export const todayKeyUTC = () => {
  const d   = new Date();
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const clampDayIndex = (n: any) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v < 0) return 0;
  if (v >= WELCOME_REWARDS.length) return WELCOME_REWARDS.length - 1;
  return v;
};

const normalizeDayIndex = (raw: any) => {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return clampDayIndex(n); // ← supprime la logique one-based, le service stocke déjà en 0-based
};

// ─────────────────────────────────────────────────────────────────────────────
// computeWelcomeBonusState
// ─────────────────────────────────────────────────────────────────────────────
export function computeWelcomeBonusState(
  userData: any | null | undefined
): WelcomeBonusState {
  const today = todayKeyUTC();
  const u     = (userData as any) || {};

  // Supporte: nouveau (welcomeLoginBonus map), legacy (WelcomeLoginBonus map)
  const wbObj =
    (u.welcomeLoginBonus && typeof u.welcomeLoginBonus === "object"
      ? u.welcomeLoginBonus : null) ||
    (u.WelcomeLoginBonus && typeof u.WelcomeLoginBonus === "object"
      ? u.WelcomeLoginBonus : null);

  const wb = wbObj || {};

  const completed     = wb.completed === true;
  const currentDay    = normalizeDayIndex(wb.currentDay);
  const lastClaimDate = typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

  if (completed) {
    return { currentDay, completed: true, canClaimToday: false, lastClaimDate };
  }

  const canClaimToday = lastClaimDate !== today;
  return { currentDay, completed: false, canClaimToday, lastClaimDate };
}

// ─────────────────────────────────────────────────────────────────────────────
// claimWelcomeBonus
// ─────────────────────────────────────────────────────────────────────────────
export async function claimWelcomeBonus(
  userId: string
): Promise<{ reward: WelcomeBonusReward; state: WelcomeBonusState }> {
  const userRef = doc(db, "users", userId);
  const today   = todayKeyUTC();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("User not found");

    const data = snap.data() || {};
    const d    = data as any;

    // ── Lire l'état welcomeLoginBonus ──────────────────────────────────────
    const wbObj =
      (d.welcomeLoginBonus && typeof d.welcomeLoginBonus === "object"
        ? d.welcomeLoginBonus : null) ||
      (d.WelcomeLoginBonus && typeof d.WelcomeLoginBonus === "object"
        ? d.WelcomeLoginBonus : null);

    const wb = wbObj || {};

    const currentDay    = normalizeDayIndex(wb.currentDay);
    const completed     = wb.completed === true;
    const lastClaimDate = typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

    if (completed)           throw new Error("Welcome bonus already completed");
    if (lastClaimDate === today) throw new Error("Already claimed today");

    const reward  = WELCOME_REWARDS[currentDay];
    const nextDay = currentDay + 1;
    const isCompleted = nextDay >= WELCOME_REWARDS.length;

    // ── Construire updates ─────────────────────────────────────────────────
    // IMPORTANT: on utilise tx.update() (pas tx.set()) pour matcher les
    // Security Rules "update". Les clés en dot-notation sont bien
    // interprétées comme nested fields par tx.update().
    const updates: Record<string, any> = {};

    // Avancer l'état welcome (MAP complet, jamais de dot-notation ici)
    const prevMap = wbObj || {};
    updates["welcomeLoginBonus"] = {
      ...prevMap,
      currentDay:    nextDay,
      lastClaimDate: today,
      completed:     isCompleted,
    };

    // Appliquer la récompense
    switch (reward.type) {
      case "trophies": {
        const trophies = typeof d.trophies === "number" ? d.trophies : 0;
        const total    = typeof d.totalTrophies === "number" ? d.totalTrophies : trophies;
        updates["trophies"]      = trophies + reward.amount;
        updates["totalTrophies"] = total    + reward.amount;
        break;
      }
      case "streakPass": {
        const inv     = d.inventory || {};
        const current = typeof inv.streakPass === "number" ? inv.streakPass : 0;
        // dot-notation correctement interprétée par tx.update()
        updates["inventory.streakPass"] = current + reward.amount;
        break;
      }
      case "premium": {
        const now      = new Date();
        const prevUntil = d?.premium?.tempPremiumUntil as string | undefined;
        const prevDate  = prevUntil ? new Date(prevUntil) : null;
        const start     = prevDate && prevDate > now ? prevDate : now;
        const expires   = new Date(start);
        expires.setUTCDate(expires.getUTCDate() + reward.amount);
        // dot-notation correctement interprétée par tx.update()
        updates["premium.tempPremiumUntil"] = expires.toISOString();
        break;
      }
    }

    // ✅ FIX CRITIQUE: tx.update() au lieu de tx.set(..., { merge: true })
    // tx.set() avec merge:true est traité comme une création potentielle par
    // les Security Rules → les règles "update" ne matchent pas → PERMISSION DENIED
    // tx.update() matche correctement les règles "update" → OK
    tx.update(userRef, updates);

    return {
      reward,
      state: {
        currentDay:    nextDay,
        completed:     isCompleted,
        canClaimToday: false,
        lastClaimDate: today,
      },
    };
  });
}
