const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
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

// Challenges à uploader
const challenges = [
  {
    title: "Eat Healthy Every Day",
    category: "health",
    description:
      "Commit to eating healthy meals every day for improved well-being.",
    imageUrl: getFirebaseImageUrl("assets/images/eat_healthy.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "eatHealthy",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Walk 10,000 Steps",
    category: "fitness",
    description: "Stay active by walking 10,000 steps daily.",
    imageUrl: getFirebaseImageUrl("assets/images/walk_steps.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "walk10000Steps",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Save $5 Daily",
    category: "finance",
    description: "Build financial discipline by saving $5 every day.",
    imageUrl: getFirebaseImageUrl("assets/images/save_money.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "saveMoney",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Meditate for 10 Minutes",
    category: "lifestyle",
    description: "Achieve mindfulness by meditating for just 10 minutes daily.",
    imageUrl: getFirebaseImageUrl("assets/images/meditation.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "meditation",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Read 1 Chapter a Day",
    category: "education",
    description: "Develop a reading habit by finishing one chapter daily.",
    imageUrl: getFirebaseImageUrl("assets/images/read_chapter.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "readChapter",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Write 500 Words a Day",
    category: "creativity",
    description: "Unlock your creative potential by writing 500 words daily.",
    imageUrl: getFirebaseImageUrl("assets/images/write_words.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "writeWords",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Learn a New Skill",
    category: "career",
    description:
      "Dedicate time daily to learning a new skill for professional growth.",
    imageUrl: getFirebaseImageUrl("assets/images/learn_skill.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnSkill",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Declutter Your Space",
    category: "lifestyle",
    description:
      "Clear your mind by organizing and decluttering your surroundings daily.",
    imageUrl: getFirebaseImageUrl("assets/images/declutter_space.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "declutterSpace",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Do 15 Minutes of Yoga",
    category: "fitness",
    description: "Strengthen your body and mind with 15 minutes of yoga daily.",
    imageUrl: getFirebaseImageUrl("assets/images/yoga.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyYoga",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Practice Gratitude",
    category: "lifestyle",
    description:
      "End your day with gratitude by reflecting on what you're thankful for.",
    imageUrl: getFirebaseImageUrl("assets/images/practice_gratitude.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "practiceGratitude",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Workout",
    category: "fitness",
    description: "Build a habit of working out at least 15 minutes every day.",
    imageUrl: getFirebaseImageUrl("assets/images/workout.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "workout15Min",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Drink 2 Liters of Water",
    category: "health",
    description: "Stay hydrated by drinking at least 2 liters of water daily.",
    imageUrl: getFirebaseImageUrl("assets/images/drink_water.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "drinkWater",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Plan Tomorrow Tonight",
    category: "productivity",
    description: "End each day by planning for tomorrow.",
    imageUrl: getFirebaseImageUrl("assets/images/plan_tomorrow.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "planTomorrow",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Morning Stretch Routine",
    category: "fitness",
    description: "Start your day with a quick morning stretch.",
    imageUrl: getFirebaseImageUrl("assets/images/stretch.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "morningStretch",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Spend 10 Minutes Outside",
    category: "lifestyle",
    description: "Improve your mental health by spending time outdoors daily.",
    imageUrl: getFirebaseImageUrl("assets/images/outside.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "timeOutside",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Unplug for 1 Hour",
    category: "lifestyle",
    description: "Take a break from screens for one hour every day.",
    imageUrl: getFirebaseImageUrl("assets/images/unplug.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "unplug",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Compliment Someone",
    category: "social",
    description: "Brighten someone’s day with a compliment.",
    imageUrl: getFirebaseImageUrl("assets/images/compliment.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "compliment",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Network Daily",
    category: "career",
    description: "Reach out to one professional contact daily.",
    imageUrl: getFirebaseImageUrl("assets/images/network.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "network",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Practice Deep Breathing",
    category: "health",
    description: "Take 5 minutes to practice deep breathing daily.",
    imageUrl: getFirebaseImageUrl("assets/images/deep_breathing.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "deepBreathing",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Wake Up Early",
    category: "lifestyle",
    description: "Develop a habit of waking up early every day.",
    imageUrl: getFirebaseImageUrl("assets/images/wake_up_early.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "wakeUpEarly",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Learn a New Language",
    category: "education",
    description: "Spend time daily learning a new language.",
    imageUrl: getFirebaseImageUrl("assets/images/learn_language.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnLanguage",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Spend Quality Family Time",
    category: "social",
    description: "Dedicate time to bonding with family every day.",
    imageUrl: getFirebaseImageUrl("assets/images/family_time.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "familyTime",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Learn to Play an Instrument",
    category: "creativity",
    description: "Spend time mastering a musical instrument.",
    imageUrl: getFirebaseImageUrl("assets/images/play_instrument.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "playInstrument",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Positive Affirmations",
    category: "motivation",
    description:
      "Repeat positive affirmations every day to boost your mindset.",
    imageUrl: getFirebaseImageUrl("assets/images/affirmations.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "positiveAffirmations",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Cold Shower Challenge",
    category: "health",
    description:
      "Boost your energy and willpower by taking a cold shower every day.",
    imageUrl: getFirebaseImageUrl("assets/images/cold-shower.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "coldShower",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "No Sugar for 30 Days",
    category: "health",
    description:
      "Eliminate added sugars from your diet for a healthier lifestyle.",
    imageUrl: getFirebaseImageUrl("assets/images/no-sugar.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noSugar30Days",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Daily Visualization",
    category: "motivation",
    description: "Visualize your goals for 5 minutes every day.",
    imageUrl: getFirebaseImageUrl("assets/images/daily-visualization.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyVisualization",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "One Act of Kindness Daily",
    category: "social",
    description: "Perform a random act of kindness every day.",
    imageUrl: getFirebaseImageUrl("assets/images/act-of-kindness.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "kindnessAct",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Wake Up at 5 AM",
    category: "discipline",
    description: "Train yourself to wake up at 5 AM every morning.",
    imageUrl: getFirebaseImageUrl("assets/images/wake-up-5.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "wakeUp5AM",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "One New Recipe Per Week",
    category: "creativity",
    description:
      "Expand your cooking skills by trying a new recipe every week.",
    imageUrl: getFirebaseImageUrl("assets/images/new-recipe.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "newRecipe",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Read 10 Pages Per Day",
    category: "education",
    description: "Develop the habit of reading at least 10 pages daily.",
    imageUrl: getFirebaseImageUrl("assets/images/read-10-pages.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "read10Pages",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "One-Minute Plank Challenge",
    category: "fitness",
    description: "Strengthen your core by doing a one-minute plank daily.",
    imageUrl: getFirebaseImageUrl("assets/images/plank.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "oneMinPlank",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Learn One New Word Per Day",
    category: "education",
    description:
      "Expand your vocabulary by learning and using a new word daily.",
    imageUrl: getFirebaseImageUrl("assets/images/learn-word.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "learnWordDaily",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "No Caffeine for 7 Days",
    category: "health",
    description:
      "Give your body a reset by eliminating caffeine for a full week.",
    imageUrl: getFirebaseImageUrl("assets/images/no-caffeine.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noCaffeine",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Write Down 3 Wins Daily",
    category: "motivation",
    description:
      "Boost your confidence by listing three wins at the end of each day.",
    imageUrl: getFirebaseImageUrl("assets/images/3-wins.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "dailyWins",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Talk to a Stranger Every Day",
    category: "social",
    description:
      "Improve your social skills by starting a conversation with someone new daily.",
    imageUrl: getFirebaseImageUrl("assets/images/talk-stranger.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "talkToStranger",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Minimalist Wardrobe Challenge",
    category: "lifestyle",
    description:
      "Wear only 33 items of clothing for a full month to embrace minimalism.",
    imageUrl: getFirebaseImageUrl("assets/images/minimalist-wardrobe.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "minimalistWardrobe",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "No Complaints for 21 Days",
    category: "mindset",
    description:
      "Train your mind to stay positive by avoiding complaints for 21 days straight.",
    imageUrl: getFirebaseImageUrl("assets/images/no-complaints.jpg"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "noComplaints",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Daily Self-Reflection",
    category: "mindset",
    description:
      "Spend 5 minutes every evening reflecting on your thoughts and actions.",
    imageUrl: getFirebaseImageUrl("assets/images/self-reflection.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "selfReflection",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Invest 30 Minutes in a Hobby",
    category: "personal growth",
    description:
      "Spend at least 30 minutes daily on a hobby that makes you happy.",
    imageUrl: getFirebaseImageUrl("assets/images/hobby-30.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "hobbyTime",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Listen to a Podcast Every Day",
    category: "education",
    description:
      "Expand your knowledge by listening to an educational podcast daily.",
    imageUrl: getFirebaseImageUrl("assets/images/poadcast.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "listenPodcast",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Reduce Plastic Use",
    category: "sustainability",
    description:
      "Reduce your environmental impact by avoiding single-use plastics.",
    imageUrl: getFirebaseImageUrl("assets/images/reduce-plastic-use.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "reducePlastic",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Practice Good Posture",
    category: "health",
    description:
      "Maintain a good posture throughout the day for improved back health.",
    imageUrl: getFirebaseImageUrl("assets/images/good-posture.png"),
    daysOptions: [7, 15, 21, 30, 60, 90, 180, 365],
    chatId: "goodPosture",
    participantsCount: 0,
    usersTakingChallenge: [],
  },
  {
    title: "Reduce Screen Time at Night",
    category: "lifestyle",
    description: "Avoid screens at least 30 minutes before bedtime.",
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
