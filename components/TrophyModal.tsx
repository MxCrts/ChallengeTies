// components/TrophyModal.tsx
import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Pressable,
  I18nManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  ZoomIn,
  ZoomOut,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import { useTrophy } from "../context/TrophyContext";
 import {
   RewardedAd,
   RewardedAdEventType,
   AdEventType,
 } from "react-native-google-mobile-ads";
 import { adUnitIds } from "@/constants/admob"; // tu l'as déjà dans ton projet



const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalize = (size: number) => {
  const base = 375;
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / base;
  return Math.round(size * scale);
};

const TrophyModal: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // 🔗 Contexte existant – on ne change pas l’API
  const {
    showTrophyModal,
    trophiesEarned,
    achievementEarned,
    isDoubleReward,
    finalTrophies,
    resetTrophyData,
    isClaiming,
    closeTrophyModal,
    canClaim,
    activateDoubleReward,  
  } = useTrophy();

   // --- Rewarded Ad ---
 const rewarded = React.useMemo(
   () =>
     RewardedAd.createForAdRequest(adUnitIds.rewarded, {
       requestNonPersonalizedAdsOnly: true,
     }),
   []
 );

 const [adReady, setAdReady] = React.useState(false);
 const [adLoading, setAdLoading] = React.useState(false);

 useEffect(() => {
   const unsubLoaded = rewarded.addAdEventListener(
     RewardedAdEventType.LOADED,
     () => setAdReady(true)
   );

   const unsubError = rewarded.addAdEventListener(
     AdEventType.ERROR,
     () => setAdReady(false)
   );

   const unsubClosed = rewarded.addAdEventListener(
     AdEventType.CLOSED,
     () => {
       setAdReady(false);
       rewarded.load();
     }
   );

   rewarded.load();

   return () => {
     unsubLoaded();
     unsubError();
     unsubClosed();
   };
 }, [rewarded]);


  // 🔥 pulse sur le gros trophée
  const pulseSV = useSharedValue(0);

  useEffect(() => {
    if (!showTrophyModal) return;
    pulseSV.value = 0;
    pulseSV.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 900 })
      ),
      -1,
      true
    );
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [showTrophyModal, pulseSV]);

  const trophyPulseStyle = useAnimatedStyle(() => {
    const scale = 1 + pulseSV.value * 0.08;
    const shadowOpacity = 0.25 + pulseSV.value * 0.25;
    return {
      transform: [{ scale }],
      shadowOpacity,
    };
  });

  if (!showTrophyModal) return null;

  const topPadding = Math.max(insets.top + normalize(12), normalize(24));
  const bottomPadding = Math.max(insets.bottom + normalize(12), normalize(24));

  const title = t("trophyModal.title", {
    defaultValue: "Trophée débloqué !",
  });

  const subtitle = t("trophyModal.subtitle", {
    defaultValue: "Tu viens de franchir un cap dans ta progression.",
  });

  const achievementTitle = t(
    achievementEarned || "trophyModal.defaultName",
    {
      defaultValue: achievementEarned || "Succès mystère",
    }
  );

  const description = t(`descriptions.${achievementEarned}`, {
    defaultValue: t("trophyModal.defaultDescription", {
      defaultValue:
        "Continue sur cette lancée : chaque trophée est une preuve concrète de ta discipline.",
    }),
  });

  const ribbonLabel = t("trophyModal.ribbon", {
    defaultValue: "Récompense débloquée",
  });

  const trophiesTitle = t("trophyModal.trophiesTitle", {
    defaultValue: "Trophées gagnés",
  });

  const trophiesHint = t("trophyModal.trophiesHint", {
    defaultValue: "Ils s’ajoutent à ton total ChallengeTies.",
  });

  const ctaLabel = isClaiming
    ? t("trophyModal.ctaLoading", { defaultValue: "En cours…" })
    : t("trophyModal.cta", { defaultValue: "Récupérer" });

  const doubleBadgeLabel = t("trophyModal.doubleBadge", {
    defaultValue: "x2 activé",
  });

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
    closeTrophyModal && closeTrophyModal();
  };

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {}
    await resetTrophyData();
  };

   const handleDoubleReward = async () => {
   if (!adReady || adLoading || isDoubleReward) return;

   setAdLoading(true);
   let rewardEarned = false;

   try {
     const subEarn = rewarded.addAdEventListener(
       RewardedAdEventType.EARNED_REWARD,
       () => {
         rewardEarned = true;
       }
     );

     const subClose = rewarded.addAdEventListener(
       AdEventType.CLOSED,
       () => {
         subEarn();
         subClose();
         setAdLoading(false);

         if (rewardEarned) {
           try {
             Haptics.notificationAsync(
               Haptics.NotificationFeedbackType.Success
             ).catch(() => {});
           } catch {}

           activateDoubleReward();
         }
       }
     );

     await rewarded.show();
   } catch (e) {
     setAdLoading(false);
   }
 };


  return (
    <Modal
      visible={showTrophyModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      {...(Platform.OS === "ios"
        ? { presentationStyle: "overFullScreen" as const }
        : {})}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {/* tap en dehors pour fermer */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          entering={ZoomIn.springify().damping(18)}
          exiting={ZoomOut.duration(160)}
          style={styles.modalContainer}
        >
          {/* Border gradient flashy */}
          <LinearGradient
            colors={["#FACC15", "#FB7185", "#38BDF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.borderWrap}
          >
            {/* Fond “glass” clair / sombre */}
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(15,23,42,0.98)", "rgba(17,24,39,0.98)"]
                  : ["rgba(248,250,252,0.98)", "rgba(239,246,255,0.96)"]
              }
              style={styles.modalBackground}
            >
              {/* Ruban top */}
              <View style={styles.ribbonWrapper}>
                <LinearGradient
                  colors={["#F97316", "#FACC15"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ribbon}
                >
                  <Ionicons
                    name="trophy"
                    size={normalize(16)}
                    color="#0F172A"
                  />
                  <Text
                    style={[
                      styles.ribbonText,
                      {
                        writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                        textAlign: I18nManager.isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {ribbonLabel}
                  </Text>
                  <Ionicons
                    name="trophy"
                    size={normalize(16)}
                    color="#0F172A"
                  />
                </LinearGradient>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Animated.View
                  style={[styles.trophyCircle, trophyPulseStyle]}
                >
                  <Ionicons
                    name="trophy"
                    size={normalize(46)}
                    color="#FACC15"
                  />
                  <View style={styles.trophyGlow} />

                  {isDoubleReward && (
                    <View style={styles.doubleBadge}>
                      <Text
                        style={[
                          styles.doubleBadgeText,
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: "center",
                          },
                        ]}
                      >
                        {doubleBadgeLabel}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                <Text
                  style={[
                    styles.title,
                    {
                      color: isDark
                        ? currentTheme.colors.textPrimary
                        : "#020617",
                      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {title}
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: isDark
                        ? currentTheme.colors.textSecondary
                        : "rgba(15,23,42,0.76)",
                      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                      textAlign: "center",
                    },
                  ]}
                >
                  {subtitle}
                </Text>
              </View>

              {/* Carte des trophées */}
              <View style={styles.trophiesCardWrapper}>
                <LinearGradient
                  colors={["#F97316", "#FACC15", "#22C55E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.trophiesCardBorder}
                >
                  <View style={styles.trophiesCard}>
                    <View style={styles.trophiesIconCircle}>
                      <Ionicons
                        name="trophy"
                        size={normalize(26)}
                        color="#FACC15"
                      />
                    </View>
                    <View style={styles.trophiesTextBlock}>
                      <Text
                        style={[
                          styles.trophiesLabel,
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                      >
                        {trophiesTitle}
                      </Text>
                      <Text
                        style={[
                          styles.trophiesValue,
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                      >
                        {isDoubleReward ? `+${finalTrophies}` : `+${trophiesEarned}`}
                      </Text>
                      <Text
                        style={[
                          styles.trophiesHint,
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {trophiesHint}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* Description du succès */}
              <View style={styles.achievementBlock}>
                <Text
                  style={[
                    styles.achievementTitle,
                    {
                      color: isDark
                        ? currentTheme.colors.textPrimary
                        : "#0F172A",
                      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={2}
                >
                  {achievementTitle}
                </Text>
                <Text
                  style={[
                    styles.achievementDescription,
                    {
                      color: isDark
                        ? currentTheme.colors.textSecondary
                        : "rgba(15,23,42,0.76)",
                      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={4}
                >
                  {description}
                </Text>
              </View>

                            {/* Boutons actions */}
              <View style={styles.actionsRow}>
                {!isDoubleReward && (
                  <TouchableOpacity
                    onPress={handleDoubleReward}
                    activeOpacity={0.9}
                    disabled={!adReady || adLoading}
                    style={[
                      styles.doubleRewardButton,
                      (!adReady || adLoading) && { opacity: 0.5 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "trophyModal.doubleReward",
                      "Regarder une vidéo pour doubler la récompense"
                    )}
                  >
                    <LinearGradient
                      colors={["#4ade80", "#16a34a"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.doubleRewardInner}
                    >
                      <Ionicons
                        name="play-circle"
                        size={normalize(16)}
                        color="#fff"
                      />
                      <Text
                        style={[
                          styles.doubleRewardText,
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: "center",
                          },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {adLoading
                          ? t("trophyModal.loadingAd", "Chargement…")
                          : t(
                              "trophyModal.doubleReward",
                              "Regarder une vidéo → x2"
                            )}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleClaim}
                  activeOpacity={0.9}
                  style={[
                    styles.primaryButton,
                    (!canClaim || isClaiming) && { opacity: 0.7 },
                  ]}
                  disabled={!canClaim || isClaiming}
                  accessibilityRole="button"
                  accessibilityLabel={ctaLabel}
                >
                  <LinearGradient
                    colors={[
                      currentTheme.colors.secondary,
                      currentTheme.colors.primary,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonInner}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        {
                          writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                          textAlign: "center",
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {ctaLabel}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={normalize(16)}
                      color="#FFF"
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>


              {/* Close X */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.close", {
                  defaultValue: "Fermer",
                })}
              >
                <Ionicons
                  name="close"
                  size={normalize(18)}
                  color={isDark ? "#E5E7EB" : "#111827"}
                />
              </TouchableOpacity>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.88)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: normalize(16),
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.94,
    maxWidth: normalize(460),
    borderRadius: normalize(28),
    overflow: "hidden",
  },
  borderWrap: {
    borderRadius: normalize(28),
    padding: 2,
  },
  modalBackground: {
    borderRadius: normalize(26),
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(14),
  },
  ribbonWrapper: {
    alignItems: "center",
    marginBottom: normalize(6),
  },
  ribbon: {
    borderRadius: normalize(999),
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(6),
    flexDirection: "row",
    alignItems: "center",
    gap: normalize(6),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 5,
  },
  ribbonText: {
    fontSize: normalize(11),
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  header: {
    alignItems: "center",
    marginTop: normalize(4),
    marginBottom: normalize(10),
  },
 actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: normalize(14),
    gap: normalize(10),
  },
  doubleRewardButton: {
    flex: 1,
    borderRadius: normalize(999),
  },
  doubleRewardInner: {
    paddingVertical: normalize(9),
    paddingHorizontal: normalize(10),
    borderRadius: normalize(999),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(6),
  },
  trophyCircle: {
    width: normalize(84),
    height: normalize(84),
    borderRadius: normalize(42),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1.5,
    borderColor: "rgba(250,204,21,0.85)",
    marginBottom: normalize(8),
    shadowColor: "#FACC15",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
  },
  trophyGlow: {
    position: "absolute",
    width: "140%",
    height: "140%",
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.16)",
  },
  doubleBadge: {
    position: "absolute",
    bottom: -normalize(4),
    right: -normalize(4),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(2),
    borderRadius: normalize(999),
    backgroundColor: "#22C55E",
    borderWidth: 1,
    borderColor: "#16A34A",
  },
  doubleBadgeText: {
    fontSize: normalize(9),
    fontFamily: "Comfortaa_700Bold",
    color: "#ECFDF5",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: normalize(22),
    fontFamily: "Comfortaa_700Bold",
  },
  subtitle: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalize(4),
  },
  trophiesCardWrapper: {
    marginTop: normalize(4),
    marginBottom: normalize(10),
  },
  trophiesCardBorder: {
    borderRadius: normalize(18),
    padding: 1.5,
  },
  trophiesCard: {
    borderRadius: normalize(16),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(10),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
  },
  trophiesIconCircle: {
    width: normalize(46),
    height: normalize(46),
    borderRadius: normalize(23),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,1)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.85)",
    marginRight: normalize(10),
  },
  trophiesTextBlock: {
    flex: 1,
  },
  trophiesLabel: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    color: "#F9FAFB",
    opacity: 0.85,
  },
  trophiesValue: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    color: "#FEF9C3",
    marginTop: 2,
  },
  trophiesHint: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(241,245,249,0.9)",
    marginTop: 2,
  },
  achievementBlock: {
    marginTop: normalize(6),
  },
  achievementTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(4),
  },
  achievementDescription: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalize(18),
  },
  doubleRewardText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  primaryButton: {
    flex: 1,
  },
  primaryButtonInner: {
    borderRadius: normalize(999),
    paddingVertical: normalize(9),
    paddingHorizontal: normalize(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: normalize(6),
  },
  primaryButtonText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
  },
  closeButton: {
    position: "absolute",
    top: normalize(10),
    right: normalize(10),
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
  },
});

export default TrophyModal;
