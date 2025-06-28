const admin = require("firebase-admin");

// Vérifie si Firebase Admin est déjà initialisé
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert("./serviceAccountKey.json"),
  });
}

const db = admin.firestore();

const createEmptyMessagesSubcollections = async () => {
  try {
    const chatsSnapshot = await db.collection("chats").get();
    if (chatsSnapshot.empty) {
      return;
    }

    const batch = db.batch();
    let initializedChats = 0;

    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const messagesCollectionRef = db.collection(`chats/${chatId}/messages`);

      // Vérifier si la collection contient déjà des messages
      const messagesSnapshot = await messagesCollectionRef.limit(1).get();
      if (!messagesSnapshot.empty) {
        continue;
      }

      // Ajouter un message de bienvenue uniquement si la collection est vide
      const messageDocRef = messagesCollectionRef.doc();
      batch.set(messageDocRef, {
        text: "Bienvenue dans ce chat ! Échangez avec les autres participants 🎉",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: "system",
        username: "Système",
      });

      initializedChats++;
    }

    if (initializedChats > 0) {
      await batch.commit();
    } else {
    }
  } catch (error) {
    console.error(
      "❌ Erreur lors de la création des sous-collections de messages :",
      error
    );
  }
};

// Exécute le script
createEmptyMessagesSubcollections();
