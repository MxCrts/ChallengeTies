// src/services/welcomeBonusService.ts
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type WelcomeBonusReward =
  | { type: "trophies"; amount: number }
  | { type: "streakPass"; amount: number }
  | { type: "premium"; amount: number };

export type WelcomeBonusState = {
  currentDay: number; // 0..6 (index récompense du jour)
  completed: boolean;
  canClaimToday: boolean;
  lastClaimDate: string | null; // "YYYY-MM-DD"
};

const WELCOME_REWARDS: WelcomeBonusReward[] = [
  { type: "trophies", amount: 8 },  // Day 1
  { type: "trophies", amount: 12 }, // Day 2
  { type: "streakPass", amount: 1 },// Day 3
  { type: "trophies", amount: 15 }, // Day 4
  { type: "streakPass", amount: 1 },// Day 5
  { type: "trophies", amount: 20 }, // Day 6
  { type: "premium", amount: 7 },   // Day 7
];

// ✅ UTC day key (aligné avec DAY_UTC / "YYYY-MM-DD")
export const todayKeyUTC = () => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const clampDayIndex = (n: any) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v < 0) return 0;
  if (v >= WELCOME_REWARDS.length) return WELCOME_REWARDS.length - 1;
  return v;
};

const looksOneBasedDay = (raw: any) => {
  return (
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw >= 1 &&
    raw <= WELCOME_REWARDS.length
  );
};

const normalizeDayIndex = (raw: any) => {
  // On accepte :
  // - 0..6 (nouveau)
  // - 1..7 (ancien) -> convertit en 0..6
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  if (looksOneBasedDay(n)) return clampDayIndex(n - 1);
  return clampDayIndex(n);
};

/**
 * ✅ Calcule l’état du welcome bonus à partir du snapshot userData
 * IMPORTANT: on compare en UTC (sinon modal qui re-pop)
 */
export function computeWelcomeBonusState(
  userData: any | null | undefined
): WelcomeBonusState {
  const today = todayKeyUTC();

  const u = (userData as any) || {};
  // ✅ Supporte 3 formats :
  // 1) ✅ nouveau: welcomeLoginBonus (map)
  // 2) legacy: WelcomeLoginBonus (map)
  // 3) ❌ cassé: champs plats "welcomeLoginBonus.currentDay" etc.
  const wbObj =
    (u.welcomeLoginBonus && typeof u.welcomeLoginBonus === "object"
      ? u.welcomeLoginBonus
      : null) ||
    (u.WelcomeLoginBonus && typeof u.WelcomeLoginBonus === "object"
      ? u.WelcomeLoginBonus
      : null);

  const wbFlat = {
    currentDay: u["welcomeLoginBonus.currentDay"],
    lastClaimDate: u["welcomeLoginBonus.lastClaimDate"],
    completed: u["welcomeLoginBonus.completed"],
  };

  const wb = wbObj || wbFlat || {};

  const completed = wb.completed === true;
  const currentDay = normalizeDayIndex(wb.currentDay);
  const lastClaimDate =
    typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

  if (completed) {
    return { currentDay, completed: true, canClaimToday: false, lastClaimDate };
  }

  const canClaimToday = lastClaimDate !== today;

  return { currentDay, completed: false, canClaimToday, lastClaimDate };
}

/**
 * ⚠️ Version complète (récompenses + welcome state)
 */
export async function claimWelcomeBonus(
  userId: string
): Promise<{ reward: WelcomeBonusReward; state: WelcomeBonusState }> {
  const userRef = doc(db, "users", userId);
  const today = todayKeyUTC();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("User not found");

    const data = snap.data() || {};
    const d = data as any;
    // ✅ même logique que compute: on lit map sinon fallback champs plats
    const wbObj =
      (d.welcomeLoginBonus && typeof d.welcomeLoginBonus === "object"
        ? d.welcomeLoginBonus
        : null) ||
      (d.WelcomeLoginBonus && typeof d.WelcomeLoginBonus === "object"
        ? d.WelcomeLoginBonus
        : null);

    const wbFlat = {
      currentDay: d["welcomeLoginBonus.currentDay"],
      lastClaimDate: d["welcomeLoginBonus.lastClaimDate"],
      completed: d["welcomeLoginBonus.completed"],
    };

    const wb = wbObj || wbFlat || {};

    const updates: Record<string, any> = {};

    // migrate legacy once
    if (d.WelcomeLoginBonus && !d.welcomeLoginBonus) {
      updates["welcomeLoginBonus"] = d.WelcomeLoginBonus;
    }

    const rawDay = wb.currentDay;
    const oneBased = looksOneBasedDay(rawDay);
    const currentDay = normalizeDayIndex(rawDay);

    const completed = wb.completed === true;
    const lastClaimDate =
      typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

    if (completed) throw new Error("Welcome bonus already completed");
    if (lastClaimDate === today) throw new Error("Already claimed today");

    const reward = WELCOME_REWARDS[currentDay];

    // --- Apply reward (⚠️ rules peuvent bloquer ces champs) ---
    switch (reward.type) {
      case "trophies": {
        const gain = reward.amount;
        const trophies = typeof d.trophies === "number" ? d.trophies : 0;
        const total =
          typeof d.totalTrophies === "number" ? d.totalTrophies : trophies;

        updates.trophies = trophies + gain;
        updates.totalTrophies = total + gain;
        break;
      }

      case "streakPass": {
        const inv = d.inventory || {};
        const current = typeof inv.streakPass === "number" ? inv.streakPass : 0;
        updates["inventory.streakPass"] = current + reward.amount;
        break;
      }

      case "premium": {
        const days = reward.amount;
        const now = new Date();
        const prevUntil = d?.premium?.tempPremiumUntil as string | undefined;

        const prevDate = prevUntil ? new Date(prevUntil) : null;
        const start = prevDate && prevDate > now ? prevDate : now;

        const expires = new Date(start);
        expires.setUTCDate(expires.getUTCDate() + days);

        updates["premium.tempPremiumUntil"] = expires.toISOString();
        break;
      }
    }

    // --- Advance welcome state (0-based) ---
    const nextDay = currentDay + 1;
    const isCompleted = nextDay >= WELCOME_REWARDS.length;

    // ✅ FIX DEFINITIF :
    // On écrit TOUJOURS le MAP complet "welcomeLoginBonus" (et jamais des clés avec des points).
    // Ça évite le bug des champs plats "welcomeLoginBonus.currentDay".
    //
    // Note: oneBased n’a plus besoin d’écrire un champ intermédiaire,
    // car le MAP ci-dessous normalise la base automatiquement.
    const prevMap =
      (d.welcomeLoginBonus && typeof d.welcomeLoginBonus === "object"
        ? d.welcomeLoginBonus
        : null) ||
      (d.WelcomeLoginBonus && typeof d.WelcomeLoginBonus === "object"
        ? d.WelcomeLoginBonus
        : null) ||
      {};

    updates.welcomeLoginBonus = {
      ...prevMap,
      currentDay: nextDay,       // 0-based
      lastClaimDate: today,      // UTC "YYYY-MM-DD"
      completed: isCompleted,
    };

    tx.set(userRef, updates, { merge: true });

    return {
      reward,
      state: {
        currentDay: nextDay,
        completed: isCompleted,
        canClaimToday: false,
        lastClaimDate: today,
      },
    };
  });
}
