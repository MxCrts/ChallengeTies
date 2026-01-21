"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDuoNudge = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
function getDb() {
    // ✅ Assure que l'admin app existe même si ce fichier est chargé avant index.ts
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    return admin.firestore();
}
function normalizeLang(raw) {
    // accepte "en", "en-US", "fr_FR", etc.
    const l = String(raw || "").toLowerCase().trim();
    const base = l.split(/[-_]/)[0];
    const allowed = [
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "hi",
        "it",
        "ru",
        "zh",
        "ja",
        "ko",
        "pt",
        "nl",
    ];
    return allowed.includes(base) ? base : "en";
}
function interpolate(template, vars) {
    // remplace {{name}} (et autres si tu ajoutes)
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
        const v = vars[k];
        return v === undefined || v === null ? "" : String(v);
    });
}
const PUSH_COPY = {
    fr: {
        duoNudge: {
            auto: { title: "Ton duo a validé aujourd’hui", body: "{{name}} a validé aujourd’hui. À toi 🔥" },
            manual: { title: "Petit rappel 👀", body: "{{name}} te relance. Go !" },
        },
    },
    en: {
        duoNudge: {
            auto: { title: "Your duo checked in today", body: "{{name}} checked in today. Your turn 🔥" },
            manual: { title: "Quick reminder 👀", body: "{{name}} is nudging you. Let’s go!" },
        },
    },
    es: {
        duoNudge: {
            auto: { title: "Tu dúo ya cumplió hoy", body: "{{name}} ya cumplió hoy. Te toca 🔥" },
            manual: { title: "Recordatorio 👀", body: "{{name}} te está recordando. ¡Vamos!" },
        },
    },
    de: {
        duoNudge: {
            auto: { title: "Dein Duo hat heute abgehakt", body: "{{name}} hat heute abgehakt. Du bist dran 🔥" },
            manual: { title: "Kurzer Reminder 👀", body: "{{name}} erinnert dich. Los geht’s!" },
        },
    },
    it: {
        duoNudge: {
            auto: { title: "Il tuo duo ha segnato oggi", body: "{{name}} ha segnato oggi. Tocca a te 🔥" },
            manual: { title: "Promemoria 👀", body: "{{name}} ti sta richiamando. Vai!" },
        },
    },
    pt: {
        // PT “neutre” (PT-BR compatible)
        duoNudge: {
            auto: { title: "Seu duo marcou hoje", body: "{{name}} marcou hoje. Sua vez 🔥" },
            manual: { title: "Lembrete 👀", body: "{{name}} está te chamando. Bora!" },
        },
    },
    nl: {
        duoNudge: {
            auto: { title: "Je duo heeft vandaag afgevinkt", body: "{{name}} heeft vandaag afgevinkt. Jij bent aan de beurt 🔥" },
            manual: { title: "Kleine reminder 👀", body: "{{name}} geeft je een seintje. Let’s go!" },
        },
    },
    ru: {
        duoNudge: {
            auto: { title: "Твой дуэт отметил сегодня", body: "{{name}} отметил сегодня. Твоя очередь 🔥" },
            manual: { title: "Небольшой пинок 👀", body: "{{name}} напоминает. Погнали!" },
        },
    },
    hi: {
        duoNudge: {
            auto: { title: "तुम्हारे डुओ ने आज पूरा किया", body: "{{name}} ने आज पूरा किया। अब तुम्हारी बारी 🔥" },
            manual: { title: "छोटा रिमाइंडर 👀", body: "{{name}} तुम्हें पुश कर रहा/रही है। चलो!" },
        },
    },
    ar: {
        duoNudge: {
            auto: { title: "شريكك أنجز اليوم", body: "{{name}} أنجز اليوم. دورك الآن 🔥" },
            manual: { title: "تذكير سريع 👀", body: "{{name}} يذكّرك. هيا!" },
        },
    },
    zh: {
        // Simplifié neutre
        duoNudge: {
            auto: { title: "你的搭档今天已打卡", body: "{{name}} 今天已打卡。轮到你了 🔥" },
            manual: { title: "小提醒 👀", body: "{{name}} 在提醒你。冲！" },
        },
    },
    ja: {
        duoNudge: {
            auto: { title: "相棒が今日達成したよ", body: "{{name}} が今日達成。次はあなた 🔥" },
            manual: { title: "ちょいリマインド 👀", body: "{{name}} が呼んでる。行こう！" },
        },
    },
    ko: {
        duoNudge: {
            auto: { title: "듀오가 오늘 완료했어", body: "{{name}}가 오늘 완료했어. 이제 너 차례 🔥" },
            manual: { title: "짧은 알림 👀", body: "{{name}}가 툭 찔렀어. 가자!" },
        },
    },
};
function getPartnerLang(partner) {
    return normalizeLang(partner?.language);
}
function getDuoNudgeCopy(lang, type, vars) {
    const pack = PUSH_COPY[lang] || PUSH_COPY.en;
    const fallback = PUSH_COPY.en;
    const chosen = type === "auto"
        ? pack.duoNudge.auto || fallback.duoNudge.auto
        : pack.duoNudge.manual || fallback.duoNudge.manual;
    return {
        title: chosen.title,
        body: interpolate(chosen.body, vars),
    };
}
// helpers
function todayKeyUTC() {
    // "YYYY-MM-DD" en UTC (aligné avec dayKeyUTC côté app)
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
// ✅ RateKey canonique, indépendante de uniqueKey (anti double-nudge si uniqueKey change)
function makeRateKey(params) {
    const cid = String(params.challengeId || "").trim();
    const days = String(params.selectedDays || "").trim();
    const [a, b] = [String(params.uid1 || ""), String(params.uid2 || "")].sort();
    return `${cid}_${days}_${a}-${b}`;
}
function toDayKeyUTCFromIso(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function hasMarkedToday(item, todayKey) {
    if (!item)
        return false;
    const k = typeof item.lastMarkedKey === "string" ? item.lastMarkedKey : null;
    if (k && k === todayKey)
        return true;
    const iso = typeof item.lastMarkedDate === "string" ? item.lastMarkedDate : null;
    const fromIso = iso ? toDayKeyUTCFromIso(iso) : null;
    if (fromIso && fromIso === todayKey)
        return true;
    const keys = Array.isArray(item.completionDateKeys) ? item.completionDateKeys : [];
    if (keys.includes(todayKey))
        return true;
    const dates = Array.isArray(item.completionDates) ? item.completionDates : [];
    for (let i = dates.length - 1; i >= 0; i--) {
        const dk = toDayKeyUTCFromIso(dates[i]);
        if (dk === todayKey)
            return true;
    }
    return false;
}
function isValidExpoPushToken(token) {
    return expo_server_sdk_1.Expo.isExpoPushToken(token);
}
const SKIP = (reason, extra = {}) => ({
    ok: true,
    sent: false,
    skipped: true,
    reason,
    ...extra,
});
const SENT = (extra = {}) => ({
    ok: true,
    sent: true,
    skipped: false,
    ...extra,
});
exports.sendDuoNudge = functions
    .region("europe-west1")
    .https
    .onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Not authenticated.");
    const rawType = String(data?.type || "manual").toLowerCase().trim();
    const type = rawType === "auto" ? "auto" : "manual";
    const uniqueKey = String(data?.uniqueKey || "").trim();
    const payloadChallengeId = String(data?.challengeId || "").trim();
    const payloadSelectedDays = Number(data?.selectedDays || 0);
    const payloadPartnerId = String(data?.partnerId || "").trim();
    // ✅ On accepte :
    // - uniqueKey (ancien client)
    // - OU (challengeId + selectedDays + partnerId) (client stable)
    const hasStablePayload = !!payloadChallengeId && !!payloadSelectedDays && !!payloadPartnerId;
    if (!uniqueKey && !hasStablePayload) {
        throw new functions.https.HttpsError("invalid-argument", "Missing uniqueKey or (challengeId, selectedDays, partnerId).");
    }
    const todayKey = todayKeyUTC();
    // Load caller
    const callerRef = getDb().collection("users").doc(uid);
    const callerSnap = await callerRef.get();
    if (!callerSnap.exists)
        throw new functions.https.HttpsError("not-found", "Caller not found.");
    const caller = callerSnap.data() || {};
    const currentChallenges = Array.isArray(caller.CurrentChallenges) ? caller.CurrentChallenges : [];
    // ✅ 1) On essaie d'abord via payload stable (challengeId/days/partnerId)
    // ✅ 2) Sinon fallback uniqueKey (ancien comportement)
    const myItem = (hasStablePayload
        ? currentChallenges.find((c) => {
            if (c?.duo !== true)
                return false;
            const cid = String(c?.challengeId || c?.id || "").trim();
            const days = Number(c?.selectedDays || 0);
            const pid = String(c?.duoPartnerId || "").trim();
            return cid === payloadChallengeId && days === payloadSelectedDays && pid === payloadPartnerId;
        })
        : null) ||
        (uniqueKey
            ? currentChallenges.find((c) => c?.duo === true && String(c?.uniqueKey || "") === uniqueKey)
            : null);
    if (!myItem) {
        throw new functions.https.HttpsError("failed-precondition", "Duo challenge not found for caller.");
    }
    const partnerId = String(myItem?.duoPartnerId || "");
    if (!partnerId)
        throw new functions.https.HttpsError("failed-precondition", "Missing duoPartnerId.");
    if (partnerId === uid) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot nudge yourself.");
    }
    // ✅ Si le client fournit partnerId (payload stable), il doit matcher le vrai duoPartnerId (defense-in-depth)
    if (hasStablePayload && payloadPartnerId && payloadPartnerId !== partnerId) {
        throw new functions.https.HttpsError("permission-denied", "Invalid partner for this duo.");
    }
    // ✅ Base challenge id + days pour rateKey stable
    const baseChallengeId = String(myItem.challengeId || myItem.id || "");
    const baseSelectedDays = Number(myItem.selectedDays || 0);
    if (!baseChallengeId || !baseSelectedDays) {
        throw new functions.https.HttpsError("failed-precondition", "Missing challengeId/selectedDays for duo nudge.");
    }
    // ✅ Optional: si un uniqueKey a été fourni, on le garde pour data push,
    // sinon on en génère un de fallback (non bloquant)
    const stableUniqueKey = uniqueKey || makeRateKey({ challengeId: baseChallengeId, selectedDays: baseSelectedDays, uid1: uid, uid2: partnerId });
    const rateKey = makeRateKey({
        challengeId: baseChallengeId,
        selectedDays: baseSelectedDays,
        uid1: uid,
        uid2: partnerId,
    });
    // Load partner
    const partnerRef = getDb().collection("users").doc(partnerId);
    const partnerSnap = await partnerRef.get();
    if (!partnerSnap.exists)
        throw new functions.https.HttpsError("not-found", "Partner not found.");
    const partner = partnerSnap.data() || {};
    const partnerChallenges = Array.isArray(partner.CurrentChallenges) ? partner.CurrentChallenges : [];
    // ✅ Même logique: on cherche le duo par (challengeId/days/partnerId) en priorité
    const partnerItem = partnerChallenges.find((c) => {
        if (c?.duo !== true)
            return false;
        const cid = String(c?.challengeId || c?.id || "").trim();
        const days = Number(c?.selectedDays || 0);
        const pid = String(c?.duoPartnerId || "").trim();
        return cid === baseChallengeId && days === baseSelectedDays && pid === uid;
    }) ||
        (uniqueKey
            ? partnerChallenges.find((c) => c?.duo === true && String(c?.uniqueKey || "") === uniqueKey)
            : null);
    // Si le partner n’a pas ce duo en CurrentChallenges, on stop (pas de notif fantôme)
    if (!partnerItem) {
        return SKIP("partner_not_in_duo_anymore");
    }
    const callerMarkedToday = hasMarkedToday(myItem, todayKey);
    const partnerMarkedToday = hasMarkedToday(partnerItem, todayKey);
    // Auto: on exige que l’appelant ait bien marqué aujourd’hui
    if (type === "auto" && !callerMarkedToday) {
        return SKIP("caller_not_marked_today");
    }
    // Si partner a déjà marqué aujourd’hui, inutile
    if (partnerMarkedToday) {
        return SKIP("partner_already_marked_today");
    }
    // Rate-limit store on partner doc
    const nudges = (partner.duoNudges && typeof partner.duoNudges === "object") ? partner.duoNudges : {};
    // ✅ Rate-limit canonique (anti double-nudge si uniqueKey change)
    const nudgeState = (nudges[rateKey] && typeof nudges[rateKey] === "object") ? nudges[rateKey] : {};
    // Auto limit: 1 / jour
    if (type === "auto") {
        if (nudgeState.autoSentKey === todayKey) {
            return SKIP("auto_already_sent_today");
        }
    }
    // Manual limit: cooldown 6h + max 2/jour
    if (type === "manual") {
        const lastManualAtMs = nudgeState.lastManualAt?.toMillis ? nudgeState.lastManualAt.toMillis() : 0;
        const nowMs = Date.now();
        const sixHours = 6 * 60 * 60 * 1000;
        if (lastManualAtMs && nowMs - lastManualAtMs < sixHours) {
            return SKIP("manual_cooldown");
        }
        const manualCount = (nudgeState.manualCountKey === todayKey ? Number(nudgeState.manualCount || 0) : 0);
        if (manualCount >= 2) {
            return SKIP("manual_daily_cap");
        }
        // We'll update count below
    }
    // Get partner expo token(s)
    const tokens = [];
    const t1 = partner.expoPushToken;
    if (typeof t1 === "string" && isValidExpoPushToken(t1))
        tokens.push(t1);
    const tArr = partner.expoPushTokens;
    if (Array.isArray(tArr)) {
        for (const t of tArr)
            if (typeof t === "string" && isValidExpoPushToken(t))
                tokens.push(t);
    }
    const uniqueTokens = Array.from(new Set(tokens));
    if (!uniqueTokens.length) {
        return SKIP("no_valid_push_token");
    }
    const callerUsername = String(caller.username || caller.displayName || caller.name || "").trim() || "Your duo";
    const partnerLang = getPartnerLang(partner);
    const { title, body } = getDuoNudgeCopy(partnerLang, type, { name: callerUsername });
    const messages = uniqueTokens.map((to) => ({
        to,
        sound: "default",
        title,
        body,
        data: {
            kind: "duo_nudge",
            type: "duo-nudge", // ✅ routing stable côté app
            nudgeType: type, // ✅ "auto" | "manual"
            uniqueKey: stableUniqueKey,
            challengeId: baseChallengeId,
            fromUid: uid,
            todayKey,
            rateKey,
            lang: partnerLang,
        },
    }));
    // send
    const chunks = expo.chunkPushNotifications(messages);
    const invalidTokens = new Set();
    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((t, i) => {
                if (t.status === "error") {
                    const token = chunk[i]?.to;
                    const details = t.details;
                    if (token && details?.error === "DeviceNotRegistered") {
                        invalidTokens.add(token);
                    }
                }
            });
        }
        catch (e) {
            // best effort: ne casse jamais le flow
            console.warn("[duoNudge] Expo send error", e);
        }
    }
    // cleanup tokens morts (best effort)
    if (invalidTokens.size) {
        const toRemove = Array.from(invalidTokens);
        const tokUpdate = {
            expoPushTokens: admin.firestore.FieldValue.arrayRemove(...toRemove),
        };
        if (typeof partner.expoPushToken === "string" && invalidTokens.has(partner.expoPushToken)) {
            tokUpdate.expoPushToken = admin.firestore.FieldValue.delete();
        }
        try {
            await partnerRef.set(tokUpdate, { merge: true });
        }
        catch { }
    }
    // update rate-limit on partner doc
    const update = {};
    if (type === "auto") {
        update[`duoNudges.${rateKey}.autoSentKey`] = todayKey;
        update[`duoNudges.${rateKey}.autoLastAt`] = admin.firestore.FieldValue.serverTimestamp();
    }
    else {
        const currentCount = (nudgeState.manualCountKey === todayKey) ? Number(nudgeState.manualCount || 0) : 0;
        update[`duoNudges.${rateKey}.manualCountKey`] = todayKey;
        update[`duoNudges.${rateKey}.manualCount`] = currentCount + 1;
        update[`duoNudges.${rateKey}.lastManualAt`] = admin.firestore.FieldValue.serverTimestamp();
    }
    await partnerRef.set(update, { merge: true });
    return SENT({ rateKey, todayKey });
});
