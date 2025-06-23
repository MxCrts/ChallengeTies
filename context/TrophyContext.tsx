import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { claimAchievement } from "../helpers/trophiesHelpers";
import { useProfileUpdate } from "./ProfileUpdateContext";
import { auth } from "../constants/firebase-config";

interface TrophyContextProps {
  showTrophyModal: boolean;
  trophiesEarned: number;
  achievementEarned: string | null;
  isDoubleReward: boolean;
  setShowTrophyModal: (visible: boolean) => void;
  setTrophyData: (trophies: number, achievement: string) => void;
  activateDoubleReward: () => void;
  resetTrophyData: () => Promise<void>;
}

const TrophyContext = createContext<TrophyContextProps | undefined>(undefined);

export const TrophyProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [showTrophyModal, setShowTrophyModal] = useState<boolean>(false);
  const [trophiesEarned, setTrophiesEarned] = useState<number>(0);
  const [achievementEarned, setAchievementEarned] = useState<string | null>(
    null
  );
  const [isDoubleReward, setIsDoubleReward] = useState<boolean>(false);
  const { triggerProfileUpdate } = useProfileUpdate();

  const setTrophyData = useCallback((trophies: number, achievement: string) => {
    console.log(
      `🎯 Préparation pour réclamer : ${achievement} (+${trophies} trophées)`
    );
    setTrophiesEarned(trophies);
    setAchievementEarned(achievement);
    setIsDoubleReward(false);
    setShowTrophyModal(true);
  }, []);

  const activateDoubleReward = useCallback(() => {
    console.log("🎥 Publicité regardée : doublement des trophées !");
    setIsDoubleReward(true);
  }, []);

  const resetTrophyData = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !achievementEarned) {
      console.warn(
        "⚠️ Aucun utilisateur ou succès sélectionné pour la réclamation."
      );
      return;
    }
    const finalTrophies = isDoubleReward ? trophiesEarned * 2 : trophiesEarned;
    console.log(
      `✅ Attribution finale : ${finalTrophies} trophées pour ${achievementEarned}`
    );

    try {
      await claimAchievement(userId, achievementEarned, isDoubleReward);
      console.log("✅ Succès réclamé avec succès. Mise à jour du profil...");
      setShowTrophyModal(false); // Fermer d’abord
      await new Promise((resolve) => setTimeout(resolve, 600)); // Attendre l’animation
      await triggerProfileUpdate();
    } catch (error: any) {
      console.error("❌ Erreur lors de la réclamation du trophée :", error);
    }

    // Réinitialisation des états
    setTrophiesEarned(0);
    setAchievementEarned(null);
    setIsDoubleReward(false);
  }, [achievementEarned, trophiesEarned, isDoubleReward, triggerProfileUpdate]);

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

export const useTrophy = () => {
  const context = useContext(TrophyContext);
  if (!context) {
    throw new Error(
      "❌ useTrophy doit être utilisé à l'intérieur de TrophyProvider."
    );
  }
  return context;
};
