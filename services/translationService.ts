import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/constants/firebase-config"; // adapte le chemin selon ton projet

const functions = getFunctions(app, "europe-west1");
const translateFn = httpsCallable(functions, "translateContent");

type TranslationResult = {
  cached?: boolean;
  sameLanguage?: boolean;
  title?: string;
  description?: string;
  text?: string;
  sourceLang?: string;
};

// ── Cache mémoire (évite les appels répétés pendant la session) ───────────────
const memCache: Record<string, TranslationResult> = {};

function cacheKey(type: string, docId: string, lang: string, subDocId?: string): string {
  return `${type}:${docId}:${subDocId || ""}:${lang}`;
}

// ── Traduit un challenge créé par un user ─────────────────────────────────────
export async function translateChallenge(
  challengeId: string,
  targetLang: string
): Promise<{ title?: string; description?: string } | null> {
  const key = cacheKey("challenge", challengeId, targetLang);
  if (memCache[key]) return memCache[key];

  try {
    const result = await translateFn({ type: "challenge", docId: challengeId, targetLang });
    const data = result.data as TranslationResult;
    memCache[key] = data;
    return data;
  } catch (e) {
    console.warn("[translateChallenge] failed:", e);
    return null;
  }
}

// ── Traduit une review ────────────────────────────────────────────────────────
export async function translateReview(
  challengeId: string,
  reviewId: string,
  targetLang: string
): Promise<{ text?: string } | null> {
  const key = cacheKey("review", challengeId, targetLang, reviewId);
  if (memCache[key]) return memCache[key];

  try {
    const result = await translateFn({
      type: "review",
      docId: challengeId,
      subDocId: reviewId,
      targetLang,
    });
    const data = result.data as TranslationResult;
    memCache[key] = data;
    return data;
  } catch (e) {
    console.warn("[translateReview] failed:", e);
    return null;
  }
}

// ── Traduit une feature vote ──────────────────────────────────────────────────
export async function translateFeature(
  featureId: string,
  targetLang: string
): Promise<{ title?: string; description?: string } | null> {
  const key = cacheKey("feature", featureId, targetLang);
  if (memCache[key]) return memCache[key];

  try {
    const result = await translateFn({ type: "feature", docId: featureId, targetLang });
    const data = result.data as TranslationResult;
    memCache[key] = data;
    return data;
  } catch (e) {
    console.warn("[translateFeature] failed:", e);
    return null;
  }
}