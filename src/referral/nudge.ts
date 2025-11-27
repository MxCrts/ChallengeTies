// src/referral/nudge.ts
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "@/i18n";

const KEY = "ties_referral_nudged_milestones";

export async function nudgeClaimableOnce(milestones: number[]) {
  try {
    if (!Array.isArray(milestones) || milestones.length === 0) return;

    // ✅ normalise + uniq + tri
    const normalized = Array.from(
      new Set(
        milestones
          .map((m) => Number(m))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ).sort((a, b) => a - b);

    if (normalized.length === 0) return;

    // ✅ lecture safe AsyncStorage
    let done: number[] = [];
    try {
      const raw = await AsyncStorage.getItem(KEY);
      done = raw ? (JSON.parse(raw) as number[]) : [];
      if (!Array.isArray(done)) done = [];
    } catch {
      done = [];
    }

    const doneSet = new Set(done.map((x) => Number(x)).filter(Number.isFinite));

    // on nudge seulement les paliers jamais nudgés
    const toNudge = normalized.filter((m) => !doneSet.has(m));
    if (toNudge.length === 0) return;

    const m = toNudge[0]; // plus petit palier dispo

    // ✅ notifs autorisées ?
        const settings = await Notifications.getPermissionsAsync();
        const status = settings.status as any;

        // Sur certaines versions, "provisional" n'existe pas dans le type
        const granted =
          status === Notifications.PermissionStatus.GRANTED ||
          status === "provisional";

        if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: String(i18n.t("referral.nudge.title")),
        body: String(i18n.t("referral.nudge.body", { milestone: m })),
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // immédiat
    });

    // on mémorise ce palier pour éviter les doublons
    const updated = Array.from(new Set([...doneSet, m]));
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // silencieux
  }
}
