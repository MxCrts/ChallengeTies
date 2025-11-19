import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Animated,
  AccessibilityInfo,
  Pressable,
  Platform,
  Image as RNImage,
} from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import SendInvitationModal from "@/components/SendInvitationModal";
import InfoDuoModal from "@/components/InfoDuoModal";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { RefreshControl } from "react-native";
import { useWindowDimensions } from "react-native";
// ✅ métriques & succès (comme sur challenge-details)
import { recordSelectDays } from "../src/services/metricsService";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { canInvite } from "@/utils/canInvite";
import { useTutorial } from "../context/TutorialContext";

const SPACING = 16;

type Challenge = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  chatId?: string;
  daysOptions?: number[];
};

const DEFAULT_DAYS = [7, 14, 21, 30, 60, 90];
const ORANGE = "#FF8C00";
const FALLBACK_IMG = RNImage.resolveAssetSource(
   require("../assets/images/fallback-card.png")
 ).uri;


export default function FirstPick() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
 const CARD_W = useMemo(() => (width - SPACING * 3) / 2, [width]);
 const CARD_H = useMemo(() => Math.min(220, height * 0.28), [height]);


  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [infoDuoVisible, setInfoDuoVisible] = useState(false);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
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

  const router = useRouter();
  const { takeChallenge } = useCurrentChallenges();
  const { startTutorial, skipTutorial } = useTutorial();

  // Fade-in d'écran (désactivé si reduce motion)
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.985)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  const [mode, setMode] = useState<"none" | "duo" | "solo">("none");
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<Challenge[]>([]);
  const [items, setItems] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_DAYS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const nav = useRootNavigationState();
  const pendingNavRef = useRef<null | { pathname: string; params?: any }>(null);

  const daysArray = selected?.daysOptions?.length ? selected.daysOptions : DEFAULT_DAYS;
const daysRows = useMemo(() => {
  const cols = 3;
  const chunks: number[][] = [];
  for (let i = 0; i < daysArray.length; i += cols) {
    chunks.push(daysArray.slice(i, i + cols));
  }
  return chunks;
}, [daysArray, selected?.id]);

  const safeReplace = useCallback(
    (to: { pathname: string; params?: any }) => {
      if (nav?.key) router.replace(to);
      else pendingNavRef.current = to;
    },
    [nav?.key, router]
  );

  const getItemLayout = useCallback(
  (_: any, index: number) => {
    // hauteur carte + marginBottom du columnWrapperStyle
    const row = Math.floor(index / 2);
    const rowHeight = CARD_H + SPACING; // SPACING = marginBottom
    return { length: rowHeight, offset: row * rowHeight, index };
  },
  [CARD_H]
);

  useEffect(() => {
    if (nav?.key && pendingNavRef.current) {
      router.replace(pendingNavRef.current);
      pendingNavRef.current = null;
    }
  }, [nav?.key, router]);

  // Lancement du fade-in
  useEffect(() => {
    if (reduceMotion) {
      introOpacity.setValue(1);
      introScale.setValue(1);
      return;
    }
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(introOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(introScale, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();

    }, 0);
    return () => clearTimeout(t);
  }, [reduceMotion, introOpacity, introScale]);

  // Micro-animation CTA quand “prêt”
  useEffect(() => {
    if (reduceMotion) return;
    let loop: Animated.CompositeAnimation | null = null;
    const ready = mode !== "none" && !!selected && !submitting && !isOffline;
    if (ready) {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.03, duration: 650, useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [mode, selected, submitting, isOffline, reduceMotion]);

  const handleInviteDismiss = () => setInviteModalVisible(false);

  // Récup challenges approuvés
  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isOffline) throw new Error("offline");
      const qRef = query(collection(db, "challenges"), where("approved", "==", true));
      const snap = await getDocs(qRef);

      const list: Challenge[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          title: data?.chatId ? (data?.title || data?.chatId) : (data?.title || t("common.challenge")),
          description: data?.description || "",
          category: data?.category || t("common.misc"),
          imageUrl: data?.imageUrl || "https://via.placeholder.com/600x400",
          chatId: data?.chatId || d.id,
          daysOptions: Array.isArray(data?.daysOptions) && data.daysOptions.length ? data.daysOptions : DEFAULT_DAYS,
        };
      });

      setPool(list);
      // ⚡ Prefetch rapide des premiers visuels pour un rendu instantané
      const prefetchTargets = list.slice(0, 8).map((c) => c.imageUrl!).filter(Boolean);
      if (prefetchTargets.length) {
        // on ne bloque pas l’UI : fire and forget
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

  // Échantillon : 1 aléatoire par catégorie (max 6)
useEffect(() => {
  if (!pool.length) {
    setItems([]);
    return;
  }

  const byCat: Record<string, Challenge[]> = {};
  for (const c of pool) {
    const cat = c.category || "Divers";
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

  setItems(sampled);

  // si l'élément sélectionné n'est plus dans l'échantillon, on le désélectionne
  setSelected((prev) => (prev && !sampled.find((s) => s.id === prev.id) ? null : prev));
}, [pool]); // ✅ uniquement pool


  // ⚡ Prefetch des visuels des cartes effectivement affichées (échantillon actuel)
  useEffect(() => {
    if (!items?.length) return;
    const targets = items.map((c) => c.imageUrl!).filter(Boolean);
    Promise.allSettled(targets.map((u) => RNImage.prefetch(u))).catch(() => {});
  }, [items]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChallenges();
  }, [fetchChallenges]);

  // ✅ Helper : valider le choix et lancer le tutoriel sur la Home
  const goHomeAndStartTutorial = useCallback(async () => {
    await AsyncStorage.setItem("firstPickDone", "1");
    startTutorial();              // active overlay + step 0 (welcome)
    safeReplace({ pathname: "/" });
  }, [safeReplace, startTutorial]);

  // ⏭️ Ignorer le FirstPick et marquer le tuto comme complété (pas d’overlay)
  const onSkip = async () => {
    await AsyncStorage.setItem("firstPickSkipped", "1");
    skipTutorial();               // désactive le tuto et pose le flag "done"
    safeReplace({ pathname: "/" });
  };

  const handleInvitationSent = async () => {
    setInviteModalVisible(false);
    await goHomeAndStartTutorial();
  };

  const handleCloseInviteModal = async () => {
    setInviteModalVisible(false);
    await goHomeAndStartTutorial();
  };

  const onConfirm = async () => {
    if (submittingRef.current || submitting) return;
    if (!selected) {
      Alert.alert(t("firstPick.alert.missingChoiceTitle"), t("firstPick.alert.missingChoiceBody"));
      return;
    }
    if (mode === "none") {
      Alert.alert(t("firstPick.alert.modeTitle"), t("firstPick.alert.modeBody"));
      return;
    }
    // 🚫 Duo impossible hors-ligne (création d'invite = réseau requis)
    if (mode === "duo" && isOffline) {
      Alert.alert(
        t("common.networkError"),
        t("firstPick.offlineDuo") || "Connecte-toi à Internet pour inviter un ami en duo."
      );
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
        description: selected.description || data?.description || "",
        daysOptions: selected.daysOptions || data?.daysOptions || DEFAULT_DAYS,
        chatId: selected.chatId || selected.id,
        imageUrl: selected.imageUrl || data?.imageUrl || "",
      };

      if (mode === "solo") {
        await takeChallenge(challengeObj, days);
        // 🏅 Stats & succès alignés sur challenge-details
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
        await goHomeAndStartTutorial();
        return;
      }

      if (mode === "duo") {
  const res = await canInvite(selected.id);
  if (!res.ok) {
    const msg =
      res.reason === "pending-invite"
        ? t("firstPick.alreadyInvited") || "Invitation déjà envoyée pour ce défi."
        : t("common.oops");
    Alert.alert(t("common.info"), msg);
    return;
  }
  setInfoDuoVisible(true);
  return;
}

    } catch (e: any) {
      console.error("first-pick confirm error", e);
      Alert.alert(t("common.error"), e?.message || t("common.oops"));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ---- UI helpers
  const onSelectCard = useCallback(async (item: Challenge) => {
    setSelected(item);
    const opts = item.daysOptions?.length ? item.daysOptions : DEFAULT_DAYS;
    setDays(opts[0]);
    try { await Haptics.selectionAsync(); } catch {}
  }, []);

  const onSelectMode = useCallback(async (m: "duo" | "solo") => {
    setMode(m);
    try { await Haptics.selectionAsync(); } catch {}
  }, []);

  const onSelectDay = useCallback(async (d: number) => {
    setDays(d);
    try { await Haptics.selectionAsync(); } catch {}
  }, []);

  // ---- Card subcomponent (mémoïsé)
  const Card = React.memo(({ item, isSel, onPress }:{
   item: Challenge; isSel: boolean; onPress: () => void;
 }) => {
  const [imgUri, setImgUri] = useState<string>(item.imageUrl || FALLBACK_IMG);

    // Si la source change (reshuffle / fetch), on réinitialise
    useEffect(() => {
      setImgUri(item.imageUrl || FALLBACK_IMG);
    }, [item.imageUrl]);
      const scale = useRef(new Animated.Value(1)).current;
      useEffect(() => {
        if (reduceMotion) return;
        Animated.spring(scale, {
          toValue: isSel ? 1.02 : 1,
          speed: 12,
          bounciness: 6,
          useNativeDriver: true,
        }).start();
       }, [isSel]);
      return (
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={[
   styles.card,
   { width: CARD_W, height: CARD_H, borderColor: isSel ? currentTheme.colors.secondary : currentTheme.colors.border,
     backgroundColor: currentTheme.colors.cardBackground }
 ]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={t("firstPick.cardHint") || undefined}
          >

            {/* HALO SÉLECTION */}
  {isSel && (
    <View
      pointerEvents="none"
      style={[
        styles.cardSelectionHalo,
        { borderColor: currentTheme.colors.secondary },
      ]}
    />
  )}
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
                {item.title}
              </Text>
              <Text numberOfLines={1} style={[styles.cardCat, { color: "#ddd" }]}>
                {item.category}
              </Text>
            </View>
            {isSel && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={18} color="#000" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
  });

  const renderItem = useCallback(
    ({ item }: { item: Challenge }) => {
      const isSel = selected?.id === item.id;
      return <Card item={item} isSel={isSel} onPress={() => onSelectCard(item)} />;
    },
    [onSelectCard, selected?.id]
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
          {t("firstPick.emptyTitle") || "No challenges yet"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: currentTheme.colors.textSecondary }]}>
          {loadError || t("firstPick.emptySubtitle") || "Pull to refresh or try again."}
        </Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(()=>{}); fetchChallenges(); }}
          android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: false }}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
          style={({ pressed }) => [
            styles.emptyCta,
            { opacity: pressed ? 0.9 : 1, borderColor: currentTheme.colors.border }
          ]}
        >
          <LinearGradient
            colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyCtaBg}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>{t("common.retry")}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }, [currentTheme.colors.border, currentTheme.colors.primary, currentTheme.colors.secondary, currentTheme.colors.textPrimary, currentTheme.colors.textSecondary, fetchChallenges, loadError, loading, t]);

const blurhash = useMemo(
    () =>
      {
        return "LEHV6nWB2yk8pyo0adR*.7kCMdnj"; 
      },
    []
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Animated.View
        style={{ flex: 1, opacity: introOpacity, transform: [{ scale: introScale }] }}
      >
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
          style={styles.container}
        >
          {isOffline && (
   <View
     pointerEvents="none"
     accessibilityLiveRegion="polite"
     style={[styles.offlineBanner, { top: Math.max(insets.top, 8) + 4 }]}
   >
              <Ionicons name="cloud-offline-outline" size={16} color={currentTheme.colors.textPrimary} />
              <Text style={[styles.offlineText, { color: currentTheme.colors.textPrimary }]}>
                {t("common.networkError")}
              </Text>
            </View>
          )}
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
              {t("firstPick.title")}
            </Text>
            <TouchableOpacity
   onPress={() => {
    // reshuffle localement sans réseau
     setItems(prev => [...prev].sort(() => Math.random() - 0.5));
     try { Haptics.selectionAsync(); } catch {}
   }}
   accessibilityLabel={t("common.shuffle") || "Mélanger"}
   style={{ padding: 8, marginTop: 8 }}
 >
   <Ionicons name="shuffle" size={18} color={currentTheme.colors.secondary} />
 </TouchableOpacity>
            <Text style={[styles.subtitle, { color: isDark ? currentTheme.colors.textSecondary : ORANGE }]}>
              {t("firstPick.subtitle")}
            </Text>

            {/* Mode Pills */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                onPress={() => onSelectMode("duo")}
                accessibilityState={{ selected: mode === "duo" }}
                activeOpacity={0.9}
                style={[
                  styles.modeCta,
                  {
                    borderColor: mode === "duo" ? currentTheme.colors.secondary : currentTheme.colors.border,
                    backgroundColor: mode === "duo" ? "rgba(255,255,255,0.08)" : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("firstPick.modeDuo")}
              >
                <Ionicons name="people-outline" size={18} color={currentTheme.colors.secondary} />
                <Text style={[styles.modeCtaText, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
                  {t("firstPick.modeDuo")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSelectMode("solo")}
                accessibilityState={{ selected: mode === "solo" }}
                activeOpacity={0.9}
                style={[
                  styles.modeCta,
                  {
                    borderColor: mode === "solo" ? currentTheme.colors.secondary : currentTheme.colors.border,
                    backgroundColor: mode === "solo" ? "rgba(255,255,255,0.08)" : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("firstPick.modeSolo")}
              >
                <Ionicons name="person-outline" size={18} color={currentTheme.colors.secondary} />
                <Text style={[styles.modeCtaText, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
                  {t("firstPick.modeSolo")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Corps: grille + sélecteur de jours */}
          <View style={{ flex: 1, width: "100%", paddingHorizontal: SPACING }}>
            {loading ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
              </View>
            ) : (
              <>
                <FlatList
                  key={isDark ? "list-dark" : "list-light"}
                  data={items}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: "space-between", marginBottom: SPACING }}
                  contentContainerStyle={{ paddingBottom: SPACING, paddingTop: 4 }}
                  ListHeaderComponent={
                    <View style={{ paddingBottom: 8 }}>
                    </View>
                  }
                  stickyHeaderIndices={[]}
                  ListEmptyComponent={ListEmpty}
                  removeClippedSubviews
                  getItemLayout={getItemLayout}
                  windowSize={5}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  updateCellsBatchingPeriod={60}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.colors.secondary} />}
                />

                {/* Sélecteur de jours */}
<View style={styles.daysRow}>
  <Text style={[styles.daysLabel, { color: currentTheme.colors.textSecondary }]}>
    {t("firstPick.durationLabel")}
  </Text>

  <View style={styles.daysGrid}>
    {daysRows.map((row, ri) => (
      <View key={`row-${ri}`} style={styles.pillRow}>
        {row.map((d, ci) => {
          const active = days === d;
          return (
            <Pressable
              key={d}
              onPress={() => onSelectDay(d)}
              android_ripple={Platform.OS === "android" ? { color: "rgba(255,255,255,0.06)", borderless: false } : undefined}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[
                styles.dayPill,
                {
                  borderColor: active ? currentTheme.colors.secondary : currentTheme.colors.border,
                  backgroundColor: active
                    ? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.2)")
                    : (isDark ? "transparent" : "rgba(0,0,0,0.12)"),
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t("firstPick.day", { count: d })}
            >
              <Ionicons name="calendar-outline" size={12} color={currentTheme.colors.secondary} />
              <Text
                style={[
                  styles.dayPillText,
                  { color: isDark ? currentTheme.colors.textPrimary : "#000" },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t("firstPick.day", { count: d })}
              </Text>
            </Pressable>
          );
        })}
        {/* Si la ligne a moins de 3 items, on remplit avec des spacers invisibles pour garder l’alignement */}
        {Array.from({ length: Math.max(0, 3 - row.length) }).map((_, k) => (
          <View key={`spacer-${ri}-${k}`} style={[styles.dayPill, styles.dayPillSpacer]} />
        ))}
      </View>
    ))}
  </View>
</View>

              </>
            )}
          </View>

{/* Footer: CTA + Ignorer */}
{/* Footer: CTA + Ignorer (compact) */}
<View style={styles.footerRow}>
  <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
    <TouchableOpacity
      onPress={onConfirm}
      disabled={mode === "none" || !selected || submitting || (mode === "duo" && isOffline)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={
        mode === "none"
          ? (t("firstPick.chooseMode") || "Choisir un mode")
          : mode === "duo"
            ? t("firstPick.chooseDuo")
            : t("firstPick.chooseSolo")
      }
      accessibilityState={{ disabled: mode === "none" || !selected || submitting || (mode === "duo" && isOffline) }}
      testID="firstpick-cta"
      style={[
        styles.primaryCtaCompact,
         { opacity: mode !== "none" && selected && !submitting && !(mode === "duo" && isOffline) ? 1 : 0.6 }
      ]}
    >
      {submitting ? (
        <ActivityIndicator color="#000" />
      ) : (
        <>
        {mode === "duo" && (
            <View
              accessibilityLabel={t("firstPick.duoBadge", "DUO")}
              style={[styles.duoBadge, isOffline && { opacity: 0.6 }]}
            >
              <Ionicons name="people" size={12} color="#000" />
              <Text style={styles.duoBadgeText}>{t("firstPick.duoBadge", "DUO")}</Text>
            </View>
          )}
          <Ionicons
            name={mode === "duo" ? "people-outline" : mode === "solo" ? "person-outline" : "sparkles-outline"}
            size={16}
            color="#000"
          />
          <Text style={styles.primaryCtaTextCompact}>
            {mode === "none"
              ? (t("firstPick.chooseMode") || "Choisir un mode")
              : mode === "duo"
                ? (t("firstPick.chooseDuoShort") || "Choisir en duo")
                : (t("firstPick.chooseSoloShort") || "Choisir en solo")}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#000" />
        </>
      )}
    </TouchableOpacity>
  </Animated.View>

  <TouchableOpacity onPress={onSkip} style={styles.skipBtnRow} hitSlop={10}>
    <Text style={[styles.skipText, { color: currentTheme.colors.textSecondary }]}>
      {t("firstPick.skip")}
    </Text>
  </TouchableOpacity>
</View>



        </LinearGradient>
      </Animated.View>

      {/* Modaux duo / invitation */}
      <InfoDuoModal
        visible={infoDuoVisible}
        onClose={() => {
          setInfoDuoVisible(false);
          setInviteModalVisible(true);
        }}
      />

      <SendInvitationModal
        visible={inviteModalVisible}
        onClose={handleInviteDismiss}
        onSent={handleInvitationSent}
        challengeId={selected?.id || ""}
        selectedDays={days}
        challengeTitle={selected?.title || t("common.challenge")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING,
    paddingBottom: SPACING,
    alignItems: "center",
  },
  header: {
    width: "100%",
    paddingHorizontal: SPACING,
    marginBottom: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: 6,
  },
  modeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  // ✅ Badge DUO compact dans le CTA (premium + lisible)
  duoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#FFE8C2",
    marginRight: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  duoBadgeText: {
    color: "#000",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    fontFamily: "Comfortaa_700Bold",
    textTransform: "uppercase",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
    paddingHorizontal: 24,
    gap: 10,
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
  offlineBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
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
  modeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeCtaText: {
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
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
    backgroundColor: "#FFD700",
    borderRadius: 14,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  daysRow: {
    width: "100%",
    marginTop: 4,
    marginBottom: 4,
  },
  daysLabel: {
    fontSize: 13,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 6,
  },
  footerRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: SPACING,
  paddingBottom: SPACING,
  paddingTop: 6,
  width: "100%",
},
primaryCtaCompact: {
  minHeight: 44,           
  borderRadius: 12,
  paddingVertical: 8,
  paddingHorizontal: 14,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: ORANGE,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 3,
  borderWidth: 0,
  borderColor: "transparent",
  alignSelf: "flex-start",
},
primaryCtaTextCompact: {
  color: "#000",           
  fontSize: 14,
  fontFamily: "Comfortaa_700Bold",
},
skipBtnRow: {
  paddingHorizontal: 4,
  paddingVertical: 8,
},
skipText: {
  fontSize: 14,
  fontFamily: "Comfortaa_400Regular",
},
  daysGrid: {
  width: "100%",
  gap: 8,
},
pillRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  gap: 8,
},
dayPill: {
  flex: 1,                 
  minWidth: 0,              
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderWidth: 1,
  borderRadius: 999,
  paddingVertical: 6,
  paddingHorizontal: 8,
  minHeight: 36,
},
dayPillSpacer: {
  opacity: 0,                  // invisible mais prend la place
  borderWidth: 0,
  backgroundColor: "transparent",
},
dayPillText: {
  fontSize: 12,
  lineHeight: 16,
  textAlign: "center",
  fontFamily: "Comfortaa_700Bold",
},
primaryCtaContainer: {
  borderRadius: 16,
  overflow: "visible",
},
primaryCta: {
  minHeight: 52,
  borderRadius: 16,
  paddingVertical: 12,
  paddingHorizontal: 16,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 6,
},
primaryCtaBorder: {
  position: "absolute",
  inset: 0,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.25)",
},
primaryCtaText: {
  color: "#fff",
  fontSize: 16,
  fontFamily: "Comfortaa_700Bold",
},
  cardSelectionHalo: {
  position: "absolute",
  top: -3, left: -3, right: -3, bottom: -3,
  borderRadius: 18,
  borderWidth: 2,
  opacity: 0.9,
  // Glow doux (iOS)
  shadowColor: "#000",
  shadowOpacity: 0.25,
  zIndex: 10, elevation: 10,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
},
  footer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: SPACING,
    marginTop: 10,
  },
  footerWrap: {
  paddingHorizontal: SPACING,
  paddingBottom: SPACING,
  paddingTop: 6,
  width: "100%",
  position: "relative",
},
footerFade: {
  position: "absolute",
  top: -32,
  left: 0,
  right: 0,
  height: 48,
},
skipBtn: {
  alignSelf: "center",
  marginTop: 10,
  padding: 8,
},
});
