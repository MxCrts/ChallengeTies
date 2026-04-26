// context/CoachmarkContext.tsx
// VERSION FINALE DÉFINITIVE v3
//
// CHANGEMENTS vs version précédente :
// 1. clearRects() dans next() est SUPPRIMÉ — les rects se mettent à jour via
//    CoachmarkAnchor.useEffect([currentStep]) naturellement, sans flash.
//    On vide uniquement au skip/fin de tour.
// 2. _sessionActive est géré ici (source unique de vérité).
// 3. tryStartFromOnboarding() est la seule entrée pour déclencher le tour
//    depuis onboarding. Pas de setTimeout externe dans onClose WelcomeBonus.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  coachmarkService,
  COACHMARK_STEPS,
  type CoachmarkStepId,
} from "../src/services/coachmarkService";

export type CoachmarkTargetRect = { x: number; y: number; w: number; h: number };

export const ONBOARDING_JUST_FINISHED_KEY = "onboarding.justFinished.v1";

// ── Flag module-level — source unique de vérité ────────────────────────────────
let _sessionActive = false;
export const isCoachmarkSessionActive = () => _sessionActive;

// ── Types ─────────────────────────────────────────────────────────────────────
type CoachmarkContextType = {
  active: boolean;
  stepIndex: number;
  currentStep: CoachmarkStepId | null;
  targetRects: Partial<Record<CoachmarkStepId, CoachmarkTargetRect>>;
  isDarkMode: boolean;
  next: () => void;
  skip: () => void;
  start: () => Promise<void>;
  tryStartFromOnboarding: () => Promise<void>;
  setOnTourEnd: (cb: (() => void) | null) => void;
  registerRect: (id: CoachmarkStepId, rect: CoachmarkTargetRect) => void;
  clearRects: () => void;
  setIsDarkMode: (v: boolean) => void;
};

const CoachmarkContext = createContext<CoachmarkContextType | null>(null);

export const useCoachmark = (): CoachmarkContextType => {
  const ctx = useContext(CoachmarkContext);
  if (!ctx) throw new Error("useCoachmark must be used inside CoachmarkProvider");
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const CoachmarkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRects, setTargetRects] = useState<
    Partial<Record<CoachmarkStepId, CoachmarkTargetRect>>
  >({});
  const [isDarkMode, setIsDarkMode] = useState(true);

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const onTourEndRef = useRef<(() => void) | null>(null);
  const registerRectRef = useRef<(id: CoachmarkStepId, rect: CoachmarkTargetRect) => void>(
  () => {}
);

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
  // 800ms au lieu de 600ms — absorbe le FadeOut de l'overlay (200ms)
  // + le temps de re-render de la home avant d'armer le spotlight
  setTimeout(() => {
    _sessionActive = false;
    if (mountedRef.current && onTourEndRef.current) {
      onTourEndRef.current();
    }
  }, 800);
}, []);


const registerRect = useCallback(
  (id: CoachmarkStepId, rect: CoachmarkTargetRect) => {
    setTargetRects((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.w === rect.w &&
        existing.h === rect.h
      )
        return prev; // ✅ même rect → pas de re-render
      return { ...prev, [id]: rect };
    });
  },
  [] // ✅ pas de deps → référence stable
);

registerRectRef.current = registerRect;

  // Vide TOUS les rects — appelé seulement à la fin/skip du tour
  const clearRects = useCallback(() => {
    setTargetRects({});
  }, []);

  // Vide uniquement le rect du step courant pour forcer une re-mesure
  // sans flash (les autres rects restent en mémoire)
  const _clearCurrentRect = useCallback((stepId: CoachmarkStepId) => {
    setTargetRects((prev) => {
      if (!prev[stepId]) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }, []);

  const _doStart = useCallback(async () => {
  console.log("[COACH_CTX] _doStart called, startingRef:", startingRef.current);
  if (startingRef.current) return;
  startingRef.current = true;
  try {
    _sessionActive = true;

    const justFinished = await AsyncStorage.getItem(ONBOARDING_JUST_FINISHED_KEY).catch(() => null);
    console.log("[COACH_CTX] justFinished:", justFinished);

    if (justFinished === "1") {
      await coachmarkService.reset();
      console.log("[COACH_CTX] reset done");
    }

    const done = await coachmarkService.isDone();
    console.log("[COACH_CTX] isDone:", done, "mounted:", mountedRef.current);
    
    if (done || !mountedRef.current) {
      _sessionActive = false;
      console.log("[COACH_CTX] → abort (done or unmounted)");
      return;
    }

    setStepIndex(0);
    setActive(true);
    console.log("[COACH_CTX] → setActive(true) called");
    await coachmarkService.saveStep(0);
  } finally {
    startingRef.current = false;
  }
}, []);

  const tryStartFromOnboarding = useCallback(async () => {
    if (!mountedRef.current) return;
    await _doStart();
  }, [_doStart]);

  const start = useCallback(async () => {
    _sessionActive = true;
    await coachmarkService.reset();
    // Vide les rects au démarrage manuel
    setTargetRects({});
    setStepIndex(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((prev) => {
      const nextIdx = prev + 1;

      if (nextIdx >= COACHMARK_STEPS.length) {
        setActive(false);
        // Vide tous les rects à la fin du tour
        setTargetRects({});
        coachmarkService.markDone();
        _fireOnTourEnd();
        return prev;
      }

      // FIX FLASH : on supprime UNIQUEMENT le rect du step actuel (prev)
      // Le step suivant (nextIdx) va se mesurer via CoachmarkAnchor.useEffect
      // Les autres rects sont conservés → pas de flash overlay
      const currentStepId = COACHMARK_STEPS[prev];
      if (currentStepId) {
        setTargetRects((rects) => {
          const updated = { ...rects };
          delete updated[currentStepId];
          return updated;
        });
      }

      coachmarkService.saveStep(nextIdx);
      return nextIdx;
    });
  }, [_fireOnTourEnd]);

  const skip = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    // Vide tous les rects au skip
    setTargetRects({});
    coachmarkService.markDone();
    _fireOnTourEnd();
  }, [_fireOnTourEnd]);

  const currentStep: CoachmarkStepId | null = active
    ? (COACHMARK_STEPS[stepIndex] ?? null)
    : null;

  return (
    <CoachmarkContext.Provider
      value={{
        active,
        stepIndex,
        currentStep,
        targetRects,
        isDarkMode,
        next,
        skip,
        start,
        tryStartFromOnboarding,
        setOnTourEnd,
        registerRect,
        clearRects,
        setIsDarkMode,
      }}
    >
      {children}
    </CoachmarkContext.Provider>
  );
};
