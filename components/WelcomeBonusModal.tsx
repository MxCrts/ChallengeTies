// components/WelcomeBonusModal.tsx
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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
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
const AMBER        = "#FFB300";
const AMBER_LIGHT  = "#FFD060";
const AMBER_DIM    = "#C87800";
const AMBER_GLOW   = "rgba(255,179,0,0.18)";
const BG_DEEP      = "#06080E";
const BG_CARD      = "#0C0F1A";
const STROKE       = "rgba(255,183,0,0.22)";
const STROKE_SOFT  = "rgba(255,255,255,0.07)";
const TEXT         = "rgba(248,250,252,0.97)";
const TEXT_DIM     = "rgba(248,250,252,0.62)";
const TEXT_FAINT   = "rgba(248,250,252,0.32)";

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

// ─── Pulsing ring ────────────────────────────────────────────────────────────
const PulsingRing: React.FC<{ sz: number }> = ({ sz }) => {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 950, easing: Easing.out(Easing.quad) }),
        withTiming(1,   { duration: 0 })
      ), -1, false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0,    { duration: 950, easing: Easing.out(Easing.quad) }),
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

// ─── Main component ──────────────────────────────────────────────────────────
const WelcomeBonusModal: React.FC<WelcomeBonusModalProps> = ({
  visible, onClose, onClaim,
  currentDay, totalDays, rewardType, rewardAmount, loading,
}) => {
  const { t } = useTranslation();
  const { width: SW, height: SH } = useWindowDimensions();

 const IS_TINY = SH < 620;
const IS_SHORT = SH < 750;
const IS_TABLET = SW >= 768;
const IS_NARROW = SW < 360;
const IS_COMPACT = SH < 780 || IS_NARROW;

const n = useMemo(() => {
  const BASE_H = 812;
  const BASE_W = 375;

  const hr = Math.min(Math.max(SH / BASE_H, 0.72), 1.12);
  const wr = Math.min(Math.max(SW / BASE_W, 0.90), 1.08);

  // On évite qu’Android petits écrans explose verticalement
  const r = Math.min(hr, wr);

  return (v: number) => Math.round(v * r);
}, [SH, SW]);

  const clampedTotal = Math.max(1, totalDays || 1);
  const dayIndex     = Math.min(Math.max(currentDay, 0), clampedTotal - 1);
  const displayDay   = dayIndex + 1;
  const progress     = clampedTotal <= 1 ? 1 : (displayDay - 1) / (clampedTotal - 1);

  // ── Animations ──────────────────────────────────────────────────────────────
const cardScale   = useSharedValue(0.90);
const cardOpacity = useSharedValue(0);
const chestBob    = useSharedValue(0);
const chestScale  = useSharedValue(1);
const shimmer     = useSharedValue(-1);
const backdropO   = useSharedValue(0);
const ctaPulse    = useSharedValue(1);

  const [showConfetti, setShowConfetti] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    if (!visible) {
      backdropO.value = withTiming(0, { duration: 200 });
      return;
    }
    setClaimSuccess(false);
    setShowConfetti(false);

    backdropO.value = withTiming(1, { duration: 300 });
    cardOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    cardScale.value   = withSpring(1, { damping: 20, stiffness: 200 });

    chestBob.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0,  { duration: 700, easing: Easing.inOut(Easing.quad) })
      ), -1, true
    );
    chestScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true
    );
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1,  { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 0 })
      ), -1, false
    );

    ctaPulse.value = withRepeat(
  withSequence(
    withTiming(1.018, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) })
  ),
  -1,
  true
);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const chestStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chestBob.value }, { scale: chestScale.value }] as any,
  }));

  const SHIMMER_TRANSLATE = n(160);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * SHIMMER_TRANSLATE }, { rotateZ: "-18deg" }] as any,
    opacity: 0.18,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropO.value,
  }));

const ctaPulseStyle = useAnimatedStyle(() => ({
  transform: [{ scale: ctaPulse.value }],
}));

  // ── Helpers ──────────────────────────────────────────────────────────────────
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

  // ── Claim ────────────────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    chestScale.value = withSequence(
      withTiming(1.25, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 280 })
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
}, 720);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  // ── Layout ───────────────────────────────────────────────────────────────────
  const CARD_W = Math.min(SW - n(28), IS_TABLET ? 520 : 410);
const CARD_MAX_H = Math.min(SH * 0.84, IS_TABLET ? 760 : 690);

const CHEST_SIZE = IS_COMPACT ? n(78) : IS_SHORT ? n(92) : n(104);
const HERO_HALO_SIZE = CHEST_SIZE * (IS_COMPACT ? 2.35 : 2.6);

const DOT_SIZE = IS_COMPACT ? n(20) : n(24);
const RING_SIZE = DOT_SIZE + n(10);

  // ── Timeline ─────────────────────────────────────────────────────────────────
  const renderTimeline = () => (
    <View style={{ width: "100%", paddingHorizontal: n(2) }}>
      {/* Track base */}
      <View
  style={{
    position: "absolute",
    height: 1.5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: DOT_SIZE / 2,
    left: n(2) + DOT_SIZE / 2,
    right: n(2) + DOT_SIZE / 2,
  }}
/>
      {/* Track fill */}
      <LinearGradient
  colors={["rgba(200,120,0,0.95)", AMBER, AMBER_LIGHT]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={{
    position: "absolute",
    height: 1.5,
    borderRadius: 999,
    top: DOT_SIZE / 2,
    left: n(2) + DOT_SIZE / 2,
    width: `${progress * 100}%` as any,
    opacity: 0.92,
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
                    ? "rgba(255,183,0,0.20)"
                    : "rgba(255,255,255,0.05)",
                  borderWidth: isToday ? 0 : 1,
                  borderColor: isPast ? "rgba(255,183,0,0.30)" : STROKE_SOFT,
                }}>
                  {isPast ? (
                    <Ionicons name="checkmark" size={n(11)} color={AMBER} />
                  ) : (
                    <Ionicons
                      name={getIcon(kind)}
                      size={n(10)}
                      color={isToday ? "#05070B" : "rgba(255,255,255,0.25)"}
                    />
                  )}
                </View>
              </View>
              <Text
  style={{
    fontSize: n(7),
    fontWeight: "800",
    color: isToday ? AMBER_LIGHT : "rgba(248,250,252,0.26)",
    marginTop: n(5),
    textAlign: "center",
    letterSpacing: 0.45,
  }}
>
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
      animationType="none"
      onRequestClose={() => {}}
      statusBarTranslucent={false}
    >
      {/*
        ── FIX CENTRAGE BULLETPROOF ────────────────────────────────────────────
        SafeAreaView DANS la Modal = gestion native des insets
        sans dépendre du parent. Fonctionne iOS + Android identiquement.
      */}
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>

        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFillObject, backdropStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(2,4,10,0.94)" }]} />
          )}
        </Animated.View>

        {/* Orbes de fond */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
  <View
    style={{
      position: "absolute",
      alignSelf: "center",
      width: SW * 0.72,
      height: SW * 0.72,
      borderRadius: SW * 0.36,
      top: -SW * 0.18,
      backgroundColor: AMBER,
      opacity: 0.045,
    }}
  />
</View>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={180}
            origin={{ x: SW / 2, y: -10 }}
            fadeOut
            fallSpeed={2400}
            explosionSpeed={600}
            colors={[AMBER, "#FFE066", "#FF8C00", "#FFF3B0", "#FFFFFF", AMBER_LIGHT]}
          />
        )}

        {/* ── Centrage parfait ── */}
        <View
  style={{
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: n(14),
    paddingVertical: n(10),
  }}
  pointerEvents="box-none"
>
  <Animated.View
    entering={FadeIn.duration(260)}
    exiting={FadeOut.duration(180)}
    style={[
      {
        width: CARD_W,
        maxHeight: CARD_MAX_H,
        borderRadius: n(26),
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,183,0,0.16)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: n(10) },
        shadowOpacity: 0.34,
        shadowRadius: n(26),
        elevation: 22,
      },
      cardStyle,
    ]}
  >
            {/* Fond dégradé premium */}
            <LinearGradient
  colors={[
    "rgba(255,183,0,0.06)",
    "#0A0E18",
    "#05070B",
  ]}
  locations={[0, 0.20, 1]}
  start={{ x: 0.5, y: 0 }}
  end={{ x: 0.5, y: 1 }}
  style={{ borderRadius: n(26), overflow: "hidden" }}
>
              {/* Mesh orbe interne */}
              <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
  <View
    style={{
      position: "absolute",
      width: n(260),
      height: n(260),
      borderRadius: n(130),
      top: -n(92),
      alignSelf: "center",
      backgroundColor: "rgba(255,179,0,0.035)",
    }}
  />
</View>

              {/* Ligne décorative top */}
              <View style={{
                height: 1,
                marginHorizontal: n(22),
                marginTop: n(1),
                backgroundColor: "rgba(255,183,0,0.16)",
                borderRadius: 999,
              }} />

              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                scrollEnabled={IS_COMPACT}
contentContainerStyle={{
  paddingHorizontal: n(IS_COMPACT ? 14 : 18),
  paddingTop: n(IS_COMPACT ? 14 : 18),
  paddingBottom: n(IS_COMPACT ? 14 : 18),
  gap: n(IS_COMPACT ? 9 : 12),
  flexGrow: 1,
}}
              >

                {/* ── RIBBON ── */}
                <View style={{ alignItems: "center" }}>
                  <View style={{
                    flexDirection:     "row",
                    alignItems:        "center",
                    gap:               n(6),
                    backgroundColor:   "rgba(255,179,0,0.09)",
                    borderWidth:       1,
                    borderColor:       "rgba(255,183,0,0.24)",
                    borderRadius:      999,
                    paddingHorizontal: n(14),
                    paddingVertical:   n(5),
                  }}>
                    <Ionicons name="sparkles" size={n(9)} color={AMBER_LIGHT} />
                    <Text style={{
                      fontSize:      n(9.5),
                      fontWeight:    "800",
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      color:         AMBER_LIGHT,
                    }}>
                      {t("welcomeBonus.ribbon", { defaultValue: "Pack de bienvenue" })}
                    </Text>
                  </View>
                </View>

                {/* ── COFFRE HERO ── */}
                <View
  style={{
    alignItems: "center",
    justifyContent: "center",
    marginTop: n(2),
    marginBottom: n(2),
    minHeight: IS_COMPACT ? n(118) : n(138),
  }}
>
  <View
    pointerEvents="none"
    style={{
      position: "absolute",
      width: HERO_HALO_SIZE,
      height: HERO_HALO_SIZE,
      borderRadius: HERO_HALO_SIZE / 2,
      backgroundColor: "rgba(255,179,0,0.09)",
    }}
  />

  {[CHEST_SIZE + n(18), CHEST_SIZE + n(36)].map((sz, i) => (
    <View
      key={i}
      pointerEvents="none"
      style={{
        position: "absolute",
        width: sz,
        height: sz,
        borderRadius: sz / 2,
        borderWidth: 1,
        borderColor: i === 0 ? "rgba(255,183,0,0.16)" : "rgba(255,183,0,0.08)",
      }}
    />
  ))}

  <Animated.View
    style={[
      {
        width: CHEST_SIZE,
        height: CHEST_SIZE,
        zIndex: 2,
      },
      chestStyle,
    ]}
  >
    <LottieView
      source={require("../assets/lotties/welcomeChest.json")}
      autoPlay
      loop={false}
      style={{ width: "100%", height: "100%" }}
      resizeMode="contain"
    />
  </Animated.View>
</View>

                {/* ── COMPTEUR DE JOURS ── */}
                <View style={{ alignItems: "center", gap: n(2) }}>
  <View
    style={{
      flexDirection: "row",
      alignItems: "flex-end",
      gap: n(2),
    }}
  >
    <Text
      style={{
        fontSize: n(IS_COMPACT ? 38 : IS_SHORT ? 46 : 54),
        fontWeight: "900",
        letterSpacing: -2.2,
        color: AMBER,
        lineHeight: n(IS_COMPACT ? 40 : IS_SHORT ? 48 : 56),
      }}
    >
      {displayDay}
    </Text>

    <Text
      style={{
        fontSize: n(IS_COMPACT ? 18 : 22),
        fontWeight: "700",
        color: "rgba(248,250,252,0.42)",
        letterSpacing: -0.6,
        marginBottom: n(2),
      }}
    >
      /{clampedTotal}
    </Text>
  </View>

  <Text
    style={{
      fontSize: n(9),
      fontWeight: "700",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: "rgba(248,250,252,0.28)",
    }}
  >
    {t("welcomeBonus.dayCounterLabel", { defaultValue: "jours consécutifs" })}
  </Text>
</View>

                {/* ── TIMELINE ── */}
                {renderTimeline()}

                {/* ── REWARD CARD ── */}
                <Animated.View
  entering={ZoomIn.delay(100).springify()}
  style={{
    borderRadius: n(18),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,183,0,0.18)",
    backgroundColor: "rgba(255,255,255,0.015)",
  }}
>
                  <LinearGradient
  colors={["rgba(255,183,0,0.10)", "rgba(255,140,0,0.03)", "rgba(8,10,18,0.14)"]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{ padding: n(IS_COMPACT ? 12 : 14) }}
>
                    {/* Shimmer */}
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden", borderRadius: n(18) }]}>
                      <Animated.View style={[{
                        position:        "absolute",
                        width:           n(60),
                        height:          n(280),
                        backgroundColor: "rgba(255,220,100,0.07)",
                        borderRadius:    n(30),
                        top:             -n(100),
                      }, shimmerStyle]} />
                    </Animated.View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: n(10) }}>
                      {/* Icône reward */}
                      <View
  style={{
    width: n(IS_COMPACT ? 44 : 50),
    height: n(IS_COMPACT ? 44 : 50),
    borderRadius: n(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,183,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,183,0,0.22)",
    flexShrink: 0,
  }}
>
  <Ionicons name={getIcon(rewardType)} size={n(IS_COMPACT ? 20 : 24)} color={AMBER} />
</View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{
                          fontSize:      n(8.5),
                          fontWeight:    "800",
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          color:         AMBER,
                          marginBottom:  n(3),
                          opacity:       0.85,
                        }}>
                          {t("welcomeBonus.todayRewardTitle", { defaultValue: "Récompense du jour" })}
                        </Text>
                        <Text
  style={{
    fontSize: n(IS_COMPACT ? 15.5 : 18.5),
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -0.45,
    marginBottom: n(2),
  }}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {rewardLabel}
</Text>
                        <Text
  style={{
    fontSize: n(10.5),
    color: TEXT_DIM,
    lineHeight: n(13.5),
  }}
  numberOfLines={2}
>
  {rewardHint}
</Text>
                      </View>
                    </View>

                    {claimSuccess && (
                      <Animated.View
                        entering={ZoomIn.springify()}
                        style={{
                          marginTop:         n(10),
                          flexDirection:     "row",
                          alignItems:        "center",
                          gap:               n(5),
                          alignSelf:         "flex-end",
                          backgroundColor:   "rgba(74,222,128,0.12)",
                          borderWidth:       1,
                          borderColor:       "rgba(74,222,128,0.28)",
                          borderRadius:      999,
                          paddingHorizontal: n(10),
                          paddingVertical:   n(4),
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={n(13)} color="#4ADE80" />
                        <Text style={{ fontSize: n(11), fontWeight: "800", color: "#4ADE80" }}>
                          {t("welcomeBonus.claimSuccess", { defaultValue: "Ajouté !" })}
                        </Text>
                      </Animated.View>
                    )}
                  </LinearGradient>
                </Animated.View>

                {/* ── CTA ── */}
                <Animated.View style={ctaPulseStyle}>
  <Pressable
    onPress={handleClaim}
    disabled={!!loading}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!loading, busy: !!loading }}
    style={({ pressed }) => [
      {
        borderRadius: n(17),
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,210,0,0.34)",
        shadowColor: AMBER,
        shadowOffset: { width: 0, height: n(8) },
        shadowOpacity: 0.28,
        shadowRadius: n(16),
        elevation: 12,
      },
      pressed && !loading && { transform: [{ scale: 0.985 }], opacity: 0.95 },
      loading && { opacity: 0.72 },
    ]}
  >
    <LinearGradient
      colors={["#FFE28A", "#FFD86B", AMBER]}
      locations={[0, 0.34, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        minHeight: n(IS_COMPACT ? 46 : 52),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: n(9),
        paddingHorizontal: n(18),
      }}
    >
      {!loading && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: n(84),
              height: n(170),
              backgroundColor: "rgba(255,255,255,0.10)",
              borderRadius: n(50),
              top: -n(66),
            },
            shimmerStyle,
          ]}
        />
      )}

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: n(10) }}>
          <ActivityIndicator color="#05070B" />
          <Text style={{ fontSize: n(14), fontWeight: "900", color: "#05070B" }}>
            {t("welcomeBonus.ctaLoading", { defaultValue: "Un instant…" })}
          </Text>
        </View>
      ) : (
        <>
          <Text
            style={{
              fontSize: n(IS_COMPACT ? 13.5 : 15),
              fontWeight: "900",
              color: "#05070B",
              letterSpacing: 0,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {t("welcomeBonus.cta", { defaultValue: "Récupérer" })}
          </Text>

          <View
            style={{
              width: n(27),
              height: n(27),
              borderRadius: n(13.5),
              backgroundColor: "rgba(5,7,11,0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-forward" size={n(14)} color="#05070B" />
          </View>
        </>
      )}
    </LinearGradient>
  </Pressable>
</Animated.View>

                {/* ── Bottom hint ── */}
                <Text
  style={{
    fontSize: n(9.2),
    textAlign: "center",
    color: "rgba(248,250,252,0.22)",
    lineHeight: n(12.5),
    letterSpacing: 0.1,
    paddingHorizontal: n(10),
  }}
  numberOfLines={2}
>
  {t("welcomeBonus.bottomHint", {
    defaultValue: "Reviens chaque jour pour tout débloquer.",
  })}
</Text>

              </ScrollView>

              {/* Ligne décorative bottom */}
              <View style={{
                height: 1,
                marginHorizontal: n(22),
                marginBottom: n(1),
                backgroundColor: "rgba(255,183,0,0.10)",
                borderRadius: 999,
              }} />

            </LinearGradient>
          </Animated.View>
        </View>

      </SafeAreaView>
    </Modal>
  );
};

export default WelcomeBonusModal;