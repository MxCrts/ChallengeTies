// components/TodayHub.tsx
import React, { useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
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


type PrimaryMode = "mark" | "new" | "duo" | "duoPending";

type HubMeta = {
  id?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
};

type Props = {
  t: TFunction;
  isDarkMode: boolean;

  primaryMode: PrimaryMode;
  hasActiveChallenges: boolean;
  activeCount: number;

  title: string;
  sub: string;

  hubMeta?: HubMeta | null;
  hubDescription?: string;

  progressPct: number;

  primaryGradient: readonly [string, string];
  primaryIcon: string;
  primaryLabel: string;

  onOpenHub: () => void;
  onPrimaryPress: () => void;
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
    primaryMode,
    hasActiveChallenges,
    activeCount,
    title,
    sub,
    hubMeta,
    hubDescription,
    progressPct,
    primaryGradient,
    primaryIcon,
    primaryLabel,
    onOpenHub,
    onPrimaryPress,
    onPickSolo,
    onCreate,
    CONTENT_MAX_W,
    normalize,
  } = props;

    const { width: W } = useWindowDimensions();
  const isTiny = W < 350;
  const isLarge = W >= 430;

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
    const s = 1 + ring.value * 0.06; // plus clean
    const o = 0.16 + ring.value * 0.14; // glow discret
    return { transform: [{ scale: s }], opacity: o };
  });

  const glowStyle = useAnimatedStyle(() => {
    const o = 0.08 + glow.value * 0.14;
    return { opacity: o };
  });

    const breathStyle = useAnimatedStyle(() => {
    const p = breath.value; // 0..1
    return {
      opacity: 0.12 + p * 0.16,             // 0.12 -> 0.28
      transform: [{ scale: 1 + p * 0.10 }], // 1 -> 1.10 (bien visible)
    };
  });

  const auraStyle = useAnimatedStyle(() => {
    const a = aura.value;
    return {
      opacity: 0.10 + a * 0.18, // 0.10 -> 0.28
      transform: [{ scale: 1 + a * 0.14 }], // 1 -> 1.14 (halo large)
    };
  });


  const rightPill = useMemo(() => {
    if (primaryMode === "duoPending") {
      return t("homeZ.todayHub.metaPending", { defaultValue: "Invitation" });
    }
    if (!hasActiveChallenges) {
      return t("homeZ.todayHub.metaNone", { defaultValue: "Aucun défi actif" });
    }
    return t("homeZ.todayHub.metaActiveCount", {
      defaultValue: "{{count}} défi(s) actif(s)",
      count: activeCount,
    });
  }, [t, primaryMode, hasActiveChallenges, activeCount]);

  const showSoloLink = !hasActiveChallenges && primaryMode !== "duoPending";

    const effectivePrimaryGradient = useMemo(() => {
    // ✅ Quand aucun défi actif -> CTA “activation”, pas “succès”
    if (primaryMode === "duo" && !hasActiveChallenges) {
      return ["#6366F1", "#A78BFA"] as const; // indigo -> violet (premium)
    }
    return primaryGradient;
  }, [primaryMode, hasActiveChallenges, primaryGradient]);


  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
        style={[
          s.shell,
          {
            maxWidth: CONTENT_MAX_W,
            borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)",
            backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.72)",
          },
        ]}
      >
        {/* Top pills */}
        <View style={s.pillsRow}>
          <View
            style={[
              s.pill,
              {
                backgroundColor: isDarkMode ? "rgba(148,163,184,0.20)" : "rgba(148,163,184,0.35)",
              },
            ]}
          >
            <Ionicons name="flash-outline" size={normalize(14)} color={isDarkMode ? "#E2E8F0" : "#0B1120"} />
                        <Text style={[s.pillText, { color: isDarkMode ? "#E2E8F0" : "#0B1120", fontSize: TYPO.pill }]}>
              {t("homeZ.todayHub.pillToday", { defaultValue: "AUJOURD’HUI" })}
            </Text>
          </View>

          <View
            style={[
              s.pill,
              {
                backgroundColor: isDarkMode ? "rgba(226,232,240,0.10)" : "rgba(2,6,23,0.06)",
              },
            ]}
          >
            <Ionicons
              name={primaryMode === "duoPending" ? "hourglass-outline" : "flame-outline"}
              size={normalize(14)}
              color={isDarkMode ? "#E2E8F0" : "#0B1120"}
            />
                        <Text
              style={[s.pillText, { color: isDarkMode ? "#E2E8F0" : "#0B1120", fontSize: TYPO.pill }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.88}
            >

              {rightPill}
            </Text>
          </View>
        </View>

        {/* Title */}
                <Text
          style={[
            s.title,
            { color: isDarkMode ? "#F8FAFC" : "#0B1120", fontSize: TYPO.title },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
        >

          {title}
        </Text>

        <Text
          style={[
            s.sub,
            {
              color: isDarkMode ? "rgba(226,232,240,0.70)" : "rgba(15,23,42,0.62)",
              fontSize: TYPO.sub,
              lineHeight: Math.round(TYPO.sub * 1.35),
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.92}
        >
          {sub}
        </Text>

        {/* Hub preview (tap to open) */}
        {!!hubMeta?.title && (
          <Pressable
            onPress={onOpenHub}
            style={({ pressed }) => [
              s.preview,
              {
                borderColor: isDarkMode ? "rgba(226,232,240,0.16)" : "rgba(2,6,23,0.10)",
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.80)",
                opacity: pressed ? 0.96 : 1,
                transform: [{ scale: pressed ? 0.995 : 1 }],
              },
            ]}
          >
            {hubMeta?.imageUrl ? (
  <View
    style={[
      s.previewThumbWrap,
      {
        borderColor: isDarkMode ? "rgba(226,232,240,0.18)" : "rgba(2,6,23,0.10)",
        backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(2,6,23,0.03)",
      },
    ]}
  >
        <ExpoImage
      source={{ uri: hubMeta.imageUrl }}
      style={s.previewThumb}
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
        borderColor: isDarkMode ? "rgba(226,232,240,0.18)" : "rgba(2,6,23,0.10)",
        backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(2,6,23,0.03)",
      },
    ]}
  >
    <Ionicons
      name="sparkles-outline"
      size={normalize(18)}
      color={isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.75)"}
    />
  </View>
)}

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[s.previewTitle, { color: isDarkMode ? "#F8FAFC" : "#0B1120", fontSize: TYPO.previewTitle }]}
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
                      color: isDarkMode ? "rgba(226,232,240,0.65)" : "rgba(15,23,42,0.55)",
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

              <View
                style={[
                  s.progressTrack,
                  { backgroundColor: isDarkMode ? "rgba(226,232,240,0.10)" : "rgba(2,6,23,0.08)" },
                ]}
              >
                <View
                  style={[
                    s.progressFill,
                    { width: `${Math.round(Math.max(0, Math.min(1, progressPct)) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={normalize(20)}
              color={isDarkMode ? "rgba(226,232,240,0.85)" : "rgba(2,6,23,0.85)"}
            />
          </Pressable>
        )}

        {/* ✅ PRIMARY ACTION */}
        {primaryMode === "duoPending" ? (
          <View style={s.pendingWrap}>
            <Pressable
              onPress={onPrimaryPress}
              accessibilityRole="button"
              accessibilityLabel={t("homeZ.todayHub.pendingCtaA11y", { defaultValue: "Invitation en attente" })}
              style={({ pressed }) => [
                s.pendingPress,
                pressed && { transform: [{ scale: 0.985 }], opacity: 0.98 },
              ]}
            >
              <View style={s.pendingCircleBox}>
                                {/* ✅ Big breathing orb (respiration) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pendingAura,
                    auraStyle,
                    { backgroundColor: isDarkMode ? "rgba(99,102,241,0.26)" : "rgba(99,102,241,0.18)" },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pendingBreath,
                    breathStyle,
                    { backgroundColor: isDarkMode ? "rgba(167,139,250,0.32)" : "rgba(167,139,250,0.22)" },
                  ]}
                />

                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pendingGlow,
                    glowStyle,
                    { backgroundColor: isDarkMode ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)" },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pendingRing,
                    ringStyle,
                    { borderColor: isDarkMode ? "rgba(167,139,250,0.55)" : "rgba(99,102,241,0.45)" },
                  ]}
                />

                <LinearGradient
                  colors={["#6366F1", "#A78BFA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.pendingCircle}
                >
                  <Ionicons name="hourglass-outline" size={normalize(26)} color="#0B1120" />
                </LinearGradient>
              </View>

                            <Text
                style={[s.pendingLabel, { color: isDarkMode ? "#F8FAFC" : "#0B1120", fontSize: TYPO.pendingLabel }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >

                {t("homeZ.todayHub.pendingShort", { defaultValue: "En attente" })}
              </Text>
                            <Text
                style={[
                  s.pendingMicro,
                  {
                    color: isDarkMode ? "rgba(226,232,240,0.62)" : "rgba(15,23,42,0.55)",
                    fontSize: TYPO.pendingMicro,
                    lineHeight: Math.round(TYPO.pendingMicro * 1.25),
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >

                {t("homeZ.todayHub.pendingMicro", { defaultValue: "Dès la réponse, ça passe en Duo." })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onPrimaryPress}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.primaryBtn,
              pressed && { transform: [{ scale: 0.992 }], opacity: 0.98 },
            ]}
          >
            <LinearGradient
             colors={[effectivePrimaryGradient[0], effectivePrimaryGradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryGradient}
            >
                            <Text
                style={[s.primaryText, { fontSize: TYPO.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.90}
              >

                {primaryLabel}
              </Text>
              <Ionicons name={primaryIcon as any} size={normalize(20)} color="#0B1120" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Secondary actions */}
        <View style={s.secondaryRow}>
          {showSoloLink && (
            <Pressable onPress={onPickSolo} style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.7 }]}>
              <Text style={[s.linkText, { color: isDarkMode ? "rgba(226,232,240,0.78)" : "rgba(2,6,23,0.72)", fontSize: TYPO.link }]}>
                {t("homeZ.todayHub.continueSolo", { defaultValue: "Continuer en solo" })}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onCreate}
            style={({ pressed }) => [
              s.createCard,
              {
                borderColor: isDarkMode ? "rgba(226,232,240,0.16)" : "rgba(2,6,23,0.10)",
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.80)",
                opacity: pressed ? 0.96 : 1,
                transform: [{ scale: pressed ? 0.995 : 1 }],
              },
            ]}
          >
            <View
              style={[
                s.createIcon,
                {
                  borderColor: isDarkMode ? "rgba(226,232,240,0.22)" : "rgba(2,6,23,0.14)",
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.65)",
                },
              ]}
            >
              <Ionicons name="add" size={normalize(18)} color={isDarkMode ? "#F8FAFC" : "#0B1120"} />
            </View>

           <Text
  style={[s.createTitle, { color: isDarkMode ? "#F8FAFC" : "#0B1120", fontSize: TYPO.createTitle }]}
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
      color: isDarkMode ? "rgba(226,232,240,0.62)" : "rgba(15,23,42,0.55)",
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
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    marginBottom: 0,
    overflow: "visible", // ✅ autorise le breathing halo
  },
    pendingAura: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 999,
  },
  pendingBreath: {
    position: "absolute",
    width: 112,
    height: 112,
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
    paddingVertical: 8,
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
  preview: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  width: 46,
  height: 46,
  borderRadius: 14,
  borderWidth: 1,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
},
previewThumb: {
  width: "100%",
  height: "100%",
},
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#F97316",
  },
  primaryBtn: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10,
  },
  primaryGradient: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryText: {
    fontSize: 20,
    fontFamily: F.bold,
    letterSpacing: -0.2,
    color: "#0B1120",
  },
  pendingWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  pendingPress: {
    alignItems: "center",
    width: "100%",
  },
  pendingCircleBox: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pendingCircle: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingRing: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 2,
  },
  pendingGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
  },
  pendingLabel: {
    fontSize: 18,
    fontFamily: F.bold,
    letterSpacing: -0.2,
  },
  pendingMicro: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: F.regular,
  },
  secondaryRow: {
    marginTop: 4,
    alignItems: "center",
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
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 10,
  },
  createIcon: {
    width: 34,
    height: 34,
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
