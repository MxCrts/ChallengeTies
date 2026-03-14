// components/WelcomeBonusModal.tsx
// 🏆 Refonte — NO SCROLL, tout sur l'écran, top 3 mondiale
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export type WelcomeRewardKind = "trophies" | "streakPass" | "premium";

const REWARD_KINDS: WelcomeRewardKind[] = [
  "trophies", "trophies", "streakPass",
  "trophies", "streakPass", "trophies", "premium",
];

// ─── Palette ────────────────────────────────────────────────────────────────
const AMBER       = "#FFB300";
const AMBER_LIGHT = "#FFD060";
const AMBER_DIM   = "#C87800";
const BG_DEEP     = "#06080E";
const STROKE      = "rgba(255,183,0,0.25)";
const STROKE_SOFT = "rgba(255,255,255,0.08)";
const TEXT        = "rgba(248,250,252,0.97)";
const TEXT_DIM    = "rgba(248,250,252,0.68)";
const TEXT_FAINT  = "rgba(248,250,252,0.38)";

// ─── Props ────────────────────────────────────────────────────────────────────
export type WelcomeBonusModalProps = {
  visible: boolean;
  onClose: () => void;
  onClaim: () => Promise<void> | void;
  currentDay: number;
  totalDays: number;
  rewardType: WelcomeRewardKind;
  rewardAmount: number;
  loading?: boolean;
};

// ─── Pulsing ring autour du dot "today" ──────────────────────────────────────
const PulsingRing: React.FC<{ sz: number }> = ({ sz }) => {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1,   { duration: 0 })
      ), -1, false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0,    { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0.85, { duration: 0 })
      ), -1, false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position:     "absolute",
    width:        sz,
    height:       sz,
    borderRadius: sz / 2,
    borderWidth:  1.5,
    borderColor:  AMBER,
    transform:    [{ scale: scale.value }],
    opacity:      opacity.value,
  }));

  return <Animated.View style={style} pointerEvents="none" />;
};

// ─────────────────────────────────────────────────────────────────────────────
const WelcomeBonusModal: React.FC<WelcomeBonusModalProps> = ({
  visible, onClose, onClaim,
  currentDay, totalDays, rewardType, rewardAmount, loading,
}) => {
  const { t }       = useTranslation();
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();

  const isDark    = theme === "dark";
  const current: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  // ── Layout adaptatif basé sur la hauteur dispo ────────────────────────────
  const AVAIL_H   = SH - insets.top - insets.bottom;
  const IS_TINY   = AVAIL_H < 620;   // SE, petits Android
  const IS_SHORT  = AVAIL_H < 740;   // iPhone 8/12 mini
  const IS_TABLET = SW >= 768;

  // n() normalise une valeur selon la hauteur disponible
  const n = useMemo(() => {
    const BASE = 812;
    const r    = Math.min(Math.max(AVAIL_H / BASE, 0.70), 1.20);
    return (v: number) => Math.round(v * r);
  }, [AVAIL_H]);

  const clampedTotal = Math.max(1, totalDays || 1);
  const dayIndex     = Math.min(Math.max(currentDay, 0), clampedTotal - 1);
  const displayDay   = dayIndex + 1;
  const progress     = clampedTotal <= 1 ? 1 : (displayDay - 1) / (clampedTotal - 1);

  // ── Shared values ──────────────────────────────────────────────────────────
  const cardScale   = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);
  const chestBob    = useSharedValue(0);
  const chestScale  = useSharedValue(1);
  const shimmer     = useSharedValue(-1);
  const glowPulse   = useSharedValue(0);

  const [showConfetti, setShowConfetti] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setClaimSuccess(false);
    setShowConfetti(false);

    cardOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    cardScale.value   = withSpring(1, { damping: 18, stiffness: 220 });

    chestBob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 660, easing: Easing.inOut(Easing.quad) }),
        withTiming(0,  { duration: 660, easing: Easing.inOut(Easing.quad) })
      ), -1, true
    );
    chestScale.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 1100 }), withTiming(1, { duration: 1100 })),
      -1, true
    );

    shimmer.value = withRepeat(
      withSequence(
        withTiming(1,  { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 0 })
      ), -1, false
    );

    glowPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 2200 }), withTiming(0.3, { duration: 2200 })),
      -1, true
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const cardStyle = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const chestStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: chestBob.value },
      { scale: chestScale.value },
    ] as any,
  }));

  const SHIMMER_TRANSLATE = n(140);

const shimmerStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: shimmer.value * SHIMMER_TRANSLATE }, { rotateZ: "-20deg" }] as any,
  opacity: 0.20,
}));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value * 0.16,
  }));

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getIcon = (kind: WelcomeRewardKind): keyof typeof Ionicons.glyphMap => {
    if (kind === "premium")    return "diamond";
    if (kind === "streakPass") return "ticket";
    return "trophy";
  };

  const rewardLabel = useMemo(() => {
    switch (rewardType) {
      case "trophies":   return t("welcomeBonus.reward.trophies",   { count: rewardAmount, defaultValue: `${rewardAmount} trophées` });
      case "streakPass": return t("welcomeBonus.reward.streakPass",  { count: rewardAmount, defaultValue: `${rewardAmount} Streak Pass` });
      case "premium":    return t("welcomeBonus.reward.premium",     { count: rewardAmount, defaultValue: `${rewardAmount}j Premium` });
      default: return "";
    }
  }, [rewardType, rewardAmount, t]);

  const rewardHint = useMemo(() => {
    switch (rewardType) {
      case "premium":    return t("welcomeBonus.premiumHint",    { defaultValue: "Sans pub + expérience illimitée." });
      case "streakPass": return t("welcomeBonus.streakPassHint", { defaultValue: "Protège ta série si tu rates un jour." });
      default:           return t("welcomeBonus.trophiesHint",   { defaultValue: "S'accumulent dans ton profil." });
    }
  }, [rewardType, t]);

  // ── Claim ──────────────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    chestScale.value = withSequence(
      withTiming(1.22, { duration: 100 }),
      withSpring(1, { damping: 10, stiffness: 260 })
    );

    try {
      await onClaim();
      setClaimSuccess(true);
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        setShowConfetti(false);
        setClaimSuccess(false);
        onClose();
      }, 900);
    } catch (e) {
      console.error("WelcomeBonus onClaim error:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  // ── Tailles calculées ──────────────────────────────────────────────────────
  const CARD_W     = Math.min(SW * 0.92, IS_TABLET ? n(540) : n(480));
  const CHEST_SIZE = IS_TINY ? n(92) : IS_SHORT ? n(108) : n(128);
  const DOT_SIZE   = IS_TINY ? n(26) : n(30);
  const RING_SIZE  = DOT_SIZE + n(14);

  // ── Timeline ───────────────────────────────────────────────────────────────
  const renderTimeline = () => (
    <View style={{ width: "100%", paddingHorizontal: n(4) }}>
      {/* Track base */}
      <View style={{
        position:        "absolute",
        height:          n(2.5),
        borderRadius:    n(999),
        backgroundColor: "rgba(255,255,255,0.08)",
        top:             n(14),
        left:            n(4) + DOT_SIZE / 2,
        right:           n(4) + DOT_SIZE / 2,
      }} />
      {/* Track fill */}
      <LinearGradient
        colors={[AMBER_DIM, AMBER, AMBER_LIGHT]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          position:     "absolute",
          height:       n(2.5),
          borderRadius: n(999),
          top:          n(14),
          left:         n(4) + DOT_SIZE / 2,
          width:        `${progress * 100}%`,
        }}
      />

      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: clampedTotal }).map((_, idx) => {
          const isPast   = idx < dayIndex;
          const isToday  = idx === dayIndex;
          const kind     = REWARD_KINDS[idx] ?? "trophies";

          return (
            <View key={idx} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                {isToday && <PulsingRing sz={RING_SIZE} />}
                <View style={{
                  width:           DOT_SIZE,
                  height:          DOT_SIZE,
                  borderRadius:    DOT_SIZE / 2,
                  alignItems:      "center",
                  justifyContent:  "center",
                  backgroundColor: isToday
                    ? AMBER
                    : isPast
                    ? "rgba(255,183,0,0.22)"
                    : "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: isToday
                    ? "rgba(255,220,100,0.5)"
                    : isPast
                    ? "rgba(255,183,0,0.28)"
                    : STROKE_SOFT,
                }}>
                  {isPast ? (
                    <Ionicons name="checkmark" size={n(13)} color={AMBER} />
                  ) : (
                    <Ionicons
                      name={getIcon(kind)}
                      size={n(12)}
                      color={isToday ? "#05070B" : "rgba(255,255,255,0.30)"}
                    />
                  )}
                </View>
              </View>

              <Text style={{
                fontSize:    n(IS_TINY ? 8.5 : 9),
                fontWeight:  "800",
                color:       isToday ? AMBER_LIGHT : TEXT_FAINT,
                marginTop:   n(5),
                textAlign:   "center",
              }}>
                {t("welcomeBonus.dayShort", { day: idx + 1, defaultValue: `J${idx + 1}` })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      statusBarTranslucent
      {...(Platform.OS === "ios" ? { presentationStyle: "overFullScreen" as const } : {})}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>

        {/* Backdrop */}
        {Platform.OS === "ios" ? (
          <BlurView intensity={76} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(3,4,9,0.90)" }]} />
        )}

        {/* Ambient orbs */}
        <Animated.View pointerEvents="none" style={[
          StyleSheet.absoluteFillObject,
          glowStyle,
          { backgroundColor: AMBER },
        ]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
          <View style={{
            position:        "absolute",
            width:           n(560),
            height:          n(560),
            borderRadius:    n(280),
            top:             -n(200),
            alignSelf:       "center",
            backgroundColor: AMBER,
            opacity:         0.10,
          }} />
          <View style={{
            position:        "absolute",
            width:           n(340),
            height:          n(340),
            borderRadius:    n(170),
            bottom:          -n(100),
            right:           -n(80),
            backgroundColor: AMBER_DIM,
            opacity:         0.07,
          }} />
        </View>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={160}
            origin={{ x: SW / 2, y: 0 }}
            fadeOut
            fallSpeed={2200}
            explosionSpeed={580}
            colors={[AMBER, "#FFE066", "#FF8C00", "#FFF3B0", "#FFFFFF", AMBER_LIGHT]}
          />
        )}

        {/* ── CARD principale ──────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={[{
            width:        CARD_W,
            borderRadius: n(30),
            overflow:     "hidden",
            borderWidth:  1,
            borderColor:  STROKE,
          }, cardStyle]}
        >
          <LinearGradient
            colors={["rgba(255,183,0,0.09)", BG_DEEP, BG_DEEP]}
            locations={[0, 0.35, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ borderRadius: n(30), overflow: "hidden" }}
          >

            {/* Mesh interne */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
              <View style={{
                position:        "absolute",
                width:           n(440),
                height:          n(440),
                borderRadius:    n(220),
                top:             -n(180),
                alignSelf:       "center",
                backgroundColor: AMBER,
                opacity:         0.055,
              }} />
            </View>

            <View style={{
              paddingHorizontal: n(IS_TINY ? 14 : 20),
              paddingTop:        n(IS_TINY ? 16 : 22),
              paddingBottom:     n(IS_TINY ? 16 : 22),
              gap:               n(IS_TINY ? 10 : 14),
            }}>

              {/* ── RIBBON ─────────────────────────────────────────────────── */}
              <View style={{ alignItems: "center" }}>
                <View style={{
                  flexDirection:   "row",
                  alignItems:      "center",
                  gap:             n(6),
                  backgroundColor: "rgba(255,179,0,0.10)",
                  borderWidth:     1,
                  borderColor:     "rgba(255,183,0,0.28)",
                  borderRadius:    n(999),
                  paddingHorizontal: n(14),
                  paddingVertical:   n(5),
                }}>
                  <Ionicons name="sparkles" size={n(10)} color={AMBER_LIGHT} />
                  <Text style={{
                    fontSize:       n(10),
                    fontWeight:     "800",
                    letterSpacing:  1.1,
                    textTransform:  "uppercase",
                    color:          AMBER_LIGHT,
                  }}>
                    {t("welcomeBonus.ribbon", { defaultValue: "Pack de bienvenue" })}
                  </Text>
                </View>
              </View>

              {/* ── HERO: coffre + rings ────────────────────────────────────── */}
              <View style={{ alignItems: "center", justifyContent: "center", position: "relative" }}>
                {/* Rings concentriques */}
                {[CHEST_SIZE + n(40), CHEST_SIZE + n(22), CHEST_SIZE + n(6)].map((sz, i) => (
                  <View key={i} pointerEvents="none" style={{
                    position:     "absolute",
                    width:        sz,
                    height:       sz,
                    borderRadius: sz / 2,
                    borderWidth:  1,
                    borderColor:  `rgba(255,183,0,${0.12 + i * 0.07})`,
                    backgroundColor: i === 2 ? "rgba(255,183,0,0.04)" : "transparent",
                  }} />
                ))}

                <Animated.View style={[{ width: CHEST_SIZE, height: CHEST_SIZE, zIndex: 2 }, chestStyle]}>
                  <LottieView
                    source={require("../assets/lotties/welcomeChest.json")}
                    autoPlay loop={false}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>

              {/* ── DAY COUNTER + TITRE ─────────────────────────────────────── */}
              <View style={{ alignItems: "center", gap: n(4) }}>
                {/* Scoreboard */}
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: n(3) }}>
                  <Text style={{
                    fontSize:      n(IS_TINY ? 38 : IS_SHORT ? 44 : 52),
                    fontWeight:    "900",
                    letterSpacing: -2,
                    color:         AMBER,
                    lineHeight:    n(IS_TINY ? 42 : IS_SHORT ? 50 : 58),
                  }}>
                    {displayDay}
                  </Text>
                  <Text style={{ fontSize: n(IS_TINY ? 20 : 26), fontWeight: "700", color: TEXT_FAINT }}>
                    /
                  </Text>
                  <Text style={{ fontSize: n(IS_TINY ? 20 : 26), fontWeight: "700", color: TEXT_FAINT }}>
                    {clampedTotal}
                  </Text>
                </View>
                <Text style={{
                  fontSize:      n(10.5),
                  fontWeight:    "700",
                  letterSpacing: 0.9,
                  textTransform: "uppercase",
                  color:         TEXT_FAINT,
                }}>
                  {t("welcomeBonus.dayCounterLabel", { defaultValue: "jours consécutifs" })}
                </Text>
              </View>

              {/* ── TIMELINE ────────────────────────────────────────────────── */}
              {renderTimeline()}

              {/* ── REWARD CARD ─────────────────────────────────────────────── */}
              <View style={{
                borderRadius: n(20),
                overflow:     "hidden",
                borderWidth:  1,
                borderColor:  STROKE,
              }}>
                <LinearGradient
                  colors={["rgba(255,183,0,0.13)", "rgba(255,140,0,0.06)", "rgba(8,10,16,0)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ padding: n(IS_TINY ? 12 : 14) }}
                >
                  {/* Shimmer */}
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden", borderRadius: n(20) }]}>
                    <Animated.View style={[{
                      position:        "absolute",
                      width:           n(70),
                      height:          n(260),
                      backgroundColor: "rgba(255,220,100,0.09)",
                      borderRadius:    n(35),
                      top:             -n(90),
                    }, shimmerStyle]} />
                  </Animated.View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: n(12) }}>
                    <View style={{
                      width:           n(IS_TINY ? 48 : 56),
                      height:          n(IS_TINY ? 48 : 56),
                      borderRadius:    n(16),
                      alignItems:      "center",
                      justifyContent:  "center",
                      backgroundColor: "rgba(255,183,0,0.13)",
                      borderWidth:     1,
                      borderColor:     "rgba(255,183,0,0.28)",
                      flexShrink:      0,
                    }}>
                      <Ionicons name={getIcon(rewardType)} size={n(IS_TINY ? 24 : 28)} color={AMBER} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{
                        fontSize:      n(9.5),
                        fontWeight:    "800",
                        letterSpacing: 1.1,
                        textTransform: "uppercase",
                        color:         AMBER,
                        marginBottom:  n(3),
                      }}>
                        {t("welcomeBonus.todayRewardTitle", { defaultValue: "Récompense du jour" })}
                      </Text>
                      <Text style={{
                        fontSize:      n(IS_TINY ? 16 : 19),
                        fontWeight:    "900",
                        color:         TEXT,
                        letterSpacing: -0.3,
                        marginBottom:  n(2),
                      }} numberOfLines={1} adjustsFontSizeToFit>
                        {rewardLabel}
                      </Text>
                      <Text style={{
                        fontSize:   n(11),
                        color:      TEXT_DIM,
                        lineHeight: n(15),
                      }} numberOfLines={2}>
                        {rewardHint}
                      </Text>
                    </View>
                  </View>

                  {claimSuccess && (
                    <Animated.View entering={ZoomIn.springify()} style={{
                      marginTop:       n(10),
                      flexDirection:   "row",
                      alignItems:      "center",
                      gap:             n(5),
                      alignSelf:       "flex-end",
                      backgroundColor: "rgba(100,220,100,0.15)",
                      borderWidth:     1,
                      borderColor:     "rgba(100,220,100,0.30)",
                      borderRadius:    n(999),
                      paddingHorizontal: n(10),
                      paddingVertical:   n(4),
                    }}>
                      <Ionicons name="checkmark-circle" size={n(13)} color="#6DDC7A" />
                      <Text style={{ fontSize: n(11), fontWeight: "800", color: "#6DDC7A" }}>
                        {t("welcomeBonus.claimSuccess", { defaultValue: "Ajouté !" })}
                      </Text>
                    </Animated.View>
                  )}
                </LinearGradient>
              </View>

              {/* ── CTA ─────────────────────────────────────────────────────── */}
              <Pressable
                onPress={handleClaim}
                disabled={!!loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!loading, busy: !!loading }}
                style={({ pressed }) => [
                  {
                    borderRadius: n(16),
                    overflow:     "hidden",
                    borderWidth:  1,
                    borderColor:  "rgba(255,183,0,0.35)",
                    shadowColor:  AMBER,
                    shadowOffset: { width: 0, height: n(7) },
                    shadowOpacity: 0.38,
                    shadowRadius: n(18),
                    elevation:    14,
                  },
                  pressed && !loading && { transform: [{ scale: 0.984 }], opacity: 0.92 },
                  loading && { opacity: 0.78 },
                ]}
              >
                <LinearGradient
                  colors={[AMBER_LIGHT, AMBER, AMBER_DIM]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    minHeight:      n(IS_TINY ? 48 : 54),
                    flexDirection:  "row",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            n(10),
                    paddingHorizontal: n(24),
                  }}
                >
                  {/* Shimmer sur CTA */}
                  {!loading && (
                    <Animated.View pointerEvents="none" style={[{
                      position:        "absolute",
                      width:           n(90),
                      height:          n(180),
                      backgroundColor: "rgba(255,255,255,0.22)",
                      borderRadius:    n(45),
                      top:             -n(70),
                    }, shimmerStyle]} />
                  )}
                  {/* Top shine */}
                  <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {
                    opacity:          0.18,
                    backgroundColor:  "white",
                    transform:        [{ translateY: -n(20) }],
                  }]} />

                  {loading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: n(10) }}>
                      <ActivityIndicator color="#05070B" />
                      <Text style={{ fontSize: n(15), fontWeight: "900", color: "#05070B" }}>
                        {t("welcomeBonus.ctaLoading", { defaultValue: "Un instant…" })}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={{
                        fontSize:   n(IS_TINY ? 14 : 15.5),
                        fontWeight: "900",
                        color:      "#05070B",
                        letterSpacing: 0.2,
                      }} numberOfLines={1} adjustsFontSizeToFit>
                        {t("welcomeBonus.cta", { defaultValue: "Récupérer ma récompense" })}
                      </Text>
                      <Ionicons name="arrow-forward" size={n(17)} color="#05070B" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {/* ── Bottom hint ──────────────────────────────────────────────── */}
              <Text style={{
                fontSize:   n(IS_TINY ? 10 : 10.5),
                textAlign:  "center",
                color:      TEXT_FAINT,
                lineHeight: n(14),
              }}>
                {t("welcomeBonus.bottomHint", { defaultValue: "Connecte-toi chaque jour pour tout débloquer." })}
              </Text>

            </View>
          </LinearGradient>
        </Animated.View>

      </View>
    </Modal>
  );
};

export default WelcomeBonusModal;
