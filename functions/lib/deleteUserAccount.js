"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
exports.deleteUserAccount = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Not authenticated");
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    try {
        // 1. Supprime les données Firestore
        const batch = db.batch();
        // Document principal user
        batch.delete(db.doc(`users/${uid}`));
        // Username réservé
        const usernameSnap = await db
            .collection("usernames")
            .where("uid", "==", uid)
            .get();
        usernameSnap.docs.forEach((d) => batch.delete(d.ref));
        // Challenges
        const challenges = await db
            .collection("challenges")
            .where("participants", "array-contains", uid)
            .get();
        challenges.docs.forEach((d) => batch.delete(d.ref));
        // Invitations (duo)
        const invSent = await db
            .collection("invitations")
            .where("senderId", "==", uid)
            .get();
        invSent.docs.forEach((d) => batch.delete(d.ref));
        const invReceived = await db
            .collection("invitations")
            .where("receiverId", "==", uid)
            .get();
        invReceived.docs.forEach((d) => batch.delete(d.ref));
        // Matching pool + invitations matching
        const matchingPool = await db
            .collection("matching_pool")
            .where("uid", "==", uid)
            .get();
        matchingPool.docs.forEach((d) => batch.delete(d.ref));
        const matchingSent = await db
            .collection("matching_invitations")
            .where("senderId", "==", uid)
            .get();
        matchingSent.docs.forEach((d) => batch.delete(d.ref));
        const matchingReceived = await db
            .collection("matching_invitations")
            .where("receiverId", "==", uid)
            .get();
        matchingReceived.docs.forEach((d) => batch.delete(d.ref));
        // Global feed
        const feed = await db
            .collection("globalFeed")
            .where("uid", "==", uid)
            .get();
        feed.docs.forEach((d) => batch.delete(d.ref));
        // Leaderboard weekly
        batch.delete(db.doc(`leaderboard_weekly/${uid}`));
        await batch.commit();
        // 2. Supprime photo de profil Storage
        try {
            const bucket = (0, storage_1.getStorage)().bucket();
            await bucket.deleteFiles({ prefix: `avatars/${uid}` });
        }
        catch {
            // Pas bloquant
        }
        // 3. Supprime le compte Auth en dernier
        await auth.deleteUser(uid);
        return { success: true };
    }
    catch (error) {
        console.error("deleteUserAccount error:", error);
        throw new https_1.HttpsError("internal", "Failed to delete account");
    }
});
