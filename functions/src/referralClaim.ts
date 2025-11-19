// functions/src/referralClaim.ts
import { onCall } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const ALLOWED = [5, 10, 25] as const;
// Récompenses proposées (à ajuster si tu veux)
const REWARDS: Record<(typeof ALLOWED)[number], number> = {
  5: 20,
  10: 60,
  25: 200,
};

export const claimReferralMilestone = onCall<{ milestone: number }>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new Error("unauthenticated");
    }

    const milestone = Number(req.data?.milestone);
    if (!ALLOWED.includes(milestone as any)) {
      throw new Error("invalid_milestone");
    }

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("user_not_found");

      const data = snap.data() || {};
      const activatedCount: number = data?.referral?.activatedCount ?? 0;
      const claimed: number[] = Array.isArray(data?.referral?.claimedMilestones)
        ? data.referral.claimedMilestones
        : [];

      if (activatedCount < milestone) throw new Error("not_reached");
      if (claimed.includes(milestone)) throw new Error("already_claimed");

      const reward = REWARDS[milestone as (typeof ALLOWED)[number]] ?? 0;

      tx.update(userRef, {
        trophies: FieldValue.increment(reward),
        "referral.claimedMilestones": FieldValue.arrayUnion(milestone),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true };
  }
);
