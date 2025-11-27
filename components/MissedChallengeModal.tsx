// components/MissedChallengeModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  AccessibilityInfo,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
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
  onWatchAd: () => void;
  onUseTrophies: () => void;
  trophyCost: number;
  preloadRewarded?: () => void;

  /** Streak Pass */
  hasStreakPass?: boolean;
  onUseStreakPass?: () => void;
}

const MissedChallengeModal: React.FC<MissedChallengeModalProps> = ({
  visible,
  onClose,
  onReset,
  onWatchAd,
  onUseTrophies,
  trophyCost,
  preloadRewarded,
  hasStreakPass,
  onUseStreakPass,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const { showRewarded } = useAdsVisibility();
  const canShowRewarded = !!showRewarded;
  const canUseStreakPass = !!hasStreakPass && !!onUseStreakPass;

  const { height: H } = useWindowDimensions();
  const modalMaxH = Math.min(H * 0.85, 760);
  const modalMinH = Math.min(H * 0.55, 520); // ✅ évite l’effet “bande”
  const optionsMaxH = Math.max(
    normalizeSize(160),
    modalMaxH - normalizeSize(210)
  ); // ✅ zone scroll clampée (petits écrans)

  const [reduceMotion, setReduceMotion] = useState(false);

  // — Précharge la rewarded quand le modal s’ouvre
  useEffect(() => {
    if (visible) {
      try {
        preloadRewarded?.();
      } catch {}
      setTimeout(() => {
        AccessibilityInfo.announceForAccessibility?.(
          t("missedChallenge.title", {
            defaultValue: "Tu as manqué un défi",
          }) as string
        );
      }, 100);
    }
  }, [visible, preloadRewarded, t]);

  // — Respect Reduce Motion (animations + haptics)
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (v) => mounted && setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      // @ts-ignore compat RN
      sub?.remove?.();
    };
  }, []);

  // — Gardes anti double-tap
  const lockRef = useRef(false);
  const withLock = async (fn: () => void | Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      if (!reduceMotion) {
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Medium
        ).catch(() => {});
      }
      await fn();
    } finally {
      setTimeout(() => {
        lockRef.current = false;
      }, 350);
    }
  };

  if (!visible) return null;

  const gradBg = useMemo<[string, string]>(
    () =>
      isDark
        ? [current.colors.cardBackground, current.colors.background]
        : ["#111827", "#0B1020"],
    [isDark, current.colors.cardBackground, current.colors.background]
  );

  const gradBorder = useMemo<[string, string, string]>(
    () =>
      isDark
        ? [
            "rgba(255,255,255,0.10)",
            "rgba(255,255,255,0.04)",
            "rgba(255,255,255,0.08)",
          ]
        : [
            "rgba(255,255,255,0.15)",
            "rgba(255,255,255,0.06)",
            "rgba(255,255,255,0.12)",
          ],
    [isDark]
  );

  const handleReset = () =>
    withLock(() => {
      if (canUseStreakPass) {
        Alert.alert(
          t("missedChallenge.confirmResetTitle", {
            defaultValue: "Confirmer ?",
          }),
          t("missedChallenge.confirmResetText", {
            defaultValue:
              "Tu as un Streak Pass disponible. Veux-tu vraiment remettre ta série à zéro ?",
          }),
          [
            {
              text: t("common.cancel", { defaultValue: "Annuler" }),
              style: "cancel",
            },
            {
              text: t("common.confirm", {
                defaultValue: "Oui, réinitialiser",
              }),
              style: "destructive",
              onPress: () => {
                onReset();
                onClose();
              },
            },
          ]
        );
      } else {
        onReset();
        onClose();
      }
    });

  const handleWatch = () =>
    withLock(() => {
      onWatchAd();
    });

  const handleUseTrophies = () =>
    withLock(() => {
      onUseTrophies();
      onClose();
    });

  const handleUseStreakPass = () => {
    if (!canUseStreakPass || !onUseStreakPass) return;
    withLock(() => {
      onUseStreakPass();
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      {...(Platform.OS === "ios"
        ? { presentationStyle: "overFullScreen" as const }
        : {})}
    >
      <View
        style={styles.overlay}
        accessible
        accessibilityViewIsModal
        accessibilityLabel={t("missedChallenge.title", {
          defaultValue: "Tu as manqué un défi",
        })}
        accessibilityHint={t("missedChallenge.subtitle", {
          defaultValue: "Choisis comment gérer ta série.",
        })}
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(180)}
          style={[
            styles.modalContainer,
            { maxHeight: modalMaxH, minHeight: modalMinH },
          ]}
        >
          <LinearGradient colors={gradBorder} style={styles.borderWrap}>
            <LinearGradient colors={gradBg} style={styles.modalContent}>
              {/* HEADER */}
              <View style={styles.header}>
                <View style={styles.headerIconWrap}>
                  <Ionicons
                    name="warning-outline"
                    size={normalizeSize(44)}
                    color={current.colors.error || "#FF4444"}
                  />
                </View>

                <Text
                  style={[
                    styles.title,
                    {
                      color: current.colors.textPrimary,
                      fontFamily: current.typography.title.fontFamily,
                    },
                  ]}
                  accessibilityRole="header"
                >
                  {t("missedChallenge.title", {
                    defaultValue: "Tu as manqué un défi",
                  })}
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: current.colors.textSecondary,
                      fontFamily: current.typography.body.fontFamily,
                    },
                  ]}
                >
                  {t("missedChallenge.subtitle", {
                    defaultValue:
                      "Ta série est en danger… mais tu peux encore la sauver.",
                  })}
                </Text>
              </View>

              {/* OPTIONS scrollables */}
              <ScrollView
                style={{ maxHeight: optionsMaxH }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={Platform.OS === "ios"}
                overScrollMode="never"
              >
                <View style={styles.optionsContainer}>
                  {/* Reset streak */}
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={handleReset}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={t("missedChallenge.reset.title", {
                      defaultValue: "Recommencer la série",
                    })}
                    accessibilityHint={t(
                      "missedChallenge.reset.subtitle",
                      {
                        defaultValue:
                          "Remettre ta série à zéro et repartir depuis le jour 1.",
                      }
                    )}
                    testID="missed-modal-reset"
                  >
                    <LinearGradient
                      colors={[
                        current.colors.secondary,
                        current.colors.primary,
                      ]}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIconWrap}>
                        <Ionicons
                          name="refresh-outline"
                          size={normalizeSize(24)}
                          color="#FFF"
                        />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[
                            styles.optionText,
                            {
                              fontFamily:
                                current.typography.title.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.reset.title", {
                            defaultValue: "Recommencer la série",
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.optionSubtext,
                            {
                              fontFamily:
                                current.typography.body.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.reset.subtitle", {
                            defaultValue:
                              "Remettre ta série à zéro et repartir depuis le jour 1.",
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={normalizeSize(18)}
                        color="rgba(255,255,255,0.9)"
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Streak Pass */}
                  {canUseStreakPass && (
                    <TouchableOpacity
                      style={styles.optionButton}
                      onPress={handleUseStreakPass}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "missedChallenge.streakPass.title",
                        {
                          defaultValue: "Utiliser un Streak Pass",
                        }
                      )}
                      accessibilityHint={t(
                        "missedChallenge.streakPass.subtitle",
                        {
                          defaultValue:
                            "Annuler ce jour manqué et garder ta série intacte.",
                        }
                      )}
                      testID="missed-modal-streak-pass"
                    >
                      <LinearGradient
                        colors={[
                          current.colors.secondary,
                          current.colors.primary,
                        ]}
                        style={styles.optionGradient}
                      >
                        <View style={styles.optionIconWrap}>
                          <Ionicons
                            name="ticket-outline"
                            size={normalizeSize(24)}
                            color="#FFF"
                          />
                        </View>
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionText,
                              {
                                fontFamily:
                                  current.typography.title.fontFamily,
                              },
                            ]}
                          >
                            {t("missedChallenge.streakPass.title", {
                              defaultValue: "Utiliser un Streak Pass",
                            })}
                          </Text>
                          <Text
                            style={[
                              styles.optionSubtext,
                              {
                                fontFamily:
                                  current.typography.body.fontFamily,
                              },
                            ]}
                          >
                            {t("missedChallenge.streakPass.subtitle", {
                              defaultValue:
                                "Annuler ce jour manqué et garder ta série intacte.",
                            })}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={normalizeSize(18)}
                          color="rgba(255,255,255,0.9)"
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {/* Watch rewarded */}
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      !canShowRewarded && { opacity: 0.55 },
                    ]}
                    onPress={handleWatch}
                    activeOpacity={0.88}
                    disabled={!canShowRewarded}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canShowRewarded }}
                    accessibilityLabel={t("missedChallenge.ad.title", {
                      defaultValue: "Regarder une vidéo pour sauver ta série",
                    })}
                    accessibilityHint={t(
                      "missedChallenge.ad.subtitle",
                      {
                        defaultValue:
                          "Regarder une vidéo sponsorisée pour annuler ce jour manqué.",
                      }
                    )}
                    testID="missed-modal-watch-ad"
                  >
                    <LinearGradient
                      colors={[
                        current.colors.primary,
                        current.colors.secondary,
                      ]}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIconWrap}>
                        <Ionicons
                          name="play-circle-outline"
                          size={normalizeSize(24)}
                          color="#FFF"
                        />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[
                            styles.optionText,
                            {
                              fontFamily:
                                current.typography.title.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.ad.title", {
                            defaultValue:
                              "Regarder une vidéo pour sauver ta série",
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.optionSubtext,
                            {
                              fontFamily:
                                current.typography.body.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.ad.subtitle", {
                            defaultValue:
                              "Regarder une vidéo sponsorisée pour annuler ce jour manqué.",
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={normalizeSize(18)}
                        color="rgba(255,255,255,0.9)"
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Use trophies */}
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={handleUseTrophies}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "missedChallenge.useTrophies.title",
                      {
                        count: trophyCost,
                        defaultValue:
                          "Utiliser {{count}} trophées pour sauver ta série",
                      }
                    )}
                    accessibilityHint={t(
                      "missedChallenge.useTrophies.subtitle",
                      {
                        defaultValue:
                          "Dépenser des trophées gagnés pour ignorer ce jour manqué.",
                      }
                    )}
                    testID="missed-modal-use-trophies"
                  >
                    <LinearGradient
                      colors={["#FACC15", current.colors.primary]}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIconWrap}>
                        <Ionicons
                          name="trophy-outline"
                          size={normalizeSize(24)}
                          color="#FFF"
                        />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[
                            styles.optionText,
                            {
                              fontFamily:
                                current.typography.title.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.useTrophies.title", {
                            count: trophyCost,
                            defaultValue:
                              "Utiliser {{count}} trophées pour sauver ta série",
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.optionSubtext,
                            {
                              fontFamily:
                                current.typography.body.fontFamily,
                            },
                          ]}
                        >
                          {t("missedChallenge.useTrophies.subtitle", {
                            defaultValue:
                              "Dépenser des trophées gagnés pour ignorer ce jour manqué.",
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={normalizeSize(18)}
                        color="rgba(255,255,255,0.9)"
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <View style={{ height: normalizeSize(10) }} />
              </ScrollView>

              {/* CLOSE */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { backgroundColor: current.colors.error || "#FF4444" },
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.close", {
                  defaultValue: "Fermer",
                })}
                testID="missed-modal-close"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.92}
              >
                <Ionicons
                  name="close"
                  size={normalizeSize(18)}
                  color="#FFF"
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
  },

  modalContainer: {
    width: SCREEN_WIDTH * 0.92,
    maxWidth: normalizeSize(440),
    borderRadius: normalizeSize(26),
    overflow: "hidden",
  },

  borderWrap: {
    padding: 1.2,
    borderRadius: normalizeSize(26),
  },

  modalContent: {
    width: "100%",
    padding: normalizeSize(18),
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(12) },
    shadowOpacity: 0.65,
    shadowRadius: normalizeSize(20),
    elevation: 25,
  },

  header: {
    alignItems: "center",
    marginBottom: normalizeSize(12),
    paddingTop: normalizeSize(6),
  },
  headerIconWrap: {
    width: normalizeSize(62),
    height: normalizeSize(62),
    borderRadius: normalizeSize(31),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: normalizeSize(8),
  },

  title: {
    fontSize: normalizeSize(24),
    marginTop: normalizeSize(4),
    textAlign: "center",
  },
  subtitle: {
    fontSize: normalizeSize(15),
    textAlign: "center",
    marginTop: normalizeSize(6),
    paddingHorizontal: normalizeSize(8),
    lineHeight: normalizeSize(20),
  },

  scrollContent: {
    paddingBottom: normalizeSize(4),
  },

  optionsContainer: {
    gap: normalizeSize(12),
  },

  optionButton: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    elevation: 6,
  },

  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalizeSize(14),
    paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(16),
    minHeight: normalizeSize(68),
  },

  optionIconWrap: {
    width: normalizeSize(38),
    height: normalizeSize(38),
    borderRadius: normalizeSize(12),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: normalizeSize(12),
  },

  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: normalizeSize(17),
    color: "#FFF",
    lineHeight: normalizeSize(21),
  },
  optionSubtext: {
    fontSize: normalizeSize(13),
    color: "rgba(255,255,255,0.9)",
    lineHeight: normalizeSize(18),
    marginTop: 2,
  },

  closeButton: {
    position: "absolute",
    top: normalizeSize(8),
    right: normalizeSize(8),
    width: normalizeSize(34),
    height: normalizeSize(34),
    borderRadius: normalizeSize(17),
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});

export default MissedChallengeModal;
