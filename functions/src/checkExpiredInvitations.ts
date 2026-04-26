import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const db = getFirestore();

export const checkExpiredInvitations = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "UTC",
    region: "europe-west1",
  },
  async () => {
    const now = Timestamp.now();
    const sevenDaysAgo = Timestamp.fromDate(
      new Date(now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000)
    );

    // ─── Cherche toutes les invitations pending créées il y a > 7 jours
    const expiredSnap = await db
      .collection("invitations")
      .where("status", "==", "pending")
      .where("createdAt", "<=", sevenDaysAgo)
      .get();

    if (expiredSnap.empty) {
      console.log("[checkExpiredInvitations] Aucune invitation expirée.");
      return;
    }

    console.log(
      `[checkExpiredInvitations] ${expiredSnap.size} invitation(s) expirée(s).`
    );

    const tasks: Promise<void>[] = [];

    for (const invDoc of expiredSnap.docs) {
      const inv = invDoc.data();
      const inviterId: string = inv.inviterId;
      const invitationId: string = invDoc.id;

      if (!inviterId) continue;

      tasks.push(
        (async () => {
          try {
            // 1. Marque l'invitation comme expirée
            await invDoc.ref.update({
              status: "expired",
              expiredAt: now,
            });

            // 2. Récupère l'état Forge depuis Firestore
            const forgeRef = db
              .collection("users")
              .doc(inviterId)
              .collection("forge")
              .doc(invitationId);

            const forgeSnap = await forgeRef.get();

            // Pas de Forge → pas de récompense, on s'arrête là
            if (!forgeSnap.exists) {
              console.log(
                `[checkExpiredInvitations] Pas de Forge pour invitation ${invitationId}`
              );
              return;
            }

            const forgeData = forgeSnap.data()!;

            // Idempotent — déjà claimed
            if (forgeData.rewardClaimed === true) return;

            const completedSteps: number[] = Array.isArray(forgeData.completedSteps)
              ? forgeData.completedSteps
              : [];

            // 3. Calcul prorata
            let trophies = 0;
            let earnedBadge = false;

            if (completedSteps.length === 1) trophies = 4;
            else if (completedSteps.length === 2) trophies = 7;
            else if (completedSteps.length >= 3) {
              trophies = 10;
              earnedBadge = true;
            }

            // 4. Attribue les trophées si > 0
            if (trophies > 0) {
              const userRef = db.collection("users").doc(inviterId);
              const updates: Record<string, any> = {
                trophies: FieldValue.increment(trophies),
                totalTrophies: FieldValue.increment(trophies),
                updatedAt: now,
              };

              if (earnedBadge) {
                updates["badges.forge"] = true;
                updates["badges.forgeEarnedAt"] = now;
              }

              await userRef.update(updates);
            }

            // 5. Marque la Forge comme claimed
            await forgeRef.update({
              rewardClaimed: true,
              rewardClaimedAt: now,
              rewardTrophies: trophies,
              rewardBadge: earnedBadge,
            });

            // 6. Envoie la notif push
            const userSnap = await db.collection("users").doc(inviterId).get();
            if (!userSnap.exists) return;

            const userData = userSnap.data()!;
            const fcmToken: string | undefined =
              userData.fcmToken || userData.expoPushToken;

            if (!fcmToken) return;

            const notifTitle =
              trophies === 0
                ? "Invitation expirée"
                : earnedBadge
                  ? 'Badge "Forgé" débloqué ! 🔥'
                  : `+${trophies} trophées gagnés 🏆`;

            const notifBody =
              trophies > 0
                ? "Ton invitation n'a pas été acceptée, mais tu gardes ta récompense Forge !"
                : "Ton invitation a expiré après 7 jours sans réponse.";

            await getMessaging().send({
              token: fcmToken,
              notification: {
                title: notifTitle,
                body: notifBody,
              },
              data: {
                type: "forge_expired",
                trophies: String(trophies),
                badge: String(earnedBadge),
              },
              apns: {
                payload: {
                  aps: { sound: "default", badge: 1 },
                },
              },
              android: {
                notification: { sound: "default", channelId: "default" },
              },
            });

            console.log(
              `[checkExpiredInvitations] ✅ ${invitationId} → ${trophies} trophées, badge=${earnedBadge}`
            );
          } catch (err) {
            console.error(
              `[checkExpiredInvitations] ❌ Erreur invitation ${invitationId}:`,
              err
            );
          }
        })()
      );
    }

    await Promise.allSettled(tasks);
  }
);