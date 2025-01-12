const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"), // Replace with your service account file
});

const db = admin.firestore();

const createEmptyMessagesSubcollections = async () => {
  try {
    // Fetch all chat documents in the `chats` collection
    const chatsSnapshot = await db.collection("chats").get();

    if (chatsSnapshot.empty) {
      console.log(
        "No chats found. Make sure you have chats in the `chats` collection."
      );
      return;
    }

    const batch = db.batch(); // Use a batch for better performance

    chatsSnapshot.forEach((chatDoc) => {
      const chatId = chatDoc.id;
      const messagesCollectionRef = db.collection(`chats/${chatId}/messages`);

      // Add a placeholder document in the `messages` subcollection
      const messageDocRef = messagesCollectionRef.doc();
      batch.set(messageDocRef, {
        text: "Welcome to the chat!", // Placeholder message
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: "system",
        username: "System",
      });

      console.log(`Prepared messages subcollection for chatId: ${chatId}`);
    });

    // Commit the batch operation
    await batch.commit();
    console.log("Messages subcollections created successfully!");
  } catch (error) {
    console.error("Error creating messages subcollections:", error);
  }
};

// Run the script
createEmptyMessagesSubcollections();
