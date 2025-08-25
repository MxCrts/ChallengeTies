const functions = require("firebase-functions");
const admin = require("firebase-admin");

try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

const enc = (s = "") => encodeURIComponent(String(s));
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// URL: https://<ton-hosting>/s/:id
exports.sharePage = functions.https.onRequest(async (req, res) => {
  try {
    const segments = req.path.split("/").filter(Boolean);
    const id = segments[segments.length - 1] || req.query.id;
    if (!id) return res.status(400).send("Missing challenge id");

    // Récupère le challenge (titre + image)
    const snap = await db.collection("challenges").doc(String(id)).get();
    const data = snap.exists ? snap.data() : {};

    const title = data?.title || "ChallengeTies";
    const description = "Rejoins-moi sur ce challenge !";
    const imageUrl = data?.imageUrl || "https://challengeme-d7fef.web.app/og-default.png";

    const webUrl   = `https://challengeme-d7fef.web.app/challenge-details/${enc(id)}`;
    const scheme   = `myapp://challenge-details/${enc(id)}`;
    const playUrl  = "https://play.google.com/store/apps/details?id=com.mxcrts.ChallengeTies";
    const intent   = `intent://challenge-details/${enc(id)}#Intent;scheme=myapp;package=com.mxcrts.ChallengeTies;S.browser_fallback_url=${enc(playUrl)};end`;

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)} – ChallengeTies</title>

<!-- Open Graph -->
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:image" content="${imageUrl}"/>
<meta property="og:url" content="${webUrl}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="ChallengeTies"/>

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${imageUrl}"/>

<!-- Android App Links -->
<meta property="al:android:app_name" content="ChallengeTies"/>
<meta property="al:android:package" content="com.mxcrts.ChallengeTies"/>
<meta property="al:android:url" content="${scheme}"/>

<meta name="theme-color" content="#111827"/>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',sans-serif;background:#0b0f1c;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .wrap{max-width:860px;padding:24px;text-align:center}
  a.btn{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#ffd700;color:#111827;text-decoration:none;font-weight:700}
  .note{opacity:.7;margin-top:8px;font-size:14px}
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a class="btn" href="${intent}">Ouvrir dans l’app</a>
    <div class="note"><a href="${webUrl}" style="color:#9bdcff">${webUrl}</a></div>
  </div>
  <script>
    // Tentative d’ouverture app après courte latence
    setTimeout(function(){ location.href = "${intent}"; }, 600);
  </script>
</body>
</html>`;

    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});
