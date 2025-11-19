"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimReferralMilestone = void 0;
// functions/src/referralClaim.ts
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const ALLOWED = [5, 10, 25];
// Récompenses proposées (à ajuster si tu veux)
const REWARDS = {
    5: 20,
    10: 60,
    25: 200,
};
exports.claimReferralMilestone = (0, https_1.onCall)({ region: "europe-west1" }, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
        throw new Error("unauthenticated");
    }
    const milestone = Number(req.data?.milestone);
    if (!ALLOWED.includes(milestone)) {
        throw new Error("invalid_milestone");
    }
    const userRef = db.collection("users").doc(uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists)
            throw new Error("user_not_found");
        const data = snap.data() || {};
        const activatedCount = data?.referral?.activatedCount ?? 0;
        const claimed = Array.isArray(data?.referral?.claimedMilestones)
            ? data.referral.claimedMilestones
            : [];
        if (activatedCount < milestone)
            throw new Error("not_reached");
        if (claimed.includes(milestone))
            throw new Error("already_claimed");
        const reward = REWARDS[milestone] ?? 0;
        tx.update(userRef, {
            trophies: firestore_1.FieldValue.increment(reward),
            "referral.claimedMilestones": firestore_1.FieldValue.arrayUnion(milestone),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { ok: true };
});
