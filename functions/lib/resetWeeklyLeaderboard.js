"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWeeklyLeaderboard = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekId() {
    // Lundi de la semaine en cours (UTC)
    const now = new Date();
    const dow = (now.getUTCDay() + 6) % 7; // 0=lundi
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - dow);
    monday.setUTCHours(0, 0, 0, 0);
    return [
        monday.getUTCFullYear(),
        String(monday.getUTCMonth() + 1).padStart(2, "0"),
        String(monday.getUTCDate()).padStart(2, "0"),
    ].join("-");
}
exports.resetWeeklyLeaderboard = (0, scheduler_1.onSchedule)({
    schedule: "every monday 00:01",
    timeZone: "UTC",
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "512MiB",
}, async () => {
    const weekId = getWeekId();
    console.log(`[resetWeeklyLeaderboard] ▶ Début reset semaine ${weekId}`);
    // ── 1. Récupère tous les users actifs (trophies > 0) ──────────────────────
    const usersSnap = await db
        .collection("users")
        .where("trophies", ">", 0)
        .get();
    console.log(`[resetWeeklyLeaderboard] ${usersSnap.size} users à traiter`);
    // ── 2. Calcule delta trophées = trophies - trophiesWeeklySnapshot ─────────
    //    et écrit dans leaderboard_weekly
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let opCount = 0;
    const weeklyRef = db.collection("leaderboard_weekly");
    // Supprime les anciens docs de leaderboard_weekly d'abord
    const oldWeeklySnap = await weeklyRef.get();
    for (const d of oldWeeklySnap.docs) {
        batch.delete(d.ref);
        opCount++;
        if (opCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }
    if (opCount > 0) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    }
    // Reconstruit leaderboard_weekly avec les deltas
    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const currentTrophies = Number(data.trophies ?? 0);
        const snapshot = Number(data.trophiesWeeklySnapshot ?? 0);
        const weeklyTrophies = Math.max(0, currentTrophies - snapshot);
        // N'ajoute que les users qui ont gagné des trophées cette semaine
        if (weeklyTrophies <= 0)
            continue;
        const entry = {
            uid: userDoc.id,
            username: data.username ?? "Unknown",
            trophies: weeklyTrophies, // trophées gagnés cette semaine
            totalTrophies: currentTrophies, // all-time pour info
            profileImage: data.profileImage ?? "",
            country: data.country ?? "",
            region: data.region ?? "",
            isPioneer: data.isPioneer ?? false,
            weekId,
            updatedAt: firestore_1.Timestamp.now(),
        };
        batch.set(weeklyRef.doc(userDoc.id), entry);
        opCount++;
        if (opCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }
    if (opCount > 0) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    }
    // ── 3. Reset le snapshot pour la semaine suivante ─────────────────────────
    //    Écrit trophiesWeeklySnapshot = trophies actuels sur chaque user
    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const currentTrophies = Number(data.trophies ?? 0);
        batch.update(userDoc.ref, {
            trophiesWeeklySnapshot: currentTrophies,
            trophiesWeeklySnapshotAt: firestore_1.Timestamp.now(),
            trophiesWeeklySnapshotWeekId: weekId,
        });
        opCount++;
        if (opCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }
    if (opCount > 0) {
        await batch.commit();
    }
    console.log(`[resetWeeklyLeaderboard] ✅ Reset semaine ${weekId} terminé`);
});
