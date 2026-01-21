// functions/src/referralRewards.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

const MILESTONES = [5, 10, 25] as const;

export const onUserActivated = onDocumentWritten(
  {
    region: "europe-west1",
    document: "users/{uid}",
  },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after = event.data?.after?.data() as any | undefined;
    if (!after) return; // deleted

    // ✅ On ne traite que les users activés avec un parrain
    const isActivated = !!after?.activated;
    if (!isActivated) return;

    const referrerId: string | undefined = after?.referrerId;
    if (!referrerId) return;

    // ✅ Anti double-traitement béton :
    const alreadyRecorded =
      !!before?.referral?.activationProcessedAt ||
      !!after?.referral?.activationProcessedAt;
    if (alreadyRecorded) return;

    const referrerRef = db.collection("users").doc(referrerId);

    // 🔢 count activated referees (server truth)
    const qSnap = await db
      .collection("users")
      .where("referrerId", "==", referrerId)
      .where("activated", "==", true)
      .count()
      .get();

    const activatedCount = qSnap.data().count;

    const FILLEUL_ID = event.params.uid;
    const filleulRef = db.collection("users").doc(FILLEUL_ID);

    await db.runTransaction(async (tx) => {
      // ✅ Re-check en transaction (retries safe)
      const filleulSnap = await tx.get(filleulRef);
      if (!filleulSnap.exists) return;

      const filleulData = filleulSnap.data() as any;
      if (filleulData?.referral?.activationProcessedAt) return;

      // ⭐ Marque l’activation UNE SEULE FOIS
      tx.update(filleulRef, {
        activated: true,
        "referral.activationProcessedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

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
        (m) => activatedCount >= m && !claimed.includes(m) && !pending.includes(m)
      );

      // ✅ update stats + reward de base (1 seule fois par filleul)
      tx.update(referrerRef, {
        "referral.activatedCount": activatedCount,
        "referral.updatedAt": FieldValue.serverTimestamp(),
        trophies: FieldValue.increment(10),
        totalTrophies: FieldValue.increment(10),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(filleulRef, {
        trophies: FieldValue.increment(10),
        totalTrophies: FieldValue.increment(10),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ------------------------------------------------------------------
      // 🆕 NOTIF : nouveau filleul activé (doc i18n)
      // ------------------------------------------------------------------
      const childUsername =
        after?.username ||
        after?.displayName ||
        (typeof after?.email === "string" ? after.email.split("@")[0] : null) ||
        (typeof filleulData?.username === "string" ? filleulData.username : null) ||
        "New player";

      const newChildNotifRef = db.collection("notifications").doc();
      tx.set(newChildNotifRef, {
        userId: referrerId,
        titleKey: "referral.notif.newChild.title",
        bodyKey: "referral.notif.newChild.body",
        params: { username: childUsername, activatedCount },
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "referral_new_child",
      });

      // ------------------------------------------------------------------
      // Milestones : unlock + notif milestoneUnlocked (si applicable)
      // ------------------------------------------------------------------
      if (newlyReached.length > 0) {
        tx.update(referrerRef, {
          "referral.pendingMilestones": FieldValue.arrayUnion(...newlyReached),
          "referral.lastUnlocked": newlyReached,
          "referral.updatedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const notifRef = db.collection("notifications").doc();
        tx.set(notifRef, {
          userId: referrerId,
          titleKey: "referral.notif.milestoneUnlocked.title",
          bodyKey: "referral.notif.milestoneUnlocked.body",
          params: {
            bonus: newlyReached.reduce(
              (s, m) => s + (m === 5 ? 50 : m === 10 ? 100 : 300),
              0
            ),
            milestones: newlyReached,
            activatedCount,
          },
          createdAt: FieldValue.serverTimestamp(),
          read: false,
          type: "referral_milestone_unlocked",
        });

        const appEventRef = db.collection("appEvents").doc();
        tx.set(appEventRef, {
          name: "ref_milestone_unlocked",
          params: { referrerId, milestones: newlyReached, activatedCount },
          uid: referrerId,
          anonId: null,
          appVersion: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }
);
