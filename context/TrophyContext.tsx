import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

interface TrophyContextProps {
  showTrophyModal: boolean;
  trophiesEarned: number;
  achievementEarned: string | null;
  isDoubleReward: boolean;
  setShowTrophyModal: (visible: boolean) => void;
  setTrophyData: (trophies: number, achievement?: string) => void;
  activateDoubleReward: () => void;
  resetTrophyData: () => void;
}

// ✅ Création du contexte sécurisé
const TrophyContext = createContext<TrophyContextProps | undefined>(undefined);

export const TrophyProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [showTrophyModal, setShowTrophyModal] = useState(false);
  const [trophiesEarned, setTrophiesEarned] = useState(0);
  const [achievementEarned, setAchievementEarned] = useState<string | null>(
    null
  );
  const [isDoubleReward, setIsDoubleReward] = useState(false);

  // ✅ Gérer l'affichage des trophées et succès
  const setTrophyData = useCallback(
    (trophies: number, achievement?: string) => {
      setTrophiesEarned(trophies);
      setAchievementEarned(achievement || null);
      setIsDoubleReward(false);
      setShowTrophyModal(true);
    },
    []
  );

  // ✅ Double la récompense si l'utilisateur regarde une pub
  const activateDoubleReward = useCallback(() => {
    setIsDoubleReward(true);
    setTrophiesEarned((prev) => prev * 2);
  }, []);

  // ✅ Réinitialisation après fermeture du modal
  const resetTrophyData = useCallback(() => {
    setShowTrophyModal(false);
    setTrophiesEarned(0);
    setAchievementEarned(null);
    setIsDoubleReward(false);
  }, []);

  return (
    <TrophyContext.Provider
      value={{
        showTrophyModal,
        trophiesEarned,
        achievementEarned,
        isDoubleReward,
        setShowTrophyModal,
        setTrophyData,
        activateDoubleReward,
        resetTrophyData,
      }}
    >
      {children}
    </TrophyContext.Provider>
  );
};

// ✅ Hook sécurisé pour éviter toute erreur hors TrophyProvider
export const useTrophy = () => {
  const context = useContext(TrophyContext);
  if (!context) {
    throw new Error(
      "❌ useTrophy doit être utilisé à l'intérieur de TrophyProvider."
    );
  }
  return context;
};
