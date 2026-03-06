import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { auth, db } from "@/constants/firebase-config";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getUsernameForUser } from "../utils/getUsernameForUser";

type RouterLike = {
  replace: (path: any) => void;
  setParams?: (p: any) => void;
};

type Args = {
  id: string;
  paramsInvite?: string;
  paramsId?: string;
  router: RouterLike;
  cameFromDeeplinkRef: React.MutableRefObject<boolean>;
};

export function useInviteHandoff({
  id,
  paramsInvite,
  paramsId,
  router,
  cameFromDeeplinkRef,
}: Args) {
  // 🆕 si on arrive avec ?invite=... → overlay actif dès le 1er render
  const [deeplinkBooting, setDeeplinkBooting] = useState(() => !!paramsInvite);

  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteModalReady, setInviteModalReady] = useState(false);

  // refs
  const processedInviteIdsRef = useRef<Set<string>>(new Set());
  const inviteOpenGuardRef = useRef(false);
  const suppressInboxInvitesRef = useRef(false);

  // ✅ Root overlay handoff control (single loader)
  const hideRootInviteHandoff = useCallback(() => {
    try {
      (globalThis as any).__HIDE_INVITE_HANDOFF__?.();
    } catch {}
  }, []);

  // ✅ Kill-switch: si on n'est plus en boot deeplink, l'overlay root ne doit JAMAIS bloquer l'UI
  useEffect(() => {
    if (!inviteLoading && !deeplinkBooting) {
      try {
        (globalThis as any).__HIDE_INVITE_HANDOFF__?.();
      } catch {}
    }
  }, [inviteLoading, deeplinkBooting]);

  // ✅ Dès que le modal d'invitation est prêt/affiché => on coupe l’overlay global
  useEffect(() => {
    if (!invitationModalVisible) return;
    if (!inviteModalReady) return;
    hideRootInviteHandoff();
    setInviteLoading(false);
    setDeeplinkBooting(false);
  }, [invitationModalVisible, inviteModalReady, hideRootInviteHandoff]);

  // ✅ Hard stop : après fermeture du modal, rien ne doit bloquer l'écran
  useEffect(() => {
    if (invitationModalVisible) return;
    setInviteLoading(false);
    setDeeplinkBooting(false);
    try {
      hideRootInviteHandoff();
    } catch {}
  }, [invitationModalVisible, hideRootInviteHandoff]);

  // ✅ Anti double-open inbox quand on arrive via ?invite=
  useEffect(() => {
    if (!paramsInvite) return;
    suppressInboxInvitesRef.current = true;
    const t = setTimeout(() => {
      suppressInboxInvitesRef.current = false;
    }, 4000);
    return () => clearTimeout(t);
  }, [paramsInvite]);

  const markInviteAsHandled = useCallback((inviteId?: string | null) => {
    if (!inviteId) return;
    processedInviteIdsRef.current.add(inviteId);
    setInvitation((prev) => (prev?.id === inviteId ? null : prev));
  }, []);

  // ✅ Nettoyage param invite sans casser la stack (si possible)
  const clearInviteParam = useCallback(() => {
    try {
      // @ts-ignore expo-router récent
      router.setParams?.({ invite: undefined });
      return;
    } catch {}

    try {
      if (id) router.replace(`/challenge-details/${id}` as any);
    } catch {}
  }, [router, id]);

  // ✅ Close atomique : ferme modal + coupe tous les overlays deeplink + marque l'invite
  const closeInviteFlow = useCallback(
    (handledId?: string | null) => {
      const toHandle = handledId ?? invitation?.id ?? paramsInvite ?? null;

      // 1) stop blocking states FIRST
      setInviteLoading(false);
      setDeeplinkBooting(false);
      try {
        hideRootInviteHandoff();
      } catch {}

      // 2) mark handled to prevent re-open
      try {
        markInviteAsHandled(toHandle);
      } catch {}

      // 3) close + cleanup
      setInvitationModalVisible(false);
      setInvitation(null);
      setInviteModalReady(true);

      // 4) remove param / clean URL
      try {
        clearInviteParam();
      } catch {}
    },
    [
      invitation?.id,
      paramsInvite,
      hideRootInviteHandoff,
      markInviteAsHandled,
      clearInviteParam,
    ]
  );

  const openFromParamOrUrl = useCallback(
    async (inviteParam?: string) => {
      const idStr = String(inviteParam || "").trim();
      if (!idStr) return;
      if (processedInviteIdsRef.current.has(idStr)) return;
      if (inviteOpenGuardRef.current) return;

      cameFromDeeplinkRef.current = true;

      // 🆕 On annonce qu'on boot via deeplink d'invit
      setDeeplinkBooting(true);
      setInviteLoading(true);
      inviteOpenGuardRef.current = true;

      // 🆕 Flag pour savoir si on va VRAIMENT afficher le modal
      let willShowModal = false;

      const liveUid = auth.currentUser?.uid || null;

      // Pas connecté → login + redirect + invite
      if (!liveUid) {
        try {
          const redirectTarget = `/challenge-details/${paramsId || id}`;
          const redirect = encodeURIComponent(redirectTarget);
          router.replace(
            `/login?redirect=${redirect}&invite=${encodeURIComponent(idStr)}` as any
          );
        } catch (e) {
          console.warn("[invite] redirect to login failed:", e);
        } finally {
          inviteOpenGuardRef.current = false;
          setInviteLoading(false);
          setDeeplinkBooting(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, "invitations", idStr));
        if (!snap.exists()) {
          console.warn("[invite] invitation doc inexistant pour id =", idStr);
          return;
        }

        let data = snap.data() as any;

        if (data.status !== "pending") {
          console.warn("[invite] invitation non pending, statut =", data.status);
          return;
        }

        if (data.inviterId === liveUid) {
          console.warn("[invite] user est l'inviteur, ignore le lien");
          return;
        }

        // direct invite
        if (data.kind !== "open") {
          if (data.inviteeId !== liveUid) {
            console.warn("[invite] doc ne concerne pas ce user (direct invite)");
            return;
          }
        } else {
          // open invite
          if (data.inviteeId && data.inviteeId !== liveUid) {
            console.warn("[invite] open invite déjà prise par un autre user");
            return;
          }

          if (!data.inviteeId) {
            const inviteeUsername = liveUid ? await getUsernameForUser(liveUid) : null;

            try {
              await runTransaction(db, async (tx) => {
                const ref = doc(db, "invitations", idStr);
                const snap2 = await tx.get(ref);
                if (!snap2.exists()) throw new Error("invite_not_found");

                const d2 = snap2.data() as any;
                if (d2.status !== "pending") throw new Error("not_pending");

                if (d2.inviteeId && d2.inviteeId !== liveUid) {
                  throw new Error("already_taken");
                }

                tx.update(ref, {
                  inviteeId: liveUid,
                  inviteeUsername: inviteeUsername || null,
                  updatedAt: serverTimestamp(),
                });
              });

              // refresh after claim
              try {
                const freshSnap = await getDoc(doc(db, "invitations", idStr));
                if (freshSnap.exists()) data = freshSnap.data() as any;
              } catch (e) {
                console.warn("[invite] refresh invitation after claim failed:", e);
              }
            } catch (e) {
              console.warn("[invite] claim open invite failed:", e);
              return;
            }
          }
        }

        // redirect other challenge
        if (data.challengeId && data.challengeId !== id) {
          try {
            router.replace(
              `/challenge-details/${data.challengeId}?invite=${encodeURIComponent(idStr)}` as any
            );
          } catch (e) {
            console.warn("[invite] redirect vers bon challenge échoué:", e);
          } finally {
            inviteOpenGuardRef.current = false;
            setInviteLoading(false);
            setDeeplinkBooting(false);
          }
          return;
        }

        // open modal once
// ✅ Délai minimum pour que les phases 1→2→3 de l'overlay soient visibles
// même quand Firestore répond depuis le cache (< 100ms)
const BOOT_OVERLAY_MIN_MS = 1200;
const elapsed = Date.now() - (
  // on récupère le ts du boot depuis le global state
  (globalThis as any).__INVITE_BOOT__?.ts || Date.now()
);
if (elapsed < BOOT_OVERLAY_MIN_MS) {
  await new Promise<void>((r) => setTimeout(r, BOOT_OVERLAY_MIN_MS - elapsed));
}

processedInviteIdsRef.current.add(idStr);
setInvitation({ id: idStr });
setInviteModalReady(false);
setInvitationModalVisible(true);
willShowModal = true;

        // clean URL
        try {
          if (id) router.replace(`/challenge-details/${id}` as any);
        } catch (e) {
          console.warn("[invite] cleanUrl failed:", e);
        }
      } catch (e) {
        console.error("❌ openFromParamOrUrl failed:", e);
      } finally {
        inviteOpenGuardRef.current = false;
        if (!willShowModal) {
          setInviteLoading(false);
          setDeeplinkBooting(false);
        }
      }
    },
    [id, paramsId, router, cameFromDeeplinkRef]
  );

  // ✅ Réagit UNIQUEMENT au param expo-router (?invite=...)
  useEffect(() => {
    if (!paramsInvite) return;
    openFromParamOrUrl(String(paramsInvite));
  }, [paramsInvite, openFromParamOrUrl]);

  // petit helper exposé (tu l’utilises déjà ailleurs)
  const isHandoffBlocking = inviteLoading || deeplinkBooting;

  return {
    // state
    deeplinkBooting,
    inviteLoading,
    inviteModalReady,
    invitationModalVisible,
    invitation,

    // setters (pour garder ton code JSX inchangé)
    setDeeplinkBooting,
    setInviteLoading,
    setInviteModalReady,
    setInvitationModalVisible,
    setInvitation,

    // refs
    processedInviteIdsRef,
    suppressInboxInvitesRef,

    // actions
    closeInviteFlow,
    hideRootInviteHandoff,
    clearInviteParam,
    markInviteAsHandled,
    isHandoffBlocking,
  };
}
