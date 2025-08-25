import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeOutDown,
  Layout,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface DurationSelectionModalProps {
  visible: boolean;
  daysOptions: number[];
  selectedDays: number;
  onSelectDays: (days: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  dayIcons: Record<number, keyof typeof Ionicons.glyphMap>;
}

const EXIT_ANIM_MS = 300;
const REOPEN_COOLDOWN_MS = 400;

const DurationSelectionModal: React.FC<DurationSelectionModalProps> = ({
  visible,
  daysOptions,
  selectedDays,
  onSelectDays,
  onConfirm,
  onCancel,
  dayIcons,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  // --- Anti "bounce": on contrôle le montage indépendamment de `visible`
  const [mounted, setMounted] = useState<boolean>(false);
  const [closing, setClosing] = useState<boolean>(false);
  const lastCloseAtRef = useRef<number>(0);

  // Empêche double tap sur "Confirmer"
  const [confirming, setConfirming] = useState<boolean>(false);

  // Animations
  const pressScale = useSharedValue(1);
  const cardScale = useSharedValue(0.9);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Synchronisation `visible` -> `mounted` avec anti-rebond
  useEffect(() => {
    if (visible) {
      // Si on tente de rouvrir trop vite après une fermeture, on ignore
      if (Date.now() - lastCloseAtRef.current < REOPEN_COOLDOWN_MS) {
        return;
      }
      setClosing(false);
      setMounted(true);
      // petit délai pour que l’Animated.View monte proprement puis spring
      requestAnimationFrame(() => {
        cardScale.value = withSpring(1, { damping: 12, stiffness: 120 });
      });
    } else if (mounted && !closing) {
      // Lance l’animation de sortie puis démonte
      setClosing(true);
      cardScale.value = withTiming(0.9, { duration: 160 }, () => {
        runOnJS(setMounted)(false);
        runOnJS(setClosing)(false);
        lastCloseAtRef.current = Date.now();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sélection d’un nombre de jours (mini feedback)
  const handleSelectDays = useCallback(
    (days: number) => {
      pressScale.value = withTiming(1.1, { duration: 100 }, () => {
        pressScale.value = withTiming(1, { duration: 100 });
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectDays(days);
    },
    [onSelectDays, pressScale]
  );

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.96, { duration: 90 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withTiming(1, { duration: 90 });
  }, [pressScale]);

  const safeConfirm = useCallback(() => {
    if (confirming) return;          // garde-fou double-tap
    setConfirming(true);
    try {
      onConfirm();                   // Le parent fermera le modal (visible=false)
    } finally {
      // On laisse le parent gérer la fermeture; on débloque le bouton
      // après une petite fenêtre pour éviter double toggles/taps.
      setTimeout(() => setConfirming(false), 500);
    }
  }, [confirming, onConfirm]);

  // Mémo des icônes (évite recalcul)
  const iconsMap = useMemo(() => dayIcons, [dayIcons]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={styles.modalContainer}>
        <Animated.View
          entering={FadeInUp.springify()}
          exiting={FadeOutDown.duration(EXIT_ANIM_MS)}
          style={[
            styles.modalContent,
            cardAnimatedStyle,
            { backgroundColor: currentTheme.colors.cardBackground },
          ]}
        >
          <Text style={[styles.modalTitle, { color: currentTheme.colors.secondary }]}>
            {t("durationModal.title")}
          </Text>

          <View style={styles.gridContainer}>
            {daysOptions.map((days, index) => {
              const selected = selectedDays === days;
              return (
                <Animated.View
                  key={days}
                  entering={FadeInUp.delay(100 + index * 50)}
                  layout={Layout.springify()}
                  style={styles.gridItem}
                >
                  <TouchableOpacity
                    style={[
                      styles.dayOption,
                      {
                        borderColor: currentTheme.colors.primary,
                        backgroundColor: selected
                          ? currentTheme.colors.primary
                          : currentTheme.colors.background,
                        shadowColor: selected ? currentTheme.colors.primary : "#000",
                      },
                    ]}
                    onPress={() => handleSelectDays(days)}
                    activeOpacity={0.85}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                  >
                    <Ionicons
                      name={iconsMap[days] || ("calendar-outline" as any)}
                      size={normalize(18)}
                      color={selected ? "#fff" : currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.dayOptionText,
                        { color: selected ? "#fff" : currentTheme.colors.textSecondary },
                      ]}
                    >
                      {t("durationModal.days", { count: days })}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <Animated.View entering={FadeInUp.delay(200)} style={buttonAnimatedStyle}>
            <TouchableOpacity
              style={styles.button}
              onPress={safeConfirm}
              activeOpacity={0.85}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={confirming}
            >
              <LinearGradient
                colors={[
                  confirming ? currentTheme.colors.textSecondary : currentTheme.colors.primary,
                  confirming ? currentTheme.colors.textSecondary : currentTheme.colors.secondary,
                ]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {confirming ? t("pleaseWait", { defaultValue: "Patiente..." }) : t("durationModal.confirm")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300)} style={buttonAnimatedStyle}>
            <TouchableOpacity
              style={styles.button}
              onPress={onCancel}
              activeOpacity={0.85}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <LinearGradient
                colors={[currentTheme.colors.error, currentTheme.colors.error + "CC"]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{t("durationModal.cancel")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    width: "80%",
    maxWidth: normalize(360),
    minHeight: normalize(200),
    borderRadius: normalize(16),
    paddingVertical: normalize(20),
    paddingHorizontal: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(10),
    elevation: 8,
  },
  modalTitle: {
    fontSize: normalize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(16),
    textAlign: "center",
    width: "100%",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: normalize(20),
  },
  gridItem: {
    width: "46%",
    marginVertical: normalize(6),
    marginHorizontal: normalize(4),
    alignItems: "center",
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(10),
    borderWidth: normalize(1.5),
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(4),
    elevation: 3,
  },
  dayOptionText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    marginHorizontal: normalize(4),
  },
  button: {
    width: "90%",
    borderRadius: normalize(10),
    marginVertical: normalize(6),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(6),
    elevation: 5,
    alignSelf: "center",
  },
  buttonGradient: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(24),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: normalize(15),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
});

export default DurationSelectionModal;
