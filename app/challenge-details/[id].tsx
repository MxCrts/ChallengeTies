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
  StatusBar,
  InteractionManager,
  Platform,
  AccessibilityInfo,
  Modal,
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
  serverTimestamp,
} from "firebase/firestore";
import { useRewardedDetailsAd } from "./_feature/hooks/useRewardedDetailsAd";
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
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import type { ViewStyle } from "react-native";
import PioneerBadge from "@/components/PioneerBadge";
import BannerSlot from "@/components/BannerSlot";
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
  FadeInUp,
  FadeIn,
 } from "react-native-reanimated";
 import { BlurView } from "expo-blur";
import SendInvitationModal from "@/components/SendInvitationModal";
import * as Haptics from "expo-haptics";
import { bumpCounterAndMaybeReview } from "../../src/services/reviewService"
import { recordSelectDays, recordDailyGlobalMark, incStat } from "../../src/services/metricsService";
import NetInfo from "@react-native-community/netinfo";
import { canInvite } from "../../utils/canInvite";
import { useAuth } from "@/context/AuthProvider"; 
import ShareCardModal from "@/components/ShareCardModal";
import SelectModeModal from "@/components/SelectModeModal";
import ConfirmationDuoModal from "@/components/ConfirmationDuoModal";
import DuoMomentModal from "@/components/DuoMomentModal";
import SoloMomentModal from "@/components/SoloMomentModal";
import OrbBackground from "./_feature/components/OrbBackground";
import SmartAvatar from "./_feature/components/SmartAvatar";
import { styles } from "./_feature/challengeDetails.styles";
import {
  IS_SMALL,
  SPACING,
  normalizeSize,
  introModalProps,
  dayIcons,
  ACCENT,
} from "./_feature/challengeDetails.tokens";
import {
  deriveDuoInfoFromUniqueKey,
  type RawChallengeEntry,
} from "./_feature/utils/deriveDuoInfoFromUniqueKey";
export { deriveDuoInfoFromUniqueKey } from "./_feature/utils/deriveDuoInfoFromUniqueKey";
import { useSafeBack } from "./_feature/hooks/useSafeBack";
import { useActiveChallengeEntry } from "./_feature/hooks/useActiveChallengeEntry";
import { usePartnerDuoSnapshot } from "./_feature/hooks/usePartnerDuoSnapshot";
import { resolveAvatarUrl as resolveAvatarUrlUtil } from "./_feature/utils/resolveAvatarUrl";
import { useInvitesInbox } from "./_feature/hooks/useInvitesInbox";
import { useOutgoingInvite } from "./_feature/hooks/useOutgoingInvite";
import { useInviteAcceptSync } from "./_feature/hooks/useInviteAcceptSync";
import { useInviteHandoff } from "./_feature/hooks/useInviteHandoff";
import { useStartFlow } from "./_feature/hooks/useStartFlow";
import { useBootOverlay } from "./_feature/hooks/useBootOverlay";
import { useMomentGate } from "./_feature/hooks/useMomentGate";
import DebugHUD from "@/components/DebugHUD";
import { dlog } from "@/src/utils/debugLog";

const hapticTap = () => {
  Haptics.selectionAsync().catch(() => {});
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
// ✅ outside ChallengeDetails (top-level in file)
type DuoAvatarProps = { uri?: string | null; name?: string; isDarkMode: boolean; styles: any };

export const DuoAvatar = React.memo(function DuoAvatar({
  uri,
  name,
  isDarkMode,
  styles,
}: DuoAvatarProps) {
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
          <Text style={styles.duoAvatarInitial}>{getInitials(name)}</Text>
        </LinearGradient>
      )}
      <View style={styles.duoAvatarRing} pointerEvents="none" />
    </View>
  );
});

type PendingPartnerAvatarProps = {
  isDarkMode: boolean;
  duoPendingPulseStyle: any;
  styles: any;
};

export const PendingPartnerAvatar = React.memo(function PendingPartnerAvatar({
  isDarkMode,
  duoPendingPulseStyle,
  styles,
}: PendingPartnerAvatarProps) {
  return (
    <View style={styles.duoAvatarShell}>
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(0,255,255,0.14)", "rgba(255,215,0,0.10)"]
            : ["rgba(55,48,163,0.14)", "rgba(0,0,0,0.06)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.duoAvatarFallback}
      >
        <Ionicons
          name="person-outline"
          size={26}
          color={isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)"}
        />
        <View style={styles.duoPendingMiniBadge}>
          <Ionicons
            name="hourglass-outline"
            size={12}
            color={isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)"}
          />
        </View>
      </LinearGradient>

      <Animated.View
        pointerEvents="none"
        style={[styles.duoPendingRing, duoPendingPulseStyle]}
      />
      <View style={styles.duoAvatarRing} pointerEvents="none" />
    </View>
  );
});

export default function ChallengeDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width: W, height: H } = useWindowDimensions();
  const isTablet = W >= 700;
  const heroH = useMemo(
    () => Math.max(240, Math.round(H * 0.35)),
    [H]
  );
  const titleLines = isTablet ? 2 : 3;
  const [marking, setMarking] = useState(false);
  const [pendingOutLock, setPendingOutLock] = useState(false);
  const [duoMomentPayload, setDuoMomentPayload] = useState<any>(null);
  const [missedChallengeVisible, setMissedChallengeVisible] = useState(false);
  const [soloBarWidth, setSoloBarWidth] = useState(0);
  const [activeEntry, setActiveEntry] = useState<any>(null);
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
const [duoMomentVisible, setDuoMomentVisible] = useState(false);
const [soloMomentVisible, setSoloMomentVisible] = useState(false);
const [soloMomentDayIndex, setSoloMomentDayIndex] = useState(0);
const [soloMomentTotalDays, setSoloMomentTotalDays] = useState(0);
const [soloMomentStreak, setSoloMomentStreak] = useState<number | undefined>(undefined);
const [soloMomentVariant, setSoloMomentVariant] = useState<"daily" | "milestone">("daily");
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
    const DUO = useMemo(() => {
    const bgSoft = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
    const bgCard = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)";
    const stroke = isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)";
    const strokeSoft = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)";
    const text = isDarkMode ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.86)";
    const textSoft = isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.56)";
    const textFaint = isDarkMode ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.42)";
    return {
      bgSoft,
      bgCard,
      stroke,
      strokeSoft,
      text,
      textSoft,
      textFaint,
      track: isDarkMode ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.06)",
      trackStroke: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)",
      tick: isDarkMode ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.14)",
      sheen: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.70)",
    };
  }, [isDarkMode]);

  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
  const justJoinedRef = useRef(false);
  const cleanupSoloRef = useRef(false);
  const [confirmResetVisible, setConfirmResetVisible] = useState(false);
  const [warmupToast, setWarmupToast] = useState<null | "success" | "error">(null);
  const [sendInviteVisible, setSendInviteVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [adHeight, setAdHeight] = useState(0);
  // 🆕 callback stable pour éviter un re-render en boucle quand BannerSlot mesure
  const onBannerHeight = useCallback((h: number) => {
    setAdHeight((prev) => (prev === h ? prev : h));
  }, []);

// --- Reanimated shared values
const warmupToastSV = useSharedValue(0); // 0 hidden, 1 shown
const warmupToastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const warmupToastStyle = useAnimatedStyle(() => {
  // 0 -> 1 : opacity 0..1, translateY 18..0
  const opacity = interpolate(warmupToastSV.value, [0, 1], [0, 1]);
  const translateY = interpolate(warmupToastSV.value, [0, 1], [18, 0]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}, []);
const hideWarmupToast = useCallback(() => {
  // stop timer
  if (warmupToastHideTimer.current) {
    clearTimeout(warmupToastHideTimer.current);
    warmupToastHideTimer.current = null;
  }

  warmupToastSV.value = withTiming(0, { duration: 180 }, (finished) => {
    if (finished) {
      runOnJS(setWarmupToast)(null);
    }
  });
}, [warmupToastSV]);

const showWarmupToast = useCallback(
  (type: "success" | "error") => {
    // cancel previous hide timer
    if (warmupToastHideTimer.current) {
      clearTimeout(warmupToastHideTimer.current);
      warmupToastHideTimer.current = null;
    }

    setWarmupToast(type);

    // animate in
    warmupToastSV.value = 0;
    warmupToastSV.value = withSpring(1, {
      damping: 16,
      stiffness: 220,
      mass: 0.7,
    });

    // auto hide
    const hideDelay = type === "success" ? 1200 : 1600;
    warmupToastHideTimer.current = setTimeout(() => {
      hideWarmupToast();
    }, hideDelay);
  },
  [hideWarmupToast, warmupToastSV]
);

useEffect(() => {
  return () => {
    if (warmupToastHideTimer.current) clearTimeout(warmupToastHideTimer.current);
  };
}, []);

  // ✅ WARMUP (duo pending) — 1/jour/challenge (dans users/{uid})
const [warmupLoading, setWarmupLoading] = useState(false);
const [warmupDoneToday, setWarmupDoneToday] = useState(false);

const warmupDayKeyLocal = useCallback(() => {
  // clé locale stable : YYYY-MM-DD
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}, []);

  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      const off = s.isConnected === false || s.isInternetReachable === false;
      setIsOffline(!!off);
    });
    return () => sub();
  }, []);

  const router = useRouter();

  const { handleSafeBack } = useSafeBack({
  router,
  isDeeplink: () => !!cameFromDeeplinkRef.current,
  fallbackRoute: "/",
});

  // pulse subtil autour de l'avatar du leader
  const leaderPulse = useSharedValue(0);
  const duoPendingPulse = useSharedValue(0);
const startedRef = useRef(false);
const myImgReady = useRef(false);
const partnerImgReady = useRef(false);
const tabBarHeight = 0;
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

 const autoSendInviteOnceRef = useRef(false);
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

  // Refs pour éviter les closures stale (events -> ouverture MomentModal)
  // ---------------------------------------------------------------------------
  const activeEntryRef = useRef<any>(null);
  const finalSelectedDaysRef = useRef<number>(0);
  const isDuoRef = useRef<boolean>(false);
  const duoChallengeDataRef = useRef<any>(null);
  const cameFromDeeplinkRef = useRef(false);
  const myNameRef = useRef<string>("");

  useEffect(() => {
    activeEntryRef.current = activeEntry;
  }, [activeEntry]);

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

 const enteringBack = useMemo(
  () => (firstMountRef.current && shouldEnterAnim ? FadeInUp : undefined),
  [shouldEnterAnim]
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
const [introBlocking, setIntroBlocking] = useState(false);
const fadeOpacity = useSharedValue(1); 
const shakeMy = useSharedValue(0);
const shakePartner = useSharedValue(0);
const [shareCardVisible, setShareCardVisible] = useState(false);
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

  const QUICK_TEXT = "#0B0B10";                 // lisible sur glass blanc
const QUICK_TEXT_DISABLED = "rgba(11,11,16,0.45)";
const QUICK_SHADOW = "rgba(255,255,255,0.65)";
const QUICK_ICON = "#0B0B10";
const QUICK_ICON_DISABLED = "rgba(11,11,16,0.35)";
const QUICK_ACTIVE = ACCENT.solid;
const QUICK_ACTIVE_SHADOW = "rgba(0,0,0,0.20)";

const {
  rewardedLoaded,
  rewardedLoading,
  rewardedShowing,
  loadRewarded,
  showRewarded,
  rewardedAdUnitId,
} = useRewardedDetailsAd({
  showBanners,
  completionModalVisible,
  t,
  onClaim: () => claimWithAdRef.current?.().catch(() => {}),
});

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
 const isDuoPendingOut = (!isDuo) && (pendingOutLock || !!outgoingPendingInvite?.id);

 const { handleCancelPendingInvite } = useOutgoingInvite({
  id,
  pendingOutLock,
  setPendingOutLock,
  outgoingPendingInvite,
  setOutgoingPendingInvite,
  isDuoPendingOut,
  t,
});

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
const warmupDisabled = warmupDoneToday || warmupLoading;

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

const confirmSwitchToDuo = useCallback(async () => {
  try {
    setConfirmResetVisible(false);


    // puis ouvre le flow d'invite
    setSendInviteVisible(true);
  } catch (e) {
    console.warn("confirmSwitchToDuo failed:", e);
    Alert.alert(
      t("alerts.error"),
      t("invitationS.errors.unknown", { defaultValue: "Erreur inconnue." })
    );
  }
}, [t]);

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

useEffect(() => {
    finalSelectedDaysRef.current = finalSelectedDays;
  }, [finalSelectedDays]);

  useEffect(() => {
    isDuoRef.current = !!isDuo;
  }, [isDuo]);

  useEffect(() => {
    duoChallengeDataRef.current = duoChallengeData;
  }, [duoChallengeData]);

  useEffect(() => {
    myNameRef.current = myName || "";
  }, [myName]);

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

const resolveAvatarUrl = useCallback(
  async (raw?: string) => resolveAvatarUrlUtil(storage, raw),
  [storage]
);

const {
  deeplinkBooting,
  inviteLoading,
  inviteModalReady,
  invitationModalVisible,
  invitation,

  setDeeplinkBooting,
  setInviteLoading,
  setInviteModalReady,
  setInvitationModalVisible,
  setInvitation,

  processedInviteIdsRef,
  suppressInboxInvitesRef,

  closeInviteFlow,
  hideRootInviteHandoff,
} = useInviteHandoff({
  id,
  paramsInvite: params?.invite,
  paramsId: params?.id,
  router,
  cameFromDeeplinkRef,
});

const forceCloseInviteUI = useCallback((inviteId?: string | null) => {
  dlog("forceCloseInviteUI()", { inviteId, invitationModalVisible, inviteLoading, deeplinkBooting, inviteModalReady });

  // 1) ferme le flow côté hook
  try { closeInviteFlow(inviteId ?? undefined); } catch {}

  // 2) hard reset local : si un state reste coincé dans le hook, on le tue ici
  try { setInvitationModalVisible(false); } catch {}
  try { setInvitation(null as any); } catch {}

  try { setInviteLoading(false); } catch {}
  try { setDeeplinkBooting(false); } catch {}
  try { setInviteModalReady(false); } catch {}
  try { hideRootInviteHandoff(); } catch {}
}, [
  closeInviteFlow,
  hideRootInviteHandoff,
  setDeeplinkBooting,
  setInviteLoading,
  setInviteModalReady,
  setInvitation,
  setInvitationModalVisible,
]);


useEffect(() => {
  if (!isHydrating) return;
  if (deeplinkBooting) return;

  const timeout = setTimeout(() => {
    // Hard fail-safe : on coupe le chargement si Firestore traîne
    setLoading(false);
  }, 2500);

  return () => clearTimeout(timeout);
}, [isHydrating, deeplinkBooting]);

useInvitesInbox({
  id,
  processedInviteIdsRef,
  suppressInboxInvitesRef,
  setInvitation,
  setInviteModalReady,
  setInvitationModalVisible,
});

useActiveChallengeEntry({
  id,
  currentChallenge,
  duoState,
  finalSelectedDays,
  localSelectedDays,
  setWarmupDoneToday,
  setActiveEntry,
  setDuoState,
  setFinalSelectedDays,
  setFinalCompletedDays,
  cleanupSoloRef,
  warmupDayKeyLocal,
});

usePartnerDuoSnapshot({
  id,
  duoState,
  t,
  resolveAvatarUrl,
  setPartnerAvatar,
  setDuoChallengeData,
});

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
    },
    (error) => {
      console.error("❌ Erreur récupération défi :", error);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [id, t]);

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

useInviteAcceptSync({ id, resetSoloProgressIfNeeded });

const handleWarmupPress = useCallback(async () => {
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;

  // 🔒 Pour l’instant: warmup uniquement utile si pending out
  if (!isDuoPendingOut) return;

  // ✅ lock UI
  if (warmupLoading || warmupDoneToday) return;

  setWarmupLoading(true);

  try {
    const dayKey = warmupDayKeyLocal();
    const userRef = doc(db, "users", uid);

    // ✅ Transaction idempotente + compatible rules (updatedAt)
    const didWrite = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) return false;

      const data = snap.data() as any;

      // New: warmup / Legacy: warmups
      const warmupNew = (data?.warmup ?? {}) as Record<string, any>;
      const warmupLegacy = (data?.warmups ?? {}) as Record<string, any>;

      const already =
        !!warmupNew?.[dayKey]?.[id] ||
        !!warmupLegacy?.[dayKey]?.[id];

      if (already) return false;

      const entry = {
        challengeId: id,
        dayKey,
        createdAt: serverTimestamp(),
      };

      tx.update(userRef, {
        // crée automatiquement warmup si absent
        [`warmup.${dayKey}.${id}`]: entry,

        // compteur global simple
        warmupCount: increment(1),

        // ✅ crucial pour tes rules
        updatedAt: serverTimestamp(),
      });

      return true;
    });

    // ✅ Si déjà enregistré (idempotent), on ne spam pas l’UI.
    if (!didWrite) {
      setWarmupDoneToday(true);
      return;
    }

    setWarmupDoneToday(true);

    // Feedback premium
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showWarmupToast("success");
  } catch (e) {
    console.error("❌ warmup failed:", e);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    showWarmupToast("error");

    // Option: garde l’Alert seulement si tu veux un fallback explicite
    Alert.alert(
      t("alerts.error", { defaultValue: "Erreur" }),
      t("duo.pending.warmupError", {
        defaultValue: "Impossible d’enregistrer le warmup.",
      })
    );
  } finally {
    setWarmupLoading(false);
  }
}, [
  id,
  isDuoPendingOut,
  warmupLoading,
  warmupDoneToday,
  warmupDayKeyLocal,
  t,
  showWarmupToast,
]);

const activeSelectedDays = useMemo(() => {
  const n = Number(activeEntry?.selectedDays ?? finalSelectedDays ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}, [activeEntry?.selectedDays, finalSelectedDays]);

const activeCompletedDays = useMemo(() => {
  const raw = activeEntry?.completedDays;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (Array.isArray(activeEntry?.completionDates)) return activeEntry.completionDates.length;
  return finalCompletedDays ?? 0;
}, [activeEntry?.completedDays, activeEntry?.completionDates, finalCompletedDays]);

const progressRatio = useMemo(() => {
  return activeSelectedDays > 0 ? Math.min(1, activeCompletedDays / activeSelectedDays) : 0;
}, [activeCompletedDays, activeSelectedDays]);

  const isSavedChallenge = useCallback((challengeId: string) => savedIds.has(challengeId), [savedIds]);

  const savedNow =
  pendingFavorite !== null
    ? pendingFavorite
    : isSavedChallenge(id);

const completions = useMemo(
  () => currentChallenge?.completionDates || [],
  [currentChallenge?.completionDates]
);

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
  challengeTakenOptimistic &&
  finalSelectedDays > 0 &&
  finalCompletedDays >= finalSelectedDays;

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

  setDurationModalVisible(false);

  try {

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

const {
  startModeVisible,
  durationModalVisible,
  setStartModeVisible,
  setDurationModalVisible,
  openStartFlow,
  pickModeThenOpenDuration,
  handleConfirmDurationByMode,
  cancelDuration,
} = useStartFlow({
  id,
  challengeTakenOptimistic,
  isDuoPendingOut,
  isOffline,
  t,
  setPendingOutLock,
  setOutgoingPendingInvite,
  setSendInviteVisible,
  handleTakeChallenge,
});

  const saveBusyRef = useRef(false);
  const markBusyRef = useRef(false);
  const openMomentAfterMissedRef = useRef<null | (() => void)>(null);

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

  // ✅ ferme les autres overlays possibles (au cas où)
  setDurationModalVisible(false);
  setStartModeVisible(false);

  // ✅ next frame = évite les glitches Android sur press + modal
  requestAnimationFrame(() => {
    setCompletionModalVisible(true);
  });
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

  const buildDuoMomentPayload = useCallback(
  (input: {
    myDone: number;
    myTotal: number;
    partnerName?: string;
    partnerAvatar?: string;
    partnerDone?: number;
    partnerTotal?: number;
    action?: any;
    streak?: number;
  }) => {
    const myTotal = Math.max(1, Number(input.myTotal || 0) || 1);
    const myDone = Math.max(0, Math.min(myTotal, Number(input.myDone || 0) || 0));

    const pDoneRaw =
      typeof input.partnerDone === "number"
        ? input.partnerDone
        : Number(duoChallengeDataRef.current?.duoUser?.completedDays || 0) || 0;

    const pTotalRaw =
      typeof input.partnerTotal === "number"
        ? input.partnerTotal
        : Number(duoChallengeDataRef.current?.duoUser?.selectedDays || 0) || 0;

    const partnerTotal = Math.max(1, pTotalRaw || myTotal);
    const partnerDone = Math.max(0, Math.min(partnerTotal, pDoneRaw));

    const partner =
      duoChallengeDataRef.current?.duoUser || {};

    return {
      action: input.action,
      streak: input.streak,

      // ✅ champs attendus par le modal (plus de 0/0/0/0)
      myDone,
      myTotal,
      partnerDone,
      partnerTotal,

      // ✅ infos UI
      myName: myNameRef.current,
      partnerName: input.partnerName || partner?.name,
      partnerAvatar: input.partnerAvatar || partner?.avatar,

      // optionnel
      dayIndex: myDone,
      totalDays: myTotal,

      // si tu en as besoin dans le modal
      partnerAlreadyMarkedToday: partnerDone >= partnerTotal,
    };
  },
  []
);

useMomentGate({
  id,
  missedChallengeVisible,
  setMissedChallengeVisible,
  finalSelectedDaysRef,
  activeEntryRef,
  isDuoRef,
  duoChallengeDataRef,
  isMarkedToday,
  finalCompletedDays,
  setSoloMomentVisible,
  setDuoMomentVisible,
  setSoloMomentDayIndex,
  setSoloMomentTotalDays,
  setSoloMomentStreak,
  setSoloMomentVariant,
  setDuoMomentPayload,
  buildDuoMomentPayload,
  setCompletionModalVisible,
});

  // ✅ Un seul point d'entrée pour ouvrir le bon modal (DUO vs SOLO)
  const openMomentModal = useCallback(
    (opts: {
      isDuo: boolean;
      myDoneAfter: number;
      myTotal: number;
      partnerName?: string;
      partnerDone?: number;
      partnerTotal?: number;
    }) => {
      // ✅ Last day => PAS de Moment, c’est Completion only
    if (opts.myTotal > 0 && opts.myDoneAfter >= opts.myTotal) {
      return;
    }
      if (opts.isDuo) {
  setDuoMomentPayload(
    buildDuoMomentPayload({
      myDone: opts.myDoneAfter,
      myTotal: opts.myTotal,
      partnerName: opts.partnerName,
      partnerDone: opts.partnerDone,
      partnerTotal: opts.partnerTotal,
    })
  );
  setDuoMomentVisible(true);
  return;
}

      setSoloMomentDayIndex(opts.myDoneAfter);
      setSoloMomentTotalDays(opts.myTotal);
      const isMilestone =
        opts.myDoneAfter === 1 ||
        opts.myDoneAfter === 7 ||
        opts.myDoneAfter === 30 ||
        opts.myDoneAfter === opts.myTotal;
      setSoloMomentVariant(isMilestone ? "milestone" : "daily");
      setSoloMomentVisible(true);
    },
    []
  );

  // ✅ Hook “Missed avant Moment” : si un Missed modal est ouvert, on diffère.
  const tryOpenMomentOrDefer = useCallback((openMoment: () => void) => {
  if (missedChallengeVisible) {
    openMomentAfterMissedRef.current = openMoment; // defer
    return;
  }
  openMoment();
}, [missedChallengeVisible]);

const { showBootOverlay, loadingLabel, loadingSubLabel } = useBootOverlay({
  invitationModalVisible,
  inviteLoading,
  deeplinkBooting,
  inviteModalReady,
  setInviteLoading,
  setDeeplinkBooting,
  setInviteModalReady,
  hideRootInviteHandoff,
  t,
});

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
  dlog("BOOT_OVERLAY", { showBootOverlay, invitationModalVisible, inviteLoading, deeplinkBooting, inviteModalReady });
}, [showBootOverlay, invitationModalVisible, inviteLoading, deeplinkBooting, inviteModalReady]);


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

 // 5) Nettoyage param SANS casser la stack
  try {
    // @ts-ignore
    router.setParams?.({ openSendInvite: undefined });
  } catch {}

  return () => {
    // @ts-ignore
    task?.cancel?.();
  };
}, [params?.openSendInvite, params?.invite, router, handleInviteFriend]);

useEffect(() => {
  if (invitationModalVisible) return;

  // si le modal n'est plus là, on ne doit JAMAIS garder un boot overlay actif
  setInviteModalReady(false);
  setInviteLoading(false);
  setDeeplinkBooting(false);

  try { setInvitation(null as any); } catch {}
  try { hideRootInviteHandoff(); } catch {}
}, [
  invitationModalVisible,
  hideRootInviteHandoff,
  setInviteModalReady,
  setInviteLoading,
  setDeeplinkBooting,
  setInvitation,
]);

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

    const duoSnap =
      isDuo
        ? {
            partnerDone: duoChallengeData?.duoUser?.completedDays ?? 0,
            partnerTotal: duoChallengeData?.duoUser?.selectedDays || finalSelectedDays,
            partnerName: duoChallengeData?.duoUser?.name || "Partner",
          }
        : null;

    // ✅ IMPORTANT: on capture un "next" cohérent immédiatement
    const before = Number(finalCompletedDays ?? 0) || 0;
    const cap = Number(finalSelectedDays) || 0;
    const optimisticNext = cap > 0 ? Math.min(before + 1, cap) : before + 1;

    // ✅ markToday DOIT renvoyer un objet (success/missedDays)
    const res = await markToday(id, finalSelectedDays);

    // ✅ si markToday a déclenché un missed-flow, on ne fait RIEN ici
    if (!res?.success) return;
    if (res?.missedDays >= 2) return; // MissedChallengeModal doit passer avant

    // ✅ OPTIMISTIC UI (barre solo instant)
    setFinalCompletedDays(optimisticNext);

    // ✅ LAST DAY (source de vérité = res.completed)
if (res?.completed || (cap > 0 && optimisticNext >= cap)) {
  // ferme proprement d’éventuels moments (au cas où)
  setSoloMomentVisible(false);
  setDuoMomentVisible(false);

  // ✅ force l’UI à 100% pour afficher le CTA "Terminer le défi"
  if (cap > 0) setFinalCompletedDays(cap);

  // ✅ IMPORTANT: ne PAS ouvrir ChallengeCompletionModal ici.
  // Le bouton "Terminer le défi" (showCompleteButton) doit être le seul point d’entrée.
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  try { await bumpCounterAndMaybeReview(`markToday:${id}:${finalSelectedDays}`, 7); } catch {}

  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await recordDailyGlobalMark(uid, new Date());
      await checkForAchievements(uid);
    }
  } catch (e) {
    console.warn("recordDailyGlobalMark failed (non-bloquant):", e);
  }

  return;
}


    const momentFn = () =>
      openMomentModal({
        isDuo: !!isDuo,
        myDoneAfter: optimisticNext,
        myTotal: finalSelectedDays,
        partnerName: duoSnap?.partnerName,
        partnerDone: duoSnap?.partnerDone,
        partnerTotal: duoSnap?.partnerTotal,
      });

    // ✅ si missed visible à cet instant, on diffère
    tryOpenMomentOrDefer(momentFn);

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { await bumpCounterAndMaybeReview(`markToday:${id}:${finalSelectedDays}`, 7); } catch {}

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
}, [
  id,
  challengeTaken,
  marking,
  finalSelectedDays,
  finalCompletedDays,
  isMarkedToday,
  markToday,
  t,
  isDuo,
  duoChallengeData?.duoUser,
  openMomentModal,
  tryOpenMomentOrDefer,
]);

  // 🆕 styles/objets stables pour ScrollView afin d’éviter re-renders
const scrollContentStyle = useMemo(
  () => [styles.scrollPad, { paddingBottom: bottomInset + SPACING }],
  [bottomInset]
);

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
   entering={enteringBack}
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
{/* ✅ DUO PENDING — Ultra minimal / ultra premium (TOP 1) */}
{isDuoPendingOut && outgoingPendingInvite?.id && (
  <View style={styles.duoPendingShell}>
    <View
      style={styles.duoPendingCardV2}
      accessibilityRole="summary"
      accessibilityLabel={t("duo.pending.title")}
      accessibilityHint={t("duo.pending.body")}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          isDarkMode
            ? ["rgba(14,14,18,0.76)", "rgba(10,10,14,0.56)"]
            : ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.86)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.duoPendingStrokeV2} />
      <View pointerEvents="none" style={styles.duoPendingSheenV2} />

      {/* TOP ROW */}
      <View style={styles.duoPendingTopRowV2}>
        <View style={styles.duoPendingDotWrapV2} pointerEvents="none">
          <Animated.View style={[styles.duoPendingGlowV2, duoPendingGlowStyle]} />
          <Animated.View style={[styles.duoPendingDotV2, duoPendingDotStyle]} />
          <View style={styles.duoPendingDotCoreV2} />
        </View>

        <Text
          style={[
            styles.duoPendingTopTextV2,
            { color: isDarkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.66)" },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {t("duo.pending.short")}
        </Text>

        <View style={styles.duoPendingTopRightV2} pointerEvents="none">
          <Ionicons
            name="hourglass-outline"
            size={16}
            color={isDarkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.56)"}
          />
        </View>
      </View>

      {/* CENTER */}
      <View style={styles.duoPendingCenterV2}>
        <View style={styles.duoPendingAvatarColV2}>
          <SmartAvatar uri={myAvatar} name={myName || t("duo.you")} size={56} isDark={isDarkMode} />
          <Text
            style={[
              styles.duoPendingNameV2,
              { color: isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {myName || t("duo.you")}
          </Text>
        </View>

        <View style={styles.duoPendingConnectorV2} pointerEvents="none">
          <View style={styles.duoPendingLineV2} />
          <Animated.View style={[styles.duoPendingRingV2, duoPendingPulseStyle]} />
          <View style={styles.duoPendingVsPillV2} pointerEvents="none">
  <LinearGradient
    colors={["#FFD700", "#00FFFF"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{ ...StyleSheet.absoluteFillObject, borderRadius: 999 }}
  />
  <Text style={styles.duoPendingVsTextV2}>{t("duo.vs", { defaultValue: "VS" })}</Text>
</View>
          <View style={styles.duoPendingLineV2} />
        </View>

        <View style={styles.duoPendingAvatarColV2}>
          <PendingPartnerAvatar
  isDarkMode={isDarkMode}
  duoPendingPulseStyle={duoPendingPulseStyle}
  styles={styles}
/>
          <Text
            style={[
              styles.duoPendingNameV2,
              { color: isDarkMode ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {outgoingPendingInvite?.inviteeUsername
              ? `@${outgoingPendingInvite.inviteeUsername}`
              : t("duo.pending.partnerPending")}
          </Text>
        </View>
      </View>

      {/* BOTTOM */}
      <Text
        style={[
          styles.duoPendingHintV2,
          { color: isDarkMode ? "rgba(255,255,255,0.66)" : "rgba(0,0,0,0.54)" },
        ]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {t("duo.pending.warmupHint")}
      </Text>

      <View style={styles.duoPendingActionsV2}>
        {/* Warmup */}
        <Pressable
          onPress={handleWarmupPress}
          disabled={warmupDisabled}
          accessibilityRole="button"
          accessibilityLabel={t("duo.pending.warmup")}
          accessibilityHint={t("duo.pending.warmupA11yHint")}
          style={({ pressed }) => [
            styles.duoPendingPrimaryBtnV2,
            warmupDisabled && styles.duoPendingPrimaryBtnDisabledV2,
            pressed && !warmupDisabled && { transform: [{ scale: 0.992 }], opacity: 0.96 },
          ]}
        >
          <LinearGradient
            colors={
              warmupDisabled
                ? (isDarkMode
                    ? ["rgba(120,120,128,0.45)", "rgba(90,90,96,0.45)"]
                    : ["rgba(170,170,178,0.55)", "rgba(135,135,145,0.55)"])
                : ["#FF9F1C", "#FFD166"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons
            name={warmupDoneToday ? "checkmark-circle-outline" : "flash-outline"}
            size={18}
            color={warmupDisabled ? "rgba(255,255,255,0.92)" : "#111"}
          />
          <Text
            style={[
              styles.duoPendingPrimaryTextV2,
              warmupDisabled && { color: "rgba(255,255,255,0.88)" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {warmupLoading
              ? t("commonS.loading")
              : warmupDoneToday
                ? t("duo.pending.warmupDone")
                : t("duo.pending.warmup")}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={warmupDisabled ? "rgba(255,255,255,0.78)" : "#111"}
          />
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={handleCancelPendingInvite}
          accessibilityRole="button"
          accessibilityLabel={t("duo.pending.cancelInvite")}
          accessibilityHint={t("duo.pending.cancelA11yHint")}
          style={({ pressed }) => [
            styles.duoPendingGhostBtnV2,
            pressed && { opacity: 0.88, transform: [{ scale: 0.992 }] },
          ]}
        >
          <View style={styles.duoPendingGhostInnerV2}>
            <Ionicons
              name="close-outline"
              size={18}
              color={isDarkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.70)"}
            />
            <Text
              style={[
                styles.duoPendingGhostTextV2,
                { color: isDarkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.70)" },
              ]}
              numberOfLines={1}
            >
              {t("duo.pending.cancelInviteShort")}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  </View>
)}



         {/* ✅ CTA PRINCIPAL — priorité FINI > START > PROGRESS (à l’emplacement "Take the challenge") */}

{challengeTakenOptimistic && showCompleteButton && (
  <TouchableOpacity
    style={styles.takeChallengeButton} // ✅ même placement que "Take the challenge"
    onPress={handleShowCompleteModal}  // ✅ ouvre ChallengeCompletionModal
    accessibilityRole="button"
    accessibilityLabel={t("challengeDetails.completeChallengeA11y", {
      defaultValue: "Terminer le défi",
    })}
    accessibilityHint={t("challengeDetails.completeChallengeHint", {
      defaultValue: "Ouvre l’écran de validation pour récupérer tes trophées.",
    })}
    testID="complete-challenge-button"
    activeOpacity={0.9}
  >
    <LinearGradient
      colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
      style={styles.takeChallengeButtonGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text
        style={[
          styles.takeChallengeButtonText,
          { color: currentTheme.colors.textPrimary },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {t("challengeDetails.completeChallenge")}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
)}

{!challengeTakenOptimistic && !isDuoPendingOut && !showCompleteButton && (
  <TouchableOpacity
    style={styles.takeChallengeButton}
    onPress={openStartFlow}
    accessibilityLabel={t("challengeDetails.takeChallengeA11y", {
      defaultValue: "Prendre le défi",
    })}
    accessibilityHint={t("challengeDetails.takeChallengeHint", {
      defaultValue: "Choisis Solo ou Duo, puis sélectionne une durée pour démarrer.",
    })}
    testID="take-challenge-button"
    accessibilityRole="button"
    activeOpacity={0.9}
  >
    <LinearGradient
      colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
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
          <View style={styles.avatarWrap}>
            <SmartAvatar
              uri={myAvatar}
              name={myName || t("duo.you")}
              size={normalizeSize(36)}
              isDark={isDarkMode}
            />
            {myIsPioneer && (
              <PioneerBadge
                size="mini"
                style={{ position: "absolute", bottom: -6, left: -6 }}
              />
            )}
          </View>
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
  onLayout={(e) => setSoloBarWidth(e.nativeEvent.layout.width)}
  accessibilityRole="progressbar"
  accessibilityLiveRegion="polite"
  accessibilityValue={{
    min: 0,
    max: activeSelectedDays || 0,
    now: activeCompletedDays || 0,
  }}
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
      {
        width: soloBarWidth * progressRatio,
      },
    ]}
  />
</View>
        {/* Mini stats */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
          <Text
  style={[
    styles.progressText,
    {
      color: currentTheme.colors.secondary,
      ...(Platform.OS === "android"
        ? { includeFontPadding: false }
        : {}),
    },
  ]}
>
  {activeCompletedDays}/{activeSelectedDays} {t("challengeDetails.daysCompleted")}
</Text>

<Text
  style={[
    styles.progressText,
    {
      color: currentTheme.colors.textSecondary,
      marginLeft: 10,
      ...(Platform.OS === "android"
        ? { includeFontPadding: false }
        : {}),
    },
  ]}
>
  · {Math.round(progressRatio * 100)}%
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
      <View style={[styles.duoEliteAvatars, { backgroundColor: DUO.bgSoft, borderColor: DUO.stroke }]}>
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
           <SmartAvatar uri={myAvatar} name={myName || t("duo.you")} size={74} isDark={isDarkMode} />

          </View>
          <Text style={[styles.duoEliteName, { color: DUO.text }]} numberOfLines={1} ellipsizeMode="tail">
            {myName || t("duo.you")}
          </Text>
        </View>

        <View style={[styles.duoVsPill, { backgroundColor: DUO.bgCard, borderColor: DUO.strokeSoft }]}>
    <Text style={[styles.duoVs, { color: DUO.textSoft, opacity: 1 }]}>VS</Text>
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
  isDark={isDarkMode}
/>

          </View>
          <Text style={[styles.duoEliteName, { color: DUO.text }]} numberOfLines={1} ellipsizeMode="tail">
            {duoChallengeData.duoUser.name}
          </Text>
        </View>
      </View>

      {/* === PROGRESS STACK (PRIMARY, lisible) === */}
      <View style={styles.duoProgressStack}>
        {/* ME BAR */}
        <View style={styles.duoBarRow}>
          <View style={styles.duoBarLabelRow}>
            <Text
   style={[
     styles.duoBarLabel,
     { color: DUO.text },
     Platform.OS === "android" && { includeFontPadding: false },
   ]}
  numberOfLines={1}
  ellipsizeMode="tail"
>
  {t("duo.you")}
</Text>

<Text
   style={[
     styles.duoBarValue,
     { color: DUO.textFaint },
     Platform.OS === "android" && { includeFontPadding: false },
   ]}
 >
  {meDone}/{meTotal}
</Text>

          </View>

         <View style={[styles.duoBarTrack, { backgroundColor: DUO.track, borderColor: DUO.trackStroke }]}>
            <View style={[styles.duoBarTrackSheen, { backgroundColor: DUO.sheen }]} pointerEvents="none" />
            <View style={styles.duoBarTicks} pointerEvents="none">
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
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
            <Text style={[styles.duoBarLabel, { color: DUO.text }]} numberOfLines={1} ellipsizeMode="tail">
              {duoChallengeData.duoUser.name}
            </Text>
            <Text style={[styles.duoBarValue, { color: DUO.textFaint }]}>{pDone}/{pTotal}</Text>
          </View>

          <View style={styles.duoBarTrack}>
            <View style={styles.duoBarTrackSheen} pointerEvents="none" />
            <View style={styles.duoBarTicks} pointerEvents="none">
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
              <View style={[styles.duoBarTick, { backgroundColor: DUO.tick }]} />
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
<View style={styles.duoBattleHeaderWrap}>
  <View style={[styles.duoBattleTitleRow, { backgroundColor: DUO.bgCard, borderColor: DUO.stroke }]}>
    <Text style={[styles.duoBattleTitle, { color: DUO.text }]} numberOfLines={1}>
      BATTLE BAR
    </Text>

    <Text style={[styles.duoBattleMini, { color: DUO.textSoft }]} numberOfLines={1} ellipsizeMode="tail">
      {meDone}/{meTotal} • {pDone}/{pTotal}
    </Text>
  </View>
</View>

<View style={styles.duoBattleBarWrap}>
  <View style={[styles.duoBattleBar, { backgroundColor: DUO.track, borderColor: DUO.trackStroke }]}>
    <View style={styles.duoBattleRail} pointerEvents="none" />
    <View style={[styles.duoBattleLeft, { width: `${mePct * 100}%` }]} />
    <View style={[styles.duoBattleRight, { width: `${pPct * 100}%` }]} />
    <View style={[styles.duoBattleDivider, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.20)", opacity: 1 }]} pointerEvents="none" />
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
            
        {/* ACTIONS */}
<View style={styles.actionsWrap}>

  {/* MAIN ACTIONS */}
  <View style={styles.primaryActions}>
    {/* ✅ Invite seulement si SOLO actif (pas empty start, pas duo, pas pending) */}
   {isSoloInThisChallenge && !isDuoPendingOut && (
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


    {/* ✅ Share seulement si le challenge est pris (solo ou duo). Si aucun challenge -> pas de share */}
{challengeTakenOptimistic && (
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
    <Text style={styles.primaryBtnTextSecondary}>
      {t("challengeDetails.actions.shareTitle")}
    </Text>
    <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
  </Pressable>
)}

  </View>

  {/* QUICK ACTIONS */}
<View style={styles.quickActions}>

  {/* CHAT */}
  <Pressable
    onPress={handleNavigateToChat}
    disabled={!challengeTaken}
    accessibilityRole="button"
    accessibilityState={{ disabled: !challengeTaken }}
    accessibilityLabel={t("challengeDetails.quick.chatA11y")}
    accessibilityHint={t("challengeDetails.quick.chatHint")}
    style={({ pressed }) => [
      styles.quickBtn,
      !challengeTaken && styles.quickBtnDisabled,
      pressed && styles.btnPressed,
    ]}
  >
    <View style={styles.quickBtnInner}>
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={18}
        color={challengeTaken ? QUICK_ICON : QUICK_ICON_DISABLED}
      />

      <Text
        style={[
          styles.quickText,
          {
            color: challengeTaken ? QUICK_TEXT : QUICK_TEXT_DISABLED,
            ...(Platform.OS === "ios"
              ? {
                  textShadowColor: QUICK_SHADOW,
                  textShadowRadius: 6,
                  textShadowOffset: { width: 0, height: 1 },
                }
              : {}),
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
        allowFontScaling={false}
      >
        {t("challengeDetails.quick.chat")}
      </Text>
    </View>
  </Pressable>

  {/* STATS */}
  <Pressable
    onPress={handleViewStats}
    disabled={!challengeTaken}
    accessibilityRole="button"
    accessibilityState={{ disabled: !challengeTaken }}
    accessibilityLabel={t("challengeDetails.quick.statsA11y")}
    accessibilityHint={t("challengeDetails.quick.statsHint")}
    style={({ pressed }) => [
      styles.quickBtn,
      !challengeTaken && styles.quickBtnDisabled,
      pressed && styles.btnPressed,
    ]}
  >
    <View style={styles.quickBtnInner}>
      <Ionicons
        name="stats-chart-outline"
        size={18}
        color={challengeTaken ? QUICK_ICON : QUICK_ICON_DISABLED}
      />

      <Text
        style={[
          styles.quickText,
          {
            color: challengeTaken ? QUICK_TEXT : QUICK_TEXT_DISABLED,
            ...(Platform.OS === "ios"
              ? {
                  textShadowColor: QUICK_SHADOW,
                  textShadowRadius: 6,
                  textShadowOffset: { width: 0, height: 1 },
                }
              : {}),
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
        allowFontScaling={false}
      >
        {t("challengeDetails.quick.stats")}
      </Text>
    </View>
  </Pressable>

  {/* SAVE / FAVORI */}
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
    <View style={styles.quickBtnInner}>
      <Ionicons
        name={savedNow ? "bookmark" : "bookmark-outline"}
        size={18}
        color={savedNow ? QUICK_ACTIVE : QUICK_ICON}
      />

      <Text
        style={[
          styles.quickText,
          savedNow && styles.quickTextActive,
          savedNow
            ? {
                color: QUICK_ACTIVE,
                ...(Platform.OS === "ios"
                  ? {
                      textShadowColor: QUICK_ACTIVE_SHADOW,
                      textShadowRadius: 7,
                      textShadowOffset: { width: 0, height: 1 },
                    }
                  : {}),
              }
            : {
                color: QUICK_TEXT,
                ...(Platform.OS === "ios"
                  ? {
                      textShadowColor: QUICK_SHADOW,
                      textShadowRadius: 6,
                      textShadowOffset: { width: 0, height: 1 },
                    }
                  : {}),
              },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
       minimumFontScale={0.62}
        allowFontScaling={false}
      >
        {savedNow
          ? t("challengeDetails.quick.saved")
          : t("challengeDetails.quick.save")}
      </Text>
    </View>
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

<SelectModeModal
  visible={startModeVisible}
  onClose={() => setStartModeVisible(false)}
  onPick={(mode) => pickModeThenOpenDuration(mode)}
  isOffline={isOffline}
  isDark={isDarkMode}
  primaryColor={currentTheme.colors.primary}
  secondaryColor={currentTheme.colors.secondary}
/>

<DurationSelectionModal
  visible={durationModalVisible}
  daysOptions={daysOptions}
  selectedDays={localSelectedDays}
  onSelectDays={setLocalSelectedDays}
  onConfirm={handleConfirmDurationByMode}
  onCancel={cancelDuration}
  dayIcons={dayIcons}
/>

      <ChallengeCompletionModal
  visible={completionModalVisible}
  challengeId={id}
  selectedDays={finalSelectedDays}
  onClose={() => setCompletionModalVisible(false)}
  onPreloadRewarded={loadRewarded}
  rewardedAdUnitId={rewardedAdUnitId}
  onShowRewarded={async () => {
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
  dlog("InvitationModal onClose", invitation?.id);
  forceCloseInviteUI(invitation?.id);
}}
  clearInvitation={() => forceCloseInviteUI(invitation?.id)}
  onLoaded={() => setInviteModalReady(true)}
/>

 {showBootOverlay && (
  <Animated.View
    // ⚠️ plus d'entering/exiting, pour éviter les soucis de hitbox fantôme
    style={styles.loadingOverlay}
    pointerEvents="auto"
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

        <Text style={[styles.loadingSubText, { color: currentTheme.colors.textSecondary }]}>
  {loadingSubLabel}
</Text>
      </View>
    </View>
  </Animated.View>
)}

<ConfirmationDuoModal
  visible={confirmResetVisible}
  onClose={() => setConfirmResetVisible(false)}
  onConfirm={async () => {
    // ✅ garde TA logique actuelle (reset + switch duo)
    // Exemple :
    // setConfirmResetVisible(false);
    // await confirmSwitchToDuo();  // <- ton handler existant
    // (si tu as un state "marking"/"pendingOutLock", passe-le en loading ci-dessous)
    await confirmSwitchToDuo();
  }}
  loading={marking || pendingOutLock} // adapte avec TON state réel
  title={t("duo.confirmTitle", { defaultValue: "Passer en duo ?" })}
  subtitle={t("duo.confirmSubtitle", {
    defaultValue:
      "Tu vas inviter un partenaire. Pour rester fair, on repart sur une progression propre.",
  })}
  warningLine={t("duo.confirmWarning", {
    defaultValue: "⚠️ Passer en duo réinitialise ta progression solo sur ce défi.",
  })}
  cancelLabel={t("commonS.cancel", { defaultValue: "Annuler" })}
  confirmLabel={t("duo.confirmCta", { defaultValue: "Oui, passer en duo" })}
  a11yCloseLabel={t("commonS.close", { defaultValue: "Fermer" })}
  a11yCancelHint={t("duo.cancelHint", {
    defaultValue: "Ferme la fenêtre sans changer ton défi.",
  })}
  a11yConfirmHint={t("duo.confirmHint", {
    defaultValue: "Confirme le passage en duo et réinitialise la progression solo.",
  })}
/>

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

{duoMomentVisible && (
  <DuoMomentModal
    visible
    onClose={() => setDuoMomentVisible(false)}
    {...(duoMomentPayload ?? {})}
  />
)}

<SoloMomentModal
  visible={soloMomentVisible}
  onClose={() => setSoloMomentVisible(false)}
  dayIndex={soloMomentDayIndex}
  totalDays={soloMomentTotalDays}
  streak={soloMomentStreak}
  variant={soloMomentVariant}
/>

<SendInvitationModal
  visible={sendInviteVisible}
  challengeId={id}
  selectedDays={localSelectedDays}
  challengeTitle={routeTitle}
  isDuo={isDuo}
  onClose={() => setSendInviteVisible(false)}
  onSent={() => {
  setOutgoingPendingInvite((prev) => prev ?? { id: "__optimistic__", inviteeUsername: null });

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
  colors={["rgba(255,215,0,0.06)", "rgba(0,0,0,0)", "rgba(255,159,28,0.05)"]}
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
           <Animated.View
  style={[
    styles.vsGlowRing,
    { borderColor: "rgba(255,159,28,0.35)", shadowColor: "rgba(255,159,28,0.9)" },
  ]}
/>
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

{warmupToast && (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.warmupToastWrap,
      warmupToastStyle,
      { bottom: tabBarHeight + insets.bottom + 14 },
    ]}
  >
    <BlurView
      intensity={26}
      tint={isDarkMode ? "dark" : "light"}
      style={styles.warmupToastBlur}
    >
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20,20,26,0.88)", "rgba(14,14,18,0.74)"]
            : ["rgba(255,255,255,0.94)", "rgba(255,255,255,0.86)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.warmupToastInner}
      >
        <View pointerEvents="none" style={styles.warmupToastStroke} />

        <View style={styles.warmupToastIconPill}>
          <LinearGradient
            colors={
              warmupToast === "success"
                ? ["rgba(255,159,28,0.85)", "rgba(255,209,102,0.85)"] // orange/gold
                : ["rgba(239,68,68,0.85)", "rgba(244,63,94,0.85)"] // red
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons
            name={warmupToast === "success" ? "checkmark" : "alert-circle"}
            size={16}
            color="#111"
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.warmupToastTitle,
              { color: isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.86)" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {warmupToast === "success"
              ? t("duo.pending.warmupSuccessTitle", { defaultValue: "Warmup réussi" })
              : t("duo.pending.warmupErrorTitle", { defaultValue: "Warmup impossible" })}
          </Text>

          <Text
            style={[
              styles.warmupToastSub,
              { color: isDarkMode ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.60)" },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {warmupToast === "success"
              ? t("duo.pending.warmupSuccessSub", { defaultValue: "On attend ton partenaire." })
              : t("duo.pending.warmupError", { defaultValue: "Impossible d’enregistrer le warmup." })}
          </Text>
        </View>
      </LinearGradient>
    </BlurView>
  </Animated.View>
)}
<DebugHUD
  data={{
    showBootOverlay,
    invitationModalVisible,
    inviteLoading,
    deeplinkBooting,
    inviteModalReady,
    introVisible,
    introBlocking,
    inviteId: invitation?.id ?? "—",
  }}
/>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ===== DUO UI: Premium Avatar + Progress Row (NO weird placeholder) =====
const getInitials = (name?: string) => {
  const s = String(name || "").trim();
  if (!s) return "CT";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).slice(0, 2) || "CT";
};
