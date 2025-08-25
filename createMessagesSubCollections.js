/**
 * ensureWelcomeMessage.js
 * Crée / répare le message système "welcome" dans /chats/{chatId}/messages/welcome
 * - Ajoute timestamp + createdAt (serverTimestamp)
 * - Utilise i18n via textKey: "chat.systemWelcome"
 * - pinned + centered + style: "notice"
 * - Met à jour chats/{chatId}.hasPinnedWelcome = true
 * - Respecte la limite de 500 opérations par batch en chunkant
 */

const admin = require("firebase-admin");
const path = require("path");

// Init Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      path.resolve(__dirname, "serviceAccountKey.json")
    ),
  });
}

const db = admin.firestore();

const BATCH_LIMIT = 500;     // limite Firestore
const SAFETY_MARGIN = 20;    // marge de sécurité
const MAX_OPS = BATCH_LIMIT - SAFETY_MARGIN; // on commit avant d'atteindre 500

async function ensureWelcomeMessage() {
  try {
    const chatsSnapshot = await db.collection("chats").get();
    if (chatsSnapshot.empty) {
      console.log("Aucun chat trouvé.");
      return;
    }

    let batch = db.batch();
    let ops = 0;       // nombre d'opérations dans le batch courant
    let touched = 0;   // nombre de chats modifiés
    let repaired = 0;  // nombre de welcomes existants réparés

    // helper pour commit+reset le batch si on approche de la limite
    const safeCommit = async () => {
      if (ops >= MAX_OPS) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    };

    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;

      const welcomeRef = db.collection(`chats/${chatId}/messages`).doc("welcome");
      const welcomeSnap = await welcomeRef.get();

      // Si déjà présent, on vérifie/répare les champs critiques
      if (welcomeSnap.exists) {
        const data = welcomeSnap.data() || {};

        const needsFix =
          !data.timestamp ||
          data.type !== "system" ||
          data.systemType !== "welcome" ||
          !data.textKey ||
          data.pinned !== true ||
          data.centered !== true ||
          data.style !== "notice";

        if (needsFix) {
          batch.set(
            welcomeRef,
            {
              // champs critiques
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              type: "system",
              systemType: "welcome",
              textKey: "chat.systemWelcome",
              text: data.text || "",

              pinned: true,
              centered: true,
              style: "notice",

              // shape auteur / modération
              userId: "system",
              username: "Moderation",
              avatar: data.avatar || "",
              reported: !!data.reported,

              author: {
                uid: "system",
                displayName: "Moderation",
                role: "system",
              },

              visibility: "everyone",
            },
            { merge: true }
          );
          ops++;

          // flag sur le chat
          batch.set(
            db.collection("chats").doc(chatId),
            { hasPinnedWelcome: true },
            { merge: true }
          );
          ops++;

          repaired++;
          await safeCommit();
        }

        continue; // rien à créer
      }

      // Sinon: création du message de bienvenue complet
      batch.set(welcomeRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
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

        textKey: "chat.systemWelcome",
        text: "",

        author: {
          uid: "system",
          displayName: "Moderation",
          role: "system",
        },

        visibility: "everyone",
      });
      ops++;

      // flag sur le chat
      batch.set(
        db.collection("chats").doc(chatId),
        { hasPinnedWelcome: true },
        { merge: true }
      );
      ops++;

      touched++;
      await safeCommit();
    }

    // commit le reliquat
    if (ops > 0) {
      await batch.commit();
    }

    if (touched || repaired) {
      console.log(`✅ Welcome créé sur ${touched} chat(s), réparé sur ${repaired} chat(s).`);
    } else {
      console.log("Tout est déjà propre, aucun backfill nécessaire.");
    }
  } catch (error) {
    console.error("❌ Erreur ensureWelcomeMessage:", error);
    process.exitCode = 1;
  }
}

ensureWelcomeMessage();
