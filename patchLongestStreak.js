/**
 * patch_longest_streak.js
 * Script one-shot — calcule et écrit longestStreak sur tous les users Firestore
 * Usage : node patch_longest_streak.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Helper : parse une key quelle que soit sa forme (YYYYMMDD ou YYYY-MM-DD)
function parseKey(key) {
  if (!key) return null;
  const s = String(key).replace(/-/g, "");
  if (s.length !== 8) return null;
  return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00Z`);
}

// ── Helper : calcule le longest streak depuis un tableau de completionDateKeys
function computeLongestStreak(allKeys) {
  if (!allKeys || allKeys.length === 0) return 0;

  const dates = allKeys
    .map(parseKey)
    .filter(Boolean)
    .map(d => d.getTime());

  // Déduplique et trie
  const sorted = [...new Set(dates)].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;

  let maxStreak = 1;
  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((sorted[i] - sorted[i - 1]) / 86400000);
    if (diffDays === 1) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 1;
    }
  }

  return maxStreak;
}

async function patchAllUsers() {
  console.log("🔍 Chargement de tous les users...");

  const snapshot = await db.collection("users").get();
  console.log(`📊 ${snapshot.size} users trouvés`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of snapshot.docs) {
    try {
      const data = userDoc.data();
      const uid = userDoc.id;

      const currentLongest = Number(data?.longestStreak ?? 0);

      const allChallenges = [
        ...(Array.isArray(data?.CurrentChallenges) ? data.CurrentChallenges : []),
        ...(Array.isArray(data?.CompletedChallenges) ? data.CompletedChallenges : []),
      ];

      let bestStreak = 0;

      for (const ch of allChallenges) {
        const keys = Array.isArray(ch?.completionDateKeys)
          ? ch.completionDateKeys
          : [];
        if (keys.length === 0) continue;
        const streak = computeLongestStreak(keys);
        if (streak > bestStreak) bestStreak = streak;
      }

      if (bestStreak > currentLongest) {
        await userDoc.ref.update({ longestStreak: bestStreak });
        console.log(`✅ ${data?.username ?? uid} : ${currentLongest} → ${bestStreak}`);
        updated++;
      } else {
        console.log(`⏭️  ${data?.username ?? uid} : déjà correct (${currentLongest})`);
        skipped++;
      }
    } catch (e) {
      console.error(`❌ Erreur sur user ${userDoc.id}:`, e.message);
      errors++;
    }
  }

  console.log("\n─────────────────────────────────");
  console.log(`✅ Mis à jour : ${updated}`);
  console.log(`⏭️  Déjà corrects : ${skipped}`);
  console.log(`❌ Erreurs : ${errors}`);
  console.log("─────────────────────────────────");
  process.exit(0);
}

patchAllUsers().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
