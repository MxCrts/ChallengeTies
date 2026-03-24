import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedProps, useAnimatedStyle,
  withDelay, withTiming, withSpring, Easing,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { useTranslation } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import { useShareCard } from "@/hooks/useShareCard";
import WeeklyTrophiesCard from "@/components/WeeklyTrophiesCard";
import { StatsShareCard } from "@/components/ShareCards";

const { width: W, height: H } = Dimensions.get("window");
const SPACING = 14;
const IS_COMPACT = H < 720;
// Grille strictement égale — chaque card = exactement la moitié moins gaps
const CARD_W = (W - SPACING * 3) / 2;
const ORANGE = "#F97316";
const ORANGE_D = "#D4620C";

const ns = (n: number) => Math.round(n * Math.min(Math.max(W / 375, 0.78), 1.55));

const wa = (c: string, a: number): string => {
  const cl = Math.min(Math.max(a, 0), 1);
  if (/^rgba?\(/i.test(c)) {
    const m = c.match(/[\d.]+/g) || [];
    return `rgba(${m[0]||0},${m[1]||0},${m[2]||0},${cl})`;
  }
  const h = c.replace("#","").padEnd(6,"0");
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${cl})`;
};

function useTabBarH(): number {
  try { return useBottomTabBarHeight(); } catch { return 0; }
}

// ── Animated ring ──────────────────────────────────────────────────────────
const AnimCircle = Animated.createAnimatedComponent(Circle);

function Ring({ pct, size, sw, isDark }: { pct: number; size: number; sw: number; isDark: boolean }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(350, withTiming(Math.min(pct / 100, 1), { duration: 1300, easing: Easing.out(Easing.cubic) }));
  }, [pct]);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - prog.value) }));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={isDark ? "rgba(255,255,255,0.08)" : wa(ORANGE,0.12)} strokeWidth={sw} fill="none" />
      <AnimCircle cx={size/2} cy={size/2} r={r} stroke={ORANGE} strokeWidth={sw} fill="none"
        strokeDasharray={circ} animatedProps={ap} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </Svg>
  );
}

// ── Sparkline bezier ───────────────────────────────────────────────────────
function Spark({ vals, w, h }: { vals: number[]; w: number; h: number }) {
  if (!vals || vals.length < 2) return null;
  const mx = Math.max(...vals), mn = Math.min(...vals), rng = mx - mn || 1;
  const p = 3;
  const pts = vals.map((v, i) => ({
    x: p + (i / (vals.length - 1)) * (w - p * 2),
    y: p + (1 - (v - mn) / rng) * (h - p * 2),
  }));
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    line += ` C ${cx} ${pts[i-1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const fill = `${line} L ${pts[pts.length-1].x} ${h} L ${pts[0].x} ${h} Z`;
  return (
    <Svg width={w} height={h}>
      <Path d={fill} fill="rgba(255,255,255,0.15)" />
      <Path d={line} stroke="rgba(255,255,255,0.94)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Mini stat card — hauteur FIXE uniforme ─────────────────────────────────
const CARD_H = ns(IS_COMPACT ? 130 : 148); // hauteur identique pour toutes

const MiniCard = memo(({ icon, label, value, delay, isDark, theme }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: string; delay: number; isDark: boolean; theme: Theme;
}) => {
  const scale = useSharedValue(0.90);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 190 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
  }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <Animated.View style={[{ width: CARD_W, height: CARD_H, marginBottom: SPACING }, anim]}>
      <LinearGradient
        colors={isDark
          ? [wa(theme.colors.cardBackground, 0.92), wa(theme.colors.cardBackground, 0.70)]
          : ["rgba(255,255,255,0.98)", "rgba(255,249,244,0.94)"]}
        style={[styles.miniCard, {
          borderColor: isDark ? "rgba(255,255,255,0.08)" : wa(ORANGE, 0.11),
          height: CARD_H,
        }]}
      >
        <LinearGradient pointerEvents="none"
          colors={["transparent", isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.65)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        {/* Dot accent */}
        <View style={[styles.dot, { backgroundColor: wa(ORANGE, isDark ? 0.45 : 0.28) }]} />

        {/* Icon */}
        <View style={[styles.iconBox, {
          backgroundColor: wa(ORANGE, isDark ? 0.20 : 0.10),
          borderColor: wa(ORANGE, isDark ? 0.30 : 0.16),
        }]}>
          <Ionicons name={icon} size={ns(18)} color={ORANGE} />
        </View>

        {/* Value — taille adaptative */}
        <Text
          style={[styles.miniVal, { color: isDark ? "#FFFFFF" : "#1A0800" }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {value}
        </Text>

        {/* Label — 2 lignes max, taille adaptative */}
        <Text
          style={[styles.miniLbl, { color: isDark ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.44)" }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
});

interface UserDoc {
  longestStreak?: number; trophies?: number; achievements?: string[];
  CompletedChallenges?: any[]; displayName?: string; profileImage?: string; weeklyTrophies?: number[];
}

export default function UserStats() {
  const { t, i18n } = useTranslation();
  const { savedChallenges } = useSavedChallenges();
  const { currentChallenges } = useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const CT: Theme = useMemo(() => isDark ? designSystem.darkTheme : designSystem.lightTheme, [isDark]);
  const insets = useSafeAreaInsets();
  const tabH = useTabBarH();
  const [adH, setAdH] = useState(0);
  const { showBanners } = useAdsVisibility();
  const bottomPad = useMemo(() => ns(80) + (showBanners ? adH : 0) + tabH + insets.bottom, [adH, insets.bottom, showBanners, tabH]);
  const { ref: shareRef, share } = useShareCard();
  const [sharePayload, setSharePayload] = useState<null | { username?: string | null; avatarUri?: string | null; stats: any }>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setIsLoading(false); return; }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!mounted.current) return;
      setUserDoc(snap.exists() ? snap.data() as UserDoc : null);
      setIsLoading(false);
    }, () => { if (mounted.current) setIsLoading(false); });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    if (!userDoc) return { saved:0,ongoing:0,completed:0,successRatePct:0,longestStreak:0,trophies:0,achievements:0 };
    const ongoing = new Map(currentChallenges.map((c: any) => [`${c.id}_${c.selectedDays}`,c])).size;
    const completed = Array.isArray(userDoc.CompletedChallenges) ? userDoc.CompletedChallenges.length : 0;
    return {
      saved: savedChallenges.length, ongoing, completed,
      successRatePct: ongoing+completed > 0 ? Math.round(completed/(ongoing+completed)*100) : 0,
      longestStreak: userDoc.longestStreak||0, trophies: userDoc.trophies||0,
      achievements: userDoc.achievements?.length||0,
    };
  }, [savedChallenges, currentChallenges, userDoc]);

  const spark = useMemo(() => {
    const base = userDoc?.weeklyTrophies;
    if (Array.isArray(base) && base.length >= 2) return base.slice(-7);
    const t = Math.max(stats.trophies, 10);
    return [.54,.61,.69,.76,.83,.92,1].map(f => Math.round(t*f));
  }, [userDoc, stats.trophies]);

  const nf = useCallback((n: number) => Number(n||0).toLocaleString(i18n.language), [i18n.language]);

  const handleShare = useCallback(async () => {
    try {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      setSharePayload({ username: userDoc?.displayName??null, avatarUri: userDoc?.profileImage??null, stats });
      await new Promise<void>(r => requestAnimationFrame(()=>r()));
      await share(`ct-stats-${auth.currentUser?.uid}-${Date.now()}.png`, t("shareStatsMessage"));
      setSharePayload(null);
    } catch {}
  }, [t, stats, userDoc, share]);

  if (isLoading) return (
    <SafeAreaView style={{ flex:1, backgroundColor: CT.colors.background }}>
      <LinearGradient colors={[CT.colors.background, CT.colors.cardBackground]} style={{ flex:1, justifyContent:"center", alignItems:"center" }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </LinearGradient>
    </SafeAreaView>
  );

  if (!userDoc) return (
    <SafeAreaView style={{ flex:1, backgroundColor: CT.colors.background }}>
      <LinearGradient colors={[CT.colors.background, CT.colors.cardBackground]} style={{ flex:1, justifyContent:"center", alignItems:"center", padding:SPACING*2 }}>
        <Ionicons name="alert-circle-outline" size={40} color={CT.colors.textSecondary} />
        <Text style={{ color:CT.colors.textPrimary, fontFamily:"Comfortaa_700Bold", fontSize:18, marginTop:12, textAlign:"center" }}>{t("profileLoadError")}</Text>
      </LinearGradient>
    </SafeAreaView>
  );

  const RING = ns(IS_COMPACT ? 104 : 114);
  const SW = ns(9);

  // ── Grid items — 6 stats, sans doublons par rapport aux badges de la trophy card
  const gridItems = [
    { icon:"bookmark-outline" as const, lbl: t("savedChallenges"), val: nf(stats.saved), d:280 },
    { icon:"hourglass-outline" as const, lbl: t("ongoingChallenges"), val: nf(stats.ongoing), d:330 },
    { icon:"trophy-outline" as const, lbl: t("completedChallenges"), val: nf(stats.completed), d:380 },
    { icon:"flame-outline" as const, lbl: t("longestStreak"), val: `${nf(stats.longestStreak)}j`, d:430 },
    { icon:"stats-chart-outline" as const, lbl: t("successRate"), val: `${stats.successRatePct}%`, d:480 },
    { icon:"ribbon-outline" as const, lbl: t("unlockedAchievements"), val: nf(stats.achievements), d:530 },
  ];

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"transparent" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />

      <LinearGradient
        colors={isDark ? [CT.colors.background, CT.colors.cardBackground, wa(ORANGE,0.06)] : ["#FFF9F5","#FFF2E8",wa(ORANGE,0.04)]}
        style={{ flex:1 }} start={{x:0,y:0}} end={{x:1,y:1}}
      >
        {/* Orbes ambiance */}
        <View pointerEvents="none" style={{ position:"absolute", top:-W*.3, right:-W*.2, width:W*.88, height:W*.88, borderRadius:W*.44, backgroundColor: wa(ORANGE, isDark?.07:.09) }} />
        <View pointerEvents="none" style={{ position:"absolute", bottom:-W*.36, left:-W*.26, width:W*1.02, height:W*1.02, borderRadius:W*.51, backgroundColor: wa(ORANGE, isDark?.04:.06) }} />

        <CustomHeader title={t("statistics")} backgroundColor="transparent" useBlur={false} showHairline={false}
          rightIcon={<Ionicons name="share-outline" size={ns(22)} color={ORANGE} />}
          onRightPress={handleShare}
        />

        <ScrollView
          contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: SPACING, paddingTop: SPACING*.6 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ═══ HERO CARD ════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInDown.delay(60).duration(440)} style={{ marginBottom: SPACING }}>
            <LinearGradient
              colors={isDark ? ["rgba(26,11,2,0.97)","rgba(16,7,1,0.94)"] : ["rgba(255,255,255,0.99)","rgba(255,246,238,0.96)"]}
              style={[styles.heroCard, { borderColor: isDark ? wa(ORANGE,.22) : wa(ORANGE,.15) }]}
            >
              <LinearGradient pointerEvents="none"
                colors={["transparent", isDark ? wa(ORANGE,.05) : "rgba(255,255,255,0.70)", "transparent"]}
                start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}
              />
              {/* Glow coin */}
              <View pointerEvents="none" style={{ position:"absolute", top:-ns(26), right:-ns(26), width:ns(100), height:ns(100), borderRadius:ns(50), backgroundColor: wa(ORANGE, isDark?.14:.09) }} />

              <View style={styles.heroBody}>

                {/* Ring + pourcentage centré */}
                <View style={{ width:RING, height:RING, alignItems:"center", justifyContent:"center" }}>
                  <Ring pct={stats.successRatePct} size={RING} sw={SW} isDark={isDark} />
                  <View style={[StyleSheet.absoluteFill, { alignItems:"center", justifyContent:"center" }]}>
                    <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize:ns(19), color:ORANGE, includeFontPadding:false }}>
                      {stats.successRatePct}%
                    </Text>
                    <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize:ns(9.5), color: isDark?"rgba(255,255,255,0.40)":"rgba(0,0,0,0.36)", textAlign:"center", marginTop:2, paddingHorizontal:4 }} numberOfLines={2}>
                      {t("successRate")}
                    </Text>
                  </View>
                </View>

                {/* Stats droite — flex:1 pour ne JAMAIS déborder */}
                <View style={{ flex:1, gap:ns(IS_COMPACT?5:7), paddingLeft:ns(4) }}>
                  <Text
                    style={{ fontFamily:"Comfortaa_700Bold", fontSize:ns(IS_COMPACT?15:17), color: isDark?"#FFFFFF":"#1A0800", includeFontPadding:false, marginBottom:ns(2) }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {userDoc?.displayName || t("statistics")}
                  </Text>

                  {([
                    { icon:"medal-outline" as const, val: nf(stats.trophies), lbl: t("trophies") },
                    { icon:"trophy-outline" as const, val: nf(stats.completed), lbl: t("completedChallenges") },
                    { icon:"flame-outline" as const, val: `${nf(stats.longestStreak)}j`, lbl: t("longestStreak") },
                    { icon:"ribbon-outline" as const, val: nf(stats.achievements), lbl: t("unlockedAchievements") },
                  ]).map(({ icon, val, lbl }, i) => (
                    <View key={i} style={{ flexDirection:"row", alignItems:"center", gap:ns(6) }}>
                      <View style={{ width:ns(20), height:ns(20), borderRadius:ns(6), backgroundColor: wa(ORANGE, isDark?.18:.10), alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <Ionicons name={icon} size={ns(11)} color={ORANGE} />
                      </View>
                      <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize:ns(13), color: isDark?"#FFFFFF":"#1A0800", includeFontPadding:false, flexShrink:0 }}
                        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {val}
                      </Text>
                      <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize:ns(10.5), color: isDark?"rgba(255,255,255,0.42)":"rgba(0,0,0,0.40)", includeFontPadding:false, flex:1 }}
                        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {lbl}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ═══ TROPHY CARD ══════════════════════════════════════════════ */}
          <Animated.View entering={FadeInUp.delay(140).duration(420)} style={{ marginBottom: SPACING }}>
            <LinearGradient
              colors={[ORANGE, ORANGE_D]}
              start={{x:0,y:0}} end={{x:1,y:1}}
              style={styles.trophyCard}
            >
              <LinearGradient pointerEvents="none"
                colors={["rgba(255,255,255,0.13)","transparent","rgba(0,0,0,0.09)"]}
                start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}
              />
              <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end", marginBottom:ns(14) }}>
                <View>
                  <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize:ns(13), color:"rgba(255,255,255,0.78)", marginBottom:ns(4) }}>
                    🏆 {t("trophies")}
                  </Text>
                  <Text style={{ fontFamily:"Comfortaa_700Bold", fontSize:ns(IS_COMPACT?34:42), color:"#FFFFFF", includeFontPadding:false }}>
                    {nf(stats.trophies)}
                  </Text>
                </View>
                <View style={{ alignItems:"flex-end", justifyContent:"flex-end" }}>
                  <Spark vals={spark} w={ns(106)} h={ns(44)} />
                  <Text style={{ fontFamily:"Comfortaa_400Regular", fontSize:ns(10), color:"rgba(255,255,255,0.52)", marginTop:ns(3) }}>
                    7 {t("days")}
                  </Text>
                </View>
              </View>
              {/* Badges — UNE SEULE fois ici, pas dans la grid */}
              <View style={{ flexDirection:"row", gap:ns(8), flexWrap:"wrap" }}>
                <View style={styles.badge}>
                  <Ionicons name="ribbon-outline" size={ns(11)} color="rgba(255,255,255,0.90)" />
                  <Text style={styles.badgeTxt}>{stats.achievements} {t("unlockedAchievements")}</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="trophy-outline" size={ns(11)} color="rgba(255,255,255,0.90)" />
                  <Text style={styles.badgeTxt}>{stats.completed} {t("completedChallenges")}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ═══ WEEKLY ═══════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInUp.delay(210).duration(400)} style={{ marginBottom: SPACING }}>
            <WeeklyTrophiesCard />
          </Animated.View>

          {/* ═══ GRID 2×2 — hauteur UNIFORME ════════════════════════════ */}
          <View style={{ flexDirection:"row", flexWrap:"wrap", justifyContent:"space-between" }}>
            {gridItems.map((item, i) => (
              <MiniCard key={i} icon={item.icon} label={item.lbl} value={item.val}
                delay={item.d} isDark={isDark} theme={CT} />
            ))}
          </View>

        </ScrollView>

        {showBanners && (
          <View style={{ position:"absolute", left:0, right:0, bottom: tabH+insets.bottom, alignItems:"center", zIndex:9999, paddingBottom:6 }} pointerEvents="box-none">
            <BannerSlot onHeight={(h) => setAdH(h)} />
          </View>
        )}
      </LinearGradient>

      {sharePayload && (
        <View style={{ position:"absolute", opacity:0, pointerEvents:"none" }}>
          <StatsShareCard ref={shareRef}
            username={sharePayload.username??null} avatarUri={sharePayload.avatarUri??null}
            items={[
              { label: t("completedChallenges"), value: String(sharePayload.stats.completed) },
              { label: t("successRate"), value: `${sharePayload.stats.successRatePct}%` },
              { label: t("longestStreak"), value: `${sharePayload.stats.longestStreak}j` },
              { label: t("trophies"), value: String(sharePayload.stats.trophies) },
            ]}
            i18n={{ kickerWhenNoUser: t("myStats",{defaultValue:"Mes stats"}), subtitleWhenUser: t("myCTStats",{defaultValue:"Mes stats ChallengeTies"}) }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: ns(22), borderWidth: 1, overflow:"hidden",
    padding: ns(IS_COMPACT ? 13 : 15),
    shadowColor: ORANGE, shadowOffset:{width:0,height:8}, shadowOpacity:0.13, shadowRadius:18, elevation:5,
  },
  heroBody: { flexDirection:"row", alignItems:"center", gap:ns(12) },

  trophyCard: {
    borderRadius: ns(22), overflow:"hidden",
    padding: ns(IS_COMPACT ? 15 : 18),
    shadowColor: ORANGE, shadowOffset:{width:0,height:10}, shadowOpacity:0.36, shadowRadius:20, elevation:8,
  },
  badge: {
    flexDirection:"row", alignItems:"center", gap:ns(5),
    backgroundColor:"rgba(255,255,255,0.18)", borderRadius:999,
    paddingHorizontal:ns(10), paddingVertical:ns(5),
  },
  badgeTxt: { fontFamily:"Comfortaa_700Bold", fontSize:ns(11), color:"#FFFFFF" },

  // Mini card — dimensions fixes pour uniformité parfaite
  miniCard: {
    borderRadius: ns(18), borderWidth: 1, overflow:"hidden",
    padding: ns(IS_COMPACT ? 12 : 14),
    justifyContent:"space-between",
    shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.06, shadowRadius:10, elevation:2,
  },
  dot: { position:"absolute", top:ns(11), right:ns(11), width:ns(5), height:ns(5), borderRadius:ns(3) },
  iconBox: {
    width:ns(34), height:ns(34), borderRadius:ns(10), borderWidth:1,
    alignItems:"center", justifyContent:"center", marginBottom:ns(IS_COMPACT?6:8),
  },
  miniVal: {
    fontFamily:"Comfortaa_700Bold",
    fontSize:ns(IS_COMPACT ? 20 : 23),
    includeFontPadding:false,
    marginBottom:ns(3),
  },
  miniLbl: {
    fontFamily:"Comfortaa_400Regular",
    fontSize:ns(IS_COMPACT ? 10.5 : 11.5),
    lineHeight:ns(IS_COMPACT ? 14 : 16),
    includeFontPadding:false,
  },
});
