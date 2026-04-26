"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWeeklyLeaderboard = exports.translateContent = exports.sendWeeklyReport = exports.checkExpiredInvitations = exports.acceptMatchingInvitation = exports.sendMatchingPush = exports.sendDuoNudge = exports.onUserActivated = exports.claimReferralMilestone = exports.invitationsOnWrite = exports.dl = void 0;
const express_1 = __importDefault(require("express"));
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
/** =========================
 *  CONFIG
 *  ========================= */
const CLOUDINARY_CLOUD_NAME = "dfhoxbsvr";
const CLOUDINARY_BG_PUBLIC_ID = "ct_share_bg1"; // asset source (PNG)
const APP_SCHEME = "myapp";
const ANDROID_PACKAGE = "com.mxcrts.ChallengeTies";
const WEB_HOSTING = "https://challengeme-d7fef.web.app";
const IOS_STORE_URL = "https://apps.apple.com/app/id6751504640";
const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.mxcrts.ChallengeTies";
// Bots (FB/Twitter/WhatsApp/etc.)
// ↑ liste élargie pour sécuriser l'aperçu OG sur un max de plateformes
const BOT_UA = /(facebookexternalhit|Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot|DiscordBot|Pinterest|SkypeUriPreview|Googlebot|bingbot)/i;
const INV = " "; // espace non vide pour éviter les fallbacks titre/desc
/** =========================
 *  I18N (12 langues)
 *  ========================= */
const I18N = {
    ar: { join: "انضم إليّ في هذا التحدي! 🚀" },
    de: { join: "Mach mit bei dieser Challenge! 🚀" },
    es: { join: "¡Únete a mí en este desafío! 🚀" },
    en: { join: "Join me on this challenge! 🚀" },
    fr: { join: "Rejoins-moi sur ce défi ! 🚀" },
    hi: { join: "इस चैलेंज में मेरे साथ जुड़ो! 🚀" },
    it: { join: "Unisciti a me in questa sfida! 🚀" },
    ru: { join: "Присоединяйся ко мне в этом челлендже! 🚀" },
    zh: { join: "加入我的挑战吧！🚀" },
    pt: { join: "Junta-te a mim neste desafio! 🚀" },
    ja: { join: "このチャレンジに一緒に挑戦しよう！🚀" },
    ko: { join: "이 챌린지에 나와 함께 도전하자! 🚀" },
    nl: { join: "Doe met mij mee aan deze challenge! 🚀" },
};
/**
 * Normalise la langue :
 *   - gère fr / fr-FR / fr_fr
 *   - fallback propre sur fr
 */
function t(lang) {
    const base = String(lang || "fr").toLowerCase().trim();
    const short = (base.split(/[-_]/)[0] || "fr");
    const key = short in I18N ? short : "fr";
    return I18N[key];
}
/** =========================
 *  APP
 *  ========================= */
const app = (0, express_1.default)();
/** Helpers */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** Build querystring only with truthy values */
function qs(obj) {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
            const sv = String(v);
            if (sv.length)
                p.set(k, sv);
        }
    });
    const str = p.toString();
    return str ? `?${str}` : "";
}
/** Extract numeric iOS App ID from the IOS_STORE_URL */
function getIosAppId(url) {
    const m = url.match(/id(\d+)/);
    return m?.[1] || "";
}
/**
 * Construit l’URL Cloudinary pour OG:
 * - source PNG (ton asset)
 * - rendu final en JPEG (f_jpg) — WhatsApp/Messenger friendly
 * - padding sombre + bordure dorée
 * - anti-cache (query v=…)
 */
function buildOgUrl(v) {
    const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const tx = `w_1200,h_630,c_pad,b_rgb:0b1020,bo_10px_solid_rgb:FFD700,f_jpg,q_auto:good`;
    const suffix = `${CLOUDINARY_BG_PUBLIC_ID}.png`; // ton fichier d’origine (PNG)
    const ver = v ? `?v=${encodeURIComponent(v)}` : `?v=${Date.now()}`;
    return `${base}/${tx}/${suffix}${ver}`;
}
/** =========================
 *  ROUTES
 *  ========================= */
app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/og", (_req, res) => {
    res.json({ imageUrl: buildOgUrl() });
});
app.get("/img", (_req, res) => {
    const ogUrl = buildOgUrl();
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.redirect(302, ogUrl);
});
/**
 * /dl — Lien universel partage + INVITATIONS
 * accepte:
 *  - id        : challenge id (cible challenge-details/[id])
 *  - title     : (optionnel) pour anti-cache image OG
 *  - lang      : fr|en|... (affiche la desc OG)
 *  - invite    : invitation document id (déclenche le modal in-app)
 *  - days      : nombre de jours suggéré (passé en query à l’app)
 */
app.get(["/", "/i"], (req, res) => {
    const ua = String(req.headers["user-agent"] || "");
    const isBot = BOT_UA.test(ua);
    // Langue : priorité au ?lang=, sinon première langue d'Accept-Language, fallback fr
    const rawLangHeader = String(req.headers["accept-language"] || "fr")
        .split(",")[0]
        .trim();
    const langParam = String(req.query.lang || "").trim();
    const lang = (langParam || rawLangHeader || "fr").toLowerCase();
    // Mode debug: ?debug=1 → renvoie un JSON au lieu de rediriger (hyper utile en dev)
    const isDebug = String(req.query.debug || "").toLowerCase() === "1" ||
        String(req.query.debug || "").toLowerCase() === "true";
    // 🔥 2 MODES POSSIBLES :
    // A) Referral: ?ref=UID&src=share
    // B) Challenge invite/share: ?id=CHALLENGE_ID&invite=INV&days=XX
    // ✅ Backward compatible: ref peut s'appeler ref / refUid / referrerId
    const ref = String(req.query.ref ||
        req.query.refUid ||
        req.query.referrerId ||
        "").trim();
    const src = String(req.query.src || "share").trim() || "share";
    // ✅ id peut venir d'anciennes variantes aussi si besoin
    const id = String(req.query.id ||
        req.query.challengeId ||
        "").trim();
    const rawTitle = String(req.query.title || "");
    const invite = String(req.query.invite || "").trim();
    const days = String(req.query.days || "").trim();
    const L = t(lang);
    // ==== Build path + query selon mode ====
    let path = "";
    let sharedQuery = "";
    // 0) Cas vide total → on renvoie vers la home (évite myapp://challenge-details fantôme)
    if (!ref && !id && !invite) {
        path = "";
        sharedQuery = "";
    }
    else if (ref && !id) {
        // ✅ MODE REFERRAL
        path = `ref/${encodeURIComponent(ref)}`;
        sharedQuery = qs({ src });
    }
    else {
        // ✅ MODE CHALLENGE / INVITATION
        sharedQuery = qs({ invite, days, ref, src });
        path = id
            ? `challenge-details/${encodeURIComponent(id)}`
            : `challenge-details`;
    }
    const appDeepLink = `${APP_SCHEME}://${path}${sharedQuery}`;
    const webFallback = `${WEB_HOSTING}/${path}${sharedQuery}`;
    const androidIntent = `intent://${path}${sharedQuery}` +
        `#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;
    const ogImageUrl = buildOgUrl(`${rawTitle}|${lang}`);
    const ogTitle = "ChallengeTies";
    const ogDesc = L.join || INV;
    const iosAppId = getIosAppId(IOS_STORE_URL);
    // 🧪 MODE DEBUG → SUPER PRATIQUE POUR TESTER LES LIENS SANS REDIRECT
    if (isDebug) {
        res.set("Cache-Control", "no-store");
        return res.status(200).json({
            ok: true,
            isBot,
            ua,
            lang,
            path,
            sharedQuery,
            appDeepLink,
            webFallback,
            androidIntent,
            ref,
            id,
            invite,
            days,
            src,
        });
    }
    const head = `<!doctype html>
<html lang="${escapeHtml(lang.split(/[-_]/)[0] || "fr")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ogTitle)}</title>

<!-- OpenGraph -->
<meta property="og:site_name" content="ChallengeTies">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDesc)}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:secure_url" content="${ogImageUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta property="og:url" content="${webFallback}">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDesc)}">
<meta name="twitter:image" content="${ogImageUrl}">

<!-- App Links -->
<meta property="al:ios:url" content="${appDeepLink}">
<meta property="al:ios:app_name" content="ChallengeTies">
${iosAppId ? `<meta property="al:ios:app_store_id" content="${iosAppId}">` : ""}
<meta property="al:android:url" content="${appDeepLink}">
<meta property="al:android:app_name" content="ChallengeTies">
<meta property="al:android:package" content="${ANDROID_PACKAGE}">
<meta property="al:web:url" content="${webFallback}">
</head>`;
    let body;
    if (isBot) {
        body = `
<body style="margin:0;background:#0b1020"><!-- empty for bots --></body>
</html>`;
    }
    else {
        body = `
<body>
<script>
(function(){
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var deepLink = ${JSON.stringify(appDeepLink)};
  var intentLink = ${JSON.stringify(androidIntent)};
  var webFallback = ${JSON.stringify(webFallback)};
  var iosStore = ${JSON.stringify(IOS_STORE_URL)};
  var androidStore = ${JSON.stringify(ANDROID_STORE_URL)};

  try {
    if (isAndroid) {
      window.location.href = intentLink;
      setTimeout(function(){ window.location.href = androidStore; }, 800);
    } else if (isIOS) {
      window.location.href = deepLink;
      setTimeout(function(){ window.location.href = iosStore; }, 800);
    } else {
      window.location.replace(webFallback);
    }
  } catch(e){}
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${webFallback}"></noscript>
</body>
</html>`;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=0, s-maxage=600");
    res.status(200).send(head + body);
});
/** =========================
 *  EXPORT
 *  ========================= */
exports.dl = (0, https_1.onRequest)({ region: "europe-west1", cors: true }, app);
var invitationsOnWrite_1 = require("./invitationsOnWrite");
Object.defineProperty(exports, "invitationsOnWrite", { enumerable: true, get: function () { return invitationsOnWrite_1.invitationsOnWrite; } });
var referralClaim_1 = require("./referralClaim");
Object.defineProperty(exports, "claimReferralMilestone", { enumerable: true, get: function () { return referralClaim_1.claimReferralMilestone; } });
var referralRewards_1 = require("./referralRewards");
Object.defineProperty(exports, "onUserActivated", { enumerable: true, get: function () { return referralRewards_1.onUserActivated; } });
var duoNudge_1 = require("./duoNudge");
Object.defineProperty(exports, "sendDuoNudge", { enumerable: true, get: function () { return duoNudge_1.sendDuoNudge; } });
var sendMatchingPush_CloudFunction_1 = require("./sendMatchingPush_CloudFunction");
Object.defineProperty(exports, "sendMatchingPush", { enumerable: true, get: function () { return sendMatchingPush_CloudFunction_1.sendMatchingPush; } });
var acceptMatchingInvitation_CloudFunction_1 = require("./acceptMatchingInvitation_CloudFunction");
Object.defineProperty(exports, "acceptMatchingInvitation", { enumerable: true, get: function () { return acceptMatchingInvitation_CloudFunction_1.acceptMatchingInvitation; } });
var checkExpiredInvitations_1 = require("./checkExpiredInvitations");
Object.defineProperty(exports, "checkExpiredInvitations", { enumerable: true, get: function () { return checkExpiredInvitations_1.checkExpiredInvitations; } });
var sendWeeklyReport_1 = require("./sendWeeklyReport");
Object.defineProperty(exports, "sendWeeklyReport", { enumerable: true, get: function () { return sendWeeklyReport_1.sendWeeklyReport; } });
var translateContent_1 = require("./translateContent");
Object.defineProperty(exports, "translateContent", { enumerable: true, get: function () { return translateContent_1.translateContent; } });
var resetWeeklyLeaderboard_1 = require("./resetWeeklyLeaderboard");
Object.defineProperty(exports, "resetWeeklyLeaderboard", { enumerable: true, get: function () { return resetWeeklyLeaderboard_1.resetWeeklyLeaderboard; } });
