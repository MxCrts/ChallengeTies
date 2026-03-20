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
import Svg, { Path, Line, Circle, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { DailyRewardResult, DailyRewardType } from "../helpers/dailyBonusService";

// ── Responsive ──────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCALE = Math.min(Math.max(SCREEN_WIDTH / 375, 0.8), 1.4);
const n = (size: number) => Math.round(size * SCALE);

const WHEEL_SIZE    = n(220);
const CENTER_R      = n(36);
const SEGMENT_COUNT = 8;
const STREAK_WEIGHT = 40;
const TROPHIES_WEIGHT = 60;

type Deg = `${number}deg`;

// ── Roue SVG ─────────────────────────────────────────────────────────────────
const WheelSVG = React.memo(({ segments, size }: { segments: ("streakPass"|"trophies")[]; size: number }) => {
  const R     = size / 2;
  const count = segments.length;
  const slice = (2 * Math.PI) / count;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={R} cy={R} r={R} fill="#0F172A" />
      {segments.map((_, i) => {
        const a0 = i * slice - Math.PI / 2;
        const a1 = a0 + slice;
        const x1 = R + R * Math.cos(a0);
        const y1 = R + R * Math.sin(a0);
        const x2 = R + R * Math.cos(a1);
        const y2 = R + R * Math.sin(a1);
        const fill = i % 2 === 0 ? "rgba(249,115,22,0.20)" : "rgba(249,115,22,0.04)";
        return (
          <Path
            key={`seg-${i}`}
            d={`M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
            fill={fill}
          />
        );
      })}
      {segments.map((_, i) => {
        const a = i * slice - Math.PI / 2;
        return (
          <Line
            key={`sep-${i}`}
            x1={R} y1={R}
            x2={R + R * Math.cos(a)} y2={R + R * Math.sin(a)}
            stroke="rgba(249,115,22,0.30)" strokeWidth="1"
          />
        );
      })}
      <Circle cx={R} cy={R} r={R - 0.5} fill="none" stroke="rgba(249,115,22,0.12)" strokeWidth="1" />
    </Svg>
  );
});

// ── Props ────────────────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  onClaim: () => Promise<DailyRewardResult | null>;
  reward: DailyRewardResult | null;
  loading: boolean;
  canReroll?: boolean;
  onReroll?: () => Promise<DailyRewardResult | null>;
  rerollLoading?: boolean;
  rerollAdReady?: boolean;
  rerollAdLoading?: boolean;
};

// ── Composant ────────────────────────────────────────────────────────────────
const DailyBonusModal: React.FC<Props> = ({
  visible, onClose, onClaim, reward, loading,
  canReroll = false, onReroll,
  rerollLoading = false, rerollAdReady = false, rerollAdLoading = false,
}) => {
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();

  // Animated values
  const spinValue    = useRef(new Animated.Value(0)).current;
  const wheelScale   = useRef(new Animated.Value(1)).current;
  const glowOpacity  = useRef(new Animated.Value(0.5)).current;
  const ctaSheen     = useRef(new Animated.Value(0)).current;
  const centerPop    = useRef(new Animated.Value(1)).current;
  const burst        = useRef(new Animated.Value(0)).current;
  const rewardScale  = useRef(new Animated.Value(0.8)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;
  const ringPulse    = useRef(new Animated.Value(0)).current;

  // State
  const [isSpinning,          setIsSpinning]          = useState(false);
  const [hasClaimed,          setHasClaimed]          = useState(false);
  const [targetRotation,      setTargetRotation]      = useState<Deg>("0deg");
  const [localReward,         setLocalReward]         = useState<DailyRewardResult | null>(null);
  const [isRerollingInternal, setIsRerollingInternal] = useState(false);

  // Segments
  const segments = useMemo(() => {
    const total = STREAK_WEIGHT + TROPHIES_WEIGHT;
    let s = Math.round((STREAK_WEIGHT / total) * SEGMENT_COUNT);
    s = Math.max(1, Math.min(SEGMENT_COUNT - 1, s));
    const arr: ("streakPass"|"trophies")[] = [];
    for (let i = 0; i < s; i++)                arr.push("streakPass");
    for (let i = 0; i < SEGMENT_COUNT - s; i++) arr.push("trophies");
    return arr;
  }, []);

  // Emoji positions calculées
  const emojiOverlay = useMemo(() => {
    const slice = (2 * Math.PI) / SEGMENT_COUNT;
    const wSize = WHEEL_SIZE - n(10);
    const R     = wSize / 2;
    const iconR = R * 0.65;
    return segments.map((type, i) => {
      const mid = (i + 0.5) * slice - Math.PI / 2;
      return {
        emoji: type === "streakPass" ? "🎟️" : "🏆",
        left: R + iconR * Math.cos(mid) - n(11),
        top:  R + iconR * Math.sin(mid) - n(11),
      };
    });
  }, [segments]);

  // Reset
  useEffect(() => {
    if (!visible) {
      setIsSpinning(false); setHasClaimed(false); setTargetRotation("0deg");
      setLocalReward(null); setIsRerollingInternal(false);
      [spinValue, rewardScale, rewardOpacity, ctaSheen, centerPop, burst, ringPulse]
        .forEach(v => v.setValue(0));
      rewardScale.setValue(0.8); centerPop.setValue(1);
    }
  }, [visible]);

  // Ring pulse idle
  useEffect(() => {
    if (!visible || isSpinning || hasClaimed) { ringPulse.stopAnimation(); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, isSpinning, hasClaimed]);

  // Spin breathing
  useEffect(() => {
    if (!isSpinning) {
      wheelScale.stopAnimation(() => wheelScale.setValue(1));
      glowOpacity.stopAnimation(() => glowOpacity.setValue(0.5));
      return;
    }
    const p = Animated.loop(Animated.sequence([
      Animated.timing(wheelScale,  { toValue: 1.05, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wheelScale,  { toValue: 1,    duration: 240, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]));
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 1,   duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0.5, duration: 240, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]));
    p.start(); g.start();
    return () => { p.stop(); g.stop(); };
  }, [isSpinning]);

  // Reward reveal
  useEffect(() => {
    if (!hasClaimed || !localReward) return;
    rewardScale.setValue(0.8); rewardOpacity.setValue(0);
    centerPop.setValue(0.92); burst.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(centerPop, { toValue: 1.12, friction: 5, tension: 160, useNativeDriver: true }),
        Animated.spring(centerPop, { toValue: 1,    friction: 6, tension: 140, useNativeDriver: true }),
      ]),
      Animated.timing(burst, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => burst.setValue(0));
    Animated.parallel([
      Animated.spring(rewardScale,   { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(rewardOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [hasClaimed, localReward]);

  // CTA shine
  useEffect(() => {
    if (!visible) return;
    ctaSheen.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ctaSheen, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1800),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // Spin logic
  const computeTarget = useCallback((type: DailyRewardType): Deg => {
    const matching = segments.map((s, i) => s === type ? i : -1).filter(i => i >= 0);
    const base = 3 + Math.floor(Math.random() * 2);
    if (!matching.length) return `${base * 360}deg` as Deg;
    const chosen = matching[Math.floor(Math.random() * matching.length)];
    const arc = 360 / SEGMENT_COUNT;
    const jitter = (Math.random() - 0.5) * arc * 0.4;
    return `${base * 360 - chosen * arc + jitter}deg` as Deg;
  }, [segments]);

  const doSpin = useCallback(async (fetch: () => Promise<DailyRewardResult | null>) => {
    if (isSpinning) return;
    setIsSpinning(true); setHasClaimed(false); setLocalReward(null);
    spinValue.setValue(0);
    try {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      const r = await fetch();
      if (!r) { setIsSpinning(false); return; }
      setTargetRotation(computeTarget(r.type));
      Animated.timing(spinValue, { toValue: 1, duration: 5000, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(async () => {
          setLocalReward(r); setHasClaimed(true);
          try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
          setIsSpinning(false); setIsRerollingInternal(false);
        });
    } catch { setIsSpinning(false); setIsRerollingInternal(false); }
  }, [isSpinning, spinValue, computeTarget]);

  const startSpin = useCallback(() => { if (!loading && !hasClaimed) doSpin(onClaim); }, [doSpin, onClaim, loading, hasClaimed]);

  const handleReroll = useCallback(async () => {
    if (!canReroll || !onReroll || isSpinning || isRerollingInternal || rerollLoading || !rerollAdReady) return;
    setIsRerollingInternal(true);
    await doSpin(onReroll);
  }, [canReroll, onReroll, isSpinning, isRerollingInternal, rerollLoading, rerollAdReady, doSpin]);

  const rotation = spinValue.interpolate({ inputRange: [0, 1], outputRange: ["0deg", targetRotation] });
  const rewardForText = localReward ?? reward;
  const handlePrimary = () => { if (!isSpinning) { if (hasClaimed) onClose(); else startSpin(); } };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={() => { if (!isSpinning && !rerollLoading && !isRerollingInternal) onClose(); }}>
        <View style={s.backdrop} accessible accessibilityViewIsModal>

          <LinearGradient
            colors={["rgba(2,6,23,0.92)", "rgba(15,23,42,0.88)", "rgba(2,6,23,0.92)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject} pointerEvents="none"
          />
          <Animated.View pointerEvents="none" style={[s.ambientGlow, { opacity: glowOpacity }]} />

          <TouchableWithoutFeedback>
            <View style={[s.card, { paddingBottom: insets.bottom + n(20), marginTop: insets.top + n(16) }]}>

              <LinearGradient
                colors={["rgba(249,115,22,0.18)", "rgba(249,115,22,0.00)"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={s.cardTopGlow} pointerEvents="none"
              />

              {/* Header */}
              <View style={s.headerRow}>
                <View style={{ width: n(36) }} />
                <View style={s.headerCenter}>
                  <View style={s.badge}>
                    <Text style={s.badgeEmoji}>🎁</Text>
                    <Text style={s.badgeText}>{t("dailyBonus.title", "Bonus du jour")}</Text>
                  </View>
                </View>
                <View style={{ width: n(36) }} />
              </View>

              <Text style={s.subtitle}>
                {hasClaimed ? t("common.congrats", "Félicitations !") : t("dailyBonus.subtitle", "Lance la roue pour révéler ta récompense")}
              </Text>

              {/* Roue */}
              <View style={s.wheelWrapper}>
                {/* Anneaux pulsants */}
                <Animated.View style={[s.ringOuter, {
                  opacity:   ringPulse.interpolate({ inputRange: [0,1], outputRange: [0.06, 0.20] }),
                  transform: [{ scale: ringPulse.interpolate({ inputRange: [0,1], outputRange: [1, 1.04] }) }],
                }]} pointerEvents="none" />
                <Animated.View style={[s.ringMid, {
                  opacity:   ringPulse.interpolate({ inputRange: [0,1], outputRange: [0.10, 0.25] }),
                  transform: [{ scale: ringPulse.interpolate({ inputRange: [0,1], outputRange: [0.96, 1] }) }],
                }]} pointerEvents="none" />

                {/* Burst */}
                <Animated.View pointerEvents="none" style={[s.burstA, {
                  opacity:   burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0] }),
                  transform: [{ scale: burst.interpolate({ inputRange: [0,1], outputRange: [0.7, 1.5] }) }],
                }]} />
                <Animated.View pointerEvents="none" style={[s.burstB, {
                  opacity:   burst.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 0] }),
                  transform: [{ scale: burst.interpolate({ inputRange: [0,1], outputRange: [0.5, 1.7] }) }],
                }]} />

                {/* Bordure orange */}
                <LinearGradient
                  colors={["#F97316", "#FB923C", "#FDBA74", "#F97316"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.wheelBorder}
                >
                  <Animated.View style={{ transform: [{ rotate: rotation }, { scale: wheelScale }] }}>
                    <View style={s.wheelInner}>
                      {/* SVG parfait */}
                      <WheelSVG segments={segments} size={WHEEL_SIZE - n(10)} />

                      {/* Emojis par calcul trigonométrique */}
                      {emojiOverlay.map((item, i) => (
                        <View key={`e-${i}`} pointerEvents="none" style={[s.emojiWrap, { left: item.left, top: item.top }]}>
                          <Text style={s.emoji}>{item.emoji}</Text>
                        </View>
                      ))}

                      {/* Gloss */}
                      <View style={s.gloss} pointerEvents="none" />

                      {/* Centre */}
                      <Animated.View style={[s.center, { transform: [{ scale: centerPop }] }]}>
                        <LinearGradient
                          colors={hasClaimed ? ["#F97316", "#EA6C0A"] : ["#1E293B", "#0F172A"]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={s.centerGrad}
                        >
                          <LinearGradient
                            colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
                            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                            style={StyleSheet.absoluteFill} pointerEvents="none"
                          />
                          {hasClaimed
                            ? <Text style={s.centerEmoji}>✨</Text>
                            : <>
                                <Text style={s.centerTop}>{t("dailyBonus.centerTop", "SPIN")}</Text>
                                <Text style={s.centerBot}>{t("dailyBonus.centerBottom", "NOW")}</Text>
                              </>}
                        </LinearGradient>
                      </Animated.View>
                    </View>
                  </Animated.View>
                </LinearGradient>

                {/* Pointeur */}
                <View style={s.pointer}>
                  <LinearGradient colors={["#F97316", "#EA6C0A"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.ptBase} />
                  <View style={s.ptTri} />
                </View>
              </View>

              {/* Récompense */}
              {hasClaimed && localReward && (
                <Animated.View style={[s.rewardBanner, { opacity: rewardOpacity, transform: [{ scale: rewardScale }] }]}>
                  <LinearGradient
                    colors={["rgba(249,115,22,0.22)", "rgba(249,115,22,0.08)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.rewardInner}
                  >
                    <Text style={s.rewardTxt}>
                      {localReward.type === "streakPass"
                        ? `🎟️ ${t("dailyBonus.reward.streakPass", { count: localReward.amount })}`
                        : `🏆 ${t("dailyBonus.reward.trophies",   { count: localReward.amount })}`}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              )}

              {/* Reroll */}
              {hasClaimed && canReroll && !!onReroll && (
                <View style={{ alignItems: "center", marginTop: n(8) }}>
                  <TouchableOpacity
                    onPress={handleReroll}
                    disabled={isSpinning || isRerollingInternal || !rerollAdReady || rerollLoading}
                    activeOpacity={0.88}
                    style={[s.rerollBtn, (!rerollAdReady || rerollLoading || isRerollingInternal) && s.dimmed]}
                  >
                    <View style={s.rerollInner}>
                      <Text style={s.rerollTxt}>
                        {(rerollLoading || isRerollingInternal)
                          ? t("dailyBonus.rerollLoading", "Pub…")
                          : rerollAdReady
                          ? t("dailyBonus.rerollCta", "🎬 Regarder une pub pour relancer")
                          : t("dailyBonus.rerollUnavailable", "Pub en chargement…")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {!rerollAdReady && !rerollAdLoading && (
                    <Text style={s.rerollSub}>{t("dailyBonus.rerollTryLater", "Réessaie dans quelques instants.")}</Text>
                  )}
                </View>
              )}

              {/* Info */}
              <View style={s.infoBox}>
                <Text style={s.infoTxt}>
                  {hasClaimed
                    ? t("dailyBonus.visualHint", "Ta récompense est ajoutée à ton compte. Continue ta série pour débloquer encore plus ✨")
                    : t("dailyBonus.teaser", "Touche pour découvrir ta récompense mystère.")}
                </Text>
              </View>

              {/* CTA */}
              <View style={s.ctaRow}>
                <TouchableOpacity
                  style={[s.cta, (isSpinning || isRerollingInternal) && s.dimmed]}
                  onPress={handlePrimary}
                  disabled={isSpinning || isRerollingInternal}
                  activeOpacity={0.90}
                >
                  <LinearGradient
                    colors={hasClaimed ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"] : ["#F97316", "#EA6C0A"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.ctaGrad}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.00)"]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: n(999) }]} pointerEvents="none"
                    />
                    {!hasClaimed && (
                      <Animated.View pointerEvents="none" style={[s.ctaSheen, {
                        transform: [
                          { translateX: ctaSheen.interpolate({ inputRange: [0,1], outputRange: [-n(280), n(280)] }) },
                          { skewX: "-18deg" as any },
                        ],
                      }]} />
                    )}
                    <Text style={[s.ctaTxt, hasClaimed && s.ctaTxtDim]}>
                      {isSpinning ? t("dailyBonus.spinning", "Lancement…")
                        : hasClaimed ? t("dailyBonus.ok", "Super, merci !")
                        : t("dailyBonus.cta", "Lancer la roue 🎯")}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: n(16) },
  ambientGlow: {
    position: "absolute", width: SCREEN_WIDTH * 1.4, height: SCREEN_WIDTH * 1.4,
    borderRadius: SCREEN_WIDTH, backgroundColor: "rgba(249,115,22,0.10)",
    top: "15%", alignSelf: "center",
  },
  card: {
    width: "100%", maxWidth: 420, borderRadius: n(28),
    paddingHorizontal: n(18), paddingTop: n(16),
    backgroundColor: "rgba(15,23,42,0.94)",
    borderWidth: 1, borderColor: "rgba(249,115,22,0.22)", overflow: "hidden",
  },
  cardTopGlow: { position: "absolute", left: 0, right: 0, top: 0, height: n(80) },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: n(8) },
  headerCenter: { flex: 1, alignItems: "center" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: n(6),
    paddingHorizontal: n(14), paddingVertical: n(6), borderRadius: n(999),
    borderWidth: 1, borderColor: "rgba(249,115,22,0.30)", backgroundColor: "rgba(249,115,22,0.10)",
  },
  badgeEmoji: { fontSize: n(15) },
  badgeText: { fontSize: n(14), color: "#F8FAFC", fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  subtitle: {
    fontSize: n(12.5), color: "rgba(226,232,240,0.65)", textAlign: "center",
    marginBottom: n(16), fontFamily: "Comfortaa_400Regular", lineHeight: n(17),
  },

  wheelWrapper: { alignItems: "center", justifyContent: "center", marginBottom: n(16) },
  ringOuter: {
    position: "absolute", width: WHEEL_SIZE + n(56), height: WHEEL_SIZE + n(56),
    borderRadius: n(999), borderWidth: 1, borderColor: "#F97316",
  },
  ringMid: {
    position: "absolute", width: WHEEL_SIZE + n(28), height: WHEEL_SIZE + n(28),
    borderRadius: n(999), borderWidth: 1, borderColor: "#F97316",
  },
  burstA: {
    position: "absolute", width: CENTER_R * 2 + n(60), height: CENTER_R * 2 + n(60),
    borderRadius: n(999), borderWidth: 1.5, borderColor: "rgba(249,115,22,0.65)",
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  burstB: {
    position: "absolute", width: CENTER_R * 2 + n(90), height: CENTER_R * 2 + n(90),
    borderRadius: n(999), borderWidth: 1, borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "rgba(249,115,22,0.03)",
  },
  wheelBorder: {
    width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2,
    padding: n(5), justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  wheelInner: {
    width: WHEEL_SIZE - n(10), height: WHEEL_SIZE - n(10),
    borderRadius: (WHEEL_SIZE - n(10)) / 2,
    overflow: "hidden", justifyContent: "center", alignItems: "center",
  },
  emojiWrap: { position: "absolute", width: n(22), height: n(22), justifyContent: "center", alignItems: "center" },
  emoji: { fontSize: n(17), textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  gloss: {
    position: "absolute", left: -(WHEEL_SIZE * 0.1), top: -(WHEEL_SIZE * 0.08),
    width: WHEEL_SIZE * 1.2, height: WHEEL_SIZE * 0.32,
    borderRadius: n(999), backgroundColor: "rgba(255,255,255,0.07)",
    transform: [{ rotate: "-12deg" }],
  },
  center: {
    position: "absolute", width: CENTER_R * 2, height: CENTER_R * 2,
    borderRadius: CENTER_R, overflow: "hidden",
    borderWidth: 2, borderColor: "rgba(249,115,22,0.55)",
  },
  centerGrad: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerTop: { fontSize: n(11), color: "#F8FAFC", letterSpacing: 2, fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  centerBot: { marginTop: n(2), fontSize: n(11), color: "#F97316", letterSpacing: 2, fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  centerEmoji: { fontSize: n(26) },

  pointer: { position: "absolute", top: n(2), alignItems: "center", justifyContent: "center" },
  ptBase: { width: n(22), height: n(22), borderRadius: n(11), borderWidth: 1.5, borderColor: "rgba(255,255,255,0.30)" },
  ptTri: {
    width: 0, height: 0, borderLeftWidth: n(7), borderRightWidth: n(7), borderBottomWidth: n(11),
    borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#F97316", marginTop: n(2),
  },

  rewardBanner: {
    marginTop: n(2), marginBottom: n(10), alignSelf: "center",
    borderRadius: n(16), overflow: "hidden", borderWidth: 1,
    borderColor: "rgba(249,115,22,0.38)", maxWidth: "92%",
  },
  rewardInner: { paddingHorizontal: n(20), paddingVertical: n(12), alignItems: "center" },
  rewardTxt: { color: "#F8FAFC", fontSize: n(14), textAlign: "center", fontFamily: "Comfortaa_700Bold", includeFontPadding: false },

  rerollBtn: {
    marginTop: n(4), borderRadius: n(999), overflow: "hidden", width: "92%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)",
  },
  rerollInner: { paddingVertical: n(10), paddingHorizontal: n(14), alignItems: "center" },
  rerollTxt: { color: "rgba(226,232,240,0.80)", fontSize: n(12.5), fontFamily: "Comfortaa_700Bold", textAlign: "center", includeFontPadding: false },
  rerollSub: { marginTop: n(5), fontSize: n(11), color: "rgba(255,255,255,0.45)", fontFamily: "Comfortaa_400Regular", textAlign: "center" },

  infoBox: { marginTop: n(8), padding: n(12), borderRadius: n(16), backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  infoTxt: { color: "rgba(226,232,240,0.65)", fontSize: n(11.5), textAlign: "center", fontFamily: "Comfortaa_400Regular", lineHeight: n(16) },

  ctaRow: { marginTop: n(14), marginBottom: n(4) },
  cta: { width: "100%", borderRadius: n(999), overflow: "hidden" },
  ctaGrad: { paddingVertical: n(14), paddingHorizontal: n(18), alignItems: "center", justifyContent: "center", minHeight: n(50) },
  ctaSheen: { position: "absolute", left: -n(120), top: 0, bottom: 0, width: n(140), backgroundColor: "rgba(255,255,255,0.22)" },
  ctaTxt: { color: "#FFFFFF", fontSize: n(14.5), fontFamily: "Comfortaa_700Bold", includeFontPadding: false, letterSpacing: 0.2 },
  ctaTxtDim: { color: "rgba(226,232,240,0.75)" },
  dimmed: { opacity: 0.48 },
});

export default DailyBonusModal;
