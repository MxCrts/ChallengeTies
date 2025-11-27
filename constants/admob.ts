// constants/admob.ts
import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const isDev = __DEV__;

/** iOS (prod) */
const IOS_BANNER = "ca-app-pub-4725616526467159/1159152549";
const IOS_INTERSTITIAL = "ca-app-pub-4725616526467159/3625641580";
const IOS_REWARDED = "ca-app-pub-4725616526467159/9999478244";

/** Android (prod) */
const AND_BANNER = "ca-app-pub-4725616526467159/1031160032";
const AND_INTERSTITIAL = "ca-app-pub-4725616526467159/1602005670";
const AND_REWARDED = "ca-app-pub-4725616526467159/3393707296";

/**
 * TEMP: force test pour bannière jusqu’à ce qu’on voie “✅ Banner LOADED”.
 * Ensuite tu pourras mettre FORCE_TEST_BANNER=false.
 */

export const adUnitIds = {
  banner: __DEV__ ? TestIds.BANNER : Platform.select({ ios: IOS_BANNER, android: AND_BANNER })!,

  interstitial: isDev
    ? TestIds.INTERSTITIAL
    : Platform.select({ ios: IOS_INTERSTITIAL, android: AND_INTERSTITIAL })!,
  rewarded: isDev
    ? TestIds.REWARDED
    : Platform.select({ ios: IOS_REWARDED, android: AND_REWARDED })!,
};
