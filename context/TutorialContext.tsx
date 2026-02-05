// context/TutorialContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TutorialContextType = {
  tutorialStep: number;
  setTutorialStep: (step: number) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (isActive: boolean) => void;
  hasCompletedTutorial: boolean;
  startTutorial: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined
);

const COMPLETED_KEY = "hasCompletedTutorialAfterSignup";

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false);

  useEffect(() => {
   let mounted = true;
    const load = async () => {
      try {
        const v = await AsyncStorage.getItem(COMPLETED_KEY);
        if (!mounted) return;
        setHasCompletedTutorial(v === "true");
      } catch (e) {
       // fallback safe
        if (mounted) setHasCompletedTutorial(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // 🚀 Démarrer le tuto depuis FirstPick / Index
  const startTutorial = useCallback(async () => {
    setTutorialStep(0);
    setIsTutorialActive(true);
  }, []);

  // ⏭️ Sauter le tuto (ou le terminer)
 const skipTutorial = useCallback(async () => {
    setTutorialStep(0);
    setIsTutorialActive(false);
    try {
      await AsyncStorage.setItem(COMPLETED_KEY, "true");
       setHasCompletedTutorial(true);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du tutoriel :", error);
    }
 }, []);

  // 🔁 Permet de rejouer le tuto (Settings / debug / bouton “Rejouer”)
  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(COMPLETED_KEY);
    } catch {}
    setHasCompletedTutorial(false);
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        tutorialStep,
        setTutorialStep,
        isTutorialActive,
        setIsTutorialActive,
        hasCompletedTutorial,
        startTutorial,
        skipTutorial,
         resetTutorial,
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
