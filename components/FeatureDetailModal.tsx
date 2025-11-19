import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  BackHandler,
  AccessibilityInfo,
  Platform,
  ScrollView,
  I18nManager,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeOutDown,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalize = (size: number) => {
  const base = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / base, 0.8), 1.6);
  return Math.round(size * scale);
};

interface FeatureDetailModalProps {
  visible: boolean;
  feature: {
    id: string;
    title: string;
    votes: number;
    description?: string;
  };
  userVoted: boolean;
  onVote: (featureId: string) => void;
  onClose: () => void;
  onShare?: () => Promise<void>;
}

export default function FeatureDetailModal({
  visible,
  feature,
  userVoted,
  onVote,
  onClose,
  onShare,
}: FeatureDetailModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Animations identiques au modal OK (scale spring)
  const cardScale = useSharedValue(0.94);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  // + légère fondu interne (optionnel)
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      cardScale.value = withSpring(1, { damping: 16, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      AccessibilityInfo.announceForAccessibility?.(feature?.title || "");
      setExpanded(false);
    } else {
      opacity.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });
      cardScale.value = withTiming(0.94, { duration: 140, easing: Easing.in(Easing.quad) });
    }
  }, [visible, feature?.title, cardScale, opacity]);

  const withAlpha = useCallback((hex: string, a = 1) => {
    if (hex.startsWith("rgba")) return hex;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }, []);

  const modalBG = useMemo(
    () =>
      isDarkMode
        ? withAlpha(currentTheme.colors.cardBackground, 0.92)
        : withAlpha("#FFFFFF", 0.97),
    [isDarkMode, currentTheme.colors.cardBackground, withAlpha]
  );

  const handleVote = useCallback(async () => {
    if (busy || userVoted) return;
    try {
      setBusy(true);
      await Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onVote?.(feature.id);
    } finally {
      setTimeout(() => setBusy(false), 360);
    }
  }, [busy, userVoted, feature?.id, onVote]);

  const handleShare = useCallback(async () => {
    if (!onShare || busy) return;
    try {
      setBusy(true);
      await Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await onShare();
    } finally {
      setTimeout(() => setBusy(false), 300);
    }
  }, [busy, onShare]);

  if (!visible) return null;

  const isWide = SCREEN_WIDTH >= 420;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      supportedOrientations={[
        "portrait",
        "portrait-upside-down",
        "landscape-left",
        "landscape-right",
      ]}
    >
      {/* EXACTEMENT le même squelette que le modal qui est centré */}
      <Pressable
        style={[
          styles.overlay,
          { backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.55)" },
        ]}
        onPress={() => {
          Haptics.selectionAsync?.().catch(() => {});
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
      >
        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            entering={FadeInUp.springify()}
            exiting={FadeOutDown.duration(220)}
            style={[styles.cardShadow, cardStyle, fadeStyle]}
            pointerEvents="auto"
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? ["#121618", "#1C2526", "#263133"]
                  : [modalBG, modalBG]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.modalContainer,
                {
                  maxHeight: Math.max(
                    240,
                    SCREEN_HEIGHT - (insets.top + insets.bottom) - normalize(48)
                  ),
                  borderColor: isDarkMode ? "rgba(255,215,0,0.2)" : "transparent",
                  borderWidth: isDarkMode ? 1 : 0,
                },
              ]}
            >
              {/* Close */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  Haptics.selectionAsync?.().catch(() => {});
                  onClose();
                }}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={normalize(24)}
                  color={currentTheme.colors.primary}
                />
              </TouchableOpacity>

              {/* Title */}
              <Text
                style={[
                  styles.title,
                  {
                    color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
                    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                    textAlign: "center",
                  },
                ]}
                accessibilityRole="header"
                numberOfLines={3}
              >
                {feature.title}
              </Text>

              {/* Description */}
              {!!feature.description && (
                <View style={styles.descWrapper}>
                  <ScrollView
                    style={{ maxHeight: expanded ? normalize(220) : normalize(120) }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text
                      style={[
                        styles.description,
                        {
                          color: currentTheme.colors.textSecondary,
                          writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                          textAlign: "center",
                        },
                      ]}
                    >
                      {feature.description}
                    </Text>
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setExpanded((e) => !e)}
                    style={styles.moreLessBtn}
                    accessibilityRole="button"
                    accessibilityLabel={
                      expanded
                        ? t("featureDetail.showLess", { defaultValue: "Voir moins" })
                        : t("featureDetail.showMore", { defaultValue: "Voir plus" })
                    }
                  >
                    <Text
                      style={[
                        styles.moreLessText,
                        { color: currentTheme.colors.secondary },
                      ]}
                    >
                      {expanded
                        ? t("featureDetail.showLess", { defaultValue: "Voir moins" })
                        : t("featureDetail.showMore", { defaultValue: "Voir plus" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Votes */}
              <View style={styles.rowCenter}>
                <Ionicons
                  name="heart"
                  size={normalize(18)}
                  color={currentTheme.colors.secondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.voteCount,
                    { color: currentTheme.colors.secondary, fontVariant: ["tabular-nums"] as any },
                  ]}
                >
                  {t("featureDetail.votes", { count: feature.votes ?? 0 })}
                </Text>
              </View>

              {/* Actions */}
              <View
                style={[
                  styles.buttonsBlock,
                  { flexDirection: isWide ? "row" : "column" },
                ]}
              >
                {!userVoted ? (
                  <TouchableOpacity
                    style={[
                      styles.ctaButton,
                      {
                        backgroundColor: busy
                          ? withAlpha(currentTheme.colors.primary, 0.6)
                          : currentTheme.colors.primary,
                        flex: isWide ? 1 : undefined,
                      },
                    ]}
                    onPress={handleVote}
                    activeOpacity={0.92}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t("featureDetail.vote", { defaultValue: "Voter" })}
                  >
                    <Ionicons
                      name="thumbs-up-outline"
                      size={normalize(18)}
                      color={currentTheme.colors.cardBackground}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.ctaText, { color: currentTheme.colors.cardBackground }]}>
                      {t("featureDetail.vote", { defaultValue: "Voter" })}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.alreadyVotedBadge,
                      { flex: isWide ? 1 : undefined, borderColor: "rgba(0,0,0,0.08)" },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={normalize(18)}
                      color={currentTheme.colors.secondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.alreadyVotedText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {t("featureDetail.alreadyVoted", { defaultValue: "Déjà voté — merci 💜" })}
                    </Text>
                  </View>
                )}

                {!!onShare && (
                  <TouchableOpacity
                    style={[
                      styles.ctaButton,
                      {
                        backgroundColor: currentTheme.colors.secondary,
                        flex: isWide ? 1 : undefined,
                      },
                    ]}
                    onPress={handleShare}
                    activeOpacity={0.92}
                    accessibilityRole="button"
                    accessibilityLabel={t("featureDetail.share", { defaultValue: "Partager" })}
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={normalize(18)}
                      color={currentTheme.colors.cardBackground}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.ctaText, { color: currentTheme.colors.cardBackground }]}>
                      {t("featureDetail.share", { defaultValue: "Partager" })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // EXACTEMENT comme le modal centré
  overlay: {
    flex: 1,
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cardShadow: {
    width: "92%",
    maxWidth: 520,
    borderRadius: normalize(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
    alignSelf: "center",
  },
  modalContainer: {
    borderRadius: normalize(18),
    paddingVertical: normalize(18),
    paddingHorizontal: normalize(16),
  },

  closeButton: {
    position: "absolute",
    top: normalize(8),
    right: normalize(8),
    zIndex: 2,
    padding: normalize(4),
  },
  title: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(8),
    textAlign: "center",
    paddingHorizontal: normalize(8),
  },
  descWrapper: {
    alignSelf: "stretch",
    marginTop: normalize(8),
    marginBottom: normalize(8),
  },
  description: {
    fontSize: normalize(15),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalize(21),
    textAlign: "center",
  },
  moreLessBtn: {
    alignSelf: "center",
    marginTop: normalize(6),
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(10),
  },
  moreLessText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_700Bold",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: normalize(6),
    marginBottom: normalize(10),
  },
  voteCount: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
  },
  buttonsBlock: {
    alignSelf: "stretch",
    width: "100%",
    gap: normalize(10),
    marginTop: normalize(2),
  },
  ctaButton: {
    minHeight: normalize(46),
    borderRadius: normalize(14),
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(12),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.22,
    shadowRadius: normalize(6),
    elevation: 6,
  },
  ctaText: {
    fontSize: normalize(15),
    fontFamily: "Comfortaa_700Bold",
  },
  alreadyVotedBadge: {
    minHeight: normalize(46),
    borderRadius: normalize(14),
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(10),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  alreadyVotedText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
  },
});
