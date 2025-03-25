import { StyleSheet } from "react-native";

// ==============================
// THÈMES LUMINEUX ET SOMBRES
// ==============================

// Thème Light – inspiré de l'apparence de votre page index.tsx
export const lightTheme = {
  colors: {
    // Fond de la page identique à celui de l'index
    background: "#e3e2e9",
    // Couleur principale utilisée pour le CTA (bouton du HERO)
    primary: "#ed8f03",
    // Couleur secondaire pour les boutons de la section "Inspire-toi"
    secondary: "#e3701e",
    // Fond des cartes (défis)
    cardBackground: "#FFFFFF",
    // Pour les bordures, si nécessaire
    border: "#E0E0E0",
    // Couleurs de texte
    textPrimary: "#FFF", // Titres du HERO et texte sur les boutons (blanc)
    textSecondary: "#212121",
    // Couleur de l'overlay utilisé sur la vidéo ou les cartes
    overlay: "rgba(0,0,0,0.35)",
    // Couleur d'erreur (si besoin)
    error: "#D32F2F",
    // Couleur pour les trophées
    trophy: "#FFD700",
  },
  typography: {
    // Pour les titres (ex. heroTitle)
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: "#FFF",
      fontFamily: "Comfortaa_700Bold",
    },
    // Pour les sous-titres (ex. heroSubtitle)
    subtitle: {
      fontSize: 16,
      fontWeight: "400",
      color: "#FFF",
      fontFamily: "Comfortaa_400Regular",
    },
    // Pour le corps du texte sur les cartes, etc.
    body: {
      fontSize: 16,
      fontWeight: "400",
      color: "#212121",
      fontFamily: "Comfortaa_400Regular",
    },
    // Pour les textes des boutons
    button: {
      fontSize: 18,
      fontWeight: "700",
      color: "#FFF",
      fontFamily: "Comfortaa_700Bold",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  shapes: {
    // Pour les boutons du HERO, par exemple
    borderRadius: 10,
    // Pour les cartes de défis (utilisées dans index.tsx : borderRadius 15)
    cardBorderRadius: 15,
  },
  components: {
    // Style global de la section HERO
    hero: {
      // La vidéo de fond est recouverte par un overlay semi-transparent
      overlay: "rgba(0,0,0,0.35)",
      // Taille du logo
      logo: { width: 180, height: 180 },
    },
    // Bouton CTA du HERO
    ctaButton: {
      backgroundColor: "#ed8f03",
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 25,
    },
    // Carte de défi
    challengeCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },
    // Bouton de la section "Inspire-toi"
    discoverButton: {
      backgroundColor: "#e3701e",
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
  },
};

// Thème Dark – exemple fourni (vous pouvez l'ajuster si besoin)
export const darkTheme = {
  colors: {
    primary: "#9C254D",
    secondary: "#FFDD95",
    background: "#121212",
    cardBackground: "#1E1E1E",
    border: "#272727",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0BEC5",
    error: "#EF5350",
    trophy: "#FFC107",
    overlay: "rgba(255,255,255,0.1)",
  },
  typography: {
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: "#FFFFFF",
      fontFamily: "Roboto_700Bold",
    },
    subtitle: {
      fontSize: 24,
      fontWeight: "600",
      color: "#FFFFFF",
      fontFamily: "Roboto_600SemiBold",
    },
    body: {
      fontSize: 16,
      fontWeight: "400",
      color: "#B0BEC5",
      fontFamily: "Roboto_400Regular",
    },
    button: {
      fontSize: 18,
      fontWeight: "700",
      color: "#FFFFFF",
      fontFamily: "Roboto_700Bold",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  shapes: {
    borderRadius: 8,
    cardBorderRadius: 12,
  },
  components: {
    challengeCard: {
      backgroundColor: "#1E1E1E",
      borderRadius: 12,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    challengeOverlay: {
      position: "absolute" as "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      justifyContent: "flex-end",
      padding: 16,
    },
    trophyBadge: {
      position: "absolute" as "absolute",
      top: 8,
      left: 8,
      backgroundColor: "#FFC107",
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    plusButton: {
      position: "absolute" as "absolute",
      top: 8,
      right: 8,
      backgroundColor: "#9C254D",
      borderRadius: 8,
      padding: 8,
    },
  },
};

export default {
  lightTheme,
  darkTheme,
};
