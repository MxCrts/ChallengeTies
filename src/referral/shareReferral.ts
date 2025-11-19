// src/referral/shareReferral.ts
import { Share } from "react-native";
import { auth } from "@/constants/firebase-config";
import i18n from "@/i18n";
import { buildAppLink, buildWebLink, getAppNameFallback } from "@/src/referral/links";

export async function shareReferralLink() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error(i18n.t("referral.share1.notLoggedIn"));

  const appName = getAppNameFallback();
  const appLink = buildAppLink(uid);
  const webLink = buildWebLink(uid);

  const title = i18n.t("referral.share1.title", { appName });
  const message = i18n.t("referral.share1.inviteMessage", { appName, webLink, appLink });

  await Share.share({ title, message });
}
