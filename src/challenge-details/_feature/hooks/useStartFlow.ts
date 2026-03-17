// hooks/useStartFlow.ts
// ✅ Modifié pour intégrer ChoixDuoModal (invite ami vs trouver binôme)
// Logique existante 100% intacte

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

  setPendingOutLock: (v: boolean) => void;
  setOutgoingPendingInvite: (updater: any) => void;
  setSendInviteVisible: (v: boolean) => void;

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
  const [startModeVisible, setStartModeVisible] = useState(false);
  const [startMode, setStartMode] = useState<"solo" | "duo" | null>(null);
  const [durationModalVisible, setDurationModalVisible] = useState(false);

  // ✅ NOUVEAU : choix duo (inviter ami vs trouver binôme)
  const [choixDuoVisible, setChoixDuoVisible] = useState(false);

  // ✅ NOUVEAU : matching modal
  const [matchingVisible, setMatchingVisible] = useState(false);

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
    setDurationModalVisible(false);

    if (startMode === "duo") {
      if (isOffline) {
        Alert.alert(
          t("common.networkError"),
          t("firstPick.offlineDuo", {
            defaultValue: "Connecte-toi à Internet pour inviter en duo.",
          })
        );
        return;
      }

      // ✅ NOUVEAU : ouvre ChoixDuoModal au lieu de SendInvitationModal directement
      setChoixDuoVisible(true);
      return;
    }

    // SOLO = flow normal inchangé
    await handleTakeChallenge();
  }, [startMode, isOffline, t, handleTakeChallenge]);

  // ✅ NOUVEAU : User choisit "Inviter un ami" → SendInvitationModal (inchangé)
  const handleChoixInviteFriend = useCallback(() => {
    setChoixDuoVisible(false);

    // Même logique que l'ancien handleConfirmDurationByMode mode duo
    setPendingOutLock(true);
    setOutgoingPendingInvite((prev: OutgoingPendingInvite) =>
      prev ?? { id: "__optimistic__", inviteeUsername: null }
    );
    setSendInviteVisible(true);
  }, [setPendingOutLock, setOutgoingPendingInvite, setSendInviteVisible]);

  // ✅ NOUVEAU : User choisit "Trouver un binôme" → MatchingModal
  const handleChoixFindPartner = useCallback(() => {
    setChoixDuoVisible(false);
    setMatchingVisible(true);
  }, []);

  // ✅ NOUVEAU : Invitation matching envoyée avec succès
  const handleMatchingInviteSent = useCallback((inviteeUsername: string) => {
    setMatchingVisible(false);

    // Optimiste : on lock pending out pour feedback UI
    setPendingOutLock(true);
    setOutgoingPendingInvite((prev: OutgoingPendingInvite) =>
      prev ?? { id: "__optimistic_matching__", inviteeUsername }
    );

    Alert.alert(
      t("matching.sentTitle", { defaultValue: "Invitation envoyée ! 🎯" }),
      t("matching.sentBody", {
        username: inviteeUsername,
        defaultValue: `${inviteeUsername} recevra une notification. On te prévient dès qu'il accepte.`,
      })
    );
  }, [setPendingOutLock, setOutgoingPendingInvite, t]);

  return {
    // state existant (inchangé)
    startModeVisible,
    startMode,
    durationModalVisible,

    // ✅ NOUVEAU
    choixDuoVisible,
    matchingVisible,

    // setters existants (inchangés)
    setStartModeVisible,
    setStartMode,
    setDurationModalVisible,

    // ✅ NOUVEAU setters
    setChoixDuoVisible,
    setMatchingVisible,

    // handlers existants (inchangés)
    openStartFlow,
    pickModeThenOpenDuration,
    handleConfirmDurationByMode,
    cancelDuration,

    // ✅ NOUVEAU handlers
    handleChoixInviteFriend,
    handleChoixFindPartner,
    handleMatchingInviteSent,
  };
}
