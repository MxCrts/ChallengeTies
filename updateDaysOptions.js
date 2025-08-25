const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

const newDaysOptions = [3, 7, 15, 21, 30, 60, 90, 180, 365];

async function updateAllChallenges() {
  const challengesRef = db.collection('challenges');
  const snapshot = await challengesRef.get();

  if (snapshot.empty) {
    console.log('❌ Aucun challenge trouvé.');
    return;
  }

  console.log(`🔍 ${snapshot.size} challenges trouvés. Mise à jour en cours...`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    try {
      await challengesRef.doc(id).update({
        daysOptions: newDaysOptions,
      });
      console.log(`✅ Challenge "${id}" mis à jour`);
      updated++;
    } catch (err) {
      console.error(`❌ Erreur sur "${id}" :`, err.message);
    }
  }

  console.log(`\n🎉 Terminé. ${updated} challenges mis à jour.`);
}

updateAllChallenges();
