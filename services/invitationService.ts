import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { sendInvitationNotification } from "./notificationService";

// Interface pour invitation
interface Invitation {
  challengeId: string;
  inviterId: string;
  inviteeId: string | null;
  status: "pending" | "accepted" | "refused";
  createdAt: any;
  expiresAt: any;
}

// Interface pour progression
interface Progress {
  userId: string;
  username: string;
  profileImage: string;
  progress: number;
}

// ✅ Créer une invitation
export const createInvitation = async (
  chatId: string // Change challengeId en chatId
): Promise<string> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      throw new Error("Utilisateur non connecté");
    }

    const invitationsQuery = query(
      collection(db, "invitations"),
      where("challengeId", "==", chatId), // Garde challengeId dans Firebase pour compatibilité
      where("inviterId", "==", userId),
      where("status", "in", ["pending", "accepted"])
    );
    const existingInvitations = await getDocs(invitationsQuery);
    if (!existingInvitations.empty) {
      console.warn("⚠️ Une invitation existe déjà pour ce challenge");
      throw new Error("Une invitation existe déjà");
    }

    const invitationRef = await addDoc(collection(db, "invitations"), {
      challengeId: chatId, // Stocke chatId comme challengeId dans Firebase
      inviterId: userId,
      inviteeId: null,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const inviteId = invitationRef.id;
    const inviteLink = `https://challengeties.app/challenge-details/${encodeURIComponent(
      chatId
    )}?invite=${encodeURIComponent(inviteId)}`;
    console.log("📩 Invitation créée:", { chatId, inviteId, inviteLink });
    return inviteLink;
  } catch (error) {
    console.error("❌ Erreur création invitation:", error);
    throw error;
  }
};

// ✅ Accepter une invitation
export const acceptInvitation = async (inviteId: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      throw new Error("Utilisateur non connecté");
    }

    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) {
      console.warn("⚠️ Invitation non trouvée");
      throw new Error("Invitation non trouvée");
    }

    const invitation = invitationSnap.data() as Invitation;
    console.log("📋 État invitation:", invitation);

    if (invitation.status !== "pending") {
      console.warn("⚠️ Invitation déjà traitée:", invitation.status);
      throw new Error("Invitation déjà traitée ou non valide");
    }

    if (invitation.inviteeId && invitation.inviteeId !== userId) {
      console.warn("⚠️ Invitation non destinée à cet utilisateur:", {
        inviteeId: invitation.inviteeId,
        userId,
      });
      throw new Error("Invitation non valide pour cet utilisateur");
    }

    // Vérifier expiration
    if (invitation.expiresAt.toDate() < new Date()) {
      console.warn("⚠️ Invitation expirée");
      await updateDoc(invitationRef, { status: "refused" });
      throw new Error("Invitation expirée");
    }

    // Transaction pour mise à jour atomique
    await runTransaction(db, async (transaction) => {
      // Mettre à jour invitation
      transaction.update(invitationRef, {
        inviteeId: userId,
        status: "accepted",
        updatedAt: serverTimestamp(),
      });

      // Ajouter utilisateur à usersTakingChallenge
      const challengeRef = doc(db, "challenges", invitation.challengeId);
      const challengeSnap = await transaction.get(challengeRef);
      if (!challengeSnap.exists()) {
        throw new Error("Challenge non trouvé");
      }
      const challengeData = challengeSnap.data();
      const currentUsers = challengeData.usersTakingChallenge || [];
      if (!currentUsers.includes(userId)) {
        transaction.update(challengeRef, {
          usersTakingChallenge: arrayUnion(userId),
          participantsCount: increment(1),
        });
      }
    });

    // Mettre à jour utilisateur invité
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      invitedChallenges: arrayUnion(inviteId),
      currentChallenges: arrayUnion({
        challengeId: invitation.challengeId,
        progress: 0,
      }),
    });

    // Notifier l'inviteur
    const inviterRef = doc(db, "users", invitation.inviterId);
    const inviterSnap = await getDoc(inviterRef);
    const inviter = inviterSnap.data();
    const inviteeSnap = await getDoc(userRef);
    const invitee = inviteeSnap.data();
    if (inviter?.notificationsEnabled) {
      await sendInvitationNotification(
        invitation.inviterId,
        `${invitee?.username} a rejoint ton challenge !`
      );
    }

    console.log("✅ Invitation acceptée:", { inviteId, userId });
  } catch (error) {
    console.error("❌ Erreur acceptation invitation:", error);
    throw error;
  }
};

// ✅ Refuser une invitation
export const refuseInvitation = async (inviteId: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      throw new Error("Utilisateur non connecté");
    }

    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) {
      console.warn("⚠️ Invitation non trouvée");
      throw new Error("Invitation non trouvée");
    }

    const invitation = invitationSnap.data() as Invitation;
    if (invitation.status !== "pending") {
      console.warn("⚠️ Invitation non valide");
      throw new Error("Invitation déjà traitée");
    }

    // Mettre à jour invitation
    await updateDoc(invitationRef, {
      inviteeId: userId,
      status: "refused",
    });

    // Notifier l'inviteur
    const inviterRef = doc(db, "users", invitation.inviterId);
    const inviterSnap = await getDoc(inviterRef);
    const inviter = inviterSnap.data();
    const inviteeSnap = await getDoc(doc(db, "users", userId));
    const invitee = inviteeSnap.data();
    if (inviter?.notificationsEnabled) {
      await sendInvitationNotification(
        invitation.inviterId,
        `${invitee?.username} a refusé ton invitation.`
      );
    }

    console.log("❌ Invitation refusée:", { inviteId, userId });
  } catch (error) {
    console.error("❌ Erreur refus invitation:", error);
    throw error;
  }
};

// ✅ Récupérer progression du duo
export const getInvitationProgress = async (
  inviteId: string
): Promise<Progress[]> => {
  try {
    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (
      !invitationSnap.exists() ||
      invitationSnap.data().status !== "accepted"
    ) {
      console.warn("⚠️ Invitation non trouvée ou non acceptée");
      return [];
    }

    const invitation = invitationSnap.data() as Invitation;
    const progress: Progress[] = [];

    // Récupérer inviteur
    const inviterRef = doc(db, "users", invitation.inviterId);
    const inviterSnap = await getDoc(inviterRef);
    if (inviterSnap.exists()) {
      const inviter = inviterSnap.data();
      const challenge = inviter.currentChallenges?.find(
        (c: any) => c.challengeId === invitation.challengeId
      );
      progress.push({
        userId: invitation.inviterId,
        username: inviter.username,
        profileImage: inviter.profileImage || "",
        progress: challenge?.progress || 0,
      });
    }

    // Récupérer invité
    if (invitation.inviteeId) {
      const inviteeRef = doc(db, "users", invitation.inviteeId);
      const inviteeSnap = await getDoc(inviteeRef);
      if (inviteeSnap.exists()) {
        const invitee = inviteeSnap.data();
        const challenge = invitee.currentChallenges?.find(
          (c: any) => c.challengeId === invitation.challengeId
        );
        progress.push({
          userId: invitation.inviteeId,
          username: invitee.username,
          profileImage: invitee.profileImage || "",
          progress: challenge?.progress || 0,
        });
      }
    }

    console.log("📊 Progression duo:", progress);
    return progress;
  } catch (error) {
    console.error("❌ Erreur récupération progression:", error);
    return [];
  }
};
