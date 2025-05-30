import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TutorialContextType = {
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  isTutorialActive: boolean;
  startTutorial: () => void;
  skipTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined
);

export const TutorialProvider = ({
  children,
  isFirstLaunch,
}: {
  children: React.ReactNode;
  isFirstLaunch: boolean;
}) => {
  const [tutorialStep, setTutorialStep] = useState(0); // 0 = pas commencé, 1-4 = étapes
  const [isTutorialActive, setIsTutorialActive] = useState(isFirstLaunch); // Dépend de l'appel de startTutorial
  const router = useRouter();

  // Lancer le tutoriel
  const startTutorial = async () => {
    setTutorialStep(1);
    setIsTutorialActive(true);
    // On s'assure que le flag n'est pas défini avant de commencer
    try {
      await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du tutoriel :", error);
    }
  };

  // Passer ou terminer le tutoriel
  const skipTutorial = async () => {
    setTutorialStep(0);
    setIsTutorialActive(false);
    try {
      await AsyncStorage.setItem("hasCompletedTutorialAfterSignup", "true");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du tutoriel :", error);
    }
  };

  // Navigation automatique selon l'étape
  useEffect(() => {
    const navigateWithDelay = (path: string) => {
      setTimeout(() => {
        try {
          router.replace(path);
        } catch (error) {
          console.error("Erreur de navigation :", error);
        }
      }, 100);
    };

    if (isTutorialActive) {
      if (tutorialStep === 1) navigateWithDelay("/");
      else if (tutorialStep === 2) navigateWithDelay("/profile");
      else if (tutorialStep === 3) navigateWithDelay("/focus");
      else if (tutorialStep === 4) navigateWithDelay("/explore");
      else if (tutorialStep === 0) navigateWithDelay("/"); // Fin → retour à Index
    }
  }, [tutorialStep, isTutorialActive, router]);

  return (
    <TutorialContext.Provider
      value={{
        tutorialStep,
        setTutorialStep,
        isTutorialActive,
        startTutorial,
        skipTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
};
