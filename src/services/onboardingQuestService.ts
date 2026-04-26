// src/services/onboardingQuestService.ts
// TOP 1 MONDIAL — 6 quêtes onboarding avec triggers auto, trophées Firestore

import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, auth } from "@/constants/firebase-config";
import {
  doc,
  runTransaction,
  increment,
  serverTimestamp,
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestId =
  | "mark_first_day"
  | "complete_profile"
  | "explore_challenges"
  | "claim_daily_bonus"
  | "invite_duo"
  | "maintain_3day_streak";

export type QuestDef = {
  id: QuestId;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  trophies: number;
  actionRoute: string | null;
  actionQuery?: string;
  order: number;
};

export type QuestState = QuestDef & {
  completed: boolean;
  completedAt?: number;
};

export type OnboardingState = {
  initialized: boolean;
  dismissed: boolean;
  allCompleted: boolean;
  quests: QuestState[];
  exploreCount: number;
};

// ─── Définition des 6 quêtes ──────────────────────────────────────────────────
// ORDRE STRATÉGIQUE :
// 0 - mark_first_day   → action immédiate, gratification rapide
// 1 - invite_duo       → différenciateur clé, pousser le social dès le début
// 2 - claim_daily_bonus → récompense simple
// 3 - explore_challenges → découverte
// 4 - complete_profile  → engagement identitaire
// 5 - maintain_3day_streak → long terme, auto-trigger

export const QUEST_DEFINITIONS: QuestDef[] = [
  {
    id: "mark_first_day",
    titleKey: "onboarding.quest.markFirstDay.title",
    descriptionKey: "onboarding.quest.markFirstDay.desc",
    icon: "checkmark-circle-outline",
    trophies: 30,
    actionRoute: null,
    order: 0,
  },
  {
    // MOVED UP: différenciateur principal de ChallengeTies
    id: "invite_duo",
    titleKey: "onboarding.quest.inviteDuo.title",
    descriptionKey: "onboarding.quest.inviteDuo.desc",
    icon: "people-outline",
    trophies: 40,
    actionRoute: null,
    order: 1,
  },
  {
    id: "claim_daily_bonus",
    titleKey: "onboarding.quest.claimDailyBonus.title",
    descriptionKey: "onboarding.quest.claimDailyBonus.desc",
    icon: "gift-outline",
    trophies: 25,
    actionRoute: null,
    order: 2,
  },
  {
    id: "explore_challenges",
    titleKey: "onboarding.quest.exploreChallenges.title",
    descriptionKey: "onboarding.quest.exploreChallenges.desc",
    icon: "compass-outline",
    trophies: 15,
    actionRoute: "/explore",
    order: 3,
  },
  {
    id: "complete_profile",
    titleKey: "onboarding.quest.completeProfile.title",
    descriptionKey: "onboarding.quest.completeProfile.desc",
    icon: "person-circle-outline",
    trophies: 20,
    actionRoute: "/profile/UserInfo",
    order: 4,
  },
  {
    id: "maintain_3day_streak",
    titleKey: "onboarding.quest.maintain3DayStreak.title",
    descriptionKey: "onboarding.quest.maintain3DayStreak.desc",
    icon: "flame-outline",
    trophies: 50,
    actionRoute: null,
    order: 5,
  },
];

export const TOTAL_TROPHIES = QUEST_DEFINITIONS.reduce(
  (sum, q) => sum + q.trophies,
  0
); // = 180

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const KEY_STATE = "onboarding.quest.state.v3";
const KEY_EXPLORE_COUNT = "onboarding.quest.exploreCount.v3";
const KEY_DISMISSED = "onboarding.quest.dismissed.v3";
const KEY_INITIALIZED = "onboarding.quest.initialized.v3";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildQuestStates = (
  completedIds: Partial<Record<QuestId, number>>
): QuestState[] =>
  QUEST_DEFINITIONS.slice()
    .sort((a, b) => a.order - b.order)
    .map((def) => ({
      ...def,
      completed: !!completedIds[def.id],
      completedAt: completedIds[def.id],
    }));

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadOnboardingState(): Promise<OnboardingState> {
  try {
    const [rawState, rawExplore, rawDismissed, rawInit] = await Promise.all([
      AsyncStorage.getItem(KEY_STATE),
      AsyncStorage.getItem(KEY_EXPLORE_COUNT),
      AsyncStorage.getItem(KEY_DISMISSED),
      AsyncStorage.getItem(KEY_INITIALIZED),
    ]);

    const initialized = rawInit === "1";
    const dismissed = rawDismissed === "1";
    const exploreCount = rawExplore ? parseInt(rawExplore, 10) || 0 : 0;

    const completedIds: Partial<Record<QuestId, number>> = rawState
      ? JSON.parse(rawState)
      : {};

    const quests = buildQuestStates(completedIds);
    const allCompleted = quests.every((q) => q.completed);

    return { initialized, dismissed, allCompleted, quests, exploreCount };
  } catch {
    return {
      initialized: false,
      dismissed: false,
      allCompleted: false,
      quests: buildQuestStates({}),
      exploreCount: 0,
    };
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

export async function initOnboardingQuests(): Promise<OnboardingState> {
  try {
    const already = await AsyncStorage.getItem(KEY_INITIALIZED);
    if (already === "1") return loadOnboardingState();

    await AsyncStorage.multiSet([
      [KEY_INITIALIZED, "1"],
      [KEY_STATE, JSON.stringify({})],
      [KEY_EXPLORE_COUNT, "0"],
    ]);
  } catch {}
  return loadOnboardingState();
}

// ─── Complete quest + Firestore trophées ─────────────────────────────────────

export async function completeQuest(questId: QuestId): Promise<OnboardingState> {
  try {
    const rawState = await AsyncStorage.getItem(KEY_STATE);
    const completedIds: Partial<Record<QuestId, number>> = rawState
      ? JSON.parse(rawState)
      : {};

    if (completedIds[questId]) return loadOnboardingState();

    completedIds[questId] = Date.now();
    await AsyncStorage.setItem(KEY_STATE, JSON.stringify(completedIds));

    const def = QUEST_DEFINITIONS.find((d) => d.id === questId);
    const trophies = def?.trophies ?? 0;
    const uid = auth.currentUser?.uid;

    if (uid && trophies > 0) {
      try {
        const userRef = doc(db, "users", uid);
        await runTransaction(db, async (tx) => {
          tx.update(userRef, {
            trophies: increment(trophies),
            totalTrophies: increment(trophies),
            [`onboardingQuests.${questId}`]: true,
            [`onboardingQuests.${questId}At`]: serverTimestamp(),
          });
        });
      } catch (e) {
        console.warn("[OnboardingQuest] Firestore transaction failed:", e);
      }
    }
  } catch (e) {
    console.warn("[OnboardingQuest] completeQuest error:", e);
  }

  return loadOnboardingState();
}

// ─── Explore counter ─────────────────────────────────────────────────────────

export async function incrementExploreCount(): Promise<number> {
  try {
    const rawState = await AsyncStorage.getItem(KEY_STATE);
    const completedIds: Partial<Record<QuestId, number>> = rawState
      ? JSON.parse(rawState)
      : {};

    if (completedIds["explore_challenges"]) return 3;

    const raw = await AsyncStorage.getItem(KEY_EXPLORE_COUNT);
    const current = raw ? parseInt(raw, 10) || 0 : 0;
    const next = current + 1;
    await AsyncStorage.setItem(KEY_EXPLORE_COUNT, String(next));

    if (next >= 3) {
      await completeQuest("explore_challenges");
    }

    return next;
  } catch {
    return 0;
  }
}

export async function getExploreCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_EXPLORE_COUNT);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

// ─── Dismiss ──────────────────────────────────────────────────────────────────

export async function dismissOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_DISMISSED, "1");
  } catch {}
}

// ─── Reset (dev only) ─────────────────────────────────────────────────────────

export async function resetOnboardingQuests(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEY_STATE,
      KEY_EXPLORE_COUNT,
      KEY_DISMISSED,
      KEY_INITIALIZED,
    ]);
  } catch {}
}

// ─── Check profile completeness ───────────────────────────────────────────────

export function isProfileComplete(userData: any): boolean {
  if (!userData) return false;
  const hasPhoto =
    typeof userData.photoURL === "string" && userData.photoURL.trim().length > 0;
  const hasBio =
    typeof userData.bio === "string" && userData.bio.trim().length > 0;
  const hasUsername =
    typeof userData.username === "string" && userData.username.trim().length > 0;
  return hasPhoto && (hasBio || hasUsername);
}
