// functions/src/referralRewards.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const MILESTONES = [5, 10, 25] as const;            // tes paliers
const MILESTONE_BONUS: Record<number, number> = {   // bonus en trophées par palier
  5: 25,
  10: 75,
  25: 250,
};

export const onUserActivated = onDocumentWritten(
  {
    region: "europe-west1",
    document: "users/{uid}",
  },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after  = event.data?.after?.data()  as any | undefined;
    if (!after) return; // deleted
    // On ne s’intéresse qu’au flip activated: false -> true
    const was = before?.activated === true;
    const is  = after?.activated === true;
    if (was || !is) return;

    const referrerId: string | undefined = after?.referrerId;
    if (!referrerId) return;

    const db = getFirestore();

    // Recompenses atomiques pour le parrain
    const referrerRef = db.collection("users").doc(referrerId);

    await db.runTransaction(async (tx) => {
      const refSnap = await tx.get(referrerRef);
      if (!refSnap.exists) return;

      const refData = refSnap.data() || {};
      const alreadyClaimed: number[] = Array.isArray(refData?.referral?.claimedMilestones)
        ? refData.referral.claimedMilestones
        : [];

      // 🔢 Compter les filleuls activés (robuste, côté serveur)
      const qSnap = await db
        .collection("users")
        .where("referrerId", "==", referrerId)
        .where("activated", "==", true)
        .count()
        .get();

      const activatedCount = qSnap.data().count;

      // Repère les nouveaux paliers franchis non encore crédités
      const newlyReached = MILESTONES.filter(
        (m) => activatedCount >= m && !alreadyClaimed.includes(m)
      );

      if (newlyReached.length === 0) {
        // Met quand même à jour le compteur côté parrain (utile pour l’app)
        tx.update(referrerRef, {
          "referral.activatedCount": activatedCount,
          "referral.updatedAt": FieldValue.serverTimestamp(),
        });
        return;
      }

      const totalBonus = newlyReached.reduce((sum, m) => sum + (MILESTONE_BONUS[m] || 0), 0);

      tx.update(referrerRef, {
        trophies: FieldValue.increment(totalBonus),
        "referral.activatedCount": activatedCount,
        "referral.claimedMilestones": FieldValue.arrayUnion(...newlyReached),
        "referral.lastBonus": totalBonus,
        "referral.updatedAt": FieldValue.serverTimestamp(),
      });

      // (Optionnel) petite notif serveur → collection notifications
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        userId: referrerId,
        title: "Palier atteint 🎉",
        body: `Tu viens de gagner +${totalBonus} trophées grâce à tes invitations !`,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "referral_milestone",
        meta: { milestones: newlyReached, activatedCount },
      });

      // (Optionnel) trace analytics serveur
      const appEventRef = db.collection("appEvents").doc();
      tx.set(appEventRef, {
        name: "ref_milestone_awarded",
        params: { referrerId, milestones: newlyReached, bonus: totalBonus, activatedCount },
        uid: referrerId,
        anonId: null,
        appVersion: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
);
