import { StyleSheet } from "react-native";

// Interface commune pour lightTheme et darkTheme
export interface Theme {
  colors: {
    background: string;
    primary: string;
    secondary: string;
    cardBackground: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    overlay: string;
    error: string;
    trophy: string;
  };
  typography: {
    title: {
      fontSize: number;
      fontWeight: string;
      color: string;
      fontFamily: string;
    };
    subtitle: {
      fontSize: number;
      fontWeight: string;
      color: string;
      fontFamily: string;
    };
    body: {
      fontSize: number;
      fontWeight: string;
      color: string;
      fontFamily: string;
    };
    button: {
      fontSize: number;
      fontWeight: string;
      color: string;
      fontFamily: string;
    };
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  shapes: { borderRadius: number; cardBorderRadius: number };
  components: {
    challengeCard: {
      backgroundColor: string;
      borderRadius: number;
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    // Propriétés optionnelles pour éviter les conflits
    hero?: { overlay: string; logo: { width: number; height: number } };
    ctaButton?: {
      backgroundColor: string;
      borderRadius: number;
      paddingVertical: number;
      paddingHorizontal: number;
    };
    discoverButton?: {
      backgroundColor: string;
      borderRadius: number;
      paddingVertical: number;
      paddingHorizontal: number;
    };
    challengeOverlay?: {
      position: "absolute";
      top: number;
      left: number;
      right: number;
      bottom: number;
      backgroundColor: string;
      justifyContent: string;
      padding: number;
    };
    trophyBadge?: {
      position: "absolute";
      top: number;
      left: number;
      backgroundColor: string;
      borderRadius: number;
      paddingVertical: number;
      paddingHorizontal: number;
    };
    plusButton?: {
      position: "absolute";
      top: number;
      right: number;
      backgroundColor: string;
      borderRadius: number;
      padding: number;
    };
  };
}

// Thème Light
export const lightTheme: Theme = {
  colors: {
    background: "#e3e2e9",
    primary: "#ed8f03",
    secondary: "#e3701e",
    cardBackground: "#FFFFFF",
    border: "#E0E0E0",
    textPrimary: "#FFF",
    textSecondary: "#212121",
    overlay: "rgba(0,0,0,0.35)",
    error: "#D32F2F",
    trophy: "#FFD700",
  },
  typography: {
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: "#FFF",
      fontFamily: "Comfortaa_700Bold",
    },
    subtitle: {
      fontSize: 16,
      fontWeight: "400",
      color: "#FFF",
      fontFamily: "Comfortaa_400Regular",
    },
    body: {
      fontSize: 16,
      fontWeight: "400",
      color: "#212121",
      fontFamily: "Comfortaa_400Regular",
    },
    button: {
      fontSize: 18,
      fontWeight: "700",
      color: "#FFF",
      fontFamily: "Comfortaa_700Bold",
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  shapes: { borderRadius: 10, cardBorderRadius: 15 },
  components: {
    challengeCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },
    hero: { overlay: "rgba(0,0,0,0.35)", logo: { width: 180, height: 180 } },
    ctaButton: {
      backgroundColor: "#ed8f03",
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 25,
    },
    discoverButton: {
      backgroundColor: "#e3701e",
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
  },
};

// Thème Dark
export const darkTheme: Theme = {
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
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  shapes: { borderRadius: 8, cardBorderRadius: 12 },
  components: {
    challengeCard: {
      backgroundColor: "#1E1E1E",
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    challengeOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      justifyContent: "flex-end",
      padding: 16,
    },
    trophyBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "#FFC107",
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    plusButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "#9C254D",
      borderRadius: 8,
      padding: 8,
    },
  },
};

export default { lightTheme, darkTheme };
