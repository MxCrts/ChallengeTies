import { useEffect, useMemo } from "react";

type TFn = (key: string, opts?: any) => string;

type Args = {
  invitationModalVisible: boolean;
  inviteLoading: boolean;
  deeplinkBooting: boolean;
  inviteModalReady: boolean;

  setInviteLoading: (v: boolean) => void;
  setDeeplinkBooting: (v: boolean) => void;
  setInviteModalReady: (v: boolean) => void;

  hideRootInviteHandoff: () => void;

  t: TFn;
};

export function useBootOverlay({
  invitationModalVisible,
  inviteLoading,
  deeplinkBooting,
  inviteModalReady,
  setInviteLoading,
  setDeeplinkBooting,
  setInviteModalReady,
  hideRootInviteHandoff,
  t,
}: Args) {
  // ✅ EXACTEMENT ta règle actuelle :
  // "si la modal n'est pas visible, on ne bloque JAMAIS l'écran"
  const showBootOverlay = useMemo(() => {
    if (!invitationModalVisible) return false;
    return !!(inviteLoading || deeplinkBooting);
  }, [invitationModalVisible, inviteLoading, deeplinkBooting]);

  // ✅ label identique à ton fichier
  const loadingLabel = useMemo(() => {
    return inviteLoading || (deeplinkBooting && !inviteModalReady)
      ? t("challengeDetails.loadingInvite", {
          defaultValue: "Ouverture de l’invitation…",
        })
      : t("challengeDetails.loading", {
          defaultValue: "Chargement…",
        });
  }, [inviteLoading, deeplinkBooting, inviteModalReady, t]);

  // ✅ sublabel identique à ton JSX actuel
  const loadingSubLabel = useMemo(() => {
    return inviteLoading
      ? t("challengeDetails.loadingInviteHint", {
          defaultValue: "On prépare ton duo et la page du défi…",
        })
      : t("challengeDetails.loadingHint", {
          defaultValue: "Synchronisation de tes données et du défi…",
        });
  }, [inviteLoading, t]);

  // ✅ failsafe identique (2500ms)
  useEffect(() => {
    if (!showBootOverlay) return;

    const timer = setTimeout(() => {
      setInviteLoading(false);
      setDeeplinkBooting(false);
      setInviteModalReady(true);
      try {
        hideRootInviteHandoff();
      } catch {}
    }, 2500);

    return () => clearTimeout(timer);
  }, [
    showBootOverlay,
    setInviteLoading,
    setDeeplinkBooting,
    setInviteModalReady,
    hideRootInviteHandoff,
  ]);

  return { showBootOverlay, loadingLabel, loadingSubLabel };
}
