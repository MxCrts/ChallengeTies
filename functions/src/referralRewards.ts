// functions/src/referralRewards.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (!getApps().length) initializeApp();
const db = getFirestore();

const MILESTONES = [5, 10, 25] as const;

export const onUserActivated = onDocumentWritten(
  {
    region: "europe-west1",
    document: "users/{uid}",
  },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after  = event.data?.after?.data()  as any | undefined;
    if (!after) return; // deleted

    // only flip false -> true
    const wasActivated = before?.activated === true;
    const isActivated  = after?.activated === true;
    if (wasActivated || !isActivated) return;

    const referrerId: string | undefined = after?.referrerId;
    if (!referrerId) return;

    const referrerRef = db.collection("users").doc(referrerId);

    // 🔢 count activated referees (server truth)
    const qSnap = await db
      .collection("users")
      .where("referrerId", "==", referrerId)
      .where("activated", "==", true)
      .count()
      .get();

    const activatedCount = qSnap.data().count;

    await db.runTransaction(async (tx) => {
      const refSnap = await tx.get(referrerRef);
      if (!refSnap.exists) return;

      const refData = refSnap.data() || {};
      const claimed: number[] = Array.isArray(refData?.referral?.claimedMilestones)
        ? refData.referral.claimedMilestones
        : [];
      const pending: number[] = Array.isArray(refData?.referral?.pendingMilestones)
        ? refData.referral.pendingMilestones
        : [];

      const newlyReached = MILESTONES.filter(
        (m) =>
          activatedCount >= m &&
          !claimed.includes(m) &&
          !pending.includes(m)
      );

      // ✅ update stats always
      tx.update(referrerRef, {
        "referral.activatedCount": activatedCount,
        "referral.updatedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (newlyReached.length === 0) return;

      // ✅ unlock pending milestones
      tx.update(referrerRef, {
        "referral.pendingMilestones": FieldValue.arrayUnion(...newlyReached),
        "referral.lastUnlocked": newlyReached,
        "referral.updatedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ✅ notif doc i18n (front ou worker push)
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        userId: referrerId,
        titleKey: "referral.notif.milestoneUnlocked.title",
        bodyKey: "referral.notif.milestoneUnlocked.body",
        params: {
          bonus: newlyReached.reduce((s, m) => s + (m === 5 ? 20 : m === 10 ? 60 : 200), 0),
          milestones: newlyReached,
          activatedCount,
        },
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "referral_milestone_unlocked",
      });

      // ✅ trace analytics
      const appEventRef = db.collection("appEvents").doc();
      tx.set(appEventRef, {
        name: "ref_milestone_unlocked",
        params: { referrerId, milestones: newlyReached, activatedCount },
        uid: referrerId,
        anonId: null,
        appVersion: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
);
