import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  AccessibilityInfo,
  Pressable,
  Platform,
  Modal,
  Image as RNImage,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  InteractionManager,
} from "react-native";
import { useRouter, useRootNavigationState, usePathname } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import SendInvitationModal from "@/components/SendInvitationModal";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { recordSelectDays } from "../src/services/metricsService";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { canInvite } from "@/utils/canInvite";
import { useToast } from "../src/ui/Toast";
import { AppState } from "react-native";
import { getOrCreateOpenInvitation } from "@/services/invitationService";
import { logEvent } from "@/src/analytics";

const SPACING = 16;
const DEFAULT_DAYS = [7, 14, 21, 30, 60, 90];
const FALLBACK_DURATION_DAYS = [7, 14, 21, 30, 60, 90];
const ORANGE = "#FF8C00";
const GOLD = "#FFD700";
const CTA_GRAD_A = "#FFB000";
const CTA_GRAD_B = "#FF8C00";
const FIRSTPICK_INVITE_SNAPSHOT_KEY = "ties_firstpick_invite_snapshot_v1";
const FIRSTPICK_INVITE_SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 min (WhatsApp/ShareSheet peut être long)
const FIRSTPICK_SHARE_IN_PROGRESS_KEY = "ties_firstpick_share_in_progress_v1";
const HOME_PENDING_INVITE_KEY = "ties_home_pending_invite_v1";
const FIRSTPICK_POSTSHARE_KEY = "ties_firstpick_postshare_v1";
const FIRSTPICK_DONE_HARD_KEY = "ties_firstpick_done_hard_v1";
const FIRSTPICK_DONE_HARD_TTL_MS = 5 * 60 * 1000; // 5 min anti-bounce


type PostSharePersisted = {
  t: number;
  inviteId?: string | null;
};


type InviteSnapshot = {
  t: number;
  step: 3;
  mode: "duo";
  days: number;
  selected: Challenge;
  inviteId?: string;
};

const setGlobalInviteSnap = (snap: InviteSnapshot | null) => {
  if (snap) (globalThis as any).__FP_INVITE_SNAP__ = snap;
  else delete (globalThis as any).__FP_INVITE_SNAP__;
};

const getGlobalInviteSnap = (): InviteSnapshot | null => {
  const v = (globalThis as any).__FP_INVITE_SNAP__;
  return v && typeof v?.t === "number" ? (v as InviteSnapshot) : null;
};

const INK = "#0B0F17";          // noir premium
const PAPER = "#FFFFFF";        // blanc
const LIGHT_PILL_BG = "rgba(0,0,0,0.06)";
const LIGHT_PILL_BORDER = "rgba(0,0,0,0.10)";
const DARK_PILL_BG = "rgba(255,255,255,0.06)";
const DARK_PILL_BORDER = "rgba(255,255,255,0.10)";


type Challenge = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  chatId?: string;
  daysOptions?: number[];
  rawCategory?: string;
};

const FALLBACK_IMG = RNImage.resolveAssetSource(
  require("../assets/images/fallback-card.png")
).uri;

const blurhash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

type Step = 1 | 2 | 3;

type ChallengeCardProps = {
  item: Challenge;
  isSel: boolean;
  onPress: () => void;
  CARD_W: number;
  CARD_H: number;
  reduceMotion: boolean;
  currentTheme: any;
  t: (k: string, opts?: any) => string;
  lang: string;
  FALLBACK_IMG: string;
  blurhash: string;
};

const ChallengeCard = React.memo(function ChallengeCard({
  item,
  isSel,
  onPress,
  CARD_W,
  CARD_H,
  reduceMotion,
  currentTheme,
  t,
  lang,
  FALLBACK_IMG,
  blurhash,
}: ChallengeCardProps) {
  const [imgUri, setImgUri] = useState<string>(item.imageUrl || FALLBACK_IMG);

  const translatedTitle = useMemo(() => {
    const key = item.chatId ? `challenges.${item.chatId}.title` : "";
    return item.chatId
      ? (t(key, { defaultValue: item.title }) as string)
      : (item.title || (t("common.challenge") as string));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.chatId, item.title, t, lang]);

  const translatedCategory = useMemo(() => {
    const rawCat = item.rawCategory || item.category || "Miscellaneous";
    return t(`categories.${rawCat}`, { defaultValue: rawCat }) as string;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.rawCategory, item.category, t, lang]);

  useEffect(() => {
    setImgUri(item.imageUrl || FALLBACK_IMG);
  }, [item.imageUrl, FALLBACK_IMG]);

  const scale = useRef(new Animated.Value(1)).current;
  

  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: isSel ? 1.02 : 1,
      speed: 12,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [isSel, reduceMotion, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        style={[
          styles.cardOuter,
          {
            width: CARD_W,
            height: CARD_H,
            borderColor: isSel ? currentTheme.colors.secondary : "transparent",
          },
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.92}
          style={[
            styles.cardInner,
            {
              borderColor: currentTheme.colors.border,
              backgroundColor: currentTheme.colors.cardBackground,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${translatedTitle} — ${translatedCategory}`}
          accessibilityHint={
            (t("firstPick.cardHint", { defaultValue: "Appuie pour sélectionner." }) as string) || ""
          }
        >
          <Image
            source={{ uri: imgUri }}
            style={styles.cardImg}
            contentFit="cover"
            transition={reduceMotion ? 0 : 120}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            placeholder={blurhash}
            onError={() => setImgUri(FALLBACK_IMG)}
          />

          <LinearGradient
            colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.55)"]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.cardLabelWrap}>
            <Text numberOfLines={2} style={[styles.cardTitle, { color: "#fff" }]}>
              {translatedTitle}
            </Text>
            <Text numberOfLines={1} style={[styles.cardCat, { color: "#ddd" }]}>
              {translatedCategory}
            </Text>
          </View>

          {isSel && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={18} color="#000" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});


export default function FirstPick() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { show } = useToast();
const pathname = usePathname();
  const router = useRouter();
  const nav = useRootNavigationState();
  const pendingNavRef = useRef<null | { pathname: string; params?: any }>(null);

  const { takeChallenge } = useCurrentChallenges();

  // ✅ onboarding steps
  const [step, setStep] = useState<Step>(1);
  const [postShareBusy, setPostShareBusy] = useState(false);

  // ✅ Base saine : mode SIMPLE (pas de "none")
  const [mode, setMode] = useState<"solo" | "duo">("duo");
  


  const [inviteModalVisible, setInviteModalVisible] = useState(false);


  const [reduceMotion, setReduceMotion] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<Challenge[]>([]);
  const [items, setItems] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [pendingInvite, setPendingInvite] = useState<null | { inviteId: string }>(null);
  const [postShareVisible, setPostShareVisible] = useState(false);
  const [postSharePhase, setPostSharePhase] = useState<"ask" | "fallback">("ask");
  const [postShareInviteId, setPostShareInviteId] = useState<string | null>(null);

  // ✅ par défaut : 7 jours (règle FirstPick)
  const [days, setDays] = useState<number>(7);

  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const userClosedInviteModalRef = useRef(false);
  const firstPickViewLoggedRef = useRef(false);
  const stepViewLoggedRef = useRef<Record<number, boolean>>({});
  // -----------------------
  // Analytics helpers (safe)
  // -----------------------
  const track = useCallback((name: string, params?: Record<string, any>) => {
    try {
      logEvent(name, params).catch?.(() => {});
    } catch {}
  }, []);

  const baseCtx = useCallback(() => {
    const uid = auth.currentUser?.uid || null;
    return {
      uid,
      pathname: typeof pathname === "string" ? pathname : null,
      step,
      mode,
      days,
      offline: !!isOffline,
      selected_id: selected?.id || null,
      selected_chatId: selected?.chatId || null,
      has_pending_invite: !!pendingInvite?.inviteId,
    };
  }, [pathname, step, mode, days, isOffline, selected?.id, selected?.chatId, pendingInvite?.inviteId]);

  // Anim
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.985)).current;
  const listRef = useRef<FlatList<Challenge> | null>(null);


  // Step transition anim (premium)
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;

 const persistInviteSnapshot = useCallback(async (inviteId?: string) => {
  if (!selected) return;
  const snap: InviteSnapshot = {
    t: Date.now(),
    step: 3,
    mode: "duo",
    days,
    selected,
    inviteId,
  };

  setGlobalInviteSnap(snap);
  // analytics: snapshot persisted (inviteId may be undefined on pre-share fallback)
  track("first_pick_invite_snapshot_persist", {
    ...baseCtx(),
    invite_id: inviteId || null,
    has_invite_id: !!inviteId,
  });

  try {
    await AsyncStorage.setItem(FIRSTPICK_INVITE_SNAPSHOT_KEY, JSON.stringify(snap));
    await setShareInProgress(true);
  } catch {}
}, [days, selected, track, baseCtx]);


  const clearInviteSnapshot = useCallback(async () => {
    setGlobalInviteSnap(null);
    try {
      await AsyncStorage.removeItem(FIRSTPICK_INVITE_SNAPSHOT_KEY);
      await setShareInProgress(false);
    } catch {}
  }, []);

  const clearHomePendingInvite = async () => {
  try {
    await AsyncStorage.removeItem(HOME_PENDING_INVITE_KEY);
  } catch {}
};

const markHomePendingInvite = async (inviteId: string) => {
  try {
    await AsyncStorage.setItem(HOME_PENDING_INVITE_KEY, inviteId);
  } catch {}
};

const deleteInvitationByIdSafe = useCallback(async (inviteId?: string) => {
  if (!inviteId) return;
  try {
    await deleteDoc(doc(db, "invitations", inviteId));
  } catch (e) {
    // on ne bloque pas l’onboarding si la suppression fail (offline etc.),
    // mais on nettoie quand même l’UI/snapshot local.
    console.warn("delete invitation failed", e);
  }
}, []);


  const setShareInProgress = async (v: boolean) => {
  try {
    if (v) await AsyncStorage.setItem(FIRSTPICK_SHARE_IN_PROGRESS_KEY, "1");
    else await AsyncStorage.removeItem(FIRSTPICK_SHARE_IN_PROGRESS_KEY);
  } catch {}
};

const getShareInProgress = async (): Promise<boolean> => {
  try {
    const v = await AsyncStorage.getItem(FIRSTPICK_SHARE_IN_PROGRESS_KEY);
    return v === "1";
  } catch {
    return false;
  }
};

const persistPostShare = useCallback(async (inviteId?: string | null) => {
  const payload: PostSharePersisted = { t: Date.now(), inviteId: inviteId ?? null };
  try {
    await AsyncStorage.setItem(FIRSTPICK_POSTSHARE_KEY, JSON.stringify(payload));
  } catch {}
}, []);

const consumePostShare = useCallback(async () => {
  try {
    const raw = await AsyncStorage.getItem(FIRSTPICK_POSTSHARE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(FIRSTPICK_POSTSHARE_KEY).catch(() => {});
    const parsed = JSON.parse(raw || "{}");
    const ts = Number(parsed?.t || 0);
    if (!ts || Date.now() - ts > 60_000) return null; // 60s fenêtre, suffisant
    return { inviteId: parsed?.inviteId ? String(parsed.inviteId) : null };
  } catch {
    return null;
  }
}, []);



  const restoreInviteSnapshot = useCallback(async () => {
    const now = Date.now();
    const shareInProgress = await getShareInProgress();

    // 1) Essaye global (ultra rapide)
    const g = getGlobalInviteSnap();
    if (g?.t && now - g.t <= FIRSTPICK_INVITE_SNAPSHOT_TTL_MS) {
      if (g?.selected?.id) setSelected(g.selected);
      if (Number.isFinite(g?.days)) setDays(Number(g.days));
      if (g?.inviteId) setPendingInvite({ inviteId: g.inviteId });
      setMode("duo");
      setStep(3);
      // ✅ Si share est en cours -> on ré-ouvre
      // ✅ Sinon -> on respecte la volonté de l'user (s'il l'a fermé)
      if (shareInProgress && !userClosedInviteModalRef.current) {
        setInviteModalVisible(true);
      }
      track("first_pick_invite_snapshot_restore", {
        ...baseCtx(),
        source: "global",
        share_in_progress: !!shareInProgress,
        invite_id: g?.inviteId || null,
        has_invite_id: !!g?.inviteId,
      });

      return true;
    }

    // 2) Essaye storage (remount / cold restore)
    try {
      const raw = await AsyncStorage.getItem(FIRSTPICK_INVITE_SNAPSHOT_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      const ts = Number(s?.t || 0);
      if (!ts || now - ts > FIRSTPICK_INVITE_SNAPSHOT_TTL_MS) {
        await AsyncStorage.removeItem(FIRSTPICK_INVITE_SNAPSHOT_KEY).catch(() => {});
        await setShareInProgress(false).catch(() => {});
        return false;
      }

      // keep global in sync
      setGlobalInviteSnap(s);

      if (s?.selected?.id) setSelected(s.selected);
      if (Number.isFinite(Number(s?.days))) setDays(Number(s.days));
      if (s?.inviteId) setPendingInvite({ inviteId: String(s.inviteId) });
      setMode("duo");
      setStep(3);
      if (shareInProgress && !userClosedInviteModalRef.current) {
        setInviteModalVisible(true);
      }
      track("first_pick_invite_snapshot_restore", {
        ...baseCtx(),
        source: "storage",
        share_in_progress: !!shareInProgress,
        invite_id: s?.inviteId ? String(s.inviteId) : null,
        has_invite_id: !!s?.inviteId,
      });
      return true;
    } catch {
      return false;
    }
  }, [track, baseCtx]);

  useEffect(() => {
  restoreInviteSnapshot().catch(() => {});
}, [restoreInviteSnapshot]);

  // KPI: first_pick_view + step views
  useEffect(() => {
    if (firstPickViewLoggedRef.current) return;
    firstPickViewLoggedRef.current = true;

    // On log l'entrée écran (une fois)
    track("first_pick_view", { ...baseCtx() });
  }, []);

  useEffect(() => {
    if (stepViewLoggedRef.current[step]) return;
    stepViewLoggedRef.current[step] = true;

    track("first_pick_step_view", {
      ...baseCtx(),
      has_selected: !!selected,
    });
  }, [step, mode, selected, days]);


  // CTA pulse
  const ctaPulse = useRef(new Animated.Value(1)).current;

    const swoosh = useRef(new Animated.Value(0)).current;

  useEffect(() => {
  if (reduceMotion) {
    swoosh.stopAnimation();
    swoosh.setValue(0);
    return;
  }

  // ✅ animé uniquement si step 2 + mode sélectionné
  const shouldAnimate = step === 2 && (mode === "duo" || mode === "solo");

  if (!shouldAnimate) {
    swoosh.stopAnimation();
    swoosh.setValue(0);
    return;
  }

  swoosh.stopAnimation();
  swoosh.setValue(0);

  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(swoosh, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(swoosh, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ])
  );

  loop.start();
  return () => loop.stop();
}, [reduceMotion, swoosh, step, mode]);


  const duoSwooshX = useMemo(
    () => swoosh.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] }),
    [swoosh]
  );
  const soloSwooshX = useMemo(
    () => swoosh.interpolate({ inputRange: [0, 1], outputRange: [20, -20] }),
    [swoosh]
  );

  const duoSwooshY = useMemo(
   () => swoosh.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }),
   [swoosh]
 );
 const soloSwooshY = useMemo(
   () => swoosh.interpolate({ inputRange: [0, 1], outputRange: [7, -7] }),
   [swoosh]
 );
 const swooshScale = useMemo(
   () => swoosh.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
   [swoosh]
 );
 const swooshRotate = useMemo(
   () => swoosh.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }),
   [swoosh]
 );


  const CARD_W = useMemo(() => (width - SPACING * 3) / 2, [width]);
  const CARD_H = useMemo(() => Math.min(230, Math.max(200, height * 0.27)), [height]);
  const onConfirmRef = useRef<() => Promise<void>>(async () => {});


  const softHaptic = useCallback(async (type: "success" | "error" | "warning" = "success") => {
    try {
      if (type === "error") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === "warning") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  }, []);

  const animateStep = useCallback(
    (direction: "next" | "prev") => {
      if (reduceMotion) return;

      stepOpacity.setValue(0);
      stepTranslate.setValue(direction === "next" ? 10 : -10);

      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(stepTranslate, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    },
    [reduceMotion, stepOpacity, stepTranslate]
  );

  const scrollListToTop = useCallback((animated = true) => {
  // On laisse React appliquer le nouveau data avant de scroller
  requestAnimationFrame(() => {
    InteractionManager.runAfterInteractions(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  });
}, []);

  const goToStep = useCallback(
    async (next: Step) => {
      if (next === step) return;

      try {
        await Haptics.selectionAsync();
      } catch {}

      const dir = next > step ? "next" : "prev";
      setStep(next);
      animateStep(dir);
    },
    [animateStep, step]
  );

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(Boolean(v)))
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      if (mountedRef.current) setReduceMotion(Boolean(v));
    });

    const net = NetInfo.addEventListener((s) => {
      const off = s.isConnected === false || s.isInternetReachable === false;
      if (mountedRef.current) setIsOffline(!!off);
    });

    return () => {
      mounted = false;
      mountedRef.current = false;
      // @ts-ignore RN <=0.72 compat
      sub?.remove?.();
      net && net();
    };
  }, []);

 
  const safeReplace = useCallback(
    (to: { pathname: string; params?: any }) => {
      if (nav?.key) router.replace(to);
      else pendingNavRef.current = to;
    },
    [nav?.key, router]
  );

  useEffect(() => {
    if (nav?.key && pendingNavRef.current) {
      router.replace(pendingNavRef.current);
      pendingNavRef.current = null;
    }
  }, [nav?.key, router]);

   type InviteResult = "dismiss" | "start_solo";

useEffect(() => {
  const sub = AppState.addEventListener("change", async (state) => {
    if (state !== "active") return;

    // 1) Si on revient du ShareSheet -> on restaure (si besoin) + on affiche "envoyée ?"
    const shareInProgress = await getShareInProgress();
    if (shareInProgress) {
      track("first_pick_return_from_share_sheet", { ...baseCtx() });
      userClosedInviteModalRef.current = false;
      await restoreInviteSnapshot().catch(() => {});

      // ⚡️force l'affichage du modal postShare même si remount Android
      const snap = getGlobalInviteSnap();
      const inviteId = snap?.inviteId || pendingInvite?.inviteId || null;
      await persistPostShare(inviteId);
      await setShareInProgress(false);
    }

    // 2) Consume postShare persisté -> ouvre le modal "Invitation envoyée ?"
    const ps = await consumePostShare();
if (ps) {
  // ✅ garde : si on n'a pas de pendingInvite et pas de snap, on ignore
  const snap = getGlobalInviteSnap();
  const hasContext = !!(ps.inviteId || pendingInvite?.inviteId || snap?.selected?.id);

  if (hasContext) {
    track("first_pick_postshare_modal_open", {
      ...baseCtx(),
      invite_id: ps.inviteId || pendingInvite?.inviteId || null,
      has_invite_id: !!(ps.inviteId || pendingInvite?.inviteId),
    });
    setMode("duo");
    setStep(3);

    if (ps.inviteId) {
      setPendingInvite({ inviteId: ps.inviteId });
      setPostShareInviteId(ps.inviteId);
    } else {
      setPostShareInviteId(null);
    }

    setPostSharePhase("ask");
    setPostShareVisible(true);
  }
}

  });

  return () => sub.remove();
}, [
  restoreInviteSnapshot,
  pendingInvite?.inviteId,
  persistPostShare,
  consumePostShare,
  track,
  baseCtx,
]);


  // Fade-in
  useEffect(() => {
    if (reduceMotion) {
      introOpacity.setValue(1);
      introScale.setValue(1);
      return;
    }
    const tt = setTimeout(() => {
      Animated.parallel([
        Animated.timing(introOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(introScale, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }, 0);
    return () => clearTimeout(tt);
  }, [reduceMotion, introOpacity, introScale]);

  // Micro pulse CTA (ready)
  useEffect(() => {
    if (reduceMotion) return;
    let loop: Animated.CompositeAnimation | null = null;

    const ready =
      (step === 1 && !!selected && !submitting) ||
      (step === 2 && !!selected && !submitting && !(mode === "duo" && isOffline)) ||
      (step === 3 && !!selected && !submitting && !(mode === "duo" && isOffline));

    if (ready) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.03, duration: 650, useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [step, mode, selected, submitting, isOffline, reduceMotion, ctaPulse]);

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const row = Math.floor(index / 2);
      const rowHeight = CARD_H + SPACING;
      return { length: rowHeight, offset: row * rowHeight, index };
    },
    [CARD_H]
  );

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isOffline) throw new Error("offline");
      const qRef = query(collection(db, "challenges"), where("approved", "==", true));
      const snap = await getDocs(qRef);

      const list: Challenge[] = snap.docs.map((d) => {
        const data: any = d.data();
        const chatId = data?.chatId || d.id;
        const rawCat = data?.category || "Miscellaneous";
        return {
          id: d.id,
          title: data?.title || chatId,
          description: data?.description || "",
          category: rawCat,
          rawCategory: rawCat,
          imageUrl: data?.imageUrl || "https://via.placeholder.com/600x400",
          chatId,
          daysOptions:
            Array.isArray(data?.daysOptions) && data.daysOptions.length
              ? data.daysOptions
              : DEFAULT_DAYS,
        };
      });

      setPool(list);

      const prefetchTargets = list.slice(0, 8).map((c) => c.imageUrl!).filter(Boolean);
      if (prefetchTargets.length) {
        Promise.allSettled(prefetchTargets.map((u) => RNImage.prefetch(u))).catch(() => {});
      }
    } catch (e: any) {
      setLoadError(t("common.networkError") || "Network error. Please try again.");
      console.error("first-pick fetch error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, isOffline]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const sampleFromPool = useCallback((list: Challenge[]) => {
    if (!list.length) return [];
    const byCat: Record<string, Challenge[]> = {};
    for (const c of list) {
      const cat = c.rawCategory || c.category || "Miscellaneous";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(c);
    }
    const cats = Object.keys(byCat).sort(() => Math.random() - 0.5);
    const sampled: Challenge[] = [];
    for (const cat of cats) {
      const arr = byCat[cat];
      const pick = arr[Math.floor(Math.random() * arr.length)];
      if (pick) sampled.push(pick);
      if (sampled.length >= 6) break;
    }
    return sampled;
  }, []);

  const regenerateItems = useCallback(async () => {
  const sampled = sampleFromPool(pool);
  setItems(sampled);
  setSelected((prev) => (prev && !sampled.find((s) => s.id === prev.id) ? null : prev));
  try { await Haptics.selectionAsync(); } catch {}
  scrollListToTop(true);
}, [pool, sampleFromPool, scrollListToTop]);


  useEffect(() => {
    const sampled = sampleFromPool(pool);
    setItems(sampled);

    setSelected((prev) => (prev && !sampled.find((s) => s.id === prev.id) ? null : prev));

    if (selected) {
      const opts = selected.daysOptions?.length ? selected.daysOptions : DEFAULT_DAYS;
      const preferred = opts.includes(7) ? 7 : opts[0];
      setDays((d) => (opts.includes(d) ? d : preferred));
    } else {
      setDays(7);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => {
    if (!items?.length) return;
    const targets = items.map((c) => c.imageUrl!).filter(Boolean);
    Promise.allSettled(targets.map((u) => RNImage.prefetch(u))).catch(() => {});
  }, [items]);

  useEffect(() => {
  let alive = true;

  const run = async () => {
    try {
      const raw = await AsyncStorage.getItem(FIRSTPICK_DONE_HARD_KEY);
      if (!alive) return;

      if (!raw) return;

      const ts = Number(raw);
      if (!Number.isFinite(ts)) {
        await AsyncStorage.removeItem(FIRSTPICK_DONE_HARD_KEY).catch(() => {});
        return;
      }

      // si trop vieux, on purge
      if (Date.now() - ts > FIRSTPICK_DONE_HARD_TTL_MS) {
        await AsyncStorage.removeItem(FIRSTPICK_DONE_HARD_KEY).catch(() => {});
        return;
      }

      // ✅ Si on est sur FirstPick ("/" chez toi) alors on ESCAPE direct vers tabs.
      // Ça tue 100% des "retours fantômes" post-navigation.
      const isOnFirstPick =
  typeof pathname === "string" &&
  (pathname.toLowerCase().includes("firstpick") || pathname === "/firstpick");

if (isOnFirstPick) {
  requestAnimationFrame(() => {
    safeReplace({ pathname: "/(tabs)" });
  });
}

    } catch {}
  };

  run();

  return () => {
    alive = false;
  };
}, [pathname, safeReplace]);


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChallenges();
  }, [fetchChallenges]);

  const goHome = useCallback(async (opts?: { pendingInviteId?: string }) => {
  await AsyncStorage.setItem("firstPickDone", "1");

  // ✅ hard reset invite flow flags (anti remount/Android weirdness)
  await AsyncStorage.removeItem(FIRSTPICK_INVITE_SNAPSHOT_KEY).catch(() => {});
  await setShareInProgress(false).catch(() => {});
  if (opts?.pendingInviteId) {
    await markHomePendingInvite(opts.pendingInviteId);
  } else {
    await clearHomePendingInvite();
  }

  setGlobalInviteSnap(null);

// ✅ hard-done anti-bounce (empêche retour Step1 après navigation)
await AsyncStorage.setItem(FIRSTPICK_DONE_HARD_KEY, String(Date.now())).catch(() => {});

safeReplace({ pathname: "/(tabs)" });

}, [safeReplace]);


const handleInviteDismiss = useCallback(() => {
  // ✅ l’utilisateur ferme volontairement le modal
  userClosedInviteModalRef.current = true;
  setInviteModalVisible(false);
  track("first_pick_invite_modal_close", { ...baseCtx(), reason: "user_dismiss" });
  // 🚫 IMPORTANT: on ne clear PAS le snapshot ici
  // sinon retour shareSheet / remount => step 1
}, [track, baseCtx]);


const handleInvitationResult = useCallback(
  async (result: InviteResult, meta?: { inviteId?: string }) => {
    const inviteId = meta?.inviteId || pendingInvite?.inviteId;

    // ✅ SOLO depuis le modal (inchangé)
    if (result === "start_solo") {
       track("first_pick_invite_modal_action", { ...baseCtx(), action: "start_solo", invite_id: inviteId || null });
      setInviteModalVisible(false);
      await clearInviteSnapshot();
      await setShareInProgress(false);

      if (!selected) return;

      try {
        setSubmitting(true);
        submittingRef.current = true;

        const ref = doc(db, "challenges", selected.id);
        const snap = await getDoc(ref);
        const data: any = snap.exists() ? snap.data() : {};

        const challengeObj = {
          id: selected.id,
          title: selected.title || data?.title || t("common.challenge"),
          category: selected.category || data?.category || t("common.misc"),
          chatId: selected.chatId || data?.chatId || selected.id,
          rawCategory: selected.rawCategory || data?.category || "Miscellaneous",
          description: selected.description || data?.description || "",
          daysOptions: selected.daysOptions || data?.daysOptions || DEFAULT_DAYS,
          imageUrl: selected.imageUrl || data?.imageUrl || "",
        };

        await takeChallenge(challengeObj, days);

        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const bucketizeDays = (n: number): 7 | 30 | 90 | 180 | 365 => {
              if (n <= 7) return 7;
              if (n <= 30) return 30;
              if (n <= 90) return 90;
              if (n <= 180) return 180;
              return 365;
            };
            await recordSelectDays(uid, bucketizeDays(days));
            await checkForAchievements(uid);
          }
        } catch {}

        await goHome();
      } catch (e: any) {
        console.error("first-pick start_solo error", e);
        show(e?.message || t("common.oops", { defaultValue: "Oups, réessaie." }), "error");
        softHaptic("error");
      } finally {
        setSubmitting(false);
        submittingRef.current = false;
      }
      return;
    }

    // ✅ FLOW UNIQUE (iOS + Android)
    // Après fermeture shareSheet => on affiche TOUJOURS "Invitation envoyée ?"
     track("first_pick_invite_share_sheet_closed", { ...baseCtx(), invite_id: inviteId || null });
    setInviteModalVisible(false);
userClosedInviteModalRef.current = true;

// ✅ on persiste "postShare" pour survivre aux remount Android
await persistPostShare(inviteId || null);

// ✅ on coupe le flag share (sinon AppState le relance)
await setShareInProgress(false);

// ✅ UI immédiate (sans attendre AppState)
setMode("duo");
setStep(3);

if (inviteId) setPendingInvite({ inviteId });

setPostShareInviteId(inviteId || null);
setPostSharePhase("ask");
setPostShareVisible(true);

  },
  [
    clearInviteSnapshot,
    days,
    goHome,
    pendingInvite?.inviteId,
    selected,
    setShareInProgress,
    show,
    softHaptic,
    t,
    takeChallenge,
    track,
    baseCtx,
  ]
);



  // ✅ Hint court, premium
  const modeHint = useMemo(() => {
    if (mode === "duo") {
      if (isOffline)
        return t("firstPick.step2.hintDuoOffline", { defaultValue: "Internet requis pour inviter." }) as string;

      return t("firstPick.step2.hintDuo", {
        defaultValue: "Invite un ami juste après. À deux, tu tiens plus longtemps.",
      }) as string;
    }
    return t("firstPick.step2.hintSolo", { defaultValue: "Tu démarres immédiatement, sans invitation." }) as string;
  }, [mode, isOffline, t]);

    const onSelectMode = useCallback(async (m: "duo" | "solo") => {
    setMode(m);
    try { await Haptics.selectionAsync(); } catch {}

    logEvent("first_pick_mode_select", {
      mode: m,
      step,
      has_selected: !!selected,
      offline: !!isOffline,
    }).catch?.(() => {});
  }, [step, selected, isOffline]);


  const onSelectCard = useCallback(async (item: Challenge) => {
    setSelected(item);
    const opts = item.daysOptions?.length ? item.daysOptions : DEFAULT_DAYS;
    const preferred = opts.includes(7) ? 7 : opts[0];
    setDays(preferred);
    try { await Haptics.selectionAsync(); } catch {}
  }, []);

  const availableDays = useMemo(() => {
  const opts =
    selected?.daysOptions?.length ? selected.daysOptions : DEFAULT_DAYS;

  const uniq = Array.from(
    new Set(
      opts
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 365)
    )
  ).sort((a, b) => a - b);

  return uniq.length ? uniq : FALLBACK_DURATION_DAYS;
}, [selected?.daysOptions]);

useEffect(() => {
  if (!availableDays.length) return;
  if (!availableDays.includes(days)) {
    const preferred = availableDays.includes(7) ? 7 : availableDays[0];
    setDays(preferred);
  }
}, [availableDays, days]);

const onPickDays = useCallback(
  async (n: number) => {
    if (n === days) return;
    setDays(n);
    try { await Haptics.selectionAsync(); } catch {}

    track("first_pick_duration_select", {
      ...baseCtx(),
      days: n,
      has_selected: !!selected,
    });
  },
 [days, step, mode, selected, track, baseCtx]
);


const formatDaysChip = useCallback(
  (n: number) => {
    // ultra court, jamais coupé
    return t(`firstPick.durationChip.${n}`, { defaultValue: `${n}j` }) as string;
  },
  [t]
);

const selectedTitle = useMemo(() => {
    if (!selected) return (t("common.challenge", { defaultValue: "Challenge" }) as string);
    const key = selected.chatId ? `challenges.${selected.chatId}.title` : "";
    if (selected.chatId) {
      return t(key, { defaultValue: selected.title || selected.chatId }) as string;
    }
    return (selected.title || (t("common.challenge", { defaultValue: "Challenge" }) as string)) as string;
  }, [selected?.id, selected?.chatId, selected?.title, t, i18n.language]);

  const ctaA11yLabel = useMemo(() => {
    const stepLabel = t("firstPick.progress", { current: step, total: 3, defaultValue: "Étape {{current}} sur {{total}}" }) as string;

    if (!selected) {
      return `${stepLabel}. ${(t("firstPick.a11yCtaNoChallenge", { defaultValue: "Choisis un défi pour continuer." }) as string)}`;
    }

    return `${stepLabel}. ${t("firstPick.a11yCtaFull", {
      mode: mode === "duo"
   ? (t("firstPick.step2.duoTitle", { defaultValue: "Duo" }) as string)
   : (t("firstPick.step2.soloTitle", { defaultValue: "Solo" }) as string),
      days,
      title: selected.title,
      defaultValue: "Continuer avec les options sélectionnées.",
    }) as string}`;
  }, [step, mode, selectedTitle, days, t]);


  const goNext = useCallback(async () => {
    if (submitting || submittingRef.current) return;

    // Step 1 needs a selection
    if (step === 1 && !selected) {
      show(t("firstPick.alert.missingChoiceBody", { defaultValue: "Choisis un défi pour continuer." }), "warning");
      softHaptic("warning");
      return;
    }

    // Step 2 needs selection + online if duo
    if (step === 2) {
      if (!selected) {
        show(t("firstPick.alert.missingChoiceBody", { defaultValue: "Choisis un défi pour continuer." }), "warning");
        softHaptic("warning");
        return;
      }
      if (mode === "duo" && isOffline) {
        show(t("firstPick.offlineDuo", { defaultValue: "Connecte-toi à Internet pour inviter un ami en duo." }), "error");
        softHaptic("error");
        return;
      }
    }

    // Step 3 -> confirm
if (step === 3) {
  await onConfirmRef.current();
  return;
}


    const nextStep: Step = (step + 1) as Step;
    await goToStep(nextStep);
  }, [isOffline, mode, selected, show, softHaptic, step, submitting, goToStep]);

  

  const goBack = useCallback(async () => {
    if (submitting || submittingRef.current) return;
    if (step === 1) return;
    const prevStep: Step = (step - 1) as Step;
    await goToStep(prevStep);
  }, [goToStep, step, submitting]);

  const onConfirm = useCallback(async () => {
    if (submittingRef.current || submitting) return;

      track("first_pick_confirm", { ...baseCtx() });


    if (!selected) {
      show(t("firstPick.alert.missingChoiceBody", { defaultValue: "Choisis un défi pour continuer." }), "warning");
      softHaptic("warning");
      return;
    }

    if (mode === "duo" && isOffline) {
      show(t("firstPick.offlineDuo", { defaultValue: "Connecte-toi à Internet pour inviter un ami en duo." }), "error");
      softHaptic("error");
      return;
    }

    submittingRef.current = true;
    try {
      setSubmitting(true);
      await Haptics.selectionAsync();

      const ref = doc(db, "challenges", selected.id);
      const snap = await getDoc(ref);
      const data: any = snap.exists() ? snap.data() : {};

      const challengeObj = {
        id: selected.id,
        title: selected.title || data?.title || t("common.challenge"),
        category: selected.category || data?.category || t("common.misc"),
        chatId: selected.chatId || data?.chatId || selected.id,
        rawCategory: selected.rawCategory || data?.category || "Miscellaneous",
        description: selected.description || data?.description || "",
        daysOptions: selected.daysOptions || data?.daysOptions || DEFAULT_DAYS,
        imageUrl: selected.imageUrl || data?.imageUrl || "",
      };

      if (mode === "solo") {
        await takeChallenge(challengeObj, days);

        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const bucketizeDays = (n: number): 7 | 30 | 90 | 180 | 365 => {
              if (n <= 7) return 7;
              if (n <= 30) return 30;
              if (n <= 90) return 90;
              if (n <= 180) return 180;
              return 365;
            };
            await recordSelectDays(uid, bucketizeDays(days));
            await checkForAchievements(uid);
          }
        } catch {}

        await goHome();
        return;
      }

      // ✅ DUO: si déjà pending -> continuer
if (mode === "duo" && pendingInvite?.inviteId) {
  await goHome({ pendingInviteId: pendingInvite.inviteId });
  return;
}

      // duo
    // ✅ DUO = toujours récup/crée l'invitation, même si elle existe déjà
      // => jamais de dead-end "invitation déjà envoyée"
      const { id: inviteId } = await getOrCreateOpenInvitation(selected.id, days);
 setPendingInvite({ inviteId });
 await persistInviteSnapshot(inviteId); // ✅ on stocke le vrai inviteId
 userClosedInviteModalRef.current = false;
 setInviteModalVisible(true);
 track("first_pick_invite_modal_open", { ...baseCtx(), invite_id: inviteId, source: "confirm_duo" });
    } catch (e: any) {
      console.error("first-pick confirm error", e);
      show(e?.message || t("common.oops", { defaultValue: "Oups, réessaie." }), "error");
      softHaptic("error");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [days, goHome, isOffline, mode, selected, show, softHaptic, submitting, t, takeChallenge]);

  useEffect(() => {
  onConfirmRef.current = onConfirm;
}, [onConfirm]);

 const renderItem = useCallback(
  ({ item }: { item: Challenge }) => {
    const isSel = selected?.id === item.id;
    return (
      <ChallengeCard
        item={item}
        isSel={isSel}
        onPress={() => onSelectCard(item)}
        CARD_W={CARD_W}
        CARD_H={CARD_H}
        reduceMotion={reduceMotion}
        currentTheme={currentTheme}
        t={t}
        lang={i18n.language}
        FALLBACK_IMG={FALLBACK_IMG}
        blurhash={blurhash}
      />
    );
  },
  [selected?.id, onSelectCard, CARD_W, CARD_H, reduceMotion, currentTheme, t, i18n.language]
);


  const keyExtractor = useCallback((it: Challenge) => it.id, []);

  const ListEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyArt}>
          <Ionicons
            name="sparkles-outline"
            size={48}
            color={currentTheme.colors.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        <Text style={[styles.emptyTitle, { color: currentTheme.colors.textPrimary }]}>
          {t("firstPick.emptyTitle", { defaultValue: "Aucun défi disponible" }) as string}
        </Text>
        <Text style={[styles.emptySubtitle, { color: currentTheme.colors.textSecondary }]}>
          {(loadError || (t("firstPick.emptySubtitle", { defaultValue: "Tire vers le bas pour réessayer." }) as string)) as string}
        </Text>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            fetchChallenges();
          }}
          android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: false }}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry", { defaultValue: "Réessayer" }) as string}
          style={({ pressed }) => [
            styles.emptyCta,
            { opacity: pressed ? 0.9 : 1, borderColor: currentTheme.colors.border },
          ]}
        >
          <LinearGradient
            colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyCtaBg}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>{t("common.retry", { defaultValue: "Réessayer" }) as string}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }, [
    currentTheme.colors.border,
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
    currentTheme.colors.textPrimary,
    currentTheme.colors.textSecondary,
    fetchChallenges,
    loadError,
    loading,
    t,
  ]);

  // Step copy (premium)
  const stepTitle = useMemo(() => {
    if (step === 1) return t("firstPick.step1.title", { defaultValue: "Commence ton aventure" }) as string;
    if (step === 2) return t("firstPick.step2.title", { defaultValue: "Solo ou Duo ?" }) as string;
    return t("firstPick.step3.title", { defaultValue: "Combien de temps peux-tu tenir ?" }) as string;
  }, [step, t]);

  // Step copy (premium)
const stepSubtitle = useMemo(() => {
  if (step === 1)
    return t("firstPick.step1.subtitle", {
      defaultValue: "Choisis ton premier challenge. Pas besoin de réfléchir trop longtemps.",
    }) as string;

  if (step === 2)
    return t("firstPick.step2.subtitle", {
      defaultValue: "En duo, tu tiens plus longtemps. Et c’est plus dur d’abandonner.",
    }) as string;

  // ✅ Step 3: dynamique selon la durée choisie (3-7-15-21-30-60-90-180-365)
  const byDays: Record<number, string> = {
    3: t("firstPick.step3.subtitleByDays.3", {
      defaultValue: "3 jours : mini sprint. Juste assez pour prouver que tu peux tenir.",
    }) as string,
    7: t("firstPick.step3.subtitleByDays.7", {
      defaultValue: "7 jours : parfait pour démarrer vite et prendre le rythme.",
    }) as string,
    15: t("firstPick.step3.subtitleByDays.15", {
      defaultValue: "15 jours : tu passes du “j’essaie” au “je le fais”.",
    }) as string,
    21: t("firstPick.step3.subtitleByDays.21", {
      defaultValue: "21 jours : tu construis une vraie routine solide.",
    }) as string,
    30: t("firstPick.step3.subtitleByDays.30", {
      defaultValue: "30 jours : objectif sérieux. Tu changes ton identité, pas juste ton humeur.",
    }) as string,
    60: t("firstPick.step3.subtitleByDays.60", {
      defaultValue: "60 jours : discipline réelle. Tu commences à devenir constant.",
    }) as string,
    90: t("firstPick.step3.subtitleByDays.90", {
      defaultValue: "90 jours : transformation. Là tu deviens quelqu’un qui finit.",
    }) as string,
    180: t("firstPick.step3.subtitleByDays.180", {
      defaultValue: "180 jours : gros engagement. Tu construis un standard de vie.",
    }) as string,
    365: t("firstPick.step3.subtitleByDays.365", {
      defaultValue: "365 jours : niveau élite. Tu ne fais plus un challenge, tu deviens ce challenge.",
    }) as string,
  };

  if (byDays[days]) return byDays[days];

  // ✅ fallback intelligent si un challenge a des durées custom
  if (days <= 7)
    return t("firstPick.step3.subtitleGeneric.short", {
      count: days,
      defaultValue: "{{count}} jours : court, clair, efficace. Lance-toi.",
    }) as string;

  if (days <= 30)
    return t("firstPick.step3.subtitleGeneric.medium", {
      count: days,
      defaultValue: "{{count}} jours : assez long pour ancrer l’habitude.",
    }) as string;

  if (days <= 90)
    return t("firstPick.step3.subtitleGeneric.long", {
      count: days,
      defaultValue: "{{count}} jours : engagement solide. Tu vas voir une vraie différence.",
    }) as string;

  return t("firstPick.step3.subtitleGeneric.ultra", {
    count: days,
    defaultValue: "{{count}} jours : engagement massif. C’est là que tu changes vraiment.",
  }) as string;
}, [step, days, t]);


 const progressText = useMemo(() => {
    // ✅ ultra court, jamais coupé, 100% responsive
    return t("firstPick.progressShort", {
      current: step,
      total: 3,
      defaultValue: "{{current}}/{{total}}",
    }) as string;
  }, [step, t]);

  // CTA label depends on step
  const ctaLabel = useMemo(() => {
    if (submitting) return t("common.loading", { defaultValue: "Chargement..." }) as string;

    if (step === 1) {
      return selected
        ? (t("firstPick.step1.cta", { defaultValue: "Suite" }) as string)
        : (t("firstPick.step1.ctaDisabled", { defaultValue: "Choisis" }) as string);
    }

    if (step === 2) {
      if (!selected) return t("firstPick.step2.ctaDisabled", { defaultValue: "Choisis" }) as string;
      if (mode === "duo" && isOffline) return t("firstPick.offlineDuoShort", { defaultValue: "Réseau" }) as string;
      return t("firstPick.step2.cta", { defaultValue: "Suite" }) as string;
    }

    // step 3
    if (!selected) return t("firstPick.step3.ctaDisabled", { defaultValue: "Choisis" }) as string;
    if (mode === "duo" && isOffline) return t("firstPick.offlineDuoShort", { defaultValue: "Réseau" }) as string;
    return t("firstPick.step3.cta", { defaultValue: "Go" }) as string;
  }, [mode, isOffline, selected, step, submitting, t]);

  const ctaDisabled =
    submitting ||
    !selected ||
    (mode === "duo" && isOffline) ||
    (step === 1 && !selected);

  const showBack = step !== 1;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Animated.View style={{ flex: 1, opacity: introOpacity, transform: [{ scale: introScale }] }}>
        <LinearGradient colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]} style={styles.container}>
          {isOffline && (
            <View
              pointerEvents="none"
              accessibilityLiveRegion="polite"
              style={[styles.offlineBanner, { top: Math.max(insets.top, 8) + 4 }]}
            >
              <Ionicons name="cloud-offline-outline" size={16} color={currentTheme.colors.textPrimary} />
              <Text style={[styles.offlineText, { color: currentTheme.colors.textPrimary }]}>
                {t("common.networkError", { defaultValue: "Problème de connexion" }) as string}
              </Text>
            </View>
          )}

          {/* Top bar: progress + optional back */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
            <View style={styles.topBarLeft}>
              {showBack ? (
                <TouchableOpacity
                  onPress={goBack}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back", { defaultValue: "Retour" }) as string}
                  style={styles.backBtn}
                  hitSlop={10}
                >
                  <Ionicons name="chevron-back" size={18} color={currentTheme.colors.secondary} />
                  <Text style={[styles.backText, { color: currentTheme.colors.secondary }]}>
                    {t("common.back", { defaultValue: "Retour" }) as string}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ height: 34 }} />
              )}
            </View>

            <View style={styles.topBarCenter}>
              <View
  style={[
    styles.progressPill,
    {
      backgroundColor: isDark ? DARK_PILL_BG : LIGHT_PILL_BG,
      borderColor: isDark ? DARK_PILL_BORDER : LIGHT_PILL_BORDER,
    },
  ]}
>
  <Text
    style={[
      styles.progressText,
      { color: isDark ? currentTheme.colors.textPrimary : INK },
    ]}
  >
    {progressText}
  </Text>
</View>

            </View>

            <View style={styles.topBarRight}>
              {/* keep small empty for symmetry */}
              <View style={{ width: 60 }} />
            </View>
          </View>

          {/* Step content */}
          <Animated.View style={{ flex: 1, opacity: stepOpacity, transform: [{ translateY: stepTranslate }] }}>
            {/* Header */}
            <View style={styles.header}>
              <Text
   numberOfLines={2}
   adjustsFontSizeToFit
   minimumFontScale={0.85}
   style={[styles.title, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}
 >
                {stepTitle}
              </Text>

              <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
                {stepSubtitle}
              </Text>
            </View>

            {/* Body */}
            <View style={{ flex: 1, width: "100%", paddingHorizontal: SPACING }}>
              {loading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
                </View>
              ) : (
                <>
                  {/* Step 1: choose challenge */}
                  {step === 1 && (
                    <>

                      <FlatList
                        ref={listRef}
                        key={isDark ? "list-dark" : "list-light"}
                        data={items}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: SPACING }}
                        contentContainerStyle={{ paddingBottom: SPACING, paddingTop: 4 }}
                        ListEmptyComponent={ListEmpty}
                        removeClippedSubviews
                        getItemLayout={getItemLayout}
                        windowSize={5}
                        initialNumToRender={6}
                        maxToRenderPerBatch={6}
                        updateCellsBatchingPeriod={60}
                        refreshControl={
                          <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={currentTheme.colors.secondary}
                          />
                        }
                      />

                      <TouchableOpacity
                        onPress={regenerateItems}
                        style={styles.discreetLinkBtn}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t("firstPick.step1.shuffleLink", { defaultValue: "Pas trouvé ? Montre-moi d’autres défis" }) as string}
                      >
                        <Text style={[styles.discreetLinkText, { color: currentTheme.colors.textSecondary }]}>
                          {t("firstPick.step1.shuffleLink", { defaultValue: "Pas trouvé ? Montre-moi d’autres défis" }) as string}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Step 2: choose mode */}
                  {step === 2 && (
   <View style={styles.step2Wrap}>

  {/* DUO HERO */}
  <Pressable
    onPress={() => onSelectMode("duo")}
    accessibilityRole="button"
    accessibilityState={{ selected: mode === "duo" }}
    accessibilityLabel={t("firstPick.modeDuo", { defaultValue: "Duo (recommandé)" }) as string}
    style={({ pressed }) => [
      styles.duoHero,
      {
        borderColor: mode === "duo" ? currentTheme.colors.secondary : currentTheme.colors.border,
        opacity: pressed ? 0.92 : 1,
      },
    ]}
  >
    <LinearGradient
      colors={
        isDark
          ? ["rgba(255,140,0,0.22)", "rgba(0,0,0,0.0)"]
          : ["rgba(255,140,0,0.26)", "rgba(255,255,255,0.0)"]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={styles.duoHeroTop}>
      <View style={styles.duoHeroIcon}>
        <Ionicons name="people" size={18} color="#000" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.duoHeroTitleRow}>
          <Text style={[styles.duoHeroTitle, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>
            {t("firstPick.step2.duoTitle", { defaultValue: "Duo" }) as string}
          </Text>

          <View
            style={[
              styles.duoHeroBadge,
              { backgroundColor: ORANGE, borderColor: "rgba(0,0,0,0.08)" },
            ]}
          >
            <Text style={styles.duoHeroBadgeText}>
              {t("common.recommended", { defaultValue: "Recommandé" }) as string}
            </Text>
          </View>
        </View>

        <Text
  numberOfLines={2}
  style={[
    styles.duoHeroDesc,
    { color: isDark ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.72)" },
  ]}
>
          {t("firstPick.step2.duoDesc", {
   defaultValue: "En duo, tu restes constant. Invite un ami juste après.",
 }) as string}

        </Text>
      </View>

      {mode === "duo" && (
        <View style={styles.duoHeroCheck}>
          <Ionicons name="checkmark" size={16} color="#000" />
        </View>
      )}
    </View>

    <View
      style={[styles.duoHeroOfflineRow, { opacity: isOffline ? 1 : 0 }]}
      pointerEvents="none"
      accessibilityElementsHidden={!isOffline}
      importantForAccessibility={isOffline ? "yes" : "no-hide-descendants"}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#F59E0B" />
      <Text style={styles.duoHeroOfflineText}>
       {t("firstPick.step2.duoOfflineLine", { defaultValue: "Connexion requise pour inviter." }) as string}
      </Text>
    </View>
    {mode === "duo" && (
      <Animated.View
        pointerEvents="none"
        style={[
         styles.swooshArt,
          {
            opacity: isDark ? 0.36 : 0.32,
            transform: [
              { translateX: duoSwooshX },
              { translateY: duoSwooshY },
              { scale: swooshScale },
              { rotate: swooshRotate },
            ],
          },
        ]}
      >
        <View style={styles.swooshLine} />
        <View style={styles.swooshIconsRow}>
          <Ionicons name="walk" size={18} color={ORANGE} />
          <Ionicons name="walk" size={18} color={ORANGE} />
        </View>
      </Animated.View>
    )}
  </Pressable>

  {/* SOLO SECONDARY */}
  <Pressable
    onPress={() => onSelectMode("solo")}
    accessibilityRole="button"
    accessibilityState={{ selected: mode === "solo" }}
    accessibilityLabel={t("firstPick.modeSolo", { defaultValue: "Solo" }) as string}
    style={({ pressed }) => [
      styles.soloSecondary,
      {
        borderColor: mode === "solo" ? currentTheme.colors.secondary : currentTheme.colors.border,
        backgroundColor: currentTheme.colors.cardBackground,
        opacity: pressed ? 0.92 : 1,
      },
    ]}
  >
      <LinearGradient
    colors={
      isDark
        ? ["rgba(255,255,255,0.06)", "rgba(0,0,0,0.0)"]
        : ["rgba(0,0,0,0.06)", "rgba(255,255,255,0.0)"]
    }
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={StyleSheet.absoluteFillObject}
  />

    <View style={styles.soloRow}>
      <View style={styles.soloIcon}>
        <Ionicons name="person" size={18} color="#000" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.soloTitle, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>
          {t("firstPick.step2.soloTitle", { defaultValue: "Solo" }) as string}
        </Text>
        <Text
  numberOfLines={2}
  style={[
    styles.soloDesc,
    { color: isDark ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.72)" },
  ]}
>
          {t("firstPick.step2.soloDesc", { defaultValue: "Démarrage immédiat, sans invitation." }) as string}
        </Text>
      </View>

      {mode === "solo" && (
        <View style={styles.soloCheck}>
          <Ionicons name="checkmark" size={16} color="#000" />
        </View>
      )}
    </View>
        {mode === "solo" && (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swooshArt,
          {
            opacity: isDark ? 0.34 : 0.30,
            transform: [
              { translateX: soloSwooshX },
              { translateY: soloSwooshY },
              { scale: swooshScale },
              { rotate: swooshRotate },
            ],
          },
        ]}
      >
        <View style={styles.swooshLine} />
        <View style={styles.swooshIconsRow}>
          <Ionicons name="body" size={18} color={currentTheme.colors.secondary} />
        </View>
      </Animated.View>
    )}

  </Pressable>

  {/* Hint ultra court */}
  <Text
  numberOfLines={2}
  style={[
    styles.modeHint,
    { color: isDark ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.60)" },
  ]}
>
  {modeHint}
</Text>
</View>

                  )}

                  {/* Step 3: duration */}
                  {step === 3 && (
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{
      flexGrow: 1,
      justifyContent: "center",
      paddingBottom: 8,
    }}
    showsVerticalScrollIndicator={false}
    bounces={false}
  >
    <View style={styles.step3Wrap}>
      {/* recap */}
      <View style={styles.step3Stack}>
        <View
          style={[
            styles.summaryCard,
            {
              borderColor: isDark ? currentTheme.colors.border : "rgba(0,0,0,0.10)",
              backgroundColor: isDark ? currentTheme.colors.cardBackground : "rgba(0,0,0,0.035)",
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,140,0,0.10)", "rgba(0,0,0,0.0)"]
                : ["rgba(255,140,0,0.14)", "rgba(255,255,255,0.0)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.summaryThumb}>
              <Image
                source={{ uri: selected?.imageUrl || FALLBACK_IMG }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={reduceMotion ? 0 : 120}
                cachePolicy="memory-disk"
              />
            </View>

            {/* ✅ ICI : plus de ScrollView, juste un View shrinkable */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={2}
                style={[styles.summaryTitle, { color: isDark ? currentTheme.colors.textPrimary : INK }]}
              >
                {selectedTitle}

              </Text>

              <Text
                numberOfLines={1}
                style={[styles.summarySub, { color: isDark ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.66)" }]}
              >
                {mode === "duo"
                  ? (t("firstPick.step3.recapDuo", { defaultValue: "Mode : Duo" }) as string)
                  : (t("firstPick.step3.recapSolo", { defaultValue: "Mode : Solo" }) as string)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {mode === "duo" && pendingInvite?.inviteId && (
  <View style={{
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,140,0,0.35)",
    backgroundColor: isDark ? "rgba(255,140,0,0.10)" : "rgba(255,140,0,0.12)",
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  }}>
    <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 14, color: isDark ? "#fff" : "#0B0F17" }}>
      {t("firstPick.invitePending.title", { defaultValue: "Invitation en attente" }) as string}
    </Text>
    <Text style={{ marginTop: 6, fontFamily: "Comfortaa_400Regular", fontSize: 12, lineHeight: 16, color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)" }}>
      {t("firstPick.invitePending.body", {
        defaultValue:
          "Ton ami n’a pas encore répondu. Tu peux renvoyer le lien, ou continuer et ça démarrera dès qu’il accepte.",
      }) as string}
    </Text>

    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
      <TouchableOpacity
        onPress={() => {
   userClosedInviteModalRef.current = false;
   setInviteModalVisible(true);
   track("first_pick_invite_pending_resend_tap", { ...baseCtx(), invite_id: pendingInvite.inviteId });
 }}
        style={{
          flex: 1,
          borderRadius: 14,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        }}
      >
         <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: isDark ? "#fff" : "#0B0F17" }}>
          {t("firstPick.invitePending.resend", { defaultValue: "Renvoyer" }) as string}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
         onPress={() => goHome({ pendingInviteId: pendingInvite.inviteId })}
         onPressIn={() => track("first_pick_invite_pending_continue_tap", { ...baseCtx(), invite_id: pendingInvite.inviteId })}
        style={{
          flex: 1,
          borderRadius: 14,
          paddingVertical: 12,
          alignItems: "center",
          backgroundColor: "#FF8C00",
        }}
      >
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: "#000" }}>
          {t("firstPick.invitePending.continue", { defaultValue: "Continuer" }) as string}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}


      <View
        style={[
          styles.daysCard,
          {
            borderColor: currentTheme.colors.border,
            backgroundColor: currentTheme.colors.cardBackground,
          },
        ]}
      >
        <Text style={[styles.daysLabel, { color: currentTheme.colors.textSecondary }]}>
  {t("firstPick.step3.durationLabel", { defaultValue: "Durée" }) as string}
</Text>

<View style={styles.chipsRow}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.chipsContent}
  >
    {availableDays.map((n) => {
      const active = n === days;
      return (
        <Pressable
          key={String(n)}
          onPress={() => onPickDays(n)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={t("firstPick.step3.durationA11y", {
            defaultValue: "Choisir {{count}} jours",
            count: n,
          }) as string}
          style={({ pressed }) => [
            styles.dayChip,
            {
              opacity: pressed ? 0.92 : 1,
              borderColor: active
                ? currentTheme.colors.secondary
                : currentTheme.colors.border,
              backgroundColor: active
                ? "rgba(255,140,0,0.18)"
                : isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.dayChipText,
              {
                color: active
                  ? (isDark ? currentTheme.colors.textPrimary : INK)
                  : currentTheme.colors.textSecondary,
              },
            ]}
          >
            {formatDaysChip(n)}
          </Text>

          {active && (
            <View style={styles.dayChipCheck}>
              <Ionicons name="checkmark" size={14} color="#000" />
            </View>
          )}
        </Pressable>
      );
    })}
  </ScrollView>
</View>

<View style={styles.durationRow}>
  <View
    style={[
      styles.durationPill,
      {
        borderColor: currentTheme.colors.border,
        backgroundColor: isDark
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.06)",
      },
    ]}
  >
    <Ionicons name="calendar-outline" size={14} color={currentTheme.colors.secondary} />
    <Text style={[styles.durationPillText, { color: isDark ? currentTheme.colors.textPrimary : INK }]}>
      {days === 1
        ? (t("firstPick.day_one", { count: days, defaultValue: "{{count}} jour" }) as string)
        : (t("firstPick.day_other", { count: days, defaultValue: "{{count}} jours" }) as string)}
    </Text>
  </View>
</View>

<Text style={[styles.durationNote, { color: currentTheme.colors.textSecondary }]}>
  {t("firstPick.step3.durationNote", { defaultValue: "Tu pourras toujours ajuster plus tard." }) as string}
</Text>

      </View>
   </View>
  </ScrollView>
)}

                </>
              )}
            </View>
          </Animated.View>

          {/* Footer sticky */}
          <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, SPACING) }]}>
            <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaPulse }] }]}>
              <TouchableOpacity
                onPress={goNext}
                disabled={ctaDisabled}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={ctaA11yLabel}
                accessibilityState={{ disabled: ctaDisabled }}
                testID="firstpick-cta"
                style={[styles.primaryCtaCompact, { opacity: ctaDisabled ? 0.62 : 1 }]}
              >
                {/* profondeur keynote */}
                <LinearGradient
                colors={[CTA_GRAD_A, CTA_GRAD_B]}
                // ✅ angle plus “cinema” (moins diagonal agressif)
                start={{ x: 0.08, y: 0.10 }}
                end={{ x: 0.92, y: 0.90 }}
                style={StyleSheet.absoluteFillObject}
              />

              {/* ✅ soft top sheen (plus une bande plate) */}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.ctaSheen}
              />

              {/* ✅ vignette légère pour profondeur (rend le gradient moins “dur”) */}
              <View pointerEvents="none" style={styles.ctaVignette} />

                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    {step === 2 && mode === "duo" && (
                      <View style={[styles.duoBadgeInline, isOffline && { opacity: 0.6 }]} accessible={false}>
                        <Ionicons name="people" size={12} color="#000" />
                        <Text numberOfLines={1} style={styles.duoBadgeInlineText}>
                          {t("firstPick.duoBadge", { defaultValue: "DUO" }) as string}
                        </Text>
                      </View>
                    )}

                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.primaryCtaTextCompact}>
                      {ctaLabel}
                    </Text>

                    <Ionicons name="arrow-forward" size={16} color="#000" />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

          </View>
        </LinearGradient>
      </Animated.View>

      <Modal
  visible={postShareVisible}
  transparent
  animationType="fade"
  onRequestClose={() => {}}
>
  <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 18 }}>
    <View
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: isDark ? "rgba(15,18,26,0.96)" : "rgba(255,255,255,0.96)",
      }}
    >
      <LinearGradient
        colors={isDark ? ["rgba(255,140,0,0.18)", "rgba(0,0,0,0.0)"] : ["rgba(255,140,0,0.18)", "rgba(255,255,255,0.0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 18 }}
      >
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 16, color: isDark ? "#fff" : INK }}>
          {postSharePhase === "ask"
            ? (t("firstPick.postShare.titleAsk", { defaultValue: "Invitation envoyée ?" }) as string)
            : (t("firstPick.postShare.titleFallback", { defaultValue: "Ok. Tu fais quoi maintenant ?" }) as string)}
        </Text>

        <Text style={{ marginTop: 8, fontFamily: "Comfortaa_400Regular", fontSize: 13, lineHeight: 18, color: isDark ? "rgba(255,255,255,0.74)" : "rgba(0,0,0,0.68)" }}>
          {postSharePhase === "ask"
            ? (t("firstPick.postShare.bodyAsk", {
                defaultValue:
                  "Android ne confirme pas toujours l’envoi. Dis-nous juste si tu as bien partagé le lien.",
              }) as string)
            : (t("firstPick.postShare.bodyFallback", {
                defaultValue: "Tu peux renvoyer tout de suite, ou basculer en solo pour démarrer maintenant.",
              }) as string)}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {postSharePhase === "ask" ? (
            <>
              <TouchableOpacity
                  disabled={postShareBusy}
                  onPress={async () => {
                  if (postShareBusy) return;
                  setPostShareBusy(true);
                  const inviteId = postShareInviteId || pendingInvite?.inviteId || null;
                  track("first_pick_invite_send_confirm", { ...baseCtx(), answer: "no", invite_id: inviteId });


                  setPostSharePhase("fallback");
                  userClosedInviteModalRef.current = true;

                  // delete server + cleanup local
                  if (inviteId) await deleteInvitationByIdSafe(inviteId);
                  await clearInviteSnapshot();
                  await setShareInProgress(false);
                  await clearHomePendingInvite();

                  setPendingInvite(null);
                  setPostShareInviteId(null);
                   setPostShareBusy(false);
                }}
                style={{
                  flex: 1,
                  opacity: postShareBusy ? 0.6 : 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
              >
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: isDark ? "#fff" : INK }}>
                  {t("firstPick.postShare.no", { defaultValue: "Je n’ai pas envoyé" }) as string}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={postShareBusy}
                onPress={async () => {
  if (postShareBusy) return;
  setPostShareBusy(true);

  const inviteId = postShareInviteId || pendingInvite?.inviteId || null;
  track("first_pick_invite_send_confirm", { ...baseCtx(), answer: "yes", invite_id: inviteId });

  // ✅ cleanup UI AVANT nav (anti Android remount/reopen)
  setPostShareVisible(false);
  setPostSharePhase("ask");
  setPostShareInviteId(null);
  setInviteModalVisible(false);

  // ✅ IMPORTANT : on neutralise toute persistance postShare qui pourrait survivre
  await AsyncStorage.removeItem(FIRSTPICK_POSTSHARE_KEY).catch(() => {});
  await setShareInProgress(false);

  try {
    if (inviteId) await goHome({ pendingInviteId: inviteId });
    else await goHome();
  } finally {
    setPostShareBusy(false);
  }
}}


                style={{
                  flex: 1,
                  opacity: postShareBusy ? 0.6 : 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#FF8C00",
                }}
              >
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: "#000" }}>
                  {t("firstPick.postShare.yesContinue", { defaultValue: "Oui, continuer" }) as string}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={async () => {
  if (!selected) return;
   track("first_pick_invite_resend_from_fallback", { ...baseCtx() });

  // ✅ reset UI
  setPostShareVisible(false);
  setPostSharePhase("ask");
  setPostShareInviteId(null);

  // ✅ force duo step3
  setMode("duo");
  setStep(3);

  // ✅ recrée un snapshot AVANT shareSheet (anti remount)
  await persistInviteSnapshot(undefined);

  userClosedInviteModalRef.current = false;
  setInviteModalVisible(true);
}}

                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
              >
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: isDark ? "#fff" : INK }}>
                  {t("firstPick.postShare.resend", { defaultValue: "Renvoyer" }) as string}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  // Solo => on délègue à ton flow existant (start_solo)
                  setPostShareVisible(false);
                  setPostSharePhase("ask");
                  track("first_pick_invite_switch_solo_from_fallback", { ...baseCtx() });
                  await handleInvitationResult("start_solo");
                }}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#FF8C00",
                }}
              >
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: 13, color: "#000" }}>
                  {t("firstPick.postShare.switchSolo", { defaultValue: "Passer en solo" }) as string}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  </View>
</Modal>


      <SendInvitationModal
        visible={inviteModalVisible}
        onClose={handleInviteDismiss}
        onSent={handleInvitationResult}
        challengeId={selected?.id || ""}
        selectedDays={days}
        challengeTitle={selectedTitle}
        isDuo={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  width: "100%",          // ✅ force largeur écran
  paddingTop: SPACING,
  alignItems: "stretch",  // ✅ empêche le shrink-to-fit
},
  // Top
  topBar: {
    width: "100%",
    paddingHorizontal: SPACING,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: { width: 110, alignItems: "flex-start" },
  topBarCenter: { flex: 1, alignItems: "center" },
  topBarRight: { width: 110, alignItems: "flex-end" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  backText: {
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
  },
  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
 daysCard: {
  borderWidth: 1,
  borderRadius: 18,
  padding: 16,
  width: "100%",
},
  progressText: {
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
  },

  offlineBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE68A",
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
  },

  // Header
  header: {
    width: "100%",
    paddingHorizontal: SPACING,
    marginBottom: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    width: "100%",
   alignSelf: "center",
paddingHorizontal: 0,  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 10,
    flexShrink: 1, 
  },

  // Step 1
  step1HeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 6,
  },
  shuffleBtn: {
    padding: 10,
    borderRadius: 999,
  },
  discreetLinkBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  discreetLinkText: {
    fontSize: 13,
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },

  // Cards
  cardOuter: {
    borderRadius: 18,
    borderWidth: 2,
   padding: 2, // espace ring
  },
  cardInner: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
  },
  step2Wrap: {
   flex: 1,
   justifyContent: "flex-start",
   paddingTop: 14,
   paddingBottom: 6,
 },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  cardLabelWrap: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  chipsRow: {
  width: "100%",
  marginTop: 6,
  marginBottom: 10,
},
chipsContent: {
  paddingVertical: 2,
  paddingRight: 6,
  gap: 10,
},
dayChip: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 10,
  minHeight: 44,
},
dayChipText: {
  fontSize: 13,
  lineHeight: 16,
  fontFamily: "Comfortaa_700Bold",
},
dayChipCheck: {
  width: 22,
  height: 22,
  borderRadius: 11,
  backgroundColor: "#FFD700",
  alignItems: "center",
  justifyContent: "center",
},

  summaryThumb: {
  width: 46,
  height: 46,
  borderRadius: 14,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.10)",
},
  cardTitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },
  cardCat: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
  },
  checkBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: GOLD,
    borderRadius: 14,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  step3Wrap: {
  flex: 1,
  justifyContent: "flex-start",
  paddingTop: 10,
  paddingBottom: 6,
},

step3Stack: {
  width: "100%",
  gap: 12,
},
  // Step 2
  selectedRecap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  duoHero: {
  borderWidth: 1,
  borderRadius: 24,
  minHeight: 150,   // au lieu de 132
  padding: 20,
  overflow: "hidden",
  marginTop: 4,
},
duoHeroTop: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
},
duoHeroIcon: {
  width: 44,
  height: 44,
  borderRadius: 16,
  backgroundColor: "#ed8f03",
  alignItems: "center",
  justifyContent: "center",
},
duoHeroTitleRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
},
duoHeroTitle: {
  fontSize: 22,
  fontFamily: "Comfortaa_700Bold",
},
duoHeroBadge: {
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  borderWidth: 1,
},
duoHeroBadgeText: {
  fontSize: 11,
  fontFamily: "Comfortaa_700Bold",
  color: "#000",
},
duoHeroDesc: {
  fontSize: 13,
  lineHeight: 18,
  fontFamily: "Comfortaa_400Regular",
  marginTop: 6,
},
duoHeroCheck: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "#FFD700",
  alignItems: "center",
  justifyContent: "center",
},
duoHeroOfflineRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginTop: 12,
   minHeight: 18,
},
duoHeroOfflineText: {
  fontSize: 12,
  fontFamily: "Comfortaa_700Bold",
  color: "#F59E0B",
},
soloSecondary: {
  borderWidth: 1,
  borderRadius: 24,      // ✅ comme DUO (premium)
  minHeight: 150,
  padding: 20,           // ✅ comme DUO
  marginTop: 10,         // ✅ espace un poil plus tight
  overflow: "hidden",    // ✅ FIX: empêche le swoosh de déborder (bordure parfaite)
  position: "relative",  // ✅ garantit le clipping propre
},
soloRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
},
soloIcon: {
  width: 44,             // ✅ aligné DUO
  height: 44,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#ed8f03", // ✅ même “surface premium” que DUO
},
soloTitle: {
  fontSize: 18,
  fontFamily: "Comfortaa_700Bold",
},
soloDesc: {
  fontSize: 13,
  lineHeight: 18,
  fontFamily: "Comfortaa_400Regular",
  marginTop: 4,
},
soloCheck: {
  width: 28,             // ✅ aligné DUO
  height: 28,
  borderRadius: 14,
  backgroundColor: "#FFD700",
  alignItems: "center",
  justifyContent: "center",
},
  selectedRecapText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Comfortaa_700Bold",
  },
  modeStack: {
    gap: 12,
    marginTop: 4,
  },
  modeCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  modeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modeCardLeft: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flex: 1,
  },
  modeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeTitle: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },
  modeDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
  },
  modeSelectedDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  recoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 215, 0, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.35)",
    maxWidth: 120,
  },
  recoBadgeText: {
    fontSize: 11,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFD700",
    letterSpacing: 0.2,
  },
  modeHint: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
     marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  modeWarningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  modeWarningText: {
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
    color: "#F59E0B",
  },

  // Step 3
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 10,   // au lieu de 12
  padding: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Comfortaa_700Bold",
  },
  summarySub: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 3,
  },
  daysRow: {
    width: "100%",
    marginTop: 4,
    marginBottom: 4,
  },
  daysLabel: {
    fontSize: 13,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 8,
  },
  durationNote: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 16,
  },
  durationRow: {
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 2,
},
durationPill: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 10,
  minHeight: 46,
},
durationPillText: {
  fontSize: 14,
  lineHeight: 18,
  textAlign: "center",
  fontFamily: "Comfortaa_700Bold",
},

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
    paddingHorizontal: 24,
    gap: 10,
  },
    swooshArt: {
    position: "absolute",
    right: -6,
   bottom: -6,
   width: 230,
   height: 92,
    justifyContent: "flex-end",
  },
  swooshLine: {
    position: "absolute",
    right: 14,
   bottom: 22,
   width: 175,
   height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,140,0,0.46)",
   transform: [{ rotate: "-10deg" }],
  },
  swooshIconsRow: {
    position: "absolute",
   right: 18,
   bottom: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyArt: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    marginBottom: 8,
  },
  emptyCta: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
  },
  emptyCtaBg: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyCtaText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING,
    paddingTop: 8,
    width: "100%",
    gap: 12,
  },
  ctaWrap: {
    flex: 1,
  },
  primaryCtaCompact: {
    minHeight: 70,          // ✅ plus massif
  borderRadius: 22,
  paddingVertical: 18,
  paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ORANGE,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
  shadowRadius: 10,
  elevation: 5,
   borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    width: "100%",
     overflow: "hidden",
  },
  ctaSheen: {
  ...StyleSheet.absoluteFillObject,
  // ✅ effet “verre” doux
  opacity: 0.9,
},

ctaVignette: {
  ...StyleSheet.absoluteFillObject,
  // ✅ micro vignette (pas visible comme une bande)
  backgroundColor: "rgba(0,0,0,0.06)",
},
  primaryCtaTextCompact: {
    color: "#000",
fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    minWidth: 0,
    flexShrink: 1,
  },
  duoBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#FFE8C2",
    marginRight: 2,
  },
  duoBadgeInlineText: {
    color: "#000",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    fontFamily: "Comfortaa_700Bold",
    textTransform: "uppercase",
  },
  skipBtnRow: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
  },
});
