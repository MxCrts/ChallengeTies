// VsIntroModal.tsx — version ROBUSTE Android/iOS
// Fix: suppression du rootOpacity gate, fond noir immédiat, fallback double

import React, {
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import PioneerBadge from "@/components/PioneerBadge";
import { normalizeSize } from "../challengeDetails.tokens";

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
const T_FADE_IN       = 180;
const T_AVATAR_SLIDE  = 420;
const T_AVATAR_DELAY  = 60;
const T_GLOW_IN       = 340;
const T_VS_DELAY      = 520;
const T_VS_IN         = 280;
const T_SCAN_DURATION = 900;
const T_IMPACT_HOLD   = 260;
const T_HOLD_TOTAL    = 1100;
const T_FADEOUT       = 380;

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── AvatarCard ───────────────────────────────────────────────────────────────
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
  const dir = side === "left" ? -1 : 1;

  const containerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(slideAnim.value, [0, 0.3, 1], [0, 0.6, 1]),
    transform: [
      { translateX: interpolate(slideAnim.value, [0, 0.72, 0.88, 1], [dir * 110, dir * 12, dir * -4, 0], "clamp") },
      { scale: interpolate(slideAnim.value, [0, 0.72, 1], [0.78, 1.04, 1], "clamp") },
    ] as ViewStyle["transform"],
  }));

  const glowStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0, 0.82]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.6, 1.18]) }] as ViewStyle["transform"],
  }));

  const impactStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(impactAnim.value, [0, 0.4, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(impactAnim.value, [0, 1], [0.85, 1.22]) }] as ViewStyle["transform"],
  }));

  const trailStyle = useAnimatedStyle<ViewStyle>(() => {
    const tx = interpolate(slideAnim.value, [0, 1], [dir * 60, dir * -20], "clamp");
    const sx = interpolate(slideAnim.value, [0, 1], [2.2, 0.3]);
    return {
      opacity: interpolate(slideAnim.value, [0, 0.4, 0.85, 1], [0, 0.55, 0.22, 0]),
      transform: [{ translateX: tx }, { scaleX: sx }] as ViewStyle["transform"],
    };
  });

  const glowColor = side === "left" ? "#FF9F1C" : "#00C2FF";
  const trailColor = side === "left" ? "rgba(255,159,28,0.38)" : "rgba(0,194,255,0.38)";

  return (
    <Animated.View style={[s.avatarCol, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[s.trail, { backgroundColor: trailColor, [side === "left" ? "right" : "left"]: "40%" }, trailStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[s.haloOuter, { width: size + 48, height: size + 48, borderRadius: (size + 48) / 2, borderColor: glowColor + "55" }, glowStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[s.haloInner, { width: size + 22, height: size + 22, borderRadius: (size + 22) / 2, borderColor: glowColor + "88" }, glowStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[s.impactFlash, { width: size + 60, height: size + 60, borderRadius: (size + 60) / 2, backgroundColor: glowColor + "33" }, impactStyle]}
      />
      <View style={[s.avatarShell, { width: size, height: size, borderRadius: size / 2, borderColor: glowColor + "CC" }]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onLoad={onImgLoad}
          onError={onImgLoad}
        />
        <View style={[s.specular, { borderRadius: size / 2 }]} pointerEvents="none" />
      </View>
      {isPioneer && <PioneerBadge size="mini" style={s.pioneer} />}
      <Text style={s.name} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
    </Animated.View>
  );
});

// ─── VsBadge ──────────────────────────────────────────────────────────────────
type VsBadgeProps = {
  vsAnim: Animated.SharedValue<number>;
  scanAnim: Animated.SharedValue<number>;
};

const VsBadge = React.memo(function VsBadge({ vsAnim, scanAnim }: VsBadgeProps) {
  const containerStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(vsAnim.value, [0, 0.5, 1], [0, 0.8, 1]),
    transform: [{ scale: interpolate(vsAnim.value, [0, 0.6, 0.85, 1], [0, 1.28, 0.94, 1], "clamp") }] as ViewStyle["transform"],
  }));

  const scanStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateY: interpolate(scanAnim.value, [0, 1], [-56, 56], "clamp") }] as ViewStyle["transform"],
    opacity: interpolate(scanAnim.value, [0, 0.08, 0.92, 1], [0, 0.9, 0.9, 0]),
  }));

  const glowStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(vsAnim.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(vsAnim.value, [0, 1], [0.5, 1]) }] as ViewStyle["transform"],
  }));

  return (
    <Animated.View style={[s.vsZone, containerStyle]}>
      <Animated.View style={[s.vsGlow, glowStyle]} pointerEvents="none" />
      <View style={s.vsBadge}>
        <LinearGradient colors={["#FF9F1C", "#FFD700", "#00C2FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.scanClip} pointerEvents="none">
          <Animated.View style={[s.scanLine, scanStyle]} />
        </View>
        <Text style={s.vsText}>VS</Text>
      </View>
      <View style={[s.decoCorner, s.decoTL]} pointerEvents="none"><Text style={s.decoPlus}>+</Text></View>
      <View style={[s.decoCorner, s.decoBR]} pointerEvents="none"><Text style={s.decoPlus}>+</Text></View>
    </Animated.View>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VsIntroModal({
  visible,
  myAvatar, myName, myIsPioneer,
  partnerAvatar, partnerName, partnerIsPioneer,
  reduceMotion = false,
  onDone, onShow,
}: VsIntroModalProps) {
  const insets = useSafeAreaInsets();

  const myLoaded    = useRef(false);
  const partnerLoaded = useRef(false);
  const startedRef  = useRef(false);
  const doneRef     = useRef(false);

  const bgOpacity    = useSharedValue(0);
  const leftSlide    = useSharedValue(0);
  const rightSlide   = useSharedValue(0);
  const leftGlow     = useSharedValue(0);
  const rightGlow    = useSharedValue(0);
  const leftImpact   = useSharedValue(0);
  const rightImpact  = useSharedValue(0);
  const vsAnim       = useSharedValue(0);
  const scanAnim     = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  // ✅ CLÉ DU FIX: fadeOut commence à 1 (visible), descend à 0 en fin d'anim
  // Plus de rootOpacity qui masque tout au départ
  const fadeOut      = useSharedValue(1);
  const particleAnim = useSharedValue(0);

  const SIZE = normalizeSize(108);

  const fireOnDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const runSequence = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (reduceMotion) {
      bgOpacity.value = withTiming(1, { duration: 300 });
      leftSlide.value = withTiming(1, { duration: 300 });
      rightSlide.value = withTiming(1, { duration: 300 });
      leftGlow.value = withTiming(1, { duration: 300 });
      rightGlow.value = withTiming(1, { duration: 300 });
      vsAnim.value = withDelay(300, withTiming(1, { duration: 300 }));
      fadeOut.value = withDelay(1200, withTiming(0, { duration: 300 }, () => {
        runOnJS(fireOnDone)();
      }));
      return;
    }

    // Phase 0: fond
    bgOpacity.value = withTiming(1, { duration: T_FADE_IN + 60 });

    // Phase 1: avatars
    leftSlide.value = withDelay(T_FADE_IN, withTiming(1, { duration: T_AVATAR_SLIDE, easing: Easing.out(Easing.cubic) }));
    rightSlide.value = withDelay(T_FADE_IN + T_AVATAR_DELAY, withTiming(1, { duration: T_AVATAR_SLIDE, easing: Easing.out(Easing.cubic) }));

    // Phase 2: halos
    leftGlow.value = withDelay(T_FADE_IN + 120, withTiming(1, { duration: T_GLOW_IN, easing: Easing.out(Easing.quad) }));
    rightGlow.value = withDelay(T_FADE_IN + 180, withTiming(1, { duration: T_GLOW_IN, easing: Easing.out(Easing.quad) }));

    // Phase 3: impact
    const impactDelay = T_FADE_IN + T_AVATAR_SLIDE - 40;
    leftImpact.value = withDelay(impactDelay, withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: T_IMPACT_HOLD, easing: Easing.in(Easing.quad) })
    ));
    rightImpact.value = withDelay(impactDelay + 40, withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: T_IMPACT_HOLD, easing: Easing.in(Easing.quad) })
    ));
    flashOpacity.value = withDelay(impactDelay, withSequence(
      withTiming(0.18, { duration: 80 }),
      withTiming(0, { duration: 240 })
    ));
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), impactDelay);

    // Phase 4: VS
    vsAnim.value = withDelay(T_FADE_IN + T_VS_DELAY, withSpring(1, { damping: 11, stiffness: 260, mass: 0.8 }));
    scanAnim.value = withDelay(T_FADE_IN + T_VS_DELAY + T_VS_IN, withTiming(1, { duration: T_SCAN_DURATION, easing: Easing.inOut(Easing.quad) }));
    particleAnim.value = withDelay(T_FADE_IN + T_VS_DELAY, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), T_FADE_IN + T_VS_DELAY + 100);

    // Phase 5: fade out final
    const totalDuration = T_FADE_IN + T_VS_DELAY + T_VS_IN + T_SCAN_DURATION + T_HOLD_TOTAL;
    fadeOut.value = withDelay(totalDuration, withTiming(0, { duration: T_FADEOUT }, () => {
      runOnJS(fireOnDone)();
    }));
  }, [
    reduceMotion, bgOpacity, leftSlide, rightSlide, leftGlow, rightGlow,
    leftImpact, rightImpact, vsAnim, scanAnim, flashOpacity, particleAnim,
    fadeOut, fireOnDone,
  ]);

  const tryStart = useCallback(() => {
    if (startedRef.current) return;
    if (myLoaded.current && partnerLoaded.current) {
      runSequence();
    }
  }, [runSequence]);

  // ✅ Reset + démarrage à chaque ouverture
  useEffect(() => {
    if (!visible) return;

    // Reset refs
    myLoaded.current = false;
    partnerLoaded.current = false;
    startedRef.current = false;
    doneRef.current = false;

    // Reset valeurs
    bgOpacity.value = 0;
    leftSlide.value = 0;
    rightSlide.value = 0;
    leftGlow.value = 0;
    rightGlow.value = 0;
    leftImpact.value = 0;
    rightImpact.value = 0;
    vsAnim.value = 0;
    scanAnim.value = 0;
    flashOpacity.value = 0;
    particleAnim.value = 0;
    // ✅ CRUCIAL: fadeOut = 1 → le contenu est visible dès l'ouverture du Modal
    fadeOut.value = 1;

    // Fire onShow immédiatement
    onShow?.();

    // Fallback 1: si images pas chargées dans 600ms
    const f1 = setTimeout(() => {
      if (startedRef.current) return;
      myLoaded.current = true;
      partnerLoaded.current = true;
      requestAnimationFrame(() => runSequence());
    }, 600);

    // Fallback 2: force absolu à 1500ms
    const f2 = setTimeout(() => {
      if (startedRef.current) return;
      runSequence();
    }, 1500);

    return () => {
      clearTimeout(f1);
      clearTimeout(f2);
    };
  }, [visible]);

  // ── Animated styles ──────────────────────────────────────────────────────────
  const rootStyle = useAnimatedStyle<ViewStyle>(() => ({
    // ✅ fadeOut: 1→0 uniquement en fin d'anim. Pas d'entrée masquée.
    opacity: fadeOut.value,
  }));

  const bgStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: bgOpacity.value,
  }));

  const flashStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: flashOpacity.value,
  }));

  const p1Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(particleAnim.value, [0, 0.3, 1], [0, 0.9, 0]),
    transform: [
      { translateX: interpolate(particleAnim.value, [0, 1], [0, -38]) },
      { translateY: interpolate(particleAnim.value, [0, 1], [0, -52]) },
      { scale: interpolate(particleAnim.value, [0, 0.5, 1], [0, 1.4, 0.3]) },
    ] as ViewStyle["transform"],
  }));

  const p2Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(particleAnim.value, [0, 0.3, 1], [0, 0.7, 0]),
    transform: [
      { translateX: interpolate(particleAnim.value, [0, 1], [0, 44]) },
      { translateY: interpolate(particleAnim.value, [0, 1], [0, -46]) },
      { scale: interpolate(particleAnim.value, [0, 0.5, 1], [0, 1.2, 0.2]) },
    ] as ViewStyle["transform"],
  }));

  const p3Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(particleAnim.value, [0, 0.4, 1], [0, 0.6, 0]),
    transform: [
      { translateX: interpolate(particleAnim.value, [0, 1], [0, -22]) },
      { translateY: interpolate(particleAnim.value, [0, 1], [0, 48]) },
      { scale: interpolate(particleAnim.value, [0, 0.5, 1], [0, 1.1, 0.2]) },
    ] as ViewStyle["transform"],
  }));

  const p4Style = useAnimatedStyle<ViewStyle>(() => ({
    opacity: interpolate(particleAnim.value, [0, 0.35, 1], [0, 0.8, 0]),
    transform: [
      { translateX: interpolate(particleAnim.value, [0, 1], [0, 52]) },
      { translateY: interpolate(particleAnim.value, [0, 1], [0, 38]) },
      { scale: interpolate(particleAnim.value, [0, 0.5, 1], [0, 1.3, 0.2]) },
    ] as ViewStyle["transform"],
  }));

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

        {/* ✅ Fond noir immédiat — visible dès que le Modal s'ouvre, sans attendre l'anim */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />

        {/* Fond animé par-dessus */}
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <LinearGradient
            colors={["#0A0500", "#000000", "#00050A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,159,28,0.18)", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,194,255,0.16)"]}
            start={{ x: 0.45, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.55)"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />
          <View style={s.centerLine} pointerEvents="none" />
          {[0.22, 0.38, 0.62, 0.78].map((top, i) => (
            <View key={i} pointerEvents="none" style={[s.gridLine, { top: `${top * 100}%` as any }]} />
          ))}
        </Animated.View>

        {/* Flash global */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.flashOverlay, flashStyle]} />

        {/* Stage */}
        <View style={[s.stage, {
          paddingTop: Math.max(insets.top + 20, 40),
          paddingBottom: Math.max(insets.bottom + 20, 40),
        }]}>
          <AvatarCard
            uri={myAvatar} name={myName} isPioneer={myIsPioneer}
            side="left" slideAnim={leftSlide} glowAnim={leftGlow} impactAnim={leftImpact}
            size={SIZE}
            onImgLoad={() => { myLoaded.current = true; tryStart(); }}
          />

          <View style={s.center}>
            <Animated.View pointerEvents="none" style={[s.particle, s.particleGold, p1Style]} />
            <Animated.View pointerEvents="none" style={[s.particle, s.particleBlue, p2Style]} />
            <Animated.View pointerEvents="none" style={[s.particle, s.particleGold, p3Style]} />
            <Animated.View pointerEvents="none" style={[s.particle, s.particleBlue, p4Style]} />
            <VsBadge vsAnim={vsAnim} scanAnim={scanAnim} />
          </View>

          <AvatarCard
            uri={partnerAvatar} name={partnerName} isPioneer={partnerIsPioneer}
            side="right" slideAnim={rightSlide} glowAnim={rightGlow} impactAnim={rightImpact}
            size={SIZE}
            onImgLoad={() => { partnerLoaded.current = true; tryStart(); }}
          />
        </View>

      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { justifyContent: "center", alignItems: "center", zIndex: 99999 },
  stage: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 12 },
  avatarCol: { flex: 1, alignItems: "center", position: "relative" },
  trail: { position: "absolute", height: 3, width: "80%", top: "38%", borderRadius: 2 },
  haloOuter: { position: "absolute", borderWidth: 1.5 },
  haloInner: { position: "absolute", borderWidth: 1 },
  impactFlash: { position: "absolute" },
  avatarShell: {
    borderWidth: 2.5, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 10,
  },
  specular: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.10)", top: 0, bottom: "60%" },
  pioneer: { position: "absolute", bottom: 32, alignSelf: "center", marginLeft: 44 },
  name: {
    marginTop: 14, color: "#fff", fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(15), textAlign: "center", maxWidth: "90%",
    ...Platform.select({ ios: { textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } } }),
  },
  vsZone: { alignItems: "center", justifyContent: "center", position: "relative" },
  vsGlow: {
    position: "absolute", width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(255,215,0,0.14)",
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 22,
  },
  vsBadge: {
    width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 18, elevation: 12,
  },
  scanClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 20 },
  scanLine: { position: "absolute", left: -4, right: -4, height: 3, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 2 },
  vsText: { color: "#000", fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(22), letterSpacing: 2.5, includeFontPadding: false },
  decoCorner: { position: "absolute" },
  decoTL: { top: -18, left: -10 },
  decoBR: { bottom: -18, right: -10 },
  decoPlus: { color: "rgba(255,215,0,0.55)", fontSize: 18, fontFamily: "Comfortaa_700Bold" },
  center: { width: 90, alignItems: "center", justifyContent: "center", position: "relative" },
  particle: { position: "absolute", width: 7, height: 7, borderRadius: 4 },
  particleGold: { backgroundColor: "#FFD700" },
  particleBlue: { backgroundColor: "#00C2FF" },
  centerLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)" },
  gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.04)" },
  flashOverlay: { backgroundColor: "#fff" },
});
