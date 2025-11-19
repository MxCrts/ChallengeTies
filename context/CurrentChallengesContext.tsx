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
// en haut des imports
import { usePathname } from "expo-router";
import { logEventOnce } from "../src/analytics";
import { consumeStreakPass } from "../helpers/dailyBonusService";
import {
   useTrophiesEconomy,
   dayKeyUTC,
   diffDaysUTC,
   coerceToDayKey,
   getSkipTrophyCost,
   computeChallengeTrophies,
 } from "../hooks/useTrophiesEconomy";
 import { DeviceEventEmitter } from "react-native";
 import { MICRO_WEEK_UPDATED_EVENT } from "../hooks/useTrophiesEconomy"
 import {
  recordDailyGlobalMark,
  recordFocusMark,
  addCompletedCategory,
  recordSeasonalCompleted,
  recordDuoFinish,
  bumpDuoStreak,
  tryFinalizePerfectMonth,
} from "@/src/services/metricsService";
import { incStat, setBool } from "@/src/services/metricsService";

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  daysOptions: number[];
  chatId: string;
}


// ➕ Ajoute l'utilisateur aux participants du défi global (idempotent)
async function addParticipantToChallengeGlobal(challengeId: string, userId: string) {
  const challengeRef = doc(db, "challenges", challengeId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const users: string[] = Array.isArray(data.usersTakingChallenge) ? data.usersTakingChallenge : [];
    if (users.includes(userId)) return;
    tx.update(challengeRef, {
      participantsCount: increment(1),
      usersTakingChallenge: arrayUnion(userId),
      // lastJoinAt: serverTimestamp(), // optionnel analytics
    });
  });
}

// --- Helpers stables ---
const makeUK = (id: string, days: number) => `${id}_${days}`;
const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

// Mélange lisible côté historique (ISO) + clé UTC (logic)
const pushCompletion = (obj: any, when: Date) => {
  const key = dayKeyUTC(when);
  const iso = when.toISOString();
  const prevKeys: string[] =
    obj?.completionDateKeys ??
    (obj?.completionDates || []).map(coerceToDayKey).filter(Boolean);

  if (!prevKeys.includes(key)) {
    obj.completionDateKeys = [...prevKeys, key];
    obj.completionDates = [...(obj?.completionDates || []), iso];
  }
  obj.lastMarkedKey = key;
  obj.lastMarkedDate = iso;
};

const readKeys = (obj: any): string[] =>
  (obj?.completionDateKeys ??
    (obj?.completionDates || []).map(coerceToDayKey).filter(Boolean)) as string[];

const sameChallengeLoose = (a: any, b: any) => {
  const aid = (a as any)?.challengeId ?? a?.id;
  const bid = (b as any)?.challengeId ?? b?.id;
  return aid === bid && Number(a?.selectedDays) === Number(b?.selectedDays);
};

// --- PerfectMonth helpers ---
const monthTokenUTC = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // ex: "2025-11"
};

const isLastUtcDayOfMonth = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return d.getUTCDate() === lastDay;
};

async function finalizePerfectMonthIfNeeded(now: Date, userId?: string | null) {
  if (!userId) return;
  if (!isLastUtcDayOfMonth(now)) return;
  try {
    const tokenKey = `pm_finalized_${monthTokenUTC(now)}`;
    const already = await AsyncStorage.getItem(tokenKey);
    if (already === "1") return;
    await tryFinalizePerfectMonth(userId, now.getUTCFullYear(), now.getUTCMonth() + 1);
    await AsyncStorage.setItem(tokenKey, "1");
  } catch (e: any) {
    __DEV__ && console.warn("[perfectMonth] finalize error:", e?.message ?? e);
  }
}



export interface CurrentChallenge extends Challenge {
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
  lastMarkedKey?: string;
  streak?: number;
  uniqueKey?: string;
  completionDates?: string[];
  completionDateKeys?: string[];
  duo?: boolean;
  duoPartnerId?: string;
  duoPartnerUsername?: string;
  challengeId?: string;
  startedKey?: string;
  startedAt?: string;
  slug?: string;                     // si tu l’utilises (focus)
  seasonal?: boolean;                // si tu l’utilises
  categoryId?: string; 
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
  requestRewardedAd: () => Promise<boolean>;
  preloadRewarded: () => void;
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
const { showInterstitials, showRewarded } = useAdsVisibility(); // showRewarded (pas showRewardedAds)
const pathname = usePathname();

// Garde globale init ads + NPA
const adsReady = (globalThis as any).__ADS_READY__ === true;
const { TROPHY, getMicroWeek, incMicroWeek } = useTrophiesEconomy();
// Masquer ADS sur routes d'auth
const isAuthRoute = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

const interstitialRef = useRef<InterstitialAd | null>(null);
const rewardedRef = useRef<RewardedAd | null>(null);

const interstitialAdUnitId = adUnitIds.interstitial;
const rewardedAdUnitId = adUnitIds.rewarded;
const npa = (globalThis as any).__NPA__ === true; // true => pubs non personnalisées
const graceShownRef = useRef<Record<string, boolean>>({});


  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();
  const [adLoaded, setAdLoaded] = useState(false);
  const [hasStreakPass, setHasStreakPass] = useState(false);

  const isActiveRef = useRef(true);
  const [selectedChallenge, setSelectedChallenge] = useState<{
    id: string;
    selectedDays: number;
  } | null>(null);

  const [rewardLoaded, setRewardLoaded] = useState(false);
// 🔒 Anti re-entrance guards
  const inFlightMarks = useRef<Set<string>>(new Set());
  const inFlightCompletes = useRef<Set<string>>(new Set());
  const inFlightRemovals = useRef<Set<string>>(new Set());
  // 🔔 Coalescer de succès (évite 10 transactions d’affilée)
  const achTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achUserRef = useRef<string | null>(null);
  const scheduleAchievementsCheck = (uid?: string | null, delay = 350) => {
    if (!uid) return;
    achUserRef.current = uid;
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
    achTimerRef.current = setTimeout(() => {
      const u = achUserRef.current;
      if (!u) return;
      checkForAchievements(u).catch(() => {});
      achTimerRef.current = null;
    }, delay);
  };

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

  const closeMissedModal = () => {
  setModalVisible(false);
  if (selectedChallenge) {
    const k = makeUK(selectedChallenge.id, selectedChallenge.selectedDays);
    // réarme la grâce pour permettre l’affichage du modal au prochain tap
    graceShownRef.current[k] = false;
  }
  setSelectedChallenge(null);
};

// Interstitial backoff & timers
const interRetryRef = useRef(0);
const interTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  // Gardes : pas d'interstitiel si pas prêt, si auth screens, si désactivé
  if (!adsReady || isAuthRoute || !showInterstitials) {
    interstitialRef.current = null;
    setAdLoaded(false);
    if (interTimerRef.current) {
      clearTimeout(interTimerRef.current);
      interTimerRef.current = null;
    }
    return;
  }

  let ad: InterstitialAd | null = null;

  const createAndLoad = () => {
    // Si déjà présent et pas d’erreur → ne recrée pas
    if (interstitialRef.current) return;

    ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
      requestNonPersonalizedAdsOnly: npa,
    });
    interstitialRef.current = ad;

const onLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {

      interRetryRef.current = 0;
      setAdLoaded(true);
      __DEV__ && console.log("[Interstitial] LOADED");
    });

    const onClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      // on détruit et on relance un load “propre”
      interstitialRef.current = null;
      setAdLoaded(false);
      const delay = 1000; // reload doux après close
      interTimerRef.current = setTimeout(createAndLoad, delay);
    });

    const onError = ad.addAdEventListener(AdEventType.ERROR, (e) => {
      __DEV__ && console.warn("[Interstitial] ERROR:", e?.message);
      interstitialRef.current = null;
      setAdLoaded(false);
      // backoff exponentiel (max 30s)
      const delay = Math.min(30000, 1000 * Math.pow(2, interRetryRef.current++));
      interTimerRef.current = setTimeout(createAndLoad, delay);
    });

    ad.load();

    // cleanup listeners au démontage / recréation
    return () => {
      onLoaded();
      onClosed();
      onError();
    };
  };

  const cleanup = createAndLoad();

  return () => {
    if (cleanup) cleanup();
    if (interTimerRef.current) {
      clearTimeout(interTimerRef.current);
      interTimerRef.current = null;
    }
    interstitialRef.current = null;
    setAdLoaded(false);
  };
}, [adsReady, isAuthRoute, showInterstitials, interstitialAdUnitId, npa]);

// Rewarded backoff & timers
const rewardRetryRef = useRef(0);
const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  // Rewarded affichables si adsReady & pas écran d'auth & feature ON
  if (!adsReady || isAuthRoute || !showRewarded) {
    rewardedRef.current = null;
    setRewardLoaded(false);
    if (rewardTimerRef.current) {
      clearTimeout(rewardTimerRef.current);
      rewardTimerRef.current = null;
    }
    return;
  }

  let ad: RewardedAd | null = null;

  const createAndLoad = () => {
    if (rewardedRef.current) return;

    ad = RewardedAd.createForAdRequest(rewardedAdUnitId, {
      requestNonPersonalizedAdsOnly: npa,
    });
    rewardedRef.current = ad;

    const onLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      rewardRetryRef.current = 0;
      setRewardLoaded(true);
      __DEV__ && console.log("[Rewarded] LOADED");
    });

    const onClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      // après fermeture on détruit et on relance (propre)
      rewardedRef.current = null;
      setRewardLoaded(false);
      const delay = 1000;
      rewardTimerRef.current = setTimeout(createAndLoad, delay);
    });

    const onError = ad.addAdEventListener(AdEventType.ERROR, (e) => {
      __DEV__ && console.warn("[Rewarded] ERROR:", e?.message);
      rewardedRef.current = null;
      setRewardLoaded(false);
      const delay = Math.min(30000, 1000 * Math.pow(2, rewardRetryRef.current++));
      rewardTimerRef.current = setTimeout(createAndLoad, delay);
    });

    ad.load();

    return () => {
      onLoaded();
      onClosed();
      onError();
    };
  };

  const cleanup = createAndLoad();

  return () => {
    if (cleanup) cleanup();
    if (rewardTimerRef.current) {
      clearTimeout(rewardTimerRef.current);
      rewardTimerRef.current = null;
    }
    rewardedRef.current = null;
    setRewardLoaded(false);
  };
}, [adsReady, isAuthRoute, showRewarded, rewardedAdUnitId, npa]);


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

      const stillPaired = partnerList.some((p) => {
  if (p?.uniqueKey === ch.uniqueKey) return true;
  const pcid = (p as any)?.challengeId ?? p?.id;
  const ccid = (ch as any)?.challengeId ?? ch?.id;
  return pcid === ccid && Number(p?.selectedDays) === Number(ch?.selectedDays);
});

const sameChallengeSolo = myChallenges.find(
       (c) =>
         !c.duo &&
         ((c.challengeId ?? c.id) === (ch.challengeId ?? ch.id)) &&
         Number(c.selectedDays) === Number(ch.selectedDays)
     );
     if (sameChallengeSolo) {
       updates[sameChallengeSolo.uniqueKey] = true; // supprime la solo
     }

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
              const key = ch?.uniqueKey || makeUK(ch?.id as string, Number(ch?.selectedDays));
              return [key, { ...ch, uniqueKey: key } as CurrentChallenge];
            })
          ).values()
        );

// 🔒 Anti re-render inutile (hash minimal)
        const prev = currentChallenges;
        const hash = (c: CurrentChallenge) =>
          [c.uniqueKey, c.completedDays, (c as any)?.lastMarkedKey, (c as any)?.streak].join("|");
        const same =
          prev.length === uniqueChallenges.length &&
          prev.every((x, i) => hash(x) === hash(uniqueChallenges[i]));
        if (!same) setCurrentChallenges(uniqueChallenges);
        // 🔔 déclenche un check coalescé (non bloquant)
        scheduleAchievementsCheck(userId);
// ✅ Tentative silencieuse de finalisation PerfectMonth au chargement
        // (le dernier jour UTC du mois, idempotent via AsyncStorage + serveur)
        try { finalizePerfectMonthIfNeeded(getToday(), userId); } catch {}
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
    if (achTimerRef.current) {
      clearTimeout(achTimerRef.current);
      achTimerRef.current = null;
    }
  };
}, []); 


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

  const uniqueKey = makeUK(challenge.id, selectedDays);
  
  if (currentChallenges.find((ch) => ch.uniqueKey === uniqueKey)) {
    Alert.alert(t("info"), t("challengeAlreadyTaken"));
    return;
  }

  try {
    const userRef = doc(db, "users", userId);
   const today = getToday();
    const todayString = today.toISOString();

    const challengeData: CurrentChallenge = {
      ...challenge,
      selectedDays,
      completedDays: 0,
      lastMarkedDate: null,
      lastMarkedKey: undefined,
      streak: 0,
      uniqueKey,
      completionDates: [],
      completionDateKeys: [],
      startedAt: todayString,
  // ✅ NEW: clef UTC du jour de départ (utile si lastMarkedKey absent)
  ...( { startedKey: dayKeyUTC(today) } as any ),
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
    // ➕ Comptabilise la participation globale (idempotent)
    await addParticipantToChallengeGlobal(challenge.id, userId);
    // 🏁 Succès "selectChallengeDays" (7/30/90/180/365)
    try {
      const DAYS = Number(selectedDays);
      if ([7, 30, 90, 180, 365].includes(DAYS)) {
        await incStat(userId, `selectChallengeDays.${DAYS}`, 1);
      }
    } catch (e) {
      __DEV__ && console.warn("[achievements] selectChallengeDays inc error:", (e as any)?.message ?? e);
    }
try {
  await logEventOnce("first_challenge", "first_challenge_started", {
    challengeId: challenge.id,
    selectedDays,
  });
} catch (e) {
  console.log("[analytics] first_challenge_started error:", (e as any)?.message ?? e);
}

    // 🔔 coalescé
    scheduleAchievementsCheck(userId);
  } catch (error) {
    console.error("Erreur lors de l'ajout du défi :", error.message);
    Alert.alert(t("error"), t("unableToAddChallenge"));
  }
};

const removeChallenge = async (id: string, selectedDays: number): Promise<void> => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = makeUK(id, selectedDays);
  // 🔒 garde anti double-tap dédiée au remove
  if (inFlightRemovals.current.has(uniqueKey)) {
    __DEV__ && console.log("[removeChallenge] skip (in-flight)", uniqueKey);
    return;
  }
  inFlightRemovals.current.add(uniqueKey);
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
    console.error("❌ Erreur lors de la suppression du défi :", (error as any)?.message ?? error);
    Alert.alert(t("error"), t("unableToRemoveChallenge"));
  } finally {
    inFlightRemovals.current.delete(uniqueKey);
  }
};


  const isMarkedToday = (id: string, selectedDays: number): boolean => {
   const uniqueKey = makeUK(id, selectedDays);
   const ch = currentChallenges.find((c) => c.uniqueKey === uniqueKey);
   if (!ch) return false;
   const todayKey = dayKeyUTC(getToday());
   const lastKey = coerceToDayKey(ch.lastMarkedKey ?? ch.lastMarkedDate);
   return !!lastKey && lastKey === todayKey;
 };

const markToday = async (id: string, selectedDays: number) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return { success: false };

  const uniqueKey = makeUK(id, selectedDays);
  if (inFlightMarks.current.has(uniqueKey)) {
    __DEV__ && console.log("[markToday] skip (in-flight)", uniqueKey);
    return { success: false };
  }
  inFlightMarks.current.add(uniqueKey);
  try {
    const now = getToday();
    const todayKey = dayKeyUTC(now); // YYYY-MM-DD (UTC)
    const userRef = doc(db, "users", userId);

    let missedDays = 0;
    let needsComplete = false;
    let newStreak = 0;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("user doc not found");
      const data = snap.data() as any;
      const arr: CurrentChallenge[] = Array.isArray(data.CurrentChallenges) ? data.CurrentChallenges : [];
      const idx = arr.findIndex((c) => c.uniqueKey === uniqueKey);
      if (idx === -1) throw new Error("challengeNotFound");

      const ch: any = { ...arr[idx] };

      // déjà validé/terminé
      if (Number(ch.completedDays || 0) >= Number(ch.selectedDays)) throw new Error("alreadyCompleted");
      const keys = readKeys(ch);
      if (keys.includes(todayKey)) throw new Error("alreadyMarked");

      const refKey = ch?.lastMarkedKey ?? coerceToDayKey(ch?.lastMarkedDate) ?? (ch?.startedKey ?? coerceToDayKey(ch?.startedAt));
      if (refKey) missedDays = diffDaysUTC(refKey, todayKey);
      if (missedDays >= 2) return; // on n’écrit rien → modale de rattrapage

      // ✅ push + streak + clamp
      pushCompletion(ch, now);
      ch.streak = Number(ch.streak || 0) + 1;
      ch.completedDays = clamp(Number(ch.completedDays || 0) + 1, Number(ch.selectedDays));
      newStreak = Number(ch.streak || 0);
      needsComplete = ch.completedDays >= ch.selectedDays;

      const next = arr.map((x, i) => (i === idx ? ch : x));
      tx.update(userRef, { CurrentChallenges: next });

      const prevMax = Number(data?.stats?.streak?.max ?? 0);
      if (newStreak > prevMax) tx.update(userRef, { "stats.streak.max": newStreak });

    });

    if (missedDays >= 2) {
      const uKey = uniqueKey;
      if (!graceShownRef.current[uKey]) {
        showMissedChallengeModal(id, selectedDays);
        graceShownRef.current[uKey] = true;
      }
      return { success: false, missedDays };
    }

    // --- METRICS: global daily completion + focus-only + duoStreak (+ perfect month)
try {
  // 1) Streak global "au moins 1 validation / jour"
  await recordDailyGlobalMark(userId, now);

  // ✅ PerfectMonth (helper centralisé)
  await finalizePerfectMonthIfNeeded(now, userId);

  // 2) Streak spécifique au challenge "focus"
  const FOCUS_ID = "focus"; // remplace par ton id/slug réel
  const isFocus =
    id === FOCUS_ID;
  if (isFocus) {
    await recordFocusMark(userId, now);
  }
} catch {}


    // 🪙 Micro-récompense quotidienne (+1) avec cap hebdo
    try {
      const bank = await getMicroWeek();
      if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
        await updateDoc(userRef, { trophies: increment(TROPHY.MICRO_PER_DAY) });
        const next = await incMicroWeek();
        try { DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, next); } catch {}
        Alert.alert(t("microEarnedTitle"), t("microEarnedMessage", { count: TROPHY.MICRO_PER_DAY }));
      }
    } catch {}

    // 🎯 Bonus palier de streak (3/7/14/21/30)
    try {
      const hit = TROPHY.STREAK_BONUS.find(b => b.at === newStreak);
      if (hit?.bonus) {
        await updateDoc(userRef, { trophies: increment(hit.bonus) });
        Alert.alert(t("streakBonusTitle"), t("streakBonusMessage", {
          bonus: hit.bonus,
          streak: newStreak
        }));
      }
    } catch {}

// 📺 Affichage interstitiel (non-premium/non-admin, et uniquement si prêt)
try {
  const justSawRewarded = Date.now() - (Number(await AsyncStorage.getItem("lastRewardedTime")||0)) < 60_000;
  if (adsReady && showInterstitials && !isAuthRoute && !justSawRewarded) {
    const canShowAd = await checkAdCooldown();
    if (canShowAd && adLoaded && interstitialRef.current) {
      await interstitialRef.current.show();
      await markAdShown();
      // NOTE: le reload est géré par l'événement CLOSED dans l'effect
    } else {
      __DEV__ && console.log("[Interstitial] Skip show: canShowAd=", canShowAd, "adLoaded=", adLoaded);
    }
  }
} catch (e: any) {
  console.warn("[Interstitial] show error:", e?.message ?? e);
}


 // 🎉 Auto-complete si l'objectif est atteint
    if (needsComplete) {
      if (!inFlightCompletes.current.has(uniqueKey)) {
        inFlightCompletes.current.add(uniqueKey);
        try {
          await completeChallenge(id, selectedDays, /*doubleReward*/ false);
        } finally {
          inFlightCompletes.current.delete(uniqueKey);
        }
      }
    } else {
      Alert.alert(t("markedTitle"), t("markedMessage"));
    }

    // 🔔 coalescé
    scheduleAchievementsCheck(userId);
    return { success: true };
  } catch (error) {
    const msg = String((error as any)?.message || error);
    if (msg === "alreadyCompleted") {
      Alert.alert(t("alreadyMarkedTitle"), t("alreadyCompleted"));
    } else if (msg === "alreadyMarked") {
      Alert.alert(t("alreadyMarkedTitle"), t("alreadyMarkedMessage"));
    } else if (msg === "challengeNotFound") {
      Alert.alert(t("error"), t("challengeNotFound"));
    } else {
      console.error("❌ Erreur lors du marquage :", msg);
      Alert.alert(t("error"), t("unableToMarkChallenge"));
    }
    return { success: false };
    } finally {
    inFlightMarks.current.delete(uniqueKey);
  }
};

const handleReset = async () => {
  if (!selectedChallenge) return;
  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = makeUK(id, selectedDays);

  // 💡 Fonction interne qui fait vraiment le reset
  const performReset = async () => {
    const today = getToday();

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const currentChallengesArray: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];

      const challengeIndex = currentChallengesArray.findIndex(
        (ch) => ch.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log("Challenge non trouvé pour reset :", uniqueKey);
        return;
      }

      const updated = { ...currentChallengesArray[challengeIndex] };
      // on marque aujourd’hui comme nouveau départ
      pushCompletion(updated as any, today);
      updated.streak = 1;
      updated.completedDays = Math.min(
        1,
        Number(updated.selectedDays || 1)
      );

      const updatedArray = currentChallengesArray.map((ch, i) =>
        i === challengeIndex ? updated : ch
      );

      await updateDoc(userRef, { CurrentChallenges: updatedArray });
      setCurrentChallenges(updatedArray);
      Alert.alert(t("streakResetTitle"), t("streakResetMessage"));
      setModalVisible(false);
      // 🔔 coalescé
      scheduleAchievementsCheck(userId);
      graceShownRef.current[makeUK(id, selectedDays)] = false;
    } catch (error: any) {
      console.error("❌ Erreur lors du reset :", error.message);
      Alert.alert(t("error"), t("unableToResetStreak"));
    }
  };

  // 🧠 Si l’utilisateur a un Streak Pass, on demande confirmation
  if (hasStreakPass) {
    Alert.alert(
      t("confirmResetTitle", "Confirmer ?"),
      t(
        "confirmResetText",
        "Tu as un Streak Pass disponible. Veux-tu vraiment remettre ta série à zéro ?"
      ),
      [
        {
          text: t("cancel", "Annuler"),
          style: "cancel",
        },
        {
          text: t("confirm", "Oui, remettre à zéro"),
          style: "destructive",
          onPress: () => {
            void performReset();
          },
        },
      ]
    );
    return;
  }

  // 🟢 Pas de Streak Pass → reset direct comme avant
  await performReset();
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
       if (earned) { try { AsyncStorage.setItem("lastRewardedTime", String(Date.now())); } catch {} }
      if (earned) resolve();
      else reject(new Error("Aucune récompense obtenue"));
    });

    ad.show().catch((err) => {
      try { earnedSub(); closeSub(); } catch {}
      reject(err);
    });
  });
};

const preloadRewarded = () => {
  // si l’objet existe mais pas encore loaded, on relance un load
  if (rewardedRef.current && !rewardLoaded) {
    try { rewardedRef.current.load(); } catch {}
  }
};

const requestRewardedAd = async (): Promise<boolean> => {
  // Si pas prêt, on renvoie false (les écrans gèrent l’état “not ready”)
  if (!rewardedRef.current || !rewardLoaded) return false;
  try {
    await showRewardedAndWait(); // résout si EARNED_REWARD + CLOSED
    return true;
  } catch {
    return false;
  }
};

const handleWatchAd = async () => {
  // La REWARDED a déjà été vue et validée par MissedChallengeModal.
  if (!selectedChallenge) return;

  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = makeUK(id, selectedDays);
   const today = getToday();

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const arr: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges) ? userData.CurrentChallenges : [];
    const index = arr.findIndex((ch) => ch.uniqueKey === uniqueKey);
    if (index === -1) return;

const updated = { ...arr[index] };
    pushCompletion(updated as any, today);
    updated.streak = Number(updated.streak || 0) + 1;
    updated.completedDays = clamp(Number(updated.completedDays || 0) + 1, Number(updated.selectedDays));

    const next = arr.map((ch, i) => (i === index ? updated : ch));
    await updateDoc(userRef, { CurrentChallenges: next });
    setCurrentChallenges(next);
    Alert.alert(t("adWatchedTitle"), t("adWatchedMessage"));
    setModalVisible(false);
    // 🔔 coalescé
    scheduleAchievementsCheck(userId);
graceShownRef.current[makeUK(id, selectedDays)] = false;
// 🔢 METRICS + micro-récompense (parité avec markToday)
    try {
      await recordDailyGlobalMark(userId, today);
      // ✅ PerfectMonth (helper centralisé)
      await finalizePerfectMonthIfNeeded(today, userId);
      const FOCUS_ID = "focus";
      const isFocus = updated.id === FOCUS_ID || (updated as any)?.slug === "focus";
      if (isFocus) await recordFocusMark(userId, today);
      if (updated.duo) await bumpDuoStreak(userId, updated.streak || 0);
    } catch {}
    try {
      const bank = await getMicroWeek();
      if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
        await updateDoc(userRef, { trophies: increment(TROPHY.MICRO_PER_DAY) });
        const nextBank = await incMicroWeek();
        try { DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, nextBank); } catch {}
      }
    } catch {}

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

  const uniqueKey = makeUK(id, selectedDays);
 const trophyCost = getSkipTrophyCost(selectedDays);
  const today = getToday();

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

    const updated = { ...currentChallengesArray[challengeIndex] };
    pushCompletion(updated as any, today);
    updated.streak = Number(updated.streak || 0) + 1;
    updated.completedDays = clamp(Number(updated.completedDays || 0) + 1, Number(updated.selectedDays));


    const updatedArray = currentChallengesArray.map((ch, i) =>
      i === challengeIndex ? updated : ch
    );

    await updateDoc(userRef, { CurrentChallenges: updatedArray });
    setCurrentChallenges(updatedArray);
    Alert.alert(t("trophiesUsedTitle"), t("trophiesUsedMessage", { cost: trophyCost }));
    setModalVisible(false);
    // 🔔 coalescé
    scheduleAchievementsCheck(userId);

    // 🔢 METRICS + micro-récompense (parité avec markToday)
    try {
      await recordDailyGlobalMark(userId, today);
      // ✅ PerfectMonth (helper centralisé)
      await finalizePerfectMonthIfNeeded(today, userId);
      const FOCUS_ID = "focus";
      const isFocus =
        (updated as any)?.id === FOCUS_ID || (updated as any)?.slug === "focus";
      if (isFocus) await recordFocusMark(userId, today);
      if (updated.duo) await bumpDuoStreak(userId, updated.streak || 0);
    } catch {}
    try {
      const bank = await getMicroWeek();
      if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
        await updateDoc(userRef, { trophies: increment(TROPHY.MICRO_PER_DAY) });
        const nextBank = await incMicroWeek();
        try { DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, nextBank); } catch {}
      }
    } catch {}

    
  } catch (error) {
    console.error("❌ Erreur useTrophies :", error.message);
    Alert.alert(t("error"), t("unableToMarkWithTrophies"));
  }
};

const handleUseStreakPass = async () => {
  if (!selectedChallenge) return;
  const { id, selectedDays } = selectedChallenge;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = makeUK(id, selectedDays);
  const today = getToday();

  try {
    // 1️⃣ Consommer 1 Streak Pass (throw si aucun dispo)
    await consumeStreakPass();

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const arr: CurrentChallenge[] = Array.isArray(userData.CurrentChallenges)
      ? userData.CurrentChallenges
      : [];

    const index = arr.findIndex((ch) => ch.uniqueKey === uniqueKey);
    if (index === -1) {
      __DEV__ && console.log("Challenge non trouvé pour Streak Pass :", uniqueKey);
      return;
    }

    // 2️⃣ Même logique que handleWatchAd / handleUseTrophies
    const updated = { ...arr[index] };
    pushCompletion(updated as any, today);
    updated.streak = Number(updated.streak || 0) + 1;
    updated.completedDays = clamp(
      Number(updated.completedDays || 0) + 1,
      Number(updated.selectedDays)
    );

    const next = arr.map((ch, i) => (i === index ? updated : ch));
    await updateDoc(userRef, { CurrentChallenges: next });
    setCurrentChallenges(next);
    setHasStreakPass(false); // on vient d'en consommer un

    Alert.alert(
      t("streakPass.usedTitle", "Streak Pass utilisé"),
      t(
        "streakPass.usedMessage",
        "Ta série a été sauvée grâce à ton Streak Pass."
      )
    );
    setModalVisible(false);
    graceShownRef.current[uniqueKey] = false;

    // 🔢 METRICS + micro-récompense (parité avec les autres chemins)
    try {
      await recordDailyGlobalMark(userId, today);
      await finalizePerfectMonthIfNeeded(today, userId);

      const FOCUS_ID = "focus";
      const isFocus =
        (updated as any)?.id === FOCUS_ID || (updated as any)?.slug === "focus";
      if (isFocus) await recordFocusMark(userId, today);
      if (updated.duo) await bumpDuoStreak(userId, updated.streak || 0);
    } catch {}

    try {
      const bank = await getMicroWeek();
      if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
        await updateDoc(userRef, {
          trophies: increment(TROPHY.MICRO_PER_DAY),
        });
        const nextBank = await incMicroWeek();
        try {
          DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, nextBank);
        } catch {}
      }
    } catch {}

    // 🔔 coalescé
    scheduleAchievementsCheck(userId);
  } catch (error: any) {
    console.error("❌ Erreur handleUseStreakPass:", error.message);
    Alert.alert(
      t("error"),
      error?.message ||
        t("unableToUseStreakPass", "Impossible d'utiliser le Streak Pass.")
    );
  }
};



const showMissedChallengeModal = (id: string, selectedDays: number) => {
  console.log("Affichage modal pour :", id, selectedDays);
  setSelectedChallenge({ id, selectedDays });
  setModalVisible(true);

  // 🔍 Check silencieux du nombre de Streak Pass
  (async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setHasStreakPass(false);
        return;
      }

      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        setHasStreakPass(false);
        return;
      }

      const data = snap.data() as any;
      const count =
        typeof data?.inventory?.streakPass === "number"
          ? data.inventory.streakPass
          : 0;

      setHasStreakPass(count > 0);
    } catch (e) {
      __DEV__ &&
        console.warn(
          "[MissedModal] streakPass read error:",
          (e as any)?.message ?? e
        );
      setHasStreakPass(false);
    }
  })();
};


const completeChallenge = async (
  id: string,
  selectedDays: number,
  doubleReward: boolean = false
) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const uniqueKey = makeUK(id, selectedDays);
  const today = getToday().toISOString();

  try {
    // 🔒 évite double finish concurrent
    if (inFlightCompletes.current.has(uniqueKey)) {
      __DEV__ && console.log("[completeChallenge] skip (in-flight)", uniqueKey);
      return;
    }
    inFlightCompletes.current.add(uniqueKey);

    const userRef = doc(db, "users", userId);
    const challengeRef = doc(db, "challenges", id);
    const todayKey = dayKeyUTC(getToday());

    let finalTrophiesComputed = 0;
    let toCompleteSnapshot: CurrentChallenge | null = null;

    await runTransaction(db, async (tx) => {
      // USER
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error("user doc not found");
      const uData = uSnap.data();
      const curr: CurrentChallenge[] = Array.isArray(uData.CurrentChallenges) ? uData.CurrentChallenges : [];
      const idx = curr.findIndex((c) => c.uniqueKey === uniqueKey);
      if (idx === -1) throw new Error("challengeNotFound");
      const toComplete = { ...curr[idx] };
      toCompleteSnapshot = toComplete;


      const myKeys: string[] =
        (toComplete as any).completionDateKeys ??
        (toComplete.completionDates || []).map(coerceToDayKey).filter(Boolean);
      const keysSorted = uniq(myKeys).sort();

      // Partenaire (facultatif)
      let partnerFinishKey: string | null = null;
      if (toComplete.duo && toComplete.duoPartnerId) {
        const pRef = doc(db, "users", toComplete.duoPartnerId);
        const pSnap = await tx.get(pRef).catch(() => null as any);
        if (pSnap?.exists()) {
          const pData = pSnap.data();
          const pArr: CurrentChallenge[] = Array.isArray(pData.CurrentChallenges) ? pData.CurrentChallenges : [];
          const p = pArr.find((ch) => {
            if (ch?.uniqueKey === uniqueKey) return true;
            const cid = (ch as any)?.challengeId ?? ch?.id;
            return cid === id && Number(ch?.selectedDays) === Number(selectedDays);
          });
          const pKeys: string[] =
            (p as any)?.completionDateKeys ??
            (p?.completionDates || []).map(coerceToDayKey).filter(Boolean);
          if (pKeys?.length) partnerFinishKey = pKeys[pKeys.length - 1];
        }
      }

      const { total } = computeChallengeTrophies({
        selectedDays,
        completionKeys: keysSorted,
        myFinishKey: todayKey,
        partnerFinishKey,
        isDuo: !!toComplete.duo,
        isDoubleReward: !!doubleReward,
        longestStreak: Number(uData?.longestStreak || 0),
      });
      finalTrophiesComputed = total;

      // CompletedChallenges append/replace
      const done: any[] = Array.isArray(uData.CompletedChallenges) ? uData.CompletedChallenges : [];
      const prevIdx = done.findIndex((e) => e.id === id);
      const newDone = {
        ...toComplete,
        completedAt: today,
        ...(keysSorted?.length ? { completionDateKeys: keysSorted } : {}),
        history:
          prevIdx !== -1
            ? [
                ...(done[prevIdx].history || []),
                { completedAt: done[prevIdx].completedAt, selectedDays: done[prevIdx].selectedDays },
              ]
            : [],
      };
      if (prevIdx !== -1) done[prevIdx] = newDone;
      else done.push(newDone);

      const newCurr = curr.filter((_, i) => i !== idx);

      tx.update(userRef, {
        CurrentChallenges: newCurr,
        CompletedChallenges: done,
        trophies: increment(finalTrophiesComputed),
        completedChallengesCount: increment(1),
        CompletedChallengeIds: arrayUnion(id),
        // ✅ Compteurs “stats.*” simples, lisibles par ton système de succès
        //    (on les maintient en plus de completedChallengesCount)
        "stats.completed.total": increment(1),
        ["stats.completed.byDays." + String(selectedDays)]: increment(1),
      });

      // CHALLENGE GLOBAL
      const cSnap = await tx.get(challengeRef);
      if (cSnap.exists()) {
        const cData = cSnap.data();
        const users: string[] = Array.isArray(cData.usersTakingChallenge) ? cData.usersTakingChallenge : [];
        tx.update(challengeRef, {
          participantsCount: Math.max((cData.participantsCount || 1) - 1, 0),
          usersTakingChallenge: users.filter((uid) => uid !== userId),
        });
      }

      // DUO cleanup (si l'autre a encore le défi en cours)
      const toComp = toComplete;
      if (toComp.duo && toComp.duoPartnerId) {
        const pRef = doc(db, "users", toComp.duoPartnerId);
        const pSnap = await tx.get(pRef).catch(() => null as any);
        if (pSnap?.exists()) {
          const pData = pSnap.data();
          const pArr: CurrentChallenge[] = Array.isArray(pData.CurrentChallenges) ? pData.CurrentChallenges : [];
          const pIdx = pArr.findIndex((ch) => ch.uniqueKey === uniqueKey);
          if (pIdx !== -1) {
            const pNew = pArr.filter((_, i) => i !== pIdx);
            tx.update(pRef, { CurrentChallenges: pNew });
          }
        }
      }
    });
// --- METRICS: catégories complétées, évènement saisonnier, fin de duo
try {
  if (toCompleteSnapshot) {
    const completedCategory =
      (toCompleteSnapshot as any)?.category ??
      (toCompleteSnapshot as any)?.categoryId;
    await addCompletedCategory(userId, completedCategory);

    const isSeasonal = (toCompleteSnapshot as any)?.seasonal === true;
    if (isSeasonal) await recordSeasonalCompleted(userId);

    if (toCompleteSnapshot.duo) {
      await recordDuoFinish(userId);
    }
  }
} catch {}
// 🔐 ZERO-MISS LONG RUN (30/60 jours) — spécifique au DÉFI complété
    try {
      // On considère "réussi sans loupé" si:
      // - on a exactement `selectedDays` validations
      // - les clés sont consécutives jour par jour (UTC)
      const keys = (toCompleteSnapshot as any)?.completionDateKeys as string[] | undefined;
      if (Array.isArray(keys) && keys.length === selectedDays && selectedDays >= 30) {
        const sorted = [...keys].sort(); // "YYYY-MM-DD" => tri lexicographique OK
        let consecutive = true;
        for (let i = 1; i < sorted.length; i++) {
          if (diffDaysUTC(sorted[i - 1], sorted[i]) !== 1) { consecutive = false; break; }
        }
        if (consecutive) {
          if (selectedDays >= 30) await setBool(userId, "zeroMissLongRun30", true);
          if (selectedDays >= 60) await setBool(userId, "zeroMissLongRun60", true);
        }
      }
    } catch (e) {
      __DEV__ && console.warn("[achievements] zero-miss check error:", (e as any)?.message ?? e);
    }

    Alert.alert(
  t("finalCongratsTitle"),
  t("finalCongratsMessage", { count: finalTrophiesComputed }),
  [
    { text: t("ok") }
  ]
);
    // 🔔 coalescé
    scheduleAchievementsCheck(userId);
  } catch (error) {
    console.error("❌ Erreur completeChallenge :", error.message);
    Alert.alert(t("error"), t("unableToFinalizeChallenge"));
    } finally {
    inFlightCompletes.current.delete(uniqueKey);
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
      const uniqueKey = makeUK(id, selectedDays);
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
      const completionDates: string[] = [];
      const completionDateKeys: string[] = [];
      for (let i = streakValue - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        completionDates.push(d.toISOString());       // ✅ lisible pour l’historique
        completionDateKeys.push(dayKeyUTC(d));           // ✅ clé UTC pour la logique
      }
      challengeToUpdate.streak = streakValue;
      challengeToUpdate.completionDates = completionDates;
      challengeToUpdate.completedDays = streakValue;
      challengeToUpdate.lastMarkedDate =
        completionDates.length ? completionDates[completionDates.length - 1] : undefined;
      (challengeToUpdate as any).completionDateKeys = completionDateKeys;
      (challengeToUpdate as any).lastMarkedKey =
        completionDateKeys.length ? completionDateKeys[completionDateKeys.length - 1] : undefined;
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
      // 🔔 coalescé
      scheduleAchievementsCheck(userId);
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
        requestRewardedAd,   // ⬅️ ajouté
        preloadRewarded,
      }}
    >
      <View style={styles.providerContainer}>
        {children}
        {modalVisible && (
  <MissedChallengeModal
    visible={modalVisible}
    onClose={closeMissedModal}
    onReset={handleReset}
    onWatchAd={handleWatchAd}
    onUseTrophies={handleUseTrophies}
    trophyCost={
      selectedChallenge
        ? getSkipTrophyCost(selectedChallenge.selectedDays)
        : 5
    }
    hasStreakPass={hasStreakPass}
    onUseStreakPass={handleUseStreakPass}
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
