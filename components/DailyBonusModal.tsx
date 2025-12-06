// components/DailyBonusModal.tsx
import React, { useRef, useState, useEffect, useMemo } from "react";
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
// Actuel dans le service : 40% streakPass / 60% trophies
const STREAK_WEIGHT = 40;
const TROPHIES_WEIGHT = 60;

  type Deg = `${number}deg`;

type Props = {
  visible: boolean;
  onClose: () => void;
  onClaim: () => Promise<DailyRewardResult | null>;
  reward: DailyRewardResult | null;
  loading: boolean;

  // ✅ reroll
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
  reward,
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
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [targetRotation, setTargetRotation] = useState<Deg>("0deg");
    // Effet "breathing" de la roue + halo pendant le spin
  const wheelScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;



  // ⭐ Animation de la bannière de récompense
  const rewardScale = useRef(new Animated.Value(0.8)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  // ---- Construction des segments visuels en fonction des poids ----
  const segments = useMemo(() => {
    const totalWeight = STREAK_WEIGHT + TROPHIES_WEIGHT;
    const rawStreak = (STREAK_WEIGHT / totalWeight) * SEGMENT_COUNT;
    let streakSlots = Math.round(rawStreak);

    // on s'assure d'avoir au moins 1 segment de chaque type
    if (streakSlots < 1) streakSlots = 1;
    if (streakSlots > SEGMENT_COUNT - 1) streakSlots = SEGMENT_COUNT - 1;

    const trophiesSlots = SEGMENT_COUNT - streakSlots;

    const arr: ("streakPass" | "trophies")[] = [];
    for (let i = 0; i < streakSlots; i++) arr.push("streakPass");
    for (let i = 0; i < trophiesSlots; i++) arr.push("trophies");

    return arr;
  }, []);

  // Reset à l’ouverture
  useEffect(() => {
    if (!visible) {
      setIsSpinning(false);
      setHasClaimed(false);
      spinValue.setValue(0);
      rewardScale.setValue(0.8);
      rewardOpacity.setValue(0);
    }
  }, [visible, spinValue, rewardScale, rewardOpacity]);

    // 🔥 TOP 3 MONDE : la roue "respire" et le halo pulse pendant le spin
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
      // Quand le spin s'arrête ou que le modal se ferme : on revient à neutre
      wheelScale.stopAnimation(() => wheelScale.setValue(1));
      glowOpacity.stopAnimation(() => glowOpacity.setValue(0.4));
    }
  }, [isSpinning, wheelScale, glowOpacity]);


  // Lance l’animation de la bannière quand la récompense est là
  useEffect(() => {
    if (hasClaimed && reward) {
      rewardScale.setValue(0.8);
      rewardOpacity.setValue(0);
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
  }, [hasClaimed, reward, rewardScale, rewardOpacity]);

  // 🔥 Calcule la rotation finale pour que le pointeur tombe sur
  // un segment qui correspond EXACTEMENT au type de récompense.
  const computeTargetRotation = (type: DailyRewardType): Deg => {
    // Liste des index de segments qui matchent le type demandé
    const matchingIndexes = segments
      .map((segType, index) => (segType === type ? index : -1))
      .filter((i) => i >= 0);

    // Sécurité : si pour une raison quelconque il n'y a pas de match,
    // on fait juste 3 tours complets.
    const baseTurns = 3 + Math.floor(Math.random() * 2); // 3 ou 4 tours
    if (!matchingIndexes.length) {
      const fallbackDeg = baseTurns * 360;
      return `${fallbackDeg}deg` as Deg;
    }

    // On choisit un des segments du bon type (aléatoire pour éviter la répétition)
    const chosenIndex =
      matchingIndexes[Math.floor(Math.random() * matchingIndexes.length)];

    const arc = 360 / SEGMENT_COUNT;

    // On ajoute un léger jitter à l'intérieur du même segment
    const jitter = (Math.random() - 0.5) * (arc * 0.4); // ±40% de l'arc

    // 🎯 Formule :
    // - à rotation 0, le segment index 0 est sous le pointeur
    // - chaque arc de 360/SEGMENT_COUNT déplace le pointeur d'un segment
    // - donc pour tomber sur l'index `chosenIndex` :
    //   rotation ≈ baseTurns*360 - chosenIndex*arc (avec petit jitter)
    const finalDeg = baseTurns * 360 - chosenIndex * arc + jitter;

    return `${finalDeg}deg` as Deg;
  };



  const startSpin = async () => {
  if (isSpinning || loading || hasClaimed) return;

  setIsSpinning(true);
  setHasClaimed(false);
  spinValue.setValue(0);

  try {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // 1️⃣ On récupère d'abord la récompense (le serveur décide)
    const r = await onClaim();
    if (!r) {
      setIsSpinning(false);
      return;
    }

    // 2️⃣ On calcule l'angle final cohérent avec le type de reward
    const target = computeTargetRotation(r.type);
    setTargetRotation(target);

    // 3️⃣ On lance la rotation longue (~5s) jusqu'à cet angle précis
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 5000, // 🔥 plus long = plus épique
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      // 4️⃣ Fin du spin → on révèle la récompense visuelle
      setHasClaimed(true);

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}

      setIsSpinning(false);
    });
  } catch (e) {
    // en cas d'erreur dans onClaim : on laisse l'index gérer l'Alert
    setIsSpinning(false);
  }
};


  const rotation = spinValue.interpolate({
  inputRange: [0, 1],
  outputRange: ["0deg", targetRotation], // 🔥 cible dynamique par spin
});

  /** Texte final selon la récompense (pour l’accessibilité / fallback) */
  let rewardText: string | null = null;

  if (reward) {
    if (reward.type === "streakPass") {
      rewardText = t("dailyBonus.reward.streakPass", { count: reward.amount });
    } else if (reward.type === "trophies") {
      rewardText = t("dailyBonus.reward.trophies", { count: reward.amount });
    }
  }

  const handlePrimaryPress = () => {
    if (isSpinning) return;
    if (hasClaimed) {
      onClose();
    } else {
      startSpin();
    }
  };

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
          // 🔒 on ne ferme pas pendant le spin ou la relance
          if (!isSpinning && !rerollLoading) onClose();
        }}
      >
        <View
          style={styles.backdrop}
          accessible
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <TouchableWithoutFeedback>
            {/* bloque la propagation */}
            <View
              style={[
                styles.modalContainer,
                {
                  paddingBottom: insets.bottom + 16,
                  marginTop: insets.top + 24,
                },
              ]}
            >
              <Text style={styles.title}>
                {t("dailyBonus.title", "Bonus du jour")}
              </Text>

              <Text style={styles.subtitle}>
                {hasClaimed
                  ? t("common.congrats", "Bravo !")
                  : t(
                      "dailyBonus.subtitle",
                      "Lance la roue mystère pour révéler ta récompense 🎁"
                    )}
              </Text>

              {/* --- ROULETTE PREMIUM --- */}
              <View style={styles.wheelWrapper}>
                {/* Halo externe */}
                <Animated.View style={[styles.wheelGlow, { opacity: glowOpacity }]} />


                {/* Bord doré + roue animée */}
                <LinearGradient
  colors={["#FFE082", "#FFC107", "#FF6F00"]} // 🌈 or bien vif
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.wheelBorder}
>
                  <Animated.View
  style={[
    styles.wheel,
    {
      transform: [{ rotate: rotation }, { scale: wheelScale }],
    },
  ]}
>

                    {/* Segments proportionnels : uniquement 🎟️ (streakPass) et 🏆 (trophies) */}
                    {segments.map((type, index) => {
                      const angle =
                        (index / segments.length) * 2 * Math.PI - Math.PI / 2; // départ en haut
                      const radius = WHEEL_SIZE / 2 - 26;

                      const x = radius * Math.cos(angle);
                      const y = radius * Math.sin(angle);

                      const emoji = type === "streakPass" ? "🎟️" : "🏆";

                      return (
                        <View
                          key={`${type}-${index}`}
                          style={[
                            styles.sliceIcon,
                            {
                              transform: [
                                { translateX: x },
                                { translateY: y },
                              ],
                            },
                          ]}
                        >
                          <Text style={styles.sliceEmoji}>{emoji}</Text>
                        </View>
                      );
                    })}

                    {/* Centre de la roue */}
                    <View style={styles.wheelCenter}>
                      <Text style={styles.wheelCenterTop}>
                        {t("dailyBonus.centerTop", "SPIN")}
                      </Text>
                      <Text style={styles.wheelCenterBottom}>
                        {t("dailyBonus.centerBottom", "NOW")}
                      </Text>
                    </View>
                  </Animated.View>
                </LinearGradient>

                {/* Pointeur fixe */}
                <View style={styles.pointer}>
                  <View style={styles.pointerBase} />
                  <View style={styles.pointerTriangle} />
                </View>
              </View>

              {/* --- BANNIÈRE DE RÉCOMPENSE ANIMÉE --- */}
              {hasClaimed && reward && rewardText && (
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
      numberOfLines={1}          // ✅ toujours une seule ligne
      ellipsizeMode="tail"       // ✅ si trop long, on tronque proprement
      adjustsFontSizeToFit       // ✅ iOS : réduit légèrement la taille si besoin
    >
      {reward.type === "streakPass"
        ? `🎟️ ${t("dailyBonus.reward.streakPass", {
            count: reward.amount,
          })}`
        : `🏆 ${t("dailyBonus.reward.trophies", {
            count: reward.amount,
          })}`}
    </Text>
  </Animated.View>
)}

{hasClaimed && canReroll && !!onReroll && (
  <View style={{ alignItems: "center", marginTop: 4 }}>
    <TouchableOpacity
      onPress={onReroll}
      disabled={isSpinning || !rerollAdReady || rerollLoading}
      activeOpacity={0.9}
      style={[
        styles.rerollButton,
        (!rerollAdReady || rerollLoading) && styles.rerollButtonDisabled,
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
          {rerollLoading
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


              {/* --- AIDE/INFO --- */}
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {hasClaimed
                    ? t(
                        "dailyBonus.visualHint",
                        "Ta récompense est ajoutée à ton compte dès que tu lances la roue. Continue ta série pour débloquer encore plus de bonus ✨"
                      )
                    : t(
                        "dailyBonus.teaser",
                        "Touche pour découvrir ta récompense mystère."
                      )}
                </Text>
              </View>

              {/* --- BOUTONS --- */}
              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={onClose}
                  disabled={isSpinning}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t("common.close", "Fermer")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    isSpinning && styles.buttonDisabled,
                  ]}
                  onPress={handlePrimaryPress}
                  disabled={isSpinning}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSpinning
                      ? t("dailyBonus.spinning", "Lancement…")
                      : hasClaimed
                      ? t("dailyBonus.ok", "Super !")
                      : t("dailyBonus.cta", "Lancer la roue")}
                  </Text>
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
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
    modalContainer: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "#06081A", // un peu plus bleu nuit
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  title: {
    fontSize: normalize(22),
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
    fontFamily: "Comfortaa_700Bold",
  },
  subtitle: {
    fontSize: normalize(14),
    color: "rgba(255,255,255,0.68)",
    textAlign: "center",
    marginBottom: 18,
    fontFamily: "Comfortaa_400Regular",
  },
  wheelWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  wheelGlow: {
    position: "absolute",
    width: WHEEL_SIZE + 40,
    height: WHEEL_SIZE + 40,
    borderRadius: 999,
    backgroundColor: "rgba(255, 210, 120, 0.24)", // ✨ halo plus intense
  },
   wheelBorder: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    padding: 7, // léger boost
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFB300",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  rerollButton: {
  marginTop: 6,
  borderRadius: 999,
  overflow: "hidden",
  width: "88%",
  borderWidth: 1,
  borderColor: "rgba(255,213,79,0.95)",
},
rerollButtonInner: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  alignItems: "center",
  justifyContent: "center",
},
rerollButtonText: {
  color: "#111",
  fontSize: normalize(13),
  fontFamily: "Comfortaa_700Bold",
  textAlign: "center",
},
rerollButtonDisabled: {
  opacity: 0.55,
},
rerollSubText: {
  marginTop: 4,
  fontSize: normalize(11),
  color: "rgba(255,255,255,0.6)",
  fontFamily: "Comfortaa_400Regular",
  textAlign: "center",
},

    wheel: {
    width: "100%",
    height: "100%",
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: "#141329", // indigo profond
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  wheelCenter: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: "#FFE97D", // + lumineux
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFCA28",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: "#FFF3CD",
  },
  wheelCenterTop: {
    fontSize: normalize(13),
    color: "#3A2A00",
    letterSpacing: 1,
    fontFamily: "Comfortaa_700Bold", 
  },
  wheelCenterBottom: {
   fontSize: normalize(13),
    color: "#3A2A00",
    letterSpacing: 1,
    fontFamily: "Comfortaa_700Bold", 
  },

   sliceIcon: {
    position: "absolute",
    width: ICON_SIZE + normalize(6),
    height: ICON_SIZE + normalize(6),
    justifyContent: "center",
    alignItems: "center",
  },
  sliceEmoji: {
    fontSize: normalize(26),
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pointer: {
    position: "absolute",
    top: 2,
    alignItems: "center",
    justifyContent: "center",
  },
    pointerBase: {
    width: normalize(24),
    height: normalize(24),
    borderRadius: normalize(12),
    backgroundColor: "#050712",
    borderWidth: 2,
    borderColor: "#FFE082",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
     borderLeftWidth: normalize(8),
    borderRightWidth: normalize(8),
    borderBottomWidth: normalize(12),
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFC107",
    marginTop: 3,
  },

  // ⭐ BANNIÈRE DE RÉCOMPENSE
    rewardBanner: {
    marginTop: 4,
    marginBottom: 10,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,213,79,0.95)",
    backgroundColor: "rgba(255,213,79,0.22)", // + soutenu
    shadowColor: "#FFCA28",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    maxWidth: "88%",
  },
  rewardBannerTitle: {
    color: "#FFFFFF", 
    fontSize: normalize(14),
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold", 
  },

  infoBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  infoText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    columnGap: 10,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: "#FFD54F",
  },
  primaryButtonText: {
    color: "#1A1A1A",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold", 
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default DailyBonusModal;
