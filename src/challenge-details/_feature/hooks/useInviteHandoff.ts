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

// ─── Minimum display time for boot overlay ───────────────────────────────────
// Guarantees the user sees all 3 phases even on fast connections
const BOOT_OVERLAY_MIN_MS = 2000;

// ─── How long to wait for Firebase Auth to hydrate on iOS ────────────────────
// iOS cold-start: Firebase Auth state is async, currentUser is null for ~300-800ms
const AUTH_HYDRATION_WAIT_MS = 1200;
const AUTH_HYDRATION_POLL_INTERVAL_MS = 80;

// ─── How long before we hard-kill the overlay (safety net) ───────────────────
const OVERLAY_HARD_KILL_MS = 9000;

/**
 * Waits for Firebase Auth to hydrate on iOS.
 * On cold-start, auth.currentUser is null even if the user is logged in.
 * We poll until we get a uid OR the timeout expires.
 */
async function waitForAuthUid(
  maxMs = AUTH_HYDRATION_WAIT_MS
): Promise<string | null> {
  // Fast path: already hydrated
  if (auth.currentUser?.uid) return auth.currentUser.uid;

  const start = Date.now();
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        clearInterval(interval);
        resolve(uid);
        return;
      }
      if (Date.now() - start >= maxMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, AUTH_HYDRATION_POLL_INTERVAL_MS);
  });
}

export function useInviteHandoff({
  id,
  paramsInvite,
  paramsId,
  router,
  cameFromDeeplinkRef,
}: Args) {
  // ─── Core states ──────────────────────────────────────────────────────────
  // If we arrive with ?invite=... → overlay is active from first render
  const [deeplinkBooting, setDeeplinkBooting] = useState(() => !!paramsInvite);
  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteModalReady, setInviteModalReady] = useState(false);

  // ─── Tracks whether Modal.onShow has fired on-screen ─────────────────────
  // Set to true by InvitationModal via onModalVisible() callback (from Modal.onShow)
  // Only AFTER this do we allow inviteBootOff()
  const [modalConfirmedVisible, setModalConfirmedVisible] = useState(false);

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const processedInviteIdsRef = useRef<Set<string>>(new Set());
  const inviteOpenGuardRef = useRef(false);
  const suppressInboxInvitesRef = useRef(false);
  const willShowModalRef = useRef(false);

  // Tracks the boot start timestamp (for min display enforcement)
  const bootStartTsRef = useRef<number>(0);

  // Hard kill timer ref (safety net overlay)
  const hardKillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Root overlay handoff control ─────────────────────────────────────────
  const hideRootInviteHandoff = useCallback(() => {
    try { (globalThis as any).__HIDE_INVITE_HANDOFF__?.(); } catch {}
  }, []);

  const forceKillOverlay = useCallback(() => {
    try { (globalThis as any).__INVITE_BOOT_OFF__?.(); } catch {}
    try { hideRootInviteHandoff(); } catch {}
  }, [hideRootInviteHandoff]);

  // ─── Cleanup hard kill timer on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (hardKillTimerRef.current) clearTimeout(hardKillTimerRef.current);
    };
  }, []);

  // ─── Kill-switch: if no longer booting, release overlay ───────────────────
  useEffect(() => {
    if (!inviteLoading && !deeplinkBooting) {
      forceKillOverlay();
    }
  }, [inviteLoading, deeplinkBooting, forceKillOverlay]);

  // ─── FIX: only cut overlay AFTER Modal is confirmed visible on screen ──────
  // This is the core fix for the "overlay cuts too early" race condition.
  // We wait for modalConfirmedVisible = true, then respect the min display time.
  useEffect(() => {
    if (!modalConfirmedVisible) return;

    const elapsed = Date.now() - bootStartTsRef.current;
    const remaining = Math.max(0, BOOT_OVERLAY_MIN_MS - elapsed);

    const t = setTimeout(() => {
      forceKillOverlay();
      setInviteLoading(false);
      setDeeplinkBooting(false);
      setModalConfirmedVisible(false);
    }, remaining);

    return () => clearTimeout(t);
  }, [modalConfirmedVisible, forceKillOverlay]);

  // ─── Hard stop: after modal closes, nothing should block the screen ────────
  useEffect(() => {
    if (invitationModalVisible) return;
    if (willShowModalRef.current) return;
    setInviteLoading(false);
    setDeeplinkBooting(false);
    setModalConfirmedVisible(false);
    forceKillOverlay();
  }, [invitationModalVisible, forceKillOverlay]);

  // ─── Suppress inbox invites when arriving via ?invite= ────────────────────
  useEffect(() => {
    if (!paramsInvite) return;
    suppressInboxInvitesRef.current = true;
    const t = setTimeout(() => {
      suppressInboxInvitesRef.current = false;
    }, 5000);
    return () => clearTimeout(t);
  }, [paramsInvite]);

  // ─── Clean invite param without breaking the stack ────────────────────────
  const clearInviteParam = useCallback(() => {
    try {
      router.setParams?.({ invite: undefined });
      return;
    } catch {}
    try {
      if (id) router.replace(`/challenge-details/${id}` as any);
    } catch {}
  }, [router, id]);

  const markInviteAsHandled = useCallback((inviteId?: string | null) => {
    if (!inviteId) return;
    processedInviteIdsRef.current.add(inviteId);
    setInvitation((prev) => (prev?.id === inviteId ? null : prev));
  }, []);

  // ─── Atomic close: close modal + cut all deeplink overlays ────────────────
  const closeInviteFlow = useCallback(
    (handledId?: string | null) => {
      const toHandle = handledId ?? invitation?.id ?? paramsInvite ?? null;

      setInviteLoading(false);
      setDeeplinkBooting(false);
      setModalConfirmedVisible(false);
      forceKillOverlay();

      markInviteAsHandled(toHandle);

      setInvitationModalVisible(false);
      setInvitation(null);
      setInviteModalReady(true);
      willShowModalRef.current = false;

      clearInviteParam();
    },
    [
      invitation?.id,
      paramsInvite,
      forceKillOverlay,
      markInviteAsHandled,
      clearInviteParam,
    ]
  );

  // ─── Callback for InvitationModal to signal it is visually on-screen ──────
  // InvitationModal calls this when Modal.onShow fires
  const signalModalVisible = useCallback(() => {
    setModalConfirmedVisible(true);
  }, []);

  // ─── Main flow: open from deeplink param ──────────────────────────────────
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

      // ─── Hard kill safety net ──────────────────────────────────────────
      // If something goes wrong, we never leave the user stuck
      if (hardKillTimerRef.current) clearTimeout(hardKillTimerRef.current);
      hardKillTimerRef.current = setTimeout(() => {
        console.warn("[invite] hard kill overlay after timeout");
        inviteOpenGuardRef.current = false;
        willShowModalRef.current = false;
        setInviteLoading(false);
        setDeeplinkBooting(false);
        forceKillOverlay();
      }, OVERLAY_HARD_KILL_MS);

      let willShowModal = false;

      try {
        // ─── Phase 1: Wait for Firebase Auth to hydrate (iOS fix) ─────────
        // On iOS cold-start, auth.currentUser is null even when logged in.
        // We poll up to AUTH_HYDRATION_WAIT_MS before giving up.
        const liveUid = await waitForAuthUid(AUTH_HYDRATION_WAIT_MS);

        if (!liveUid) {
          // Genuinely not logged in → redirect to login
          try {
            const redirectTarget = `/challenge-details/${paramsId || id}`;
            const redirect = encodeURIComponent(redirectTarget);
            router.replace(
              `/login?redirect=${redirect}&invite=${encodeURIComponent(idStr)}` as any
            );
          } catch (e) {
            console.warn("[invite] redirect to login failed:", e);
          }
          return;
        }

        // ─── Phase 1 confirmed: Fetch invitation doc ───────────────────────
        const snap = await getDoc(doc(db, "invitations", idStr));
        if (!snap.exists()) {
          console.warn("[invite] invitation doc not found for id =", idStr);
          return;
        }

        let data = snap.data() as any;

        if (data.status !== "pending") {
          console.warn("[invite] invitation not pending, status =", data.status);
          return;
        }

        if (data.inviterId === liveUid) {
          console.warn("[invite] user is the inviter, ignoring link");
          return;
        }

        // Direct invite: check recipient matches
        if (data.kind !== "open") {
          if (data.inviteeId !== liveUid) {
            console.warn("[invite] direct invite not for this user");
            return;
          }
        } else {
          // Open invite: claim if unclaimed
          if (data.inviteeId && data.inviteeId !== liveUid) {
            console.warn("[invite] open invite already taken by another user");
            return;
          }

          if (!data.inviteeId) {
            const inviteeUsername = await getUsernameForUser(liveUid).catch(() => null);

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
                console.warn("[invite] refresh after claim failed:", e);
              }
            } catch (e) {
              console.warn("[invite] claim open invite failed:", e);
              return;
            }
          }
        }

        // ─── Phase 2: challenge redirect if needed ─────────────────────────
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
            console.warn("[invite] redirect to correct challenge failed:", e);
          }
          // Note: overlay stays active, will be managed by the new screen
          return;
        }

        // ─── All checks passed → advance to phase 3, open modal ───────────
        try {
          const g = globalThis as any;
          if (typeof g.__INVITE_BOOT_SET_PHASE__ === "function") {
            g.__INVITE_BOOT_SET_PHASE__(3);
          }
        } catch {}

        processedInviteIdsRef.current.add(idStr);
        setInvitation({ id: idStr });
        setInviteModalReady(false);

        // Arm ref BEFORE setState to prevent the useEffect from cutting too early
        willShowModalRef.current = true;
        setInvitationModalVisible(true);
        willShowModal = true;

        // Clean URL param without re-navigating
        try { clearInviteParam(); } catch {}

      } catch (e) {
        console.error("❌ openFromParamOrUrl failed:", e);
      } finally {
        inviteOpenGuardRef.current = false;
        if (hardKillTimerRef.current) {
          clearTimeout(hardKillTimerRef.current);
          hardKillTimerRef.current = null;
        }
        if (!willShowModal) {
          // Nothing to show → immediately release overlay
          setInviteLoading(false);
          setDeeplinkBooting(false);
          forceKillOverlay();
        }
        // If willShowModal=true: overlay stays until signalModalVisible() fires
      }
    },
    [id, paramsId, router, cameFromDeeplinkRef, forceKillOverlay, clearInviteParam]
  );

  // ─── React to expo-router ?invite= param ──────────────────────────────────
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

    // setters (needed by challenge-details to override from outside)
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

    // Signal that Modal is visually on-screen (called by InvitationModal.onShow)
    signalModalVisible,
  };
}
