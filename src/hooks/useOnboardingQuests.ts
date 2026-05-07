// src/hooks/useOnboardingQuests.ts
// TOP 1 MONDIAL — triggers auto sur tous les events, polling intelligent

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOnboardingState,
  completeQuest,
  dismissOnboarding,
  incrementExploreCount,
  isProfileComplete,
  type OnboardingState,
  type QuestId,
} from "../services/onboardingQuestService";
import { AppState, type AppStateStatus, DeviceEventEmitter } from "react-native";
import { FIRST_MARK_EVENT } from "@/context/CurrentChallengesContext";

// Events internes pour déclencher les quêtes depuis n'importe où dans l'app
export const QUEST_DAILY_BONUS_CLAIMED = "quest.dailyBonusClaimed";
export const QUEST_INVITATION_SENT = "quest.invitationSent";
export const QUEST_CHALLENGE_EXPLORED = "quest.challengeExplored";

export function useOnboardingQuests() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const completingRef = useRef<Set<QuestId>>(new Set());

  // ─── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const s = await loadOnboardingState();
      if (mountedRef.current) setState(s);
    } catch (e) {
      console.warn("[useOnboardingQuests] load error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // ─── Complete (avec guard anti-double) ───────────────────────────────────

  const complete = useCallback(async (questId: QuestId) => {
    if (completingRef.current.has(questId)) return;
    completingRef.current.add(questId);
    try {
      const next = await completeQuest(questId);
      if (mountedRef.current) setState(next);
      return next;
    } catch (e) {
      console.warn("[useOnboardingQuests] complete error:", questId, e);
    } finally {
      completingRef.current.delete(questId);
    }
  }, []);

  // ─── Check auto profile ──────────────────────────────────────────────────

  const checkProfileQuest = useCallback(
    async (userData: any) => {
      if (!state) return;
      const already = state.quests.find((q) => q.id === "complete_profile")?.completed;
      if (already) return;
      if (isProfileComplete(userData)) {
        await complete("complete_profile");
      }
    },
    [state, complete]
  );

  // ─── Check auto streak ───────────────────────────────────────────────────

 const checkStreakQuest = useCallback(
  async (userData: any) => {
    if (!state) return;
    const already = state.quests.find((q) => q.id === "maintain_3day_streak")?.completed;
    if (already) return;

    // FIX: cherche le streak dans CurrentChallenges comme dans home.tsx
    const challenges = Array.isArray(userData?.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];
    const activeChallenges = challenges.filter(
      (c: any) => !c?.completed && !c?.archived
    );
    const maxStreak = activeChallenges.reduce(
      (m: number, c: any) => Math.max(m, typeof c?.streak === "number" ? c.streak : 0),
      0
    );

    if (maxStreak >= 3) {
      await complete("maintain_3day_streak");
    }
  },
  [state, complete]
);

  // ─── Dismiss ─────────────────────────────────────────────────────────────

  const dismiss = useCallback(async () => {
    await dismissOnboarding();
    if (mountedRef.current)
      setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
  }, []);

  // ─── Mount + AppState polling ─────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    load();

    const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") load();
    });

    return () => {
      mountedRef.current = false;
      sub.remove();
    };
  }, [load]);

  // ─── Trigger : FIRST_MARK_EVENT → mark_first_day ─────────────────────────

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(FIRST_MARK_EVENT, () => {
      complete("mark_first_day");
    });
    return () => sub.remove();
  }, [complete]);

  // ─── Trigger : QUEST_DAILY_BONUS_CLAIMED → claim_daily_bonus ─────────────

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(QUEST_DAILY_BONUS_CLAIMED, () => {
      complete("claim_daily_bonus");
    });
    return () => sub.remove();
  }, [complete]);

  // ─── Trigger : QUEST_INVITATION_SENT → invite_duo ────────────────────────

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(QUEST_INVITATION_SENT, () => {
      complete("invite_duo");
    });
    return () => sub.remove();
  }, [complete]);

  // ─── Trigger : QUEST_CHALLENGE_EXPLORED → explore_challenges ─────────────

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(QUEST_CHALLENGE_EXPLORED, async () => {
      await incrementExploreCount();
      load();
    });
    return () => sub.remove();
  }, [load]);

  // ─── Dérivés ──────────────────────────────────────────────────────────────

  const completedCount = state?.quests.filter((q) => q.completed).length ?? 0;
  const totalCount = state?.quests.length ?? 6;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;

  // ✅ FIX : allCompleted recalculé localement pour éviter le cas où
  // state.allCompleted est true mais les quêtes ne le reflètent pas encore
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const visible =
    !loading &&
    !!state &&
    !state.dismissed &&
    !allCompleted; // ← utilise le calcul local, pas state.allCompleted

  return {
    loading,
    state,
    visible,
    completedCount,
    totalCount,
    progressPct,
    complete,
    dismiss,
    reload: load,
    checkProfileQuest,
    checkStreakQuest,
  };
}
