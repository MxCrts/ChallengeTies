import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// admin.initializeApp() est appelé dans index.ts

type AcceptMatchingParams = {
  inviteId: string;
};

type AcceptMatchingResult = {
  ok: boolean;
  reason?: string;
};

function dayKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const acceptMatchingInvitation = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Non authentifié.");
    }
    const me = request.auth.uid;
    const { inviteId } = request.data as AcceptMatchingParams;
    if (!inviteId || typeof inviteId !== "string") {
      throw new HttpsError("invalid-argument", "inviteId manquant.");
    }

    const db = admin.firestore();

    try {
      // ── 1) Lire l'invitation ──────────────────────────────────
      const invRef = db.doc(`matching_invitations/${inviteId}`);
      const invSnap = await invRef.get();

      if (!invSnap.exists) {
        throw new HttpsError("not-found", "invitation_introuvable");
      }

      const inv = invSnap.data() as any;

      // Checks métier
      if (inv.inviteeId !== me) {
        throw new HttpsError("permission-denied", "non_autorise");
      }
      if (inv.status !== "pending") {
        throw new HttpsError("failed-precondition", "invitation_deja_traitee");
      }

      // Check expiration
      const expiresAt = inv.expiresAt as admin.firestore.Timestamp | null;
      if (expiresAt && expiresAt.toMillis() < Date.now()) {
        throw new HttpsError("deadline-exceeded", "expired");
      }

      // ── 2) Lire les données nécessaires en parallèle ─────────
      const [inviterSnap, inviteeSnap, chSnap] = await Promise.all([
        db.doc(`users/${inv.inviterId}`).get(),
        db.doc(`users/${me}`).get(),
        db.doc(`challenges/${inv.challengeId}`).get(),
      ]);

      if (!inviterSnap.exists || !inviteeSnap.exists) {
        throw new HttpsError("not-found", "utilisateur_introuvable");
      }
      if (!chSnap.exists) {
        throw new HttpsError("not-found", "challenge_introuvable");
      }

      const inviterData = inviterSnap.data() as any;
      const inviteeData = inviteeSnap.data() as any;
      const ch = chSnap.data() as any;

      // ── 3) Construire le duo ──────────────────────────────────
      const pairKey = [inv.inviterId, me].sort().join("-");
      const uniqueKey = `${inv.challengeId}_${inv.selectedDays}_${pairKey}`;
      const now = new Date();

      const duoBase = {
        challengeId: inv.challengeId,
        id: inv.challengeId,
        title: ch.title || inv.challengeTitle,
        description: ch.description || "",
        imageUrl: ch.imageUrl || "",
        chatId: ch.chatId || inv.challengeId,
        selectedDays: inv.selectedDays,
        completedDays: 0,
        completionDates: [],
        completionDateKeys: [],
        lastMarkedDate: null,
        lastMarkedKey: null,
        streak: 0,
        duo: true,
        uniqueKey,
        startedAt: now.toISOString(),
        startedKey: dayKeyUTC(now),
        seasonal: !!ch.seasonal,
        ...(ch.category ? { category: ch.category } : {}),
      };

      // Nettoyer les anciennes entrées pour ce challenge
      const inviteeChallenges: any[] = Array.isArray(inviteeData?.CurrentChallenges)
        ? inviteeData.CurrentChallenges
        : [];
      const inviterChallenges: any[] = Array.isArray(inviterData?.CurrentChallenges)
        ? inviterData.CurrentChallenges
        : [];

      const filteredInvitee = inviteeChallenges.filter(
        (c: any) => (c?.challengeId ?? c?.id) !== inv.challengeId
      );
      const filteredInviter = inviterChallenges.filter(
        (c: any) => (c?.challengeId ?? c?.id) !== inv.challengeId
      );

      const duoForInvitee = {
        ...duoBase,
        duoPartnerId: inv.inviterId,
        duoPartnerUsername: inviterData?.username || inviterData?.displayName || null,
      };

      const duoForInviter = {
        ...duoBase,
        duoPartnerId: me,
        duoPartnerUsername: inviteeData?.username || inviteeData?.displayName || null,
      };

      // ── 4) Batch atomique Admin SDK ───────────────────────────
      // Admin SDK bypass les rules → cross-user write possible
      const batch = db.batch();

      // Mettre à jour l'invitation
      batch.update(invRef, {
        status: "accepted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // CurrentChallenges de l'invité (= me)
      batch.update(db.doc(`users/${me}`), {
        CurrentChallenges: [...filteredInvitee, duoForInvitee],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // CurrentChallenges de l'inviteur (cross-user — impossible côté client)
      batch.update(db.doc(`users/${inv.inviterId}`), {
        CurrentChallenges: [...filteredInviter, duoForInviter],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // ── 5) Mettre à jour le matching pool (non-bloquant) ─────
      const updatePool = async (uid: string) => {
        try {
          const userSnap = await db.doc(`users/${uid}`).get();
          if (!userSnap.exists) return;
          const userData = userSnap.data() as any;

          const currentChallenges: any[] = Array.isArray(userData?.CurrentChallenges)
            ? userData.CurrentChallenges
            : [];

          const ids: string[] = [];
          const cats = new Set<string>();
          for (const c of currentChallenges) {
            const cid = c?.challengeId ?? c?.id;
            if (!cid || c?.duo) continue;
            const sel = Number(c?.selectedDays ?? 0);
            const done = Number(c?.completedDays ?? 0);
            if (sel > 0 && done >= sel) continue;
            ids.push(String(cid));
            if (c?.category) cats.add(String(c.category));
          }

          let completedCount = 0;
          const completedChallenges: any[] = Array.isArray(userData?.CompletedChallenges)
            ? userData.CompletedChallenges
            : [];
          completedCount += completedChallenges.length;
          for (const c of currentChallenges) {
            const sel = Number(c?.selectedDays ?? 0);
            const done = Number(c?.completedDays ?? 0);
            if (sel > 0 && done >= sel) completedCount++;
          }

          await db.doc(`matching_pool/${uid}`).set({
            uid,
            username: userData?.username || userData?.displayName || "User",
            profileImage: userData?.profileImage || null,
            region: userData?.region || null,
            completedChallengesCount: completedCount,
            currentChallengeIds: ids,
            currentChallengeCategories: Array.from(cats),
            challengeCategories: Array.isArray(userData?.challengeCategories)
              ? userData.challengeCategories
              : [],
            duoAvailable: userData?.duoAvailable === true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.warn(`updatePool(${uid}) failed:`, e);
        }
      };

      // Non-bloquant
      Promise.all([updatePool(me), updatePool(inv.inviterId)]).catch(() => {});

      // ── 6) Push notification vers l'inviteur ─────────────────
      try {
        const inviterToken = inviterData?.expoPushToken;
        const inviterLang = String(inviterData?.language || "en").split("-")[0].toLowerCase();
        const inviteeUsername = inviteeData?.username || inviteeData?.displayName || "Someone";
        const challengeTitle = ch.title || inv.challengeTitle || "challenge";

        if (inviterToken && inviterData?.notificationsEnabled !== false) {
          const TEXTS: Record<string, { title: string; body: string }> = {
            fr: { title: "Binôme accepté ! 🔥", body: `${inviteeUsername} a accepté «${challengeTitle}» avec toi !` },
            en: { title: "Duo accepted! 🔥", body: `${inviteeUsername} accepted «${challengeTitle}» with you!` },
            de: { title: "Duo akzeptiert! 🔥", body: `${inviteeUsername} hat «${challengeTitle}» mit dir angenommen!` },
            es: { title: "¡Dúo aceptado! 🔥", body: `${inviteeUsername} aceptó «${challengeTitle}» contigo.` },
            it: { title: "Duo accettato! 🔥", body: `${inviteeUsername} ha accettato «${challengeTitle}» con te!` },
            pt: { title: "Duo aceite! 🔥", body: `${inviteeUsername} aceitou «${challengeTitle}» com você!` },
            nl: { title: "Duo geaccepteerd! 🔥", body: `${inviteeUsername} accepteerde «${challengeTitle}» met jou!` },
            ru: { title: "Дуэт принят! 🔥", body: `${inviteeUsername} принял «${challengeTitle}» с тобой!` },
            ar: { title: "تم قبول الثنائي! 🔥", body: `${inviteeUsername} قبل «${challengeTitle}» معك!` },
            zh: { title: "搭档已接受！🔥", body: `${inviteeUsername} 接受了《${challengeTitle}》！` },
            ja: { title: "デュオ承認！🔥", body: `${inviteeUsername}が「${challengeTitle}」を承認しました！` },
            ko: { title: "듀오 수락! 🔥", body: `${inviteeUsername}님이 «${challengeTitle}»를 수락했습니다!` },
            hi: { title: "डुओ स्वीकार! 🔥", body: `${inviteeUsername} ने «${challengeTitle}» स्वीकार किया!` },
          };

          const texts = TEXTS[inviterLang] || TEXTS["en"];

          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              to: inviterToken,
              title: texts.title,
              body: texts.body,
              sound: "default",
              data: {
                type: "matching_invite",
                kind: "matching_invite_accepted",
                challengeId: inv.challengeId,
                inviteId,
              },
            }),
          });
        }
      } catch (pushErr) {
        // Non-bloquant
        console.warn("Push notification failed (non-bloquant):", pushErr);
      }

      return { ok: true };

    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      console.error("acceptMatchingInvitation error:", e?.message || e);
      throw new HttpsError("internal", "Erreur interne.");
    }
  });

// ================================================================
// DANS TON functions/src/index.ts, ajoute :
// export { acceptMatchingInvitation } from "./acceptMatchingInvitation";
// ================================================================
