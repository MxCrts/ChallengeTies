import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { auth, db } from "@/constants/firebase-config";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

type TFn = (key: string, opts?: any) => string;

type OutgoingPendingInvite = { id: string; inviteeUsername?: string | null } | null;

type Args = {
  id: string | string[] | undefined;
  pendingOutLock: boolean;
  setPendingOutLock: (v: boolean) => void;
  outgoingPendingInvite: OutgoingPendingInvite;
  setOutgoingPendingInvite: (
    v:
      | OutgoingPendingInvite
      | ((prev: OutgoingPendingInvite) => OutgoingPendingInvite)
  ) => void;
  isDuoPendingOut: boolean;
  t: TFn;
};

export function useOutgoingInvite({
  id,
  pendingOutLock,
  setPendingOutLock,
  outgoingPendingInvite,
  setOutgoingPendingInvite,
  isDuoPendingOut,
  t,
}: Args) {
  const cancelOutBusyRef = useRef(false);

  // ✅ On écoute si MOI (inviter) j’ai une invitation pending sur ce challenge
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const challengeId = Array.isArray(id) ? id[0] : id;
    if (!uid || !challengeId) return;

    const qOut = query(
      collection(db, "invitations"),
      where("inviterId", "==", uid),
      where("challengeId", "==", challengeId),
      where("status", "==", "pending"),
      limit(1)
    );

    const unsub = onSnapshot(
      qOut,
      (snap) => {
        if (snap.empty) {
          // ✅ si on a un lock local, on garde l’optimiste (le temps que Firestore rattrape)
          if (!pendingOutLock) setOutgoingPendingInvite(null);
          return;
        }
        const d = snap.docs[0];
        const data = d.data() as any;
        setOutgoingPendingInvite({
          id: d.id,
          inviteeUsername: data?.inviteeUsername ?? null,
        });
      },
      () => {}
    );

    return () => unsub();
  }, [id, pendingOutLock, setOutgoingPendingInvite]);

  const resolveOutgoingPendingInviteId = useCallback(async (): Promise<string | null> => {
    // 1) si on a déjà le vrai id (pas optimiste)
    const currentId = outgoingPendingInvite?.id;
    if (currentId && currentId !== "__optimistic__") return currentId;

    // 2) sinon on cherche le vrai doc pending côté Firestore
    const uid = auth.currentUser?.uid;
    const challengeId = Array.isArray(id) ? id[0] : id;
    if (!uid || !challengeId) return null;

    try {
      const snap = await getDocs(
        query(
          collection(db, "invitations"),
          where("inviterId", "==", uid),
          where("challengeId", "==", challengeId),
          where("status", "==", "pending"),
          limit(1)
        )
      );
      if (snap.empty) return null;
      return snap.docs[0].id;
    } catch {
      return null;
    }
  }, [outgoingPendingInvite?.id, id]);

  const cancelOutgoingPendingInvite = useCallback(async () => {
    if (cancelOutBusyRef.current) return;
    cancelOutBusyRef.current = true;

    // ✅ UI instant : on retire la card pending direct
    setPendingOutLock(false);
    setOutgoingPendingInvite(null);

    try {
      const inviteId = await resolveOutgoingPendingInviteId();
      if (!inviteId) return;

      await updateDoc(doc(db, "invitations", inviteId), {
        status: "refused",
        updatedAt: serverTimestamp(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    } catch (e) {
      // ✅ ZÉRO message d’erreur user ici (décision produit)
      console.warn("cancelOutgoingPendingInvite failed:", e);
    } finally {
      cancelOutBusyRef.current = false;
    }
  }, [resolveOutgoingPendingInviteId, setOutgoingPendingInvite, setPendingOutLock]);

  const handleCancelPendingInvite = useCallback(() => {
    if (!isDuoPendingOut) return;

    Alert.alert(
      t("duo.pending.cancelConfirmTitle", {
        defaultValue: "Annuler l’invitation ?",
      }),
      t("duo.pending.cancelConfirmBody", {
        defaultValue: "Ton ami ne pourra plus rejoindre ce duo avec ce lien.",
      }),
      [
        { text: t("commonS.keep", { defaultValue: "Garder" }), style: "cancel" },
        {
          text: t("duo.pending.cancelInvite", {
            defaultValue: "Annuler l’invitation",
          }),
          style: "destructive",
          onPress: () => cancelOutgoingPendingInvite(),
        },
      ],
      { cancelable: true }
    );
  }, [isDuoPendingOut, cancelOutgoingPendingInvite, t]);

  return {
    handleCancelPendingInvite,
    cancelOutgoingPendingInvite,
    resolveOutgoingPendingInviteId,
  };
}
