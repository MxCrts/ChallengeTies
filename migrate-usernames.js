/**
 * migrate-usernames.js
 *
 * Backfill la collection `usernames/` pour tous les users existants.
 *
 * Usage :
 *   node migrate-usernames.js                  → dry-run (aucune écriture)
 *   node migrate-usernames.js --write          → écrit pour de vrai
 *   node migrate-usernames.js --write --limit=50  → batch limité (test)
 *
 * Prérequis :
 *   npm install firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   (ou placer serviceAccountKey.json dans le même dossier)
 */

const admin = require("firebase-admin");
const path  = require("path");
const fs    = require("fs");

// ─── Init Firebase Admin ──────────────────────────────────────────────────────
const keyPath = path.join(__dirname, "serviceAccountKey.json");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(keyPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// ─── Args ─────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = !args.includes("--write");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT   = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ─── Normalisation (identique à usernameService.ts) ──────────────────────────
const normalizeUsername = (raw) =>
  (raw || "").trim().toLowerCase().replace(/\s+/g, "_");

// ─── Batch writer helper ──────────────────────────────────────────────────────
// Firestore limite à 500 ops par batch
async function commitBatch(batch, count) {
  if (count === 0) return;
  if (!DRY_RUN) await batch.commit();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔧  migrate-usernames.js`);
  console.log(`   mode        : ${DRY_RUN ? "DRY-RUN (aucune écriture)" : "⚠️  WRITE"}`);
  console.log(`   limit       : ${LIMIT === Infinity ? "tous les users" : LIMIT}`);
  console.log(`─────────────────────────────────────────────\n`);

  // Stats
  let total      = 0;
  let skipped    = 0; // username déjà dans usernames/ (autre uid)
  let conflict   = 0; // username déjà pris par un uid différent
  let written    = 0;
  let noUsername = 0; // users sans username
  let processed  = 0;

  // Lecture de tous les users (paginated par 500)
  let query = db.collection("users").orderBy("createdAt").limit(500);
  let lastDoc = null;
  let batch = db.batch();
  let batchCount = 0;

  while (true) {
    const snap = lastDoc
      ? await query.startAfter(lastDoc).get()
      : await query.get();

    if (snap.empty) break;

    for (const userDoc of snap.docs) {
      if (processed >= LIMIT) break;
      processed++;
      total++;

      const data = userDoc.data();
      const uid  = userDoc.id;
      const rawUsername = data.username || "";

      if (!rawUsername || rawUsername.trim().length < 2) {
        noUsername++;
        console.log(`  ⚠️  ${uid} — pas de username, ignoré`);
        continue;
      }

      const key = normalizeUsername(rawUsername);
      const usernameRef = db.collection("usernames").doc(key);

      // Vérifie si déjà réservé
      const existing = await usernameRef.get();

      if (existing.exists) {
        const existingUid = existing.data()?.uid;
        if (existingUid === uid) {
          // Déjà bon — idempotent
          skipped++;
          console.log(`  ✅  ${key} → déjà réservé par le bon uid, skip`);
        } else {
          // Conflit : deux users avec le même username normalisé
          conflict++;
          console.warn(
            `  ❌  CONFLIT : "${key}" déjà pris par ${existingUid}, user ${uid} (${rawUsername}) ignoré`
          );
        }
        continue;
      }

      // Pas encore réservé → on écrit
      const payload = {
        uid,
        createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (DRY_RUN) {
        console.log(`  📝  [DRY] usernames/${key} → { uid: ${uid} }`);
      } else {
        batch.set(usernameRef, payload);
        batchCount++;
        console.log(`  ✍️  usernames/${key} → { uid: ${uid} }`);
      }
      written++;

      // Commit par tranche de 499
      if (batchCount >= 499) {
        await commitBatch(batch, batchCount);
        console.log(`  💾  Batch de ${batchCount} ops commité`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 500 || processed >= LIMIT) break;
  }

  // Commit du dernier batch
  if (batchCount > 0) {
    await commitBatch(batch, batchCount);
    console.log(`  💾  Batch final de ${batchCount} ops commité`);
  }

  // ─── Rapport ────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`✅  Migration terminée`);
  console.log(`   Total users lus    : ${total}`);
  console.log(`   Écrits             : ${written}${DRY_RUN ? " (dry-run, rien écrit)" : ""}`);
  console.log(`   Déjà OK (skip)     : ${skipped}`);
  console.log(`   Sans username      : ${noUsername}`);
  console.log(`   Conflits (⚠️ check): ${conflict}`);

  if (conflict > 0) {
    console.warn(`\n⚠️  ${conflict} conflit(s) détecté(s).`);
    console.warn(`   Ces users ont le même username normalisé qu'un autre compte.`);
    console.warn(`   Tu devras les gérer manuellement (ex: ajouter un suffixe).`);
  }

  if (DRY_RUN) {
    console.log(`\n💡  C'était un dry-run. Lance avec --write pour appliquer.`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
