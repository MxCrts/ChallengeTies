import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

// ── Google Translate (gratuit via REST, pas de SDK nécessaire) ────────────────
async function googleTranslate(
  texts: string[],
  targetLang: string,
  apiKey: string
): Promise<string[]> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texts,
      target: targetLang.split("-")[0], // "fr-FR" → "fr"
      format: "text",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Translate error: ${err}`);
  }

  const data = await response.json();
  return data.data.translations.map((t: any) => t.translatedText);
}

// ── Détecte la langue d'un texte ──────────────────────────────────────────────
async function detectLanguage(
  text: string,
  apiKey: string
): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text }),
  });

  if (!response.ok) return "unknown";

  const data = await response.json();
  return data.data.detections?.[0]?.[0]?.language || "unknown";
}

// ── Cloud Function callable ───────────────────────────────────────────────────
export const translateContent = onCall(
  { region: "europe-west1", secrets: ["GOOGLE_TRANSLATE_API_KEY"] },
  async (request) => {
    const { type, docId, targetLang, subDocId } = request.data as {
      type: "challenge" | "review" | "feature";
      docId: string;
      targetLang: string;
      subDocId?: string; // pour les reviews
    };

    if (!type || !docId || !targetLang) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    // Normalise la langue : "fr-FR" → "fr"
    const lang = targetLang.split("-")[0].toLowerCase();

    const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!API_KEY) {
      throw new HttpsError("internal", "Translation API key not configured");
    }

    // ── Challenge créé par un user ────────────────────────────────────────────
    if (type === "challenge") {
     const translationRef = db
        .collection("polls").doc("new-features")
        .collection("features").doc(docId)
        .collection("translations").doc(lang);

      // Déjà traduit ? Retourne le cache
      const existing = await translationRef.get();
      if (existing.exists) {
        return { cached: true, ...existing.data() };
      }

      const challengeSnap = await db.collection("challenges").doc(docId).get();
      if (!challengeSnap.exists) {
        throw new HttpsError("not-found", "Challenge not found");
      }

      const data = challengeSnap.data()!;

      // Pas de creatorId = challenge officiel, pas besoin de traduire
      if (!data.creatorId) {
        throw new HttpsError("failed-precondition", "Official challenges use i18n");
      }

      const title = String(data.title || "");
      const description = String(data.description || "");

      if (!title && !description) {
        throw new HttpsError("failed-precondition", "No content to translate");
      }

      // Détecte la langue source
      const sourceLang = await detectLanguage(title || description, API_KEY);

      // Même langue → pas besoin de traduire
      if (sourceLang === lang) {
        const result = { title, description, sourceLang, translatedAt: new Date().toISOString(), sameLanguage: true };
        await translationRef.set(result);
        return result;
      }

      const textsToTranslate = [title, description].filter(Boolean);
      const translated = await googleTranslate(textsToTranslate, lang, API_KEY);

      const result = {
        title: translated[0] || title,
        description: translated[1] || description,
        sourceLang,
        translatedAt: new Date().toISOString(),
        sameLanguage: false,
      };

      await translationRef.set(result);
      return result;
    }

    // ── Review ────────────────────────────────────────────────────────────────
    if (type === "review") {
      if (!subDocId) {
        throw new HttpsError("invalid-argument", "subDocId required for reviews");
      }

      const translationRef = db
        .collection("challenges").doc(docId)
        .collection("reviews").doc(subDocId)
        .collection("translations").doc(lang);

      const existing = await translationRef.get();
      if (existing.exists) {
        return { cached: true, ...existing.data() };
      }

      const reviewSnap = await db
        .collection("challenges").doc(docId)
        .collection("reviews").doc(subDocId)
        .get();

      if (!reviewSnap.exists) {
        throw new HttpsError("not-found", "Review not found");
      }

      const reviewData = reviewSnap.data()!;
      const text = String(reviewData.text || "");

      if (!text) {
        throw new HttpsError("failed-precondition", "No text to translate");
      }

      const sourceLang = await detectLanguage(text, API_KEY);

      if (sourceLang === lang) {
        const result = { text, sourceLang, translatedAt: new Date().toISOString(), sameLanguage: true };
        await translationRef.set(result);
        return result;
      }

      const [translatedText] = await googleTranslate([text], lang, API_KEY);

      const result = {
        text: translatedText || text,
        sourceLang,
        translatedAt: new Date().toISOString(),
        sameLanguage: false,
      };

      await translationRef.set(result);
      return result;
    }

    // ── Feature vote (newfeatures) ────────────────────────────────────────────
    if (type === "feature") {
      const translationRef = db
        .collection("polls").doc("newfeatures")
        .collection("features").doc(docId)
        .collection("translations").doc(lang);

      const existing = await translationRef.get();
      if (existing.exists) {
        return { cached: true, ...existing.data() };
      }

      const featureSnap = await db
        .collection("polls").doc("new-features")
        .collection("features").doc(docId)
        .get();

      if (!featureSnap.exists) {
        throw new HttpsError("not-found", "Feature not found");
      }

      const featureData = featureSnap.data()!;
      const title = String(featureData.title || "");
      const description = String(featureData.description || "");

      const sourceLang = await detectLanguage(title || description, API_KEY);

      if (sourceLang === lang) {
        const result = { title, description, sourceLang, translatedAt: new Date().toISOString(), sameLanguage: true };
        await translationRef.set(result);
        return result;
      }

      const textsToTranslate = [title, description].filter(Boolean);
      const translated = await googleTranslate(textsToTranslate, lang, API_KEY);

      const result = {
        title: translated[0] || title,
        description: translated[1] || description,
        sourceLang,
        translatedAt: new Date().toISOString(),
        sameLanguage: false,
      };

      await translationRef.set(result);
      return result;
    }

    throw new HttpsError("invalid-argument", "Unknown type");
  }
);