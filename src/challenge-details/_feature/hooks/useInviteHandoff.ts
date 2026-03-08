import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── Minimum display time for boot overlay (all 3 phases must be visible) ───
// This guarantees the user sees the cinematic sequence even on fast connections
const BOOT_OVERLAY_MIN_MS = 1800;

export function useInviteHandoff({
  id,
  paramsInvite,
  paramsId,
  router,
  cameFromDeeplinkRef,
}: Args) {
  // If we arrive with ?invite=... → overlay is active from first render
  const [deeplinkBooting, setDeeplinkBooting] = useState(() => !!paramsInvite);

  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteModalReady, setInviteModalReady] = useState(false);

  // ─── NEW: tracks whether the Modal has been confirmed visible on-screen ───
  // Set to true by InvitationModal via onModalVisible() callback
  // Only THEN do we allow inviteBootOff()
  const [modalConfirmedVisible, setModalConfirmedVisible] = useState(false);

  // refs
  const processedInviteIdsRef = useRef<Set<string>>(new Set());
  const inviteOpenGuardRef = useRef(false);
  const suppressInboxInvitesRef = useRef(false);
  const willShowModalRef = useRef(false);

  // ─── Tracks the boot start timestamp (for min display enforcement) ───────
  const bootStartTsRef = useRef<number>(0);

  // ─── Root overlay handoff control ────────────────────────────────────────
  const hideRootInviteHandoff = useCallback(() => {
    try {
      (globalThis as any).__HIDE_INVITE_HANDOFF__?.();
    } catch {}
  }, []);

  // ─── Kill-switch: if no longer booting, release overlay ──────────────────
  useEffect(() => {
    if (!inviteLoading && !deeplinkBooting) {
      try { (globalThis as any).__HIDE_INVITE_HANDOFF__?.(); } catch {}
    }
  }, [inviteLoading, deeplinkBooting]);

  // ─── FIX: only cut overlay AFTER Modal is confirmed visible on screen ────
  // This is the core fix for the "overlay cuts too early" race condition.
  // Previously: inviteBootOff() was called in load() finally → before React re-render
  // Now: we wait for modalConfirmedVisible = true (set by InvitationModal.onModalVisible)
  useEffect(() => {
    if (!modalConfirmedVisible) return;

    // Modal IS visible on screen → safe to cut overlay now
    const elapsed = Date.now() - bootStartTsRef.current;
    const remaining = Math.max(0, BOOT_OVERLAY_MIN_MS - elapsed);

    const t = setTimeout(() => {
      try { (globalThis as any).__INVITE_BOOT_OFF__?.(); } catch {}
      try { hideRootInviteHandoff(); } catch {}
      setInviteLoading(false);
      setDeeplinkBooting(false);
      // reset for next use
      setModalConfirmedVisible(false);
    }, remaining);

    return () => clearTimeout(t);
  }, [modalConfirmedVisible, hideRootInviteHandoff]);

  // ─── Hard stop: after modal closes, nothing should block screen ──────────
  useEffect(() => {
  if (invitationModalVisible) {
    return; // ← juste return, on ne touche PLUS au ref
  }
  if (willShowModalRef.current) return;
  setInviteLoading(false);
  setDeeplinkBooting(false);
  setModalConfirmedVisible(false);
  try { hideRootInviteHandoff(); } catch {}
}, [invitationModalVisible, hideRootInviteHandoff]);

  // ─── Suppress inbox invites when arriving via ?invite= ───────────────────
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

  // ─── Clean invite param without breaking the stack ───────────────────────
  const clearInviteParam = useCallback(() => {
    try {
      router.setParams?.({ invite: undefined });
      return;
    } catch {}
    try {
      if (id) router.replace(`/challenge-details/${id}` as any);
    } catch {}
  }, [router, id]);

  // ─── Atomic close: close modal + cut all deeplink overlays ───────────────
  const closeInviteFlow = useCallback(
    (handledId?: string | null) => {
      const toHandle = handledId ?? invitation?.id ?? paramsInvite ?? null;

      setInviteLoading(false);
      setDeeplinkBooting(false);
      setModalConfirmedVisible(false);
      try { hideRootInviteHandoff(); } catch {}
      try { (globalThis as any).__INVITE_BOOT_OFF__?.(); } catch {}

      try { markInviteAsHandled(toHandle); } catch {}

      setInvitationModalVisible(false);
      setInvitation(null);
      setInviteModalReady(true);

      try { clearInviteParam(); } catch {}
    },
    [
      invitation?.id,
      paramsInvite,
      hideRootInviteHandoff,
      markInviteAsHandled,
      clearInviteParam,
    ]
  );

  // ─── Callback for InvitationModal to signal it is on-screen ─────────────
  // InvitationModal calls this when its Modal component fires onShow
  const signalModalVisible = useCallback(() => {
    setModalConfirmedVisible(true);
  }, []);

  // ─── Main flow: open from deeplink param ─────────────────────────────────
  const openFromParamOrUrl = useCallback(
    async (inviteParam?: string) => {
      const idStr = String(inviteParam || "").trim();
      if (!idStr) return;
      if (processedInviteIdsRef.current.has(idStr)) return;
      if (inviteOpenGuardRef.current) return;

      cameFromDeeplinkRef.current = true;

      // Record boot start time (for min display enforcement)
      bootStartTsRef.current = Date.now();

      setDeeplinkBooting(true);
      setInviteLoading(true);
      inviteOpenGuardRef.current = true;

      let willShowModal = false;

      const liveUid = auth.currentUser?.uid || null;

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
        // ─── Phase 1: Fetch invitation doc ───────────────────────────────
        // Phase is already at 1 from inviteBootOn() in DeepLinkManager
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

        // Direct invite check
        if (data.kind !== "open") {
          if (data.inviteeId !== liveUid) {
            console.warn("[invite] doc ne concerne pas ce user (direct invite)");
            return;
          }
        } else {
          // Open invite
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

              // Refresh after claim
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

        // ─── Phase 2: challenge redirect if needed ────────────────────────
        // Signal phase 2 (challenge loading)
        try {
          const g = globalThis as any;
          if (typeof g.__INVITE_BOOT_SET_PHASE__ === "function") {
            g.__INVITE_BOOT_SET_PHASE__(2);
          }
        } catch {}

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

        // ─── All checks passed → open modal ──────────────────────────────
        processedInviteIdsRef.current.add(idStr);
        setInvitation({ id: idStr });
        setInviteModalReady(false);
        // Arm ref BEFORE setState to block the useEffect prematurely
        willShowModalRef.current = true;
        setInvitationModalVisible(true);
        willShowModal = true;

        // Clean URL
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
          // No modal to show → safe to cut overlay
          setInviteLoading(false);
          setDeeplinkBooting(false);
          try { (globalThis as any).__INVITE_BOOT_OFF__?.(); } catch {}
        }
        // If willShowModal=true, overlay stays up until signalModalVisible() is called
      }
    },
    [id, paramsId, router, cameFromDeeplinkRef]
  );

  // ─── React to expo-router ?invite= param ─────────────────────────────────
  useEffect(() => {
    if (!paramsInvite) return;
    openFromParamOrUrl(String(paramsInvite));
  }, [paramsInvite, openFromParamOrUrl]);

  const isHandoffBlocking = inviteLoading || deeplinkBooting;

  return {
    // state
    deeplinkBooting,
    inviteLoading,
    inviteModalReady,
    invitationModalVisible,
    invitation,

    // setters
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

    // ─── NEW: signal that Modal is visually on-screen ───────────────────
    signalModalVisible,
  };
}
