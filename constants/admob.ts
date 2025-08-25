// constants/admob.ts
import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const isDev = __DEV__;

/** iOS (tes nouveaux IDs) */
const IOS_BANNER = "ca-app-pub-4725616526467159/6909958390";
const IOS_INTERSTITIAL = "ca-app-pub-4725616526467159/4942270608";
const IOS_REWARDED = "ca-app-pub-4725616526467159/2626280210";

/** Android (tes IDs existants) */
const AND_BANNER = "ca-app-pub-4725616526467159/3887969618";
const AND_INTERSTITIAL = "ca-app-pub-4725616526467159/6097960289";
const AND_REWARDED = "ca-app-pub-4725616526467159/6366749139";

/**
 * En DEV ➜ TestIds (recommandé par Google)
 * En PROD ➜ vrais IDs
 */
export const adUnitIds = {
  banner: isDev
    ? TestIds.BANNER
    : Platform.select({ ios: IOS_BANNER, android: AND_BANNER })!,
  interstitial: isDev
    ? TestIds.INTERSTITIAL
    : Platform.select({ ios: IOS_INTERSTITIAL, android: AND_INTERSTITIAL })!,
  rewarded: isDev
    ? TestIds.REWARDED
    : Platform.select({ ios: IOS_REWARDED, android: AND_REWARDED })!,
};
