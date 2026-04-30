// hooks/useMatchingInbox.ts

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { isInvitationExpired } from "@/services/invitationService";
import type { MatchingInvitation } from "@/services/matchingService";

export type MatchingInboxItem = MatchingInvitation & { id: string };

const isValidTimestampLike = (v: any) =>
  !!v && typeof v.toMillis === "function";

const safeIsExpired = (expiresAt: any) => {
  try {
    if (!isValidTimestampLike(expiresAt)) return true;
    return isInvitationExpired({ expiresAt });
  } catch {
    return true;
  }
};

const safeCreatedAtMs = (createdAt: any) => {
  try {
    if (createdAt && typeof createdAt.toMillis === "function") {
      return createdAt.toMillis();
    }
    return 0;
  } catch {
    return 0;
  }
};

export function useMatchingInbox() {
  const [items, setItems] = useState<MatchingInboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const me = auth.currentUser?.uid;

    if (!me) {
      setItems([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "matching_invitations"),
      where("inviteeId", "==", me),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const results: MatchingInboxItem[] = [];

          for (const d of snap.docs) {
            const inv = d.data() as MatchingInvitation;

            if (!safeIsExpired((inv as any).expiresAt)) {
              results.push({ ...inv, id: d.id });
            }
          }

          results.sort(
            (a, b) => safeCreatedAtMs((b as any).createdAt) - safeCreatedAtMs((a as any).createdAt)
          );

          setItems(results);
        } catch (e) {
          console.warn("[useMatchingInbox] snapshot parse error:", e);
          setItems([]);
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        console.warn("[useMatchingInbox] snapshot error:", e);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { items, loading, count: items.length };
}