// constants/admob.ts
import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const isDev = __DEV__;

// ⚠️ IMPORTANT :
// Mets ceci à `true` TANT QUE tu veux FORCER les test ads partout
// (debug local, émulateur, etc).
// Pour voir les VRAIES pubs en internal app sharing → passe à false.
const FORCE_TEST_ADS = false; // 👈 CHANGE ICI

/** iOS (prod) */
const IOS_BANNER = "ca-app-pub-4725616526467159/1159152549";
const IOS_INTERSTITIAL = "ca-app-pub-4725616526467159/3625641580";
const IOS_REWARDED = "ca-app-pub-4725616526467159/9999478244";

/** Android (prod) */
const AND_BANNER = "ca-app-pub-4725616526467159/1031160032";
const AND_INTERSTITIAL = "ca-app-pub-4725616526467159/1602005670";
const AND_REWARDED = "ca-app-pub-4725616526467159/3393707296";

const useTestIds = isDev || FORCE_TEST_ADS;

export const adUnitIds = {
  banner: useTestIds
    ? TestIds.BANNER
    : Platform.select({ ios: IOS_BANNER, android: AND_BANNER })!,

  interstitial: useTestIds
    ? TestIds.INTERSTITIAL
    : Platform.select({
        ios: IOS_INTERSTITIAL,
        android: AND_INTERSTITIAL,
      })!,

  rewarded: useTestIds
    ? TestIds.REWARDED
    : Platform.select({
        ios: IOS_REWARDED,
        android: AND_REWARDED,
      })!,
};

// Petit log pour vérifier en console ce qui est utilisé
if (__DEV__) {
  console.log("[Ads] Using testIds ?", useTestIds, adUnitIds);
}
