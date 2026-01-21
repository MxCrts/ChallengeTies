// components/ShareCardModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
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

    const heldLine = useMemo(() => {
    if (isDuo) {
      return t("shareCardT.heldDuo", { defaultValue: "On a tenu" });
    }
    // SOLO: formulation plus “j’ai tenu bon”
    return t("shareCardT.heldSolo", { defaultValue: "J’ai tenu" });
  }, [isDuo, t]);

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
  result: "tmpfile",
  width: 1080,
  height: 1350,
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
  {/* ✅ WRAP: la carte (capturée) */}
  <View style={styles.cardFrame} ref={cardRef} collapsable={false}>
    <LinearGradient
      colors={[
        withAlpha("#FFFFFF", 0.22),
        withAlpha("#FFFFFF", 0.06),
        withAlpha("#FFFFFF", 0.14),
      ]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.cardBorder}
    >
      <View style={styles.cardPremium}>
        {/* Keynote ambient background */}
        <View pointerEvents="none" style={styles.ambientLayer}>
          <LinearGradient
            colors={[withAlpha(th.colors.primary, 0.55), "transparent"]}
            style={styles.orbA}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
          />
          <LinearGradient
            colors={[withAlpha(th.colors.secondary, 0.45), "transparent"]}
            style={styles.orbB}
            start={{ x: 0.8, y: 0.2 }}
            end={{ x: 0.2, y: 0.8 }}
          />
          <LinearGradient
            colors={[withAlpha("#FFFFFF", 0.14), "transparent"]}
            style={styles.sheen}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        {/* ✅ LAYOUT verrouillé */}
        <View style={styles.cardLayout}>
          {/* HEADER */}
          <LinearGradient
            colors={[th.colors.primary, th.colors.secondary]}
            style={styles.headerPremium}
          >
            <View style={styles.headerTopRow}>
  <Image
    source={require("../assets/images/adaptive-icon.png")}
    style={styles.appLogo}
  />

  {userAvatar && (
    <Image
      source={{ uri: userAvatar }}
      style={styles.headerAvatar}
    />
  )}
</View>


            <View style={styles.modePill}>
              <Text style={styles.modePillText}>
                {isDuo
                  ? t("shareCardT.duoBadge", { defaultValue: "DUO" })
                  : t("shareCardT.soloBadge", { defaultValue: "SOLO" })}
              </Text>
            </View>

            <Text
              style={styles.challengeTitlePremium}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {challengeTitle}
            </Text>
          </LinearGradient>

          {/* BODY */}
          <View style={styles.bodyPremium}>
            {!isDuo ? (
              <View style={styles.soloBlockPremium}>


                {!!userName && (
                  <Text style={styles.userNamePremium} numberOfLines={1} ellipsizeMode="tail">
                    {userName}
                  </Text>
                )}

                <Text style={styles.heroPct} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {Math.round(userPct)}%
                </Text>

                <Text style={styles.progressLabelPremium} numberOfLines={1} ellipsizeMode="tail">
                  {heldLine}{" "}
                  {daysCompleted}/{totalDays}
                </Text>

                <View style={styles.progressBarPremium}>
                  <View style={[styles.progressFillPremium, { width: `${userPct}%` }]} />
                </View>

                <Text style={styles.milestonePremium} numberOfLines={2} ellipsizeMode="tail">
                  {milestoneText}
                </Text>
              </View>
            ) : (
              <View style={styles.duoBlockPremium}>
                <Text style={styles.duoHeadline} numberOfLines={1} ellipsizeMode="tail">
                  {heldLine}{" "}
                  {Math.max(daysCompleted, partnerCompleted)}/{totalDays}
                </Text>

                <View style={styles.duoRowPremium}>
                  <View
                    style={[
                      styles.duoSidePremium,
                      userPct >= partnerPct && styles.duoSideHighlight,
                    ]}
                  >
                    <View style={styles.avatarRingSm}>
                      {userAvatar ? (
                        <Image source={{ uri: userAvatar }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]} />
                      )}
                    </View>

                    {!!userName && (
                      <Text style={styles.duoNamePremium} numberOfLines={1} ellipsizeMode="tail">
                        {userName}
                      </Text>
                    )}

                    <View style={styles.progressBarMiniPremium}>
                      <View style={[styles.progressFillMiniPremium, { width: `${userPct}%` }]} />
                    </View>

                    <Text style={styles.duoProgressLabel} numberOfLines={1}>
                      {daysCompleted}/{totalDays}
                    </Text>
                  </View>

                  <View style={styles.vsBadge}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>

                  <View
                    style={[
                      styles.duoSidePremium,
                      partnerPct >= userPct && styles.duoSideHighlight,
                    ]}
                  >
                    <View style={styles.avatarRingSm}>
                      {partnerAvatar ? (
                        <Image source={{ uri: partnerAvatar }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]} />
                      )}
                    </View>

                    {!!partnerName && (
                      <Text style={styles.duoNamePremium} numberOfLines={1} ellipsizeMode="tail">
                        {partnerName}
                      </Text>
                    )}

                    <View style={styles.progressBarMiniPremium}>
                      <View
                        style={[
                          styles.progressFillMiniPremium,
                          { width: `${partnerPct}%`, backgroundColor: th.colors.secondary },
                        ]}
                      />
                    </View>

                    <Text style={styles.duoProgressLabel} numberOfLines={1}>
                      {partnerCompleted}/{totalDays}
                    </Text>
                  </View>
                </View>

                <Text style={styles.milestonePremium} numberOfLines={2} ellipsizeMode="tail">
                  {milestoneText}
                </Text>
              </View>
            )}
          </View>

          {/* FOOTER (fix) */}
          <View style={styles.footerPremium}>
            <Text style={styles.footerLinePremium} numberOfLines={1} ellipsizeMode="tail">
              {t("shareCardT.footerLine1", { defaultValue: "ChallengeTies" })}
            </Text>
            <Text style={styles.footerSmallPremium} numberOfLines={1} ellipsizeMode="tail">
              {t("shareCardT.footerLine2", {
                defaultValue: "Rejoins-nous. Un jour. Un défi. Une victoire.",
              })}
            </Text>
          </View>

          {/* watermark (ne casse plus rien) */}
          <Text style={styles.watermark} numberOfLines={1} ellipsizeMode="clip">
            {t("shareCardT.watermark", { defaultValue: "@ChallengeTies" })}
          </Text>
        </View>
      </View>
    </LinearGradient>
  </View>

  {/* ✅ ACTIONS (hors capture) */}
  <View style={styles.actionsRow}>
    <Pressable
      onPress={handleShare}
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.86 }]}
      accessibilityRole="button"
      accessibilityLabel={t("shareCardT.shareBtnA11y", { defaultValue: "Partager la carte" })}
    >
      <Text style={styles.actionBtnText}>
        {t("shareCardT.shareBtn", { defaultValue: "Partager" })}
      </Text>
    </Pressable>

    <Pressable
      onPress={onClose}
      style={({ pressed }) => [styles.actionBtnGhost, pressed && { opacity: 0.86 }]}
      accessibilityRole="button"
      accessibilityLabel={t("commonS.close", { defaultValue: "Fermer" })}
    >
      <Text style={styles.actionBtnGhostText}>
        {t("commonS.close", { defaultValue: "Fermer" })}
      </Text>
    </Pressable>
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
  paddingHorizontal: 16,
  alignItems: "center",
},

cardFrame: {
  width: Math.min(SCREEN_W - 48, 380),
  height: Math.round(Math.min(SCREEN_H * 0.62, 520)), // ✅ VERROU: plus de layout aléatoire
  borderRadius: 28,
  overflow: "hidden",
},

cardLayout: {
  flex: 1,
},

bodyPremium: {
  flex: 1,
  minHeight: 0,
  paddingHorizontal: 18,
  paddingVertical: 10,
  justifyContent: "center",
},

soloBlockPremium: {
  flex: 1,
  minHeight: 0,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},

duoBlockPremium: {
  flex: 1,
  minHeight: 0,
  justifyContent: "center",
  gap: 8,
},

footerPremium: {
  paddingTop: 8,
  paddingBottom: 14,
  paddingHorizontal: 18,
  alignItems: "center",
},

watermark: {
  position: "absolute",
  right: 14,
  bottom: 10,
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalize(10),
  color: withAlpha("#FFFFFF", 0.30),
  letterSpacing: 0.8,
},
cardContent: {
  flex: 1,
},
cardBorder: {
  flex: 1,
  borderRadius: 28,
  padding: 2,
},

cardPremium: {
  flex: 1,
  borderRadius: 26,
  overflow: "hidden",
  backgroundColor: withAlpha("#04050C", 0.92),
  borderWidth: 1,
  borderColor: withAlpha("#ffffff", 0.10),
  justifyContent: "space-between",
},

headerTopRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
},

headerAvatar: {
  width: 36,
  height: 36,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: withAlpha("#fff", 0.35),
},

ambientLayer: {
  ...StyleSheet.absoluteFillObject,
},

orbA: {
  position: "absolute",
  top: -120,
  left: -120,
  width: 320,
  height: 320,
  borderRadius: 999,
},

orbB: {
  position: "absolute",
  bottom: -140,
  right: -140,
  width: 360,
  height: 360,
  borderRadius: 999,
},

sheen: {
  position: "absolute",
  top: -80,
  left: 40,
  width: 260,
  height: 260,
  borderRadius: 999,
  transform: [{ rotate: "18deg" }],
  opacity: 0.9,
},

modePill: {
  marginTop: 10,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.30),
  backgroundColor: withAlpha("#000000", 0.18),
},

modePillText: {
  color: "#FFFFFF",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalize(12),
  letterSpacing: 1.2,
  opacity: 0.95,
},
heroPct: {
  marginTop: 6,
  color: "#FFFFFF",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalize(40),
  letterSpacing: 0.6,
  textShadowColor: "rgba(0,0,0,0.25)",
  textShadowRadius: 10,
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
avatarRing: {
  width: 108,
  height: 108,
  borderRadius: 54,
  padding: 2,
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.22),
  backgroundColor: withAlpha("#000", 0.18),
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
},

avatarRingSm: {
  width: 76,
  height: 76,
  borderRadius: 38,
  padding: 2,
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.18),
  backgroundColor: withAlpha("#000", 0.18),
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 6,
},

avatarFallback: {
  backgroundColor: withAlpha("#FFFFFF", 0.08),
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.14),
},

duoHeadline: {
  color: "#fff",
  fontSize: normalize(16),
  fontFamily: "Comfortaa_700Bold",
  textAlign: "center",
  marginBottom: 12,
  opacity: 0.95,
},
headerPremium: {
  paddingHorizontal: 18,
  paddingTop: 18,
  paddingBottom: 14,
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
    duoStatusRow: {
      alignItems: "center",
      marginBottom: 12,
    },
actionsRow: {
  width: Math.min(SCREEN_W - 48, 380),
  flexDirection: "row",
  gap: 10,
  marginTop: 12,
  paddingHorizontal: 2,
},

actionBtn: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 999,
  backgroundColor: th.colors.primary,
  alignItems: "center",
  justifyContent: "center",
},

actionBtnText: {
  color: "#fff",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalize(14),
  letterSpacing: 0.6,
},

actionBtnGhost: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.24),
  backgroundColor: withAlpha("#000", 0.22),
  alignItems: "center",
  justifyContent: "center",
},

actionBtnGhostText: {
  color: "#fff",
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalize(14),
  letterSpacing: 0.6,
  opacity: 0.92,
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
    progressFillMiniPremium: {
      height: "100%",
      backgroundColor: th.colors.primary,
      borderRadius: 6,
    },
vsBadge: {
  width: 44,
  height: 44,
  borderRadius: 22,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.22),
  backgroundColor: withAlpha("#000000", 0.22),
},

progressBarPremium: {
  width: "72%",
  height: 12,
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: withAlpha("#FFFFFF", 0.10),
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.12),
  marginTop: 6,
},

progressBarMiniPremium: {
  width: "82%",
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  backgroundColor: withAlpha("#FFFFFF", 0.10),
  borderWidth: 1,
  borderColor: withAlpha("#FFFFFF", 0.12),
  marginTop: 6,
},
milestonePremium: {
  marginTop: 10,
  color: "#fff",
  fontSize: normalize(13),
  opacity: 0.9,
  fontFamily: "Comfortaa_400Regular",
  textAlign: "center",
  paddingHorizontal: 6,     // ✅ évite que ça touche les bords
},
    vsText: {
      color: "#000",
      fontSize: normalize(16),
      fontFamily: "Comfortaa_700Bold",
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
  textAlign: "center",
  opacity: 0.92,
},

  });

export default ShareCardModal;
