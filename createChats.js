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
      console.log("⚠ Aucun challenge trouvé dans Firestore.");
      return;
    }

    const batch = db.batch();
    let createdChats = 0;

    console.log("🔄 Création des chats en cours...");

    for (const doc of challengesSnapshot.docs) {
      const challengeData = doc.data();
      const chatId = challengeData.chatId || doc.id; // Utilisation de chatId existant ou ID du challenge
      const chatRef = db.collection("chats").doc(chatId);

      // Vérifier si le chat existe déjà
      const chatDoc = await chatRef.get();
      if (chatDoc.exists) {
        console.log(`🔵 Chat déjà existant pour : ${challengeData.title}`);
        continue;
      }

      batch.set(chatRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        description: `Chat pour le challenge : ${
          challengeData.title || "Sans titre"
        }`,
        challengeId: doc.id,
        participantsCount: 0,
        requiresRulesAcceptance: true, // Indique que les règles doivent être acceptées
        welcomeRules: {
          title: "Bienvenue dans le chat du challenge !",
          message:
            `Nous sommes ici pour nous encourager, nous soutenir et avancer ensemble dans ce challenge ! Voici les règles pour garder une vibe positive :\n\n` +
            `1. **Respect** : Pas d’insultes, de harcèlement ou de contenu inapproprié.\n` +
            `2. **Encouragement** : Partagez des messages positifs pour motiver les autres.\n` +
            `3. **Pertinence** : Restez dans le sujet du challenge.\n` +
            `4. **Confidentialité** : Ne partagez pas d’informations personnelles sensibles.\n` +
            `5. **Langage approprié** : Pas de spam, de pub ou de contenu illégal.\n\n` +
            `En rejoignant ce chat, vous vous engagez à respecter ces règles. Merci de cocher la case ci-dessous et de cliquer sur "J’ai compris" pour continuer !`,
        },
      });

      createdChats++;
    }

    if (createdChats > 0) {
      await batch.commit();
      console.log(`✅ ${createdChats} nouveaux chats créés avec succès !`);
    } else {
      console.log("⚠ Aucun nouveau chat à créer.");
    }
  } catch (error) {
    console.error("❌ Erreur lors de la création des chats :", error);
  }
};

// Exécute le script
createChatsForExistingChallenges();
