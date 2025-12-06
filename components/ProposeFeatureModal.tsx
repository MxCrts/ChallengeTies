import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProposeFeatureModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, description?: string) => Promise<void> | void;
};

const TITLE_MAX = 60;
const DESC_MAX = 280;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const normalize = (n: number) => {
  const base = 375;
  const scale = Math.min(Math.max(SCREEN_W / base, 0.85), 1.5);
  return Math.round(n * scale);
};

const withAlpha = (hex: string, a: number) => {
  const clamp = (x: number, min = 0, max = 1) => Math.min(Math.max(x, min), max);
  const alpha = Math.round(clamp(a) * 255)
    .toString(16)
    .padStart(2, "0");
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `#${r}${g}${b}${alpha}`;
  }
  return `#${clean}${alpha}`;
};

export default function ProposeFeatureModal({
  visible,
  onClose,
  onSubmit,
}: ProposeFeatureModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const titleInputRef = useRef<TextInput>(null);

  const titleLen = title.trim().length;
  const descLen = description.trim().length;
  const titleLeft = Math.max(0, TITLE_MAX - titleLen);
  const descLeft = Math.max(0, DESC_MAX - descLen);

  const titleValid = titleLen >= 6 && titleLen <= TITLE_MAX;
  const descValid = descLen <= DESC_MAX; // facultatif
  const canSubmit = titleValid && descValid && !submitting;

  const styles = useMemo(
    () => createStyles(isDark, currentTheme, insets),
    [isDark, currentTheme, insets]
  );

  // Respect des préférences d’accessibilité (Reduce Motion)
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (isMounted) setReduceMotion(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
      if (isMounted) setReduceMotion(!!v);
    });
    return () => {
      isMounted = false;
      // @ts-ignore RN compat
      sub?.remove?.();
    };
  }, []);

  const handleClose = useCallback(async () => {
    try {
      if (!reduceMotion) {
        await Haptics.selectionAsync();
      }
    } catch {}
    onClose();
  }, [onClose, reduceMotion]);

  const handleSubmission = useCallback(async () => {
    if (!canSubmit) {
      try {
        if (!reduceMotion) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch {}
      Alert.alert(
        t("proposeFeature.errorTitle", { defaultValue: "Oups" }),
        t("proposeFeature.errorNoTitle", {
          defaultValue: "Ajoute un titre suffisamment clair pour ta proposition.",
        })
      );
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(title.trim(), description.trim() || undefined);
      try {
        if (!reduceMotion) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {}
      setTitle("");
      setDescription("");
      onClose();
    } catch (e) {
      console.error(e);
      try {
        if (!reduceMotion) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {}
      Alert.alert(
        t("proposeFeature.errorTitle", { defaultValue: "Oups" }),
        t("proposeFeature.submitFailed", {
          defaultValue: "Échec de l’envoi. Réessaie un peu plus tard.",
        })
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, onSubmit, title, description, t, onClose, reduceMotion]);

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      {/* Overlay plein écran, centrage absolu */}
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(160)}
        exiting={reduceMotion ? undefined : FadeOut.duration(140)}
        style={styles.overlay}
        accessibilityViewIsModal
        accessible
        accessibilityLabel={t("proposeFeature.a11yOverlay", {
          defaultValue: "Proposer une fonctionnalité",
        })}
        accessibilityHint={t("proposeFeature.a11yOverlayHint", {
          defaultValue: "Remplis le formulaire pour suggérer une nouvelle idée.",
        })}
      >
        {/* Backdrop cliquable pour fermer */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* KAV + Scroll pour clavier / petits écrans */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kav}
          keyboardVerticalOffset={
            Platform.OS === "ios" ? Math.max(insets.top, 16) + 24 : 0
          }
        >
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : ZoomIn.springify().damping(18).stiffness(180)
            }
            exiting={reduceMotion ? undefined : ZoomOut.duration(140)}
            style={styles.cardShadow}
          >
            {/* Liseré premium */}
            <LinearGradient
              colors={
                [
                  withAlpha(currentTheme.colors.secondary, 0.9),
                  withAlpha(currentTheme.colors.primary, 0.9),
                ] as const
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.borderGlow}
            >
              <View style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="sparkles-outline"
                      size={normalize(20)}
                      color={currentTheme.colors.secondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[styles.title, { color: currentTheme.colors.textPrimary }]}
                      accessibilityRole="header"
                    >
                      {t("proposeFeature.modalTitle")}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleClose}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close"
                      size={normalize(22)}
                      color={isDark ? "#fff" : "#111"}
                    />
                  </TouchableOpacity>
                </View>

                <Text
                  style={[
                    styles.subtitle,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("proposeFeature.subtitle", {
                    defaultValue:
                      "Une idée précise ? Décris-la clairement pour que la communauté puisse voter.",
                  })}
                </Text>

                {/* Contenu scrollable pour éviter tout débordement */}
                <ScrollView
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.scrollInner}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Titre */}
                  <View style={styles.inputBlock}>
                    <View className="labelRow" style={styles.labelRow}>
                      <Text
                        style={[
                          styles.label,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {t("proposeFeature.labelTitle", {
                          defaultValue: "Titre (obligatoire)",
                        })}
                      </Text>
                      <Text
                        style={[
                          styles.counter,
                          {
                            color:
                              titleLeft <= 8
                                ? "#FF6B6B"
                                : currentTheme.colors.textSecondary,
                          },
                        ]}
                      >
                        {titleLeft}
                      </Text>
                    </View>

                    <TextInput
                      ref={titleInputRef}
                      value={title}
                      onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
                      onBlur={() => setTitle((v) => v.trimStart())}
                      placeholder={t("proposeFeature.placeholderTitle")}
                      placeholderTextColor={withAlpha(
                        currentTheme.colors.textSecondary,
                        0.8
                      )}
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark
                            ? withAlpha("#FFFFFF", 0.06)
                            : withAlpha("#000000", 0.04),
                          borderColor:
                            titleLen === 0
                              ? withAlpha(currentTheme.colors.border, 0.6)
                              : titleValid
                              ? withAlpha("#00C853", 0.6)
                              : withAlpha("#FF6B6B", 0.6),
                        },
                      ]}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={Keyboard.dismiss}
                      accessible
                      accessibilityLabel={t("proposeFeature.placeholderTitle")}
                      accessibilityHint={t("proposeFeature.a11yTitleHint", {
                        defaultValue: "Entre un titre clair et concis.",
                      })}
                      maxLength={TITLE_MAX}
                      autoCapitalize="sentences"
                    />
                    {!titleValid && titleLen > 0 && (
                      <Text style={[styles.helper, { color: "#FF6B6B" }]}>
                        {t("proposeFeature.titleRule", {
                          defaultValue: "Entre 6 et 60 caractères.",
                        })}
                      </Text>
                    )}
                  </View>

                  {/* Description */}
                  <View style={styles.inputBlock}>
                    <View style={styles.labelRow}>
                      <Text
                        style={[
                          styles.label,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {t("proposeFeature.labelDescription", {
                          defaultValue: "Description (optionnel)",
                        })}
                      </Text>
                      <Text
                        style={[
                          styles.counter,
                          {
                            color:
                              descLeft <= 20
                                ? "#FF9E3D"
                                : currentTheme.colors.textSecondary,
                          },
                        ]}
                      >
                        {descLeft}
                      </Text>
                    </View>

                    <TextInput
                      value={description}
                      onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
                      onBlur={() => setDescription((v) => v.trimStart())}
                      placeholder={t("proposeFeature.placeholderDescription")}
                      placeholderTextColor={withAlpha(
                        currentTheme.colors.textSecondary,
                        0.8
                      )}
                      style={[
                        styles.input,
                        styles.textArea,
                        {
                          backgroundColor: isDark
                            ? withAlpha("#FFFFFF", 0.05)
                            : withAlpha("#000000", 0.035),
                          borderColor: withAlpha(currentTheme.colors.border, 0.7),
                        },
                      ]}
                      multiline
                      textAlignVertical="top"
                      returnKeyType="done"
                      accessible
                      accessibilityLabel={t(
                        "proposeFeature.placeholderDescription"
                      )}
                      maxLength={DESC_MAX}
                      autoCapitalize="sentences"
                    />
                  </View>

                  {/* Tips */}
                  <View style={styles.chipsRow}>
                    <Chip
                      text={t("proposeFeature.chipImpact", {
                        defaultValue: "Impact clair",
                      })}
                    />
                    <Chip
                      text={t("proposeFeature.chipFeasible", {
                        defaultValue: "Faisable",
                      })}
                    />
                    <Chip
                      text={t("proposeFeature.chipPrecise", {
                        defaultValue: "Précis",
                      })}
                    />
                  </View>

                  {/* CTA */}
                  <TouchableOpacity
                    onPress={handleSubmission}
                    disabled={!canSubmit}
                    activeOpacity={0.92}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmit }}
                    accessibilityLabel={t("proposeFeature.submitButton", {
                      defaultValue: "Envoyer la proposition",
                    })}
                    accessibilityHint={t(
                      "proposeFeature.a11ySubmitHint",
                      {
                        defaultValue:
                          "Valide ta proposition pour qu’elle soit visible dans les votes.",
                      }
                    )}
                    testID="submit-feature"
                    style={{ width: "100%", marginTop: 10 }}
                  >
                    <LinearGradient
                      colors={
                        [
                          canSubmit
                            ? currentTheme.colors.secondary
                            : withAlpha(currentTheme.colors.secondary, 0.5),
                          canSubmit
                            ? currentTheme.colors.primary
                            : withAlpha(currentTheme.colors.primary, 0.5),
                        ] as const
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitBtn}
                    >
                      {submitting ? (
                        <ActivityIndicator
                          size="small"
                          color={currentTheme.colors.textPrimary}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="paper-plane-outline"
                            size={normalize(18)}
                            color={currentTheme.colors.textPrimary}
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[
                              styles.submitText,
                              { color: currentTheme.colors.textPrimary },
                            ]}
                          >
                            {t("proposeFeature.submitButton")}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

/* ---------- UI Subcomponent ---------- */
function Chip({ text }: { text: string }) {
  return (
    <View style={chipStyles.chip}>
      <Ionicons
        name="shield-checkmark-outline"
        size={14}
        color="#fff"
        style={{ marginRight: 6 }}
      />
      <Text style={chipStyles.text}>{text}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#00000033",
    marginRight: 8,
    marginBottom: 8,
  },
  text: { color: "#fff", fontSize: 12, fontFamily: "Comfortaa_700Bold" },
});

/* ---------- Styles ---------- */
const createStyles = (
  isDark: boolean,
  current: Theme,
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    kav: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Math.max(insets.top, 16),
      paddingBottom: Math.max(insets.bottom, 16),
    },
    cardShadow: {
      width: "100%",
      maxWidth: 520,
      borderRadius: 22,
      overflow: "hidden",
      maxHeight: SCREEN_H - (insets.top + insets.bottom) - normalize(48),
    },
    borderGlow: {
      padding: 1.5,
      borderRadius: 22,
    },
    card: {
      backgroundColor: isDark
        ? withAlpha(current.colors.cardBackground, 0.92)
        : withAlpha("#ffffff", 0.98),
      borderRadius: 20,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(current.colors.border, 0.6),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
        },
        android: { elevation: 6 },
      }),
      flexGrow: 0,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    title: {
      fontSize: normalize(18),
      fontFamily: "Comfortaa_700Bold",
    },
    subtitle: {
      fontSize: normalize(13),
      fontFamily: "Comfortaa_400Regular",
      marginBottom: 12,
    },
    scrollInner: {
      paddingBottom: 4,
    },
    inputBlock: { marginBottom: 12 },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      fontFamily: "Comfortaa_700Bold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    counter: {
      fontSize: 12,
      fontFamily: "Comfortaa_700Bold",
    },
    input: {
      width: "100%",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Comfortaa_400Regular",
      fontSize: 14,
      borderWidth: 1.5,
      color: isDark ? current.colors.textPrimary : "#111111",
    },
    textArea: { minHeight: 110 },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 4,
      marginBottom: 8,
    },
    submitBtn: {
      width: "100%",
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    helper: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: "Comfortaa_400Regular",
    },
    submitText: {
      fontSize: 15,
      fontFamily: "Comfortaa_700Bold",
    },
  });
