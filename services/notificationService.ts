// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import i18n from "../i18n";

type LocalizedPayload = {
  titleKey?: string;
  bodyKey?: string;
  params?: Record<string, any>;
  type?: string;
};


/** IDs persistés (utile si on veut annuler vite fait) */
const STORAGE_KEYS = {
  morningId: "notif.morning.id",
  eveningId: "notif.evening.id",
  dailyScheduled: "notif.daily.scheduled.v1",
} as const;

/** Tags internes pour repérer/annuler proprement nos notif planifiées */
const TAGS = {
  MORNING: "daily_morning_v1",
  EVENING: "daily_evening_v1",
} as const;

/** Petit mutex process pour éviter les chevauchements */
let SCHEDULING_LOCK = false;

/** ✅ Garde-fou session (évite reschedule en boucle dans le même run) */
let DAILY_SCHEDULED_IN_SESSION = false;

/* ------------------------- Notification handler ------------------------- */
/* ------------------------- Notification handler ------------------------- */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      const data: any = notification?.request?.content?.data || {};
      const type = data?.type;
      const slot = data?.slot; // "morning" | "evening"

      if (type === "daily-reminder") {
        const now = new Date();
        const hour = now.getHours(); // 0–23

        const isMorning = slot === "morning";
        const isEvening = slot === "evening";

        // 👉 On n'affiche que si on est VRAIMENT à la bonne heure
        const shouldShow =
          (isMorning && hour === 9) ||
          (isEvening && hour === 19);

        if (!shouldShow) {
          console.log(
            "⏱️ Daily-reminder reçu hors plage autorisée → masqué.",
            { hour, slot, type }
          );

          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            // pour la d.ts expo (iOS 15+)
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
      }

      // ✅ Tous les autres types de notif restent affichés normalement
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    } catch (e) {
      console.warn("⚠️ handleNotification error:", e);
      // En cas de bug, on préfère afficher la notif plutôt que rien
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }
  },
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
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.morningId,
      STORAGE_KEYS.eveningId,
      STORAGE_KEYS.dailyScheduled, // ✅ reset flag aussi
    ]);
    DAILY_SCHEDULED_IN_SESSION = false;
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
    // ✅ 0bis) Idempotence hard: si déjà schedulé (session ou storage) → skip total
    if (DAILY_SCHEDULED_IN_SESSION) {
      __DEV__ && console.log("✅ Daily notifs déjà schedulées (session) — skip.");
      return true;
    }
    const already = await AsyncStorage.getItem(STORAGE_KEYS.dailyScheduled);
    if (already === "1") {
      DAILY_SCHEDULED_IN_SESSION = true;
      __DEV__ && console.log("✅ Daily notifs déjà schedulées (storage) — skip.");
      return true;
    }

        // 0) Android channel + permissions (centralisé, style "grosse app")
    await ensureAndroidChannelAsync();

    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn("⚠️ Notifications pas autorisées — planification ignorée.");
      return false;
    }

    // 🔥 Anti-bug hard reset global (AVANT toute décision, pour nettoyer les anciens schedulers buggés)
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of all) {
        try {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        } catch {}
      }
    } catch {}

    // ✅ On s'assure que le token est à jour (expo + FCM), mais on ne bloque pas sur le résultat
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
    const morningTrigger = {
      hour: 9,
      minute: 0,
      repeats: true,
    } as any as Notifications.NotificationTriggerInput;

    const eveningTrigger = {
      hour: 19,
      minute: 0,
      repeats: true,
    } as any as Notifications.NotificationTriggerInput;


    // 5) Planification — on garde les tags + type pour router ensuite
    const morningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notificationsPush.title", { lng: language }),
        body:
          morningMessages[Math.floor(Math.random() * morningMessages.length)] ||
          "",
        sound: "default",
        data: {
          __tag: TAGS.MORNING,
          type: "daily-reminder",
          slot: "morning",
        },
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
        data: {
          __tag: TAGS.EVENING,
          type: "daily-reminder",
          slot: "evening",
        },
      },
      trigger: eveningTrigger,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.morningId, morningId],
      [STORAGE_KEYS.eveningId, eveningId],
      [STORAGE_KEYS.dailyScheduled, "1"],
    ]);

    __DEV__ && console.log("✅ Scheduled:", { morningId, eveningId });
    DAILY_SCHEDULED_IN_SESSION = true;
    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  } finally {
    SCHEDULING_LOCK = false;
  }
};

/** ✅ Si tu veux forcer un reschedule (debug / changement langue / heure) */
export const resetDailyNotificationsFlag = async () => {
  DAILY_SCHEDULED_IN_SESSION = false;
  await AsyncStorage.removeItem(STORAGE_KEYS.dailyScheduled);
};

/* -------------------- Notification locale immédiate -------------------- */
export const sendInvitationNotification = async (
  userId: string,
  messageOrLocalized: string | LocalizedPayload
): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || !userSnap.data().notificationsEnabled) {
      console.warn("⚠️ Notifications désactivées pour l'utilisateur:", userId);
      return;
    }
    const language = userSnap.data().language || "en";

    const toStr = (v: any) => (typeof v === "string" ? v : String(v ?? ""));
    let title = toStr(i18n.t("notificationsPush.title", { lng: language }));
    let body = "";

    if (typeof messageOrLocalized === "string") {
      body = messageOrLocalized;
    } else {
      const { titleKey, bodyKey, params } = messageOrLocalized || {};
      if (titleKey) {
        title = toStr(
          i18n.t(titleKey, { lng: language, ...(params || {}) })
        );
      }
      if (bodyKey) {
        body = toStr(i18n.t(bodyKey, { lng: language, ...(params || {}) }));
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: {
          ...(typeof messageOrLocalized === "string" ? {} : messageOrLocalized),
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error("❌ Erreur envoi notification:", error);
  }
};


const REFERRAL_MILESTONE_PREFIX = "referral.milestone.notified";
const INVITE_STATUS_NOTIF_PREFIX = "invite.status.notified";
// Garde-fous mémoire pour éviter les doublons concurrents
const inFlightInviteStatusKeys = new Set<string>();
const inFlightReferralKeys = new Set<string>();
const REFERRAL_NEW_CHILD_PREFIX = "referral.newChild.notified";
const inFlightReferralNewChildKeys = new Set<string>();




/* ---------------- Referral local nudge (optionnel mais prêt) ---------------- */
export const sendReferralMilestoneLocalNudge = async (
  userId: string,
  payload: {
    bonus: number;
    milestones: number[];
    activatedCount: number;
    username?: string; // 🆕 pour afficher "parrain de username"
  }
) => {
  try {
    // 1) Déterminer le palier réellement atteint (le plus haut <= activatedCount)
    const reached = payload.milestones
      .filter((m) => typeof m === "number" && m <= payload.activatedCount)
      .sort((a, b) => a - b)
      .pop();

    if (!reached) {
      // Aucun palier réellement atteint → pas de notif
      return;
    }

    // 2) Clé unique pour ce user + ce palier
    const key = `${REFERRAL_MILESTONE_PREFIX}.${userId}.${reached}`;
        // 🔒 Lock mémoire pour éviter les doublons concurrents dans la même session
    if (inFlightReferralKeys.has(key)) {
      return;
    }
    inFlightReferralKeys.add(key);


        try {
      const already = await AsyncStorage.getItem(key);
      if (already === "1") {
        // Ce palier a déjà déclenché une notif sur cet appareil → skip
        return;
      }

      // 3) On envoie la notif locale (comme avant)
      await sendInvitationNotification(userId, {
        titleKey: "referral.notif.milestoneUnlocked.title",
        bodyKey: "referral.notif.milestoneUnlocked.body",
        params: payload,
        type: "referral_milestone_unlocked",
      });

      // 4) On marque ce palier comme notifié
      await AsyncStorage.setItem(key, "1");
    } finally {
      inFlightReferralKeys.delete(key);
    }

  } catch (e) {
    console.error("❌ sendReferralMilestoneLocalNudge (idempotent) error:", e);
  }
};

/* ---------------- Expo push (duo & invites) ---------------- */
type ExpoPushError = {
  ok: false;
  code?: string;
  message?: string;
  details?: any;
};
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
    const d = json?.data;
    if (d?.status === "ok") return { ok: true };
    if (d?.status === "error") {
      const code = d?.details?.error || d?.__errorCode || undefined;
      return {
        ok: false,
        code,
        message: d?.message,
        details: d?.details,
      };
    }
    return { ok: false, message: "Unknown Expo response", details: json };
  } catch (e: any) {
    console.error("❌ sendPushToExpoToken:", e);
    return { ok: false, message: String(e) };
  }
};

/** ✅ Nudge duo → utilisé par le bouton “Encourager” sur challenge-details/[id] */
export const sendDuoNudge = async ({
  toUserId,
  challengeTitle,
  challengeId, // optionnel pour routing précis
}: {
  toUserId: string;
  challengeTitle: string;
  challengeId?: string;
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
    if (to.notificationsEnabled === false)
      return { ok: false, reason: "disabled" };

    const token: string | undefined = to.expoPushToken;
    const looksLikeExpo =
  typeof token === "string" && token.trim().length > 0;


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
      challengeId: challengeId ?? null,
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
      return {
        ok: false,
        reason: "unregistered",
        expoCode: code,
        expoMessage: message,
      };
    }
    return {
      ok: false,
      reason: "expo-error",
      expoCode: code,
      expoMessage: message,
    };
  } catch (e) {
    console.error("❌ sendDuoNudge:", e);
    return { ok: false, reason: "error" };
  }
};

/** ✅ Push pour informer l’inviteur quand l’invitation est acceptée / refusée */
export const sendInviteStatusPush = async ({
  inviterId,
  inviteId,
  inviteeId,
  status,
  challengeId,
  challengeTitle,
  inviteeUsername,
}: {
  inviterId: string;
  inviteId: string;
  inviteeId?: string | null;
  status: "accepted" | "refused";
  challengeId: string;
  challengeTitle?: string | null;
  inviteeUsername?: string | null;
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
  // 🔒 clé d'idempotence ultra-stable : inviteId + status + inviter
  const dedupeKey = `${INVITE_STATUS_NOTIF_PREFIX}.${inviterId}.${inviteId}.${status}`;

  // 1) Lock mémoire (évite doublons concurrents dans la même session)
  if (inFlightInviteStatusKeys.has(dedupeKey)) {
    return { ok: true };
  }
  inFlightInviteStatusKeys.add(dedupeKey);

  try {
    const inviterRef = doc(db, "users", inviterId);
    const inviterSnap = await getDoc(inviterRef);
    if (!inviterSnap.exists()) return { ok: false, reason: "no-user" };

    const inviter = inviterSnap.data() as any;
    if (inviter.notificationsEnabled === false)
      return { ok: false, reason: "disabled" };

    const token: string | undefined = inviter.expoPushToken;
    const looksLikeExpo =
      typeof token === "string" && token.trim().length > 0;

    if (!token || !looksLikeExpo) {
      console.warn("⚠️ Pas de expoPushToken valable pour", inviterId);
      return { ok: false, reason: "no-token" };
    }

    const lang = inviter.language || "en";

    // 🔒 Garde-fou idempotent (persistant) : même invit / même status → une seule notif
    const already = await AsyncStorage.getItem(dedupeKey);
    if (already === "1") {
      return { ok: true };
    }

    const prefix =
      status === "accepted"
        ? "notificationsPush.inviteAccepted"
        : "notificationsPush.inviteRefused";

    const title = i18n.t(`${prefix}.title`, {
      lng: lang,
      username: inviteeUsername || "",
    });
    const body = i18n.t(`${prefix}.body`, {
      lng: lang,
      username: inviteeUsername || "",
      title: challengeTitle || "",
    });

    const result = await sendPushToExpoToken(token, title, body, {
      type: "invite-status",
      status,
      challengeId,
      inviteeId: inviteeId ?? null,
    });

    if (!isExpoPushError(result)) {
      // ✅ On marque cette notif comme envoyée (idempotence persistante)
      try {
        await AsyncStorage.setItem(dedupeKey, "1");
      } catch {}
      return { ok: true };
    }

    const { code, message } = result;
    if (code === "DeviceNotRegistered") {
      try {
        await updateDoc(inviterRef, { expoPushToken: null });
      } catch (e) {
        console.warn("⚠️ Impossible de nettoyer token expiré:", e);
      }
      return {
        ok: false,
        reason: "unregistered",
        expoCode: code,
        expoMessage: message,
      };
    }
    return {
      ok: false,
      reason: "expo-error",
      expoCode: code,
      expoMessage: message,
    };
  } catch (e) {
    console.error("❌ sendInviteStatusPush:", e);
    return { ok: false, reason: "error" };
  } finally {
    inFlightInviteStatusKeys.delete(dedupeKey);
  }
};



/** ✅ Notif parrain : “vous êtes désormais le parrain de username” */
/** ✅ Notif parrain : “vous êtes désormais le parrain de username” */
export const sendReferralNewChildPush = async ({
  sponsorId,
  childUsername,
}: {
  sponsorId: string;
  childUsername: string;
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
  // 🔒 Clé d'idempotence ultra-stable : sponsor + username (normalisé)
  const normalizedUsername = (childUsername || "").trim().toLowerCase();
  const dedupeKey = `${REFERRAL_NEW_CHILD_PREFIX}.${sponsorId}.${normalizedUsername}`;

  // 1) Lock mémoire (évite doublons concurrents dans la même session)
  if (inFlightReferralNewChildKeys.has(dedupeKey)) {
    return { ok: true };
  }
  inFlightReferralNewChildKeys.add(dedupeKey);

  try {
    // 2) Garde-fou persistant (AsyncStorage) → si déjà notifié, on skip
    const already = await AsyncStorage.getItem(dedupeKey);
    if (already === "1") {
      return { ok: true };
    }

    const sponsorRef = doc(db, "users", sponsorId);
    const sponsorSnap = await getDoc(sponsorRef);
    if (!sponsorSnap.exists()) return { ok: false, reason: "no-user" };

    const sponsor = sponsorSnap.data() as any;
    if (sponsor.notificationsEnabled === false)
      return { ok: false, reason: "disabled" };

    const token: string | undefined = sponsor.expoPushToken;
    const looksLikeExpo =
      typeof token === "string" && token.trim().length > 0;

    if (!token || !looksLikeExpo) {
      console.warn("⚠️ Pas de expoPushToken valable pour", sponsorId);
      return { ok: false, reason: "no-token" };
    }

    const lang = sponsor.language || "en";
    const title = i18n.t("referral.notif.newChild.title", {
      lng: lang,
      username: childUsername,
    });
    const body = i18n.t("referral.notif.newChild.body", {
      lng: lang,
      username: childUsername,
    });

    const result = await sendPushToExpoToken(token, title, body, {
      type: "referral_new_child",
      username: childUsername,
    });

    if (!isExpoPushError(result)) {
      // ✅ On marque cette notif comme envoyée (idempotence persistante)
      try {
        await AsyncStorage.setItem(dedupeKey, "1");
      } catch {}
      return { ok: true };
    }

    const { code, message } = result;
    if (code === "DeviceNotRegistered") {
      try {
        await updateDoc(sponsorRef, { expoPushToken: null });
      } catch (e) {
        console.warn("⚠️ Impossible de nettoyer token expiré:", e);
      }
      return {
        ok: false,
        reason: "unregistered",
        expoCode: code,
        expoMessage: message,
      };
    }
    return {
      ok: false,
      reason: "expo-error",
      expoCode: code,
      expoMessage: message,
    };
  } catch (e) {
    console.error("❌ sendReferralNewChildPush:", e);
    return { ok: false, reason: "error" };
  } finally {
    inFlightReferralNewChildKeys.delete(dedupeKey);
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
    if (uid)
      await updateDoc(doc(db, "users", uid), {
        notificationsEnabled: true,
      });
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
    if (uid)
      await updateDoc(doc(db, "users", uid), {
        notificationsEnabled: false,
      });
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
  responseSub =
    Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        const data: any = resp.notification.request.content.data || {};
        const type = data?.type;

        // ✅ helper: garantit un string (évite string | object)
        const tSafe = (key: string, options?: Record<string, any>) => {
          const res = i18n.t(key, {
            ...(options || {}),
            returnObjects: false,
          });
          return typeof res === "string" ? res : String(res ?? "");
        };

        // Daily reminders → home / index
        if (type === "daily-reminder") {
          onNavigate("/");
          if (onToast) {
            onToast(tSafe("notificationsPush.opened"));
          }
          return;
        }

        if (type === "invite-status") {
          // data: { type: 'invite-status', status, challengeId, inviteeId }
          const status: string = data?.status ?? "";
          const challengeId: string | undefined = data?.challengeId;

          if (challengeId) {
            onNavigate(`/challenge-details/${challengeId}`);
          }
          if (onToast) {
            const key =
              status === "accepted"
                ? "notificationsPush.inviteAcceptedToast"
                : status === "refused"
                ? "notificationsPush.inviteRefusedToast"
                : "notificationsPush.opened";
            onToast(tSafe(key));
          }
          return;
        }

        if (type === "duo-nudge") {
          const challengeId: string | undefined = data?.challengeId;
          if (challengeId) {
            onNavigate(`/challenge-details/${challengeId}`);
          } else {
            onNavigate("/current-challenges");
          }
          if (onToast) {
            onToast(tSafe("notificationsPush.duoNudgeOpened", {}));
          }
          return;
        }

        if (type === "referral_milestone_unlocked") {
          onNavigate("/referral/ShareAndEarn");

          if (onToast) {
            const titleKey = data?.titleKey || "referral.nudge.title";
            const bodyKey = data?.bodyKey || "referral.nudge.body";
            const params = data?.params || {};

            const toastText =
              tSafe(titleKey, params) ||
              tSafe(bodyKey, params) ||
              tSafe("referral.nudge.title");

            onToast(toastText);
          }
          return;
        }

        if (type === "referral_new_child") {
          onNavigate("/referral/ShareAndEarn");
          if (onToast) {
            const username: string = data?.username || "";
            onToast(
              tSafe("referral.notif.newChild.toast", {
                username,
              })
            );
          }
          return;
        }

        // Fallback générique éventuellement
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
