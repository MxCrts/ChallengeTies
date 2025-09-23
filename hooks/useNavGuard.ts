// src/hooks/useNavGuard.ts
import { useRef } from "react";
import { Router } from "expo-router";

export function useNavGuard(router: Router, cooldownMs = 700) {
  const last = useRef(0);
  function canNavigate(key?: string) {
    const now = Date.now();
    if (now - last.current < cooldownMs) return false;
    last.current = now;
    return true;
  }
  return {
    replace: (path: string) => { if (canNavigate(path)) router.replace(path); },
    push:    (path: string) => { if (canNavigate(path)) router.push(path); },
    back:    () => { if (canNavigate("back")) router.back(); },
    canNavigate,
  };
}
