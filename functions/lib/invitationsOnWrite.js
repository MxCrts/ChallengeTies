"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationsOnWrite = void 0;
// functions/src/invitationsOnWrite.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes
function isLockExpired(lock) {
    if (!lock)
        return true;
    const s = String(lock || "");
    // lockKey = "accepted:1700000000000"
    const parts = s.split(":");
    const ts = Number(parts[1] || 0);
    if (!ts)
        return true;
    return Date.now() - ts > LOCK_TTL_MS;
}
/** Normalise une langue vers nos locales supportées */
function normalizeLang(lang) {
    const base = String(lang || "en")
        .trim() // ✅ LE FIX
        .toLowerCase()
        .split(/[-_]/)[0];
    const supported = ["fr", "en", "es", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "nl"];
    return supported.includes(base) ? base : "en";
}
function titleFor(_lang) {
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
function isExpoToken(t) {
    return (typeof t === "string" &&
        (t.includes("ExponentPushToken") || t.includes("ExpoPushToken")));
}
async function sendExpoPushBatch(messages) {
    // Timeout dur pour éviter une function pendue
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const resp = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                accept: "application/json",
                "accept-encoding": "gzip, deflate",
                "content-type": "application/json",
            },
            body: JSON.stringify(messages.map((m) => ({
                to: m.to,
                sound: "default",
                title: m.title,
                body: m.body,
                data: m.data,
            }))),
            signal: controller.signal,
        });
        // ✅ Si Expo renvoie un status HTTP non-2xx, on throw => retry automatique CF
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw new Error(`expo_http_${resp.status}: ${text?.slice?.(0, 250) || ""}`);
        }
        const json = (await resp.json().catch(() => null));
        // ✅ Format attendu: { data: [ { status: "ok"|"error", ... } ] }
        const arr = Array.isArray(json?.data) ? json.data : [];
        // ✅ Si réponse anormale => throw => retry
        if (!Array.isArray(arr)) {
            throw new Error("expo_bad_response_shape");
        }
        return arr;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Notif INVITEUR quand invitation passe pending -> accepted/refused.
 * Idempotence safe: on "claim" l'envoi via transaction (CAS),
 * puis on send, puis on "finalize" lastStatusNotified.
 */
exports.invitationsOnWrite = (0, firestore_1.onDocumentWritten)({ region: "europe-west1", document: "invitations/{inviteId}" }, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const inviteId = event.params?.inviteId;
    console.log("[invite] TRIGGER", {
        inviteId,
        before: before?.status,
        after: after?.status,
    });
    // updates only
    if (!before || !after)
        return;
    // pending -> accepted/refused only
    if (before.status === after.status)
        return;
    if (after.status !== "accepted" && after.status !== "refused")
        return;
    const inviteRef = event.data?.after?.ref;
    if (!inviteRef)
        return;
    const inviterId = after.inviterId;
    if (!inviterId)
        return;
    // ✅ CAS: un seul worker gagne le droit d'envoyer (anti retries / double trigger)
    // On utilise un champ "notifyLock" transient, puis on set lastStatusNotified seulement si send OK.
    const lockKey = `${after.status}:${Date.now()}`; // unique-ish
    let claimed = false;
    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(inviteRef);
            if (!snap.exists)
                return;
            const cur = snap.data();
            // Déjà notifié => stop
            if (cur?.lastStatusNotified === after.status)
                return;
            // Déjà locké par un autre => stop
            if (typeof cur?.notifyLock === "string" &&
                cur.notifyLock.length > 0 &&
                !isLockExpired(cur.notifyLock))
                return;
            tx.update(inviteRef, { notifyLock: lockKey });
            claimed = true;
        });
    }
    catch (e) {
        console.warn("[invite] lock transaction failed", inviteId, e?.message ?? e);
        return;
    }
    if (!claimed) {
        // Un autre worker a géré, ou déjà notifié
        return;
    }
    // Load inviter
    const inviterSnap = await db.doc(`users/${inviterId}`).get();
    if (!inviterSnap.exists) {
        // release lock (best effort)
        try {
            await inviteRef.set({ notifyLock: firestore_2.FieldValue.delete() }, { merge: true });
        }
        catch { }
        return;
    }
    const inviter = inviterSnap.data();
    if (inviter?.notificationsEnabled === false) {
        try {
            await inviteRef.set({ notifyLock: firestore_2.FieldValue.delete(), lastStatusNotified: after.status }, { merge: true });
        }
        catch { }
        return;
    }
    // Tokens: merge single + array, unique, only Expo tokens
    const mergedTokens = new Set();
    const tArr = inviter?.expoPushTokens;
    if (Array.isArray(tArr))
        for (const t of tArr)
            if (isExpoToken(t))
                mergedTokens.add(t);
    if (isExpoToken(inviter?.expoPushToken))
        mergedTokens.add(inviter.expoPushToken);
    // legacy fallback (si tu as encore des vieux champs)
    const legacyArr = inviter?.pushTokens;
    if (Array.isArray(legacyArr))
        for (const t of legacyArr)
            if (isExpoToken(t))
                mergedTokens.add(t);
    if (isExpoToken(inviter?.pushToken))
        mergedTokens.add(inviter.pushToken);
    const expoTokens = Array.from(mergedTokens);
    if (expoTokens.length === 0) {
        // finalize: on marque notifié (sinon tu vas retry en boucle à chaque update)
        try {
            await inviteRef.set({ notifyLock: firestore_2.FieldValue.delete(), lastStatusNotified: after.status }, { merge: true });
        }
        catch { }
        return;
    }
    // Resolve invitee username (best effort)
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
    // Resolve challenge title (best effort)
    let challengeTitle = null;
    if (after.challengeId) {
        const chSnap = await db.doc(`challenges/${after.challengeId}`).get().catch(() => null);
        challengeTitle = chSnap?.get("title") || null;
    }
    console.log("[invite] inviter.language RAW =", inviter?.language);
    console.log("[invite] inviter.language JSON =", JSON.stringify(inviter?.language), "len=", String(inviter?.language || "").length);
    const lang = inviter?.language || "en";
    const title = titleFor(lang);
    const body = bodyFor(after.status, lang, inviteeUsername, challengeTitle);
    // Payload stable (inviteeId peut être null: open refused/accepted set par ton service)
    const dataPayload = {
        kind: "invite_status",
        type: "invite-status", // ✅ ton NotificationsBootstrap écoute ça
        __tag: "invite-status",
        status: after.status,
        inviteId,
        challengeId: after.challengeId || "",
        inviteeId: after.inviteeId || "",
    };
    // Send to all devices
    const invalid = [];
    let successCount = 0;
    const makeChunks = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size)
            out.push(arr.slice(i, i + size));
        return out;
    };
    for (const chunk of makeChunks(expoTokens, 100)) {
        const results = await sendExpoPushBatch(chunk.map((to) => ({ to, title, body, data: dataPayload })));
        results.forEach((r, idx) => {
            const token = chunk[idx];
            if (r?.status === "ok") {
                successCount++;
                return;
            }
            const code = r?.details?.error;
            console.warn("[invite] push failed", { inviteId, token, code });
            if (code === "DeviceNotRegistered")
                invalid.push(token);
        });
    }
    // Cleanup invalid tokens
    if (invalid.length > 0) {
        try {
            const updates = {};
            updates.expoPushTokens = firestore_2.FieldValue.arrayRemove(...invalid);
            if (typeof inviter?.expoPushToken === "string" && invalid.includes(inviter.expoPushToken)) {
                updates.expoPushToken = firestore_2.FieldValue.delete();
            }
            await inviterSnap.ref.set(updates, { merge: true });
        }
        catch (e) {
            console.warn("[invite] token cleanup failed", inviteId, e?.message ?? e);
        }
    }
    // ✅ Finalize:
    try {
        if (successCount > 0) {
            await inviteRef.set({ notifyLock: firestore_2.FieldValue.delete(), lastStatusNotified: after.status }, { merge: true });
        }
        else {
            // On libère le lock…
            await inviteRef.set({ notifyLock: firestore_2.FieldValue.delete() }, { merge: true });
            // …mais on force un retry si on avait des tokens (sinon inutile)
            // => Cloud Functions retente automatiquement (at-least-once)
            throw new Error("expo_push_all_failed");
        }
    }
    catch (e) {
        console.warn("[invite] finalize failed", inviteId, e?.message ?? e);
        // Important: on re-throw seulement si c'est notre "all failed"
        if (String(e?.message || "").includes("expo_push_all_failed")) {
            throw e;
        }
    }
});
