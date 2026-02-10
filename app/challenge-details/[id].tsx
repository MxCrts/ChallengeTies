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
 import { DeviceEventEmitter } from "react-native";
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
import SelectModeModal from "@/components/SelectModeModal";
import ConfirmationDuoModal from "@/components/ConfirmationDuoModal";
import DuoMomentModal from "@/components/DuoMomentModal";
import SoloMomentModal from "@/components/SoloMomentModal";
import { MISSED_FLOW_EVENT, MARK_RESOLVED_EVENT } from "@/context/CurrentChallengesContext";

const short = (s: string, max = 16) => (s.length > max ? s.slice(0, max - 1).trim() + "…" : s);


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

// ---------------------------------------------------------------------------
// DuoPending helpers (avatar premium stable)
// ---------------------------------------------------------------------------
const safeSeed = (v: unknown, fallback = "seed") => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : fallback;
};

// hash simple stable -> number (évite "random" différent à chaque render)
const seedToInt = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

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
  // 4 colonnes = cheap. Tablet = 3 colonnes, phone = 2 colonnes.
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
      // tracks
      track: isDarkMode ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.06)",
      trackStroke: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)",
      tick: isDarkMode ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.14)",
      sheen: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.70)",
    };
  }, [isDarkMode]);
  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
  const justJoinedRef = useRef(false);
  // 🧹 Anti-doublon solo+duo : évite boucle de nettoyage
  const cleanupSoloRef = useRef(false);
  
const IS_COMPACT = W < 380; // ✅ basé sur la largeur actuelle (split-screen/tablette)
const [confirmResetVisible, setConfirmResetVisible] = useState(false);
const [warmupToast, setWarmupToast] = useState<null | "success" | "error">(null);
const [sendInviteVisible, setSendInviteVisible] = useState(false);
const insets = useSafeAreaInsets();


 const IS_TINY = W < 360;
const [adHeight, setAdHeight] = useState(0);
  // 🆕 callback stable pour éviter un re-render en boucle quand BannerSlot mesure
  const onBannerHeight = useCallback((h: number) => {
    setAdHeight((prev) => (prev === h ? prev : h));
  }, []);

  
// --- Toast state

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

// cleanup on unmount
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

  // 🆕 si on arrive avec ?invite=... → overlay actif dès le 1er render
const [deeplinkBooting, setDeeplinkBooting] = useState(
  () => !!params?.invite
);
  
 const [invitation, setInvitation] = useState<{ id: string } | null>(null);
 const [invitationModalVisible, setInvitationModalVisible] = useState(false);
 const [inviteLoading, setInviteLoading] = useState(false);
 const [inviteModalReady, setInviteModalReady] = useState(false);
 const [startModeVisible, setStartModeVisible] = useState(false);
 const [startMode, setStartMode] = useState<"solo" | "duo" | null>(null);
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

  // ---------------------------------------------------------------------------
  // Refs pour éviter les closures stale (events -> ouverture MomentModal)
  // ---------------------------------------------------------------------------
  const activeEntryRef = useRef<any>(null);
  const finalSelectedDaysRef = useRef<number>(0);
  const isDuoRef = useRef<boolean>(false);
  const duoChallengeDataRef = useRef<any>(null);
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

  const QUICK_TEXT = "#0B0B10";                 // lisible sur glass blanc
const QUICK_TEXT_DISABLED = "rgba(11,11,16,0.45)";
const QUICK_SHADOW = "rgba(255,255,255,0.65)";

const QUICK_ICON = "#0B0B10";
const QUICK_ICON_DISABLED = "rgba(11,11,16,0.35)";

// ACTIVE (Save)
const QUICK_ACTIVE = ACCENT.solid;
const QUICK_ACTIVE_SHADOW = "rgba(0,0,0,0.20)";

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
 const isDuoPendingOut = (!isDuo) && (pendingOutLock || !!outgoingPendingInvite?.id);


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

useEffect(() => {
  const sub = DeviceEventEmitter.addListener(MISSED_FLOW_EVENT, (payload: any) => {
    // payload typique: { challengeId, visible: true/false } ou juste { challengeId }
    if (!payload) return;
    if (payload.challengeId && payload.challengeId !== id) return;

    // si tu envoies explicitement visible:
    if (typeof payload.visible === "boolean") {
      setMissedChallengeVisible(payload.visible);
      return;
    }

    // fallback: l’event signifie "missed flow démarre"
    setMissedChallengeVisible(true);
  });

  return () => sub?.remove?.();
}, [id]);

// ✅ Après résolution du MissedChallengeModal (streak pass / trophées / etc),
// on ouvre le MomentModal (solo/duo) une fois que la donnée "marquée" est bien sync.
useEffect(() => {
  const sub = DeviceEventEmitter.addListener(MARK_RESOLVED_EVENT, (p: any) => {
    if (!p) return;
    if (p.id && p.id !== id) return;

    const selectedDays = Number(p.selectedDays || finalSelectedDaysRef.current || 0);
    if (!selectedDays) return;

    // tentative "safe" : on attend que le missed flow soit bien fermé + que isMarkedToday devienne true
    const tryOpen = (attempt = 0) => {
      // 1) si missed flow encore visible, on attend
      if ((globalThis as any).__MISSED_VISIBLE__ === true || missedChallengeVisible) {
        if (attempt < 18) setTimeout(() => tryOpen(attempt + 1), 60);
        return;
      }

      // 2) si pas encore marqué côté UI (snapshot pas encore arrivé), on attend un peu
      if (!isMarkedToday(id, selectedDays)) {
        if (attempt < 18) setTimeout(() => tryOpen(attempt + 1), 60);
        return;
      }

      // 3) lire la meilleure source (ref) pour récupérer dayIndex/streak
      const entry = activeEntryRef.current;
      const totalDays = Number(selectedDays || entry?.selectedDays || 0) || 0;
      const dayIndex =
        Number(entry?.completedDays) ||
        Number(finalCompletedDays) ||
        0;
      const streak = typeof entry?.streak === "number" ? entry.streak : undefined;

      // ✅ LAST DAY => Completion only (jamais Moment)
      if (totalDays > 0 && dayIndex >= totalDays) {
        setSoloMomentVisible(false);
        setDuoMomentVisible(false);
        requestAnimationFrame(() => {
          setCompletionModalVisible(true);
        });
        return;
      }

      // 4) ouvrir le bon modal
      if (isDuoRef.current) {
  const partner = duoChallengeDataRef.current?.duoUser;

  setDuoMomentPayload(
    buildDuoMomentPayload({
      action: p.action,
      streak,
      myDone: dayIndex,
      myTotal: totalDays,
      partnerName: partner?.name,
      partnerAvatar: partner?.avatar,
      partnerDone: partner?.completedDays,
      partnerTotal: partner?.selectedDays,
    })
  );
  setDuoMomentVisible(true);
  return;
}
      setSoloMomentDayIndex(dayIndex);
      setSoloMomentTotalDays(totalDays);
      setSoloMomentStreak(streak);
      setSoloMomentVariant("daily");
      setSoloMomentVisible(true);
    };

    // on laisse 1 tick pour que l’UI ferme le modal missed + que le snapshot arrive
    setTimeout(() => tryOpen(0), 0);
  });

  return () => sub?.remove?.();
}, [
  id,
  missedChallengeVisible,
  isMarkedToday,
  finalCompletedDays,
  setDuoMomentPayload,
]);

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

const cancelSwitchToDuo = useCallback(() => {
  setConfirmResetVisible(false);
}, []);



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
        setInviteModalReady(false);
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
          setInviteModalReady(false);
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
        setInviteModalReady(false);
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
      // ✅ Warmup state (ne dépend pas de CurrentChallenges)
// - Nouveau storage: data.warmup
// - Rétro-compat: data.warmups (legacy)
try {
  const k = warmupDayKeyLocal();

  const warmupNew = data?.warmup || {};
  const warmupLegacy = data?.warmups || {};

  const done =
    !!warmupNew?.[k]?.[id] ||
    !!warmupLegacy?.[k]?.[id];

  setWarmupDoneToday(done);
} catch {}


      const list: any[] = Array.isArray(data?.CurrentChallenges)
        ? data.CurrentChallenges
        : [];

      // ✅ Match toutes les entrées liées à ce challenge
      const matches = list.filter((c) => {
        const cid = c?.challengeId ?? c?.id;
        return cid === id;
      });

      // ✅ Résolution déterministe de l'entrée "active"
      // 1) Priorité au uniqueKey si on en a un (évite de tomber sur une vieille entrée solo)
      // 2) Sinon: duo > solo (même logique)
      // 3) En solo: on prend la durée courante (selectedDays) si possible
      const preferredUniqueKey =
        (currentChallenge as any)?.uniqueKey ||
        (duoState as any)?.uniqueKey ||
        null;

      const preferredDaysRaw =
        (currentChallenge as any)?.selectedDays ??
        finalSelectedDays ??
        localSelectedDays ??
        0;
      const preferredDays = Number(preferredDaysRaw) || 0;

      const byKey =
        preferredUniqueKey
          ? matches.find((m) => !!m?.uniqueKey && m.uniqueKey === preferredUniqueKey)
          : undefined;

      const duoEntry = matches.find((m) => !!m.duo);
      const soloByDays =
        preferredDays > 0
          ? matches.find((m) => !m.duo && Number(m?.selectedDays || 0) === preferredDays)
          : undefined;
      const firstSolo = matches.find((m) => !m.duo);

      // ✅ si duo existe -> duo, sinon la meilleure solo
      const entry = byKey || duoEntry || soloByDays || firstSolo || matches[0];
      setActiveEntry(entry);


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

// Toujours garder ces deux-là sync depuis Firestore (cast SAFE)
const sel = Number(entry?.selectedDays ?? 0);
setFinalSelectedDays(Number.isFinite(sel) && sel > 0 ? sel : 0);

// ✅ completedDays robuste (cast SAFE)
let computedCompleted = 0;
const rawCompleted = entry?.completedDays;

if (typeof rawCompleted === "number") {
  computedCompleted = rawCompleted;
} else if (typeof rawCompleted === "string") {
  const n = Number(rawCompleted);
  computedCompleted = Number.isFinite(n) ? n : 0;
} else if (Array.isArray(entry?.completionDates)) {
  computedCompleted = entry.completionDates.length;
}

setFinalCompletedDays(
  Number.isFinite(computedCompleted) && computedCompleted >= 0 ? computedCompleted : 0
);



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
    },
    (error) => {
      console.error("❌ Erreur récupération défi :", error);
      setLoading(false);
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
  // ✅ si on a un lock local, on garde l’optimiste (le temps que Firestore rattrape)
  if (!pendingOutLock) setOutgoingPendingInvite(null);
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
      setInviteModalReady(false);
      setInvitationModalVisible(true);
      willShowModal = true; // ✅ on va laisser l’overlay vivre jusqu’à onLoaded()

      // Nettoie l’URL en enlevant ?invite (évite re-open au re-render)
      try {
        if (id) router.replace(`/challenge-details/${id}` as any);
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
  challengeTakenOptimistic &&
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


const openStartFlow = useCallback(() => {
    if (challengeTakenOptimistic || !id) return;
    // si une invite sortante est pending -> pas de re-start
    if (isDuoPendingOut) return;
    setStartMode(null);
    setStartModeVisible(true);
  }, [challengeTakenOptimistic, id, isDuoPendingOut]);

  const chooseSoloThenDuration = useCallback(() => {
    setStartMode("solo");
    setStartModeVisible(false);
    setModalVisible(true); // DurationSelectionModal
  }, []);

  const chooseDuoThenDuration = useCallback(() => {
    setStartMode("duo");
    setStartModeVisible(false);
    setModalVisible(true); // DurationSelectionModal (même UI)
  }, []);

  const handleConfirmDurationByMode = useCallback(async () => {
    // ⚠️ modalVisible = DurationSelectionModal
    // On ferme d'abord pour éviter double overlays
    setModalVisible(false);

    if (startMode === "duo") {
      // Duo = on ne prend PAS le challenge en solo.
      // On enchaîne sur l'invitation (qui créera l'open invite) + state pending.
      if (isOffline) {
        Alert.alert(
          t("common.networkError"),
          t("firstPick.offlineDuo", {
            defaultValue: "Connecte-toi à Internet pour inviter un ami en duo.",
          })
        );
        return;
      }

      // Optimiste : on lock l'état pending out immédiatement (UX “instant”)
      setPendingOutLock(true);
      setOutgoingPendingInvite((prev) => prev ?? { id: "__optimistic__", inviteeUsername: null });

      // Ouvre ton modal existant (il va envoyer l'invite)
      setSendInviteVisible(true);
      return;
    }

    // Solo = flow normal (inchangé)
    await handleTakeChallenge();
  }, [startMode, handleTakeChallenge, isOffline, t]);

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
  setModalVisible(false);
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

const onCloseMissed = useCallback(() => {
  setMissedChallengeVisible(false);

  // flush deferred moment
  const fn = openMomentAfterMissedRef.current;
  openMomentAfterMissedRef.current = null;
  fn?.();
}, []);

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

const showBootOverlay =
  !invitationModalVisible &&
  (isHydrating || inviteLoading || (deeplinkBooting && !inviteModalReady));

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
    if (id) router.replace(`/challenge-details/${id}` as any);
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

  const cancelOutBusyRef = useRef(false);

const resolveOutgoingPendingInviteId = useCallback(async (): Promise<string | null> => {
  // 1) si on a déjà le vrai id -> go
  if (outgoingPendingInvite?.id && outgoingPendingInvite.id !== "__optimistic__") {
    return outgoingPendingInvite.id;
  }

  // 2) sinon on cherche le vrai doc pending côté Firestore
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return null;

  try {
    const snap = await getDocs(
      query(
        collection(db, "invitations"),
        where("inviterId", "==", uid),
        where("challengeId", "==", id),
        where("status", "==", "pending"),
        limit(1)
      )
    );
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch {
    return null;
  }
}, [outgoingPendingInvite?.id, id]);

const cancelOutgoingPendingInvite = useCallback(async () => {
  if (cancelOutBusyRef.current) return;
  cancelOutBusyRef.current = true;

  // ✅ UI instant : on retire la card pending direct (plus besoin de quitter/revenir)
  setPendingOutLock(false);
  setOutgoingPendingInvite(null);

  try {
    const inviteId = await resolveOutgoingPendingInviteId();
    if (!inviteId) {
      // Pas encore créé / déjà supprimé : côté UX c’est clean, on s’en fout
      return;
    }

    await updateDoc(doc(db, "invitations", inviteId), {
      status: "refused",
      updatedAt: serverTimestamp(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch (e) {
    // ✅ ZÉRO message d’erreur user ici (tu l’as demandé)
    // Si ça a échoué, le snapshot qOut re-affichera la card si l’invite est toujours pending
    console.warn("cancelOutgoingPendingInvite failed:", e);
  } finally {
    cancelOutBusyRef.current = false;
  }
}, [resolveOutgoingPendingInviteId]);

const handleCancelPendingInvite = useCallback(() => {
  if (!isDuoPendingOut) return;

  Alert.alert(
    t("duo.pending.cancelConfirmTitle", { defaultValue: "Annuler l’invitation ?" }),
    t("duo.pending.cancelConfirmBody", { defaultValue: "Ton ami ne pourra plus rejoindre ce duo avec ce lien." }),
    [
      { text: t("commonS.keep", { defaultValue: "Garder" }), style: "cancel" },
      {
        text: t("duo.pending.cancelInvite", { defaultValue: "Annuler l’invitation" }),
        style: "destructive",
        onPress: () => cancelOutgoingPendingInvite(),
      },
    ],
    { cancelable: true }
  );
}, [isDuoPendingOut, cancelOutgoingPendingInvite, t]);

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


  const pickModeThenOpenDuration = useCallback(
    (mode: "solo" | "duo") => {
      setStartMode(mode);
      setStartModeVisible(false);
      setModalVisible(true); // ton DurationSelectionModal
    },
    []
  );

  // 🆕 styles/objets stables pour ScrollView afin d’éviter re-renders
const scrollContentStyle = useMemo(
  () => [styles.scrollPad, { paddingBottom: bottomInset + SPACING }],
  [bottomInset]
);

  const loadingLabel = inviteLoading || (deeplinkBooting && !inviteModalReady)
    ? t("challengeDetails.loadingInvite", {
        defaultValue: "Ouverture de l’invitation…",
      })
    : t("challengeDetails.loading", {
        defaultValue: "Chargement du défi…",
      });

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
        visible={modalVisible}
        daysOptions={daysOptions}
        selectedDays={localSelectedDays}
        onSelectDays={setLocalSelectedDays}
        onConfirm={handleConfirmDurationByMode}
        onCancel={() => {
   setModalVisible(false);
   // retour mode selection = UX premium (pas wtf)
   setStartModeVisible(true);
 }}
        dayIcons={dayIcons}
      />

      <ChallengeCompletionModal
  visible={completionModalVisible}
  challengeId={id}
  selectedDays={finalSelectedDays}
  onClose={() => setCompletionModalVisible(false)}
  onPreloadRewarded={loadRewarded}
  rewardedAdUnitId={REWARDED_UNIT_ID}
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
    markInviteAsHandled(invitation?.id);
    setInvitationModalVisible(false);
   setInviteLoading(false);
   setDeeplinkBooting(false);
   setInviteModalReady(true);
  }}
  clearInvitation={() => {
    markInviteAsHandled(invitation?.id);
  }}
  // 🆕 Quand le modal a fini de charger -> on coupe l’overlay deeplink/invite
  onLoaded={() => {
    // ✅ coupe l’overlay pile après que le modal soit prêt (zéro trou visuel)
   requestAnimationFrame(() => {
     setInviteModalReady(true);
     setInviteLoading(false);
     setDeeplinkBooting(false);
   });
  }}
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

const SmartAvatar = React.memo(function SmartAvatar({
  uri,
  name,
  size = 74,
  isDark,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  isDark: boolean;
}) {
  const [failed, setFailed] = React.useState(false);

  const safeUri = typeof uri === "string" ? uri.trim() : "";
  const showImage = safeUri.length > 0 && !failed;
  // ✅ premium tokens (dark/light)
  const ring = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
  const shell = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const text = isDark ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.86)";
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.avatarShell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: shell,
          borderColor: ring,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: safeUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
          fadeDuration={120}
        />
      ) : (
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,159,28,0.95)", "rgba(0,194,255,0.88)"]
              : ["rgba(255,159,28,0.90)", "rgba(0,194,255,0.75)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: size / 2, alignItems: "center", justifyContent: "center" },
          ]}
        >
          {/* sheen (Keynote reflection) */}
          <View
            pointerEvents="none"
            style={[
              styles.avatarSheen,
              {
                borderRadius: size / 2,
                opacity: isDark ? 0.22 : 0.28,
              },
            ]}
          />

          {/* initials */}
          <Text
  style={[
    styles.avatarInitial,
    {
      color: text,
      fontSize: Math.round(size * 0.30),
      letterSpacing: 1.2,
      lineHeight: Math.round(size * 0.34), // ✅ Android safe
      textAlignVertical: "center",          // ✅ Android
    },
  ]}
  numberOfLines={1}
>
            {initials}
          </Text>
        </LinearGradient>
      )}

      {/* ring clean (no “cadre chelou”) */}
      <View
        style={[
          styles.avatarRing,
          { borderRadius: size / 2, borderColor: ring },
        ]}
        pointerEvents="none"
      />
      {/* specular ultra subtil */}
      <View
        style={[
          styles.avatarSpecular,
          { borderRadius: size / 2, opacity: isDark ? 0.55 : 0.40 },
        ]}
        pointerEvents="none"
      />
    </View>
  );
});


// ===== /DUO UI =====
const shadowSoft = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  android: {
    elevation: 6,
  },
  default: {},
});



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
  duoPendingVsPillV2: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  minWidth: 44,
  alignItems: "center",
  justifyContent: "center",
  zIndex: 6,
  elevation: 6,
  overflow: "visible",

  // ✅ ajout
  backgroundColor: "rgba(255,215,0,0.22)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,215,0,0.30)",
},
duoPendingVsTextV2: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: 12,
  letterSpacing: 1,
  color: "#111",
},

  duoPendingRingV2: {
  position: "absolute",
  width: 56,
  height: 56,
  borderRadius: 56,
  borderWidth: 1,
  // ⛔️ avant: rgba(0,255,255,...)
  borderColor: "rgba(255,159,28,0.30)", // ✅ orange soft
},
toastRoot: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 16, // on reste au-dessus des bannières/tab bar via safeArea plus bas
  alignItems: "center",
  zIndex: 99999,
},

toastCard: {
  width: "92%",
  maxWidth: 420,
  borderRadius: 18,
  overflow: "hidden",
},

toastBlur: {
  borderRadius: 18,
  overflow: "hidden",
},

toastInner: {
  paddingVertical: 12,
  paddingHorizontal: 12,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
},

toastIconPill: {
  width: 30,
  height: 30,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
},

toastTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13.6),
},

toastSub: {
  marginTop: 2,
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(12.2),
  lineHeight: normalizeSize(15.5),
},

duoPendingGlowV2: {
  position: "absolute",
  width: 18,
  height: 18,
  borderRadius: 18,
  // ⛔️ avant: cyan
  backgroundColor: "rgba(255,159,28,0.14)", // ✅ orange glow
},

duoPendingDotV2: {
  position: "absolute",
  width: 18,
  height: 18,
  borderRadius: 18,
  borderWidth: 1,
  // tu peux garder gold (ok)
  borderColor: "rgba(255,215,0,0.38)",
},

duoPendingDotCoreV2: {
  width: 7,
  height: 7,
  borderRadius: 7,
  backgroundColor: "rgba(255,215,0,0.92)",
},

  duoPendingCard: {
  borderRadius: 18,
  padding: 14,
  // ✅ CRITIQUE : sinon le hub se fait couper
  overflow: "visible", // pas "hidden" ici
},
startModeBackdrop: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  // ✅ plus sombre pour lisibilité
  backgroundColor: "rgba(0,0,0,0.68)",
},

startModeCard: {
  width: "100%",
  maxWidth: 560,
  alignSelf: "center",
  borderRadius: 26,
  overflow: "hidden",
  ...S.float,
},

warmupToastWrap: {
  position: "absolute",
  left: 14,
  right: 14,
  zIndex: 99999,
  elevation: 999,
},

warmupToastBlur: {
  borderRadius: 18,
  overflow: "hidden",
},

warmupToastInner: {
  borderRadius: 18,
  paddingVertical: 12,
  paddingHorizontal: 12,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},

warmupToastStroke: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 18,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.16)",
},

warmupToastIconPill: {
  width: 28,
  height: 28,
  borderRadius: 10,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
},

warmupToastTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: 13.6,
  lineHeight: 16,
},

warmupToastSub: {
  marginTop: 2,
  fontFamily: "Comfortaa_400Regular",
  fontSize: 12.2,
  lineHeight: 15,
},

startModeCardInner: {
  // ✅ on garde un padding mais on laisse le footer respirer
  paddingTop: 16,
  paddingHorizontal: 16,
  paddingBottom: 10,
  borderRadius: 26,
},

// ✅ ScrollView : occupe l'espace et ne "mange" plus le footer
startModeScroll: {
  flexGrow: 0,
},
startModeScrollContent: {
  paddingBottom: 10,
},

startModeOption: {
  width: "100%",
  // ✅ un peu plus haut pour absorber langues longues
  minHeight: 124,
  borderRadius: 18,
  padding: 12,
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
  justifyContent: "space-between",
},

startModeFooter: {
  marginTop: 12,
  alignItems: "center",
},

startModeCancel: {
  paddingVertical: 11,
  paddingHorizontal: 18,
  borderRadius: 999,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
  // ✅ petit fond pour mieux découper sur glass
  backgroundColor: "rgba(0,0,0,0.16)",
},

startModeCancelText: {
  color: "rgba(255,255,255,0.90)",
  fontSize: 13,
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},

startModeOptionSub: {
  marginTop: 2,
  color: "rgba(255,255,255,0.72)",
  fontSize: 12,
  lineHeight: 15,
  flexShrink: 1,
},


// ✅ tiny phones : micro shrink pour éviter les "..."
startModeOptionSubTiny: {
  fontSize: 11.2,
  lineHeight: 14,
},
startModeStroke: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
  borderRadius: 26,
},
startModeHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
},
startModeIconPill: {
  width: 36,
  height: 36,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
},
startModeTitle: {
  color: "rgba(255,255,255,0.96)",
  fontFamily: "Comfortaa_700Bold",
  fontSize: 16,
},
startModeSub: {
  marginTop: 2,
  color: "rgba(255,255,255,0.70)",
  fontSize: 12.5,
  lineHeight: 16,
},
startModeGrid: {
  flexDirection: "row",
  gap: 12,
  flexWrap: "wrap",
},
startModeOptionHalf: {
   width: "48%",
 },
startModeOptionDuo: {
  borderColor: "rgba(244,211,94,0.30)",
},
startModeTopRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
startModeBadge: {
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
  backgroundColor: "rgba(0,0,0,0.22)",
},
startModeBadgeText: {
  color: "rgba(255,255,255,0.90)",
  fontSize: 10,
  letterSpacing: 0.4,
  fontFamily: "Comfortaa_700Bold",
},
startModeOptionTitle: {
  marginTop: 8,
  color: "rgba(255,255,255,0.96)",
  fontFamily: "Comfortaa_700Bold",
  fontSize: 14.5,
},
  startModeCardBlur: {
    borderRadius: 26,
    overflow: "hidden",
  },
duoPendingWarmupDisabledStroke: {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  borderRadius: 999,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.22)",
},
duoPendingShell: {
  marginTop: 14,
  width: "100%",
},
duoPendingCardV2: {
  borderRadius: 22,
  padding: 14,
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.10)",
  ...shadowSoft,
},
duoBattleHeaderWrap: {
  width: "100%",
  maxWidth: 560,
  alignSelf: "center",
  marginTop: 14,
  marginBottom: 8,
  paddingHorizontal: 6,
},
duoBattleTitleRow: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 14,
  backgroundColor: Platform.select({
    ios: "rgba(0,0,0,0.28)",
    android: "rgba(0,0,0,0.22)",
    default: "rgba(0,0,0,0.26)",
  }) as any,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.16)",
  zIndex: 2,
  elevation: 2,
},
duoBattleTitle: {
  flexShrink: 1,
  minWidth: 0,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12.6),
  letterSpacing: 1.2,
  color: "rgba(255,255,255,0.94)",
  includeFontPadding: false,
  ...(Platform.OS === "ios"
    ? {
        textShadowColor: "rgba(0,0,0,0.55)",
        textShadowRadius: 6,
        textShadowOffset: { width: 0, height: 1 },
      }
    : {}),
},
duoBattleMini: {
  flexShrink: 0,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(11.2),
  color: "rgba(255,255,255,0.78)",
  includeFontPadding: false,
},
duoBattleBarWrap: {
  width: "100%",
  maxWidth: 560,
  alignSelf: "center",
  marginTop: 0,
  opacity: 1,
},
duoPendingStrokeV2: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 22,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
  opacity: 0.9,
},
duoPendingSheenV2: {
  position: "absolute",
  left: -40,
  top: -60,
  width: 160,
  height: 160,
  borderRadius: 160,
  backgroundColor: "rgba(255,255,255,0.08)",
  transform: [{ rotate: "18deg" }],
},
duoPendingTopRowV2: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
},
duoPendingDotWrapV2: {
  width: 18,
  height: 18,
  marginRight: 10,
  alignItems: "center",
  justifyContent: "center",
},
duoPendingTopTextV2: {
  flex: 1,
  minWidth: 0,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12.5),
  letterSpacing: 0.3,
},
duoPendingTopRightV2: {
  width: 22,
  alignItems: "flex-end",
},
duoPendingCenterV2: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
},
duoPendingAvatarColV2: {
  width: "40%",
  alignItems: "center",
},
duoPendingNameV2: {
  marginTop: 8,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12.8),
},
duoPendingConnectorV2: {
  width: "20%",
  alignItems: "center",
  justifyContent: "center",
},
duoPendingLineV2: {
  width: 2,
  height: 14,
  borderRadius: 2,
  backgroundColor: "rgba(255,255,255,0.14)",
},
duoPendingHintV2: {
  textAlign: "center",
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(12.6),
  lineHeight: normalizeSize(17),
  marginBottom: 12,
},
duoPendingActionsV2: {
  flexDirection: "row",
  gap: 10,
},
duoPendingPrimaryBtnV2: {
  flex: 1,
  height: 46,
  borderRadius: 16,
  overflow: "hidden",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 12,
},
duoPendingPrimaryBtnDisabledV2: {
  opacity: 0.92,
},
duoPendingPrimaryTextV2: {
  flex: 1,
  minWidth: 0,
  marginLeft: 10,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13.2),
  color: "#111",
},
duoPendingGhostBtnV2: {
  width: 118,
  height: 46,
  borderRadius: 16,
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: "rgba(255,255,255,0.06)",
  alignItems: "center",
  justifyContent: "center",
},
duoPendingGhostInnerV2: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingHorizontal: 10,
},
duoPendingGhostTextV2: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12.8),
},
 imageContainer: {
    width: "100%",
    borderBottomLeftRadius: R.hero,
    borderBottomRightRadius: R.hero,
    overflow: "hidden",
    marginBottom: SPACING,
    ...S.float,
  },
  confirmBackdrop: {
  flex: 1,                 // ✅ CRITIQUE
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 16,
},
confirmCardKeynote: {
  width: "100%",           // ✅ évite le crop
  maxWidth: 420,
  alignSelf: "center",
  borderRadius: 26,
  overflow: "hidden",
  maxHeight: "85%",        // ✅ jamais coupé
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
avatarShell: {
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  ...S.card,
},
avatarRing: {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  borderWidth: StyleSheet.hairlineWidth,
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
avatarInitial: {
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},
avatarSheen: {
  position: "absolute",
  left: "10%",
  right: "10%",
  top: "10%",
  height: "42%",
  backgroundColor: "rgba(255,255,255,0.18)",
  transform: [{ skewY: "-10deg" }],
},
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
duoEliteAvatars: {
  width: "100%",
  maxWidth: 560,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
 paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 18,
  borderWidth: StyleSheet.hairlineWidth,
},
duoPendingRing: {
  position: "absolute",
   width: 38,
   height: 38,
   borderRadius: 999,
   borderWidth: 2.5,
   borderColor: "rgba(139,92,246,0.95)",
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
},
duoVs: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(12),
  letterSpacing: 1.6,
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
  marginTop: 14,
  flexDirection: "row",
  flexWrap: "nowrap",          // ✅ JAMAIS 2 lignes
  justifyContent: "space-between",
  gap: 10,                     // ✅ spacing stable
},
quickBtn: {
  flex: 1,                     // ✅ 3 colonnes égales
  minWidth: 0,                 // ✅ CRUCIAL pour éviter overflow iOS
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderRadius: 14,
  minHeight: 56,               // ✅ plus haut => texte jamais coupé
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.12)",
  backgroundColor: "rgba(255,255,255,0.86)",
},
quickText: {
  width: "100%",
  textAlign: "center",
  flexShrink: 1,
  minWidth: 0,                 // ✅ iOS long strings
  fontSize: normalizeSize(12.5),
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
  lineHeight: normalizeSize(14),
},
quickBtnInner: {
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},
quickIcon: {
  marginBottom: 0,
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

duoPendingCenter: {
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 10,
  minWidth: 64,
},
duoPendingCenterGlow: {
  position: "absolute",
  width: 58,
  height: 58,
  borderRadius: 29,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
},
duoPendingCenterLine: {
  width: 2,
  height: 18,
  borderRadius: 1,
  backgroundColor: "rgba(255,255,255,0.18)",
  marginVertical: 6,
},
duoPendingVsPill: {
  paddingHorizontal: 14,
  paddingVertical: 7,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.22)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.16)",
},
duoPendingVsText: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: 12,
  letterSpacing: 1.2,
  color: "rgba(255,255,255,0.92)",
},
duoPendingMiniBadge: {
  position: "absolute",
  right: 6,
  bottom: 6,
  width: 18,
  height: 18,
  borderRadius: 9,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.22)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.18)",
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
  position: "relative",
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

