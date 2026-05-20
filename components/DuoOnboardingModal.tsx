// components/DuoOnboardingModal.tsx
// TOP 1 MONDE — Duo onboarding 3 slides fullscreen
// Trigger : AsyncStorage "duo_onboarding_seen" — une seule fois
// Usage   : <DuoOnboardingModal visible onClose={() => {}} onInviteFriend={() => {}} onFindPartner={() => {}} />

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";

const { width: SW, height: SH } = Dimensions.get("window");

const ORANGE = "#F97316";
const GOLD = "#FFD166";
const CYAN = "#00C2FF";
const BG = "#05070B";
const CARD = "#0C0F1A";
const STROKE = "rgba(255,255,255,0.08)";
const TEXT = "rgba(248,250,252,0.97)";
const TEXT_DIM = "rgba(248,250,252,0.58)";

const DUO_ONBOARDING_KEY = "duo_onboarding_seen";

const ns = (n: number) =>
  Math.round(n * Math.min(Math.max(SW / 375, 0.78), 1.45));

// ─── Check / mark seen ───────────────────────────────────────────────────────
export async function isDuoOnboardingSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DUO_ONBOARDING_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markDuoOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(DUO_ONBOARDING_KEY, "1");
  } catch {}
}

// ─── Avatar pill animée ───────────────────────────────────────────────────────
const AvatarPill = React.memo(function AvatarPill({
  initials,
  color,
  delay,
}: {
  initials: string;
  color: string;
  delay: number;
}) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160, delay } as any);
    opacity.value = withTiming(1, { duration: 340, delay } as any);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: ns(64),
          height: ns(64),
          borderRadius: ns(32),
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.18)",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: ns(22),
          color: "#0B1120",
        }}
      >
        {initials}
      </Text>
    </Animated.View>
  );
});

// ─── Slide 1 — Le concept ────────────────────────────────────────────────────
const Slide1 = React.memo(function Slide1() {
  const { t } = useTranslation();
  const pulse = useSharedValue(0);
  const connectorScale = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    connectorScale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  const vsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [0.92, 1.06]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.08, 0.22]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.18]) },
    ],
  }));

  return (
    <View style={s.slideContent}>
      {/* Avatars + VS */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: ns(18), marginBottom: ns(36) }}>
        <View style={{ alignItems: "center", gap: ns(10) }}>
          <AvatarPill initials="TOI" color={ORANGE} delay={0} />
          <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(12), color: ORANGE }}>
            {t("duo.you", { defaultValue: "Toi" })}
          </Text>
        </View>

        {/* Connecteur VS animé */}
        <View style={{ alignItems: "center", justifyContent: "center", width: ns(64) }}>
          <Animated.View
            style={[
              {
                position: "absolute",
                width: ns(80),
                height: ns(80),
                borderRadius: ns(40),
                backgroundColor: ORANGE,
              },
              glowStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View style={[{
            width: ns(44),
            height: ns(44),
            borderRadius: ns(22),
            backgroundColor: CARD,
            borderWidth: 1.5,
            borderColor: ORANGE,
            alignItems: "center",
            justifyContent: "center",
          }, vsStyle]}>
            <Text style={{
              fontFamily: "Comfortaa_700Bold",
              fontSize: ns(13),
              color: ORANGE,
              letterSpacing: -0.5,
            }}>VS</Text>
          </Animated.View>

          {/* Ligne de connexion gauche */}
          <View style={{
            position: "absolute",
            height: 1.5,
            backgroundColor: ORANGE,
            opacity: 0.35,
            left: ns(-28),
            width: ns(26),
          }} />
          {/* Ligne droite */}
          <View style={{
            position: "absolute",
            height: 1.5,
            backgroundColor: CYAN,
            opacity: 0.35,
            right: ns(-28),
            width: ns(26),
          }} />
        </View>

        <View style={{ alignItems: "center", gap: ns(10) }}>
          <AvatarPill initials="AMI" color={CYAN} delay={120} />
          <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(12), color: CYAN }}>
            {t("duo.partner", { defaultValue: "Ton ami" })}
          </Text>
        </View>
      </View>

      <Text style={s.slideTitle}>
        {t("duo.onboarding.slide1.title", {
          defaultValue: "Seul on va plus vite.\nEnsemble on va plus loin.",
        })}
      </Text>
      <Text style={s.slideDesc}>
        {t("duo.onboarding.slide1.desc", {
          defaultValue:
            "ChallengeTies te connecte à quelqu'un qui compte vraiment. Votre progression, visible à deux.",
        })}
      </Text>
    </View>
  );
});

// ─── Slide 2 — La preuve ─────────────────────────────────────────────────────
const ProgressBar = React.memo(function ProgressBar({
  pct,
  color,
  label,
  value,
  delay,
}: {
  pct: number;
  color: string;
  label: string;
  value: string;
  delay: number;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
      delay,
    } as any);
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as any,
  }));

  return (
    <View style={{ width: "100%", marginBottom: ns(14) }}>
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: ns(6),
      }}>
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(13), color: TEXT }}>
          {label}
        </Text>
        <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(13), color }}>
          {value}
        </Text>
      </View>
      <View style={{
        height: ns(10),
        borderRadius: ns(999),
        backgroundColor: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        <Animated.View style={[{ height: "100%", borderRadius: ns(999) }, barStyle]}>
          <LinearGradient
            colors={[color, color + "BB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  );
});

const Slide2 = React.memo(function Slide2() {
  const { t } = useTranslation();
  const statScale = useSharedValue(0.6);
  const statOpacity = useSharedValue(0);

  useEffect(() => {
    statScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    statOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  const statStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statScale.value }],
    opacity: statOpacity.value,
  }));

  return (
    <View style={s.slideContent}>
      {/* Stat principale */}
      <Animated.View style={[{
        borderRadius: ns(20),
        backgroundColor: "rgba(249,115,22,0.10)",
        borderWidth: 1,
        borderColor: "rgba(249,115,22,0.28)",
        paddingHorizontal: ns(24),
        paddingVertical: ns(16),
        alignItems: "center",
        marginBottom: ns(28),
        width: "100%",
      }, statStyle]}>
        <Text style={{
          fontFamily: "Comfortaa_700Bold",
          fontSize: ns(48),
          color: ORANGE,
          letterSpacing: -2,
          includeFontPadding: false,
        }}>65%</Text>
        <Text style={{
          fontFamily: "Comfortaa_400Regular",
          fontSize: ns(13),
          color: TEXT_DIM,
          textAlign: "center",
          marginTop: ns(4),
        }}>
          {t("duo.onboarding.slide2.statLabel", {
            defaultValue: "plus de chances de tenir 30 jours à deux",
          })}
        </Text>
      </Animated.View>

      {/* Barres de progression comparatives */}
      <View style={{ width: "100%" }}>
        <ProgressBar pct={0.65} color={ORANGE} label={t("duo.onboarding.slide2.withFriend", { defaultValue: "Avec un ami" })} value="65j / 100" delay={200} />
        <ProgressBar pct={0.28} color="rgba(255,255,255,0.35)" label={t("duo.onboarding.slide2.alone", { defaultValue: "Seul" })} value="28j / 100" delay={400} />
      </View>

      <Text style={[s.slideDesc, { marginTop: ns(16) }]}>
        {t("duo.onboarding.slide2.desc", {
          defaultValue:
            "Votre partenaire vous voit progresser. Vous le voyez. Cette simple visibilité change tout.",
        })}
      </Text>
    </View>
  );
});

// ─── Slide 3 — L'action ──────────────────────────────────────────────────────
const Slide3 = React.memo(function Slide3({
  onInviteFriend,
  onFindPartner,
}: {
  onInviteFriend: () => void;
  onFindPartner: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={s.slideContent}>
      <View style={{
        width: ns(72),
        height: ns(72),
        borderRadius: ns(36),
        backgroundColor: "rgba(249,115,22,0.14)",
        borderWidth: 1.5,
        borderColor: "rgba(249,115,22,0.35)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: ns(20),
      }}>
        <Ionicons name="people" size={ns(34)} color={ORANGE} />
      </View>

      <Text style={[s.slideTitle, { marginBottom: ns(8) }]}>
        {t("duo.onboarding.slide3.title", {
          defaultValue: "Prêt à démarrer en Duo ?",
        })}
      </Text>
      <Text style={[s.slideDesc, { marginBottom: ns(28) }]}>
        {t("duo.onboarding.slide3.desc", {
          defaultValue: "Choisis comment tu veux trouver ton partenaire.",
        })}
      </Text>

      {/* CTA 1 — Inviter un ami */}
      <Pressable
        onPress={onInviteFriend}
        style={({ pressed }) => [
          {
            width: "100%",
            borderRadius: ns(18),
            overflow: "hidden",
            marginBottom: ns(12),
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.982 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={["#FF9F1C", ORANGE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: ns(10),
            paddingVertical: ns(16),
            paddingHorizontal: ns(20),
          }}
        >
          <View style={{
            width: ns(32),
            height: ns(32),
            borderRadius: ns(16),
            backgroundColor: "rgba(5,7,11,0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name="person-add-outline" size={ns(17)} color="#0B1120" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: "#0B1120" }}>
              {t("duo.onboarding.slide3.ctaInvite", { defaultValue: "Inviter un ami" })}
            </Text>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: "rgba(5,7,11,0.62)" }}>
              {t("duo.onboarding.slide3.ctaInviteSub", { defaultValue: "Envoie un lien à quelqu'un que tu connais" })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={ns(18)} color="#0B1120" />
        </LinearGradient>
      </Pressable>

      {/* CTA 2 — Trouver un binôme */}
      <Pressable
        onPress={onFindPartner}
        style={({ pressed }) => [
          {
            width: "100%",
            borderRadius: ns(18),
            overflow: "hidden",
            borderWidth: 1.5,
            borderColor: CYAN + "55",
            backgroundColor: "rgba(0,194,255,0.07)",
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.982 : 1 }],
          },
        ]}
      >
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: ns(10),
          paddingVertical: ns(16),
          paddingHorizontal: ns(20),
        }}>
          <View style={{
            width: ns(32),
            height: ns(32),
            borderRadius: ns(16),
            backgroundColor: "rgba(0,194,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name="search-outline" size={ns(17)} color={CYAN} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: ns(6) }}>
              <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: TEXT }}>
                {t("duo.onboarding.slide3.ctaMatch", { defaultValue: "Trouver un binôme" })}
              </Text>
              <View style={{
                backgroundColor: CYAN,
                borderRadius: ns(999),
                paddingHorizontal: ns(7),
                paddingVertical: ns(2),
              }}>
                <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(9), color: "#0B1120" }}>
                  NEW
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: TEXT_DIM }}>
              {t("duo.onboarding.slide3.ctaMatchSub", { defaultValue: "Matche avec un user qui fait le même défi" })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={ns(18)} color={CYAN} />
        </View>
      </Pressable>
    </View>
  );
});

// ─── Dots de pagination ───────────────────────────────────────────────────────
const Dots = React.memo(function Dots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: ns(6), alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        return (
          <View
            key={i}
            style={{
              width: active ? ns(20) : ns(6),
              height: ns(6),
              borderRadius: ns(3),
              backgroundColor: active ? ORANGE : "rgba(255,255,255,0.22)",
            }}
          />
        );
      })}
    </View>
  );
});

// ─── Export principal ─────────────────────────────────────────────────────────
export type DuoOnboardingModalProps = {
  visible: boolean;
  onClose: () => void;
  onInviteFriend: () => void;
  onFindPartner: () => void;
};

export default function DuoOnboardingModal({
  visible,
  onClose,
  onInviteFriend,
  onFindPartner,
}: DuoOnboardingModalProps) {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);
  const TOTAL = 3;

  const backdropO = useSharedValue(0);
  const cardY = useSharedValue(SH * 0.12);
  const cardO = useSharedValue(0);
  const slideX = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      backdropO.value = withTiming(0, { duration: 220 });
      cardY.value = withTiming(SH * 0.12, { duration: 260 });
      cardO.value = withTiming(0, { duration: 220 });
      return;
    }
    setSlide(0);
    backdropO.value = withTiming(1, { duration: 280 });
    cardY.value = withSpring(0, { damping: 18, stiffness: 180 });
    cardO.value = withTiming(1, { duration: 260 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{ translateY: cardY.value }],
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const goTo = useCallback(
    (next: number, direction: 1 | -1) => {
      const OUT = SW * 0.22 * -direction;
      const IN = SW * 0.22 * direction;

      slideX.value = withSequence(
        withTiming(OUT, { duration: 180, easing: Easing.in(Easing.quad) }),
        withTiming(IN, { duration: 0 }),
        withSpring(0, { damping: 16, stiffness: 200 })
      );

      // Délai pour changer le slide après l'animation out
      setTimeout(() => {
        setSlide(next);
      }, 185);

      Haptics.selectionAsync().catch(() => {});
    },
    [slideX]
  );

  const handleNext = useCallback(() => {
    if (slide < TOTAL - 1) {
      goTo(slide + 1, 1);
    } else {
      // Dernier slide — ferme
      markDuoOnboardingSeen().catch(() => {});
      onClose();
    }
  }, [slide, goTo, onClose]);

  const handlePrev = useCallback(() => {
    if (slide > 0) goTo(slide - 1, -1);
  }, [slide, goTo]);

  // Swipe horizontal
  const startX = useRef(0);
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      startX.current = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -40 && slide < TOTAL - 1) {
        runOnJS(goTo)(slide + 1, 1);
      } else if (e.translationX > 40 && slide > 0) {
        runOnJS(goTo)(slide - 1, -1);
      }
    });

  const handleInviteFriend = useCallback(() => {
    markDuoOnboardingSeen().catch(() => {});
    onClose();
    setTimeout(() => onInviteFriend(), 320);
  }, [onClose, onInviteFriend]);

  const handleFindPartner = useCallback(() => {
    markDuoOnboardingSeen().catch(() => {});
    onClose();
    setTimeout(() => onFindPartner(), 320);
  }, [onClose, onFindPartner]);

  if (!visible) return null;

  const isLast = slide === TOTAL - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        markDuoOnboardingSeen().catch(() => {});
        onClose();
      }}
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFillObject, backdropStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(2,4,10,0.96)" }]} />
          )}
        </Animated.View>

        {/* Orbe ambiance */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
          <View style={{
            position: "absolute",
            width: SW * 0.9,
            height: SW * 0.9,
            borderRadius: SW * 0.45,
            top: -SW * 0.28,
            alignSelf: "center",
            backgroundColor: ORANGE,
            opacity: 0.045,
          }} />
          <View style={{
            position: "absolute",
            width: SW * 0.7,
            height: SW * 0.7,
            borderRadius: SW * 0.35,
            bottom: -SW * 0.22,
            right: -SW * 0.18,
            backgroundColor: CYAN,
            opacity: 0.04,
          }} />
        </View>

        {/* Skip */}
        <Animated.View style={[{
          position: "absolute",
          top: (StatusBar.currentHeight ?? 0) + ns(14),
          right: ns(18),
          zIndex: 10,
        }, backdropStyle]}>
          <Pressable
            onPress={() => {
              markDuoOnboardingSeen().catch(() => {});
              onClose();
            }}
            hitSlop={12}
            style={({ pressed }) => ({
              backgroundColor: "rgba(255,255,255,0.08)",
              borderRadius: ns(999),
              paddingHorizontal: ns(14),
              paddingVertical: ns(7),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontFamily: "Comfortaa_400Regular", fontSize: ns(13), color: "rgba(255,255,255,0.58)" }}>
              {t("commonS.skip", { defaultValue: "Passer" })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Card principale */}
        <Animated.View style={[{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: ns(18),
          paddingTop: ns(60),
          paddingBottom: ns(32),
        }, cardStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={{
              flex: 1,
              justifyContent: "center",
            }}>
              {/* Ligne décorative top */}
              <View style={{
                height: 1.5,
                borderRadius: 999,
                marginBottom: ns(20),
                marginHorizontal: ns(12),
                overflow: "hidden",
              }}>
                <LinearGradient
                  colors={["transparent", ORANGE + "AA", GOLD + "CC", CYAN + "88", "transparent"]}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={{ flex: 1 }}
                />
              </View>

              {/* Slides */}
              <Animated.View style={[{ flex: 1 }, slideStyle]}>
                {slide === 0 && <Slide1 />}
                {slide === 1 && <Slide2 />}
                {slide === 2 && (
                  <Slide3
                    onInviteFriend={handleInviteFriend}
                    onFindPartner={handleFindPartner}
                  />
                )}
              </Animated.View>

              {/* Footer : dots + bouton */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: ns(20),
                paddingHorizontal: ns(4),
              }}>
                {/* Dots */}
                <Dots total={TOTAL} current={slide} />

                {/* Bouton précédent (slide 1+) */}
                {slide > 0 && !isLast ? (
                  <Pressable
                    onPress={handlePrev}
                    style={({ pressed }) => ({
                      paddingHorizontal: ns(18),
                      paddingVertical: ns(12),
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="arrow-back" size={ns(22)} color="rgba(255,255,255,0.45)" />
                  </Pressable>
                ) : (
                  <View style={{ width: ns(54) }} />
                )}

                {/* Bouton suivant — masqué sur slide 3 (les CTA remplacent) */}
                {!isLast && (
                  <Pressable
                    onPress={handleNext}
                    style={({ pressed }) => ({
                      borderRadius: ns(999),
                      overflow: "hidden",
                      opacity: pressed ? 0.88 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    })}
                  >
                    <LinearGradient
                      colors={[GOLD, ORANGE]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: ns(6),
                        paddingHorizontal: ns(20),
                        paddingVertical: ns(12),
                      }}
                    >
                      <Text style={{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: "#0B1120" }}>
                        {t("commonS.next", { defaultValue: "Suivant" })}
                      </Text>
                      <Ionicons name="arrow-forward" size={ns(16)} color="#0B1120" />
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ns(8),
  },
  slideTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: ns(24),
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.6,
    lineHeight: ns(32),
    marginBottom: ns(14),
  },
  slideDesc: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: ns(14.5),
    color: TEXT_DIM,
    textAlign: "center",
    lineHeight: ns(21),
    maxWidth: SW * 0.82,
  },
});
