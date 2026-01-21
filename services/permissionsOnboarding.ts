// src/services/permissionsOnboarding.ts
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { rescheduleNextDailyIfNeeded } from "@/services/notificationService";

const ASKED_KEY_PREFIX = "onboarding.permissions.askedOnce:";

// Lis les statuts SANS popup
export async function getSystemStatuses() {
  const notif = await Notifications.getPermissionsAsync();
  const loc = await Location.getForegroundPermissionsAsync().catch(() => ({ status: "undetermined" as const }));
  return { notif: notif.status, loc: loc.status };
}

// Demande les permissions une seule fois après inscription
export async function askPermissionsOnceAfterSignup() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const ASKED_KEY = `${ASKED_KEY_PREFIX}${uid}`;
  const already = await AsyncStorage.getItem(ASKED_KEY);
  if (already) return; // déjà fait pour CE user

  // 1) NOTIFS
  let notifStatus = (await Notifications.getPermissionsAsync()).status;
  if (notifStatus === "undetermined") {
    notifStatus = (await Notifications.requestPermissionsAsync()).status; // 1 seul popup
  }
  const notifGranted = notifStatus === "granted";

  // 2) LOCALISATION (si utile)
  let locStatus = (await Location.getForegroundPermissionsAsync().catch(() => ({ status: "undetermined" as const }))).status;
  if (locStatus === "undetermined") {
    locStatus = (await Location.requestForegroundPermissionsAsync()).status; // 1 seul popup
  }
  const locGranted = locStatus === "granted";

  // 3) Préférences utilisateur mirroir
  await setDoc(
    doc(db, "users", uid),
    {
      notificationsEnabled: notifGranted,
      locationEnabled: locGranted,
      expoPushUpdatedAt: new Date(),
    },
    { merge: true }
  );

  // 4) Planification silencieuse si granted
  if (notifGranted) {
   await rescheduleNextDailyIfNeeded();
  }

  // 5) Marque comme fait pour CE user
  await AsyncStorage.setItem(ASKED_KEY, "1");
}
