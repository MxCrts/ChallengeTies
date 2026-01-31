// functions/src/notificationsPush.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import Expo from "expo-server-sdk";

const db = getFirestore();
const expo = new Expo();

/**
 * Rate limit par type (ms)
 * - referral_new_child: 10 min + DIGEST
 * - referral_milestone_unlocked: 2 min (simple RL)
 */
const RATE_LIMIT_MS: Record<string, number> = {
  referral_new_child: 10 * 60 * 1000,
  referral_milestone_unlocked: 2 * 60 * 1000,
};

const DIGEST_ENABLED: Record<string, boolean> = {
  referral_new_child: true,
};

function getRateLimitMs(type?: string): number {
  if (!type) return 0;
  return RATE_LIMIT_MS[type] ?? 0;
}

function isDigestEnabled(type?: string): boolean {
  if (!type) return false;
  return !!DIGEST_ENABLED[type];
}

// ---------------- i18n minimal (tu peux brancher ton système ensuite) ----------------
function renderNotification(
  lang: string,
  titleKey: string,
  bodyKey: string,
  params: Record<string, any>
): { title: string; body: string } {
  const L = (lang || "en").slice(0, 2);

  const dict: Record<string, any> = {
    fr: {
      "referral.notif.newChild.title": "Parrainage activé 🎉",
      "referral.notif.newChild.body":
        "🔥 {{username}} a rejoint ChallengeTies. +10 trophées. Total activés : {{activatedCount}}.",
      "referral.notif.milestoneUnlocked.title": "Palier débloqué 🏆",
      "referral.notif.milestoneUnlocked.body":
        "Tu as débloqué un bonus de {{bonus}} trophées. Paliers : {{milestones}}. Activés : {{activatedCount}}.",

      // ✅ Digest
      "referral.notif.newChildDigest.title": "Parrainage : +{{count}} 🎉",
      "referral.notif.newChildDigest.body":
        "Tu as {{count}} nouveau(x) filleul(s) activé(s) en quelques minutes. Dernier : {{lastUsername}}.",
    },
    en: {
      "referral.notif.newChild.title": "Referral activated 🎉",
      "referral.notif.newChild.body":
        "🔥 {{username}} joined ChallengeTies. +10 trophies. Activated total: {{activatedCount}}.",
      "referral.notif.milestoneUnlocked.title": "Milestone unlocked 🏆",
      "referral.notif.milestoneUnlocked.body":
        "You unlocked {{bonus}} bonus trophies. Milestones: {{milestones}}. Activated: {{activatedCount}}.",

      // ✅ Digest
      "referral.notif.newChildDigest.title": "Referrals: +{{count}} 🎉",
      "referral.notif.newChildDigest.body":
        "You got {{count}} new activated referral(s). Latest: {{lastUsername}}.",
    },
  };

  const pack = dict[L] || dict.en;
  const titleTpl = pack[titleKey] || titleKey;
  const bodyTpl = pack[bodyKey] || bodyKey;

  const safeParams = { ...params };
  if (Array.isArray(safeParams.milestones)) safeParams.milestones = safeParams.milestones.join(", ");

  const apply = (tpl: string) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      safeParams?.[k] != null ? String(safeParams[k]) : ""
    );

  return { title: apply(titleTpl), body: apply(bodyTpl) };
}

type Decision =
  | { mode: "skip"; reason: string }
  | { mode: "send_single" }
  | { mode: "send_digest"; digest: { count: number; lastUsername: string } };

export const onNotificationCreatedSendPush = onDocumentCreated(
  {
    region: "europe-west1",
    document: "notifications/{notifId}",
  },
  async (event) => {
    const notifId = event.params.notifId as string;
    const notifSnap = event.data;
    const data = notifSnap?.data() as any;
    if (!data) return;

    // ✅ Anti double-handling
    if (data.sentAt || data.suppressedAt) return;

    const userId: string | undefined = data.userId;
    if (!userId) return;

    const type: string = data.type || "generic";
    const windowMs = getRateLimitMs(type);

    const userRef = db.collection("users").doc(userId);
    const notifRef = db.collection("notifications").doc(notifId);

    // ------------------------------------------------------------
    // ✅ DECISION (transaction) : single / digest / skip
    // ------------------------------------------------------------
    let decision: Decision = { mode: "send_single" };

    if (windowMs > 0) {
      const now = Date.now();

      decision = await db.runTransaction(async (tx) => {
        const [uSnap, nSnap] = await Promise.all([tx.get(userRef), tx.get(notifRef)]);
        if (!uSnap.exists) return { mode: "skip", reason: "user_not_found" } as const;
        if (!nSnap.exists) return { mode: "skip", reason: "notif_deleted" } as const;

        const n = nSnap.data() as any;
        if (n.sentAt || n.suppressedAt) return { mode: "skip", reason: "already_handled" } as const;

        const u = uSnap.data() as any;

        if (u?.notificationsEnabled === false) {
          tx.update(notifRef, {
            suppressedAt: FieldValue.serverTimestamp(),
            suppressedReason: "notifications_disabled",
          });
          return { mode: "skip", reason: "notifications_disabled" } as const;
        }

        const lastSingleTs: Timestamp | undefined =
          u?.debugPush?.lastPushAtByType?.[type] || undefined;

        const lastSingle = lastSingleTs ? lastSingleTs.toMillis() : 0;

        // ✅ Si on peut envoyer un single (hors fenêtre) -> on réserve
        if (!lastSingle || now - lastSingle >= windowMs) {
          tx.update(userRef, {
            [`debugPush.lastPushAtByType.${type}`]: FieldValue.serverTimestamp(),
            "debugPush.lastPushType": type,
            "debugPush.updatedAt": FieldValue.serverTimestamp(),
          });
          return { mode: "send_single" } as const;
        }

        // ----------------------------------------------------------------
        // ✅ Sinon : rate-limited
        //    - si digest activé : on queue et éventuellement on déclenche un digest
        //    - sinon : on suppress "rate_limited"
        // ----------------------------------------------------------------
        if (!isDigestEnabled(type)) {
          tx.update(notifRef, {
            suppressedAt: FieldValue.serverTimestamp(),
            suppressedReason: "rate_limited",
            suppressedMeta: { type, windowMs, lastMsAgo: now - lastSingle },
          });
          return { mode: "skip", reason: "rate_limited" } as const;
        }

        // ✅ DIGEST QUEUE
        const lastUsername =
          (typeof n?.params?.username === "string" && n.params.username) || "Someone";

        const digestPathBase = `debugPush.digestByType.${type}`;
        const pending: number = Number(u?.debugPush?.digestByType?.[type]?.pendingCount || 0);
        const lastDigestSentTs: Timestamp | undefined =
          u?.debugPush?.digestByType?.[type]?.lastDigestSentAt || undefined;

        const lastDigestSent = lastDigestSentTs ? lastDigestSentTs.toMillis() : 0;

        const nextPending = pending + 1;

        // On supprime le push individuel, mais on garde la notif in-app
        tx.update(notifRef, {
          suppressedAt: FieldValue.serverTimestamp(),
          suppressedReason: "digest_queued",
          suppressedMeta: { type, windowMs },
        });

        // On stocke le digest state
        tx.update(userRef, {
          [`${digestPathBase}.pendingCount`]: nextPending,
          [`${digestPathBase}.lastUsername`]: lastUsername,
          [`${digestPathBase}.updatedAt`]: FieldValue.serverTimestamp(),
        });

        // ✅ Si fenêtre digest dépassée, on déclenche un digest maintenant
        if (!lastDigestSent || now - lastDigestSent >= windowMs) {
          tx.update(userRef, {
            [`${digestPathBase}.lastDigestSentAt`]: FieldValue.serverTimestamp(),
            [`${digestPathBase}.pendingCount`]: 0, // reset (réservation anti double)
          });

          return {
            mode: "send_digest",
            digest: { count: nextPending, lastUsername },
          } as const;
        }

        return { mode: "skip", reason: "digest_queued" } as const;
      });

      if (decision.mode === "skip") return;
    }

    // ------------------------------------------------------------
    // ✅ Fetch user + tokens + lang (pour envoyer push)
    // ------------------------------------------------------------
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;
    const user = userSnap.data() as any;

    if (user?.notificationsEnabled === false) {
      await notifRef.update({
        suppressedAt: FieldValue.serverTimestamp(),
        suppressedReason: "notifications_disabled",
      });
      return;
    }

    const tokens: string[] = Array.isArray(user.expoPushTokens)
      ? user.expoPushTokens
      : typeof user.expoPushToken === "string"
      ? [user.expoPushToken]
      : [];

    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) {
      await notifRef.update({
        suppressedAt: FieldValue.serverTimestamp(),
        suppressedReason: "no_expo_token",
      });
      return;
    }

    const lang =
      (typeof user.language === "string" && user.language) ||
      (typeof user.lang === "string" && user.lang) ||
      "en";

    // ------------------------------------------------------------
    // ✅ Build payload : single vs digest
    // ------------------------------------------------------------
    let title = "";
    let body = "";
    let pushType = type;
    let pushData: Record<string, any> = { type: pushType, notifId };

    if (decision.mode === "send_digest") {
      const { count, lastUsername } = decision.digest;

      const rendered = renderNotification(
        lang,
        "referral.notif.newChildDigest.title",
        "referral.notif.newChildDigest.body",
        { count, lastUsername }
      );

      title = rendered.title;
      body = rendered.body;

      pushType = "referral_new_child_digest";
      pushData = { type: pushType, count, lastUsername };
    } else {
      // send_single (notif normale)
      const titleKey: string = data.titleKey || "";
      const bodyKey: string = data.bodyKey || "";
      const params: Record<string, any> = data.params || {};

      const rendered = renderNotification(lang, titleKey, bodyKey, params);
      title = rendered.title;
      body = rendered.body;

      pushData = { type: pushType, notifId, ...params };
    }

    const messages = validTokens.map((to) => ({
      to,
      title,
      body,
      sound: "default" as const,
      data: pushData,
    }));

    try {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        await expo.sendPushNotificationsAsync(chunk);
      }

      // ✅ On marque sentAt seulement pour les singles.
      // Les digests sont “système” et ne correspondent pas à la notif doc.
      if (decision.mode === "send_single") {
        await notifRef.update({
          sentAt: FieldValue.serverTimestamp(),
        });
      } else {
        // option: log/debug
        await userRef.update({
          "debugPush.lastDigestType": type,
          "debugPush.lastDigestAt": FieldValue.serverTimestamp(),
        });
      }
    } catch (e: any) {
      if (decision.mode === "send_single") {
        await notifRef.update({
          sendError: String(e?.message || e),
          sendErrorAt: FieldValue.serverTimestamp(),
        });
      } else {
        await userRef.update({
          "debugPush.lastDigestError": String(e?.message || e),
          "debugPush.lastDigestErrorAt": FieldValue.serverTimestamp(),
        });
      }
    }
  }
);
