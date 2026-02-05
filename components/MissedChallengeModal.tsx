// components/MissedChallengeModal.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  AccessibilityInfo,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(size * scale);
};

interface MissedChallengeModalProps {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;

  // (gardés pour compat parent, mais non utilisés dans cette version)
  onWatchAd: () => void;
  preloadRewarded?: () => void;
  rewardedReady?: boolean;

  onUseTrophies: () => void;
  trophyCost: number;

  /** Streak Pass */
  hasStreakPass?: boolean;
  onUseStreakPass?: () => void;
}

const MissedChallengeModal: React.FC<MissedChallengeModalProps> = ({
  visible,
  onClose,
  onReset,
  onUseTrophies,
  trophyCost,
  hasStreakPass,
  onUseStreakPass,
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const canUseStreakPass = !!hasStreakPass && !!onUseStreakPass;

 const { height: H, width: W } = useWindowDimensions();
 const IS_TINY = W < 360;
  const IS_SHORT = H < 700;
  const contentPad = IS_TINY ? normalizeSize(14) : normalizeSize(20);
  const titleFs = IS_TINY ? normalizeSize(20) : normalizeSize(24);
  const subtitleFs = IS_TINY ? normalizeSize(13) : normalizeSize(15);
  const headerIconSize = IS_TINY ? normalizeSize(38) : normalizeSize(44);
  const headerIconWrap = IS_TINY ? normalizeSize(58) : normalizeSize(66);

  // ✅ responsive heights
  const modalMaxH = Math.min(H * (IS_SHORT ? 0.98 : 0.96), 920);
  const modalMinH = Math.min(H * (IS_SHORT ? 0.82 : 0.78), 760);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Précharge annonce accessibilité
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility?.(
        (t("missedChallenge.title", {
          defaultValue: "You missed a challenge",
        }) as string) || ""
      );
    }, 120);

    return () => clearTimeout(timer);
  }, [visible, t, i18n.language]);

  // Respect Reduce Motion
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
      mounted && setReduceMotion(!!v);
    });
    return () => {
      mounted = false;
      // @ts-ignore compat RN
      sub?.remove?.();
    };
  }, []);

  // Gardes anti double-tap
  const lockRef = useRef(false);
  const withLock = async (fn: () => void | Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      if (!reduceMotion) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      await fn();
    } finally {
      setTimeout(() => {
        lockRef.current = false;
      }, 350);
    }
  };

  if (!visible) return null;

  // ✅ "Solar Keynote" gradients (plus clairs, chauds)
  const gradBg = useMemo<[string, string, string]>(
    () =>
      isDark
        ? ["rgba(18,22,34,0.96)", "rgba(14,18,30,0.96)", "rgba(10,12,20,0.96)"]
        : ["rgba(255,248,236,0.98)", "rgba(255,243,225,0.98)", "rgba(255,236,210,0.98)"],
    [isDark]
  );

  const gradBorder = useMemo<[string, string, string]>(
    () =>
      isDark
        ? ["rgba(255,255,255,0.20)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.14)"]
        : ["rgba(255,180,90,0.55)", "rgba(255,255,255,0.55)", "rgba(255,140,60,0.45)"],
    [isDark]
  );

  const overlayBg = isDark ? "rgba(0,0,0,0.72)" : "rgba(18,18,18,0.50)";

  const titleColor = isDark ? "#FFFFFF" : "rgba(20,20,20,0.96)";
  const subColor = isDark ? "rgba(255,255,255,0.82)" : "rgba(20,20,20,0.72)";
  const pillTextColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(20,20,20,0.78)";
  const pillBorder = isDark ? "rgba(255,255,255,0.14)" : "rgba(255,140,60,0.28)";
  const pillBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)";

  const closeBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)";
  const closeBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const closeIcon = isDark ? "rgba(255,255,255,0.95)" : "rgba(10,10,10,0.88)";

  const handleReset = useCallback(
    () =>
      withLock(() => {
        if (canUseStreakPass) {
          setConfirmVisible(true);
          return;
        }
        onReset();
        onClose();
      }),
    [canUseStreakPass, onReset, onClose]
  );

  const handleUseTrophies = useCallback(
    () =>
      withLock(() => {
        onUseTrophies();
        onClose();
      }),
    [onUseTrophies, onClose]
  );

  const handleUseStreakPass = useCallback(() => {
    if (!canUseStreakPass || !onUseStreakPass) return;
    withLock(() => {
      onUseStreakPass();
      onClose();
    });
  }, [canUseStreakPass, onUseStreakPass, onClose]);

  const confirmResetNow = useCallback(() => {
    setConfirmVisible(false);
    onReset();
    onClose();
  }, [onReset, onClose]);

  const cancelConfirm = useCallback(() => setConfirmVisible(false), []);

  const KeynotePill = ({
    icon,
    label,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }) => (
    <View style={[styles.pill, { borderColor: pillBorder, backgroundColor: pillBg }]}>
      <Ionicons
        name={icon}
        size={normalizeSize(14)}
        color={isDark ? "rgba(255,255,255,0.9)" : "rgba(20,20,20,0.78)"}
      />
      <Text
   style={[
     styles.pillText,
     { color: pillTextColor, fontFamily: current.typography.body.fontFamily },
   ]}
   numberOfLines={1}
   ellipsizeMode="tail"
 >
        {label}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      {...(Platform.OS === "ios" ? { presentationStyle: "overFullScreen" as const } : {})}
    >
      <View
        style={[styles.overlay, { backgroundColor: overlayBg }]}
        accessible
        accessibilityViewIsModal
        accessibilityLabel={t("missedChallenge.title", { defaultValue: "You missed a challenge" })}
        accessibilityHint={t("missedChallenge.subtitle", {
          defaultValue: "Choose how you want to handle your streak.",
        })}
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(180)}
          style={[
            styles.modalContainer,
            {
   width: Math.min(W * 0.94, normalizeSize(460)),
   maxHeight: modalMaxH,
   minHeight: canUseStreakPass ? modalMinH : Math.min(H * (IS_SHORT ? 0.78 : 0.74), 720),
   alignSelf: "center",
 },
          ]}
        >
          <LinearGradient colors={gradBorder} style={[styles.borderWrap, { flex: 1 }]}>
           <LinearGradient colors={gradBg} style={[styles.modalContent, { flex: 1, padding: contentPad }]}>
              {/* CLOSE */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { backgroundColor: closeBg, borderColor: closeBorder },
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.close", { defaultValue: "Close" })}
                testID="missed-modal-close"
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                activeOpacity={0.9}
              >
                <Ionicons name="close" size={normalizeSize(18)} color={closeIcon} />
              </TouchableOpacity>

              {/* HEADER */}
              <View style={styles.header}>
                <View
                  style={[
   styles.headerIconWrap,
   { width: headerIconWrap, height: headerIconWrap, borderRadius: headerIconWrap / 2 },
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.78)",
                      borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
                    },
                  ]}
                >
                  <Ionicons
                    name="sunny-outline"
                     size={headerIconSize}
                    color={isDark ? "#FBBF24" : "#F59E0B"}
                  />
                </View>

                <Text
                  style={[
                    styles.title,
                    { color: titleColor, fontFamily: current.typography.title.fontFamily, fontSize: titleFs },
                  ]}
                  accessibilityRole="header"
                >
                  {t("missedChallenge.title", { defaultValue: "You missed a challenge" })}
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    { color: subColor, fontFamily: current.typography.body.fontFamily, fontSize: subtitleFs },
                  ]}
                >
                  {t("missedChallenge.subtitle", {
                    defaultValue: "Your streak is at risk… but you can still save it.",
                  })}
                </Text>

                <View style={styles.pillsRow}>
                  {canUseStreakPass ? (
                    <KeynotePill
                      icon="ticket-outline"
                      label={t("missedChallenge.pill.streakPass", {
                        defaultValue: "Streak Pass available",
                      })}
                    />
                  ) : null}

                  <KeynotePill
                    icon="trophy-outline"
                    label={t("missedChallenge.pill.trophies", {
                      count: trophyCost,
                      defaultValue: "Cost: {{count}} trophies",
                    })}
                  />
                </View>
              </View>

              {/* scroll affordance */}
              <View style={[styles.grabber, { backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)" }]} />
              <View style={styles.scrollHint} pointerEvents="none">
                <Ionicons
                  name="chevron-down"
                  size={normalizeSize(16)}
                  color={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)"}
                />
              </View>

              {/* BODY */}
              <View style={styles.body}>
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={Platform.OS === "ios" && canUseStreakPass}
                  overScrollMode="never"
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.optionsContainer}>
                    {/* Streak Pass */}
                    {canUseStreakPass && (
                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          !isDark && { backgroundColor: "rgba(255,255,255,0.82)", borderColor: "rgba(0,0,0,0.06)" },
                        ]}
                        onPress={handleUseStreakPass}
                        activeOpacity={0.92}
                        accessibilityRole="button"
                        accessibilityLabel={t("missedChallenge.streakPass.title", {
                          defaultValue: "Use a Streak Pass",
                        })}
                        accessibilityHint={t("missedChallenge.streakPass.subtitle", {
                          defaultValue: "Cancel the missed day and keep your streak.",
                        })}
                        testID="missed-modal-streak-pass"
                      >
                        <LinearGradient
                          colors={isDark ? ["#4F46E5", "#2563EB"] : ["#FFB86B", "#FF7A59"]}
                          style={styles.optionGradient}
                        >
                          <View style={styles.optionIconWrap}>
                            <Ionicons name="ticket-outline" size={normalizeSize(24)} color="#FFF" />
                          </View>
                          <View style={styles.optionTextContainer}>
                            <Text style={[styles.optionText, { fontFamily: current.typography.title.fontFamily }]}>
                              {t("missedChallenge.streakPass.title", { defaultValue: "Use a Streak Pass" })}
                            </Text>
                            <Text style={[styles.optionSubtext, { fontFamily: current.typography.body.fontFamily }]}>
                              {t("missedChallenge.streakPass.subtitle", {
                                defaultValue: "Cancel the missed day and keep your streak intact.",
                              })}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={normalizeSize(18)} color="rgba(255,255,255,0.92)" />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {/* Use trophies */}
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        !isDark && { backgroundColor: "rgba(255,255,255,0.82)", borderColor: "rgba(0,0,0,0.06)" },
                      ]}
                      onPress={handleUseTrophies}
                      activeOpacity={0.92}
                      accessibilityRole="button"
                      accessibilityLabel={t("missedChallenge.useTrophies.title", {
                        count: trophyCost,
                        defaultValue: "Use {{count}} trophies to save your streak",
                      })}
                      accessibilityHint={t("missedChallenge.useTrophies.subtitle", {
                        defaultValue: "Spend trophies to ignore the missed day.",
                      })}
                      testID="missed-modal-use-trophies"
                    >
                      <LinearGradient
                        colors={isDark ? ["#F59E0B", "#FB923C"] : ["#FFD36B", "#FFB74A"]}
                        style={styles.optionGradient}
                      >
                        <View style={styles.optionIconWrap}>
                          <Ionicons name="trophy-outline" size={normalizeSize(24)} color="#FFF" />
                        </View>
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[styles.optionText, { fontFamily: current.typography.title.fontFamily }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {t("missedChallenge.useTrophies.title", {
                              count: trophyCost,
                              // FR: concis, calqué sur les autres options
                              defaultValue: "Sauver la série — {{count}} trophées",
                            })}
                          </Text>
                          <Text
                            style={[styles.optionSubtext, { fontFamily: current.typography.body.fontFamily }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {t("missedChallenge.useTrophies.subtitle", {
                              defaultValue: "Échange des trophées pour protéger ta progression.",
                            })}
                          </Text>
                        </View>

                        <Ionicons
                          style={styles.chevron}
                          name="chevron-forward"
                          size={normalizeSize(18)}
                          color="rgba(255,255,255,0.92)"
                        />
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Reset streak */}
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        !isDark && { backgroundColor: "rgba(255,255,255,0.82)", borderColor: "rgba(0,0,0,0.06)" },
                      ]}
                      onPress={handleReset}
                      activeOpacity={0.92}
                      accessibilityRole="button"
                      accessibilityLabel={t("missedChallenge.reset.title", { defaultValue: "Reset your streak" })}
                      accessibilityHint={t("missedChallenge.reset.subtitle", {
                        defaultValue: "Start again from day 1.",
                      })}
                      testID="missed-modal-reset"
                    >
                      <LinearGradient
                        colors={isDark ? ["#111827", "#0B1224"] : ["#2B2B2B", "#141414"]}
                        style={styles.optionGradient}
                      >
                        <View style={styles.optionIconWrap}>
                          <Ionicons name="refresh-outline" size={normalizeSize(24)} color="#FFF" />
                        </View>
                        <View style={styles.optionTextContainer}>
                          <Text style={[styles.optionText, { fontFamily: current.typography.title.fontFamily }]}>
                            {t("missedChallenge.reset.title", { defaultValue: "Reset your streak" })}
                          </Text>
                          <Text style={[styles.optionSubtext, { fontFamily: current.typography.body.fontFamily }]}>
                            {t("missedChallenge.reset.subtitle", {
                              defaultValue: "Start over from day 1. This cannot be undone.",
                            })}
                          </Text>
                        </View>
                        <Ionicons
                          style={styles.chevron}
                          name="chevron-forward"
                          size={normalizeSize(18)}
                          color="rgba(255,255,255,0.92)"
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: normalizeSize(14) }} />
                </ScrollView>

                {/* Fade bas */}
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    isDark
                      ? ["rgba(0,0,0,0)", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.46)"]
                      : ["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,235,210,0.90)"]
                  }
                  locations={[0, 0.55, 1]}
                  style={styles.bottomFade}
                />
              </View>

              {/* CONFIRM RESET */}
              {confirmVisible && (
                <View style={styles.confirmOverlay} pointerEvents="auto">
                  <Pressable style={styles.confirmBackdrop} onPress={cancelConfirm} />
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInUp.duration(220)}
                    exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                    style={[
                      styles.confirmCard,
                      {
                        backgroundColor: isDark ? "rgba(17,24,39,0.94)" : "rgba(255,255,255,0.92)",
                        borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                      },
                    ]}
                    pointerEvents="auto"
                  >
                    <Text
                      style={[
                        styles.confirmTitle,
                        {
                          color: isDark ? "#FFF" : "rgba(15,15,15,0.95)",
                          fontFamily: current.typography.title.fontFamily,
                        },
                      ]}
                    >
                      {t("missedChallenge.confirmResetTitle", { defaultValue: "Confirm reset?" })}
                    </Text>

                    <Text
                      style={[
                        styles.confirmText,
                        {
                          color: isDark ? "rgba(255,255,255,0.84)" : "rgba(15,15,15,0.72)",
                          fontFamily: current.typography.body.fontFamily,
                        },
                      ]}
                    >
                      {t("missedChallenge.confirmResetText", {
                        defaultValue:
                          "You have a Streak Pass available. Are you sure you want to reset your streak?",
                      })}
                    </Text>

                    <View style={styles.confirmRow}>
                      <TouchableOpacity
                        onPress={cancelConfirm}
                        activeOpacity={0.92}
                        style={[
                          styles.confirmBtn,
                          { backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.confirmBtnText,
                            {
                              color: isDark ? "#FFF" : "rgba(10,10,10,0.90)",
                              fontFamily: current.typography.body.fontFamily,
                            },
                          ]}
                        >
                          {t("common.cancel", { defaultValue: "Cancel" })}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={confirmResetNow}
                        activeOpacity={0.92}
                        style={[
                          styles.confirmBtn,
                          { backgroundColor: "rgba(239,68,68,0.92)" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.confirmBtnText,
                            { color: "#FFF", fontFamily: current.typography.body.fontFamily },
                          ]}
                        >
                          {t("common.confirm", { defaultValue: "Yes, reset" })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </View>
              )}
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
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: normalizeSize(12),
  paddingHorizontal: normalizeSize(10),
  },
modalContainer: {
   borderRadius: normalizeSize(30),
   overflow: "hidden",
 },
  borderWrap: {
    padding: 1.2,
    borderRadius: normalizeSize(30),
    flex: 1,
  },
  modalContent: {
    width: "100%",
    borderRadius: normalizeSize(29),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(18) },
    shadowOpacity: 0.30,
    shadowRadius: normalizeSize(26),
    elevation: 24,
    flex: 1,
  },

  closeButton: {
    position: "absolute",
    top: normalizeSize(10),
    right: normalizeSize(10),
    width: normalizeSize(34),
    height: normalizeSize(34),
    borderRadius: normalizeSize(17),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderWidth: 1,
  },
chevron: {
    marginLeft: normalizeSize(10),
    flexShrink: 0,
  },
  header: {
    alignItems: "center",
    marginBottom: normalizeSize(8),
    paddingTop: normalizeSize(4),
  },
  headerIconWrap: {
    width: normalizeSize(66),
    height: normalizeSize(66),
    borderRadius: normalizeSize(33),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalizeSize(10),
    borderWidth: 1,
  },

  title: {
    fontSize: normalizeSize(24),
    marginTop: normalizeSize(2),
    textAlign: "center",
    letterSpacing: 0.15,
  },
  subtitle: {
    fontSize: normalizeSize(15),
    textAlign: "center",
    marginTop: normalizeSize(8),
    paddingHorizontal: normalizeSize(10),
    lineHeight: normalizeSize(21),
    opacity: 0.98,
  },

  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: normalizeSize(8),
    marginTop: normalizeSize(12),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(6),
    paddingHorizontal: normalizeSize(10),
    paddingVertical: normalizeSize(6),
    borderRadius: normalizeSize(999),
    borderWidth: 1,
     maxWidth: "100%",
  },
  pillText: {
    fontSize: normalizeSize(12),
    flexShrink: 1,
  },

  body: {
    flexGrow: 1,
    position: "relative",
    marginTop: normalizeSize(6),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: normalizeSize(24),
    flexGrow: 1,
  },

  optionsContainer: {
    gap: normalizeSize(12),
    paddingBottom: normalizeSize(6),
  },
  optionButton: {
    borderRadius: normalizeSize(18),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },

  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(12),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(18),
    minHeight: normalizeSize(70),
  },

  optionIconWrap: {
    width: normalizeSize(40),
    height: normalizeSize(40),
    borderRadius: normalizeSize(14),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: normalizeSize(12),
  },

  optionTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  optionText: {
    fontSize: normalizeSize(17),
    color: "#FFF",
    lineHeight: normalizeSize(21),
    flexShrink: 1,
  },
  optionSubtext: {
    fontSize: normalizeSize(13),
    color: "rgba(255,255,255,0.90)",
    lineHeight: normalizeSize(18),
    marginTop: 2,
    flexShrink: 1,
  },

  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: normalizeSize(18),
    borderBottomLeftRadius: normalizeSize(22),
    borderBottomRightRadius: normalizeSize(22),
  },

  grabber: {
    alignSelf: "center",
    width: normalizeSize(52),
    height: normalizeSize(5),
    borderRadius: normalizeSize(999),
    marginTop: normalizeSize(2),
    marginBottom: normalizeSize(6),
  },
  scrollHint: {
    alignSelf: "center",
 marginTop: normalizeSize(4),
 marginBottom: normalizeSize(2),
 opacity: 0.9,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: normalizeSize(14),
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    pointerEvents: "auto",
  },
  confirmCard: {
    width: "100%",
    maxWidth: normalizeSize(420),
    borderRadius: normalizeSize(22),
    padding: normalizeSize(16),
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 16,
  },
  confirmTitle: {
    fontSize: normalizeSize(18),
    textAlign: "center",
  },
  confirmText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(14),
    textAlign: "center",
    lineHeight: normalizeSize(20),
  },
  confirmRow: {
    flexDirection: "row",
    gap: normalizeSize(10),
    marginTop: normalizeSize(14),
  },
  confirmBtn: {
    flex: 1,
    borderRadius: normalizeSize(14),
    paddingVertical: normalizeSize(12),
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: normalizeSize(14),
  },
});

export default MissedChallengeModal;
