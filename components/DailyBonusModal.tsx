// components/DailyBonusModal.tsx
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { DailyRewardResult, DailyRewardType } from "../helpers/dailyBonusService";

// ---- Responsive helpers ----
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BASE_WIDTH = 375;
const SCALE = Math.min(Math.max(SCREEN_WIDTH / BASE_WIDTH, 0.8), 1.4);
const normalize = (size: number) => Math.round(size * SCALE);

// ---- Constantes roue / segments (responsives) ----
const WHEEL_SIZE = normalize(190);
const CENTER_SIZE = normalize(86);
const ICON_SIZE = normalize(24);
const SEGMENT_COUNT = 8;

// ⚖️ POIDS à garder en phase avec dailyBonusService.pickRandomReward
const STREAK_WEIGHT = 40;
const TROPHIES_WEIGHT = 60;

type Deg = `${number}deg`;

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 1er spin */
  onClaim: () => Promise<DailyRewardResult | null>;

  /** Props parent (on les garde pour compat, mais on ne dépend PLUS d'elles pour l'UI) */
  reward: DailyRewardResult | null;
  loading: boolean;

  /** reroll */
  canReroll?: boolean;
  onReroll?: () => Promise<DailyRewardResult | null>;
  rerollLoading?: boolean;
  rerollAdReady?: boolean;
  rerollAdLoading?: boolean;
};

const DailyBonusModal: React.FC<Props> = ({
  visible,
  onClose,
  onClaim,
  reward, // gardé mais on ne s’appuie plus dessus pour l’UI
  loading,
  canReroll = false,
  onReroll,
  rerollLoading = false,
  rerollAdReady = false,
  rerollAdLoading = false,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const spinValue = useRef(new Animated.Value(0)).current;
  const wheelScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
    // ✨ Premium shine (UI only)
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const wheelSheen = useRef(new Animated.Value(0)).current;
    // ✨ Micro celebration (UI only)
  const centerPop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current; // 0 -> 1



  const rewardScale = useRef(new Animated.Value(0.8)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  const [isSpinning, setIsSpinning] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [targetRotation, setTargetRotation] = useState<Deg>("0deg");

  // ✅ IMPORTANT : récompense interne (sinon le parent te “bloque” le state)
  const [localReward, setLocalReward] = useState<DailyRewardResult | null>(null);

  // ✅ lock interne reroll (ne dépend pas du timing du parent)
  const [isRerollingInternal, setIsRerollingInternal] = useState(false);

  // ---- Construction des segments visuels en fonction des poids ----
  const segments = useMemo(() => {
    const totalWeight = STREAK_WEIGHT + TROPHIES_WEIGHT;
    const rawStreak = (STREAK_WEIGHT / totalWeight) * SEGMENT_COUNT;
    let streakSlots = Math.round(rawStreak);

    if (streakSlots < 1) streakSlots = 1;
    if (streakSlots > SEGMENT_COUNT - 1) streakSlots = SEGMENT_COUNT - 1;

    const trophiesSlots = SEGMENT_COUNT - streakSlots;

    const arr: ("streakPass" | "trophies")[] = [];
    for (let i = 0; i < streakSlots; i++) arr.push("streakPass");
    for (let i = 0; i < trophiesSlots; i++) arr.push("trophies");

    return arr;
  }, []);

  // Reset à la fermeture
  useEffect(() => {
    if (!visible) {
      setIsSpinning(false);
      setHasClaimed(false);
      setTargetRotation("0deg");
      setLocalReward(null);
      setIsRerollingInternal(false);

      spinValue.setValue(0);
      rewardScale.setValue(0.8);
      rewardOpacity.setValue(0);
      ctaSheen.setValue(0);
      wheelSheen.setValue(0);
            centerPop.setValue(1);
      burst.setValue(0);

    }
    }, [visible, spinValue, rewardScale, rewardOpacity, ctaSheen, wheelSheen, centerPop, burst]);


  // 🔥 breathing + halo pendant spin
  useEffect(() => {
    if (isSpinning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(wheelScale, {
            toValue: 1.06,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wheelScale, {
            toValue: 1,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.9,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.4,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      pulse.start();
      glow.start();

      return () => {
        pulse.stop();
        glow.stop();
        wheelScale.stopAnimation(() => wheelScale.setValue(1));
        glowOpacity.stopAnimation(() => glowOpacity.setValue(0.4));
      };
    } else {
      wheelScale.stopAnimation(() => wheelScale.setValue(1));
      glowOpacity.stopAnimation(() => glowOpacity.setValue(0.4));
    }
  }, [isSpinning, wheelScale, glowOpacity]);

  // Animation bannière quand localReward est révélée
  useEffect(() => {
    if (hasClaimed && localReward) {
      rewardScale.setValue(0.8);
      rewardOpacity.setValue(0);
            // ✨ Micro celebration: burst + center pop
      centerPop.setValue(0.92);
      burst.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.spring(centerPop, {
            toValue: 1.08,
            friction: 5,
            tension: 160,
            useNativeDriver: true,
          }),
          Animated.spring(centerPop, {
            toValue: 1,
            friction: 6,
            tension: 140,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(burst, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // reset burst for next time (safe)
        burst.setValue(0);
      });

      Animated.parallel([
        Animated.spring(rewardScale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(rewardOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
    }, [hasClaimed, localReward, rewardScale, rewardOpacity, centerPop, burst]);


    // ✨ Shine loop (subtil) — uniquement quand visible
  useEffect(() => {
    if (!visible) return;

    ctaSheen.setValue(0);
    wheelSheen.setValue(0);

    const ctaLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaSheen, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1400),
      ])
    );

    const wheelLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wheelSheen, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    );

    ctaLoop.start();
    wheelLoop.start();

    return () => {
      ctaLoop.stop();
      wheelLoop.stop();
    };
  }, [visible, ctaSheen, wheelSheen]);


  const computeTargetRotation = (type: DailyRewardType): Deg => {
    const matchingIndexes = segments
      .map((segType, index) => (segType === type ? index : -1))
      .filter((i) => i >= 0);

    const baseTurns = 3 + Math.floor(Math.random() * 2); // 3 ou 4 tours
    if (!matchingIndexes.length) {
      const fallbackDeg = baseTurns * 360;
      return `${fallbackDeg}deg` as Deg;
    }

    const chosenIndex =
      matchingIndexes[Math.floor(Math.random() * matchingIndexes.length)];

    const arc = 360 / SEGMENT_COUNT;
    const jitter = (Math.random() - 0.5) * (arc * 0.4);
    const finalDeg = baseTurns * 360 - chosenIndex * arc + jitter;

    return `${finalDeg}deg` as Deg;
  };

  const doSpin = useCallback(
    async (fetchReward: () => Promise<DailyRewardResult | null>) => {
      if (isSpinning) return;

      setIsSpinning(true);
      setHasClaimed(false);
      setLocalReward(null); // ✅ reset UI "récompense" tout de suite
      spinValue.setValue(0);

      try {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}

        const r = await fetchReward();
        if (!r) {
          setIsSpinning(false);
          return;
        }

        const target = computeTargetRotation(r.type);
        setTargetRotation(target);

        Animated.timing(spinValue, {
          toValue: 1,
          duration: 5000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(async () => {
          // ✅ on “révèle” la récompense à la fin du spin
          setLocalReward(r);
          setHasClaimed(true);

          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } catch {}

          setIsSpinning(false);
          setIsRerollingInternal(false);
        });
      } catch {
        setIsSpinning(false);
        setIsRerollingInternal(false);
      }
    },
    [computeTargetRotation, isSpinning, spinValue]
  );

  const startSpin = useCallback(() => {
    if (loading || hasClaimed) return;
    doSpin(onClaim);
  }, [doSpin, onClaim, loading, hasClaimed]);

  const handleRerollPress = useCallback(async () => {
    if (!canReroll || !onReroll) return;
    if (isSpinning || isRerollingInternal || rerollLoading) return;
    if (!rerollAdReady) return;

    setIsRerollingInternal(true);

    // ✅ après la pub, on relance un spin COMPLET avec la nouvelle reward
    await doSpin(onReroll);
  }, [
    canReroll,
    onReroll,
    isSpinning,
    isRerollingInternal,
    rerollLoading,
    rerollAdReady,
    doSpin,
  ]);

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", targetRotation],
  });

  const rewardForText = localReward ?? reward; // fallback si jamais
  let rewardText: string | null = null;
  if (rewardForText) {
    if (rewardForText.type === "streakPass") {
      rewardText = t("dailyBonus.reward.streakPass", { count: rewardForText.amount });
    } else if (rewardForText.type === "trophies") {
      rewardText = t("dailyBonus.reward.trophies", { count: rewardForText.amount });
    }
  }

  const handlePrimaryPress = () => {
    if (isSpinning) return;
    if (hasClaimed) onClose();
    else startSpin();
  };

  const allowBackdropClose = !isSpinning && !rerollLoading && !isRerollingInternal;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (allowBackdropClose) onClose();
        }}
      >
        <View
          style={styles.backdrop}
          accessible
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <LinearGradient
    colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0.62)", "rgba(0,0,0,0.78)"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={StyleSheet.absoluteFillObject}
    pointerEvents="none"
  />
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContainer,
                {
                  paddingBottom: insets.bottom + 16,
                  marginTop: insets.top + 24,
                },
              ]}
            >
              <View style={styles.cardTopGlow} pointerEvents="none" />

              <View style={styles.headerRow}>
  <View style={{ width: 36 }} />
  <View style={styles.headerCenter}>
    <Text style={styles.title}>
      {t("dailyBonus.title", "Bonus du jour")}
    </Text>
  </View>

</View>


              <Text style={styles.subtitle}>
                {hasClaimed
                  ? t("common.congrats", "Bravo !")
                  : t("dailyBonus.subtitle", "Lance la roue mystère pour révéler ta récompense 🎁")}
              </Text>

              {/* --- ROULETTE PREMIUM --- */}
              <View style={styles.wheelWrapper}>
                <Animated.View style={[styles.wheelGlow, { opacity: glowOpacity }]} />
<View style={styles.wheelOuterSoft} pointerEvents="none" />
<Animated.View
  pointerEvents="none"
  style={[
    styles.burstRing,
    {
      opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
      transform: [
        {
          scale: burst.interpolate({
            inputRange: [0, 1],
            outputRange: [0.75, 1.35],
          }),
        },
      ],
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burstRing2,
    {
      opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
      transform: [
        {
          scale: burst.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1.55],
          }),
        },
      ],
    },
  ]}
/>



                <LinearGradient
                  colors={["#FFF6D8", "#FFDCA8", "#FFB86B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.wheelBorder}
                >
                  <Animated.View
  pointerEvents="none"
  style={[
    styles.wheelSheenBand,
    {
      transform: [
        {
          translateX: wheelSheen.interpolate({
            inputRange: [0, 1],
            outputRange: [-WHEEL_SIZE * 0.9, WHEEL_SIZE * 0.9],
          }),
        },
      ],
    },
  ]}
/>

                  <Animated.View
                    style={[
                      styles.wheel,
                      { transform: [{ rotate: rotation }, { scale: wheelScale }] },
                    ]}
                  >
                    <View style={styles.wheelInnerGlow} pointerEvents="none" />
<View style={styles.wheelGloss} pointerEvents="none" />

                    {segments.map((type, index) => {
                      const angle =
                        (index / segments.length) * 2 * Math.PI - Math.PI / 2;
                      const radius = WHEEL_SIZE / 2 - 26;

                      const x = radius * Math.cos(angle);
                      const y = radius * Math.sin(angle);

                      const emoji = type === "streakPass" ? "🎟️" : "🏆";

                      return (
                        <View
                          key={`${type}-${index}`}
                          style={[
                            styles.sliceIcon,
                            { transform: [{ translateX: x }, { translateY: y }] },
                          ]}
                        >
                          <Text style={styles.sliceEmoji}>{emoji}</Text>
                        </View>
                      );
                    })}

                    <Animated.View style={[styles.wheelCenter, { transform: [{ scale: centerPop }] }]}>
                      <Text style={styles.wheelCenterTop}>
                        {t("dailyBonus.centerTop", "SPIN")}
                      </Text>
                      <Text style={styles.wheelCenterBottom}>
                        {t("dailyBonus.centerBottom", "NOW")}
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </LinearGradient>

                <View style={styles.pointer}>
                  <View style={styles.pointerBase} />
                  <View style={styles.pointerTriangle} />
                </View>
              </View>

              {/* --- BANNIÈRE DE RÉCOMPENSE --- */}
              {hasClaimed && localReward && rewardText && (
                <Animated.View
                  style={[
                    styles.rewardBanner,
                    {
                      opacity: rewardOpacity,
                      transform: [{ scale: rewardScale }],
                    },
                  ]}
                >
                  <Text
                    style={styles.rewardBannerTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                  >
                    {localReward.type === "streakPass"
                      ? `🎟️ ${t("dailyBonus.reward.streakPass", { count: localReward.amount })}`
                      : `🏆 ${t("dailyBonus.reward.trophies", { count: localReward.amount })}`}
                  </Text>
                </Animated.View>
              )}

              {/* --- REROLL --- */}
              {hasClaimed && canReroll && !!onReroll && (
                <View style={{ alignItems: "center", marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={handleRerollPress}
                    disabled={
                      isSpinning ||
                      isRerollingInternal ||
                      !rerollAdReady ||
                      rerollLoading
                    }
                    activeOpacity={0.9}
                    style={[
                      styles.rerollButton,
                      (!rerollAdReady || rerollLoading || isRerollingInternal) &&
                        styles.rerollButtonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("dailyBonus.rerollCta", "Regarder une pub pour relancer")}
                    accessibilityHint={t("dailyBonus.rerollHint", "Autorise une seule relance par jour")}
                  >
                    <LinearGradient
                      colors={["#FFE082", "#FFC107", "#FF8F00"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.rerollButtonInner}
                    >
                      <Text style={styles.rerollButtonText}>
                        {rerollLoading || isRerollingInternal
                          ? t("dailyBonus.rerollLoading", "Pub…")
                          : rerollAdReady
                          ? t("dailyBonus.rerollCta", "🎬 Regarder une pub pour relancer")
                          : t("dailyBonus.rerollUnavailable", "Pub en chargement…")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {!rerollAdReady && !rerollAdLoading && (
                    <Text style={styles.rerollSubText}>
                      {t("dailyBonus.rerollTryLater", "Réessaie dans quelques instants.")}
                    </Text>
                  )}
                </View>
              )}

              {/* --- INFO --- */}
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {hasClaimed
                    ? t(
                        "dailyBonus.visualHint",
                        "Ta récompense est ajoutée à ton compte dès que tu lances la roue. Continue ta série pour débloquer encore plus de bonus ✨"
                      )
                    : t("dailyBonus.teaser", "Touche pour découvrir ta récompense mystère.")}
                </Text>
              </View>

              {/* --- BOUTON UNIQUE --- */}
              <View style={styles.buttonsRow}>
                <TouchableOpacity
  style={[
    styles.primaryCta,
    (isSpinning || isRerollingInternal) && styles.buttonDisabled,
  ]}
  onPress={handlePrimaryPress}
  disabled={isSpinning || isRerollingInternal}
  activeOpacity={0.92}
>
  <LinearGradient
    colors={hasClaimed ? ["#FFFFFF", "#F4F4F5"] : ["#FFE082", "#FFC107", "#FF8F00"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.primaryCtaInner}
  >
    <Animated.View
  pointerEvents="none"
  style={[
    styles.primaryCtaSheen,
    {
      transform: [
        {
          translateX: ctaSheen.interpolate({
            inputRange: [0, 1],
            outputRange: [-260, 260],
          }),
        },
        { skewX: "-18deg" as any },
      ],
      opacity: hasClaimed ? 0.12 : 0.28,
    },
  ]}
/>

    <Text style={[styles.primaryButtonText, hasClaimed && styles.primaryButtonTextDark]}>
      {isSpinning
        ? t("dailyBonus.spinning", "Lancement…")
        : hasClaimed
        ? t("dailyBonus.ok", "Super !")
        : t("dailyBonus.cta", "Lancer la roue")}
    </Text>
  </LinearGradient>
</TouchableOpacity>

              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.62)",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 14,
},

modalContainer: {
  width: "100%",
  maxWidth: 420,
  borderRadius: 30,
  paddingHorizontal: 18,
  paddingTop: 14,
  backgroundColor: "rgba(255,255,255,0.06)", // + clair / glass
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
  overflow: "hidden",
  shadowColor: "#000",
  shadowOpacity: 0.24,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 18 },
  elevation: 12,
},

  // ---- Header ----
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingTop: 2,
  },
  headerCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
title: {
  fontSize: normalize(20),
  color: "#fff",
  textAlign: "center",
  fontFamily: "Comfortaa_700Bold",
  includeFontPadding: false,
},
closeBtn: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
},
  burstRing: {
    position: "absolute",
    width: CENTER_SIZE + normalize(54),
    height: CENTER_SIZE + normalize(54),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  burstRing2: {
    position: "absolute",
    width: CENTER_SIZE + normalize(78),
    height: CENTER_SIZE + normalize(78),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,220,168,0.22)",
    backgroundColor: "rgba(255,220,168,0.05)",
  },
  closeBtnDisabled: { opacity: 0.45 },
  closeBtnText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },

  subtitle: {
    fontSize: normalize(13),
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
    marginBottom: 14,
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalize(18),
  },

  // ---- Wheel ----
  wheelWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
wheelGlow: {
  position: "absolute",
  width: WHEEL_SIZE + 64,
  height: WHEEL_SIZE + 64,
  borderRadius: 999,
  backgroundColor: "rgba(255, 224, 160, 0.14)",
},

wheelBorder: {
  width: WHEEL_SIZE,
  height: WHEEL_SIZE,
  borderRadius: WHEEL_SIZE / 2,
  padding: 9,
  justifyContent: "center",
  alignItems: "center",
  shadowColor: "#FFD08A",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.20,
  shadowRadius: 22,
  elevation: 10,
},

wheel: {
  width: "100%",
  height: "100%",
  borderRadius: WHEEL_SIZE / 2,
  backgroundColor: "rgba(255,255,255,0.06)", // + clair
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},

  sliceIcon: {
    position: "absolute",
    width: ICON_SIZE + normalize(8),
    height: ICON_SIZE + normalize(8),
    justifyContent: "center",
    alignItems: "center",
  },

  sliceEmoji: {
    fontSize: normalize(24),
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  wheelCenterTop: {
    fontSize: normalize(12),
    color: "#111",
    letterSpacing: 1.6,
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
  wheelCenterBottom: {
    marginTop: 2,
    fontSize: normalize(12),
    color: "#111",
    letterSpacing: 1.6,
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
  cardTopGlow: {
  position: "absolute",
  left: -40,
  right: -40,
  top: -80,
  height: 160,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.10)",
  transform: [{ rotate: "-8deg" }],
},

wheelOuterSoft: {
  position: "absolute",
  width: WHEEL_SIZE + 92,
  height: WHEEL_SIZE + 92,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.03)",
},

wheelInnerGlow: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.04)",
},

wheelGloss: {
  position: "absolute",
  left: -WHEEL_SIZE * 0.1,
  top: -WHEEL_SIZE * 0.12,
  width: WHEEL_SIZE * 1.2,
  height: WHEEL_SIZE * 0.55,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.10)",
  transform: [{ rotate: "-12deg" }],
},

wheelSheenBand: {
  position: "absolute",
  top: -12,
  bottom: -12,
  width: WHEEL_SIZE * 0.42,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.16)",
  opacity: 0.35,
},


  // Center gradient (applied by nesting a gradient in JSX? no: we keep simple)
  // We’ll fake “center glass” with background + shadow:
  wheelCenter: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: "#FFE97D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFCA28",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },

  // ---- Pointer ----
  pointer: {
    position: "absolute",
    top: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  pointerBase: {
    width: normalize(26),
    height: normalize(26),
    borderRadius: normalize(13),
    backgroundColor: "rgba(5,7,18,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(255,224,130,0.92)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },

  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: normalize(9),
    borderRightWidth: normalize(9),
    borderBottomWidth: normalize(14),
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFC107",
    marginTop: 3,
    transform: [{ translateY: -1 }],
  },

  // ---- Reward banner ----
  rewardBanner: {
    marginTop: 2,
    marginBottom: 10,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    maxWidth: "92%",
  },

  rewardBannerTitle: {
    color: "#FFFFFF",
    fontSize: normalize(14),
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },

  // ---- Reroll ----
  rerollButton: {
    marginTop: 6,
    borderRadius: 999,
    overflow: "hidden",
    width: "92%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  rerollButtonInner: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  rerollButtonText: {
    color: "#111",
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    includeFontPadding: false,
  },

  rerollButtonDisabled: { opacity: 0.55 },

  rerollSubText: {
    marginTop: 6,
    fontSize: normalize(11),
    color: "rgba(255,255,255,0.60)",
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    lineHeight: normalize(16),
  },

  // ---- Info box ----
  infoBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  infoText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: normalize(12.5),
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalize(18),
  },

  // ---- Buttons ----
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 2,
  },

  primaryCta: {
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  primaryCtaInner: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
primaryCtaSheen: {
  position: "absolute",
  left: -120,
  top: 0,
  bottom: 0,
  width: 160,
  backgroundColor: "rgba(255,255,255,0.28)",
},
  primaryButtonText: {
    color: "#111",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
  primaryButtonTextDark: {
    color: "#111",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});


export default DailyBonusModal;
