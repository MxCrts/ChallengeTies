// src/services/reviewService.ts
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Linking } from "react-native";
import * as Application from "expo-application";

/** ⚠️ REMPLACE ces IDs par les tiens */
const IOS_APP_ID = "6751504640"; // ✅ ton ID est déjà bon

// NEW — lecture robuste du package Android (prod, dev, Expo Go)
function getAndroidPackage(): string {
  // 1) Prod build : valeur fiable
  const fromApp = Application.applicationId;
  if (fromApp && !fromApp.startsWith("host.exp.exponent")) return fromApp;
  // 2) Var d'env expo (facultative mais pratique en dev)
  const fromEnv = process.env.EXPO_PUBLIC_ANDROID_PACKAGE;
  if (fromEnv) return fromEnv;
  // 3) Fallback en dur = ton package Play
  return "com.mxcrts.ChallengeTies";
}
const ANDROID_PACKAGE = getAndroidPackage();

const KEY_LAST_PROMPT = "review.lastPromptAt";
const KEY_SHOWN_COUNT = "review.shownCount";
const COOLDOWN_DAYS = 14;
const MAX_SHOWS = 3;

function daysSince(ts: number) {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

/** Ouvre la fiche de l’app sur le store (fallback manuel) */
export async function openStoreListing(): Promise<boolean> {
  // iOS: si l’ID n’est pas numérique, on évite une URL invalide
  const iosIdValid = /^\d+$/.test(IOS_APP_ID);
  const iosDeep = iosIdValid
    ? `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`
    : null;
  const iosHttpWrite = iosIdValid
    ? `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
    : null;
  const iosHttpApp = iosIdValid
    ? `https://apps.apple.com/app/id${IOS_APP_ID}`
    : "https://apps.apple.com"; // fallback ultra-générique si ID manquant
  const andDeep = `market://details?id=${ANDROID_PACKAGE}`;
  const andHttp = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

 const candidates = Platform.select({
    ios: [iosDeep, iosHttpWrite, iosHttpApp].filter(Boolean) as string[],
    android: [andDeep, andHttp],
    default: [andHttp],
  })!;

  for (const url of candidates) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
}

/** Heuristique simple + idempotence pour demander une note */
export async function maybeAskForReview(opts?: { force?: boolean }): Promise<boolean> {
  try {
    const supported = await StoreReview.isAvailableAsync();
    if (!supported && !opts?.force) return false; // Settings appellera openStoreListing()

    // Petit garde-fou iOS: prévenir en dev si l’ID n’est pas bon
    if (Platform.OS === "ios" && !/^\d+$/.test(IOS_APP_ID)) {
      // Ne bloque pas; juste informatif pendant le dev/test
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          "[reviewService] IOS_APP_ID invalide. Renseigne l’ID App Store numérique pour ouvrir directement la page d’avis."
        );
      }
    }

    // Rate limiting basique
    const [last, shownRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_LAST_PROMPT),
      AsyncStorage.getItem(KEY_SHOWN_COUNT),
    ]);
    const shown = Number(shownRaw || 0);

    if (!opts?.force) {
      if (shown >= MAX_SHOWS) return false;
      if (last && daysSince(Number(last)) < COOLDOWN_DAYS) return false;
    }

    // iOS renvoie void, Android renvoie boolean → on normalise en boolean
    const result = (await StoreReview.requestReview()) as unknown;
    const flowShown = typeof result === "boolean" ? result : true;

    // Book-keeping
    await AsyncStorage.multiSet([
      [KEY_LAST_PROMPT, String(Date.now())],
      [KEY_SHOWN_COUNT, String(shown + 1)],
    ]);

    return !!flowShown;
  } catch {
    return false;
  }
}

/** Compteur d’événements → déclenche la demande quand la cible est atteinte */
export async function bumpCounterAndMaybeReview(key: string, target = 3): Promise<void> {
  const countKey = `review.counter.${key}`;
  const raw = await AsyncStorage.getItem(countKey);
  const n = (Number(raw) || 0) + 1;
  await AsyncStorage.setItem(countKey, String(n));
  if (n >= target) {
    await maybeAskForReview();
    await AsyncStorage.removeItem(countKey); // reset doux
  }
}
