import React, { useEffect } from "react";
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
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const scale = useSharedValue(1);
  const scaleAnim = useSharedValue(0.8);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  useEffect(() => {
    console.log("Viewport:", { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }); // Log pour déboguer
    if (visible) {
      scaleAnim.value = withSpring(1, { damping: 10, stiffness: 80 });
    } else {
      scaleAnim.value = withTiming(0.8, { duration: 200 });
    }
  }, [visible]);

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const handleSelectDays = (days: number) => {
    scale.value = withTiming(1.1, { duration: 100 }, () => {
      scale.value = withTiming(1, { duration: 100 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectDays(days);
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalContainer}>
        <Animated.View
          entering={FadeInUp.springify()}
          exiting={FadeOutDown.duration(300)}
          style={[
            styles.modalContent,
            animatedScaleStyle,
            { backgroundColor: currentTheme.colors.cardBackground },
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              { color: currentTheme.colors.secondary },
            ]}
          >
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
                        shadowColor: selected
                          ? currentTheme.colors.primary
                          : "#000",
                      },
                    ]}
                    onPress={() => handleSelectDays(days)}
                    activeOpacity={0.8}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                  >
                    <Ionicons
                      name={dayIcons[days] || "calendar-outline"}
                      size={normalize(18)}
                      color={selected ? "#fff" : currentTheme.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.dayOptionText,
                        {
                          color: selected
                            ? "#fff"
                            : currentTheme.colors.textSecondary,
                        },
                      ]}
                    >
                      {t("durationModal.days", { count: days })}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <Animated.View
            entering={FadeInUp.delay(200)}
            style={buttonAnimatedStyle}
          >
            <TouchableOpacity
              style={styles.button}
              onPress={onConfirm}
              activeOpacity={0.8}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {t("durationModal.confirm")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(300)}
            style={buttonAnimatedStyle}
          >
            <TouchableOpacity
              style={styles.button}
              onPress={onCancel}
              activeOpacity={0.8}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.error,
                  currentTheme.colors.error + "CC",
                ]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {t("durationModal.cancel")}
                </Text>
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
    minHeight: normalize(200), // Hauteur minimale pour éviter compression
    borderRadius: normalize(16),
    paddingVertical: normalize(20),
    paddingHorizontal: normalize(16),
    alignItems: "center",
    justifyContent: "center", // Centrage vertical interne
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
    justifyContent: "center", // Centrage horizontal de la grille
    alignItems: "center",
    width: "100%",
    marginBottom: normalize(20),
  },
  gridItem: {
    width: "46%", // Réduit pour espacement uniforme
    marginVertical: normalize(6),
    marginHorizontal: normalize(4), // Centrage symétrique
    alignItems: "center",
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%", // Occupe tout l’espace du gridItem
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(12), // Réduit pour compacité
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
    marginHorizontal: normalize(4), // Symétrique
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
