// app/ref/[refUid].tsx
import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { logEvent } from "@/src/analytics";
import { auth, db } from "@/constants/firebase-config";
import { doc, getDoc } from "firebase/firestore";
import {
  REFERRER_KEY,
  REFERRER_SRC_KEY,
  REFERRER_TS_KEY,
} from "@/services/referralLinking";

const GUEST_KEY = "ties.guest.enabled.v1";
const EXPLICIT_LOGOUT_KEY = "ties.explicitLogout.v1";

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

    // Si la route est ouverte sans refUid valide (lien cassé / accès direct),
   // on renvoie tout de suite vers la home sans lancer la logique async.
   if (!refUid) {
     router.replace("/");
     return;
   }


    (async () => {
      try {
        const cleanRef = String(refUid ?? "").trim();
        const cleanSrc = String(src ?? "").trim() || "share";

        if (!cleanRef) return;

        const me = auth.currentUser?.uid;
if (me && me === cleanRef) return;

// ✅ Un referral ne doit jamais te laisser en mode visiteur
await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
// ✅ Et on force le flow auth au retour sur "/"
(globalThis as any).__FORCE_AUTH_FLOW__ = true;

// ✅ On peut aussi mettre explicitLogout pour que login gagne dans ton gate
await AsyncStorage.setItem(EXPLICIT_LOGOUT_KEY, "1").catch(() => {});

const existing = (await AsyncStorage.getItem(REFERRER_KEY))?.trim();

        // check base: si user connecté et déjà lié → on ne touche pas
        let alreadyLinkedInDb = false;
        if (me) {
          try {
            const meSnap = await getDoc(doc(db, "users", me));
            const meData = meSnap.exists() ? (meSnap.data() as any) : null;
            alreadyLinkedInDb = !!meData?.referrerId;
          } catch {}
        }

        // overwrite autorisé seulement si pas lié en base
        if (!alreadyLinkedInDb && existing !== cleanRef) {
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
            overwritten: !alreadyLinkedInDb && existing !== cleanRef,
            warmStartLoggedIn: !!me,
          });
        } catch {}
      } catch (e) {
        console.log("[referral] store referrer error:", e);
      } finally {

        (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = false;
        /**
         * ✅ IMPORTANT:
         * On renvoie vers la root et on laisse TON flow global
         * (AuthProvider / guard / onboarding) décider.
         */
        router.replace("/");
      }
    })();
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
