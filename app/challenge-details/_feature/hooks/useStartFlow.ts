import { useCallback, useState } from "react";
import { Alert } from "react-native";

type TFn = (key: string, opts?: any) => string;

type OutgoingPendingInvite = { id: string; inviteeUsername?: string | null } | null;

type Args = {
  id: string;
  challengeTakenOptimistic: boolean;
  isDuoPendingOut: boolean;
  isOffline: boolean;
  t: TFn;

  // state outside (utilisés ailleurs dans l’écran)
  setPendingOutLock: (v: boolean) => void;
  setOutgoingPendingInvite: (updater: any) => void;
  setSendInviteVisible: (v: boolean) => void;

  // action SOLO existante
  handleTakeChallenge: () => Promise<void>;
};

export function useStartFlow({
  id,
  challengeTakenOptimistic,
  isDuoPendingOut,
  isOffline,
  t,
  setPendingOutLock,
  setOutgoingPendingInvite,
  setSendInviteVisible,
  handleTakeChallenge,
}: Args) {
  // ✅ états déplacés du screen
  const [startModeVisible, setStartModeVisible] = useState(false);
  const [startMode, setStartMode] = useState<"solo" | "duo" | null>(null);
  const [durationModalVisible, setDurationModalVisible] = useState(false);

  const openStartFlow = useCallback(() => {
    if (challengeTakenOptimistic || !id) return;
    if (isDuoPendingOut) return;

    setStartMode(null);
    setStartModeVisible(true);
  }, [challengeTakenOptimistic, id, isDuoPendingOut]);

  const pickModeThenOpenDuration = useCallback((mode: "solo" | "duo") => {
    setStartMode(mode);
    setStartModeVisible(false);
    setDurationModalVisible(true);
  }, []);

  const cancelDuration = useCallback(() => {
    setDurationModalVisible(false);
    setStartModeVisible(true);
  }, []);

  const handleConfirmDurationByMode = useCallback(async () => {
    // ⚠️ tu faisais ça : on ferme d’abord pour éviter double overlays
    setDurationModalVisible(false);

    if (startMode === "duo") {
      if (isOffline) {
        Alert.alert(
          t("common.networkError"),
          t("firstPick.offlineDuo", {
            defaultValue: "Connecte-toi à Internet pour inviter un ami en duo.",
          })
        );
        return;
      }

      // Optimiste : lock pending out immédiat
      setPendingOutLock(true);
      setOutgoingPendingInvite((prev: OutgoingPendingInvite) =>
        prev ?? { id: "__optimistic__", inviteeUsername: null }
      );

      // ouvre ton modal existant d’invite
      setSendInviteVisible(true);
      return;
    }

    // SOLO = flow normal inchangé
    await handleTakeChallenge();
  }, [
    startMode,
    isOffline,
    t,
    setPendingOutLock,
    setOutgoingPendingInvite,
    setSendInviteVisible,
    handleTakeChallenge,
  ]);

  return {
    // state
    startModeVisible,
    startMode,
    durationModalVisible,

    // setters (pour fermer depuis ailleurs si besoin)
    setStartModeVisible,
    setStartMode,
    setDurationModalVisible,

    // handlers
    openStartFlow,
    pickModeThenOpenDuration,
    handleConfirmDurationByMode,
    cancelDuration,
  };
}
