// components/ShareCardModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { useTranslation } from "react-i18next";
import { Dimensions } from "react-native";
import { Image } from "react-native";
import { useRef } from "react";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const normalize = (n: number) => {
  const base = 375;
  const scale = Math.min(Math.max(SCREEN_W / base, 0.85), 1.4);
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

type Props = {
  visible: boolean;
  onClose: () => void;
  userAvatar?: string;
  partnerAvatar?: string;

  // Données du défi
  challengeTitle: string;
  daysCompleted: number;
  totalDays: number;

  // Pour les cartes duo (optionnel)
  isDuo?: boolean;
  userName?: string;
  partnerName?: string;
  partnerDaysCompleted?: number;
};

const ShareCardModal: React.FC<Props> = ({
  visible,
  onClose,
  challengeTitle,
  daysCompleted,
  totalDays,
  isDuo,
  userName,
  partnerName,
  userAvatar,
  partnerAvatar,
   partnerDaysCompleted,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);

    // ✅ Progressions sécurisées (0–100%) pour solo & duo
  const safeTotal = totalDays > 0 ? totalDays : 1;

  // TA progression
  const userPct = Math.min(
    Math.max((daysCompleted / safeTotal) * 100, 0),
    100
  );

  // Progression réelle du partenaire (si fournie)
  const partnerCompletedRaw =
    isDuo && typeof partnerDaysCompleted === "number"
      ? partnerDaysCompleted
      : 0;

  const partnerPct = isDuo
    ? Math.min(
        Math.max((partnerCompletedRaw / safeTotal) * 100, 0),
        100
      )
    : 0;

  const partnerCompleted = isDuo ? partnerCompletedRaw : 0;


  const styles = useMemo(
    () => createStyles(isDark, th, insets),
    [isDark, th, insets]
  );

  const progressLabel =
    totalDays > 0 ? `${daysCompleted}/${totalDays}` : `${daysCompleted}`;

  const milestoneText = useMemo(() => {
    const variants = t("shareCardT.milestoneVariants", { returnObjects: true });
    if (Array.isArray(variants)) {
      const pick = variants[Math.floor(Math.random() * variants.length)];
      return pick.replace("{{days}}", String(daysCompleted));
    }
    return t("shareCardT.milestoneMessage", {
      days: daysCompleted,
    });
  }, [daysCompleted, t]);

  const handleShare = async () => {
    try {
      if (!cardRef.current) return;

      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
      });

      const fileUri = FileSystem.cacheDirectory + "sharecard.png";
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        dialogTitle: t("shareCardT.shareTitle", {
          defaultValue: "Partager ma carte",
        }),
      });
    } catch (err) {
      console.log("Error share card:", err);
    }
  };

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
        accessible
        accessibilityViewIsModal
        accessibilityLabel={t("shareCardT.a11yTitle", {
          defaultValue: "Carte de partage du défi",
        })}
        accessibilityHint={t("shareCardT.a11yHint", {
          defaultValue:
            "Prévisualise la carte qui sera partagée avec tes amis.",
        })}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={0.9}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
        />

        <Animated.View
          entering={ZoomIn.springify().damping(18).stiffness(190)}
          exiting={ZoomOut.duration(140)}
          style={styles.cardShadow}
        >
          <View style={styles.cardPremium} ref={cardRef}>
            {/* HEADER */}
            <LinearGradient
              colors={[th.colors.primary, th.colors.secondary]}
              style={styles.headerPremium}
            >
              <Image
                source={require("../assets/images/adaptive-icon.png")}
                style={styles.appLogo}
                resizeMode="contain"
                accessibilityLabel={t("shareCardT.logoAlt", {
                  defaultValue: "Logo ChallengeTies",
                })}
              />

              <Text style={styles.headerTitlePremium}>
                {isDuo
                  ? t("shareCardT.duoBadge", { defaultValue: "DÉFI EN DUO" })
                  : t("shareCardT.soloBadge", { defaultValue: "FOCUS EN SOLO" })}
              </Text>

              <Text style={styles.challengeTitlePremium}>{challengeTitle}</Text>
            </LinearGradient>

            {/* SOLO MODE */}
            {!isDuo && (
              <View style={styles.soloBlockPremium}>
                {userAvatar && (
                  <Image source={{ uri: userAvatar }} style={styles.avatarXL} />
                )}

                <Text style={styles.userNamePremium}>{userName}</Text>

                <View style={styles.progressBarPremium}>
                  <View
                    style={[
                      styles.progressFillPremium,
                      { width: `${userPct}%` },
                    ]}
                  />
                </View>

                <Text style={styles.progressLabelPremium}>
                  {daysCompleted}/{totalDays} · {Math.round(userPct)}%
                </Text>

                {/* Message inspirant */}
                <Text style={styles.milestonePremium}>{milestoneText}</Text>
              </View>
            )}

            {/* DUO MODE */}
            {isDuo && (
              <View style={styles.duoBlockPremium}>
                <View style={styles.duoStatusRow}>
                  <Text style={styles.duoStatusText}>
                    {(() => {
                      if (userPct > partnerPct) {
                        return t("shareCardT.leading", {
                          defaultValue: "Tu mènes la course !",
                        });
                      }
                      if (userPct < partnerPct) {
                        return t("shareCardT.behind", {
                          defaultValue: "Rattrape ton partenaire !",
                        });
                      }
                      return t("shareCardT.tie", {
                        defaultValue: "Égalité parfaite",
                      });
                    })()}
                  </Text>
                </View>

                <View style={styles.duoRowPremium}>
                  {/* USER */}
                  <View
                    style={[
                      styles.duoSidePremium,
                      userPct >= partnerPct && styles.duoSideHighlight,
                    ]}
                  >
                    {userAvatar && (
                      <Image source={{ uri: userAvatar }} style={styles.avatar} />
                    )}
                    <Text style={styles.duoNamePremium}>{userName}</Text>
                    <View style={styles.progressBarMiniPremium}>
                      <View
                        style={[
                          styles.progressFillMiniPremium,
                          { width: `${userPct}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.duoProgressLabel}>
                      {daysCompleted}/{totalDays} · {Math.round(userPct)}%
                    </Text>
                  </View>

                  {/* VS */}
                  <View style={styles.vsBadge}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>

                  {/* PARTNER */}
                  <View
                    style={[
                      styles.duoSidePremium,
                      partnerPct >= userPct && styles.duoSideHighlight,
                    ]}
                  >
                    {partnerAvatar && (
                      <Image
                        source={{ uri: partnerAvatar }}
                        style={styles.avatar}
                      />
                    )}
                    <Text style={styles.duoNamePremium}>{partnerName}</Text>

                    <View style={styles.progressBarMiniPremium}>
                      <View
                        style={[
                          styles.progressFillMiniPremium,
                          {
                            width: `${partnerPct}%`,
                            backgroundColor: "#00e6e6",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.duoProgressLabel}>
                      {partnerCompleted}/{totalDays} · {Math.round(partnerPct)}%
                    </Text>
                  </View>
                </View>

                {/* Message inspirant */}
                <Text style={styles.milestonePremium}>{milestoneText}</Text>
              </View>
            )}

            {/* FOOTER */}
            <View style={styles.footerPremium}>
              <Text style={styles.footerLinePremium}>
                {t("shareCardT.footerLine1")}
              </Text>
              <Text style={styles.footerSmallPremium}>
                {t("shareCardT.footerLine2")}
              </Text>
            </View>
          </View>

          {/* Boutons bas */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareBtn}
              activeOpacity={0.9}
            >
              <Text style={styles.shareText}>
                {t("shareCardT.share", { defaultValue: "Partager" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t("commonS.close", {
                defaultValue: "Fermer",
              })}
            >
              <Text style={styles.closeText}>
                {t("commonS.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>
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
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    cardShadow: {
      width: "100%",
      maxWidth: 420,
      paddingHorizontal: 16,
    },
    cardOuter: {
      borderRadius: 26,
      padding: 2,
      marginTop: Math.max(insets.top, 32),
    },
    cardPremium: {
      backgroundColor: withAlpha("#04050C", 0.9),
      borderRadius: 26,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.12),
    },
    shareBtn: {
      paddingVertical: 12,
      paddingHorizontal: 26,
      borderRadius: 999,
      backgroundColor: th.colors.primary,
      marginBottom: 10,
    },
    shareText: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(14),
      letterSpacing: 0.6,
      textAlign: "center",
    },

    headerPremium: {
      padding: 20,
      alignItems: "center",
    },

    headerTitlePremium: {
      fontSize: normalize(14),
      color: "#ffffff",
      opacity: 0.85,
      fontFamily: "Comfortaa_700Bold",
    },

    challengeTitlePremium: {
      marginTop: 6,
      fontSize: normalize(20),
      color: "#ffffff",
      fontFamily: "Comfortaa_700Bold",
      textAlign: "center",
    },

    /* SOLO */
    soloBlockPremium: {
      alignItems: "center",
      paddingVertical: 22,
    },

    avatarXL: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 10,
    },

    userNamePremium: {
      color: "#fff",
      fontSize: normalize(17),
      fontFamily: "Comfortaa_700Bold",
      marginBottom: 8,
    },

    progressBarPremium: {
      width: "70%",
      height: 12,
      backgroundColor: "#333",
      borderRadius: 10,
      overflow: "hidden",
      marginTop: 4,
    },

    progressFillPremium: {
      height: "100%",
      backgroundColor: th.colors.primary,
    },

    progressLabelPremium: {
      marginTop: 6,
      color: "#fff",
      opacity: 0.85,
      fontSize: normalize(13),
      fontFamily: "Comfortaa_400Regular",
    },

    /* DUO */
    duoBlockPremium: {
      paddingVertical: 20,
    },

    duoStatusRow: {
      alignItems: "center",
      marginBottom: 12,
    },

    duoStatusText: {
      color: "#fff",
      fontSize: normalize(13),
      opacity: 0.9,
      fontFamily: "Comfortaa_400Regular",
      textAlign: "center",
    },

    duoRowPremium: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },
    appLogo: {
      width: normalize(40),
      height: normalize(40),
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.35),
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },

    duoSidePremium: {
      alignItems: "center",
      width: "38%",
    },

    duoSideHighlight: {
      borderWidth: 1.5,
      borderColor: th.colors.secondary,
      shadowColor: th.colors.secondary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
      borderRadius: 18,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },

    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
    },

    duoNamePremium: {
      marginTop: 6,
      color: "#fff",
      fontSize: normalize(14),
      fontFamily: "Comfortaa_700Bold",
    },

    duoProgressLabel: {
      marginTop: 4,
      color: "#fff",
      fontSize: normalize(12),
      opacity: 0.85,
      fontFamily: "Comfortaa_400Regular",
      textAlign: "center",
    },

    progressBarMiniPremium: {
      width: "80%",
      height: 8,
      backgroundColor: "#222",
      borderRadius: 6,
      marginTop: 6,
    },

    progressFillMiniPremium: {
      height: "100%",
      backgroundColor: th.colors.primary,
      borderRadius: 6,
    },

    vsBadge: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
    },
    milestonePremium: {
      marginTop: 10,
      color: "#fff",
      fontSize: normalize(13),
      opacity: 0.9,
      fontFamily: "Comfortaa_400Regular",
      textAlign: "center",
    },

    vsText: {
      color: "#000",
      fontSize: normalize(16),
      fontFamily: "Comfortaa_700Bold",
    },

    /* FOOTER */
    footerPremium: {
      paddingVertical: 20,
      alignItems: "center",
    },

    footerLinePremium: {
      color: "#fff",
      fontSize: normalize(15),
      fontFamily: "Comfortaa_700Bold",
    },

    footerSmallPremium: {
      marginTop: 4,
      color: "#ccc",
      fontSize: normalize(12),
      fontFamily: "Comfortaa_400Regular",
    },

    cardInner: {
      borderRadius: 24,
      paddingVertical: normalize(24),
      paddingHorizontal: normalize(20),
      backgroundColor: withAlpha("#050816", isDark ? 0.9 : 0.88),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha("#ffffff", 0.15),
    },
    headerRow: {
      alignItems: "flex-start",
      marginBottom: normalize(14),
    },
    appTitle: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(18),
      color: "#ffffff",
      letterSpacing: 1.2,
    },
    tagline: {
      marginTop: 4,
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(11),
      color: withAlpha("#ffffff", 0.8),
    },
    mainStats: {
      alignItems: "center",
      marginVertical: normalize(12),
    },
    label: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(12),
      color: withAlpha("#ffffff", 0.8),
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    bigNumber: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(40),
      color: "#ffffff",
    },
    subLabel: {
      marginTop: 4,
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(13),
      color: withAlpha("#ffffff", 0.85),
    },
    challengeTitle: {
      marginTop: normalize(10),
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(16),
      color: "#ffffff",
      textAlign: "center",
    },
    duoContainer: {
      marginTop: normalize(18),
      alignItems: "center",
    },
    duoBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.5),
      color: "#ffffff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(11),
      letterSpacing: 1,
    },
    duoNames: {
      marginTop: 6,
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(13),
      color: withAlpha("#ffffff", 0.92),
    },
    footer: {
      marginTop: normalize(24),
      alignItems: "center",
    },
    footerLine: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(14),
      color: "#ffffff",
    },
    footerLineSmall: {
      marginTop: 4,
      fontFamily: "Comfortaa_400Regular",
      fontSize: normalize(11),
      color: withAlpha("#ffffff", 0.8),
      textAlign: "center",
    },
    actionsRow: {
      marginTop: 12,
      marginBottom: Math.max(insets.bottom, 18),
      alignItems: "center",
    },
    closeBtn: {
      paddingVertical: 10,
      paddingHorizontal: 22,
      borderRadius: 999,
      backgroundColor: isDark
        ? withAlpha("#ffffff", 0.12) // halo blanc subtil en dark mode
        : withAlpha("#000000", 0.08), // halo noir en light mode
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.25),
    },

    closeText: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: normalize(14),
      color: "#ffffff", // TOUJOURS lisible
      letterSpacing: 0.5,
    },
  });

export default ShareCardModal;
