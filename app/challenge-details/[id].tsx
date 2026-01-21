import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  startTransition,
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
  useWindowDimensions,
  Dimensions,
  StatusBar,
  InteractionManager,
  Platform,
  AccessibilityInfo,
  Modal,
  Share,
  BackHandler,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import mobileAds, {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { db, auth } from "@/constants/firebase-config";
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from "expo-linear-gradient";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { checkForAchievements } from "../../helpers/trophiesHelpers";
import ChallengeCompletionModal from "../../components/ChallengeCompletionModal";
import DurationSelectionModal from "../../components/DurationSelectionModal";
import StatsModal from "../../components/StatsModal";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import InvitationModal from "../../components/InvitationModal";
import ChallengeReviews from "../../components/ChallengeReviews";
import { storage } from "../../constants/firebase-config";
import { getDownloadURL, ref } from "firebase/storage";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import type { ViewStyle } from "react-native";
import PioneerBadge from "@/components/PioneerBadge";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
   useAnimatedStyle,
  withRepeat,
   withSequence,
   withTiming,
   interpolate,
   Easing,
   runOnJS,
   withSpring,
   FadeOut,
  FadeInUp,
  FadeIn,
 } from "react-native-reanimated";
 import { BlurView } from "expo-blur";
import * as Linking from "expo-linking";
import SendInvitationModal from "@/components/SendInvitationModal";
import * as Localization from "expo-localization";
import type { ModalProps } from "react-native";
import * as Haptics from "expo-haptics";
import { bumpCounterAndMaybeReview } from "../../src/services/reviewService"
import { recordSelectDays, recordDailyGlobalMark, incStat } from "../../src/services/metricsService";
import NetInfo from "@react-native-community/netinfo";
import { canInvite } from "../../utils/canInvite";
import { usePathname } from "expo-router";
import { useAuth } from "@/context/AuthProvider"; 
import ShareCardModal from "@/components/ShareCardModal";


const short = (s: string, max = 16) => (s.length > max ? s.slice(0, max - 1).trim() + "…" : s);

function useTabBarHeightSafe(): number {
  try {
    return useBottomTabBarHeight();
  } catch (_e) {
    return 0;
  }
}


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_SMALL = SCREEN_WIDTH < 360;
const SPACING = 15;
const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};
const HERO_H = Math.max(240, Math.round(SCREEN_HEIGHT * 0.35));

const pct = (num = 0, den = 0) =>
  den > 0 ? Math.min(100, Math.max(0, Math.round((num / den) * 100))) : 0;

const isIOS = Platform.OS === "ios";

const hapticTap = () => {
  Haptics.selectionAsync().catch(() => {});
};



const introModalProps: Partial<ModalProps> = Platform.select<Partial<ModalProps>>({
  ios: {
    presentationStyle: "overFullScreen",
    transparent: true,
    statusBarTranslucent: true,
    animationType: "fade",
  } as const,
  android: {
    transparent: true,
    statusBarTranslucent: true,
    animationType: "fade",
    hardwareAccelerated: true,
  } as const,
  default: {
    animationType: "fade",
  } as const,
})!;

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

 interface DuoUser {
   id: string;
   name: string;
   avatar: string;
   completedDays: number;
   selectedDays: number;
   isPioneer?: boolean;
 }

 interface DuoChallengeData {
   duo: boolean;
   duoUser: DuoUser;
 }

 type RawChallengeEntry = {
   challengeId?: string;
   id?: string;
   uniqueKey?: string;
   duo?: boolean;
   duoPartnerId?: string | null;
   duoPartnerUsername?: string | null;
   selectedDays?: number;
 };

export function deriveDuoInfoFromUniqueKey(
  entry: RawChallengeEntry,
  currentUserId: string | undefined | null
) {
  // 🛑 Si le doc indique explicitement SOLO → on respecte ça
  const explicitSolo =
    entry &&
    entry.duo === false &&
    !entry.duoPartnerId &&
    !entry.duoPartnerUsername;

  if (explicitSolo) {
    return {
      isDuo: false,
      duoPartnerId: null,
      duoPartnerUsername: null,
    };
  }

  if (!entry || !currentUserId) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const rawKey = entry.uniqueKey;
  if (!rawKey || typeof rawKey !== "string") {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const parts = rawKey.split("_");
  if (parts.length < 3) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const pairSegment = parts[parts.length - 1]; // "uidA-uidB"
  if (!pairSegment.includes("-")) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const [uidA, uidB] = pairSegment.split("-");
  if (!uidA || !uidB) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  let partnerId: string | null = null;
  if (uidA === currentUserId) partnerId = uidB;
  else if (uidB === currentUserId) partnerId = uidA;
  else partnerId = null;

  const isDuo = partnerId !== null;

  return {
    isDuo,
    duoPartnerId: partnerId,
    duoPartnerUsername: entry?.duoPartnerUsername ?? null,
  };
}


export default function ChallengeDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width: W, height: H } = useWindowDimensions();
  const isTablet = W >= 700;
  const heroH = useMemo(
    () => Math.max(240, Math.round(H * 0.35)),
    [H]
  );
  // 4 colonnes = cheap. Tablet = 3 colonnes, phone = 2 colonnes.
  const actionIconWidth = isTablet ? "33.333%" : "50%";
  const titleLines = isTablet ? 2 : 3;
  const descLines = isTablet ? 4 : 6;
  const [marking, setMarking] = useState(false);
  const [outgoingPendingInvite, setOutgoingPendingInvite] = useState<{
  id: string;
  inviteeUsername?: string | null;
} | null>(null);
  const [duoState, setDuoState] = useState<{
  enabled: boolean;
  partnerId?: string;
  selectedDays?: number;
  uniqueKey?: string | null;   // 👈 ajoute null
} | null>(null);
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
  const justJoinedRef = useRef(false);
  // 🧹 Anti-doublon solo+duo : évite boucle de nettoyage
  const cleanupSoloRef = useRef(false);
const IS_COMPACT = W < 380; // ✅ basé sur la largeur actuelle (split-screen/tablette)
const [confirmResetVisible, setConfirmResetVisible] = useState(false);
const [sendInviteVisible, setSendInviteVisible] = useState(false);
const insets = useSafeAreaInsets();
const [adHeight, setAdHeight] = useState(0);
  // 🆕 callback stable pour éviter un re-render en boucle quand BannerSlot mesure
  const onBannerHeight = useCallback((h: number) => {
    setAdHeight((prev) => (prev === h ? prev : h));
  }, []);


  // 🆕 état réseau : interdit l’invitation hors-ligne (UX claire)
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      const off = s.isConnected === false || s.isInternetReachable === false;
      setIsOffline(!!off);
    });
    return () => sub();
  }, []);


  const router = useRouter();

    // ✅ Safe back pour deeplink (si pas de stack -> home)
  const handleSafeBack = useCallback(() => {
    // expo-router peut exposer canGoBack selon version
    // @ts-ignore
    if (router.canGoBack?.()) {
      router.back();
      return true;
    }
    router.replace("/");
    return true;
  }, [router]);

  // ✅ Hardware back Android
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        handleSafeBack
      );
      return () => sub.remove();
    }, [handleSafeBack])
  );

  // pulse subtil autour de l'avatar du leader
  const leaderPulse = useSharedValue(0);
  const duoPendingPulse = useSharedValue(0);
const startedRef = useRef(false);
const myImgReady = useRef(false);
const partnerImgReady = useRef(false);
const tabBarHeight = useTabBarHeightSafe();
const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const duoPendingPulseStyle = useAnimatedStyle(() => {
  // Ring très visible + léger "glow"
  const s = 1 + duoPendingPulse.value * 0.28;
  const o = 0.28 + duoPendingPulse.value * 0.62;
  return {
    transform: [{ scale: s }],
    opacity: o,
  };
});

const duoPendingDotStyle = useAnimatedStyle(() => {
  // Dot qui "respire" + mini pop (Keynote)
  const s = 1 + duoPendingPulse.value * 0.38;
  const o = 0.10 + duoPendingPulse.value * 0.28;
  return {
    transform: [{ scale: s }],
    opacity: o,
  };
});

const duoPendingGlowStyle = useAnimatedStyle(() => {
  // Halo externe (super visible mais clean)
  const s = 1 + duoPendingPulse.value * 0.26;
  const o = 0.08 + duoPendingPulse.value * 0.22;
  return { transform: [{ scale: s }], opacity: o };
});

  const firstMountRef = useRef(true);
useEffect(() => {
  firstMountRef.current = false;
}, []);

// 🆕 Affiche les reviews après les animations/gestes initiaux (perf perçue)
useEffect(() => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const task = InteractionManager.runAfterInteractions(() => {
    timeout = setTimeout(() => setShowReviews(true), 220);
  });

  return () => {
    if (timeout) clearTimeout(timeout);
    task?.cancel?.();
  };
}, []);

// 🆕 Démarrer/stopper l'animation quand l'écran est focus (perf batterie + évite jank en background)
useFocusEffect(
  useCallback(() => {
    leaderPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.in(Easing.quad) })
      ),
      -1,
      true
    );
    return () => { leaderPulse.value = 0; };
  }, [leaderPulse])
);
  
  const params = useLocalSearchParams<{
    id?: string;
    invite?: string;      // id du document d’invitation
  days?: string;
    title?: string;
    category?: string;
    openSendInvite?: string;
    description?: string;
    selectedDays?: string;
    completedDays?: string;
  }>();

  // 🆕 si on arrive avec ?invite=... → overlay actif dès le 1er render
const [deeplinkBooting, setDeeplinkBooting] = useState(
  () => !!params?.invite
);
  
  const [invitation, setInvitation] = useState<{ id: string } | null>(null);
 const [invitationModalVisible, setInvitationModalVisible] = useState(false);
 const [inviteLoading, setInviteLoading] = useState(false);
 
 const processedInviteIdsRef = useRef<Set<string>>(new Set());
 const inviteOpenGuardRef = useRef(false);
 const autoSendInviteOnceRef = useRef(false);
 const markInviteAsHandled = useCallback((inviteId?: string | null) => {
  if (!inviteId) return;

  // Marque l'ID comme traitée pour ne jamais ré-ouvrir le modal
  processedInviteIdsRef.current.add(inviteId);

  // Nettoie l'état local si c'est la même invite
  setInvitation((prev) => (prev?.id === inviteId ? null : prev));
}, []);

  
  const id = params.id || "";
const isReload = !!(params as any)?.reload;
const shouldEnterAnim =
  Platform.OS === "ios" && !isReload; // ➜ pas d'entering sur Android ni après reload

   const { savedChallenges, addChallenge, removeChallenge } = useSavedChallenges();
  // 🆕 lookup O(1) au lieu d'un some() à chaque render
  const savedIds = useMemo(() => new Set<string>(savedChallenges.map(ch => ch.id)), [savedChallenges]);
  const {
    currentChallenges,
    takeChallenge,
    removeChallenge: removeCurrentChallenge,
    markToday,
    isMarkedToday,
    completeChallenge,
  } = useCurrentChallenges();
  const lastIntroKeyRef = useRef<string | null>(null);

// ✅ Résout UNE seule entrée "courante" avec priorité DUO (si présente)
 const currentChallenge = useMemo(() => {
   const matches = currentChallenges.filter(
     (ch) => (ch.challengeId ?? ch.id) === id
   );
   if (matches.length === 0) return undefined;
   const duo = matches.find((m) => !!m.duo);
   return duo || matches[0];
 }, [currentChallenges, id]);

 // 🧠 Duo dérivé de façon déterministe à partir du uniqueKey + userId
 const derivedDuo = useMemo(
   () =>
     deriveDuoInfoFromUniqueKey(
       (currentChallenge || {}) as RawChallengeEntry,
       user?.uid
     ),
   [currentChallenge, user?.uid]
 );

  const [duoChallengeData, setDuoChallengeData] =
    useState<DuoChallengeData | null>(null);

  const [showReviews, setShowReviews] = useState(false);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([
    7, 14, 21, 30, 60, 90, 180, 365,
  ]);
  

  const [routeTitle, setRouteTitle] = useState(
    params.title || t("challengeDetails.untitled")
  );

  const [routeCategory, setRouteCategory] = useState(
    params.category || t("challengeDetails.uncategorized")
  );
  const [routeDescription, setRouteDescription] = useState(
    params.description || t("challengeDetails.noDescription")
  );
    const [loading, setLoading] = useState(true);

  
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [myName, setMyName] = useState<string>("");
  const [myIsPioneer, setMyIsPioneer] = useState(false);
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
  const [modalVisible, setModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<boolean | null>(null);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [challenge, setChallenge] = useState<any>(null);
const [introVisible, setIntroVisible] = useState(false);
// ✅ Un challenge a une page d'aide SEULEMENT s'il est approuvé + possède un chatId
const hasHelper = useMemo(
  () => !!(challenge && challenge.chatId && challenge.approved === true),
  [challenge]
);
const [introBlocking, setIntroBlocking] = useState(false); // blocks UI & hides StatusBar while true
const fadeOpacity = useSharedValue(1); // pour fade-out
const shakeMy = useSharedValue(0);
const shakePartner = useSharedValue(0);
const [shareCardVisible, setShareCardVisible] = useState(false);

 /* -------------------------------------------------------------------------- */
  /*                           CLAIM (stable refs)                               */
  /* -------------------------------------------------------------------------- */
  const claimWithoutAdRef = useRef<(() => Promise<void>) | null>(null);
  const claimWithAdRef = useRef<(() => Promise<void>) | null>(null);

  const handleClaimTrophiesWithoutAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, false);
      confettiRef.current?.start?.();
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge, t]);

  const handleClaimTrophiesWithAd = useCallback(async () => {
    try {
      await completeChallenge(id, finalSelectedDays, true);
      confettiRef.current?.start?.();
      setCompletionModalVisible(false);
    } catch (error) {
      Alert.alert(t("alerts.error"), t("challengeDetails.completeError"));
    }
  }, [id, finalSelectedDays, completeChallenge, t]);

  // ✅ expose des callbacks stables aux listeners (pas de deps instables dans l’effet rewarded)
  useEffect(() => {
    claimWithoutAdRef.current = handleClaimTrophiesWithoutAd;
    claimWithAdRef.current = handleClaimTrophiesWithAd;
  }, [handleClaimTrophiesWithoutAd, handleClaimTrophiesWithAd]);

/* -------------------------------------------------------------------------- */
  /*                               REWARDED (PARENT)                            */
  /* -------------------------------------------------------------------------- */
  const rewardedRef = useRef<RewardedAd | null>(null);
  const rewardedEarnedRef = useRef(false);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  const [rewardedLoading, setRewardedLoading] = useState(false);
  const [rewardedShowing, setRewardedShowing] = useState(false);

 // ✅ AdUnit stable + PROD ready (évite "TestIds en prod" + évite runtime crash si missing)
  // ⚠️ Branche EXACTEMENT comme ton index (même source). Ici: EXPO_PUBLIC_ADMOB_REWARDED_DETAILS
  const REWARDED_UNIT_ID = useMemo(() => {
    const prod =
      (process.env.EXPO_PUBLIC_ADMOB_REWARDED_DETAILS as string | undefined) ||
      (process.env.EXPO_PUBLIC_ADMOB_REWARDED as string | undefined) ||
      "";
    return __DEV__ ? TestIds.REWARDED : (prod || TestIds.REWARDED);
  }, []);

  const ensureRewardedInstance = useCallback(() => {
    if (rewardedRef.current) return rewardedRef.current;
    const ad = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    rewardedRef.current = ad;
    return ad;
  }, [REWARDED_UNIT_ID]);

 const loadRewarded = useCallback(() => {
    if (!showBanners) return;
    if (rewardedLoaded || rewardedLoading) return;
    const ad = ensureRewardedInstance();
    rewardedEarnedRef.current = false;
    setRewardedLoading(true);
    try { ad.load(); } catch { setRewardedLoading(false); }
  }, [ensureRewardedInstance, rewardedLoaded, rewardedLoading, showBanners]);

  // ✅ cleanup hard (évite instance/listerners fantômes sur nav back/forward)
  useEffect(() => {
    return () => {
      rewardedRef.current = null;
      rewardedEarnedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showBanners) {
      // ✅ reset clean si ads off
      setRewardedLoaded(false);
      setRewardedLoading(false);
      setRewardedShowing(false);
      rewardedEarnedRef.current = false;
      return;
    }

    const ad = ensureRewardedInstance();

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedLoaded(true);
      setRewardedLoading(false);
    });

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardedEarnedRef.current = true;
      }
    );

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);

      // ✅ on déclenche le claim UNIQUEMENT si reward a été gagné
      if (rewardedEarnedRef.current) {
        rewardedEarnedRef.current = false;
        // IMPORTANT : on fait le claim ici (comme l’exemple index)
        claimWithAdRef.current?.().catch(() => {});
      }

      // preload next
      requestAnimationFrame(() => { try { ad.load(); } catch {} });
    });

    const unsubErr = ad.addAdEventListener(AdEventType.ERROR, () => {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);
      rewardedEarnedRef.current = false;
      // retry soft
      setTimeout(() => {
        try {
          ad.load();
        } catch {}
      }, 900);
    });

    // preload initial
    try {
      ad.load();
    } catch {}

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubErr();
    };
  }, [ensureRewardedInstance, showBanners]);

  // quand le modal s'ouvre => on s'assure que c'est preload
  useEffect(() => {
    if (!completionModalVisible) return;
    loadRewarded();
  }, [completionModalVisible, loadRewarded]);

  const showRewarded = useCallback(async () => {
    if (!showBanners) {
      // Ads off -> fallback direct
     await claimWithAdRef.current?.();
      return;
    }

    const ad = ensureRewardedInstance();
    rewardedEarnedRef.current = false;

    // pas prêt ? on tente un load + message UX
    if (!rewardedLoaded) {
      loadRewarded();
      Alert.alert(
        t("commonS.loading", { defaultValue: "Chargement…" }),
        t("commonS.tryAgainInSeconds", {
          defaultValue: "La vidéo se prépare. Réessaie dans quelques secondes.",
        })
      );
      return;
    }

    try {
      setRewardedShowing(true);
      await ad.show();
    } catch (e) {
      setRewardedShowing(false);
      setRewardedLoaded(false);
      setRewardedLoading(false);
      rewardedEarnedRef.current = false;
      loadRewarded();
      Alert.alert(
        t("alerts.error"),
        t("adsS.rewardedFailed", { defaultValue: "La vidéo n’a pas pu se lancer." })
      );
    }
  }, [
    ensureRewardedInstance,
    rewardedLoaded,
    loadRewarded,
    showBanners,
    t,
  ]);

const popMy = useSharedValue(0);
const popPartner = useSharedValue(0);

const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  let sub: any;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => setReduceMotion(!!v))
    .catch(() => {});
  // écoute si l'utilisateur change l'option pendant l'app
  sub = (AccessibilityInfo as any).addEventListener?.(
    "reduceMotionChanged",
    (v: boolean) => setReduceMotion(!!v)
  );
  return () => sub?.remove?.();
}, []);
// Padding bas pour le ScrollView
const bottomInset = useMemo(() => {
  const h = showBanners && !introBlocking ? adHeight : 0;
  return SPACING * 2 + h + tabBarHeight + insets.bottom;
}, [showBanners, introBlocking, adHeight, tabBarHeight, insets.bottom]);
  
const AVA = IS_SMALL ? normalizeSize(96) : normalizeSize(120);
const GAP = IS_SMALL ? 16 : 24;

const isHydrating = useMemo(
  () => !challenge && loading,
  [challenge, loading]
);

useEffect(() => {
  if (!isHydrating) return;

  const timeout = setTimeout(() => {
    // Hard fail-safe : on coupe le chargement si Firestore traîne
    setLoading(false);
  }, 2500);

  return () => clearTimeout(timeout);
}, [isHydrating]);


 const challengeTaken = !!currentChallenge;
 const challengeTakenOptimistic = challengeTaken || justJoinedRef.current;

 // 🧠 partenaire effectif calculé à partir du uniqueKey OU du state
 const effectiveDuoPartnerId =
   derivedDuo.duoPartnerId ||
   duoState?.partnerId ||
   currentChallenge?.duoPartnerId ||
   null;

 // 🧠 isDuo = priorité au calcul dérivé, puis au state, puis aux champs bruts
 const isDuo =
   !!derivedDuo.isDuo ||
   !!duoState?.enabled ||
   !!(currentChallenge && currentChallenge.duo) ||
   !!effectiveDuoPartnerId;

 // ✅ SOLO uniquement si aucune info duo ne ressort
 const isSoloInThisChallenge = !!currentChallenge && !isDuo;
 const isDuoPendingOut = !!outgoingPendingInvite && !isDuo;

 useEffect(() => {
  if (!isDuoPendingOut) {
    duoPendingPulse.value = 0;
    return;
  }
  duoPendingPulse.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) })
   ),
   -1,
   false
  );
}, [isDuoPendingOut, duoPendingPulse]);


const isDisabledMark = marking || isMarkedToday(id, finalSelectedDays);



// 🆕 Sync immédiate avec le contexte quand le challenge passe en DUO
useEffect(() => {
  if (!currentChallenge || !currentChallenge.duo || !currentChallenge.duoPartnerId) return;

  setDuoState((prev) => {
    const selectedDays =
      currentChallenge.selectedDays ??
      prev?.selectedDays ??
      finalSelectedDays ??
      0;

    const uniqueKey =
      currentChallenge.uniqueKey ||
      prev?.uniqueKey ||
      null; // 👈 plus de clé inventée sans pair

    const partnerId = currentChallenge.duoPartnerId;

    if (
      prev &&
      prev.enabled &&
      prev.partnerId === partnerId &&
      prev.selectedDays === selectedDays &&
      prev.uniqueKey === uniqueKey
    ) {
      return prev;
    }

    return {
      enabled: true,
      partnerId,
      selectedDays,
      uniqueKey,
    };
  });

  if (
    typeof currentChallenge.selectedDays === "number" &&
    currentChallenge.selectedDays > 0 &&
    currentChallenge.selectedDays !== finalSelectedDays
  ) {
    setFinalSelectedDays(currentChallenge.selectedDays);
  }

  if (
    typeof currentChallenge.completedDays === "number" &&
    currentChallenge.completedDays >= 0 &&
    currentChallenge.completedDays !== finalCompletedDays
  ) {
    setFinalCompletedDays(currentChallenge.completedDays);
  }
}, [
  currentChallenge?.duo,
  currentChallenge?.duoPartnerId,
  currentChallenge?.selectedDays,
  currentChallenge?.completedDays,
  currentChallenge?.id,
  finalSelectedDays,
  finalCompletedDays,
]);


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

      let data = snap.data() as any;
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
            completionDates: [],
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
    { translateX: shakeMy.value * 3 }, // micro-shake premium
    { scale: interpolate(popMy.value, [0, 1], [1, 1.12]) },
  ] as ViewStyle["transform"],
}));

const shakeStylePartner = useAnimatedStyle<ViewStyle>(() => ({
  transform: [
    { translateX: shakePartner.value * 3 },
    { scale: interpolate(popPartner.value, [0, 1], [1, 1.12]) },
  ] as ViewStyle["transform"],
}));

const pulseStyle = useAnimatedStyle<ViewStyle>(() => ({
  transform: [{ scale: interpolate(leaderPulse.value, [0, 1], [1, 1.08]) }],
  opacity: 1, // ✅ NE JAMAIS baisser la couronne
}));


useEffect(() => {
  if (!isDuo) return;
  if (!duoChallengeData?.duoUser) return; // ⬅️ on attend que le partenaire soit chargé

  const introKey =
    duoState?.uniqueKey ||
    `${id}_${duoState?.selectedDays || 0}_${
      duoState?.partnerId || duoChallengeData.duoUser.id
    }`;

  if (!introKey || lastIntroKeyRef.current === introKey) return;

  lastIntroKeyRef.current = introKey;
  setIntroVisible(true);
}, [
  isDuo,
  id,
  duoState?.uniqueKey,
  duoState?.selectedDays,
  duoState?.partnerId,
  duoChallengeData?.duoUser?.id,
]);


const startVsIntro = useCallback(() => {
  // Respect accessibilité : pas d'anim agressive
  if (reduceMotion) {
    fadeOpacity.value = withTiming(0, { duration: 450 }, () => {
      runOnJS(setIntroVisible)(false);
      runOnJS(setIntroBlocking)(false);
      startedRef.current = false;
      myImgReady.current = false;
      partnerImgReady.current = false;
    });
    return;
  }

  // petit "impact" haptique premium
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

  // Pop scale synchro (court et cinématique)
  popMy.value = 0;
  popPartner.value = 0;
  popMy.value = withSequence(
    withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) })
  );
  popPartner.value = withSequence(
    withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) })
  );

  // Micro-shake x2 (plus rapide, moins "jeu mobile")
  shakeMy.value = withSequence(
    withRepeat(
      withSequence(
        withTiming(-1, { duration: 55, easing: Easing.out(Easing.quad) }),
        withTiming( 1, { duration: 55, easing: Easing.out(Easing.quad) }),
        withTiming( 0, { duration: 55 })
      ),
      2,
      true
    ),
    withTiming(0, { duration: 40 })
  );

  shakePartner.value = withSequence(
    withRepeat(
      withSequence(
        withTiming( 1, { duration: 55 }),
        withTiming(-1, { duration: 55 }),
        withTiming( 0, { duration: 55 })
      ),
      2,
      true
    ),
    withTiming(0, { duration: 40 }, () => {
      fadeOpacity.value = withTiming(
        0,
        { duration: 420, easing: Easing.inOut(Easing.quad) },
        () => {
          runOnJS(setIntroVisible)(false);
          runOnJS(setIntroBlocking)(false);
          startedRef.current = false;
          myImgReady.current = false;
          partnerImgReady.current = false;
        }
      );
    })
  );
}, [reduceMotion, fadeOpacity, popMy, popPartner, shakeMy, shakePartner]);

const tryStart = useCallback(() => {
  if (startedRef.current) return;
  if (myImgReady.current && partnerImgReady.current) {
    startedRef.current = true;
    startVsIntro();
  }
}, [startVsIntro]);

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

  // reset à chaque ouverture
  startedRef.current = false;
  myImgReady.current = false;
  partnerImgReady.current = false;

  setIntroBlocking(true);
  fadeOpacity.value = 0;
  fadeOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });

  // pas de timer ici
  return () => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  };
}, [introVisible]);

useEffect(() => {
  if (!introVisible) return;

  // Si les assets sont prêts, on fait le démarrage "propre"
  if (assetsReady) {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => {
      if (!startedRef.current && myImgReady.current && partnerImgReady.current) {
        startedRef.current = true;
        startVsIntro();
      }
    }, 400);
  }

  // Dans TOUS les cas : hard-fallback pour ne JAMAIS rester bloqué sur le spinner
  const hard = setTimeout(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startVsIntro();
    }
  }, assetsReady ? 2500 : 2200);

  return () => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    clearTimeout(hard);
  };
}, [introVisible, assetsReady, startVsIntro]);


// Résout une URL d'avatar quelle que soit la forme : http(s) (Firebase ou non), gs://, ou path Storage
const resolveAvatarUrl = useCallback(async (raw?: string): Promise<string> => {
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
}, []);

useEffect(() => {
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;

  // On garde ici ce qui a déjà été traité (deeplink + modal déjà ouvert)
  const alreadyProcessed = processedInviteIdsRef.current;

  // 🧩 On essaie d'abord la requête "propre" avec status == pending + challengeId
  const baseQuery = query(
    collection(db, "invitations"),
    where("inviteeId", "==", uid),
    where("status", "==", "pending"),
    where("challengeId", "==", id)
  );

  let fallbackUnsub: (() => void) | undefined;

  const unsubMain = onSnapshot(
    baseQuery,
    (snap) => {
      snap.docChanges().forEach((change) => {
        const docId = change.doc.id;
        const data = change.doc.data() as any;

        // ✅ On ne traite que les "added" (pas les removed/modified)
        if (change.type !== "added") return;

        // ✅ Si déjà traité par un deeplink ou un précédent affichage, on ignore
        if (alreadyProcessed.has(docId)) return;

        // Juste au cas où : status & challengeId
        if (data.status !== "pending") return;
        if (data.challengeId !== id) return;

        processedInviteIdsRef.current.add(docId);
        setInvitation({ id: docId });
        setInvitationModalVisible(true);
      });
    },
    (err) => {
      console.warn(
        "⚠️ Snapshot invitations (query complète) a échoué, fallback sans index :",
        err?.message || err
      );

      // 🔁 Fallback : on écoute juste inviteeId et on filtre en JS
      const qFallback = query(
        collection(db, "invitations"),
        where("inviteeId", "==", uid)
      );

      fallbackUnsub = onSnapshot(qFallback, (snap2) => {
        snap2.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const data = change.doc.data() as any;

          if (alreadyProcessed.has(docId)) return;
          if (data.status !== "pending") return;
          if (data.challengeId !== id) return;
          if (change.type !== "added" && change.type !== "modified") return;

          processedInviteIdsRef.current.add(docId);
          setInvitation({ id: docId });
          setInvitationModalVisible(true);
        });
      });
    }
  );

  // 🔍 Vérif immédiate au montage (sans attendre un changement)
  (async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "invitations"),
          where("inviteeId", "==", uid),
          where("status", "==", "pending"),
          where("challengeId", "==", id)
        )
      );

      snap.forEach((d) => {
        const docId = d.id;
        const data = d.data() as any;

        if (alreadyProcessed.has(docId)) return;
        if (data.status !== "pending") return;
        if (data.challengeId !== id) return;

        processedInviteIdsRef.current.add(docId);
        setInvitation({ id: docId });
        setInvitationModalVisible(true);
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
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;

  const userRef = doc(db, "users", uid);

  const unsub = onSnapshot(
    userRef,
    (snap) => {
      let data = snap.data() as any;
      const list: any[] = Array.isArray(data?.CurrentChallenges)
        ? data.CurrentChallenges
        : [];

      // ✅ Match toutes les entrées liées à ce challenge
      const matches = list.filter((c) => {
        const cid = c?.challengeId ?? c?.id;
        return cid === id;
      });

      // ✅ S'il y a un duo, il gagne la priorité
      const entry = matches.find((m) => !!m.duo) || matches[0];

      if (!entry) {
        setDuoState((prev) => (prev?.enabled ? { enabled: false } : prev));
        return;
      }

      // 🧹 Auto-cleanup : si duo + solo coexistent, on supprime solo
      if (
        matches.length > 1 &&
        matches.some((m) => !!m.duo) &&
        matches.some((m) => !m.duo) &&
        !cleanupSoloRef.current
      ) {
        cleanupSoloRef.current = true;

        runTransaction(db, async (tx) => {
          const snap2 = await tx.get(userRef);
          if (!snap2.exists()) return;
          const data2 = snap2.data() as any;
          const list2: any[] = Array.isArray(data2?.CurrentChallenges)
            ? data2.CurrentChallenges
            : [];
          const cleaned = list2.filter((c) => {
            const cid = c?.challengeId ?? c?.id;
            // garde tout sauf SOLO de ce challenge quand DUO existe
            if (cid === id && !c?.duo) return false;
            return true;
          });
          tx.update(userRef, { CurrentChallenges: cleaned });
        })
          .catch((e) => console.warn("cleanup solo failed (non bloquant):", e))
          .finally(() => {
            cleanupSoloRef.current = false;
          });
      }

     // Toujours garder ces deux-là sync depuis Firestore
setFinalSelectedDays(entry.selectedDays || 0);

// ✅ completedDays robuste : chiffre direct OU length de completionDates
let computedCompleted = 0;
if (typeof entry.completedDays === "number") {
  computedCompleted = entry.completedDays;
} else if (Array.isArray(entry.completionDates)) {
  computedCompleted = entry.completionDates.length;
}

setFinalCompletedDays(computedCompleted);


      // 🧠 on recalcule le duo à partir du uniqueKey + uid courant
      const { isDuo, duoPartnerId } = deriveDuoInfoFromUniqueKey(
        {
          challengeId: entry.challengeId ?? entry.id,
          id: entry.id,
          uniqueKey: entry.uniqueKey,
          duo: entry.duo,
          duoPartnerId: entry.duoPartnerId,
          duoPartnerUsername: entry.duoPartnerUsername,
          selectedDays: entry.selectedDays,
        },
        uid
      );

      if (isDuo && duoPartnerId) {
        setDuoState({
          enabled: true,
          partnerId: duoPartnerId,
          selectedDays: entry.selectedDays,
          uniqueKey:
            entry.uniqueKey ||
            `${entry.challengeId ?? entry.id}_${entry.selectedDays}`,
        });
      } else {
        setDuoState((prev) => (prev?.enabled ? { enabled: false } : prev));
      }
    },
    (error) => {
      console.error("❌ user CurrentChallenges snapshot error:", error);
    }
  );

  return () => unsub();
}, [id]);


useEffect(() => {
   if (!duoState?.enabled || !duoState?.partnerId) {
     setDuoChallengeData(null);
     return;
   }
   const partnerRef = doc(db, "users", duoState.partnerId);
   const unsub = onSnapshot(partnerRef, async (partnerSnap) => {
     if (!partnerSnap.exists()) {
       setDuoChallengeData(null);
       return;
     }
     const partnerData = partnerSnap.data() as any;
     const partnerName =
       partnerData.username ||
       partnerData.displayName ||
       (typeof partnerData.email === "string" ? partnerData.email.split("@")[0] : "") ||
       t("duo.partner");
     const rawAvatar =
       partnerData.profileImage ||
       partnerData.avatar ||
       partnerData.avatarUrl ||
       partnerData.photoURL ||
       partnerData.photoUrl ||
       partnerData.imageUrl ||
       "";
     let resolvedPartnerAvatar = "";
     try { resolvedPartnerAvatar = (await resolveAvatarUrl(rawAvatar)) || rawAvatar; } catch {}
     if (!resolvedPartnerAvatar) {
       resolvedPartnerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName || "P")}`;
     }

     // entrée miroir côté partenaire
     const partnerList: any[] = Array.isArray(partnerData.CurrentChallenges)
       ? partnerData.CurrentChallenges
       : [];
     const mirror = partnerList.find((c: any) => {
  if (duoState.uniqueKey && c?.uniqueKey) return c.uniqueKey === duoState.uniqueKey;
  const cid = c?.challengeId ?? c?.id;
  return cid === id && c?.selectedDays === (duoState.selectedDays || 0);
});

// ✅ jours sélectionnés : miroir > duoState > 0
const partnerSelectedDays =
  (typeof mirror?.selectedDays === "number" && mirror.selectedDays > 0)
    ? mirror.selectedDays
    : (duoState.selectedDays || 0);

// ✅ completedDays robuste : chiffre direct OU length de completionDates
let partnerCompleted = 0;
if (mirror) {
  if (typeof mirror.completedDays === "number") {
    partnerCompleted = mirror.completedDays;
  } else if (Array.isArray(mirror.completionDates)) {
    partnerCompleted = mirror.completionDates.length;
  }
}

setPartnerAvatar(resolvedPartnerAvatar);
setDuoChallengeData({
  duo: true,
  duoUser: {
    id: duoState.partnerId,
    name: partnerName,
    avatar: resolvedPartnerAvatar,
    completedDays: partnerCompleted,
    selectedDays: partnerSelectedDays,
    isPioneer: !!partnerData.isPioneer,
  },
});

   }, (e) => console.error("❌ partner onSnapshot error:", e));

   return () => unsub();
 }, [duoState?.enabled, duoState?.partnerId, duoState?.selectedDays, duoState?.uniqueKey, id, t]);

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

      setLoading(false);
      setDeeplinkBooting(false); 
    },
    (error) => {
      console.error("❌ Erreur récupération défi :", error);
      setLoading(false);
      setDeeplinkBooting(false); 
    }
  );

  return () => unsubscribe();
}, [id, t]);


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
          setMyIsPioneer(!!u?.isPioneer);
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

      if (data.status === "accepted") {
  // La notif à l'inviteur est envoyée par la Cloud Function.
  // Ici, on ne fait que le reset solo local, idempotent et sûr.
  resetSoloProgressIfNeeded();
}

    });
  });

  return () => unsubscribe();
}, [id, t, resetSoloProgressIfNeeded]);


const pathname = usePathname();
const currentUid = auth.currentUser?.uid || null;
useEffect(() => {
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;

  // ✅ On écoute si MOI (inviter) j’ai une invitation pending sur ce challenge
  const qOut = query(
    collection(db, "invitations"),
    where("inviterId", "==", uid),
    where("challengeId", "==", id),
    where("status", "==", "pending"),
    limit(1)
  );

  const unsub = onSnapshot(
    qOut,
    (snap) => {
      if (snap.empty) {
        setOutgoingPendingInvite(null);
        return;
      }
      const d = snap.docs[0];
      const data = d.data() as any;
      setOutgoingPendingInvite({
        id: d.id,
        inviteeUsername: data?.inviteeUsername ?? null,
      });
    },
    () => {
      // non bloquant
      setOutgoingPendingInvite(null);
    }
  );

  return () => unsub();
}, [id]);


// 🆕 Helper : récupère un username propre pour stocker dans inviteeUsername
const getInviteeUsername = useCallback(async (uid: string): Promise<string | null> => {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const u = snap.data() as any;
    return (
      u.username ||
      u.displayName ||
      (typeof u.email === "string" ? u.email.split("@")[0] : null)
    );
  } catch {
    return null;
  }
}, []);

useEffect(() => {
  const openFromParamOrUrl = async (inviteParam?: string) => {
    const idStr = String(inviteParam || "").trim();
    if (!idStr) return;
    if (processedInviteIdsRef.current.has(idStr)) return;
    if (inviteOpenGuardRef.current) return; // anti double open

    // 🆕 On annonce qu'on boot via deeplink d'invit
    setDeeplinkBooting(true);
    setInviteLoading(true);
    inviteOpenGuardRef.current = true;

    // 🆕 Flag pour savoir si on va VRAIMENT afficher le modal
    let willShowModal = false;

    // 🔐 Re-snapshot live de l'utilisateur au moment T
    const liveUid = auth.currentUser?.uid || null;

    // Pas connecté → on garde le flow login + redirect + invite
    if (!liveUid) {
      try {
        const redirectTarget = `/challenge-details/${params.id || id}`;
        const redirect = encodeURIComponent(redirectTarget);
        router.replace(
          `/login?redirect=${redirect}&invite=${encodeURIComponent(idStr)}` as any
        );
      } catch (e) {
        console.warn("[invite] redirect to login failed:", e);
      } finally {
        // ❌ Pas de modal → on coupe l’overlay
        inviteOpenGuardRef.current = false;
        setInviteLoading(false);
        setDeeplinkBooting(false);
      }
      return;
    }

    try {
      // 🧾 Vérifie que l’invitation existe
      const snap = await getDoc(doc(db, "invitations", idStr));
      if (!snap.exists()) {
        console.warn("[invite] invitation doc inexistant pour id =", idStr);
        return;
      }

      let data = snap.data() as any;

      // Invitation plus valable
      if (data.status !== "pending") {
        console.warn("[invite] invitation non pending, statut =", data.status);
        return;
      }

      // 🚫 L'inviteur ne peut pas "accepter" sa propre open-invite
      if (data.inviterId === liveUid) {
        console.warn("[invite] user est l'inviteur, ignore le lien");
        return;
      }

      // === CAS 1 : invitation classique (directe, avec inviteeId fixé) ===
      if (data.kind !== "open") {
        if (data.inviteeId !== liveUid) {
          console.warn("[invite] doc ne concerne pas ce user (direct invite)");
          return;
        }
      } else {
        // === CAS 2 : OPEN INVITE ===
        if (data.inviteeId && data.inviteeId !== liveUid) {
          console.warn("[invite] open invite déjà prise par un autre user");
          return;
        }

        if (!data.inviteeId) {
          console.log(
            "[invite] open invite sans inviteeId → tentative de claim pour",
            liveUid
          );

          const inviteeUsername = liveUid
            ? await getInviteeUsername(liveUid)
            : null;

          try {
            await runTransaction(db, async (tx) => {
              const ref = doc(db, "invitations", idStr);
              const snap2 = await tx.get(ref);
              if (!snap2.exists()) throw new Error("invite_not_found");

              const d2 = snap2.data() as any;
              if (d2.status !== "pending") throw new Error("not_pending");

              // si quelqu'un l'a prise entre-temps, on stoppe
              if (d2.inviteeId && d2.inviteeId !== liveUid) {
                throw new Error("already_taken");
              }

              tx.update(ref, {
                inviteeId: liveUid,
                inviteeUsername: inviteeUsername || null,
                updatedAt: serverTimestamp(),
              });
            });

            console.log("[invite] open invite CLAIMED par", liveUid);

            // 🔁 On recharge la version à jour (inviteeId / inviteeUsername remplis)
            try {
              const freshSnap = await getDoc(doc(db, "invitations", idStr));
              if (freshSnap.exists()) {
                data = freshSnap.data() as any;
              }
            } catch (e) {
              console.warn("[invite] refresh invitation after claim failed:", e);
            }
          } catch (e) {
            console.warn("[invite] claim open invite failed:", e);
            return; // on ne montre pas de modal si on ne peut pas revendiquer
          }
        }
      }

      // Si le lien pointe vers un autre challenge, on redirige dessus
      if (data.challengeId && data.challengeId !== id) {
        try {
          router.replace(
            `/challenge-details/${data.challengeId}?invite=${encodeURIComponent(
              idStr
            )}` as any
          );
        } catch (e) {
          console.warn("[invite] redirect vers bon challenge échoué:", e);
        } finally {
          // ❌ on ne montre pas de modal ici, ce sera géré dans l'autre screen
          inviteOpenGuardRef.current = false;
          setInviteLoading(false);
          setDeeplinkBooting(false);
        }
        return;
      }

      // ✅ OK : on ouvre le modal une seule fois
      processedInviteIdsRef.current.add(idStr);
      setInvitation({ id: idStr });
      setInvitationModalVisible(true);
      willShowModal = true; // ✅ on va laisser l’overlay vivre jusqu’à onLoaded()

      // Nettoie l’URL en enlevant ?invite (évite re-open au re-render)
      try {
        const cleanUrl = pathname || `/challenge-details/${id}`;
        router.replace(cleanUrl as any);
      } catch (e) {
        console.warn("[invite] cleanUrl failed:", e);
      }
    } catch (e) {
      console.error("❌ openFromParamOrUrl failed:", e);
    } finally {
      inviteOpenGuardRef.current = false;
      if (!willShowModal) {
        // ❌ pas de modal → on coupe l’overlay ici
        setInviteLoading(false);
        setDeeplinkBooting(false);
      }
      // ✅ si willShowModal = true → on laisse l’overlay,
      // il sera coupé par InvitationModal.onLoaded
    }
  };

   let urlSub: { remove?: () => void } | undefined;

  // 1) Param route déjà mappé par expo-router
  if (params?.invite) {
    openFromParamOrUrl(String(params.invite));
  }

  // 2) Initial URL (app tuée puis ouverte via lien)
  Linking.getInitialURL()
    .then((initialUrl) => {
      if (!initialUrl) return;
      const parsed = Linking.parse(initialUrl);
      const invite = String(parsed?.queryParams?.invite || "");
      if (invite) openFromParamOrUrl(invite);
    })
    .catch((e) => console.warn("⚠️ getInitialURL error:", e));

  // 3) URLs runtime (app déjà ouverte, clic depuis WhatsApp, SMS, etc.)
  const onUrl = ({ url }: { url: string }) => {
    try {
      const parsed = Linking.parse(url);
      const invite = String(parsed?.queryParams?.invite || "");
      if (invite) openFromParamOrUrl(invite);
    } catch (e) {
      console.warn("⚠️ Linking url handler error:", e);
    }
  };
  // ✅ évite les API divergentes (Expo/RN) + cleanup fiable
  urlSub = (Linking as any).addEventListener?.("url", onUrl);

  return () => {
    urlSub?.remove?.();
  };
}, [id, params?.invite, pathname, router, getInviteeUsername, markInviteAsHandled]);



  const isSavedChallenge = useCallback((challengeId: string) => savedIds.has(challengeId), [savedIds]);

  const savedNow =
  pendingFavorite !== null
    ? pendingFavorite
    : isSavedChallenge(id);

const completions = useMemo(
  () => currentChallenge?.completionDates || [],
  [currentChallenge?.completionDates]
);

// 🆕 Set normalisé en "YYYY-MM-DD" (supporte string & Timestamp)
const completionSet = useMemo(() => {
  if (!Array.isArray(completions)) return new Set<string>();

  const normalized = completions
    .map((raw) => {
      if (!raw) return null;
      const v: any = raw;

      // Firestore Timestamp { seconds, nanoseconds }
      if (v && typeof v === "object" && typeof v.seconds === "number") {
        const d = new Date(v.seconds * 1000);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      // String : "2025-12-01" ou "2025-12-01T10:12:00Z"
      if (typeof v === "string") {
        const s = v.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      }

      return null;
    })
    .filter((s): s is string => !!s);

  return new Set(normalized);
}, [completions]);

const calendarDays = useMemo(() => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const numDays = new Date(year, month + 1, 0).getDate();

  const jsWeekday = new Date(year, month, 1).getDay(); // 0 = dimanche, 1 = lundi...
  const firstDayIndex = (jsWeekday + 6) % 7; // on aligne sur lundi

  const calendar: (null | { day: number; date: Date; completed: boolean })[] =
    [];

  // Cases vides avant le 1er
  for (let i = 0; i < firstDayIndex; i++) {
    calendar.push(null);
  }

  // Jours du mois
  for (let day = 1; day <= numDays; day++) {
    const dateObj = new Date(year, month, day);

    // ✅ clé locale "YYYY-MM-DD" (plus de décalage UTC)
    const key = [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");

    const completed = completionSet.has(key);
    calendar.push({ day, date: dateObj, completed });
  }

  return calendar;
}, [currentMonth, completionSet]);


 const goToPrevMonth = useCallback(() => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    startTransition(() => setCurrentMonth(newMonth));
  }, [currentMonth]);

  const goToNextMonth = useCallback(() => {
    const newMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );
   startTransition(() => setCurrentMonth(newMonth));
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleString(i18n.language, {
    month: "long",
  });
  const currentYearNum = currentMonth.getFullYear();

  const showCompleteButton =
    challengeTaken &&
    finalSelectedDays > 0 &&
    finalCompletedDays >= finalSelectedDays;
  const progressPercent =
    finalSelectedDays > 0
      ? Math.min(1, finalCompletedDays / finalSelectedDays)
      : 0;

      // Map la durée sélectionnée vers nos paliers d'achievements (7/30/90/180/365)
 const bucketizeDays = (n: number): 7 | 30 | 90 | 180 | 365 => {
   if (n <= 7) return 7;
   if (n <= 30) return 30;
   if (n <= 90) return 90;
   if (n <= 180) return 180;
   return 365;
 };

  const handleTakeChallenge = useCallback(async () => {
  if (challengeTaken || !id) return;

  setModalVisible(false);

  try {
    // 👇 spinner global c'est optionnel, mais on va surtout faire de l’optimiste
    // setLoading(true);

    // 1) On récupère le challenge une fois (rapide)
    const challengeRef = doc(db, "challenges", id);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) {
      Alert.alert(t("alerts.error"), t("challengeDetails.fetchError"));
      return;
    }
    const challengeData = challengeSnap.data();

    // 2) UI optimiste IMMÉDIATE (non bloquante)
    startTransition(() => {
      justJoinedRef.current = true;
      setFinalSelectedDays(localSelectedDays);
      setFinalCompletedDays(0);
    });

    // 3) Contexte (persistance locale) — ok de l’attendre pour être cohérent
    await takeChallenge(
      {
        id,
        title: challengeData.title || "Untitled Challenge",
        category: challengeData.category || "Uncategorized",
        description: challengeData.description || "No description available",
        daysOptions: challengeData.daysOptions || [7,14,21,30,60,90,180,365],
        chatId: challengeData.chatId || id,
        imageUrl: challengeData.imageUrl || "",
      },
      localSelectedDays
    );

    // 🔢 Metrics: sélectionner une durée compte pour les succès (7/30/90/180/365)
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await recordSelectDays(uid, bucketizeDays(localSelectedDays));
      await checkForAchievements(uid);
    }
  } catch (e) {
    console.warn("recordSelectDays failed (non-bloquant):", e);
  }

    // 4) Préfetch de l’image pour éviter le flash si tu scrolles/remontes
    if (challengeData.imageUrl) {
      try { Image.prefetch?.(challengeData.imageUrl); } catch {}
    }

    // 5) Écriture Firestore **en arrière-plan** (pas d’attente UI)
    runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(challengeRef);
      if (!docSnap.exists()) throw new Error("Challenge inexistant");
      const data = docSnap.data();
      const uid = auth.currentUser?.uid!;
      const count = data.participantsCount || 0;
      const users: string[] = data.usersTakingChallenge || [];
      if (!users.includes(uid)) {
        transaction.update(challengeRef, {
          participantsCount: count + 1,
          usersTakingChallenge: users.concat([uid]),
        });
      }
    }).catch((e) => console.warn("Txn participants échouée (non bloquant):", e));

    // ❌ plus de router.replace() ici
  } catch (err) {
    startTransition(() => {
      justJoinedRef.current = false;
      setFinalSelectedDays(0);
      setFinalCompletedDays(0);
    });
    Alert.alert(
      t("alerts.error"),
      err instanceof Error ? err.message : t("challengeDetails.joinError")
    );
  } finally {
    // setLoading(false);
  }
}, [id, challengeTaken, localSelectedDays, takeChallenge, t]);


  const saveBusyRef = useRef(false);
  const markBusyRef = useRef(false);

const handleSaveChallenge = useCallback(async () => {
  if (!id || saveBusyRef.current) return;
  saveBusyRef.current = true;

  const wasSaved = isSavedChallenge(id);
  setPendingFavorite(!wasSaved); // 👈 optimiste immédiat

  try {
    const challengeRef = doc(db, "challenges", id);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) throw new Error("not_found");

    const d = challengeSnap.data();
    const obj = {
      id,
      title: d.title || "Untitled Challenge",
      category: d.category || "Uncategorized",
      description: d.description || "No description available",
      daysOptions: d.daysOptions || [7,14,21,30,60,90,180,365],
      chatId: d.chatId || id,
      imageUrl: d.imageUrl || "",
    };

    if (wasSaved) await removeChallenge(id);
    else {
      await addChallenge(obj);
      // 🔢 Metrics succès : saveChallenge
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const userRef = doc(db, "users", uid);
          await updateDoc(userRef, { saveChallenge: increment(1) });
          await checkForAchievements(uid);
        }
      } catch (e) {
        console.warn("saveChallenge metric failed (non-bloquant):", e);
      }
    }

  } catch (err) {
    // rollback optimiste
    setPendingFavorite(null);
    Alert.alert(t("alerts.error"), t("challengeDetails.saveError"));
  } finally {
    saveBusyRef.current = false;
    setPendingFavorite(null);
  }
}, [id, addChallenge, removeChallenge, isSavedChallenge, t]);

const handleShowCompleteModal = useCallback(() => {
  if (!id) return;
  if (!finalSelectedDays || finalSelectedDays <= 0) return;
  setCompletionModalVisible(true);
}, [id, finalSelectedDays]);

  const handleNavigateToChat = useCallback(() => {
    if (!challengeTaken ) {
      Alert.alert(
        t("alerts.accessDenied"),
        t("challengeDetails.chatAccessDenied")
      );
      return;
    }
    router.push(
  `/challenge-chat/${id}?title=${encodeURIComponent(routeTitle)}&duo=${isDuo ? "1" : "0"}`
);
  }, [id, challengeTaken , routeTitle, router]);

// Langue sûre pour le partage (jamais de split sur undefined)
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
      const l = String(locs[0].languageTag)
        .split(/[-_]/)[0]
        ?.toLowerCase();
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
  // 4) Web fallback éventuel (web only)
  const navLang = (globalThis as any)?.navigator?.language;
  if (typeof navLang === "string" && navLang.length > 0) {
    const l = navLang.split(/[-_]/)[0]?.toLowerCase();
    if (l) return l;
  }
  // 5) Défaut
  return "en";
};

// 🔗 Construction du lien de partage 100 % safe RN/Hermes (pas de URLSearchParams)
const buildShareUrl = (challengeId: string, title: string, lang: string) => {
  const entries: [string, string][] = [
    ["id", challengeId],
    ["title", title],
    ["lang", lang],
    // petit cache-busting pour les aperçus (WhatsApp / iMessage)
    ["v", String(Date.now())],
  ];

  const qs = entries
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join("&");

  return `https://links.challengeties.app/i?${qs}`;
};

const handleShareChallenge = useCallback(async () => {
  if (!id) return;

  try {
    const shareLang = getShareLang(i18n?.language as string | undefined);
    const safeTitle =
      routeTitle && routeTitle.trim().length > 0
        ? routeTitle.trim()
        : t("challengeDetails.untitled");

    const appLink = buildShareUrl(id, safeTitle, shareLang);
    const message = `${t("challengeDetails.shareMessage", {
      title: safeTitle,
    })}\n${appLink}`;

    // Payload compatible Android / iOS
    const payload: any = {
      title: t("challengeDetails.share"),
      message,
    };

    // Sur iOS seulement, on ajoute url (Android n'en a pas besoin,
    // et certains bridges cassent quand l'url est mal gérée)
    if (Platform.OS === "ios") {
      payload.url = appLink;
    }

    const result = await Share.share(payload, {
      dialogTitle: t("challengeDetails.share"),
    });

    if (result.action === Share.sharedAction) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await incStat(uid, "shareChallenge.total", 1);
        await checkForAchievements(uid);
      }
    } else {
      // Annulé → on copie le lien en fallback discret
      try {
        const { setStringAsync } = await import("expo-clipboard");
        await setStringAsync(appLink);
        Alert.alert(
          t("challengeDetails.share"),
          t("challengeDetails.linkCopied")
        );
      } catch {}
    }
  } catch (error: any) {
    console.error("❌ handleShareChallenge error:", error);
    Alert.alert(
      t("alerts.shareError"),
      error?.message || String(error)
    );
  }
}, [id, routeTitle, t, i18n?.language]);

const handleInviteFriend = useCallback(async () => {
  hapticTap();
  try {
    if (!id) return;

    // 0) Hors-ligne -> message clair
    if (isOffline) {
      Alert.alert(
        t("common.networkError"),
        t("firstPick.offlineDuo", {
          defaultValue: "Connecte-toi à Internet pour inviter un ami en duo.",
        })
      );
      return;
    }

    // 1) Interdit si déjà en DUO
    if (isDuo) {
      Alert.alert(t("alerts.error"), t("invitationS.errors.duoAlready"));
      return;
    }

    // 2) Anti-doublon : refuse si une invitation PENDING existe déjà pour ce défi
    const res = await canInvite(id);
    if (!res.ok) {
      const msg =
        res.reason === "pending-invite"
          ? t("firstPick.alreadyInvited", {
              defaultValue: "Tu as déjà une invitation en attente pour ce défi.",
            })
          : t("common.oops");
      Alert.alert(t("common.info"), msg);
      return;
    }

    // 3) Si déjà en SOLO → confirmation reset
    if (isSoloInThisChallenge) {
      setConfirmResetVisible(true);
      return;
    }

    // 4) Sinon, ouvre directement le SendInvitationModal
    setSendInviteVisible(true);
  } catch (err) {
    console.error("❌ handleInviteFriend error:", err);
    Alert.alert(t("alerts.error"), t("invitationS.errors.unknown"));
  }
}, [id, isDuo, isSoloInThisChallenge, isOffline, t]);

useEffect(() => {
  // 1) Pas de signal -> rien
  if (!params?.openSendInvite) return;

  // 2) Si on est dans le flow "InvitationModal" (deeplink / pending invite),
  //    on ne touche à rien. Priorité à ?invite=
  if (params?.invite) return;

  // 3) Anti double-open
  if (autoSendInviteOnceRef.current) return;
  autoSendInviteOnceRef.current = true;

  // 4) On déclenche l’ouverture de ton flow existant
  const task = InteractionManager.runAfterInteractions(() => {
    handleInviteFriend(); // garde toutes tes protections (offline, duo, pending, confirm reset)
  });

  // 5) Nettoyage URL pour éviter ré-ouverture si re-render / retour écran
  try {
    const clean = pathname || `/challenge-details/${id}`;
    router.replace(clean as any);
  } catch {}

  return () => {
    // @ts-ignore
    task?.cancel?.();
  };
}, [params?.openSendInvite, params?.invite, pathname, id, router, handleInviteFriend]);


const handleInviteButtonPress = useCallback(() => {
  if (isDuo) {
    Alert.alert(
      t("alerts.info", { defaultValue: "Info" }),
      t("invitationS.errors.duoAlready", {
        defaultValue: "Tu es déjà en duo sur ce défi.",
      })
    );
    return;
  }
  handleInviteFriend();
}, [isDuo, handleInviteFriend, t]);


  const handleViewStats = useCallback(() => {
    if (!challengeTaken ) return;
    setStatsModalVisible(true);
  }, [challengeTaken ]);

  const handleMarkTodayPress = useCallback(async () => {
  if (!id || !challengeTaken) return;
  if (marking || markBusyRef.current) return;
  if (isMarkedToday(id, finalSelectedDays)) return;

  try {
    markBusyRef.current = true;
    setMarking(true);
    // ⚠️ on laisse le contexte faire ses vérifications (rupture, modal, etc.)
    await markToday(id, finalSelectedDays);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
try {
  await bumpCounterAndMaybeReview(`markToday:${id}:${finalSelectedDays}`, 7);
} catch {}
// 🔢 Metrics : streak "au moins 1 validation / jour" + succès
try {
  const uid = auth.currentUser?.uid;
  if (uid) {
    await recordDailyGlobalMark(uid, new Date());
    await checkForAchievements(uid);
  }
} catch (e) {
  console.warn("recordDailyGlobalMark failed (non-bloquant):", e);
}


  } catch (e) {
    console.error("markToday failed", e);
    Alert.alert(
      t("alerts.error"),
      t("challengeDetails.markError", { defaultValue: "Erreur" })
    );
  } finally {
    setMarking(false);
    markBusyRef.current = false;
  }
}, [marking, challengeTaken, id, finalSelectedDays, isMarkedToday, markToday, t]);

  // 🆕 styles/objets stables pour ScrollView afin d’éviter re-renders
const scrollContentStyle = useMemo(
  () => [styles.scrollPad, { paddingBottom: bottomInset + SPACING }],
  [bottomInset]
);

  const loadingLabel = inviteLoading
    ? t("challengeDetails.loadingInvite", {
        defaultValue: "Ouverture de l’invitation…",
      })
    : t("challengeDetails.loading", {
        defaultValue: "Chargement du défi…",
      });

const DuoAvatar = ({ uri, name }: { uri?: string | null; name?: string }) => {
  const hasUri = typeof uri === "string" && uri.trim().length > 0;

  return (
    <View style={styles.duoAvatarShell}>
      {hasUri ? (
        <ExpoImage
  source={{ uri: uri as string }}
  style={styles.duoEliteAvatar}
  contentFit="cover"
  transition={120}
  cachePolicy="memory-disk"
  recyclingKey={uri as string}
/>

      ) : (
        <LinearGradient
          colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.06)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.duoAvatarFallback}
        >
          <Text style={styles.duoAvatarInitial}>{getInitial(name)}</Text>
        </LinearGradient>
      )}
      <View style={styles.duoAvatarRing} pointerEvents="none" />
    </View>
  );
};



  return (
    <LinearGradient
  colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
  style={styles.container}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
      <OrbBackground theme={currentTheme} />
     <SafeAreaView
  style={{ flex: 1, backgroundColor: 'transparent' }}
  edges={['top','bottom']}
>
      <StatusBar
  translucent
  backgroundColor="transparent"
  barStyle={isDarkMode ? "light-content" : "dark-content"}
  hidden={introBlocking}
/>
      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut 
        explosionSpeed={800}
        fallSpeed={3000}
      />
      <Animated.View
   entering={firstMountRef.current && shouldEnterAnim ? FadeInUp : undefined}
   style={[styles.backButtonContainer, { top: insets.top + 6 }]}
   renderToHardwareTextureAndroid
   needsOffscreenAlphaCompositing
   pointerEvents="box-none"
 >
        <BlurView
          intensity={22}
          tint={isDarkMode ? "dark" : "light"}
          style={styles.backButtonBlur}
        >
          <Pressable
            onPress={handleSafeBack}
            style={({ pressed }) => [
              styles.backButtonPress,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t("backButton")}
            accessibilityHint={t("backButtonHint")}
            accessibilityRole="button"
            testID="back-button"
          >
            <Ionicons
              name="arrow-back"
              size={normalizeSize(22)}
              color={isDarkMode ? "#FFD700" : currentTheme.colors.secondary}
            />
          </Pressable>
        </BlurView>
      </Animated.View>
      <ScrollView
        style={{ flex: 1 }}
        removeClippedSubviews={false}          
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        scrollEventThrottle={16}
      >
  <View style={[styles.imageContainer, { height: heroH }]}>
    {challengeImage ? (
      <>
        {/* 🆕 ExpoImage = cache memory/disk + transition native */}
        <ExpoImage
  source={{ uri: challengeImage }}
  style={[styles.image, { height: heroH }]}
  contentFit="cover"
  cachePolicy="disk"          // 👈 force disque pour retours
  transition={150}
  priority="high"             // 👈 charge en priorité
  recyclingKey={challengeImage}
  accessibilityLabel={routeTitle}
/>

        <LinearGradient
        pointerEvents="none"
          colors={
   isDarkMode
     ? ["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.65)"]
     : ["rgba(255,255,255,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.38)"]
 }
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroOverlay}
        />
        {/* vignette ultra légère (Keynote) */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0)", "rgba(0,0,0,0.18)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroVignette}
        />
      </>
    ) : (
      <View style={[
        styles.imagePlaceholder,
        { backgroundColor: currentTheme.colors.overlay, height: heroH }
      ]}>
        <Ionicons name="image-outline" size={normalizeSize(80)} color={currentTheme.colors.textPrimary} />
        <Text style={[styles.noImageText, { color: currentTheme.colors.textPrimary }]}>
  {t("challengeDetails.noImage")}
</Text>
      </View>
    )}
  </View>
        {/* CARD “Keynote” qui chevauche le hero */}
        <Animated.View
          entering={firstMountRef.current && shouldEnterAnim ? FadeInUp.delay(100) : undefined}
          style={styles.heroCardWrap}
        >
          <BlurView
            intensity={Platform.OS === "ios" ? 26 : 18}
            tint={isDarkMode ? "dark" : "light"}
            style={styles.heroCardBlur}
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? ["rgba(20,20,26,0.86)", "rgba(14,14,18,0.74)"]
                  : ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.82)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardInner}
            >
          <Text
            style={[
              styles.infoRecipeName,
              {
                color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
              }, // Couleur dynamique
            ]}
            accessibilityRole="header"
            numberOfLines={titleLines}
            ellipsizeMode="tail"
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
    <View
      style={[
        styles.chip,
        isDarkMode ? styles.chipDark : styles.chipLight,
      ]}
    >
      <Ionicons name="calendar-outline" size={14} color={isDarkMode ? "#fff" : "#111"} />
      <Text style={[styles.chipText, { color: isDarkMode ? "#fff" : "#111" }]}>
        {finalSelectedDays} {t("challengeDetails.days")}
      </Text>
    </View>
  )}

  {/* Duo actif ? */}
  {isDuo && (
    <View style={[styles.chip, isDarkMode ? styles.chipDark : styles.chipLight]}>
      <Ionicons name="people-outline" size={14} color={isDarkMode ? "#fff" : "#111"} />
      <Text style={[styles.chipText, { color: isDarkMode ? "#fff" : "#111" }]}>{t("duo.title")}</Text>
    </View>
  )}

  {/* Participants */}
  <View style={[styles.chip, isDarkMode ? styles.chipDark : styles.chipLight]}>
  <Ionicons name="person-outline" size={14} color={isDarkMode ? "#fff" : "#111"} />
  <Text style={[styles.chipText, { color: isDarkMode ? "#fff" : "#111" }]}>
    {t("challengeDetails.participantsLabel", {
      defaultValue: "Participants",
    })}{": "}{userCount}
  </Text>
</View>
</View>
{/* ✅ DUO PENDING — Keynote card */}
{isDuoPendingOut && outgoingPendingInvite?.id && (
  <View style={styles.duoPendingShell}>
    {/* LEFT = info cliquable */}
    <Pressable
      onPress={() => {
   Alert.alert(
     t("duo.pending.title"),
     t("duo.pending.body"),
     [
       {
         text: t("duo.pending.cancelInvite"),
         style: "destructive",
         onPress: async () => {
           try {
             if (!outgoingPendingInvite?.id) return;
             await updateDoc(doc(db, "invitations", outgoingPendingInvite.id), {
               status: "refused",
               updatedAt: serverTimestamp(),
             });
             Haptics.notificationAsync(
               Haptics.NotificationFeedbackType.Success
             ).catch(() => {});
           } catch {
             Alert.alert(t("alerts.error"), t("duo.pending.cancelError"));
           }
         },
       },
       { text: t("commonS.ok", { defaultValue: "OK" }), style: "cancel" },
     ]
   );
 }}
      style={({ pressed }) => [
        styles.duoPendingCard,
        pressed && { transform: [{ scale: 0.995 }], opacity: 0.97 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("duo.pending.title")}
      accessibilityHint={t("duo.pending.body")}
    >
      {/* ✅ background premium + stroke interne (au lieu d'un border moche) */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isDarkMode
            ? ["rgba(20,20,26,0.78)", "rgba(12,12,16,0.62)"]
            : ["rgba(255,255,255,0.96)", "rgba(255,255,255,0.90)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.duoPendingStroke} />

      <View style={styles.duoPendingRow}>
        <View style={styles.duoPendingLeft}>
        <View style={styles.duoPendingIconWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.duoPendingHalo, duoPendingGlowStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.duoPendingRing, duoPendingPulseStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.duoPendingDot, duoPendingDotStyle]}
          />
          <Ionicons
            name="hourglass-outline"
            size={18}
            color={isDarkMode ? "#fff" : "#111"}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.duoPendingTitle, { color: isDarkMode ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.88)" }]} numberOfLines={1} ellipsizeMode="tail">
            {t("duo.pending.short", { defaultValue: "Invitation en attente" })}
          </Text>

          <View style={styles.duoPendingMetaRow}>
            <View style={styles.duoPendingChip}>
              <Text style={[styles.duoPendingChipText, { color: isDarkMode ? "rgba(255,255,255,0.88)" : "rgba(55,48,163,0.95)" }]}>PENDING</Text>
            </View>
           <Text style={[styles.duoPendingSub, { color: isDarkMode ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.52)" }]} numberOfLines={1} ellipsizeMode="tail">
              {t("invitationS.sentBody", { defaultValue: "On te prévient dès qu’il répond." })}
            </Text>
          </View>

          {!!outgoingPendingInvite.inviteeUsername && (
            <Text style={styles.duoPendingTo} numberOfLines={1} ellipsizeMode="tail">
              @{outgoingPendingInvite.inviteeUsername}
            </Text>
          )}
        </View>
      </View>

      <Ionicons
  name="chevron-forward"
  size={18}
  color={isDarkMode ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.45)"}
  style={{ marginLeft: 10, marginRight: 2 }}
/>
</View>
    </Pressable>

  </View>
)}

          {!challengeTakenOptimistic  && (
            <TouchableOpacity
              style={styles.takeChallengeButton}
              onPress={() => setModalVisible(true)}
             accessibilityLabel={t("challengeDetails.takeChallengeA11y", {
                defaultValue: "Prendre le défi",
              })}
              accessibilityHint={t("challengeDetails.takeChallengeHint", {
                defaultValue: "Ouvre la sélection de durée, puis confirme pour commencer.",
              })}
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
          {challengeTakenOptimistic &&
  !(finalSelectedDays > 0 && finalCompletedDays >= finalSelectedDays) && (
  <Animated.View entering={firstMountRef.current && shouldEnterAnim ? FadeInUp.delay(200) : undefined}
    style={styles.progressSection}
  >
    <Text
      style={[
        styles.inProgressText,
        { color: currentTheme.colors.secondary },
      ]}
    >
      {t("challengeDetails.inProgress")}
    </Text>

    {/* === SOLO MODE (pas de duo) === */}
    {!isDuo && (
      <View style={{ marginTop: SPACING }}>
        {/* Header: avatar + label */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {!!myAvatar && (
    <View style={styles.avatarWrap}>
      <Image
        source={{ uri: myAvatar }}
        style={{ width: normalizeSize(36), height: normalizeSize(36), borderRadius: normalizeSize(18), borderWidth: 2, borderColor: "#FFD700" }}
      />
      {myIsPioneer && (
        <PioneerBadge
    size="mini"
    style={{ position: "absolute", bottom: -6, left: -6 }}
  />
      )}
    </View>
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
  accessibilityRole="progressbar"
  accessibilityLiveRegion="polite"
  accessibilityValue={{
    min: 0,
    max: finalSelectedDays || 0,
    now: finalCompletedDays || 0,
    text: `${finalCompletedDays}/${finalSelectedDays}`
  }}
  style={[styles.progressBarBackground, { backgroundColor: currentTheme.colors.border }]}
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

    {/* === DUO MODE — ELITE (2 barres + battle bonus) === */}
{isDuo && duoChallengeData?.duoUser && (() => {
  const meDone = finalCompletedDays || 0;
  const meTotal = finalSelectedDays || 1;

  const pDone = duoChallengeData.duoUser.completedDays || 0;
  const pTotal = duoChallengeData.duoUser.selectedDays || 1;

  const mePct = Math.max(0, Math.min(1, meDone / meTotal));
  const pPct = Math.max(0, Math.min(1, pDone / pTotal));

  const diff = Math.abs(mePct - pPct);
  const status = mePct > pPct ? "leading" : mePct < pPct ? "behind" : "tied";
  const dayLead = (meDone - pDone);

  const MeIsLeader = status === "leading";
  const PartnerIsLeader = status === "behind";

  return (
    <View style={styles.duoEliteWrap}>
      {/* === AVATARS + COURONNE (lisible) === */}
      <View style={styles.duoEliteAvatars}>
        {/* ME */}
        <View style={styles.duoEliteCol}>
          <View style={styles.duoAvatarWrap}>
            {MeIsLeader && (
              <Animated.View style={[styles.duoCrownMini, pulseStyle]}>
                <View style={styles.duoCrownPill}>
                  <Text style={styles.duoCrownMiniEmoji}>👑</Text>
                </View>
              </Animated.View>
            )}
           <SmartAvatar uri={myAvatar} name={myName || t("duo.you")} size={74} />

          </View>
          <Text style={styles.duoEliteName} numberOfLines={1} ellipsizeMode="tail">
            {myName || t("duo.you")}
          </Text>
        </View>

        <View style={styles.duoVsPill}>
          <Text style={styles.duoVs}>VS</Text>
        </View>

        {/* PARTNER */}
        <View style={styles.duoEliteCol}>
          <View style={styles.duoAvatarWrap}>
            {PartnerIsLeader && (
              <Animated.View style={[styles.duoCrownMini, pulseStyle]}>
                <View style={styles.duoCrownPill}>
                  <Text style={styles.duoCrownMiniEmoji}>👑</Text>
                </View>
              </Animated.View>
            )}
            <SmartAvatar
  uri={duoChallengeData.duoUser.avatar}
  name={duoChallengeData.duoUser.name}
  size={74}
/>

          </View>
          <Text style={styles.duoEliteName} numberOfLines={1} ellipsizeMode="tail">
            {duoChallengeData.duoUser.name}
          </Text>
        </View>
      </View>

      {/* === PROGRESS STACK (PRIMARY, lisible) === */}
      <View style={styles.duoProgressStack}>
        {/* ME BAR */}
        <View style={styles.duoBarRow}>
          <View style={styles.duoBarLabelRow}>
            <Text style={styles.duoBarLabel} numberOfLines={1} ellipsizeMode="tail">{t("duo.you")}</Text>
            <Text style={styles.duoBarValue}>{meDone}/{meTotal}</Text>
          </View>

          <View style={styles.duoBarTrack}>
            <View style={styles.duoBarTrackSheen} pointerEvents="none" />
            <View style={styles.duoBarTicks} pointerEvents="none">
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
            </View>
            <LinearGradient
              colors={["#FF9F1C", "#FFD166"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
  styles.duoBarFill,
  styles.duoBarFillMe,
  { width: `${Math.max(2, mePct * 100)}%`, opacity: mePct === 0 ? 0.35 : 1 },
]}

            />
          </View>
        </View>

        {/* PARTNER BAR */}
        <View style={styles.duoBarRow}>
          <View style={styles.duoBarLabelRow}>
            <Text style={styles.duoBarLabel} numberOfLines={1} ellipsizeMode="tail">
              {duoChallengeData.duoUser.name}
            </Text>
            <Text style={styles.duoBarValue}>{pDone}/{pTotal}</Text>
          </View>

          <View style={styles.duoBarTrack}>
            <View style={styles.duoBarTrackSheen} pointerEvents="none" />
            <View style={styles.duoBarTicks} pointerEvents="none">
              <View style={styles.duoBattleOutline} pointerEvents="none" />
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
              <View style={styles.duoBarTick} />
            </View>
            <LinearGradient
              colors={["#00C2FF", "#00FFD1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
  styles.duoBarFill,
  styles.duoBarFillPartner,
  { width: `${Math.max(2, pPct * 100)}%`, opacity: pPct === 0 ? 0.35 : 1 },
]}

            />
          </View>
        </View>
      </View>

      {/* === BATTLE BAR (SECONDARY, Netflix vibe) === */}
      <View style={styles.duoBattleTitleRow}>
  <Text style={styles.duoBattleTitle}>BATTLE BAR</Text>
  <Text style={styles.duoBattleMini}>{meDone}/{meTotal} • {pDone}/{pTotal}</Text>
</View>

      <View style={styles.duoBattleBarWrap}>
        <View style={styles.duoBattleBar}>
          <View style={styles.duoBattleRail} pointerEvents="none" />
          <View style={[styles.duoBattleLeft, { width: `${mePct * 100}%` }]} />
          <View style={[styles.duoBattleRight, { width: `${pPct * 100}%` }]} />
          <View style={styles.duoBattleDivider} pointerEvents="none" />
        </View>
      </View>

      {/* === STATUT === */}
      <Text
        style={[
          styles.duoEliteStatus,
          status === "leading" && styles.duoLeading,
          status === "behind" && styles.duoBehind,
        ]}
      >
        {status === "leading" && `▲ +${Math.abs(dayLead)}`}
  {status === "behind" && `▼ -${Math.abs(dayLead)}`}
  {status === "tied" && "—"}
      </Text>
      {status !== "tied" && (
  <Text style={styles.duoEliteSubStatus}>
    {status === "leading" && t("duo.status.leading", { percent: Math.round(diff * 100) })}
    {status === "behind" && t("duo.status.behind", { percent: Math.round(diff * 100) })}
  </Text>
)}
    </View>
  );
})()}




    {/* Bouton marquer aujourd'hui (commun) */}
        <TouchableOpacity
      style={styles.markTodayButton}
      accessibilityHint={t("challengeDetails.markTodayHint")}
      accessibilityRole="button"
      onPress={handleMarkTodayPress}
      disabled={isDisabledMark}
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
              ? ["#6b7280", "#6b7280"] // gris pendant l’envoi
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
            {marking
              ? t("commonS.sending", { defaultValue: "Envoi..." })
              : t("challengeDetails.markToday")}
          </Text>
        </LinearGradient>
      )}
    </TouchableOpacity>

  </Animated.View>
)}


           {hasHelper && (
  <Animated.View
    entering={firstMountRef.current && shouldEnterAnim ? FadeIn : undefined}
    style={{ marginTop: SPACING * 1.5, alignItems: "center", zIndex: 0 }}
  >
    <Pressable
      onPress={() => {
        // Ici, on est garanti d'avoir un chatId valide
        router.push(`/challenge-helper/${challenge!.chatId}`);
      }}
      android_ripple={{ color: "#fff", borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={t("challengeDetails.needHelp")}
      accessibilityHint={t("challengeDetails.needHelpHint", {
        defaultValue: "Ouvre une page d’aide détaillée pour ce défi.",
      })}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        borderRadius: 24,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: Platform.OS === "android" ? 0 : 5,
        width: "90%",
        maxWidth: 380,
        marginTop: SPACING * 1.2,
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
        <Ionicons
          name="bulb-outline"
          size={20}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <Text
          style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}
        >
          {t("challengeDetails.needHelp")}
        </Text>
      </LinearGradient>
    </Pressable>
  </Animated.View>
)}

          <Text
            style={[
              styles.infoDescriptionRecipe,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {routeDescription}
          </Text>
                    {showCompleteButton && (
            <TouchableOpacity
              style={styles.completeChallengeButton}
              onPress={handleShowCompleteModal}
              accessibilityRole="button"
               accessibilityLabel={t("challengeDetails.completeChallengeA11y", {
                defaultValue: "Terminer le défi",
              })}
              accessibilityHint={t("challengeDetails.completeChallengeHint", {
                defaultValue: "Ouvre l’écran de validation pour récupérer tes trophées.",
              })}
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
            
        {/* ACTIONS */}
<View style={styles.actionsWrap}>

  {/* MAIN ACTIONS */}
  <View style={styles.primaryActions}>
    {!isDuoPendingOut && (
    <Pressable
     onPress={handleInviteButtonPress}
     accessibilityRole="button"
     accessibilityLabel={t("challengeDetails.actions.inviteA11y", { defaultValue: "Invite a friend" })}
     accessibilityHint={t("challengeDetails.actions.inviteHint", { defaultValue: "Opens duo invitation for this challenge." })}
     style={({ pressed }) => [
       styles.primaryBtn,
       styles.primaryBtnInvite,
       pressed && styles.btnPressed,
     ]}
   >
     <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
       <Ionicons name="person-add-outline" size={20} color="#fff" />
     </View>

     <Text style={styles.primaryBtnText}>
       {t("challengeDetails.actions.inviteTitle")}
     </Text>

     <Ionicons name="chevron-forward" size={18} color="#fff" />
   </Pressable>
 )}


    <Pressable
      onPress={() => setShareCardVisible(true)}
       accessibilityRole="button"
  accessibilityLabel={t("challengeDetails.actions.shareA11y", { defaultValue: "Share" })}
  accessibilityHint={t("challengeDetails.actions.shareHint", { defaultValue: "Opens share options for this challenge." })}
      style={({ pressed }) => [
        styles.primaryBtn,
        styles.primaryBtnSecondary,
        pressed && styles.btnPressed,
      ]}
    >
      <Ionicons name="share-outline" size={20} color="#111" />
      <Text style={styles.primaryBtnTextSecondary}>{t("challengeDetails.actions.shareTitle")}</Text>
      <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
    </Pressable>
  </View>

  {/* QUICK ACTIONS */}
  <View style={styles.quickActions}>
    <Pressable
      onPress={handleNavigateToChat}
      disabled={!challengeTaken}
      accessibilityRole="button"
      accessibilityState={{ disabled: !challengeTaken }}
      accessibilityLabel={t("challengeDetails.quick.chatA11y", { defaultValue: "Open chat" })}
      accessibilityHint={t("challengeDetails.quick.chatHint", { defaultValue: "Opens the challenge chat." })}
      style={({ pressed }) => [
        styles.quickBtn,
        !challengeTaken && styles.quickBtnDisabled,
        pressed && styles.btnPressed,
      ]}
    >
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={18}
        color={!challengeTaken ? "rgba(0,0,0,0.35)" : undefined}
      />
      <Text
  style={styles.quickText}
  numberOfLines={1}
  ellipsizeMode="tail"
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t("challengeDetails.quick.chat")}
</Text>
    </Pressable>

    <Pressable
      onPress={handleViewStats}
      disabled={!challengeTaken}
      accessibilityRole="button"
      accessibilityState={{ disabled: !challengeTaken }}
      accessibilityLabel={t("challengeDetails.quick.statsA11y", { defaultValue: "Open stats" })}
      accessibilityHint={t("challengeDetails.quick.statsHint", { defaultValue: "Opens your progress calendar and stats." })}
      style={({ pressed }) => [
        styles.quickBtn,
        !challengeTaken && styles.quickBtnDisabled,
        pressed && styles.btnPressed,
      ]}
    >
      <Ionicons
        name="stats-chart-outline"
        size={18}
        color={!challengeTaken ? "rgba(0,0,0,0.35)" : undefined}
      />
      <Text
  style={styles.quickText}
  numberOfLines={1}
  ellipsizeMode="tail"
  adjustsFontSizeToFit
  minimumFontScale={0.85}
>
  {t("challengeDetails.quick.stats")}
</Text>
    </Pressable>

    <Pressable
  onPress={handleSaveChallenge}
  accessibilityRole="button"
  accessibilityLabel={
    savedNow
      ? t("challengeDetails.quick.savedA11y")
      : t("challengeDetails.quick.saveA11y")
  }
  accessibilityHint={t("challengeDetails.quick.saveHint")}
  style={({ pressed }) => [
    styles.quickBtn,
    pressed && styles.btnPressed,
  ]}
>
  <Ionicons
    name={savedNow ? "bookmark" : "bookmark-outline"}
    size={18}
    color={savedNow ? ACCENT.solid : undefined}
  />

  <Text
    style={[
      styles.quickText,
      savedNow && styles.quickTextActive,
    ]}
    numberOfLines={1}
    ellipsizeMode="tail"
    adjustsFontSizeToFit
    minimumFontScale={0.85}
  >
    {savedNow
      ? t("challengeDetails.quick.saved")
      : t("challengeDetails.quick.save")}
  </Text>
</Pressable>

  </View>

</View>


        </LinearGradient>
          </BlurView>
        </Animated.View>
        {/* 🆕 Lazy mount des reviews après les interactions (fluidité initiale) */}
{showReviews && (
  <ChallengeReviews
    challengeId={id}
    selectedDays={finalSelectedDays}
  />
)}
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
    onPreloadRewarded={loadRewarded}
    onShowRewarded={async () => {
      // showRewarded ne renvoie rien -> on convertit en boolean
      try {
        await showRewarded();
        return true;
      } catch {
        return false;
      }
    }}
    canShowRewarded={!!showBanners}
    rewardedReady={rewardedLoaded}
    rewardedLoading={rewardedLoading}
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
      {showBanners && !introBlocking && (
  <View
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: tabBarHeight + insets.bottom, // 👈 juste au-dessus de la TabBar + safe area
      alignItems: "center",
      backgroundColor: "transparent",
      zIndex: 9999,
      paddingBottom: 6,
    }}
    pointerEvents="box-none"
  >
    <BannerSlot onHeight={onBannerHeight} />
  </View>
)}


      <InvitationModal
  key={invitation?.id || "no-invite"}
  visible={invitationModalVisible}
  inviteId={invitation?.id || null}
  challengeId={id}
  onClose={() => {
    markInviteAsHandled(invitation?.id);
    setInvitationModalVisible(false);
  }}
  clearInvitation={() => {
    markInviteAsHandled(invitation?.id);
  }}
  // 🆕 Quand le modal a fini de charger -> on coupe l’overlay deeplink/invite
  onLoaded={() => {
    setInviteLoading(false);
    setDeeplinkBooting(false);
  }}
/>

{isHydrating && (
  <Animated.View
    // ⚠️ plus d'entering/exiting, pour éviter les soucis de hitbox fantôme
    style={styles.loadingOverlay}
    pointerEvents="none" // ✅ ne bloque PLUS JAMAIS les interactions
  >
    <BlurView
      intensity={40}
      tint={isDarkMode ? "dark" : "light"}
      style={StyleSheet.absoluteFill}
    />

    <View style={styles.loadingCard}>
      <LinearGradient
        colors={[
          currentTheme.colors.primary,
          currentTheme.colors.secondary,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingIconRing}
      >
        <View style={styles.loadingIconInner}>
          <Ionicons
            name={inviteLoading ? "people-circle-outline" : "aperture-outline"}
            size={normalizeSize(26)}
            color="#fff"
          />
        </View>
      </LinearGradient>

      <View style={styles.loadingTextBlock}>
        <ActivityIndicator
          size="small"
          color={currentTheme.colors.secondary}
          style={{ marginBottom: 8 }}
        />

        <Text
          style={[
            styles.loadingText,
            { color: currentTheme.colors.textPrimary },
          ]}
        >
          {loadingLabel}
        </Text>

        <Text
          style={[
            styles.loadingSubText,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {inviteLoading
            ? t("challengeDetails.loadingInviteHint", {
                defaultValue: "On prépare ton duo et la page du défi…",
              })
            : t("challengeDetails.loadingHint", {
                defaultValue: "Synchronisation de tes données et du défi…",
              })}
        </Text>
      </View>
    </View>
  </Animated.View>
)}


{/* ⚠️ Confirmation : passer en Duo réinitialise ta progression solo */}
<Modal
  visible={confirmResetVisible}
  transparent
  animationType="fade"
  statusBarTranslucent
  onRequestClose={() => setConfirmResetVisible(false)}
>
  <View style={styles.confirmBackdrop}>
    {/* Backdrop premium (blur + vignette) */}
    <BlurView intensity={44} tint="dark" style={StyleSheet.absoluteFill} />
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.62)"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />

    <Animated.View
      entering={FadeInUp.duration(240)}
      style={[
        styles.confirmCardKeynote,
        { marginBottom: insets.bottom + 12 },
      ]}
    >
      {/* Glass card */}
      <BlurView
        intensity={Platform.OS === "ios" ? 28 : 18}
        tint="dark"
        style={styles.confirmCardBlur}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.06)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmCardInner}
        >
          {/* Stroke interne (au lieu d’un border moche) */}
          <View pointerEvents="none" style={styles.confirmInnerStroke} />

          {/* Header: icon + title */}
          <View style={styles.confirmHeaderRow}>
            <View style={styles.confirmIconPill}>
              <LinearGradient
                colors={["rgba(255,215,0,0.22)", "rgba(0,255,255,0.16)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="people-outline" size={18} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.confirmTitleKeynote} numberOfLines={1} ellipsizeMode="tail">
                {t("invitationS.confirmReset.title", { defaultValue: "Passer en duo" })}
              </Text>
              <Text style={styles.confirmSubKeynote} numberOfLines={2} ellipsizeMode="tail">
                {t("invitationS.confirmReset.sub", {
                  defaultValue: "Tu redémarres le défi pour avancer ensemble, à égalité.",
                })}
              </Text>
            </View>
          </View>

          {/* Message card (compact, lisible) */}
          <View style={styles.confirmMessageCard}>
            <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.confirmTextKeynote}>
              {t("invitationS.confirmReset.message", {
                defaultValue:
                  "Ta progression solo sera remise à zéro sur ce défi. Ton ami commencera au même niveau.",
              })}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => setConfirmResetVisible(false)}
              style={({ pressed }) => [
                styles.confirmGhostBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.cancel", { defaultValue: "Annuler" })}
            >
              <Text style={styles.confirmGhostText}>
                {t("commonS.cancel", { defaultValue: "Annuler" })}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setConfirmResetVisible(false);
                setSendInviteVisible(true);
              }}
              style={({ pressed }) => [
                styles.confirmPrimaryBtn,
                pressed && { transform: [{ scale: 0.985 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.continue", { defaultValue: "Continuer" })}
            >
              <LinearGradient
                colors={["#FFD700", "#00FFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.confirmPrimarySheen} />
              <Text style={styles.confirmPrimaryText}>
                {t("commonS.continue", { defaultValue: "Continuer" })}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#111" />
            </Pressable>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  </View>
</Modal>



<ShareCardModal
  visible={shareCardVisible}
  onClose={() => setShareCardVisible(false)}
  challengeTitle={routeTitle || ""}
  daysCompleted={finalCompletedDays}
  totalDays={finalSelectedDays}
  isDuo={!!isDuo}
  userName={myName || ""}
  partnerName={duoChallengeData?.duoUser?.name || ""}
  userAvatar={myAvatar}
partnerAvatar={duoChallengeData?.duoUser?.avatar}
partnerDaysCompleted={duoChallengeData?.duoUser?.completedDays ?? 0}

/>


<SendInvitationModal
  visible={sendInviteVisible}
  challengeId={id}
  selectedDays={localSelectedDays}
  challengeTitle={routeTitle}
  isDuo={isDuo}
  onClose={() => setSendInviteVisible(false)}
  onSent={() => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  Alert.alert(
    t("invitationS.sentTitle", { defaultValue: "Invitation envoyée" }),
    t("invitationS.sentBody", { defaultValue: "On te prévient dès qu’il répond." })
  );
  setSendInviteVisible(false);
}}
/>


{/* === DUO INTRO — FULLSCREEN MODAL === */}
{introVisible && (
  <View pointerEvents="none" /> /* keep tree stable while Modal mounts */
)}
<Modal
  visible={introVisible}
  onRequestClose={() => setIntroVisible(false)}
  onShow={() => setIntroBlocking(true)}
  onDismiss={() => setIntroBlocking(false)}
  {...introModalProps}
>
  <Animated.View
    style={[styles.vsModalRoot, fadeStyle]}
    pointerEvents="auto"  // capture touches while showing
  >
    {/* BACKDROP: deep black with subtle gradient beams */}
    <LinearGradient
      colors={["#000000", "#050505", "#000000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={["rgba(255,215,0,0.06)", "rgba(0,0,0,0)", "rgba(0,255,255,0.06)"]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={StyleSheet.absoluteFill}
    />

    {/* CONTENT */}
    {!assetsReady ? (
      <ActivityIndicator size="large" color="#FFD700" />
    ) : (
      <View style={[styles.vsStage, { paddingHorizontal: GAP }]}>
        {/* Me */}
        <Animated.View entering={FadeInUp.duration(220)} style={[shakeStyleMy, styles.vsSide, { marginHorizontal: GAP }]}>
          <View style={styles.vsAvatarWrap}>
           <Image
  source={{ uri: myAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(myName || "You")}` }}
  style={[styles.vsAvatarXL, { width: AVA, height: AVA, borderRadius: AVA/2 }]}
  onLoad={() => { myImgReady.current = true; tryStart(); }}
  onError={() => { myImgReady.current = true; tryStart(); }}  // 👈 fail-safe
/>
            {/* glow ring */}
            <Animated.View style={[styles.vsGlowRing]} />
            {myIsPioneer && (
              <PioneerBadge size="mini" style={{ position: "absolute", bottom: -6, left: -6 }} />
            )}
          </View>
          <Text style={[styles.vsNameXL, { fontSize: IS_SMALL ? normalizeSize(16) : normalizeSize(18) }]}>
            {myName || t("duo.you")}
          </Text>
        </Animated.View>

        {/* VS badge */}
        <Animated.View entering={FadeInUp.delay(120).duration(320)} style={[styles.vsCenter, { marginHorizontal: GAP }]}>
          <LinearGradient
            colors={["#FFD700", "#00FFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vsBadgeBig}
          >
            <Text style={styles.vsBadgeText}>VS</Text>
          </LinearGradient>
        </Animated.View>

        {/* Partner */}
        <Animated.View entering={FadeInUp.duration(220)} style={[shakeStylePartner, styles.vsSide, { marginHorizontal: GAP }]}>
          <View style={styles.vsAvatarWrap}>
            <Image
  source={{ uri: partnerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(duoChallengeData?.duoUser?.name || "P")}` }}
  style={[styles.vsAvatarXL, { width: AVA, height: AVA, borderRadius: AVA/2 }]}
  onLoad={() => { partnerImgReady.current = true; tryStart(); }}
  onError={() => { partnerImgReady.current = true; tryStart(); }} // 👈 fail-safe
/>
            {/* glow ring */}
            <Animated.View style={[styles.vsGlowRing, { borderColor: "#00FFFF55", shadowColor: "#00FFFF" }]} />
            {duoChallengeData?.duoUser?.isPioneer && (
              <PioneerBadge size="mini" style={{ position: "absolute", bottom: -6, left: -6 }} />
            )}
          </View>
          <Text style={[styles.vsNameXL, { fontSize: IS_SMALL ? normalizeSize(16) : normalizeSize(18) }]}>
            {duoChallengeData?.duoUser?.name || t("duo.partner")}
          </Text>
        </Animated.View>
      </View>
    )}
  </Animated.View>
</Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ===== DUO UI: Premium Avatar + Progress Row (NO weird placeholder) =====
const getInitial = (name?: string) => {
  const n = (name || "").trim();
  return n ? n[0]!.toUpperCase() : "•";
};

const SmartAvatar = ({
  uri,
  name,
  size = 74,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) => {
  const [failed, setFailed] = React.useState(false);

  const hasUri = typeof uri === "string" && uri.trim().length > 0;
  const showImage = hasUri && !failed;

  return (
    <View
      style={[
        styles.avatarShell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri!.trim() }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
          fadeDuration={120}
        />
      ) : (
        <LinearGradient
          colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0.06)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={styles.avatarFallbackIconWrap}>
            <Ionicons
              name="person"
              size={Math.round(size * 0.34)}
              color="rgba(255,255,255,0.92)"
            />
          </View>

          <Text
            style={[
              styles.avatarInitial,
              { fontSize: Math.round(size * 0.22) },
            ]}
          >
            {getInitial(name)}
          </Text>
        </LinearGradient>
      )}

      {/* Premium ring */}
      <View
        style={[styles.avatarRing, { borderRadius: size / 2 }]}
        pointerEvents="none"
      />

      {/* Soft top highlight */}
      <View
        style={[styles.avatarSpecular, { borderRadius: size / 2 }]}
        pointerEvents="none"
      />
    </View>
  );
};

// ===== /DUO UI =====


// ✅ Keynote tokens (cohérence + rendu premium)
const R = {
  hero: normalizeSize(30),
  card: 26,
  pill: 999,
  btn: normalizeSize(22),
};

const GLASS = {
  // plus "Apple glass", moins "gaming"
  border: "rgba(255,255,255,0.14)",
  borderSoft: "rgba(255,255,255,0.10)",
  bg: "rgba(255,255,255,0.08)",
  bgSoft: "rgba(255,255,255,0.06)",
  bgDark: "rgba(10, 10, 15, 0.88)",
};

const ACCENT = {
  // or plus subtil (moins “#FFD700” brut)
  solid: "#F4D35E",
  softBorder: "rgba(244, 211, 94, 0.35)",
  softFill: "rgba(244, 211, 94, 0.16)",
  glow: "rgba(244, 211, 94, 0.55)",
};

const S = {
  // shadows plus clean (iOS) + elevation modérée (Android)
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }),
  float: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 10 },
    default: {},
  }),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  carouselContainer: { position: "relative", height: 0 },
 imageContainer: {
    width: "100%",
    borderBottomLeftRadius: R.hero,
    borderBottomRightRadius: R.hero,
    overflow: "hidden",
    marginBottom: SPACING,
    ...S.float,
  },
  confirmBackdrop: {
  flex: 1,
  justifyContent: "flex-end",
  paddingHorizontal: 16,
  paddingTop: 24,
},

confirmCardKeynote: {
  borderRadius: 28,
  overflow: "hidden",
  maxWidth: 520,
  width: "100%",
  alignSelf: "center",
  // shadow iOS
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.35,
  shadowRadius: 28,
  // elevation Android
  elevation: 22,
},

confirmCardBlur: {
  borderRadius: 28,
  overflow: "hidden",
},

confirmCardInner: {
  paddingHorizontal: 18,
  paddingTop: 18,
  paddingBottom: 14,
  borderRadius: 28,
},

confirmInnerStroke: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 28,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
},

confirmHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
},

confirmIconPill: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.22)",
  backgroundColor: "rgba(255,255,255,0.06)",
},

confirmTitleKeynote: {
  fontSize: 18,
  lineHeight: 22,
  color: "rgba(255,255,255,0.96)",
  fontFamily: "Comfortaa_700Bold",
},

confirmSubKeynote: {
  marginTop: 3,
  fontSize: 13,
  lineHeight: 17,
  color: "rgba(255,255,255,0.72)",
  fontFamily: "System",
},

confirmMessageCard: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 10,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 18,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
  marginBottom: 14,
},

confirmTextKeynote: {
  flex: 1,
  minWidth: 0,
  fontSize: 13.5,
  lineHeight: 18,
  color: "rgba(255,255,255,0.86)",
  fontFamily: "System",
},

confirmActions: {
  flexDirection: "row",
  gap: 10,
  paddingTop: 2,
},

confirmGhostBtn: {
  flex: 1,
  height: 48,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.16)",
},

confirmGhostText: {
  color: "rgba(255,255,255,0.90)",
  fontSize: 14,
  fontFamily: "Comfortaa_700Bold",
},

confirmPrimaryBtn: {
  flex: 1.2,
  height: 48,
  borderRadius: 16,
  overflow: "hidden",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
},

confirmPrimarySheen: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(255,255,255,0.18)",
  opacity: 0.0,
},

confirmPrimaryText: {
  color: "#111",
  fontSize: 14,
  fontFamily: "Comfortaa_700Bold",
},
  // ===== SmartAvatar styles (fallback premium, no octogon) =====
avatarShell: {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: "rgba(255,255,255,0.08)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
  ...S.card,
},
avatarRing: {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
},
avatarSpecular: {
  position: "absolute",
  left: "10%",
  right: "10%",
  top: "8%",
  height: "42%",
  backgroundColor: "rgba(255,255,255,0.10)",
  transform: [{ skewY: "-10deg" }],
  opacity: 0.85,
},
avatarFallbackIconWrap: {
  width: 30,
  height: 30,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.18)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
  marginBottom: 6,
},
avatarInitial: {
  fontFamily: "Comfortaa_700Bold",
  color: "rgba(255,255,255,0.92)",
  includeFontPadding: false,
},

// ===== Duo bars: make them pop more =====
duoBarTrack: {
  height: 16, // ⬅️ un peu plus épais
  borderRadius: 999,
  backgroundColor: Platform.OS === "android"
   ? "rgba(0,0,0,0.18)"
   : "rgba(255,255,255,0.10)",
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.20)",
  position: "relative",
},
duoBarTrackSheen: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(255,255,255,0.05)",
},
duoBarTicks: {
  ...StyleSheet.absoluteFillObject,
  flexDirection: "row",
  justifyContent: "space-evenly",
  alignItems: "center",
  opacity: 0.42, // ⬅️ plus visible
},
duoBarTick: {
  width: 1,
  height: "65%",
  borderRadius: 1,
  backgroundColor: Platform.OS === "android"
   ? "rgba(255,255,255,0.55)"
   : "rgba(255,255,255,0.30)",
},
duoBarFill: {
  height: "100%",
  borderRadius: 999,
},

// ===== Battle bar title =====
duoBattleTitleRow: {
  width: "100%",
  maxWidth: 560,
  marginTop: 14,
  marginBottom: 8,
  paddingHorizontal: 6,
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
},
duoBattleTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  letterSpacing: 1.4,
  opacity: 0.60,
},
duoBattleMini: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(11),
  opacity: Platform.OS === "android" ? 0.85 : 0.40
},

// ===== Battle bar: more contrast =====
duoBattleBarWrap: {
  marginTop: 0, // ⬅️ le titre gère l’espace
  width: "100%",
  maxWidth: 560,
  opacity: 1,
},
duoBattleBar: {
  width: "100%",
  height: 18,
  borderRadius: 999,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
  backgroundColor: Platform.OS === "android"
   ? "rgba(0,0,0,0.12)"
   : "rgba(255,255,255,0.10)",
  position: "relative",
},
duoBattleRail: {
  ...StyleSheet.absoluteFillObject,
  opacity: 0.65,
  backgroundColor: Platform.OS === "android"
   ? "rgba(255,255,255,0.08)"
   : "rgba(255,255,255,0.04)",
},
duoBattleDivider: {
  position: "absolute",
  left: "50%",
  top: 1,
  bottom: 1,
  width: 3,
  borderRadius: 2,
  backgroundColor: "rgba(255,255,255,0.55)",
  shadowColor: "#000",
  shadowOpacity: 0.22,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 7,
  opacity: Platform.OS === "android" ? 0.9 : 0.55,
},

  actionGrid: {
  marginTop: SPACING * 1.6,
  flexDirection: "row",
  paddingHorizontal: 12,
  flexWrap: "wrap",
  justifyContent: "center",
  rowGap: 14,
},
duoEliteWrap: {
  marginTop: SPACING * 1.6,
  alignItems: "center",
  width: "100%",
  paddingHorizontal: 12,
},
duoCrownMini: {
  position: "absolute",
  top: -10,
  right: -10,
  zIndex: 30,
},
duoCrownPill: {
  width: normalizeSize(26),
  height: normalizeSize(26),
  borderRadius: normalizeSize(13),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.55)",
  borderWidth: 1,
  borderColor: "rgba(244, 211, 94, 0.38)",
  shadowColor: ACCENT.glow,
  shadowOpacity: 0.35,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
},
duoCrownMiniEmoji: {
  fontSize: normalizeSize(14),
  includeFontPadding: false,
},
duoProgressStack: {
  width: "100%",
  maxWidth: 560,
  marginTop: 16,
  gap: 12,
},

duoBarRow: {
  width: "100%",
},

duoBarLabelRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
  gap: 10,
},

duoBarLabel: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  opacity: 0.9,
  flex: 1,
  minWidth: 0,
},

duoBarValue: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  opacity: 0.55,
  flexShrink: 0,
},
duoBarFillMe: {
  shadowColor: "#FF9F1C",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
},
duoBarFillPartner: {
  shadowColor: "#00C2FF",
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
},
duoBattleLeft: {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  backgroundColor: "#FF9F1C",
  opacity: 0.85,
},
duoBattleRight: {
  position: "absolute",
  right: 0,
  top: 0,
  bottom: 0,
  backgroundColor: "#00C2FF",
  opacity: 0.85,
},
duoBattleOutline: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.10)",
},
duoPendingShell: {
   width: "100%",
   marginTop: 12,
   gap: 10,
   alignItems: "stretch",
 },
duoEliteAvatars: {
  width: "100%",
  maxWidth: 560,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  backgroundColor: Platform.OS === "android"
  ? "rgba(255,255,255,0.10)"
  : "rgba(255,255,255,0.08)",
},
duoPendingCard: {
  borderRadius: normalizeSize(18),
  paddingVertical: 12,
  paddingHorizontal: 12,
  overflow: "hidden",
  width: "100%",
  // ✅ pas de border externe : c’est ça qui fait “gris moche”
  backgroundColor: "transparent",
  ...Platform.select({
    ios: S.card,
    android: { elevation: 6 },
    default: {},
  }),
},
duoPendingRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
duoPendingStroke: {
  position: "absolute",
  top: 1,
  left: 1,
  right: 1,
  bottom: 1,
  borderRadius: normalizeSize(17),
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(0,0,0,0.10)",
  // ✅ stroke clair en dark mode
  ...(Platform.OS === "android"
    ? {}
    : {}),
},
duoPendingLeft: {
   flex: 1,
   flexDirection: "row",
   alignItems: "center",
   minWidth: 0,
 },
duoPendingIconWrap: {
 width: 38,
   height: 38,
   borderRadius: 999,
   alignItems: "center",
   justifyContent: "center",
   backgroundColor: "rgba(0,0,0,0.22)",
   borderWidth: 1,
   borderColor: "rgba(255,255,255,0.16)",
   overflow: "hidden",
   marginRight: 12,
},
duoPendingHalo: {
   position: "absolute",
   width: 42,
   height: 42,
   borderRadius: 999,
   backgroundColor: "rgba(139,92,246,0.22)",
 },
duoPendingRing: {
  position: "absolute",
   width: 38,
   height: 38,
   borderRadius: 999,
   borderWidth: 2.5,
   borderColor: "rgba(139,92,246,0.95)",
},
duoPendingDot: {
  position: "absolute",
   width: 10,
   height: 10,
   borderRadius: 999,
   backgroundColor: "rgba(255,255,255,0.92)",
   right: 6,
   top: 6,
 borderWidth: 1,
 borderColor: "rgba(255,255,255,0.55)",

},
duoPendingTitle: {
   fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13.5),
   includeFontPadding: false,
   color: "rgba(0,0,0,0.88)",
},
duoPendingMetaRow: {
   flexDirection: "row",
   alignItems: "center",
   gap: 8,
   marginTop: 3,
 },

 duoPendingChip: {
   paddingHorizontal: 9,
   paddingVertical: 4,
   borderRadius: 999,
   backgroundColor: "rgba(99,102,241,0.16)",
  borderWidth: 1,
  borderColor: "rgba(99,102,241,0.30)",
 },
 duoPendingChipText: {
   fontFamily: "Comfortaa_700Bold",
   fontSize: 10,
   letterSpacing: 0.8,
   color: "rgba(55,48,163,0.95)",
   includeFontPadding: false,
 },
duoPendingSub: {
   flex: 1,
   fontFamily: "Comfortaa_400Regular",
   fontSize: 12,
   includeFontPadding: false,
   color: "rgba(0,0,0,0.52)",
},
duoPendingTo: {
  marginTop: 4,
   fontFamily: "Comfortaa_700Bold",
   fontSize: 12,
   includeFontPadding: false,
   color: "rgba(255,255,255,0.88)",
},
 duoPendingCancelBtn: {
   alignSelf: "flex-end",
   borderRadius: 14,
   paddingHorizontal: 14,
   paddingVertical: 10,
   borderWidth: 1,
   backgroundColor: "rgba(255,255,255,0.10)",
   borderColor: "rgba(255,255,255,0.16)",
 },
 duoPendingCancelText: {
   fontFamily: "Comfortaa_700Bold",
   fontSize: normalizeSize(11.5),
   includeFontPadding: false,
   color: "rgba(255,255,255,0.92)",
 },
duoEliteCol: {
  alignItems: "center",
   flex: 1,
  minWidth: 0,
},
duoAvatarWrap: {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
},
duoEliteAvatar: {
  width: "100%",
  height: "100%",
  borderRadius: normalizeSize(37),
  borderWidth: 1.5,
  borderColor: "rgba(255,255,255,0.22)",
  backgroundColor: "rgba(255,255,255,0.08)",
  ...S.card,
},

duoEliteName: {
  marginTop: 8,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  opacity: 0.92,
  maxWidth: "100%",
},
duoVsPill: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: "rgba(255,255,255,0.06)",
},
duoVs: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  letterSpacing: 1.6,
  opacity: 0.55,
  includeFontPadding: false,
},
crownElite: {
  position: "absolute",
  top: -18,
  zIndex: 10,
},
duoAvatarShell: {
  position: "relative",
  width: normalizeSize(74),
  height: normalizeSize(74),
  borderRadius: normalizeSize(37),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: Platform.OS === "android"
  ? "rgba(255,255,255,0.10)"
  : "rgba(255,255,255,0.08)",
},
duoEliteBar: {
  marginTop: 16,
  width: "100%",
  maxWidth: 360,
  height: 10,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.14)",
  overflow: "hidden",
},
duoCrownGlow: {
  shadowColor: "#FF9F1C",
  shadowOpacity: 0.9,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
},

duoEliteFill: {
  height: "100%",
  borderRadius: 999,
},

duoEliteStatus: {
  marginTop: 12,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(18),
  opacity: 0.9,
  textAlign: "center",
  paddingHorizontal: 10,
},
duoEliteSubStatus: {
  marginTop: 4,
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(12),
  color: "rgba(255,255,255,0.72)",
  textAlign: "center",
  paddingHorizontal: 10,
},
actionsWrap: {
  marginTop: 24,
  paddingHorizontal: 16,
},


primaryActions: {
  gap: 12,
},

primaryBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 18,
  height: 56,
  borderRadius: 18,
},

primaryBtnInvite: {
  backgroundColor: "#6366F1",
 borderWidth: 1,
 borderColor: "rgba(255,255,255,0.22)",
},

primaryBtnSecondary: {
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.12)",
},

primaryBtnText: {
  flex: 1,
  marginLeft: 12,
  fontSize: 16,
  fontFamily: "Comfortaa_700Bold",
  color: "#fff",
},
quickTextActive: {
  color: ACCENT.solid,
},
confirmIconWrap: {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: ACCENT.solid,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
},
duoStatusBig: {
  marginTop: 14,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(18),
},
primaryBtnTextSecondary: {
  flex: 1,
  marginLeft: 12,
  fontSize: 16,
  fontFamily: "Comfortaa_700Bold",
  color: "#111",
},
duoKeynoteWrap: {
  marginTop: SPACING * 1.4,
  alignItems: "center",
},
duoAvatarFallback: {
  width: "100%",
  height: "100%",
  borderRadius: normalizeSize(37),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: Platform.OS === "android"
   ? "#FFFFFF"
   : "rgba(255,255,255,0.08)",
},

duoAvatarInitial: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(22),
  color: "rgba(255,255,255,0.92)",
  includeFontPadding: false,
},

duoAvatarRing: {
  position: "absolute",
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  borderRadius: normalizeSize(37),
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
},
duoKeynoteAvatars: {
  flexDirection: "row",
  gap: 48,
  marginBottom: 16,
},

duoKeynoteAvatarCol: {
  alignItems: "center",
},

duoKeynoteAvatar: {
  width: normalizeSize(64),
  height: normalizeSize(64),
  borderRadius: normalizeSize(32),
},

duoKeynoteName: {
  marginTop: 8,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  opacity: 0.85,
},

duoKeynoteTrack: {
  width: "100%",
  maxWidth: 360,
  height: 8,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.12)",
  overflow: "hidden",
  marginTop: 6,
},

duoKeynoteFill: {
  height: "100%",
  borderRadius: 999,
  backgroundColor: ACCENT.solid,
},

duoKeynoteStatus: {
  marginTop: 12,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(15),
  opacity: 0.85,
},

duoLeading: {
  color: ACCENT.solid,
},

duoBehind: {
  color: "#FF6B6B",
},

crownPulse: {
  position: "absolute",
  top: -14,
  zIndex: 2,
},

quickActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 14,
},
quickBtn: {
  flex: 1,
  minWidth: 0, // CRUCIAL pour éviter que le Text force la largeur
  height: 48,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.12)",
  backgroundColor: "rgba(255,255,255,0.86)",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 10, // un poil moins
  gap: 6,
},

quickText: {
  flexShrink: 1, // CRUCIAL
  fontSize: 12.5, // stable
  fontFamily: "Comfortaa_700Bold",
},

btnPressed: {
  transform: [{ scale: 0.98 }],
  opacity: 0.9,
},

  image: {
    width: "100%",
    backfaceVisibility: "hidden",
    borderBottomLeftRadius: R.hero,
    borderBottomRightRadius: R.hero,
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
    // on laisse le fond transparent, c’est le BlurView qui gère le rendu
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
ctaRow: {
  flexDirection: "row",
  gap: 12,
  paddingHorizontal: 16,
  marginTop: 10,
  marginBottom: 6,
},

ctaCard: {
  flex: 1,
  borderRadius: 22,
  overflow: "hidden",
  minHeight: 118,               // <<< le “poids” Keynote
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
},

pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

ctaGradient: {
  flex: 1,
  paddingHorizontal: 14,
  paddingTop: 14,
  paddingBottom: 12,
},
quickBtnDisabled: {
    opacity: 0.55,
  },

ctaPlain: {
  flex: 1,
  backgroundColor: "#fff",
  paddingHorizontal: 14,
  paddingTop: 14,
  paddingBottom: 12,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.07)",
},

ctaTop: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
},

ctaIconWrap: {
  width: 38,
  height: 38,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.22)",
},

ctaIconWrapPlain: {
  backgroundColor: "rgba(0,0,0,0.06)",
},
dockCardShareOutline: {
  borderWidth: 1.5,
  borderColor: Platform.select({
    ios: "rgba(255,255,255,0.22)",
    android: "rgba(255,255,255,0.24)",
    default: "rgba(255,255,255,0.22)",
  }) as any,
},


dockHeaderCenteredRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 8,
},

dockHeaderSideSlot: {
  width: 44, // ⬅️ clé du centrage parfait
  alignItems: "center",
  justifyContent: "center",
},

dockHeaderRightSlot: {
  alignItems: "flex-end",
},

dockHeaderCenterSlot: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
},



ctaTitle: {
  color: "#fff",
  fontSize: 16,
  lineHeight: 20,
  fontFamily: "Comfortaa_700Bold",
},

ctaSub: {
  marginTop: 6,
  color: "rgba(255,255,255,0.92)",
  fontSize: 12.5,
  lineHeight: 16,
  fontFamily: "Comfortaa_400Regular",
},

ctaTitlePlain: { color: "#111" },
ctaSubPlain: { color: "rgba(0,0,0,0.62)" },

ctaFooter: {
  marginTop: "auto",
  paddingTop: 10,
},
// === DOCK (Apple Keynote) ===
dockWrap: {
  marginTop: SPACING * 1.6,
  alignSelf: "center",
  width: "100%",
  maxWidth: 760,
  paddingHorizontal: 12,
},

dockBlur: {
  borderRadius: 26,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: GLASS.border,
  ...S.float,
},

dockInner: {
  padding: 12,
  borderRadius: 26,
},

dockTopRow: {
  flexDirection: "row",
  gap: 12,
},

dockTopRowCompact: {
  flexDirection: "column",
},

dockCard: {
  flex: 1,
  borderRadius: 22,
  overflow: "hidden",
  alignItems: "center",
  minHeight: 116,
},

dockCardPrimary: {
  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }),
},

dockCardGlass: {
  borderWidth: 1,
  borderColor: GLASS.borderSoft,
  backgroundColor: Platform.select({
    ios: "rgba(255,255,255,0.06)",
    android: "rgba(255,255,255,0.08)",
  }) as any,
},

dockCardDisabled: {
  opacity: 0.82,
},

dockPressed: {
  transform: [{ scale: 0.992 }],
  opacity: 0.94,
},

dockCardFill: {
  flex: 1,
  paddingHorizontal: 14,
  paddingTop: 14,
  paddingBottom: 12,
},

dockDisabledVeil: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.20)",
},

dockCardGlassInner: {
  flex: 1,
  paddingHorizontal: 14,
  paddingTop: 14,
  paddingBottom: 12,
},

dockCardHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
},

dockRightBits: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},

dockIconPill: {
  width: 38,
  height: 38,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.20)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
},

dockIconPillGlass: {
  backgroundColor: "rgba(0,0,0,0.06)",
  borderColor: "rgba(0,0,0,0.10)",
},

dockMiniPill: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.18)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
},

dockMiniPillText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: 11,
  color: "#fff",
  includeFontPadding: false,
},

dockMiniPillGlass: {
  backgroundColor: "rgba(0,0,0,0.06)",
  borderColor: "rgba(0,0,0,0.10)",
},

dockMiniPillTextGlass: {
  color: "rgba(0,0,0,0.70)",
},

dockTitlePrimary: {
  color: "#fff",
  fontSize: 16,
  lineHeight: 20,
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},

dockSubPrimary: {
  marginTop: 6,
  color: "rgba(255,255,255,0.90)",
  fontSize: 12.5,
  lineHeight: 16,
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},

dockTitleGlass: {
  fontSize: 16,
  lineHeight: 20,
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},

dockSubGlass: {
  marginTop: 6,
  fontSize: 12.5,
  lineHeight: 16,
  fontFamily: "Comfortaa_400Regular",
  includeFontPadding: false,
},

dockQuickRow: {
  marginTop: 12,
  flexDirection: "row",
  gap: 10,
},

dockQuickBtn: {
  flex: 1,
  minHeight: 54,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: GLASS.borderSoft,
  backgroundColor: Platform.select({
    ios: "rgba(255,255,255,0.06)",
    android: "rgba(255,255,255,0.08)",
    default: "rgba(255,255,255,0.06)",
  }) as any,
},

dockQuickDisabled: {
  opacity: 0.55,
},

dockQuickPressed: {
  transform: [{ scale: 0.988 }],
  opacity: 0.92,
},

dockQuickIcon: {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.06)",
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.10)",
  marginBottom: 6,
},

dockQuickText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(11),
  includeFontPadding: false,
},

ctaPill: {
  alignSelf: "flex-start",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.22)",
},

ctaPillText: {
  color: "#fff",
  fontSize: 11,
  fontFamily: "Comfortaa_700Bold",
},

ctaPillPlain: { backgroundColor: "rgba(0,0,0,0.06)" },
ctaPillTextPlain: { color: "rgba(0,0,0,0.72)" },

  loadingCard: {
    minWidth: 260,
    maxWidth: 320,
    borderRadius: R.card,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.bgDark,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    ...S.float,
    overflow: "hidden",
  },

  loadingIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  loadingIconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingTextBlock: {
    alignItems: "center",
  },
heroVignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  loadingSubText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
backButtonContainer: {
    position: "absolute",
    // la valeur sera surchargée à l’usage avec insets.top
    top: 0,
    left: SPACING,
    zIndex: 50,        // plus haut que tout le reste
    elevation: 50,
    pointerEvents: "box-none",
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
backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: "rgba(0,0,0,0.16)",
    ...S.card,
  },
  backButtonPress: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
confirmCard: {
  width: "100%",
  maxWidth: 380,
  borderRadius: 18,
  padding: 18,
  backgroundColor: GLASS.bgDark,
  borderWidth: 1,
  borderColor: GLASS.border,
  ...S.float,

},
confirmTitle: {
  fontSize: 18,
  fontWeight: "700",
  color: "#fff",
  marginBottom: 8,
  textAlign: "center",
},
confirmText: {
  fontSize: 14,
  color: "#ddd",
  lineHeight: 20,
  textAlign: "center",
},
confirmRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 16,
},
confirmBtn: {
  flex: 1,
  paddingVertical: 12,
 borderRadius: 14,
  alignItems: "center",
},
confirmBtnCancel: {
 backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  marginRight: 8,
},
confirmBtnOk: {
  backgroundColor: ACCENT.solid,
  marginLeft: 8,
},
confirmBtnCancelText: {
  color: "#fff",
  fontWeight: "600",
},
confirmBtnOkText: {
  color: "#000",
  fontWeight: "700",
},
scrollPad: { paddingBottom: SPACING },
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
  backgroundColor: "rgba(0,0,0,0.94)",
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
  borderColor: ACCENT.solid,
  shadowColor: ACCENT.glow,
  shadowOpacity: 0.22,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 7,
},
vsModalRoot: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "#000", // hard black base, then gradients on top
  justifyContent: "center",
  alignItems: "center",
  zIndex: 99999,
},

vsStage: {
  width: "100%",
  maxWidth: 820,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},

vsAvatarWrap: {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
},

vsGlowRing: {
  position: "absolute",
  width: normalizeSize(138),
  height: normalizeSize(138),
  borderRadius: normalizeSize(69),
  borderWidth: 2,
  borderColor: ACCENT.softBorder,
  shadowColor: ACCENT.glow,
  shadowOpacity: 0.26,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  opacity: 0.85,
},

vsBadgeBig: {
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 999,
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
},

vsBadgeText: {
  color: "#000",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(18),
  letterSpacing: 2,
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
  color: ACCENT.solid,
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
  borderWidth: 1,
  margin: 4, // remplace le gap du parent
},
chipDark: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.16)",
  },
  chipLight: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderColor: "rgba(0,0,0,0.08)",
  },
chipText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  marginLeft: 6, // remplace le gap interne
  includeFontPadding: false,
},
duoCard: {
  marginTop: SPACING * 1.4,
  paddingVertical: SPACING * 1.2,
  paddingHorizontal: SPACING,
  borderRadius: normalizeSize(24),
},
  duoTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(16),
  },
  duoLeadBanner: {
  alignSelf: "center",
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 999,
},
  duoLeadText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    letterSpacing: 0.3,
  },
  duoHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: SPACING,
},
duoRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACING * 1.4,
},
duoRowCompact: {
  flexDirection: "column",
  alignItems: "stretch",
  gap: SPACING,
},

duoSide: {
  flex: 1,
  alignItems: "center",
  // ✅ NEW: sur très petit écran, on force la pleine largeur pour les barres
  width: "100%",
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
  width: normalizeSize(64),
  height: normalizeSize(64),
  borderRadius: normalizeSize(32),
  borderWidth: 0, // ⛔️ stop bordures
},
duoName: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(14),
  maxWidth: normalizeSize(160), // ✅ un peu plus large
  textAlign: "center",
},
  pulseCircle: {
    position: "absolute",
    width: normalizeSize(68),
    height: normalizeSize(68),
    borderRadius: normalizeSize(34),
    borderWidth: 2,
    opacity: 0.18,
  },
  miniBarBg: {
  width: "90%",
  height: 6,
  borderRadius: 3,
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
  justifyContent: "center",
},

// ✅ NEW: en compact, on ne “vole” pas de largeur ; on met VS avec marge verticale
vsWrapCompact: {
  width: "100%",
  paddingVertical: 6,
},
vsBadge: {
  paddingVertical: 4,
  paddingHorizontal: 10,
  opacity: 0.35,
},
// ✅ NEW: badge plus visible en compact
vsBadgeCompact: {
  alignSelf: "center",
  paddingVertical: 8,
  paddingHorizontal: 16,
},
vsText: {
  fontSize: normalizeSize(11),
  letterSpacing: 1,
},
// ✅ NEW: texte un poil plus grand sur compact pour compenser la verticalité
vsTextCompact: {
  fontSize: normalizeSize(14),
},
  noImageText: {
    marginTop: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  heroCardWrap: {
    width: "100%",
    paddingHorizontal: SPACING * 1.2,
    marginTop: -normalizeSize(26), // chevauche le hero (Keynote)
  },
  heroCardBlur: {
    borderRadius: R.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GLASS.border,
    ...S.float,
  },
  heroCardInner: {
    borderRadius: R.card,
    paddingHorizontal: SPACING * 1.2,
    paddingTop: SPACING * 1.1,
    paddingBottom: SPACING * 1.25,
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
progressSection: {
    alignItems: "center",       // on centre le contenu de la section, pas tout l’écran
    paddingHorizontal: SPACING,
    paddingTop: SPACING,
    width: "100%",              // ✅ garantit la pleine largeur (évite les chevaucher)
   maxWidth: 560,
   alignSelf: "center",
  },
  takeChallengeButton: {
    borderRadius: R.btn,
    overflow: "hidden",
    marginTop: SPACING,
    ...S.card,
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
    includeFontPadding: false,
  },
  markTodayButton: {
    borderRadius: R.btn,
    overflow: "hidden",
    marginTop: SPACING,
    ...S.card,
  },
  markTodayButtonGradient: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.btn,
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
    width: "100%",        // prend la largeur dispo
    maxWidth: 480,        // borne haute élégante
    minWidth: 220,
    alignSelf: "center",
    zIndex: 0,
    height: normalizeSize(10),
    borderRadius: normalizeSize(5),
    overflow: "hidden",
    marginTop: SPACING,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",

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
    includeFontPadding: false,
    marginTop: SPACING * 2,
    marginHorizontal: SPACING,
    lineHeight: normalizeSize(22),
    fontFamily: "Comfortaa_400Regular",
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
   borderColor: ACCENT.solid,
  },
});

