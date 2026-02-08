// components/TodayHub.tsx
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
  icon?: string; // Ionicons name
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
    whyReturn,
    hubMeta,
    hubDescription,
    progressPct,
    primaryGradient,
    primaryIcon,
    primaryLabel,
    onOpenHub,
    onPrimaryPress,
    onPendingWarmupPress,
    onPickSolo,
    onCreate,
    CONTENT_MAX_W,
    normalize,
  } = props;

    const { width: W } = useWindowDimensions();
  const isTiny = W < 350;
  const isLarge = W >= 430;
  const isTablet = W >= 700;

  // ✅ responsive micro-tokens (no hard UI)
  const UI = useMemo(() => {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const pad = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 14, 20);
  const shellR = clamp(normalize(isTiny ? 24 : isTablet ? 30 : 26), 22, 32);
  const cardR = clamp(normalize(isTiny ? 16 : isTablet ? 20 : 18), 14, 22);
  const ctaR = clamp(normalize(isTiny ? 16 : isTablet ? 22 : 18), 14, 24);

  const iconBox = clamp(normalize(isTiny ? 58 : isTablet ? 74 : 64), 56, 78);
  const orb = clamp(Math.round(iconBox * 0.78), 44, 62);
  const ring = iconBox;
  const sheen = clamp(Math.round(iconBox * 1.55), 84, 132);
  const aura = clamp(Math.round(iconBox * 1.78), 96, 150);

  const gap = clamp(normalize(isTiny ? 10 : isTablet ? 14 : 12), 9, 16);

  const ctaPadY = clamp(normalize(isTiny ? 7 : isTablet ? 10 : 8), 6, 12);
  const ctaPadX = clamp(normalize(isTiny ? 10 : isTablet ? 14 : 12), 10, 16);
  const ctaIcon = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 14, 20);
  const hourglass = clamp(normalize(isTiny ? 20 : isTablet ? 26 : 22), 18, 28);

  // ✅ manquants pour le “100%”
  const previewR = clamp(normalize(isTiny ? 16 : isTablet ? 22 : 20), 14, 24);
  const previewPadY = clamp(normalize(isTiny ? 12 : isTablet ? 16 : 14), 10, 18);
  const previewPadX = clamp(normalize(isTiny ? 12 : isTablet ? 16 : 14), 10, 18);
  const thumb = clamp(normalize(isTiny ? 44 : isTablet ? 56 : 46), 40, 60);
  const thumbR = clamp(normalize(isTiny ? 12 : isTablet ? 16 : 14), 10, 18);
  const chevronBox = clamp(normalize(isTiny ? 30 : isTablet ? 38 : 32), 28, 42);
  const trackH = clamp(normalize(isTiny ? 5 : isTablet ? 7 : 6), 4, 8);

  const primaryR = clamp(normalize(isTiny ? 16 : isTablet ? 22 : 20), 14, 24);
  const primaryPadY = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 12, 20);
  const primaryPadX = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 12, 20);

  const createR = clamp(normalize(isTiny ? 16 : isTablet ? 22 : 18), 14, 24);
  const createPadY = clamp(normalize(isTiny ? 14 : isTablet ? 18 : 16), 12, 20);
  const createPadX = clamp(normalize(isTiny ? 12 : isTablet ? 16 : 14), 10, 18);
  const createIcon = clamp(normalize(isTiny ? 32 : isTablet ? 40 : 34), 30, 44);

  return {
    pad,
    shellR,
    cardR,
    ctaR,
    iconBox,
    orb,
    ring,
    sheen,
    aura,
    gap,
    ctaPadY,
    ctaPadX,
    ctaIcon,
    hourglass,

    previewR,
    previewPadY,
    previewPadX,
    thumb,
    thumbR,
    chevronBox,
    trackH,

    primaryR,
    primaryPadY,
    primaryPadX,

    createR,
    createPadY,
    createPadX,
    createIcon,
  };
}, [normalize, isTiny, isTablet]);


  const TYPO = useMemo(() => {
    // ✅ cohérent avec ton index + DailyBonus (un poil plus “dense”)
    return {
      pill: normalize(isTiny ? 11 : isLarge ? 12 : 11.5),
      title: normalize(isTiny ? 20 : isLarge ? 22 : 21),        // ↓ avant 26
      sub: normalize(isTiny ? 13 : isLarge ? 14 : 13.5),         // ↓ avant 16
      previewTitle: normalize(isTiny ? 14 : isLarge ? 15 : 14.5),// ↓ avant 18
      previewDesc: normalize(isTiny ? 12 : isLarge ? 13 : 12.5), // ↓ avant 14
      primary: normalize(isTiny ? 15 : isLarge ? 16 : 15.5),     // ↓ avant 20
      pendingLabel: normalize(isTiny ? 15 : isLarge ? 16 : 15.5),// ↓ avant 18
      pendingMicro: normalize(isTiny ? 11 : isLarge ? 12 : 11.5),// ↓ avant 13
      link: normalize(isTiny ? 13 : isLarge ? 14 : 13.5),        // ↓ avant 15
      createTitle: normalize(isTiny ? 17 : isLarge ? 18 : 17.5), // ↓ avant 22
      createSub: normalize(isTiny ? 12 : isLarge ? 13 : 12.5),   // ↓ avant 14
    };
  }, [normalize, isTiny, isLarge]);

  // ✅ “Why return” micro-pulse (subtil, pas TikTok cheap)
  const whyPulse = useSharedValue(0);
  useEffect(() => {
    whyPulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [whyPulse]);

  // ✅ DuoPending breathing (gros cercle qui respire)
  const ring = useSharedValue(0);
  const glow = useSharedValue(0);
  const breath = useSharedValue(0);
  const aura = useSharedValue(0);

  const isPending = primaryMode === "duoPending";

  useEffect(() => {
    if (!isPending) {
      ring.value = 0;
      glow.value = 0;
      breath.value = 0;
      aura.value = 0;
      return;
    }

    // ring + glow (tu l’avais déjà, un poil retuné)
    ring.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // ✅ breathing: plus ample + plus “organique”
    breath.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    aura.value = withRepeat(
      withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [isPending, ring, glow, breath, aura]);


  const ringStyle = useAnimatedStyle(() => {
   const s = 1 + ring.value * 0.045;
   const o = 0.12 + ring.value * 0.10;
    return { transform: [{ scale: s }], opacity: o };
  });

  const glowStyle = useAnimatedStyle(() => {
    const o = 0.06 + glow.value * 0.10;
    return { opacity: o };
  });

    const breathStyle = useAnimatedStyle(() => {
    const p = breath.value; // 0..1
    return {
      opacity: 0.08 + p * 0.12,
      transform: [{ scale: 1 + p * 0.08 }],
    };
  });

  const auraStyle = useAnimatedStyle(() => {
    const a = aura.value;
    return {
      opacity: 0.07 + a * 0.13,
     transform: [{ scale: 1 + a * 0.10 }],
    };
  });

  const whyReturnStyle = useAnimatedStyle(() => {
    // léger “alive” uniquement quand on affiche le bloc
    const p = whyPulse.value;
    return {
      transform: [{ scale: 1 + p * 0.006 }],
      opacity: 0.92 + p * 0.08,
    };
  });

  const whyReturnIcon = useMemo(() => {
    if (whyReturn?.icon) return whyReturn.icon;
    switch (whyReturn?.variant) {
      case "duo": return "people-outline";
      case "streak": return "flame-outline";
      case "trophy": return "trophy-outline";
      case "warning": return "alert-circle-outline";
      default: return "sparkles-outline";
    }
  }, [whyReturn?.icon, whyReturn?.variant]);

  const rightPill = useMemo(() => {
    if (primaryMode === "duoPending") {
      return t("homeZ.todayHub.metaPending", { defaultValue: "Invitation" });
    }
    if (!hasActiveChallenges) {
      return t("homeZ.todayHub.metaNone", { defaultValue: "Aucun défi actif" });
    }
    return t("homeZ.todayHub.metaActive", {
      defaultValue: "{{count}} défi(s) actif(s)",
      count: activeCount,
    });
  }, [t, langKey, primaryMode, hasActiveChallenges, activeCount]);

    const effectivePrimaryGradient = useMemo(() => {
    // ✅ Quand aucun défi actif -> CTA “activation”, pas “succès”
    if (primaryMode === "duo" && !hasActiveChallenges) {
      return ["#6366F1", "#A78BFA"] as const; // indigo -> violet (premium)
    }
    return primaryGradient;
  }, [primaryMode, hasActiveChallenges, primaryGradient]);

  const TOKENS = useMemo(() => {
    const border = isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)";
    const surface = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.74)";
    const surface2 = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.86)";
    const text = isDarkMode ? "#F8FAFC" : "#0B1120";
    const subText = isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)";
    const mutedText = isDarkMode ? "rgba(226,232,240,0.65)" : "rgba(15,23,42,0.55)";
    const track = isDarkMode ? "rgba(226,232,240,0.10)" : "rgba(2,6,23,0.08)";
    const icon = isDarkMode ? "#E2E8F0" : "#0B1120";
    const chevron = isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.85)";
    const pillA = isDarkMode ? "rgba(148,163,184,0.20)" : "rgba(148,163,184,0.35)";
    const pillB = isDarkMode ? "rgba(226,232,240,0.10)" : "rgba(2,6,23,0.06)";
    const thumbBorder = isDarkMode ? "rgba(226,232,240,0.18)" : "rgba(2,6,23,0.10)";
    const thumbBg = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(2,6,23,0.03)";
    const hairline = Math.max(1, Math.round(PixelRatio.get() * 0.35)) / PixelRatio.get();
    const highlight = isDarkMode
      ? "rgba(255,255,255,0.08)"
      : "rgba(255,255,255,0.75)";
    const rim = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(2,6,23,0.08)";

    // ✅ whyReturn
    const whyBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(2,6,23,0.035)";
    const whyBorder = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(2,6,23,0.08)";
    const whyText = isDarkMode ? "rgba(248,250,252,0.92)" : "rgba(2,6,23,0.86)";
    const whySub = isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)";
    const whyIcon = isDarkMode ? "rgba(226,232,240,0.92)" : "rgba(2,6,23,0.86)";

    const whyGlowA = isDarkMode ? "rgba(255,215,0,0.14)" : "rgba(255,215,0,0.10)";
    const whyGlowB = isDarkMode ? "rgba(0,255,255,0.12)" : "rgba(0,255,255,0.08)";


    // ✅ progress qui se “marie” au CTA (pas orange random)
    const progressFill = effectivePrimaryGradient[1];

    return {
      border,
      surface,
      surface2,
      text,
      subText,
      mutedText,
      track,
      icon,
      chevron,
      pillA,
      pillB,
      thumbBorder,
      thumbBg,
      progressFill,
      hairline,
      highlight,
      rim,
      whyBg,
      whyBorder,
      whyText,
      whySub,
      whyIcon,
      whyGlowA,
      whyGlowB,
    };
  }, [isDarkMode, effectivePrimaryGradient]);

  const hapticTap = (kind: "light" | "selection" = "light") => {
    if (Platform.OS === "web") return;
    try {
      if (kind === "selection") Haptics.selectionAsync();
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const pressFx = (pressed: boolean, baseScale = 0.995) => ({
    opacity: pressed ? 0.96 : 1,
    transform: [{ scale: pressed ? baseScale : 1 }],
  });

  const showSoloLink = !hasActiveChallenges && primaryMode !== "duoPending";

const pendingTitle = useMemo(
    () => t("homeZ.duoPending.title", { defaultValue: "Invite sent" }),
   [t, langKey]
  );
  const pendingSub = useMemo(
    () =>
      t("homeZ.duoPending.sub", {
        defaultValue: "Pending. Once accepted: Duo.",
      }),
    [t, langKey]
  );

  const pendingHint = useMemo(
    () =>
      t("homeZ.duoPending.hint", {
        defaultValue: "While waiting, set up your Duo.",
      }),
    [t, langKey]
  );

  const displayTitle = isPending ? pendingTitle : title;
  const displaySub = isPending ? pendingHint : sub;
 
  const pendingA11y = useMemo(
    () => t("homeZ.duoPending.a11y", { defaultValue: "Duo invite pending" }),
    [t, langKey]
  );

  const stepSent = useMemo(
    () => t("homeZ.duoPending.steps.sent", { defaultValue: "Invitation sent" }),
    [t, langKey]
  );
  const stepWaiting = useMemo(
    () => t("homeZ.duoPending.steps.waiting", { defaultValue: "Waiting for acceptance" }),
    [t, langKey]
  );
  const stepReady = useMemo(
    () => t("homeZ.duoPending.steps.ready", { defaultValue: "Once confirmed: Duo starts" }),
   [t, langKey]
  );

  const todayBadge = useMemo(
    () => t("homeZ.todayHub.badge", { defaultValue: "TODAY" }),
    [t, langKey]
  );


  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
  style={[
    s.shell,
    s.shadowSoft,
    {
      maxWidth: CONTENT_MAX_W,
      borderColor: TOKENS.rim,
      backgroundColor: TOKENS.surface,
      borderRadius: UI.shellR,
      padding: UI.pad,
    },
  ]}
>
  {/* ✅ subtle highlight to add “depth” (Android+iOS) */}
        <View
          pointerEvents="none"
          style={[
            s.shellHighlight,
            {
              borderColor: isDarkMode
                ? "rgba(255,255,255,0.10)"
                : "rgba(2,6,23,0.06)",
              backgroundColor: isDarkMode
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.55)",
            },
          ]}
        />
                <View
          pointerEvents="none"
          style={[
            s.shellRim,
            {
              borderColor: TOKENS.rim,
              borderWidth: TOKENS.hairline,
              borderRadius: UI.shellR,
            },
          ]}
        />


        {/* Top pills */}
        <View style={[s.pillsRow, { marginBottom: normalize(isTiny ? 10 : 12) }]}>
          <View
            style={[
              s.pill,
              {
                backgroundColor: TOKENS.pillA,
                borderWidth: TOKENS.hairline,
                borderColor: TOKENS.rim,
              },
            ]}
          >
            <Ionicons name="flash-outline" size={normalize(14)} color={TOKENS.icon} />
                        <Text style={[s.pillText, { color: TOKENS.icon, fontSize: TYPO.pill }]}>
              {todayBadge}
            </Text>
          </View>

          <View
            style={[
              s.pill,
              {
                backgroundColor: TOKENS.pillB,
                borderWidth: TOKENS.hairline,
                borderColor: TOKENS.rim,
              },
            ]}
          >
            <Ionicons
              name={primaryMode === "duoPending" ? "hourglass-outline" : "flame-outline"}
              size={normalize(14)}
              color={TOKENS.icon}
            />
                        <Text
              style={[s.pillText, { color: TOKENS.icon, fontSize: TYPO.pill }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.88}
            >

              {rightPill}
            </Text>
          </View>
        </View>

        {/* Title */}
                <Text style={[s.title, { color: TOKENS.text, fontSize: TYPO.title }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
        >

          {displayTitle}
        </Text>

        <Text
          style={[
    s.sub,
    {
      color: TOKENS.subText,
      fontSize: TYPO.sub,
      lineHeight: Math.round(TYPO.sub * 1.35),
    },
  ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.92}
        >
          {displaySub}
        </Text>

        {/* ✅ WHY RETURN (bonus) — “perte évitée” / “partner t’attend” / “trophée proche” */}
        {!!whyReturn?.text && (
          <Animated.View
            style={[
              s.whyWrap,
              whyReturnStyle,
              {
                borderColor: TOKENS.whyBorder,
                backgroundColor: TOKENS.whyBg,
                borderRadius: normalize(isTiny ? 16 : isTablet ? 20 : 18),
              },
            ]}
          >
            {/* glow ultra subtil */}
            <LinearGradient
              pointerEvents="none"
              colors={[TOKENS.whyGlowA, "rgba(0,0,0,0)", TOKENS.whyGlowB]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={s.whyRow}>
              <View style={s.whyIconPill}>
                <Ionicons name={whyReturnIcon as any} size={normalize(isTiny ? 16 : 18)} color={TOKENS.whyIcon} />
              </View>
              <Text
                style={[
                  s.whyText,
                  { color: TOKENS.whyText, fontSize: normalize(isTiny ? 12.5 : isTablet ? 13.5 : 13) },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >
                {whyReturn.text}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Hub preview (tap to open) */}
        {!!hubMeta?.title && (
          <Pressable
            onPress={() => {
    hapticTap("selection");
    onOpenHub();
  }}
  style={({ pressed }) => [
    s.preview,
    {
      borderColor: TOKENS.border,
      backgroundColor: TOKENS.surface2,
      borderRadius: UI.previewR,
                paddingVertical: UI.previewPadY,
                paddingHorizontal: UI.previewPadX,
    },
    pressFx(pressed, 0.993),
  ]}
          >
                        <View
              pointerEvents="none"
              style={[
                s.previewRim,
                {
                  borderColor: TOKENS.rim,
                  borderWidth: TOKENS.hairline,
                  borderRadius: UI.previewR,
                },
              ]}
            />

            {hubMeta?.imageUrl ? (
  <View
    style={[
      s.previewThumbWrap,
      {
        borderColor: TOKENS.thumbBorder,
        backgroundColor: TOKENS.thumbBg,
        width: UI.thumb,
                    height: UI.thumb,
                    borderRadius: UI.thumbR,

      },
    ]}
  >
       <ExpoImage
  source={{ uri: getThumbUrl200(hubMeta.imageUrl) || hubMeta.imageUrl }}
  style={{ width: "100%", height: "100%" }}
  contentFit="cover"
  transition={120}
  cachePolicy="memory-disk"
/>

  </View>
) : (
  <View
    style={[
      s.previewThumbWrap,
      {
        borderColor: TOKENS.thumbBorder,
        backgroundColor: TOKENS.thumbBg,
        width: UI.thumb,
                    height: UI.thumb,
                    borderRadius: UI.thumbR,

      },
    ]}
  >
        <View
      pointerEvents="none"
      style={[
        s.thumbRim,
         {
                      borderColor: TOKENS.thumbBorder,
                      borderWidth: TOKENS.hairline,
                      borderRadius: UI.thumbR,
                    },
      ]}
    />

    <Ionicons
      name="sparkles-outline"
      size={normalize(Math.max(16, Math.round(UI.thumb * 0.42)))}
      color={isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.75)"}
    />
  </View>
)}

            <View style={{ flex: 1, minWidth: 0, marginRight: normalize(10) }}>
              <Text
                 style={[s.previewTitle, { color: TOKENS.text, fontSize: TYPO.previewTitle }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >
                {hubMeta.title}
              </Text>

              {!!hubDescription && (
                                <Text
                  style={[
                    s.previewDesc,
                    {
                       color: TOKENS.mutedText,
                      fontSize: TYPO.previewDesc,
                      lineHeight: Math.round(TYPO.previewDesc * 1.25),
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.92}
                >

                  {hubDescription}
                </Text>
              )}

               <View style={[s.progressTrack, { backgroundColor: TOKENS.track, height: UI.trackH }]}>

                <View
  style={[
    s.progressFill,
    {
      width: `${Math.round(Math.max(0, Math.min(1, progressPct)) * 100)}%`,
      backgroundColor: TOKENS.progressFill,
      height: UI.trackH,
    },
  ]}
/>
              </View>
            </View>

                        <View
              style={[
                s.previewChevron,
                {
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(2,6,23,0.04)",
                  width: UI.chevronBox,
                  height: UI.chevronBox,
                  borderRadius: 999,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={normalize(Math.max(16, Math.round(UI.chevronBox * 0.56)))}
                color={TOKENS.chevron}
              />
            </View>

          </Pressable>
        )}

        {/* ✅ PRIMARY ACTION */}
        {primaryMode === "duoPending" ? (
          <View style={s.pendingWrap}>
            <Pressable
              ref={primaryCtaRef as any}
              onPress={() => {
                hapticTap("selection");
                (onPendingWarmupPress ?? onPrimaryPress)();
              }}
              accessibilityRole="button"
              accessibilityLabel={pendingA11y}
              accessibilityHint={t("homeZ.duoPending.hint", { defaultValue: "Open to prepare your Duo while waiting." })}
              style={({ pressed }) => [
                s.pendingCard,
               {
                  borderColor: TOKENS.border,
                  backgroundColor: TOKENS.surface2,
                  borderRadius: UI.cardR,
                  paddingVertical: normalize(isTiny ? 12 : isTablet ? 16 : 14),
                  paddingHorizontal: normalize(isTiny ? 12 : isTablet ? 16 : 14),
                },
                primaryAnimatedStyle as any,
                pressFx(pressed, 0.992),
              ]}
            >
              {/* ✅ internal rim (premium) */}
              <View
                pointerEvents="none"
                style={[
                  s.pendingRim,
                  { borderRadius: UI.cardR, borderColor: TOKENS.rim, borderWidth: TOKENS.hairline },
                ]}
              />
              <View style={s.pendingRow}>
                <View style={[s.pendingCircleBox, { width: UI.iconBox, height: UI.iconBox }]}>
                  {/* ✅ breathing orb (compact) */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.pendingAura,
                      auraStyle,
                      { backgroundColor: isDarkMode ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.10)",
                        width: UI.aura, height: UI.aura, borderRadius: 999 },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.pendingBreath,
                      breathStyle,
                       { backgroundColor: isDarkMode ? "rgba(167,139,250,0.18)" : "rgba(167,139,250,0.12)",
                         width: UI.sheen, height: UI.sheen, borderRadius: 999 },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.pendingRing,
                      ringStyle,
                      {
                        borderColor: isDarkMode ? "rgba(167,139,250,0.55)" : "rgba(99,102,241,0.42)",
                        width: UI.ring,
                        height: UI.ring,
                        borderRadius: 999,
                      },
                    ]}
                  />

                  <LinearGradient
                    colors={["#6366F1", "#A78BFA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      s.pendingCircle,
                      { width: UI.orb, height: UI.orb, borderRadius: 999 },
                    ]}
                  >
                    <Ionicons name="hourglass-outline" size={UI.hourglass} color="#0B1120" />
                  </LinearGradient>
                </View>

                <View style={s.pendingCopy}>

{/* ✅ Info (non action) — 1 seule fois ici */}
                  <Text
                    style={[
                      s.pendingMicro,
                      {
                        color: TOKENS.mutedText,
                        fontSize: TYPO.pendingMicro,
                        lineHeight: Math.round(TYPO.pendingMicro * 1.25),
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.92}
                  >
                    {pendingSub}
                  </Text>

                  {/* ✅ Action row: spacer + chip */}
                  <View style={s.pendingCtaRow}>
                    <View style={{ flex: 1 }} />
                    <View
                      style={[
                        s.pendingChip,
                        {
                          borderRadius: UI.ctaR,
                          paddingVertical: UI.ctaPadY,
                          paddingHorizontal: UI.ctaPadX,
                        },
                      ]}
                    >                  

                      <Text
                        style={[s.pendingChipText, { fontSize: TYPO.pendingLabel }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.88}
                      >
                        {t("duo.pending.warmup", { defaultValue: "Warmup" })}
                      </Text>
                      <Ionicons name="arrow-forward" size={UI.ctaIcon} color="#0B1120" />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ) : (
          <Pressable
          ref={primaryCtaRef as any}
            onPress={() => {
    hapticTap("light");
    onPrimaryPress();
  }}
            accessibilityRole="button"
            style={({ pressed }) => [
    s.primaryBtn,
    s.shadowSoft,
    primaryAnimatedStyle as any,
    {
                borderRadius: UI.primaryR,
                marginBottom: normalize(10),
              },
    pressFx(pressed, 0.990),
  ]}
          >
            <LinearGradient
             colors={[effectivePrimaryGradient[0], effectivePrimaryGradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                s.primaryGradient,
                {
                  borderRadius: UI.primaryR,
                  paddingVertical: UI.primaryPadY,
                  paddingHorizontal: UI.primaryPadX,
                },
              ]}
            >
                            <Text
                style={[s.primaryText, { fontSize: TYPO.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >

                {primaryLabel}
              </Text>
              <Ionicons name={primaryIcon as any} size={normalize(isTiny ? 18 : 20)} color="#0B1120" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Secondary actions */}
        <View style={s.secondaryRow}>
          {showSoloLink && (
            <Pressable onPress={() => {
   hapticTap("selection");
   onPickSolo();
 }}
 style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.70 }]}>
              <Text  style={[s.linkText, { color: TOKENS.mutedText, fontSize: TYPO.link }]}>
                {t("homeZ.todayHub.continueSolo", { defaultValue: "Continuer en solo" })}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
   hapticTap("selection");
   onCreate();
 }}
 style={({ pressed }) => [
   s.createCard,
   {
                borderColor: TOKENS.border,
                backgroundColor: TOKENS.surface2,
                borderRadius: UI.createR,
                paddingVertical: UI.createPadY,
                paddingHorizontal: UI.createPadX,
              },
   pressFx(pressed, 0.993),
 ]}
          >
            <View
              style={[
                s.createIcon,
                {
                  borderColor: TOKENS.thumbBorder,
                  backgroundColor: TOKENS.thumbBg,
                  width: UI.createIcon,
                  height: UI.createIcon,
                  borderRadius: 999,
                },
              ]}
            >
               <Ionicons name="add" size={normalize(isTiny ? 16 : 18)} color={isDarkMode ? "#F8FAFC" : "#0B1120"} />
            </View>

           <Text
  style={[s.createTitle, { color: TOKENS.text, fontSize: TYPO.createTitle }]}
  numberOfLines={1}
  adjustsFontSizeToFit
  minimumFontScale={0.90}
>

              {t("homeZ.todayHub.create", { defaultValue: "Créer" })}
            </Text>
            <Text
  style={[
    s.createSub,
    {
      color: TOKENS.mutedText,
      fontSize: TYPO.createSub,
      lineHeight: Math.round(TYPO.createSub * 1.25),
    },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
  minimumFontScale={0.90}
>

              {t("homeZ.todayHub.createSub", { defaultValue: "Ton défi, tes règles." })}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
    shell: {
    width: "100%",
    position: "relative",
    borderWidth: 0,
    borderRadius: 26,
    padding: 16,
    marginBottom: 0,
    overflow: "visible", // ✅ autorise le breathing halo
  },
    pendingAura: {
    position: "absolute",
    width: 106,
    height: 106,
    borderRadius: 999,
  },
  pendingRim: {
    ...StyleSheet.absoluteFillObject,
  },
  shadowSoft: {
    
  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 12 },
    default: {},
    
  }),
},
  pendingBreath: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
  },
  pillsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    flexShrink: 1,
  },
  pillText: {
    fontSize: 13,
    fontFamily: F.bold,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: F.bold,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sub: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: F.regular,
    marginBottom: 14,
  },
  whyWrap: {
    width: "100%",
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  whyIconPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  whyText: {
    flex: 1,
    minWidth: 0,
    fontFamily: F.bold,
    letterSpacing: -0.2,
  },
  preview: {
     width: "100%",
     borderWidth: 0,
     flexDirection: "row",
     alignItems: "center",
     marginBottom: 14,
   },
  previewTitle: {
    fontSize: 18,
    fontFamily: F.bold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  previewDesc: {
    fontSize: 14,
    fontFamily: F.regular,
    marginBottom: 10,
  },
  previewThumbWrap: {
  borderWidth: 0,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
},
previewThumb: {
  width: "100%",
  height: "100%",
},
  progressTrack: {
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
  borderRadius: 999,
},
  primaryBtn: {
    width: "100%",
    overflow: "hidden",
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryText: {
    fontSize: 20,
    fontFamily: F.bold,
    letterSpacing: -0.2,
    color: "#0B1120",
    textShadowColor: "rgba(255,255,255,0.10)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
    shellRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
  },

  previewRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  thumbRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  pendingWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  pendingCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  pendingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pendingCircleBox: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingCircle: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
  },
  pendingGlow: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 999,
  },
    shellHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "52%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    opacity: 0.55,
  },
  previewChevron: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingTextBlock: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  pendingStepsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  stepText: {
    fontFamily: F.regular,
    fontSize: 11,
  },
  stepSep: {
    fontFamily: F.bold,
    fontSize: 12,
    marginHorizontal: 2,
  },
  pendingCtaHint: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
pendingCopy: {
    flex: 1,
    minWidth: 0,
  },
  pendingCtaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#A78BFA",
  },
  pendingCtaChipText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: "#0B1120",
    letterSpacing: 0.2,
  },
  pendingLabel: {
    fontFamily: F.bold,
    letterSpacing: -0.2,
  },
  pendingMicro: {
    marginTop: 2,
    fontFamily: F.regular,
  },
  secondaryRow: {
    marginTop: 4,
    alignItems: "center",
  },
  pendingCtaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pendingTapText: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#A78BFA",
  },
  pendingChipText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: "#0B1120",
    letterSpacing: 0.2,
  },
  linkBtn: {
    paddingVertical: 10,
  },
  linkText: {
    fontSize: 15,
    fontFamily: F.regular,
    textDecorationLine: "underline",
  },
  createCard: {
    width: "100%",
    borderWidth: 1,
    alignItems: "center",
    marginTop: 10,
  },
  createIcon: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1.5,
  },
  createTitle: {
    fontSize: 22,
    fontFamily: F.bold,
    letterSpacing: -0.2,
  },
  createSub: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: F.regular,
  },
});
