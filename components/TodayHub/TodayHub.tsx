// components/TodayHub/TodayHub.tsx
import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  PixelRatio,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import type { TFunction } from "i18next";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import type { AnimatedStyle } from "react-native-reanimated";
import type { ViewStyle } from "react-native";

export type TodayHubPrimaryMode = "mark" | "new" | "pick" | "duo" | "duoPending";

export type TodayHubWhyReturnVariant = "duo" | "streak" | "trophy" | "warning";
export type TodayHubWhyReturn = {
  text: string;
  variant?: TodayHubWhyReturnVariant;
  icon?: string;
};

const getThumbUrl200 = (url?: string) => {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return "";
  return u.replace(/(\.[a-zA-Z0-9]+)(\?|$)/, "_200x200$1$2");
};

type HubMeta = {
  id?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
};

type Props = {
  t: TFunction;
  isDarkMode: boolean;
  langKey: string;
  primaryMode: TodayHubPrimaryMode;
  hasActiveChallenges: boolean;
  activeCount: number;
  primaryCtaRef?: React.RefObject<any>;
  primaryAnimatedStyle?: AnimatedStyle<ViewStyle>;
  title: string;
  sub: string;
  whyReturn?: TodayHubWhyReturn | null;
  hubMeta?: HubMeta | null;
  hubDescription?: string;
  progressPct: number;
  primaryGradient: readonly [string, string];
  primaryIcon: string;
  primaryLabel: string;
  onOpenHub: () => void;
  onPrimaryPress: () => void;
  onPendingWarmupPress?: () => void;
  onPickSolo: () => void;
  onCreate: () => void;
  CONTENT_MAX_W: number;
  staticStyles: any;
  normalize: (n: number) => number;
};

const F = {
  regular: "Comfortaa_400Regular",
  bold: "Comfortaa_700Bold",
} as const;

export default function TodayHub(props: Props) {
  const {
    t,
    isDarkMode,
    langKey,
    primaryMode,
    hasActiveChallenges,
    activeCount,
    primaryCtaRef,
    primaryAnimatedStyle,
    title,
    sub,
    hubMeta,
    progressPct,
    primaryGradient,
    primaryIcon,
    primaryLabel,
    onOpenHub,
    onPrimaryPress,
    onPendingWarmupPress,
    onPickSolo,
    CONTENT_MAX_W,
    normalize,
  } = props;

  const { width: W } = useWindowDimensions();
  const isTiny = W < 350;
  const isLarge = W >= 430;
  const isTablet = W >= 700;

  const isPending = primaryMode === "duoPending";
  const isMark = primaryMode === "mark";

  // ─── Responsive sizes ──────────────────────────────────────────────────
  const UI = useMemo(() => {
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const shellR = clamp(normalize(isTiny ? 24 : isTablet ? 30 : 28), 22, 32);
    const pad = clamp(normalize(isTiny ? 14 : isTablet ? 20 : 16), 14, 22);
    const cardR = clamp(normalize(isTiny ? 16 : isTablet ? 20 : 18), 14, 22);
    const ctaR = clamp(normalize(isTiny ? 18 : isTablet ? 22 : 20), 16, 24);
    const thumb = clamp(normalize(isTiny ? 52 : isTablet ? 64 : 56), 48, 70);
    const thumbR = clamp(normalize(isTiny ? 12 : isTablet ? 16 : 14), 10, 18);
    const chevronBox = clamp(normalize(isTiny ? 28 : isTablet ? 36 : 30), 26, 40);
    const trackH = clamp(normalize(isTiny ? 4 : isTablet ? 6 : 5), 3, 7);
    const primaryPadY = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 12, 20);
    const primaryPadX = clamp(normalize(isTiny ? 16 : isTablet ? 22 : 18), 14, 24);
    const iconBox = clamp(normalize(isTiny ? 58 : isTablet ? 74 : 64), 56, 78);
    const orb = clamp(Math.round(iconBox * 0.78), 44, 62);
    const ring = iconBox;
    const sheen = clamp(Math.round(iconBox * 1.55), 84, 132);
    const aura = clamp(Math.round(iconBox * 1.78), 96, 150);
    const ctaPadY = clamp(normalize(isTiny ? 7 : isTablet ? 10 : 8), 6, 12);
    const ctaPadX = clamp(normalize(isTiny ? 10 : isTablet ? 14 : 12), 10, 16);
    const ctaIcon = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 14, 20);
    const hourglass = clamp(normalize(isTiny ? 20 : isTablet ? 26 : 22), 18, 28);
    return {
      shellR, pad, cardR, ctaR, thumb, thumbR, chevronBox, trackH,
      primaryPadY, primaryPadX, iconBox, orb, ring, sheen, aura,
      ctaPadY, ctaPadX, ctaIcon, hourglass,
    };
  }, [normalize, isTiny, isTablet]);

  const TYPO = useMemo(() => ({
    title: normalize(isTiny ? 22 : isLarge ? 25 : 23),
    sub: normalize(isTiny ? 13 : isLarge ? 14.5 : 14),
    badge: normalize(isTiny ? 10 : 10.5),
    previewTitle: normalize(isTiny ? 13.5 : isLarge ? 15 : 14),
    primary: normalize(isTiny ? 19 : isTablet ? 22 : 20),
    link: normalize(isTiny ? 12 : isLarge ? 13 : 12.5),
    pendingLabel: normalize(isTiny ? 15 : isLarge ? 16 : 15.5),
    pendingMicro: normalize(isTiny ? 11 : isLarge ? 12 : 11.5),
  }), [normalize, isTiny, isLarge, isTablet]);

  // ─── Animations ────────────────────────────────────────────────────────
  const ring = useSharedValue(0);
  const glow = useSharedValue(0);
  const breath = useSharedValue(0);
  const aura = useSharedValue(0);
  const ctaShine = useSharedValue(-1);

  useEffect(() => {
    if (!isPending) {
      ring.value = 0; glow.value = 0; breath.value = 0; aura.value = 0;
      return;
    }
    ring.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
    glow.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }), -1, true);
    breath.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
    aura.value = withRepeat(withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [isPending]);

  useEffect(() => {
    if (!isMark) { ctaShine.value = -1; return; }
    ctaShine.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [isMark]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring.value * 0.045 }],
    opacity: 0.12 + ring.value * 0.10,
  }));
  const breathStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + breath.value * 0.12,
    transform: [{ scale: 1 + breath.value * 0.08 }],
  }));
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.07 + aura.value * 0.13,
    transform: [{ scale: 1 + aura.value * 0.10 }],
  }));
  const ctaShineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ctaShine.value * (CONTENT_MAX_W + 60) }],
    opacity: 0.18,
  }));

  // ─── Derived ───────────────────────────────────────────────────────────
  const effectivePrimaryGradient = useMemo(() => {
    if (primaryMode === "duo" && !hasActiveChallenges) return ["#6366F1", "#A78BFA"] as const;
    return primaryGradient;
  }, [primaryMode, hasActiveChallenges, primaryGradient]);

  const shellBgGradient = useMemo(() => {
    if (isPending) return isDarkMode
      ? ["rgba(99,102,241,0.12)", "rgba(2,6,23,0.00)"] as const
      : ["rgba(99,102,241,0.07)", "rgba(255,255,255,0.00)"] as const;
    if (isMark) return isDarkMode
      ? ["rgba(249,115,22,0.12)", "rgba(2,6,23,0.00)"] as const
      : ["rgba(249,115,22,0.08)", "rgba(255,255,255,0.00)"] as const;
    return ["rgba(0,0,0,0.00)", "rgba(0,0,0,0.00)"] as const;
  }, [isPending, isMark, isDarkMode]);

  const TOKENS = useMemo(() => {
    const hairline = Math.max(1, Math.round(PixelRatio.get() * 0.35)) / PixelRatio.get();
    return {
      text: isDarkMode ? "#F8FAFC" : "#0B1120",
      subText: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)",
      mutedText: isDarkMode ? "rgba(226,232,240,0.55)" : "rgba(15,23,42,0.50)",
      surface: isDarkMode ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.97)",
      surface2: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.86)",
      border: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)",
      rim: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(2,6,23,0.08)",
      track: isDarkMode ? "rgba(226,232,240,0.10)" : "rgba(2,6,23,0.08)",
      chevron: isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.85)",
      thumbBorder: isDarkMode ? "rgba(226,232,240,0.18)" : "rgba(2,6,23,0.10)",
      thumbBg: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(2,6,23,0.03)",
      progressFill: effectivePrimaryGradient[0],
      progressFillEnd: effectivePrimaryGradient[1],
      hairline,
    };
  }, [isDarkMode, effectivePrimaryGradient]);

  const hapticTap = (kind: "light" | "selection" = "light") => {
    if (Platform.OS === "web") return;
    try {
      if (kind === "selection") Haptics.selectionAsync();
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const showSoloLink = !hasActiveChallenges && primaryMode !== "duoPending";

  const pendingSub = useMemo(() => t("homeZ.duoPending.sub", { defaultValue: "Pending. Once accepted: Duo." }), [t, langKey]);
  const pendingHint = useMemo(() => t("homeZ.duoPending.hint", { defaultValue: "While waiting, set up your Duo." }), [t, langKey]);
  const pendingA11y = useMemo(() => t("homeZ.duoPending.a11y", { defaultValue: "Duo invite pending" }), [t, langKey]);

  const displayTitle = isPending ? t("homeZ.duoPending.title", { defaultValue: "Invitation envoyée" }) : title;
  const displaySub = isPending ? pendingHint : sub;

  // Badge label contextuel
  const badgeLabel = isMark
    ? t("homeZ.todayHub.badgeMark", "Action requise")
    : isPending
      ? t("homeZ.todayHub.badgePending", "En attente")
      : t("homeZ.todayHub.badgeExplore", "Prêt à démarrer");

  const badgeColor = isMark ? "#F97316" : isPending ? "#818CF8" : (isDarkMode ? "rgba(148,163,184,0.55)" : "rgba(100,116,139,0.55)");

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={[s.outerWrapper, { paddingHorizontal: normalize(15) }]}>
      <View
        style={[
          s.shell,
          {
            maxWidth: CONTENT_MAX_W,
            borderColor: isMark
              ? (isDarkMode ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.22)")
              : isPending
                ? (isDarkMode ? "rgba(99,102,241,0.30)" : "rgba(99,102,241,0.18)")
                : (isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)"),
            borderWidth: (isMark || isPending) ? 1.5 : TOKENS.hairline,
            backgroundColor: TOKENS.surface,
            borderRadius: normalize(UI.shellR),
            ...(Platform.OS === "ios" ? {
              shadowColor: isMark ? "#F97316" : isPending ? "#6366F1" : "#000",
              shadowOpacity: isMark ? 0.22 : isPending ? 0.18 : 0.10,
              shadowRadius: normalize(28),
              shadowOffset: { width: 0, height: normalize(10) },
            } : {
              elevation: isMark ? 16 : isPending ? 14 : 8,
            }),
          },
        ]}
      >
        {/* Backdrop gradient mode-aware */}
        <LinearGradient
          colors={shellBgGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: normalize(UI.shellR) }]}
          pointerEvents="none"
        />

        {/* Shell highlight top */}
        <View pointerEvents="none" style={[s.shellHighlight, {
          borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.04)",
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.60)",
          borderTopLeftRadius: normalize(UI.shellR),
          borderTopRightRadius: normalize(UI.shellR),
        }]} />

        {/* ── ZONE HEADER ── */}
        <View style={{ paddingHorizontal: UI.pad, paddingTop: UI.pad, paddingBottom: 0 }}>

          {/* Badge contextuel */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: normalize(6), marginBottom: normalize(10) }}>
            <View style={{
              width: normalize(6), height: normalize(6),
              borderRadius: normalize(3),
              backgroundColor: badgeColor,
            }} />
            <Text style={{
              fontFamily: F.bold,
              fontSize: TYPO.badge,
              letterSpacing: 1.1,
              color: badgeColor,
              textTransform: "uppercase",
            }}>
              {badgeLabel}
            </Text>
          </View>

          {/* Titre fort */}
          <Text style={[s.title, {
            color: TOKENS.text,
            fontSize: TYPO.title,
            lineHeight: Math.round(TYPO.title * 1.22),
          }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {displayTitle}
          </Text>

          {/* Sous-titre discret */}
          <Text style={[s.sub, {
            color: TOKENS.subText,
            fontSize: TYPO.sub,
            lineHeight: Math.round(TYPO.sub * 1.38),
          }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.92}
          >
            {displaySub}
          </Text>
        </View>

        {/* Séparateur */}
        <View style={{
          height: TOKENS.hairline,
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(2,6,23,0.06)",
          marginHorizontal: UI.pad,
          marginVertical: normalize(12),
        }} />

        {/* ── CHALLENGE PREVIEW ── */}
        {!!hubMeta?.title && (
          <View style={{ paddingHorizontal: UI.pad, paddingBottom: normalize(12) }}>
            <Pressable
              onPress={() => { hapticTap("selection"); onOpenHub(); }}
              style={({ pressed }) => ({
                borderRadius: normalize(16),
                overflow: "hidden",
                opacity: pressed ? 0.94 : 1,
                transform: [{ scale: pressed ? 0.993 : 1 }],
              })}
            >
              <LinearGradient
                colors={isDarkMode
                  ? ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.03)"]
                  : ["rgba(255,255,255,0.98)", "rgba(248,250,252,0.92)"]}
                style={{
                  borderRadius: normalize(16),
                  flexDirection: "row",
                  alignItems: "center",
                  padding: normalize(12),
                  gap: normalize(12),
                  borderWidth: TOKENS.hairline,
                  borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)",
                }}
              >
                {/* Thumb */}
                {hubMeta.imageUrl ? (
                  <View style={{
                    width: normalize(UI.thumb), height: normalize(UI.thumb),
                    borderRadius: normalize(UI.thumbR), overflow: "hidden",
                    flexShrink: 0,
                    borderWidth: TOKENS.hairline,
                    borderColor: TOKENS.thumbBorder,
                  }}>
                    <ExpoImage
                      source={{ uri: getThumbUrl200(hubMeta.imageUrl) || hubMeta.imageUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover" transition={120} cachePolicy="memory-disk"
                    />
                  </View>
                ) : (
                  <View style={{
                    width: normalize(UI.thumb), height: normalize(UI.thumb),
                    borderRadius: normalize(UI.thumbR), overflow: "hidden",
                    flexShrink: 0,
                    backgroundColor: "rgba(249,115,22,0.10)",
                    borderWidth: TOKENS.hairline,
                    borderColor: "rgba(249,115,22,0.22)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name="trophy-outline" size={normalize(20)} color="#F97316" />
                  </View>
                )}

                {/* Info */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontFamily: F.bold,
                    fontSize: TYPO.previewTitle,
                    color: TOKENS.text,
                    marginBottom: normalize(isMark ? 6 : 2),
                    letterSpacing: -0.2,
                  }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                    {hubMeta.title}
                  </Text>

                  {isMark ? (
                    <View>
                      <View style={{
                        height: normalize(UI.trackH),
                        backgroundColor: TOKENS.track,
                        borderRadius: normalize(999),
                        overflow: "hidden",
                      }}>
                        <LinearGradient
                          colors={[TOKENS.progressFill, TOKENS.progressFillEnd]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={{
                            width: `${Math.round(Math.max(0, Math.min(1, progressPct)) * 100)}%`,
                            height: "100%",
                            borderRadius: normalize(999),
                          }}
                        />
                      </View>
                      <Text style={{
                        fontFamily: F.regular,
                        fontSize: normalize(10.5),
                        color: TOKENS.mutedText,
                        marginTop: normalize(3),
                      }}>
                        {`${Math.round(progressPct * 100)}% accompli`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{
                      fontFamily: F.regular,
                      fontSize: normalize(11.5),
                      color: TOKENS.mutedText,
                    }} numberOfLines={1}>
                      {t("homeZ.todayHub.tapToOpen", "Voir le défi →")}
                    </Text>
                  )}
                </View>

                {/* Chevron */}
                <View style={{
                  width: normalize(UI.chevronBox), height: normalize(UI.chevronBox),
                  borderRadius: normalize(999),
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(2,6,23,0.05)",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Ionicons name="chevron-forward" size={normalize(14)} color={TOKENS.chevron} />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* ── PRIMARY ACTION ── */}
        {isPending ? (
          // Mode duoPending
          <View style={{ paddingHorizontal: UI.pad, paddingBottom: UI.pad }}>
            <Pressable
              ref={primaryCtaRef as any}
              onPress={() => { hapticTap("selection"); (onPendingWarmupPress ?? onPrimaryPress)(); }}
              accessibilityRole="button"
              accessibilityLabel={pendingA11y}
              style={({ pressed }) => [
                {
                  width: "100%",
                  borderRadius: normalize(UI.cardR),
                  borderWidth: TOKENS.hairline,
                  borderColor: TOKENS.border,
                  backgroundColor: TOKENS.surface2,
                  paddingVertical: normalize(isTiny ? 12 : isTablet ? 16 : 14),
                  paddingHorizontal: normalize(isTiny ? 12 : isTablet ? 16 : 14),
                  overflow: "hidden",
                  opacity: pressed ? 0.96 : 1,
                  transform: [{ scale: pressed ? 0.992 : 1 }],
                },
                primaryAnimatedStyle as any,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: normalize(12) }}>
                {/* Orb animé */}
                <View style={{ width: normalize(UI.iconBox), height: normalize(UI.iconBox), alignItems: "center", justifyContent: "center" }}>
                  <Animated.View pointerEvents="none" style={[{
                    position: "absolute",
                    width: normalize(UI.aura), height: normalize(UI.aura), borderRadius: 999,
                    backgroundColor: isDarkMode ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.10)",
                  }, auraStyle]} />
                  <Animated.View pointerEvents="none" style={[{
                    position: "absolute",
                    width: normalize(UI.sheen), height: normalize(UI.sheen), borderRadius: 999,
                    backgroundColor: isDarkMode ? "rgba(167,139,250,0.18)" : "rgba(167,139,250,0.12)",
                  }, breathStyle]} />
                  <Animated.View pointerEvents="none" style={[{
                    position: "absolute",
                    width: normalize(UI.ring), height: normalize(UI.ring), borderRadius: 999,
                    borderWidth: 2,
                    borderColor: isDarkMode ? "rgba(167,139,250,0.55)" : "rgba(99,102,241,0.42)",
                  }, ringStyle]} />
                  <LinearGradient colors={["#6366F1", "#A78BFA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ width: normalize(UI.orb), height: normalize(UI.orb), borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="hourglass-outline" size={normalize(UI.hourglass)} color="#0B1120" />
                  </LinearGradient>
                </View>

                {/* Copy */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontFamily: F.regular,
                    fontSize: TYPO.pendingMicro,
                    color: TOKENS.mutedText,
                    lineHeight: Math.round(TYPO.pendingMicro * 1.3),
                  }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.92}>
                    {pendingSub}
                  </Text>
                  <View style={{ marginTop: normalize(10), flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: normalize(8),
                      borderRadius: normalize(999),
                      paddingHorizontal: normalize(UI.ctaPadX),
                      paddingVertical: normalize(UI.ctaPadY),
                      backgroundColor: "#A78BFA",
                    }}>
                      <Text style={{ fontFamily: F.bold, fontSize: TYPO.pendingLabel, color: "#0B1120", letterSpacing: 0.2 }}
                        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                        {t("duo.pending.warmup", { defaultValue: "Warmup" })}
                      </Text>
                      <Ionicons name="arrow-forward" size={normalize(UI.ctaIcon)} color="#0B1120" />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ) : (
          // Mode normal — CTA énorme
          <View style={{ paddingHorizontal: UI.pad, paddingBottom: UI.pad }}>
            <Pressable
              ref={primaryCtaRef as any}
              onPress={() => { hapticTap("light"); onPrimaryPress(); }}
              accessibilityRole="button"
              style={({ pressed }) => [
                primaryAnimatedStyle as any,
                {
                  borderRadius: normalize(UI.ctaR),
                  overflow: "hidden",
                  opacity: pressed ? 0.95 : 1,
                  transform: [{ scale: pressed ? 0.987 : 1 }],
                  ...(Platform.OS === "ios" ? {
                    shadowColor: effectivePrimaryGradient[0],
                    shadowOpacity: 0.55,
                    shadowRadius: normalize(22),
                    shadowOffset: { width: 0, height: normalize(10) },
                  } : { elevation: 18 }),
                },
              ]}
            >
              <LinearGradient
                colors={[effectivePrimaryGradient[0], effectivePrimaryGradient[1]]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: normalize(UI.ctaR),
                  paddingVertical: normalize(UI.primaryPadY),
                  paddingHorizontal: normalize(UI.primaryPadX),
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {/* Shine top statique */}
                <LinearGradient
                  colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: normalize(UI.ctaR) }]}
                  pointerEvents="none"
                />

                {/* Shine sweep animé */}
                {isMark && (
                  <Animated.View pointerEvents="none" style={[{
                    position: "absolute",
                    top: 0, bottom: 0,
                    width: normalize(60),
                    backgroundColor: "rgba(255,255,255,0.22)",
                    transform: [{ skewX: "-18deg" }],
                    borderRadius: normalize(UI.ctaR),
                  }, ctaShineStyle]} />
                )}

                {/* Label + sous-texte */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontFamily: F.bold,
                    fontSize: TYPO.primary,
                    letterSpacing: -0.4,
                    color: "#0B1120",
                    includeFontPadding: false,
                  }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.88}
                  >
                    {primaryLabel}
                  </Text>
                  {isMark && (
                    <Text style={{
                      fontFamily: F.regular,
                      fontSize: normalize(isTiny ? 10 : 11),
                      color: "rgba(11,17,32,0.58)",
                      marginTop: normalize(2),
                    }}>
                      {t("homeZ.todayHub.ctaSub", "1 tap pour valider ta journée")}
                    </Text>
                  )}
                </View>

                {/* Icône dans cercle */}
                <View style={{
                  width: normalize(isTiny ? 38 : 42),
                  height: normalize(isTiny ? 38 : 42),
                  borderRadius: normalize(999),
                  backgroundColor: "rgba(11,17,32,0.16)",
                  borderWidth: 1,
                  borderColor: "rgba(11,17,32,0.10)",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Ionicons name={primaryIcon as any} size={normalize(isTiny ? 18 : 21)} color="#0B1120" />
                </View>
              </LinearGradient>
            </Pressable>

            {/* Solo link discret */}
            {showSoloLink && (
              <View style={{ alignItems: "center", marginTop: normalize(10) }}>
                <Pressable
                  onPress={() => { hapticTap("selection"); onPickSolo(); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.55 : 0.70 })}
                >
                  <Text style={{
                    fontSize: TYPO.link,
                    fontFamily: F.regular,
                    color: TOKENS.mutedText,
                    textDecorationLine: "underline",
                  }}>
                    {t("homeZ.todayHub.continueSolo", "Continuer en solo")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outerWrapper: {
    width: "100%",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 4,
  },
  shell: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  shellHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    borderWidth: 1,
    opacity: 0.50,
  },
  title: {
    fontFamily: "Comfortaa_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: {
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 0,
  },
  progressTrack: {
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFillGrad: {
    borderRadius: 999,
  },
});
