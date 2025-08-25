// components/ShareCard.tsx
import React, { forwardRef, useMemo } from "react";
import { View, Text, StyleSheet, Dimensions, ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

/** --- Responsive crisp sizing --- */
const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const CARD_WIDTH = Math.min(1080, Math.round(SCREEN_WIDTH * 0.92));
export const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.56);
const s = (n: number) => Math.max(1, Math.round((n / 1080) * CARD_WIDTH));

export type ShareCardTheme = {
  primary: string;
  secondary: string;
  bgA: string;
  bgB: string;
  bgC: string;
  textPrimary: string;
  textSecondary: string;
  chipBg: string;
};

export type ShareCardProps = {
  username: string;
  avatarUrl?: string;
  challengeTitle: string;
  /** Le fond est le logo plein cadre via brandLogoSource */
  challengeImageUrl?: string; // (ignoré ici)
  completedDays: number;
  totalDays: number;
  dark?: boolean;
  themeColors?: Partial<ShareCardTheme>;
  /** Logo ChallengeTies (ex: require('../../assets/images/icon.png')) */
  brandLogoSource?: ImageSourcePropType;
  shareUrl?: string;
};

const initialsFromName = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase()).join("") || "U";

const frOrdinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

const ShareCard = forwardRef<View, ShareCardProps>((props, ref) => {
  const {
    username,
    avatarUrl,
    challengeTitle,
    completedDays,
    totalDays,
    dark = true,
    themeColors,
    brandLogoSource,
    shareUrl,
  } = props;

  const pct = useMemo(() => {
    if (!totalDays || totalDays <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((completedDays / totalDays) * 100)));
  }, [completedDays, totalDays]);

  const defaults: ShareCardTheme = dark
    ? {
        primary: "#00D1FF",
        secondary: "#7C3AED",
        bgA: "#070A12",
        bgB: "#0C1120",
        bgC: "#0E173A",
        textPrimary: "#FFFFFF",
        textSecondary: "rgba(255,255,255,0.82)",
        chipBg: "rgba(255,255,255,0.12)",
      }
    : {
        primary: "#0EA5E9",
        secondary: "#8B5CF6",
        bgA: "#EAF2FF",
        bgB: "#F3F7FF",
        bgC: "#FFFFFF",
        textPrimary: "#0B1020",
        textSecondary: "#44506C",
        chipBg: "rgba(10,20,40,0.06)",
      };

  const colors: ShareCardTheme = { ...defaults, ...(themeColors || {}) };

  // Progress & cadre selon thème
  const PROGRESS_FILL = dark ? "#FFD700" : "#F69E07";
  const PROGRESS_TRACK = dark ? "rgba(255,255,255,0.18)" : "rgba(10,20,40,0.14)";
  const BORDER_COLOR = dark ? "rgba(255,215,0,0.95)" : "rgba(246,158,7,0.95)";

  const avatarSrc =
    avatarUrl ||
    `https://ui-avatars.com/api/?background=0D8ABC&color=fff&bold=true&name=${encodeURIComponent(
      initialsFromName(username)
    )}`;

  const progressHeadline =
    totalDays > 0 && completedDays >= totalDays
      ? "Je viens de finir !"
      : completedDays > 0
      ? `Je suis à mon ${frOrdinal(completedDays)} jour !`
      : "Je commence aujourd’hui !";

  return (
    <View ref={ref} style={styles.canvas} collapsable={false}>
      {/* === BACKGROUND: LOGO FULL COVER === */}
      {brandLogoSource ? (
        <Image
          source={brandLogoSource}
          style={[StyleSheet.absoluteFill, { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: s(40) }]}
          contentFit="cover"
          cachePolicy="disk"
          transition={80}
        />
      ) : (
        <LinearGradient
          colors={[colors.bgA, colors.bgB, colors.bgC]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: s(40) }]}
        />
      )}

      {/* === OVERLAY GLOBAL LÉGER (lisibilité) === */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: s(40), backgroundColor: dark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.22)" },
        ]}
      />

      {/* Vignette basse très légère */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.0)", dark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.18)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: s(40) }]}
      />

      {/* === CARD LAYER === */}
      <View style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
        {/* TITRES CENTRÉS HAUT (blanc) */}
        <View style={styles.topCenterTitles}>
          <Text style={styles.appTitle}>ChallengeTies</Text>
          <Text style={styles.challengeTitle} numberOfLines={2}>
            {challengeTitle}
          </Text>
        </View>

        {/* CONTENU BAS */}
        <View style={styles.bottomContent}>
          {/* User + Headline */}
          <View style={styles.userRow}>
            <Image source={{ uri: avatarSrc }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headline} numberOfLines={2}>
                {progressHeadline}
              </Text>
              <Text style={styles.subline} numberOfLines={1}>
                {username}
              </Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressArea}>
            <View style={[styles.progressTrack, { backgroundColor: PROGRESS_TRACK }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: PROGRESS_FILL }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressPct}>{pct}%</Text>
              <Text style={styles.progressCount}>
                {completedDays}/{Math.max(1, totalDays)} jours
              </Text>
            </View>
          </View>

          {/* Punchline */}
          <Text style={styles.punchline} numberOfLines={1}>
            Et toi ? Qu’est-ce que tu attends pour commencer ?
          </Text>
        </View>

        {/* BORDURE PREMIUM */}
        <View pointerEvents="none" style={[styles.borderOverlay, { borderColor: BORDER_COLOR, shadowColor: dark ? "#000" : "#111827" }]} />
      </View>
    </View>
  );
});

ShareCard.displayName = "ShareCard";

const styles = StyleSheet.create({
  canvas: { position: "relative" },

  card: {
    borderRadius: s(40),
    overflow: "hidden",
    justifyContent: "space-between",
  },

  /** Bordure premium (or/orange) */
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: s(40),
    borderWidth: s(10),
    shadowOpacity: 0.28,
    shadowRadius: s(22),
    shadowOffset: { width: 0, height: s(10) },
  },

  /** TITRES centrés haut (blanc) */
  topCenterTitles: {
    position: "absolute",
    top: s(24),
    left: s(24),
    right: s(24),
    alignItems: "center",
    zIndex: 3,
  },
  appTitle: {
    fontSize: s(52),
    fontFamily: "Comfortaa_700Bold",
    letterSpacing: 0.4,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: s(2) },
    textShadowRadius: s(4),
  },
  challengeTitle: {
    marginTop: s(10),
    fontSize: s(40),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    lineHeight: s(44),
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: s(2) },
    textShadowRadius: s(4),
  },

  /** CONTENU bas */
  bottomContent: {
    flex: 1,
    paddingHorizontal: s(30),
    paddingBottom: s(30),
    justifyContent: "flex-end",
    gap: s(16),
    zIndex: 2,
  },

  /** USER ROW */
  userRow: { flexDirection: "row", alignItems: "center", gap: s(16) },
  avatar: {
    width: s(96),
    height: s(96),
    borderRadius: s(48),
    borderWidth: s(3),
    borderColor: "rgba(255,255,255,0.95)",
  },
  headline: {
    fontSize: s(44),
    lineHeight: s(48),
    letterSpacing: 0.2,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
  },
  subline: {
    marginTop: s(6),
    fontSize: s(22),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(255,255,255,0.85)",
  },

  /** PROGRESSION */
  progressArea: { marginTop: s(6) },
  progressTrack: { height: s(28), borderRadius: s(16), overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: s(16) },
  progressMeta: {
    marginTop: s(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressPct: { fontSize: s(32), fontFamily: "Comfortaa_700Bold", color: "#FFFFFF" },
  progressCount: { fontSize: s(22), fontFamily: "Comfortaa_400Regular", color: "rgba(255,255,255,0.85)" },

  /** PUNCHLINE */
  punchline: { fontSize: s(30), fontFamily: "Comfortaa_700Bold", color: "#FFFFFF" },
});

export default ShareCard;
