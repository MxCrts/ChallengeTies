// VsIntroModal.tsx — ULTIME — Top 1 Mondial Netflix
// Logique 100% inchangée — subtitle déplacé en bas de stage

import React, { useCallback, useEffect, useRef } from "react";
import {
  Modal, Platform, StyleSheet, Text, View, type ViewStyle,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Animated, {
  Easing, interpolate, runOnJS,
  useAnimatedStyle, useSharedValue,
  withDelay, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import PioneerBadge from "@/components/PioneerBadge";
import { normalizeSize } from "../challengeDetails.tokens";

// ─── Timing ──────────────────────────────────────────────────────────────────
const T_BG_IN        = 200;
const T_AVATAR_IN    = 460;
const T_AVATAR_DELAY = 70;
const T_GLOW_IN      = 360;
const T_VS_DELAY     = 540;
const T_VS_IN        = 280;
const T_SCAN         = 960;
const T_SUBTITLE     = 320;
const T_HOLD         = 1400;
const T_FADEOUT      = 440;

// ─── Types ───────────────────────────────────────────────────────────────────
export type VsIntroModalProps = {
  visible: boolean;
  myAvatar: string;
  myName: string;
  myIsPioneer?: boolean;
  partnerAvatar: string;
  partnerName: string;
  partnerIsPioneer?: boolean;
  reduceMotion?: boolean;
  onDone: () => void;
  onShow?: () => void;
};

// ─── AvatarCard ──────────────────────────────────────────────────────────────
type AvatarCardProps = {
  uri: string;
  name: string;
  isPioneer?: boolean;
  side: "left" | "right";
  slideAnim: Animated.SharedValue<number>;
  glowAnim: Animated.SharedValue<number>;
  impactAnim: Animated.SharedValue<number>;
  size: number;
  onImgLoad: () => void;
};

const AvatarCard = React.memo(function AvatarCard({
  uri, name, isPioneer, side,
  slideAnim, glowAnim, impactAnim,
  size, onImgLoad,
}: AvatarCardProps) {
  const dir         = side === "left" ? -1 : 1;
  const accentColor = side === "left" ? "#FF9F1C" : "#00C2FF";
  const accentAlpha = side === "left" ? "rgba(255,159,28,0.22)" : "rgba(0,194,255,0.22)";

  const containerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(slideAnim.value, [0, 0.22, 1], [0, 0.65, 1]),
    transform: [
      { translateX: interpolate(slideAnim.value, [0, 0.68, 0.86, 1], [dir * 140, dir * 16, dir * -6, 0], "clamp") },
      { scale:      interpolate(slideAnim.value, [0, 0.68, 1],        [0.70, 1.07, 1],                   "clamp") },
    ] as ViewStyle["transform"],
  }));

  const halo3Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(glowAnim.value, [0, 1], [0, 0.20]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.3, 1.55]) }] as ViewStyle["transform"],
  }));
  const halo2Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(glowAnim.value, [0, 1], [0, 0.42]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.4, 1.32]) }] as ViewStyle["transform"],
  }));
  const halo1Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(glowAnim.value, [0, 1], [0, 0.78]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.5, 1.14]) }] as ViewStyle["transform"],
  }));
  const impactStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(impactAnim.value, [0, 0.30, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(impactAnim.value, [0, 1], [0.75, 1.42]) }] as ViewStyle["transform"],
  }));
  const trailStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(slideAnim.value, [0, 0.30, 0.78, 1], [0, 0.65, 0.28, 0]),
    transform: [
      { translateX: interpolate(slideAnim.value, [0, 1], [dir * 60, dir * -22], "clamp") },
      { scaleX:     interpolate(slideAnim.value, [0, 1], [3.2, 0.12]) },
    ] as ViewStyle["transform"],
  }));
  const nameStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(slideAnim.value, [0.50, 1], [0, 1]),
    transform: [{ translateY: interpolate(slideAnim.value, [0.50, 1], [14, 0]) }] as ViewStyle["transform"],
  }));

  return (
    <Animated.View style={[s.avatarCol, containerStyle]}>
      {/* Traînée */}
      <Animated.View pointerEvents="none" style={[
        s.trail,
        { backgroundColor: accentColor + "55", [side === "left" ? "right" : "left"]: "36%" },
        trailStyle,
      ]} />

      {/* Triple halo */}
      <Animated.View pointerEvents="none" style={[s.haloBase, {
        width: size + 68, height: size + 68, borderRadius: (size + 68) / 2,
        backgroundColor: accentAlpha,
      }, halo3Style]} />
      <Animated.View pointerEvents="none" style={[s.haloBase, {
        width: size + 38, height: size + 38, borderRadius: (size + 38) / 2,
        borderWidth: 1.5, borderColor: accentColor + "55",
      }, halo2Style]} />
      <Animated.View pointerEvents="none" style={[s.haloBase, {
        width: size + 20, height: size + 20, borderRadius: (size + 20) / 2,
        borderWidth: 1, borderColor: accentColor + "99",
      }, halo1Style]} />

      {/* Impact */}
      <Animated.View pointerEvents="none" style={[s.haloBase, {
        width: size + 84, height: size + 84, borderRadius: (size + 84) / 2,
        backgroundColor: accentColor + "1A",
      }, impactStyle]} />

      {/* Avatar shell */}
      <View style={[s.avatarShell, {
        width: size, height: size, borderRadius: size / 2,
        borderColor: accentColor,
        shadowColor: accentColor,
      }]}>
        <ExpoImage
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onLoad={onImgLoad}
          onError={onImgLoad}
        />
        {/* Spéculaire */}
        <View style={[StyleSheet.absoluteFillObject, {
          borderRadius: size / 2,
          backgroundColor: "rgba(255,255,255,0.12)",
          bottom: "54%",
        }]} pointerEvents="none" />
        {/* Bord inner */}
        <View style={[StyleSheet.absoluteFillObject, {
          borderRadius: size / 2,
          borderWidth: 1, borderColor: accentColor + "33",
        }]} pointerEvents="none" />
      </View>

      {isPioneer && <PioneerBadge size="mini" style={s.pioneer} />}

      {/* Nom */}
      <Animated.View style={[s.nameWrap, nameStyle]}>
        <Text
          style={[s.nameLabel, Platform.OS === "ios" && {
            textShadowColor: "rgba(0,0,0,0.95)",
            textShadowRadius: 12,
            textShadowOffset: { width: 0, height: 2 },
          }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        {/* Ligne colorée sous le nom */}
        <LinearGradient
          colors={["transparent", accentColor, accentColor, "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.nameLine}
        />
      </Animated.View>
    </Animated.View>
  );
});

// ─── VsBadge (sans subtitle — déplacé en bas) ─────────────────────────────
type VsBadgeProps = {
  vsAnim: Animated.SharedValue<number>;
  scanAnim: Animated.SharedValue<number>;
};

const VsBadge = React.memo(function VsBadge({ vsAnim, scanAnim }: VsBadgeProps) {
  const badgeStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(vsAnim.value, [0, 0.35, 1], [0, 0.85, 1]),
    transform: [
      { scale:  interpolate(vsAnim.value, [0, 0.52, 0.78, 1], [0, 1.42, 0.88, 1], "clamp") },
      { rotate: `${interpolate(vsAnim.value, [0, 1], [-12, 0])}deg` },
    ] as ViewStyle["transform"],
  }));
  const outerGlowStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(vsAnim.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(vsAnim.value, [0, 1], [0.3, 1.10]) }] as ViewStyle["transform"],
  }));
  const pulseStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(vsAnim.value, [0, 0.45, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(vsAnim.value, [0, 1], [0.35, 2.2]) }] as ViewStyle["transform"],
  }));
  const scanStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateY: interpolate(scanAnim.value, [0, 1], [-80, 80], "clamp") }] as ViewStyle["transform"],
    opacity:   interpolate(scanAnim.value, [0, 0.05, 0.93, 1], [0, 1, 1, 0]),
  }));

  return (
    <View style={s.vsCenterWrap}>
      <Animated.View pointerEvents="none" style={[s.vsPulse, pulseStyle]} />
      <Animated.View pointerEvents="none" style={[s.vsOuterGlow, outerGlowStyle]} />

      <Animated.View style={[s.vsZone, badgeStyle]}>
        <View style={s.vsBadge}>
          {/* Gradient métal premium */}
          <LinearGradient
            colors={["#FFF5B0", "#FFCC00", "#FF8C00", "#FF5500", "#FF8C00", "#FFCC00"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Profondeur */}
          <LinearGradient
            colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0.00)", "rgba(0,0,0,0.30)"]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          {/* Spéculaire */}
          <LinearGradient
            colors={["rgba(255,255,255,0.70)", "rgba(255,255,255,0.00)"]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.1, y: 1 }}
            style={[StyleSheet.absoluteFill, { bottom: "46%" }]}
            pointerEvents="none"
          />
          {/* Scan */}
          <View style={s.scanClip} pointerEvents="none">
            <Animated.View style={[s.scanLine, scanStyle]} />
          </View>
          <View style={s.vsBorder} pointerEvents="none" />
          <Text style={s.vsText}>VS</Text>
        </View>

        {/* Étoiles déco */}
        {([
          [s.decoTL, "✦"], [s.decoBR, "✦"],
          [s.decoTR, "·"], [s.decoBL, "·"],
        ] as const).map(([st, ch], i) => (
          <View key={i} style={[s.decoCorner, st]} pointerEvents="none">
            <Text style={s.decoChar}>{ch}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

// ─── Main ────────────────────────────────────────────────────────────────────
export default function VsIntroModal({
  visible,
  myAvatar, myName, myIsPioneer,
  partnerAvatar, partnerName, partnerIsPioneer,
  reduceMotion = false,
  onDone, onShow,
}: VsIntroModalProps) {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const subtitleText = t("vsIntro.challengeAccepted", { defaultValue: "CHALLENGE ACCEPTED" });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const myLoaded       = useRef(false);
  const partnerLoaded  = useRef(false);
  const startedRef     = useRef(false);
  const doneRef        = useRef(false);

  // ── Shared values ────────────────────────────────────────────────────────
  const bgOpacity     = useSharedValue(0);
  const leftSlide     = useSharedValue(0);
  const rightSlide    = useSharedValue(0);
  const leftGlow      = useSharedValue(0);
  const rightGlow     = useSharedValue(0);
  const leftImpact    = useSharedValue(0);
  const rightImpact   = useSharedValue(0);
  const vsAnim        = useSharedValue(0);
  const scanAnim      = useSharedValue(0);
  const subtitleAnim  = useSharedValue(0);
  const flashOpacity  = useSharedValue(0);
  const fadeOut       = useSharedValue(1);
  const particleAnim  = useSharedValue(0);
  const collisionAnim = useSharedValue(0);

  const SIZE = normalizeSize(114);

  const fireOnDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const runSequence = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (reduceMotion) {
      bgOpacity.value    = withTiming(1, { duration: 280 });
      leftSlide.value    = withTiming(1, { duration: 280 });
      rightSlide.value   = withTiming(1, { duration: 280 });
      leftGlow.value     = withTiming(1, { duration: 280 });
      rightGlow.value    = withTiming(1, { duration: 280 });
      vsAnim.value       = withDelay(280, withTiming(1, { duration: 280 }));
      subtitleAnim.value = withDelay(480, withTiming(1, { duration: 280 }));
      fadeOut.value      = withDelay(1200, withTiming(0, { duration: 300 }, () => runOnJS(fireOnDone)()));
      return;
    }

    bgOpacity.value = withTiming(1, { duration: T_BG_IN + 80, easing: Easing.out(Easing.quad) });

    leftSlide.value  = withDelay(T_BG_IN, withTiming(1, { duration: T_AVATAR_IN, easing: Easing.out(Easing.cubic) }));
    rightSlide.value = withDelay(T_BG_IN + T_AVATAR_DELAY, withTiming(1, { duration: T_AVATAR_IN, easing: Easing.out(Easing.cubic) }));

    leftGlow.value  = withDelay(T_BG_IN + 90,  withTiming(1, { duration: T_GLOW_IN, easing: Easing.out(Easing.quad) }));
    rightGlow.value = withDelay(T_BG_IN + 150, withTiming(1, { duration: T_GLOW_IN, easing: Easing.out(Easing.quad) }));

    const impactAt = T_BG_IN + T_AVATAR_IN - 65;
    leftImpact.value  = withDelay(impactAt, withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) })
    ));
    rightImpact.value = withDelay(impactAt + 45, withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) })
    ));
    flashOpacity.value = withDelay(impactAt, withSequence(
      withTiming(0.28, { duration: 60 }),
      withTiming(0,    { duration: 300 })
    ));
    collisionAnim.value = withDelay(impactAt, withSequence(
      withTiming(1, { duration: 110 }),
      withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) })
    ));
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), impactAt);

    vsAnim.value       = withDelay(T_BG_IN + T_VS_DELAY, withSpring(1, { damping: 9, stiffness: 300, mass: 0.7 }));
    scanAnim.value     = withDelay(T_BG_IN + T_VS_DELAY + T_VS_IN, withTiming(1, { duration: T_SCAN, easing: Easing.inOut(Easing.quad) }));
    subtitleAnim.value = withDelay(T_BG_IN + T_VS_DELAY + T_VS_IN + T_SUBTITLE, withSpring(1, { damping: 13, stiffness: 230 }));
    particleAnim.value = withDelay(T_BG_IN + T_VS_DELAY, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), T_BG_IN + T_VS_DELAY + 110);

    const total = T_BG_IN + T_VS_DELAY + T_VS_IN + T_SCAN + T_HOLD;
    fadeOut.value = withDelay(total, withTiming(0, { duration: T_FADEOUT, easing: Easing.in(Easing.quad) }, () => runOnJS(fireOnDone)()));
  }, [
    reduceMotion, bgOpacity, leftSlide, rightSlide, leftGlow, rightGlow,
    leftImpact, rightImpact, vsAnim, scanAnim, subtitleAnim, flashOpacity,
    collisionAnim, particleAnim, fadeOut, fireOnDone,
  ]);

  const tryStart = useCallback(() => {
    if (startedRef.current) return;
    if (myLoaded.current && partnerLoaded.current) runSequence();
  }, [runSequence]);

  useEffect(() => {
    if (!visible) return;

    myLoaded.current      = false;
    partnerLoaded.current = false;
    startedRef.current    = false;
    doneRef.current       = false;

    bgOpacity.value     = 0;
    leftSlide.value     = 0;
    rightSlide.value    = 0;
    leftGlow.value      = 0;
    rightGlow.value     = 0;
    leftImpact.value    = 0;
    rightImpact.value   = 0;
    vsAnim.value        = 0;
    scanAnim.value      = 0;
    subtitleAnim.value  = 0;
    flashOpacity.value  = 0;
    particleAnim.value  = 0;
    collisionAnim.value = 0;
    fadeOut.value       = 1;

    onShow?.();

    const f1 = setTimeout(() => {
      if (startedRef.current) return;
      myLoaded.current      = true;
      partnerLoaded.current = true;
      requestAnimationFrame(() => runSequence());
    }, 600);
    const f2 = setTimeout(() => {
      if (startedRef.current) return;
      runSequence();
    }, 1500);

    return () => { clearTimeout(f1); clearTimeout(f2); };
  }, [visible]);

  // ── Animated styles ──────────────────────────────────────────────────────
  const rootStyle     = useAnimatedStyle<ViewStyle>(() => ({ opacity: fadeOut.value }));
  const bgStyle       = useAnimatedStyle<ViewStyle>(() => ({ opacity: bgOpacity.value }));
  const flashStyle    = useAnimatedStyle<ViewStyle>(() => ({ opacity: flashOpacity.value }));
  const collisionStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(collisionAnim.value, [0, 0.22, 1], [0, 1, 0]),
    transform: [{ scaleX: interpolate(collisionAnim.value, [0, 0.22, 1], [0, 1.6, 0.08]) }] as ViewStyle["transform"],
  }));

  // Subtitle animé — séparé en bas
  const subtitleStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity:   interpolate(subtitleAnim.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(subtitleAnim.value, [0, 1], [20, 0]) },
      { scale:      interpolate(subtitleAnim.value, [0, 1], [0.80, 1]) },
    ] as ViewStyle["transform"],
  }));

  // Particules
  const makeP = (dx: number, dy: number, d: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle<ViewStyle>(() => ({
      opacity: interpolate(particleAnim.value, [0, d, d + 0.30, 1], [0, 0, 0.95, 0]),
      transform: [
        { translateX: interpolate(particleAnim.value, [d, 1], [0, dx], "clamp") },
        { translateY: interpolate(particleAnim.value, [d, 1], [0, dy], "clamp") },
        { scale:      interpolate(particleAnim.value, [d, d + 0.26, 1], [0, 1.6, 0.15], "clamp") },
      ] as ViewStyle["transform"],
    }));

  const p1 = makeP(-46, -62, 0.00);
  const p2 = makeP( 52, -48, 0.04);
  const p3 = makeP(-30,  56, 0.07);
  const p4 = makeP( 62,  44, 0.02);
  const p5 = makeP(-68,  10, 0.09);
  const p6 = makeP( 36, -68, 0.05);
  const p7 = makeP( 72, -18, 0.11);
  const p8 = makeP(-20,  74, 0.06);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}
      onShow={onShow}
    >
      <Animated.View style={[StyleSheet.absoluteFill, s.root, rootStyle]}>

        {/* Fond noir immédiat */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#010003" }]} />

        {/* Fond cinématique */}
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <LinearGradient
            colors={["#060200", "#000003", "#000600"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,90,0,0.32)", "rgba(255,90,0,0.10)", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,140,255,0.10)", "rgba(0,140,255,0.30)"]}
            start={{ x: 0.45, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          {/* Vignette haut/bas */}
          <LinearGradient
            colors={["rgba(0,0,0,0.85)", "transparent", "rgba(0,0,0,0.85)"]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          {/* Letterbox cinéma */}
          <View style={s.letterboxTop} pointerEvents="none" />
          <View style={s.letterboxBot} pointerEvents="none" />
          {/* Lignes de fond */}
          <View style={s.centerVLine} pointerEvents="none" />
          {[18, 34, 66, 82].map((pct, i) => (
            <View key={i} style={[s.hGridLine, { top: `${pct}%` as any }]} pointerEvents="none" />
          ))}
        </Animated.View>

        {/* Flash global */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.flashOverlay, flashStyle]} />

        {/* ── STAGE ─────────────────────────────────────────────────────── */}
        <View style={[s.outerWrap, {
          paddingTop:    Math.max(insets.top    + 24, 48),
          paddingBottom: Math.max(insets.bottom + 32, 56),
        }]}>

          {/* Zone avatars + VS */}
          <View style={s.stage}>
            <AvatarCard
              uri={myAvatar} name={myName} isPioneer={myIsPioneer}
              side="left" slideAnim={leftSlide} glowAnim={leftGlow} impactAnim={leftImpact}
              size={SIZE}
              onImgLoad={() => { myLoaded.current = true; tryStart(); }}
            />

            {/* Centre */}
            <View style={s.center}>
              <Animated.View pointerEvents="none" style={[s.collisionLine, collisionStyle]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pGold,  p1]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pBlue,  p2]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pGold,  p3]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pBlue,  p4]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pWhite, p5]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pWhite, p6]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pGold,  p7]} />
              <Animated.View pointerEvents="none" style={[s.part, s.pBlue,  p8]} />
              <VsBadge vsAnim={vsAnim} scanAnim={scanAnim} />
            </View>

            <AvatarCard
              uri={partnerAvatar} name={partnerName} isPioneer={partnerIsPioneer}
              side="right" slideAnim={rightSlide} glowAnim={rightGlow} impactAnim={rightImpact}
              size={SIZE}
              onImgLoad={() => { partnerLoaded.current = true; tryStart(); }}
            />
          </View>

          {/* ── SUBTITLE — en bas, bien séparé, jamais superposé ────────── */}
          <Animated.View style={[s.subtitleWrap, subtitleStyle]} pointerEvents="none">
            <View style={s.subtitleInner}>
              <LinearGradient
                colors={["transparent", "rgba(255,215,0,0.55)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.subtitleLineLeft}
              />
              <Text
                style={s.subtitleText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
                ellipsizeMode="clip"
              >
                {subtitleText}
              </Text>
              <LinearGradient
                colors={["rgba(255,215,0,0.55)", "transparent"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.subtitleLineRight}
              />
            </View>
          </Animated.View>

        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { justifyContent: "center", alignItems: "center", zIndex: 99999 },

  letterboxTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: "6%", backgroundColor: "#000",
  },
  letterboxBot: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: "6%", backgroundColor: "#000",
  },

  // Layout principal — colonne : stage + subtitle
  outerWrap: {
    flex: 1, width: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Stage — avatars + centre
  stage: {
    flex: 1, width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },

  // Avatar
  avatarCol: { flex: 1, alignItems: "center", position: "relative" },
  trail:     { position: "absolute", height: 4, width: "88%", top: "38%", borderRadius: 3 },
  haloBase:  { position: "absolute" },
  avatarShell: {
    borderWidth: 2.5, overflow: "hidden",
    ...Platform.select({
      ios:     { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.72, shadowRadius: 20 },
      android: { elevation: 14 },
      default: {},
    }),
  },
  pioneer:  { position: "absolute", bottom: 38, alignSelf: "center", marginLeft: 48 },
  nameWrap: { marginTop: 14, alignItems: "center", width: "90%" },
  nameLabel: {
    color: "#FFFFFF", fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14.5), textAlign: "center",
    letterSpacing: 0.5, includeFontPadding: false,
  },
  nameLine: { marginTop: 6, height: 2, width: "55%", borderRadius: 1, opacity: 0.75 },

  // Centre
  center: { width: 100, alignItems: "center", justifyContent: "center", position: "relative" },
  collisionLine: {
    position: "absolute", width: 130, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...Platform.select({
      ios: { shadowColor: "#fff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 14 },
    }),
  },

  // VS
  vsCenterWrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  vsPulse:    { position: "absolute", width: 148, height: 148, borderRadius: 74, backgroundColor: "rgba(255,180,0,0.08)" },
  vsOuterGlow: {
    position: "absolute", width: 112, height: 112, borderRadius: 56,
    backgroundColor: "rgba(255,160,0,0.14)",
    ...Platform.select({
      ios: { shadowColor: "#FF9F00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.88, shadowRadius: 30 },
    }),
  },
  vsZone:  { alignItems: "center", justifyContent: "center", position: "relative" },
  vsBadge: {
    width: 78, height: 78, borderRadius: 24,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    ...Platform.select({
      ios:     { shadowColor: "#FF9F00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.82, shadowRadius: 28 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  vsBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.52)" },
  scanClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 24 },
  scanLine: { position: "absolute", left: -4, right: -4, height: 4, backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 2 },
  vsText:   {
    color: "#000", fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(25), letterSpacing: 3.5, includeFontPadding: false,
    ...Platform.select({
      ios: { textShadowColor: "rgba(0,0,0,0.22)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    }),
  },
  decoCorner: { position: "absolute" },
  decoTL: { top: -22, left: -14 },
  decoBR: { bottom: -22, right: -14 },
  decoTR: { top: -10,  right: -8 },
  decoBL: { bottom: -10, left: -8 },
  decoChar: { color: "rgba(255,215,0,0.68)", fontSize: 14, fontFamily: "Comfortaa_700Bold" },

  // ── Subtitle — en bas, complètement séparé ───────────────────────────────
  subtitleWrap: {
    width: "80%",
    maxWidth: 340,
    marginTop: 0,
    paddingBottom: 8,
    alignItems: "center",
  },
  subtitleInner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  subtitleLineLeft: {
    flex: 1, height: 1, borderRadius: 1, marginRight: 8,
  },
  subtitleLineRight: {
    flex: 1, height: 1, borderRadius: 1, marginLeft: 8,
  },
  subtitleText: {
    color: "rgba(255,255,255,0.58)",
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(8.5),
    letterSpacing: 2.8,
    textTransform: "uppercase",
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: "center",
  },

  // Particules
  part:   { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  pGold:  { backgroundColor: "#FFD700" },
  pBlue:  { backgroundColor: "#00C2FF" },
  pWhite: { backgroundColor: "rgba(255,255,255,0.88)" },

  // Fond
  centerVLine: {
    position: "absolute", left: "50%", top: 0, bottom: 0,
    width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.05)",
  },
  hGridLine: {
    position: "absolute", left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.04)",
  },
  flashOverlay: { backgroundColor: "#fff" },
});
