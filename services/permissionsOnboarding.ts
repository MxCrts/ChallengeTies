// src/services/permissionsOnboarding.ts
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import {
  rescheduleNextDailyIfNeeded,
  rescheduleLateIfNeeded,
} from "@/services/notificationService";

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
  // ✅ On importe getDoc pour vérifier que le doc principal existe déjà
  // avant d'écrire — évite de créer un doc partiel si appelé trop tôt
  const userRef = doc(db, "users", uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        notificationsEnabled: notifGranted,
        locationEnabled: locGranted,
        expoPushUpdatedAt: new Date(),
      });
    } else {
      // Doc pas encore créé → on skip, register va s'en occuper
      console.log("[permissionsOnboarding] userDoc absent → skip write");
      await AsyncStorage.setItem(ASKED_KEY, "1");
      return;
    }
  } catch (e) {
    console.log("[permissionsOnboarding] write error:", e);
  }

  // 4) Planification silencieuse si granted
  if (notifGranted) {
   await rescheduleNextDailyIfNeeded();
    await rescheduleLateIfNeeded();
  }

  // 5) Marque comme fait pour CE user
  await AsyncStorage.setItem(ASKED_KEY, "1");
}
