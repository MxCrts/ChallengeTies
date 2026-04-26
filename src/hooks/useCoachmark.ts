// src/hooks/useCoachmark.ts  v6 FINAL
// Fix spotlight pop : flag module-level _sessionActive
// Mis à true AVANT le reset DEV → useEffect arm ne peut pas s'armer pendant le tour

import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  coachmarkService,
  COACHMARK_STEPS,
  type CoachmarkStepId,
} from "../services/coachmarkService";

export const ONBOARDING_JUST_FINISHED_KEY = "onboarding.justFinished.v1";

// ── Flag module-level ─────────────────────────────────────────────────────────
// true = tour en cours OU délai post-tour (spotlight ne doit pas s'armer)
// Lisible depuis index.tsx via isCoachmarkSessionActive()
let _sessionActive = false;
export const isCoachmarkSessionActive = () => _sessionActive;

export type CoachmarkState = {
  active: boolean;
  stepIndex: number;
  currentStep: CoachmarkStepId | null;
  next: () => void;
  skip: () => void;
  start: () => void;
  tryStartFromOnboarding: () => Promise<void>;
  setOnTourEnd: (cb: (() => void) | null) => void;
};

export function useCoachmark(): CoachmarkState {
  const [active, setActive]       = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const mountedRef   = useRef(true);
  const startingRef  = useRef(false);
  const onTourEndRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      _sessionActive = false;
    };
  }, []);

  const setOnTourEnd = useCallback((cb: (() => void) | null) => {
    onTourEndRef.current = cb;
  }, []);

  const _fireOnTourEnd = useCallback(() => {
    // _sessionActive reste true encore 600ms après la fin du tour
    // pour absorber toute race condition avant d'armer le spotlight
    setTimeout(() => {
      _sessionActive = false;
      if (mountedRef.current && onTourEndRef.current) {
        onTourEndRef.current();
      }
    }, 600);
  }, []);

  const _doStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // ✅ Flag ON immédiatement — avant même le reset DEV
      // Bloque useEffect arm dans index.tsx pendant toute la session
      _sessionActive = true;
const justFinished = await AsyncStorage.getItem(
  ONBOARDING_JUST_FINISHED_KEY
).catch(() => null);

if (justFinished === "1") {
  await coachmarkService.reset();
}

      const done = await coachmarkService.isDone();
      if (done || !mountedRef.current) {
        _sessionActive = false;
        return;
      }

      setStepIndex(0);
      setActive(true);
      await coachmarkService.saveStep(0);
    } finally {
      startingRef.current = false;
    }
  }, []);

  const tryStartFromOnboarding = useCallback(async () => {
    if (!mountedRef.current) return;
    await _doStart();
  }, [_doStart]);

  const next = useCallback(() => {
    setStepIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= COACHMARK_STEPS.length) {
        setActive(false);
        coachmarkService.markDone();
        _fireOnTourEnd();
        return prev;
      }
      coachmarkService.saveStep(nextIdx);
      return nextIdx;
    });
  }, [_fireOnTourEnd]);

  const skip = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    coachmarkService.markDone();
    _fireOnTourEnd();
  }, [_fireOnTourEnd]);

  const start = useCallback(async () => {
    _sessionActive = true;
    await coachmarkService.reset();
    setStepIndex(0);
    setActive(true);
  }, []);

  const currentStep: CoachmarkStepId | null = active
    ? (COACHMARK_STEPS[stepIndex] ?? null)
    : null;

  return { active, stepIndex, currentStep, next, skip, start, tryStartFromOnboarding, setOnTourEnd };
}
