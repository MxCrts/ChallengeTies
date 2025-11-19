// context/TutorialContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TutorialContextType = {
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (isActive: boolean) => void;
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
  const [isTutorialActive, setIsTutorialActive] = useState(false);

  // 🔍 Au tout premier lancement après signup, on peut auto-proposer le tuto
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
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
          setTutorialStep(0); // 👉 commence bien sur l'écran "welcome"
        }
      } catch (e) {
        console.warn("checkTutorialStatus error", e);
      }
    };
    checkTutorialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstLaunch]);

  // 🚀 Démarrer le tuto depuis FirstPick / Index
  const startTutorial = async () => {
    setTutorialStep(0);        // ✅ on passe à l’étape 0 (welcome)
    setIsTutorialActive(true); // ✅ overlay actif

    try {
      // on laisse la liberté de rejouer plus tard si on veut
      await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du tutoriel :", error);
    }
  };

  // ⏭️ Sauter le tuto (ou le terminer)
  const skipTutorial = async () => {
    setTutorialStep(0);
    setIsTutorialActive(false);
    try {
      await AsyncStorage.setItem("hasCompletedTutorialAfterSignup", "true");
      // ❌ plus de navigation automatique ici : l’écran appelant contrôle le flux
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du tutoriel :", error);
    }
  };

  return (
    <TutorialContext.Provider
      value={{
        tutorialStep,
        setTutorialStep,
        isTutorialActive,
        setIsTutorialActive,
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
