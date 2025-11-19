// src/services/PermissionOrchestrator.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Keys de persistance */
const KS = {
  SEEN_VALUE: "perm_seen_value_v1",
  ASKED_NOTIF: "perm_asked_notif_v1",
  ASKED_LOCATION: "perm_asked_location_v1",
} as const;

async function getFlag(k: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(k)) === "1";
  } catch {
    return false;
  }
}
async function setFlag(k: string) {
  try {
    await AsyncStorage.setItem(k, "1");
  } catch {}
}

/** À appeler une fois l’utilisateur a vécu de la valeur (fin tuto, 1er défi lancé, etc.) */
export async function markValueSeen() {
  await setFlag(KS.SEEN_VALUE);
}

/** Notifications — one-shot, après valeur perçue. */
export async function maybeRequestPushAfterValue(): Promise<boolean> {
  // déjà demandé ?
  if (await getFlag(KS.ASKED_NOTIF)) {
    const s = await Notifications.getPermissionsAsync();
    return s.status === "granted";
  }

  // valeur pas encore marquée → on attend
  if (!(await getFlag(KS.SEEN_VALUE))) return false;

  // web: pas de prompt natif
  if (Platform.OS === "web") {
    await setFlag(KS.ASKED_NOTIF);
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    await setFlag(KS.ASKED_NOTIF);
    return true;
  }
  if (existing.status === "denied") {
    await setFlag(KS.ASKED_NOTIF);
    return false;
  }

  // iOS/Android — pas de allowAnnouncements (non supporté selon ta version)
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  } as Notifications.NotificationPermissionsRequest); // typing safe selon SDK

  await setFlag(KS.ASKED_NOTIF);
  return req.status === "granted";
}

/** Localisation — one-shot, “foreground” (approx/precise selon OS). */
export async function maybeRequestLocationAfterValue(): Promise<boolean> {
  if (await getFlag(KS.ASKED_LOCATION)) {
    const s = await Location.getForegroundPermissionsAsync();
    return s.status === "granted";
  }

  if (!(await getFlag(KS.SEEN_VALUE))) return false;

  if (Platform.OS === "web") {
    await setFlag(KS.ASKED_LOCATION);
    return false;
  }

  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") {
    await setFlag(KS.ASKED_LOCATION);
    return true;
  }
  if (current.status === "denied") {
    await setFlag(KS.ASKED_LOCATION);
    return false;
  }

  try {
    const req = await Location.requestForegroundPermissionsAsync();
    const ok = req.status === "granted";
    await setFlag(KS.ASKED_LOCATION);
    return ok;
  } catch {
    await setFlag(KS.ASKED_LOCATION);
    return false;
  }
}

/** Helpers (lecture simple, sans déclencher) */
export async function hasPushPermission() {
  const s = await Notifications.getPermissionsAsync();
  return s.status === "granted";
}
export async function hasLocationPermission() {
  const s = await Location.getForegroundPermissionsAsync();
  return s.status === "granted";
}
