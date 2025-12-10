// services/referralLinking.ts
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/constants/firebase-config";
import { logEvent } from "@/src/analytics";

export const REFERRER_KEY = "ties_referrer_id";
export const REFERRER_SRC_KEY = "ties_referrer_src";
export const REFERRER_TS_KEY = "ties_referrer_ts";

type ParsedReferral = {
  referrerId: string | null;
  src: string;
  rawUrl: string;
};

function isReferralUrl(rawUrl: string) {
  if (!rawUrl) return false;

  const url = rawUrl.trim();

  // ✅ 0) Détection simple/robuste AVANT tout parse
  //    → marche pour https://...dl?ref=xxx
  //    → marche pour ties://ref/xxx
  //    → marche pour n'importe quel truc qui contient ces patterns
  if (
    /:\/\/ref\//i.test(url) ||         // schéma app: myapp://ref/xxx
    /\/ref\//i.test(url) ||           // chemin: .../ref/xxx
    /[?&]refuid=/i.test(url) ||       // query: ?refUid=xxx
    /[?&]referrerid=/i.test(url) ||   // query: ?referrerId=xxx
    /[?&]ref=/i.test(url)             // query: ?ref=xxx
  ) {
    return true;
  }

  // ✅ 1) On garde malgré tout le parse Expo comme bonus
  try {
    const parsed = Linking.parse(url);

    const host = String((parsed as any).hostname || "")
      .trim()
      .toLowerCase();
    const path = String(parsed.path || "").trim().toLowerCase();
    const qp: any = parsed.queryParams || {};

    // Format app scheme: myapp://ref/<uid>  -> host="ref", path="<uid>"
    if (host === "ref") return true;

    // Format path: myapp://something/ref/<uid> OR https://.../ref/<uid>
    if (path.startsWith("ref/") || path.includes("/ref/")) return true;

    // Format query: ?refUid=... OR ?ref=... OR ?referrerId=...
    if (qp.refUid || qp.ref || qp.referrerId) return true;

    return false;
  } catch {
    // Si parse plante, on retombe sur le test brut
    return false;
  }
}



// Parse solide qui accepte plusieurs formats
function parseReferralUrl(rawUrl: string): ParsedReferral {
  const url = rawUrl.trim();
  let referrerId: string | null = null;
  let src = "share";

  try {
    // expo-linking parse: marche sur ties://, https://, etc.
    const parsed = Linking.parse(url);

    const qp: any = parsed.queryParams || {};
    const path = (parsed.path || "").trim();
    const segments = path.split("/").filter(Boolean);

    // 🔥 FULL QUERY CAPTURE (toutes variantes)
    const queryRef =
      qp.ref ||
      qp.refUid ||
      qp.refuid ||
      qp.referrerId ||
      qp.referrerid ||
      null;

    if (queryRef) {
      referrerId = String(queryRef).trim();
    }
    // 🔥 Path-based capture: /ref/<uid>
    if (!referrerId && segments[0] === "ref" && segments[1]) {
      referrerId = segments[1];
    }

    // 🔥 Fallback brut Android : recherche /ref/<uid> dans l’URL complète
    if (!referrerId && /\/ref\/([^/?#]+)/i.test(url)) {
      referrerId = url.match(/\/ref\/([^/?#]+)/i)?.[1] || null;
    }

    // 🔥 src
    if (qp.src) {
      src = String(qp.src).trim() || "share";
    }
  } catch (e) {
    // Fallback manuel si parse fail
    // 🔥 Fallback robuste quand Linking.parse retourne vide (Android)
    try {
      const u = new URL(url);
      const qp = u.searchParams;

      const raw =
        qp.get("ref") ||
        qp.get("refUid") ||
        qp.get("refuid") ||
        qp.get("referrerId") ||
        qp.get("referrerid");

      if (raw) {
        referrerId = String(raw).trim();
      }

      if (!referrerId && /\/ref\/([^/?#]+)/i.test(url)) {
        referrerId = url.match(/\/ref\/([^/?#]+)/i)?.[1] || null;
      }

      src = qp.get("src") || "share";
    } catch {}
  }

  referrerId = referrerId ? String(referrerId).trim() : null;
  src = String(src).trim() || "share";

  return { referrerId, src, rawUrl: url };
}

/**
 * ✅ Fonction globale appelée par AuthProvider AND /ref/[refUid]
 * - idempotente
 * - loggue tout
 */
export async function handleReferralUrl(rawUrl?: string | null) {
  if (!rawUrl) {
    console.log("🟡 [referral] handleReferralUrl: no url");
    return false;
  }

  // ✅ ignore tout ce qui n'est pas une URL referral
  if (!isReferralUrl(rawUrl)) {
    console.log("🟡 [referral] non-referral url -> ignore:", rawUrl);
    return false;
  }

  const { referrerId, src, rawUrl: cleanUrl } = parseReferralUrl(rawUrl);

  console.log("🔗 [referral] handleReferralUrl called with:", cleanUrl);
  console.log("🧩 [referral] parsed ->", { referrerId, src });

  if (!referrerId) {
    console.log("🟡 [referral] no referrerId found -> skip");
    return false;
  }

  // ignore self-ref si déjà loggé in
  const me = auth.currentUser?.uid;
  if (me && me === referrerId) {
    console.log("🟡 [referral] self-ref detected -> skip");
    return false;
  }

    try {
    const existing = await AsyncStorage.getItem(REFERRER_KEY);

    await AsyncStorage.multiSet([
      [REFERRER_KEY, referrerId],
      [REFERRER_SRC_KEY, src],
      [REFERRER_TS_KEY, String(Date.now())],
    ]);

    console.log("✅ [referral] stored/overwrote pending referrer locally:", {
      previous: existing,
      next: referrerId,
      src,
    });

    // analytics best-effort
    try {
      await logEvent("ref_link_captured", {
        referrerId,
        src,
        alreadyHadReferrer: !!existing,
        overwritten: !!existing && existing !== referrerId,
        warmStartLoggedIn: !!me,
      });
    } catch {}


    return true;
  } catch (e) {
    console.log("❌ [referral] store pending error:", e);
    return false;
  }
}
