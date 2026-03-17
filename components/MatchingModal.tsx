// components/MatchingModal.tsx
// ✅ Matching Feature — Modal top 1 mondial
// Affiche les candidats matchés et permet d'envoyer une invitation in-app

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
  sendMatchingInvitation,
  type MatchCandidate,
} from "@/services/matchingService";

type Props = {
  visible: boolean;
  onClose: () => void;
  onInviteSent: (inviteeUsername: string) => void; // appelé quand l'invitation est envoyée
  challengeId: string;
  challengeTitle: string;
  challengeCategory: string | null;
  selectedDays: number;
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

const getInitials = (name?: string) => {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).slice(0, 2) || "?";
};

// Card d'un candidat
const CandidateCard: React.FC<{
  candidate: MatchCandidate;
  onInvite: (uid: string, username: string) => void;
  sentTo: Set<string>;
  isDark: boolean;
  th: Theme;
  styles: any;
  index: number;
}> = ({ candidate, onInvite, sentTo, isDark, th, styles, index }) => {
  const { t } = useTranslation();
  const alreadySent = sentTo.has(candidate.uid);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(280)}
      style={styles.candidateCard}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {candidate.profileImage ? (
          <ExpoImage
            source={{ uri: candidate.profileImage }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={["rgba(255,159,28,0.35)", "rgba(255,215,0,0.20)"]}
            style={styles.avatarFallback}
          >
            <Text style={styles.avatarInitials}>
              {getInitials(candidate.username)}
            </Text>
          </LinearGradient>
        )}

        {/* Badge match score */}
        {candidate.matchScore === 3 && (
          <View style={[styles.matchBadge, styles.matchBadgePerfect]}>
            <Text style={styles.matchBadgeText}>🎯</Text>
          </View>
        )}
        {candidate.matchScore === 2 && (
          <View style={[styles.matchBadge, styles.matchBadgeGood]}>
            <Text style={styles.matchBadgeText}>⚡</Text>
          </View>
        )}
      </View>

      {/* Infos */}
      <View style={styles.candidateInfo}>
        <Text style={styles.candidateName} numberOfLines={1}>
          {candidate.username}
        </Text>

        <View style={styles.candidateMeta}>
          {/* Région */}
          {!!candidate.region && (
            <View style={styles.metaChip}>
              <Ionicons
                name="location-outline"
                size={10}
                color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
              />
              <Text style={styles.metaChipText} numberOfLines={1}>
                {candidate.region}
              </Text>
            </View>
          )}

          {/* Défis complétés */}
          {candidate.completedChallengesCount > 0 && (
            <View style={styles.metaChip}>
              <Ionicons
                name="trophy-outline"
                size={10}
                color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
              />
              <Text style={styles.metaChipText}>
                {candidate.completedChallengesCount}
              </Text>
            </View>
          )}
        </View>

        {/* Match label */}
        <Text style={styles.matchLabel} numberOfLines={1}>
          {candidate.hasSameChallenge
            ? t("matching.sameChallengeLabel", { defaultValue: "Fait ce défi en solo" })
            : candidate.sharedCategory
            ? t("matching.sameCategoryLabel", {
                category: candidate.sharedCategory,
                defaultValue: `Catégorie : ${candidate.sharedCategory}`,
              })
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
        {alreadySent ? (
          <Ionicons name="checkmark" size={16} color="#000" />
        ) : (
          <Ionicons name="person-add-outline" size={16} color="#000" />
        )}
      </Pressable>
    </Animated.View>
  );
};

const MatchingModal: React.FC<Props> = ({
  visible,
  onClose,
  onInviteSent,
  challengeId,
  challengeTitle,
  challengeCategory,
  selectedDays,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () => createStyles(isDark, th, insets),
    [isDark, th, insets]
  );

  // Charger les candidats à l'ouverture
  useEffect(() => {
    if (!visible || !challengeId) return;

    setLoading(true);
    setError(null);
    setSentTo(new Set());
    setCandidates([]);

    findMatches({
      challengeId,
      challengeCategory,
      selectedDays,
    })
      .then((results) => {
        setCandidates(results);
      })
      .catch(() => {
        setError(
          t("matching.loadError", {
            defaultValue: "Impossible de charger les profils.",
          })
        );
      })
      .finally(() => setLoading(false));
  }, [visible, challengeId, challengeCategory, selectedDays]);

  const handleInvite = useCallback(
    async (uid: string, username: string) => {
      if (sendingTo) return;
      setSendingTo(uid);

      try {
        await sendMatchingInvitation({
          inviteeId: uid,
          challengeId,
          challengeTitle,
          selectedDays,
        });

        setSentTo((prev) => new Set([...prev, uid]));
        onInviteSent(username);
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("rate_limit_exceeded")) {
          Alert.alert(
            t("matching.rateLimitTitle", { defaultValue: "Limite atteinte" }),
            t("matching.rateLimitBody", {
              defaultValue: "Tu peux envoyer 5 invitations matching par jour.",
            })
          );
        } else {
          Alert.alert(
            t("alerts.error"),
            t("matching.sendError", { defaultValue: "Erreur lors de l'envoi." })
          );
        }
      } finally {
        setSendingTo(null);
      }
    },
    [sendingTo, challengeId, challengeTitle, selectedDays, onInviteSent, t]
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
                      name="search"
                      size={15}
                      color={isDark ? "#F8FAFC" : "#0B1220"}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>
                      {t("matching.title", { defaultValue: "Trouver un binôme" })}
                    </Text>
                    {!!challengeTitle && (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {challengeTitle}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons
                    name="close"
                    size={18}
                    color={isDark ? "#F8FAFC" : "#0B1220"}
                  />
                </Pressable>
              </View>

              {/* Body */}
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator
                    size="small"
                    color={th.colors.primary}
                  />
                  <Text style={styles.loadingText}>
                    {t("matching.searching", {
                      defaultValue: "Recherche de binômes…",
                    })}
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={36}
                    color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)"}
                  />
                  <Text style={styles.emptyText}>{error}</Text>
                </View>
              ) : candidates.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
                  />
                  <Text style={styles.emptyTitle}>
                    {t("matching.emptyTitle", {
                      defaultValue: "Aucun binôme trouvé",
                    })}
                  </Text>
                  <Text style={styles.emptyText}>
                    {t("matching.emptyDesc", {
                      defaultValue:
                        "Active le toggle \"Disponible pour un duo\" dans ton profil pour apparaître ici.",
                    })}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {/* Légende match score */}
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <Text style={styles.legendEmoji}>🎯</Text>
                      <Text style={styles.legendText}>
                        {t("matching.legendPerfect", {
                          defaultValue: "Fait ce défi",
                        })}
                      </Text>
                    </View>
                    <View style={styles.legendItem}>
                      <Text style={styles.legendEmoji}>⚡</Text>
                      <Text style={styles.legendText}>
                        {t("matching.legendGood", { defaultValue: "Même catégorie" })}
                      </Text>
                    </View>
                  </View>

                  {candidates.map((c, i) => (
                    <CandidateCard
                      key={c.uid}
                      candidate={c}
                      onInvite={handleInvite}
                      sentTo={sentTo}
                      isDark={isDark}
                      th={th}
                      styles={styles}
                      index={i}
                    />
                  ))}
                </ScrollView>
              )}

              {/* Footer */}
              {!loading && candidates.length > 0 && (
                <Text style={styles.footerHint}>
                  {t("matching.footerHint", {
                    defaultValue: "L'invitation expire dans 72h. Max 5 invitations/jour.",
                  })}
                </Text>
              )}
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
      backgroundColor: isDark ? "rgba(0,0,0,0.80)" : "rgba(0,0,0,0.60)",
    },
    cardWrap: {
      width: "100%",
      maxWidth: 400,
      marginHorizontal: 20,
      maxHeight: 560,
      borderRadius: 26,
      overflow: "hidden",
    },
    borderGlow: {
      padding: 1.5,
      borderRadius: 26,
      flex: 1,
    },
    card: {
      borderRadius: 24,
      padding: 18,
      backgroundColor: isDark ? "rgba(11,18,32,0.97)" : "rgba(255,255,255,0.99)",
      flex: 1,
      minHeight: 0,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    headerIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
    },
    title: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 16,
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    subtitle: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11.5,
      color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.42)",
      marginTop: 1,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    },

    // Loading / Empty
    loadingWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
      gap: 12,
    },
    loadingText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 13,
      color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
    },
    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 30,
      paddingHorizontal: 16,
      gap: 10,
    },
    emptyTitle: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 15,
      color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
      textAlign: "center",
    },
    emptyText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 12.5,
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)",
      textAlign: "center",
      lineHeight: 18,
    },

    // List
    list: {
      flex: 1,
      minHeight: 0,
    },
    listContent: {
      paddingBottom: 8,
      gap: 10,
    },

    // Legend
    legend: {
      flexDirection: "row",
      gap: 14,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendEmoji: {
      fontSize: 13,
    },
    legendText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)",
    },

    // Candidate card
    candidateCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.03)",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)",
    },

    // Avatar
    avatarWrap: {
      position: "relative",
      width: 46,
      height: 46,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
    },
    avatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 15,
      color: "#fff",
    },
    matchBadge: {
      position: "absolute",
      bottom: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(11,18,32,0.97)" : "#fff",
    },
    matchBadgePerfect: {
      backgroundColor: "rgba(255,215,0,0.90)",
    },
    matchBadgeGood: {
      backgroundColor: "rgba(0,200,255,0.90)",
    },
    matchBadgeText: {
      fontSize: 10,
    },

    // Candidate info
    candidateInfo: {
      flex: 1,
      minWidth: 0,
    },
    candidateName: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 14,
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    candidateMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4,
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    metaChipText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)",
    },
    matchLabel: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(0,200,255,0.75)" : "rgba(0,140,200,0.85)",
      marginTop: 3,
    },

    // Invite button
    inviteBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: th.colors.primary,
    },
    inviteBtnSent: {
      backgroundColor: isDark
        ? "rgba(255,215,0,0.80)"
        : "rgba(255,159,28,0.85)",
    },

    // Footer
    footerHint: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.30)",
      textAlign: "center",
      marginTop: 10,
      lineHeight: 16,
    },
  });

export default MatchingModal;
