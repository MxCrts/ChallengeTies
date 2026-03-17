// hooks/useMatchingInbox.ts
// ✅ Écoute en temps réel les invitations matching reçues
// Utilisé dans le profil pour afficher le badge + l'inbox

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { isInvitationExpired } from "@/services/invitationService";
import type { MatchingInvitation } from "@/services/matchingService";

export type MatchingInboxItem = MatchingInvitation & { id: string };

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
        const results: MatchingInboxItem[] = [];
        for (const d of snap.docs) {
          const inv = d.data() as MatchingInvitation;
          if (!isInvitationExpired({ expiresAt: inv.expiresAt })) {
            results.push({ ...inv, id: d.id });
          }
        }
        // Tri : plus récent en premier
        results.sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? 0;
          const bMs = b.createdAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
        setItems(results);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { items, loading, count: items.length };
}
