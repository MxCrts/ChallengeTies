// components/ShareCardModal.tsx
import React, { useCallback, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { useTranslation } from "react-i18next";
import { Image } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

const withAlpha = (hex: string, a: number) => {
  const clamp = (x: number, min = 0, max = 1) => Math.min(Math.max(x, min), max);
  const alpha = Math.round(clamp(a) * 255).toString(16).padStart(2, "0");
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

  challengeTitle: string;
  daysCompleted: number;
  totalDays: number;

  isDuo?: boolean;
  userName?: string;
  partnerName?: string;
  partnerDaysCompleted?: number;
};

// ✅ Export ratio: 4:5 (1080x1350)
const CAPTURE_W = 1080;
const CAPTURE_H = 1350;
const CARD_RATIO = CAPTURE_W / CAPTURE_H; // 0.8

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
  const { width: W, height: H } = useWindowDimensions();
  const cardRef = useRef<View>(null);

  // ✅ Card preview size: computed from available viewport (safe area + actions)
  const IS_TINY = W < 360 || H < 700;

  const availableH = H - insets.top - insets.bottom - (IS_TINY ? 210 : 240);
  const maxCardW = Math.min(W - 40, 420);
  const maxCardH = Math.min(availableH, 640);

  const wFromH = Math.floor(maxCardH * CARD_RATIO);
  const CARD_W = Math.max(280, Math.min(maxCardW, wFromH));
  const CARD_H = Math.floor(CARD_W / CARD_RATIO);

  // ✅ Scale based on the card itself (not the screen)
  const S = useMemo(() => {
    const base = 380; // "design width"
    return Math.min(Math.max(CARD_W / base, 0.82), 1.12);
  }, [CARD_W]);

  const s = useCallback((n: number) => Math.round(n * S), [S]);

  // ✅ Progress safe
  const safeTotal = totalDays > 0 ? totalDays : 1;
  const userPct = Math.min(Math.max((daysCompleted / safeTotal) * 100, 0), 100);

  const partnerCompletedRaw =
    isDuo && typeof partnerDaysCompleted === "number" ? partnerDaysCompleted : 0;
  const partnerPct = isDuo
    ? Math.min(Math.max((partnerCompletedRaw / safeTotal) * 100, 0), 100)
    : 0;
  const partnerCompleted = isDuo ? partnerCompletedRaw : 0;

  const milestoneText = useMemo(() => {
    const variants = t("shareCardT.milestoneVariants", { returnObjects: true });
    if (Array.isArray(variants) && variants.length) {
      const pick = variants[Math.floor(Math.random() * variants.length)];
      return String(pick).replace("{{days}}", String(daysCompleted));
    }
    return t("shareCardT.milestoneMessage", {
      days: daysCompleted,
      defaultValue: `Day ${daysCompleted} 🔥`,
    });
  }, [daysCompleted, t]);

  const handleShare = useCallback(async () => {
    try {
      if (!cardRef.current) return;
      const ok = await Sharing.isAvailableAsync();
      if (!ok) return;

      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: CAPTURE_W,
        height: CAPTURE_H,
      });

      const fileUri = FileSystem.cacheDirectory + `sharecard_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: t("shareCardT.shareTitle", { defaultValue: "Partager ma carte" }),
      });
    } catch (e) {
      console.log("ShareCard error:", e);
    }
  }, [t]);

  const styles = useMemo(() => createStyles(th, s, IS_TINY), [th, s, IS_TINY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          entering={ZoomIn.springify().damping(18).stiffness(190)}
          exiting={ZoomOut.duration(140)}
          style={styles.centerWrap}
        >
          {/* ✅ CARD (captured) */}
          <View
            ref={cardRef}
            collapsable={false}
            renderToHardwareTextureAndroid
            needsOffscreenAlphaCompositing
            style={[styles.cardFrame, { width: CARD_W, height: CARD_H }]}
          >
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
              <View style={styles.cardInner}>
                {/* ambient */}
                <View pointerEvents="none" style={styles.ambient}>
                  <LinearGradient
                    colors={[withAlpha(th.colors.primary, 0.55), "transparent"]}
                    start={{ x: 0.2, y: 0.2 }}
                    end={{ x: 0.8, y: 0.8 }}
                    style={styles.orbA}
                  />
                  <LinearGradient
                    colors={[withAlpha(th.colors.secondary, 0.45), "transparent"]}
                    start={{ x: 0.8, y: 0.2 }}
                    end={{ x: 0.2, y: 0.8 }}
                    style={styles.orbB}
                  />
                  <LinearGradient
                    colors={[withAlpha("#FFFFFF", 0.14), "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sheen}
                  />
                </View>

                {/* ✅ LAYOUT LOCKED */}
                <View style={styles.layout}>
                  {/* HEADER */}
                  <LinearGradient colors={[th.colors.primary, th.colors.secondary]} style={styles.header}>
                    <View style={styles.headerRow}>
                      <Image
                        source={require("../assets/images/adaptive-icon.png")}
                        style={styles.appLogo}
                      />
                      {userAvatar ? (
                        <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
                      ) : (
                        <View style={styles.headerAvatarGhost} />
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
                      style={styles.title}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {challengeTitle}
                    </Text>
                  </LinearGradient>

                  {/* BODY */}
                  <View style={styles.body}>
                    {!isDuo ? (
                      <View style={styles.solo}>
                        {!!userName && (
                          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                            {userName}
                          </Text>
                        )}

                        <Text
                          style={styles.heroPct}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                        >
                          {Math.round(userPct)}%
                        </Text>

                        <Text style={styles.dayLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {t("shareCardT.dayOf", {
                            day: daysCompleted,
                            total: totalDays,
                            defaultValue: `Day ${daysCompleted} of ${totalDays}`,
                          })}
                        </Text>

                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${userPct}%` }]} />
                        </View>

                        <Text style={styles.milestone} numberOfLines={1} ellipsizeMode="tail">
                          {t("shareCardT.milestoneShort", {
                            days: daysCompleted,
                            defaultValue: `Day ${daysCompleted} 🔥`,
                          })}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.duo}>
                        <Text
                          style={styles.duoHeadline}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.86}
                        >
                          {t("shareCardT.dayOf", {
                            day: Math.max(daysCompleted, partnerCompleted),
                            total: totalDays,
                            defaultValue: `Day ${Math.max(daysCompleted, partnerCompleted)} of ${totalDays}`,
                          })}
                        </Text>

                        <View style={styles.duoRow}>
                          <View style={[styles.duoSide, userPct >= partnerPct && styles.duoSideHi]}>
                            <View style={styles.avatarRingSm}>
                              {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.avatar} />
                              ) : (
                                <View style={[styles.avatar, styles.avatarFallback]} />
                              )}
                            </View>

                            {!!userName && (
                              <Text style={styles.duoName} numberOfLines={1} ellipsizeMode="tail">
                                {userName}
                              </Text>
                            )}

                            <View style={styles.miniTrack}>
                              <View style={[styles.miniFill, { width: `${userPct}%` }]} />
                            </View>

                            <Text style={styles.duoLabel} numberOfLines={1}>
                              {daysCompleted}/{totalDays}
                            </Text>
                          </View>

                          <View style={styles.vsBadge}>
                            <Text style={styles.vsText}>VS</Text>
                          </View>

                          <View style={[styles.duoSide, partnerPct >= userPct && styles.duoSideHi]}>
                            <View style={styles.avatarRingSm}>
                              {partnerAvatar ? (
                                <Image source={{ uri: partnerAvatar }} style={styles.avatar} />
                              ) : (
                                <View style={[styles.avatar, styles.avatarFallback]} />
                              )}
                            </View>

                            {!!partnerName && (
                              <Text style={styles.duoName} numberOfLines={1} ellipsizeMode="tail">
                                {partnerName}
                              </Text>
                            )}

                            <View style={styles.miniTrack}>
                              <View
                                style={[
                                  styles.miniFill,
                                  { width: `${partnerPct}%`, backgroundColor: th.colors.secondary },
                                ]}
                              />
                            </View>

                            <Text style={styles.duoLabel} numberOfLines={1}>
                              {partnerCompleted}/{totalDays}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={styles.milestoneDuo}
                          numberOfLines={IS_TINY ? 1 : 2}
                          ellipsizeMode="tail"
                          adjustsFontSizeToFit
                          minimumFontScale={0.74}
                        >
                          {milestoneText}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* FOOTER */}
                  <View style={styles.footer}>
                    <Text style={styles.footerTitle} numberOfLines={1} ellipsizeMode="tail">
                      {t("shareCardT.footerLine1", { defaultValue: "ChallengeTies" })}
                    </Text>
                    <Text style={styles.footerSub} numberOfLines={2} ellipsizeMode="tail">
                      {t("shareCardT.tagline", { defaultValue: "Rejoins le défi sur ChallengeTies" })}
                    </Text>
                    <Text style={styles.watermark} numberOfLines={1} ellipsizeMode="clip">
                      {t("shareCardT.watermark", { defaultValue: "@ChallengeTies" })}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ✅ ACTIONS (not captured) */}
          <View style={[styles.actions, { width: CARD_W, paddingBottom: Math.max(10, insets.bottom + 6) }]}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{t("shareCardT.shareBtn", { defaultValue: "Partager" })}</Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>{t("commonS.close", { defaultValue: "Fermer" })}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

function createStyles(th: Theme, s: (n: number) => number, IS_TINY: boolean) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.72)",
    },
    centerWrap: {
      width: "100%",
      paddingHorizontal: 16,
      alignItems: "center",
    },

    // CARD SHELL
    cardFrame: {
      borderRadius: 28,
      overflow: "hidden",
      ...(Platform.OS === "ios"
        ? {
            shadowColor: "#000",
            shadowOpacity: 0.26,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 14 },
          }
        : { elevation: 10 }),
    },
    cardBorder: {
      flex: 1,
      borderRadius: 28,
      padding: 2,
    },
    cardInner: {
      flex: 1,
      borderRadius: 26,
      overflow: "hidden",
      backgroundColor: withAlpha("#04050C", 0.92),
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.10),
    },

    ambient: { ...StyleSheet.absoluteFillObject },
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

    // ✅ LOCKED LAYOUT
    layout: { flex: 1 },

    header: {
      flexShrink: 0,
      paddingHorizontal: s(16),
      paddingTop: s(14),
      paddingBottom: s(12),
      alignItems: "center",
    },
    headerRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: s(8),
    },
    appLogo: {
      width: s(40),
      height: s(40),
      borderRadius: s(12),
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.35),
    },
    headerAvatar: {
      width: s(36),
      height: s(36),
      borderRadius: s(18),
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.35),
    },
    headerAvatarGhost: {
      width: s(36),
      height: s(36),
      borderRadius: s(18),
      borderWidth: 1,
      borderColor: withAlpha("#ffffff", 0.18),
      backgroundColor: withAlpha("#000", 0.15),
    },

    modePill: {
      marginTop: s(2),
      paddingHorizontal: s(12),
      paddingVertical: s(6),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.30),
      backgroundColor: withAlpha("#000000", 0.18),
    },
    modePillText: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(12),
      letterSpacing: 1.2,
      opacity: 0.95,
      includeFontPadding: false,
    },

    title: {
      marginTop: s(10),
      paddingHorizontal: s(10),
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(IS_TINY ? 16 : 18),
      lineHeight: s(IS_TINY ? 20 : 22),
      textAlign: "center",
      includeFontPadding: false,
    },

    body: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: s(16),
      paddingVertical: s(IS_TINY ? 10 : 12),
    },

    // SOLO
    solo: { alignItems: "center" },
    name: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(16),
      opacity: 0.98,
      marginBottom: s(6),
      includeFontPadding: false,
    },
    heroPct: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(IS_TINY ? 36 : 40),
      letterSpacing: 0.6,
      marginBottom: s(6),
      includeFontPadding: false,
    },
    dayLine: {
      color: withAlpha("#FFFFFF", 0.86),
      fontFamily: "Comfortaa_400Regular",
      fontSize: s(13),
      marginBottom: s(10),
      includeFontPadding: false,
    },
    progressTrack: {
      width: "78%",
      height: s(12),
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: withAlpha("#FFFFFF", 0.10),
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.12),
      marginBottom: s(10),
    },
    progressFill: { height: "100%", backgroundColor: th.colors.primary },

    milestone: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(12),
      opacity: 0.88,
      includeFontPadding: false,
    },

    // DUO
    duo: { alignItems: "center" },
    duoHeadline: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(15),
      opacity: 0.96,
      marginBottom: s(10),
      includeFontPadding: false,
    },
    duoRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: s(10),
    },
    duoSide: {
      width: "41%",
      alignItems: "center",
      paddingVertical: s(6),
      borderRadius: s(16),
    },
    duoSideHi: {
      borderWidth: 1.5,
      borderColor: withAlpha("#FFFFFF", 0.22),
      backgroundColor: withAlpha("#000", 0.10),
    },
    avatarRingSm: {
      width: s(70),
      height: s(70),
      borderRadius: s(35),
      padding: 2,
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.18),
      backgroundColor: withAlpha("#000", 0.18),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: s(6),
    },
    avatar: {
      width: s(62),
      height: s(62),
      borderRadius: s(31),
    },
    avatarFallback: {
      backgroundColor: withAlpha("#FFFFFF", 0.08),
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.14),
    },
    duoName: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(13),
      marginBottom: s(6),
      includeFontPadding: false,
    },
    miniTrack: {
      width: "86%",
      height: s(8),
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: withAlpha("#FFFFFF", 0.10),
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.12),
      marginBottom: s(6),
    },
    miniFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: th.colors.primary,
    },
    duoLabel: {
      color: withAlpha("#FFFFFF", 0.86),
      fontFamily: "Comfortaa_400Regular",
      fontSize: s(12),
      includeFontPadding: false,
    },
    vsBadge: {
      width: s(42),
      height: s(42),
      borderRadius: s(21),
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.22),
      backgroundColor: withAlpha("#000000", 0.22),
    },
    vsText: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(13),
      includeFontPadding: false,
    },
    milestoneDuo: {
      marginTop: s(2),
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(12),
      opacity: 0.88,
      textAlign: "center",
      paddingHorizontal: s(12),
      includeFontPadding: false,
    },

    footer: {
      flexShrink: 0,
      paddingHorizontal: s(16),
      paddingTop: s(10),
      paddingBottom: s(12),
      alignItems: "center",
    },
    footerTitle: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(15),
      includeFontPadding: false,
    },
    footerSub: {
      marginTop: s(4),
      color: withAlpha("#FFFFFF", 0.78),
      fontFamily: "Comfortaa_400Regular",
      fontSize: s(11),
      lineHeight: s(14),
      textAlign: "center",
      paddingHorizontal: s(8),
      includeFontPadding: false,
    },
    watermark: {
      marginTop: s(6),
      color: withAlpha("#FFFFFF", 0.28),
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(10),
      letterSpacing: 0.8,
      includeFontPadding: false,
    },

    // ACTIONS
    actions: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10, // si ton RN supporte pas gap, ça n’explose pas car les buttons ont flex:1 + margin géré ci-dessous
    },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: th.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    btnText: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(14),
      letterSpacing: 0.6,
      includeFontPadding: false,
    },
    btnGhost: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha("#FFFFFF", 0.24),
      backgroundColor: withAlpha("#000", 0.22),
      alignItems: "center",
      justifyContent: "center",
    },
    btnGhostText: {
      color: "#fff",
      fontFamily: "Comfortaa_700Bold",
      fontSize: s(14),
      letterSpacing: 0.6,
      opacity: 0.92,
      includeFontPadding: false,
    },
  });
}

export default ShareCardModal;
