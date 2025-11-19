// components/ShareCards.tsx
import React, { forwardRef, useMemo } from "react";
import type { ReactNode } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import type { ViewStyle, TextStyle } from "react-native";
import ViewShot from "react-native-view-shot";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import { Image as ExpoImage } from "expo-image"
import { I18nManager } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

const IMG_LOGO = require("../assets/images/GreatLogo1.png");
const IMG_DEFAULT_AVATAR = require("../assets/images/default-profile.webp");
const { width } = Dimensions.get("window");
// ✅ Responsive à l’écran (aperçu)
const CARD_W = Math.min(1080, Math.round(width * 0.92));
const CARD_H = Math.round(CARD_W * 1.24);
// ✅ Taille d’export haute définition (partage)
export const EXPORT_W = 1080;
export const EXPORT_H = 1350;

// --------- Palette brand par défaut (peut être override via props)
type Brand = {
  bgA: string; bgB: string; bgC: string;
  primary: string; secondary: string; accent: string;
  text: string; textDim: string; textMute: string; border: string;
};
const defaultBrand: Brand = {
  bgA: "#0B1020",
  bgB: "#0F172A",
  bgC: "#111827",
  primary: "#7C3AED",   // ChallengeTies violet
  secondary: "#06B6D4", // cyan
  accent: "#FDE68A",    // amber
  text: "#111111",
  textDim: "#222222",
  textMute: "#444444",
  border: "rgba(0,0,0,0.12)",
};

type BrandOverrides = {
  primary?: string;
  secondary?: string;
  accent?: string;
  text?: string;
  textDim?: string;
  textMute?: string;
  border?: string;
  bgA?: string;
  bgB?: string;
  bgC?: string;
};

// --- styles dynamiques basés sur la palette courante
const makeStyles = (brand: Brand) =>
  StyleSheet.create({
    card: { borderRadius: 32, justifyContent: "flex-start" },
    safePad: { flex: 1, padding: 28, justifyContent: "space-between" },
    statRow: {
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 8,
    },
    statTile: {
      flex: 1,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: "rgba(255,255,255,0.92)",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
    statTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statValue: { fontWeight: "800", fontSize: 28, lineHeight: 30, color: "#0B0B0B" },
    statLabel: { color: "#444", fontSize: 12, lineHeight: 14, marginTop: 6 },

    progressTrack: {
      height: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.08)",
      overflow: "hidden", marginTop: 10,
    },
    progressFill: {
      height: 6, borderRadius: 999,
    },
    // Orbes
    orb: {
      position: "absolute",
      width: CARD_W * 0.95,
      height: CARD_W * 0.95,
      borderRadius: 999,
      opacity: 0.9,
    },
    // Lueur diagonale
    diagGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    
    // Gros logo en header (à droite) — visible & net (légèrement plus grand)
    headerRightLogo: { width: 112, height: 112, marginLeft: 12 },
    // Brand tag
    tag: {
      alignSelf: "flex-start",
      backgroundColor: brand.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
    },
    tagLogo: { width: 26, height: 26, marginRight: 10 }, // logo plus grand et net
    tagText: { color: "#111111", fontWeight: "800", letterSpacing: 0.5 },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    // Glass container
    glass: {
      borderRadius: 24,
      padding: 18,
      backgroundColor: "rgba(255,255,255,0.92)",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
    kicker: { color: brand.primary, fontWeight: "700", fontSize: 18, marginBottom: 6 },
    title: { color: "#0B0B0B", fontWeight: "800", fontSize: 34, lineHeight: 38, marginTop: 2 },     // noir
    body: { color: "#222222", fontSize: 18, lineHeight: 26, marginTop: 10 },                         // gris foncé
    meta: { color: "#444444", fontSize: 18, marginTop: 4 },                                          // gris
    metaSmall: { color: "#555555", fontSize: 14, marginTop: 10 },
    metaTiny: { color: "#666666", fontSize: 12, marginTop: 6 },
    // Footer en pastille blanche pour rester lisible même sur fond sombre
    footer: {
      alignSelf: "center",
      color: "#111111",
      fontSize: 14,
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.92)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    footerRow: {
  alignSelf: "center",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginTop: 16,
  backgroundColor: "rgba(12,12,12,0.86)",
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 999,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.15)",
},
footerLogo: { width: 18, height: 18, borderRadius: 4, overflow: "hidden" },
footerText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 12, marginTop: 6 },
    cell: { width: (CARD_W - 28*2 - 16) / 2 },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      overflow: "hidden",
      opacity: 1,                     // ✅ bien visible
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontWeight: "800", fontSize: 18, color: "#111111" },
  });

const BrandTag = ({ logoSource, styles }: { logoSource?: any; styles: ReturnType<typeof makeStyles> }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.tag}>
      {logoSource ? (
        <ExpoImage source={logoSource} style={styles.tagLogo} contentFit="contain" cachePolicy="memory-disk" />
      ) : null}
      <Text style={styles.tagText}>{t("cards.brandName")}</Text>
    </View>
  );
};

const HeaderBar = ({ qrValue, logoSource, styles }: { qrValue?: string | null; logoSource?: any; styles: ReturnType<typeof makeStyles>; }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.headerRow}>
      <BrandTag logoSource={logoSource} styles={styles} />
      <View style={{ flex: 1 }} />
      <ExpoImage
        source={logoSource || IMG_LOGO}
        style={styles.headerRightLogo}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
        accessibilityLabel={t("cards.accessibility.logoAlt", {
          brand: t("cards.brandName", { defaultValue: "ChallengeTies" }),
          defaultValue: "Logo ChallengeTies"
        })}
      />
    </View>
  );
};


// Carte de base avec décor “galaxy” + glass container
const ExportableCard = forwardRef<
  React.ElementRef<typeof ViewShot>,
  {
    children: React.ReactNode;
    palette?: BrandOverrides;
    logoSource?: any;
    qrValue?: string | null;
    /** optionnel : forcer la taille d’export (ex: { width: 1080, height: 1350 }) */
    exportSize?: { width: number; height: number };
  }
>(
  ({ children, palette, logoSource, qrValue, exportSize }, ref) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const isDark = theme === "dark";
    const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

    // Couleurs CT depuis le designSystem (fallback sur defaults)
    const brandFromTheme: BrandOverrides = {
      primary: currentTheme.colors.primary,
      secondary: currentTheme.colors.secondary,
      text: currentTheme.colors.textPrimary,
      textDim: currentTheme.colors.textSecondary,
      textMute: currentTheme.colors.textSecondary,
      border: currentTheme.colors.border,
      bgA: currentTheme.colors.background,
      bgB: currentTheme.colors.cardBackground,
      bgC: currentTheme.colors.background,
    };

    // ➜ On force une encre sombre pour tous les textes de la carte exportée (lisible sur panneau blanc)
    const forceInk: BrandOverrides = {
      text: "#111111",
      textDim: "#222222",
      textMute: "#444444",
      border: "rgba(0,0,0,0.12)",
    };
    const brand: Brand = { ...defaultBrand, ...brandFromTheme, ...forceInk, ...(palette || {}) } as Brand;
    const styles = makeStyles(brand);
    const isRTL = I18nManager.isRTL;
    // ✅ View: seulement `direction` (writingDirection n’existe pas sur ViewStyle)
    const dirView: ViewStyle = { direction: isRTL ? "rtl" : "ltr" };
    // ✅ Text: on prépare un style pour l’alignement
    const rtlText: TextStyle = { textAlign: isRTL ? "right" : "left" };
    // Ombres iOS/Android cohérentes
    const shadowStyle = useMemo(
      () =>
        Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 16 },
          },
          android: { elevation: 8 },
          default: {},
        }),
      []
    );
// Wrap any raw text children in <Text> to avoid "Text strings must be rendered within a <Text>".
    const normalizeChildren = (nodes: ReactNode): ReactNode => {
      // Map strings/numbers to <Text>, keep elements as-is
      const map = (child: any, idx: number): any => {
        if (typeof child === "string" || typeof child === "number") {
          // ignore pure whitespace between tags that can sneak in from formatting
          const str = String(child);
          if (!str.trim()) return null;
          return <Text key={`txt-${idx}`} style={{ color: "#111111" }}>{str}</Text>;
        }
        return child;
      };
      // children can be a single node or an array/fragment
      // React.Children.map handles all safely
      // eslint-disable-next-line react/no-children-prop
      return React.Children.map(nodes as any, map);
    };

    return (
      <View collapsable={false} style={[{ borderRadius: 32, overflow: "hidden" }, shadowStyle]}>
        <ViewShot
          ref={ref}
          style={{}}
          captureMode="update"               // ✅ capture après update (images chargées)
          options={{
            format: "png",
            quality: 1,
            result: "tmpfile",
            // ✅ export HD sans casser le layout responsive à l’écran
            width: exportSize?.width ?? undefined,
            height: exportSize?.height ?? undefined,
          }}
        >
          {/* Fond multi-dégradés + orbes */}
          <LinearGradient
            colors={[brand.bgA!, brand.bgB!, brand.bgC!]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.card, { width: CARD_W, height: CARD_H }]}
          >
            {/* Orbes décoratives */}
            <LinearGradient
              colors={[brand.primary + "33", "transparent"]}
              style={[styles.orb, { top: -140, right: -110, transform: [{ rotate: "18deg" }] }]}
            />
            <LinearGradient
              colors={[brand.secondary + "2A", "transparent"]}
              style={[styles.orb, { bottom: -160, left: -120, transform: [{ rotate: "-12deg" }] }]}
            />

            {/* Lueur diagonale subtile */}
            <LinearGradient
              colors={["transparent", brand.primary + "10", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.diagGlow}
            />

            {/* Contenu dans une “glass panel” */}
            <View style={styles.safePad}>
              <HeaderBar styles={styles} logoSource={logoSource} qrValue={null} />

              <View
              style={[
                styles.glass,
                Platform.OS === "web" ? ({ backdropFilter: "blur(10px)" } as any) : null,
              ]}
            >
                {/* Hairline top */}
                <View style={styles.hairline} />
                <View style={dirView}>
                  {normalizeChildren(children)}
                </View>
                {/* Hairline bottom */}
                <View style={[styles.hairline, { marginTop: 16 }]} />
              </View>

              <View style={styles.footerRow}>
  <ExpoImage source={logoSource || IMG_LOGO} style={styles.footerLogo} contentFit="cover" />
  <Text style={styles.footerText}>#ChallengeTies • challengeties.app</Text>
</View>
              
            </View>
          </LinearGradient>
        </ViewShot>
      </View>
    );
  }
);
ExportableCard.displayName = "ExportableCard";

/** 1) TIP CARD */
export const TipShareCard = forwardRef<React.ElementRef<typeof ViewShot>, {
  title: string;
  tip: string;
  i18n?: { kicker?: string };
}>(
  ({ title, tip, i18n }, ref) => (
    <ExportableCard ref={ref}>
      <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 6, color: "#0B0B0B" }}>
        {i18n?.kicker ?? "Daily tip"}
      </Text>
      <Text style={{ color: "#0B0B0B", fontWeight: "800", fontSize: 34, lineHeight: 38, marginTop: 2 }} numberOfLines={2}>{title}</Text>
      <Text style={{ color: "#222222", fontSize: 18, lineHeight: 26, marginTop: 10 }} numberOfLines={6}>{tip}</Text>
    </ExportableCard>
  )
);
TipShareCard.displayName = "TipShareCard";

/** 2) RANK CARD */
export const RankShareCard = forwardRef<React.ElementRef<typeof ViewShot>, {
  username: string;
  rank: number | string;
  trophies?: number;
  avatarUri?: string | null;
palette?: BrandOverrides;
  logoSource?: any;
  qrValue?: string | null;
i18n?: { kicker?: string; body?: (rank: number|string)=>string };
}>(({ username, rank, trophies, avatarUri, palette, logoSource, qrValue, i18n }, ref) => {
  
  // on recrée un styles local cohérent via makeStyles pour la typographie
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const brand: Brand = {
    ...defaultBrand,
    primary: currentTheme.colors.primary,
    secondary: currentTheme.colors.secondary,
    text: currentTheme.colors.textPrimary,
    textDim: currentTheme.colors.textSecondary,
    textMute: currentTheme.colors.textSecondary,
    border: currentTheme.colors.border,
    bgA: currentTheme.colors.background,
    bgB: currentTheme.colors.cardBackground,
    bgC: currentTheme.colors.background,
    ...(palette || {}),
  };
  const s = makeStyles(brand);
  // —— Font size adaptatif pour @username —— 
  const unameLen = (username || "").length;
  const usernameFontSize =
    unameLen > 22 ? 20 :
    unameLen > 18 ? 22 :
    unameLen > 14 ? 24 :
    unameLen > 10 ? 28 : 32; // max 32

  return (
    <ExportableCard ref={ref} palette={palette} logoSource={logoSource} qrValue={qrValue}>
       <Text style={s.kicker}>{i18n?.kicker ?? "My ranking"}</Text>
      <View style={s.row}>
  <ExpoImage
    source={avatarUri ? { uri: avatarUri } : IMG_DEFAULT_AVATAR}
    style={s.avatar}
    contentFit="cover"
    cachePolicy="memory-disk"
    transition={120}
    priority="high"
    accessibilityLabel={avatarUri ? "Avatar utilisateur" : "Avatar par défaut"}
  />

  <View style={{ flex: 1 }}>
    <Text
      numberOfLines={1}
      // Start grand puis auto-shrink si besoin (iOS/Android OK en RN récent)
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.0}
      style={[s.title, { fontSize: usernameFontSize, lineHeight: usernameFontSize + 4 }]}
      allowFontScaling={false}
    >
      @{username}
    </Text>
    <Text style={s.meta} numberOfLines={1}>
      #{rank} • {trophies ?? 0}🏆
    </Text>
  </View>
</View>

<Text style={s.body}>
{i18n?.body ? i18n.body(rank) : `I'm #${rank} this week! Challenge me on ChallengeTies and climb the leaderboard 💥`}      </Text>    </ExportableCard>
  );
});
RankShareCard.displayName = "RankShareCard";

/** 3) FEATURE CARD */
export const FeatureShareCard = forwardRef<React.ElementRef<typeof ViewShot>, {
  featureTitle: string;
  description?: string;
palette?: BrandOverrides;
  logoSource?: any;
  qrValue?: string | null;
i18n?: { kicker?: string; footer?: string };
}>(({ featureTitle, palette, logoSource, qrValue, i18n }, ref) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const brand: Brand = {
    ...defaultBrand,
    primary: currentTheme.colors.primary,
    secondary: currentTheme.colors.secondary,
    text: currentTheme.colors.textPrimary,
    textDim: currentTheme.colors.textSecondary,
    textMute: currentTheme.colors.textSecondary,
    border: currentTheme.colors.border,
    bgA: currentTheme.colors.background,
    bgB: currentTheme.colors.cardBackground,
    bgC: currentTheme.colors.background,
    ...(palette || {}),
  };
  const s = makeStyles(brand);
  return (
    <ExportableCard ref={ref} palette={palette} logoSource={logoSource} qrValue={qrValue}>
      <Text style={s.kicker}>
        {i18n?.kicker ?? t("newFeatures.share.kicker", { defaultValue: "Vote la prochaine nouveauté" })}
      </Text>
      <Text style={s.title} numberOfLines={2}>{featureTitle}</Text>
      <Text style={[s.metaSmall, { marginTop: 8 }]}>
        {i18n?.footer ?? t("newFeatures.share.footerWithDays", { days: 3, defaultValue: "Fin du vote dans {{days}} jours — ta voix compte ✨" })}
      </Text>
    </ExportableCard>
  );
});
FeatureShareCard.displayName = "FeatureShareCard";

/** 4) STATS CARD — partage des stats utilisateur */
export const StatsShareCard = forwardRef<
  React.ElementRef<typeof ViewShot>,
  {
    username?: string | null;
    avatarUri?: string | null;
    // Option A (recommandée) : items i18n prêt-à-afficher (max 4–5 pour éviter la coupe)
    items?: { label: string; value: string }[];
    // Option B (legacy) : stats brutes — on garde pour compat, mais on n’en affiche que 4
    stats?: {
      saved: number;
      ongoing: number;
      completed: number;
      successRatePct: number;
      longestStreak: number;
      trophies: number;
      achievements: number;
    };
    palette?: BrandOverrides;
    logoSource?: any;
    qrValue?: string | null;
    i18n?: { kickerWhenNoUser?: string; subtitleWhenUser?: string };
  }
>(({ username, avatarUri, stats, items, palette, logoSource, qrValue, i18n }, ref) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const brand: Brand = {
    ...defaultBrand,
    primary: currentTheme.colors.primary,
    secondary: currentTheme.colors.secondary,
    text: currentTheme.colors.textPrimary,
    textDim: currentTheme.colors.textSecondary,
    textMute: currentTheme.colors.textSecondary,
    border: currentTheme.colors.border,
    bgA: currentTheme.colors.background,
    bgB: currentTheme.colors.cardBackground,
    bgC: currentTheme.colors.background,
    ...(palette || {}),
  };
  const s = makeStyles(brand);

// ---- Helpers
  const nf = (n: number) => {
    try { return new Intl.NumberFormat().format(n); } catch { return String(n); }
  };
  const clamp = (n: number, min = 0, max = 100) => Math.min(Math.max(n, min), max);

  // Sélection “Top 3” par défaut si items non fournis
  // 1) Completed challenges   2) Success rate   3) Longest streak
  type KV = { key: "completed" | "success" | "streak"; label: string; value: string; pct?: number };
  let top3: KV[] = [];
  if (items && items.length) {
    // Si l’app te passe déjà des items i18n, on garde les 3 premiers
    top3 = items.slice(0, 3).map((it, idx) => ({
      key: (["completed","success","streak"][idx] as KV["key"]) ?? "completed",
      label: it.label, value: it.value
    }));
  } else if (stats) {
    const sr = clamp(stats.successRatePct ?? 0);
    top3 = [
      { key: "completed", label: "Completed", value: nf(stats.completed ?? 0) },
      { key: "success",   label: "Success rate", value: `${sr}%`, pct: sr },
      { key: "streak",    label: "Longest streak", value: `${nf(stats.longestStreak ?? 0)} d` },
    ];
  }

  return (
    <ExportableCard ref={ref} palette={palette} logoSource={logoSource} qrValue={qrValue}>
      {!!username && (
        <View style={[s.row, { marginBottom: 10 }]}>
          <ExpoImage
            source={avatarUri ? { uri: avatarUri } : IMG_DEFAULT_AVATAR}
            style={s.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.0}
              style={[s.title, { fontSize: 30, lineHeight: 34 }]}
            >
              @{username}
            </Text>
            <Text style={s.metaSmall}>{i18n?.subtitleWhenUser ?? "Mes stats ChallengeTies"}</Text>
          </View>
        </View>
      )}

      {!username && (
        <>
          <Text style={s.kicker}>{i18n?.kickerWhenNoUser ?? "Mes stats"}</Text>
          <Text style={[s.title, { marginBottom: 6 }]}>ChallengeTies</Text>
        </>
      )}

      {/* ====== Top 3 Tiles ====== */}
<View style={s.statRow}>
  {top3.map((it, idx) => {
    const isSuccess = it.key === "success";

    // ✅ tuples readonly typés "as const" (pas de warning TS)
    const gradients = [
      [brand.accent + "E6", "#FFFFFF"] as const,    // Completed – amber → white
      [brand.secondary + "E6", "#FFFFFF"] as const, // Success – cyan → white
      [brand.primary + "E6", "#FFFFFF"] as const,   // Streak – violet → white
    ] as const;

    const gradient = gradients[Math.min(idx, gradients.length - 1)];

    return (
      <LinearGradient
        key={`${it.key}-${idx}`}
        colors={gradient}                 // ✅ tuple readonly
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.statTile}
      >
        <View style={s.statTopRow}>
          <Text
  style={s.statValue}
  numberOfLines={1}
  adjustsFontSizeToFit
  minimumFontScale={0.8}
  maxFontSizeMultiplier={1.0}
>
  {it.value}
</Text>
          {it.key === "completed" && (
            <Ionicons name="checkmark-done-outline" size={20} color="#111" />
          )}
          {it.key === "success" && (
            <Ionicons name="sparkles-outline" size={20} color="#111" />
          )}
          {it.key === "streak" && (
            <Ionicons name="flame-outline" size={20} color="#111" />
          )}
        </View>
        <Text
  style={s.statLabel}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.72}
  maxFontSizeMultiplier={1.0}
>
  {it.label}
</Text>
        {isSuccess && typeof it.pct === "number" && (
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.min(Math.max(it.pct, 0), 100)}%`, backgroundColor: brand.secondary },
              ]}
            />
          </View>
        )}
      </LinearGradient>
    );
  })}
</View>
    </ExportableCard>
  );
});
StatsShareCard.displayName = "StatsShareCard";

/** 5) HELPER CARD — partage mini-cours d’un challenge */
export const HelperShareCard = forwardRef<
  React.ElementRef<typeof ViewShot>,
  {
    title: string;
    summary: string;
    bullets?: string[]; // optionnel: quelques points clés (max 3)
    palette?: BrandOverrides;
    logoSource?: any;
    qrValue?: string | null;
    /** force la taille d’export (ex: { width: 1080, height: 1350 }) */
    exportSize?: { width: number; height: number };
    i18n?: { kicker?: string };
  }
>(({ title, summary, bullets, palette, logoSource, qrValue, exportSize, i18n }, ref) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const brand: Brand = {
    ...defaultBrand,
    primary: currentTheme.colors.primary,
    secondary: currentTheme.colors.secondary,
    text: currentTheme.colors.textPrimary,
    textDim: currentTheme.colors.textSecondary,
    textMute: currentTheme.colors.textSecondary,
    border: currentTheme.colors.border,
    bgA: currentTheme.colors.background,
    bgB: currentTheme.colors.cardBackground,
    bgC: currentTheme.colors.background,
    ...(palette || {}),
  };
  const s = makeStyles(brand);

  return (
    <ExportableCard
      ref={ref}
      palette={palette}
      logoSource={logoSource}
      qrValue={qrValue}
      exportSize={exportSize}
    >
      <Text style={s.kicker}>{i18n?.kicker ?? "Challenge helper"}</Text>
      <Text style={[s.title]} numberOfLines={2}>{title}</Text>

      <Text style={[s.body]} numberOfLines={6}>
        {summary}
      </Text>

      {!!bullets?.length && (
        <View style={{ marginTop: 10 }}>
          {bullets.slice(0, 3).map((b, i) => (
            <Text key={i} style={s.metaSmall} numberOfLines={2}>
              • {b}
            </Text>
          ))}
        </View>
      )}
    </ExportableCard>
  );
});
HelperShareCard.displayName = "HelperShareCard";


