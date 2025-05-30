import React, { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

interface OnboardingMusicProviderProps {
  children: React.ReactNode;
}

const OnboardingMusicProvider: React.FC<OnboardingMusicProviderProps> = ({
  children,
}) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Charger et jouer la musique
    const loadAndPlay = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/audio/intro-music.mp3"), // Assurez-vous d'avoir ce fichier
          { shouldPlay: true, isLooping: true, volume: 0.5 }
        );
        soundRef.current = sound;
        setIsLoaded(true);
      } catch (error) {
        console.error(
          "Erreur lors du chargement de la musique d'onboarding :",
          error
        );
      }
    };

    loadAndPlay();

    // Nettoyage à la fermeture
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return <>{children}</>;
};

export default OnboardingMusicProvider;
