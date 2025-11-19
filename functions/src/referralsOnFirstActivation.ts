// functions/src/referralsOnFirstActivation.ts
import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

// Admin SDK (init une seule fois dans le projet — garde-le ici si pas déjà fait ailleurs)
try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

// ⚙️ Récompenses (tu peux ajuster)
const REF_TROPHY_PER_ACTIVATION = 10;
const MILESTONES = [5, 10, 25];
const MILESTONE_BONUS: Record<number, number> = {
  5: 50,
  10: 120,
  25: 400,
};

export const referralsOnFirstActivation = onDocumentWritten(
  {
    region: "europe-west1",
    document: "users/{userId}",
  },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after  = event.data?.after?.data()  as any | undefined;
    const userId = event.params.userId as string;

    if (!after) return;

    // Détection passage 0 -> 1 CurrentChallenge + parrain + pas encore "activated"
    const hadChallengesBefore =
      Array.isArray(before?.CurrentChallenges) && before!.CurrentChallenges.length > 0;
    const hasChallengesAfter =
      Array.isArray(after.CurrentChallenges) && after.CurrentChallenges.length > 0;

    const referrerId: string | undefined = after.referrerId;
    const wasActivated = !!before?.activated;
    const isActivatedNow = !!after?.activated;

    if (!referrerId) return;
    if (wasActivated || isActivatedNow) return;
    if (hadChallengesBefore) return;
    if (!hasChallengesAfter) return;

    const referrerRef = db.collection("users").doc(referrerId);
    const refereeRef  = db.collection("users").doc(userId);
    const statsRef    = db.collection("referrals").doc(referrerId);

    await db.runTransaction(async (tx) => {
      // 1) Marque le filleul "activated: true"
      tx.update(refereeRef, {
        activated: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2) Crédit du parrain
      const referrerSnap = await tx.get(referrerRef);
      if (!referrerSnap.exists) return; // parrain supprimé ?

      tx.update(referrerRef, {
        trophies: admin.firestore.FieldValue.increment(REF_TROPHY_PER_ACTIVATION),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3) Stats parrain
      const statsSnap = await tx.get(statsRef);
      const prevCount = statsSnap.exists ? (statsSnap.data()?.activatedCount || 0) : 0;
      const newCount  = prevCount + 1;

      if (!statsSnap.exists) {
        tx.set(statsRef, {
          activatedCount: 1,
          referees: [userId],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const referees: string[] = Array.isArray(statsSnap.data()?.referees)
          ? statsSnap.data()!.referees
          : [];
        if (!referees.includes(userId)) {
          tx.update(statsRef, {
            activatedCount: admin.firestore.FieldValue.increment(1),
            referees: admin.firestore.FieldValue.arrayUnion(userId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(statsRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      }

      // 4) Bonus palier si atteint
      if (MILESTONES.includes(newCount)) {
        const bonus = MILESTONE_BONUS[newCount] || 0;
        if (bonus > 0) {
          tx.update(referrerRef, {
            trophies: admin.firestore.FieldValue.increment(bonus),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.set(
            statsRef.collection("milestones").doc(String(newCount)),
            { reachedAt: admin.firestore.FieldValue.serverTimestamp(), bonus }
          );
        }
      }
    });

    // 5) (facultatif) traces analytics dans appEvents (lecture admin-only — OK avec tes rules)
    try {
      await db.collection("appEvents").add({
        name: "ref_reward_granted",
        params: {
          referrerId,
          refereeId: userId,
          perActivation: REF_TROPHY_PER_ACTIVATION,
        },
        uid: referrerId,
        anonId: null,
        appVersion: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {}

    try {
      const statsSnap = await db.collection("referrals").doc(referrerId).get();
      const countNow = statsSnap.exists ? (statsSnap.data()?.activatedCount || 0) : 0;
      if (MILESTONES.includes(countNow)) {
        await db.collection("appEvents").add({
          name: "ref_milestone_reached",
          params: { referrerId, milestone: countNow, bonus: MILESTONE_BONUS[countNow] || 0 },
          uid: referrerId,
          anonId: null,
          appVersion: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch {}

    return;
  }
);
