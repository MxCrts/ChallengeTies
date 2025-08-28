// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, setDoc  } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import i18n from "../i18n";

const STORAGE_KEYS = {
  morningId: "notif.morning.id",
  eveningId: "notif.evening.id",
};

// ---------- Handler (affichage) ----------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------- Canal Android propre ----------
export const ensureAndroidChannelAsync = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default", // ✅ string attendu (et non boolean)
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
    if (!Constants.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== "granted") return null;

    let tokenResp;
    try {
      tokenResp = await Notifications.getExpoPushTokenAsync({
        projectId:
          (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
          (Constants as any)?.easConfig?.projectId,
      });
    } catch {
      tokenResp = await Notifications.getExpoPushTokenAsync();
    }
    const token = tokenResp?.data ?? null;

    const uid = auth.currentUser?.uid;
    if (uid && token) {
      await setDoc(
        doc(db, "users", uid),
        {
          expoPushToken: token,
          notificationsEnabled: true,
          expoPushUpdatedAt: new Date(),
        },
        { merge: true }
      );
    }
    return token;
  } catch (e) {
    console.error("❌ registerForPushNotificationsAsync:", e);
    return null;
  }
};

// ---------- Planifier 09:00 & 19:00 (heure locale), sans doublons ----------
export const scheduleDailyNotifications = async (): Promise<boolean> => {
  try {
    await ensureAndroidChannelAsync();

    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      return false;
    }

    const userSnap = await getDoc(doc(db, "users", userId));
    if (!userSnap.exists() || !userSnap.data()?.notificationsEnabled) {
      console.warn("⚠️ Notifications désactivées ou utilisateur non trouvé");
      return false;
    }

    const language = userSnap.data()?.language || "en";

    // 🔒 Annule proprement nos anciennes notifs planifiées (si présentes)
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

    // 🗨️ Textes i18n
    const morningMessages = [
      i18n.t("notificationsPush.morning1", { lng: language }),
      i18n.t("notificationsPush.morning2", { lng: language }),
    ];
    const eveningMessages = [
      i18n.t("notificationsPush.evening1", { lng: language }),
      i18n.t("notificationsPush.evening2", { lng: language }),
    ];

    // ✅ Triggers tapés correctement (plus d’erreurs TS)
    const morningTrigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY, 
      hour: 9,
      minute: 0,
      ...(Platform.OS === "android" ? { channelId: "default" } : {}),
    };

    const eveningTrigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY, 
      hour: 19,
      minute: 0,
      ...(Platform.OS === "android" ? { channelId: "default" } : {}),
    };

    // 09:00 local
    const morningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body: morningMessages[Math.floor(Math.random() * morningMessages.length)],
        sound: Platform.OS === "ios" ? "default" : undefined,
      },
      trigger: morningTrigger,
    });

    // 19:00 local
    const eveningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body: eveningMessages[Math.floor(Math.random() * eveningMessages.length)],
        sound: Platform.OS === "ios" ? "default" : undefined,
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

// ---------- Envoi push Expo (nudge duo) ----------
const sendPushToExpoToken = async (
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
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
  } catch (e) {
    console.error("❌ sendPushToExpoToken:", e);
  }
};

// 🔔 Nudge Duo
export const sendDuoNudge = async ({
  toUserId,
  challengeTitle,
}: {
  toUserId: string;
  challengeTitle: string;
}): Promise<boolean> => {
  try {
    const from = auth.currentUser;
    if (!from?.uid) return false;

    const toSnap = await getDoc(doc(db, "users", toUserId));
    if (!toSnap.exists()) return false;

    const to = toSnap.data() as any;
    if (!to.notificationsEnabled) return false;

    const lang = to.language || "en";
    const token = to.expoPushToken;
    if (!token) {
      console.warn("⚠️ Pas de expoPushToken pour", toUserId);
      return false;
    }

    const title = i18n.t("notificationsPush.title", { lng: lang });
    const body = i18n.t("notificationsPush.nudgeBody", {
      lng: lang,
      title: challengeTitle,
      from: from.displayName || "Your duo",
    });

    await sendPushToExpoToken(token, title, body, {
      type: "duo-nudge",
      challengeTitle,
      fromUserId: from.uid,
    });

    return true;
  } catch (e) {
    console.error("❌ sendDuoNudge:", e);
    return false;
  }
};
