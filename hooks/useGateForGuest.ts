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
    () => new Set(["/(tabs)/index", "/(tabs)/explore", "/tips", "/", "/explore"]),
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

    // guest => autorisé seulement sur allowlist
    if (isGuest && to && guestAllowed.has(to)) {
      return true;
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
