// functions/src/challenges.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const db = admin.firestore();

const incStat = async (uid: string, path: string, by = 1) =>
  db.doc(`users/${uid}`).update({ [`stats.${path}`]: admin.firestore.FieldValue.increment(by) });

/** 1) Count created challenges when they become approved */
export const onChallengeApproved = functions.firestore
  .document("challenges/{id}")
  .onUpdate(async (change, ctx) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (!before.approved && after.approved) {
      const creatorId = String(after.creatorId || "");
      if (!creatorId) return;
      await incStat(creatorId, "challengeCreated.total", 1);
      // optionnel: await checkForAchievements(...) côté serveur si tu l’as
    }
  });

/** 2) Count “adopted” milestones for creator when participantsCount hits thresholds */
const ADOPT_MILESTONES = [10, 50, 100];
export const onParticipantsMilestones = functions.firestore
  .document("challenges/{id}")
  .onUpdate(async (change, ctx) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const creatorId = String(after.creatorId || "");
    if (!creatorId) return;

    const prev = Number(before.participantsCount || 0);
    const curr = Number(after.participantsCount || 0);
    if (curr <= prev) return;

    // évite re-crédit: marque les paliers déjà passés
    const chRef = change.after.ref;
    const passed: string[] = Array.isArray(after._adoptPassed) ? after._adoptPassed : [];
    const newlyHit = ADOPT_MILESTONES.filter((m) => curr >= m && !passed.includes(String(m)));
    if (newlyHit.length === 0) return;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(chRef);
      const curPassed: string[] = Array.isArray(snap.get("_adoptPassed")) ? snap.get("_adoptPassed") : [];
      const add = newlyHit.filter((m) => !curPassed.includes(String(m)));
      if (add.length === 0) return;

      // 1 crédit par palier; si tu veux 1 seul total peu importe le palier, remplace par +1
      for (const _ of add) {
        tx.update(db.doc(`users/${creatorId}`), {
          "stats.challengeAdopted.total": admin.firestore.FieldValue.increment(1),
        });
      }
      tx.update(chRef, { _adoptPassed: admin.firestore.FieldValue.arrayUnion(...add.map(String)) });
    });
  });
