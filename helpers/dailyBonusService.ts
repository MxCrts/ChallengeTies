// helpers/dailyBonusService.ts
import {
  doc,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";

// 👉 On ne garde que ces 2 types de récompenses
export type DailyRewardType = "streakPass" | "trophies";

export type DailyRewardResult =
  | { type: "streakPass"; amount: number }
  | { type: "trophies"; amount: number };

/** ---- Utils ---- */

const todayKey = () => new Date().toISOString().slice(0, 10);

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sélection de la récompense avec pondération.
 * On garde 2 types simples :
 * - streakPass
 * - trophies
 *
 * Tu peux ajuster les probabilités si tu veux plus tard.
 */
function pickRandomReward(): DailyRewardResult {
  const roll = getRandomInt(1, 100);

  // 40% — Streak Pass (ressource premium)
  if (roll <= 40) {
  return { type: "streakPass", amount: 1 };
}

  // 60% — Coffre de trophées
  const amount = getRandomInt(3, 14);
  return { type: "trophies", amount };
}

/**
 * Vérifie côté client si a priori on peut réclamer le bonus :
 * prend en entrée les données user (de ton AuthContext par ex)
 */
export function canClaimDailyBonusFromUserData(userData: any | null): boolean {
  if (!userData) return false;
  const last = userData?.dailyBonus?.lastClaimDate as string | undefined;
  const today = todayKey();
  return last !== today;
}

/**
 * Réclame le bonus du jour (transaction Firestore)
 * - 1 seule fois par jour (clé UTC)
 * - Met à jour les stats : stats.dailyBonus.total / stats.dailyBonus.byType.*
 */
export async function claimDailyBonus(): Promise<DailyRewardResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Utilisateur non connecté");
  }

  const uid = currentUser.uid;
  const userRef = doc(db, "users", uid);
  const today = todayKey();

  let chosenReward: DailyRewardResult | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      throw new Error("Document utilisateur introuvable");
    }
    const data = snap.data() || {};
    const lastClaimDate: string | undefined = data?.dailyBonus?.lastClaimDate;

    // 🔐 déjà pris aujourd'hui => on bloque
    if (lastClaimDate === today) {
      throw new Error("Bonus du jour déjà réclamé");
    }

    const reward = pickRandomReward();
    chosenReward = reward;

    const updates: any = {
  updatedAt: serverTimestamp(), // ✅ AJOUTE ÇA
  "dailyBonus.lastClaimDate": today,
  "dailyBonus.claimedAt": serverTimestamp(),
  "dailyBonus.lastType": reward.type,
  "stats.dailyBonus.total": increment(1),
  [`stats.dailyBonus.byType.${reward.type}`]: increment(1),
};

    // Application de la récompense
    switch (reward.type) {
      case "streakPass": {
        updates["inventory.streakPass"] = increment(reward.amount);
        // Stats spécifiques streakPass gagnés via daily bonus (optionnel)
        updates["stats.streakPass.fromDaily"] = increment(reward.amount);
        break;
      }
      case "trophies": {
        updates["trophies"] = increment(reward.amount);
        updates["totalTrophies"] = increment(reward.amount);
        break;
      }
    }

    tx.update(userRef, updates);
  });

  if (!chosenReward) {
    throw new Error("Échec de la transaction du bonus du jour");
  }

  return chosenReward;
}

/**
 * Consommer 1 Streak Pass (pour MissedChallengeModal)
 * -> throw si aucun Streak Pass dispo
 */
export async function consumeStreakPass(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Utilisateur non connecté");

  const uid = currentUser.uid;
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("Document utilisateur introuvable");
    const data = snap.data() as any;
    const inventory = data.inventory || {};
    const current =
      typeof inventory.streakPass === "number" ? inventory.streakPass : 0;

    if (current <= 0) {
      throw new Error("Aucun Streak Pass disponible");
    }

   tx.update(userRef, {
  updatedAt: serverTimestamp(), // ✅
  "inventory.streakPass": increment(-1),
  "stats.streakPass.used": increment(1),
});
  });
}

/**
 * Reroll du bonus du jour (1 fois max / jour, seulement si déjà claim)
 * - nécessite lastClaimDate === today
 * - bloque si lastRerollDate === today
 * - attribue une nouvelle récompense
 */
export async function claimDailyBonusReroll(): Promise<DailyRewardResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Utilisateur non connecté");

  const uid = currentUser.uid;
  const userRef = doc(db, "users", uid);
  const today = todayKey();

  let chosenReward: DailyRewardResult | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("Document utilisateur introuvable");

    const data = snap.data() || {};
    const lastClaimDate: string | undefined = data?.dailyBonus?.lastClaimDate;
    const lastRerollDate: string | undefined = data?.dailyBonus?.lastRerollDate;

    // 🔐 doit avoir claim une première fois aujourd'hui
    if (lastClaimDate !== today) {
      throw new Error("Bonus du jour non réclamé");
    }

    // 🔐 reroll déjà utilisé aujourd'hui => on bloque
    if (lastRerollDate === today) {
      throw new Error("Relance déjà utilisée aujourd'hui");
    }

    const reward = pickRandomReward();
    chosenReward = reward;

    const updates: any = {
      "dailyBonus.lastRerollDate": today,
      "dailyBonus.rerolledAt": serverTimestamp(),
      "dailyBonus.lastRerollType": reward.type,

      // ✅ Stats reroll
      "stats.dailyBonus.rerollsTotal": increment(1),
      [`stats.dailyBonus.rerollsByType.${reward.type}`]: increment(1),
    };

    // Application de la récompense reroll
    switch (reward.type) {
      case "streakPass": {
        updates["inventory.streakPass"] = increment(reward.amount);
        updates["stats.streakPass.fromDailyReroll"] = increment(reward.amount);
        break;
      }
      case "trophies": {
        updates["trophies"] = increment(reward.amount);
        updates["totalTrophies"] = increment(reward.amount);
        break;
      }
    }

    tx.update(userRef, updates);
  });

  if (!chosenReward) {
    throw new Error("Échec de la transaction reroll");
  }

  return chosenReward;
}

