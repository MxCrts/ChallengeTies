export const achievementsList = {
  // ✅ Succès liés au nombre de défis terminés
  finishChallenge: {
    1: { name: "Premier défi complété", points: 10 },
    3: { name: "Débutant motivé", points: 15 },
    10: { name: "Sérieux dans ses défis", points: 20 },
    25: { name: "Machine à challenges", points: 30 },
    50: { name: "Imbattable !", points: 50 },
    100: { name: "Légende vivante", points: 100 },
  },

  // ✅ Succès liés à la durée sélectionnée d’un défi
  selectChallengeDays: {
    7: { name: "Petit joueur", points: 5 },
    30: { name: "Détermination", points: 10 },
    90: { name: "Marathonien", points: 20 },
    180: { name: "Le long terme, c'est mon truc", points: 30 },
    365: { name: "Le patient légendaire", points: 50 },
  },

  // ✅ Succès liés aux séries de complétion de défis (Streak)
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

  // ✅ Succès liés à l'interaction avec la communauté (messages envoyés)
  messageSent: {
    1: { name: "Premier message envoyé", points: 5 },
    10: { name: "Esprit d'équipe", points: 10 },
    50: { name: "Communauté active", points: 20 },
  },

  // ✅ Succès liés aux partages de défis
  shareChallenge: {
    1: { name: "J'aime partager", points: 5 },
    5: { name: "Influenceur en herbe", points: 10 },
    20: { name: "Meneur de communauté", points: 25 },
  },

  // ✅ Succès liés aux votes pour les nouvelles fonctionnalités
  voteFeature: {
    1: { name: "Premier défi voté", points: 5 },
    5: { name: "J'aime voter !", points: 10 },
  },

  // ✅ Succès liés aux défis sauvegardés
  saveChallenge: {
    1: { name: "Défi sauvegardé", points: 5 },
    5: { name: "5 défis sauvegardés", points: 10 },
  },

  // ✅ Succès liés aux défis créés par l'utilisateur
  challengeCreated: {
    1: { name: "Créateur de défis", points: 10 },
    5: { name: "J’ai de l’inspiration", points: 20 },
    10: { name: "Innovateur", points: 40 },
  },

  // ✅ Succès **uniques** liés à l'inscription et la complétion du profil
  first_connection: { name: "Première connexion", points: 10 },
  profile_completed: { name: "Profil complété", points: 5 },
};
