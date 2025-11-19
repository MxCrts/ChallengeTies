import React from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

export default function BannerTestScreen() {
  const unitId = TestIds.BANNER; // ID de test officiel
  console.log("🧪 Banner will use unitId =", unitId, " __DEV__ =", __DEV__);

  return (
    <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.BANNER} // 320x50
        requestOptions={{ requestNonPersonalizedAdsOnly: (globalThis as any).__NPA__ === true }}
        onAdLoaded={() => console.log("✅ [TEST] Banner LOADED")}
        onAdFailedToLoad={(e) => console.log("🛑 [TEST] Banner ERROR:", e)}
      />
    </View>
  );
}
