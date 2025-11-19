// src/hooks/useMicroWeek.ts
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTrophiesEconomy } from "./useTrophiesEconomy";

/**
 * Hook simple pour lire la “banque micro” hebdo et être notifié en temps réel.
 * - Charge la valeur au mount et à chaque focus d’écran
 * - Mets à jour instantanément quand incMicroWeek() est appelé (DeviceEventEmitter)
 */
export function useMicroWeek() {
  const { getMicroWeek, MICRO_WEEK_UPDATED_EVENT } = useTrophiesEconomy();
  const [used, setUsed] = useState<number>(0);
  const [key, setKey] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const bank = await getMicroWeek();
      setUsed(Number(bank.used || 0));
      setKey(bank.key);
    } catch {
      // silent
    }
  }, [getMicroWeek]);

  // 1) Chargement initial + refresh à chaque focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // 2) Écoute des updates (incMicroWeek émet l’event)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      MICRO_WEEK_UPDATED_EVENT,
      (p?: { key?: string; used?: number }) => {
        if (p && typeof p.used === "number") {
          setUsed(p.used);
          if (typeof p.key === "string") setKey(p.key);
        } else {
          // Fallback optimiste si payload absent
          setUsed((u) => u + 1);
        }
      }
    );
    return () => sub.remove();
  }, [MICRO_WEEK_UPDATED_EVENT]);

  return { used, key, refresh };
}
