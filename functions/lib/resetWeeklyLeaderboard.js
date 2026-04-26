"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWeeklyLeaderboard = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
exports.resetWeeklyLeaderboard = (0, scheduler_1.onSchedule)({
    schedule: "every monday 00:01",
    timeZone: "UTC",
    region: "europe-west1",
}, async () => {
    // Snapshot du leaderboard all-time → copie en weekly_snapshot
    const leaderSnap = await db.collection("leaderboard").orderBy("trophies", "desc").limit(200).get();
    const batch = db.batch();
    // Archive la semaine passée
    const weekId = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    })();
    // Reset leaderboard_weekly
    const weeklySnap = await db.collection("leaderboard_weekly").get();
    weeklySnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[resetWeeklyLeaderboard] ✅ Reset semaine ${weekId}`);
});
