// src/referral/pioneerChecker.ts
import { auth, db } from "@/constants/firebase-config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { logEvent } from "../analytics";

/**
 * Donne automatiquement le badge Pioneer (+50 trophées) au parrain
 * s'il a au moins 3 filleuls ACTIVÉS (activated=true).
 * - Ne fait rien si déjà Pioneer/pioneerRewardGranted = true.
 * - Utilise un update doc self (compatible avec tes rules one-shot).
 */
export async function checkAndGrantPioneerIfEligible() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  // 1) Compter mes filleuls ACTIVÉS
  const q = query(
    collection(db, "users"),
    where("referrerId", "==", me),
    where("activated", "==", true)
  );
  const snap = await getDocs(q);
  const activatedCount = snap.size;

  if (activatedCount < 3) return; // pas encore éligible

  // 2) Lire mon état pour éviter le double-grant
  const meRef = doc(db, "users", me);
  const meSnap = await getDoc(meRef);
  const meData = meSnap.exists() ? (meSnap.data() as any) : {};

  if (meData?.isPioneer === true && meData?.pioneerRewardGranted === true) {
    return; // déjà attribué
  }

  // 3) One-shot grant Pioneer (+50)
  try {
    await updateDoc(meRef, {
  isPioneer: true,
  pioneerRewardGranted: true,
  trophies: increment(50),
});

    // métrique (ton analytics accepte les strings élargis)
    await logEvent("pioneer_unlocked", { activatedCount });
  } catch (e) {
    console.log("[pioneer] grant error:", (e as any)?.message ?? e);
  }
}

export async function checkAndGrantAmbassadorRewards() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  // 1) Compter mes filleuls ACTIVÉS
  const q = query(
    collection(db, "users"),
    where("referrerId", "==", me),
    where("activated", "==", true)
  );
  const snap = await getDocs(q);
  const activatedCount = snap.size;

  // 2) Lire mon état (combien déjà payés)
  const meRef = doc(db, "users", me);
  const meSnap = await getDoc(meRef);
  const meData = meSnap.exists() ? (meSnap.data() as any) : {};

  const alreadyPaidFor: number = Number(meData?.ambassadorPaidFor ?? 0);
  const delta = activatedCount - alreadyPaidFor;
  if (delta <= 0) return; // rien de nouveau à payer

  const TROPHY_PER_ACTIVATION = 10; // 🎯 règle simple et claire
  const payout = delta * TROPHY_PER_ACTIVATION;

  try {
    await updateDoc(meRef, {
      trophies: increment(payout),
      ambassadorPaidFor: activatedCount, // on “rattrape” la différence
    });
    await logEvent("ambassador_reward", { activatedCount, delta, payout });
  } catch (e) {
    console.log("[ambassador] reward error:", (e as any)?.message ?? e);
  }
}

export async function checkAndGrantAmbassadorMilestones() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  // 1) Compte les filleuls ACTIVÉS
  const q = query(
    collection(db, "users"),
    where("referrerId", "==", me),
    where("activated", "==", true)
  );
  const snap = await getDocs(q);
  const activatedCount = snap.size;

  // 2) Lis mon état
  const meRef = doc(db, "users", me);
  const meSnap = await getDoc(meRef);
  const meData = meSnap.exists() ? (meSnap.data() as any) : {};
  const paid: number[] = Array.isArray(meData?.ambassadorMilestones)
    ? meData.ambassadorMilestones
    : [];

  // 3) Définis les paliers et récompenses (modifiable à volonté)
  const milestones: Record<number, number> = {
    5: 50,
    10: 100,
    25: 300,
  };

  // 4) Trouve les paliers atteints non encore payés
  const toPay = Object.entries(milestones)
    .map(([m, reward]) => ({ m: Number(m), reward }))
    .filter(({ m }) => activatedCount >= m && !paid.includes(m))
    .sort((a, b) => a.m - b.m); // pas indispensable, mais propre

  if (toPay.length === 0) return;

  // 5) Calcule le total et mets à jour en une fois
  const totalPayout = toPay.reduce((s, x) => s + x.reward, 0);
  const newPaid = [...paid, ...toPay.map((x) => x.m)];

  try {
    await updateDoc(meRef, {
      trophies: increment(totalPayout),
      ambassadorMilestones: newPaid,
    });
    await logEvent("ambassador_milestone", {
      activatedCount,
      milestonesPaid: toPay.map((x) => x.m),
      totalPayout,
    });
  } catch (e) {
    console.log("[ambassador] milestone error:", (e as any)?.message ?? e);
  }
}
