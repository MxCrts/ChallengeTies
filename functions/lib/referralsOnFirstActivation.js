"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralsOnFirstActivation = void 0;
// functions/src/referralsOnFirstActivation.ts
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
// Admin SDK (init une seule fois dans le projet — garde-le ici si pas déjà fait ailleurs)
try {
    admin.app();
}
catch {
    admin.initializeApp();
}
const db = admin.firestore();
// ⚙️ Récompenses (tu peux ajuster)
const REF_TROPHY_PER_ACTIVATION = 10;
const MILESTONES = [5, 10, 25];
const MILESTONE_BONUS = {
    5: 50,
    10: 120,
    25: 400,
};
exports.referralsOnFirstActivation = (0, firestore_1.onDocumentWritten)({
    region: "europe-west1",
    document: "users/{userId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const userId = event.params.userId;
    if (!after)
        return;
    // Détection passage 0 -> 1 CurrentChallenge + parrain + pas encore "activated"
    const hadChallengesBefore = Array.isArray(before?.CurrentChallenges) && before.CurrentChallenges.length > 0;
    const hasChallengesAfter = Array.isArray(after.CurrentChallenges) && after.CurrentChallenges.length > 0;
    const referrerId = after.referrerId;
    const wasActivated = !!before?.activated;
    const isActivatedNow = !!after?.activated;
    if (!referrerId)
        return;
    if (wasActivated || isActivatedNow)
        return;
    if (hadChallengesBefore)
        return;
    if (!hasChallengesAfter)
        return;
    const referrerRef = db.collection("users").doc(referrerId);
    const refereeRef = db.collection("users").doc(userId);
    const statsRef = db.collection("referrals").doc(referrerId);
    await db.runTransaction(async (tx) => {
        // 1) Marque le filleul "activated: true"
        tx.update(refereeRef, {
            activated: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 2) Crédit du parrain
        const referrerSnap = await tx.get(referrerRef);
        if (!referrerSnap.exists)
            return; // parrain supprimé ?
        tx.update(referrerRef, {
            trophies: admin.firestore.FieldValue.increment(REF_TROPHY_PER_ACTIVATION),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 3) Stats parrain
        const statsSnap = await tx.get(statsRef);
        const prevCount = statsSnap.exists ? (statsSnap.data()?.activatedCount || 0) : 0;
        const newCount = prevCount + 1;
        if (!statsSnap.exists) {
            tx.set(statsRef, {
                activatedCount: 1,
                referees: [userId],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            const referees = Array.isArray(statsSnap.data()?.referees)
                ? statsSnap.data().referees
                : [];
            if (!referees.includes(userId)) {
                tx.update(statsRef, {
                    activatedCount: admin.firestore.FieldValue.increment(1),
                    referees: admin.firestore.FieldValue.arrayUnion(userId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            else {
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
                tx.set(statsRef.collection("milestones").doc(String(newCount)), { reachedAt: admin.firestore.FieldValue.serverTimestamp(), bonus });
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
    }
    catch { }
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
    }
    catch { }
    return;
});
