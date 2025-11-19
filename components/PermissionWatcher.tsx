// src/components/PermissionWatcher.tsx  (ou services/components selon ton arbo)
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useTutorial } from "@/context/TutorialContext";
import {
  markValueSeen,
  maybeRequestLocationAfterValue,
  maybeRequestPushAfterValue,
} from "@/services/PermissionOrchestrator";

const PermissionWatcher: React.FC = () => {
  // ✅ Appel inconditionnel du hook
  const { isTutorialActive } = useTutorial();

  const wasActiveRef = useRef<boolean>(isTutorialActive);
  const askedOnceRef = useRef<boolean>(false);

  // Détecte la fin du tuto → one-shot permissions
  useEffect(() => {
    if (wasActiveRef.current && !isTutorialActive && !askedOnceRef.current) {
      askedOnceRef.current = true;

      (async () => {
        try { await markValueSeen(); } catch {}

        setTimeout(async () => {
          try { await maybeRequestPushAfterValue(); } catch {}
          try { await maybeRequestLocationAfterValue(); } catch {}
        }, 800);
      })();
    }
    wasActiveRef.current = isTutorialActive;
  }, [isTutorialActive]);

  // En revenant foreground, retente (idempotent côté service)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        maybeRequestPushAfterValue().catch(() => {});
        maybeRequestLocationAfterValue().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return null;
};

export default PermissionWatcher;
