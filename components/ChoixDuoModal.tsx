// components/ChoixDuoModal.tsx
// ✅ Modal choix duo — top 1 mondial
// Deux options : Inviter un ami (deeplink) | Trouver un binôme (matching)

import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  onInviteFriend: () => void;   // → SendInvitationModal (deeplink, inchangé)
  onFindPartner: () => void;    // → MatchingModal (NEW)
  challengeTitle?: string;
};

const withAlpha = (hex: string, a: number) => {
  const alpha = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  const clean = hex.replace("#", "");
  return `#${clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean}${alpha}`;
};

const ChoixDuoModal: React.FC<Props> = ({
  visible,
  onClose,
  onInviteFriend,
  onFindPartner,
  challengeTitle,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const styles = useMemo(
    () => createStyles(isDark, th, insets),
    [isDark, th, insets]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={styles.overlay}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          entering={ZoomIn.springify().damping(18).stiffness(190)}
          exiting={ZoomOut.duration(140)}
          style={styles.cardWrap}
        >
          <LinearGradient
            colors={[
              withAlpha(th.colors.secondary, 0.95),
              withAlpha(th.colors.primary, 0.9),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.borderGlow}
          >
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Ionicons
                      name="people"
                      size={16}
                      color={isDark ? "#F8FAFC" : "#0B1220"}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>
                      {t("choixDuo.title", { defaultValue: "Trouver un partenaire" })}
                    </Text>
                    {!!challengeTitle && (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {challengeTitle}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  style={styles.closeBtn}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={isDark ? "#F8FAFC" : "#0B1220"}
                  />
                </Pressable>
              </View>

              {/* Options */}
              <View style={styles.options}>

                {/* Option 1 : Inviter un ami */}
                <Pressable
                  onPress={onInviteFriend}
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,159,28,0.18)", "rgba(255,215,0,0.12)"]
                        : ["rgba(255,159,28,0.14)", "rgba(255,215,0,0.08)"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.optionGradient}
                  >
                    <View style={[styles.optionIconWrap, styles.optionIconFriend]}>
                      <Ionicons name="person-add-outline" size={22} color="#FF9F1C" />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>
                        {t("choixDuo.inviteFriend", { defaultValue: "Inviter un ami" })}
                      </Text>
                      <Text style={styles.optionDesc}>
                        {t("choixDuo.inviteFriendDesc", {
                          defaultValue: "Envoie un lien à quelqu'un que tu connais",
                        })}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
                    />
                  </LinearGradient>
                </Pressable>

                {/* Option 2 : Trouver un binôme */}
                <Pressable
                  onPress={onFindPartner}
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(0,200,255,0.18)", "rgba(0,255,180,0.12)"]
                        : ["rgba(0,180,230,0.14)", "rgba(0,220,160,0.08)"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.optionGradient}
                  >
                    <View style={[styles.optionIconWrap, styles.optionIconMatch]}>
                      <Ionicons name="search-outline" size={22} color="#00C8FF" />
                    </View>
                    <View style={styles.optionText}>
                      <View style={styles.optionTitleRow}>
                        <Text style={styles.optionTitle}>
                          {t("choixDuo.findPartner", { defaultValue: "Trouver un binôme" })}
                        </Text>
                        {/* Badge NEW */}
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      </View>
                      <Text style={styles.optionDesc}>
                        {t("choixDuo.findPartnerDesc", {
                          defaultValue: "Matche avec un user qui fait le même défi",
                        })}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
                    />
                  </LinearGradient>
                </Pressable>
              </View>

              {/* Footer hint */}
              <Text style={styles.hint}>
                {t("choixDuo.hint", {
                  defaultValue: "À deux, on tient beaucoup plus longtemps. 💪",
                })}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const createStyles = (
  isDark: boolean,
  th: Theme,
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.58)",
    },
    cardWrap: {
      width: "100%",
      maxWidth: 400,
      marginHorizontal: 20,
      borderRadius: 26,
      overflow: "hidden",
    },
    borderGlow: {
      padding: 1.5,
      borderRadius: 26,
    },
    card: {
      borderRadius: 24,
      padding: 20,
      backgroundColor: isDark
        ? "rgba(11,18,32,0.96)"
        : "rgba(255,255,255,0.98)",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.08)",
    },
    title: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 17,
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    subtitle: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 12,
      color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.05)",
    },

    // Options
    options: {
      gap: 12,
      marginBottom: 16,
    },
    optionCard: {
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(255,255,255,0.10)"
        : "rgba(0,0,0,0.07)",
    },
    optionCardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    optionGradient: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 14,
    },
    optionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    optionIconFriend: {
      backgroundColor: isDark
        ? "rgba(255,159,28,0.20)"
        : "rgba(255,159,28,0.16)",
    },
    optionIconMatch: {
      backgroundColor: isDark
        ? "rgba(0,200,255,0.20)"
        : "rgba(0,180,230,0.16)",
    },
    optionText: {
      flex: 1,
      minWidth: 0,
    },
    optionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    optionTitle: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 15,
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    optionDesc: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 12,
      color: isDark ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.50)",
      marginTop: 3,
      lineHeight: 17,
    },

    // Badge NEW
    newBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#00C8FF",
    },
    newBadgeText: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 9,
      color: "#000",
      letterSpacing: 0.5,
    },

    // Hint footer
    hint: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 12,
      color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.36)",
      textAlign: "center",
      lineHeight: 17,
    },
  });

export default ChoixDuoModal;
