import { useEffect } from "react";
import { auth, db } from "@/constants/firebase-config";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Args = {
  id: string | string[] | undefined;
  resetSoloProgressIfNeeded: () => void;
};

export function useInviteAcceptSync({ id, resetSoloProgressIfNeeded }: Args) {
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const challengeId = Array.isArray(id) ? id[0] : id;
    if (!uid || !challengeId) return;

    const q = query(
      collection(db, "invitations"),
      where("inviterId", "==", uid),
      where("challengeId", "==", challengeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "modified") return;
        const data = change.doc.data() as any;

        if (data?.status === "accepted") {
          // La notif à l'inviteur est envoyée par la Cloud Function.
          // Ici, on ne fait que le reset solo local, idempotent et sûr.
          resetSoloProgressIfNeeded();
        }
      });
    });

    return () => unsubscribe();
  }, [id, resetSoloProgressIfNeeded]);
}
