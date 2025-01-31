const admin = require("firebase-admin");

// Vérifie si Firebase Admin est déjà initialisé
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert("./serviceAccountKey.json"),
  });
}

const db = admin.firestore();

const createChatsForExistingChallenges = async () => {
  try {
    const challengesSnapshot = await db.collection("challenges").get();
    if (challengesSnapshot.empty) {
      console.log("⚠ No challenges found in Firestore.");
      return;
    }

    const batch = db.batch();
    let createdChats = 0;

    for (const doc of challengesSnapshot.docs) {
      const chatRef = db.collection("chats").doc(doc.id);

      // Vérifier si le chat existe déjà
      const chatDoc = await chatRef.get();
      if (chatDoc.exists) {
        console.log(`Chat already exists for challenge: ${doc.data().title}`);
        continue;
      }

      batch.set(chatRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        description: `Chat for challenge: ${
          doc.data().title || "Untitled Challenge"
        }`,
      });

      createdChats++;
    }

    if (createdChats > 0) {
      await batch.commit();
      console.log(`✅ Successfully created ${createdChats} new chats!`);
    } else {
      console.log("⚠ No new chats needed.");
    }
  } catch (error) {
    console.error("❌ Error creating chats:", error);
  }
};

// Exécute le script
createChatsForExistingChallenges();
