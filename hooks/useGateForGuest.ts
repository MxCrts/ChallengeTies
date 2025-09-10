// hooks/useGateForGuest.ts
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useVisitor } from "@/context/VisitorContext";

export default function useGateForGuest() {
  const { user } = useAuth();
  const { isGuest } = useVisitor();
  const [visible, setVisible] = useState(false);

  // true si connecté, false sinon
  const canProceed = !!user;

  // À appeler dans onPress : si pas connecté => ouvre modale et bloque
  const gate = () => {
    if (canProceed) return true;
    setVisible(true);
    return false;
  };

  return {
    canProceed,
    isGuest,
    modalVisible: visible,
    openGate: () => setVisible(true),
    closeGate: () => setVisible(false),
    gate,
  };
}
