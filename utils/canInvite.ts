// utils/canInvite.ts
import { db, auth } from "@/constants/firebase-config";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function canInvite(challengeId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return { ok: false, reason: "no-auth" };

  // 1) invite pendante ?
  const q1 = query(
    collection(db, "invitations"),
    where("inviterId", "==", uid),
    where("challengeId", "==", challengeId),
    where("status", "==", "pending")
  );
  const pend = await getDocs(q1);
  if (!pend.empty) return { ok: false, reason: "pending-invite" };

  // 2) déjà en duo ?
  // Si tu as un selector maison, remplace par ton CurrentChallengesContext
  // Ici on lit user doc minimaliste si tu préfères.
  // Retourne ok:false si duo:true sur ce challenge.
  return { ok: true as const };
}
