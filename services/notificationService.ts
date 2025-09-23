// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import i18n from "../i18n";

const STORAGE_KEYS = {
  morningId: "notif.morning.id",
  eveningId: "notif.evening.id",
};

// ---------- Handler (affichage) ----------
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      // iOS (anciens SDK):      shouldShowAlert
      // iOS (SDK récents):      shouldShowBanner + shouldShowList
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,

      // commun
      shouldPlaySound: true,
      shouldSetBadge: false,
    } as Notifications.NotificationBehavior),
});

export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const [morningId, eveningId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.morningId),
      AsyncStorage.getItem(STORAGE_KEYS.eveningId),
    ]);
    if (morningId) await Notifications.cancelScheduledNotificationAsync(morningId).catch(() => {});
    if (eveningId) await Notifications.cancelScheduledNotificationAsync(eveningId).catch(() => {});
    await AsyncStorage.multiRemove([STORAGE_KEYS.morningId, STORAGE_KEYS.eveningId]);
  } catch (e) {
    console.warn("⚠️ cancelDailyNotifications:", e);
  }
};


// ---------- Canal Android propre ----------
export const ensureAndroidChannelAsync = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF8C00",
  });
};

// ---------- Permissions (robuste) ----------
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

// ---------- Token Expo Push (pour nudges duo) ----------
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    if (!Constants.isDevice) {
      console.log("🔧 Not a real device → no push token");
      return null;
    }

    // 0) Permissions
    const perm = await Notifications.getPermissionsAsync();
    let final = perm.status;
    if (final !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    console.log("🔔 Permission notifications (register):", final);
    if (final !== "granted") return null;

    // 1) Debug projet Expo (super utile pour comprendre un token=null)
    const pjA = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
    const pjB = (Constants as any)?.easConfig?.projectId;
    console.log("🪪 Expo projectId A (expoConfig.extra.eas.projectId):", pjA);
    console.log("🪪 Expo projectId B (easConfig.projectId):", pjB);

    // 2) Tentative Expo push token
    let expoResp: any = null;
    try {
      if (pjA || pjB) {
        expoResp = await Notifications.getExpoPushTokenAsync({
          projectId: pjA || pjB,
        });
      } else {
        // fallback (devrait rarement être nécessaire)
        expoResp = await Notifications.getExpoPushTokenAsync();
      }
    } catch (err) {
      console.log("❌ getExpoPushTokenAsync failed:", err);
    }

    const expoToken = expoResp?.data ?? null;
    console.log("🔔 Expo push token (data):", expoToken);
    console.log("🔍 Expo push raw response:", expoResp);

    // 3) Enregistre aussi le device token FCM (diagnostic)
    let deviceResp: any = null;
    let fcmToken: string | null = null;
    try {
      deviceResp = await Notifications.getDevicePushTokenAsync();
      // Sur Android => { type: 'fcm', data: '<FCM_TOKEN>' }
      fcmToken = typeof deviceResp?.data === "string" ? deviceResp.data : null;
    } catch (err) {
      console.log("❌ getDevicePushTokenAsync failed:", err);
    }
    console.log("📦 Device push token (Android FCM attendu):", deviceResp);

    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(
        doc(db, "users", uid),
        {
          expoPushToken: expoToken || null,
          notificationsEnabled: true,
          expoPushUpdatedAt: new Date(),
          // champs debug très parlants :
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

    return expoToken; // même si null → on saura lire le FCM dans Firestore
  } catch (e) {
    console.error("❌ registerForPushNotificationsAsync:", e);
    return null;
  }
};


// ---------- Planifier 09:00 & 19:00 (heure locale), sans doublons ----------
export const scheduleDailyNotifications = async (): Promise<boolean> => {
  try {
    // 0) Channel Android
    await ensureAndroidChannelAsync();

    // ANDROID: pas de calendar triggers → on skip la planif
    if (Platform.OS === "android") {
      const { status } = await Notifications.getPermissionsAsync();
      console.log("🔔 Android notif permission:", status);
      if (status === "granted") {
        await registerForPushNotificationsAsync(); // on assure le token
      } else {
        console.warn("⚠️ Notifications pas autorisées — planification ignorée (Android).");
      }
      console.warn("↪️ Android: skip scheduleDailyNotifications (calendar triggers non supportés).");
      return false;
    }

    // iOS à partir d’ici
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn("⚠️ Notifications pas autorisées — planification iOS ignorée.");
      return false;
    }

    // OK pour récupérer/mettre à jour le token (iOS)
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

    // 2) Annule proprement nos anciennes notifs planifiées
    const [oldMorning, oldEvening] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.morningId),
      AsyncStorage.getItem(STORAGE_KEYS.eveningId),
    ]);
    if (oldMorning) await Notifications.cancelScheduledNotificationAsync(oldMorning).catch(() => {});
    if (oldEvening) await Notifications.cancelScheduledNotificationAsync(oldEvening).catch(() => {});

    // 3) Textes i18n
    const morningMessages = [
      i18n.t("notificationsPush.morning1", { lng: language }),
      i18n.t("notificationsPush.morning2", { lng: language }),
    ];
    const eveningMessages = [
      i18n.t("notificationsPush.evening1", { lng: language }),
      i18n.t("notificationsPush.evening2", { lng: language }),
    ];

    // 4) Triggers quotidiens (iOS uniquement)
    const morningTrigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 9,
      minute: 0,
      repeats: true,
    };

    const eveningTrigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 19,
      minute: 0,
      repeats: true,
    };

    // 5) Planification
    const morningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body: morningMessages[Math.floor(Math.random() * morningMessages.length)],
        sound: "default",
      },
      trigger: morningTrigger,
    });

    const eveningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body: eveningMessages[Math.floor(Math.random() * eveningMessages.length)],
        sound: "default",
      },
      trigger: eveningTrigger,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.morningId, morningId],
      [STORAGE_KEYS.eveningId, eveningId],
    ]);

    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  }
};


// ---------- Invitation locale immédiate ----------
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

// ---------- Envoi push Expo (nudge duo) avec lecture de réponse ----------
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
      body: JSON.stringify({
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data,
      }),
    });

    const json = await resp.json().catch(() => null);

    // Réponses Expo typiques:
    // { data: { status: 'ok' } }
    // { data: { status: 'error', message, details: { error: 'DeviceNotRegistered' } } }
    const d = json?.data;
    if (d?.status === "ok") return { ok: true };

    if (d?.status === "error") {
      const code = d?.details?.error || d?.__errorCode || undefined;
      return { ok: false, code, message: d?.message, details: d?.details };
    }

    // Réponse inattendue
    return { ok: false, message: "Unknown Expo response", details: json };
  } catch (e: any) {
    console.error("❌ sendPushToExpoToken:", e);
    return { ok: false, message: String(e) };
  }
};

// 🔔 Nudge Duo — robuste (accepte tous formats token, nettoie si désenregistré)
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
    | "unregistered" // Expo: DeviceNotRegistered
    | "expo-error" // autre erreur Expo
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

    if (to.notificationsEnabled === false) {
      return { ok: false, reason: "disabled" };
    }

    const token: string | undefined = to.expoPushToken;
    // Expo a pu retourner différents formats : "ExponentPushToken[xxx]" ou "ExpoPushToken[xxx]"
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

if (!isExpoPushError(result)) {
  // ok: true
  return { ok: true };
}

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

// ---------- Helpers pour Settings (toggles) ----------

export const enableNotificationsFromSettings = async (): Promise<boolean> => {
  try {
    // Vérifie permissions
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;

    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
      if (final !== "granted") {
        return false; // refusé → à gérer côté Settings (ouvrir réglages)
      }
    }

    // Maintenant granted → enregistre token + planifie
    await registerForPushNotificationsAsync();
    await scheduleDailyNotifications();

    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, "users", uid), { notificationsEnabled: true });
    }
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
    if (uid) {
      await updateDoc(doc(db, "users", uid), { notificationsEnabled: false });
    }
  } catch (e) {
    console.error("❌ disableNotificationsFromSettings:", e);
  }
};

