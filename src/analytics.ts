// src/analytics.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";

/** Active/désactive le log si besoin (garde sur true en prod) */
const ENABLE_ANALYTICS = true;

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

/** Log basique d’un événement important (nom + petits détails facultatifs) */
export async function logEvent(
  name:
    | "app_open"
    | "register_success"
    | "first_challenge_started"
    | "invite_sent"
    | "invite_accepted"
    | "paywall_view"
    | "purchase_success"
    | "ref_attributed"
    | "ref_activation_marked"
    | "pioneer_unlocked"
    | "ambassador_reward"
    | "ambassador_milestone"
    | "share_card_saved"
    | "share_card_shared"
    | "share_open"
    | "share_link_copied"
    | "share_native_opened"
    | "ref_activation_marked"
    | "ambassador_reward"
    | "ref_reward_granted"       // 👈 NEW
    | "ref_milestone_reached"
    
    // 👇 garde-fou: autorise d'autres strings à l'avenir
    | (string & {}),
  params: Record<string, any> = {}
) {
  try {
    if (!ENABLE_ANALYTICS) return;

    const uid = auth.currentUser?.uid ?? null;
    const anonId = await getAnonId();
    const appVersion =
      // @ts-ignore (selon l’environnement Expo)
      (Constants?.nativeAppVersion as string | undefined) ?? (Constants?.manifest2?.extra?.expoClient?.version as string | undefined) ?? null;

    await addDoc(collection(db, "appEvents"), {
      name,
      params,
      uid,
      anonId,
      appVersion,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("[analytics] logEvent error:", e);
  }
}

/** Utilitaire: n’enregistrer cet événement qu’UNE seule fois par appareil */
export async function logEventOnce(key: string, name: Parameters<typeof logEvent>[0], params: Record<string, any> = {}) {
  const storageKey = `ties_once_${key}`;
  const done = await AsyncStorage.getItem(storageKey);
  if (done === "1") return;
  await logEvent(name, params);
  await AsyncStorage.setItem(storageKey, "1");
}
