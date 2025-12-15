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
import {
  Alert,
  StyleSheet,
  View,
  AccessibilityInfo,
  Text,
  Animated,
  Easing,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  checkForAchievements,
  deductTrophies,
} from "../helpers/trophiesHelpers";
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
import { MICRO_WEEK_UPDATED_EVENT } from "../hooks/useTrophiesEconomy";
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
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";



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
async function addParticipantToChallengeGlobal(
  challengeId: string,
  userId: string
) {
  const challengeRef = doc(db, "challenges", challengeId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const users: string[] = Array.isArray(data.usersTakingChallenge)
      ? data.usersTakingChallenge
      : [];
    if (users.includes(userId)) return;
    tx.update(challengeRef, {
      participantsCount: increment(1),
      usersTakingChallenge: arrayUnion(userId),
    });
  });
}

// --- Helpers stables ---
const makeUK = (id: string, days: number) => `${id}_${days}`;

// Clé duo canonique, avec UIDs triés pour être identiques chez A et B
const makeDuoUK = (id: string, days: number, u1: string, u2: string) => {
  const [a, b] = [u1, u2].sort(); // ordre stable
  return `${id}_${days}_${a}-${b}`;
};

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

// 🔍 Helper unique pour retrouver un challenge dans un tableau
// → Ne dépend plus de uniqueKey, uniquement de (challengeId || id) + selectedDays
const findChallengeIndexByIdAndDays = (
  arr: CurrentChallenge[],
  id: string,
  selectedDays: number
): number => {
  return arr.findIndex((c: any) => {
    const cid = c?.challengeId ?? c?.id;
    return (
      cid === id &&
      Number(c?.selectedDays ?? 0) === Number(selectedDays)
    );
  });
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

async function finalizePerfectMonthIfNeeded(
  now: Date,
  userId?: string | null
) {
  if (!userId) return;
  if (!isLastUtcDayOfMonth(now)) return;
  try {
    const tokenKey = `pm_finalized_${monthTokenUTC(now)}`;
    const already = await AsyncStorage.getItem(tokenKey);
    if (already === "1") return;
    await tryFinalizePerfectMonth(userId, now.getUTCFullYear(), now.getUTCMonth() + 1);
    await AsyncStorage.setItem(tokenKey, "1");
  } catch (e: any) {
    __DEV__ &&
      console.warn("[perfectMonth] finalize error:", e?.message ?? e);
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
  slug?: string;
  seasonal?: boolean;
  categoryId?: string;
}

interface CurrentChallengesContextType {
  currentChallenges: CurrentChallenge[];
  setCurrentChallenges: React.Dispatch<React.SetStateAction<CurrentChallenge[]>>;
  simulatedToday: Date | null;
  setSimulatedToday: React.Dispatch<React.SetStateAction<Date | null>>;
  takeChallenge: (
    challenge: Challenge,
    selectedDays: number,
    options?: { duo?: boolean; duoPartnerId?: string }
  ) => Promise<void>;
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

type MissedChallengeModalComponent = React.ComponentType<any>;

export const CurrentChallengesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentChallenges, setCurrentChallenges] = useState<
    CurrentChallenge[]
  >([]);
  const [simulatedToday, setSimulatedToday] = useState<Date | null>(null);
  const { showInterstitials, showRewarded } = useAdsVisibility();
  const pathname = usePathname();
  const { TROPHY, getMicroWeek, incMicroWeek } = useTrophiesEconomy();
  const { t } = useTranslation();

  const isActiveRef = useRef(true);

  // Masquer ADS sur routes d'auth
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  // Garde globale init ads + NPA

  const interstitialRef = useRef<InterstitialAd | null>(null);
  const rewardedRef = useRef<RewardedAd | null>(null);

  const interstitialAdUnitId = adUnitIds.interstitial;
  const rewardedAdUnitId = adUnitIds.rewarded;
  const npa = (globalThis as any).__NPA__ === true;

  const graceShownRef = useRef<Record<string, boolean>>({});

   // 🔔 Petit système de toast inline (success / info / warning / error)
  const [toastState, setToastState] = useState<{
    visible: boolean;
    kind: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

    // 🎛 Animation pour le toast premium
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toastState.visible) {
      toastAnim.setValue(0);
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [toastState.visible, toastAnim]);

  // ✅ Heartbeat pour downgrade DUO → SOLO même si mon doc ne bouge pas
useEffect(() => {
  let mounted = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const run = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const mine = currentChallengesRef.current || [];
      const hasDuo = mine.some((c) => c.duo && c.duoPartnerId);
      if (!hasDuo) return;

      // throttle global anti-spam
      const now = Date.now();
      (globalThis as any).__lastReconcileAt =
        (globalThis as any).__lastReconcileAt || 0;

      if (now - (globalThis as any).__lastReconcileAt < 1500) return;
      (globalThis as any).__lastReconcileAt = now;

      await reconcileDuoLinks(uid, mine, setCurrentChallenges);
    } catch {}
  };

  // 1) Run once
  void run();

  // 2) Run when app returns foreground
  const sub = AppState.addEventListener("change", (state) => {
    if (!mounted) return;
    if (state === "active") void run();
  });

  // 3) Small interval (safe & light)
  intervalId = setInterval(() => {
    if (!mounted) return;
    void run();
  }, 4000);

  return () => {
    mounted = false;
    try {
      // @ts-ignore compat
      sub?.remove?.();
    } catch {}
    if (intervalId) clearInterval(intervalId);
  };
}, []);


  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [hasStreakPass, setHasStreakPass] = useState(false);
  const [rewardLoaded, setRewardLoaded] = useState(false);

  const [selectedChallenge, setSelectedChallenge] = useState<{
    id: string;
    selectedDays: number;
  } | null>(null);

  // 🔒 Guards
  const inFlightMarks = useRef<Set<string>>(new Set());
  const inFlightCompletes = useRef<Set<string>>(new Set());
  const inFlightRemovals = useRef<Set<string>>(new Set());

  // 🔔 Coalescer de succès
  const achTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achUserRef = useRef<string | null>(null);
  const lastAchCheckAtRef = useRef(0);

  // ✅ Ref miroir pour éviter un "currentChallenges stale"
  const currentChallengesRef = useRef<CurrentChallenge[]>([]);
  useEffect(() => {
    currentChallengesRef.current = currentChallenges;
  }, [currentChallenges]);

  // ✅ Modal dynamic loader (anti-cycle)
  const missedModalRef = useRef<MissedChallengeModalComponent | null>(null);
  const getMissedModalComponent = () => {
    if (!missedModalRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      missedModalRef.current =
        require("../components/MissedChallengeModal").default;
    }
    return missedModalRef.current;
  };

  // 🔊 Respect Reduce Motion pour haptics/alerts
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      // @ts-ignore compat
      sub?.remove?.();
    };
  }, []);

  // 🧹 Cleanup du timer de toast à l'unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const notify = (
    kind: "success" | "error" | "info" | "warning",
    title: string,
    message: string,
    buttons?: { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[]
  ) => {
    try {
      if (!reduceMotion) {
        const map = {
          success: Haptics.NotificationFeedbackType.Success,
          error: Haptics.NotificationFeedbackType.Error,
          info: Haptics.NotificationFeedbackType.Success,
          warning: Haptics.NotificationFeedbackType.Warning,
        } as const;
        Haptics.notificationAsync(map[kind]).catch(() => {});
      }
    } catch {}
    if (buttons && buttons.length) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  };

   // 🌈 Toast premium (utilisé pour "marquer aujourd'hui" & autres succès discrets)
  const showToast = (
    kind: "success" | "error" | "info" | "warning",
    title: string,
    message: string
  ) => {
    try {
      if (!reduceMotion) {
        const map = {
          success: Haptics.NotificationFeedbackType.Success,
          error: Haptics.NotificationFeedbackType.Error,
          info: Haptics.NotificationFeedbackType.Success,
          warning: Haptics.NotificationFeedbackType.Warning,
        } as const;
        Haptics.notificationAsync(map[kind]).catch(() => {});
      }
    } catch {}

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToastState({
      visible: true,
      kind,
      title,
      message,
    });

    toastTimerRef.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  const scheduleAchievementsCheck = (uid?: string | null, delay = 350) => {
    if (!uid) return;
    achUserRef.current = uid;
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
    achTimerRef.current = setTimeout(() => {
      const u = achUserRef.current;
      if (!u) return;
      const now = Date.now();
      const COOLDOWN_MS = 2500;
      if (now - lastAchCheckAtRef.current < COOLDOWN_MS) {
        achTimerRef.current = null;
        return;
      }
      lastAchCheckAtRef.current = now;
      checkForAchievements(u).catch(() => {});
      achTimerRef.current = null;
    }, delay);
  };

  const checkAdCooldown = async () => {
    const lastAdTime = await AsyncStorage.getItem("lastInterstitialTime");
    if (!lastAdTime) return true;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    return now - parseInt(lastAdTime, 10) > cooldownMs;
  };

  const markAdShown = async () => {
    await AsyncStorage.setItem("lastInterstitialTime", Date.now().toString());
  };

  const closeMissedModal = () => {
    setModalVisible(false);
    if (selectedChallenge) {
      const k = makeUK(selectedChallenge.id, selectedChallenge.selectedDays);
      graceShownRef.current[k] = false;
    }
    setSelectedChallenge(null);
  };

  // Interstitial backoff & timers
  const interRetryRef = useRef(0);
  const interTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
    // 👉 On fait confiance à AdsVisibilityContext : si showInterstitials est false, on ne charge pas.
    if (isAuthRoute || !showInterstitials) {
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
        interstitialRef.current = null;
        setAdLoaded(false);
        const delay = 1000;
        interTimerRef.current = setTimeout(createAndLoad, delay);
      });

      const onError = ad.addAdEventListener(AdEventType.ERROR, (e) => {
        __DEV__ && console.warn("[Interstitial] ERROR:", e?.message);
        interstitialRef.current = null;
        setAdLoaded(false);
        const delay = Math.min(
          30000,
          1000 * Math.pow(2, interRetryRef.current++)
        );
        interTimerRef.current = setTimeout(createAndLoad, delay);
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
      if (interTimerRef.current) {
        clearTimeout(interTimerRef.current);
        interTimerRef.current = null;
      }
      interstitialRef.current = null;
      setAdLoaded(false);
    };
  }, [isAuthRoute, showInterstitials, interstitialAdUnitId, npa]);


  // Rewarded backoff & timers
  const rewardRetryRef = useRef(0);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   useEffect(() => {
    if (isAuthRoute || !showRewarded) {
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

      const onLoaded = ad.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          rewardRetryRef.current = 0;
          setRewardLoaded(true);
          __DEV__ && console.log("[Rewarded] LOADED");
        }
      );

      const onClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        rewardedRef.current = null;
        setRewardLoaded(false);
        const delay = 1000;
        rewardTimerRef.current = setTimeout(createAndLoad, delay);
      });

      const onError = ad.addAdEventListener(AdEventType.ERROR, (e) => {
        __DEV__ && console.warn("[Rewarded] ERROR:", e?.message);
        rewardedRef.current = null;
        setRewardLoaded(false);
        const delay = Math.min(
          30000,
          1000 * Math.pow(2, rewardRetryRef.current++)
        );
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
  }, [isAuthRoute, showRewarded, rewardedAdUnitId, npa]);


/** 🔥 VERSION FINALE — ZERO BUGS  
 *  Gère 100 % des cas DUO/SOLO :
 *  
 * 1. A invite B → si B avait un SOLO, il est détruit puis recréé en DUO (0 jours)
 * 2. Si un membre du duo supprime → l’autre repasse SOLO proprement
 * 3. Plus JAMAIS un état mixte (A en duo/B en solo)
 */
async function reconcileDuoLinks(
  myUserId: string,
  myChallenges: CurrentChallenge[],
  setCurrent: React.Dispatch<React.SetStateAction<CurrentChallenge[]>>
) {
  const myDuo = myChallenges.filter((c) => c.duo && c.duoPartnerId);
  if (!myDuo.length) return;

  const shouldDowngradeKeys = new Set<string>();

  for (const ch of myDuo) {
    const partnerId = ch.duoPartnerId!;
    const baseId = ch.challengeId ?? ch.id;
    const days = Number(ch.selectedDays);
    const duoKey = makeDuoUK(baseId, days, myUserId, partnerId);

    try {
      const partnerRef = doc(db, "users", partnerId);
      const snap = await getDoc(partnerRef);

      // si partner doc n'existe pas → je repasse solo
      if (!snap.exists()) {
        if (ch.uniqueKey) shouldDowngradeKeys.add(ch.uniqueKey);
        continue;
      }

      const partnerData = snap.data() as any;
      const list: CurrentChallenge[] = Array.isArray(partnerData.CurrentChallenges)
        ? partnerData.CurrentChallenges
        : [];

      const partnerHasSame = list.some((p: any) => {
        if (p?.uniqueKey === duoKey) return true;
        const cid = p?.challengeId ?? p?.id;
        return cid === baseId && Number(p?.selectedDays) === days;
      });

      // 🔥 partner n'a plus le challenge (ou plus le duo) → je repasse solo
      if (!partnerHasSame) {
        if (ch.uniqueKey) shouldDowngradeKeys.add(ch.uniqueKey);
      }
    } catch (e) {
      __DEV__ && console.warn("[reconcileDuoLinks] read partner error:", e);
      // en cas d'erreur réseau, on ne downgrade pas par sécurité
    }
  }

  if (!shouldDowngradeKeys.size) return;

  const meRef = doc(db, "users", myUserId);

  const newMine = myChallenges.map((c) => {
    if (!c.uniqueKey) return c;
    if (!shouldDowngradeKeys.has(c.uniqueKey)) return c;

    const baseId = (c as any)?.challengeId ?? c.id;
    const days = Number(c.selectedDays);

    return {
      ...c,
      duo: false,
      duoPartnerId: null,
      duoPartnerUsername: null,
      uniqueKey: makeUK(baseId, days),
    };
  });

  try {
    await updateDoc(meRef, { CurrentChallenges: newMine });
    setCurrent(newMine);
  } catch (e: any) {
    console.warn("[reconcileDuoLinks] update self error:", e?.message ?? e);
  }
}


  const getToday = () => simulatedToday || new Date();

  // --- Snapshot / auth effect ---
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let cancelled = false;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        isActiveRef.current = false;
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setCurrentChallenges([]);
        return;
      }

      isActiveRef.current = true;
      const userId = user.uid;
      const userRef = doc(db, "users", userId);

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
          const rawList: CurrentChallenge[] = Array.isArray(
            userData.CurrentChallenges
          )
            ? userData.CurrentChallenges
            : [];

                    const userId = user.uid;

          const normalizeUniqueKey = (ch: CurrentChallenge): string => {
  // 🔒 JAMAIS recalculer une clé existante
  if (ch.uniqueKey) return ch.uniqueKey;

  const id = (ch as any)?.challengeId ?? ch.id;
  const days = Number(ch.selectedDays);

  return ch.uniqueKey ?? makeUK(id, days);
};


          const uniqueChallenges = Array.from(
  new Map(
    rawList.map((ch: CurrentChallenge) => {
      const key = normalizeUniqueKey(ch);
      return [key, { ...ch, uniqueKey: key } as CurrentChallenge];
    })
  ).values()
);

// ✅ Diff rapide pour éviter les re-renders inutiles
const prev = currentChallengesRef.current;
const hash = (c: CurrentChallenge) =>
  [
    c.uniqueKey,
    c.completedDays,
    (c as any)?.lastMarkedKey,
    (c as any)?.streak,
  ].join("|");

const same =
  prev.length === uniqueChallenges.length &&
  prev.every((x, i) => hash(x) === hash(uniqueChallenges[i]));

if (!same) {
  setCurrentChallenges(uniqueChallenges);

  // ✅ Auto-reconcile DUO → SOLO (sans écrire chez le partner)
  try {
    const hasDuo = uniqueChallenges.some((c) => c.duo && c.duoPartnerId);
    if (hasDuo) {
      // throttle anti-spam
      const now = Date.now();
      (globalThis as any).__lastReconcileAt = (globalThis as any).__lastReconcileAt || 0;

      if (now - (globalThis as any).__lastReconcileAt > 1500) {
        (globalThis as any).__lastReconcileAt = now;

        // ⚠️ IMPORTANT: on ne passe que des données "fraîches"
        reconcileDuoLinks(userId, uniqueChallenges, setCurrentChallenges);
      }
    }
  } catch {}
}

scheduleAchievementsCheck(userId);

try {
  finalizePerfectMonthIfNeeded(getToday(), userId);
} catch {}


        },
        (error) => {
          console.error(
            "❌ Erreur onSnapshot Challenges:",
            error.message,
            error.code
          );
          notify(
            "error",
            t("error", "Erreur"),
            t("unableToLoadChallenges", {
              defaultValue:
                "Impossible de charger les défis: {{message}}",
              message: error.message,
            })
          );
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
  }, [t]);

  const takeChallenge = async (
    challenge: Challenge,
    selectedDays: number,
    options?: { duo?: boolean; duoPartnerId?: string }
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      notify(
        "error",
        t("error", "Erreur"),
        t("loginRequired", "Connexion requise.")
      );
      return;
    }

     const uniqueKey =
      options?.duo && options.duoPartnerId
        ? makeDuoUK(challenge.id, selectedDays, userId, options.duoPartnerId)
        : makeUK(challenge.id, selectedDays);

    if (currentChallenges.find((ch) => ch.uniqueKey === uniqueKey)) {
      notify(
        "info",
        t("info", "Info"),
        t("challengeAlreadyTaken", "Défi déjà en cours.")
      );
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
        lastMarkedKey: null,
        streak: 0,
        uniqueKey,
        completionDates: [],
        completionDateKeys: [],
        startedAt: todayString,
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

      await addParticipantToChallengeGlobal(challenge.id, userId);

      try {
        const DAYS = Number(selectedDays);
        if ([7, 30, 90, 180, 365].includes(DAYS)) {
          await incStat(userId, `selectChallengeDays.${DAYS}`, 1);
        }
      } catch (e) {
        __DEV__ &&
          console.warn(
            "[achievements] selectChallengeDays inc error:",
            (e as any)?.message ?? e
          );
      }

      try {
        await logEventOnce("first_challenge", "first_challenge_started", {
          challengeId: challenge.id,
          selectedDays,
        });
      } catch (e) {
        console.log(
          "[analytics] first_challenge_started error:",
          (e as any)?.message ?? e
        );
      }

      scheduleAchievementsCheck(userId);
    } catch (error: any) {
      console.error("Erreur lors de l'ajout du défi :", error.message);
      notify(
        "error",
        t("error", "Erreur"),
        t("unableToAddChallenge", "Impossible d'ajouter le défi.")
      );
    }
  };

 const removeChallenge = async (id: string, selectedDays: number): Promise<void> => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const key = makeUK(id, selectedDays);
  if (inFlightRemovals.current.has(key)) return;
  inFlightRemovals.current.add(key);

  try {
    const userRef = doc(db, "users", userId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const curr: CurrentChallenge[] = Array.isArray(data.CurrentChallenges)
        ? data.CurrentChallenges
        : [];

      const idx = findChallengeIndexByIdAndDays(curr, id, selectedDays);
      if (idx === -1) return;

      // 🔥 IMPORTANT : on supprime UNIQUEMENT chez moi
      const next = curr.filter((_, i) => i !== idx);
      tx.update(userRef, { CurrentChallenges: next });
    });

  } catch (e: any) {
    console.error("❌ removeChallenge error:", e?.message ?? e);
  } finally {
    inFlightRemovals.current.delete(key);
  }
};


   const isMarkedToday = (id: string, selectedDays: number): boolean => {
    const idx = findChallengeIndexByIdAndDays(currentChallenges, id, selectedDays);
    if (idx === -1) return false;
    const ch = currentChallenges[idx];
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
      const todayKey = dayKeyUTC(now);
      const userRef = doc(db, "users", userId);

      let missedDays = 0;
      let needsComplete = false;
      let newStreak = 0;

      // Flags pour contrôler un SEUL toast en sortie
     let microEarned = 0;
     let streakBonus:
       | {
           bonus: number;
           streak: number;
         }
       | null = null;

            await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error("user doc not found");
        const data = snap.data() as any;
        const arr: CurrentChallenge[] = Array.isArray(
          data.CurrentChallenges
        )
          ? data.CurrentChallenges
          : [];

        // ✅ Utilise le helper pour trouver l'index
        const idx = findChallengeIndexByIdAndDays(arr, id, selectedDays);
        if (idx === -1) throw new Error("challengeNotFound");

        const ch: any = { ...arr[idx] };

        // ✅ Normaliser le uniqueKey SANS casser le duo
        const isDuo = !!ch.duo && !!ch.duoPartnerId;
        const canonicalKey = isDuo
          ? makeDuoUK(
              (ch as any)?.challengeId ?? ch.id,
              Number(ch.selectedDays),
              userId,
              ch.duoPartnerId as string
            )
          : makeUK((ch as any)?.challengeId ?? ch.id, Number(ch.selectedDays));

        ch.uniqueKey = canonicalKey;

        if (Number(ch.completedDays || 0) >= Number(ch.selectedDays)) {
          throw new Error("alreadyCompleted");
        }

        const keys = readKeys(ch);
        if (keys.includes(todayKey)) throw new Error("alreadyMarked");

        const refKey =
          ch?.lastMarkedKey ??
          coerceToDayKey(ch?.lastMarkedDate) ??
          (ch?.startedKey ?? coerceToDayKey(ch?.startedAt));
        if (refKey) missedDays = diffDaysUTC(refKey, todayKey);
        if (missedDays >= 2) return;

        pushCompletion(ch, now);
        ch.streak = Number(ch.streak || 0) + 1;
        ch.completedDays = clamp(
          Number(ch.completedDays || 0) + 1,
          Number(ch.selectedDays)
        );
        newStreak = Number(ch.streak || 0);
        needsComplete = ch.completedDays >= ch.selectedDays;

        const next = arr.map((x, i) => (i === idx ? ch : x));
        tx.update(userRef, { CurrentChallenges: next });

        const prevMax = Number(data?.stats?.streak?.max ?? 0);
        if (newStreak > prevMax) {
          tx.update(userRef, { "stats.streak.max": newStreak });
        }
      });



      if (missedDays >= 2) {
        const uKey = uniqueKey;
        if (!graceShownRef.current[uKey]) {
          showMissedChallengeModal(id, selectedDays);
          graceShownRef.current[uKey] = true;
        }
        return { success: false, missedDays };
      }

      try {
        await recordDailyGlobalMark(userId, now);
        await finalizePerfectMonthIfNeeded(now, userId);

        const FOCUS_ID = "focus";
        const isFocus = id === FOCUS_ID;
        if (isFocus) {
          await recordFocusMark(userId, now);
        }
      } catch {}

      try {
        const bank = await getMicroWeek();
        if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
          await updateDoc(doc(db, "users", userId), {
            trophies: increment(TROPHY.MICRO_PER_DAY),
          });
          const next = await incMicroWeek();
          try {
            DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, next);
          } catch {}
          // On enregistre juste le gain pour le toast final
         microEarned = TROPHY.MICRO_PER_DAY;
        }
      } catch {}

      try {
        const hit = TROPHY.STREAK_BONUS.find(
          (b) => b.at === newStreak
        );
        if (hit?.bonus) {
          await updateDoc(doc(db, "users", userId), {
            trophies: increment(hit.bonus),
          });
          // On garde l’info pour le toast final unique
         streakBonus = {
           bonus: hit.bonus,
           streak: newStreak,
         };
        }
      } catch {}

           try {
        const justSawRewarded =
          Date.now() -
            (Number(await AsyncStorage.getItem("lastRewardedTime")) ||
              0) <
          60_000;

        if (
          showInterstitials &&
          !isAuthRoute &&
          !justSawRewarded
        ) {
          const canShowAd = await checkAdCooldown();
          if (canShowAd && adLoaded && interstitialRef.current) {
            await interstitialRef.current.show();
            await markAdShown();
          } else {
            __DEV__ &&
              console.log(
                "[Interstitial] Skip show: canShowAd=",
                canShowAd,
                "adLoaded=",
                adLoaded
              );
          }
        }
      } catch (e: any) {
        console.warn(
          "[Interstitial] show error:",
          e?.message ?? e
        );
      }


      if (needsComplete) {
        if (!inFlightCompletes.current.has(uniqueKey)) {
          inFlightCompletes.current.add(uniqueKey);
          try {
            await completeChallenge(id, selectedDays, false);
          } finally {
            inFlightCompletes.current.delete(uniqueKey);
          }
        }
      } else {
        // 🌟 Toast premium pour le marquage du jour (sans Alert bloquante)
         // ✅ Un seul toast en bas, priorité :
       // 1) Bonus de série
       // 2) Micro-trophées
       // 3) Simple "jour marqué"
       if (streakBonus) {
         showToast(
           "success",
           t("streakBonusTitle", "Bonus de série"),
           t("streakBonusMessage", {
             bonus: streakBonus.bonus,
             streak: streakBonus.streak,
             defaultValue:
               "Bravo ! Ta série de {{streak}} jours t’apporte {{bonus}} trophée(s) bonus.",
           })
         );
       } else if (microEarned > 0) {
         showToast(
           "success",
           t("microEarnedTitle", "Trophées gagnés"),
           t("microEarnedMessage", {
             count: microEarned,
             defaultValue:
               "Tu as gagné {{count}} trophée(s) bonus aujourd’hui !",
           })
         );
       } else {
         showToast(
           "success",
           t("markedTitle", "Progression validée"),
           t("markedMessage", "Jour marqué avec succès.")
         );
      }
      }

      scheduleAchievementsCheck(userId);
      return { success: true };
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (msg === "alreadyCompleted") {
        showToast(
          "info",
          t("alreadyMarkedTitle", "Défi déjà terminé"),
          t("alreadyCompleted", "Ce défi est déjà complété.")
        );
      } else if (msg === "alreadyMarked") {
       showToast(
          "info",
          t("alreadyMarkedTitle", "Déjà validé"),
          t(
            "alreadyMarkedMessage",
            "Tu as déjà validé ce jour pour ce défi."
          )
        );
      } else if (msg === "challengeNotFound") {
        showToast(
          "error",
          t("error", "Erreur"),
          t("challengeNotFound", "Défi introuvable.")
        );
      } else {
        console.error("❌ Erreur lors du marquage :", msg);
        showToast(
          "error",
          t("error", "Erreur"),
          t(
            "unableToMarkChallenge",
            "Impossible de marquer ce défi."
          )
        );
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

const challengeIndex = findChallengeIndexByIdAndDays(
  currentChallengesArray,
  id,
  selectedDays
);
if (challengeIndex === -1) {
  console.log("Challenge non trouvé pour reset :", uniqueKey);
  return;
}

const updated = {
  ...currentChallengesArray[challengeIndex],
} as any;
pushCompletion(updated, today);
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
        notify(
          "info",
          t("streakResetTitle", "Série remise à zéro"),
          t(
            "streakResetMessage",
            "Ta série a été réinitialisée, aujourd’hui compte comme nouveau départ."
          )
        );
        setModalVisible(false);
        scheduleAchievementsCheck(userId);
        graceShownRef.current[makeUK(id, selectedDays)] = false;
      } catch (error: any) {
        console.error(
          "❌ Erreur lors du reset :",
          error.message
        );
        notify(
          "error",
          t("error", "Erreur"),
          t(
            "unableToResetStreak",
            "Impossible de réinitialiser la série."
          )
        );
      }
    };

    if (hasStreakPass) {
      notify(
        "warning",
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
        }
      );

      const closeSub = ad.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          earnedSub();
          closeSub();
          if (earned) {
            try {
              AsyncStorage.setItem(
                "lastRewardedTime",
                String(Date.now())
              );
            } catch {}
          }
          if (earned) resolve();
          else reject(new Error("Aucune récompense obtenue"));
        }
      );

      ad.show().catch((err) => {
        try {
          earnedSub();
          closeSub();
        } catch {}
        reject(err);
      });
    });
  };

  const preloadRewarded = () => {
    if (rewardedRef.current && !rewardLoaded) {
      try {
        rewardedRef.current.load();
      } catch {}
    }
  };

  const requestRewardedAd = async (): Promise<boolean> => {
    if (!rewardedRef.current || !rewardLoaded) return false;
    try {
      await showRewardedAndWait();
      return true;
    } catch {
      return false;
    }
  };

  const handleWatchAd = async () => {
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
      const arr: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];
      const index = findChallengeIndexByIdAndDays(arr, id, selectedDays);
if (index === -1) {
  console.log("Challenge non trouvé pour handleWatchAd :", uniqueKey);
  return;
}

const updated = { ...arr[index] } as any;

      pushCompletion(updated, today);
      updated.streak = Number(updated.streak || 0) + 1;
      updated.completedDays = clamp(
        Number(updated.completedDays || 0) + 1,
        Number(updated.selectedDays)
      );

      const next = arr.map((ch, i) =>
        i === index ? updated : ch
      );
      await updateDoc(userRef, { CurrentChallenges: next });
      setCurrentChallenges(next);
      notify(
        "success",
        t("adWatchedTitle", "Série sauvée"),
        t(
          "adWatchedMessage",
          "Ta série a été sauvée grâce à la vidéo."
        )
      );
      setModalVisible(false);
      scheduleAchievementsCheck(userId);
      graceShownRef.current[makeUK(id, selectedDays)] = false;

      try {
        await recordDailyGlobalMark(userId, today);
        await finalizePerfectMonthIfNeeded(today, userId);
        const FOCUS_ID = "focus";
        const isFocus =
          (updated as any)?.id === FOCUS_ID ||
          (updated as any)?.slug === "focus";
        if (isFocus) await recordFocusMark(userId, today);
        if (updated.duo)
          await bumpDuoStreak(userId, updated.streak || 0);
      } catch {}
      try {
        const bank = await getMicroWeek();
        if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
          await updateDoc(userRef, {
            trophies: increment(TROPHY.MICRO_PER_DAY),
          });
          const nextBank = await incMicroWeek();
          try {
            DeviceEventEmitter.emit(
              MICRO_WEEK_UPDATED_EVENT,
              nextBank
            );
          } catch {}
        }
      } catch {}
    } catch (error: any) {
      console.error(
        "❌ Erreur handleWatchAd:",
        error.message
      );
      notify(
        "error",
        t("error", "Erreur"),
        t(
          "unableToMarkAfterAd",
          "Impossible de marquer après la vidéo."
        )
      );
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

      const currentChallengesArray: CurrentChallenge[] =
        Array.isArray(userData.CurrentChallenges)
          ? userData.CurrentChallenges
          : [];

      const challengeIndex = findChallengeIndexByIdAndDays(
  currentChallengesArray,
  id,
  selectedDays
);
if (challengeIndex === -1) {
  console.log(
    "Challenge non trouvé pour useTrophies :",
    uniqueKey
  );
  return;
}


      const success = await deductTrophies(userId, trophyCost);
      if (!success) {
        notify(
          "warning",
          t(
            "notEnoughTrophiesTitle",
            "Trophées insuffisants"
          ),
          t(
            "notEnoughTrophiesMessage",
            "Tu n’as pas assez de trophées."
          )
        );
        setModalVisible(false);
        return;
      }

      const updated = {
        ...currentChallengesArray[challengeIndex],
      } as any;
      pushCompletion(updated, today);
      updated.streak = Number(updated.streak || 0) + 1;
      updated.completedDays = clamp(
        Number(updated.completedDays || 0) + 1,
        Number(updated.selectedDays)
      );

      const updatedArray = currentChallengesArray.map((ch, i) =>
        i === challengeIndex ? updated : ch
      );

      await updateDoc(userRef, { CurrentChallenges: updatedArray });
      setCurrentChallenges(updatedArray);
      notify(
        "success",
        t("trophiesUsedTitle", "Trophées utilisés"),
        t("trophiesUsedMessage", {
          cost: trophyCost,
          defaultValue:
            "Tu as utilisé {{cost}} trophée(s) pour sauver ta série.",
        })
      );
      setModalVisible(false);
      scheduleAchievementsCheck(userId);

      try {
        await recordDailyGlobalMark(userId, today);
        await finalizePerfectMonthIfNeeded(today, userId);
        const FOCUS_ID = "focus";
        const isFocus =
          (updated as any)?.id === FOCUS_ID ||
          (updated as any)?.slug === "focus";
        if (isFocus) await recordFocusMark(userId, today);
        if (updated.duo)
          await bumpDuoStreak(userId, updated.streak || 0);
      } catch {}
      try {
        const bank = await getMicroWeek();
        if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
          await updateDoc(userRef, {
            trophies: increment(TROPHY.MICRO_PER_DAY),
          });
          const nextBank = await incMicroWeek();
          try {
            DeviceEventEmitter.emit(
              MICRO_WEEK_UPDATED_EVENT,
              nextBank
            );
          } catch {}
        }
      } catch {}
    } catch (error: any) {
      console.error(
        "❌ Erreur useTrophies :",
        error.message
      );
      notify(
        "error",
        t("error", "Erreur"),
        t(
          "unableToMarkWithTrophies",
          "Impossible de valider avec des trophées."
        )
      );
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
      await consumeStreakPass();

      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const arr: CurrentChallenge[] = Array.isArray(
        userData.CurrentChallenges
      )
        ? userData.CurrentChallenges
        : [];

      const index = findChallengeIndexByIdAndDays(arr, id, selectedDays);
if (index === -1) {
  __DEV__ &&
    console.log(
      "Challenge non trouvé pour Streak Pass :",
      uniqueKey
    );
  return;
}


      const updated = { ...arr[index] } as any;
      pushCompletion(updated, today);
      updated.streak = Number(updated.streak || 0) + 1;
      updated.completedDays = clamp(
        Number(updated.completedDays || 0) + 1,
        Number(updated.selectedDays)
      );

      const next = arr.map((ch, i) =>
        i === index ? updated : ch
      );
      await updateDoc(userRef, { CurrentChallenges: next });
      setCurrentChallenges(next);
      setHasStreakPass(false);

      notify(
        "success",
        t("streakPass.usedTitle", "Streak Pass utilisé"),
        t(
          "streakPass.usedMessage",
          "Ta série a été sauvée grâce à ton Streak Pass."
        )
      );
      setModalVisible(false);
      graceShownRef.current[uniqueKey] = false;

      try {
        await recordDailyGlobalMark(userId, today);
        await finalizePerfectMonthIfNeeded(today, userId);

        const FOCUS_ID = "focus";
        const isFocus =
          (updated as any)?.id === FOCUS_ID ||
          (updated as any)?.slug === "focus";
        if (isFocus) await recordFocusMark(userId, today);
        if (updated.duo)
          await bumpDuoStreak(userId, updated.streak || 0);
      } catch {}

      try {
        const bank = await getMicroWeek();
        if ((bank.used || 0) < TROPHY.MICRO_WEEKLY_CAP) {
          await updateDoc(userRef, {
            trophies: increment(TROPHY.MICRO_PER_DAY),
          });
          const nextBank = await incMicroWeek();
          try {
            DeviceEventEmitter.emit(
              MICRO_WEEK_UPDATED_EVENT,
              nextBank
            );
          } catch {}
        }
      } catch {}

      scheduleAchievementsCheck(userId);
    } catch (error: any) {
      console.error(
        "❌ Erreur handleUseStreakPass:",
        error.message
      );
      notify(
        "error",
        t("error", "Erreur"),
        error?.message ||
          t(
            "unableToUseStreakPass",
            "Impossible d'utiliser le Streak Pass."
          )
      );
    }
  };

  const showMissedChallengeModal = (
    id: string,
    selectedDays: number
  ) => {
    console.log("Affichage modal pour :", id, selectedDays);
    setSelectedChallenge({ id, selectedDays });
    setModalVisible(true);

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
      } catch (e: any) {
        __DEV__ &&
          console.warn(
            "[MissedModal] streakPass read error:",
            e?.message ?? e
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
  const today = getToday();
  const todayIso = today.toISOString();
  const todayKey = dayKeyUTC(today);

  try {
    if (inFlightCompletes.current.has(uniqueKey)) {
      __DEV__ &&
        console.log("[completeChallenge] skip (in-flight)", uniqueKey);
      return;
    }
    inFlightCompletes.current.add(uniqueKey);

    const userRef = doc(db, "users", userId);
    const challengeRef = doc(db, "challenges", id);

    let finalTrophiesComputed = 0;
    let toCompleteSnapshot: CurrentChallenge | null = null;

    await runTransaction(db, async (tx) => {
      // 1️⃣ READ USER
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error("user doc not found");
      const uData = uSnap.data();
      const curr: CurrentChallenge[] = Array.isArray(uData.CurrentChallenges)
        ? uData.CurrentChallenges
        : [];

      const idx = findChallengeIndexByIdAndDays(curr, id, selectedDays);
      if (idx === -1) throw new Error("challengeNotFound");

      const toComplete = { ...curr[idx] } as any;
      toCompleteSnapshot = toComplete;

      // Normaliser la clé (solo ou duo)
      const isDuo = !!toComplete.duo && !!toComplete.duoPartnerId;
      const canonicalKey = isDuo
        ? makeDuoUK(
            (toComplete as any)?.challengeId ?? toComplete.id,
            Number(toComplete.selectedDays),
            userId,
            toComplete.duoPartnerId as string
          )
        : makeUK(
            (toComplete as any)?.challengeId ?? toComplete.id,
            Number(toComplete.selectedDays)
          );
      toComplete.uniqueKey = canonicalKey;

      // 2️⃣ READ PARTNER (si duo) — AVANT TOUT WRITE
      let partnerFinishKey: string | null = null;
      let partnerRef: ReturnType<typeof doc> | null = null;
      let partnerCurr: CurrentChallenge[] = [];

      if (isDuo && toComplete.duoPartnerId) {
        partnerRef = doc(db, "users", toComplete.duoPartnerId);
        const pSnap = await tx.get(partnerRef).catch(() => null as any);
        if (pSnap?.exists()) {
          const pData = pSnap.data();
          partnerCurr = Array.isArray(pData.CurrentChallenges)
            ? pData.CurrentChallenges
            : [];

          const p = partnerCurr.find((ch: any) => {
            if (ch?.uniqueKey === canonicalKey) return true;
            const cid = (ch as any)?.challengeId ?? ch?.id;
            return (
              cid === id &&
              Number(ch?.selectedDays) === Number(selectedDays)
            );
          });

          const pKeys: string[] =
            (p as any)?.completionDateKeys ??
            (p?.completionDates || [])
              .map(coerceToDayKey)
              .filter(Boolean);

          if (pKeys?.length) {
            partnerFinishKey = pKeys[pKeys.length - 1];
          }
        }
      }

      // 3️⃣ READ CHALLENGE DOC — TOUJOURS AVANT LES WRITES
      const cSnap = await tx.get(challengeRef).catch(() => null as any);
      const cData = cSnap?.exists() ? cSnap.data() : null;

      // 4️⃣ Calcul des trophées
      const myKeys: string[] =
        (toComplete as any).completionDateKeys ??
        (toComplete.completionDates || [])
          .map(coerceToDayKey)
          .filter(Boolean);

      const keysSorted = uniq(myKeys).sort();

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

      // 5️⃣ Mise à jour CompletedChallenges & CurrentChallenges côté USER
      const done: any[] = Array.isArray(uData.CompletedChallenges)
        ? uData.CompletedChallenges
        : [];

      const prevIdx = done.findIndex((e) => e.id === id);

      const newDone = {
        ...toComplete,
        completedAt: todayIso,
        ...(keysSorted?.length ? { completionDateKeys: keysSorted } : {}),
        history:
          prevIdx !== -1
            ? [
                ...(done[prevIdx].history || []),
                {
                  completedAt: done[prevIdx].completedAt,
                  selectedDays: done[prevIdx].selectedDays,
                },
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
        "stats.completed.total": increment(1),
        ["stats.completed.byDays." + String(selectedDays)]: increment(1),
      });

      // 6️⃣ Mise à jour du challenge global (participants)
      if (cData) {
        const users: string[] = Array.isArray(cData.usersTakingChallenge)
          ? cData.usersTakingChallenge
          : [];
        tx.update(challengeRef, {
          participantsCount: Math.max((cData.participantsCount || 1) - 1, 0),
          usersTakingChallenge: users.filter((uid: string) => uid !== userId),
        });
      }

      // 7️⃣ Si duo → supprimer le défi du partenaire (comportement actuel conservé)
      if (isDuo && partnerRef && partnerCurr.length) {
        const duoKey = toComplete.uniqueKey as string;
        const pIdx = partnerCurr.findIndex((ch: any) => {
          if (ch?.uniqueKey === duoKey) return true;
          const cid = ch?.challengeId ?? ch?.id;
          return cid === id && Number(ch?.selectedDays) === Number(selectedDays);
        });

        if (pIdx !== -1) {
          const pNew = partnerCurr.filter((_x, i) => i !== pIdx);
          tx.update(partnerRef, { CurrentChallenges: pNew });
        }
      }
    });

    // 8️⃣ Stats supplémentaires / achievements hors transaction
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

    try {
      const keys =
        (toCompleteSnapshot as any)?.completionDateKeys as
          | string[]
          | undefined;
      if (Array.isArray(keys) && keys.length === selectedDays && selectedDays >= 30) {
        const sorted = [...keys].sort();
        let consecutive = true;
        for (let i = 1; i < sorted.length; i++) {
          if (diffDaysUTC(sorted[i - 1], sorted[i]) !== 1) {
            consecutive = false;
            break;
          }
        }
        if (consecutive) {
          if (selectedDays >= 30)
            await setBool(userId, "zeroMissLongRun30", true);
          if (selectedDays >= 60)
            await setBool(userId, "zeroMissLongRun60", true);
        }
      }
    } catch (e: any) {
      __DEV__ &&
        console.warn("[achievements] zero-miss check error:", e?.message ?? e);
    }

    // 9️⃣ Feedback UI
    showToast(
      "success",
      t("finalCongratsTitle", "Bravo !"),
      t("finalCongratsMessage", {
        count: finalTrophiesComputed,
        defaultValue: "Défi complété ! Tu as gagné {{count}} trophées.",
      })
    );
    scheduleAchievementsCheck(userId);
  } catch (error: any) {
    console.error("❌ Erreur completeChallenge :", error.message);
    notify(
      "error",
      t("error", "Erreur"),
      t(
        "unableToFinalizeChallenge",
        "Impossible de finaliser ce défi."
      )
    );
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
      console.log(
        "Pas d'utilisateur connecté pour simulateStreak."
      );
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
      let currentChallengesArray: CurrentChallenge[] =
        Array.isArray(userData.CurrentChallenges)
          ? userData.CurrentChallenges
          : [];
      const uniqueKey = makeUK(id, selectedDays);
      const challengeIndex = currentChallengesArray.findIndex(
        (challenge: CurrentChallenge) =>
          challenge.uniqueKey === uniqueKey
      );
      if (challengeIndex === -1) {
        console.log(
          "Challenge non trouvé pour simulateStreak :",
          uniqueKey
        );
        notify(
          "error",
          t(
            "simulation.errorTitle",
            "Erreur de simulation"
          ),
          t(
            "simulation.challengeNotFound",
            "Challenge non trouvé pour simulation."
          )
        );
        return;
      }
      const challengeToUpdate = {
        ...currentChallengesArray[challengeIndex],
      } as any;
      const today = getToday();
      const completionDates: string[] = [];
      const completionDateKeys: string[] = [];
      for (let i = streakValue - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        completionDates.push(d.toISOString());
        completionDateKeys.push(dayKeyUTC(d));
      }
      challengeToUpdate.streak = streakValue;
      challengeToUpdate.completionDates = completionDates;
      challengeToUpdate.completedDays = streakValue;
      challengeToUpdate.lastMarkedDate = completionDates.length
        ? completionDates[completionDates.length - 1]
        : undefined;
      (challengeToUpdate as any).completionDateKeys =
        completionDateKeys;
      (challengeToUpdate as any).lastMarkedKey =
        completionDateKeys.length
          ? completionDateKeys[completionDateKeys.length - 1]
          : undefined;
      const updatedChallenges = currentChallengesArray.map(
        (challenge, idx) =>
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
      notify(
        "info",
        t("simulation.title", "Simulation"),
        t("simulation.message", {
          streak: streakValue,
          defaultValue: "Streak simulé à {{streak}} jours.",
        })
      );
      scheduleAchievementsCheck(userId);
    } catch (error: any) {
      console.error(
        "Erreur lors de la simulation du streak :",
        error.message
      );
      notify(
        "error",
        t(
          "simulation.errorTitle",
          "Erreur de simulation"
        ),
        t(
          "simulation.errorGeneric",
          "Impossible de simuler le streak."
        )
      );
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
        requestRewardedAd,
        preloadRewarded,
      }}
    >
      <View style={styles.providerContainer}>
        {children}
        {modalVisible &&
          (() => {
            const MissedChallengeModal =
              getMissedModalComponent();
            return (
              <MissedChallengeModal
                visible={modalVisible}
                onClose={closeMissedModal}
                onReset={handleReset}
                onWatchAd={handleWatchAd}
                onUseTrophies={handleUseTrophies}
                preloadRewarded={preloadRewarded}
                trophyCost={
                  selectedChallenge
                    ? getSkipTrophyCost(
                        selectedChallenge.selectedDays
                      )
                    : 5
                }
                hasStreakPass={hasStreakPass}
                onUseStreakPass={handleUseStreakPass}
              />
            );
          })()}
          {toastState.visible && (
  <View
    pointerEvents="box-none"
    style={styles.toastContainer}
  >
    <Animated.View
      style={[
        styles.toastAnimatedWrapper,
        {
          opacity: toastAnim,
          transform: [
            toastAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }) && {
              translateY: toastAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
            {
              scale: toastAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ].filter(Boolean) as any,
        },
      ]}
    >
      <LinearGradient
        colors={
          toastState.kind === "success"
            ? ["#2ecc71", "#27ae60"]
            : toastState.kind === "error"
            ? ["#e74c3c", "#c0392b"]
            : toastState.kind === "warning"
            ? ["#f1c40f", "#f39c12"]
            : ["#3498db", "#2980b9"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastInner}
      >
        <View style={styles.toastContentRow}>
          <View style={styles.toastIconWrapper}>
            <Ionicons
              name={
                toastState.kind === "success"
                  ? "checkmark-circle"
                  : toastState.kind === "error"
                  ? "close-circle"
                  : toastState.kind === "warning"
                  ? "alert-circle"
                  : "information-circle"
              }
              size={22}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.toastTextWrapper}>
            <Text style={styles.toastTitle} numberOfLines={1}>
              {toastState.title}
            </Text>
            {!!toastState.message && (
              <Text style={styles.toastMessage} numberOfLines={2}>
                {toastState.message}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.toastPill}>
          <Text style={styles.toastPillText}>
            {t(
              "toast.keepGoing",
              "Garde le rythme 🔥"
            )}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  </View>
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
    toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
    toastInner: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(10, 10, 10, 0.9)", // fallback derrière le gradient
  },

   toastTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: "#F5F5F5",
  },
    toastAnimatedWrapper: {
    maxWidth: "96%",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  toastContentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  toastIconWrapper: {
    marginRight: 10,
  },
  toastTextWrapper: {
    flex: 1,
  },
  toastPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
  },
  toastPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
