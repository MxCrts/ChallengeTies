// src/services/welcomeBonusService.ts
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type WelcomeBonusReward =
  | { type: "trophies"; amount: number }
  | { type: "streakPass"; amount: number }
  | { type: "premium"; amount: number };

export type WelcomeBonusState = {
  currentDay: number;       // 0 à 6 (index dans le tableau de récompenses)
  completed: boolean;       // true si les 7 jours ont été pris
  canClaimToday: boolean;   // true si la récompense du jour est réclamable
  lastClaimDate: string | null; // "YYYY-MM-DD" ou null
};

const WELCOME_REWARDS: WelcomeBonusReward[] = [
  { type: "trophies", amount: 8 },   // Jour 1
  { type: "trophies", amount: 12 },  // Jour 2
  { type: "streakPass", amount: 1 }, // Jour 3
  { type: "trophies", amount: 15 },  // Jour 4
  { type: "streakPass", amount: 1 }, // Jour 5
  { type: "trophies", amount: 20 },  // Jour 6
  { type: "premium", amount: 7 },      // Jour 7
];

const todayKeyLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Calcule l’état du bonus de connexion à partir des données actuelles du user.
 * userData peut être ton snapshot Firestore (data()).
 */
export function computeWelcomeBonusState(userData: any | null | undefined): WelcomeBonusState {
  const today = todayKeyLocal();

  const wb = (userData as any)?.welcomeLoginBonus || {};
  let currentDay = typeof wb.currentDay === "number" ? wb.currentDay : 0;
  const completed = wb.completed === true;
  const lastClaimDate: string | null =
    typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

  if (completed) {
    return {
      currentDay: Math.min(currentDay, WELCOME_REWARDS.length - 1),
      completed: true,
      canClaimToday: false,
      lastClaimDate,
    };
  }

  // Si jamais currentDay sort des bornes, on le clamp.
  if (currentDay < 0) currentDay = 0;
  if (currentDay >= WELCOME_REWARDS.length) {
    currentDay = WELCOME_REWARDS.length - 1;
  }

  // 🔑 Logique simple : pas besoin que les jours soient consécutifs,
  // on avance juste si on n'a pas encore réclamé "aujourd'hui".
  const canClaimToday = lastClaimDate !== today;

  return {
    currentDay,
    completed: false,
    canClaimToday,
    lastClaimDate,
  };
}

/**
 * Applique la récompense du jour en transaction Firestore.
 * - Incrémente trophies / totalTrophies si besoin
 * - Incrémente inventory.streakPass si besoin
 * - Active un premium temporaire si besoin
 * - Met à jour welcomeLoginBonus.{currentDay,lastClaimDate,completed}
 *
 * Retourne la récompense réellement appliquée + l’état après coup.
 */
export async function claimWelcomeBonus(
  userId: string
): Promise<{ reward: WelcomeBonusReward; state: WelcomeBonusState }> {
  const userRef = doc(db, "users", userId);
  const today = todayKeyLocal();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      throw new Error("User not found");
    }

    const data = snap.data() || {};
    const wb = (data as any).welcomeLoginBonus || {};

    let currentDay: number =
      typeof wb.currentDay === "number" ? wb.currentDay : 0;
    let completed: boolean = wb.completed === true;
    const lastClaimDate: string | null =
      typeof wb.lastClaimDate === "string" ? wb.lastClaimDate : null;

    if (completed) {
      throw new Error("Welcome bonus already completed");
    }

    if (lastClaimDate === today) {
      // Déjà récupéré aujourd'hui
      throw new Error("Already claimed today");
    }

    // S'il dépasse la taille du tableau pour une raison X → clamp
    if (currentDay < 0) currentDay = 0;
    if (currentDay >= WELCOME_REWARDS.length) {
      currentDay = WELCOME_REWARDS.length - 1;
    }

    const reward = WELCOME_REWARDS[currentDay];

    // Copie mutable pour modifications
    const updates: Record<string, any> = {};

    // --- Appliquer la récompense ---
    switch (reward.type) {
      case "trophies": {
        const gain = reward.amount;
        const trophies =
          typeof (data as any).trophies === "number" ? (data as any).trophies : 0;
        const total =
          typeof (data as any).totalTrophies === "number"
            ? (data as any).totalTrophies
            : trophies;
        updates.trophies = trophies + gain;
        updates.totalTrophies = total + gain;
        break;
      }

      case "streakPass": {
        const inv = (data as any).inventory || {};
        const current =
          typeof inv.streakPass === "number" ? inv.streakPass : 0;
        updates["inventory.streakPass"] = current + reward.amount;
        break;
      }

      case "premium": {
        const days = reward.amount;
        const now = new Date();
        const prevUntil = (data as any)?.premium?.tempPremiumUntil as string | undefined;
        const baseDate = new Date(prevUntil || now.toISOString());
        const start =
          baseDate > now ? baseDate : now; // si déjà un essai, on empile après
        const expires = new Date(start);
        expires.setDate(expires.getDate() + days);

        updates["premium.tempPremiumUntil"] = expires.toISOString();
        break;
      }
    }

    // --- Avancer l’état du welcome ---
    const nextDay = currentDay + 1;
    const isCompleted = nextDay >= WELCOME_REWARDS.length;

    updates["welcomeLoginBonus.currentDay"] = nextDay; // index du prochain jour
    updates["welcomeLoginBonus.lastClaimDate"] = today;
    updates["welcomeLoginBonus.completed"] = isCompleted;

    tx.set(userRef, updates, { merge: true });

    const finalState: WelcomeBonusState = {
      currentDay: nextDay,
      completed: isCompleted,
      canClaimToday: false,
      lastClaimDate: today,
    };

    return { reward, state: finalState };
  });
}
