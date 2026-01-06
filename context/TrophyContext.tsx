// context/TrophyContext.tsx
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
import { auth } from "@/constants/firebase-config";

interface TrophyContextProps {
  showTrophyModal: boolean;
  trophiesEarned: number;
  achievementEarned: string | null;
  isDoubleReward: boolean;

  // derived helpful values
  finalTrophies: number;

  setShowTrophyModal: (visible: boolean) => void;
  setTrophyData: (trophies: number, achievement: string) => void;
  activateDoubleReward: () => void;
  resetTrophyData: () => Promise<void>;

  isClaiming?: boolean;
  closeTrophyModal?: () => void;
  canClaim?: boolean;
}

const TrophyContext = createContext<TrophyContextProps | undefined>(undefined);

export const TrophyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showTrophyModal, setShowTrophyModal] = useState(false);
  const [trophiesEarned, setTrophiesEarned] = useState(0);
  const [achievementEarned, setAchievementEarned] = useState<string | null>(null);
  const [isDoubleReward, setIsDoubleReward] = useState(false);

  const [isClaiming, setIsClaiming] = useState(false);

  // refs perf (pas de rerender pour un cooldown)
  const lastActionAtRef = useRef(0);
  const recentClaimsRef = useRef<Set<string>>(new Set());

  const { triggerProfileUpdate } = useProfileUpdate();

  /** Cooldown anti spam */
  const withinCooldown = useCallback((ms = 800) => {
    const now = Date.now();
    if (now - lastActionAtRef.current < ms) return true;
    lastActionAtRef.current = now;
    return false;
  }, []);

  /** Open modal with data */
  const setTrophyData = useCallback(
    (trophies: number, achievement: string) => {
      if (!trophies || !achievement) return;
      if (withinCooldown(350)) return;

      // si déjà ouvert sur le même succès => ignore
      if (showTrophyModal && achievementEarned === achievement) return;

      setTrophiesEarned(trophies);
      setAchievementEarned(achievement);
      setIsDoubleReward(false);
      setShowTrophyModal(true);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [withinCooldown, showTrophyModal, achievementEarned]
  );

  /** Double after ad */
  const activateDoubleReward = useCallback(() => {
    if (withinCooldown(450)) return;
    setIsDoubleReward(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [withinCooldown]);

  /** Close only UI */
  const closeTrophyModal = useCallback(() => {
    setShowTrophyModal(false);
  }, []);

  /** Anti double claim local */
  const alreadyClaimedLocally = useCallback((id: string) => {
    if (!id) return false;
    const s = recentClaimsRef.current;
    if (s.has(id)) return true;
    s.add(id);
    setTimeout(() => s.delete(id), 3000);
    return false;
  }, []);

  /** Claim atomique */
  const resetTrophyData = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    const id = achievementEarned;

    if (!userId || !id) return;
    if (isClaiming) return;
    if (withinCooldown(400)) return;
    if (alreadyClaimedLocally(id)) return;

    setIsClaiming(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await claimAchievement(userId, id, isDoubleReward);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowTrophyModal(false);

      await new Promise((r) => setTimeout(r, 450));
      await triggerProfileUpdate();
    } catch (error) {
      console.error("❌ claimAchievement erreur:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsClaiming(false);
      setTrophiesEarned(0);
      setAchievementEarned(null);
      setIsDoubleReward(false);
    }
  }, [
    achievementEarned,
    isDoubleReward,
    triggerProfileUpdate,
    withinCooldown,
    alreadyClaimedLocally,
    isClaiming,
  ]);

  const finalTrophies = useMemo(
    () => (isDoubleReward ? trophiesEarned * 2 : trophiesEarned),
    [isDoubleReward, trophiesEarned]
  );

  const canClaim = useMemo(
    () => !!achievementEarned && trophiesEarned > 0 && !isClaiming,
    [achievementEarned, trophiesEarned, isClaiming]
  );

  return (
    <TrophyContext.Provider
      value={{
        showTrophyModal,
        trophiesEarned,
        achievementEarned,
        isDoubleReward,
        finalTrophies,
        setShowTrophyModal,
        setTrophyData,
        activateDoubleReward,
        resetTrophyData,
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
