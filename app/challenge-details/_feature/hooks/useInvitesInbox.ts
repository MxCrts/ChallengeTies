import { useEffect } from "react";
import { auth, db } from "@/constants/firebase-config";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type Args = {
  id: string | string[] | undefined;

  processedInviteIdsRef: React.MutableRefObject<Set<string>>;
  suppressInboxInvitesRef: React.MutableRefObject<boolean>;

  setInvitation: (v: { id: string }) => void;
  setInviteModalReady: (v: boolean) => void;
  setInvitationModalVisible: (v: boolean) => void;
};

export function useInvitesInbox({
  id,
  processedInviteIdsRef,
  suppressInboxInvitesRef,
  setInvitation,
  setInviteModalReady,
  setInvitationModalVisible,
}: Args) {
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const challengeId = Array.isArray(id) ? id[0] : id;
    if (!uid || !challengeId) return;

    // On garde ici ce qui a déjà été traité (deeplink + modal déjà ouvert)
    const alreadyProcessed = processedInviteIdsRef.current;

    // 🧩 Query "propre" : pending + challengeId
    const baseQuery = query(
      collection(db, "invitations"),
      where("inviteeId", "==", uid),
      where("status", "==", "pending"),
      where("challengeId", "==", challengeId)
    );

    let fallbackUnsub: (() => void) | undefined;

    const open = (docId: string) => {
      processedInviteIdsRef.current.add(docId);
      setInvitation({ id: docId });
      setInviteModalReady(false);
      setInvitationModalVisible(true);
    };

    const unsubMain = onSnapshot(
      baseQuery,
      (snap) => {
        snap.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const data = change.doc.data() as any;

          // ✅ added only (exactement comme ton code)
          if (change.type !== "added") return;

          // ✅ si deeplink ?invite= en cours, on évite double-open
          if (suppressInboxInvitesRef.current) return;

          if (alreadyProcessed.has(docId)) return;

          if (data.status !== "pending") return;
          if (data.challengeId !== challengeId) return;

          open(docId);
        });
      },
      (err) => {
        console.warn(
          "⚠️ Snapshot invitations (query complète) a échoué, fallback sans index :",
          (err as any)?.message || err
        );

        // 🔁 Fallback : on écoute inviteeId et on filtre en JS
        const qFallback = query(
          collection(db, "invitations"),
          where("inviteeId", "==", uid)
        );

        fallbackUnsub = onSnapshot(qFallback, (snap2) => {
          snap2.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data() as any;

            if (alreadyProcessed.has(docId)) return;
            if (data.status !== "pending") return;
            if (data.challengeId !== challengeId) return;

            // ✅ added OR modified (exactement comme ton code)
            if (change.type !== "added" && change.type !== "modified") return;

            open(docId);
          });
        });
      }
    );

    // 🔍 Vérif immédiate au montage (sans attendre un changement)
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "invitations"),
            where("inviteeId", "==", uid),
            where("status", "==", "pending"),
            where("challengeId", "==", challengeId)
          )
        );

        snap.forEach((d) => {
          const docId = d.id;
          const data = d.data() as any;

          if (alreadyProcessed.has(docId)) return;
          if (data.status !== "pending") return;
          if (data.challengeId !== challengeId) return;

          open(docId);
        });
      } catch (e) {
        console.error("❌ Vérif immédiate invitations échouée:", e);
      }
    })();

    return () => {
      unsubMain();
      fallbackUnsub?.();
    };
  }, [id]); // ✅ dépendance identique à ton fichier (juste [id])
}
