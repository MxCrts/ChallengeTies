// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";
import i18n from "../i18n";
import { coerceToDayKey } from "@/hooks/useTrophiesEconomy";
import { sendDuoNudge as callSendDuoNudge, DuoNudgeParams } from "@/services/duoNudgeService";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type LocalizedPayload = {
  titleKey?: string;
  bodyKey?: string;
  params?: Record<string, any>;
  type?: string;
};

/* -------------------------------------------------------------------------- */
/*                          Payload normalization (push)                      */
/* -------------------------------------------------------------------------- */

type PushKind =
  | "daily_reminder"
  | "invite_status"
  | "duo_nudge"
  | "referral_milestone_unlocked"
  | "referral_new_child"
  | "unknown";

function normalizePushKind(data: any): PushKind {
  const rawKind = String(data?.kind || "").toLowerCase().trim();

  if (rawKind === "duo_nudge") return "duo_nudge";
  if (rawKind === "invite_status") return "invite_status"; // ✅ AJOUT
  if (rawKind === "daily_reminder") return "daily_reminder"; // optionnel, cohérent
  if (rawKind === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawKind === "referral_new_child") return "referral_new_child";

  const rawType = String(data?.type || data?.__tag || "").toLowerCase().trim();
  if (rawType === "daily-reminder") return "daily_reminder";
  if (rawType === "invite-status") return "invite_status";
  if (rawType === "duo-nudge") return "duo_nudge";
  if (rawType === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawType === "referral_new_child") return "referral_new_child";
  return "unknown";
}


/* -------------------------------------------------------------------------- */
/*                                   Storage                                  */
/* -------------------------------------------------------------------------- */

/** IDs persistés (utile si on veut annuler vite fait) */
const STORAGE_KEYS = {
  dailyId: "notif.daily.id",
  dailyScheduled: "notif.daily.scheduled.v1",
  dailyRescheduledDay: "notif.daily.rescheduled.day.v1",

  // 🆕 late reminder
  lateId: "notif.late.id",
  lateScheduled: "notif.late.scheduled.v1",
  lateRescheduledDay: "notif.late.rescheduled.day.v1",
} as const;

const TAGS = {
  DAILY: "daily_window_v1",
  LATE: "late_window_v1", // 🆕
} as const;

let LATE_SCHEDULED_IN_SESSION = false;


/* -------------------------------------------------------------------------- */
/*                              Internal state                                */
/* -------------------------------------------------------------------------- */

/** Petit mutex process pour éviter les chevauchements */
let SCHEDULING_LOCK = false;

/** ✅ Garde-fou session (évite reschedule en boucle dans le même run) */
let DAILY_SCHEDULED_IN_SESSION = false;

/* -------------------------------------------------------------------------- */
/*                                Daily config                                */
/* -------------------------------------------------------------------------- */

const DAILY_WINDOW = {
  startHour: 9,
  endHour: 19,
}; // inclusive start, inclusive end

function dayKeyLocal(d = new Date()) {
  // YYYY-MM-DD en local (stable pour notre "1x par jour")
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

async function shouldRescheduleDailyToday(): Promise<boolean> {
  const today = dayKeyLocal();
  const last = await AsyncStorage.getItem(STORAGE_KEYS.dailyRescheduledDay);
  return last !== today;
}

const LATE_WINDOW = {
  startHour: 18,
  endHour: 22,
}; // 18..22
function pickRandomHourInLateWindow() {
  const span = LATE_WINDOW.endHour - LATE_WINDOW.startHour + 1;
  return LATE_WINDOW.startHour + Math.floor(Math.random() * span);
}
function buildTodayTriggerInLateWindow() {
  const now = new Date();
  const base = new Date();
  const hour = pickRandomHourInLateWindow();
  const minute = Math.floor(Math.random() * 60);
  base.setHours(hour, minute, 0, 0);

  // ✅ Si on est déjà après l'heure prévue, on choisit soit +15min si on reste dans la fenêtre,
  // sinon on planifie demain dans la fenêtre late (sinon notif masquée par le handler).
  if (base.getTime() <= now.getTime()) {
    const bumped = new Date(now.getTime() + 15 * 60 * 1000);
    if (bumped.getHours() <= LATE_WINDOW.endHour) {
      return bumped;
    }
    const tomorrow = startOfTomorrowLocal();
    const h2 = pickRandomHourInLateWindow();
    const m2 = Math.floor(Math.random() * 60);
    tomorrow.setHours(h2, m2, 0, 0);
    return tomorrow;
  }

  return base;
}
async function shouldRescheduleLateToday(): Promise<boolean> {
  const today = dayKeyLocal();
  const last = await AsyncStorage.getItem(STORAGE_KEYS.lateRescheduledDay);
  return last !== today;
}
async function markLateRescheduledToday(): Promise<void> {
  const today = dayKeyLocal();
  await AsyncStorage.setItem(STORAGE_KEYS.lateRescheduledDay, today);
}


async function markDailyRescheduledToday(): Promise<void> {
  const today = dayKeyLocal();
  await AsyncStorage.setItem(STORAGE_KEYS.dailyRescheduledDay, today);
}

function pickRandomHourInWindow() {
  // 09..19
  const span = DAILY_WINDOW.endHour - DAILY_WINDOW.startHour + 1;
  return DAILY_WINDOW.startHour + Math.floor(Math.random() * span);
}

function tSafe(key: string, options?: Record<string, any>) {
  const res = i18n.t(key, { ...(options || {}), returnObjects: false });
  return typeof res === "string" ? res : String(res ?? "");
}

function startOfTomorrowLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfTomorrowLocalBase() {
  return startOfTomorrowLocal();
}

function buildTomorrowTriggerInWindow() {
  const base = startOfTomorrowLocal();
  const hour = pickRandomHourInWindow();
  const minute = Math.floor(Math.random() * 60);
  base.setHours(hour, minute, 0, 0);
  return base;
}

function hasMarkedTodayLocal(ch: any, todayKey: string) {
  if (!ch) return false;

  const k = typeof ch.lastMarkedKey === "string" ? ch.lastMarkedKey : null;
  if (k && k === todayKey) return true;

  const iso = typeof ch.lastMarkedDate === "string" ? ch.lastMarkedDate : null;
  const fromIso = iso ? coerceToDayKey(iso) : null;
  if (fromIso && fromIso === todayKey) return true;

  const keys: string[] = Array.isArray(ch.completionDateKeys)
    ? ch.completionDateKeys
    : [];
  if (keys.includes(todayKey)) return true;

  const dates: string[] = Array.isArray(ch.completionDates)
    ? ch.completionDates
    : [];
  for (let i = dates.length - 1; i >= 0; i--) {
    const dk = coerceToDayKey(dates[i]);
    if (dk === todayKey) return true;
  }

  return false;
}

async function shouldScheduleDailyReminderForUser(userId: string): Promise<{
  ok: boolean;
  lng: string;
  hasActive: boolean;
  hasUnmarkedToday: boolean;
}> {
  const snap = await getDoc(doc(db, "users", userId));
  const u = snap.exists() ? (snap.data() as any) : null;

  if (!u) return { ok: false, lng: "en", hasActive: false, hasUnmarkedToday: false };
  if (u.notificationsEnabled === false)
    return {
      ok: false,
      lng: String(u.language || "en"),
      hasActive: false,
      hasUnmarkedToday: false,
    };

  const lng = String(u.language || "en");
  const list: any[] = Array.isArray(u.CurrentChallenges) ? u.CurrentChallenges : [];
  const hasActive = list.length > 0;
  if (!hasActive) return { ok: true, lng, hasActive: false, hasUnmarkedToday: false };

  const todayKey = dayKeyLocal(new Date());
  const hasUnmarkedToday = list.some((ch) => !hasMarkedTodayLocal(ch, todayKey));
  return { ok: true, lng, hasActive: true, hasUnmarkedToday };
}

/* -------------------------------------------------------------------------- */
/*                         Notification display policy                         */
/* -------------------------------------------------------------------------- */

Notifications.setNotificationHandler({
  handleNotification: async (
    notification
  ): Promise<Notifications.NotificationBehavior> => {
    try {
      const data: any = notification?.request?.content?.data || {};
      const type = String(data?.type || "").toLowerCase();
      const kind = normalizePushKind(data);

      // ✅ Helper: shape EXACT identique partout (évite TS union)
      const behavior = (show: boolean): Notifications.NotificationBehavior => ({
        shouldShowAlert: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
        // ✅ requis dans ta version expo-notifications
        shouldShowBanner: show,
        shouldShowList: show,
      });

      // Daily: on masque hors fenêtre locale
      if (kind === "daily_reminder") {
  const hour = new Date().getHours();
  const slot = String(data?.slot || "daily");

  const window =
    slot === "late"
      ? { startHour: LATE_WINDOW.startHour, endHour: LATE_WINDOW.endHour }
      : { startHour: DAILY_WINDOW.startHour, endHour: DAILY_WINDOW.endHour };

  const shouldShow = hour >= window.startHour && hour <= window.endHour;
  if (!shouldShow) return behavior(false);
}
      // Default: afficher
      return behavior(true);
    } catch (e) {
      // En cas de bug : on affiche plutôt que rien
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

export const cancelLateNotifications = async (): Promise<void> => {
  try {
    const lateId = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
    if (lateId) {
      await Notifications.cancelScheduledNotificationAsync(lateId).catch(() => {});
    }

    await cancelByTag(TAGS.LATE);

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.lateId,
      STORAGE_KEYS.lateScheduled,
      STORAGE_KEYS.lateRescheduledDay,
    ]);

    LATE_SCHEDULED_IN_SESSION = false;
  } catch (e) {
    console.warn("⚠️ cancelLateNotifications:", e);
  }
};

export const scheduleLateReminderIfNeeded = async (): Promise<boolean> => {
  if (SCHEDULING_LOCK) return false;
  SCHEDULING_LOCK = true;

  try {
    if (LATE_SCHEDULED_IN_SESSION) return true;

    const already = await AsyncStorage.getItem(STORAGE_KEYS.lateScheduled);
    if (already === "1") {
      LATE_SCHEDULED_IN_SESSION = true;
      return true;
    }

    await ensureAndroidChannelAsync();
    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    const userId = auth.currentUser?.uid;
    if (!userId) return false;

    const gate = await shouldScheduleDailyReminderForUser(userId);
    const language = gate.lng || "en";

    if (!gate.ok) return false;

    // ✅ Si pas de défis actifs OU tout est marqué → pas de late
    if (!gate.hasActive || !gate.hasUnmarkedToday) {
      await cancelLateNotifications();
      return true;
    }

    // Nettoyage strict de NOS notifs late
    await cancelByTag(TAGS.LATE);

    const oldLate = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
    if (oldLate) {
      await Notifications.cancelScheduledNotificationAsync(oldLate).catch(() => {});
    }

    const lateMessages = [
      tSafe("notificationsPush.late1", { lng: language }),
      tSafe("notificationsPush.late2", { lng: language }),
      tSafe("notificationsPush.late3", { lng: language }),
    ].filter((s) => typeof s === "string" && s.trim().length > 0);

    const triggerDate = buildTodayTriggerInLateWindow();
    const trigger = triggerDate as any as Notifications.NotificationTriggerInput;

    const lateId = await Notifications.scheduleNotificationAsync({
      content: {
        title: tSafe("notificationsPush.title", { lng: language }),
        body: lateMessages[Math.floor(Math.random() * lateMessages.length)] || "",
        sound: "default",
        data: {
          __tag: TAGS.LATE,
          type: "daily-reminder",
          kind: "daily_reminder",
          slot: "late",
          plannedAt: triggerDate.toISOString(),
        },
      },
      trigger,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.lateId, lateId],
      [STORAGE_KEYS.lateScheduled, "1"],
    ]);

    LATE_SCHEDULED_IN_SESSION = true;
    return true;
  } catch (e) {
    console.error("❌ scheduleLateReminderIfNeeded:", e);
    return false;
  } finally {
    SCHEDULING_LOCK = false;
  }
};

export const rescheduleLateIfNeeded = async () => {
  try {
    const ok = await shouldRescheduleLateToday();
    if (!ok) return;

    LATE_SCHEDULED_IN_SESSION = false;
    await AsyncStorage.removeItem(STORAGE_KEYS.lateScheduled);

    const did = await scheduleLateReminderIfNeeded();
    if (did) await markLateRescheduledToday();
  } catch {}
};


/* -------------------------------------------------------------------------- */
/*                           Android Notification Channel                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                Permissions                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                         Expo Push Registration (token)                      */
/* -------------------------------------------------------------------------- */

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  const TAG = "[PUSH]";
  const log = (...a: any[]) => console.log(TAG, ...a);

  log("START", {
    platform: Platform.OS,
    constants_isDevice: (Constants as any)?.isDevice,
    appOwnership: (Constants as any)?.appOwnership ?? null,
  });

  try {
    // ✅ Le seul cas à exclure vraiment
    if (Platform.OS === "web") {
      log("WEB → abort");
      return null;
    }

    const uid = auth.currentUser?.uid ?? null;
    log("uid:", uid);
    if (!uid) {
      log("No authenticated user → abort");
      return null;
    }

    // ✅ Permissions
    const perm = await Notifications.getPermissionsAsync();
    let finalStatus = perm.status;
    log("permission BEFORE:", finalStatus);

    if (finalStatus !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
      log("permission AFTER:", finalStatus);
    }

    if (finalStatus !== "granted") {
      log("Permission not granted → abort");
      return null;
    }

    // ✅ ProjectId (EAS / Expo)
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      null;

    log("projectId:", projectId);

    // ✅ Expo Push Token
    let expoToken: string | null = null;
    try {
      const tokenResp = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      expoToken = tokenResp?.data ?? null;
      log("expoToken:", expoToken ? `${expoToken.slice(0, 20)}…` : null);
    } catch (err) {
      log("getExpoPushTokenAsync ERROR:", err);
    }

    if (!expoToken) {
      log("No expo token returned → abort");
      return null;
    }

    // ✅ Android FCM token (debug)
    let fcmToken: string | null = null;
    try {
      const deviceResp = await Notifications.getDevicePushTokenAsync();
      fcmToken = typeof deviceResp?.data === "string" ? deviceResp.data : null;
      log("fcmToken:", fcmToken ? `${fcmToken.slice(0, 20)}…` : null);
    } catch (err) {
      log("getDevicePushTokenAsync failed:", err);
    }

    // ✅ Firestore write
    await setDoc(
      doc(db, "users", uid),
      {
        expoPushToken: expoToken,
        notificationsEnabled: true,
        expoPushUpdatedAt: new Date(),
        debugPush: {
          permission: finalStatus,
          projectId,
          fcmToken: fcmToken || null,
          platform: Platform.OS,
          constants_isDevice: (Constants as any)?.isDevice ?? null,
          appOwnership: (Constants as any)?.appOwnership ?? null,
        },
      },
      { merge: true }
    );

    log("Saved to Firestore OK");
    return expoToken;
  } catch (e) {
    console.error("💥 [PUSH] CRASH:", e);
    return null;
  } finally {
    log("END");
  }
};



/* -------------------------------------------------------------------------- */
/*                         Helpers: cancel scheduled by tag                    */
/* -------------------------------------------------------------------------- */

async function getAllScheduled() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

async function cancelByTag(tag: string) {
  const list = await getAllScheduled();
  const targets = list.filter((n) => (n as any)?.content?.data?.__tag === tag);

  for (const n of targets) {
    try {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    } catch {}
  }
}

export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const dailyId = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
    if (dailyId) {
      await Notifications.cancelScheduledNotificationAsync(dailyId).catch(() => {});
    }

    await cancelByTag(TAGS.DAILY);

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.dailyId,
      STORAGE_KEYS.dailyScheduled, // ✅ reset flag aussi
      STORAGE_KEYS.dailyRescheduledDay,
    ]);

    DAILY_SCHEDULED_IN_SESSION = false;
  } catch (e) {
    console.warn("⚠️ cancelDailyNotifications:", e);
  }
};

/* -------------------------------------------------------------------------- */
/*                        Daily scheduling (1 notif / day)                     */
/* -------------------------------------------------------------------------- */

export const scheduleDailyNotifications = async (): Promise<boolean> => {
  if (SCHEDULING_LOCK) {
    __DEV__ && console.log("⏳ scheduleDailyNotifications déjà en cours — skip.");
    return false;
  }

  SCHEDULING_LOCK = true;

  try {
    // ✅ Idempotence hard: si déjà schedulé (session ou storage) → skip total
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

    // 0) Android channel + permissions
    await ensureAndroidChannelAsync();
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn("⚠️ Notifications pas autorisées — planification ignorée.");
      return false;
    }

    // ✅ Token à jour (expo + FCM) — on ne bloque pas sur le résultat
    await registerForPushNotificationsAsync();

    // 1) Sanity user
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      return false;
    }

    const gate = await shouldScheduleDailyReminderForUser(userId);
    const language = gate.lng || "en";

    if (!gate.ok) {
      console.warn("⚠️ Notifications désactivées ou utilisateur non trouvé");
      return false;
    }

    if (!gate.hasActive) {
      await cancelDailyNotifications();
      __DEV__ && console.log("ℹ️ Daily reminder skipped (no active challenges).");
      return true; // ✅ pas une erreur : juste pas nécessaire
    }

    // 2) Nettoyage STRICT de NOS notifs uniquement
    await cancelByTag(TAGS.DAILY);

    const oldDaily = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
    if (oldDaily) {
      await Notifications.cancelScheduledNotificationAsync(oldDaily).catch(() => {});
    }

    // 3) Textes i18n (pool)
    const dailyMessages = [
      tSafe("notificationsPush.daily1", { lng: language }),
      tSafe("notificationsPush.daily2", { lng: language }),
      tSafe("notificationsPush.daily3", { lng: language }),
    ].filter((s) => typeof s === "string" && s.trim().length > 0);

    // 4) Trigger: une seule notif programmée pour demain dans la fenêtre
    const triggerDate = buildTomorrowTriggerInWindow();
    const dailyTrigger =
      triggerDate as any as Notifications.NotificationTriggerInput;

    // 5) Planification (1 notif / jour)
    const dailyId = await Notifications.scheduleNotificationAsync({
      content: {
        title: tSafe("notificationsPush.title", { lng: language }),
        body:
          dailyMessages[Math.floor(Math.random() * dailyMessages.length)] || "",
        sound: "default",
        data: {
          __tag: TAGS.DAILY,
          type: "daily-reminder",
          slot: "daily",
          plannedAt: triggerDate.toISOString(),
        },
      },
      trigger: dailyTrigger,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.dailyId, dailyId],
      [STORAGE_KEYS.dailyScheduled, "1"],
    ]);

    __DEV__ && console.log("✅ Scheduled daily (tomorrow):", { dailyId, triggerDate });

    DAILY_SCHEDULED_IN_SESSION = true;
    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  } finally {
    SCHEDULING_LOCK = false;
  }
};

/** ✅ À appeler quand une daily-reminder est reçue (ou au retour app active) */
export const rescheduleNextDailyIfNeeded = async () => {
  try {
    // ✅ verrou “1x/jour” (anti spam / anti boucles)
    const ok = await shouldRescheduleDailyToday();
    if (!ok) return;

    // on reset le flag pour autoriser un nouveau schedule
    await resetDailyNotificationsFlag();
    const did = await scheduleDailyNotifications();
    // ✅ ne verrouille la journée que si le schedule a réussi
    if (did) {
      await markDailyRescheduledToday();
    }
  } catch {}
};

/** ✅ Si tu veux forcer un reschedule (debug / changement langue / heure) */
export const resetDailyNotificationsFlag = async () => {
  DAILY_SCHEDULED_IN_SESSION = false;
  await AsyncStorage.removeItem(STORAGE_KEYS.dailyScheduled);
};

/* -------------------------------------------------------------------------- */
/*                      Local notification (immediate)                         */
/* -------------------------------------------------------------------------- */

export const sendInvitationNotification = async (
  userId: string,
  messageOrLocalized: string | LocalizedPayload
): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || userSnap.data()?.notificationsEnabled === false) {
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
        title = toStr(i18n.t(titleKey, { lng: language, ...(params || {}) }));
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

/* -------------------------------------------------------------------------- */
/*                           Referral local nudge                              */
/* -------------------------------------------------------------------------- */

const REFERRAL_MILESTONE_PREFIX = "referral.milestone.notified";

// Garde-fous mémoire pour éviter les doublons concurrents
const inFlightReferralKeys = new Set<string>();

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

    if (!reached) return;

    // 2) Clé unique pour ce user + ce palier
    const key = `${REFERRAL_MILESTONE_PREFIX}.${userId}.${reached}`;

    // 🔒 Lock mémoire (évite doublons concurrents dans la même session)
    if (inFlightReferralKeys.has(key)) return;
    inFlightReferralKeys.add(key);

    try {
      const already = await AsyncStorage.getItem(key);
      if (already === "1") return;

      await sendInvitationNotification(userId, {
        titleKey: "referral.notif.milestoneUnlocked.title",
        bodyKey: "referral.notif.milestoneUnlocked.body",
        params: payload,
        type: "referral_milestone_unlocked",
      });

      await AsyncStorage.setItem(key, "1");
    } finally {
      inFlightReferralKeys.delete(key);
    }
  } catch (e) {
    console.error("❌ sendReferralMilestoneLocalNudge (idempotent) error:", e);
  }
};

/* -------------------------------------------------------------------------- */
/*                          Expo push (duo & invites)                          */
/* -------------------------------------------------------------------------- */


/**
 * ✅ Nudge duo (CANONIQUE) — passe par Cloud Function (rate-limit + multi-token + i18n server-side)
 * Utilisé par le bouton “Encourager”
 */
export const sendDuoNudge = async (params: DuoNudgeParams): Promise<any> => {
  try {
    // params = { type: "manual"|"auto", challengeId, selectedDays, partnerId, uniqueKey? }
    return await callSendDuoNudge(params);
  } catch (e) {
    console.error("❌ sendDuoNudge (callable):", e);
    return { ok: false, reason: "error" };
  }
};


/* -------------------------------------------------------------------------- */
/*                         Settings toggles (idempotent)                       */
/* -------------------------------------------------------------------------- */

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
    await scheduleDailyNotifications(); // idempotent
    await scheduleLateReminderIfNeeded(); 

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
    await cancelLateNotifications();

    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, "users", uid), { notificationsEnabled: false });
    }
  } catch (e) {
    console.error("❌ disableNotificationsFromSettings:", e);
  }
};

/* -------------------------------------------------------------------------- */
/*                         Tap actions: routing by payload                      */
/* -------------------------------------------------------------------------- */

let responseSub: Notifications.Subscription | null = null;

export function getPathFromNotificationData(data: any): string {
  const kind = normalizePushKind(data);
  const challengeId = data?.challengeId != null ? String(data.challengeId) : undefined;

  if (kind === "daily_reminder") return "/";

  if (kind === "invite_status") {
    return challengeId ? `/challenge-details/${challengeId}` : "/(tabs)";
  }

  if (kind === "duo_nudge") {
    return challengeId ? `/challenge-details/${challengeId}` : "/current-challenges";
  }

   if (kind === "referral_milestone_unlocked" || kind === "referral_new_child") {
    return "/referral/ShareAndEarn";
  }

  if (challengeId) return `/challenge-details/${challengeId}`;

  return "/(tabs)";
}

// ✅ Anti double navigation (cold start getLastNotificationResponseAsync vs listener)
const COLD_START_HANDLED_FLAG = "__NOTIF_HANDLED_COLD_START__";
export function markNotifHandledOnColdStart() {
  try {
    (globalThis as any)[COLD_START_HANDLED_FLAG] = true;
  } catch {}
}
function consumeNotifHandledOnColdStart(): boolean {
  try {
    const v = (globalThis as any)[COLD_START_HANDLED_FLAG] === true;
    if (v) (globalThis as any)[COLD_START_HANDLED_FLAG] = false; // reset
    return v;
  } catch {
    return false;
  }
}


export const startNotificationResponseListener = (
  onNavigate: (path: string) => void,
  onToast?: (text: string) => void
) => {
  if (responseSub) return; // idempotent

  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      // ✅ Si le cold start a déjà routé, on ignore ce premier event du listener
       if (consumeNotifHandledOnColdStart()) return;
      const data: any = resp.notification.request.content.data || {};
      const kind = normalizePushKind(data);

      const tSafeLocal = (key: string, options?: Record<string, any>) => {
        const res = i18n.t(key, { ...(options || {}), returnObjects: false });
        return typeof res === "string" ? res : String(res ?? "");
      };

// ✅ Une seule source de vérité pour la route
      const path = getPathFromNotificationData(data);
      onNavigate(path);

      // ✅ Toasts : cohérents, simples, non-duplicatifs (ton wrapper safeToast gère le dedupe)
      if (!onToast) return;

      if (kind === "duo_nudge") {
        onToast(tSafeLocal("notificationsPush.duoNudgeOpened"));
        return;
      }

      if (kind === "invite_status") {
        const status: string = String(data?.status || "");
        const key =
         status === "accepted"
            ? "notificationsPush.inviteAcceptedToast"
            : status === "refused"
            ? "notificationsPush.inviteRefusedToast"
            : "notificationsPush.opened";
        onToast(tSafeLocal(key));
        return;
      }

      if (kind === "referral_new_child") {
        const username: string = String(data?.username || "");
        onToast(tSafeLocal("referral.notif.newChild.toast", { username }));
        return;
      }

      if (kind === "referral_milestone_unlocked") {
        const titleKey = data?.titleKey || "referral.nudge.title";
        const bodyKey = data?.bodyKey || "referral.nudge.body";
        const params = data?.params || {};
        const toastText =
          tSafeLocal(titleKey, params) ||
          tSafeLocal(bodyKey, params) ||
          tSafeLocal("notificationsPush.opened");
        onToast(toastText);
        return;
      }

      // daily + fallback
      onToast(tSafeLocal("notificationsPush.opened"));
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
