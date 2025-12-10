// functions/src/referralClaim.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const ALLOWED = [5, 10, 25] as const;
const REWARDS: Record<(typeof ALLOWED)[number], number> = {
  5: 50,
  10: 100,
  25: 300,
};

export const claimReferralMilestone = onCall<{ milestone: number }>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

    const milestone = Number(req.data?.milestone);
    if (!ALLOWED.includes(milestone as any)) {
      throw new HttpsError("invalid-argument", "invalid_milestone");
    }

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpsError("not-found", "user_not_found");

      const data = snap.data() || {};
      const activatedCount: number = data?.referral?.activatedCount ?? 0;
      const claimed: number[] = Array.isArray(data?.referral?.claimedMilestones)
        ? data.referral.claimedMilestones
        : [];
      const pending: number[] = Array.isArray(data?.referral?.pendingMilestones)
        ? data.referral.pendingMilestones
        : [];

      // sécurité serveur: doit être débloqué ET pending
      if (activatedCount < milestone) {
        throw new HttpsError("failed-precondition", "not_reached");
      }
      if (!pending.includes(milestone)) {
        // pas encore unlock côté serveur
        throw new HttpsError("failed-precondition", "not_unlocked");
      }
      if (claimed.includes(milestone)) {
        throw new HttpsError("already-exists", "already_claimed");
      }

      const reward = REWARDS[milestone as (typeof ALLOWED)[number]] ?? 0;

      tx.update(userRef, {
        trophies: FieldValue.increment(reward),

        // move pending -> claimed
        "referral.claimedMilestones": FieldValue.arrayUnion(milestone),
        "referral.pendingMilestones": FieldValue.arrayRemove(milestone),

        "referral.lastClaimed": milestone,
        "referral.updatedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true };
  }
);
