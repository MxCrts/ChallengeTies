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
exports.onParticipantsMilestones = exports.onChallengeApproved = void 0;
// functions/src/challenges.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const incStat = async (uid, path, by = 1) => db.doc(`users/${uid}`).update({ [`stats.${path}`]: admin.firestore.FieldValue.increment(by) });
/** 1) Count created challenges when they become approved */
exports.onChallengeApproved = functions.firestore
    .document("challenges/{id}")
    .onUpdate(async (change, ctx) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (!before.approved && after.approved) {
        const creatorId = String(after.creatorId || "");
        if (!creatorId)
            return;
        await incStat(creatorId, "challengeCreated.total", 1);
        // optionnel: await checkForAchievements(...) côté serveur si tu l’as
    }
});
/** 2) Count “adopted” milestones for creator when participantsCount hits thresholds */
const ADOPT_MILESTONES = [10, 50, 100];
exports.onParticipantsMilestones = functions.firestore
    .document("challenges/{id}")
    .onUpdate(async (change, ctx) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const creatorId = String(after.creatorId || "");
    if (!creatorId)
        return;
    const prev = Number(before.participantsCount || 0);
    const curr = Number(after.participantsCount || 0);
    if (curr <= prev)
        return;
    // évite re-crédit: marque les paliers déjà passés
    const chRef = change.after.ref;
    const passed = Array.isArray(after._adoptPassed) ? after._adoptPassed : [];
    const newlyHit = ADOPT_MILESTONES.filter((m) => curr >= m && !passed.includes(String(m)));
    if (newlyHit.length === 0)
        return;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(chRef);
        const curPassed = Array.isArray(snap.get("_adoptPassed")) ? snap.get("_adoptPassed") : [];
        const add = newlyHit.filter((m) => !curPassed.includes(String(m)));
        if (add.length === 0)
            return;
        // 1 crédit par palier; si tu veux 1 seul total peu importe le palier, remplace par +1
        for (const _ of add) {
            tx.update(db.doc(`users/${creatorId}`), {
                "stats.challengeAdopted.total": admin.firestore.FieldValue.increment(1),
            });
        }
        tx.update(chRef, { _adoptPassed: admin.firestore.FieldValue.arrayUnion(...add.map(String)) });
    });
});
