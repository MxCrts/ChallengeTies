// components/GuidedTourOverlay.tsx
// VERSION FINALE v4
//
// Fix 1 — Flash entre steps :
//   - overlayO reste à 1 pendant tout le tour (jamais reset entre steps)
//   - animateTooltipIn() déclenché UNIQUEMENT quand spot est dispo
//   - animFiredRef reset dans useEffect sur currentStep, PAS sur spot
//   - Tooltip invisible (opacity 0) tant que spot n'est pas disponible
//
// Fix 2 — Pas de double animation :
//   - animFiredRef garantit qu'on anime UNE seule fois par step
//
// Fix 3 — Tooltip positionning parfait :
//   - Logique unifiée : au-dessus si place, en-dessous sinon, centré en dernier recours
//   - Flèche correcte dans tous les cas
//   - Tab bar steps : padding élargi pour highlight harmonieux
//
// Fix 4 — dimRects couvrent toute la screen (inclut tab bar) :
//   - Utilise Dimensions.get('screen').height, PAS window

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { CoachmarkStepId } from "../src/services/coachmarkService";
import { COACHMARK_STEPS } from "../src/services/coachmarkService";
import type { CoachmarkTargetRect } from "../context/CoachmarkContext";

export type { CoachmarkTargetRect };

// Steps qui sont dans la tab bar (besoin de padding différent)
const TAB_BAR_STEPS: CoachmarkStepId[] = ["exploits", "profile"];

const STEPS_CONFIG = [
  {
    id: "create" as CoachmarkStepId,
    icon: "add-circle",
    titleKey: "coachmark.create.title",
    bodyKey: "coachmark.create.body",
    titleDefault: "Crée ton propre défi ✍️",
    bodyDefault: "Un défi 100% personnalisé — ta règle, ta durée, ton rythme.",
    ctaKey: "coachmark.create.cta",
    ctaDefault: "Super, je vais créer",
    accent: "#34D399",
  },
  {
    id: "explore" as CoachmarkStepId,
    icon: "compass",
    titleKey: "coachmark.explore.title",
    bodyKey: "coachmark.explore.body",
    titleDefault: "100+ défis t'attendent 🧭",
    bodyDefault: "Fitness, mindfulness, productivité… Explore toute la bibliothèque.",
    ctaKey: "coachmark.explore.cta",
    ctaDefault: "J'explore !",
    accent: "#38BDF8",
  },
  {
    id: "exploits" as CoachmarkStepId,
    icon: "trophy",
    titleKey: "coachmark.exploits.title",
    bodyKey: "coachmark.exploits.body",
    titleDefault: "Tes exploits t'attendent 🏆",
    bodyDefault: "Défis accomplis, séries tenues — tout est ici.",
    ctaKey: "coachmark.exploits.cta",
    ctaDefault: "Voir mes exploits",
    accent: "#FBBF24",
  },
  {
    id: "profile" as CoachmarkStepId,
    icon: "person-circle",
    titleKey: "coachmark.profile.title",
    bodyKey: "coachmark.profile.body",
    titleDefault: "Ton profil, tes stats 📊",
    bodyDefault: "Trophées, séries, classement… Tout ce qui compte est dans ton profil.",
    ctaKey: "coachmark.profile.cta",
    ctaDefault: "Vu, merci !",
    accent: "#F472B6",
  },
  {
    id: "bonus" as CoachmarkStepId,
    icon: "gift",
    titleKey: "coachmark.bonus.title",
    bodyKey: "coachmark.bonus.body",
    titleDefault: "Bonus quotidien 🎁",
    bodyDefault: "Chaque jour un bonus gratuit — trophées ou Streak Pass.",
    ctaKey: "coachmark.bonus.cta",
    ctaDefault: "Trop bien !",
    accent: "#F97316",
  },
];

type SpotRect = { x: number; y: number; w: number; h: number; br: number };

type Props = {
  active: boolean;
  stepIndex: number;
  currentStep: CoachmarkStepId | null;
  targetRects: Partial<Record<CoachmarkStepId, CoachmarkTargetRect>>;
  onNext: () => void;
  onSkip: () => void;
  isDarkMode: boolean;
};

// Dimensions
const SCREEN_PAD = 12;
const TOOLTIP_PAD = 14;
const TOOLTIP_MAX_W = 360;
const TOOLTIP_EST_H = 230;
const TOOLTIP_GAP = 12;

// Padding standard (quick actions dans le scroll)
const SPOT_PAD_X = 6;
const SPOT_PAD_Y = 6;
const SPOT_RADIUS = 20;

// Padding élargi tab bar — englobe toute l'icône + zone de tap
const TAB_SPOT_PAD_X = 20;
const TAB_SPOT_PAD_Y = 14;
const TAB_SPOT_RADIUS = 26;

function clampVal(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

// IMPORTANT: screen height pour couvrir la tab bar
function getScreenH() {
  return Dimensions.get("screen").height;
}
function getScreenW() {
  return Dimensions.get("window").width;
}

function normalizeSpot(
  raw?: CoachmarkTargetRect | null,
  isTabBar = false
): SpotRect | null {
  if (!raw || raw.w <= 4 || raw.h <= 4) return null;

  const sw = getScreenW();
  const sh = getScreenH();
  const padX = isTabBar ? TAB_SPOT_PAD_X : SPOT_PAD_X;
  const padY = isTabBar ? TAB_SPOT_PAD_Y : SPOT_PAD_Y;
  const br = isTabBar ? TAB_SPOT_RADIUS : SPOT_RADIUS;

  const x = clampVal(
    raw.x - padX,
    SCREEN_PAD,
    sw - SCREEN_PAD - (raw.w + padX * 2)
  );
  const y = clampVal(raw.y - padY, 0, sh - (raw.h + padY * 2));

  return { x, y, w: raw.w + padX * 2, h: raw.h + padY * 2, br };
}

export default function GuidedTourOverlay({
  active,
  stepIndex,
  currentStep,
  targetRects,
  onNext,
  onSkip,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Ref pour tracker le step précédent
  const prevStepRef = useRef<CoachmarkStepId | null>(null);
  // Garantit qu'animateTooltipIn ne se déclenche qu'UNE fois par step
  const animFiredRef = useRef(false);

  const SCREEN_H = getScreenH();
  const SCREEN_W = getScreenW();

  // ── Shared values ──────────────────────────────────────────────────
  const tooltipO = useSharedValue(0);
  const tooltipS = useSharedValue(0.92);
  const tooltipY = useSharedValue(10);
  const ringS = useSharedValue(1);
  const ringO = useSharedValue(0);
  const iconS = useSharedValue(0.88);
  // overlayO ne se reset JAMAIS entre steps — reste à 1 tout le tour
  const overlayO = useSharedValue(0);

  const animateTooltipIn = useCallback(() => {
    // Reset les valeurs de départ du tooltip
    tooltipO.value = 0;
    tooltipS.value = 0.92;
    tooltipY.value = 10;
    ringO.value = 0;
    ringS.value = 1;
    iconS.value = 0.88;

    // Anime le tooltip
    tooltipO.value = withTiming(1, { duration: 220 });
    tooltipS.value = withSpring(1, { damping: 18, stiffness: 260 });
    tooltipY.value = withSpring(0, { damping: 20, stiffness: 240 });

    // Ring pulsant autour du spot
    ringO.value = withTiming(1, { duration: 180 });
    ringS.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );

    // Icône pop
    iconS.value = withSpring(1, { damping: 12, stiffness: 280 });
  }, [iconS, ringO, ringS, tooltipO, tooltipS, tooltipY]);

  // ── Réagit au changement de step ─────────────────────────────────────
  // Reset animFiredRef + cache le tooltip jusqu'à ce que le spot soit dispo
  useEffect(() => {
  if (!active || !currentStep) {
    overlayO.value = withTiming(0, { duration: 200 });
    tooltipO.value = withTiming(0, { duration: 160 });
    ringO.value = withTiming(0, { duration: 120 });
    prevStepRef.current = null;
    animFiredRef.current = false;
    return;
  }

  overlayO.value = withTiming(1, { duration: 200 });

  if (prevStepRef.current !== currentStep) {
    prevStepRef.current = currentStep;
    // Reset le flag ICI — pas dans handleNext — pour garantir
    // qu'il est reset APRÈS le changement de step
    animFiredRef.current = false;
    tooltipO.value = 0;
    tooltipS.value = 0.92;
    tooltipY.value = 10;
  }
}, [active, currentStep, overlayO, ringO, tooltipO, tooltipS, tooltipY]);

  // ── Spot courant ───────────────────────────────────────────────────────
  const isTabBarStep = currentStep ? TAB_BAR_STEPS.includes(currentStep) : false;
  const currentRect = currentStep ? (targetRects[currentStep] ?? null) : null;
  const spot = useMemo(
    () => normalizeSpot(currentRect, isTabBarStep),
    [currentRect, isTabBarStep]
  );

  // ── Déclenche animateTooltipIn UNE SEULE FOIS par step dès que spot dispo ──
  useEffect(() => {
  if (!active || !currentStep) return;
  if (animFiredRef.current) return;
  if (!spot) return;

  // Délai minimal pour laisser le rect se stabiliser
  // (évite une animation sur un rect encore en train de bouger)
  const t = setTimeout(() => {
    if (!animFiredRef.current) {
      animFiredRef.current = true;
      animateTooltipIn();
    }
  }, 32);

  return () => clearTimeout(t);
}, [active, currentStep, spot, animateTooltipIn]);

  // ── Animated styles ───────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayO.value }));
  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipO.value,
    transform: [
      { scale: tooltipS.value as number },
      { translateY: tooltipY.value as number },
    ] as any,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringO.value,
    transform: [{ scale: ringS.value as number }] as any,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconS.value as number }] as any,
  }));

  const handleNext = useCallback(async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}

  // Cache le tooltip avec une micro-animation
  tooltipO.value = withTiming(0, { duration: 80 });

  // IMPORTANT : on attend que le tooltip soit invisible AVANT d'appeler
  // onNext() — évite que animFiredRef se reset pendant que l'ancien
  // spot est encore visible → pas de flash
  setTimeout(() => {
    animFiredRef.current = false;
    onNext();
  }, 90);
}, [onNext, tooltipO]);

  const handleSkip = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    onSkip();
  }, [onSkip]);

  if (!active || !currentStep) return null;

  const cfg = STEPS_CONFIG.find((s) => s.id === currentStep);
  if (!cfg) return null;

  const isLast = stepIndex === COACHMARK_STEPS.length - 1;
  const accent = cfg.accent;
  const tooltipWidth = Math.min(SCREEN_W - TOOLTIP_PAD * 2, TOOLTIP_MAX_W);

  // ── Calcul position tooltip ─────────────────────────────────────────────
  const layout = useMemo(() => {
    const centerX = spot ? spot.x + spot.w / 2 : SCREEN_W / 2;
    const left = clampVal(
      centerX - tooltipWidth / 2,
      TOOLTIP_PAD,
      SCREEN_W - TOOLTIP_PAD - tooltipWidth
    );

    let top: number;
    let arrowDirection: "up" | "down" | null = null;

    if (spot) {
      const spaceAbove = spot.y - insets.top - TOOLTIP_GAP;
      const spaceBelow = SCREEN_H - (spot.y + spot.h) - insets.bottom - TOOLTIP_GAP;

      if (spaceAbove >= TOOLTIP_EST_H) {
        // Place le tooltip au-dessus du spot
        top = spot.y - TOOLTIP_EST_H - TOOLTIP_GAP;
        arrowDirection = "down";
      } else if (spaceBelow >= TOOLTIP_EST_H) {
        // Place le tooltip en-dessous du spot
        top = spot.y + spot.h + TOOLTIP_GAP;
        arrowDirection = "up";
      } else {
        // Dernier recours : centré verticalement
        top = SCREEN_H / 2 - TOOLTIP_EST_H / 2;
        arrowDirection = null;
      }

      top = clampVal(
        top,
        insets.top + 8,
        SCREEN_H - insets.bottom - TOOLTIP_EST_H - 8
      );
    } else {
      // Pas de spot (loading) : centré
      top = SCREEN_H / 2 - TOOLTIP_EST_H / 2;
      arrowDirection = null;
    }

    // Position horizontale de la flèche (pointe vers le centre du spot)
    const spotCenterX = spot ? spot.x + spot.w / 2 : SCREEN_W / 2;
    const arrowLeft = clampVal(spotCenterX - left - 11, 20, tooltipWidth - 42);

    return { left, top, arrowDirection, arrowLeft };
  }, [insets.bottom, insets.top, spot, tooltipWidth, SCREEN_H, SCREEN_W]);

  // ── dimRects : 4 rectangles qui assombrissent tout sauf le spot ───────────
  // Utilise SCREEN_H (screen, pas window) pour couvrir tab bar + status bar
  const dimRects = spot
    ? [
        {
          key: "top",
          left: 0,
          top: 0,
          width: SCREEN_W,
          height: Math.max(0, spot.y),
        },
        {
          key: "bottom",
          left: 0,
          top: spot.y + spot.h,
          width: SCREEN_W,
          height: Math.max(0, SCREEN_H - (spot.y + spot.h)),
        },
        {
          key: "left",
          left: 0,
          top: spot.y,
          width: Math.max(0, spot.x),
          height: spot.h,
        },
        {
          key: "right",
          left: spot.x + spot.w,
          top: spot.y,
          width: Math.max(0, SCREEN_W - (spot.x + spot.w)),
          height: spot.h,
        },
      ]
    : [{ key: "full", left: 0, top: 0, width: SCREEN_W, height: SCREEN_H }];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, styles.root, overlayStyle]}
    >
      {/* ── Zones sombres ──────────────────────────────────────────── */}
      {dimRects.map((r) => (
        <Pressable
          key={r.key}
          onPress={handleSkip}
          style={[
            styles.dimRect,
            { left: r.left, top: r.top, width: r.width, height: r.height },
          ]}
        />
      ))}

      {/* ── Zone de spot : cliquable pour avancer ──────────────────── */}
      {spot && (
        <>
          <Pressable
            onPress={handleNext}
            style={{
              position: "absolute",
              left: spot.x,
              top: spot.y,
              width: spot.w,
              height: spot.h,
              borderRadius: spot.br,
              backgroundColor: "transparent",
            }}
          />
          {/* Fond légèrement éclairé dans le spot (sans remplissage opaque) */}
          <View
            pointerEvents="none"
            style={[
              styles.spotBase,
              {
                left: spot.x,
                top: spot.y,
                width: spot.w,
                height: spot.h,
                borderRadius: spot.br,
              },
            ]}
          />
          {/* Ring pulsant autour du spot */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotRing,
              {
                left: spot.x - 6,
                top: spot.y - 6,
                width: spot.w + 12,
                height: spot.h + 12,
                borderRadius: spot.br + 6,
                borderColor: accent,
                shadowColor: accent,
              },
              ringStyle,
            ]}
          />
        </>
      )}

      {/* ── Tooltip ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.tooltip,
          {
            left: layout.left,
            top: layout.top,
            width: tooltipWidth,
          },
          tooltipStyle,
        ]}
      >
        {/* Flèche directionnelle */}
        {layout.arrowDirection && (
          <View
            pointerEvents="none"
            style={[
              styles.arrowWrap,
              layout.arrowDirection === "up"
                ? { top: -11, left: layout.arrowLeft }
                : { bottom: -11, left: layout.arrowLeft },
            ]}
          >
            <View
              style={[
                styles.arrow,
                layout.arrowDirection === "up"
                  ? styles.arrowUp
                  : styles.arrowDown,
              ]}
            />
          </View>
        )}

        {/* Header : icône + progress dots + skip */}
        <View style={styles.headerRow}>
          <Animated.View style={iconStyle}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: `${accent}18`,
                  borderColor: `${accent}40`,
                },
              ]}
            >
              <Ionicons name={cfg.icon as any} size={20} color={accent} />
            </View>
          </Animated.View>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {COACHMARK_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === stepIndex && {
                    width: 22,
                    backgroundColor: accent,
                  },
                  i < stepIndex && {
                    backgroundColor: `${accent}60`,
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity onPress={handleSkip} hitSlop={16}>
            <Text style={styles.skipText}>
              {t("coachmark.skip", { defaultValue: "Passer" })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Text style={styles.title}>
          {t(cfg.titleKey, { defaultValue: cfg.titleDefault })}
        </Text>

        {/* Corps */}
        <Text style={styles.body}>
          {t(cfg.bodyKey, { defaultValue: cfg.bodyDefault })}
        </Text>

        {/* CTA */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleNext}
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[accent, `${accent}D8`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>
              {isLast
                ? t("coachmark.finish", { defaultValue: "C'est parti ! 🔥" })
                : t(cfg.ctaKey, { defaultValue: cfg.ctaDefault })}
            </Text>
            {!isLast && (
              <Ionicons
                name="arrow-forward"
                size={15}
                color="#FFFFFF"
                style={{ marginLeft: 6 }}
              />
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Compteur */}
        <Text style={styles.counter}>
          {stepIndex + 1} / {COACHMARK_STEPS.length}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: "box-none",
  },
  dimRect: {
    position: "absolute",
    backgroundColor: "rgba(3,8,23,0.74)",
  },
  // Fond subtil dans la zone highlight (sans couleur de remplissage)
  spotBase: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  spotRing: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  tooltip: {
    position: "absolute",
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: Platform.OS === "ios" ? 0.13 : 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 22,
  },
  arrowWrap: {
    position: "absolute",
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowUp: {
    borderBottomWidth: 11,
    borderBottomColor: "#FFFFFF",
  },
  arrowDown: {
    borderTopWidth: 11,
    borderTopColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
  },
  dotsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 10,
    marginRight: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.13)",
  },
  skipText: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12,
    color: "rgba(15,23,42,0.44)",
  },
  title: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 17,
    lineHeight: 22,
    color: "#0F172A",
    marginBottom: 8,
  },
  body: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(15,23,42,0.66)",
    marginBottom: 16,
  },
  ctaOuter: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
  },
  ctaInner: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  counter: {
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
    fontSize: 11,
    color: "rgba(15,23,42,0.28)",
  },
});
