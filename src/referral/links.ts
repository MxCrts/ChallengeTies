// src/referral/links.ts
import * as Application from "expo-application";
import i18n from "@/i18n";

export function buildAppLink(refUid: string) {
  return `myapp://ref/${refUid}`;
}

export function buildWebLink(refUid: string) {
  const base = "https://europe-west1-challengeme-d7fef.cloudfunctions.net/dl";
  const url = new URL(base);
  url.searchParams.set("ref", refUid);
  url.searchParams.set("src", "share");
  url.searchParams.set("v", String(Date.now()));
  return url.toString();
}

/** i18n-friendly — conserve le même nom pour ne rien casser ailleurs */
export function getAppNameFallback() {
  const fallback = Application.applicationName || "ChallengeTies";
  // si i18n est prêt, on renvoie la clé ; sinon on garde le fallback
  try {
    return i18n.t("appName", { defaultValue: fallback }) || fallback;
  } catch {
    return fallback;
  }
}
