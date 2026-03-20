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
import { publishToGlobalFeed, isFeedEnabled } from "@/src/services/globalFeedService";

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
  | "streak_danger"
  | "milestone"
  | "duo_lead"
  | "referral_milestone_unlocked"
  | "referral_new_child"
  | "unknown";

function normalizePushKind(data: any): PushKind {
  const rawKind = String(data?.kind || "").toLowerCase().trim();
  if (rawKind === "duo_nudge")                  return "duo_nudge";
  if (rawKind === "invite_status")              return "invite_status";
  if (rawKind === "daily_reminder")             return "daily_reminder";
  if (rawKind === "streak_danger")              return "streak_danger";
  if (rawKind === "milestone")                  return "milestone";
  if (rawKind === "duo_lead")                   return "duo_lead";
  if (rawKind === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawKind === "referral_new_child")         return "referral_new_child";

  const rawType = String(data?.type || data?.__tag || "").toLowerCase().trim();
  if (rawType === "daily-reminder")   return "daily_reminder";
  if (rawType === "invite-status")    return "invite_status";
  if (rawType === "duo-nudge")        return "duo_nudge";
  if (rawType === "streak-danger")    return "streak_danger";
  if (rawType === "milestone")        return "milestone";
  if (rawType === "duo-lead")         return "duo_lead";
  if (rawType === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawType === "referral_new_child")          return "referral_new_child";
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/*                                   Storage                                  */
/* -------------------------------------------------------------------------- */

const STORAGE_KEYS = {
  dailyId:              "notif.daily.id",
  dailyScheduled:       "notif.daily.scheduled.v1",
  dailyRescheduledDay:  "notif.daily.rescheduled.day.v1",
  lateId:               "notif.late.id",
  lateScheduled:        "notif.late.scheduled.v1",
  lateRescheduledDay:   "notif.late.rescheduled.day.v1",
  // 🆕 streak danger
  streakDangerId:       "notif.streak.danger.id",
  streakDangerDay:      "notif.streak.danger.day.v1",
  // 🆕 milestone : on stocke "dernière clé milestone envoyée" par challenge
  milestonePrefix:      "notif.milestone",
} as const;

const TAGS = {
  DAILY:         "daily_window_v1",
  LATE:          "late_window_v1",
  STREAK_DANGER: "streak_danger_v1",
  MILESTONE:     "milestone_v1",
} as const;

/* -------------------------------------------------------------------------- */
/*                              Internal state                                */
/* -------------------------------------------------------------------------- */

let SCHEDULING_LOCK         = false;
let DAILY_SCHEDULED_IN_SESSION   = false;
let LATE_SCHEDULED_IN_SESSION    = false;
let STREAK_SCHEDULED_IN_SESSION  = false;

/* -------------------------------------------------------------------------- */
/*                           Utility helpers                                  */
/* -------------------------------------------------------------------------- */

function dayKeyLocal(d = new Date()) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
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

function hasMarkedTodayLocal(ch: any, todayKey: string): boolean {
  if (!ch) return false;
  const k = typeof ch.lastMarkedKey === "string" ? ch.lastMarkedKey : null;
  if (k && k === todayKey) return true;
  const iso = typeof ch.lastMarkedDate === "string" ? ch.lastMarkedDate : null;
  const fromIso = iso ? coerceToDayKey(iso) : null;
  if (fromIso && fromIso === todayKey) return true;
  const keys: string[] = Array.isArray(ch.completionDateKeys) ? ch.completionDateKeys : [];
  if (keys.includes(todayKey)) return true;
  const dates: string[] = Array.isArray(ch.completionDates) ? ch.completionDates : [];
  for (let i = dates.length - 1; i >= 0; i--) {
    if (coerceToDayKey(dates[i]) === todayKey) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                          Daily window config                               */
/* -------------------------------------------------------------------------- */

const DAILY_WINDOW = { startHour: 9,  endHour: 19 };
const LATE_WINDOW  = { startHour: 18, endHour: 22 };

function pickRandomHourInWindow(w: { startHour: number; endHour: number }) {
  return w.startHour + Math.floor(Math.random() * (w.endHour - w.startHour + 1));
}

function buildTomorrowTriggerInWindow() {
  const base = startOfTomorrowLocal();
  base.setHours(pickRandomHourInWindow(DAILY_WINDOW), Math.floor(Math.random() * 60), 0, 0);
  return base;
}

function buildTodayTriggerInLateWindow() {
  const now  = new Date();
  const base = new Date();
  const h    = pickRandomHourInWindow(LATE_WINDOW);
  const m    = Math.floor(Math.random() * 60);
  base.setHours(h, m, 0, 0);
  if (base.getTime() <= now.getTime()) {
    const bumped = new Date(now.getTime() + 15 * 60 * 1000);
    if (bumped.getHours() <= LATE_WINDOW.endHour) return bumped;
    const tomorrow = startOfTomorrowLocal();
    tomorrow.setHours(pickRandomHourInWindow(LATE_WINDOW), Math.floor(Math.random() * 60), 0, 0);
    return tomorrow;
  }
  return base;
}

/* -------------------------------------------------------------------------- */
/*                       User gate (shared by all schedulers)                 */
/* -------------------------------------------------------------------------- */

async function shouldScheduleDailyReminderForUser(userId: string): Promise<{
  ok: boolean;
  lng: string;
  hasActive: boolean;
  hasUnmarkedToday: boolean;
  unmarkedChallenges: any[];
}> {
  const snap = await getDoc(doc(db, "users", userId));
  const u = snap.exists() ? (snap.data() as any) : null;
  if (!u) return { ok: false, lng: "en", hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };
  if (u.notificationsEnabled === false)
    return { ok: false, lng: String(u.language || "en"), hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };

  const lng    = String(u.language || "en");
  const list: any[] = Array.isArray(u.CurrentChallenges) ? u.CurrentChallenges : [];
  const hasActive = list.length > 0;
  if (!hasActive) return { ok: true, lng, hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };

  const todayKey          = dayKeyLocal();
  const unmarkedChallenges = list.filter(ch => !hasMarkedTodayLocal(ch, todayKey));
  const hasUnmarkedToday  = unmarkedChallenges.length > 0;
  return { ok: true, lng, hasActive: true, hasUnmarkedToday, unmarkedChallenges };
}

/* -------------------------------------------------------------------------- */
/*                      Notification display policy                            */
/* -------------------------------------------------------------------------- */

Notifications.setNotificationHandler({
  handleNotification: async (notification): Promise<Notifications.NotificationBehavior> => {
    try {
      const data: any = notification?.request?.content?.data || {};
      const kind = normalizePushKind(data);

      const behavior = (show: boolean): Notifications.NotificationBehavior => ({
        shouldShowAlert:  show,
        shouldPlaySound:  show,
        shouldSetBadge:   false,
        shouldShowBanner: show,
        shouldShowList:   show,
      });

      if (kind === "daily_reminder") {
        const hour = new Date().getHours();
        const slot = String(data?.slot || "daily");
        const window = slot === "late" ? LATE_WINDOW : DAILY_WINDOW;
        return behavior(hour >= window.startHour && hour <= window.endHour);
      }

      // streak_danger, milestone, duo_lead → toujours afficher
      return behavior(true);
    } catch {
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true };
    }
  },
});

/* -------------------------------------------------------------------------- */
/*                         Android channel                                    */
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
/*                              Permissions                                   */
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
  } catch {
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/*                          Expo Push Registration                            */
/* -------------------------------------------------------------------------- */

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  const TAG = "[PUSH]";
  const log = (...a: any[]) => console.log(TAG, ...a);
  log("START", { platform: Platform.OS, constants_isDevice: (Constants as any)?.isDevice, appOwnership: (Constants as any)?.appOwnership ?? null });
  try {
    if (Platform.OS === "web") { log("WEB → abort"); return null; }
    const uid = auth.currentUser?.uid ?? null;
    log("uid:", uid);
    if (!uid) { log("No authenticated user → abort"); return null; }
    const perm = await Notifications.getPermissionsAsync();
    let finalStatus = perm.status;
    log("permission BEFORE:", finalStatus);
    if (finalStatus !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
      log("permission AFTER:", finalStatus);
    }
    if (finalStatus !== "granted") { log("Permission not granted → abort"); return null; }
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId ?? null;
    log("projectId:", projectId);
    let expoToken: string | null = null;
    try {
      const tokenResp = projectId ? await Notifications.getExpoPushTokenAsync({ projectId }) : await Notifications.getExpoPushTokenAsync();
      expoToken = tokenResp?.data ?? null;
      log("expoToken:", expoToken ? `${expoToken.slice(0, 20)}…` : null);
    } catch (err) { log("getExpoPushTokenAsync ERROR:", err); }
    if (!expoToken) { log("No expo token returned → abort"); return null; }
    let fcmToken: string | null = null;
    try {
      const deviceResp = await Notifications.getDevicePushTokenAsync();
      fcmToken = typeof deviceResp?.data === "string" ? deviceResp.data : null;
      log("fcmToken:", fcmToken ? `${fcmToken.slice(0, 20)}…` : null);
    } catch (err) { log("getDevicePushTokenAsync failed:", err); }
    await setDoc(doc(db, "users", uid), {
      expoPushToken: expoToken, notificationsEnabled: true, expoPushUpdatedAt: new Date(),
      debugPush: { permission: finalStatus, projectId, fcmToken: fcmToken || null, platform: Platform.OS, constants_isDevice: (Constants as any)?.isDevice ?? null, appOwnership: (Constants as any)?.appOwnership ?? null },
    }, { merge: true });
    log("Saved to Firestore OK");
    return expoToken;
  } catch (e) {
    console.error("💥 [PUSH] CRASH:", e);
    return null;
  } finally { log("END"); }
};

/* -------------------------------------------------------------------------- */
/*                       Helpers: cancel by tag                               */
/* -------------------------------------------------------------------------- */

async function getAllScheduled() {
  try { return await Notifications.getAllScheduledNotificationsAsync(); } catch { return []; }
}

async function cancelByTag(tag: string) {
  const list    = await getAllScheduled();
  const targets = list.filter(n => (n as any)?.content?.data?.__tag === tag);
  for (const n of targets) {
    try { await Notifications.cancelScheduledNotificationAsync(n.identifier); } catch {}
  }
}

/* -------------------------------------------------------------------------- */
/*                          Daily notification                                */
/* -------------------------------------------------------------------------- */

async function shouldRescheduleDailyToday(): Promise<boolean> {
  const today = dayKeyLocal();
  const last  = await AsyncStorage.getItem(STORAGE_KEYS.dailyRescheduledDay);
  return last !== today;
}
async function markDailyRescheduledToday(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.dailyRescheduledDay, dayKeyLocal());
}

export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const dailyId = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
    if (dailyId) await Notifications.cancelScheduledNotificationAsync(dailyId).catch(() => {});
    await cancelByTag(TAGS.DAILY);
    await AsyncStorage.multiRemove([STORAGE_KEYS.dailyId, STORAGE_KEYS.dailyScheduled, STORAGE_KEYS.dailyRescheduledDay]);
    DAILY_SCHEDULED_IN_SESSION = false;
  } catch (e) { console.warn("⚠️ cancelDailyNotifications:", e); }
};

export const scheduleDailyNotifications = async (): Promise<boolean> => {
  if (SCHEDULING_LOCK) return false;
  SCHEDULING_LOCK = true;
  try {
    if (DAILY_SCHEDULED_IN_SESSION) return true;
    const already = await AsyncStorage.getItem(STORAGE_KEYS.dailyScheduled);
    if (already === "1") { DAILY_SCHEDULED_IN_SESSION = true; return true; }
    await ensureAndroidChannelAsync();
    const granted = await requestNotificationPermissions();
    if (!granted) return false;
    await registerForPushNotificationsAsync();
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    const gate     = await shouldScheduleDailyReminderForUser(userId);
    const language = gate.lng || "en";
    if (!gate.ok) return false;
    if (!gate.hasActive) { await cancelDailyNotifications(); return true; }
    await cancelByTag(TAGS.DAILY);
    const oldDaily = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
    if (oldDaily) await Notifications.cancelScheduledNotificationAsync(oldDaily).catch(() => {});
    const dailyMessages = [
      tSafe("notificationsPush.daily1", { lng: language }),
      tSafe("notificationsPush.daily2", { lng: language }),
      tSafe("notificationsPush.daily3", { lng: language }),
    ].filter(s => s.trim().length > 0);
    const triggerDate  = buildTomorrowTriggerInWindow();
    const dailyId      = await Notifications.scheduleNotificationAsync({
      content: {
        title: tSafe("notificationsPush.title", { lng: language }),
        body:  dailyMessages[Math.floor(Math.random() * dailyMessages.length)] || "",
        sound: "default",
        data:  { __tag: TAGS.DAILY, type: "daily-reminder", kind: "daily_reminder", slot: "daily", plannedAt: triggerDate.toISOString() },
      },
      trigger: triggerDate as any as Notifications.NotificationTriggerInput,
    });
    await AsyncStorage.multiSet([[STORAGE_KEYS.dailyId, dailyId], [STORAGE_KEYS.dailyScheduled, "1"]]);
    __DEV__ && console.log("✅ Scheduled daily (tomorrow):", { dailyId, triggerDate });
    DAILY_SCHEDULED_IN_SESSION = true;
    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  } finally { SCHEDULING_LOCK = false; }
};

export const rescheduleNextDailyIfNeeded = async () => {
  try {
    const ok = await shouldRescheduleDailyToday();
    if (!ok) return;
    await resetDailyNotificationsFlag();
    const did = await scheduleDailyNotifications();
    if (did) await markDailyRescheduledToday();
  } catch {}
};

export const resetDailyNotificationsFlag = async () => {
  DAILY_SCHEDULED_IN_SESSION = false;
  await AsyncStorage.removeItem(STORAGE_KEYS.dailyScheduled);
};

/* -------------------------------------------------------------------------- */
/*                          Late reminder                                     */
/* -------------------------------------------------------------------------- */

async function shouldRescheduleLateToday(): Promise<boolean> {
  const today = dayKeyLocal();
  const last  = await AsyncStorage.getItem(STORAGE_KEYS.lateRescheduledDay);
  return last !== today;
}
async function markLateRescheduledToday(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.lateRescheduledDay, dayKeyLocal());
}

export const cancelLateNotifications = async (): Promise<void> => {
  try {
    const lateId = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
    if (lateId) await Notifications.cancelScheduledNotificationAsync(lateId).catch(() => {});
    await cancelByTag(TAGS.LATE);
    await AsyncStorage.multiRemove([STORAGE_KEYS.lateId, STORAGE_KEYS.lateScheduled, STORAGE_KEYS.lateRescheduledDay]);
    LATE_SCHEDULED_IN_SESSION = false;
  } catch (e) { console.warn("⚠️ cancelLateNotifications:", e); }
};

export const scheduleLateReminderIfNeeded = async (): Promise<boolean> => {
  if (SCHEDULING_LOCK) return false;
  SCHEDULING_LOCK = true;
  try {
    if (LATE_SCHEDULED_IN_SESSION) return true;
    const already = await AsyncStorage.getItem(STORAGE_KEYS.lateScheduled);
    if (already === "1") { LATE_SCHEDULED_IN_SESSION = true; return true; }
    await ensureAndroidChannelAsync();
    const granted = await requestNotificationPermissions();
    if (!granted) return false;
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    const gate     = await shouldScheduleDailyReminderForUser(userId);
    const language = gate.lng || "en";
    if (!gate.ok) return false;
    if (!gate.hasActive || !gate.hasUnmarkedToday) { await cancelLateNotifications(); return true; }
    await cancelByTag(TAGS.LATE);
    const oldLate = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
    if (oldLate) await Notifications.cancelScheduledNotificationAsync(oldLate).catch(() => {});
    const lateMessages = [
      tSafe("notificationsPush.late1", { lng: language }),
      tSafe("notificationsPush.late2", { lng: language }),
      tSafe("notificationsPush.late3", { lng: language }),
    ].filter(s => s.trim().length > 0);
    const triggerDate = buildTodayTriggerInLateWindow();
    const lateId      = await Notifications.scheduleNotificationAsync({
      content: {
        title: tSafe("notificationsPush.title", { lng: language }),
        body:  lateMessages[Math.floor(Math.random() * lateMessages.length)] || "",
        sound: "default",
        data:  { __tag: TAGS.LATE, type: "daily-reminder", kind: "daily_reminder", slot: "late", plannedAt: triggerDate.toISOString() },
      },
      trigger: triggerDate as any as Notifications.NotificationTriggerInput,
    });
    await AsyncStorage.multiSet([[STORAGE_KEYS.lateId, lateId], [STORAGE_KEYS.lateScheduled, "1"]]);
    LATE_SCHEDULED_IN_SESSION = true;
    return true;
  } catch (e) { console.error("❌ scheduleLateReminderIfNeeded:", e); return false; }
  finally { SCHEDULING_LOCK = false; }
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
/*              🆕  STREAK DANGER — notif à 21h si pas marqué                */
/* -------------------------------------------------------------------------- */

/**
 * À appeler :
 * 1) Au démarrage de l'app (AppState active)
 * 2) Après chaque markToday (reschedule ou cancel si marqué)
 *
 * La notif part à 21h si l'user n'a pas encore marqué aujourd'hui.
 * Une seule notif par jour, supprimée dès que l'user marque.
 */
export const scheduleStreakDangerIfNeeded = async (): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const gate     = await shouldScheduleDailyReminderForUser(userId);
    const language = gate.lng || "en";

    if (!gate.ok || !gate.hasActive) {
      await cancelStreakDangerNotification();
      return;
    }

    // Si tout est déjà marqué → on annule et on sort
    if (!gate.hasUnmarkedToday) {
      await cancelStreakDangerNotification();
      return;
    }

    // ✅ Idempotence : 1 seule notif streak danger par jour
    const today    = dayKeyLocal();
    const lastDay  = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerDay);
    if (lastDay === today && STREAK_SCHEDULED_IN_SESSION) return;

    // Heure cible : 21h00 aujourd'hui
    const now     = new Date();
    const trigger = new Date();
    trigger.setHours(21, 0, 0, 0);

    // Si 21h est déjà passé aujourd'hui → pas de notif (on ne spamme pas demain pour ça)
    if (trigger.getTime() <= now.getTime()) return;

    // Annule l'éventuelle précédente
    const oldId = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerId);
    if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
    await cancelByTag(TAGS.STREAK_DANGER);

    // Textes — variété pour ne pas être répétitif
    const streakDangerMessages = [
      tSafe("notificationsPush.streakDanger1", { lng: language }),
      tSafe("notificationsPush.streakDanger2", { lng: language }),
      tSafe("notificationsPush.streakDanger3", { lng: language }),
    ].filter(s => s.trim().length > 0);

    // Fallback si clés i18n pas encore là
    const fallbackBodies = [
      "⚠️ Ta série est en danger ! Marque ton défi avant minuit.",
      "🔥 Ne laisse pas tomber maintenant. Il te reste quelques heures.",
      "⏰ Ton streak t'attend. Dernière chance avant minuit !",
    ];
    const bodies = streakDangerMessages.length > 0 ? streakDangerMessages : fallbackBodies;

    const titleKey = "notificationsPush.streakDangerTitle";
    const fallbackTitle = "🚨 Streak en danger !";
    const title = tSafe(titleKey, { lng: language }) || fallbackTitle;

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body:  bodies[Math.floor(Math.random() * bodies.length)],
        sound: "default",
        data:  {
          __tag:       TAGS.STREAK_DANGER,
          type:        "streak-danger",
          kind:        "streak_danger",
          plannedAt:   trigger.toISOString(),
        },
      },
      trigger: trigger as any as Notifications.NotificationTriggerInput,
    });

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.streakDangerId, notifId],
      [STORAGE_KEYS.streakDangerDay, today],
    ]);

    STREAK_SCHEDULED_IN_SESSION = true;
    __DEV__ && console.log("✅ Streak danger scheduled at 21h:", { notifId });
  } catch (e) {
    console.warn("⚠️ scheduleStreakDangerIfNeeded:", e);
  }
};

/** À appeler dès que l'user marque un défi — annule la notif streak danger */
export const cancelStreakDangerNotification = async (): Promise<void> => {
  try {
    const oldId = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerId);
    if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
    await cancelByTag(TAGS.STREAK_DANGER);
    await AsyncStorage.multiRemove([STORAGE_KEYS.streakDangerId, STORAGE_KEYS.streakDangerDay]);
    STREAK_SCHEDULED_IN_SESSION = false;
  } catch {}
};

/* -------------------------------------------------------------------------- */
/*           🆕  MILESTONE — notif immédiate à certains jalons                */
/* -------------------------------------------------------------------------- */

const MILESTONE_DAYS = [7, 30, 100];  // jours absolus
const MILESTONE_PCTS = [0.5, 1.0];    // 50% et 100% de progression

/** Calcule si on est sur un milestone et retourne sa clé unique (pour déduplication) */
function getMilestoneKey(completedDays: number, selectedDays: number): string | null {
  // 100% = dernier jour
  if (completedDays >= selectedDays && selectedDays > 0) {
    return `last_${selectedDays}`;
  }
  // Jalons en jours absolus
  if (MILESTONE_DAYS.includes(completedDays)) {
    return `day_${completedDays}`;
  }
  // Jalons en pourcentage (50%)
  if (selectedDays > 0) {
    const pct = completedDays / selectedDays;
    for (const target of MILESTONE_PCTS) {
      if (Math.abs(pct - target) < 0.01 && target < 1.0) {
        return `pct_${Math.round(target * 100)}`;
      }
    }
  }
  return null;
}

/**
 * À appeler juste après un markToday réussi.
 * Envoie une notif immédiate si on est sur un milestone, sans doublon.
 *
 * @param challengeId   ID du challenge
 * @param uniqueKey     uniqueKey du challenge (pour la dédup)
 * @param completedDays nombre de jours complétés APRÈS le mark
 * @param selectedDays  durée totale du challenge
 */
export const sendMilestoneNotificationIfNeeded = async (
  challengeId: string,
  uniqueKey: string,
  completedDays: number,
  selectedDays: number,
): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const milestoneKey = getMilestoneKey(completedDays, selectedDays);
    if (!milestoneKey) return; // pas un milestone

    // ✅ Dédup : on stocke "déjà envoyé" par challenge + milestone
    const storageKey = `${STORAGE_KEYS.milestonePrefix}.${uniqueKey}.${milestoneKey}`;
    const already    = await AsyncStorage.getItem(storageKey);
    if (already === "1") return;

    // Langue de l'user
    const snap     = await getDoc(doc(db, "users", userId));
    const language = snap.exists() ? String((snap.data() as any)?.language || "en") : "en";

    const isLastDay = completedDays >= selectedDays;
    const pct       = selectedDays > 0 ? Math.round((completedDays / selectedDays) * 100) : 0;

    // Textes adaptés au milestone
    let title = "";
    let body  = "";

    if (isLastDay) {
      title = tSafe("notificationsPush.milestoneLastDayTitle", { lng: language }) || "🏆 Défi terminé !";
      body  = tSafe("notificationsPush.milestoneLastDayBody",  { lng: language, days: selectedDays }) || `Tu viens de terminer ${selectedDays} jours. Incroyable !`;
    } else if (milestoneKey.startsWith("pct_50")) {
      title = tSafe("notificationsPush.milestone50Title", { lng: language }) || "⚡ Mi-parcours !";
      body  = tSafe("notificationsPush.milestone50Body",  { lng: language, completed: completedDays, total: selectedDays }) || `${completedDays}/${selectedDays} jours complétés. Continue comme ça !`;
    } else if (milestoneKey === "day_7") {
      title = tSafe("notificationsPush.milestone7Title", { lng: language }) || "🔥 7 jours de suite !";
      body  = tSafe("notificationsPush.milestone7Body",  { lng: language }) || "Une semaine complète. Tu es en train de créer une vraie habitude.";
    } else if (milestoneKey === "day_30") {
      title = tSafe("notificationsPush.milestone30Title", { lng: language }) || "💪 30 jours !";
      body  = tSafe("notificationsPush.milestone30Body",  { lng: language }) || "Un mois de constance. C'est exceptionnel.";
    } else if (milestoneKey === "day_100") {
      title = tSafe("notificationsPush.milestone100Title", { lng: language }) || "🌟 100 jours !";
      body  = tSafe("notificationsPush.milestone100Body",  { lng: language }) || "100 jours. Tu fais partie des 1% qui tiennent aussi longtemps.";
    } else {
      return; // milestone inconnu
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: {
          __tag:        TAGS.MILESTONE,
          type:         "milestone",
          kind:         "milestone",
          challengeId,
          uniqueKey,
          milestoneKey,
          completedDays,
          selectedDays,
        },
      },
      trigger: null, // immédiat
    });

    // Marque comme envoyé (dédup permanente)
    await AsyncStorage.setItem(storageKey, "1");
    __DEV__ && console.log("✅ Milestone notification sent:", milestoneKey, { completedDays, selectedDays });

    // 🆕 Global feed — milestone
    try {
      const feedSnap = await getDoc(doc(db, "users", userId));
      if (feedSnap.exists()) {
        const fd = feedSnap.data() as any;
        const username = String(fd.username || fd.displayName || "");
        if (username) {
          await publishToGlobalFeed({
            type: "milestone",
            challengeId,
            challengeTitle: "",
            payload: {
              milestoneName: milestoneKey,
              completedDays,
              selectedDays,
            },
            username,
            avatarUrl: fd.profileImage || fd.avatar || null,
          });
        }
      }
    } catch {}
  } catch (e) {
    console.warn("⚠️ sendMilestoneNotificationIfNeeded:", e);
  }
};

/* -------------------------------------------------------------------------- */
/*           🆕  DUO LEAD — notif quand le partner prend de l'avance          */
/* -------------------------------------------------------------------------- */

/**
 * À appeler après avoir récupéré les données du partner (usePartnerDuoSnapshot).
 * Envoie une notif locale immédiate si le partner a N jours d'avance.
 * Dédup : 1 notif par "écart franchi" par challenge.
 */
export const sendDuoLeadNotificationIfNeeded = async (
  uniqueKey: string,
  myCompletedDays: number,
  partnerCompletedDays: number,
  partnerName: string,
): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const lead = partnerCompletedDays - myCompletedDays;
    if (lead <= 0) return; // on ne notifie que si partner DEVANT

    // Seuils : notif à 1, 3, 7 jours d'avance
    const LEAD_THRESHOLDS = [1, 3, 7];
    const threshold = LEAD_THRESHOLDS.find(t => lead >= t && lead < (LEAD_THRESHOLDS[LEAD_THRESHOLDS.indexOf(t) + 1] ?? Infinity));
    if (threshold === undefined) return;

    // Dédup par uniqueKey + seuil franchi
    const storageKey = `notif.duo.lead.${uniqueKey}.threshold_${threshold}`;
    const already    = await AsyncStorage.getItem(storageKey);
    if (already === "1") return;

    // Reset si on rattrape (pour notifier de nouveau si le partner reprend de l'avance)
    // (géré implicitement : si myCompleted rattrape, threshold > lead donc on n'entre plus)

    const snap     = await getDoc(doc(db, "users", userId));
    const language = snap.exists() ? String((snap.data() as any)?.language || "en") : "en";

    const name    = partnerName || tSafe("duo.partner", { lng: language }) || "ton partenaire";
    const dayWord = tSafe("completion.days", { lng: language }) || "j";

    const title = tSafe("notificationsPush.duoLeadTitle", { lng: language }) || "⚔️ Ton partenaire est devant !";
    const body  = tSafe("notificationsPush.duoLeadBody",  { lng: language, name, lead, dayWord })
      || `${name} a ${lead} ${dayWord} d'avance. Réagis !`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: {
          type:      "duo-lead",
          kind:      "duo_lead",
          uniqueKey,
          lead,
          threshold,
        },
      },
      trigger: null, // immédiat
    });

    await AsyncStorage.setItem(storageKey, "1");
    __DEV__ && console.log("✅ Duo lead notification sent:", { lead, threshold, partnerName });
  } catch (e) {
    console.warn("⚠️ sendDuoLeadNotificationIfNeeded:", e);
  }
};

/** Reset les dédup duo lead quand l'user rattrape le partner (à appeler quand myDays >= partnerDays) */
export const resetDuoLeadDedupIfCaughtUp = async (uniqueKey: string): Promise<void> => {
  try {
    const LEAD_THRESHOLDS = [1, 3, 7];
    const keys = LEAD_THRESHOLDS.map(t => `notif.duo.lead.${uniqueKey}.threshold_${t}`);
    await AsyncStorage.multiRemove(keys);
  } catch {}
};

/* -------------------------------------------------------------------------- */
/*                    Local notification (immediate)                           */
/* -------------------------------------------------------------------------- */

export const sendInvitationNotification = async (
  userId: string,
  messageOrLocalized: string | LocalizedPayload
): Promise<void> => {
  try {
    const userRef  = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || userSnap.data()?.notificationsEnabled === false) return;
    const language = userSnap.data().language || "en";
    const toStr    = (v: any) => (typeof v === "string" ? v : String(v ?? ""));
    let title = toStr(i18n.t("notificationsPush.title", { lng: language }));
    let body  = "";
    if (typeof messageOrLocalized === "string") {
      body = messageOrLocalized;
    } else {
      const { titleKey, bodyKey, params } = messageOrLocalized || {};
      if (titleKey) title = toStr(i18n.t(titleKey, { lng: language, ...(params || {}) }));
      if (bodyKey)  body  = toStr(i18n.t(bodyKey,  { lng: language, ...(params || {}) }));
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default", data: { ...(typeof messageOrLocalized === "string" ? {} : messageOrLocalized) } },
      trigger: null,
    });
  } catch (error) { console.error("❌ Erreur envoi notification:", error); }
};

/* -------------------------------------------------------------------------- */
/*                           Referral local nudge                              */
/* -------------------------------------------------------------------------- */

const REFERRAL_MILESTONE_PREFIX    = "referral.milestone.notified";
const inFlightReferralKeys         = new Set<string>();

export const sendReferralMilestoneLocalNudge = async (
  userId: string,
  payload: { bonus: number; milestones: number[]; activatedCount: number; username?: string }
) => {
  return; // toggled off — activer quand referral sera live
};

/* -------------------------------------------------------------------------- */
/*                          Expo push (duo & invites)                          */
/* -------------------------------------------------------------------------- */

export const sendDuoNudge = async (params: DuoNudgeParams): Promise<any> => {
  try {
    return await callSendDuoNudge(params);
  } catch (e) {
    console.error("❌ sendDuoNudge (callable):", e);
    return { ok: false, reason: "error" };
  }
};

/* -------------------------------------------------------------------------- */
/*                         Settings toggles                                    */
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
    await scheduleDailyNotifications();
    await scheduleLateReminderIfNeeded();
    await scheduleStreakDangerIfNeeded(); // 🆕
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, "users", uid), { notificationsEnabled: true });
    return true;
  } catch (e) { console.error("❌ enableNotificationsFromSettings:", e); return false; }
};

export const disableNotificationsFromSettings = async (): Promise<void> => {
  try {
    await cancelDailyNotifications();
    await cancelLateNotifications();
    await cancelStreakDangerNotification(); // 🆕
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, "users", uid), { notificationsEnabled: false });
  } catch (e) { console.error("❌ disableNotificationsFromSettings:", e); }
};

/* -------------------------------------------------------------------------- */
/*                         Tap actions: routing                                */
/* -------------------------------------------------------------------------- */

let responseSub: Notifications.Subscription | null = null;

export function getPathFromNotificationData(data: any): string {
  const kind        = normalizePushKind(data);
  const challengeId = data?.challengeId != null ? String(data.challengeId) : undefined;

  if (kind === "daily_reminder")  return "/";
  if (kind === "streak_danger")   return "/current-challenges";
  if (kind === "milestone")       return challengeId ? `/challenge-details/${challengeId}` : "/current-challenges";
  if (kind === "duo_lead")        return challengeId ? `/challenge-details/${challengeId}` : "/current-challenges";
  if (kind === "invite_status")   return challengeId ? `/challenge-details/${challengeId}` : "/(tabs)";
  if (kind === "duo_nudge")       return challengeId ? `/challenge-details/${challengeId}` : "/current-challenges";
  if (challengeId)                return `/challenge-details/${challengeId}`;
  return "/(tabs)";
}

const COLD_START_HANDLED_FLAG = "__NOTIF_HANDLED_COLD_START__";
export function markNotifHandledOnColdStart() {
  try { (globalThis as any)[COLD_START_HANDLED_FLAG] = true; } catch {}
}
function consumeNotifHandledOnColdStart(): boolean {
  try {
    const v = (globalThis as any)[COLD_START_HANDLED_FLAG] === true;
    if (v) (globalThis as any)[COLD_START_HANDLED_FLAG] = false;
    return v;
  } catch { return false; }
}

export const startNotificationResponseListener = (
  onNavigate: (path: string) => void,
  onToast?: (text: string) => void
) => {
  if (responseSub) return;
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      if (consumeNotifHandledOnColdStart()) return;
      const data: any = resp.notification.request.content.data || {};
      const kind      = normalizePushKind(data);
      const path      = getPathFromNotificationData(data);
      onNavigate(path);
      if (!onToast) return;
      const tL = (key: string, opts?: Record<string, any>) => {
        const res = i18n.t(key, { ...(opts || {}), returnObjects: false });
        return typeof res === "string" ? res : String(res ?? "");
      };
      if (kind === "duo_nudge")     { onToast(tL("notificationsPush.duoNudgeOpened")); return; }
      if (kind === "streak_danger") { onToast(tL("notificationsPush.streakDangerOpened")); return; }
      if (kind === "milestone")     { onToast(tL("notificationsPush.milestoneOpened")); return; }
      if (kind === "duo_lead")      { onToast(tL("notificationsPush.duoLeadOpened")); return; }
      if (kind === "invite_status") {
        const status = String(data?.status || "");
        const key = status === "accepted" ? "notificationsPush.inviteAcceptedToast" : status === "refused" ? "notificationsPush.inviteRefusedToast" : "notificationsPush.opened";
        onToast(tL(key)); return;
      }
      onToast(tL("notificationsPush.opened"));
    } catch (e) { console.warn("⚠️ startNotificationResponseListener error:", e); }
  });
};

export const stopNotificationResponseListener = () => {
  try { responseSub?.remove(); } catch {}
  responseSub = null;
};

/* -------------------------------------------------------------------------- */
/*              🆕  REACTION — notif push quand quelqu'un réagit              */
/* -------------------------------------------------------------------------- */

export const sendReactionPushNotification = async (
  targetUserId: string,
  reaction: "fire" | "muscle",
  fromUid: string,
): Promise<void> => {
  try {
    const targetSnap = await getDoc(doc(db, "users", targetUserId));
    if (!targetSnap.exists()) return;
    const targetData = targetSnap.data() as any;
    if (targetData.notificationsEnabled === false) return;
    const token = targetData.expoPushToken;
    if (!token || typeof token !== "string") return;

    const language = String(targetData.language || "en");

    // Récupère le username de celui qui réagit
    const fromSnap = await getDoc(doc(db, "users", fromUid));
    const fromName = fromSnap.exists()
      ? String((fromSnap.data() as any).username || (fromSnap.data() as any).displayName || "Quelqu'un")
      : "Quelqu'un";

    const emoji  = reaction === "fire" ? "🔥" : "💪";
    const title  = tSafe("notificationsPush.reactionTitle",  { lng: language, defaultValue: "ChallengeTies" });
    const body   = tSafe("notificationsPush.reactionBody",   {
      lng: language,
      name: fromName,
      emoji,
      defaultValue: `${fromName} a réagi à ton exploit ${emoji}`,
    });

    // Envoi via Expo Push API (fetch direct — pas de SDK serveur requis)
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to:    token,
        title,
        body,
        sound: "default",
        data:  { kind: "reaction", reaction, fromUid, type: "reaction" },
      }),
    });
  } catch (e) {
    __DEV__ && console.warn("[notif] sendReactionPushNotification error:", e);
  }
};