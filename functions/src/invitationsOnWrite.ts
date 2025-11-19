// functions/src/invitationsOnWrite.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();
const db = getFirestore();

type InvitationStatus = "pending" | "accepted" | "refused" | "cancelled";
type InvitationKind = "open" | "direct";

interface Invitation {
  challengeId: string;
  inviterId: string;
  inviteeId: string | null;
  inviteeUsername?: string | null;
  selectedDays: number;
  status: InvitationStatus;
  kind: InvitationKind;
  lastStatusNotified?: InvitationStatus | null; // 👈 anti-doublon
}

function titleFor(lang: string | undefined) {
  const L = (lang || "en").toLowerCase();
  switch (L) {
    case "fr":
    case "es":
    case "de":
    case "it":
      return "ChallengeTies";
    default:
      return "ChallengeTies";
  }
}

function bodyFor(
  status: InvitationStatus,
  lang: string | undefined,
  inviteeUsername?: string | null,
  challengeTitle?: string | null
) {
  const name = inviteeUsername || "Your partner";
  const ct = challengeTitle ? ` « ${challengeTitle} »` : "";
  const L = (lang || "en").toLowerCase();

  if (status === "accepted") {
    switch (L) {
      case "fr": return `${name} a accepté ton invitation${ct} 🎉`;
      case "es": return `${name} aceptó tu invitación${ct} 🎉`;
      case "de": return `${name} hat deine Einladung${ct} angenommen 🎉`;
      case "it": return `${name} ha accettato il tuo invito${ct} 🎉`;
      default:   return `${name} accepted your invitation${ct} 🎉`;
    }
  }
  if (status === "refused") {
    switch (L) {
      case "fr": return `${name} a refusé ton invitation${ct} 🙏`;
      case "es": return `${name} rechazó tu invitación${ct} 🙏`;
      case "de": return `${name} hat deine Einladung${ct} abgelehnt 🙏`;
      case "it": return `${name} ha rifiutato il tuo invito${ct} 🙏`;
      default:   return `${name} refused your invitation${ct} 🙏`;
    }
  }
  return "";
}

async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json",
    },
    body: JSON.stringify({ to, sound: "default", title, body, data }),
  });

  const json = (await resp.json().catch(() => null)) as any;
  const d = json?.data;
  if (d?.status === "ok") return { ok: true as const };

  const code = d?.details?.error || d?.__errorCode || undefined;
  return { ok: false as const, code, message: d?.message, details: d?.details };
}

/**
 * Envoie une notif à l’INVITEUR quand une invitation passe de "pending" → "accepted" | "refused".
 * Idempotent grâce à lastStatusNotified.
 */
export const invitationsOnWrite = onDocumentWritten(
  { region: "europe-west1", document: "invitations/{inviteId}" },
  async (event) => {
    const before = event.data?.before?.data() as Invitation | undefined;
    const after = event.data?.after?.data() as Invitation | undefined;
    const inviteId = event.params?.inviteId as string;

    // On ne traite que les mises à jour
    if (!before || !after) return;

    // Doit venir de "pending" et aller vers "accepted" ou "refused"
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "refused") return;

    // Anti-doublon (retries) : si déjà notifié pour ce status, on sort
    if (after.lastStatusNotified === after.status) {
      console.log("[invite] already notified", { inviteId, status: after.status });
      return;
    }

    const inviterId = after.inviterId;
    if (!inviterId) return;

    // Récup INVITEUR
    const inviterSnap = await db.doc(`users/${inviterId}`).get();
    if (!inviterSnap.exists) return;
    const inviter = inviterSnap.data() as any;
    if (inviter?.notificationsEnabled === false) return;

    // Tokens (support single string OR array)
    const rawTokens =
      inviter?.expoPushTokens ??
      inviter?.expoPushToken ??
      inviter?.pushTokens ??
      inviter?.pushToken;

    const tokens: string[] = Array.isArray(rawTokens)
      ? rawTokens.filter(Boolean)
      : rawTokens
      ? [rawTokens]
      : [];

    const expoTokens = tokens.filter(
      (t) => typeof t === "string" && (t.includes("ExponentPushToken") || t.includes("ExpoPushToken"))
    );

    if (expoTokens.length === 0) {
      console.log("[invite] no expo tokens for inviter", { inviterId });
      // on marque quand même comme notifié pour éviter les retries looping
      try { await event.data?.after?.ref.update({ lastStatusNotified: after.status }); } catch {}
      return;
    }

    // Username invité si manquant
    let inviteeUsername = after.inviteeUsername || null;
    if (!inviteeUsername && after.inviteeId) {
      const inviteeSnap = await db.doc(`users/${after.inviteeId}`).get().catch(() => null);
      const u = inviteeSnap?.data() as any;
      inviteeUsername =
        u?.username ||
        u?.displayName ||
        (typeof u?.email === "string" ? u.email.split("@")[0] : null) ||
        null;
    }

    // Titre du challenge (facultatif mais sympa)
    let challengeTitle: string | null = null;
    if (after.challengeId) {
      const chSnap = await db.doc(`challenges/${after.challengeId}`).get().catch(() => null);
      challengeTitle = (chSnap?.get("title") as string) || null;
    }

    const lang = inviter?.language || "en";
    const title = titleFor(lang);
    const body = bodyFor(after.status, lang, inviteeUsername, challengeTitle);
    if (!body) {
      // marque notifié quand même (anti-retry)
      try { await event.data?.after?.ref.update({ lastStatusNotified: after.status }); } catch {}
      return;
    }

    // Envoi à tous les devices expo
    const failures: string[] = [];
    for (const token of expoTokens) {
      const res = await sendExpoPush(token, title, body, {
        type: "invite-status",
        status: after.status,
        inviteId,
        challengeId: after.challengeId || "",
        inviteeId: after.inviteeId || "",
      });
      if (!res.ok) {
        console.warn("[invite] push failed", { token, code: res.code, details: res.details });
        if (res.code === "DeviceNotRegistered") failures.push(token);
      }
    }

    // Nettoyage tokens invalides
    if (failures.length > 0) {
      try {
        const keep = expoTokens.filter((t) => !failures.includes(t));
        if (Array.isArray(inviter?.expoPushTokens)) {
          await inviterSnap.ref.update({ expoPushTokens: keep });
        } else {
          await inviterSnap.ref.update({ expoPushToken: keep[0] ?? null });
        }
      } catch {}
    }

    // Marque comme notifié pour idempotence
    try {
      await event.data?.after?.ref.update({ lastStatusNotified: after.status });
    } catch (e) {
      console.warn("[invite] could not set lastStatusNotified", e);
    }
  }
);
