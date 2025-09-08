import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { auth, db } from "../constants/firebase-config";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  runTransaction,
  increment,
} from "firebase/firestore";
import { Alert, StyleSheet, View } from "react-native";
import {
  checkForAchievements,
  deductTrophies,
} from "../helpers/trophiesHelpers";
import MissedChallengeModal from "../components/MissedChallengeModal";
import { useTranslation } from "react-i18next";
import {
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";


interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  daysOptions: number[];
  chatId: string;
}

export interface CurrentChallenge extends Challenge {
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
  streak?: number;
  uniqueKey?: string;
  completionDates?: string[];
  duo?: boolean;
  duoPartnerId?: string;
  duoPartnerUsername?: string;
  challengeId?: string;
  startedAt?: string;

}

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  setCurrentChallenges: React.Dispatch<
    React.SetStateAction<CurrentChallenge[]>
  >;
  simulatedToday: Date | null;
  setSimulatedToday: React.Dispatch<React.SetStateAction<Date | null>>;
  takeChallenge: (challenge: Challenge, selectedDays: number) => Promise<void>;
  removeChallenge: (id: string, selectedDays: number) => Promise<void>;
  markToday: (
    id: string,
    selectedDays: number
  ) => Promise<{ success: boolean; missedDays?: number }>;
  isMarkedToday: (id: string, selectedDays: number) => boolean;
  completeChallenge: (
    id: string,
    selectedDays: number,
    doubleReward?: boolean
  ) => Promise<void>;
  simulateStreak: (
    id: string,
    selectedDays: number,
    streakValue?: number
  ) => Promise<void>;
  showMissedChallengeModal: (id: string, selectedDays: number) => void;
}

const CurrentChallengesContext =
  createContext<CurrentChallengesContextType | null>(null);



export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);
  const [simulatedToday, setSimulatedToday] = useState<Date | null>(null);
const { showInterstitials, showRewardedAds } = useAdsVisibility() as any; // ok si non défini

const interstitialRef = useRef<InterstitialAd | null>(null);
const rewardedRef = useRef<RewardedAd | null>(null);

const interstitialAdUnitId = adUnitIds.interstitial;
const rewardedAdUnitId = adUnitIds.rewarded;
const npa = (globalThis as any).__NPA__ === true; // true => pubs non personnalisées


  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();
  const [adLoaded, setAdLoaded] = useState(false);
  const isActiveRef = useRef(true);
  const [selectedChallenge, setSelectedChallenge] = useState<{
    id: string;
    selectedDays: number;
  } | null>(null);

  const [rewardLoaded, setRewardLoaded] = useState(false);


  const checkAdCooldown = async () => {
    const lastAdTime = await AsyncStorage.getItem("lastInterstitialTime");
    if (!lastAdTime) return true;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    return now - parseInt(lastAdTime) > cooldownMs;
  };

  const markAdShown = async () => {
    await AsyncStorage.setItem("lastInterstitialTime", Date.now().toString());
  };

useEffect(() => {
  // Si on ne doit pas afficher d'interstitiels (premium/admin) -> clean total
  if (!showInterstitials) {
    interstitialRef.current = null;
    setAdLoaded(false);
    return;
  }

  // (Re)création contrôlée
  const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  requestNonPersonalizedAdsOnly: npa,
});
  interstitialRef.current = ad;

  const onLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    setAdLoaded(true);
  });

  const onError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
    console.error("Erreur interstitiel:", error.message);
    setAdLoaded(false);
  });

  ad.load();

  return () => {
    onLoaded();
    onError();
    interstitialRef.current = null;
    setAdLoaded(false);
  };
}, [showInterstitials, interstitialAdUnitId]);

// --- à placer dans le même fichier, au-dessus du useEffect ---
async function reconcileDuoLinks(
  myUserId: string,
  myChallenges: CurrentChallenge[],
  setCurrentChallenges: React.Dispatch<React.SetStateAction<CurrentChallenge[]>>,
) {
  // Rien à faire si aucun duo
  const hasDuo = myChallenges.some((c) => c?.duo && c?.duoPartnerId && c?.uniqueKey);
  if (!hasDuo) return;

  const updates: Record<string, boolean> = {};

  for (const ch of myChallenges) {
    if (!ch?.duo || !ch?.duoPartnerId || !ch?.uniqueKey) continue;

    try {
      const partnerRef = doc(db, "users", ch.duoPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (!partnerSnap.exists()) {
        updates[ch.uniqueKey] = true; // partenaire inexistant → solo
        continue;
      }

      const partnerData = partnerSnap.data();
      const partnerList: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
        ? partnerData.CurrentChallenges
        : [];

      const stillPaired = partnerList.some((p) => p?.uniqueKey === ch.uniqueKey);
      if (!stillPaired) updates[ch.uniqueKey] = true; // l'autre s'est retiré → je passe solo
    } catch (e: any) {
      console.warn("reconcileDuoLinks partner read error:", e?.message ?? e);
    }
  }

  if (Object.keys(updates).length === 0) return;

  // Applique localement puis persiste (on modifie MON doc → autorisé par tes rules)
  const meRef = doc(db, "users", myUserId);
  const newArray = myChallenges.map((item) => {
    if (!item?.uniqueKey) return item;
    if (!updates[item.uniqueKey]) return item;
    return {
      ...item,
      duo: false,
      duoPartnerId: null,
      duoPartnerUsername: null,
    };
  });

  try {
    await updateDoc(meRef, { CurrentChallenges: newArray });
    setCurrentChallenges(newArray);
  } catch (e: any) {
    console.error("reconcileDuoLinks write error:", e?.message ?? e);
  }
}

// --- remplace intégralement ton useEffect par ceci ---
useEffect(() => {
  let unsubscribeSnapshot: (() => void) | null = null;
  let cancelled = false;

  const unsubscribeAuth = auth.onAuthStateChanged((user) => {
    // Si déconnecté → on nettoie et on sort
    if (!user) {
      isActiveRef.current = false;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      setCurrentChallenges([]);
      return;
    }

    // Connecté
    isActiveRef.current = true;
    const userId = user.uid;
    const userRef = doc(db, "users", userId);

    // On (ré)écoute le doc utilisateur
    unsubscribeSnapshot = onSnapshot(
      userRef,
      (docSnap) => {
        if (cancelled || !isActiveRef.current || !auth.currentUser) {
          setCurrentChallenges([]);
          return;
        }

        if (!docSnap.exists()) {
          setCurrentChallenges([]);
          return;
        }

        const userData = docSnap.data();
        const rawList: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
          ? userData.CurrentChallenges
          : [];

        // Dédup + normalisation du uniqueKey
        const uniqueChallenges = Array.from(
          new Map(
            rawList.map((ch: CurrentChallenge) => {
              const key = ch?.uniqueKey || `${ch?.id}_${ch?.selectedDays}`;
              return [key, { ...ch, uniqueKey: key } as CurrentChallenge];
            })
          ).values()
        );

        setCurrentChallenges(uniqueChallenges);

        // Réconciliation duo (asynchrone, ne bloque pas l'UI)
        // NB: on appelle seulement si toujours connecté
        if (auth.currentUser?.uid) {
          void reconcileDuoLinks(userId, uniqueChallenges, setCurrentChallenges);
        }
      },
      (error) => {
        console.error("❌ Erreur onSnapshot Challenges:", error.message, error.code);
        Alert.alert("Erreur", `Impossible de charger les défis: ${error.message}`);
        setCurrentChallenges([]);
      }
    );
  });

  return () => {
    cancelled = true;
    isActiveRef.current = false;
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    unsubscribeAuth();
  };
}, [t]);


  const getToday = () => simulatedToday || new Date();

 const takeChallenge = async (
  challenge: Challenge,
  selectedDays: number,
  options?: { duo?: boolean; duoPartnerId?: string }
) => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    Alert.alert(t("error"), t("loginRequired"));
    return;
  }

  const uniqueKey = `${challenge.id}_${selectedDays}`;
  if (currentChallenges.find((ch) => ch.uniqueKey === uniqueKey)) {
    Alert.alert(t("info"), t("challengeAlreadyTaken"));
    return;
  }

  try {
    const userRef = doc(db, "users", userId);
    const todayString = getToday().toDateString();

    const challengeData: CurrentChallenge = {
      ...challenge,
      selectedDays,
      completedDays: 0,
      lastMarkedDate: null,
      streak: 0,
      uniqueKey,
      completionDates: [],
      startedAt: todayString,
      ...(options?.duo
        ? {
            duo: true,
            duoPartnerId: options.duoPartnerId,
          }
        : {}),
    };

    await updateDoc(userRef, {
      CurrentChallenges: arrayUnion(challengeData),
    });

    await checkForAchievements(userId);
  } catch (error) {
    console.error("Erreur lors de l'ajout du défi :", error.message);
    Alert.alert(t("error"), t("unableToAddChallenge"));
  }
};

const removeChallenge = async (id: string, selectedDays: number) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = `${id}_${selectedDays}`;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const currentChallenges: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const challengeToRemove = currentChallenges.find((ch) => ch.uniqueKey === uniqueKey);
    if (!challengeToRemove) return;




    const updatedChallenges = currentChallenges.filter((ch) => ch.uniqueKey !== uniqueKey);

    // 🔥 Mise à jour du document utilisateur
    await updateDoc(userRef, { CurrentChallenges: updatedChallenges });

    // 🔁 Mise à jour du document challenge global
    const challengeRef = doc(db, "challenges", id);
    await runTransaction(db, async (transaction) => {
      const challengeDoc = await transaction.get(challengeRef);
      if (!challengeDoc.exists()) throw new Error("Challenge inexistant");

      const data = challengeDoc.data();
      const currentCount = data.participantsCount || 0;
      const currentUsers = data.usersTakingChallenge || [];
      const updatedUsers = currentUsers.filter((uid: string) => uid !== userId);

      transaction.update(challengeRef, {
        participantsCount: Math.max(currentCount - 1, 0),
        usersTakingChallenge: updatedUsers,
      });
    });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du défi :", error.message);
    Alert.alert(t("error"), t("unableToRemoveChallenge"));
  }
};


  const isMarkedToday = (id: string, selectedDays: number): boolean => {
    const today = getToday().toDateString();
    const uniqueKey = `${id}_${selectedDays}`;
    const challenge = currentChallenges.find(
      (ch) => ch.uniqueKey === uniqueKey
    );
    if (!challenge) {
      return false;
    }
    return challenge.lastMarkedDate === today;
  };

const markToday = async (id: string, selectedDays: number) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return { success: false };

  const uniqueKey = `${id}_${selectedDays}`;
  try {
    const today = getToday();
    const todayString = today.toDateString();
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { success: false };

    const userData = userSnap.data();
    const currentChallengesArray: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const challengeIndex = currentChallengesArray.findIndex(
      (ch) => ch.uniqueKey === uniqueKey
    );
    if (challengeIndex === -1) {
      Alert.alert(t("error"), t("challengeNotFound"));
      return { success: false };
    }

    const challengeToMark = { ...currentChallengesArray[challengeIndex] };

    // Déjà marqué aujourd’hui ?
    if (challengeToMark.completionDates?.includes(todayString)) {
      Alert.alert(t("alreadyMarkedTitle"), t("alreadyMarkedMessage"));
      return { success: false };
    }

    // Vérifie s’il y a eu des jours manqués
    let missedDays = 0;

// 🔥 NEW: on prend lastMarkedDate OU startedAt comme point de référence
const refDateStr =
  challengeToMark.lastMarkedDate || challengeToMark.startedAt || null;

if (refDateStr) {
  const refDate = new Date(refDateStr);
  missedDays = Math.floor(
    (today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

if (missedDays >= 2) {
  showMissedChallengeModal(id, selectedDays);
  return { success: false, missedDays };
}

    // ✅ Marquer le jour
    challengeToMark.streak = (challengeToMark.streak || 0) + 1;
    challengeToMark.completionDates = [
      ...(challengeToMark.completionDates || []),
      todayString,
    ];
    challengeToMark.completedDays = (challengeToMark.completedDays || 0) + 1;
    challengeToMark.lastMarkedDate = todayString;

    const updatedChallenges = currentChallengesArray.map((ch, idx) =>
      idx === challengeIndex ? challengeToMark : ch
    );

    await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
    setCurrentChallenges(updatedChallenges);

    // 🔁 Synchronisation avec le partenaire
    if (challengeToMark.duo && challengeToMark.duoPartnerId) {
      try {
        const partnerRef = doc(db, "users", challengeToMark.duoPartnerId);
        const partnerSnap = await getDoc(partnerRef);
        if (partnerSnap.exists()) {
          const partnerData = partnerSnap.data();
          const partnerChallenges: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
            ? partnerData.CurrentChallenges
            : [];

          const partnerIndex = partnerChallenges.findIndex((ch) => ch.uniqueKey === uniqueKey);
          if (partnerIndex !== -1) {
            const updatedPartner = { ...partnerChallenges[partnerIndex] };

            if (!updatedPartner.completionDates?.includes(todayString)) {
              updatedPartner.completionDates = [
                ...(updatedPartner.completionDates || []),
                todayString,
              ];
              updatedPartner.lastMarkedDate = todayString;
            }

            const updatedPartnerArray = partnerChallenges.map((ch, idx) =>
              idx === partnerIndex ? updatedPartner : ch
            );

            await updateDoc(partnerRef, {
              CurrentChallenges: updatedPartnerArray,
            });
          }
        }
      } catch (err) {
        console.error("❌ Erreur synchronisation duo:", err.message);
      }
    }

    // 📺 Affichage pub (non-premium/non-admin uniquement)
try {
  if (showInterstitials) {
    const canShowAd = await checkAdCooldown();
    if (canShowAd && adLoaded && interstitialRef.current) {
      await interstitialRef.current.show();
      await markAdShown();
      setAdLoaded(false);
      // Reload pour la prochaine fois
      interstitialRef.current.load();
    }
  }
} catch (e: any) {
  console.warn("Interstitial show error:", e?.message ?? e);
}


    // 🎉 Alertes
    if (challengeToMark.completedDays >= challengeToMark.selectedDays) {
      Alert.alert(t("congrats"), t("challengeFinishedPrompt"));
    } else {
      Alert.alert(t("markedTitle"), t("markedMessage"));
    }

    // 🏅 Streak max
    const currentLongest = userData.longestStreak || 0;
    if (challengeToMark.streak > currentLongest) {
      await updateDoc(userRef, { longestStreak: challengeToMark.streak });
    }

    await checkForAchievements(userId);
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors du marquage :", error.message);
    Alert.alert(t("error"), t("unableToMarkChallenge"));
    return { success: false };
  }
};


const handleReset = async () => {
  if (!selectedChallenge) return;
  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = `${id}_${selectedDays}`;
  const today = getToday().toDateString();

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const currentChallengesArray: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const challengeIndex = currentChallengesArray.findIndex((ch) => ch.uniqueKey === uniqueKey);
    if (challengeIndex === -1) {
      console.log("Challenge non trouvé pour reset :", uniqueKey);
      return;
    }

    const updated = {
      ...currentChallengesArray[challengeIndex],
      streak: 1,
      completionDates: [today],
      completedDays: 1,
      lastMarkedDate: today,
    };

    const updatedArray = currentChallengesArray.map((ch, i) =>
      i === challengeIndex ? updated : ch
    );

    await updateDoc(userRef, { CurrentChallenges: updatedArray });
    setCurrentChallenges(updatedArray);
    Alert.alert(t("streakResetTitle"), t("streakResetMessage"));
    setModalVisible(false);
    await checkForAchievements(userId);

    // 🔁 Si duo, reset partenaire aussi
    if (updated.duo && updated.duoPartnerId) {
      const partnerRef = doc(db, "users", updated.duoPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (partnerSnap.exists()) {
        const partnerData = partnerSnap.data();
        const partnerChallenges: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
          ? partnerData.CurrentChallenges
          : [];

        const partnerIndex = partnerChallenges.findIndex((ch) => ch.uniqueKey === uniqueKey);
        if (partnerIndex !== -1) {
          const updatedPartner = {
            ...partnerChallenges[partnerIndex],
            streak: 1,
            completedDays: 1,
            completionDates: [today],
            lastMarkedDate: today,
          };

          const updatedPartnerArray = partnerChallenges.map((ch, i) =>
            i === partnerIndex ? updatedPartner : ch
          );

          await updateDoc(partnerRef, { CurrentChallenges: updatedPartnerArray });
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors du reset :", error.message);
    Alert.alert(t("error"), t("unableToResetStreak"));
  }
};

const showRewardedAndWait = async () => {
  const ad = rewardedRef.current;
  if (!ad || !rewardLoaded) {
    throw new Error("Rewarded non prêt");
  }
  return new Promise<void>((resolve, reject) => {
    let earned = false;

    const earnedSub = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earned = true;
        // on ne resolve pas ici — on attend la fermeture pour proprement relancer le load
      }
    );

    const closeSub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      earnedSub();
      closeSub();
      if (earned) resolve();
      else reject(new Error("Aucune récompense obtenue"));
    });

    ad.show().catch((err) => {
      try { earnedSub(); closeSub(); } catch {}
      reject(err);
    });
  });
};

const handleWatchAd = async () => {
  // La REWARDED a déjà été vue et validée par MissedChallengeModal.
  if (!selectedChallenge) return;

  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = `${id}_${selectedDays}`;
  const today = getToday().toDateString();

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const arr: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges) ? userData.CurrentChallenges : [];
    const index = arr.findIndex((ch) => ch.uniqueKey === uniqueKey);
    if (index === -1) return;

    const updated = {
      ...arr[index],
      streak: (arr[index].streak || 0) + 1,
      completedDays: (arr[index].completedDays || 0) + 1,
      completionDates: [ ...(arr[index].completionDates || []), today ],
      lastMarkedDate: today,
    };

    const next = arr.map((ch, i) => (i === index ? updated : ch));
    await updateDoc(userRef, { CurrentChallenges: next });
    setCurrentChallenges(next);
    Alert.alert(t("adWatchedTitle"), t("adWatchedMessage"));
    setModalVisible(false);
    await checkForAchievements(userId);

    // Duo sync (identique à avant)
    if (updated.duo && updated.duoPartnerId) {
      const partnerRef = doc(db, "users", updated.duoPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (partnerSnap.exists()) {
        const pData = partnerSnap.data();
        const pArr: CurrentChallenge[] = Array.isArray(pData.CurrentChallenges) ? pData.CurrentChallenges : [];
        const pIdx = pArr.findIndex((ch) => ch.uniqueKey === uniqueKey);
        if (pIdx !== -1) {
          const pUpd = {
            ...pArr[pIdx],
            lastMarkedDate: today,
            completionDates: [ ...(pArr[pIdx].completionDates || []), today ],
          };
          const pNext = pArr.map((ch, i) => (i === pIdx ? pUpd : ch));
          await updateDoc(partnerRef, { CurrentChallenges: pNext });
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Erreur handleWatchAd:", error.message);
    Alert.alert(t("error"), t("unableToMarkAfterAd"));
  }
};



const handleUseTrophies = async () => {
  if (!selectedChallenge) return;
  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = `${id}_${selectedDays}`;
  const trophyCost = 5;
  const today = getToday().toDateString();

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();

    const currentChallengesArray: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const challengeIndex = currentChallengesArray.findIndex((ch) => ch.uniqueKey === uniqueKey);
    if (challengeIndex === -1) {
      console.log("Challenge non trouvé pour useTrophies :", uniqueKey);
      return;
    }

    const success = await deductTrophies(userId, trophyCost);
    if (!success) {
      Alert.alert(t("notEnoughTrophiesTitle"), t("notEnoughTrophiesMessage"));
      setModalVisible(false);
      return;
    }

    const updated = {
      ...currentChallengesArray[challengeIndex],
      streak: (currentChallengesArray[challengeIndex].streak || 0) + 1,
      completedDays: (currentChallengesArray[challengeIndex].completedDays || 0) + 1,
      completionDates: [
        ...(currentChallengesArray[challengeIndex].completionDates || []),
        today,
      ],
      lastMarkedDate: today,
    };

    const updatedArray = currentChallengesArray.map((ch, i) =>
      i === challengeIndex ? updated : ch
    );

    await updateDoc(userRef, { CurrentChallenges: updatedArray });
    setCurrentChallenges(updatedArray);
    Alert.alert(t("trophiesUsedTitle"), t("trophiesUsedMessage", { cost: trophyCost }));
    setModalVisible(false);
    await checkForAchievements(userId);

    // 🔁 Duo sync
    if (updated.duo && updated.duoPartnerId) {
      const partnerRef = doc(db, "users", updated.duoPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (partnerSnap.exists()) {
        const partnerData = partnerSnap.data();
        const partnerArray: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
          ? partnerData.CurrentChallenges
          : [];

        const partnerIndex = partnerArray.findIndex((ch) => ch.uniqueKey === uniqueKey);
        if (partnerIndex !== -1) {
          const updatedPartner = {
            ...partnerArray[partnerIndex],
            lastMarkedDate: today,
            completionDates: [
              ...(partnerArray[partnerIndex].completionDates || []),
              today,
            ],
          };

          const updatedPartnerArray = partnerArray.map((ch, i) =>
            i === partnerIndex ? updatedPartner : ch
          );

          await updateDoc(partnerRef, { CurrentChallenges: updatedPartnerArray });
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur useTrophies :", error.message);
    Alert.alert(t("error"), t("unableToMarkWithTrophies"));
  }
};


const showMissedChallengeModal = (id: string, selectedDays: number) => {
    console.log("Affichage modal pour :", id, selectedDays);
    setSelectedChallenge({ id, selectedDays });
    setModalVisible(true);
  };

const completeChallenge = async (
  id: string,
  selectedDays: number,
  doubleReward: boolean = false
) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = `${id}_${selectedDays}`;
  const today = getToday().toDateString();

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const currentChallengesArray: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const challengeIndex = currentChallengesArray.findIndex(
      (ch) => ch.uniqueKey === uniqueKey
    );
    if (challengeIndex === -1) {
      Alert.alert(t("error"), t("challengeNotFound"));
      return;
    }

    const challengeToComplete = { ...currentChallengesArray[challengeIndex] };

    // 🏆 Récompenses
    const baseBonusTrophies = 5;
    const rewardMultiplier = selectedDays / 7;
    const calculatedReward = Math.round(baseBonusTrophies * rewardMultiplier);
    const finalTrophies = doubleReward ? calculatedReward * 2 : calculatedReward;

    // 📜 Historique
    const completedChallengesArray: any[] = Array.isArray(userData.CompletedChallenges)
      ? userData.CompletedChallenges
      : [];

    const existingIndex = completedChallengesArray.findIndex((entry) => entry.id === id);
    const newCompletedEntry = {
      ...challengeToComplete,
      completedAt: today,
      history:
        existingIndex !== -1
          ? [
              ...(completedChallengesArray[existingIndex].history || []),
              {
                completedAt: completedChallengesArray[existingIndex].completedAt,
                selectedDays: completedChallengesArray[existingIndex].selectedDays,
              },
            ]
          : [],
    };

    if (existingIndex !== -1) {
      completedChallengesArray[existingIndex] = newCompletedEntry;
    } else {
      completedChallengesArray.push(newCompletedEntry);
    }

    const updatedArray = currentChallengesArray.filter((_, idx) => idx !== challengeIndex);

    await updateDoc(userRef, {
      CurrentChallenges: updatedArray,
      CompletedChallenges: completedChallengesArray,
      trophies: increment(finalTrophies),
      completedChallengesCount: increment(1),
      CompletedChallengeIds: arrayUnion(id),
    });
    setCurrentChallenges(updatedArray);

    // 🔄 Supprimer user du challenge global
    const challengeRef = doc(db, "challenges", id);
    await runTransaction(db, async (transaction) => {
      const challengeDoc = await transaction.get(challengeRef);
      if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
      const data = challengeDoc.data();
      const currentUsers = data.usersTakingChallenge || [];
      transaction.update(challengeRef, {
        participantsCount: Math.max((data.participantsCount || 1) - 1, 0),
        usersTakingChallenge: currentUsers.filter((uid: string) => uid !== userId),
      });
    });

    // 🔁 Si duo → supprimer chez partenaire aussi
    if (challengeToComplete.duo && challengeToComplete.duoPartnerId) {
      const partnerRef = doc(db, "users", challengeToComplete.duoPartnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (partnerSnap.exists()) {
        const partnerData = partnerSnap.data();
        const partnerChallenges: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
          ? partnerData.CurrentChallenges
          : [];
        const partnerIndex = partnerChallenges.findIndex((ch) => ch.uniqueKey === uniqueKey);
        if (partnerIndex !== -1) {
          const updatedPartner = partnerChallenges.filter((_, i) => i !== partnerIndex);
          await updateDoc(partnerRef, {
            CurrentChallenges: updatedPartner,
          });
        }
      }
    }

    Alert.alert(
      t("finalCongratsTitle"),
      t("finalCongratsMessage", { count: finalTrophies })
    );
    await checkForAchievements(userId);
  } catch (error) {
    console.error("❌ Erreur completeChallenge :", error.message);
    Alert.alert(t("error"), t("unableToFinalizeChallenge"));
  }
};

  const simulateStreak = async (
    id: string,
    selectedDays: number,
    streakValue: number = 3
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("Pas d'utilisateur connecté pour simulateStreak.");
      return;
    }
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.log("Document utilisateur inexistant.");
        return;
      }
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const uniqueKey = `${id}_${selectedDays}`;
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé pour simulateStreak :", uniqueKey);
        Alert.alert("Erreur", "Challenge non trouvé pour simulation.");
        return;
      }
      const challengeToUpdate = { ...currentChallengesArray[challengeIndex] };
      const today = getToday();
      const completionDates = [];
      for (let i = streakValue - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        completionDates.push(d.toDateString());
      }
      challengeToUpdate.streak = streakValue;
      challengeToUpdate.completionDates = completionDates;
      challengeToUpdate.completedDays = streakValue;
      challengeToUpdate.lastMarkedDate =
        completionDates[completionDates.length - 1];
      const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
        idx === challengeIndex ? challengeToUpdate : challenge
      );
      console.log(
        "Mise à jour Firebase pour simulateStreak :",
        JSON.stringify(updatedChallenges, null, 2)
      );
      await updateDoc(userRef, {
        CurrentChallenges: updatedChallenges,
      });
      setCurrentChallenges(updatedChallenges);
      Alert.alert("Simulation", `Streak simulé à ${streakValue} jours.`);
      await checkForAchievements(userId);
    } catch (error) {
      console.error("Erreur lors de la simulation du streak :", error.message);
      Alert.alert("Erreur", "Impossible de simuler le streak.");
    }
  };

  return (
    <CurrentChallengesContext.Provider
      value={{
        currentChallenges,
        setCurrentChallenges,
        simulatedToday,
        setSimulatedToday,
        takeChallenge,
        removeChallenge,
        markToday,
        isMarkedToday,
        completeChallenge,
        simulateStreak,
        showMissedChallengeModal,
      }}
    >
      <View style={styles.providerContainer}>
        {children}
        {modalVisible && (
          <MissedChallengeModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onReset={handleReset}
            onWatchAd={handleWatchAd}
            onUseTrophies={handleUseTrophies}
            trophyCost={5}
          />
        )}
      </View>
    </CurrentChallengesContext.Provider>
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
    position: "relative",
  },
});

export const useCurrentChallenges = () => {
  const context = useContext(CurrentChallengesContext);
  if (!context) {
    throw new Error(
      "useCurrentChallenges must be used within a CurrentChallengesProvider"
    );
  }
  return context;
};
