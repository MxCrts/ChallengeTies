"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralOnUserWrite = void 0;
// functions/src/referralOnUserWrite.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const db = (0, firestore_2.getFirestore)();
/**
 * Donne +10 trophées au parrain quand un filleul est "activé"
 * - activated === true
 * - referrerId présent
 * - referralRewardGranted pas encore true
 */
exports.referralOnUserWrite = (0, firestore_1.onDocumentWritten)("users/{userId}", async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists)
        return;
    const afterData = after.data();
    const beforeData = event.data?.before?.exists
        ? event.data.before.data()
        : undefined;
    const userId = event.params.userId;
    const referrerId = afterData.referrerId;
    const activated = afterData.activated === true;
    const alreadyGranted = afterData.referralRewardGranted === true;
    // 🔒 Garde-fous
    if (!referrerId)
        return; // pas de parrain
    if (!activated)
        return; // pas encore activé
    if (alreadyGranted)
        return; // bonus déjà attribué
    if (referrerId === userId)
        return; // auto-parrainage (on ignore)
    try {
        await db.runTransaction(async (tx) => {
            const referrerRef = db.collection("users").doc(referrerId);
            const childRef = db.collection("users").doc(userId);
            // On recheck rapidement dans la transaction pour éviter
            // une course si jamais la doc a changé entre-temps
            const freshChildSnap = await tx.get(childRef);
            if (!freshChildSnap.exists)
                return;
            const freshChild = freshChildSnap.data();
            const freshActivated = freshChild.activated === true;
            const freshAlreadyGranted = freshChild.referralRewardGranted === true;
            if (!freshActivated || freshAlreadyGranted) {
                return;
            }
            // ✅ +10 trophées pour le parrain
            tx.set(referrerRef, {
                trophies: firestore_2.FieldValue.increment(10),
                totalTrophies: firestore_2.FieldValue.increment(10),
            }, { merge: true });
            // ✅ +10 trophées pour le FILLEUL (même logique)
            tx.set(childRef, {
                trophies: firestore_2.FieldValue.increment(10),
                totalTrophies: firestore_2.FieldValue.increment(10),
                referralRewardGranted: true, // on marque le bonus comme déjà attribué
            }, { merge: true });
        });
        console.log(`[referralOnUserWrite] +10 trophies pour parrain ${referrerId} via filleul ${userId}`);
    }
    catch (err) {
        console.error("[referralOnUserWrite] Transaction error:", err);
    }
});
