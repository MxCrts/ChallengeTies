const admin = require("firebase-admin");
const path = require("path");

// Vérifie si Firebase Admin est déjà initialisé
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      path.resolve(__dirname, "serviceAccountKey.json")
    ),
  });
}

const db = admin.firestore();

const createChatsForExistingChallenges = async () => {
  try {
    const challengesSnapshot = await db.collection("challenges").get();
    if (challengesSnapshot.empty) {
      return;
    }

    const batch = db.batch();
    let createdChats = 0;

    for (const doc of challengesSnapshot.docs) {
  const challengeData = doc.data();
  const chatId = challengeData.chatId || doc.id; // Utilise chatId existant ou l’ID du challenge
  const chatRef = db.collection("chats").doc(chatId);

  // Vérifier si le chat existe déjà
  const chatDoc = await chatRef.get();
  if (chatDoc.exists) {
    continue; // on ne modifie pas les chats déjà présents
  }

  // 1) Création du document "chat"
  batch.set(chatRef, {
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  description: `Chat pour le challenge : ${challengeData.title || "Sans titre"}`,
  challengeId: doc.id,
  participantsCount: 0,
  requiresRulesAcceptance: true,

  // ⬇️ i18n direct
  welcomeRules: {
    titleKey: "chat.welcomeRules.title",
    messageKey: "chat.welcomeRules.message",
  },

  hasPinnedWelcome: true,
});

  // 2) Ajout du **message système de bienvenue** dans /chats/{chatId}/messages/welcome
  // 2) Ajout du message système de bienvenue
const welcomeMsgRef = chatRef.collection("messages").doc("welcome");
batch.set(welcomeMsgRef, {
  // IMPORTANT: le champ que le client utilise pour orderBy
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  // (optionnel) tu peux garder createdAt si tu veux
  createdAt: admin.firestore.FieldValue.serverTimestamp(),

  type: "system",
  systemType: "welcome",
  pinned: true,
  centered: true,
  style: "notice",

  userId: "system",
  username: "Moderation",
  avatar: "",
  reported: false,

  // i18n direct
  textKey: "chat.systemWelcome",
  text: "", // inutile mais inoffensif

  visibility: "everyone",
});



  createdChats++;
}


    if (createdChats > 0) {
      await batch.commit();
    } else {
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création des chats :", error);
  }
};

// Exécute le script
createChatsForExistingChallenges();
