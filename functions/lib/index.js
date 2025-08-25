"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dl = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/v2/https");
/** =========================
 *  CONFIG
 *  ========================= */
const CLOUDINARY_CLOUD_NAME = "dfhoxbsvr";
const CLOUDINARY_BG_PUBLIC_ID = "ct_share_bg1"; // ta source est un PNG
const APP_SCHEME = "myapp";
const ANDROID_PACKAGE = "com.mxcrts.ChallengeTies";
const WEB_HOSTING = "https://challengeme-d7fef.web.app";
const IOS_STORE_URL = "https://apps.apple.com/app/idXXXXXXXX"; // TODO: real App Store id
const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.mxcrts.ChallengeTies";
// Bots (FB/Twitter/WhatsApp/etc.)
const BOT_UA = /(facebookexternalhit|Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot|Pinterest|SkypeUriPreview|Googlebot|bingbot)/i;
const WA_UA = /WhatsApp/i; // si besoin de traitements spécifiques
const INV = " "; // espace non-vide pour éviter les fallbacks titre/desc
/** =========================
 *  I18N (9 langues)
 *  ========================= */
const I18N = {
    ar: {
        join: "انضم إليّ في هذا التحدي! 🚀",
    },
    de: {
        join: "Mach mit bei dieser Challenge! 🚀",
    },
    es: {
        join: "¡Únete a mí en este desafío! 🚀",
    },
    en: {
        join: "Join me on this challenge! 🚀",
    },
    fr: {
        join: "Rejoins-moi sur ce défi ! 🚀",
    },
    hi: {
        join: "इस चैलेंज में मेरे साथ जुड़ो! 🚀",
    },
    it: {
        join: "Unisciti a me in questa sfida! 🚀",
    },
    ru: {
        join: "Присоединяйся ко мне в этом челлендже! 🚀",
    },
    zh: {
        join: "加入我的挑战吧！🚀",
    },
};
function t(lang) {
    const key = (lang || "fr").toLowerCase();
    return I18N[key] || I18N.fr;
}
/** =========================
 *  APP
 *  ========================= */
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
/** Helpers */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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
app.get(["/", "/dl"], (req, res) => {
    const ua = String(req.headers["user-agent"] || "");
    const isBot = BOT_UA.test(ua);
    // const isWA = WA_UA.test(ua); // si tu veux des tweaks spécifiques WhatsApp
    const lang = String(req.query.lang || "fr").toLowerCase();
    const id = String(req.query.id || "");
    const rawTitle = String(req.query.title || ""); // si tu veux l’exploiter plus tard
    const L = t(lang);
    // Deep links
    const appDeepLink = id
        ? `${APP_SCHEME}://challenge-details/${encodeURIComponent(id)}`
        : `${APP_SCHEME}://challenge-details`;
    const webFallback = id
        ? `${WEB_HOSTING}/challenge-details/${encodeURIComponent(id)}`
        : `${WEB_HOSTING}`;
    // Android intent
    const androidIntent = id
        ? `intent://challenge-details/${encodeURIComponent(id)}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`
        : `intent://challenge-details#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;
    // Image OG (anti-cache)
    const ogImageUrl = buildOgUrl(`${rawTitle}|${lang}`);
    // Texte d’aperçu SOUS l’image (pas incrusté)
    const ogTitle = "ChallengeTies";
    const ogDesc = L.join || INV;
    // HEAD (balises OG/Twitter strictes)
    const head = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ogTitle)}</title>

<!-- OpenGraph -->
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
</head>`;
    let body;
    if (isBot) {
        // Bots: on ne rend RIEN de visible (uniquement l'image via OG)
        body = `
<body style="margin:0;background:#0b1020"><!-- empty for bots --></body>
</html>`;
    }
    else {
        // Humains: redirection intelligente
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
