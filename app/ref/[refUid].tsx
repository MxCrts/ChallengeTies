// app/ref/[refUid].tsx
import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { logEvent } from "@/src/analytics";
import { auth } from "@/constants/firebase-config";import {
  REFERRER_KEY,
  REFERRER_SRC_KEY,
  REFERRER_TS_KEY,
} from "@/services/referralLinking";

const GUEST_KEY = "ties.guest.enabled.v1";

export default function ReferralCatcher() {
  const { t } = useTranslation();
  const router = useRouter();
  const handledRef = useRef(false);

  const { refUid, src } = useLocalSearchParams<{
    refUid?: string;
    src?: string;
  }>();

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // ✅ Watchdog hard: quoi qu'il arrive, on ne reste jamais coincé ici
    const watchdog = setTimeout(() => {
      try {
        const me = auth.currentUser?.uid;
        if (me) router.replace("/(tabs)");
        else router.replace("/login");
      } catch {}
    }, 2500);

    // Si la route est ouverte sans refUid valide (lien cassé / accès direct),
   // on renvoie tout de suite vers la home sans lancer la logique async.
   if (!refUid) {
    clearTimeout(watchdog);
     router.replace("/");
     return;
   }


    (async () => {
      try {
        const cleanRef = String(refUid ?? "").trim();
        const cleanSrc = String(src ?? "").trim() || "share";

        if (!cleanRef) return;

        const me = auth.currentUser?.uid;
// ✅ si user déjà loggué, on ne “link” pas via referral (évite abus + complexité)
        if (me) return;

// ✅ Un referral ne doit jamais te laisser en mode visiteur
await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
// ✅ Et on force le flow auth au retour sur "/"
(globalThis as any).__FORCE_AUTH_FLOW__ = true;


const existing = (await AsyncStorage.getItem(REFERRER_KEY))?.trim();

        // ✅ ici, on fait SIMPLE : on stocke si pas déjà stocké
         if (existing !== cleanRef) {
          await AsyncStorage.multiSet([
            [REFERRER_KEY, cleanRef],
            [REFERRER_SRC_KEY, cleanSrc],
            [REFERRER_TS_KEY, String(Date.now())],
          ]);
        }

        // analytics best-effort
        try {
          await logEvent("ref_link_opened", {
            referrerId: cleanRef,
            src: cleanSrc,
            alreadyHadReferrer: !!existing,
            overwritten: existing !== cleanRef,
            warmStartLoggedIn: false,
          });
        } catch {}
      } catch (e) {
        console.log("[referral] store referrer error:", e);
      } finally {
        clearTimeout(watchdog);

        (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = false;
        /**
         * ✅ IMPORTANT:
         * On renvoie vers la root et on laisse TON flow global
         * (AuthProvider / guard / onboarding) décider.
         */
        // ✅ déterministe : si pas connecté, on va LOGIN (pas home)
        const me = auth.currentUser?.uid;
        if (me) router.replace("/(tabs)");
        else router.replace("/login");
      }
    })();
 return () => clearTimeout(watchdog);
  }, [refUid, src, router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" />
      <Text style={styles.txt}>
        {t("referral.catching", { defaultValue: "Préparation…" })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  txt: { fontSize: 12, opacity: 0.7 },
});
