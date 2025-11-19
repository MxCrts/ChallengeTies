export const achievementsList = {
  // ✅ Succès liés au nombre de défis terminés (EXISTANTS — inchangés)
  finishChallenge: {
    1: { name: "Premier défi complété", points: 10 },
    3: { name: "Débutant motivé", points: 15 },
    10: { name: "Sérieux dans ses défis", points: 20 },
    25: { name: "Machine à challenges", points: 30 },
    50: { name: "Imbattable !", points: 50 },
    100: { name: "Légende vivante", points: 100 },
  },

  // ✅ Durée sélectionnée d’un défi (EXISTANTS — inchangés)
  selectChallengeDays: {
    7: { name: "Petit joueur", points: 5 },
    30: { name: "Détermination", points: 10 },
    90: { name: "Marathonien", points: 20 },
    180: { name: "Le long terme, c'est mon truc", points: 30 },
    365: { name: "Le patient légendaire", points: 50 },
  },

  // ✅ Séries (EXISTANTS — inchangés)
  streakProgress: {
    3: { name: "Mini Streak", points: 5 },
    7: { name: "Routine en place", points: 10 },
    14: { name: "Impressionnant !", points: 15 },
    30: { name: "Détermination en béton", points: 25 },
    60: { name: "Rien ne peut m'arrêter", points: 40 },
    90: { name: "Je suis une machine", points: 60 },
    180: { name: "Discipline ultime", points: 100 },
    365: { name: "Je suis un monstre !", points: 150 },
  },

  // ✅ Messages envoyés (EXISTANTS + extensions)
  messageSent: {
    1: { name: "Premier message envoyé", points: 5 },
    10: { name: "Esprit d'équipe", points: 10 },
    50: { name: "Communauté active", points: 20 },
    100: { name: "Voix incontournable", points: 35 },     // NEW
    200: { name: "Pilier du chat", points: 60 },          // NEW
  },

  // ✅ Partages (EXISTANTS + extension palier intermédiaire)
  shareChallenge: {
    1: { name: "J'aime partager", points: 5 },
    5: { name: "Influenceur en herbe", points: 10 },
    10: { name: "Ambassadeur", points: 18 },              // NEW
    20: { name: "Meneur de communauté", points: 25 },
  },

  // ✅ Votes (EXISTANTS + extension)
  voteFeature: {
    1: { name: "Premier défi voté", points: 5 },
    5: { name: "J'aime voter !", points: 10 },
    10: { name: "Façonneur de produit", points: 20 },     // NEW
  },

  // ✅ Sauvegardes (EXISTANTS + extension)
  saveChallenge: {
    1: { name: "Défi sauvegardé", points: 5 },
    5: { name: "5 défis sauvegardés", points: 10 },
    10: { name: "Collectionneur", points: 20 },           // NEW
  },

  // ✅ Création de défis (EXISTANTS — inchangés)
  challengeCreated: {
    1: { name: "Créateur de défis", points: 10 },
    5: { name: "J’ai de l’inspiration", points: 20 },
    10: { name: "Innovateur", points: 40 },
  },

  // ✅ Uniques (EXISTANTS — inchangés)
  first_connection: { name: "Première connexion", points: 10 },
  profile_completed: { name: "Profil complété", points: 5 },

  // ─────────────────────────────────────────────────────────────
  // 🚀 AJOUTS "TOP 3 MONDIALE"
  // ─────────────────────────────────────────────────────────────

  // 🤝 Invitations acceptées (réseau/duo) — parrainage simple (acceptations)
  inviteFriend: {
    1: { name: "Première invitation acceptée", points: 15 },
    3: { name: "Mon cercle grandit", points: 30 },
    10: { name: "Capitaine d'équipe", points: 80 },
  },

  // 👥 Défis en DUO terminés
  finishDuoChallenge: {
    1: { name: "Victoire en duo", points: 15 },
    5: { name: "Duo solide", points: 35 },
    10: { name: "Âmes jumelles du challenge", points: 80 },
  },

  // 🔥 Streaks en DUO (jours consécutifs validés par les deux)
  duoStreak: {
    7: { name: "Synergie hebdo", points: 15 },
    30: { name: "Âme d'équipe", points: 50 },
  },

  // 🎯 Mois parfait (tous les jours du mois validés sur un défi actif)
  perfectMonth: {
    1: { name: "Mois parfait", points: 25 },
    3: { name: "Trilogie parfaite", points: 60 },
    6: { name: "Semestre invincible", points: 120 },
  },

  // 🗂️ Maîtrise de catégories (au moins 1 défi terminé dans X catégories distinctes)
  categoriesMastered: {
    3: { name: "Esprit polyvalent", points: 20 },
    5: { name: "Maître des domaines", points: 45 },
  },

  // 👥 Parrainage (inscriptions via ton code/lien — distinct des invitations duo)
  referralsRegistered: {
    1: { name: "Parrain", points: 15 },
    3: { name: "Mentor", points: 40 },
    5: { name: "Bâtisseur de communauté", points: 80 },
  },

  // 💬 Duo social (messages dans un chat de challenge/duo) — cumulé
  duoMessages: {
    20: { name: "Synchronisation parfaite", points: 15 },
    100: { name: "Alliance indestructible", points: 50 },
  },

  // 🧠 Série de jours "focus" (ex: challenge Focus/Deep Work)
  focusDays: {
    7: { name: "Concentration stable", points: 12 },
    21: { name: "Hyperfocus", points: 35 },
    42: { name: "Maître du focus", points: 80 },
  },

  // 🏅 Marathon de complétions (X jours d’affilée avec au moins 1 validation sur n’importe quel défi)
  dailyCompletion: {
    7: { name: "Héros de la constance", points: 12 },
    30: { name: "Inarrêtable", points: 45 },
    60: { name: "Titan de l'habitude", points: 100 },
  },

  // 🛠️ Créations approuvées ET adoptées (participantCount ≥ palier)
  challengeAdopted: {
    10: { name: "Idée qui prend", points: 20 },
    50: { name: "Tendance", points: 60 },
    100: { name: "Mouvement", points: 120 },
  },

  // 🏆 Événements spéciaux (placeholders pour events/seasonals)
  seasonal: {
    1: { name: "Édition spéciale complétée", points: 20 },
    3: { name: "Collectionneur d'évènements", points: 60 },
  },

  // 🔐 Anti-abandon : terminer un défi de 30+ jours sans aucune journée manquée
  zeroMissLongRun: {
    30: { name: "Discipline parfaite (30j)", points: 60 },
    60: { name: "Discipline parfaite (60j)", points: 120 },
  },
} as const;

export type AchievementsList = typeof achievementsList;
