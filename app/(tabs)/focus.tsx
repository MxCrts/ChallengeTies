// app/(tabs)/focus.tsx — "Exploits" — Salle des Triomphes
// Esthétique : Rome Antique — marbre, or, lauriers, magnificence

import React, {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  ActivityIndicator, Dimensions, FlatList, Platform,
  Pressable, StyleSheet, Text, TouchableOpacity,
  View, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring,
  withTiming, withDelay, interpolate, Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import {
  fetchFeedPage, addReaction, type FeedEvent, type FeedEventType, type FeedReactions,
} from "@/src/services/globalFeedService";
import { auth } from "@/constants/firebase-config";
import { sendReactionPushNotification } from "@/services/notificationService";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { completeQuest as completeOnboardingQuest } from "@/src/services/onboardingQuestService";

/* ─── Responsive ───────────────────────────────────── */
const { width: SW } = Dimensions.get("window");
const SCALE = Math.min(Math.max(SW / 375, 0.82), 1.35);
const ns = (s: number) => Math.round(s * SCALE);

/* ─── Palette Rome ─────────────────────────────────── */
const MARBLE_LIGHT  = "#F5F0E8";
const MARBLE_DARK   = "#1A1610";
const GOLD          = "#C9922A";
const GOLD_BRIGHT   = "#E8B84B";
const GOLD_PALE     = "#F2D98A";
const CRIMSON       = "#8B1A1A";
const EMERALD_ROME  = "#1A5C3A";
const SILVER        = "#A8A090";
const PARCHMENT     = "#E8DEC8";
const INK           = "#2A1F0E";

type TypeCfg = { color: string; glowColor: string; icon: string; titleKey: string; subtitleKey: string; borderAccent: string; };
const TYPE_CONFIG: Record<FeedEventType, TypeCfg> = {
  completion: {
    color: GOLD_BRIGHT, glowColor: "rgba(200,150,40,0.40)",
    icon: "trophy", titleKey: "exploits.type.completion",
    subtitleKey: "exploits.type.completionSub",
    borderAccent: GOLD,
  },
  milestone: {
    color: CRIMSON, glowColor: "rgba(139,26,26,0.35)",
    icon: "star", titleKey: "exploits.type.milestone",
    subtitleKey: "exploits.type.milestoneSub",
    borderAccent: CRIMSON,
  },
  daily_mark: {
    color: EMERALD_ROME, glowColor: "rgba(26,92,58,0.30)",
    icon: "shield-checkmark", titleKey: "exploits.type.dailyMark",
    subtitleKey: "exploits.type.dailyMarkSub",
    borderAccent: EMERALD_ROME,
  },
};

/* ─── Helpers ──────────────────────────────────────── */
function pluralDays(n: number, t: (k: string, o?: any) => string): string {
  if (n <= 1) return t("exploits.day", { defaultValue: "jour" });
  return t("exploits.days", { defaultValue: "jours" });
}

function timeAgo(date: Date, t: (k: string, o?: any) => string): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return t("exploits.justNow",    { defaultValue: "À l'instant" });
  if (diff < 3600)  return t("exploits.minutesAgo", { count: Math.floor(diff / 60), defaultValue: `${Math.floor(diff / 60)}min` });
  if (diff < 86400) return t("exploits.hoursAgo",   { count: Math.floor(diff / 3600), defaultValue: `${Math.floor(diff / 3600)}h` });
  return t("exploits.daysAgo", { count: Math.floor(diff / 86400), defaultValue: `${Math.floor(diff / 86400)}j` });
}

function buildLabel(event: FeedEvent, t: (k: string, o?: any) => string): string {
  const translatedTitle = event.challengeId
    ? t(`challenges.${event.challengeId}.title`, { defaultValue: "" })
    : "";
  const ch = translatedTitle || event.challengeTitle;
  switch (event.type) {
    case "completion":
      return t("exploits.label.completion", {
        challenge: ch,
        days: event.payload.totalDays ?? "?",
        unit: pluralDays(Number(event.payload.totalDays ?? 1), t),
        defaultValue: `a accompli « ${ch} » en ${event.payload.totalDays ?? "?"} ${pluralDays(Number(event.payload.totalDays ?? 1), t)}`,
      });
    case "milestone": {
      const mk = event.payload.milestoneName ?? "";
      if (mk === "day_7")   return t("exploits.label.milestone7",   { challenge: ch, defaultValue: `7 jours de constance — « ${ch} »` });
      if (mk === "day_30")  return t("exploits.label.milestone30",  { challenge: ch, defaultValue: `30 jours accomplis — « ${ch} »` });
      if (mk === "day_100") return t("exploits.label.milestone100", { challenge: ch, defaultValue: `100 jours de maîtrise — « ${ch} »` });
      if (mk.includes("50")) return t("exploits.label.milestone50", { challenge: ch, defaultValue: `Mi-parcours atteint — « ${ch} »` });
      return t("exploits.label.milestoneGeneric", { challenge: ch, defaultValue: `Jalon conquis — « ${ch} »` });
    }
    case "daily_mark":
    default: {
      const s = event.payload.streak ?? 1;
      return t("exploits.label.dailyMark", {
        challenge: ch,
        streak: s,
        unit: pluralDays(s, t),
        defaultValue: `« ${ch} » — ${s} ${pluralDays(s, t)} de rigueur`,
      });
    }
  }
}

function avatarUrl(username: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "?")}&background=2A1F0E&color=E8B84B&bold=true&size=64`;
}

/* ─── SVG Laurel inline ────────────────────────────── */
const LaurelLeft = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size * 1.4, overflow: "hidden" }}>
    <Text style={{ fontSize: size, color, fontStyle: "italic", lineHeight: size * 1.4 }}>𝕷</Text>
  </View>
);

/* ─── Composant : Pilier décoratif animé ───────────── */
const PillarDeco = ({ isDark }: { isDark: boolean }) => {
  const shimmer = useSharedValue(-1);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
  }, []);
    const shimLeft  = -Math.round(60 * SCALE);
  const shimRight =  Math.round(60 * SCALE);
  const shimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [-1, 1], [shimLeft, shimRight]) }],
    opacity: 0.18,
  }));
  const col = isDark ? "rgba(200,150,40,0.12)" : "rgba(200,150,40,0.10)";
  return (
    <View style={{ width: ns(3), height: "100%", overflow: "hidden", backgroundColor: col, borderRadius: ns(2) }}>
      <Animated.View style={[StyleSheet.absoluteFill, shimStyle, { backgroundColor: GOLD_PALE, width: ns(8) }]} />
    </View>
  );
};

/* ─── Header Triomphe ──────────────────────────────── */
const TriumphHeader = ({
  isDark, t, onRefresh, refreshing,
}: { isDark: boolean; t: (k: string, o?: any) => string; onRefresh: () => void; refreshing: boolean }) => {

  const glow  = useSharedValue(0.7);
  const spinV = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ), -1, false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinV.value * 360}deg` }],
  }));

  const handleRefresh = () => {
    spinV.value = withTiming(spinV.value + 1, { duration: 600, easing: Easing.inOut(Easing.ease) });
    onRefresh();
  };

  const bgTop    = isDark ? "#1A1610" : "#EDE5CF";
  const bgBottom = isDark ? "#0E0C08" : "#E0D4B8";
  const titleCol = isDark ? GOLD_BRIGHT : GOLD;
  const subCol   = isDark ? "rgba(200,160,80,0.65)" : "rgba(100,75,20,0.65)";
  const divCol   = isDark ? "rgba(200,150,40,0.35)" : "rgba(180,130,30,0.40)";

  return (
    <Animated.View entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))} style={s.headerOuter}>
      <LinearGradient
        colors={[bgTop, bgBottom]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.headerGrad}
      >
        {/* Texture marbre subtile */}
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.15)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: ns(20) }]}
        />

        {/* Piliers latéraux */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: ns(6), paddingVertical: ns(4) }]} pointerEvents="none">
          <PillarDeco isDark={isDark} />
          <PillarDeco isDark={isDark} />
        </View>

        {/* Frise haute dorée */}
        <LinearGradient
          colors={["transparent", GOLD + "60", GOLD_BRIGHT + "80", GOLD + "60", "transparent"]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={s.headerFrise}
        />

        {/* Icône trophée + glow */}
        <View style={s.headerIconRow}>
          <Animated.View style={[s.headerGlow, glowStyle, { shadowColor: GOLD }]} />
          <View style={[s.headerIconWrap, {
            backgroundColor: isDark ? "rgba(200,150,40,0.12)" : "rgba(200,150,40,0.10)",
            borderColor: isDark ? "rgba(200,150,40,0.45)" : "rgba(180,130,30,0.40)",
          }]}>
            <Ionicons name="trophy" size={ns(28)} color={GOLD_BRIGHT} />
          </View>
        </View>

        {/* Titre */}
        <Text style={[s.headerTitle, { color: titleCol }]}>
          {t("exploits.title", { defaultValue: "EXPLOITS" })}
        </Text>
        <Text style={[s.headerSub, { color: subCol }]}>
          {t("exploits.subtitle", { defaultValue: "Les hauts faits de la communauté" })}
        </Text>

        {/* Divider laurier */}
        <View style={s.headerDivRow}>
          <View style={[s.headerDivLine, { backgroundColor: divCol }]} />
          <Ionicons name="leaf" size={ns(12)} color={isDark ? GOLD + "80" : GOLD + "90"} />
          <Ionicons name="star" size={ns(10)} color={isDark ? GOLD_BRIGHT + "90" : GOLD + "AA"} />
          <Ionicons name="leaf" size={ns(12)} color={isDark ? GOLD + "80" : GOLD + "90"} style={{ transform: [{ scaleX: -1 }] }} />
          <View style={[s.headerDivLine, { backgroundColor: divCol }]} />
        </View>

        {/* Légende */}
        <View style={s.legendRow}>
          {(Object.entries(TYPE_CONFIG) as [FeedEventType, TypeCfg][]).map(([type, cfg]) => (
            <View key={type} style={[s.legendItem, {
              backgroundColor: cfg.color + (isDark ? "18" : "14"),
              borderColor: cfg.color + (isDark ? "40" : "35"),
            }]}>
              <Ionicons name={cfg.icon as any} size={ns(10)} color={cfg.color} />
              <Text style={[s.legendText, { color: cfg.color }]}>
                {t(cfg.titleKey, { defaultValue: cfg.titleKey })}
              </Text>
            </View>
          ))}
          <TouchableOpacity onPress={handleRefresh} style={[s.refreshBtn, {
            backgroundColor: isDark ? "rgba(200,150,40,0.12)" : "rgba(200,150,40,0.10)",
            borderColor: isDark ? "rgba(200,150,40,0.35)" : "rgba(180,130,30,0.30)",
          }]}>
            <Animated.View style={spinStyle}>
              <Ionicons name="refresh-outline" size={ns(15)} color={isDark ? GOLD_BRIGHT : GOLD} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Frise basse */}
        <LinearGradient
          colors={["transparent", GOLD + "50", GOLD_BRIGHT + "60", GOLD + "50", "transparent"]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={[s.headerFrise, { marginTop: ns(12), marginBottom: 0 }]}
        />
      </LinearGradient>
    </Animated.View>
  );
};

/* ─── Stèle / EventCard ────────────────────────────── */
const ExploitStele = React.memo(function ExploitStele({
  event, index, isDark, t,
}: { event: FeedEvent; index: number; isDark: boolean; t: (k: string, o?: any) => string }) {
  const cfg  = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.daily_mark;
  const isMe = event.uid === auth.currentUser?.uid;
  const label = buildLabel(event, t);
  const time  = timeAgo(event.createdAt, t);

  const scaleV = useSharedValue(1);
  const glowV  = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleV.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowV.value, [0, 1], [0, 0.55]),
  }));

  const myUid = auth.currentUser?.uid ?? "";
  const [reactions, setReactions] = useState(event.reactions);
  const [reacting, setReacting] = useState<"fire" | "muscle" | null>(null);

  const hasFired   = reactions.fireBy.includes(myUid);
  const hasMuscled = reactions.muscleBy.includes(myUid);

  const handleReact = useCallback(async (type: "fire" | "muscle") => {
    if (reacting) return;
    setReacting(type);
    // Optimistic update immédiat
    const byKey    = type === "fire" ? "fireBy"   : "muscleBy";
    const countKey = type === "fire" ? "fire"      : "muscle";
    const already  = reactions[byKey].includes(myUid);
    setReactions(prev => ({
      ...prev,
      [byKey]:    already ? prev[byKey].filter(u => u !== myUid) : [...prev[byKey], myUid],
      [countKey]: Math.max(0, already ? prev[countKey] - 1 : prev[countKey] + 1),
    }));
     const result = await addReaction(event.id, type, event.uid, (ownerId, reactionType, fromUid) => {
      sendReactionPushNotification(ownerId, reactionType, fromUid).catch(() => {});
    });
    if (result) setReactions(result);
    setReacting(null);
  }, [reactions, myUid, reacting, event.id, event.uid]);

  const onIn  = () => { scaleV.value = withSpring(0.972, { damping: 20, stiffness: 320 }); glowV.value = withTiming(1, { duration: 180 }); };
  const onOut = () => { scaleV.value = withSpring(1, { damping: 15, stiffness: 200 }); glowV.value = withTiming(0, { duration: 280 }); };

  /* Couleurs fond stèle selon thème + type */
  const steleBase = isDark
    ? event.type === "completion" ? "#1E1508"
      : event.type === "milestone" ? "#1C0A0A"
      : "#0C2016"
    : event.type === "completion" ? "#FAF3DE"
      : event.type === "milestone" ? "#FAE8E8"
      : "#E8F8F0";

  const borderTop = cfg.borderAccent + (isDark ? "70" : "55");
  const textPrim  = isDark ? "#EDE5CF" : INK;
  const textSec   = isDark ? "rgba(220,200,150,0.55)" : "rgba(42,31,14,0.52)";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(400).springify().damping(14).mass(0.8)}
      style={[s.steleOuter, cardStyle]}
    >
      <Pressable onPressIn={onIn} onPressOut={onOut} style={{ flex: 1 }}>

        {/* Halo */}
        <Animated.View style={[s.steleGlow, glowStyle, { shadowColor: cfg.glowColor, backgroundColor: cfg.glowColor }]} />

                <View style={[s.stele, { backgroundColor: steleBase, borderColor: cfg.borderAccent + "55" }]}>

          {/* Frise haute colorée */}
          <LinearGradient
            colors={[cfg.borderAccent + "90", cfg.color + "CC", cfg.borderAccent + "90"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={s.steleFrise}
          />

          {/* Corps */}
          <View style={s.steleBody}>

            {/* Avatar colonne */}
            <View style={s.avatarCol}>
              <View style={[s.avatarOuter, { borderColor: cfg.color + "50", backgroundColor: cfg.color + "10" }]}>
                <Image
                  source={{ uri: event.avatarUrl || avatarUrl(event.username) }}
                  style={s.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>
              {/* Médaillon type */}
              <View style={[s.medallion, { backgroundColor: cfg.color, borderColor: isDark ? "#0E0C08" : PARCHMENT }]}>
                <Ionicons name={cfg.icon as any} size={ns(9)} color={isDark ? "#0E0C08" : "#FFF"} />
              </View>
              {/* Médaillon DUO */}
              {event.payload.isDuo && (
                <View style={[s.duoMedallion, { backgroundColor: GOLD, borderColor: isDark ? "#0E0C08" : PARCHMENT }]}>
                  <Ionicons name="people" size={ns(8)} color="#0E0C08" />
                </View>
              )}
            </View>

            {/* Contenu inscription */}
            <View style={s.inscription}>

              {/* Nom + temps */}
              <View style={s.inscriptionTopRow}>
                <View style={s.nameRow}>
                                    <Text style={[s.inscriptionName, { color: cfg.color }]} numberOfLines={1}>
                    {event.username}
                  </Text>
                  {isMe && (
                    <View style={[s.meTag, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55" }]}>
                      <Text style={[s.meTagText, { color: cfg.color }]}>
                        {t("exploits.you", { defaultValue: "toi" })}
                      </Text>
                    </View>
                  )}
                  {event.payload.isDuo && (
                    <View style={[s.duoTag, { backgroundColor: GOLD + "18", borderColor: GOLD + "45" }]}>
                      <Ionicons name="people" size={ns(9)} color={GOLD} />
                      <Text style={[s.duoTagText, { color: GOLD }]}>DUO</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.inscriptionTime, { color: textSec }]}>{time}</Text>
              </View>

              {/* Inscription principale */}
                            <Text style={[s.inscriptionLabel, { color: textPrim }]} numberOfLines={3}>
                {label}
              </Text>

              {/* ── Réactions ── */}
              <View style={s.reactRow}>
                <TouchableOpacity
                  onPress={() => handleReact("fire")}
                  disabled={!!reacting}
                  style={[s.reactBtn, hasFired && { backgroundColor: cfg.color + "20", borderColor: cfg.color + "55" }]}
                  activeOpacity={0.75}
                >
                  <Text style={s.reactEmoji}>🔥</Text>
                  {reactions.fire > 0 && (
                    <Text style={[s.reactCount, { color: hasFired ? cfg.color : textSec }]}>
                      {reactions.fire}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReact("muscle")}
                  disabled={!!reacting}
                  style={[s.reactBtn, hasMuscled && { backgroundColor: cfg.color + "20", borderColor: cfg.color + "55" }]}
                  activeOpacity={0.75}
                >
                  <Text style={s.reactEmoji}>💪</Text>
                  {reactions.muscle > 0 && (
                    <Text style={[s.reactCount, { color: hasMuscled ? cfg.color : textSec }]}>
                      {reactions.muscle}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Bandeau type */}
              <View style={s.typeBandeauRow}>
                <LinearGradient
                  colors={[cfg.borderAccent + "28", cfg.color + "18"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.typeBandeau, { borderColor: cfg.borderAccent + "40" }]}
                >
                  <Ionicons name={cfg.icon as any} size={ns(13)} color={cfg.color} />
                  <Text style={[s.typeBandeauText, { color: cfg.color }]}>
                    {t(cfg.titleKey, { defaultValue: cfg.titleKey })}
                  </Text>
                  <View style={[s.sepDot, { backgroundColor: cfg.color + "40" }]} />
                  <Text style={[s.typeBandeauSub, { color: cfg.color + "AA" }]} numberOfLines={1} ellipsizeMode="tail">
                    {t(cfg.subtitleKey, { defaultValue: cfg.subtitleKey })}
                  </Text>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Décor coin trophée pour completion */}
          {event.type === "completion" && (
            <View style={s.cornerWreath} pointerEvents="none">
              <LinearGradient
                colors={[GOLD + "40", "transparent"]}
                start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="trophy" size={ns(20)} color={GOLD + "70"} />
            </View>
          )}
          {event.type === "milestone" && (
            <View style={s.cornerWreath} pointerEvents="none">
              <LinearGradient
                colors={[CRIMSON + "35", "transparent"]}
                start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="star" size={ns(18)} color={CRIMSON + "70"} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

/* ─── Empty State ──────────────────────────────────── */
const ForumVacuum = ({ isDark, t }: { isDark: boolean; t: (k: string, o?: any) => string }) => {
  const floatV = useSharedValue(0);
  const floatDist = -Math.round(8 * SCALE);
  useEffect(() => {
    floatV.value = withRepeat(
      withSequence(withTiming(floatDist, { duration: 2200 }), withTiming(0, { duration: 2200 })),
      -1, true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatV.value }] }));

  const col = isDark ? "rgba(200,150,40,0.10)" : "rgba(200,150,40,0.08)";
  const brd = isDark ? "rgba(200,150,40,0.28)" : "rgba(200,150,40,0.22)";

  return (
    <Animated.View entering={FadeIn.duration(500)} style={s.emptyWrap}>
      <Animated.View style={[s.emptyIconWrap, floatStyle, { backgroundColor: col, borderColor: brd }]}>
        <Ionicons name="trophy-outline" size={ns(52)} color={GOLD + "80"} />
      </Animated.View>
      <Text style={[s.emptyTitle, { color: isDark ? GOLD_PALE : GOLD }]}>
        {t("exploits.emptyTitle", { defaultValue: "Forum Vacuum" })}
      </Text>
      <Text style={[s.emptySub, { color: isDark ? "rgba(220,200,150,0.45)" : "rgba(100,75,20,0.50)" }]}>
        {t("exploits.emptySub", { defaultValue: "Aucun exploit n'est encore gravé ici.\nMarque un défi pour entrer dans les annales !" })}
      </Text>
    </Animated.View>
  );
};

/* ─── Page principale ──────────────────────────────── */
export default function ExploitsScreen() {
  const { t }      = useTranslation();
  const { theme }  = useTheme();
  const isDark     = theme === "dark";
  const insets     = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  const [events,      setEvents]      = useState<FeedEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const bg      = isDark ? MARBLE_DARK : MARBLE_LIGHT;
  const textSec = isDark ? "rgba(220,200,150,0.45)" : "rgba(100,75,20,0.50)";

  const loadFirst = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = await fetchFeedPage(null);
      setEvents(p.events); lastDocRef.current = p.lastDoc; setHasMore(p.hasMore);
    } catch { setError(t("exploits.loadError", { defaultValue: "Impossible de charger les exploits." })); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  useEffect(() => {
    completeOnboardingQuest("explore_community").catch(() => {});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const p = await fetchFeedPage(null);
      setEvents(p.events); lastDocRef.current = p.lastDoc; setHasMore(p.hasMore);
    } catch {}
    setRefreshing(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const p = await fetchFeedPage(lastDocRef.current);
      setEvents(prev => [...prev, ...p.events]); lastDocRef.current = p.lastDoc; setHasMore(p.hasMore);
    } catch {}
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedEvent; index: number }) => (
      <ExploitStele event={item} index={index} isDark={isDark} t={t} />
    ), [isDark, t]
  );
  const keyExtractor = useCallback((item: FeedEvent) => item.id, []);

  const ListHeader = useCallback(() => (
    <TriumphHeader isDark={isDark} t={t} onRefresh={onRefresh} refreshing={refreshing} />
  ), [isDark, t, onRefresh, refreshing]);

  const ListFooter = useCallback(() => {
    if (loadingMore) return (
      <View style={s.footerLoader}><ActivityIndicator size="small" color={GOLD} /></View>
    );
    if (!hasMore && events.length > 0) return (
      <View style={s.endWrap}>
        <LinearGradient colors={["transparent", GOLD + "55", "transparent"]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.endLine} />
        <View style={s.endInner}>
          <Ionicons name="leaf" size={ns(12)} color={GOLD + "70"} />
          <Text style={[s.endText, { color: textSec }]}>
            {t("exploits.endOfFeed", { defaultValue: "Finis tabula" })}
          </Text>
          <Ionicons name="leaf" size={ns(12)} color={GOLD + "70"} style={{ transform: [{ scaleX: -1 }] }} />
        </View>
        <LinearGradient colors={["transparent", GOLD + "55", "transparent"]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.endLine} />
      </View>
    );
    return null;
  }, [loadingMore, hasMore, events.length, textSec, t]);

  const ListEmpty = useCallback(() => {
    if (loading) return null;
    if (error) return (
      <View style={s.errorWrap}>
        <Ionicons name="alert-circle-outline" size={ns(36)} color={GOLD + "80"} />
        <Text style={[s.errorText, { color: textSec }]}>{error}</Text>
        <TouchableOpacity style={[s.retryBtn, { borderColor: GOLD + "55", backgroundColor: GOLD + "10" }]} onPress={loadFirst}>
          <Text style={[s.retryText, { color: GOLD }]}>{t("exploits.retry", { defaultValue: "Réessayer" })}</Text>
        </TouchableOpacity>
      </View>
    );
    return <ForumVacuum isDark={isDark} t={t} />;
  }, [loading, error, isDark, t, loadFirst, textSec]);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* Fond marbre — gradient ambiants croisés */}
      <LinearGradient
        pointerEvents="none"
        colors={isDark
          ? ["rgba(180,130,40,0.06)", "transparent", "rgba(139,26,26,0.04)"]
          : ["rgba(200,160,50,0.09)", "transparent", "rgba(139,26,26,0.05)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={isDark
          ? ["transparent", "rgba(26,92,58,0.04)", "transparent"]
          : ["transparent", "rgba(26,92,58,0.05)", "transparent"]}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ligne accent haut */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", GOLD + "65", GOLD_BRIGHT + "80", GOLD + "65", "transparent"]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={[s.topAccent, { top: insets.top + 1 }]}
      />

      {/* Loading */}
      {loading && (
        <Animated.View entering={FadeIn.duration(220)} style={[s.loadingWrap, { paddingTop: insets.top + ns(80) }]}>
          <View style={[s.loadingIcon, {
            backgroundColor: isDark ? "rgba(200,150,40,0.10)" : "rgba(200,150,40,0.08)",
            borderColor: isDark ? "rgba(200,150,40,0.35)" : "rgba(180,130,30,0.28)",
          }]}>
            <Ionicons name="trophy" size={ns(32)} color={GOLD_BRIGHT} />
          </View>
          <ActivityIndicator color={GOLD_BRIGHT} size="large" style={{ marginTop: ns(18) }} />
          <Text style={[s.loadingText, { color: textSec }]}>
            {t("exploits.loading", { defaultValue: "Consultation des annales…" })}
          </Text>
        </Animated.View>
      )}

      {/* Feed */}
      {!loading && (
        <FlatList
          data={events}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={ListEmpty}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          contentContainerStyle={[s.listContent, {
            paddingTop: insets.top + ns(8),
            paddingBottom: insets.bottom + ns(90),
          }]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          initialNumToRender={7}
          maxToRenderPerBatch={7}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────── */
const s = StyleSheet.create({
  root:      { flex: 1, overflow: "hidden" },
  topAccent: { position: "absolute", left: ns(24), right: ns(24), height: 1 },

  /* Loading */
  loadingWrap: { flex: 1, alignItems: "center", paddingHorizontal: ns(32) },
  loadingIcon: { width: ns(76), height: ns(76), borderRadius: ns(38), alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  loadingText: { fontFamily: "Comfortaa_400Regular", fontSize: ns(13), marginTop: ns(14), textAlign: "center" },

  /* List */
  listContent: { paddingHorizontal: ns(12) },

  /* ── Header ── */
  headerOuter: { marginBottom: ns(12) },
  headerGrad:  { borderRadius: ns(20), padding: ns(16), overflow: "hidden",
    borderWidth: 1, borderColor: GOLD + "22",
    ...Platform.select({ ios: { shadowColor: GOLD, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 6 } }),
  },
  headerFrise: { height: 2, borderRadius: 2, marginBottom: ns(16) },
  headerIconRow: { alignItems: "center", marginBottom: ns(10), position: "relative" },
  headerGlow: {
    position: "absolute", width: ns(80), height: ns(80), borderRadius: ns(40),
    backgroundColor: GOLD + "20",
    shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: ns(24),
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  headerIconWrap: { width: ns(58), height: ns(58), borderRadius: ns(29), alignItems: "center", justifyContent: "center", borderWidth: 2 },
  headerTitle: {
    fontFamily: "Comfortaa_700Bold", fontSize: ns(26),
    letterSpacing: 3.5, textAlign: "center", marginBottom: ns(4),
  },
  headerSub: { fontFamily: "Comfortaa_400Regular", fontSize: ns(12), textAlign: "center", letterSpacing: 0.8 },
  headerDivRow: { flexDirection: "row", alignItems: "center", gap: ns(8), marginVertical: ns(12) },
  headerDivLine: { flex: 1, height: 1, borderRadius: 1, opacity: 0.6 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: ns(6), alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: ns(4), paddingHorizontal: ns(9), paddingVertical: ns(5), borderRadius: ns(99), borderWidth: 1 },
  legendText: { fontFamily: "Comfortaa_700Bold", fontSize: ns(10) },
  refreshBtn: { width: ns(32), height: ns(32), borderRadius: ns(16), alignItems: "center", justifyContent: "center", borderWidth: 1, marginLeft: "auto" },

  /* ── Stèle ── */
  steleOuter: { marginBottom: ns(12), position: "relative" },
  steleGlow:  {
    position: "absolute",
    top: -ns(6), bottom: -ns(6), left: -ns(6), right: -ns(6),
    borderRadius: ns(22),
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: ns(18),
    zIndex: 0,
  },
  stele: {
    borderRadius: ns(18), borderWidth: 1, overflow: "hidden", zIndex: 1,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  steleFrise: { height: ns(4) },
  steleBody:  { flexDirection: "row", alignItems: "flex-start", padding: ns(12), paddingTop: ns(10) },
reactRow:   { flexDirection: "row", gap: ns(8), marginBottom: ns(8) },
  reactBtn:   { flexDirection: "row", alignItems: "center", gap: ns(4), paddingHorizontal: ns(10), paddingVertical: ns(6), borderRadius: ns(99), borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  reactEmoji: { fontSize: ns(14) },
  reactCount: { fontFamily: "Comfortaa_700Bold", fontSize: ns(11) },
  /* Avatar colonne */
  avatarCol:    { alignItems: "center", marginRight: ns(12), position: "relative", paddingTop: ns(2) },
    avatarOuter:  { width: ns(52), height: ns(52), borderRadius: ns(26), borderWidth: 2, overflow: "hidden" },
  avatar:       { width: "100%", height: "100%" },
  medallion:    { position: "absolute", bottom: -ns(3), right: -ns(5), width: ns(20), height: ns(20), borderRadius: ns(10), alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  duoMedallion: { position: "absolute", top: -ns(3), right: -ns(5), width: ns(18), height: ns(18), borderRadius: ns(9), alignItems: "center", justifyContent: "center", borderWidth: 1.5 },

  /* Inscription */
  inscription:    { flex: 1, minWidth: 0, overflow: "hidden" },
  inscriptionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ns(3) },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: ns(5), flex: 1, minWidth: 0 },
  inscriptionName:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(15), letterSpacing: 0.3, flexShrink: 1, minWidth: 0 },
  meTag:          { paddingHorizontal: ns(6), paddingVertical: ns(2), borderRadius: ns(99), borderWidth: 1 },
  meTagText:      { fontFamily: "Comfortaa_700Bold", fontSize: ns(9.5) },
  duoTag:         { flexDirection: "row", alignItems: "center", gap: ns(3), paddingHorizontal: ns(5), paddingVertical: ns(2), borderRadius: ns(99), borderWidth: 1 },
  duoTagText:     { fontFamily: "Comfortaa_700Bold", fontSize: ns(9.5) },
  inscriptionTime: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), marginLeft: ns(4) },
  inscriptionLabel:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(13.5), lineHeight: ns(20), marginBottom: ns(10), flexShrink: 1 },

  /* Bandeau type */
   typeBandeauRow: { flexDirection: "row", overflow: "hidden" },
  typeBandeau:    { flexDirection: "row", alignItems: "center", gap: ns(5), paddingHorizontal: ns(10), paddingVertical: ns(7), borderRadius: ns(12), borderWidth: 1, alignSelf: "flex-start", maxWidth: "100%", flexShrink: 1 },
  typeBandeauText:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(11), flexShrink: 0 },
  sepDot:         { width: ns(3), height: ns(3), borderRadius: ns(2), flexShrink: 0 },
  typeBandeauSub: { fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5), flexShrink: 1, flexGrow: 0 },

  /* Corner deco */
  cornerWreath: { position: "absolute", top: 0, right: 0, width: ns(42), height: ns(42), alignItems: "center", justifyContent: "center", overflow: "hidden", borderTopRightRadius: ns(18) },

  /* Empty */
  emptyWrap:    { flex: 1, alignItems: "center", paddingTop: ns(64), paddingHorizontal: ns(32) },
  emptyIconWrap:{ width: ns(100), height: ns(100), borderRadius: ns(50), alignItems: "center", justifyContent: "center", borderWidth: 1.5, marginBottom: ns(22) },
  emptyTitle:   { fontFamily: "Comfortaa_700Bold", fontSize: ns(22), textAlign: "center", letterSpacing: 1.5, marginBottom: ns(10) },
  emptySub:     { fontFamily: "Comfortaa_400Regular", fontSize: ns(14), textAlign: "center", lineHeight: ns(22) },

  /* Error */
  errorWrap:  { flex: 1, alignItems: "center", paddingTop: ns(60), gap: ns(12) },
  errorText:  { fontFamily: "Comfortaa_400Regular", fontSize: ns(14), textAlign: "center" },
  retryBtn:   { paddingHorizontal: ns(20), paddingVertical: ns(10), borderRadius: ns(12), borderWidth: 1 },
  retryText:  { fontFamily: "Comfortaa_700Bold", fontSize: ns(13) },

  /* Footer */
  footerLoader: { paddingVertical: ns(22), alignItems: "center" },
  endWrap:      { paddingVertical: ns(22), alignItems: "center", gap: ns(8) },
  endLine:      { width: "55%", height: 1 },
  endInner:     { flexDirection: "row", alignItems: "center", gap: ns(8) },
  endText:      { fontFamily: "Comfortaa_400Regular", fontSize: ns(12), letterSpacing: 0.8 },
});
