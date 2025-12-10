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
const REWARDS = {
    5: 50,
    10: 100,
    25: 300,
};
exports.claimReferralMilestone = (0, https_1.onCall)({ region: "europe-west1" }, async (req) => {
    const uid = req.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "unauthenticated");
    const milestone = Number(req.data?.milestone);
    if (!ALLOWED.includes(milestone)) {
        throw new https_1.HttpsError("invalid-argument", "invalid_milestone");
    }
    const userRef = db.collection("users").doc(uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "user_not_found");
        const data = snap.data() || {};
        const activatedCount = data?.referral?.activatedCount ?? 0;
        const claimed = Array.isArray(data?.referral?.claimedMilestones)
            ? data.referral.claimedMilestones
            : [];
        const pending = Array.isArray(data?.referral?.pendingMilestones)
            ? data.referral.pendingMilestones
            : [];
        // sécurité serveur: doit être débloqué ET pending
        if (activatedCount < milestone) {
            throw new https_1.HttpsError("failed-precondition", "not_reached");
        }
        if (!pending.includes(milestone)) {
            // pas encore unlock côté serveur
            throw new https_1.HttpsError("failed-precondition", "not_unlocked");
        }
        if (claimed.includes(milestone)) {
            throw new https_1.HttpsError("already-exists", "already_claimed");
        }
        const reward = REWARDS[milestone] ?? 0;
        tx.update(userRef, {
            trophies: firestore_1.FieldValue.increment(reward),
            // move pending -> claimed
            "referral.claimedMilestones": firestore_1.FieldValue.arrayUnion(milestone),
            "referral.pendingMilestones": firestore_1.FieldValue.arrayRemove(milestone),
            "referral.lastClaimed": milestone,
            "referral.updatedAt": firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { ok: true };
});
