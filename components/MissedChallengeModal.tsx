import React, { useEffect, useMemo, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import { useTheme } from "../context/ThemeContext";
import * as Haptics from "expo-haptics";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";

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

  /** Nouveau : Streak Pass */
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
  hasStreakPass,
  onUseStreakPass,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const { showRewarded } = useAdsVisibility();
  const { preloadRewarded } = useCurrentChallenges();

  const canShowRewarded = !!showRewarded;
  const canUseStreakPass = !!hasStreakPass && !!onUseStreakPass;

  // — Précharge la rewarded quand le modal s’ouvre
  useEffect(() => {
    if (visible) {
      try {
        preloadRewarded();
      } catch {}
      // focus vocal pour a11y
      setTimeout(() => {
        AccessibilityInfo.announceForAccessibility?.(
          t("missedChallenge.title") as string
        );
      }, 100);
    }
  }, [visible, preloadRewarded, t]);

  // — Gardes anti double-tap
  const lockRef = useRef(false);
  const withLock = async (fn: () => void | Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {}
      );
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
      : ["#1E1E1E", "#3A3A3A"],
  [isDark, current.colors.cardBackground, current.colors.background]
);


  const handleReset = () =>
  withLock(() => {
    if (canUseStreakPass) {
      // Petit message de confirmation si un Streak Pass est disponible
      Alert.alert(
        t("missedChallenge.confirmResetTitle", "Confirmer ?"),
        t(
          "missedChallenge.confirmResetText",
          "Tu as un Streak Pass disponible. Veux-tu vraiment remettre ta série à zéro ?"
        ),
        [
          { text: t("common.cancel", "Annuler"), style: "cancel" },
          {
            text: t("common.confirm", "Oui, réinitialiser"),
            style: "destructive",
            onPress: () => {
              onReset();
              onClose();
            },
          },
        ]
      );
    } else {
      // Flow normal
      onReset();
      onClose();
    }
  });


  const handleWatch = () =>
    withLock(() => {
      onWatchAd(); // flow rewarded géré côté contexte
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
        accessibilityLabel={t("missedChallenge.title")}
        accessibilityHint={t("missedChallenge.subtitle")}
      >
        <Animated.View
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(180)}
          style={styles.modalContainer}
        >
          <LinearGradient colors={gradBg} style={styles.modalContent}>
            <View style={styles.header}>
              <Ionicons
                name="warning-outline"
                size={normalizeSize(48)}
                color={current.colors.error || "#FF4444"}
              />
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
                {t("missedChallenge.title")}
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
                {t("missedChallenge.subtitle")}
              </Text>
            </View>

            <View style={styles.optionsContainer}>
              {/* Reset streak */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleReset}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("missedChallenge.reset.title")}
                accessibilityHint={t("missedChallenge.reset.subtitle")}
                testID="missed-modal-reset"
              >
                <LinearGradient
                  colors={[current.colors.secondary, current.colors.primary]}
                  style={styles.optionGradient}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={normalizeSize(28)}
                    color="#FFF"
                  />
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        { fontFamily: current.typography.title.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.reset.title")}
                    </Text>
                    <Text
                      style={[
                        styles.optionSubtext,
                        { fontFamily: current.typography.body.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.reset.subtitle")}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Streak Pass (si dispo) */}
              {canUseStreakPass && (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleUseStreakPass}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("missedChallenge.streakPass.title")}
                  accessibilityHint={t(
                    "missedChallenge.streakPass.subtitle"
                  )}
                  testID="missed-modal-streak-pass"
                >
                  <LinearGradient
                    colors={[current.colors.secondary, current.colors.primary]}
                    style={styles.optionGradient}
                  >
                    <Ionicons
                      name="ticket-outline"
                      size={normalizeSize(28)}
                      color="#FFF"
                    />
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
                        {t("missedChallenge.streakPass.title")}
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
                        {t("missedChallenge.streakPass.subtitle")}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Watch rewarded */}
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  !canShowRewarded && { opacity: 0.5 },
                ]}
                onPress={handleWatch}
                activeOpacity={0.85}
                disabled={!canShowRewarded}
                accessibilityRole="button"
                accessibilityLabel={t("missedChallenge.ad.title")}
                accessibilityHint={t("missedChallenge.ad.subtitle")}
                testID="missed-modal-watch-ad"
              >
                <LinearGradient
                  colors={[current.colors.primary, current.colors.secondary]}
                  style={styles.optionGradient}
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={normalizeSize(28)}
                    color="#FFF"
                  />
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        { fontFamily: current.typography.title.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.ad.title")}
                    </Text>
                    <Text
                      style={[
                        styles.optionSubtext,
                        { fontFamily: current.typography.body.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.ad.subtitle")}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Use trophies */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleUseTrophies}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t(
                  "missedChallenge.useTrophies.title",
                  { count: trophyCost }
                )}
                accessibilityHint={t(
                  "missedChallenge.useTrophies.subtitle"
                )}
                testID="missed-modal-use-trophies"
              >
                <LinearGradient
                  colors={["#FACC15", current.colors.primary]}
                  style={styles.optionGradient}
                >
                  <Ionicons
                    name="trophy-outline"
                    size={normalizeSize(28)}
                    color="#FFF"
                  />
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        { fontFamily: current.typography.title.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.useTrophies.title", {
                        count: trophyCost,
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.optionSubtext,
                        { fontFamily: current.typography.body.fontFamily },
                      ]}
                    >
                      {t("missedChallenge.useTrophies.subtitle")}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor:
                    current.colors.error || "#FF4444",
                },
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.close")}
              testID="missed-modal-close"
            >
              <Ionicons
                name="close-circle"
                size={normalizeSize(36)}
                color="#FFF"
              />
            </TouchableOpacity>
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: normalizeSize(12),
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: normalizeSize(420),
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: normalizeSize(24),
    overflow: "hidden",
  },
  modalContent: {
    width: "100%",
    padding: normalizeSize(24),
    borderRadius: normalizeSize(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(12) },
    shadowOpacity: 0.6,
    shadowRadius: normalizeSize(20),
    elevation: 25,
  },
  header: {
    alignItems: "center",
    marginBottom: normalizeSize(24),
  },
  title: {
    fontSize: normalizeSize(28),
    color: "#FFF",
    marginTop: normalizeSize(12),
    textAlign: "center",
  },
  subtitle: {
    fontSize: normalizeSize(16),
    color: "#D1D5DB",
    textAlign: "center",
    marginTop: normalizeSize(8),
    paddingHorizontal: normalizeSize(10),
  },
  optionsContainer: {
    gap: normalizeSize(16),
  },
  optionButton: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    elevation: 8,
  },
  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(16),
    borderRadius: normalizeSize(16),
    minHeight: normalizeSize(70),
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: normalizeSize(12),
  },
  optionText: {
    fontSize: normalizeSize(18),
    color: "#FFF",
    lineHeight: normalizeSize(22),
  },
  optionSubtext: {
    fontSize: normalizeSize(14),
    color: "#E5E7EB",
    lineHeight: normalizeSize(18),
  },
  closeButton: {
    position: "absolute",
    top: normalizeSize(3),
    right: normalizeSize(3),
    borderRadius: normalizeSize(18),
    padding: normalizeSize(6),
    elevation: 10,
  },
});

export default MissedChallengeModal;
