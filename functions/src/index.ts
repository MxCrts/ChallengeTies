import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";

/** =========================
 *  CONFIG
 *  ========================= */
const CLOUDINARY_CLOUD_NAME = "dfhoxbsvr";
const CLOUDINARY_BG_PUBLIC_ID = "ct_share_bg1"; // asset source (PNG)
const APP_SCHEME = "myapp";
const ANDROID_PACKAGE = "com.mxcrts.ChallengeTies";
const WEB_HOSTING = "https://challengeme-d7fef.web.app";
const IOS_STORE_URL = "https://apps.apple.com/app/idXXXXXXXX"; // TODO: real App Store id
const ANDROID_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mxcrts.ChallengeTies";

// Bots (FB/Twitter/WhatsApp/etc.)
const BOT_UA =
  /(facebookexternalhit|Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot|Pinterest|SkypeUriPreview|Googlebot|bingbot)/i;

const INV = " "; // espace non vide pour éviter les fallbacks titre/desc

/** =========================
 *  I18N (9 langues)
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
} as const;

function t(lang: string) {
  const key = (lang || "fr").toLowerCase();
  return I18N[key as keyof typeof I18N] || I18N.fr;
}

/** =========================
 *  APP
 *  ========================= */
const app = express();
app.use(cors({ origin: true }));

/** Helpers */
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build querystring only with truthy values */
function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      const sv = String(v);
      if (sv.length) p.set(k, sv);
    }
  });
  const str = p.toString();
  return str ? `?${str}` : "";
}

/** Extract numeric iOS App ID from the IOS_STORE_URL */
function getIosAppId(url: string): string {
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
function buildOgUrl(v?: string) {
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
app.get(["/", "/dl"], (req, res) => {
  const ua = String(req.headers["user-agent"] || "");
  const isBot = BOT_UA.test(ua);

  const lang = String(req.query.lang || "fr").toLowerCase();
  const id = String(req.query.id || "");
  const rawTitle = String(req.query.title || ""); // pour anti-cache OG

  // 🔑 paramètres d’invitation (si présents)
  const invite = String(req.query.invite || "");
  const days = String(req.query.days || "");

  const L = t(lang);

  // ==== Deep links ====
  // Query à transmettre à l’app (ou au web fallback) pour ouvrir le modal invitation
  const sharedQuery = qs({ invite, days });

  // Paths
  const path = id ? `challenge-details/${encodeURIComponent(id)}` : `challenge-details`;

  // App deep link (avec query)
  const appDeepLink = `${APP_SCHEME}://${path}${sharedQuery}`;

  // Web fallback
  const webFallback = `${WEB_HOSTING}/${path}${sharedQuery}`;

  // Android intent
  const androidIntent =
    `intent://${path}${sharedQuery}` +
    `#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;

  // Image OG (anti-cache)
  const ogImageUrl = buildOgUrl(`${rawTitle}|${lang}`);

  // Texte d’aperçu SOUS l’image (pas incrusté)
  const ogTitle = "ChallengeTies";
  const ogDesc = L.join || INV;

  const iosAppId = getIosAppId(IOS_STORE_URL);

  // HEAD (balises OG/Twitter strictes + App Links hints)
  const head = `<!doctype html>
<html lang="${lang}">
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

<!-- App Links (hint pour OS/navigateurs) -->
<meta property="al:ios:url" content="${appDeepLink}">
<meta property="al:ios:app_name" content="ChallengeTies">
${iosAppId ? `<meta property="al:ios:app_store_id" content="${iosAppId}">` : ""}
<meta property="al:android:url" content="${appDeepLink}">
<meta property="al:android:app_name" content="ChallengeTies">
<meta property="al:android:package" content="${ANDROID_PACKAGE}">
<meta property="al:web:url" content="${webFallback}">
</head>`;

  let body: string;

  if (isBot) {
    // Bots: on ne rend RIEN de visible (uniquement l'image via OG)
    body = `
<body style="margin:0;background:#0b1020"><!-- empty for bots --></body>
</html>`;
  } else {
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
export const dl = onRequest({ region: "europe-west1", cors: true }, app);
