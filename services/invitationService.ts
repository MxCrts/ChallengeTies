import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
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
  inviteeUsername?: string;
  selectedDays: number;
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
  selectedDays: number;
}

export const resetInviterChallenge = async (challengeId: string): Promise<void> => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Utilisateur non connecté");

  const userRef = doc(db, "users", userId);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    let currentChallenges = data.CurrentChallenges || [];

    currentChallenges = currentChallenges.filter(
      (c: any) => c.challengeId !== challengeId && c.id !== challengeId
    );

    transaction.update(userRef, { CurrentChallenges: currentChallenges });
  });

  console.log("✅ Reset Inviteur fait pour", challengeId);
};

export const resetInviteeChallenge = async (challengeId: string, inviteeUsername: string) => {
  const inviteeQuery = query(
    collection(db, "users"),
    where("username", "==", inviteeUsername.trim())
  );
  const inviteeSnap = await getDocs(inviteeQuery);
  if (inviteeSnap.empty) throw new Error("Invité introuvable");

  const inviteeId = inviteeSnap.docs[0].id;
  const inviteeRef = doc(db, "users", inviteeId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(inviteeRef);
    if (!snap.exists()) return;

    const data = snap.data();
    let currentChallenges = data.CurrentChallenges || [];

    currentChallenges = currentChallenges.filter(
      (c: any) => c.challengeId !== challengeId && c.id !== challengeId
    );

    transaction.update(inviteeRef, { CurrentChallenges: currentChallenges });
  });

  console.log("✅ Reset Invitee fait pour", challengeId);
};


// ✅ Créer une invitation DUO
export const createInvitation = async (
  challengeId: string,
  selectedDays: number,
  inviteeUsername: string
): Promise<string> => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Utilisateur non connecté");

  // 1️⃣ Vérifie que l’invité existe
  const inviteeQuery = query(
    collection(db, "users"),
    where("username", "==", inviteeUsername.trim())
  );
  const inviteeSnap = await getDocs(inviteeQuery);
  if (inviteeSnap.empty) {
    throw new Error("Utilisateur invité introuvable");
  }
  const inviteeId = inviteeSnap.docs[0].id;
  if (inviteeId === userId) {
    throw new Error("Vous ne pouvez pas vous inviter vous-même");
  }

  // 2️⃣ Vérifie que l’inviteur n’a pas déjà une invitation active
  const inviterInvitationsQuery = query(
    collection(db, "invitations"),
    where("challengeId", "==", challengeId),
    where("inviterId", "==", userId),
    where("status", "in", ["pending", "accepted"])
  );
  const inviterInvitationsSnap = await getDocs(inviterInvitationsQuery);
  if (!inviterInvitationsSnap.empty) {
    throw new Error("Vous avez déjà une invitation en cours ou acceptée pour ce challenge");
  }

  // 3️⃣ Vérifie que l’invité n’est pas déjà en duo
  const inviteeInvitationsQuery = query(
    collection(db, "invitations"),
    where("challengeId", "==", challengeId),
    where("inviteeId", "==", inviteeId),
    where("status", "in", ["pending", "accepted"])
  );
  const inviteeInvitationsSnap = await getDocs(inviteeInvitationsQuery);
  if (!inviteeInvitationsSnap.empty) {
    throw new Error("Cet utilisateur est déjà en duo sur ce challenge");
  }

  // 4️⃣ Vérifie si l’inviteur a déjà une progression
  const inviterRef = doc(db, "users", userId);
  const inviterDocSnap = await getDoc(inviterRef);
  if (inviterDocSnap.exists()) {
    const inviterData = inviterDocSnap.data();
    const hasProgress = (inviterData.CurrentChallenges || []).some(
(ch: any) => ch.id === challengeId || ch.challengeId === challengeId
    );
    if (hasProgress) {
      throw new Error("restart_inviteur");
    }
  }

  // Vérifie si l’invité a déjà une progression
  const inviteeRef = doc(db, "users", inviteeId);
  const inviteeDocSnap = await getDoc(inviteeRef);
  if (inviteeDocSnap.exists()) {
    const inviteeData = inviteeDocSnap.data();
    const hasProgressInvitee = (inviteeData.CurrentChallenges || []).some(
(ch: any) => ch.id === challengeId || ch.challengeId === challengeId
    );
    if (hasProgressInvitee) {
      throw new Error("restart_invitee");
    }
  }

  // 5️⃣ Crée l’invitation
  const invitationRef = await addDoc(collection(db, "invitations"), {
    challengeId,
    inviterId: userId,
    inviteeId,
    inviteeUsername: inviteeUsername.trim(),
    selectedDays,
    status: "pending",
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // 6️⃣ Notifie l’invité
  await sendInvitationNotification(
    inviteeId,
    `Tu as une nouvelle invitation Duo sur ChallengeTies !`
  );

  console.log("✅ Invitation créée :", invitationRef.id);
  return invitationRef.id;
};


// ✅ Accepter une invitation
// ✅ Accepter une invitation (version CurrentChallenges unique + duo)
export const acceptInvitation = async (inviteId: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Utilisateur non connecté");

    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) throw new Error("Invitation non trouvée");

    const invitation = invitationSnap.data() as Invitation;
    if (invitation.status !== "pending") throw new Error("Invitation déjà traitée");
    if (invitation.inviteeId && invitation.inviteeId !== userId)
      throw new Error("Invitation non valide pour cet utilisateur");

    if (invitation.expiresAt.toDate() < new Date()) {
      await updateDoc(invitationRef, { status: "refused" });
      throw new Error("Invitation expirée");
    }

    const inviteeRef = doc(db, "users", userId);
    const inviteeSnap = await getDoc(inviteeRef);
    if (!inviteeSnap.exists()) throw new Error("Profil invité introuvable");
    const invitee = inviteeSnap.data();
    const inviteeUsername = invitee?.username || "Utilisateur";

    const inviteeChallenges = invitee?.CurrentChallenges || [];
    const hasInvitee = inviteeChallenges.some(
      (c: any) => c.challengeId === invitation.challengeId
    );
    if (hasInvitee) throw new Error("restart_invitee");

    // 🔄 Transaction sur challenge
    await runTransaction(db, async (transaction) => {
      const challengeRef = doc(db, "challenges", invitation.challengeId);
      const challengeSnap = await transaction.get(challengeRef);
      if (!challengeSnap.exists()) throw new Error("Challenge non trouvé");

      const challengeData = challengeSnap.data() as { usersTakingChallenge?: string[] };
      const currentUsers = challengeData.usersTakingChallenge || [];

      if (!currentUsers.includes(userId)) {
        transaction.update(challengeRef, {
          usersTakingChallenge: arrayUnion(userId),
          participantsCount: increment(1),
        });
      }

      transaction.update(invitationRef, {
        inviteeId: userId,
        inviteeUsername,
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
    });

    // 🔄 Transaction sur invitee ➜ DUO OK
    await runTransaction(db, async (transaction) => {
      const inviteeSnap = await transaction.get(inviteeRef);
      const inviteeData = inviteeSnap.data();
      const invitedChallenges = inviteeData?.invitedChallenges || [];
      const currentChallenges = inviteeData?.CurrentChallenges || [];

      transaction.update(inviteeRef, {
        invitedChallenges: arrayUnion(inviteId),
        CurrentChallenges: arrayUnion({
          challengeId: invitation.challengeId,
          selectedDays: invitation.selectedDays,
          completedDays: 0,
          duo: true,
          duoPartnerId: invitation.inviterId,
        }),
      });
    });

    // 🔄 Transaction sur inviter ➜ DUO OK
    const inviterRef = doc(db, "users", invitation.inviterId);
    await runTransaction(db, async (transaction) => {
      const inviterSnap = await transaction.get(inviterRef);
      const inviterData = inviterSnap.data();
      let inviterChallenges = inviterData?.CurrentChallenges || [];

      inviterChallenges = inviterChallenges.filter(
        (c: any) => c.challengeId !== invitation.challengeId
      );

      inviterChallenges.push({
        challengeId: invitation.challengeId,
        selectedDays: invitation.selectedDays,
        completedDays: 0,
        duo: true,
        duoPartnerId: userId,
      });

      transaction.update(inviterRef, {
        CurrentChallenges: inviterChallenges,
      });
    });

    // ✅ Notifie l'inviteur si activé
    const inviterSnap = await getDoc(inviterRef);
    const inviterData = inviterSnap.data();
    if (inviterData?.notificationsEnabled) {
      await sendInvitationNotification(
        invitation.inviterId,
        `${inviteeUsername} a accepté ton invitation Duo !`
      );
    }

    console.log("✅ Invitation acceptée : CurrentChallenges mis à jour pour les deux !");
  } catch (error) {
    console.error("❌ Erreur acceptation invitation:", error);
    throw error;
  }
};



// ✅ Refuser une invitation
export const refuseInvitation = async (inviteId: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Utilisateur non connecté");

    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) throw new Error("Invitation non trouvée");

    const invitation = invitationSnap.data() as Invitation;
    if (invitation.status !== "pending") throw new Error("Invitation déjà traitée");

    const userRef = doc(db, "users", userId);
    const inviteeSnap = await getDoc(userRef);
    const inviteeUsername = inviteeSnap.data()?.username || "Utilisateur";

    await updateDoc(invitationRef, {
      inviteeId: userId,
      inviteeUsername,
      status: "refused",
    });

    await deleteDoc(invitationRef);

    const inviterRef = doc(db, "users", invitation.inviterId);
    const inviterSnap = await getDoc(inviterRef);
    if (inviterSnap.exists() && inviterSnap.data()?.notificationsEnabled) {
      await sendInvitationNotification(
        invitation.inviterId,
        `${inviteeUsername} a refusé ton invitation Duo.`
      );
    }

    console.log("❌ Invitation refusée :", { inviteId, userId });
  } catch (error) {
    console.error("❌ Erreur refus invitation:", error);
    throw error;
  }
};

// ✅ Récupérer progression DUO
export const getInvitationProgress = async (
  inviteId: string
): Promise<Progress[]> => {
  try {
    const invitationRef = doc(db, "invitations", inviteId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists() || invitationSnap.data().status !== "accepted") {
      console.warn("⚠️ Invitation non trouvée ou non acceptée");
      return [];
    }

    const invitation = invitationSnap.data() as Invitation;
    const progress: Progress[] = [];

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
progress: challenge?.completedDays || 0,
        selectedDays: challenge?.selectedDays || 0,
      });
    }

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
progress: challenge?.completedDays || 0,
          selectedDays: challenge?.selectedDays || 0,
        });
      }
    }

    console.log("📊 Progression DUO:", progress);
    return progress;
  } catch (error) {
    console.error("❌ Erreur progression invitation:", error);
    return [];
  }
};
