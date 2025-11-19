"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserActivated = void 0;
// functions/src/referralRewards.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const MILESTONES = [5, 10, 25]; // tes paliers
const MILESTONE_BONUS = {
    5: 25,
    10: 75,
    25: 250,
};
exports.onUserActivated = (0, firestore_1.onDocumentWritten)({
    region: "europe-west1",
    document: "users/{uid}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after)
        return; // deleted
    // On ne s’intéresse qu’au flip activated: false -> true
    const was = before?.activated === true;
    const is = after?.activated === true;
    if (was || !is)
        return;
    const referrerId = after?.referrerId;
    if (!referrerId)
        return;
    const db = (0, firestore_2.getFirestore)();
    // Recompenses atomiques pour le parrain
    const referrerRef = db.collection("users").doc(referrerId);
    await db.runTransaction(async (tx) => {
        const refSnap = await tx.get(referrerRef);
        if (!refSnap.exists)
            return;
        const refData = refSnap.data() || {};
        const alreadyClaimed = Array.isArray(refData?.referral?.claimedMilestones)
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
        const newlyReached = MILESTONES.filter((m) => activatedCount >= m && !alreadyClaimed.includes(m));
        if (newlyReached.length === 0) {
            // Met quand même à jour le compteur côté parrain (utile pour l’app)
            tx.update(referrerRef, {
                "referral.activatedCount": activatedCount,
                "referral.updatedAt": firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        const totalBonus = newlyReached.reduce((sum, m) => sum + (MILESTONE_BONUS[m] || 0), 0);
        tx.update(referrerRef, {
            trophies: firestore_2.FieldValue.increment(totalBonus),
            "referral.activatedCount": activatedCount,
            "referral.claimedMilestones": firestore_2.FieldValue.arrayUnion(...newlyReached),
            "referral.lastBonus": totalBonus,
            "referral.updatedAt": firestore_2.FieldValue.serverTimestamp(),
        });
        // (Optionnel) petite notif serveur → collection notifications
        const notifRef = db.collection("notifications").doc();
        tx.set(notifRef, {
            userId: referrerId,
            title: "Palier atteint 🎉",
            body: `Tu viens de gagner +${totalBonus} trophées grâce à tes invitations !`,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
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
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
    });
});
