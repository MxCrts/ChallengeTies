// components/DurationSelectionModal.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  BackHandler,
  AccessibilityInfo,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import * as Haptics from "expo-haptics";

const normalize = (size: number) => {
  const baseWidth = 375;
  const width = Math.max(
    320,
    Math.min(
      1024,
      require("react-native").Dimensions.get("window").width
    )
  );
  const scale = Math.min(Math.max(width / baseWidth, 0.7), 1.8);
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
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const CARD_MAX_W = Math.min(width - 32, 420);
  const CARD_MAX_H = Math.min(height - 96, 620);

  const [confirming, setConfirming] = useState(false);

  // Bouton retour Android : ferme le modal
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility?.(
        t("durationModal.title", { defaultValue: "Choisis la durée" })
      );
    }
  }, [visible, t]);

  const handleSelectDays = useCallback(
    (days: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onSelectDays(days);
    },
    [onSelectDays]
  );

  const safeConfirm = useCallback(() => {
    if (confirming) return;
    setConfirming(true);
    try {
      onConfirm?.();
    } finally {
      setTimeout(() => setConfirming(false), 500);
    }
  }, [confirming, onConfirm]);

  const iconsMap = useMemo(() => dayIcons, [dayIcons]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
    >
      {/* OVERLAY FULLSCREEN CENTRÉ SIMPLE */}
      <View
        style={styles.overlay}
        accessible
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        {/* Backdrop tappable */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("durationModal.closeBackdrop", {
            defaultValue: "Fermer le choix de durée",
          })}
        />

        {/* Carte centrée */}
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: currentTheme.colors.cardBackground,
              width: CARD_MAX_W,
              maxHeight: CARD_MAX_H,
            },
          ]}
        >
          <ScrollView
            style={{
              alignSelf: "stretch",
              maxHeight: CARD_MAX_H - normalize(120),
            }}
            contentContainerStyle={styles.scrollCC}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: currentTheme.colors.secondary },
              ]}
              accessibilityRole="header"
            >
              {t("durationModal.title")}
            </Text>

            <View style={styles.gridContainer}>
              {daysOptions.map((days) => {
                const selected = selectedDays === days;
                const iconName =
                  iconsMap[days] ||
                  ("calendar-outline" as keyof typeof Ionicons.glyphMap);

                return (
                  <View key={days} style={styles.gridItem}>
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
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        "durationModal.optionLabel",
                        { count: days }
                      )}
                      accessibilityHint={t("durationModal.optionHint")}
                    >
                      <Ionicons
                        name={iconName}
                        size={normalize(18)}
                        color={
                          selected ? "#fff" : currentTheme.colors.secondary
                        }
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
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Bouton confirmer */}
          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={styles.button}
              onPress={safeConfirm}
              activeOpacity={0.85}
              disabled={confirming}
              accessibilityRole="button"
              accessibilityLabel={t("durationModal.confirm")}
            >
              <LinearGradient
                colors={[
                  confirming
                    ? currentTheme.colors.textSecondary
                    : currentTheme.colors.primary,
                  confirming
                    ? currentTheme.colors.textSecondary
                    : currentTheme.colors.secondary,
                ]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {confirming
                    ? t("pleaseWait", { defaultValue: "Patiente..." })
                    : t("durationModal.confirm")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bouton annuler */}
          <View style={styles.btnWrapLast}>
            <TouchableOpacity
              style={styles.button}
              onPress={onCancel}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("durationModal.cancel")}
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
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // overlay FULLSCREEN + centrage
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  modalContent: {
    borderRadius: normalize(16),
    paddingTop: normalize(20),
    paddingHorizontal: normalize(16),
    paddingBottom: normalize(10),
    alignItems: "center",
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(10),
    elevation: 8,
  },
  scrollCC: {
    paddingBottom: normalize(10),
    alignItems: "center",
  },
  modalTitle: {
    fontSize: normalize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(12),
    textAlign: "center",
    alignSelf: "stretch",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: normalize(10),
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
    gap: normalize(6),
  },
  dayOptionText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  btnWrap: { alignSelf: "stretch" },
  btnWrapLast: { alignSelf: "stretch", marginBottom: normalize(4) },
  button: {
    alignSelf: "center",
    width: "92%",
    borderRadius: normalize(10),
    marginVertical: normalize(6),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.25,
    shadowRadius: normalize(6),
    elevation: 5,
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
