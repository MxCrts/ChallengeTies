// components/SelectModeModal.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  AccessibilityInfo,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

type Mode = "solo" | "duo";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (mode: Mode) => void;

  isOffline?: boolean;

  isDark?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function SelectModeModal({
  visible,
  onClose,
  onPick,
  isOffline = false,
  isDark = true,
  primaryColor = "#F4D35E",
  secondaryColor = "#00FFFF",
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const IS_TINY = W < 360;

  const [reduceMotion, setReduceMotion] = useState(false);

  // Entry/exit animation (aggressive but classy)
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.965)).current;
  const lift = useRef(new Animated.Value(14)).current;

  // Duo effects
  const shineX = useRef(new Animated.Value(0)).current;
  const duoPulse = useRef(new Animated.Value(0)).current;

  const runIn = useCallback(() => {
    fade.setValue(0);
    scale.setValue(0.965);
    lift.setValue(14);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 18,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale, lift]);

  const runOut = useCallback(
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.985,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 10,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => cb?.());
    },
    [fade, scale, lift]
  );

  useEffect(() => {
    let sub: any;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
    sub = (AccessibilityInfo as any).addEventListener?.(
      "reduceMotionChanged",
      (v: boolean) => setReduceMotion(!!v)
    );
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      fade.setValue(1);
      scale.setValue(1);
      lift.setValue(0);
      return;
    }

    runIn();

    // Shine loop
    shineX.setValue(0);
    const shineLoop = Animated.loop(
      Animated.timing(shineX, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    shineLoop.start();

    // Pulse loop
    duoPulse.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(duoPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(duoPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      shineLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, reduceMotion, runIn, fade, scale, lift, shineX, duoPulse]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility?.(
        t("challengeDetails.startMode.title", { defaultValue: "Choisis ton mode" })
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [visible, t]);

  const maxCardW = useMemo(() => clamp(W - 28, 320, 520), [W]);
  const maxCardH = useMemo(() => Math.min(H * 0.84, 560), [H]);

  const backdropPad = useMemo(
    () => ({
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 14,
    }),
    []
  );

  // ✅ i18n
  const title = t("challengeDetails.startMode.title", { defaultValue: "Choisis ton mode" });
  const subtitle = t("challengeDetails.startMode.sub", {
    defaultValue: "Solo pour avancer. Duo pour tenir jusqu’au bout.",
  });
  const recommendedLabel = t("challengeDetails.startMode.recommended", { defaultValue: "RECOMMANDÉ" });

  const duoTitle = t("challengeDetails.startMode.duo", { defaultValue: "Duo" });
  const duoDesc = t("challengeDetails.startMode.duoDesc", { defaultValue: "Invite un ami. Tiens jusqu’au bout." });
  const soloTitle = t("challengeDetails.startMode.solo", { defaultValue: "Solo" });
  const soloDesc = t("challengeDetails.startMode.soloDesc", { defaultValue: "Simple, rapide, efficace." });

  const a11yPickDuoLabel = t("challengeDetails.startMode.duoA11y", { defaultValue: "Choisir Duo" });
  const a11yPickSoloLabel = t("challengeDetails.startMode.soloA11y", { defaultValue: "Choisir Solo" });
  const a11yPickDuoHint = t("challengeDetails.startMode.duoHint", {
    defaultValue: "Ensuite, choisis une durée et invite un ami.",
  });
  const a11yPickSoloHint = t("challengeDetails.startMode.soloHint", {
    defaultValue: "Ensuite, choisis une durée et démarre.",
  });

  const cancelLabel = t("challengeDetails.startMode.cancel", { defaultValue: "Annuler" });
  const a11yCloseLabel = t("challengeDetails.startMode.closeA11y", { defaultValue: "Fermer" });
  const a11yCloseHint = t("challengeDetails.startMode.closeHint", { defaultValue: "Ferme la fenêtre." });
  const offlineLabel = t("challengeDetails.startMode.offlineRequired", { defaultValue: "Connexion requise" });

  const textMain = isDark ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.92)";
  const textSub = isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.62)";
  const textSub2 = isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)";

  const handleClose = useCallback(() => {
    Haptics.selectionAsync?.().catch(() => {});
    const doClose = () => onClose();
    if (reduceMotion) return doClose();
    runOut(() => doClose());
  }, [onClose, reduceMotion, runOut]);

  const handlePick = useCallback(
    (mode: Mode) => {
      if (isOffline && mode === "duo") {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      Haptics.impactAsync?.(
        mode === "duo" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
      onPick(mode);
    },
    [isOffline, onPick]
  );

  const duoShineTranslate = shineX.interpolate({
    inputRange: [0, 1],
    outputRange: [-W * 0.55, W * 0.55],
  });

  const duoRingOpacity = duoPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={[styles.backdrop, backdropPad]}>
        {/* Backdrop tap */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={a11yCloseLabel}
          accessibilityHint={a11yCloseHint}
        />

        {/* Cinematic layers */}
        <Animated.View pointerEvents="none" style={[styles.vignette, { opacity: fade }]} />
        <Animated.View pointerEvents="none" style={[styles.colorWash, { opacity: fade }]}>
          <LinearGradient
            colors={["rgba(0,255,255,0.10)", "rgba(244,211,94,0.08)", "rgba(0,0,0,0.00)"]}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.8, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.cardShell,
            {
              width: maxCardW,
              maxHeight: maxCardH,
              marginBottom: Math.max(10, insets.bottom + 10),
              opacity: fade,
              transform: [{ translateY: lift }, { scale }],
            },
            Platform.OS === "android" ? styles.cardAndroidShadow : null,
          ]}
        >
          {/* Outer glow */}
          <View pointerEvents="none" style={styles.outerGlow}>
            <LinearGradient
              colors={["rgba(0,255,255,0.18)", "rgba(244,211,94,0.14)", "rgba(255,255,255,0.00)"]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <BlurView
            intensity={Platform.OS === "ios" ? 28 : 18}
            tint={isDark ? "dark" : "light"}
            style={styles.cardBlur}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.055)"]
                  : ["rgba(255,255,255,0.94)", "rgba(255,255,255,0.82)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardInner}
            >
              {/* double stroke */}
              <View pointerEvents="none" style={styles.strokeOuter} />
              <View pointerEvents="none" style={styles.strokeInner} />

              {/* Close */}
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={a11yCloseLabel}
                accessibilityHint={a11yCloseHint}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                ]}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ["rgba(255,255,255,0.09)", "rgba(255,255,255,0.04)"]
                      : ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.02)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name="close"
                  size={18}
                  color={isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.85)"}
                />
              </Pressable>

              {/* Scroll */}
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={styles.iconPill}>
                    <LinearGradient
                      colors={["rgba(244,211,94,0.30)", "rgba(0,255,255,0.18)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons
                      name="flash-outline"
                      size={18}
                      color={isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)"}
                    />
                  </View>

                  <View style={styles.headerText}>
                    <Text style={[styles.title, { color: textMain }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={[styles.subtitle, { color: textSub }]} numberOfLines={IS_TINY ? 4 : 3}>
                      {subtitle}
                    </Text>
                  </View>
                </View>

                {/* Options */}
                <View style={IS_TINY ? styles.gridStack : styles.gridRow}>
                  {/* DUO */}
                  <Pressable
                    onPress={() => handlePick("duo")}
                    disabled={isOffline}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isOffline }}
                    accessibilityLabel={a11yPickDuoLabel}
                    accessibilityHint={a11yPickDuoHint}
                    style={({ pressed }) => [
                      styles.option,
                      !IS_TINY && styles.optionHalf,
                      styles.optionDuo,
                      isOffline && styles.optionDisabled,
                      pressed && !isOffline && styles.optionPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={["rgba(244,211,94,0.30)", "rgba(0,255,255,0.16)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />

                    <Animated.View pointerEvents="none" style={[styles.duoRing, { opacity: duoRingOpacity }]} />

                    {!reduceMotion && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.duoShine,
                          { transform: [{ translateX: duoShineTranslate }, { rotate: "-18deg" }] },
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            "rgba(255,255,255,0.00)",
                            isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.24)",
                            "rgba(255,255,255,0.00)",
                          ]}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={StyleSheet.absoluteFill}
                        />
                      </Animated.View>
                    )}

                    <View style={styles.topRow}>
                      <Ionicons
                        name="people-outline"
                        size={20}
                        color={isDark ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.92)"}
                      />
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{recommendedLabel}</Text>
                      </View>
                    </View>

                    <Text style={[styles.optionTitle, { color: textMain }]}>{duoTitle}</Text>

                    <Text
                      style={[styles.optionSub, { color: textSub2 }, IS_TINY && styles.optionSubTiny]}
                      numberOfLines={IS_TINY ? 3 : 2}
                    >
                      {duoDesc}
                    </Text>

                    {isOffline && (
                      <View style={styles.offlineRow}>
                        <View style={styles.lockPill}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={14}
                            color={isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.85)"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.offlineText,
                            { color: isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.80)" },
                          ]}
                          numberOfLines={2}
                        >
                          {offlineLabel}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {/* SOLO */}
                  <Pressable
                    onPress={() => handlePick("solo")}
                    accessibilityRole="button"
                    accessibilityLabel={a11yPickSoloLabel}
                    accessibilityHint={a11yPickSoloHint}
                    style={({ pressed }) => [
                      styles.option,
                      !IS_TINY && styles.optionHalf,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isDark
                          ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.06)"]
                          : ["rgba(0,0,0,0.04)", "rgba(0,0,0,0.02)"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.topRow}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.90)"}
                      />
                      <View style={styles.badgeSpacer} />
                    </View>

                    <Text style={[styles.optionTitle, { color: textMain }]}>{soloTitle}</Text>

                    <Text
                      style={[styles.optionSub, { color: textSub2 }, IS_TINY && styles.optionSubTiny]}
                      numberOfLines={IS_TINY ? 3 : 2}
                    >
                      {soloDesc}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>

              {/* Footer fixed */}
              <View style={[styles.footer, { paddingBottom: Math.max(10, insets.bottom + 6) }]}>
                <Pressable
                  onPress={handleClose}
                  accessibilityRole="button"
                  accessibilityLabel={cancelLabel}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && { opacity: 0.90, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <Text
                    style={[
                      styles.cancelText,
                      { color: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)" },
                    ]}
                  >
                    {cancelLabel}
                  </Text>
                </Pressable>

                <View pointerEvents="none" style={styles.footerAccent}>
                  <LinearGradient
                    colors={[primaryColor, secondaryColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },

  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  colorWash: {
    ...StyleSheet.absoluteFillObject,
  },

  cardShell: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  cardAndroidShadow: {
    elevation: 16,
  },

  outerGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },

  cardBlur: {
    borderRadius: 28,
    overflow: "hidden",
  },
  cardInner: {
    borderRadius: 28,
    overflow: "hidden",
    paddingTop: 16,
  },

  strokeOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  strokeInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    margin: 1,
  },

  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 5,
  },

  scroll: { flexGrow: 0 },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingRight: 44,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    marginRight: 12, // ✅ remplace gap (compat)
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 13.2,
    lineHeight: 17.5,
    fontWeight: "600",
  },

  // ✅ pas de gap -> compat
  gridRow: {
    flexDirection: "row",
  },
  gridStack: {
    flexDirection: "column",
  },

  option: {
    borderRadius: 22,
    padding: 14,
    minHeight: 128,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  optionHalf: {
    flex: 1,
  },

  // spacing between cards without gap
  // row: add marginRight on first card + marginTop when stacked
  optionDuo: {
    borderColor: "rgba(0,255,255,0.30)",
    marginRight: 12,
  },

  optionPressed: {
    transform: [{ scale: 0.988 }],
    opacity: 0.98,
  },

  optionDisabled: {
    opacity: 0.75,
  },

  duoRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.22)",
  },

  duoShine: {
    position: "absolute",
    top: -50,
    bottom: -50,
    width: 130,
    opacity: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  badgeSpacer: {
    width: 92,
    height: 22,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.20)",
  },
  badgeText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  optionTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  optionSub: {
    fontSize: 12.9,
    lineHeight: 16.7,
    fontWeight: "600", // ✅ valid RN
  },
  optionSubTiny: {
    fontSize: 12.6,
    lineHeight: 16.2,
  },

  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
  lockPill: {
    width: 24,
    height: 24,
    borderRadius: 9,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    marginRight: 8, // ✅ remplace gap
  },
  offlineText: {
    fontSize: 12,
    fontWeight: "800", // ✅ valid RN
    opacity: 0.98,
    flex: 1,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  cancelBtn: {
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cancelText: {
    fontSize: 14.2,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  footerAccent: {
    marginTop: 10,
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    opacity: 0.92,
  },
});
