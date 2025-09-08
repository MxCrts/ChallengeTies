import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  doc,
  onSnapshot,
  runTransaction,
  getDoc,
  updateDoc,
  increment,
  getDocs,
  query,
  collection,
  where,
} from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from "expo-linear-gradient";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import ChallengeCompletionModal from "../../components/ChallengeCompletionModal";
import DurationSelectionModal from "../../components/DurationSelectionModal";
import StatsModal from "../../components/StatsModal";
import { FadeInUp, FadeIn } from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import InvitationModal from "../../components/InvitationModal";
import ChallengeReviews from "../../components/ChallengeReviews";
import { storage } from "../../constants/firebase-config";
import { getDownloadURL, ref } from "firebase/storage";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { CARD_HEIGHT, CARD_WIDTH } from "@/components/ShareCard";
import * as Notifications from "expo-notifications";
import { Share } from "react-native";
import type { ViewStyle } from "react-native";
import { adUnitIds } from "@/constants/admob";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
  runOnJS,              // 👈 AJOUT
} from "react-native-reanimated";
import { sendDuoNudge } from "@/services/notificationService";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import * as Linking from "expo-linking";
import SendInvitationModal from "@/components/SendInvitationModal";
import * as Localization from "expo-localization";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;
const BANNER_HEIGHT = 50;
const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

/** Fond orbe premium, non interactif */
const OrbBackground = ({ theme }: { theme: Theme }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Orbe haut-gauche */}
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_WIDTH * 0.95,
          borderRadius: (SCREEN_WIDTH * 0.95) / 2,
          top: -SCREEN_WIDTH * 0.45,
          left: -SCREEN_WIDTH * 0.28,
        },
      ]}
    />

    {/* Orbe bas-droite */}
    <LinearGradient
      colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.1,
          height: SCREEN_WIDTH * 1.1,
          borderRadius: (SCREEN_WIDTH * 1.1) / 2,
          bottom: -SCREEN_WIDTH * 0.55,
          right: -SCREEN_WIDTH * 0.35,
        },
      ]}
    />

    {/* Voile très léger pour fondre les orbes */}
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);


const dayIcons: Record<
  number,
  | "sunny-outline"
  | "flash-outline"
  | "timer-outline"
  | "calendar-outline"
  | "speedometer-outline"
  | "trending-up-outline"
  | "barbell-outline"
  | "rocket-outline"
> = {
  7: "sunny-outline",
  14: "flash-outline",
  21: "timer-outline",
  30: "calendar-outline",
  60: "speedometer-outline",
  90: "trending-up-outline",
  180: "barbell-outline",
  365: "rocket-outline",
};

interface Stat {
  name: string;
  value: number | string;
  icon: string;
}

interface DuoUser {
  id: string;
  name: string;
  avatar: string;
  completedDays: number;
  selectedDays: number;
}

interface DuoChallengeData {
  duo: boolean;
  duoUser: DuoUser;
}
export default function ChallengeDetails() {
  const { theme } = useTheme();
  const [marking, setMarking] = useState(false);
  const [sendingNudge, setSendingNudge] = useState(false);
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
 const bottomInset = showBanners ? BANNER_HEIGHT + SPACING * 2 : SPACING * 2;
const npa = (globalThis as any).__NPA__ === true;

  const router = useRouter();
    const pct = (num = 0, den = 0) => (den > 0 ? Math.min(100, Math.max(0, Math.round((num / den) * 100))) : 0);

  // pulse subtil autour de l'avatar du leader
  const leaderPulse = useSharedValue(0);

useEffect(() => {
  leaderPulse.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 1400, easing: Easing.in(Easing.quad) })
    ),
    -1, // -1 = repeat infini
    true // reverse = true pour alterner
  );
}, []);

  
  const params = useLocalSearchParams<{
    id?: string;
    invite?: string;      // id du document d’invitation
  days?: string;
    title?: string;
    category?: string;
    description?: string;
    selectedDays?: string;
    completedDays?: string;
  }>();
  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const id = params.id || "";

  const { savedChallenges, addChallenge, removeChallenge } =
    useSavedChallenges();
  const {
    currentChallenges,
    takeChallenge,
    removeChallenge: removeCurrentChallenge,
    markToday,
    isMarkedToday,
    completeChallenge,
  } = useCurrentChallenges();

const currentChallenge = useMemo(() => {
  return currentChallenges.find((ch) => ch.id === id || ch.challengeId === id);
}, [currentChallenges, id]);


  const [duoChallengeData, setDuoChallengeData] =
    useState<DuoChallengeData | null>(null);

  const bannerAdUnitId = __DEV__ ? TestIds.BANNER : adUnitIds.banner;


  const [loading, setLoading] = useState(true);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([
    7, 14, 21, 30, 60, 90, 180, 365,
  ]);
  const challengeTaken =
  !!currentChallenge ||
  currentChallenges.some((ch) => ch.challengeId === id || ch.id === id);

  const [routeTitle, setRouteTitle] = useState(
    params.title || t("challengeDetails.untitled")
  );
  const [isCurrentUserInviter, setIsCurrentUserInviter] = useState(false);

  const [routeCategory, setRouteCategory] = useState(
    params.category || t("challengeDetails.uncategorized")
  );
  const [routeDescription, setRouteDescription] = useState(
    params.description || t("challengeDetails.noDescription")
  );

  const [myAvatar, setMyAvatar] = useState<string>("");
  const [myName, setMyName] = useState<string>("");
const [partnerAvatar, setPartnerAvatar] = useState<string>("");
const assetsReady =
  !!myAvatar &&
  !!myName &&
  !!(partnerAvatar || duoChallengeData?.duoUser?.avatar) &&
  !!(duoChallengeData?.duoUser?.name || "");

  const [localSelectedDays, setLocalSelectedDays] = useState<number>(10);
  const [finalSelectedDays, setFinalSelectedDays] = useState<number>(0);
  const [finalCompletedDays, setFinalCompletedDays] = useState<number>(0);
  const [userCount, setUserCount] = useState(0);
  const [stats, setStats] = useState<Stat[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteConfirmVisible, setInviteConfirmVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<boolean | null>(null);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [challenge, setChallenge] = useState<any>(null);
const [introVisible, setIntroVisible] = useState(false);
const fadeOpacity = useSharedValue(1); // pour fade-out
const shakeMy = useSharedValue(0);
const shakePartner = useSharedValue(0);
const hasShownIntro = useRef(false);

const IS_SMALL = SCREEN_WIDTH < 360;
const AVA = IS_SMALL ? normalizeSize(96) : normalizeSize(120);
const GAP = IS_SMALL ? 16 : 24;
const TITLE = IS_SMALL ? normalizeSize(34) : normalizeSize(42);


const isDuo = !!currentChallenge?.duo;


const canInviteFriend = !isDuo; // interne : on autorise l'ouverture du modal si pas en duo

  // ⚙️ Pré-sélection depuis le deep link ?days=XX (si valide)
useEffect(() => {
  const raw = params.days ? String(params.days) : "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  // si le challenge a déjà chargé ses options, on respecte la liste
  if (Array.isArray(daysOptions) && daysOptions.length > 0) {
    if (daysOptions.includes(n)) {
      setLocalSelectedDays(n);
    } else {
      // si la valeur n'est pas dans la liste, on garde la plus proche
      const closest = [...daysOptions].sort(
        (a, b) => Math.abs(a - n) - Math.abs(b - n)
      )[0];
      if (closest) setLocalSelectedDays(closest);
    }
  } else {
    setLocalSelectedDays(n);
  }
}, [params.days, daysOptions]);


const resetSoloProgressIfNeeded = useCallback(async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) return;

    const userRef = doc(db, "users", uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const list = Array.isArray(data?.CurrentChallenges) ? data.CurrentChallenges : [];

      let changed = false;
      const updated = list.map((c: any) => {
        const cid = c?.challengeId ?? c?.id;
        // On ne touche qu’à l’entrée SOLO du challenge courant si progression > 0
        if (cid === id && !c?.duo && (c?.completedDays || 0) > 0) {
          changed = true;
          return {
            ...c,
            completedDays: 0,
            completionDates: [], // reset propre
          };
        }
        return c;
      });

      if (changed) {
        tx.update(userRef, { CurrentChallenges: updated });
      }
    });
  } catch (e) {
    console.error("❌ resetSoloProgressIfNeeded failed:", e);
  }
}, [id]);

const lang = useMemo(
  () => String(i18n?.language || "fr").split("-")[0].toLowerCase(),
  [i18n?.language]
);

const fadeStyle = useAnimatedStyle<ViewStyle>(() => ({
  opacity: fadeOpacity.value,
}));

const shakeStyleMy = useAnimatedStyle<ViewStyle>(() => ({
  transform: [
    { translateX: shakeMy.value * 6 },
    { scale: 1.18 },
  ] as ViewStyle["transform"],
}));

const shakeStylePartner = useAnimatedStyle<ViewStyle>(() => ({
  transform: [
    { translateX: shakePartner.value * 6 },
    { scale: 1.18 },
  ] as ViewStyle["transform"],
}));


const pulseStyle = useAnimatedStyle<ViewStyle>(() => ({
  transform: [
    { scale: interpolate(leaderPulse.value, [0, 1], [1, 1.08]) },
  ] as ViewStyle["transform"],
  opacity: interpolate(leaderPulse.value, [0, 1], [0.12, 0.28]),
}));

useEffect(() => {
  if (!currentChallenge?.duo) return;
  if (hasShownIntro.current) return;      // ✅ ne pas ré-afficher si déjà vu

  hasShownIntro.current = true;
  setIntroVisible(true);
  fadeOpacity.value = 1;

  // Sécurité : on éteint l’overlay au cas où
  const killer = setTimeout(() => {
    fadeOpacity.value = withTiming(0, { duration: 500 }, () => {
      runOnJS(setIntroVisible)(false);
    });
  }, 6000);

  return () => clearTimeout(killer);
}, [currentChallenge?.duo]);

const startVsIntro = useCallback(() => {
  // 3 shakes chacun
  shakeMy.value = withSequence(
    withRepeat(
      withSequence(
        withTiming(-1, { duration: 80 }),
        withTiming( 1, { duration: 80 }),
        withTiming( 0, { duration: 80 })
      ),
      3, // ✅ 3 cycles
      true
    ),
    withTiming(0, { duration: 60 })
  );

  shakePartner.value = withSequence(
    withRepeat(
      withSequence(
        withTiming( 1, { duration: 80 }),
        withTiming(-1, { duration: 80 }),
        withTiming( 0, { duration: 80 })
      ),
      3, // ✅ 3 cycles
      true
    ),
    withTiming(0, { duration: 60 }, () => {
      // ✅ fermeture douce de l’overlay à la fin du partner
      fadeOpacity.value = withTiming(0, { duration: 500 }, () => {
        runOnJS(setIntroVisible)(false);
      });
    })
  );
}, []);


useEffect(() => {
  if (!introVisible) return;

  const ua = myAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(myName || "You")}`;
  const pa =
    partnerAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(duoChallengeData?.duoUser?.name || "P")}`;

  Image.prefetch(ua);
  Image.prefetch(pa);
}, [introVisible, myAvatar, partnerAvatar, myName, duoChallengeData?.duoUser?.name]);

useEffect(() => {
  if (!introVisible) return;
  if (!assetsReady) return;

  startVsIntro();
}, [introVisible, assetsReady, startVsIntro]);


// Résout une URL d'avatar quelle que soit la forme : http(s) (Firebase ou non), gs://, ou path Storage
const resolveAvatarUrl = async (raw?: string): Promise<string> => {
  if (!raw) return "";
  const url = raw.trim();

  // Déjà http(s)
  if (url.startsWith("http")) {
    try {
      const u = new URL(url);
      const isFirebase =
        u.hostname.includes("firebasestorage.googleapis.com") &&
        u.pathname.includes("/o/");
      if (!isFirebase) {
        // Pas une URL Firebase Storage signée -> garder telle quelle
        return url;
      }
      // Regénérer un lien frais (token) depuis le path encodé après /o/
      const idx = u.pathname.indexOf("/o/");
      if (idx === -1) return url;
      const encodedPath = u.pathname.substring(idx + 3);
      const objectPath = decodeURIComponent(encodedPath.replace(/^\//, ""));
      const r = ref(storage, objectPath);
      return await getDownloadURL(r);
    } catch {
      return url;
    }
  }

  // gs://... ou chemin Storage
  try {
    const r = ref(storage, url);
    return await getDownloadURL(r);
  } catch {
    return "";
  }
};
useEffect(() => {
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;

  // déduplication (évite d'ouvrir plusieurs fois le même doc)
  const opened = new Set<string>();

  // on gardera ici un éventuel unsub du fallback
  let fallbackUnsub: (() => void) | undefined;

  const qPending = query(
    collection(db, "invitations"),
    where("inviteeId", "==", uid),
    where("status", "==", "pending")
  );

  const unsubMain = onSnapshot(
    qPending,
    (snap) => {
      snap.docChanges().forEach((chg) => {
        const docId = chg.doc.id;
        const data = chg.doc.data() as any;
        if (data.challengeId === id && !opened.has(docId)) {
          opened.add(docId);
          setInvitation({ id: docId });
          setInvitationModalVisible(true);
        }
      });
    },
    async (err) => {
      console.warn(
        "⚠️ Snapshot (inviteeId+status) a échoué, fallback sans index:",
        err?.message || err
      );
      // Fallback: écoute "inviteeId" uniquement puis filtre en JS
      const qByInvitee = query(
        collection(db, "invitations"),
        where("inviteeId", "==", uid)
      );
      fallbackUnsub = onSnapshot(qByInvitee, (snap2) => {
        snap2.docChanges().forEach((chg) => {
          const docId = chg.doc.id;
          const data = chg.doc.data() as any;
          if (
            data.status === "pending" &&
            data.challengeId === id &&
            !opened.has(docId)
          ) {
            opened.add(docId);
            setInvitation({ id: docId });
            setInvitationModalVisible(true);
          }
        });
      });
    }
  );

  // Vérif immédiate (au cas où)
  (async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "invitations"), where("inviteeId", "==", uid))
      );
      snap.forEach((d) => {
        const data = d.data() as any;
        if (
          data.status === "pending" &&
          data.challengeId === id &&
          !opened.has(d.id)
        ) {
          opened.add(d.id);
          setInvitation({ id: d.id });
          setInvitationModalVisible(true);
        }
      });
    } catch (e) {
      console.error("❌ Vérif immédiate invitations échouée:", e);
    }
  })();

  return () => {
    unsubMain();
    fallbackUnsub?.();
  };
}, [id]);


useEffect(() => {
  if (!id) return;

  const challengeRef = doc(db, "challenges", id);
  const unsubscribe = onSnapshot(
    challengeRef,
    async (docSnap) => {
      if (!docSnap.exists()) {
        console.warn("⚠️ Défi non trouvé pour ID :", id);
        setLoading(false);
        return;
      }

      const data = docSnap.data();
      setChallenge({ id: docSnap.id, ...data });
      setChallengeImage(data.imageUrl || null);
      setDaysOptions(data.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365]);
      setUserCount(data.participantsCount || 0);

      // UI infos
      setRouteTitle(
        t(`challenges.${data.chatId}.title`, { defaultValue: data.title })
      );
      const rawCat = data.category || "";
      setRouteCategory(
        t(`categories.${rawCat}`, { defaultValue: rawCat })
      );
      setRouteDescription(
        t(`challenges.${data.chatId}.description`, {
          defaultValue: data.description,
        })
      );

      // 🔁 Récupération des données duo si challenge actif et en duo
      if (currentChallenge?.duo && currentChallenge.duoPartnerId) {
        try {
          const partnerRef = doc(db, "users", currentChallenge.duoPartnerId);
          const partnerSnap = await getDoc(partnerRef);

          if (partnerSnap.exists()) {
            const partnerData = partnerSnap.data();
            const partnerChallenge = (partnerData.CurrentChallenges || []).find(
              (ch: any) =>
                ch.challengeId === id &&
                ch.selectedDays === currentChallenge.selectedDays
            );

            if (partnerChallenge) {
  // Sécurisation des infos (nom + avatar)
  const partnerName =
    partnerData.username ||
    partnerData.displayName ||
    (typeof partnerData.email === "string"
      ? partnerData.email.split("@")[0]
      : "") ||
    t("duo.partner"); // fallback lisible

  const rawAvatar =
    partnerData.profileImage ||
    partnerData.avatar ||
    partnerData.avatarUrl ||
    partnerData.photoURL ||
    partnerData.photoUrl ||
    partnerData.imageUrl ||
    "";

  let resolvedPartnerAvatar = "";
  try {
    resolvedPartnerAvatar = (await resolveAvatarUrl(rawAvatar)) || rawAvatar;
  } catch {
    resolvedPartnerAvatar = "";
  }

  if (!resolvedPartnerAvatar) {
    resolvedPartnerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      partnerName || "P"
    )}`;
  }

  setPartnerAvatar(resolvedPartnerAvatar);

  setDuoChallengeData({
    duo: true,
    duoUser: {
      id: currentChallenge.duoPartnerId,
      name: partnerName,
      avatar: resolvedPartnerAvatar, // ✅ plus d'image de test
      completedDays: partnerChallenge.completedDays || 0,
      selectedDays: partnerChallenge.selectedDays || 0,
    },
  });
}

          }
        } catch (err) {
          console.error("❌ Erreur récupération partenaire duo :", err);
        }
      }

      setLoading(false);
    },
    (error) => {
      console.error("❌ Erreur récupération défi :", error);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [id, t, currentChallenge]);

  useEffect(() => {
    if (!id || !auth.currentUser?.uid) return;

    const challengeRef = doc(db, "challenges", id);
    getDoc(challengeRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isInviter = data?.inviterId === auth.currentUser?.uid;
        setIsCurrentUserInviter(isInviter);
      }
    });
  }, [id]);

  useEffect(() => {
  if (currentChallenge) {
    setFinalSelectedDays(currentChallenge.selectedDays || 0);
    setFinalCompletedDays(currentChallenge.completedDays || 0);
  }
}, [currentChallenge]);


  useEffect(() => {
  if (!currentChallenge) return;

    const totalSaved = savedChallenges.length;
    const uniqueOngoing = new Map(
      currentChallenges.map((ch: any) => [`${ch.id}_${ch.selectedDays}`, ch])
    );
    const totalOngoing = uniqueOngoing.size;
    const totalCompleted = currentChallenges.filter(
      (challenge) => challenge.completedDays === challenge.selectedDays
    ).length;
    const successRate =
      totalOngoing + totalCompleted > 0
        ? Math.round((totalCompleted / (totalOngoing + totalCompleted)) * 100)
        : 0;
    const longestStreak = 0;
    const trophies = 0;
    const achievementsUnlocked = 0;

    const newStats: Stat[] = [
      { name: "Challenges Saved", value: totalSaved, icon: "bookmark-outline" },
      {
        name: "Ongoing Challenges",
        value: totalOngoing,
        icon: "hourglass-outline",
      },
      {
        name: "Challenges Completed",
        value: totalCompleted,
        icon: "trophy-outline",
      },
      {
        name: "Success Rate",
        value: `${successRate}%`,
        icon: "stats-chart-outline",
      },
      { name: "Trophies", value: trophies, icon: "medal-outline" },
      {
        name: "Achievements Unlocked",
        value: achievementsUnlocked,
        icon: "ribbon-outline",
      },
      {
        name: "Longest Streak",
        value: `${longestStreak} days`,
        icon: "flame-outline",
      },
    ];
    setStats(newStats);
  }, [savedChallenges, currentChallenges, currentChallenge]);

// Avatar du user courant
// Avatar + Nom du user courant
useEffect(() => {
  const run = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const snap = await getDoc(doc(db, "users", uid));
      let raw = "";
      let display = "";

      if (snap.exists()) {
        const u = snap.data() as any;
        raw =
          u?.profileImage ||
          u?.avatar ||
          u?.avatarUrl ||
          u?.photoURL ||
          u?.photoUrl ||
          u?.imageUrl ||
          "";
        display =
          u?.username ||
          u?.displayName ||
          (typeof u?.email === "string" ? u.email.split("@")[0] : "") ||
          auth.currentUser?.displayName ||
          (auth.currentUser?.email ? auth.currentUser.email.split("@")[0] : "") ||
          "You";
      } else {
        raw = auth.currentUser?.photoURL || "";
        display =
          auth.currentUser?.displayName ||
          (auth.currentUser?.email ? auth.currentUser.email.split("@")[0] : "") ||
          "You";
      }

      const resolved = (await resolveAvatarUrl(raw)) || raw;
      setMyAvatar(
        resolved ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(display || "You")}`
      );
      setMyName(display); // 👈 NEW
    } catch {
      setMyAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent("You")}`);
      setMyName("You"); // 👈 NEW
    }
  };
  run();
}, []);

useEffect(() => {
  if (!auth.currentUser?.uid || !id) return;

  const q = query(
    collection(db, "invitations"),
    where("inviterId", "==", auth.currentUser.uid),
    where("challengeId", "==", id)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== "modified") return;
      const data = change.doc.data();

      if (data.status === "refused") {
        Notifications.scheduleNotificationAsync({
          content: {
            title: t("notificationsPush.title"),
            body: t("notificationsPush.invitationRefused", {
              username: data.inviteeUsername || t("duo.partner"),
            }),
          },
          trigger: null,
        });
      }

      if (data.status === "accepted") {
  Notifications.scheduleNotificationAsync({
    content: {
      title: t("notificationsPush.title"),
      body: t("notificationsPush.invitationAccepted", {
        username: data.inviteeUsername || "L'utilisateur",
      }),
    },
    trigger: null,
  });

  // ✅ Reset de la progression SOLO de l’inviteur UNIQUEMENT maintenant
  // (si elle existait et > 0 ; idempotent et sûr)
  resetSoloProgressIfNeeded();
}

    });
  });

  return () => unsubscribe();
}, [id, t, resetSoloProgressIfNeeded]);


// Ouvre le modal si ?invite=... est présent (via route OU via deep link brut)
useEffect(() => {
  const openFromParams = (inviteParam?: string) => {
    if (!inviteParam) return;
    if (auth.currentUser) {
      setInvitation({ id: String(inviteParam) });
      // petit délai pour laisser l'écran se charger
      setTimeout(() => setInvitationModalVisible(true), 200);
    } else {
      // si non connecté → on redirige vers login en préservant l'invite
      router.replace(`/login?redirect=challenge-details/${params.id}&invite=${inviteParam}`);
    }
  };

  // 1) Si expo-router nous a déjà passé ?invite
  if (params?.invite) {
    openFromParams(String(params.invite));
  }

  // 2) Fallback: lire l’URL initiale (si l’app a été ouverte par un lien)
  Linking.getInitialURL().then((url) => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      const invite = String(parsed?.queryParams?.invite || "");
      if (invite) openFromParams(invite);
    } catch {}
  });

  // 3) Fallback live: si un lien arrive pendant que l’app est ouverte
  const sub = Linking.addEventListener("url", ({ url }) => {
    try {
      const parsed = Linking.parse(url);
      const invite = String(parsed?.queryParams?.invite || "");
      if (invite) openFromParams(invite);
    } catch {}
  });

  return () => {
    // API SDK48/49: sub.remove(); SDK50+: sub.remove() aussi
    (sub as any)?.remove?.();
  };
}, [params?.id, params?.invite, router]);



  const isSavedChallenge = (challengeId: string) =>
    savedChallenges.some((ch) => ch.id === challengeId);


  // 👇 TOP-LEVEL, pas dans une fonction
const completions = useMemo(
  () => currentChallenge?.completionDates || [],
  [currentChallenge?.completionDates]
);

const getCalendarDays = (): (null | { day: number; date: Date; completed: boolean })[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const numDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const calendar: (null | { day: number; date: Date; completed: boolean })[] = [];
  for (let i = 0; i < firstDayIndex; i++) calendar.push(null);

  for (let day = 1; day <= numDays; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = dateObj.toDateString();
    const completed = completions.includes(dateStr);
    calendar.push({ day, date: dateObj, completed });
  }
  return calendar;
};


  const calendarDays = getCalendarDays();

  const goToPrevMonth = () => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );
    setCurrentMonth(newMonth);
  };

  const monthName = currentMonth.toLocaleString(i18n.language, {
    month: "long",
  });
  const currentYearNum = currentMonth.getFullYear();

  const alreadyMarkedToday = currentChallenge
    ? currentChallenge.completionDates?.includes(new Date().toDateString())
    : false;

  const showCompleteButton =
    challengeTaken &&
    finalSelectedDays > 0 &&
    finalCompletedDays >= finalSelectedDays;
  const progressPercent =
    finalSelectedDays > 0
      ? Math.min(1, finalCompletedDays / finalSelectedDays)
      : 0;

  const handleTakeChallenge = useCallback(async () => {
  if (challengeTaken || !id) return;

  // ✅ Fermer IMMÉDIATEMENT le modal pour éviter le "rebond"
  setModalVisible(false);

  try {
    setLoading(true);

    const challengeRef = doc(db, "challenges", id);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) {
      Alert.alert(t("alerts.error"), t("challengeDetails.fetchError"));
      return;
    }
    const challengeData = challengeSnap.data();

    await takeChallenge(
      {
        id,
        title: challengeData.title || "Untitled Challenge",
        category: challengeData.category || "Uncategorized",
        description: challengeData.description || "No description available",
        daysOptions:
          challengeData.daysOptions || [7, 14, 21, 30, 60, 90, 180, 365],
        chatId: challengeData.chatId || id,
        imageUrl: challengeData.imageUrl || "",
      },
      localSelectedDays
    );

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(challengeRef);
      if (!docSnap.exists()) throw new Error("Challenge inexistant");
      const data = docSnap.data();
      const uid = auth.currentUser?.uid;
      const count = data.participantsCount || 0;
      const users: string[] = data.usersTakingChallenge || [];
      const updatedUsers = users.includes(uid!) ? users : users.concat([uid!]);
      transaction.update(challengeRef, {
        participantsCount: count + 1,
        usersTakingChallenge: updatedUsers,
      });
    });

    // ✅ Mettre à jour les infos locales
    setFinalSelectedDays(localSelectedDays);
    setFinalCompletedDays(0);
  } catch (err) {
    Alert.alert(
      t("alerts.error"),
      err instanceof Error ? err.message : t("challengeDetails.joinError")
    );
  } finally {
    setLoading(false);
  }
}, [id, challengeTaken, localSelectedDays, takeChallenge, t]);


  const handleSaveChallenge = useCallback(async () => {
    if (!id) return;
    setPendingFavorite(!isSavedChallenge(id));
    try {
      const challengeRef = doc(db, "challenges", id);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) {
        Alert.alert(t("alerts.error"), t("challengeDetails.fetchError"));
        setPendingFavorite(null);
        return;
      }
      const challengeData = challengeSnap.data();
      const challengeObj = {
        id,
        title: challengeData.title || "Untitled Challenge",
        category: challengeData.category || "Uncategorized",
        description: challengeData.description || "No description available",
        daysOptions: challengeData.daysOptions || [
          7, 14, 21, 30, 60, 90, 180, 365,
        ],
        chatId: challengeData.chatId || id,
        imageUrl: challengeData.imageUrl || "",
      };
      if (isSavedChallenge(id)) {
        await removeChallenge(id);
      } else {
        await addChallenge(challengeObj);
      }
      setPendingFavorite(null);
    } catch (err) {
      Alert.alert(
        t("alerts.error"),
        err instanceof Error ? err.message : t("challengeDetails.saveError")
      );
      setPendingFavorite(null);
    }
  }, [id, savedChallenges, addChallenge, removeChallenge]);

const handleNudgePartner = useCallback(async () => {
  if (!duoChallengeData?.duo || !currentChallenge?.duoPartnerId) {
    Alert.alert(
      t("alerts.error"),
      t("duo.nudgeUnavailable", { defaultValue: "Fonction réservée aux défis en duo." })
    );
    return;
  }
  if (sendingNudge) return;

  try {
    setSendingNudge(true);
    const ok = await sendDuoNudge({
      toUserId: currentChallenge.duoPartnerId,
      challengeTitle: routeTitle || t("challengeDetails.untitled"),
    });

    if (ok) {
      Alert.alert(
        t("duo.nudge", { defaultValue: "Encourager" }),
        t("duo.nudgeSent", { defaultValue: "Encouragement envoyé ✅" })
      );
    } else {
      Alert.alert(
        t("alerts.error"),
        t("duo.nudgeFailed", { defaultValue: "Impossible d'envoyer la notification." })
      );
    }
  } catch (e) {
    Alert.alert(
      t("alerts.error"),
      t("duo.nudgeFailed", { defaultValue: "Impossible d'envoyer la notification." })
    );
  } finally {
    setSendingNudge(false);
  }
}, [
  duoChallengeData?.duo,
  currentChallenge?.duoPartnerId,
  routeTitle,
  t,
  sendingNudge,
]);

  const handleShowCompleteModal = useCallback(() => {
    setCompletionModalVisible(true);
  }, [finalSelectedDays]);

  const handleClaimTrophiesWithoutAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, false);
      
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge]);

  const handleClaimTrophiesWithAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, true);
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge]);

  const handleNavigateToChat = useCallback(() => {
    if (!challengeTaken ) {
      Alert.alert(
        t("alerts.accessDenied"),
        t("challengeDetails.chatAccessDenied")
      );
      return;
    }
    router.push(
      `/challenge-chat/${id}?title=${encodeURIComponent(routeTitle)}`
    );
  }, [id, challengeTaken , routeTitle, router]);

  // Langue sûre pour le partage (Jamais de split sur undefined)
const getShareLang = (i18nLang?: string) => {
  // 1) i18n si dispo
  if (typeof i18nLang === "string" && i18nLang.length > 0) {
    const l = i18nLang.split(/[-_]/)[0]?.toLowerCase();
    if (l) return l;
  }
  // 2) Expo Localization (SDK récents)
  try {
    const locs = (Localization as any)?.getLocales?.();
    if (Array.isArray(locs) && locs[0]?.languageTag) {
      const l = String(locs[0].languageTag).split(/[-_]/)[0]?.toLowerCase();
      if (l) return l;
    }
  } catch {}
  // 3) Expo Localization (SDK anciens)
  try {
    const tag = (Localization as any)?.locale;
    if (typeof tag === "string" && tag.length > 0) {
      const l = tag.split(/[-_]/)[0]?.toLowerCase();
      if (l) return l;
    }
  } catch {}
  // 4) Web fallback éventuel
  const navLang = (globalThis as any)?.navigator?.language;
  if (typeof navLang === "string" && navLang.length > 0) {
    const l = navLang.split(/[-_]/)[0]?.toLowerCase();
    if (l) return l;
  }
  // 5) Défaut
  return "en";
};

const handleShareChallenge = useCallback(async () => {
  try {
    const shareLang = getShareLang(i18n?.language as string | undefined);
    // ⚠️ Utiliser la Cloud Function (pas le domaine web.app)
    const base = "https://europe-west1-challengeme-d7fef.cloudfunctions.net/dl";

    const params = new URLSearchParams({
      id,
      title: routeTitle,
      shareLang,
      v: String(Date.now()),
    });

    const appLink = `${base}?${params.toString()}`;
    const message = `${t("challengeDetails.shareMessage", { title: routeTitle })}\n${appLink}`;

    const result = await Share.share(
      { title: t("challengeDetails.share"), message },
      { dialogTitle: t("challengeDetails.share") }
    );

    if (result.action === Share.sharedAction) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { shareChallenge: increment(1) });
        await checkForAchievements(userId);
      }
    }
  } catch (error: any) {
    console.error("❌ handleShareChallenge error:", error);
    Alert.alert(t("alerts.shareError"), error?.message || String(error));
  }
}, [id, routeTitle, t, lang]);


const handleInviteFriend = useCallback(() => {
  try {
    if (!id) return;

    // 1) Si déjà en duo → interdit
    if (isDuo) {
      Alert.alert(t("alerts.error"), t("invitationS.errors.duoAlready"));
      return;
    }

    // 2) Sinon (solo ou challenge pas encore pris) → ouvrir le modal interne
    setInviteConfirmVisible(true);
  } catch (err) {
    console.error("❌ handleInviteFriend error:", err);
    Alert.alert(t("alerts.error"), t("invitationS.errors.unknown"));
  }
}, [id, isDuo, t]);


  const handleViewStats = useCallback(() => {
    if (!challengeTaken ) return;
    setStatsModalVisible(true);
  }, [challengeTaken ]);

  const handleMarkTodayPress = useCallback(async () => {
  if (marking) return;
  if (isMarkedToday(id, finalSelectedDays)) return;

  try {
    setMarking(true);
    // ⚠️ on laisse le contexte faire ses vérifications (rupture, modal, etc.)
    const res = await markToday(id, finalSelectedDays);

  } catch (e) {
    console.error("markToday failed", e);
    Alert.alert(t("alerts.error"), t("challengeDetails.markError") || "Erreur");
  } finally {
    setMarking(false);
  }
}, [marking, id, finalSelectedDays, isMarkedToday, markToday, t]);

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={[styles.container, { paddingBottom: bottomInset }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <OrbBackground theme={currentTheme} />
     <SafeAreaView
  style={{ flex: 1, backgroundColor: 'transparent' }}
  edges={['top','bottom']}
>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={false}
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <Animated.View entering={FadeInUp} style={styles.backButtonContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, styles.backButtonOverlay]}
          accessibilityLabel={t("backButton")}
          accessibilityHint={t("backButtonHint")}
          accessibilityRole="button"
          testID="back-button"
        >
          <Ionicons
            name="arrow-back"
            size={normalizeSize(24)}
            color={isDarkMode ? "#FFD700" : currentTheme.colors.secondary}
          />
        </TouchableOpacity>
      </Animated.View>
      <View style={styles.imageContainer}>
            {challengeImage ? (
  <>
    <Image
      source={{ uri: challengeImage }}
      style={styles.image}
      resizeMode="cover"
    />
    {/* 🔥 Overlay premium */}
    <LinearGradient
      colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.6)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.heroOverlay}
    />
  </>
) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  { backgroundColor: currentTheme.colors.overlay },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={normalizeSize(80)}
                  color={currentTheme.colors.textPrimary}
                />
                <Text
                  style={[
                    styles.noImageText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  Image non disponible
                </Text>
              </View>
            )}
          </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset }}

      >
        <View style={styles.carouselContainer}>
          
        </View>
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.infoRecipeContainer}
        >
          <Text
            style={[
              styles.infoRecipeName,
              {
                color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
              }, // Couleur dynamique
            ]}
          >
            {routeTitle}
          </Text>
          <Text
            style={[styles.category, { color: currentTheme.colors.secondary }]}
          >
            {routeCategory.toUpperCase()}
          </Text>
          {/* Chips context */}
<View style={styles.chipRow}>
  {/* Jours sélectionnés (si challenge pris) */}
  {finalSelectedDays > 0 && (
    <View style={styles.chip}>
      <Ionicons name="calendar-outline" size={14} color="#fff" />
      <Text style={styles.chipText}>{finalSelectedDays} {t("challengeDetails.days")}</Text>
    </View>
  )}

  {/* Duo actif ? */}
  {duoChallengeData?.duo && (
    <View style={styles.chip}>
      <Ionicons name="people-outline" size={14} color="#fff" />
      <Text style={styles.chipText}>{t("duo.title")}</Text>
    </View>
  )}

  {/* Participants */}
  <View style={styles.chip}>
    <Ionicons name="person-outline" size={14} color="#fff" />
    <Text style={styles.chipText}>
      {userCount} {t(`challengeDetails.participant${userCount > 1 ? "s" : ""}`)}
    </Text>
  </View>
</View>
          {!challengeTaken  && (
            <TouchableOpacity
              style={styles.takeChallengeButton}
              onPress={() => setModalVisible(true)}
              accessibilityLabel="Prendre le défi"
              testID="take-challenge-button"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.takeChallengeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  style={[
                    styles.takeChallengeButtonText,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >

                  {t("challengeDetails.takeChallenge")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {challengeTaken &&
  !(finalSelectedDays > 0 && finalCompletedDays >= finalSelectedDays) && (
  <Animated.View entering={FadeInUp.delay(200)}>
    <Text
      style={[
        styles.inProgressText,
        { color: currentTheme.colors.secondary },
      ]}
    >
      {t("challengeDetails.inProgress")}
    </Text>

    {/* === SOLO MODE (pas de duo) === */}
    {!duoChallengeData?.duo && (
      <View style={{ marginTop: SPACING }}>
        {/* Header: avatar + label */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {!!myAvatar && (
            <Image
              source={{ uri: myAvatar }}
              style={{ width: normalizeSize(36), height: normalizeSize(36), borderRadius: normalizeSize(18), borderWidth: 2, borderColor: "#FFD700" }}
            />
          )}
          <Text
  style={[
    styles.inProgressText,
    { color: currentTheme.colors.secondary, marginLeft: 8 }, // 👈 ajouté
  ]}
>
  {t("duo.you")}
</Text>
        </View>

        {/* Barre perso */}
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: currentTheme.colors.border },
          ]}
        >
          <LinearGradient
            colors={
              isDarkMode
                ? ["#FFD700", "#FFD700"]
                : [currentTheme.colors.primary, currentTheme.colors.secondary]
            }
            style={[
              styles.progressBarFill,
              { width: `${progressPercent * 100}%` },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        {/* Mini stats */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
          <Text style={[styles.progressText, { color: currentTheme.colors.secondary }]}>
            {finalCompletedDays}/{finalSelectedDays} {t("challengeDetails.daysCompleted")}
          </Text>
          <Text
  style={[
    styles.progressText,
    { color: currentTheme.colors.textSecondary, marginLeft: 10 }, // 👈 ajouté
  ]}
>
  · {Math.round(progressPercent * 100)}%
</Text>
        </View>
      </View>
    )}

    {/* === DUO MODE === */}
    {duoChallengeData?.duo && duoChallengeData.duoUser && (
      <View
        style={[
          styles.duoCard,
          !isDarkMode && { backgroundColor: "rgba(0,0,0,0.05)", borderColor: "rgba(0,0,0,0.08)" },
        ]}
      >
        {/* Header */}
        <View style={styles.duoHeader}>
          <Ionicons
  name="people-circle-outline"
  size={normalizeSize(22)}
  color={currentTheme.colors.secondary}
  style={{ marginRight: 8 }} // 👈 ajouté
/>
          <Text style={[styles.duoTitle, { color: currentTheme.colors.secondary }]}>
            {t("duo.title")}
          </Text>
        </View>

        {/* Versus row */}
        {(() => {
          const me = {
            id: auth.currentUser?.uid || "me",
            name: t("duo.you"),
            avatar: myAvatar || (auth.currentUser as any)?.photoURL || "https://ui-avatars.com/api/?name=You",
            completedDays: finalCompletedDays || 0,
            selectedDays: finalSelectedDays || 0,
          };
          const partner = duoChallengeData.duoUser;
          const myPct = pct(me.completedDays, me.selectedDays);
          const hisPct = pct(partner.completedDays, partner.selectedDays);
          const iLead = myPct > hisPct;
          const tied = myPct === hisPct;


          return (
            <>
              {/* Lead banner */}
{(() => {
  // Styles dynamiques par état + thème
  const bannerBase = [styles.duoLeadBanner];
  let bannerBg = {};
  let textStyle = {};
  let iconColor = currentTheme.colors.textSecondary;

  if (tied) {
    bannerBg = isDarkMode
      ? { backgroundColor: "rgba(255,255,255,0.08)" }
      : { backgroundColor: "rgba(0,0,0,0.06)" };
    textStyle = { color: currentTheme.colors.textSecondary };
  } else if (iLead) {
    bannerBg = isDarkMode
      ? { backgroundColor: "rgba(255,215,0,0.18)" } // gold pill dark
      : { backgroundColor: "#FFF4CC" };             // gold pill light
    textStyle = isDarkMode ? { color: "#FFD700" } : { color: "#8A6A00" };
    iconColor = isDarkMode ? "#FFD700" : "#8A6A00";
  } else {
    bannerBg = isDarkMode
      ? { backgroundColor: "rgba(255,122,122,0.18)" } // red pill dark
      : { backgroundColor: "#FFE5E5" };               // red pill light
    textStyle = isDarkMode ? { color: "#FF9999" } : { color: "#B30000" };
    iconColor = isDarkMode ? "#FF9999" : "#B30000";
  }

  return (
    <View style={[...bannerBase, bannerBg]}>
      {tied ? (
        <>
          <Ionicons name="remove-outline" size={16} color={iconColor} style={{ marginRight: 6 }} />
          <Text style={[styles.duoLeadText, textStyle]}>{t("duo.tied")}</Text>
        </>
      ) : iLead ? (
        <>
          <Ionicons name="trophy-outline" size={16} color={iconColor} style={{ marginRight: 6 }} />
          <Text style={[styles.duoLeadText, textStyle]}>{t("duo.leading")}</Text>
        </>
      ) : (
        <>
          <Ionicons name="trending-down-outline" size={16} color={iconColor} style={{ marginRight: 6 }} />
          <Text style={[styles.duoLeadText, textStyle]}>{t("duo.behind")}</Text>
        </>
      )}
    </View>
  );
})()}


              <View style={styles.duoRow}>
                {/* Me */}
                <View style={styles.duoSide}>
                 <View style={styles.avatarWrap}>
  <Image source={{ uri: me.avatar }} style={styles.duoAvatarBig} />
  {(iLead && !tied) && (
    <View
      style={[
        styles.crownWrap,
        isDarkMode
          ? { backgroundColor: "rgba(255,215,0,0.18)", borderWidth: 1, borderColor: "rgba(255,215,0,0.6)" }
          : { backgroundColor: "#FFF4CC", borderWidth: 1, borderColor: "#FFE08A" }
      ]}
    >
      <Text style={styles.crownEmoji}>👑</Text>
    </View>
  )}
  {(iLead || tied) && (
    <Animated.View
  pointerEvents="none"
  style={[
    styles.pulseCircle,
    pulseStyle,
    { borderColor: currentTheme.colors.secondary },
  ]}
/>

  )}
</View>

                  <Text style={[styles.duoName, { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" }]} numberOfLines={1}>
                    {me.name}
                  </Text>

                  <View style={[styles.miniBarBg, { backgroundColor: currentTheme.colors.border }]}>
                    <LinearGradient
                      colors={
                        isDarkMode
                          ? ["#FFD700", "#FFD700"]
                          : [currentTheme.colors.primary, currentTheme.colors.secondary]
                      }
                      style={[styles.miniBarFill, { width: `${myPct}%` }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  </View>
                  <Text style={[styles.duoPct, { color: currentTheme.colors.textSecondary }]}>
                    {me.completedDays}/{me.selectedDays} · {myPct}%
                  </Text>
                </View>

                {/* VS */}
                <View style={styles.vsWrap}>
                  <LinearGradient
                    colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.vsBadge}
                  >
                    <Text style={styles.vsText}>VS</Text>
                  </LinearGradient>
                </View>

                {/* Partner */}
                <View style={styles.duoSide}>
                  <View style={styles.avatarWrap}>
  <Image
    source={{ uri: partnerAvatar || partner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name || "P")}` }}
    style={styles.duoAvatarBig}
  />
  {(!iLead && !tied) && (
    <View
      style={[
        styles.crownWrap,
        isDarkMode
          ? { backgroundColor: "rgba(0,209,255,0.18)", borderWidth: 1, borderColor: "rgba(0,209,255,0.55)" }
          : { backgroundColor: "#DFF7FF", borderWidth: 1, borderColor: "#B9ECFF" }
      ]}
    >
      <Text style={styles.crownEmoji}>👑</Text>
    </View>
  )}
  {(!iLead && !tied) && (
    <Animated.View
  pointerEvents="none"
  style={[
    styles.pulseCircle,
    pulseStyle,
    { borderColor: currentTheme.colors.secondary },
  ]}
/>

  )}
</View>

                  <Text style={[styles.duoName, { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" }]} numberOfLines={1}>
                    {partner.name}
                  </Text>

                  <View style={[styles.miniBarBg, { backgroundColor: currentTheme.colors.border }]}>
                    <LinearGradient
                      colors={isDarkMode ? ["#00FFFF", "#00FFFF"] : [currentTheme.colors.secondary, currentTheme.colors.primary]}
                      style={[styles.miniBarFill, { width: `${hisPct}%` }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  </View>
                  <Text style={[styles.duoPct, { color: currentTheme.colors.textSecondary }]}>
                    {partner.completedDays}/{partner.selectedDays} · {hisPct}%
                  </Text>
                </View>
              </View>

              {/* CTA Duo */}
              <View style={styles.duoCtas}>
  <TouchableOpacity
    onPress={handleNudgePartner}
    onLongPress={handleNavigateToChat}
    activeOpacity={0.9}
    disabled={sendingNudge}
    accessibilityLabel={t("duo.nudge")}
    accessibilityHint={t("duo.nudgeHint", {
      defaultValue: "Appuie pour encourager. Appui long pour ouvrir le chat.",
    })}
  >
    <LinearGradient
      colors={
        sendingNudge
          ? ["#6b7280", "#6b7280"] // gris pendant l'envoi
          : [currentTheme.colors.secondary, currentTheme.colors.primary]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.duoBtn}
    >
      <Ionicons name="megaphone-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.duoBtnText}>
        {sendingNudge
          ? t("commonS.sending", { defaultValue: "Envoi..." })
          : t("duo.nudge")}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
</View>

            </>
          );
        })()}
      </View>
    )}

    {/* Bouton marquer aujourd'hui (commun) */}
    <TouchableOpacity
      style={styles.markTodayButton}
      accessibilityRole="button"
      onPress={handleMarkTodayPress}
 disabled={marking || isMarkedToday(id, finalSelectedDays)}
      accessibilityLabel={
        isMarkedToday(id, finalSelectedDays)
          ? t("challengeDetails.alreadyMarked")
          : t("challengeDetails.markToday")
      }
      testID="mark-today-button"
    >
      {isMarkedToday(id, finalSelectedDays) ? (
        <View
          style={[
            styles.markTodayButtonGradient,
            { backgroundColor: "#808080" },
          ]}
        >
          <Text
            style={[
              styles.markTodayButtonText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("challengeDetails.alreadyMarked")}
          </Text>
        </View>
      ) : (
        <LinearGradient
  colors={
    marking
      ? ["#6b7280", "#6b7280"]            // gris pendant l’envoi
      : [currentTheme.colors.primary, currentTheme.colors.secondary]
  }
  style={styles.markTodayButtonGradient}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
          <Text
            style={[
              styles.markTodayButtonText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
             {marking ? t("commonS.sending", { defaultValue: "Envoi..." }) : t("challengeDetails.markToday")}
          </Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  </Animated.View>
)}


            <Animated.View entering={FadeIn} style={{ marginTop: 20, alignItems: "center" }}>
                  <Pressable
                    onPress={() => {
  if (challenge?.chatId) {
    router.push(`/challenge-helper/${challenge.chatId}`);
  } else {
    console.warn("❌ Aucun chatId disponible pour ce challenge");
    Alert.alert(t("alerts.error"), t("alerts.noHelperAvailable"));
  }
}}
                    android_ripple={{ color: "#fff", borderless: false }}
                    accessibilityLabel="HelpButton"
                    accessibilityHint="Navigate to challenge help content"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.8 : 1,
                      borderRadius: 24,
                      overflow: "hidden",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 5,
                      width: "90%",
                      maxWidth: 380,
                    })}
                  >
                    <LinearGradient
                      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderRadius: 24,
                      }}
                    >
                      <Ionicons name="bulb-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                        {t("challengeDetails.needHelp")}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
          <Text
            style={[
              styles.infoDescriptionRecipe,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {routeDescription}
          </Text>
          {challengeTaken  &&
            finalSelectedDays > 0 &&
            finalCompletedDays >= finalSelectedDays && (
              <TouchableOpacity
                style={styles.completeChallengeButton}
                onPress={handleShowCompleteModal}
                accessibilityRole="button"
                accessibilityLabel="Terminer le défi"
                testID="complete-challenge-button"
              >
                <LinearGradient
                  colors={[
                    currentTheme.colors.primary,
                    currentTheme.colors.secondary,
                  ]}
                  style={styles.completeChallengeButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={[
                      styles.completeChallengeButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("challengeDetails.completeChallenge")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            
          <Animated.View
            entering={FadeInUp.delay(300)}
            style={styles.actionIconsContainer}
          >
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleNavigateToChat}
              accessibilityRole="button"
              accessibilityLabel={t("challengeDetails.chatA11y")}
              testID="chat-button"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={normalizeSize(22)} // Taille réduite pour compacité
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
       
              >
                {t("challengeDetails.chat")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleSaveChallenge}
              accessibilityRole="button"
              accessibilityLabel={
                isSavedChallenge(id)
                  ? t("challengeDetails.removeSavedA11y")
                  : t("challengeDetails.saveA11y")
              }
              testID="save-button"
            >
              <Ionicons
                name={
                  pendingFavorite !== null
                    ? pendingFavorite
                      ? "bookmark"
                      : "bookmark-outline"
                    : isSavedChallenge(id)
                    ? "bookmark"
                    : "bookmark-outline"
                }
                size={normalizeSize(22)} // Taille réduite
                color={
                  pendingFavorite !== null
                    ? pendingFavorite
                      ? currentTheme.colors.secondary
                      : currentTheme.colors.textSecondary
                    : isSavedChallenge(id)
                    ? currentTheme.colors.secondary
                    : currentTheme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
        
              >
                {pendingFavorite !== null
                  ? pendingFavorite
                    ? t("challengeDetails.saved")
                    : t("challengeDetails.save")
                  : isSavedChallenge(id)
                  ? t("challengeDetails.saved")
                  : t("challengeDetails.save")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
  style={[styles.actionIcon, { opacity: canInviteFriend ? 1 : 0.4 }]}
  onPress={canInviteFriend ? handleInviteFriend : undefined}
  accessibilityRole="button"
  accessibilityLabel={t("inviteAFriend")}
  testID="invite-button"
  disabled={!canInviteFriend}
>
  <Ionicons
    name="person-add-outline"
    size={normalizeSize(22)}
    color={currentTheme.colors.textSecondary}
  />
  <Text
    style={[
      styles.actionIconLabel,
      { color: currentTheme.colors.textSecondary },
    ]}
  >
    {t("inviteAFriend")}
  </Text>
</TouchableOpacity>



            <TouchableOpacity
              style={styles.actionIcon}
              onPress={handleShareChallenge}
              accessibilityRole="button"
              accessibilityLabel={t("challengeDetails.shareA11y")}
              testID="share-button"
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(22)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
 
              >
                {t("challengeDetails.share")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionIcon, { opacity: challengeTaken  ? 1 : 0.5 }]}
              onPress={challengeTaken  ? handleViewStats : undefined}
              accessibilityLabel={t("challengeDetails.statsA11y")}
              accessibilityRole="button"
              testID="stats-button"
              disabled={!challengeTaken }
            >
              <Ionicons
                name="stats-chart-outline"
                size={normalizeSize(22)}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionIconLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}

              >
                {t("challengeDetails.stats")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
        <ChallengeReviews
  challengeId={id}
  selectedDays={finalSelectedDays}
/>
      </ScrollView>

      <DurationSelectionModal
        visible={modalVisible}
        daysOptions={daysOptions}
        selectedDays={localSelectedDays}
        onSelectDays={setLocalSelectedDays}
        onConfirm={handleTakeChallenge}
        onCancel={() => setModalVisible(false)}
        dayIcons={dayIcons}
      />

      {completionModalVisible && (
        <ChallengeCompletionModal
          visible={completionModalVisible}
          challengeId={id}
          selectedDays={finalSelectedDays}
          onClose={() => setCompletionModalVisible(false)}
        />
      )}

      <StatsModal
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        monthName={monthName}
        currentYearNum={currentYearNum}
        calendarDays={calendarDays}
        goToPrevMonth={goToPrevMonth}
        goToNextMonth={goToNextMonth}
      />
      {showBanners && (
  <View style={styles.bannerContainer}>
    <BannerAd
  unitId={bannerAdUnitId}
  size={BannerAdSize.BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: npa }}
  onAdFailedToLoad={(err) =>
    console.error("Échec chargement bannière", err)
  }
/>

  </View>
)}

      <InvitationModal
        visible={invitationModalVisible}
        inviteId={invitation?.id || null}
        challengeId={id}
        onClose={() => setInvitationModalVisible(false)}
        clearInvitation={() => setInvitation(null)} // 👈 ICI
      />
      {loading && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
    <Text style={[styles.loadingText, { color: currentTheme.colors.textSecondary }]}>
      {t("challengeDetails.loading")}
    </Text>
  </View>
)}
{/* ⚠️ Confirmation : passer en Duo réinitialise ta progression solo */}
<SendInvitationModal
  visible={inviteConfirmVisible}
  onClose={() => setInviteConfirmVisible(false)}
  challengeId={id}
  selectedDays={localSelectedDays}
  challengeTitle={routeTitle}
/>

{introVisible && (
  <Animated.View style={[styles.vsOverlay, fadeStyle]} pointerEvents="auto">
    {!assetsReady ? (
      <ActivityIndicator size="large" color="#FFD700" />
    ) : (
     <View style={[styles.vsRow, { paddingHorizontal: GAP }]}>
  {/* Moi */}
  <Animated.View entering={FadeInUp.duration(300)} style={[shakeStyleMy, styles.vsSide, { marginHorizontal: GAP }]}>
    <Image source={{ uri: myAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(myName || "You")}`, }} style={[styles.vsAvatarXL, { width: AVA, height: AVA, borderRadius: AVA/2 }]} />
    <Text style={[styles.vsNameXL, { fontSize: IS_SMALL ? normalizeSize(16) : normalizeSize(18) }]}>
      {myName || t("duo.you")}
    </Text>
  </Animated.View>

  {/* VS */}
  <Animated.View entering={FadeInUp.delay(200).duration(600)} style={[styles.vsCenter, { marginHorizontal: GAP }]}>
    <Text style={[styles.vsTextBig, { fontSize: TITLE }]}>VS</Text>
  </Animated.View>

  {/* Partenaire */}
  <Animated.View entering={FadeInUp.duration(300)} style={[shakeStylePartner, styles.vsSide, { marginHorizontal: GAP }]}>
    <Image source={{ uri: partnerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  duoChallengeData?.duoUser?.name || "P"
                )}`, }} style={[styles.vsAvatarXL, { width: AVA, height: AVA, borderRadius: AVA/2 }]} />
    <Text style={[styles.vsNameXL, { fontSize: IS_SMALL ? normalizeSize(16) : normalizeSize(18) }]}>
      {duoChallengeData?.duoUser?.name || t("duo.partner")}
    </Text>
  </Animated.View>
</View>

    )}
  </Animated.View>
)}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  carouselContainer: {
    position: "relative",
    height: SCREEN_HEIGHT * 0.3,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.35,
    borderBottomLeftRadius: normalizeSize(30),
    borderBottomRightRadius: normalizeSize(30),
    overflow: 'hidden',
    zIndex: 1,
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH,
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1, // Assure que la bannière reste au-dessus mais ne coupe pas
  },
  image: {
    width: "100%",
    height: "100%",
  },
  hiddenShareCanvas: {
  position: "absolute",
  left: -9999,   // ❗ rendu offscreen mais présent dans l’arbre
  top: -9999,
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
},
  loadingOverlay: {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.35)",
  zIndex: 999,
},
loadingText: {
  marginTop: 12,
  fontSize: normalizeSize(16),
  fontFamily: "Comfortaa_400Regular",
},

  backButtonContainer: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 20, // Augmente le zIndex pour être au-dessus de l'image et du gradient
  },
  orb: {
  position: "absolute",
  opacity: 0.9,     // tu peux baisser si tu veux encore plus subtil
},

  crownWrap: {
  position: "absolute",
  right: -6,
  top: -6,
  width: normalizeSize(22),
  height: normalizeSize(22),
  borderRadius: normalizeSize(11),
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 3,
  elevation: 3,
},

  backButton: {
    padding: SPACING / 2,
  },
  backButtonOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay semi-transparent
    borderRadius: normalizeSize(20),
    padding: SPACING / 2,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chipRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: 6,
},
vsOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.92)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
},
vsRow: {
  flexDirection: "row",
  alignItems: "center",
},
// ⚠️ Ceci est le "vsSide" NOUVEAU — différent de l’ancien supprimé
vsSide: {
  alignItems: "center",
  marginHorizontal: 24,
},
vsAvatarXL: {
  width: normalizeSize(120),
  height: normalizeSize(120),
  borderRadius: normalizeSize(60),
  borderWidth: 3,
  borderColor: "#FFD700",
  shadowColor: "#FFD700",
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
},
vsNameXL: {
  color: "#fff",
  marginTop: 10,
  fontSize: normalizeSize(18),
  fontFamily: "Comfortaa_700Bold",
  textAlign: "center",
},
// Nouveau "vsCenter" (juste un espace horizontal, pas en absolute)
vsCenter: {
  marginHorizontal: 24,
},
// Nouveau "vsTextBig" (jaune)
vsTextBig: {
  fontSize: normalizeSize(42),
  fontFamily: "Comfortaa_700Bold",
  color: "#FFD700",
  letterSpacing: 2,
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
},
chip: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.25)",
  margin: 4, // remplace le gap du parent
},
chipText: {
  color: "#fff",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  marginLeft: 6, // remplace le gap interne
},
    duoCard: {
    marginTop: SPACING * 1.2,
    borderRadius: normalizeSize(20),
    padding: SPACING,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  duoHeader: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: SPACING,
},
  duoTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
  },
  duoLeadBanner: {
  alignSelf: "center",
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.08)",
  marginBottom: SPACING,
},

  duoLeadText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 0.3,
  },
  duoRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

  duoSide: {
    flex: 1,
    alignItems: "center",
  },
  heroOverlay: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  top: 0,
},
  avatarWrap: {
    width: normalizeSize(68),
    height: normalizeSize(68),
    borderRadius: normalizeSize(34),
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    marginBottom: 6,
  },
  duoAvatarBig: {
    width: normalizeSize(62),
    height: normalizeSize(62),
    borderRadius: normalizeSize(31),
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  pulseCircle: {
    position: "absolute",
    width: normalizeSize(68),
    height: normalizeSize(68),
    borderRadius: normalizeSize(34),
    borderWidth: 2,
  },
  duoName: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
    maxWidth: normalizeSize(120),
    textAlign: "center",
  },
  miniBarBg: {
    width: "85%",
    height: normalizeSize(8),
    borderRadius: normalizeSize(4),
    overflow: "hidden",
    marginTop: 8,
  },
  crownEmoji: {
  fontSize: normalizeSize(12),
  transform: [{ translateY: Platform.OS === "android" ? -1 : 0 }],
},

  miniBarFill: {
    height: "100%",
    borderRadius: normalizeSize(4),
  },
  duoPct: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
    marginTop: 6,
  },
  vsWrap: {
    width: normalizeSize(56),
    alignItems: "center",
  },
  vsBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  vsText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 1.5,
  },
  duoCtas: {
    marginTop: SPACING,
    alignItems: "center",
  },
  duoBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  duoBtnText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
  },

  noImageText: {
    marginTop: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  infoRecipeContainer: {
    flex: 1,
    paddingHorizontal: SPACING * 1.5,
    paddingTop: SCREEN_HEIGHT * 0.05 ,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRecipeName: {
    fontSize: normalizeSize(28),
    marginTop: SPACING * 0.2,
    marginBottom: SPACING,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  category: {
    fontSize: normalizeSize(14),
    marginVertical: SPACING / 2,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: SPACING / 2,
  },
  infoRecipe: {
    fontSize: normalizeSize(14),
    marginLeft: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  actionIconsRowCentered: {
  flexDirection: "row",
  justifyContent: "center",
  marginTop: 12,
},

  takeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  takeChallengeButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
  },
  takeChallengeButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  inProgressText: {
    fontSize: normalizeSize(16),
    marginTop: SPACING,
    fontFamily: "Comfortaa_700Bold",
  },
  markTodayButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  markTodayButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: normalizeSize(25), // Ajoute pour cohérence
  },
  markTodayButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  progressText: {
    fontSize: normalizeSize(14),
    marginBottom: SPACING,
    textAlign: "center",
    marginTop: SPACING / 2,
    fontFamily: "Comfortaa_400Regular",
  },
  progressBarBackground: {
    width: normalizeSize(250),
    height: normalizeSize(10),
    borderRadius: normalizeSize(5),
    overflow: "hidden",
    alignSelf: "center", // Déjà présent
    marginTop: SPACING,
  },
  progressBarFill: {
    height: "100%",
  },
  completeChallengeButton: {
    borderRadius: normalizeSize(25),
    overflow: "hidden",
    marginTop: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  completeChallengeButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
  },
  completeChallengeButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  infoDescriptionRecipe: {
    textAlign: "center",
    fontSize: normalizeSize(16),
    marginTop: SPACING * 2,
    marginHorizontal: SPACING,
    lineHeight: normalizeSize(22),
    fontFamily: "Comfortaa_400Regular",
  },
  actionIconsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between", 
    alignItems: "center",
    marginTop: SPACING * 2,
    minWidth: "100%",
    paddingHorizontal: SPACING / 2
  },
   actionIcon: {
     alignItems: "center",
     justifyContent: "center",
    marginHorizontal: 0,
    width: '50%',
     minHeight: normalizeSize(90),
   },
  actionIconLabel: {
    marginTop: normalizeSize(6),
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    includeFontPadding: false,     // compacte le text verticalement
    lineHeight: normalizeSize(18),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
 
  duoProgressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING,
  },
  duoAvatar: {
    width: normalizeSize(36),
    height: normalizeSize(36),
    borderRadius: normalizeSize(18),
    borderWidth: 2,
    borderColor: "#FFD700",
  },
});

