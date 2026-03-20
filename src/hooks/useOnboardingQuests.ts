// src/hooks/useOnboardingQuests.ts
// ✅ Hook onboarding "First Win" — top 1 mondial

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOnboardingState,
  completeQuest,
  dismissOnboarding,
  type OnboardingState,
  type QuestId,
} from "../services/onboardingQuestService";
import { AppState, type AppStateStatus } from "react-native";

const POLL_MS = 1500; // re-check quand l'app revient au premier plan

export function useOnboardingQuests() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const s = await loadOnboardingState();
      if (mountedRef.current) setState(s);
    } catch {}
    finally { if (mountedRef.current) setLoading(false); }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    // Re-check quand l'app revient au premier plan
    // (ex: user est allé marquer un défi dans une autre tab)
    const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") load();
    });

    return () => {
      mountedRef.current = false;
      sub.remove();
    };
  }, [load]);

  const complete = useCallback(async (questId: QuestId) => {
    const next = await completeQuest(questId);
    if (mountedRef.current) setState(next);
    return next;
  }, []);

  const dismiss = useCallback(async () => {
    await dismissOnboarding();
    if (mountedRef.current) setState(prev => prev ? { ...prev, dismissed: true } : prev);
  }, []);

  // Visible si : initialisé + pas dismissed + pas tout complété
  const visible =
    !loading &&
    !!state &&
    !state.dismissed &&
    !state.allCompleted;

  const completedCount = state?.quests.filter(q => q.completed).length ?? 0;
  const totalCount = state?.quests.length ?? 3;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;

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
  };
}
