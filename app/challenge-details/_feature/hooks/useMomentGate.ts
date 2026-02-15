import { useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { MISSED_FLOW_EVENT, MARK_RESOLVED_EVENT } from "@/context/CurrentChallengesContext";

type BuildDuoPayload = (args: any) => any;

type Args = {
  id: string;

  // missed modal state
  missedChallengeVisible: boolean;
  setMissedChallengeVisible: (v: boolean) => void;

  // refs / helpers
  finalSelectedDaysRef: React.MutableRefObject<number>;
  activeEntryRef: React.MutableRefObject<any>;
  isDuoRef: React.MutableRefObject<boolean>;
  duoChallengeDataRef: React.MutableRefObject<any>;

  isMarkedToday: (challengeId: string, selectedDays: number) => boolean;

  // state used to compute dayIndex fallback
  finalCompletedDays: number;

  // moment / completion setters
  setSoloMomentVisible: (v: boolean) => void;
  setDuoMomentVisible: (v: boolean) => void;

  setSoloMomentDayIndex: (v: number) => void;
  setSoloMomentTotalDays: (v: number) => void;
  setSoloMomentStreak: (v: number | undefined) => void;
  setSoloMomentVariant: (v: "daily" | "milestone") => void;

  setDuoMomentPayload: (v: any) => void;
  buildDuoMomentPayload: BuildDuoPayload;

  setCompletionModalVisible: (v: boolean) => void;
};

export function useMomentGate({
  id,
  missedChallengeVisible,
  setMissedChallengeVisible,
  finalSelectedDaysRef,
  activeEntryRef,
  isDuoRef,
  duoChallengeDataRef,
  isMarkedToday,
  finalCompletedDays,
  setSoloMomentVisible,
  setDuoMomentVisible,
  setSoloMomentDayIndex,
  setSoloMomentTotalDays,
  setSoloMomentStreak,
  setSoloMomentVariant,
  setDuoMomentPayload,
  buildDuoMomentPayload,
  setCompletionModalVisible,
}: Args) {
  // ✅ 1) Listen to MISSED_FLOW_EVENT -> toggles MissedChallengeModal
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MISSED_FLOW_EVENT, (payload: any) => {
      // payload typique: { challengeId, visible: true/false } ou juste { challengeId }
      if (!payload) return;
      if (payload.challengeId && payload.challengeId !== id) return;

      // si tu envoies explicitement visible:
      if (typeof payload.visible === "boolean") {
        setMissedChallengeVisible(payload.visible);
        return;
      }

      // fallback: l’event signifie "missed flow démarre"
      setMissedChallengeVisible(true);
    });

    return () => sub?.remove?.();
  }, [id, setMissedChallengeVisible]);

  // ✅ 2) After MARK_RESOLVED_EVENT -> open Moment modal once mark is synced
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MARK_RESOLVED_EVENT, (p: any) => {
      if (!p) return;
      if (p.id && p.id !== id) return;

      const selectedDays = Number(p.selectedDays || finalSelectedDaysRef.current || 0);
      if (!selectedDays) return;

      // tentative "safe" : on attend que le missed flow soit bien fermé + que isMarkedToday devienne true
      const tryOpen = (attempt = 0) => {
        // 1) si missed flow encore visible, on attend
        if ((globalThis as any).__MISSED_VISIBLE__ === true || missedChallengeVisible) {
          if (attempt < 18) setTimeout(() => tryOpen(attempt + 1), 60);
          return;
        }

        // 2) si pas encore marqué côté UI (snapshot pas encore arrivé), on attend un peu
        if (!isMarkedToday(id, selectedDays)) {
          if (attempt < 18) setTimeout(() => tryOpen(attempt + 1), 60);
          return;
        }

        // 3) lire la meilleure source (ref) pour récupérer dayIndex/streak
        const entry = activeEntryRef.current;
        const totalDays = Number(selectedDays || entry?.selectedDays || 0) || 0;
        const dayIndex = Number(entry?.completedDays) || Number(finalCompletedDays) || 0;
        const streak = typeof entry?.streak === "number" ? entry.streak : undefined;

        // ✅ LAST DAY => Completion only (jamais Moment)
        if (totalDays > 0 && dayIndex >= totalDays) {
          setSoloMomentVisible(false);
          setDuoMomentVisible(false);
          requestAnimationFrame(() => {
            setCompletionModalVisible(true);
          });
          return;
        }

        // 4) ouvrir le bon modal
        if (isDuoRef.current) {
          const partner = duoChallengeDataRef.current?.duoUser;

          setDuoMomentPayload(
            buildDuoMomentPayload({
              action: p.action,
              streak,
              myDone: dayIndex,
              myTotal: totalDays,
              partnerName: partner?.name,
              partnerAvatar: partner?.avatar,
              partnerDone: partner?.completedDays,
              partnerTotal: partner?.selectedDays,
            })
          );
          setDuoMomentVisible(true);
          return;
        }

        setSoloMomentDayIndex(dayIndex);
        setSoloMomentTotalDays(totalDays);
        setSoloMomentStreak(streak);
        setSoloMomentVariant("daily");
        setSoloMomentVisible(true);
      };

      // on laisse 1 tick pour que l’UI ferme le modal missed + que le snapshot arrive
      setTimeout(() => tryOpen(0), 0);
    });

    return () => sub?.remove?.();
  }, [
    id,
    missedChallengeVisible,
    isMarkedToday,
    finalCompletedDays,
    finalSelectedDaysRef,
    activeEntryRef,
    isDuoRef,
    duoChallengeDataRef,
    setSoloMomentVisible,
    setDuoMomentVisible,
    setSoloMomentDayIndex,
    setSoloMomentTotalDays,
    setSoloMomentStreak,
    setSoloMomentVariant,
    setDuoMomentPayload,
    buildDuoMomentPayload,
    setCompletionModalVisible,
  ]);
}
