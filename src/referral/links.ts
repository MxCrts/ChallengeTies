// src/referral/links.ts
import * as Application from "expo-application";
import Constants from "expo-constants";
import i18n from "@/i18n";

const FALLBACK_SCHEME = "myapp"; // garde un fallback au cas où

const getScheme = () => {
  const raw =
    (Constants as any)?.expoConfig?.scheme ||
    (Constants as any)?.manifest2?.extra?.expoClient?.scheme ||
    (Constants as any)?.manifest?.scheme;

  const s0 = typeof raw === "string" ? raw.trim() : "";
  if (!s0) return FALLBACK_SCHEME;

  // 1) si quelqu’un a mis "myapp://whatever", on garde juste "myapp"
  const beforeSlashes = s0.split("://")[0];

  // 2) si quelqu’un a mis "myapp/whatever" ou "myapp:whatever"
  const clean = beforeSlashes.split("/")[0].split(":")[0].trim();

  return clean || FALLBACK_SCHEME;
};

// Base universelle (Cloud Function) — override possible en dev
const DL_BASE =
  (Constants as any)?.expoConfig?.extra?.dlBase ||
  (Constants as any)?.manifest2?.extra?.dlBase ||
  "https://europe-west1-challengeme-d7fef.cloudfunctions.net/dl";

const assertRef = (refUid: string) => {
  const clean = String(refUid ?? "").trim();
  if (!clean) throw new Error("[referral] refUid is required to build links");
  return clean;
};

/** Lien app direct (si app installée) */
export function buildAppLink(refUid: string, src: string = "share") {
  const scheme = getScheme();
  const cleanRef = assertRef(refUid);
  const cleanSrc = String(src ?? "").trim() || "share";

  return `${scheme}://ref/${encodeURIComponent(cleanRef)}?src=${encodeURIComponent(cleanSrc)}`;
}

/** Lien web universel (fonction cloud -> store / app / register) */
export function buildWebLink(refUid: string, src: string = "share") {
  const cleanRef = assertRef(refUid);
  const cleanSrc = String(src ?? "").trim() || "share";
  const v = String(Date.now());

  try {
    const url = new URL(DL_BASE);
    url.searchParams.set("ref", cleanRef);
   url.searchParams.set("refUid", cleanRef);
   url.searchParams.set("referrerId", cleanRef);
    url.searchParams.set("src", cleanSrc);
    url.searchParams.set("v", v);
    return url.toString();
  } catch {
    const q = new URLSearchParams({
     ref: cleanRef,
     refUid: cleanRef,
     referrerId: cleanRef,
     src: cleanSrc,
     v,
   });
    return `${DL_BASE}?${q.toString()}`;
  }
}

/** i18n-friendly — conserve le même nom pour ne rien casser ailleurs */
export function getAppNameFallback() {
  const fallback = Application.applicationName || "ChallengeTies";
  try {
    const tr = i18n.t("appName", {
      defaultValue: fallback,
      returnObjects: false,
    });
    return typeof tr === "string" && tr.trim() ? tr : fallback;
  } catch {
    return fallback;
  }
}
