// src/services/notificationService.ts
// VERSION ANTI-SPAM v2
//
// FIXES vs version précédente :
// 1. Mutex asyncrone (promesses) remplace les booleans en mémoire → élimine les race conditions
// 2. cancelAllStaleNotifications() au démarrage → purge les notifs orphelines sans __tag
// 3. Vérification "notif déjà dans la queue système" AVANT de scheduler (getAllScheduled)
// 4. rescheduleLateIfNeeded : setItem AVANT de reset le flag, pas après
// 5. scheduleStreakDangerIfNeeded : guard double-entrée avec un mutex, pas juste AsyncStorage

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
/*                          Payload normalization                              */
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
  if (rawKind === "duo_nudge")                   return "duo_nudge";
  if (rawKind === "invite_status")               return "invite_status";
  if (rawKind === "daily_reminder")              return "daily_reminder";
  if (rawKind === "streak_danger")               return "streak_danger";
  if (rawKind === "milestone")                   return "milestone";
  if (rawKind === "duo_lead")                    return "duo_lead";
  if (rawKind === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawKind === "referral_new_child")          return "referral_new_child";
  const rawType = String(data?.type || data?.__tag || "").toLowerCase().trim();
  if (rawType === "daily-reminder")              return "daily_reminder";
  if (rawType === "invite-status")               return "invite_status";
  if (rawType === "duo-nudge")                   return "duo_nudge";
  if (rawType === "streak-danger")               return "streak_danger";
  if (rawType === "milestone")                   return "milestone";
  if (rawType === "duo-lead")                    return "duo_lead";
  if (rawType === "referral_milestone_unlocked") return "referral_milestone_unlocked";
  if (rawType === "referral_new_child")          return "referral_new_child";
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/*                                   Storage                                  */
/* -------------------------------------------------------------------------- */

const STORAGE_KEYS = {
  dailyId:             "notif.daily.id",
  dailyScheduled:      "notif.daily.scheduled.v1",
  dailyRescheduledDay: "notif.daily.rescheduled.day.v1",
  lateId:              "notif.late.id",
  lateScheduled:       "notif.late.scheduled.v1",
  lateRescheduledDay:  "notif.late.rescheduled.day.v1",
  streakDangerId:      "notif.streak.danger.id",
  streakDangerDay:     "notif.streak.danger.day.v1",
  milestonePrefix:     "notif.milestone",
} as const;

const TAGS = {
  DAILY:         "daily_window_v1",
  LATE:          "late_window_v1",
  STREAK_DANGER: "streak_danger_v1",
  MILESTONE:     "milestone_v1",
} as const;

/* -------------------------------------------------------------------------- */
/*                    Mutex asyncrone — élimine les race conditions            */
/* -------------------------------------------------------------------------- */

// Chaque mutex est une Promise chaînée. Si deux appels concurrent arrivent,
// le second attend la fin du premier avant de s'exécuter.
const _mutexes: Record<string, Promise<void>> = {};

function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = _mutexes[key] ?? Promise.resolve();
  const next = prev.then(() => fn()).catch(() => undefined as any);
  _mutexes[key] = next.then(() => undefined).catch(() => undefined);
  return next;
}

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
/*                          Window config                                     */
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
/*                       User gate                                            */
/* -------------------------------------------------------------------------- */

async function shouldScheduleDailyReminderForUser(userId: string): Promise<{
  ok: boolean;
  lng: string;
  hasActive: boolean;
  hasUnmarkedToday: boolean;
  unmarkedChallenges: any[];
}> {
  const snap = await getDoc(doc(db, "users", userId));
  const u    = snap.exists() ? (snap.data() as any) : null;
  if (!u) return { ok: false, lng: "en", hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };
  if (u.notificationsEnabled === false)
    return { ok: false, lng: String(u.language || "en"), hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };

  const lng    = String(u.language || "en");
  const list: any[] = Array.isArray(u.CurrentChallenges) ? u.CurrentChallenges : [];
  const hasActive = list.length > 0;
  if (!hasActive) return { ok: true, lng, hasActive: false, hasUnmarkedToday: false, unmarkedChallenges: [] };

  const todayKey           = dayKeyLocal();
  const unmarkedChallenges = list.filter(ch => !hasMarkedTodayLocal(ch, todayKey));
  const hasUnmarkedToday   = unmarkedChallenges.length > 0;
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
  const log = (...a: any[]) => __DEV__ && console.log(TAG, ...a);
  try {
    if (Platform.OS === "web") return null;
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) return null;
    const perm = await Notifications.getPermissionsAsync();
    let finalStatus = perm.status;
    if (finalStatus !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== "granted") return null;
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId ?? null;
    let expoToken: string | null = null;
    try {
      const tokenResp = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      expoToken = tokenResp?.data ?? null;
    } catch (err) { log("getExpoPushTokenAsync ERROR:", err); }
    if (!expoToken) return null;
    let fcmToken: string | null = null;
    try {
      const deviceResp = await Notifications.getDevicePushTokenAsync();
      fcmToken = typeof deviceResp?.data === "string" ? deviceResp.data : null;
    } catch {}
    await setDoc(doc(db, "users", uid), {
      expoPushToken: expoToken, notificationsEnabled: true, expoPushUpdatedAt: new Date(),
      debugPush: { permission: finalStatus, projectId, fcmToken: fcmToken || null, platform: Platform.OS },
    }, { merge: true });
    return expoToken;
  } catch (e) {
    console.error("💥 [PUSH] CRASH:", e);
    return null;
  }
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
  await Promise.all(targets.map(n =>
    Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
  ));
}

/**
 * Vérifie si une notif avec ce tag est déjà dans la queue système.
 * Évite de scheduler si une existe déjà (sécurité supplémentaire).
 */
async function hasScheduledNotifWithTag(tag: string): Promise<boolean> {
  const list = await getAllScheduled();
  return list.some(n => (n as any)?.content?.data?.__tag === tag);
}

/**
 * Purge TOUTES les notifs schedulées sans __tag (orphelines d'anciennes versions).
 * À appeler au cold start UNE seule fois.
 */
export const cancelAllOrphanNotifications = async (): Promise<void> => {
  try {
    const list     = await getAllScheduled();
    const orphans  = list.filter(n => !(n as any)?.content?.data?.__tag);
    await Promise.all(orphans.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
    ));
    if (__DEV__ && orphans.length > 0) {
      console.log(`🧹 Purged ${orphans.length} orphan notification(s)`);
    }
  } catch {}
};

/* -------------------------------------------------------------------------- */
/*                          Daily notification                                */
/* -------------------------------------------------------------------------- */

export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const dailyId = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
    if (dailyId) await Notifications.cancelScheduledNotificationAsync(dailyId).catch(() => {});
    await cancelByTag(TAGS.DAILY);
    await AsyncStorage.multiRemove([STORAGE_KEYS.dailyId, STORAGE_KEYS.dailyScheduled, STORAGE_KEYS.dailyRescheduledDay]);
  } catch (e) { console.warn("⚠️ cancelDailyNotifications:", e); }
};

const _scheduleDailyCore = async (): Promise<boolean> => {
  // Guard 1 : déjà schedulé aujourd'hui
  const today    = dayKeyLocal();
  const lastDay  = await AsyncStorage.getItem(STORAGE_KEYS.dailyRescheduledDay);
  if (lastDay === today) return true;

  // Guard 2 : déjà dans la queue système
  if (await hasScheduledNotifWithTag(TAGS.DAILY)) {
    await AsyncStorage.setItem(STORAGE_KEYS.dailyRescheduledDay, today);
    return true;
  }

  await ensureAndroidChannelAsync();
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  const userId = auth.currentUser?.uid;
  if (!userId) return false;

  const gate     = await shouldScheduleDailyReminderForUser(userId);
  const language = gate.lng || "en";
  if (!gate.ok) return false;
  if (!gate.hasActive) { await cancelDailyNotifications(); return true; }

  // Annule les éventuelles précédentes (sécurité)
  await cancelByTag(TAGS.DAILY);
  const oldId = await AsyncStorage.getItem(STORAGE_KEYS.dailyId);
  if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});

  // APRÈS
const buildPersonalizedMessages = (
  unmarked: any[],
  lng: string
): string[] => {
  const firstTitle = typeof unmarked[0]?.title === "string"
    ? unmarked[0].title.trim()
    : "";
  const count = unmarked.length;

  if (firstTitle && count === 1) {
    return [
      tSafe("notificationsPush.dailyPersonal1", { lng, title: firstTitle,
        defaultValue: `✅ "${firstTitle}" t'attend aujourd'hui.` }),
      tSafe("notificationsPush.dailyPersonal2", { lng, title: firstTitle,
        defaultValue: `🔥 Un jour de plus sur "${firstTitle}". Go.` }),
      tSafe("notificationsPush.dailyPersonal3", { lng, title: firstTitle,
        defaultValue: `⚡ "${firstTitle}" — 1 clic pour valider.` }),
    ];
  }

  if (firstTitle && count > 1) {
    return [
      tSafe("notificationsPush.dailyPersonalMulti1", { lng, title: firstTitle, count,
        defaultValue: `✅ "${firstTitle}" et ${count - 1} autre(s) à valider.` }),
      tSafe("notificationsPush.dailyPersonalMulti2", { lng, count,
        defaultValue: `🔥 ${count} défis t'attendent aujourd'hui.` }),
    ];
  }

  // Fallback générique
  return [
    tSafe("notificationsPush.daily1", { lng }),
    tSafe("notificationsPush.daily2", { lng }),
    tSafe("notificationsPush.daily3", { lng }),
  ].filter(s => s.trim().length > 0);
};

const messages = buildPersonalizedMessages(gate.unmarkedChallenges, language);

  const triggerDate = buildTomorrowTriggerInWindow();
  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: tSafe("notificationsPush.title", { lng: language }),
      body:  messages[Math.floor(Math.random() * messages.length)] || "",
      sound: "default",
      data:  { __tag: TAGS.DAILY, type: "daily-reminder", kind: "daily_reminder", slot: "daily", plannedAt: triggerDate.toISOString() },
    },
    trigger: triggerDate as any as Notifications.NotificationTriggerInput,
  });

  // ✅ Persiste l'ID ET le jour en une seule opération atomique
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.dailyId, notifId],
    [STORAGE_KEYS.dailyScheduled, "1"],
    [STORAGE_KEYS.dailyRescheduledDay, today],
  ]);

  __DEV__ && console.log("✅ Daily scheduled:", { notifId, triggerDate });
  return true;
};

export const scheduleDailyNotifications = async (): Promise<boolean> => {
  return withMutex("daily", _scheduleDailyCore);
};

export const rescheduleNextDailyIfNeeded = async (): Promise<void> => {
  // withMutex garantit qu'un seul appel concurrent s'exécute
  await withMutex("daily", _scheduleDailyCore);
};

export const resetDailyNotificationsFlag = async () => {
  await AsyncStorage.multiRemove([STORAGE_KEYS.dailyScheduled, STORAGE_KEYS.dailyRescheduledDay]);
};

/* -------------------------------------------------------------------------- */
/*                          Late reminder                                     */
/* -------------------------------------------------------------------------- */

export const cancelLateNotifications = async (): Promise<void> => {
  try {
    const lateId = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
    if (lateId) await Notifications.cancelScheduledNotificationAsync(lateId).catch(() => {});
    await cancelByTag(TAGS.LATE);
    await AsyncStorage.multiRemove([STORAGE_KEYS.lateId, STORAGE_KEYS.lateScheduled, STORAGE_KEYS.lateRescheduledDay]);
  } catch (e) { console.warn("⚠️ cancelLateNotifications:", e); }
};

const _scheduleLateCore = async (): Promise<boolean> => {
  // Guard 1 : déjà schedulé aujourd'hui
  const today   = dayKeyLocal();
  const lastDay = await AsyncStorage.getItem(STORAGE_KEYS.lateRescheduledDay);
  if (lastDay === today) return true;

  // Guard 2 : déjà dans la queue système
  if (await hasScheduledNotifWithTag(TAGS.LATE)) {
    await AsyncStorage.setItem(STORAGE_KEYS.lateRescheduledDay, today);
    return true;
  }

  await ensureAndroidChannelAsync();
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  const userId = auth.currentUser?.uid;
  if (!userId) return false;

  const gate     = await shouldScheduleDailyReminderForUser(userId);
  const language = gate.lng || "en";
  if (!gate.ok) return false;
  if (!gate.hasActive || !gate.hasUnmarkedToday) {
    await cancelLateNotifications();
    return true;
  }

  await cancelByTag(TAGS.LATE);
  const oldId = await AsyncStorage.getItem(STORAGE_KEYS.lateId);
  if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});

  const buildPersonalizedLateMessages = (
  unmarked: any[],
  lng: string
): string[] => {
  const firstTitle = typeof unmarked[0]?.title === "string"
    ? unmarked[0].title.trim()
    : "";
  const count = unmarked.length;

  if (firstTitle && count === 1) {
    return [
      tSafe("notificationsPush.latePersonal1", { lng, title: firstTitle,
        defaultValue: `⏰ "${firstTitle}" — encore quelques heures.` }),
      tSafe("notificationsPush.latePersonal2", { lng, title: firstTitle,
        defaultValue: `🚨 Ne laisse pas tomber "${firstTitle}" ce soir.` }),
      tSafe("notificationsPush.latePersonal3", { lng, title: firstTitle,
        defaultValue: `🔥 "${firstTitle}" attend ton check-in. Dernier moment.` }),
    ];
  }

  if (firstTitle && count > 1) {
    return [
      tSafe("notificationsPush.latePersonalMulti1", { lng, title: firstTitle, count,
        defaultValue: `⏰ "${firstTitle}" et ${count - 1} autre(s) non validés.` }),
      tSafe("notificationsPush.latePersonalMulti2", { lng, count,
        defaultValue: `🚨 ${count} défis non validés. Il te reste ce soir.` }),
    ];
  }

  return [
    tSafe("notificationsPush.late1", { lng }),
    tSafe("notificationsPush.late2", { lng }),
    tSafe("notificationsPush.late3", { lng }),
  ].filter(s => s.trim().length > 0);
};

const messages = buildPersonalizedLateMessages(gate.unmarkedChallenges, language);

  const triggerDate = buildTodayTriggerInLateWindow();
  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: tSafe("notificationsPush.title", { lng: language }),
      body:  messages[Math.floor(Math.random() * messages.length)] || "",
      sound: "default",
      data:  { __tag: TAGS.LATE, type: "daily-reminder", kind: "daily_reminder", slot: "late", plannedAt: triggerDate.toISOString() },
    },
    trigger: triggerDate as any as Notifications.NotificationTriggerInput,
  });

  // ✅ Persiste tout en une seule opération APRÈS le schedule (pas avant)
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.lateId, notifId],
    [STORAGE_KEYS.lateScheduled, "1"],
    [STORAGE_KEYS.lateRescheduledDay, today],
  ]);

  __DEV__ && console.log("✅ Late scheduled:", { notifId, triggerDate });
  return true;
};

export const scheduleLateReminderIfNeeded = async (): Promise<boolean> => {
  return withMutex("late", _scheduleLateCore);
};

export const rescheduleLateIfNeeded = async (): Promise<void> => {
  await withMutex("late", _scheduleLateCore);
};

/* -------------------------------------------------------------------------- */
/*              STREAK DANGER — notif à 21h si pas marqué                    */
/* -------------------------------------------------------------------------- */

export const scheduleStreakDangerIfNeeded = async (): Promise<void> => {
  await withMutex("streakDanger", async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const gate     = await shouldScheduleDailyReminderForUser(userId);
      const language = gate.lng || "en";

      if (!gate.ok || !gate.hasActive || !gate.hasUnmarkedToday) {
        await cancelStreakDangerNotification();
        return;
      }

      // Guard 1 : déjà schedulé aujourd'hui (AsyncStorage)
      const today   = dayKeyLocal();
      const lastDay = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerDay);
      if (lastDay === today) return;

      // Guard 2 : déjà dans la queue système (protection anti-doublon ultime)
      if (await hasScheduledNotifWithTag(TAGS.STREAK_DANGER)) {
        await AsyncStorage.setItem(STORAGE_KEYS.streakDangerDay, today);
        return;
      }

      // Heure cible : 21h00 aujourd'hui
      const now     = new Date();
      const trigger = new Date();
      trigger.setHours(21, 0, 0, 0);

      // 21h déjà passé → pas de notif
      if (trigger.getTime() <= now.getTime()) return;

      // Annule l'éventuelle précédente
      const oldId = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerId);
      if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
      await cancelByTag(TAGS.STREAK_DANGER);

      const firstTitle = typeof gate.unmarkedChallenges[0]?.title === "string"
  ? gate.unmarkedChallenges[0].title.trim()
  : "";

const messages = firstTitle
  ? [
      tSafe("notificationsPush.streakDangerPersonal1", { lng: language, title: firstTitle,
        defaultValue: `🚨 "${firstTitle}" — ta série en danger. Valide avant minuit.` }),
      tSafe("notificationsPush.streakDangerPersonal2", { lng: language, title: firstTitle,
        defaultValue: `⚠️ Série "${firstTitle}" en jeu. Il te reste quelques heures.` }),
    ]
  : [
      tSafe("notificationsPush.streakDanger1", { lng: language }),
      tSafe("notificationsPush.streakDanger2", { lng: language }),
      tSafe("notificationsPush.streakDanger3", { lng: language }),
    ].filter(s => s.trim().length > 0);

      const fallbackBodies = [
        "⚠️ Ta série est en danger ! Marque ton défi avant minuit.",
        "🔥 Ne laisse pas tomber maintenant. Il te reste quelques heures.",
        "⏰ Ton streak t'attend. Dernière chance avant minuit !",
      ];
      const bodies = messages.length > 0 ? messages : fallbackBodies;

      const title = tSafe("notificationsPush.streakDangerTitle", { lng: language }) || "🚨 Streak en danger !";

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body:  bodies[Math.floor(Math.random() * bodies.length)],
          sound: "default",
          data:  { __tag: TAGS.STREAK_DANGER, type: "streak-danger", kind: "streak_danger", plannedAt: trigger.toISOString() },
        },
        trigger: trigger as any as Notifications.NotificationTriggerInput,
      });

      // ✅ Persiste tout d'un coup APRÈS le schedule
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.streakDangerId, notifId],
        [STORAGE_KEYS.streakDangerDay, today],
      ]);

      __DEV__ && console.log("✅ Streak danger scheduled at 21h:", { notifId });
    } catch (e) {
      console.warn("⚠️ scheduleStreakDangerIfNeeded:", e);
    }
  });
};

export const cancelStreakDangerNotification = async (): Promise<void> => {
  try {
    const oldId = await AsyncStorage.getItem(STORAGE_KEYS.streakDangerId);
    if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
    await cancelByTag(TAGS.STREAK_DANGER);
    await AsyncStorage.multiRemove([STORAGE_KEYS.streakDangerId, STORAGE_KEYS.streakDangerDay]);
  } catch {}
};

/* -------------------------------------------------------------------------- */
/*              MILESTONE — notif immédiate à certains jalons                 */
/* -------------------------------------------------------------------------- */

const MILESTONE_DAYS = [7, 30, 100];
const MILESTONE_PCTS = [0.5, 1.0];

function getMilestoneKey(completedDays: number, selectedDays: number): string | null {
  if (completedDays >= selectedDays && selectedDays > 0) return `last_${selectedDays}`;
  if (MILESTONE_DAYS.includes(completedDays)) return `day_${completedDays}`;
  if (selectedDays > 0) {
    const pct = completedDays / selectedDays;
    for (const target of MILESTONE_PCTS) {
      if (Math.abs(pct - target) < 0.01 && target < 1.0) return `pct_${Math.round(target * 100)}`;
    }
  }
  return null;
}

export const sendMilestoneNotificationIfNeeded = async (
  challengeId: string,
  uniqueKey: string,
  completedDays: number,
  selectedDays: number,
): Promise<void> => {
  await withMutex(`milestone_${uniqueKey}`, async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const milestoneKey = getMilestoneKey(completedDays, selectedDays);
      if (!milestoneKey) return;

      const storageKey = `${STORAGE_KEYS.milestonePrefix}.${uniqueKey}.${milestoneKey}`;
      const already    = await AsyncStorage.getItem(storageKey);
      if (already === "1") return;

      const snap     = await getDoc(doc(db, "users", userId));
      const language = snap.exists() ? String((snap.data() as any)?.language || "en") : "en";

      const isLastDay = completedDays >= selectedDays;

      let title = "";
      let body  = "";

      if (isLastDay) {
        title = tSafe("notificationsPush.milestoneLastDayTitle", { lng: language }) || "🏆 Défi terminé !";
        body  = tSafe("notificationsPush.milestoneLastDayBody",  { lng: language, days: selectedDays }) || `Tu viens de terminer ${selectedDays} jours. Incroyable !`;
      } else if (milestoneKey.startsWith("pct_50")) {
        title = tSafe("notificationsPush.milestone50Title", { lng: language }) || "⚡ Mi-parcours !";
        body  = tSafe("notificationsPush.milestone50Body",  { lng: language, completed: completedDays, total: selectedDays }) || `${completedDays}/${selectedDays} jours complétés.`;
      } else if (milestoneKey === "day_7") {
        title = tSafe("notificationsPush.milestone7Title",  { lng: language }) || "🔥 7 jours de suite !";
        body  = tSafe("notificationsPush.milestone7Body",   { lng: language }) || "Une semaine complète. Tu crées une vraie habitude.";
      } else if (milestoneKey === "day_30") {
        title = tSafe("notificationsPush.milestone30Title", { lng: language }) || "💪 30 jours !";
        body  = tSafe("notificationsPush.milestone30Body",  { lng: language }) || "Un mois de constance. Exceptionnel.";
      } else if (milestoneKey === "day_100") {
        title = tSafe("notificationsPush.milestone100Title", { lng: language }) || "🌟 100 jours !";
        body  = tSafe("notificationsPush.milestone100Body",  { lng: language }) || "100 jours. Top 1% mondial.";
      } else {
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title, body, sound: "default",
          data: { __tag: TAGS.MILESTONE, type: "milestone", kind: "milestone", challengeId, uniqueKey, milestoneKey, completedDays, selectedDays },
        },
        trigger: null,
      });

      await AsyncStorage.setItem(storageKey, "1");
      __DEV__ && console.log("✅ Milestone sent:", milestoneKey, { completedDays, selectedDays });

      // Global feed
      try {
        const fd = snap.exists() ? (snap.data() as any) : null;
        const username = fd ? String(fd.username || fd.displayName || "") : "";
        if (username) {
          await publishToGlobalFeed({
            type: "milestone", challengeId, challengeTitle: "",
            payload: { milestoneName: milestoneKey, completedDays, selectedDays },
            username,
            avatarUrl: fd?.profileImage || fd?.avatar || null,
          });
        }
      } catch {}
    } catch (e) {
      console.warn("⚠️ sendMilestoneNotificationIfNeeded:", e);
    }
  });
};

/* -------------------------------------------------------------------------- */
/*              DUO LEAD — notif quand le partner prend de l'avance           */
/* -------------------------------------------------------------------------- */

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
    if (lead <= 0) return;

    const LEAD_THRESHOLDS = [1, 3, 7];
    const threshold = LEAD_THRESHOLDS.find(t => lead >= t && lead < (LEAD_THRESHOLDS[LEAD_THRESHOLDS.indexOf(t) + 1] ?? Infinity));
    if (threshold === undefined) return;

    const storageKey = `notif.duo.lead.${uniqueKey}.threshold_${threshold}`;
    const already    = await AsyncStorage.getItem(storageKey);
    if (already === "1") return;

    const snap     = await getDoc(doc(db, "users", userId));
    const language = snap.exists() ? String((snap.data() as any)?.language || "en") : "en";

    const name    = partnerName || tSafe("duo.partner", { lng: language }) || "ton partenaire";
    const dayWord = tSafe("completion.days", { lng: language }) || "j";
    const title   = tSafe("notificationsPush.duoLeadTitle", { lng: language }) || "⚔️ Ton partenaire est devant !";
    const body    = tSafe("notificationsPush.duoLeadBody",  { lng: language, name, lead, dayWord })
      || `${name} a ${lead} ${dayWord} d'avance. Réagis !`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title, body, sound: "default",
        data: { type: "duo-lead", kind: "duo_lead", uniqueKey, lead, threshold },
      },
      trigger: null,
    });

    await AsyncStorage.setItem(storageKey, "1");
    __DEV__ && console.log("✅ Duo lead notification sent:", { lead, threshold, partnerName });
  } catch (e) {
    console.warn("⚠️ sendDuoLeadNotificationIfNeeded:", e);
  }
};

export const resetDuoLeadDedupIfCaughtUp = async (uniqueKey: string): Promise<void> => {
  try {
    const keys = [1, 3, 7].map(t => `notif.duo.lead.${uniqueKey}.threshold_${t}`);
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

export const sendReferralMilestoneLocalNudge = async (
  _userId: string,
  _payload: { bonus: number; milestones: number[]; activatedCount: number; username?: string }
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
    await scheduleStreakDangerIfNeeded();
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, "users", uid), { notificationsEnabled: true });
    return true;
  } catch (e) { console.error("❌ enableNotificationsFromSettings:", e); return false; }
};

export const disableNotificationsFromSettings = async (): Promise<void> => {
  try {
    await cancelDailyNotifications();
    await cancelLateNotifications();
    await cancelStreakDangerNotification();
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
        const key = status === "accepted" ? "notificationsPush.inviteAcceptedToast"
          : status === "refused" ? "notificationsPush.inviteRefusedToast"
          : "notificationsPush.opened";
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
/*              REACTION — notif push quand quelqu'un réagit                  */
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
    const fromSnap = await getDoc(doc(db, "users", fromUid));
    const fromName = fromSnap.exists()
      ? String((fromSnap.data() as any).username || (fromSnap.data() as any).displayName || "Quelqu'un")
      : "Quelqu'un";

    const emoji = reaction === "fire" ? "🔥" : "💪";
    const title = tSafe("notificationsPush.reactionTitle", { lng: language, defaultValue: "ChallengeTies" });
    const body  = tSafe("notificationsPush.reactionBody",  {
      lng: language, name: fromName, emoji,
      defaultValue: `${fromName} a réagi à ton exploit ${emoji}`,
    });

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "default", data: { kind: "reaction", reaction, fromUid, type: "reaction" } }),
    });
  } catch (e) {
    __DEV__ && console.warn("[notif] sendReactionPushNotification error:", e);
  }
};
