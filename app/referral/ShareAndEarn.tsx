// app/referral/ShareAndEarn.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
} from "firebase/firestore";
import {
  buildAppLink,
  buildWebLink,
  getAppNameFallback,
} from "@/src/referral/links";
import { logEvent } from "@/src/analytics";
import { useFocusEffect } from "@react-navigation/native";
import { auth, db, app } from "@/constants/firebase-config";
import { useTranslation } from "react-i18next";
import { maybeAskForReview } from "@/src/services/reviewService";
import { tap, success } from "@/src/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "@/theme/designSystem";
import { getFunctions, httpsCallable } from "firebase/functions";

const REWARDS: Record<number, number> = { 5: 20, 10: 60, 25: 200 };
const MILESTONES = [5, 10, 25];
const P = 16;
const REF_STORAGE_KEY = "ties_referrer_id";

// Toast types
type ToastType = "success" | "error" | "info";
interface ToastState {
  type: ToastType;
  message: string;
}
const TOAST_DURATION = 2200;

type PendingReferrerState =
  | { status: "idle" }
  | { status: "pending"; referrerId: string; referrerUsername?: string }
  | { status: "linked"; referrerId: string; referrerUsername?: string };

export default function ShareAndEarn() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette = isDark
    ? designSystem.darkTheme.colors
    : designSystem.lightTheme.colors;

  const { width } = useWindowDimensions();
  const normalize = useCallback(
    (size: number) => {
      const baseWidth = 375;
      const scale = Math.min(Math.max(width / baseWidth, 0.7), 1.9);
      return Math.round(size * scale);
    },
    [width]
  );
  const styles = useMemo(() => makeStyles(normalize), [normalize]);

  const pageBgTop = isDark ? "#020617" : "#F3F4F6";
  const pageBgBottom = isDark ? palette.cardBackground : "#F9FAFB";
  const textPrimary = isDark ? palette.textPrimary : "#111827";
  const textSecondary = isDark ? palette.textSecondary : "rgba(15,23,42,0.7)";
  const cardBg = isDark ? "rgba(15,23,42,0.96)" : "#FFFFFF";
  const cardBorder = isDark
    ? "rgba(148,163,184,0.4)"
    : "rgba(15,23,42,0.08)";

  const me = auth.currentUser?.uid;
  const router = useRouter();

  const [activatedCount, setActivatedCount] = useState(0);
  const [claimed, setClaimed] = useState<number[]>([]);
  const [pending, setPending] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  

  // ✅ État parrain détecté côté filleul
  const [pendingReferrer, setPendingReferrer] = useState<PendingReferrerState>({
    status: "idle",
  });

  const [rewardBanner, setRewardBanner] = useState<{
    visible: boolean;
    amount: number;
  }>({ visible: false, amount: 0 });

  const bannerY = useRef(new Animated.Value(-80)).current;
  const [confetti, setConfetti] = useState<
    { id: number; x: number; y: number; char: string }[]
  >([]);
  const confettiId = useRef(0);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  const src = "settings_shareearn";
  const appLink = useMemo(() => (me ? buildAppLink(me, src) : ""), [me, src]);
  const webLink = useMemo(() => (me ? buildWebLink(me, src) : ""), [me, src]);

  const [linkMode, setLinkMode] = useState<"web" | "app">("web");
const activeLink = linkMode === "web" ? webLink : appLink;

  // === Toast premium ===
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(10)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);


  // 🔒 Monté/démonté pour éviter les setState inutiles
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

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
      isMountedRef.current = false;

      // Nettoyage des timers (toast, confettis, bannière)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

      // @ts-ignore RN compat
      sub?.remove?.();
    };
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      if (!isMountedRef.current) return;

      setToast({ type, message });

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      toastOpacity.setValue(0);
      toastTranslateY.setValue(10);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      toastTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: reduceMotion ? 0 : 220,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslateY, {
            toValue: 10,
            duration: reduceMotion ? 0 : 220,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMountedRef.current) return;
          setToast((current) =>
            current && current.message === message ? null : current
          );
        });
      }, TOAST_DURATION);
    },
    [reduceMotion, toastOpacity, toastTranslateY]
  );

  // ✅ Detect parrain (filleul)
  const fetchPendingReferrer = useCallback(async () => {
    if (!me || !isMountedRef.current) {
      if (isMountedRef.current) {
        setPendingReferrer({ status: "idle" });
      }
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(REF_STORAGE_KEY);
      const cleanStored = stored?.trim();

      const meRef = doc(db, "users", me);
      const meSnap = await getDoc(meRef);
      const meData = meSnap.exists() ? (meSnap.data() as any) : null;

      const linkedReferrerId = meData?.referrerId?.trim?.();

      // Cas 1 : déjà lié en base → on clear le storage, on affiche "linked"
      if (linkedReferrerId) {
        if (cleanStored && cleanStored === linkedReferrerId) {
          await AsyncStorage.multiRemove([
            "ties_referrer_id",
            "ties_referrer_src",
            "ties_referrer_ts",
          ]);
        }

        // fetch username du parrain si possible
        let refUsername: string | undefined;
        try {
          const refSnap = await getDoc(doc(db, "users", linkedReferrerId));
          if (refSnap.exists()) {
            const rd = refSnap.data() as any;
            refUsername =
              rd?.username || rd?.displayName || rd?.name || undefined;
          }
        } catch {}

        if (!isMountedRef.current) return;
        setPendingReferrer({
          status: "linked",
          referrerId: linkedReferrerId,
          referrerUsername: refUsername,
        });
        return;
      }

      // Cas 2 : storage existe mais pas encore lié → pending
      if (cleanStored) {
        let refUsername: string | undefined;
        try {
          const refSnap = await getDoc(doc(db, "users", cleanStored));
          if (refSnap.exists()) {
            const rd = refSnap.data() as any;
            refUsername =
              rd?.username || rd?.displayName || rd?.name || undefined;
          }
        } catch {}

        if (!isMountedRef.current) return;
        setPendingReferrer({
          status: "pending",
          referrerId: cleanStored,
          referrerUsername: refUsername,
        });
        return;
      }

      if (!isMountedRef.current) return;
      setPendingReferrer({ status: "idle" });
    } catch (e) {
      console.log("[referral] fetchPendingReferrer error:", e);
      if (!isMountedRef.current) return;
      setPendingReferrer({ status: "idle" });
    }
  }, [me]);

  const fetchStats = useCallback(async () => {
    try {
      if (!me) {
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const meRef = doc(db, "users", me);
      const meSnap = await getDoc(meRef);

      let serverCount: number | undefined;
      let serverClaimed: number[] = [];
      let serverPending: number[] = [];

            if (meSnap.exists()) {
        const data = meSnap.data() as any;

        // 🔎 Debug propre pour vérifier en prod ce que tu reçois
        console.log("[share] referral snapshot:", data?.referral);

        // 1) Lecture propre du compteur serveur
        serverCount =
          typeof data?.referral?.activatedCount === "number"
            ? data.referral.activatedCount
            : undefined;

        // 2) Fallback ultra safe : si pas de compteur mais une liste de filleuls existe
        const children = Array.isArray(data?.referral?.children)
          ? data.referral.children
          : [];

        if (typeof serverCount !== "number" && children.length > 0) {
          serverCount = children.length;
        }

        // 3) Milestones côté serveur
        serverClaimed = Array.isArray(data?.referral?.claimedMilestones)
          ? data.referral.claimedMilestones
          : [];

        serverPending = Array.isArray(data?.referral?.pendingMilestones)
          ? data.referral.pendingMilestones
          : [];

        if (isMountedRef.current) {
          setClaimed(serverClaimed);
          setPending(serverPending);
        }
      }


      if (typeof serverCount === "number") {
        if (isMountedRef.current) {
          setActivatedCount(serverCount);
        }

        try {
          const r = logEvent("share_open" as any);
          (r as any)?.catch?.(() => {});
        } catch {}
        return;
      }

      const qUsers = query(
        collection(db, "users"),
        where("referrerId", "==", me)
      );
      const snap = await getDocs(qUsers);

      const activated = snap.docs.filter((d) => {
        const u = d.data() as any;
        return u?.activated === true || u?.referralActivated === true;
      }).length;

      if (isMountedRef.current) {
        setActivatedCount(activated);
      }

      try {
        const r = logEvent("share_open" as any);
        (r as any)?.catch?.(() => {});
      } catch {}
    } catch (e: any) {
      console.log("[share] load error:", e?.message ?? e);
      if (isMountedRef.current) {
        showToast(
          "error",
          String(
            t("referral.share.errors.loadStats") || "Erreur de chargement"
          )
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [me, t, showToast]);

  const showRewardBanner = useCallback(
    (amount: number) => {
      if (!isMountedRef.current) return;

      setRewardBanner({ visible: true, amount });
      Animated.timing(bannerY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        Animated.timing(bannerY, {
          toValue: -80,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (!isMountedRef.current) return;
          setRewardBanner({ visible: false, amount: 0 });
        });
      }, 2200);
    },
    [bannerY]
  );

  const fireConfetti = useCallback(() => {
    if (!isMountedRef.current) return;

    const chars = ["🎉", "🎊", "🏆", "✨", "💥", "👏"];
    const baseWidth = Math.max(320, width - 40);
    const batch = Array.from({ length: 18 }).map(() => ({
      id: ++confettiId.current,
      x: Math.random() * baseWidth + 20,
      y: -20 - Math.random() * 40,
      char: chars[Math.floor(Math.random() * chars.length)],
    }));
    setConfetti(batch);

    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    confettiTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setConfetti([]);
    }, 1200);
  }, [width]);

 const claimMilestone = useCallback(
  async (m: number) => {
    if (!me) return;
    if (claimingMilestone === m) return; // déjà en cours pour ce palier

    try {
      setClaimingMilestone(m);
      const functions = getFunctions(app, "europe-west1");
      const callable = httpsCallable(functions, "claimReferralMilestone");
      await callable({ milestone: m });

      if (isMountedRef.current) {
        setLoading(true);
      }
      await fetchStats();

      const amount = REWARDS[m] ?? 0;
      success();
      showRewardBanner(amount);
      fireConfetti();

      try {
        const r = maybeAskForReview();
        (r as any)?.catch?.(() => {});
      } catch {}

      try {
        const r = logEvent("share_claim_success" as any, { milestone: m });
        (r as any)?.catch?.(() => {});
      } catch {}
    } catch (e: any) {
      const msg =
        e?.message?.includes("already_claimed")
          ? t("referral.share.errors.alreadyClaimed")
          : e?.message?.includes("not_reached")
          ? t("referral.share.errors.notReached")
          : e?.message?.includes("not_unlocked")
          ? t("referral.share.errors.notUnlocked")
          : t("referral.share.errors.claimFailed");

      showToast("error", String(msg));

      try {
        const r = logEvent("share_claim_error" as any, {
          milestone: m,
          error: String(e?.message || e),
        });
        (r as any)?.catch?.(() => {});
      } catch {}
    } finally {
      setClaimingMilestone(null);
    }
  },
  [me, fetchStats, t, showRewardBanner, fireConfetti, showToast, claimingMilestone]
);


  const renderConfetti = () =>
    confetti.map((c) => (
      <Animated.Text
        key={c.id}
        style={[
          styles.confetti,
          {
            left: c.x,
            top: c.y,
            fontSize: normalize(18 + Math.random() * 8),
            transform: [
              {
                translateY: bannerY.interpolate({
                  inputRange: [-80, 0],
                  outputRange: [0, 180 + Math.random() * 60],
                }),
              },
            ],
          },
        ]}
      >
        {c.char}
      </Animated.Text>
    ));

  // 🔁 Chargement sur focus (et 1er affichage)
  useFocusEffect(
    useCallback(() => {
      if (!me) {
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }
      if (isMountedRef.current) {
        setLoading(true);
      }
      fetchStats();
      fetchPendingReferrer();
    }, [fetchStats, fetchPendingReferrer, me])
  );

  const nextMilestone = useMemo(() => {
    for (const m of MILESTONES) if (activatedCount < m) return m;
    return null;
  }, [activatedCount]);

  const onCopy = async (text: string, kind: "app" | "web") => {
    tap();
    try {
      await Clipboard.setStringAsync(text);
      success();
      showToast(
        "success",
        String(
          t("referral.share.copiedMsg", {
            defaultValue: "Lien copié dans le presse-papiers",
          })
        )
      );
      try {
        const r = logEvent("share_link_copied", { kind });
        (r as any)?.catch?.(() => {});
      } catch {}
    } catch {}
  };

  const onNativeShare = async () => {
    tap();
    try {
      const appName = getAppNameFallback();

      // 1) Récupère la trad
      let message = t("referral.share.nativeShare.message", {
        appName,
        appLink,
        webLink,
      });

      // 2) Sécurise
      if (typeof message !== "string") {
        message = String(message ?? "");
      }

      // 3) Remplace "\n" textuels par vrais retours à la ligne
      message = message.replace(/\\n/g, "\n").trim();

      // 4) Fallback
      if (!message.length) {
        message = `${appName}\n\n${webLink}\n${appLink}`;
      }

      await Share.share({
        title: t("referral.share.nativeShare.title", { appName }),
        message,
      });

      success();
      try {
        const r = logEvent("share_native_opened");
        (r as any)?.catch?.(() => {});
      } catch {}
    } catch (e: any) {
      if (e?.message) console.log("Share error:", e.message);
    }
  };

  const Progress = ({ value, max }: { value: number; max: number }) => {
    const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
    return (
      <View
        style={[
          styles.progressWrap,
          {
            backgroundColor: isDark
              ? "rgba(148,163,184,0.18)"
              : "rgba(15,23,42,0.05)",
            borderColor: isDark
              ? "rgba(148,163,184,0.5)"
              : "rgba(15,23,42,0.12)",
          },
        ]}
        accessibilityRole={"progressbar" as any}
        accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}
      >
        <View
          style={[
            styles.progressBar,
            {
              width: `${pct * 100}%`,
              backgroundColor: palette.primary,
            },
          ]}
        />
      </View>
    );
  };

  const LinkRow = React.memo(function LinkRow({
    label,
    value,
    onCopyPress,
  }: {
    label: string;
    value: string;
    onCopyPress: () => void;
  }) {
    return (
      <View style={{ marginTop: 8 }}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: textSecondary }]}>{label}</Text>
          <TouchableOpacity
            style={[
              styles.copyBtn,
              {
                backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#FFE9A6",
                borderColor: isDark ? "rgba(148,163,184,0.7)" : "#FFB800",
              },
            ]}
            onPress={onCopyPress}
            accessibilityLabel={label}
            accessibilityRole="button"
          >
            <Ionicons
              name="copy-outline"
              size={normalize(16)}
              color={isDark ? "#F9FAFB" : "#111827"}
            />
            <Text
              style={[
                styles.copyTxt,
                { color: isDark ? "#F9FAFB" : "#111827" },
              ]}
            >
              {t("referral.share.copy")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          numberOfLines={2}
          selectable
          style={[styles.link, { color: textPrimary }]}
        >
          {value || "—"}
        </Text>
      </View>
    );
  });

  // 🔒 Cas non connecté
  if (!me) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: pageBgTop }]}
        edges={["top", "left", "right", "bottom"]}
      >
        <LinearGradient
          colors={[pageBgTop, pageBgBottom]}
          style={[styles.container, styles.center]}
        >
          <View
            style={[
              styles.card,
              {
                borderWidth: 1,
                borderColor: cardBorder,
                backgroundColor: cardBg,
                alignItems: "center",
                maxWidth: 340,
              },
            ]}
          >
            <View
              style={[
                styles.lockCircle,
                {
                  backgroundColor: isDark
                    ? "rgba(148,163,184,0.18)"
                    : "#FFF1C9",
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={normalize(24)}
                color={palette.primary}
              />
            </View>

            <Text
              style={[
                styles.title,
                { marginTop: 0, color: textPrimary, textAlign: "center" },
              ]}
            >
              {t("referral.share.auth.title", {
                defaultValue: "Connexion requise",
              })}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: textSecondary,
                  textAlign: "center",
                  marginTop: 6,
                },
              ]}
            >
              {t("referral.share.auth.subtitle", {
                defaultValue: "Connecte-toi pour accéder à Share & Earn.",
              })}
            </Text>

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={[
                styles.shareBtn,
                {
                  marginTop: 18,
                  backgroundColor: palette.primary,
                  borderColor: isDark ? "#020617" : "#111827",
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name="log-in-outline"
                size={normalize(16)}
                color={isDark ? "#020617" : "#111827"}
              />
              <Text
                style={[
                  styles.shareTxt,
                  { color: isDark ? "#020617" : "#111827" },
                ]}
              >
                {t("login", { defaultValue: "Se connecter" })}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: pageBgTop }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <LinearGradient
        colors={[pageBgTop, pageBgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.container}
      >
        {rewardBanner.visible && (
          <Animated.View
            style={[
              styles.banner,
              {
                transform: [{ translateY: bannerY }],
                backgroundColor: isDark ? "#020617" : "#0F172A",
                borderColor: palette.primary,
              },
            ]}
          >
            <Text style={[styles.bannerAmount, { color: palette.primary }]}>
              {t("referral.share.banner.amount", {
                amount: rewardBanner.amount,
              })}
            </Text>
            <Text style={styles.bannerMsg}>
              {t("referral.share.banner.message")}
            </Text>
          </Animated.View>
        )}

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {renderConfetti()}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
  <View style={styles.heroTopRow}>
    <View style={styles.heroIcon}>
      <Ionicons name="gift-outline" size={normalize(18)} color={palette.primary} />
    </View>

    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={[styles.heroTitle, { color: textPrimary }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {t("referral.share.title")}
      </Text>
      <Text
        style={[styles.heroSubtitle, { color: textSecondary }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {t("referral.share.subtitle")}
      </Text>
    </View>
  </View>

  <View style={styles.heroStatsRow}>
    <View style={[styles.statPill, { borderColor: cardBorder, backgroundColor: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.04)" }]}>
      <Text style={[styles.statLabel, { color: textSecondary }]} numberOfLines={1}>
        {t("referral.share.activatedReferrals")}
      </Text>
      <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1}>
        {loading ? "—" : String(activatedCount)}
      </Text>
    </View>

    <View style={[styles.statPill, { borderColor: cardBorder, backgroundColor: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.04)" }]}>
      <Text style={[styles.statLabel, { color: textSecondary }]} numberOfLines={1}>
        {t("referral.share.tipNext", {
          remaining: Math.max(0, (nextMilestone ?? 0) - activatedCount),
          milestone: nextMilestone ?? 0,
          defaultValue: "Prochain palier",
        })}
      </Text>
      <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1}>
        {nextMilestone ? `${nextMilestone}` : "✓"}
      </Text>
    </View>
  </View>
</View>


          {/* ✅ Bloc filleul : parrain détecté */}
          {pendingReferrer.status !== "idle" && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: isDark ? cardBorder : "#22C55E",
                  borderWidth: 1.5,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={[
                    styles.lockCircle,
                    {
                      width: normalize(40),
                      height: normalize(40),
                      borderRadius: normalize(20),
                      marginBottom: 0,
                      backgroundColor: isDark
                        ? "rgba(34,197,94,0.15)"
                        : "#DCFCE7",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      pendingReferrer.status === "pending"
                        ? "hourglass-outline"
                        : "checkmark-circle-outline"
                    }
                    size={normalize(20)}
                    color="#22C55E"
                  />
                </View>

                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: textPrimary, marginBottom: 2 },
                    ]}
                  >
                    {pendingReferrer.status === "pending"
                      ? t("referral.invited.title", {
                          defaultValue: "Invitation détectée 🎁",
                        })
                      : t("referral.invited.linkedTitle", {
                          defaultValue: "Parrainage activé ✅",
                        })}
                  </Text>

                  <Text style={[styles.micro, { color: textSecondary, marginTop: 0 }]} numberOfLines={3}>
                    {pendingReferrer.status === "pending"
                      ? t("referral.invited.body", {
                          defaultValue:
                            "Tu as été invité par un utilisateur. Ta récompense sera activée automatiquement après ton inscription.",
                        })
                      : t("referral.invited.linkedBody", {
                          defaultValue:
                            "Ton parrainage est lié. Merci d’avoir rejoint ChallengeTies !",
                        })}
                  </Text>

                  {!!pendingReferrer.referrerUsername && (
                    <Text
                      style={[
                        styles.micro,
                        { color: textPrimary, marginTop: 6 },
                      ]}
                      numberOfLines={1}
                    >
                      {t("referral.invited.by", {
                        defaultValue: "Parrain :",
                      })}{" "}
                      <Text style={{ fontWeight: "900" }}>
                        @{pendingReferrer.referrerUsername}
                      </Text>
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Liens de parrainage */}
          <View
  style={[
    styles.card,
    { backgroundColor: cardBg, borderColor: isDark ? cardBorder : "#FFB800" },
  ]}
>
  <View style={styles.cardHeaderRow}>
    <Text style={[styles.sectionTitle, { color: textPrimary }]}>
      {t("referral.share.linksTitle")}
    </Text>

     <View style={[styles.segment, { borderColor: cardBorder }]}>
      <TouchableOpacity
        onPress={() => setLinkMode("web")}
        style={[
          styles.segmentBtn,
          linkMode === "web" && { backgroundColor: palette.primary, borderColor: palette.primary },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Web link"
      >
        <Text
          style={[
            styles.segmentTxt,
            { color: linkMode === "web" ? (isDark ? "#020617" : "#111827") : textSecondary },
          ]}
          numberOfLines={1}
        >
          Web
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setLinkMode("app")}
        style={[
          styles.segmentBtn,
          styles.segmentBtnLast,
          linkMode === "app" && { backgroundColor: palette.primary, borderColor: palette.primary },
        ]}
        accessibilityRole="button"
        accessibilityLabel="App link"
      >
        <Text
          style={[
            styles.segmentTxt,
            { color: linkMode === "app" ? (isDark ? "#020617" : "#111827") : textSecondary },
          ]}
          numberOfLines={1}
        >
          App
        </Text>
      </TouchableOpacity>
    </View>
  </View>

  <View style={[styles.linkBox, { borderColor: cardBorder, backgroundColor: isDark ? "rgba(148,163,184,0.06)" : "rgba(15,23,42,0.02)" }]}>
    <Text
      selectable
      numberOfLines={2}
      ellipsizeMode="middle"
      style={[styles.linkMono, { color: textPrimary }]}
    >
      {activeLink || "—"}
    </Text>
  </View>

  <View style={styles.actionsRow}>
    <TouchableOpacity
      style={[
        styles.secondaryBtn,
        { borderColor: cardBorder, backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "rgba(15,23,42,0.03)" },
      ]}
      onPress={() => onCopy(activeLink, linkMode === "web" ? "web" : "app")}
      accessibilityRole="button"
    >
      <Ionicons name="copy-outline" size={normalize(16)} color={textPrimary} />
      <Text style={[styles.secondaryTxt, { color: textPrimary }]} numberOfLines={1}>
        {t("referral.share.copy")}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.primaryBtn,
        { backgroundColor: palette.primary, borderColor: isDark ? "#020617" : "#111827" },
      ]}
      onPress={onNativeShare}
      accessibilityRole="button"
    >
      <Ionicons
        name="share-social-outline"
        size={normalize(16)}
        color={isDark ? "#020617" : "#111827"}
      />
      <Text
        style={[
          styles.primaryTxt,
          { color: isDark ? "#020617" : "#111827" },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.9}
      >
        {t("referral.share.shareBtn")}
      </Text>
    </TouchableOpacity>
  </View>
</View>
{/* Rail CTA (ShareCard + Historique) */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              onPress={() => router.push("/referral/ShareCard")}
              style={[
                styles.ctaChip,
                {
                  backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#FFF1C9",
                  borderColor: isDark ? cardBorder : "#FFB800",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("referral.share.cardCta")}
              testID="open-share-card"
            >
              <Ionicons name="image-outline" size={normalize(16)} color={textPrimary} />
              <Text
                style={[styles.ctaChipTxt, { color: textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
              >
                {t("referral.share.cardCta")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/referral/History")}
              style={[
                styles.ctaChip,
                {
                  backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#FFF1C9",
                  borderColor: isDark ? cardBorder : "#FFB800",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("referral.share.historyCta")}
              testID="open-referral-history"
            >
              <Ionicons name="people-outline" size={normalize(16)} color={textPrimary} />
              <Text
                style={[styles.ctaChipTxt, { color: textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
              >
                {t("referral.share.historyCta")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats & paliers */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: isDark ? cardBorder : "#FFB800",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              {t("referral.share.statsTitle")}
            </Text>

            {loading ? (
              <View
                style={styles.skeletonRow}
                accessible
                accessibilityLabel={t("loading", {
                  defaultValue: "Chargement",
                })}
              >
                <View
                  style={[
                    styles.skeletonDot,
                    {
                      backgroundColor: isDark
                        ? "rgba(148,163,184,0.5)"
                        : "#EEE2B7",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonBar,
                    {
                      backgroundColor: isDark
                        ? "rgba(148,163,184,0.25)"
                        : "#F5E4B5",
                    },
                  ]}
                />
              </View>
            ) : (
             <Text style={[styles.micro, { color: textSecondary }]} numberOfLines={2}>
                {t("referral.share.activatedReferrals")}:{" "}
                <Text style={{ fontWeight: "900", color: textPrimary }}>{activatedCount}</Text>
              </Text>

            )}

            {!!nextMilestone && !loading && (
              <>
                <Progress value={activatedCount} max={nextMilestone} />
                <Text style={[styles.micro, { color: textSecondary }]} numberOfLines={2}>
                  {t("referral.share.tipNext", {
                    remaining: Math.max(0, nextMilestone - activatedCount),
                    milestone: nextMilestone,
                  })}
                </Text>
              </>
            )}

            {!nextMilestone && !loading && (
              <Text style={[styles.micro, { color: textSecondary }]} numberOfLines={2}>
                {t("referral.share.tipAllReached")}
              </Text>
            )}

            <View style={styles.milestones}>
              {MILESTONES.map((m) => {
                const reached = activatedCount >= m;
                const isClaimed = claimed.includes(m);
                const isPending = pending.includes(m);

                const isClaimable =
                  reached && !isClaimed && (isPending || pending.length === 0);

                const bg = isClaimed
                  ? "#DCFCE7"
                  : reached
                  ? "#D9F99D"
                  : isDark
                  ? "rgba(15,23,42,0.9)"
                  : "#FFF1C9";

                const border = isClaimed
                  ? "#22C55E"
                  : reached
                  ? "#65A30D"
                  : "#FFB800";

                const textColor = isClaimed
                  ? "#14532D"
                  : reached
                  ? "#2D5900"
                  : "#7C5800";

                return (
                  <View
                    key={m}
                    style={[
                      styles.milestone,
                      { borderColor: border, backgroundColor: bg },
                    ]}
                  >
                    <Text
                      style={[styles.milestoneTxt, { color: textColor }]}
                    >
                      {t("referral.share.milestoneLabel", { count: m })}
                      {isClaimed ? " ✅" : ""}
                    </Text>

                    {isClaimable && (
                      <TouchableOpacity
  style={styles.claimBtn}
  onPress={() => claimMilestone(m)}
  disabled={claimingMilestone === m || loading}
  accessibilityRole="button"
  accessibilityLabel={t("referral.share.claim")}
>
                        <Text style={styles.claimTxt}>
                          {t("referral.share.claim")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

        </ScrollView>

        {/* Toast premium bottom */}
        {toast && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastContainer,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.toastInner,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "error" && styles.toastError,
                toast.type === "info" && styles.toastInfo,
              ]}
            >
              <Text style={styles.toastIcon}>
                {
                  {
                    success: "✅",
                    error: "⚠️",
                    info: "ℹ️",
                  }[toast.type]
                }
              </Text>
              <Text style={styles.toastText} numberOfLines={3}>
                {toast.message}
              </Text>
            </View>
          </Animated.View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const makeStyles = (normalize: (n: number) => number) =>
  StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scrollContent: {
  padding: P,
  paddingBottom: P * 4,
  paddingTop: P,
  alignSelf: "center",
  width: "100%",
  maxWidth: 520, // ✅ iPad / grands écrans = clean
},
hero: {
  borderRadius: 20,
  padding: P,
  marginTop: 6,
  borderWidth: 1,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 5,
},
heroTopRow: {
  flexDirection: "row",
  alignItems: "center",
  columnGap: 12,
},
segmentBtnLast: {
      borderRightWidth: 0,
    },
heroIcon: {
  width: 40,
  height: 40,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,184,0,0.14)",
  borderWidth: 1,
  borderColor: "rgba(255,184,0,0.25)",
},

heroTitle: {
  fontSize: normalize(18),
  fontWeight: "900",
  letterSpacing: -0.2,
},

heroSubtitle: {
  fontSize: normalize(12),
  fontWeight: "600",
  marginTop: 2,
},

heroStatsRow: {
  flexDirection: "row",
  columnGap: 10,
  marginTop: 12,
},

statPill: {
  flex: 1,
  minWidth: 0,
  borderWidth: 1,
  borderRadius: 16,
  paddingVertical: 10,
  paddingHorizontal: 12,
},

statLabel: {
  fontSize: normalize(11),
  fontWeight: "700",
  marginBottom: 2,
},

statValue: {
  fontSize: normalize(16),
  fontWeight: "900",
},

card: {
  borderRadius: 20,
  padding: P,
  borderWidth: 1,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 4,
  marginTop: P,
},

sectionTitle: {
  fontSize: normalize(14),
  fontWeight: "900",
  letterSpacing: -0.1,
},

micro: {
  fontSize: normalize(12),
  fontWeight: "600",
  marginTop: 6,
},

cardHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: 10,
},

segment: {
  flexDirection: "row",
  borderRadius: 999,
  borderWidth: 1,
  overflow: "hidden",
},

segmentBtn: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRightWidth: 1,
},

segmentTxt: {
  fontSize: normalize(11),
  fontWeight: "900",
},

linkBox: {
  marginTop: 10,
  borderRadius: 16,
  borderWidth: 1,
  paddingHorizontal: 12,
  paddingVertical: 10,
},

linkMono: {
  fontSize: normalize(12),
  fontWeight: "700",
},

actionsRow: {
  flexDirection: "row",
  columnGap: 10,
  marginTop: 12,
},

secondaryBtn: {
  flex: 1,
  minWidth: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  columnGap: 8,
  paddingVertical: 12,
  borderRadius: 999,
  borderWidth: 1,
},

secondaryTxt: {
  fontSize: normalize(12),
  fontWeight: "900",
  flexShrink: 1,
  minWidth: 0,
},
title: { display: "none" as any },      // (plus utilisé)
    subtitle: { display: "none" as any },   // (plus utilisé)
    tip: { display: "none" as any }, 
primaryBtn: {
  flex: 1,
  minWidth: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  columnGap: 8,
  paddingVertical: 12,
  borderRadius: 999,
  borderWidth: 1.5,
},

primaryTxt: {
  fontSize: normalize(12),
  fontWeight: "900",
  flexShrink: 1,
  minWidth: 0,
},

ctaRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  columnGap: 10,
  rowGap: 10,
  marginTop: P,
},

ctaChip: {
  flexGrow: 1,
  flexBasis: "48%",
  minWidth: 160,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  columnGap: 8,
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
},

ctaChipTxt: {
  fontSize: normalize(12),
  fontWeight: "900",
  flexShrink: 1,
  minWidth: 0,
},


    center: { alignItems: "center", justifyContent: "center" },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    label: { fontSize: normalize(13) },
    link: {
      fontSize: normalize(11),
      opacity: 0.95,
      marginTop: 2,
    },

    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    copyTxt: {
      fontWeight: "700",
      fontSize: normalize(12),
      marginLeft: 6,
    },

    shareBtn: {
      marginTop: 10,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
    },
    shareTxt: {
      fontWeight: "800",
      marginLeft: 8,
      fontSize: normalize(13),
    },

    cardCta: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      marginTop: P,
    },
    cardCtaTxt: {
      fontWeight: "800",
      marginLeft: 8,
      fontSize: normalize(13),
    },
    milestones: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 10,
    },
    milestone: {
  flexDirection: "row",           // 👉 texte + bouton sur une ligne
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  marginRight: 8,
  marginBottom: 8,
},
 milestoneTxt: {
  fontSize: normalize(11),
  fontWeight: "800",
  flexShrink: 1,                  // évite que le texte prenne tout l’espace
},
   claimBtn: {
  marginLeft: 10,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "#111827",
  backgroundColor: "#111827",     // 👉 bouton sombre, bien séparé du badge
  // légère ombre pour donner un côté premium
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 4,
  elevation: 3,
},

claimTxt: {
  fontWeight: "900",
  color: "#F9FAFB",               // texte blanc sur bouton sombre
  fontSize: normalize(11),
},

    skeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      marginTop: 6,
    },
    skeletonDot: { width: 14, height: 14, borderRadius: 7 },
    skeletonBar: { flex: 1, height: 12, borderRadius: 6, marginLeft: 10 },

    progressWrap: {
      height: 10,
      borderRadius: 999,
      overflow: "hidden",
      borderWidth: 1,
      marginTop: 8,
    },
    progressBar: { height: "100%" },

    banner: {
      position: "absolute",
      top: 12,
      left: 12,
      right: 12,
      borderWidth: 2,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      zIndex: 99,
    },
    bannerAmount: {
      fontWeight: "900",
      fontSize: normalize(15),
    },
    bannerMsg: {
      color: "#F9FAFB",
      marginTop: 2,
      fontWeight: "600",
      fontSize: normalize(12),
    },

    confetti: {
      position: "absolute",
    },

    lockCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    // Toast
    toastContainer: {
      position: "absolute",
      left: P,
      right: P,
      bottom: P * 2.5,
      alignItems: "center",
      justifyContent: "center",
    },
    toastInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(15,23,42,0.95)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    toastText: {
      marginLeft: 8,
      fontSize: normalize(12),
      fontWeight: "700",
      color: "#F9FAFB",
      flexShrink: 1,
    },
    toastSuccess: {
      backgroundColor: "#16A34A",
    },
    toastError: {
      backgroundColor: "#DC2626",
    },
    toastInfo: {
      backgroundColor: "#0F172A",
    },
    toastIcon: {
      fontSize: normalize(14),
      color: "#F9FAFB",
    },
  });
