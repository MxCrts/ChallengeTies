"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserActivated = void 0;
// functions/src/referralRewards.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const MILESTONES = [5, 10, 25];
exports.onUserActivated = (0, firestore_1.onDocumentWritten)({
    region: "europe-west1",
    document: "users/{uid}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after)
        return; // deleted
    // ✅ On ne traite que les users activés avec un parrain
    const isActivated = !!after?.activated;
    if (!isActivated)
        return;
    const referrerId = after?.referrerId;
    if (!referrerId)
        return;
    // ✅ Anti double-traitement : si on a déjà une date d'activation, on sort
    const alreadyRecorded = !!before?.referral?.activatedAt;
    if (alreadyRecorded)
        return;
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
        // ⭐ NEW: force server-side activation to avoid race conditions
        tx.update(filleulRef, {
            activated: true,
            referral: {
                ...(after.referral || {}),
                activatedAt: firestore_2.FieldValue.serverTimestamp(),
            },
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        const refSnap = await tx.get(referrerRef);
        if (!refSnap.exists)
            return;
        const refData = refSnap.data() || {};
        const claimed = Array.isArray(refData?.referral?.claimedMilestones)
            ? refData.referral.claimedMilestones
            : [];
        const pending = Array.isArray(refData?.referral?.pendingMilestones)
            ? refData.referral.pendingMilestones
            : [];
        const newlyReached = MILESTONES.filter((m) => activatedCount >= m &&
            !claimed.includes(m) &&
            !pending.includes(m));
        // ✅ update stats + reward de base (1 seule fois par filleul)
        tx.update(referrerRef, {
            "referral.activatedCount": activatedCount,
            "referral.updatedAt": firestore_2.FieldValue.serverTimestamp(),
            trophies: firestore_2.FieldValue.increment(10),
            totalTrophies: firestore_2.FieldValue.increment(10),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        tx.update(filleulRef, {
            trophies: firestore_2.FieldValue.increment(10),
            totalTrophies: firestore_2.FieldValue.increment(10),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        if (newlyReached.length === 0)
            return;
        // ✅ unlock pending milestones
        tx.update(referrerRef, {
            "referral.pendingMilestones": firestore_2.FieldValue.arrayUnion(...newlyReached),
            "referral.lastUnlocked": newlyReached,
            "referral.updatedAt": firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // ✅ notif doc i18n (front ou worker push)
        const notifRef = db.collection("notifications").doc();
        tx.set(notifRef, {
            userId: referrerId,
            titleKey: "referral.notif.milestoneUnlocked.title",
            bodyKey: "referral.notif.milestoneUnlocked.body",
            params: {
                bonus: newlyReached.reduce((s, m) => s + (m === 5 ? 50 : m === 10 ? 100 : 300), 0),
                milestones: newlyReached,
                activatedCount,
            },
            createdAt: firestore_2.FieldValue.serverTimestamp(),
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
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
    });
});
