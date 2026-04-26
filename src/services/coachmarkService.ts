// src/services/coachmarkService.ts
// v2 — 5 étapes : create, explore, exploits, profile, bonus
// L'étape "duo" est supprimée — gérée par FirstMarkModal

import AsyncStorage from "@react-native-async-storage/async-storage";

const COACHMARK_DONE_KEY = "coachmark.guidedTour.v2.done"; // v2 = reset auto si l'user avait v1
const COACHMARK_STEP_KEY = "coachmark.guidedTour.v2.step";

export type CoachmarkStepId =
  | "create"
  | "explore"
  | "exploits"
  | "profile"
  | "bonus";

export const COACHMARK_STEPS: CoachmarkStepId[] = [
  "create",
  "explore",
  "exploits",
  "profile",
  "bonus",
];

export const coachmarkService = {
  async isDone(): Promise<boolean> {
    try {
      const v = await AsyncStorage.getItem(COACHMARK_DONE_KEY);
      return v === "1";
    } catch {
      return false;
    }
  },

  async markDone(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [COACHMARK_DONE_KEY, "1"],
        [COACHMARK_STEP_KEY, String(COACHMARK_STEPS.length)],
      ]);
    } catch {}
  },

  async saveStep(stepIndex: number): Promise<void> {
    try {
      await AsyncStorage.setItem(COACHMARK_STEP_KEY, String(stepIndex));
    } catch {}
  },

  async getSavedStep(): Promise<number> {
    try {
      const v = await AsyncStorage.getItem(COACHMARK_STEP_KEY);
      const n = Number(v ?? 0);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    } catch {
      return 0;
    }
  },

  async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([COACHMARK_DONE_KEY, COACHMARK_STEP_KEY]);
    } catch {}
  },
};
