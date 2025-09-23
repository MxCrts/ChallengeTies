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
}

function titleFor(lang: string | undefined) {
  const L = (lang || "en").toLowerCase();
  switch (L) {
    case "fr": return "ChallengeTies";
    case "es": return "ChallengeTies";
    case "de": return "ChallengeTies";
    case "it": return "ChallengeTies";
    default: return "ChallengeTies";
  }
}

function bodyFor(status: InvitationStatus, lang: string | undefined, inviteeUsername?: string | null) {
  const name = inviteeUsername || "Your partner";
  const L = (lang || "en").toLowerCase();
  if (status === "accepted") {
    switch (L) {
      case "fr": return `${name} a accepté ton invitation 🎉`;
      case "es": return `${name} aceptó tu invitación 🎉`;
      case "de": return `${name} hat deine Einladung angenommen 🎉`;
      case "it": return `${name} ha accettato il tuo invito 🎉`;
      default:    return `${name} accepted your invitation 🎉`;
    }
  }
  if (status === "refused") {
    switch (L) {
      case "fr": return `${name} a refusé ton invitation 🙏`;
      case "es": return `${name} rechazó tu invitación 🙏`;
      case "de": return `${name} hat deine Einladung abgelehnt 🙏`;
      case "it": return `${name} ha rifiutato il tuo invito 🙏`;
      default:    return `${name} refused your invitation 🙏`;
    }
  }
  return "";
}

async function sendExpoPush(to: string, title: string, body: string, data?: Record<string, any>) {
  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json",
    },
    body: JSON.stringify({ to, sound: "default", title, body, data }),
  });
  const json = await resp.json().catch(() => null) as any;
  const d = json?.data;
  if (d?.status === "ok") return { ok: true as const };

  const code = d?.details?.error || d?.__errorCode || undefined;
  return { ok: false as const, code, message: d?.message, details: d?.details };
}

/**
 * Envoie une notif à l’INVITEUR quand une invitation passe de "pending" → "accepted" | "refused".
 */
export const invitationsOnWrite = onDocumentWritten(
  { region: "europe-west1", document: "invitations/{inviteId}" },
  async (event) => {
    const before = event.data?.before?.data() as Invitation | undefined;
    const after = event.data?.after?.data() as Invitation | undefined;

    // On ne traite que les mises à jour
    if (!before || !after) return;

    // Doit venir de "pending" et aller vers "accepted" ou "refused"
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "refused") return;

    const inviterId = after.inviterId;
    if (!inviterId) return;

    // Récupère l’utilisateur INVITEUR
    const inviterSnap = await db.doc(`users/${inviterId}`).get();
    if (!inviterSnap.exists) return;

    const inviter = inviterSnap.data() as any;
    if (inviter?.notificationsEnabled === false) return;

    const token: string | undefined = inviter?.expoPushToken;
    const looksLikeExpo = typeof token === "string" && (token.includes("ExponentPushToken") || token.includes("ExpoPushToken"));
    if (!token || !looksLikeExpo) return;

    const lang = inviter?.language || "en";
    const title = titleFor(lang);
    const body = bodyFor(after.status, lang, after.inviteeUsername);

    if (!body) return;

    const res = await sendExpoPush(token, title, body, {
      type: "invite-status",
      status: after.status,
      challengeId: after.challengeId,
      inviteeId: after.inviteeId || null,
    });

    // Nettoyage si device non enregistré
    if (!res.ok && res.code === "DeviceNotRegistered") {
      try { await inviterSnap.ref.update({ expoPushToken: null }); } catch {}
    }
  }
);
