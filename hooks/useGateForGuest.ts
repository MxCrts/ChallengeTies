// hooks/useGateForGuest.ts
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useVisitor } from "@/context/VisitorContext";

type GateReason = string | undefined;

export default function useGateForGuest() {
  const { user } = useAuth();
  const { isGuest, hydrated } = useVisitor();

  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<GateReason>(undefined);
  const [pendingTo, setPendingTo] = useState<string | undefined>(undefined);

  // ✅ connecté => full accès
  const canProceed = !!user;

  // ✅ routes autorisées pour guest
  const guestAllowed = useMemo(
    () => new Set([
      // ✅ existant
      "/(tabs)/index", "/(tabs)/explore", "/tips", "/", "/explore",
      // ✅ nouveau — lecture seule, pas de sauvegarde possible sans compte
      "/(tabs)/focus",          // Exploits/Feed — preuve sociale
      "/leaderboard",           // Classement — en lecture
    ]),
    []
  );

  /**
   * gate(to?, reason?)
   * - return true => navigation autorisée
   * - return false => bloquée + modal
   */
  const gate = (to?: string, why?: string) => {
    if (!hydrated) return false; // évite tout flicker avant hydration

    if (canProceed) return true;

    // guest => autorisé seulement sur allowlist + challenge-details en lecture
    if (isGuest && to) {
      if (guestAllowed.has(to)) return true;
      if (to.startsWith("/challenge-details/")) return true;
      if (to.startsWith("/challenge-helper/")) return true;
    }

    // sinon => bloque
    setPendingTo(to);
    setReason(why);
    setVisible(true);
    return false;
  };

  return {
    canProceed,
    isGuest,
    hydrated,
    modalVisible: visible,
    closeGate: () => setVisible(false),

    // pour usages spécifiques si besoin
    openGate: (why?: string) => {
      setReason(why);
      setVisible(true);
    },

    // la fonction principale
    gate,

    // exposé si tu veux rediriger ensuite
    pendingTo,
    reason,
  };
}
