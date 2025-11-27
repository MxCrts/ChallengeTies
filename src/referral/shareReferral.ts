// src/referral/shareReferral.ts
import { Share, Platform } from "react-native";
import { auth } from "@/constants/firebase-config";
import i18n from "@/i18n";
import {
  buildAppLink,
  buildWebLink,
  getAppNameFallback,
} from "@/src/referral/links";

export async function shareReferralLink() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error(String(i18n.t("referral.share1.notLoggedIn")));
  }

  const appName = getAppNameFallback();

  // source tracking (utile pour analytics / debug)
  const src = "settings_shareearn";
  const appLink = buildAppLink(uid, src);
  const webLink = buildWebLink(uid, src);

  const title = String(i18n.t("referral.share1.title", { appName }));

  let message = i18n.t("referral.share1.inviteMessage", {
    appName,
    webLink,
    appLink,
  });

  // force string & fallback safe
  message = typeof message === "string" && message.trim().length
    ? message
    : `${appName} — ${webLink}`;

  // transforme les "\n" texte en vrais retours ligne
  message = message.replace(/\\n/g, "\n");

  // iOS préfère url séparé, Android préfère message
  const payload =
    Platform.OS === "ios"
      ? { title, message, url: webLink }
      : { title, message };

  await Share.share(payload);
}
