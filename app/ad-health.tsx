import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
  RequestConfiguration,
} from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";

export default function AdHealth() {
  const [inited, setInited] = React.useState(false);
  const [adapterInfo, setAdapterInfo] = React.useState<string>("(en cours…)");

  const [useTestIds, setUseTestIds] = React.useState(true); // ← force TestIds au départ
  const [interStatus, setInterStatus] = React.useState<"idle"|"loading"|"loaded"|"error"|"shown">("idle");
  const [rewardStatus, setRewardStatus] = React.useState<"idle"|"loading"|"loaded"|"error"|"rewarded">("idle");

  const ids = React.useMemo(() => {
    return useTestIds
      ? { banner: TestIds.BANNER, interstitial: TestIds.INTERSTITIAL, rewarded: TestIds.REWARDED }
      : { banner: adUnitIds.banner, interstitial: adUnitIds.interstitial, rewarded: adUnitIds.rewarded };
  }, [useTestIds]);

  const inter = React.useMemo(() => InterstitialAd.createForAdRequest(ids.interstitial, {}), [ids.interstitial]);
  const rewarded = React.useMemo(() => RewardedAd.createForAdRequest(ids.rewarded, {}), [ids.rewarded]);

  // 1) Initialisation + logs détaillés des adapters
React.useEffect(() => {
  (async () => {
    try {
      const reqCfg: RequestConfiguration = {
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      };
      await mobileAds().setRequestConfiguration(reqCfg);

      const init = await mobileAds().initialize();

      // ✅ Compatibilité : objet OU tableau
      let adaptersText = "inconnu";
      const adaptersRaw: any = (init as any).adapterStatuses || init;

      if (Array.isArray(adaptersRaw)) {
        adaptersText = adaptersRaw
          .map(
            (st: any) =>
              `${st.name || "?"}: ${st.initializationState || "?"}${
                st.description ? ` (${st.description})` : ""
              }`
          )
          .join(" | ");
      } else if (adaptersRaw && typeof adaptersRaw === "object") {
        adaptersText = Object.entries(adaptersRaw)
          .map(
            ([name, st]: any) =>
              `${name}: ${st.initializationState || "?"}${
                st.description ? ` (${st.description})` : ""
              }`
          )
          .join(" | ");
      }

      console.log("🧩 AdMob adapters:", adaptersText);
      setAdapterInfo(adaptersText);
      setInited(true);
    } catch (e) {
      console.log("💥 Init error:", e);
      setAdapterInfo(String(e));
    }
  })();
}, []);


  // 2) Chargements après init
  React.useEffect(() => {
    if (!inited) return;

    // Interstitial
    const i1 = inter.addAdEventListener(AdEventType.LOADED, () => {
      console.log("✅ Interstitial LOADED");
      setInterStatus("loaded");
    });
    const i2 = inter.addAdEventListener(AdEventType.ERROR, (e) => {
      console.log("🛑 Interstitial ERROR:", e);
      setInterStatus("error");
    });
    const i3 = inter.addAdEventListener(AdEventType.OPENED, () => setInterStatus("shown"));
    const i4 = inter.addAdEventListener(AdEventType.CLOSED, () => {
      setInterStatus("idle");
      setTimeout(() => inter.load(), 1500);
    });

    // Rewarded
    const r1 = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log("✅ Rewarded LOADED");
      setRewardStatus("loaded");
    });
    const r2 = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      console.log("🏆 Rewarded EARNED");
      setRewardStatus("rewarded");
    });
    const r3 = rewarded.addAdEventListener(AdEventType.ERROR, (e) => {
      console.log("🛑 Rewarded ERROR:", e);
      setRewardStatus("error");
    });
    const r4 = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardStatus("idle");
      setTimeout(() => rewarded.load(), 1500);
    });

    setInterStatus("loading");
    inter.load();
    setRewardStatus("loading");
    rewarded.load();

    return () => {
      i1(); i2(); i3(); i4();
      r1(); r2(); r3(); r4();
    };
  }, [inited, inter, rewarded]);

  if (!inited) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Ad Health</Text>
        <Text>Initialisation en cours…</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Ad Health</Text>

      <Text style={{ fontSize: 12, opacity: 0.7 }}>
        Platform: {Platform.OS} | IDs: {useTestIds ? "TEST" : "PROD"}
      </Text>
      <Text style={{ fontSize: 12, opacity: 0.7 }}>Adapters: {adapterInfo}</Text>

      <TouchableOpacity
        onPress={() => mobileAds().openAdInspector()}
        style={{ padding: 12, backgroundColor: "#0f172a", borderRadius: 12 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Ouvrir Ad Inspector</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setUseTestIds(v => !v)}
        style={{ padding: 12, backgroundColor: "#334155", borderRadius: 12 }}
      >
        <Text style={{ color: "#fff" }}>{useTestIds ? "🔁 Utiliser IDs PROD" : "🔁 Utiliser TestIds"}</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, opacity: 0.7 }}>
        Banner: {ids.banner}{"\n"}Inter: {ids.interstitial}{"\n"}Rewarded: {ids.rewarded}
      </Text>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>Bannière</Text>
      <BannerAd
        unitId={ids.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => console.log("✅ Banner LOADED")}
        onAdFailedToLoad={(e) => console.log("🛑 Banner ERROR:", e)}
      />

      <View style={{ height: 1, backgroundColor: "#eee", marginVertical: 8 }} />

      <Text style={{ fontSize: 18, fontWeight: "700" }}>Interstitial</Text>
      <Text>État: {interStatus}</Text>
      <TouchableOpacity
        onPress={() => inter.show()}
        style={{ padding: 10, backgroundColor: "#111", borderRadius: 10, alignSelf: "flex-start" }}
      >
        <Text style={{ color: "#fff" }}>Afficher interstitiel</Text>
      </TouchableOpacity>

      <View style={{ height: 1, backgroundColor: "#eee", marginVertical: 8 }} />

      <Text style={{ fontSize: 18, fontWeight: "700" }}>Rewarded</Text>
      <Text>État: {rewardStatus}</Text>
      <TouchableOpacity
        onPress={() => rewarded.show()}
        style={{ padding: 10, backgroundColor: "#111", borderRadius: 10, alignSelf: "flex-start" }}
      >
        <Text style={{ color: "#fff" }}>Afficher rewarded</Text>
      </TouchableOpacity>
    </View>
  );
}
