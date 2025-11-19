// src/referral/nudge.ts
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "@/i18n"; // 👈 importe ton instance i18n (même import que dans Settings)

const KEY = "ties_referral_nudged_milestones";

export async function nudgeClaimableOnce(milestones: number[]) {
  try {
    if (milestones.length === 0) return;

    const raw = await AsyncStorage.getItem(KEY);
    const done: number[] = raw ? JSON.parse(raw) : [];

    // on nudge seulement les paliers jamais nudgés
    const toNudge = milestones.filter((m) => !done.includes(m));
    if (toNudge.length === 0) return;

    const m = Math.min(...toNudge); // nudge le plus petit palier dispo

    // notifs autorisées ?
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("referral.nudge.title"),                // 🎁 Récompense dispo
        body: i18n.t("referral.nudge.body", { milestone: m }),// Tu peux réclamer...
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // immédiat
    });

    // on mémorise ce palier pour éviter les doublons
    const updated = Array.from(new Set([...done, m]));
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // silencieux
  }
}
