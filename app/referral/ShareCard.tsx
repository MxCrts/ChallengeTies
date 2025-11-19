// app/referral/ShareCard.tsx
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { auth } from "@/constants/firebase-config";
import { buildWebLink, getAppNameFallback } from "@/src/referral/links";
import QRCode from "react-native-qrcode-svg";
import { logEvent } from "@/src/analytics";
import { useTranslation } from "react-i18next";

export default function ShareCard() {
  const { t } = useTranslation();
  const me = auth.currentUser;
  const username =
    me?.displayName ||
    me?.email?.split("@")[0] ||
    t("referral.shareCard.defaultUsername", "New Challenger");
  const refUid = me?.uid || "me";
  const webLink = useMemo(() => buildWebLink(refUid), [refUid]);
  const appName = getAppNameFallback();

  const shotRef = useRef<View>(null);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  const onSave = async () => {
    try {
      setBusy("save");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("referral.shareCard.alerts.permission.title"),
          t("referral.shareCard.alerts.permission.media")
        );
        setBusy(null);
        return;
      }
      const uri = await captureRef(shotRef, { format: "png", quality: 1, result: "tmpfile" });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        t("referral.shareCard.alerts.saved.title"),
        t("referral.shareCard.alerts.saved.msg")
      );
      try { await logEvent("share_card_saved"); } catch {}
    } catch (e: any) {
      Alert.alert(
        t("referral.shareCard.alerts.error.title"),
        t("referral.shareCard.alerts.saveFailed")
      );
      console.log("save error:", e?.message ?? e);
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    try {
      setBusy("share");
      const uri = await captureRef(shotRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        try { await logEvent("share_card_shared"); } catch {}
      } else {
        Alert.alert(
          t("referral.shareCard.alerts.shareUnavailable.title"),
          t("referral.shareCard.alerts.shareUnavailable.msg")
        );
      }
    } catch (e: any) {
      Alert.alert(
        t("referral.shareCard.alerts.error.title"),
        t("referral.shareCard.alerts.shareFailed")
      );
      console.log("share error:", e?.message ?? e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t("referral.shareCard.title")}</Text>
      <Text style={styles.subtitle}>{t("referral.shareCard.subtitle")}</Text>

      {/* Carte à capturer */}
      <ViewShot ref={shotRef} style={styles.cardWrapper} options={{ format: "png", quality: 1 }}>
        <View style={styles.card}>
          <Text style={styles.app}>{appName}</Text>
          <Text style={styles.handle}>@{username}</Text>

          <View style={styles.qrWrap}>
            <QRCode value={webLink} size={180} />
          </View>

          <Text numberOfLines={1} style={styles.linkText}>{webLink}</Text>
          <Text style={styles.tagline}>{t("referral.shareCard.tagline")}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("referral.shareCard.footer")}</Text>
          </View>
        </View>
      </ViewShot>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity disabled={!!busy} style={styles.btn} onPress={onSave} accessibilityLabel={t("referral.shareCard.actions.save")}>
          {busy === "save" ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#111" />
              <Text style={styles.btnTxt}>{t("referral.shareCard.actions.save")}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity disabled={!!busy} style={[styles.btn, styles.primary]} onPress={onShare} accessibilityLabel={t("referral.shareCard.actions.share")}>
          {busy === "share" ? (
            <ActivityIndicator color="#111" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#111" />
              <Text style={styles.btnTxt}>{t("referral.shareCard.actions.share")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const P = 16;

const styles = StyleSheet.create({
  screen: { flex: 1, padding: P, gap: P, backgroundColor: "#FFF8E7" },
  title: { fontSize: 22, fontWeight: "800", color: "#111" },
  subtitle: { fontSize: 13, color: "#333" },

  cardWrapper: { alignItems: "center", marginTop: 8 },
  card: {
    width: 320,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: P * 1.2,
    borderWidth: 2,
    borderColor: "#FFB800",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: "center",
  },
  app: { fontSize: 14, fontWeight: "800", color: "#FFB800", marginBottom: 4 },
  handle: { fontSize: 22, fontWeight: "900", color: "#111", marginBottom: 10 },
  qrWrap: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#FFF7D6",
    borderWidth: 1,
    borderColor: "#FFB800",
    marginBottom: 10,
  },
  linkText: { fontSize: 12, color: "#111", opacity: 0.9, marginBottom: 6 },
  tagline: { fontSize: 14, color: "#333", fontWeight: "600", marginBottom: 6 },
  footer: {
    marginTop: 6,
    backgroundColor: "#FFE9A6",
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 999, borderWidth: 1, borderColor: "#FFB800",
  },
  footerText: { fontSize: 12, fontWeight: "700", color: "#111" },

  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1.5, borderColor: "#111",
    backgroundColor: "#FFE9A6",
  },
  primary: { backgroundColor: "#FFB800" },
  btnTxt: { color: "#111", fontWeight: "800" },
});
