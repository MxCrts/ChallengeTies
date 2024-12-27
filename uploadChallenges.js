const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

// Challenges to upload
const challenges = [
  {
    title: "Eat Healthy Every Day",
    category: "health",
    description:
      "Commit to eating healthy meals every day for improved well-being.",
    imageUrl: "assets/images/eat_healthy.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "eatHealthy",
    participantsCount: 0,
  },
  {
    title: "Walk 10,000 Steps",
    category: "fitness",
    description: "Stay active by walking 10,000 steps daily.",
    imageUrl: "assets/images/walk_steps.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "walk10000Steps",
    participantsCount: 0,
  },
  {
    title: "Save $5 Daily",
    category: "finance",
    description: "Build financial discipline by saving $5 every day.",
    imageUrl: "assets/images/save_money.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "saveMoney",
    participantsCount: 0,
  },
  {
    title: "Meditate for 10 Minutes",
    category: "lifestyle",
    description: "Achieve mindfulness by meditating for just 10 minutes daily.",
    imageUrl: "assets/images/meditation.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "meditation",
    participantsCount: 0,
  },
  {
    title: "Read 1 Chapter a Day",
    category: "education",
    description: "Develop a reading habit by finishing one chapter daily.",
    imageUrl: "assets/images/read_chapter.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "readChapter",
    participantsCount: 0,
  },
  {
    title: "Write 500 Words a Day",
    category: "creativity",
    description: "Unlock your creative potential by writing 500 words daily.",
    imageUrl: "assets/images/write_words.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "writeWords",
    participantsCount: 0,
  },
  {
    title: "Learn a New Skill",
    category: "career",
    description:
      "Dedicate time daily to learning a new skill for professional growth.",
    imageUrl: "assets/images/learn_skill.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "learnSkill",
    participantsCount: 0,
  },
  {
    title: "Declutter Your Space",
    category: "lifestyle",
    description:
      "Clear your mind by organizing and decluttering your surroundings daily.",
    imageUrl: "assets/images/declutter_space.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "declutterSpace",
    participantsCount: 0,
  },
  {
    title: "Do 15 Minutes of Yoga",
    category: "fitness",
    description: "Strengthen your body and mind with 15 minutes of yoga daily.",
    imageUrl: "assets/images/yoga.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "dailyYoga",
    participantsCount: 0,
  },
  {
    title: "Practice Gratitude",
    category: "lifestyle",
    description:
      "End your day with gratitude by reflecting on what you're thankful for.",
    imageUrl: "assets/images/practice_gratitude.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "practiceGratitude",
    participantsCount: 0,
  },
  {
    title: "Workout",
    category: "fitness",
    description: "Build a habit of working out at least 15 minutes every day.",
    imageUrl: "assets/images/workout.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "workout15Min",
    participantsCount: 0,
  },
  {
    title: "Drink 2 Liters of Water",
    category: "health",
    description: "Stay hydrated by drinking at least 2 liters of water daily.",
    imageUrl: "assets/images/drink_water.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "drinkWater",
    participantsCount: 0,
  },
  {
    title: "Plan Tomorrow Tonight",
    category: "productivity",
    description: "End each day by planning for tomorrow.",
    imageUrl: "assets/images/plan_tomorrow.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "planTomorrow",
    participantsCount: 0,
  },
  {
    title: "Morning Stretch Routine",
    category: "fitness",
    description: "Start your day with a quick morning stretch.",
    imageUrl: "assets/images/stretch.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "morningStretch",
    participantsCount: 0,
  },
  {
    title: "Spend 10 Minutes Outside",
    category: "lifestyle",
    description: "Improve your mental health by spending time outdoors daily.",
    imageUrl: "assets/images/outside.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "timeOutside",
    participantsCount: 0,
  },
  {
    title: "Unplug for 1 Hour",
    category: "lifestyle",
    description: "Take a break from screens for one hour every day.",
    imageUrl: "assets/images/unplug.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "unplug",
    participantsCount: 0,
  },
  {
    title: "Compliment Someone",
    category: "social",
    description: "Brighten someone’s day with a compliment.",
    imageUrl: "assets/images/compliment.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "compliment",
    participantsCount: 0,
  },
  {
    title: "Network Daily",
    category: "career",
    description: "Reach out to one professional contact daily.",
    imageUrl: "assets/images/network.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "network",
    participantsCount: 0,
  },
  {
    title: "Practice Deep Breathing",
    category: "health",
    description: "Take 5 minutes to practice deep breathing daily.",
    imageUrl: "assets/images/deep_breathing.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "deepBreathing",
    participantsCount: 0,
  },
  {
    title: "Wake Up Early",
    category: "lifestyle",
    description: "Develop a habit of waking up early every day.",
    imageUrl: "assets/images/wake_up_early.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "wakeUpEarly",
    participantsCount: 0,
  },
  {
    title: "Learn a New Language",
    category: "education",
    description: "Spend time daily learning a new language.",
    imageUrl: "assets/images/learn_language.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "learnLanguage",
    participantsCount: 0,
  },
  {
    title: "Spend Quality Family Time",
    category: "social",
    description: "Dedicate time to bonding with family every day.",
    imageUrl: "assets/images/family_time.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "familyTime",
    participantsCount: 0,
  },
  {
    title: "Learn to Play an Instrument",
    category: "creativity",
    description: "Spend time mastering a musical instrument.",
    imageUrl: "assets/images/play_instrument.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "playInstrument",
    participantsCount: 0,
  },
  {
    title: "Positive Affirmations",
    category: "motivation",
    description:
      "Repeat positive affirmations every day to boost your mindset.",
    imageUrl: "assets/images/affirmations.png",
    daysOptions: Array.from({ length: 365 }, (_, i) => i + 1),
    chatId: "positiveAffirmations",
    participantsCount: 0,
  },
];

const uploadChallenges = async () => {
  const batch = db.batch();
  const challengesCollection = db.collection("challenges");

  challenges.forEach((challenge) => {
    const docRef = challengesCollection.doc(); // Auto-generate ID
    batch.set(docRef, challenge);
  });

  try {
    await batch.commit();
    console.log("Challenges uploaded successfully!");
  } catch (error) {
    console.error("Error uploading challenges:", error);
  }
};

uploadChallenges();
