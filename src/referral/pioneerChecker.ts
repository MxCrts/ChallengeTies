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
} from "firebase/firestore";
import { logEvent } from "../analytics";
import { sendReferralMilestoneLocalNudge } from "@/services/notificationService";


/**
 * Compte mes filleuls activés.
 * Tolère 2 flags côté filleul pour compat:
 *  - activated === true (flag principal)
 *  - referralActivated === true (anciens essais / fallback)
 */
async function getActivatedReferralsCount(meUid: string) {
  const q = query(
    collection(db, "users"),
    where("referrerId", "==", meUid)
  );

  const snap = await getDocs(q);

  return snap.docs.filter((d) => {
    const u = d.data() as any;
    return u?.activated === true || u?.referralActivated === true;
  }).length;
}

async function getMeData(meUid: string) {
  const meRef = doc(db, "users", meUid);
  const meSnap = await getDoc(meRef);
  return {
    meRef,
    meData: meSnap.exists() ? (meSnap.data() as any) : {},
  };
}

// Paliers de parrainage -> bonus affiché dans la notif
// ⚠️ À garder cohérent avec ton écran Share & Earn
const REFERRAL_MILESTONES: Record<number, number> = {
  5: 50,
  10: 100,
  25: 300,
};


/**
 * Donne automatiquement le badge Pioneer (+50 trophées) au parrain
 * s'il a au moins 3 filleuls ACTIVÉS.
 * - Ne fait rien si déjà Pioneer OU pioneerRewardGranted.
 * - Utilise un update doc self (compatible avec tes rules one-shot).
 */
export async function checkAndGrantPioneerIfEligible() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  // 1) compter mes filleuls activés
  const activatedCount = await getActivatedReferralsCount(me);
  if (activatedCount < 3) return;

  // 2) lire mon état
  const { meRef, meData } = await getMeData(me);

  if (meData?.pioneerRewardGranted === true || meData?.isPioneer === true) {
    return; // déjà attribué
  }

  // 3) one-shot grant Pioneer (+50)
  try {
    await updateDoc(meRef, {
      isPioneer: true,
      pioneerRewardGranted: true,
      trophies: increment(50),
    });

    await logEvent("pioneer_unlocked", { activatedCount });
  } catch (e) {
    console.log("[pioneer] grant error:", (e as any)?.message ?? e);
  }
}

/**
 * Récompense "Ambassador" simple : +10 trophées par filleul activé,
 * payés une seule fois par activation (tracking ambassadorPaidFor).
 */
export async function checkAndGrantAmbassadorRewards() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  const activatedCount = await getActivatedReferralsCount(me);
  const { meRef, meData } = await getMeData(me);

  const alreadyPaidFor = Number(meData?.ambassadorPaidFor ?? 0);

  // On met juste à jour le compteur, PAS de trophées ici.
  if (activatedCount > alreadyPaidFor) {
    await updateDoc(meRef, {
      ambassadorPaidFor: activatedCount,
    });
  }
}


/**
 * Paliers Ambassador : 5/10/25 activations
 * -> payés 1 seule fois chacun via ambassadorMilestones[]
 */
export async function checkAndGrantAmbassadorMilestones() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  const activatedCount = await getActivatedReferralsCount(me);

  const { meRef, meData } = await getMeData(me);

  const paid: number[] = Array.isArray(meData?.ambassadorMilestones)
    ? meData.ambassadorMilestones
        .map((n: any) => Number(n))
        .filter((x: number) => Number.isFinite(x))
    : [];

  const milestones: Record<number, number> = {
    5: 50,
    10: 100,
    25: 300,
  };

  const toPay = Object.entries(milestones)
    .map(([m, reward]) => ({ m: Number(m), reward }))
    .filter(({ m }) => activatedCount >= m && !paid.includes(m))
    .sort((a, b) => a.m - b.m);

  if (toPay.length === 0) return;

  const totalPayout = toPay.reduce((s, x) => s + x.reward, 0);
  const newPaid = Array.from(new Set([...paid, ...toPay.map((x) => x.m)]));

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

/**
 * Notif de palier de parrainage :
 * - se base sur le nombre de filleuls activés (comme le reste)
 * - ne NOTIFIE que les paliers qui ne sont PAS dans referral.claimedMilestones
 * - ne touche pas Firestore → la notif continuera à sortir tant que ce n'est pas claim
 */
export async function checkAndNotifyReferralMilestones() {
  const me = auth.currentUser?.uid;
  if (!me) return;

  // 1) nombre de filleuls activés (source de vérité)
  const activatedCount = await getActivatedReferralsCount(me);

  // 2) récupérer mes données user (dont referral.*)
  const { meData } = await getMeData(me);

  const referral = meData?.referral || {};

  const claimed: number[] = Array.isArray(referral.claimedMilestones)
    ? referral.claimedMilestones
        .map((n: any) => Number(n))
        .filter((x: number) => Number.isFinite(x))
    : [];

  // 3) déterminer les paliers atteints mais PAS claim
  const unlockedNotClaimed = Object.keys(REFERRAL_MILESTONES)
    .map((m) => Number(m))
    .filter((m) => activatedCount >= m && !claimed.includes(m))
    .sort((a, b) => a - b);

  // Rien à notifier
  if (unlockedNotClaimed.length === 0) return;

  // On prend le "prochain" palier intéressant (le plus petit non claimé)
  const next = unlockedNotClaimed[0];
  const bonus = REFERRAL_MILESTONES[next];

  // 4) Notif locale → tu peux claim ton palier
  await sendReferralMilestoneLocalNudge(me, {
    bonus,
    milestones: unlockedNotClaimed,
    activatedCount,
    // username optionnel → utilisé dans les traductions si tu veux
    username: meData?.username || meData?.displayName || null,
  });

  // 5) Analytics (optionnel mais propre)
  try {
    await logEvent("referral_milestone_nudge_shown", {
      activatedCount,
      milestone: next,
      claimedMilestones: claimed,
    });
  } catch (e) {
    console.log(
      "[referral] milestone_nudge analytics error:",
      (e as any)?.message ?? e
    );
  }
}
