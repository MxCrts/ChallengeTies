"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationsOnWrite = void 0;
// functions/src/invitationsOnWrite.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const db = (0, firestore_2.getFirestore)();
/** Normalise une langue vers nos 12 locales supportées */
function normalizeLang(lang) {
    const base = String(lang || "en")
        .toLowerCase()
        .split(/[-_]/)[0];
    const supported = ["fr", "en", "es", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "nl"];
    return supported.includes(base) ? base : "en";
}
function titleFor(_lang) {
    // Titre identique partout (brand). Gardé pour extensibilité future.
    return "ChallengeTies";
}
function bodyFor(status, lang, inviteeUsername, challengeTitle) {
    const name = inviteeUsername || "Your partner";
    const ct = challengeTitle ? ` « ${challengeTitle} »` : "";
    const L = normalizeLang(lang);
    if (status === "accepted") {
        switch (L) {
            case "fr": return `${name} a accepté ton invitation${ct} 🎉`;
            case "en": return `${name} accepted your invitation${ct} 🎉`;
            case "es": return `${name} aceptó tu invitación${ct} 🎉`;
            case "de": return `${name} hat deine Einladung${ct} angenommen 🎉`;
            case "it": return `${name} ha accettato il tuo invito${ct} 🎉`;
            case "pt": return `${name} aceitou o teu convite${ct} 🎉`;
            case "ru": return `${name} принял(а) твоё приглашение${ct} 🎉`;
            case "ar": return `${name} قبل دعوتك${ct} 🎉`;
            case "hi": return `${name} ने तुम्हारा निमंत्रण स्वीकार किया${ct} 🎉`;
            case "zh": return `${name} 接受了你的邀请${ct} 🎉`;
            case "ja": return `${name} があなたの招待${ct}を承認しました 🎉`;
            case "ko": return `${name} 님이 당신의 초대${ct}를 수락했어요 🎉`;
            case "nl": return `${name} heeft je uitnodiging${ct} geaccepteerd 🎉`;
            default: return `${name} accepted your invitation${ct} 🎉`;
        }
    }
    if (status === "refused") {
        switch (L) {
            case "fr": return `${name} a refusé ton invitation${ct} 🙏`;
            case "en": return `${name} refused your invitation${ct} 🙏`;
            case "es": return `${name} rechazó tu invitación${ct} 🙏`;
            case "de": return `${name} hat deine Einladung${ct} abgelehnt 🙏`;
            case "it": return `${name} ha rifiutato il tuo invito${ct} 🙏`;
            case "pt": return `${name} recusou o teu convite${ct} 🙏`;
            case "ru": return `${name} отклонил(а) твоё приглашение${ct} 🙏`;
            case "ar": return `${name} رفض دعوتك${ct} 🙏`;
            case "hi": return `${name} ने तुम्हारा निमंत्रण अस्वीकार कर दिया${ct} 🙏`;
            case "zh": return `${name} 拒绝了你的邀请${ct} 🙏`;
            case "ja": return `${name} があなたの招待${ct}を辞退しました 🙏`;
            case "ko": return `${name} 님이 당신의 초대${ct}를 거절했어요 🙏`;
            case "nl": return `${name} heeft je uitnodiging${ct} geweigerd 🙏`;
            default: return `${name} refused your invitation${ct} 🙏`;
        }
    }
    return "";
}
async function sendExpoPush(to, title, body, data) {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            accept: "application/json",
            "accept-encoding": "gzip, deflate",
            "content-type": "application/json",
        },
        body: JSON.stringify({ to, sound: "default", title, body, data }),
    });
    const json = (await resp.json().catch(() => null));
    const d = json?.data;
    if (d?.status === "ok")
        return { ok: true };
    const code = d?.details?.error || d?.__errorCode || undefined;
    return { ok: false, code, message: d?.message, details: d?.details };
}
/**
 * Envoie une notif à l’INVITEUR quand une invitation passe de "pending" → "accepted" | "refused".
 * Idempotent grâce à lastStatusNotified.
 */
exports.invitationsOnWrite = (0, firestore_1.onDocumentWritten)({ region: "europe-west1", document: "invitations/{inviteId}" }, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const inviteId = event.params?.inviteId;
    // On ne traite que les mises à jour
    if (!before || !after)
        return;
    // Doit venir de "pending" et aller vers "accepted" ou "refused"
    if (before.status !== "pending")
        return;
    if (after.status !== "accepted" && after.status !== "refused")
        return;
    // Anti-doublon (retries) : si déjà notifié pour ce status, on sort
    if (after.lastStatusNotified === after.status) {
        console.log("[invite] already notified", { inviteId, status: after.status });
        return;
    }
    const inviterId = after.inviterId;
    if (!inviterId)
        return;
    // Récup INVITEUR
    const inviterSnap = await db.doc(`users/${inviterId}`).get();
    if (!inviterSnap.exists)
        return;
    const inviter = inviterSnap.data();
    if (inviter?.notificationsEnabled === false)
        return;
    // Tokens (support single string OR array)
    const rawTokens = inviter?.expoPushTokens ??
        inviter?.expoPushToken ??
        inviter?.pushTokens ??
        inviter?.pushToken;
    const tokens = Array.isArray(rawTokens)
        ? rawTokens.filter(Boolean)
        : rawTokens
            ? [rawTokens]
            : [];
    const expoTokens = tokens.filter((t) => typeof t === "string" && (t.includes("ExponentPushToken") || t.includes("ExpoPushToken")));
    if (expoTokens.length === 0) {
        console.log("[invite] no expo tokens for inviter", { inviterId });
        // on marque quand même comme notifié pour éviter les retries looping
        try {
            await event.data?.after?.ref.update({ lastStatusNotified: after.status });
        }
        catch { }
        return;
    }
    // Username invité si manquant
    let inviteeUsername = after.inviteeUsername || null;
    if (!inviteeUsername && after.inviteeId) {
        const inviteeSnap = await db.doc(`users/${after.inviteeId}`).get().catch(() => null);
        const u = inviteeSnap?.data();
        inviteeUsername =
            u?.username ||
                u?.displayName ||
                (typeof u?.email === "string" ? u.email.split("@")[0] : null) ||
                null;
    }
    // Titre du challenge (facultatif mais sympa)
    let challengeTitle = null;
    if (after.challengeId) {
        const chSnap = await db.doc(`challenges/${after.challengeId}`).get().catch(() => null);
        challengeTitle = chSnap?.get("title") || null;
    }
    const lang = inviter?.language || "en";
    const title = titleFor(lang);
    const body = bodyFor(after.status, lang, inviteeUsername, challengeTitle);
    if (!body) {
        // marque notifié quand même (anti-retry)
        try {
            await event.data?.after?.ref.update({ lastStatusNotified: after.status });
        }
        catch { }
        return;
    }
    // Envoi à tous les devices expo
    const failures = [];
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
            if (res.code === "DeviceNotRegistered")
                failures.push(token);
        }
    }
    // Nettoyage tokens invalides
    if (failures.length > 0) {
        try {
            const keep = expoTokens.filter((t) => !failures.includes(t));
            if (Array.isArray(inviter?.expoPushTokens)) {
                await inviterSnap.ref.update({ expoPushTokens: keep });
            }
            else {
                await inviterSnap.ref.update({ expoPushToken: keep[0] ?? null });
            }
        }
        catch { }
    }
    // Marque comme notifié pour idempotence
    try {
        await event.data?.after?.ref.update({ lastStatusNotified: after.status });
    }
    catch (e) {
        console.warn("[invite] could not set lastStatusNotified", e);
    }
});
