// src/services/onboardingQuestService.ts
// ✅ Onboarding "First Win" — Service top 1 mondial
// Gère la logique des quêtes d'onboarding adaptatives solo/duo

import AsyncStorage from "@react-native-async-storage/async-storage";

/* ─── Clés AsyncStorage ─────────────────────────────────────── */
const KEYS = {
  QUESTS_DONE:   "onboarding.quests.done.v1",   // "1" = banner dismissed définitivement
  QUEST_STATE:   "onboarding.quests.state.v1",  // JSON des quêtes et leur état
  USER_PATH:     "onboarding.user.path.v1",     // "solo" | "duo"
  INITIALIZED:   "onboarding.initialized.v1",   // "1" = déjà initialisé
};

/* ─── Types ─────────────────────────────────────────────────── */
export type QuestId =
  | "mark_first_day"       // Solo : marquer son premier jour
  | "explore_community"    // Solo + Duo : ouvrir Exploits
  | "complete_profile"     // Solo + Duo : photo + catégories
  | "join_solo_challenge"  // Duo : rejoindre un défi solo
  | "view_challenge";      // Solo : aller voir son défi

export type UserPath = "solo" | "duo";

export interface Quest {
  id: QuestId;
  titleKey: string;       // clé i18n
  descKey: string;        // clé i18n description
  trophies: number;
  completed: boolean;
  icon: string;           // Ionicons name
}

export interface OnboardingState {
  path: UserPath;
  quests: Quest[];
  allCompleted: boolean;
  dismissed: boolean;
  totalTrophiesEarned: number;
}

/* ─── Quêtes par path ───────────────────────────────────────── */
const SOLO_QUESTS: Omit<Quest, "completed">[] = [
  {
    id: "mark_first_day",
    titleKey: "onboarding.quest.markFirstDay.title",
    descKey:  "onboarding.quest.markFirstDay.desc",
    trophies: 30,
    icon: "checkmark-circle-outline",
  },
  {
    id: "complete_profile",
    titleKey: "onboarding.quest.completeProfile.title",
    descKey:  "onboarding.quest.completeProfile.desc",
    trophies: 20,
    icon: "person-circle-outline",
  },
  {
    id: "explore_community",
    titleKey: "onboarding.quest.exploreCommunity.title",
    descKey:  "onboarding.quest.exploreCommunity.desc",
    trophies: 10,
    icon: "trophy-outline",
  },
];

const DUO_QUESTS: Omit<Quest, "completed">[] = [
  {
    id: "join_solo_challenge",
    titleKey: "onboarding.quest.joinSoloChallenge.title",
    descKey:  "onboarding.quest.joinSoloChallenge.desc",
    trophies: 30,
    icon: "flag-outline",
  },
  {
    id: "complete_profile",
    titleKey: "onboarding.quest.completeProfile.title",
    descKey:  "onboarding.quest.completeProfile.desc",
    trophies: 20,
    icon: "person-circle-outline",
  },
  {
    id: "explore_community",
    titleKey: "onboarding.quest.exploreCommunity.title",
    descKey:  "onboarding.quest.exploreCommunity.desc",
    trophies: 10,
    icon: "trophy-outline",
  },
];

/* ─── Helpers internes ──────────────────────────────────────── */
function buildQuests(path: UserPath): Quest[] {
  const base = path === "solo" ? SOLO_QUESTS : DUO_QUESTS;
  return base.map(q => ({ ...q, completed: false }));
}

/* ─── API publique ──────────────────────────────────────────── */

/**
 * Initialise les quêtes d'onboarding.
 * À appeler une seule fois après le firstpick, en passant le path choisi.
 * Idempotent : si déjà initialisé, ne fait rien.
 */
export async function initOnboardingQuests(path: UserPath): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(KEYS.INITIALIZED);
    if (already === "1") return;

    const quests = buildQuests(path);
    await AsyncStorage.multiSet([
      [KEYS.USER_PATH,   path],
      [KEYS.QUEST_STATE, JSON.stringify(quests)],
      [KEYS.INITIALIZED, "1"],
    ]);
  } catch (e) {
    __DEV__ && console.warn("[onboardingQuests] init error:", e);
  }
}

/**
 * Charge l'état complet des quêtes.
 * Retourne null si pas encore initialisé.
 */
export async function loadOnboardingState(): Promise<OnboardingState | null> {
  try {
    const [
      [, pathRaw],
      [, stateRaw],
      [, dismissedRaw],
    ] = await AsyncStorage.multiGet([
      KEYS.USER_PATH,
      KEYS.QUEST_STATE,
      KEYS.QUESTS_DONE,
    ]);

    if (!pathRaw || !stateRaw) return null;

    const path     = pathRaw as UserPath;
    const quests   = JSON.parse(stateRaw) as Quest[];
    const dismissed = dismissedRaw === "1";
    const allCompleted = quests.every(q => q.completed);
    const totalTrophiesEarned = quests
      .filter(q => q.completed)
      .reduce((sum, q) => sum + q.trophies, 0);

    return { path, quests, allCompleted, dismissed, totalTrophiesEarned };
  } catch (e) {
    __DEV__ && console.warn("[onboardingQuests] load error:", e);
    return null;
  }
}

/**
 * Marque une quête comme complétée.
 * Retourne le nouvel état ou null si erreur.
 */
export async function completeQuest(questId: QuestId): Promise<OnboardingState | null> {
  try {
    const stateRaw = await AsyncStorage.getItem(KEYS.QUEST_STATE);
    if (!stateRaw) return null;

    const quests = JSON.parse(stateRaw) as Quest[];
    const updated = quests.map(q =>
      q.id === questId ? { ...q, completed: true } : q
    );

    await AsyncStorage.setItem(KEYS.QUEST_STATE, JSON.stringify(updated));
    return loadOnboardingState();
  } catch (e) {
    __DEV__ && console.warn("[onboardingQuests] complete error:", e);
    return null;
  }
}

/**
 * Dismisses définitivement la bannière.
 */
export async function dismissOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.QUESTS_DONE, "1");
  } catch (e) {
    __DEV__ && console.warn("[onboardingQuests] dismiss error:", e);
  }
}

/**
 * Reset complet (dev/test uniquement).
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch {}
}
