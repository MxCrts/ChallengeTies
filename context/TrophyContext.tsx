import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useMemo,
} from "react";
import * as Haptics from "expo-haptics";
import { claimAchievement } from "../helpers/trophiesHelpers";
import { useProfileUpdate } from "./ProfileUpdateContext";
import { auth } from "../constants/firebase-config";

interface TrophyContextProps {
  // existant
  showTrophyModal: boolean;
  trophiesEarned: number;
  achievementEarned: string | null;
  isDoubleReward: boolean;
  setShowTrophyModal: (visible: boolean) => void;
  setTrophyData: (trophies: number, achievement: string) => void;
  activateDoubleReward: () => void;
  resetTrophyData: () => Promise<void>;
  // bonus non-cassants (utiles si tu veux les lire)
  isClaiming?: boolean;
  closeTrophyModal?: () => void;
  canClaim?: boolean;
}

const TrophyContext = createContext<TrophyContextProps | undefined>(undefined);

export const TrophyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showTrophyModal, setShowTrophyModal] = useState<boolean>(false);
  const [trophiesEarned, setTrophiesEarned] = useState<number>(0);
  const [achievementEarned, setAchievementEarned] = useState<string | null>(null);
  const [isDoubleReward, setIsDoubleReward] = useState<boolean>(false);

  // Nouveaux états premium
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [lastActionAt, setLastActionAt] = useState<number>(0);
  const recentClaimsRef = useRef<Set<string>>(new Set()); // anti double-claim local

  const { triggerProfileUpdate } = useProfileUpdate();

  /** Cooldown anti-spam (tap, pub, etc.) */
  const withinCooldown = useCallback((ms = 800) => {
    const now = Date.now();
    if (now - lastActionAt < ms) return true;
    setLastActionAt(now);
    return false;
  }, [lastActionAt]);

  /** Ouverture modale + pré-chargement des infos (idempotent, anti-spam) */
  const setTrophyData = useCallback((trophies: number, achievement: string) => {
    if (!trophies || !achievement) return;
    if (withinCooldown(400)) return;

    // si la même récompense est déjà en cours/ouverte on ignore
    if (showTrophyModal && achievementEarned === achievement) return;

    setTrophiesEarned(trophies);
    setAchievementEarned(achievement);
    setIsDoubleReward(false);
    setShowTrophyModal(true);
    // haptique léger pour feedback premium
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [achievementEarned, showTrophyModal, withinCooldown]);

  /** Active le x2 après pub/condition */
  const activateDoubleReward = useCallback(() => {
    if (withinCooldown(500)) return;
    setIsDoubleReward(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [withinCooldown]);

  /** Ferme proprement la modale (sans reset des states métier) */
  const closeTrophyModal = useCallback(() => {
    setShowTrophyModal(false);
  }, []);

  /** Idempotence locale pour empêcher double soumission */
  const alreadyClaimedLocally = useCallback((id: string) => {
    if (!id) return false;
    const s = recentClaimsRef.current;
    if (s.has(id)) return true;
    // expire localement après ~3s
    s.add(id);
    setTimeout(() => s.delete(id), 3000);
    return false;
  }, []);

  /** Claim atomique + UI optimiste + haptics + refresh profil */
  const resetTrophyData = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    const id = achievementEarned;
    if (!userId || !id) {
      console.warn("⚠️ Aucun utilisateur ou succès sélectionné pour la réclamation.");
      return;
    }
    if (withinCooldown(400)) return;
    if (alreadyClaimedLocally(id)) return; // anti double tap ultra-rapide

    const finalTrophies = isDoubleReward ? trophiesEarned * 2 : trophiesEarned;
    setIsClaiming(true);

    try {
      // feedback immédiat
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Transaction serveur (vérifie pending côté Firestore)
      await claimAchievement(userId, id, isDoubleReward);

      // Succès 🎉
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Ferme d’abord pour laisser place aux toasts/animations d’UI
      setShowTrophyModal(false);

      // Petite pause le temps d’éventuelles animations de sortie
      await new Promise((r) => setTimeout(r, 500));

      // Refresh profil (trophies, achievements, newAchievements…)
      await triggerProfileUpdate();
    } catch (error: any) {
      console.error("❌ Erreur lors de la réclamation du trophée :", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      // Réinitialisation des états
      setIsClaiming(false);
      setTrophiesEarned(0);
      setAchievementEarned(null);
      setIsDoubleReward(false);
    }
  }, [achievementEarned, trophiesEarned, isDoubleReward, triggerProfileUpdate, withinCooldown, alreadyClaimedLocally]);

  const canClaim = useMemo(
    () => !!achievementEarned && trophiesEarned > 0 && !isClaiming,
    [achievementEarned, trophiesEarned, isClaiming]
  );

  return (
    <TrophyContext.Provider
      value={{
        // existant
        showTrophyModal,
        trophiesEarned,
        achievementEarned,
        isDoubleReward,
        setShowTrophyModal,
        setTrophyData,
        activateDoubleReward,
        resetTrophyData,
        // bonus
        isClaiming,
        closeTrophyModal,
        canClaim,
      }}
    >
      {children}
    </TrophyContext.Provider>
  );
};

export const useTrophy = () => {
  const context = useContext(TrophyContext);
  if (!context) {
    throw new Error("❌ useTrophy doit être utilisé à l'intérieur de TrophyProvider.");
  }
  return context;
};
