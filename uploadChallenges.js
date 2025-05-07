const admin = require("firebase-admin");
const path = require("path");

// Initialiser le SDK Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
  storageBucket: "challengeme-d7fef.firebasestorage.app", // Assure-toi que ce nom correspond à ton bucket
});

const db = admin.firestore();

// Nom du bucket et dossier de stockage
const bucketName = "challengeme-d7fef.firebasestorage.app";
const storageFolder = "Challenges-Image";

// Fonction pour générer l'URL publique d'une image
function getFirebaseImageUrl(localPath) {
  const fileName = path.basename(localPath); // ex: "eat_healthy.png"
  const fullPath = `${storageFolder}/${fileName}`;
  const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
  return `${baseUrl}${encodeURIComponent(fullPath)}?alt=media`;
}

// Challenges à uploader (traduits en français)
const challenges = [
  {
    title: "Mangez sainement chaque jour",
    category: "Santé",
    description:
      "Engagez-vous à consommer des repas sains chaque jour pour améliorer votre bien-être.",
    imageUrl: getFirebaseImageUrl("assets/images/eat_healthy.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "eatHealthy",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Marchez 10 000 pas",
    category: "Fitness",
    description: "Restez actif en marchant 10 000 pas chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/walk_steps.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "walk10000Steps",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Économisez 5 $ par jour",
    category: "Finance",
    description:
      "Développez votre discipline financière en économisant 5 dollars chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/save_money.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "saveMoney",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Méditez pendant 10 minutes",
    category: "Mode De Vie",
    description:
      "Atteignez la pleine conscience en méditant seulement 10 minutes par jour.",
    imageUrl: getFirebaseImageUrl("assets/images/meditation.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "meditation",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Lisez 1 chapitre par jour",
    category: "Éducation",
    description:
      "Développez l'habitude de lire en terminant un chapitre chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/read_chapter.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "readChapter",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Écrivez 500 mots par jour",
    category: "Créativité",
    description:
      "Libérez votre potentiel créatif en écrivant 500 mots chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/write_words.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "writeWords",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Apprenez une nouvelle compétence",
    category: "Carrière",
    description:
      "Consacrez du temps chaque jour à l'apprentissage d'une nouvelle compétence pour votre développement professionnel.",
    imageUrl: getFirebaseImageUrl("assets/images/learn_skill.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnSkill",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Désencombrez votre espace",
    category: "Mode De Vie",
    description:
      "Libérez votre esprit en organisant et en désencombrant votre environnement chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/declutter_space.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "declutterSpace",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Pratiquez 15 minutes de yoga",
    category: "Fitness",
    description:
      "Renforcez votre corps et votre esprit en pratiquant 15 minutes de yoga chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/yoga.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyYoga",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Pratiquez la gratitude",
    category: "Mode De Vie",
    description:
      "Terminez votre journée en réfléchissant à ce pour quoi vous êtes reconnaissant.",
    imageUrl: getFirebaseImageUrl("assets/images/practice_gratitude.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "practiceGratitude",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Entraînez-vous",
    category: "Fitness",
    description:
      "Adoptez l'habitude de faire de l'exercice pendant au moins 15 minutes chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/workout.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "workout15Min",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Buvez 2 litres d'eau",
    category: "Santé",
    description: "Restez hydraté en buvant au moins 2 litres d'eau par jour.",
    imageUrl: getFirebaseImageUrl("assets/images/drink_water.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "drinkWater",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Planifiez demain ce soir",
    category: "Productivité",
    description: "Terminez chaque journée en planifiant celle du lendemain.",
    imageUrl: getFirebaseImageUrl("assets/images/plan_tomorrow.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "planTomorrow",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Routine d'étirement matinal",
    category: "Fitness",
    description: "Commencez votre journée par quelques étirements matinaux.",
    imageUrl: getFirebaseImageUrl("assets/images/stretch.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "morningStretch",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Passez 10 minutes dehors",
    category: "Mode De Vie",
    description:
      "Améliorez votre santé mentale en passant du temps à l'extérieur chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/outside.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "timeOutside",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Déconnectez-vous pendant 1 heure",
    category: "Mode De Vie",
    description: "Faites une pause des écrans pendant une heure chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/unplug.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "unplug",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Faites un compliment",
    category: "Social",
    description: "Égayez la journée de quelqu'un avec un compliment.",
    imageUrl: getFirebaseImageUrl("assets/images/compliment.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "compliment",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Réseautage quotidien",
    category: "Carrière",
    description:
      "Contactez chaque jour un professionnel pour élargir votre réseau.",
    imageUrl: getFirebaseImageUrl("assets/images/network.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "network",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Pratiquez la respiration profonde",
    category: "Santé",
    description:
      "Consacrez 5 minutes par jour à pratiquer la respiration profonde.",
    imageUrl: getFirebaseImageUrl("assets/images/deep_breathing.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "deepBreathing",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Réveillez-vous tôt",
    category: "Mode De Vie",
    description: "Adoptez l'habitude de vous réveiller tôt chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/wake_up_early.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "wakeUpEarly",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Apprenez une nouvelle langue",
    category: "Éducation",
    description:
      "Consacrez du temps chaque jour à apprendre une nouvelle langue.",
    imageUrl: getFirebaseImageUrl("assets/images/learn_language.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnLanguage",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Passez du temps de qualité en famille",
    category: "Social",
    description:
      "Consacrez du temps chaque jour pour renforcer les liens familiaux.",
    imageUrl: getFirebaseImageUrl("assets/images/family_time.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "familyTime",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Apprenez à jouer d'un instrument",
    category: "Créativité",
    description: "Consacrez du temps pour maîtriser un instrument de musique.",
    imageUrl: getFirebaseImageUrl("assets/images/play_instrument.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "playInstrument",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Affirmations positives",
    category: "Motivation",
    description:
      "Répétez des affirmations positives chaque jour pour renforcer votre état d'esprit.",
    imageUrl: getFirebaseImageUrl("assets/images/affirmations.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "positiveAffirmations",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Défi douche froide",
    category: "Santé",
    description:
      "Stimulez votre énergie et votre volonté en prenant une douche froide chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/cold-shower.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "coldShower",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Sans sucre pendant 30 jours",
    category: "Santé",
    description:
      "Éliminez les sucres ajoutés de votre alimentation pour adopter un mode de vie plus sain.",
    imageUrl: getFirebaseImageUrl("assets/images/no-sugar.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noSugar30Days",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Visualisation quotidienne",
    category: "Motivation",
    description: "Visualisez vos objectifs pendant 5 minutes chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/daily-visualization.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyVisualization",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Un geste de gentillesse quotidien",
    category: "Social",
    description: "Faites un geste de gentillesse aléatoire chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/act-of-kindness.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "kindnessAct",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Réveillez-vous à 5h",
    category: "Discipline",
    description: "Apprenez à vous lever à 5h du matin chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/wake-up-5.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "wakeUp5AM",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Une nouvelle recette par semaine",
    category: "Créativité",
    description:
      "Développez vos compétences culinaires en essayant une nouvelle recette chaque semaine.",
    imageUrl: getFirebaseImageUrl("assets/images/new-recipe.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "newRecipe",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Lisez 10 pages par jour",
    category: "Éducation",
    description: "Adoptez l'habitude de lire au moins 10 pages chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/read-10-pages.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "read10Pages",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Défi planche d'une minute",
    category: "Fitness",
    description:
      "Renforcez votre sangle abdominale en faisant une planche d'une minute chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/plank.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "oneMinPlank",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Apprenez un nouveau mot par jour",
    category: "Éducation",
    description:
      "Enrichissez votre vocabulaire en apprenant et en utilisant un nouveau mot chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/learn-word.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnWordDaily",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Sans caféine pendant 7 jours",
    category: "Santé",
    description:
      "Offrez à votre corps un redémarrage en éliminant la caféine pendant une semaine complète.",
    imageUrl: getFirebaseImageUrl("assets/images/no-caffeine.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noCaffeine",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Notez 3 réussites par jour",
    category: "Motivation",
    description:
      "Boostez votre confiance en listant trois réussites à la fin de chaque journée.",
    imageUrl: getFirebaseImageUrl("assets/images/3-wins.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyWins",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Parlez à un inconnu chaque jour",
    category: "Social",
    description:
      "Améliorez vos compétences sociales en entamant une conversation avec quelqu'un de nouveau chaque jour.",
    imageUrl: getFirebaseImageUrl("assets/images/talk-stranger.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "talkToStranger",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Défi garde-robe minimaliste",
    category: "Mode De Vie",
    description:
      "Ne portez que 33 vêtements pendant un mois complet pour adopter le minimalisme.",
    imageUrl: getFirebaseImageUrl("assets/images/minimalist-wardrobe.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "minimalistWardrobe",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Pas de plaintes pendant 21 jours",
    category: "État d'esprit",
    description:
      "Entraînez votre esprit à rester positif en évitant les plaintes pendant 21 jours consécutifs.",
    imageUrl: getFirebaseImageUrl("assets/images/no-complaints.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noComplaints",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Auto-réflexion quotidienne",
    category: "État d'esprit",
    description:
      "Prenez 5 minutes chaque soir pour réfléchir à vos pensées et à vos actions.",
    imageUrl: getFirebaseImageUrl("assets/images/self-reflection.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "selfReflection",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Investissez 30 minutes dans un loisir",
    category: "Développement Personnel",
    description:
      "Consacrez au moins 30 minutes par jour à un loisir qui vous rend heureux.",
    imageUrl: getFirebaseImageUrl("assets/images/hobby-30.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "hobbyTime",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Écoutez un podcast chaque jour",
    category: "Éducation",
    description:
      "Enrichissez vos connaissances en écoutant un podcast éducatif quotidiennement.",
    imageUrl: getFirebaseImageUrl("assets/images/poadcast.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "listenPodcast",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Réduisez l'utilisation du plastique",
    category: "Écologie",
    description:
      "Réduisez votre impact environnemental en évitant les plastiques à usage unique.",
    imageUrl: getFirebaseImageUrl("assets/images/reduce-plastic-use.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "reducePlastic",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Adoptez une bonne posture",
    category: "Santé",
    description:
      "Maintenez une posture correcte tout au long de la journée pour améliorer la santé de votre dos.",
    imageUrl: getFirebaseImageUrl("assets/images/good-posture.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "goodPosture",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Réduisez le temps d'écran la nuit",
    category: "Mode De Vie",
    description: "Évitez les écrans au moins 30 minutes avant de vous coucher.",
    imageUrl: getFirebaseImageUrl("assets/images/no-phone-bed.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "reduceScreenTime",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
];

const uploadChallenges = async () => {
  const batch = db.batch();
  const challengesCollection = db.collection("challenges");

  console.log("Début de l'upload des challenges...");

  challenges.forEach((challenge) => {
    const docId = challenge.title.replace(/\s+/g, "_").toLowerCase(); // ID basé sur le titre
    const docRef = challengesCollection.doc(docId);

    batch.set(docRef, {
      ...challenge,
      createdAt: admin.firestore.Timestamp.now(),
    });
  });

  try {
    await batch.commit();
    console.log("Challenges uploadés avec succès !");
  } catch (error) {
    console.error("Erreur lors de l'upload des challenges :", error);
  }
};

uploadChallenges();
