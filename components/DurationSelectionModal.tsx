// components/DurationSelectionModal.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  Platform,
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
    Math.min(1024, require("react-native").Dimensions.get("window").width)
  );
  const scale = Math.min(Math.max(width / baseWidth, 0.75), 1.7);
  return Math.round(size * scale);
};

// rgba helper (hex/rgb -> rgba avec alpha)
const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
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

  const CARD_MAX_W = Math.min(width - 28, 440);
  const CARD_MAX_H = Math.min(height - 86, 660);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      onConfirm?.();
    } finally {
      setTimeout(() => setConfirming(false), 520);
    }
  }, [confirming, onConfirm]);

  const iconsMap = useMemo(() => dayIcons, [dayIcons]);

    // Micro copy unique par durée (clé dédiée par option)
  // ex: durationModal.micro.7, durationModal.micro.14, etc.
  const MICRO_DEFAULTS: Record<number, string> = useMemo(
    () => ({
      3: "Test rapide. Zéro pression, juste l’élan.",
      5: "Format nerveux. Lance-toi et valide.",
      7: "Le classique : simple, efficace, motivant.",
      10: "Bon rythme : assez long pour créer l’habitude.",
      14: "Transformation visible. Tu commences à te prouver.",
      21: "Discipline réelle. Là tu changes de niveau.",
      30: "Mode sérieux. Identité + constance.",
      45: "Marathon mental. Tu deviens inarrêtable.",
      60: "Engagement total. Nouveau standard.",
      90: "Élite. Tu reprogrammes ton cerveau.",
    }),
    []
  );

  const microKeyForDays = useCallback(
    (days: number) => `durationModal.micro.${days}`,
    []
  );

  const microDefaultForDays = useCallback(
    (days: number) => {
      // unique si on a un texte dédié
      if (MICRO_DEFAULTS[days]) return MICRO_DEFAULTS[days];

      // fallback (au pire 2 répétitions max)
      if (days <= 7) return "Court et puissant. Parfait pour démarrer.";
      if (days <= 21) return "Le sweet spot : tu construis l’habitude.";
      return "Long terme : discipline + identité.";
    },
    [MICRO_DEFAULTS]
  );

  const columns = useMemo(() => {
    // Téléphone => 2 colonnes (lisible). Tablette => 3.
    return width >= 640 ? 3 : 2;
  }, [width]);


   const optionW = useMemo(() => {
    const gap = normalize(10);
    const pad = normalize(14) * 2; // ↓ moins de padding = cartes plus larges
    const available = CARD_MAX_W - pad - gap * (columns - 1);
    return Math.floor(available / columns);
  }, [CARD_MAX_W, columns]);

  if (!visible) return null;

  const bg = currentTheme.colors.background;
  const cardBg = currentTheme.colors.cardBackground;
  const primary = currentTheme.colors.primary;
  const secondary = currentTheme.colors.secondary;
  const textPrimary = currentTheme.colors.textPrimary;
  const textSecondary = currentTheme.colors.textSecondary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
    >
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

        {/* Ambient orbs */}
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(primary, 0.34), "transparent"]}
          style={[
            styles.orbTop,
            { width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45 },
          ]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(secondary, 0.26), "transparent"]}
          style={[
            styles.orbBottom,
            { width: width * 1.05, height: width * 1.05, borderRadius: width * 0.525 },
          ]}
          start={{ x: 0.9, y: 0.1 }}
          end={{ x: 0.1, y: 0.9 }}
        />

        {/* Card */}
        <View
          style={[
            styles.cardWrap,
            {
              width: CARD_MAX_W,
              maxHeight: CARD_MAX_H,
            },
          ]}
        >
          {/* Glass border */}
          <LinearGradient
            colors={[
              withAlpha("#FFFFFF", isDarkMode ? 0.10 : 0.65),
              withAlpha("#FFFFFF", isDarkMode ? 0.04 : 0.25),
            ]}
            style={[
              styles.glassBorder,
              {
                borderColor: withAlpha("#FFFFFF", isDarkMode ? 0.10 : 0.35),
              },
            ]}
          >
            {/* Inner surface */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: withAlpha(cardBg, isDarkMode ? 0.92 : 0.96),
                  borderColor: withAlpha(primary, isDarkMode ? 0.20 : 0.18),
                },
              ]}
            >
              {/* Top bar: handle + close */}
              <View style={styles.topBar}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: withAlpha(textSecondary, isDarkMode ? 0.28 : 0.22) },
                  ]}
                />
                <TouchableOpacity
                  onPress={onCancel}
                  activeOpacity={0.85}
                  style={[
                    styles.closeBtn,
                    {
                      backgroundColor: withAlpha(bg, isDarkMode ? 0.32 : 0.55),
                      borderColor: withAlpha("#FFFFFF", isDarkMode ? 0.12 : 0.35),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("durationModal.cancel", {
                    defaultValue: "Annuler",
                  })}
                >
                  <Ionicons
                    name="close"
                    size={normalize(18)}
                    color={isDarkMode ? "#fff" : "#111"}
                  />
                </TouchableOpacity>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View
                  style={[
                    styles.headerIconWrap,
                    {
                      backgroundColor: withAlpha(primary, isDarkMode ? 0.18 : 0.14),
                      borderColor: withAlpha(primary, isDarkMode ? 0.22 : 0.18),
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={normalize(18)}
                    color={secondary}
                  />
                </View>

                <Text
                  style={[
                    styles.title,
                    { color: isDarkMode ? textPrimary : "#0B0B0F" },
                  ]}
                  accessibilityRole="header"
                >
                  {t("durationModal.title", { defaultValue: "Choisis la durée" })}
                </Text>

                <Text style={[styles.subtitle, { color: textSecondary }]}>
                  {t("durationModal.subtitle", {
                    defaultValue: "Sélectionne un format simple. Tu pourras l’ajuster plus tard.",
                  })}
                </Text>
              </View>

              {/* Options */}
              <ScrollView
                style={{ alignSelf: "stretch" }}
                contentContainerStyle={[
                  styles.optionsCC,
                  { paddingBottom: normalize(10) },
                ]}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.grid, { gap: normalize(10) }]}>
                  {daysOptions.map((days) => {
                    const selected = selectedDays === days;
                    const isLegend = days >= 365;   // 365 only chez toi
const isPrestige = days >= 90;  // 90,180,365

                    const iconName =
                      iconsMap[days] ||
                      ("calendar-outline" as keyof typeof Ionicons.glyphMap);

                    return (
                                           <TouchableOpacity
                        key={days}
                        style={[
                          styles.option,
                          {
                            width: optionW,
                            borderColor: selected
                              ? withAlpha(primary, 0.85)
                              : withAlpha(textSecondary, isDarkMode ? 0.22 : 0.18),
                            backgroundColor: selected
                              ? "transparent"
                              : withAlpha(cardBg, isDarkMode ? 0.55 : 0.92),
                          },
                        ]}
                        onPress={() => handleSelectDays(days)}
                        activeOpacity={0.92}
                        accessibilityRole="button"
                        accessibilityLabel={t("durationModal.optionLabel", {
                          count: days,
                        })}
                        accessibilityHint={t("durationModal.optionHint", {
                          defaultValue: "Sélectionne cette durée.",
                        })}
                      >
                        {selected ? (
                          <LinearGradient
                            colors={[secondary, primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.optionInner}
                          >
                            <View style={styles.optionRow}>
  <View style={[styles.optionIcon, styles.optionIconSelected]}>
    <Ionicons name={iconName} size={normalize(16)} color="#fff" />
  </View>

  {/* Days badge (top-right) */}
  <View style={styles.daysBadgeWrap}>
    <LinearGradient
      colors={[withAlpha("#FFFFFF", 0.30), withAlpha("#FFFFFF", 0.12)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
  styles.daysBadge,
  styles.daysBadgeSelected,
  isPrestige && styles.daysBadgePrestige,
  isLegend && styles.daysBadgeLegend,
]}
    >
      <Text style={[styles.daysBadgeNum, styles.daysBadgeNumSelected]}>
        {days}
      </Text>
      <Text
  style={[styles.daysBadgeLabel, styles.daysBadgeLabelSelected]}
  numberOfLines={1}
>
  {t("durationModal.daysShort", { defaultValue: "j" })}
</Text>

{isLegend && (
  <Ionicons
    name="sparkles"
    size={normalize(12)}
    color={withAlpha("#FFFFFF", 0.95)}
    style={{ marginLeft: normalize(2), marginTop: Platform.OS === "android" ? 1 : 0 }}
  />
)}


    </LinearGradient>
  </View>
</View>


{/* Micro en 2 lignes (safe toutes langues) */}
<Text style={[styles.optionSub, styles.optionSubSelected]} numberOfLines={2}>
  {t(microKeyForDays(days), { defaultValue: microDefaultForDays(days) })}
</Text>


                          </LinearGradient>
                        ) : (
                          <View style={styles.optionInner}>
                            <View style={styles.optionRow}>
  <View
    style={[
      styles.optionIcon,
      {
        backgroundColor: withAlpha(secondary, isDarkMode ? 0.18 : 0.10),
        borderColor: withAlpha(secondary, isDarkMode ? 0.24 : 0.16),
      },
    ]}
  >
    <Ionicons name={iconName} size={normalize(16)} color={secondary} />
  </View>

  {/* Days badge (glass) */}
  <View style={styles.daysBadgeWrap}>
    <View style={[
  styles.daysBadge,
  isPrestige && styles.daysBadgePrestigeSoft,
  isLegend && styles.daysBadgeLegendSoft,
]}>
      <Text
        style={[
          styles.daysBadgeNum,
          { color: isDarkMode ? "#FFFFFF" : "#0B0B0F" },
        ]}
      >
        {days}
      </Text>
      <Text
        style={[
          styles.daysBadgeLabel,
          { color: withAlpha(isDarkMode ? "#FFFFFF" : "#0B0B0F", 0.72) },
        ]}
      >
        {t("durationModal.daysShort", { defaultValue: "jours" })}
      </Text>
    </View>
  </View>
</View>



                            <Text style={[styles.optionSub, { color: textSecondary }]} numberOfLines={2}>
  {t(microKeyForDays(days), { defaultValue: microDefaultForDays(days) })}
</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                    );
                  })}
                </View>
              </ScrollView>

              {/* Footer CTA */}
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: withAlpha("#FFFFFF", isDarkMode ? 0.10 : 0.35),
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.primaryBtn, { opacity: confirming ? 0.9 : 1 }]}
                  onPress={safeConfirm}
                  activeOpacity={0.9}
                  disabled={confirming}
                  accessibilityRole="button"
                  accessibilityLabel={t("durationModal.confirm", {
                    defaultValue: "Confirmer",
                  })}
                >
                  <LinearGradient
                    colors={[
                      confirming ? withAlpha(textSecondary, 0.55) : secondary,
                      confirming ? withAlpha(textSecondary, 0.45) : primary,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryGrad}
                  >
                    <Ionicons
                      name={confirming ? "hourglass-outline" : "checkmark-circle-outline"}
                      size={normalize(18)}
                      color="#fff"
                      style={{ marginRight: normalize(8) }}
                    />
                    <Text style={styles.primaryText}>
                      {confirming
                        ? t("pleaseWait", { defaultValue: "Patiente..." })
                        : t("durationModal.confirm", { defaultValue: "Confirmer" })}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
  styles.secondaryBtn,
  {
    backgroundColor: isDarkMode
      ? withAlpha("#FFFFFF", 0.08)
      : withAlpha("#0B0B0F", 0.06),
    borderColor: isDarkMode
      ? withAlpha("#FFFFFF", 0.16)
      : withAlpha("#0B0B0F", 0.14),
  },
]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => {}
                    );
                    onCancel?.();
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("durationModal.cancel", { defaultValue: "Annuler" })}
                >
                  <Text
  style={[
    styles.secondaryText,
    { color: isDarkMode ? "#FFFFFF" : "#0B0B0F" }
  ]}
>
  {t("durationModal.cancel", { defaultValue: "Annuler" })}
</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Platform.select({
      ios: "rgba(0,0,0,0.55)",
      android: "rgba(0,0,0,0.62)",
      default: "rgba(0,0,0,0.6)",
    }),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 22,
  },

  orbTop: {
    position: "absolute",
    top: -120,
    left: -120,
  },
  orbBottom: {
    position: "absolute",
    bottom: -160,
    right: -160,
  },

  cardWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  glassBorder: {
    borderRadius: normalize(22),
    padding: 1.2,
    borderWidth: 1,
  },

  card: {
    borderRadius: normalize(22),
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(10) },
    shadowOpacity: 0.32,
    shadowRadius: normalize(18),
    elevation: 14,
  },

  topBar: {
    paddingTop: normalize(12),
    paddingBottom: normalize(8),
    paddingHorizontal: normalize(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: normalize(56),
    height: normalize(5),
    borderRadius: 999,
  },
  closeBtn: {
    position: "absolute",
    right: normalize(12),
    top: normalize(8),
    width: normalize(34),
    height: normalize(34),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
daysBadgePrestige: {
  backgroundColor: withAlpha("#FFFFFF", 0.14),
  borderColor: withAlpha("#FFFFFF", 0.22),
},

daysBadgeLegend: {
  backgroundColor: withAlpha("#FFFFFF", 0.18),
  borderColor: withAlpha("#FFFFFF", 0.30),
  shadowColor: "#FFFFFF",
  shadowOpacity: 0.18,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 10,
},

daysBadgePrestigeSoft: {
  backgroundColor: withAlpha("#FFFFFF", 0.12),
  borderColor: withAlpha("#FFFFFF", 0.18),
},

daysBadgeLegendSoft: {
  backgroundColor: withAlpha("#FFFFFF", 0.16),
  borderColor: withAlpha("#FFFFFF", 0.24),
},

  header: {
    paddingHorizontal: normalize(18),
    paddingBottom: normalize(12),
    alignItems: "center",
  },
  headerIconWrap: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(14),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: normalize(10),
  },
  title: {
    fontSize: normalize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  subtitle: {
    marginTop: normalize(6),
    fontSize: normalize(13),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    lineHeight: normalize(18),
    maxWidth: 360,
  },

  optionsCC: {
    paddingHorizontal: normalize(18),
    paddingTop: normalize(8),
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  option: {
    borderRadius: normalize(18),
    borderWidth: 1.25,
    marginBottom: normalize(10),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.18,
    shadowRadius: normalize(10),
    elevation: 6,
  },
     optionInner: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(18),
    minHeight: normalize(98), // ↑ un peu plus haut = respire, meilleur rendu
    justifyContent: "space-between",
  },

  optionIconSelected: {
    backgroundColor: withAlpha("#FFFFFF", 0.18),
    borderColor: withAlpha("#FFFFFF", 0.22),
    borderWidth: 1,
  },
  optionTitleSelected: {
    color: "#fff",
  },
    optionSubSelected: {
    color: withAlpha("#fff", 0.92),
  },
  checkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha("#FFFFFF", 0.22),
    backgroundColor: withAlpha("#FFFFFF", 0.18),
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalize(10),
  },
  optionIcon: {
    width: normalize(30),
    height: normalize(30),
    borderRadius: normalize(12),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  checkPillText: {
    color: "#fff",
    fontSize: normalize(10),
    fontFamily: "Comfortaa_700Bold",
  },
  optionTitle: {
    fontSize: normalize(16), // ↑ plus visible
    fontFamily: "Comfortaa_700Bold",
    letterSpacing: 0.2,
  },
  optionSub: {
  marginTop: normalize(6),
  fontSize: normalize(12),          // + lisible
  fontFamily: "Comfortaa_400Regular",
  lineHeight: normalize(16),
},
  footer: {
    paddingHorizontal: normalize(16),
    paddingTop: normalize(12),
    paddingBottom: normalize(14),
    borderTopWidth: 1,
  },
  primaryBtn: {
    borderRadius: normalize(16),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(6) },
    shadowOpacity: 0.28,
    shadowRadius: normalize(10),
    elevation: 8,
  },
  primaryGrad: {
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryText: {
    color: "#fff",
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },

  secondaryBtn: {
    marginTop: normalize(10),
    borderRadius: normalize(16),
    borderWidth: 1,
    paddingVertical: normalize(12),
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: normalize(13),
    fontFamily: "Comfortaa_700Bold",
  },
  daysBadgeWrap: {
  alignItems: "flex-end",
  justifyContent: "flex-start",
},

daysBadge: {
  flexDirection: "row",
  alignItems: "baseline",
  gap: normalize(3),
  paddingHorizontal: normalize(12),   // + large
  paddingVertical: normalize(7),      // + haut
  borderRadius: 999,
  borderWidth: 1,
  backgroundColor: withAlpha("#FFFFFF", 0.10),
  borderColor: withAlpha("#FFFFFF", 0.16),
},

daysBadgeNum: {
  fontSize: normalize(16),            // + visible
  fontFamily: "Comfortaa_700Bold",
  letterSpacing: 0.2,
},

daysBadgeLabel: {
  fontSize: normalize(11),            // + lisible
  fontFamily: "Comfortaa_700Bold",
  letterSpacing: 0.2,
},


daysBadgeSelected: {
  borderColor: withAlpha("#FFFFFF", 0.24),
},
daysBadgeNumSelected: {
  color: "#FFFFFF",
  textShadowColor: "rgba(0,0,0,0.18)",
  textShadowRadius: 6,
},
daysBadgeLabelSelected: {
  color: withAlpha("#FFFFFF", 0.82),
},

});

export default DurationSelectionModal;
