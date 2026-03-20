import { StyleSheet, Platform } from "react-native";
import {
  SPACING,
  normalizeSize,
  shadowSoft,
  R,
  GLASS,
  ACCENT,
  S,
} from "./challengeDetails.tokens";

export const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── DUO PENDING ──────────────────────────────────────────────────────────
  duoPendingVsPillV2: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    minWidth: 44, alignItems: "center", justifyContent: "center",
    zIndex: 6, elevation: 6, overflow: "visible",
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(249,115,22,0.38)",
  },
  duoPendingVsTextV2: {
    fontFamily: "Comfortaa_700Bold", fontSize: 12, letterSpacing: 1, color: "#fff",
  },
  duoPendingRingV2: {
    position: "absolute", width: 56, height: 56, borderRadius: 56,
    borderWidth: 1.5, borderColor: "rgba(249,115,22,0.50)",
  },
  duoPendingGlowV2: {
    position: "absolute", width: 18, height: 18, borderRadius: 18,
    backgroundColor: "rgba(249,115,22,0.22)",
  },
  duoPendingDotV2: {
    position: "absolute", width: 18, height: 18, borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.55)",
  },
  duoPendingDotCoreV2: { width: 7, height: 7, borderRadius: 7, backgroundColor: "#F97316" },
  warmupToastWrap: { position: "absolute", left: 14, right: 14, zIndex: 99999, elevation: 999 },
  warmupToastBlur: { borderRadius: 20, overflow: "hidden" },
  warmupToastInner: {
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  warmupToastStroke: {
    ...StyleSheet.absoluteFillObject, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)",
  },
  warmupToastIconPill: {
    width: 32, height: 32, borderRadius: 12, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  warmupToastTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 13.5, lineHeight: 17 },
  warmupToastSub: { marginTop: 2, fontFamily: "Comfortaa_400Regular", fontSize: 12, lineHeight: 16 },
  duoPendingShell: { marginTop: 14, width: "100%" },
  duoPendingCardV2: {
    borderRadius: 22, padding: 16, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(249,115,22,0.22)",
    ...shadowSoft,
  },
  duoPendingStrokeV2: {
    ...StyleSheet.absoluteFillObject, borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.10)", opacity: 0.9,
  },
  duoPendingSheenV2: {
    position: "absolute", left: -40, top: -60, width: 180, height: 180,
    borderRadius: 180, backgroundColor: "rgba(249,115,22,0.07)",
    transform: [{ rotate: "18deg" }],
  },
  duoPendingTopRowV2: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  duoPendingDotWrapV2: { width: 18, height: 18, marginRight: 10, alignItems: "center", justifyContent: "center" },
  duoPendingTopTextV2: { flex: 1, minWidth: 0, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12.5), letterSpacing: 0.3 },
  duoPendingTopRightV2: { width: 22, alignItems: "flex-end" },
  duoPendingCenterV2: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  duoPendingAvatarColV2: { width: "40%", alignItems: "center" },
  duoPendingNameV2: { marginTop: 8, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12.8) },
  duoPendingConnectorV2: { width: "20%", alignItems: "center", justifyContent: "center" },
  duoPendingLineV2: { width: 2, height: 16, borderRadius: 2, backgroundColor: "rgba(249,115,22,0.20)" },
  duoPendingHintV2: { textAlign: "center", fontFamily: "Comfortaa_400Regular", fontSize: normalizeSize(12.5), lineHeight: normalizeSize(17), marginBottom: 14, opacity: 0.78 },
  duoPendingActionsV2: { flexDirection: "row", gap: 10 },
  duoPendingPrimaryBtnV2: { flex: 1, height: 48, borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  duoPendingPrimaryBtnDisabledV2: { opacity: 0.88 },
  duoPendingPrimaryTextV2: { flex: 1, minWidth: 0, marginLeft: 10, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(13), color: "#111" },
  duoPendingGhostBtnV2: { width: 118, height: 48, borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  duoPendingGhostInnerV2: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  duoPendingGhostTextV2: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12.8) },

  // ── IMAGE HERO ────────────────────────────────────────────────────────────
  imageContainer: {
    width: "100%", borderBottomLeftRadius: R.hero, borderBottomRightRadius: R.hero,
    overflow: "hidden", marginBottom: SPACING, ...S.float,
  },
  image: { width: "100%", backfaceVisibility: "hidden", borderBottomLeftRadius: R.hero, borderBottomRightRadius: R.hero },
  heroOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0 },
  heroVignette: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },

  // ── HERO CARD premium ─────────────────────────────────────────────────────
  heroCardWrap: { width: "100%", paddingHorizontal: SPACING * 1.2, marginTop: -normalizeSize(26) },
  heroCardBlur: {
    borderRadius: R.card, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(249,115,22,0.20)",
    ...S.float,
  },
  heroCardInner: {
    borderRadius: R.card,
    paddingHorizontal: SPACING * 1.2,
    paddingTop: SPACING * 1.1,
    paddingBottom: SPACING * 1.3,
  },

  // ── TEXTES ───────────────────────────────────────────────────────────────
  infoRecipeName: {
    fontSize: normalizeSize(27), marginTop: SPACING * 0.2, marginBottom: SPACING * 0.5,
    textAlign: "center", fontFamily: "Comfortaa_700Bold",
    letterSpacing: -0.2, includeFontPadding: false,
  },
  category: {
    fontSize: normalizeSize(10.5), marginVertical: SPACING / 3,
    textAlign: "center", fontFamily: "Comfortaa_700Bold",
    letterSpacing: 3, includeFontPadding: false,
  },

  // ── CHIPS ────────────────────────────────────────────────────────────────
  chipRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 8, gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  chipDark: { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.28)" },
  chipLight: {
  backgroundColor: "rgba(249,115,22,0.12)",
  borderColor: "rgba(249,115,22,0.32)",
},
  chipText: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(11.5), marginLeft: 5, includeFontPadding: false },

  // ── CTA ───────────────────────────────────────────────────────────────────
  takeChallengeButton: {
    borderRadius: R.btn, overflow: "hidden",
    marginTop: normalizeSize(16), marginHorizontal: SPACING * 0.4,
    ...Platform.select({
      ios: { shadowColor: "#F97316", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  takeChallengeButtonGradient: { paddingVertical: normalizeSize(17), paddingHorizontal: SPACING * 2, alignItems: "center", justifyContent: "center" },
  takeChallengeButtonText: { fontSize: normalizeSize(16), fontFamily: "Comfortaa_700Bold", textAlign: "center", letterSpacing: 0.4, includeFontPadding: false },

  // ── EN COURS ──────────────────────────────────────────────────────────────
  progressSection: { alignItems: "center", paddingHorizontal: SPACING, paddingTop: SPACING, width: "100%", maxWidth: 560, alignSelf: "center" },
  inProgressText: { fontSize: normalizeSize(13), marginTop: SPACING, fontFamily: "Comfortaa_700Bold", includeFontPadding: false, letterSpacing: 1.8, textTransform: "uppercase" },
  progressBarBackground: {
    position: "relative", width: "100%", maxWidth: 480, minWidth: 220, alignSelf: "center",
    zIndex: 0, height: normalizeSize(10), borderRadius: normalizeSize(5), overflow: "hidden",
    marginTop: SPACING, borderWidth: 1, borderColor: "rgba(249,115,22,0.18)",
  },
  progressBarFill: { height: "100%" },
  progressText: { fontSize: normalizeSize(13), marginBottom: SPACING, textAlign: "center", marginTop: SPACING / 2, fontFamily: "Comfortaa_400Regular", includeFontPadding: false },
  avatarWrap: {
  width: normalizeSize(52), height: normalizeSize(52), borderRadius: normalizeSize(26),
  alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 4,
  borderWidth: 2, borderColor: "rgba(249,115,22,0.40)",
    ...Platform.select({
      ios: { shadowColor: "#F97316", shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
      default: {},
    }),
  },
  markTodayButton: {
    borderRadius: R.btn, overflow: "hidden",
    marginTop: normalizeSize(14), marginHorizontal: SPACING * 0.4,
    width: "100%", maxWidth: 480, alignSelf: "center",
    ...Platform.select({
      ios: { shadowColor: "#F97316", shadowOpacity: 0.38, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  markTodayButtonGradient: { paddingVertical: normalizeSize(17), paddingHorizontal: SPACING * 2, alignItems: "center", justifyContent: "center", borderRadius: R.btn, flexDirection: "row" },
  markTodayButtonText: { fontSize: normalizeSize(16), fontFamily: "Comfortaa_700Bold", letterSpacing: 0.4, includeFontPadding: false },
  infoDescriptionRecipe: { textAlign: "center", fontSize: normalizeSize(14.5), includeFontPadding: false, marginTop: normalizeSize(20), marginHorizontal: SPACING * 0.8, lineHeight: normalizeSize(22), fontFamily: "Comfortaa_400Regular", opacity: 0.82 },

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  actionsWrap: { marginTop: normalizeSize(20), paddingHorizontal: normalizeSize(12), gap: normalizeSize(10) },
  primaryActions: { gap: normalizeSize(10) },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: normalizeSize(18), height: normalizeSize(56),
    borderRadius: normalizeSize(18), overflow: "hidden",
  },
  // Bouton Inviter — ORANGE #F97316 plein, pas de bleu
  primaryBtnInvite: {
    backgroundColor: "#F97316",
    ...Platform.select({
      ios: { shadowColor: "#F97316", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  primaryBtnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  primaryBtnText: { flex: 1, marginLeft: normalizeSize(12), fontSize: normalizeSize(15), fontFamily: "Comfortaa_700Bold", color: "#fff", letterSpacing: 0.2, includeFontPadding: false },
  primaryBtnTextSecondary: { flex: 1, marginLeft: normalizeSize(12), fontSize: normalizeSize(15), fontFamily: "Comfortaa_700Bold", letterSpacing: 0.2, includeFontPadding: false },
  btnPressed: { transform: [{ scale: 0.972 }], opacity: 0.85 },

  // ── QUICK ACTIONS — glass orange premium ──────────────────────────────────
  quickActions: { marginTop: normalizeSize(2), flexDirection: "row", justifyContent: "space-between", gap: normalizeSize(8) },
  quickBtn: {
  flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center",
  paddingVertical: normalizeSize(13), paddingHorizontal: normalizeSize(6),
  borderRadius: normalizeSize(16), minHeight: normalizeSize(64),
  borderWidth: 1.5,
  borderColor: "#F97316",
  backgroundColor: "#FFFFFF",
  ...Platform.select({
    ios: { shadowColor: "#F97316", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 3 },
    default: {},
  }),
},
  quickBtnInner: { width: "100%", alignItems: "center", justifyContent: "center", gap: normalizeSize(5) },
  quickBtnDisabled: { opacity: 0.32 },
  quickText: { width: "100%", textAlign: "center", flexShrink: 1, minWidth: 0, fontSize: normalizeSize(11.5), fontFamily: "Comfortaa_700Bold", includeFontPadding: false, lineHeight: normalizeSize(14) },
  quickTextActive: { color: "#F97316" },

  // ── DUO ELITE ─────────────────────────────────────────────────────────────
  duoEliteWrap: { marginTop: SPACING * 1.6, alignItems: "center", width: "100%", paddingHorizontal: 8 },
  duoEliteAvatars: { width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: normalizeSize(14), paddingHorizontal: normalizeSize(14), borderRadius: normalizeSize(20), borderWidth: 1 },
  duoEliteCol: { alignItems: "center", flex: 1, minWidth: 0 },
  duoAvatarWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  duoEliteAvatar: { width: "100%", height: "100%", borderRadius: normalizeSize(37), borderWidth: 2, borderColor: "rgba(249,115,22,0.40)", backgroundColor: "rgba(255,255,255,0.08)", ...S.card },
  duoEliteName: { marginTop: 8, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(13), opacity: 0.92, maxWidth: "100%", includeFontPadding: false },
  duoVsPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  duoVs: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12), letterSpacing: 2, includeFontPadding: false },
  duoCrownMini: { position: "absolute", top: -10, right: -10, zIndex: 30 },
  duoCrownPill: {
    width: normalizeSize(26), height: normalizeSize(26), borderRadius: normalizeSize(13),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(249,115,22,0.60)",
    shadowColor: "#F97316", shadowOpacity: 0.45, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  duoCrownMiniEmoji: { fontSize: normalizeSize(14), includeFontPadding: false },
  duoProgressStack: { width: "100%", maxWidth: 560, marginTop: 16, gap: 14 },
  duoBarRow: { width: "100%" },
  duoBarLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7, gap: 10 },
  duoBarLabel: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12), opacity: 0.92, flex: 1, minWidth: 0, includeFontPadding: false },
  duoBarValue: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(12), opacity: 0.50, flexShrink: 0, includeFontPadding: false },
  duoBarTrack: { height: normalizeSize(14), borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", position: "relative" },
  duoBarTrackSheen: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.03)" },
  duoBarTicks: { ...StyleSheet.absoluteFillObject, flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", opacity: 0.28 },
  duoBarTick: { width: 1, height: "60%", borderRadius: 1 },
  duoBarFill: { height: "100%", borderRadius: 999 },
  duoBarFillMe: { shadowColor: "#FF9F1C", shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  duoBarFillPartner: { shadowColor: "#00C2FF", shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },

  // Battle bar
  duoBattleHeaderWrap: { width: "100%", maxWidth: 560, alignSelf: "center", marginTop: 18, marginBottom: 8, paddingHorizontal: 2 },
  duoBattleTitleRow: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    paddingVertical: normalizeSize(10), paddingHorizontal: normalizeSize(14),
    borderRadius: normalizeSize(14), borderWidth: 1, borderColor: "rgba(249,115,22,0.22)",
    zIndex: 2, elevation: 2,
  },
  duoBattleTitle: { flexShrink: 1, minWidth: 0, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(10.5), letterSpacing: 2.5, includeFontPadding: false },
  duoBattleMini: { flexShrink: 0, fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(11), includeFontPadding: false, opacity: 0.70 },
  duoBattleBarWrap: { width: "100%", maxWidth: 560, alignSelf: "center", marginTop: 0 },
  duoBattleBar: { width: "100%", height: normalizeSize(20), borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "rgba(249,115,22,0.22)", position: "relative" },
  duoBattleRail: { ...StyleSheet.absoluteFillObject, opacity: 0.40, backgroundColor: "rgba(255,255,255,0.02)" },
  duoBattleDivider: {
    position: "absolute", left: "50%", top: 1, bottom: 1, width: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.85)",
    shadowColor: "#fff", shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  duoBattleLeft: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#F97316", opacity: 0.92 },
  duoBattleRight: { position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: "#00C2FF", opacity: 0.92 },

  // Avatar shells
  duoAvatarShell: {
    position: "relative", width: normalizeSize(74), height: normalizeSize(74),
    borderRadius: normalizeSize(37), alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.08)",
  },
  duoAvatarFallback: {
    width: "100%", height: "100%", borderRadius: normalizeSize(37),
    alignItems: "center", justifyContent: "center",
    backgroundColor: Platform.OS === "android" ? "rgba(30,15,5,0.95)" : "rgba(249,115,22,0.12)",
  },
  duoAvatarInitial: { fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(22), color: "#F97316", includeFontPadding: false },
  duoAvatarRing: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: normalizeSize(37), borderWidth: 1.5, borderColor: "rgba(249,115,22,0.35)" },
  duoPendingRing: { position: "absolute", width: 38, height: 38, borderRadius: 999, borderWidth: 2.5, borderColor: "#F97316" },
  duoPendingMiniBadge: { position: "absolute", right: 6, bottom: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.30)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.20)" },

  // ── PLACEHOLDERS & LOADING ────────────────────────────────────────────────
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  noImageText: { marginTop: SPACING, fontFamily: "Comfortaa_400Regular", fontSize: normalizeSize(16) },
  loadingOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 9999, elevation: 9999, backgroundColor: "transparent", paddingHorizontal: 24 },
  loadingCard: { minWidth: 260, maxWidth: 320, borderRadius: R.card, paddingVertical: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: GLASS.bgDark, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", ...S.float, overflow: "hidden" },
  loadingIconRing: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  loadingIconInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  loadingTextBlock: { alignItems: "center" },
  loadingText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  loadingSubText: { marginTop: 4, fontSize: 13, lineHeight: 18, textAlign: "center" },

  // ── BACK BUTTON ──────────────────────────────────────────────────────────
  backButtonContainer: { position: "absolute", top: 0, left: SPACING, zIndex: 50, elevation: 50, pointerEvents: "box-none" },
  backButtonBlur: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(249,115,22,0.35)", backgroundColor: "rgba(0,0,0,0.22)", ...S.card },
  backButtonPress: { flex: 1, alignItems: "center", justifyContent: "center" },

  scrollPad: { paddingBottom: SPACING },
  orb: { position: "absolute", opacity: 0.9 },

  // ── LEGACY SHELLS ────────────────────────────────────────────────────────
  avatarShell: { position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, ...S.card },
  avatarRing: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderWidth: StyleSheet.hairlineWidth },
  avatarSpecular: { position: "absolute", left: "10%", right: "10%", top: "8%", height: "42%", backgroundColor: "rgba(255,255,255,0.10)", transform: [{ skewY: "-10deg" }], opacity: 0.85 },
  avatarInitial: { fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  avatarSheen: { position: "absolute", left: "10%", right: "10%", top: "10%", height: "42%", backgroundColor: "rgba(255,255,255,0.18)", transform: [{ skewY: "-10deg" }] },
  vsModalRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", justifyContent: "center", alignItems: "center", zIndex: 99999 },
  vsStage: { width: "100%", maxWidth: 820, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  vsSide: { alignItems: "center", marginHorizontal: 24 },
  vsAvatarXL: { width: normalizeSize(120), height: normalizeSize(120), borderRadius: normalizeSize(60), borderWidth: 3, borderColor: ACCENT.solid, shadowColor: ACCENT.glow, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  vsAvatarWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  vsGlowRing: { position: "absolute", width: normalizeSize(138), height: normalizeSize(138), borderRadius: normalizeSize(69), borderWidth: 2, borderColor: ACCENT.softBorder, shadowColor: ACCENT.glow, shadowOpacity: 0.26, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, opacity: 0.85 },
  vsBadgeBig: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  vsBadgeText: { color: "#000", fontFamily: "Comfortaa_700Bold", fontSize: normalizeSize(18), letterSpacing: 2 },
  vsNameXL: { color: "#fff", marginTop: 10, fontSize: normalizeSize(18), fontFamily: "Comfortaa_700Bold", textAlign: "center" },
  vsCenter: { marginHorizontal: 24 },
});
