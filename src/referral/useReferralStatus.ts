// src/referral/useReferralStatus.ts
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/constants/firebase-config";
import {
  doc,
  onSnapshot,
  query,
  where,
  collection,
  type Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const MILESTONES = [5, 10, 25] as const;

export type ReferralStatus = {
  activatedCount: number;
  claimed: number[];
  claimable: number[];
  nextMilestone: number | null;
  loading: boolean;
};

export function useReferralStatus(): ReferralStatus {
  const [me, setMe] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [activatedCount, setActivatedCount] = useState(0);
  const [claimed, setClaimed] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ réactif auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setMe(u?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!me) {
      setActivatedCount(0);
      setClaimed([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubUser: Unsubscribe | null = null;
    let unsubFallback: Unsubscribe | null = null;

    setLoading(true);

    const userRef = doc(db, "users", me);

    // ✅ 1) Toujours écouter le user doc
    unsubUser = onSnapshot(
      userRef,
      (s) => {
        if (cancelled) return;

        const data = s.data() as any;
        const referral = data?.referral;

        if (referral) {
          // --- source de vérité ---
          const count = Number(referral?.activatedCount ?? 0);

          const rawClaimed = Array.isArray(referral?.claimedMilestones)
            ? referral.claimedMilestones
            : [];

          const normalizedClaimed = rawClaimed
            .map((x: any) => Number(x))
            .filter((n: number) => Number.isFinite(n));

          setActivatedCount(count);
          setClaimed(normalizedClaimed);

          // si on était en fallback avant, on coupe
          if (unsubFallback) {
            unsubFallback();
            unsubFallback = null;
          }

          setLoading(false);
          return;
        }

        // ✅ 2) Pas de referral → on lance fallback si pas déjà lancé
        if (!unsubFallback) {
          const q = query(
            collection(db, "users"),
            where("referrerId", "==", me)
          );

          unsubFallback = onSnapshot(
            q,
            (ss) => {
              if (cancelled) return;

              const activated = ss.docs.filter((d) => {
                const u = d.data() as any;
                return u?.activated === true || u?.referralActivated === true;
              }).length;

              setActivatedCount(activated);
              setClaimed([]); // pas fiable en fallback
              setLoading(false);
            },
            () => !cancelled && setLoading(false)
          );
        }
      },
      () => !cancelled && setLoading(false)
    );

    return () => {
      cancelled = true;
      unsubUser?.();
      unsubFallback?.();
    };
  }, [me]);

  const claimable = useMemo(() => {
    const already = new Set(claimed);
    return MILESTONES.filter(
      (m) => activatedCount >= m && !already.has(m)
    ) as number[];
  }, [activatedCount, claimed]);

  const nextMilestone = useMemo(() => {
    for (const m of MILESTONES) {
      if (activatedCount < m) return m;
    }
    return null;
  }, [activatedCount]);

  return { activatedCount, claimed, claimable, nextMilestone, loading };
}
