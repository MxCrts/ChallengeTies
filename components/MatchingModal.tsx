// components/MatchingModal.tsx
// ✅ Matching Feature — Modal top 1 mondial

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import designSystem, { Theme } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import {
  findMatches,
searchMatchesByUsername,
sendMatchingInvitation,
type MatchCandidate,
} from "@/services/matchingService";

const { width: SW } = Dimensions.get("window");
const ns = (s: number) => Math.round(s * Math.min(Math.max(SW / 375, 0.82), 1.35));

const ORANGE = "#F97316";
const GOLD   = "#E8B84B";

type Props = {
  visible: boolean;
  onClose: () => void;
  onInviteSent: (inviteeUsername: string) => void;
  challengeId: string;
  challengeTitle: string;
  challengeCategory: string | null;
  selectedDays: number;
};

const withAlpha = (hex: string, a: number) => {
  const alpha = Math.round(Math.min(Math.max(a, 0), 1) * 255).toString(16).padStart(2, "0");
  const clean = hex.replace("#", "");
  return `#${clean.length === 3 ? clean[0]+clean[0]+clean[1]+clean[1]+clean[2]+clean[2] : clean}${alpha}`;
};

const getInitials = (name?: string) => {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).slice(0, 2) || "?";
};

const CandidateCard: React.FC<{
  candidate: MatchCandidate;
  onInvite: (uid: string, username: string) => void;
  sentTo: Set<string>;
  isDark: boolean;
  th: Theme;
  styles: ReturnType<typeof createStyles>;
  index: number;
}> = ({ candidate, onInvite, sentTo, isDark, th, styles, index }) => {
  const { t } = useTranslation();
  const alreadySent = sentTo.has(candidate.uid);
  const accentColor = candidate.matchScore === 3 ? GOLD : candidate.matchScore === 2 ? ORANGE : "#64748B";

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(280)}
      style={styles.candidateCard}
    >
      {/* Barre accent gauche */}
      <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {candidate.profileImage ? (
          <ExpoImage source={{ uri: candidate.profileImage }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[ORANGE + "55", GOLD + "33"]} style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{getInitials(candidate.username)}</Text>
          </LinearGradient>
        )}
        {candidate.matchScore === 3 && (
          <View style={[styles.matchBadge, { backgroundColor: GOLD }]}>
            <Text style={styles.matchBadgeText}>🎯</Text>
          </View>
        )}
        {candidate.matchScore === 2 && (
          <View style={[styles.matchBadge, { backgroundColor: ORANGE }]}>
            <Text style={styles.matchBadgeText}>⚡</Text>
          </View>
        )}
      </View>

      {/* Infos */}
      <View style={styles.candidateInfo}>
        <Text style={[styles.candidateName, { color: accentColor }]} numberOfLines={1}>
          {candidate.username}
        </Text>
        <View style={styles.candidateMeta}>
          {!!candidate.region && (
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={ns(9)} color={isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)"} />
              <Text style={styles.metaChipText} numberOfLines={1}>{candidate.region}</Text>
            </View>
          )}
          {candidate.completedChallengesCount > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="trophy-outline" size={ns(9)} color={GOLD} />
              <Text style={[styles.metaChipText, { color: GOLD }]}>{candidate.completedChallengesCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.matchLabel} numberOfLines={2}>
          {candidate.hasSameChallenge
            ? t("matching.sameChallengeLabel", { defaultValue: "Fait ce défi en solo" })
            : candidate.sharedCategory
            ? t("matching.sameCategoryLabel", { category: candidate.sharedCategory, defaultValue: `Catégorie : ${candidate.sharedCategory}` })
            : t("matching.availableLabel", { defaultValue: "Disponible pour un duo" })}
        </Text>
      </View>

      {/* Bouton inviter */}
      <Pressable
        onPress={() => !alreadySent && onInvite(candidate.uid, candidate.username)}
        style={({ pressed }) => [
          styles.inviteBtn,
          alreadySent && styles.inviteBtnSent,
          pressed && !alreadySent && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
      >
        {alreadySent
          ? <Ionicons name="checkmark" size={ns(16)} color="#000" />
          : <Ionicons name="person-add-outline" size={ns(16)} color="#000" />
        }
      </Pressable>
    </Animated.View>
  );
};

const MatchingModal: React.FC<Props> = ({
  visible, onClose, onInviteSent,
  challengeId, challengeTitle, challengeCategory, selectedDays,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [loading,    setLoading]    = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [sentTo,     setSentTo]     = useState<Set<string>>(new Set());
  const [sendingTo,  setSendingTo]  = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
const [searching, setSearching] = useState(false);

  const styles = useMemo(() => createStyles(isDark, th, insets), [isDark, th, insets]);

  useEffect(() => {
    if (!visible || !challengeId) return;
    setLoading(true); setError(null); setSentTo(new Set()); setCandidates([]);
    findMatches({ challengeId, challengeCategory, selectedDays })
      .then(setCandidates)
      .catch(() => setError(t("matching.loadError", { defaultValue: "Impossible de charger les profils." })))
      .finally(() => setLoading(false));
  }, [visible, challengeId, challengeCategory, selectedDays]);

  useEffect(() => {
  if (!visible || !challengeId) return;

  const q = searchText.trim().toLowerCase();

  if (q.length < 2) {
    setError(null);
    return;
  }

  let cancelled = false;
  setSearching(true);
  setError(null);

  const timer = setTimeout(async () => {
    try {
      const results = await searchMatchesByUsername({
        usernameQuery: q,
        challengeId,
        challengeCategory,
        selectedDays,
      });

      if (!cancelled) {
        setCandidates(results);
      }
    } catch (e) {
      if (!cancelled) {
        setError(t("matching.searchError", {
          defaultValue: "Impossible de rechercher ce profil.",
        }));
      }
    } finally {
      if (!cancelled) setSearching(false);
    }
  }, 320);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [searchText, visible, challengeId, challengeCategory, selectedDays, t]);

  const handleInvite = useCallback(async (uid: string, username: string) => {
    if (sendingTo) return;
    setSendingTo(uid);
    try {
      await sendMatchingInvitation({ inviteeId: uid, challengeId, challengeTitle, selectedDays });
      setSentTo(prev => new Set([...prev, uid]));
      onInviteSent(username);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("rate_limit_exceeded")) {
        Alert.alert(t("matching.rateLimitTitle", { defaultValue: "Limite atteinte" }), t("matching.rateLimitBody", { defaultValue: "Tu peux envoyer 5 invitations matching par jour." }));
      } else {
        Alert.alert(t("alerts.error"), t("matching.sendError", { defaultValue: "Erreur lors de l'envoi." }));
      }
    } finally { setSendingTo(null); }
  }, [sendingTo, challengeId, challengeTitle, selectedDays, onInviteSent, t]);

  return (
    <Modal
      visible={visible} transparent animationType="none"
      statusBarTranslucent presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View entering={ZoomIn.springify().damping(18).stiffness(190)} exiting={ZoomOut.duration(140)} style={styles.cardWrap}>
          <LinearGradient colors={[ORANGE + "CC", GOLD + "AA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.borderGlow}>
            <View style={styles.card}>

              {/* Ligne accent top */}
              <LinearGradient
                colors={["transparent", ORANGE + "90", GOLD + "AA", ORANGE + "90", "transparent"]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={styles.topAccentLine}
              />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <LinearGradient colors={[ORANGE + "33", GOLD + "22"]} style={styles.headerIcon}>
                    <Ionicons name="flash" size={ns(15)} color={ORANGE} />
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{t("matching.title", { defaultValue: "Trouver un binôme" })}</Text>
                    {!!challengeTitle && <Text style={styles.subtitle} numberOfLines={1}>{challengeTitle}</Text>}
                  </View>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={ns(18)} color={isDark ? "#F8FAFC" : "#0B1220"} />
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              <View style={styles.searchWrap}>
  <Ionicons
    name="search-outline"
    size={ns(16)}
    color={isDark ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.38)"}
  />

  <TextInput
    value={searchText}
    onChangeText={setSearchText}
    placeholder={t("matching.searchPlaceholder", {
      defaultValue: "Rechercher par username…",
    })}
    placeholderTextColor={isDark ? "rgba(255,255,255,0.34)" : "rgba(15,23,42,0.34)"}
    autoCapitalize="none"
    autoCorrect={false}
    returnKeyType="search"
    style={styles.searchInput}
  />

  {searchText.trim().length > 0 && (
    <Pressable onPress={() => setSearchText("")} hitSlop={8}>
      <Ionicons
        name="close-circle"
        size={ns(17)}
        color={isDark ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.36)"}
      />
    </Pressable>
  )}
</View>

              {/* Body */}
             {loading || searching ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={ORANGE} />
                 <Text style={styles.loadingText}>
  {searching
    ? t("matching.searchingUser", { defaultValue: "Recherche du profil…" })
    : t("matching.searching", { defaultValue: "Recherche de binômes…" })}
</Text>
                </View>
              ) : error ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="alert-circle-outline" size={ns(36)} color={ORANGE + "80"} />
                  <Text style={styles.emptyText}>{error}</Text>
                </View>
              ) : candidates.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <LinearGradient colors={[ORANGE + "20", "transparent"]} style={styles.emptyIconWrap}>
                    <Ionicons name="people-outline" size={ns(40)} color={ORANGE + "90"} />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>
  {searchText.trim().length >= 2
    ? t("matching.noSearchResultTitle", { defaultValue: "Aucun profil trouvé" })
    : t("matching.emptyTitle", { defaultValue: "Aucun binôme trouvé" })}
</Text>
                  <Text style={styles.emptyText}>
  {searchText.trim().length >= 2
    ? t("matching.noSearchResultDesc", {
        defaultValue: "Vérifie le username ou demande à la personne d’activer sa disponibilité duo.",
      })
    : t("matching.emptyDesc", {
        defaultValue: "Active \"Disponible pour un duo\" dans ton profil pour apparaître ici.",
      })}
</Text>
                </View>
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} bounces={false}>
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <Text style={styles.legendEmoji}>🎯</Text>
                      <Text style={styles.legendText}>{t("matching.legendPerfect", { defaultValue: "Fait ce défi" })}</Text>
                    </View>
                    <View style={styles.legendSep} />
                    <View style={styles.legendItem}>
                      <Text style={styles.legendEmoji}>⚡</Text>
                      <Text style={styles.legendText}>{t("matching.legendGood", { defaultValue: "Même catégorie" })}</Text>
                    </View>
                    <Text style={[styles.legendCount, { color: ORANGE }]}>{candidates.length} profil{candidates.length > 1 ? "s" : ""}</Text>
                  </View>
                  {candidates.map((c, i) => (
                    <CandidateCard key={c.uid} candidate={c} onInvite={handleInvite} sentTo={sentTo} isDark={isDark} th={th} styles={styles} index={i} />
                  ))}
                </ScrollView>
              )}

              {!loading && candidates.length > 0 && (
                <Text style={styles.footerHint}>{t("matching.footerHint", { defaultValue: "L'invitation expire dans 72h · Max 5/jour" })}</Text>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const createStyles = (isDark: boolean, th: Theme, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    overlay:  { ...StyleSheet.absoluteFillObject, flex: 1, justifyContent: "center", alignItems: "center" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.62)" },
    cardWrap: { width: "90%", maxWidth: 420, height: 540, borderRadius: ns(26), overflow: "hidden" },
    borderGlow: { padding: 1.5, borderRadius: ns(26), height: "100%" },
    card: {
      borderRadius: ns(24), flex: 1,
      backgroundColor: isDark ? "#080C14" : "#F8F5EE",
      paddingTop: ns(4), paddingBottom: ns(16), paddingHorizontal: ns(16),
      overflow: "hidden",
    },
    topAccentLine: { height: 1, marginBottom: ns(14) },
    header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ns(10) },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: ns(10), flex: 1, minWidth: 0 },
    headerIcon: { width: ns(32), height: ns(32), borderRadius: ns(10), alignItems: "center", justifyContent: "center" },
    title:    { fontFamily: "Comfortaa_700Bold", fontSize: ns(16), color: isDark ? "#F1F5F9" : "#0F172A" },
    subtitle: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11.5), color: isDark ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.42)", marginTop: ns(2) },
    closeBtn: { width: ns(30), height: ns(30), borderRadius: ns(10), alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" },
    divider:  { height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", marginBottom: ns(10) },
    searchWrap: {
  flexDirection: "row",
  alignItems: "center",
  gap: ns(8),
  borderRadius: ns(14),
  borderWidth: 1,
  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
  backgroundColor: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)",
  paddingHorizontal: ns(12),
  height: ns(42),
  marginBottom: ns(10),
},
searchInput: {
  flex: 1,
  minWidth: 0,
  fontFamily: "Comfortaa_400Regular",
  fontSize: ns(12.5),
  color: isDark ? "#F8FAFC" : "#0F172A",
  paddingVertical: 0,
  includeFontPadding: false,
},

    loadingWrap:  { alignItems: "center", justifyContent: "center", paddingVertical: ns(40), gap: ns(12) },
    loadingText:  { fontFamily: "Comfortaa_400Regular", fontSize: ns(13), color: isDark ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.45)" },
    emptyWrap:    { alignItems: "center", justifyContent: "center", paddingVertical: ns(28), paddingHorizontal: ns(16), gap: ns(10) },
    emptyIconWrap:{ width: ns(76), height: ns(76), borderRadius: ns(38), alignItems: "center", justifyContent: "center" },
    emptyTitle:   { fontFamily: "Comfortaa_700Bold", fontSize: ns(15), color: isDark ? "#F1F5F9" : "#0F172A", textAlign: "center" },
emptyText: { fontFamily: "Comfortaa_400Regular", fontSize: ns(12.5), color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)", textAlign: "center", lineHeight: ns(18), flexShrink: 1 },
    list:        { flex: 1, minHeight: 0 },
    listContent: { paddingBottom: ns(4), gap: ns(8) },

legend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ns(6), paddingHorizontal: ns(4), paddingVertical: ns(8), marginBottom: ns(4) },    legendItem:  { flexDirection: "row", alignItems: "center", gap: ns(5) },
    legendEmoji: { fontSize: ns(12) },
    legendText:  { fontFamily: "Comfortaa_400Regular", fontSize: ns(10.5), color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)" },
    legendSep:   { width: 1, height: ns(12), backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)" },
    legendCount: { fontFamily: "Comfortaa_700Bold", fontSize: ns(11), marginLeft: "auto" },

    /* Card candidat */
    candidateCard: {
      flexDirection: "row", alignItems: "center",
      borderRadius: ns(16), borderWidth: 1, overflow: "hidden",
      paddingVertical: ns(10), paddingRight: ns(12), gap: ns(10),
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.88)",
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
        android: { elevation: 2 },
      }),
    },
    cardAccentBar: { width: ns(3), alignSelf: "stretch" },
    avatarWrap:    { position: "relative", marginLeft: ns(10) },
    avatar:        { width: ns(44), height: ns(44), borderRadius: ns(13) },
    avatarFallback:{ width: ns(44), height: ns(44), borderRadius: ns(13), alignItems: "center", justifyContent: "center" },
    avatarInitials:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: "#fff" },
    matchBadge:    { position: "absolute", bottom: -ns(3), right: -ns(4), width: ns(18), height: ns(18), borderRadius: ns(9), alignItems: "center", justifyContent: "center" },
    matchBadgeText:{ fontSize: ns(9) },

    candidateInfo: { flex: 1, minWidth: 0 },
    candidateName: { fontFamily: "Comfortaa_700Bold", fontSize: ns(13.5) },
    candidateMeta: { flexDirection: "row", flexWrap: "wrap", gap: ns(6), marginTop: ns(3) },
    metaChip:      { flexDirection: "row", alignItems: "center", gap: ns(3) },
    metaChipText:  { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)" },
    matchLabel: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: ORANGE, marginTop: ns(3), flexShrink: 1, flexWrap: "wrap" },

    inviteBtn:    { width: ns(36), height: ns(36), borderRadius: ns(11), alignItems: "center", justifyContent: "center", backgroundColor: ORANGE },
    inviteBtnSent:{ backgroundColor: GOLD },

    footerHint: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)", textAlign: "center", marginTop: ns(10) },
  });

export default MatchingModal;
