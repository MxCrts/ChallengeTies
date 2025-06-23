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
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const adUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-4725616526467159/6097960289";
const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);
  const [simulatedToday, setSimulatedToday] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();
  const [adLoaded, setAdLoaded] = useState(false);
  const isActiveRef = useRef(true);
  const [selectedChallenge, setSelectedChallenge] = useState<{
    id: string;
    selectedDays: number;
  } | null>(null);

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
    const unsubscribe = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setAdLoaded(true);
        console.log("Interstitiel chargé");
      }
    );
    const errorListener = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error("Erreur interstitiel:", error.message);
        setAdLoaded(false);
      }
    );
    interstitial.load();
    return () => {
      unsubscribe();
      errorListener();
    };
  }, []);

  useEffect(() => {
    console.log(
      "🟢 Initialisation onSnapshot, auth state:",
      auth.currentUser?.uid || "null"
    );
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      console.log(
        "🔐 onAuthStateChanged Challenges, user:",
        user?.uid || "null"
      );
      if (!user) {
        console.log("❌ Pas d'utilisateur, réinitialisation challenges");
        isActiveRef.current = false;
        if (unsubscribeSnapshot) {
          console.log("Désabonnement onSnapshot immédiat");
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setCurrentChallenges([]);
        return;
      }

      console.log("✅ Utilisateur connecté, activation onSnapshot");
      isActiveRef.current = true; // Réactiver quand un utilisateur est connecté
      const userId = user.uid;
      console.log("🔐 userId:", userId);
      const userRef = doc(db, "users", userId);

      unsubscribeSnapshot = onSnapshot(
        userRef,
        (docSnap) => {
          console.log(
            "📡 onSnapshot triggered, userId:",
            userId,
            "isActive:",
            isActiveRef.current
          );
          if (!isActiveRef.current || !auth.currentUser) {
            console.log("🚫 onSnapshot ignoré: inactif ou déconnecté");
            setCurrentChallenges([]);
            return;
          }
          if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log(
              "🔍 Données Firestore CurrentChallenges:",
              JSON.stringify(userData?.CurrentChallenges || "vide", null, 2)
            );
            if (Array.isArray(userData.CurrentChallenges)) {
              const uniqueChallenges = Array.from(
                new Map(
                  userData.CurrentChallenges.map((ch: CurrentChallenge) => {
                    const key = ch.uniqueKey || `${ch.id}_${ch.selectedDays}`;
                    return [key, { ...ch, uniqueKey: key }];
                  })
                ).values()
              );
              console.log(
                "✅ Challenges uniques:",
                JSON.stringify(uniqueChallenges, null, 2)
              );
              setCurrentChallenges(uniqueChallenges);
            } else {
              console.log(
                "⚠️ CurrentChallenges n'est pas un tableau:",
                userData.CurrentChallenges
              );
              setCurrentChallenges([]);
            }
          } else {
            console.log(
              "❌ Document utilisateur inexistant pour userId:",
              userId
            );
            setCurrentChallenges([]);
          }
        },
        (error) => {
          console.error(
            "❌ Erreur onSnapshot Challenges:",
            error.message,
            error.code
          );
          Alert.alert(
            "Erreur",
            `Impossible de charger les défis: ${error.message}`
          );
        }
      );
    });

    return () => {
      console.log("🔴 Arrêt onSnapshot");
      isActiveRef.current = false;
      if (unsubscribeSnapshot) {
        console.log("Désabonnement onSnapshot final");
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, [t]);

  const getToday = () => simulatedToday || new Date();

  const takeChallenge = async (challenge: Challenge, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("Pas d'utilisateur connecté pour takeChallenge.");
      Alert.alert(t("error"), t("loginRequired"));
      return;
    }
    const uniqueKey = `${challenge.id}_${selectedDays}`;
    if (currentChallenges.find((ch) => ch.uniqueKey === uniqueKey)) {
      console.log("Défi déjà pris :", uniqueKey);
      Alert.alert(t("info"), t("challengeAlreadyTaken"));
      return;
    }
    try {
      const userRef = doc(db, "users", userId);
      const challengeData: CurrentChallenge = {
        ...challenge,
        selectedDays,
        completedDays: 0,
        lastMarkedDate: null,
        streak: 0,
        uniqueKey,
        completionDates: [],
      };
      console.log("Envoi à Firebase :", JSON.stringify(challengeData, null, 2));
      await updateDoc(userRef, {
        CurrentChallenges: arrayUnion(challengeData),
      });
      console.log("Défi envoyé à Firebase, en attente de onSnapshot...");
      await checkForAchievements(userId);
    } catch (error) {
      console.error("Erreur lors de l'ajout du défi :", error.message);
      Alert.alert(t("error"), t("unableToAddChallenge"));
    }
  };

  const removeChallenge = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("Pas d'utilisateur connecté pour removeChallenge.");
      return;
    }
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.log("Document utilisateur inexistant.");
        return;
      }
      const userData = userSnap.data();
      const updatedChallenges = (userData.CurrentChallenges || []).filter(
        (challenge: CurrentChallenge) => challenge.uniqueKey !== uniqueKey
      );
      console.log(
        "Mise à jour Firebase avec challenges :",
        JSON.stringify(updatedChallenges, null, 2)
      );
      await updateDoc(userRef, {
        CurrentChallenges: updatedChallenges,
      });
      setCurrentChallenges(updatedChallenges);
      console.log("Défi retiré du user document !");

      const challengeRef = doc(db, "challenges", id);
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const updatedUsers = currentUsers.filter(
          (uid: string) => uid !== userId
        );
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentCount - 1, 0),
          usersTakingChallenge: updatedUsers,
        });
      });
      console.log("✅ Document challenge mis à jour après suppression !");
    } catch (error) {
      console.error(
        "❌ Erreur lors de la suppression du défi :",
        error.message
      );
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
      console.log("Challenge non trouvé pour isMarkedToday :", uniqueKey);
      return false;
    }
    return challenge.lastMarkedDate === today;
  };

  const markToday = async (id: string, selectedDays: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log("Pas d'utilisateur connecté pour markToday.");
      return { success: false };
    }
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const today = getToday();
      const todayString = today.toDateString();
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.log("Document utilisateur inexistant.");
        return { success: false };
      }
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé :", uniqueKey);
        Alert.alert(t("error"), t("challengeNotFound"));
        return { success: false };
      }
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };

      if (
        challengeToMark.completionDates &&
        challengeToMark.completionDates.includes(todayString)
      ) {
        console.log("⚠️ Déjà marqué aujourd'hui :", uniqueKey);
        Alert.alert(t("alreadyMarkedTitle"), t("alreadyMarkedMessage"));
        return { success: false };
      }

      let missedDays = 0;
      if (challengeToMark.lastMarkedDate) {
        const lastMarked = new Date(challengeToMark.lastMarkedDate);
        const diffTime = today.getTime() - lastMarked.getTime();
        missedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else {
        missedDays = 0;
      }

      if (missedDays < 2) {
        challengeToMark.streak = (challengeToMark.streak || 0) + 1;
        challengeToMark.completionDates = challengeToMark.completionDates || [];
        challengeToMark.completionDates.push(todayString);
        challengeToMark.completedDays =
          (challengeToMark.completedDays || 0) + 1;
        challengeToMark.lastMarkedDate = todayString;

        const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
          idx === challengeIndex ? challengeToMark : challenge
        );
        console.log(
          "📤 Mise à jour Firebase pour markToday :",
          JSON.stringify(updatedChallenges, null, 2)
        );
        await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
        setCurrentChallenges(updatedChallenges);

        const canShowAd = await checkAdCooldown();
        if (canShowAd && adLoaded) {
          interstitial.show();
          await markAdShown();
          setAdLoaded(false);
          interstitial.load();
        }

        if (challengeToMark.completedDays >= challengeToMark.selectedDays) {
          Alert.alert(t("congrats"), t("challengeFinishedPrompt"));
        } else {
          Alert.alert(t("markedTitle"), t("markedMessage"));
        }

        const currentLongest = userData.longestStreak || 0;
        if (challengeToMark.streak > currentLongest) {
          await updateDoc(userRef, { longestStreak: challengeToMark.streak });
          console.log(
            `✅ Longest streak mis à jour : ${challengeToMark.streak}`
          );
        }
        await checkForAchievements(userId);
        return { success: true };
      } else {
        console.log("⚠️ Trop de jours manqués :", missedDays, uniqueKey);
        showMissedChallengeModal(id, selectedDays);
        return { success: false, missedDays };
      }
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
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé pour reset :", uniqueKey);
        return;
      }
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };
      const today = getToday().toDateString();

      challengeToMark.streak = 1;
      challengeToMark.completionDates = [today];
      challengeToMark.completedDays = 1;
      challengeToMark.lastMarkedDate = today;
      const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
        idx === challengeIndex ? challengeToMark : challenge
      );
      console.log(
        "📤 Mise à jour Firebase pour reset :",
        JSON.stringify(updatedChallenges, null, 2)
      );
      await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
      setCurrentChallenges(updatedChallenges);
      Alert.alert(t("streakResetTitle"), t("streakResetMessage"));
      await checkForAchievements(userId);
      setModalVisible(false);
    } catch (error) {
      console.error("❌ Erreur lors du reset :", error.message);
      Alert.alert(t("error"), t("unableToResetStreak"));
    }
  };

  const handleWatchAd = async () => {
    if (!selectedChallenge) return;
    const { id, selectedDays } = selectedChallenge;
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé pour watchAd :", uniqueKey);
        return;
      }
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };
      const today = getToday().toDateString();
      const newCompletedDays = (challengeToMark.completedDays || 0) + 1;

      challengeToMark.streak = (challengeToMark.streak || 0) + 1;
      challengeToMark.completionDates = challengeToMark.completionDates || [];
      challengeToMark.completionDates.push(today);
      challengeToMark.completedDays = newCompletedDays;
      challengeToMark.lastMarkedDate = today;
      const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
        idx === challengeIndex ? challengeToMark : challenge
      );
      console.log(
        "📤 Mise à jour Firebase pour watchAd :",
        JSON.stringify(updatedChallenges, null, 2)
      );
      await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
      setCurrentChallenges(updatedChallenges);
      Alert.alert(t("adWatchedTitle"), t("adWatchedMessage"));
      await checkForAchievements(userId);
      setModalVisible(false);
    } catch (error) {
      console.error("❌ Erreur lors de watchAd :", error.message);
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
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      let currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé pour useTrophies :", uniqueKey);
        return;
      }
      const challengeToMark = { ...currentChallengesArray[challengeIndex] };
      const today = getToday().toDateString();
      const newCompletedDays = (challengeToMark.completedDays || 0) + 1;

      const success = await deductTrophies(userId, trophyCost);
      if (!success) {
        console.log("⚠️ Pas assez de trophées :", userId);
        Alert.alert(t("notEnoughTrophiesTitle"), t("notEnoughTrophiesMessage"));
        setModalVisible(false);
        return;
      }

      challengeToMark.streak = (challengeToMark.streak || 0) + 1;
      challengeToMark.completionDates = challengeToMark.completionDates || [];
      challengeToMark.completionDates.push(today);
      challengeToMark.completedDays = newCompletedDays;
      challengeToMark.lastMarkedDate = today;
      const updatedChallenges = currentChallengesArray.map((challenge, idx) =>
        idx === challengeIndex ? challengeToMark : challenge
      );
      console.log(
        "📤 Mise à jour Firebase pour useTrophies :",
        JSON.stringify(updatedChallenges, null, 2)
      );
      await updateDoc(userRef, { CurrentChallenges: updatedChallenges });
      setCurrentChallenges(updatedChallenges);
      Alert.alert(
        t("trophiesUsedTitle"),
        t("trophiesUsedMessage", { cost: trophyCost })
      );
      await checkForAchievements(userId);
      setModalVisible(false);
    } catch (error) {
      console.error("❌ Erreur lors de useTrophies :", error.message);
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
    if (!userId) {
      console.log("Pas d'utilisateur connecté pour completeChallenge.");
      return;
    }
    const uniqueKey = `${id}_${selectedDays}`;
    try {
      const today = getToday().toDateString();
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
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) => challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log(
          "⚠️ Challenge non trouvé pour completeChallenge :",
          uniqueKey
        );
        Alert.alert(t("error"), t("challengeNotFound"));
        return;
      }
      const challengeToComplete = { ...currentChallengesArray[challengeIndex] };

      const baseBonusTrophies = 5;
      const rewardMultiplier = selectedDays / 7;
      const calculatedReward = Math.round(baseBonusTrophies * rewardMultiplier);
      const finalTrophies = doubleReward
        ? calculatedReward * 2
        : calculatedReward;

      let completedChallengesArray: any[] = Array.isArray(
        userData.CompletedChallenges
      )
        ? userData.CompletedChallenges
        : [];
      const existingIndex = completedChallengesArray.findIndex(
        (entry: any) => entry.id === id
      );
      let newCompletedEntry;
      if (existingIndex !== -1) {
        const oldEntry = completedChallengesArray[existingIndex];
        const history = oldEntry.history ? [...oldEntry.history] : [];
        history.push({
          completedAt: oldEntry.completedAt,
          selectedDays: oldEntry.selectedDays,
        });
        newCompletedEntry = {
          ...challengeToComplete,
          completedAt: today,
          history: history,
        };
        completedChallengesArray[existingIndex] = newCompletedEntry;
      } else {
        newCompletedEntry = {
          ...challengeToComplete,
          completedAt: today,
          history: [],
        };
        completedChallengesArray.push(newCompletedEntry);
      }

      console.log(
        "📤 Mise à jour Firebase pour completeChallenge :",
        JSON.stringify(
          {
            CurrentChallenges: currentChallengesArray.filter(
              (_, idx) => idx !== challengeIndex
            ),
            CompletedChallenges: completedChallengesArray,
          },
          null,
          2
        )
      );
      await updateDoc(userRef, {
        CurrentChallenges: currentChallengesArray.filter(
          (_, idx) => idx !== challengeIndex
        ),
        CompletedChallenges: completedChallengesArray,
        trophies: increment(finalTrophies),
        completedChallengesCount: increment(1),
      });

      setCurrentChallenges(
        currentChallengesArray.filter((_, idx) => idx !== challengeIndex)
      );

      const challengeRef = doc(db, "challenges", id);
      await runTransaction(db, async (transaction) => {
        const challengeDoc = await transaction.get(challengeRef);
        if (!challengeDoc.exists()) throw new Error("Challenge inexistant");
        const data = challengeDoc.data();
        const currentCount = data.participantsCount || 0;
        const currentUsers = data.usersTakingChallenge || [];
        const updatedUsers = currentUsers.filter(
          (uid: string) => uid !== userId
        );
        transaction.update(challengeRef, {
          participantsCount: Math.max(currentCount - 1, 0),
          usersTakingChallenge: updatedUsers,
        });
      });

      Alert.alert(
        t("finalCongratsTitle"),
        t("finalCongratsMessage", { count: finalTrophies })
      );
      await checkForAchievements(userId);
    } catch (error) {
      console.error(
        "❌ Erreur lors de la finalisation du défi :",
        error.message
      );
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
