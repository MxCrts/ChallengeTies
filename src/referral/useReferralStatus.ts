// src/referral/useReferralStatus.ts
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/constants/firebase-config";
import { doc, getDoc, onSnapshot, query, where, orderBy, collection } from "firebase/firestore";

const MILESTONES = [5, 10, 25];

export type ReferralStatus = {
  activatedCount: number;
  claimed: number[];
  claimable: number[];     // paliers atteints mais non réclamés
  nextMilestone: number | null;
  loading: boolean;
};

export function useReferralStatus(): ReferralStatus {
  const me = auth.currentUser?.uid;
  const [activatedCount, setActivatedCount] = useState(0);
  const [claimed, setClaimed] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    setLoading(true);

    const userRef = doc(db, "users", me);
    let unsubUser: (() => void) | null = null;
    let unsubFallback: (() => void) | null = null;

    (async () => {
      const snap = await getDoc(userRef);
      const tryServer = snap.exists() && snap.data()?.referral;

      if (tryServer) {
        // live-sub sur le doc user
        unsubUser = onSnapshot(userRef, (s) => {
          const data = s.data() as any;
          const count = Number(data?.referral?.activatedCount ?? 0);
          const c = Array.isArray(data?.referral?.claimedMilestones)
            ? (data.referral.claimedMilestones as number[])
            : [];
          setActivatedCount(count);
          setClaimed(c);
          setLoading(false);
        }, () => setLoading(false));
      } else {
        // fallback live-sub sur la collection users (referrerId == me)
        const q = query(
          collection(db, "users"),
          where("referrerId", "==", me),
          orderBy("createdAt", "desc")
        );
        unsubFallback = onSnapshot(q, (ss) => {
          setActivatedCount(ss.docs.filter(d => !!(d.data() as any)?.activated).length);
          setLoading(false);
        }, () => setLoading(false));
      }
    })();

    return () => {
      unsubUser?.();
      unsubFallback?.();
    };
  }, [me]);

  const claimable = useMemo(() => {
    const already = new Set(claimed);
    return MILESTONES.filter(m => activatedCount >= m && !already.has(m));
  }, [activatedCount, claimed]);

  const nextMilestone = useMemo(() => {
    for (const m of MILESTONES) if (activatedCount < m) return m;
    return null;
  }, [activatedCount]);

  return { activatedCount, claimed, claimable, nextMilestone, loading };
}
