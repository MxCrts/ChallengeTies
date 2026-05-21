// components/UserProfileCard.tsx
// Modal profil user — thème cohérent Rome/Or avec le feed Exploits
// S'ouvre au clic sur avatar/username dans ExploitStele

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";

/* ─── Palette Rome (cohérente avec focus.tsx) ─────── */
const GOLD         = "#C9922A";
const GOLD_BRIGHT  = "#E8B84B";
const GOLD_PALE    = "#F2D98A";
const MARBLE_LIGHT = "#F5F0E8";
const MARBLE_DARK  = "#1A1610";
const PARCHMENT    = "#E8DEC8";
const INK          = "#2A1F0E";
const CRIMSON      = "#8B1A1A";
const EMERALD_ROME = "#1A5C3A";
const SILVER       = "#A8A090";

/* ─── Responsive ──────────────────────────────────── */
const { width: SW } = Dimensions.get("window");
const SCALE = Math.min(Math.max(SW / 375, 0.82), 1.35);
const ns = (s: number) => Math.round(s * SCALE);

/* ─── Types ───────────────────────────────────────── */
interface UserProfileData {
  uid: string;
  username: string;
  profileImage?: string;
  trophies?: number;
  longestStreak?: number;
  region?: string;
  country?: string;
  duoAvailable?: boolean;
  currentChallengesCount?: number;
  completedChallengesCount?: number;
  isPioneer?: boolean;
}

interface Props {
  visible: boolean;
  uid: string | null;
  username: string;
  avatarUrl?: string;
  challengeId?: string;      // pour "Faire ce défi"
  challengeTitle?: string;   // pour affichage
  onClose: () => void;
}

/* ─── Helper avatar fallback ──────────────────────── */
function fallbackAvatar(username: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "?")}&background=2A1F0E&color=E8B84B&bold=true&size=128`;
}

/* ─── Stat pill ───────────────────────────────────── */
const StatPill = ({
  icon, value, label, color, isDark,
}: {
  icon: string; value: string | number; label: string; color: string; isDark: boolean;
}) => (
  <View style={[
    sp.wrap,
    {
      backgroundColor: color + (isDark ? "14" : "10"),
      borderColor: color + (isDark ? "40" : "30"),
    },
  ]}>
    <Ionicons name={icon as any} size={ns(16)} color={color} />
    <Text style={[sp.value, { color: isDark ? GOLD_PALE : INK }]}>{value}</Text>
    <Text style={[sp.label, { color: isDark ? "rgba(220,200,150,0.55)" : "rgba(42,31,14,0.52)" }]}>
      {label}
    </Text>
  </View>
);

const sp = StyleSheet.create({
  wrap:  {
    flex: 1, alignItems: "center", paddingVertical: ns(12), paddingHorizontal: ns(8),
    borderRadius: ns(14), borderWidth: 1, gap: ns(4),
  },
  value: { fontFamily: "Comfortaa_700Bold", fontSize: ns(18), includeFontPadding: false },
  label: { fontFamily: "Comfortaa_400Regular", fontSize: ns(10), textAlign: "center", includeFontPadding: false },
});

/* ─── Composant principal ─────────────────────────── */
export default function UserProfileCard({
  visible, uid, username, avatarUrl, challengeId, challengeTitle, onClose,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile, setProfile]   = useState<UserProfileData | null>(null);
  const [loading, setLoading]   = useState(false);
  const myUid = auth.currentUser?.uid;
  const isMe  = uid === myUid;

  /* Animations */
  const scaleV  = useSharedValue(0.88);
  const opacV   = useSharedValue(0);
  const glowV   = useSharedValue(0.7);
  const shimV   = useSharedValue(-1);

  useEffect(() => {
    if (visible) {
      scaleV.value = withSpring(1, { damping: 16, stiffness: 260, mass: 0.75 });
      opacV.value  = withTiming(1, { duration: 220 });
      glowV.value  = withRepeat(
        withSequence(
          withTiming(1,   { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.7, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false
      );
      shimV.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
    } else {
      scaleV.value = withTiming(0.88, { duration: 160 });
      opacV.value  = withTiming(0,    { duration: 160 });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleV.value }],
    opacity: opacV.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowV.value, [0.7, 1], [0.3, 0.6]),
  }));

  const shimLeft  = -ns(80);
const shimRight =  ns(80);

const shimStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: interpolate(shimV.value, [-1, 1], [shimLeft, shimRight]) }],
  opacity: 0.14,
}));

  /* Fetch profil depuis Firestore */
  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;
        if (!snap.exists()) { setLoading(false); return; }
        const d = snap.data() as any;

        const currentCount = Array.isArray(d?.CurrentChallenges)
          ? d.CurrentChallenges.length : 0;
        const completedCount = Array.isArray(d?.CompletedChallenges)
          ? d.CompletedChallenges.length : 0;

        setProfile({
          uid,
          username:                d?.username || username,
          profileImage:            d?.profileImage || d?.avatar || "",
          trophies:                Number(d?.trophies ?? 0),
          longestStreak:           Number(d?.longestStreak ?? 0),
          region:                  d?.region || "",
          country:                 d?.country || "",
          duoAvailable:            !!d?.duoAvailable,
          currentChallengesCount:  currentCount,
          completedChallengesCount: completedCount,
          isPioneer:               !!d?.isPioneer,
        });
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [visible, uid]);

  const handleViewChallenge = useCallback(() => {
    if (!challengeId) return;
    onClose();
    setTimeout(() => {
      router.push(`/challenge-details/${challengeId}` as any);
    }, 280);
  }, [challengeId, onClose, router]);

  const handleInviteDuo = useCallback(() => {
    if (!challengeId) return;
    onClose();
    setTimeout(() => {
      router.push(`/challenge-details/${challengeId}?openChoixDuo=1` as any);
    }, 280);
  }, [challengeId, onClose, router]);

  /* Couleurs */
  const bg      = isDark ? MARBLE_DARK : MARBLE_LIGHT;
  const bgCard  = isDark ? "#1E1A10"   : "#FAF5E8";
  const textPri = isDark ? GOLD_PALE   : INK;
  const textSec = isDark ? "rgba(220,200,150,0.55)" : "rgba(42,31,14,0.52)";
  const divCol  = isDark ? "rgba(200,150,40,0.25)"  : "rgba(180,130,30,0.30)";

  const displayName    = profile?.username || username;
  const displayAvatar  = profile?.profileImage || avatarUrl || fallbackAvatar(displayName);
  const location       = [profile?.region, profile?.country].filter(Boolean).join(", ");

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView
          intensity={isDark ? 40 : 30}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.30)" },
        ]} />
      </Pressable>

      {/* Card */}
      <View style={[s.centerer, { paddingBottom: insets.bottom + ns(20), paddingTop: insets.top + ns(20) }]} pointerEvents="box-none">
        <Animated.View style={[s.card, cardStyle, {
          backgroundColor: bgCard,
          borderColor: GOLD + (isDark ? "50" : "40"),
          ...Platform.select({
            ios: { shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: ns(28), shadowOffset: { width: 0, height: ns(10) } },
            android: { elevation: 16 },
          }),
        }]}>

          {/* Overflow fix pour shimmer */}
          <View style={[StyleSheet.absoluteFill, { borderRadius: ns(24), overflow: "hidden" }]} pointerEvents="none">
            {/* Shimmer diagonal */}
            <Animated.View style={[s.shimmer, shimStyle]} />
            {/* Halo gold ambiant */}
            <Animated.View style={[s.ambientGlow, glowStyle, { backgroundColor: GOLD + "10" }]} />
          </View>

          {/* Frise haute */}
          <LinearGradient
            colors={["transparent", GOLD + "70", GOLD_BRIGHT + "90", GOLD + "70", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={s.frise}
          />

          {/* Bouton fermer */}
          <TouchableOpacity onPress={onClose} style={[s.closeBtn, {
            backgroundColor: isDark ? "rgba(200,150,40,0.12)" : "rgba(200,150,40,0.10)",
            borderColor: isDark ? "rgba(200,150,40,0.35)" : "rgba(180,130,30,0.28)",
          }]}>
            <Ionicons name="close" size={ns(16)} color={isDark ? GOLD_BRIGHT : GOLD} />
          </TouchableOpacity>

          {/* Loading */}
          {loading && (
            <Animated.View entering={FadeIn} style={s.loadingWrap}>
              <ActivityIndicator color={GOLD_BRIGHT} size="large" />
              <Text style={[s.loadingText, { color: textSec }]}>
                {t("profileC.loading", { defaultValue: "Consultation des annales…" })}
              </Text>
            </Animated.View>
          )}

          {/* Contenu */}
          {!loading && (
            <Animated.View entering={FadeIn.duration(300)} style={s.content}>

              {/* Avatar + badge Pioneer */}
              <View style={s.avatarWrap}>
                {/* Halo avatar */}
                <View style={[s.avatarHalo, { borderColor: GOLD + (isDark ? "55" : "45"), backgroundColor: GOLD + "10" }]} />
                <Image
                  source={{ uri: displayAvatar }}
                  style={s.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {profile?.isPioneer && (
                  <View style={[s.pioneerBadge, {
                    backgroundColor: GOLD,
                    borderColor: isDark ? MARBLE_DARK : PARCHMENT,
                  }]}>
                    <Ionicons name="sparkles" size={ns(10)} color={isDark ? MARBLE_DARK : INK} />
                  </View>
                )}
              </View>

              {/* Nom */}
              <Text style={[s.username, { color: isDark ? GOLD_BRIGHT : GOLD }]} numberOfLines={1}>
                {displayName}
              </Text>

              {/* Tags Pioneer + location */}
              <View style={s.tagsRow}>
                {profile?.isPioneer && (
                  <View style={[s.tag, { backgroundColor: GOLD + "18", borderColor: GOLD + "45" }]}>
                    <Ionicons name="sparkles" size={ns(10)} color={GOLD_BRIGHT} />
                    <Text style={[s.tagText, { color: GOLD_BRIGHT }]}>Pioneer</Text>
                  </View>
                )}
                {profile?.duoAvailable && !isMe && (
                  <View style={[s.tag, { backgroundColor: EMERALD_ROME + "18", borderColor: EMERALD_ROME + "45" }]}>
                    <Ionicons name="people" size={ns(10)} color={EMERALD_ROME + "CC"} />
                    <Text style={[s.tagText, { color: EMERALD_ROME + "CC" }]}>
                      {t("profileC.availableForDuo", { defaultValue: "Dispo duo" })}
                    </Text>
                  </View>
                )}
                {isMe && (
                  <View style={[s.tag, { backgroundColor: CRIMSON + "18", borderColor: CRIMSON + "45" }]}>
                    <Text style={[s.tagText, { color: CRIMSON + "CC" }]}>
                      {t("exploits.you", { defaultValue: "toi" })}
                    </Text>
                  </View>
                )}
              </View>

              {location ? (
                <View style={s.locationRow}>
                  <Ionicons name="location-outline" size={ns(12)} color={textSec} />
                  <Text style={[s.locationText, { color: textSec }]} numberOfLines={1}>{location}</Text>
                </View>
              ) : null}

              {/* Divider laurier */}
              <View style={s.divRow}>
                <View style={[s.divLine, { backgroundColor: divCol }]} />
                <Ionicons name="leaf" size={ns(11)} color={GOLD + "80"} />
                <Ionicons name="star" size={ns(9)} color={GOLD_BRIGHT + "90"} />
                <Ionicons name="leaf" size={ns(11)} color={GOLD + "80"} style={{ transform: [{ scaleX: -1 }] }} />
                <View style={[s.divLine, { backgroundColor: divCol }]} />
              </View>

              {/* Stats pills */}
              <View style={s.statsRow}>
                <StatPill
                  icon="trophy"
                  value={profile?.trophies ?? 0}
                  label={t("profileS.statTrophies", { defaultValue: "trophées" })}
                  color={GOLD_BRIGHT}
                  isDark={isDark}
                />
                <StatPill
                  icon="flame"
                  value={profile?.longestStreak ?? 0}
                  label={t("profileS.statStreak", { defaultValue: "meilleur streak" })}
                  color={CRIMSON}
                  isDark={isDark}
                />
                <StatPill
                  icon="checkmark-done"
                  value={profile?.completedChallengesCount ?? 0}
                  label={t("profileS.statCompleted", { defaultValue: "terminés" })}
                  color={EMERALD_ROME}
                  isDark={isDark}
                />
              </View>

              {/* Défis en cours */}
              {(profile?.currentChallengesCount ?? 0) > 0 && (
                <View style={[s.currentRow, {
                  backgroundColor: GOLD + (isDark ? "10" : "08"),
                  borderColor: GOLD + (isDark ? "30" : "22"),
                }]}>
                  <Ionicons name="flag" size={ns(13)} color={GOLD} />
                  <Text style={[s.currentText, { color: textSec }]}>
                    {t("profileC.challengesInProgress", {
                      count: profile?.currentChallengesCount,
                      defaultValue: `${profile?.currentChallengesCount} défi(s) en cours`,
                    })}
                  </Text>
                </View>
              )}

              {/* Divider avant CTAs */}
              <View style={[s.divLineFull, { backgroundColor: divCol }]} />

              {/* CTAs */}
              <View style={s.ctaRow}>

                {/* Faire ce défi */}
                {challengeId && (
                  <TouchableOpacity
                    onPress={handleViewChallenge}
                    activeOpacity={0.84}
                    style={s.ctaPrimaryWrap}
                  >
                    <LinearGradient
                      colors={[GOLD, GOLD_BRIGHT]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.ctaPrimary}
                    >
                      <Ionicons name="flame" size={ns(16)} color={isDark ? MARBLE_DARK : INK} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.ctaPrimaryText, { color: isDark ? MARBLE_DARK : INK }]} numberOfLines={1}>
                          {t("profileC.doThisChallenge", { defaultValue: "Faire ce défi" })}
                        </Text>
                        {challengeTitle ? (
                          <Text style={[s.ctaPrimarySub, { color: isDark ? "rgba(42,31,14,0.65)" : "rgba(42,31,14,0.60)" }]} numberOfLines={1}>
                            {challengeTitle}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={ns(14)} color={isDark ? "rgba(42,31,14,0.55)" : "rgba(42,31,14,0.50)"} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Inviter en Duo — seulement si l'user est dispo et c'est pas moi */}
                {!isMe && profile?.duoAvailable && challengeId && (
                  <TouchableOpacity
                    onPress={handleInviteDuo}
                    activeOpacity={0.84}
                    style={[s.ctaSecondaryWrap, {
                      backgroundColor: EMERALD_ROME + (isDark ? "14" : "10"),
                      borderColor: EMERALD_ROME + (isDark ? "45" : "35"),
                    }]}
                  >
                    <Ionicons name="people" size={ns(16)} color={EMERALD_ROME + "CC"} />
                    <Text style={[s.ctaSecondaryText, { color: EMERALD_ROME + "CC" }]} numberOfLines={1}>
                      {t("profileC.inviteDuo", { defaultValue: "Défier en Duo" })}
                    </Text>
                  </TouchableOpacity>
                )}

              </View>

            </Animated.View>
          )}

          {/* Frise basse */}
          <LinearGradient
            colors={["transparent", GOLD + "50", GOLD_BRIGHT + "60", GOLD + "50", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[s.frise, { marginTop: 0 }]}
          />

        </Animated.View>
      </View>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────── */
const s = StyleSheet.create({
  centerer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ns(20),
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: ns(24),
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  shimmer: {
    position: "absolute",
    top: -ns(60), bottom: -ns(60),
    width: ns(80),
    backgroundColor: GOLD_PALE,
    transform: [{ skewX: "-18deg" }],
  },
  ambientGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  frise: { height: ns(3), marginBottom: 0 },
  closeBtn: {
    position: "absolute",
    top: ns(14), right: ns(14),
    width: ns(32), height: ns(32),
    borderRadius: ns(16),
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, zIndex: 10,
  },

  /* Loading */
  loadingWrap: {
    paddingVertical: ns(48),
    alignItems: "center", gap: ns(14),
  },
  loadingText: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: ns(13), textAlign: "center",
  },

  /* Content */
  content: {
    paddingHorizontal: ns(20),
    paddingTop: ns(20),
    paddingBottom: ns(16),
    alignItems: "center",
    gap: ns(10),
  },

  /* Avatar */
  avatarWrap: {
    position: "relative",
    marginBottom: ns(4),
  },
  avatarHalo: {
    position: "absolute",
    top: -ns(6), left: -ns(6), right: -ns(6), bottom: -ns(6),
    borderRadius: ns(999),
    borderWidth: 1.5,
  },
  avatar: {
    width: ns(88), height: ns(88),
    borderRadius: ns(44),
  },
  pioneerBadge: {
    position: "absolute",
    bottom: -ns(2), right: -ns(2),
    width: ns(24), height: ns(24),
    borderRadius: ns(12),
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },

  /* Username */
  username: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: ns(22),
    letterSpacing: 0.5,
    textAlign: "center",
    includeFontPadding: false,
  },

  /* Tags */
  tagsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: ns(6) },
  tag: {
    flexDirection: "row", alignItems: "center", gap: ns(4),
    paddingHorizontal: ns(8), paddingVertical: ns(4),
    borderRadius: ns(99), borderWidth: 1,
  },
  tagText: { fontFamily: "Comfortaa_700Bold", fontSize: ns(10), includeFontPadding: false },

  /* Location */
  locationRow: { flexDirection: "row", alignItems: "center", gap: ns(4) },
  locationText: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), includeFontPadding: false },

  /* Dividers */
  divRow: {
    flexDirection: "row", alignItems: "center",
    gap: ns(8), width: "100%",
    marginVertical: ns(2),
  },
  divLine: { flex: 1, height: 1, borderRadius: 1, opacity: 0.7 },
  divLineFull: { width: "100%", height: 1, borderRadius: 1, opacity: 0.5, marginVertical: ns(4) },

  /* Stats */
  statsRow: { flexDirection: "row", gap: ns(8), width: "100%" },

  /* Défis en cours */
  currentRow: {
    flexDirection: "row", alignItems: "center", gap: ns(6),
    paddingHorizontal: ns(12), paddingVertical: ns(8),
    borderRadius: ns(12), borderWidth: 1,
    width: "100%",
  },
  currentText: { fontFamily: "Comfortaa_400Regular", fontSize: ns(12), includeFontPadding: false },

  /* CTAs */
  ctaRow: { width: "100%", gap: ns(8) },
  ctaPrimaryWrap: { borderRadius: ns(16), overflow: "hidden" },
  ctaPrimary: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: ns(13), paddingHorizontal: ns(16),
    gap: ns(10), borderRadius: ns(16),
  },
  ctaPrimaryText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: ns(14), includeFontPadding: false,
  },
  ctaPrimarySub: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: ns(11), includeFontPadding: false,
    marginTop: ns(2),
  },
  ctaSecondaryWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: ns(8), paddingVertical: ns(11), paddingHorizontal: ns(16),
    borderRadius: ns(14), borderWidth: 1,
  },
  ctaSecondaryText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: ns(13), includeFontPadding: false,
  },
});
