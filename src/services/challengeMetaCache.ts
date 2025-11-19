// src/services/challengeMetaCache.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type ChallengeMeta = { title: string };

const CACHE = new Map<string, ChallengeMeta>();
const INFLIGHT = new Map<string, Promise<ChallengeMeta | null>>();

export async function getChallengeMeta(id: string): Promise<ChallengeMeta | null> {
  if (!id) return null;
  if (CACHE.has(id)) return CACHE.get(id)!;
  if (INFLIGHT.has(id)) return INFLIGHT.get(id)!;

  const p = (async () => {
    try {
      const snap = await getDoc(doc(db, "challenges", id));
      if (!snap.exists()) return null;
      const data = snap.data() as any;
      const meta: ChallengeMeta = { title: String(data?.title || "Challenge") };
      CACHE.set(id, meta);
      return meta;
    } catch {
      return null;
    } finally {
      INFLIGHT.delete(id);
    }
  })();

  INFLIGHT.set(id, p);
  return p;
}

/** Prefetch silencieux de plusieurs IDs (dédupe incluse) */
export async function warmChallengeMetas(ids: string[]): Promise<void> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  await Promise.all(uniq.map(getChallengeMeta));
}

/** Lecture synchrone pour le rendu (fallback si pas encore en cache) */
export function readTitleSync(id: string, fallback = "…"): string {
  return CACHE.get(id)?.title ?? fallback;
}
