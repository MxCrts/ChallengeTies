// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import i18n from "../i18n";

/** IDs persistés (utile si on veut annuler vite fait) */
const STORAGE_KEYS = {
  morningId: "notif.morning.id",
  eveningId: "notif.evening.id",
} as const;

/** Tags internes pour repérer/annuler proprement nos notif planifiées */
const TAGS = {
  MORNING: "daily_morning_v1",
  EVENING: "daily_evening_v1",
} as const;

/** Petit mutex process pour éviter les chevauchements */
let SCHEDULING_LOCK = false;

/* ------------------------- Notification handler ------------------------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // ✅ nécessaires selon ta d.ts
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* --------------------------- Android Channel --------------------------- */
export const ensureAndroidChannelAsync = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    description: "ChallengeTies reminders & duo updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FFB800",
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};


/* ----------------------------- Permissions ----------------------------- */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    return final === "granted";
  } catch (error) {
    console.error("❌ Erreur permission notifications:", error);
    return false;
  }
};

/* ------------------------- Expo Push Registration ---------------------- */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    if (!Constants.isDevice) {
      console.log("🔧 Not a real device → no push token");
      return null;
    }

    const perm = await Notifications.getPermissionsAsync();
    let final = perm.status;
    if (final !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    console.log("🔔 Permission notifications (register):", final);
    if (final !== "granted") return null;

    const pjA = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
    const pjB = (Constants as any)?.easConfig?.projectId;

    let expoResp: any = null;
    try {
      expoResp = pjA || pjB
        ? await Notifications.getExpoPushTokenAsync({ projectId: pjA || pjB })
        : await Notifications.getExpoPushTokenAsync();
    } catch (err) {
      console.log("❌ getExpoPushTokenAsync failed:", err);
    }

    const expoToken = expoResp?.data ?? null;

    // FCM token (Android)
    let deviceResp: any = null;
    let fcmToken: string | null = null;
    try {
      deviceResp = await Notifications.getDevicePushTokenAsync();
      fcmToken = typeof deviceResp?.data === "string" ? deviceResp.data : null;
    } catch (err) {
      console.log("❌ getDevicePushTokenAsync failed:", err);
    }

    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(
        doc(db, "users", uid),
        {
          expoPushToken: expoToken || null,
          notificationsEnabled: true,
          expoPushUpdatedAt: new Date(),
          debugLastPermissionStatus: final,
          debugLastExpoProjectIdA: pjA || null,
          debugLastExpoProjectIdB: pjB || null,
          debugLastExpoPushRaw: expoResp || null,
          debugLastDevicePushRaw: deviceResp || null,
          debugLastFcmToken: fcmToken || null,
        },
        { merge: true }
      );
    }

    return expoToken;
  } catch (e) {
    console.error("❌ registerForPushNotificationsAsync:", e);
    return null;
  }
};

/* ----------------------- Helpers: cancel par “tag” ---------------------- */
async function getAllScheduled() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

async function cancelByTag(tag: string) {
  const list = await getAllScheduled();
  const targets = list.filter(
    (n) => (n as any)?.content?.data?.__tag === tag
  );
  for (const n of targets) {
    try {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    } catch {}
  }
}

export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const [morningId, eveningId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.morningId),
      AsyncStorage.getItem(STORAGE_KEYS.eveningId),
    ]);
    if (morningId) await Notifications.cancelScheduledNotificationAsync(morningId).catch(() => {});
    if (eveningId) await Notifications.cancelScheduledNotificationAsync(eveningId).catch(() => {});
    await cancelByTag(TAGS.MORNING);
    await cancelByTag(TAGS.EVENING);
    await AsyncStorage.multiRemove([STORAGE_KEYS.morningId, STORAGE_KEYS.eveningId]);
  } catch (e) {
    console.warn("⚠️ cancelDailyNotifications:", e);
  }
};

/* -------------- Planifier 09:00 & 19:00 (heure locale), idempotent -------------- */
export const scheduleDailyNotifications = async (): Promise<boolean> => {
  if (SCHEDULING_LOCK) {
    __DEV__ && console.log("⏳ scheduleDailyNotifications déjà en cours — skip.");
    return false;
  }
  SCHEDULING_LOCK = true;

  try {
    // 0) Android channel + permissions
    await ensureAndroidChannelAsync();

    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (final !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    if (final !== "granted") {
      console.warn("⚠️ Notifications pas autorisées — planification ignorée.");
      return false;
    }

    await registerForPushNotificationsAsync();

    // 1) Sanity user
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      return false;
    }
    const userSnap = await getDoc(doc(db, "users", userId));
    const udata = userSnap.data();
    if (!userSnap.exists() || udata?.notificationsEnabled === false) {
      console.warn("⚠️ Notifications désactivées ou utilisateur non trouvé");
      return false;
    }

    const language = udata?.language || "en";

    // 2) Nettoyage STRICT par tags + anciens IDs
    await cancelByTag(TAGS.MORNING);
    await cancelByTag(TAGS.EVENING);
    const [oldMorning, oldEvening] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.morningId),
      AsyncStorage.getItem(STORAGE_KEYS.eveningId),
    ]);
    if (oldMorning) {
      await Notifications.cancelScheduledNotificationAsync(oldMorning).catch(() => {});
    }
    if (oldEvening) {
      await Notifications.cancelScheduledNotificationAsync(oldEvening).catch(() => {});
    }

    // 3) Textes i18n
    const morningMessages = [
      i18n.t("notificationsPush.morning1", { lng: language }),
      i18n.t("notificationsPush.morning2", { lng: language }),
    ].filter(Boolean);
    const eveningMessages = [
      i18n.t("notificationsPush.evening1", { lng: language }),
      i18n.t("notificationsPush.evening2", { lng: language }),
    ].filter(Boolean);

    // 4) Triggers quotidiens cross-platform
    let morningTrigger: Notifications.NotificationTriggerInput;
    let eveningTrigger: Notifications.NotificationTriggerInput;

    if (Platform.OS === "ios") {
      // iOS → CALENDAR (supporté)
      morningTrigger = {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 9,
        minute: 0,
        second: 0,
        repeats: true,
      } as Notifications.CalendarTriggerInput;

      eveningTrigger = {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 19,
        minute: 0,
        second: 0,
        repeats: true,
      } as Notifications.CalendarTriggerInput;
    } else {
      // Android → TIME_INTERVAL (CALENDAR non supporté dans ton contexte)
      const now = new Date();

      const computeSecondsUntil = (targetHour: number) => {
        const first = new Date(now);
        first.setHours(targetHour, 0, 0, 0);
        if (first <= now) {
          first.setDate(first.getDate() + 1);
        }
        const diffMs = first.getTime() - now.getTime();
        const seconds = Math.max(60, Math.round(diffMs / 1000)); // min 60s
        return seconds;
      };

      const secondsUntilMorning = computeSecondsUntil(9);
      const secondsUntilEvening = computeSecondsUntil(19);

      morningTrigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilMorning,
        repeats: true,
        channelId: "default",
      } as Notifications.TimeIntervalTriggerInput;

      eveningTrigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilEvening,
        repeats: true,
        channelId: "default",
      } as Notifications.TimeIntervalTriggerInput;
    }

    // 5) Planification — on garde les tags
    const morningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body:
          morningMessages[Math.floor(Math.random() * morningMessages.length)] ||
          "",
        sound: "default",
        data: { __tag: TAGS.MORNING },
      },
      trigger: morningTrigger,
    });

    const eveningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body:
          eveningMessages[Math.floor(Math.random() * eveningMessages.length)] ||
          "",
        sound: "default",
        data: { __tag: TAGS.EVENING },
      },
      trigger: eveningTrigger,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.morningId, morningId],
      [STORAGE_KEYS.eveningId, eveningId],
    ]);

    __DEV__ && console.log("✅ Scheduled:", { morningId, eveningId });
    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  } finally {
    SCHEDULING_LOCK = false;
  }
};



/* -------------------- Invitation locale immédiate -------------------- */
export const sendInvitationNotification = async (userId: string, message: string): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || !userSnap.data().notificationsEnabled) {
      console.warn("⚠️ Notifications désactivées pour l'utilisateur:", userId);
      return;
    }
    const language = userSnap.data().language || "en";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body: message,
      },
      trigger: null,
    });
  } catch (error) {
    console.error("❌ Erreur envoi notification:", error);
  }
};

/* ---------------- Expo push (nudge duo) — inchangé sauf cleanup ---------------- */
type ExpoPushError = { ok: false; code?: string; message?: string; details?: any };
type ExpoPushOk = { ok: true };
type ExpoPushResult = ExpoPushOk | ExpoPushError;

const isExpoPushError = (r: ExpoPushResult): r is ExpoPushError => r.ok === false;

const sendPushToExpoToken = async (
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<ExpoPushResult> => {
  try {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
      },
      body: JSON.stringify({ to: expoPushToken, sound: "default", title, body, data }),
    });
    const json = await resp.json().catch(() => null);
    const d = json?.data;
    if (d?.status === "ok") return { ok: true };
    if (d?.status === "error") {
      const code = d?.details?.error || d?.__errorCode || undefined;
      return { ok: false, code, message: d?.message, details: d?.details };
    }
    return { ok: false, message: "Unknown Expo response", details: json };
  } catch (e: any) {
    console.error("❌ sendPushToExpoToken:", e);
    return { ok: false, message: String(e) };
  }
};

export const sendDuoNudge = async ({
  toUserId,
  challengeTitle,
}: {
  toUserId: string;
  challengeTitle: string;
}): Promise<{
  ok: boolean;
  reason?:
    | "no-user"
    | "disabled"
    | "no-token"
    | "unregistered"
    | "expo-error"
    | "error";
  expoCode?: string;
  expoMessage?: string;
}> => {
  try {
    const from = auth.currentUser;
    if (!from?.uid) return { ok: false, reason: "error" };

    const toRef = doc(db, "users", toUserId);
    const toSnap = await getDoc(toRef);
    if (!toSnap.exists()) return { ok: false, reason: "no-user" };

    const to = toSnap.data() as any;
    if (to.notificationsEnabled === false) return { ok: false, reason: "disabled" };

    const token: string | undefined = to.expoPushToken;
    const looksLikeExpo =
      typeof token === "string" &&
      (token.includes("ExponentPushToken") || token.includes("ExpoPushToken"));

    if (!token || !looksLikeExpo) {
      console.warn("⚠️ Pas de expoPushToken valable pour", toUserId);
      return { ok: false, reason: "no-token" };
    }

    const lang = to.language || "en";
    const title = i18n.t("notificationsPush.title", { lng: lang });
    const body = i18n.t("notificationsPush.nudgeBody", {
      lng: lang,
      title: challengeTitle,
      from: from.displayName || "Your duo",
    });

    const result = await sendPushToExpoToken(token, title, body, {
      type: "duo-nudge",
      challengeTitle,
      fromUserId: from.uid,
    });

    if (!isExpoPushError(result)) return { ok: true };

    const { code, message } = result;
    if (code === "DeviceNotRegistered") {
      try {
        await updateDoc(toRef, { expoPushToken: null });
      } catch (e) {
        console.warn("⚠️ Impossible de nettoyer token expiré:", e);
      }
      return { ok: false, reason: "unregistered", expoCode: code, expoMessage: message };
    }
    return { ok: false, reason: "expo-error", expoCode: code, expoMessage: message };
  } catch (e) {
    console.error("❌ sendDuoNudge:", e);
    return { ok: false, reason: "error" };
  }
};

/* ---------------- Toggles Settings (idempotents) ---------------- */
export const enableNotificationsFromSettings = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
      if (final !== "granted") return false;
    }
    await registerForPushNotificationsAsync();
    await scheduleDailyNotifications(); // idempotent maintenant
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, "users", uid), { notificationsEnabled: true });
    return true;
  } catch (e) {
    console.error("❌ enableNotificationsFromSettings:", e);
    return false;
  }
};

export const disableNotificationsFromSettings = async (): Promise<void> => {
  try {
    await cancelDailyNotifications();
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, "users", uid), { notificationsEnabled: false });
  } catch (e) {
    console.error("❌ disableNotificationsFromSettings:", e);
  }
};

/* ---------------- Tap actions: route selon le payload ---------------- */
let responseSub: Notifications.Subscription | null = null;

export const startNotificationResponseListener = (
  onNavigate: (path: string) => void,
  onToast?: (text: string) => void
) => {
  if (responseSub) return; // idempotent
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      const data: any = resp.notification.request.content.data || {};
      const type = data?.type;

      if (type === "invite-status") {
        // data: { type: 'invite-status', status, challengeId, inviteeId }
        const status: string = data?.status ?? "";
        const challengeId: string | undefined = data?.challengeId;

        if (challengeId) {
          onNavigate(`/challenge-details/${challengeId}`);
        }
        if (onToast) {
          const key = status === "accepted"
            ? "notificationsPush.inviteAcceptedToast"
            : status === "refused"
            ? "notificationsPush.inviteRefusedToast"
            : "notificationsPush.opened";
          onToast(i18n.t(key));
        }
      }
      // Tu pourras ajouter d’autres types ici: duo-nudge, special-event, etc.
    } catch (e) {
      console.warn("⚠️ startNotificationResponseListener error:", e);
    }
  });
};

export const stopNotificationResponseListener = () => {
  try {
    responseSub?.remove();
  } catch {}
  responseSub = null;
};
