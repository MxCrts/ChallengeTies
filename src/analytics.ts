// src/analytics.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "@/constants/firebase-config";
import { faLogEvent } from "@/src/firebaseAnalytics";

/** Active/désactive le log si besoin (garde sur true en prod) */
const ENABLE_ANALYTICS = true;

/** Hard limit anti spam (ms) : même event+signature pas plus souvent que ça */
const DEDUPE_WINDOW_MS = 1200;

let SESSION_ID: string | null = null;

async function getSessionId(): Promise<string> {
  if (SESSION_ID) return SESSION_ID;
  SESSION_ID =
    "sess_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
  return SESSION_ID;
}

/** ID anonyme pour suivre une même personne même si elle n'est pas connectée */
async function getAnonId(): Promise<string> {
  const KEY = "ties_anon_id";
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    await AsyncStorage.setItem(KEY, id);
  }
  return id;
}

function getAppVersion() {
  // @ts-ignore
  const v1 = (Constants?.nativeAppVersion as string | undefined) ?? null;
  // @ts-ignore
  const v2 =
    (Constants?.manifest2?.extra?.expoClient?.version as string | undefined) ??
    null;
  return v1 ?? v2 ?? null;
}

function getBuildNumber() {
  // iOS buildNumber / Android versionCode
  // @ts-ignore
  const ios = Constants?.expoConfig?.ios?.buildNumber as string | undefined;
  // @ts-ignore
  const android = Constants?.expoConfig?.android?.versionCode as number | undefined;
  return ios ?? (android != null ? String(android) : null);
}

/** Dedupe key simple pour éviter spam */
async function shouldDropEvent(signature: string) {
  try {
    const KEY = "ties_evt_dedupe_v1";
    const raw = await AsyncStorage.getItem(KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    const last = map[signature] || 0;
    if (now - last < DEDUPE_WINDOW_MS) return true;
    map[signature] = now;

    // cleanup light
    const keys = Object.keys(map);
    if (keys.length > 120) {
      for (const k of keys.slice(0, 40)) delete map[k];
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    return false;
  } catch {
    return false;
  }
}

/** Log basique d’un événement important (nom + petits détails facultatifs) */
export async function logEvent(
  name:
    | "app_open"
    | "daily_active"
    | "register_success"
    | "login_success"
    | "onboarding_start"
    | "onboarding_complete"
    | "first_challenge_started"
    | "day_marked"
    | "challenge_completed"
    | "invite_sent"
    | "invite_opened"
    | "invite_accepted"
    | "invite_refused"
    | "paywall_view"
    | "purchase_success"
    | "ad_impression"
    | "signup_complete"
    | "rewarded_completed"
    | "ref_attributed"
    | "ref_activation_marked"
    | "pioneer_unlocked"
    | "ambassador_reward"
    | "ambassador_milestone"
    | "ref_reward_granted"
    | "ref_milestone_reached"
    | "share_card_saved"
    | "share_card_shared"
    | "share_open"
    | "share_link_copied"
    | "share_native_opened"
    | (string & {}),
  params: Record<string, any> = {}
) {
  try {
    if (!ENABLE_ANALYTICS) return;

    const uid = auth.currentUser?.uid ?? null;
    const anonId = await getAnonId();
    const sessionId = await getSessionId();
    const appVersion = getAppVersion();
    const buildNumber = getBuildNumber();

    const signature = `${name}:${uid ?? anonId}:${params?.id ?? ""}:${params?.challengeId ?? ""}`;
    if (await shouldDropEvent(signature)) return;

    await addDoc(collection(db, "appEvents"), {
      name,
      params,
      uid,
      anonId,
      sessionId,
      platform: Platform.OS,
      appVersion,
      buildNumber,
      createdAt: serverTimestamp(),
    });
    await faLogEvent(name, {
  ...params,
  platform: Platform.OS,
  appVersion,
  buildNumber,
});
  } catch (e) {
    console.log("[analytics] logEvent error:", e);
  }
}

/** Utilitaire: n’enregistrer cet événement qu’UNE seule fois par appareil */
export async function logEventOnce(
  key: string,
  name: Parameters<typeof logEvent>[0],
  params: Record<string, any> = {}
) {
  const storageKey = `ties_once_${key}`;
  const done = await AsyncStorage.getItem(storageKey);
  if (done === "1") return;
  await logEvent(name, params);
  await AsyncStorage.setItem(storageKey, "1");
}

/** Utilitaire: n’enregistrer qu’UNE fois par jour (DAU / daily bonus / etc.) */
export async function logEventDaily(
  key: string,
  name: Parameters<typeof logEvent>[0],
  params: Record<string, any> = {}
) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const storageKey = `ties_daily_${key}_${stamp}`;
  const done = await AsyncStorage.getItem(storageKey);
  if (done === "1") return;
  await logEvent(name, params);
  await AsyncStorage.setItem(storageKey, "1");
}