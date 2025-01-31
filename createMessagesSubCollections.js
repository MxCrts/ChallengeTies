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
      console.log("⚠ No chats found. Ensure there are chats in Firestore.");
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
        console.log(`Messages already exist for chatId: ${chatId}`);
        continue;
      }

      // Ajouter un message de bienvenue uniquement si la collection est vide
      const messageDocRef = messagesCollectionRef.doc();
      batch.set(messageDocRef, {
        text: "Welcome to the chat!",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: "system",
        username: "System",
      });

      initializedChats++;
      console.log(
        `✅ Initialized messages subcollection for chatId: ${chatId}`
      );
    }

    if (initializedChats > 0) {
      await batch.commit();
      console.log(
        `✅ Successfully initialized ${initializedChats} chats with a welcome message!`
      );
    } else {
      console.log("⚠ No new messages needed.");
    }
  } catch (error) {
    console.error("❌ Error creating messages subcollections:", error);
  }
};

// Exécute le script
createEmptyMessagesSubcollections();
