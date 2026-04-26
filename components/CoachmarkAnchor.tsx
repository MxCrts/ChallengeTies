// components/CoachmarkAnchor.tsx
// VERSION DÉFINITIVE v6 — Fix boucle infinie measureInWindow

import React, { useRef, useCallback, useEffect } from "react";
import { View } from "react-native";
import type { ViewProps } from "react-native";
import { useCoachmark } from "../context/CoachmarkContext";
import type { CoachmarkStepId } from "../src/services/coachmarkService";

type Props = ViewProps & {
  stepId: CoachmarkStepId;
  children: React.ReactNode;
};

export default function CoachmarkAnchor({
  stepId,
  children,
  style,
  ...viewProps
}: Props) {
  const coachmark = useCoachmark();
  const selfRef = useRef<View>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | null>(null);
  // ✅ Clé : on track quel step a DÉJÀ été mesuré
  // pour ne pas relancer scheduleRetries sur chaque re-render
  const measuredForStepRef = useRef<CoachmarkStepId | null>(null);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const registerRectStable = useRef(coachmark.registerRect);
useEffect(() => {
  registerRectStable.current = coachmark.registerRect;
});

const measure = useCallback(() => {
  const node = selfRef.current;
  if (!node?.measureInWindow) return;

  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    node.measureInWindow((x, y, w, h) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 4 || h <= 4)
        return;
      // ✅ Via ref stable → pas dans les deps → pas de boucle
      registerRectStable.current(stepId, { x, y, w, h });
    });
  });
}, [stepId]); 

  const scheduleRetries = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    measure();
    timersRef.current = [
      setTimeout(measure, 80),
      setTimeout(measure, 300),
      setTimeout(measure, 700),
      setTimeout(measure, 1200),
    ];
  }, [measure]);

  useEffect(() => {
    if (!coachmark.active) {
      // Tour terminé → reset
      measuredForStepRef.current = null;
      return;
    }
    if (coachmark.currentStep !== stepId) return;

    // ✅ GUARD : on ne mesure qu'UNE SEULE FOIS par activation de step
    // Empêche la boucle : registerRect → re-render → useEffect → registerRect
    if (measuredForStepRef.current === stepId) return;
    measuredForStepRef.current = stepId;

    scheduleRetries();
  }, [coachmark.active, coachmark.currentStep, stepId, scheduleRetries]);

  return (
    <View
      ref={selfRef}
      collapsable={false}
      onLayout={() => {
        // onLayout uniquement si pas encore mesuré pour ce step
        if (
          coachmark.active &&
          coachmark.currentStep === stepId &&
          measuredForStepRef.current !== stepId
        ) {
          measuredForStepRef.current = stepId;
          scheduleRetries();
        }
      }}
      style={style}
      {...viewProps}
    >
      {children}
    </View>
  );
}