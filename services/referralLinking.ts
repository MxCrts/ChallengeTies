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
  const url = rawUrl.trim();

  try {
    const parsed = Linking.parse(url);

    const host = String((parsed as any).hostname || "").trim().toLowerCase();
    const path = String(parsed.path || "").trim().toLowerCase();
    const qp: any = parsed.queryParams || {};

    // ✅ 1) Format app scheme:
    // myapp://ref/<uid>  -> host="ref", path="<uid>"
    if (host === "ref") return true;

    // ✅ 2) Format path:
    // myapp://something/ref/<uid> OR https://.../ref/<uid>
    if (path.startsWith("ref/") || path.includes("/ref/")) return true;

    // ✅ 3) Format query:
    // ?refUid=... OR ?ref=... OR ?referrerId=...
    if (qp.refUid || qp.ref || qp.referrerId) return true;

    return false;
  } catch {
    // fallback simple si parse fail
    return (
      /:\/\/ref\//i.test(url) ||
      /\/ref\//i.test(url) ||
      /[?&]refUid=/i.test(url) ||
      /[?&]ref=/i.test(url) ||
      /[?&]referrerId=/i.test(url)
    );
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

    // ex: ties://ref/<uid>  -> parsed.path = "ref/<uid>"
    const path = (parsed.path || "").trim();
    const segments = path.split("/").filter(Boolean);

    // 1) Format principal: /ref/:uid
    if (segments[0] === "ref" && segments[1]) {
      referrerId = segments[1];
    }

    // 2) Format query: ?refUid=xxx
    const qp: any = parsed.queryParams || {};
    if (!referrerId && qp.refUid) {
      referrerId = String(qp.refUid);
    }

    // 3) Fallback query: ?ref=xxx
    if (!referrerId && qp.ref) {
      referrerId = String(qp.ref);
    }

    // src
    if (qp.src) src = String(qp.src).trim() || "share";
  } catch (e) {
    // Fallback manuel si parse fail
    try {
      const u = new URL(url);
      const qp = u.searchParams;

      referrerId =
        qp.get("refUid") ||
        qp.get("ref") ||
        null;

      src = qp.get("src") || "share";

      // si /ref/<uid> en path
      if (!referrerId) {
        const segs = u.pathname.split("/").filter(Boolean);
        if (segs[0] === "ref" && segs[1]) referrerId = segs[1];
      }
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

    if (existing) {
      console.log("🟡 [referral] already had referrer locally:", existing);
    } else {
      await AsyncStorage.multiSet([
        [REFERRER_KEY, referrerId],
        [REFERRER_SRC_KEY, src],
        [REFERRER_TS_KEY, String(Date.now())],
      ]);
      console.log("✅ [referral] stored pending referrer locally:", referrerId);
    }

    // analytics best-effort
    try {
      await logEvent("ref_link_captured", {
        referrerId,
        src,
        alreadyHadReferrer: !!existing,
        warmStartLoggedIn: !!me,
      });
    } catch {}

    return true;
  } catch (e) {
    console.log("❌ [referral] store pending error:", e);
    return false;
  }
}
