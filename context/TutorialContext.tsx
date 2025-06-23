import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TutorialContextType = {
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (isActive: boolean) => void; // Add this line
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
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isTutorialActive, setIsTutorialActive] = useState(isFirstLaunch);
  const router = useRouter();

  useEffect(() => {
    const checkTutorialStatus = async () => {
      const hasCompletedTutorial = await AsyncStorage.getItem(
        "hasCompletedTutorialAfterSignup"
      );
      console.log("Tutorial Status:", {
        isFirstLaunch,
        hasCompletedTutorial,
        isTutorialActive,
        tutorialStep,
      });
      if (!hasCompletedTutorial && isFirstLaunch) {
        setIsTutorialActive(true);
        setTutorialStep(0);
      }
    };
    checkTutorialStatus();
  }, [isFirstLaunch]);

  const startTutorial = async () => {
    setTutorialStep(1);
    setIsTutorialActive(true);
    try {
      await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du tutoriel :", error);
    }
  };

  const skipTutorial = async () => {
    setTutorialStep(0);
    setIsTutorialActive(false);
    try {
      await AsyncStorage.setItem("hasCompletedTutorialAfterSignup", "true");
      router.replace("/"); // Redirection explicite
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du tutoriel :", error);
    }
  };

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
      if (tutorialStep === 0 || tutorialStep === 1) navigateWithDelay("/");
      else if (tutorialStep === 2) navigateWithDelay("/profile");
      else if (tutorialStep === 3) navigateWithDelay("/focus");
      else if (tutorialStep === 4) navigateWithDelay("/explore");
    }
  }, [tutorialStep, isTutorialActive, router]);

  return (
    <TutorialContext.Provider
      value={{
        tutorialStep,
        setTutorialStep,
        isTutorialActive,
        setIsTutorialActive, // Add this to the context value
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
