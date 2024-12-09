import React, { createContext, useContext, useState } from "react";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  totalDays?: number; // Total duration of the challenge in days
}

interface CurrentChallenge extends Challenge {
  completedDays: number; // Tracks the progress of the challenge
  lastMarkedDate?: string; // Keeps track of the last date the challenge was marked
}

interface SavedChallengesContextType {
  savedChallenges: Challenge[];
  currentChallenges: CurrentChallenge[];
  addChallenge: (challenge: Challenge) => void;
  removeChallenge: (id: string) => void;
  takeChallenge: (challenge: Challenge) => void;
  markToday: (id: string) => void;
  completeChallenge: (id: string) => void;
}

const SavedChallengesContext = createContext<SavedChallengesContextType | null>(
  null
);

export const SavedChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);

  const addChallenge = (challenge: Challenge) => {
    setSavedChallenges((prev) =>
      prev.some((c) => c.id === challenge.id) ? prev : [...prev, challenge]
    );
  };

  const removeChallenge = (id: string) => {
    setSavedChallenges((prev) => prev.filter((c) => c.id !== id));
    setCurrentChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  const takeChallenge = (challenge: Challenge) => {
    if (currentChallenges.some((c) => c.id === challenge.id)) return;

    setCurrentChallenges((prev) => [
      ...prev,
      { ...challenge, completedDays: 0, lastMarkedDate: undefined }, // Use undefined instead of null
    ]);
  };

  const markToday = (id: string) => {
    setCurrentChallenges((prev) =>
      prev.map((challenge) => {
        if (challenge.id === id) {
          const today = new Date().toDateString();
          if (challenge.lastMarkedDate === today) return challenge; // Already marked today

          const newCompletedDays = Math.min(
            (challenge.completedDays || 0) + 1,
            challenge.totalDays || 30 // Default to 30 days if not specified
          );

          return {
            ...challenge,
            completedDays: newCompletedDays,
            lastMarkedDate: today,
          };
        }
        return challenge;
      })
    );
  };

  const completeChallenge = (id: string) => {
    setCurrentChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <SavedChallengesContext.Provider
      value={{
        savedChallenges,
        currentChallenges,
        addChallenge,
        removeChallenge,
        takeChallenge,
        markToday,
        completeChallenge,
      }}
    >
      {children}
    </SavedChallengesContext.Provider>
  );
};

export const useSavedChallenges = () => {
  const context = useContext(SavedChallengesContext);
  if (!context) {
    throw new Error(
      "useSavedChallenges must be used within a SavedChallengesProvider"
    );
  }
  return context;
};
