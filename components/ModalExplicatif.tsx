import React, { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
  Platform,
  Dimensions,
  I18nManager,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import Animated, {
  FadeInUp,
  FadeOutDown,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type ModalExplicatifProps = {
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalize = (size: number) => {
  const baseWidth = 375;
  const w = Math.max(320, Math.min(1024, SCREEN_WIDTH));
  const scale = Math.min(Math.max(w / baseWidth, 0.8), 1.6);
  return Math.round(size * scale);
};

export default function ModalExplicatif({ onClose }: ModalExplicatifProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  // Anim scale carte + légère pop du bouton
  const cardScale = useSharedValue(0.94);
  const btnScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
  // annonce vocale + pop in
  AccessibilityInfo.announceForAccessibility?.(t("explanation.title"));
  cardScale.value = withSpring(1, { damping: 16, stiffness: 160 });
}, [t, cardScale]);


  const handleClose = () => {
    // légère pop out + haptique
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    cardScale.value = withTiming(0.94, { duration: 140 });
    onClose?.();
  };

  const bulletItems = useMemo(
    () => [
      t("explanation.optionsIntro"),
      `• ${t("explanation.optionVote")}`,
      `• ${t("explanation.optionPropose")}`,
      t("explanation.outcome"),
    ],
    [t]
  );

  const styles = createStyles(isDarkMode, currentTheme);

  return (
    <Modal
      animationType="fade"
      transparent
      visible
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
    >
      {/* Backdrop plein écran (fermeture au tap) */}
      <Pressable
        style={styles.overlay}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={t("explanation.dismissBackdrop")}
      >
        {/* Stop propagation pour ne pas fermer quand on tape la carte */}
        <View style={styles.centerWrap} pointerEvents="box-none">
  <Pressable
    onPress={() => {}}
    style={styles.cardShadow}
    pointerEvents="auto"
    accessible={false}
  >
    <Animated.View
      entering={FadeInUp.springify()}
      exiting={FadeOutDown.duration(220)}
      style={cardStyle}
    >
      <LinearGradient
        colors={
          isDarkMode
            ? ["#121618", "#1C2526", "#263133"]
            : [currentTheme.colors.cardBackground, currentTheme.colors.cardBackground + "E6"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.modalContainer}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Ionicons
            name="sparkles-outline"
            size={normalize(22)}
            color={isDarkMode ? "#FFD700" : currentTheme.colors.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text
            style={[
              styles.title,
              { color: isDarkMode ? currentTheme.colors.textPrimary : "#000" },
            ]}
            accessibilityRole="header"
          >
            {t("explanation.title")}
          </Text>

          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("commonS.close")}
            style={styles.iconClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close"
              size={normalize(20)}
              color={isDarkMode ? currentTheme.colors.textSecondary : "#222"}
            />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <Text style={styles.message}>{t("explanation.welcome")}</Text>
        {bulletItems.map((line, i) => (
          <Text key={i} style={styles.message}>
            {line}
          </Text>
        ))}

        {/* CTA */}
        <Animated.View style={[btnStyle, styles.btnWrap]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={() => (btnScale.value = withTiming(0.98, { duration: 80 }))}
            onPressOut={() => (btnScale.value = withTiming(1, { duration: 120 }))}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("explanation.understood")}
            style={styles.ctaTouchable}
          >
            <LinearGradient
              colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={normalize(20)} color="#000" />
              <Text style={styles.ctaText}>{t("explanation.understood")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  </Pressable>
</View>

      </Pressable>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean, currentTheme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
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
    },
    modalContainer: {
      borderRadius: normalize(18),
      paddingVertical: normalize(18),
      paddingHorizontal: normalize(16),
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? "rgba(255,215,0,0.2)" : "transparent",
    },
    headerRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: normalize(10),
  position: "relative",
  minHeight: normalize(32),
  paddingRight: normalize(40), // ✅ on réserve la place du bouton close
  paddingLeft: normalize(8),
},
 iconClose: {
  position: "absolute",
  right: normalize(4),
  top: normalize(2),
  width: normalize(32),
  height: normalize(32),
  borderRadius: normalize(16),
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
},

    title: {
  fontSize: normalize(20),
  fontFamily: currentTheme.typography.title.fontFamily,
  textAlign: I18nManager.isRTL ? "right" : "center",
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  flexShrink: 1,                        // ✅ le texte rétrécit / wrap au lieu de pousser
  marginHorizontal: normalize(8),       // petit espace autour
},
    message: {
  fontSize: normalize(14),
  fontFamily: currentTheme.typography.body.fontFamily,
  color: currentTheme.colors.textSecondary,
  textAlign: I18nManager.isRTL ? "right" : "center",
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  marginBottom: normalize(8),
  lineHeight: normalize(20),
},

    btnWrap: {
      marginTop: normalize(14),
      alignSelf: "stretch",
    },
    ctaTouchable: {
      alignSelf: "center",
      width: "88%",
      borderRadius: normalize(14),
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 8,
    },
    ctaGradient: {
      paddingVertical: normalize(12),
      paddingHorizontal: normalize(16),
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: normalize(8),
    },
    ctaText: {
      color: "#000",
      fontSize: normalize(15),
      fontFamily: currentTheme.typography.title.fontFamily,
      textAlign: "center",
    },
  });
