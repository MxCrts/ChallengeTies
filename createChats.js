const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

const createChatsForExistingChallenges = async () => {
  try {
    const challengesSnapshot = await db.collection("challenges").get();
    if (challengesSnapshot.empty) {
      console.log("No challenges found in Firestore.");
      return;
    }

    const batch = db.batch();

    challengesSnapshot.docs.forEach((doc) => {
      const chatRef = db.collection("chats").doc(doc.id); // Chat ID matches the challenge ID
      batch.set(chatRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        description: `Chat for challenge: ${
          doc.data().title || "Untitled Challenge"
        }`,
      });
    });

    await batch.commit();
    console.log("Chats successfully created for all existing challenges.");
  } catch (error) {
    console.error("Error creating chats:", error);
  }
};

createChatsForExistingChallenges();
