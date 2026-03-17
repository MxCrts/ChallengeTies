// components/MatchingInboxModal.tsx
// ✅ Inbox des invitations matching — top 1 mondial
// L'invité voit, accepte ou refuse ses invitations

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
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
  acceptMatchingInvitation,
  refuseMatchingInvitation,
} from "@/services/matchingService";
import type { MatchingInboxItem } from "@/hooks/useMatchingInbox";

type Props = {
  visible: boolean;
  onClose: () => void;
  items: MatchingInboxItem[];
  onAccepted: (item: MatchingInboxItem) => void;
};

const withAlpha = (hex: string, a: number) => {
  const alpha = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  const clean = hex.replace("#", "");
  return `#${clean.length === 3
    ? clean[0]+clean[0]+clean[1]+clean[1]+clean[2]+clean[2]
    : clean}${alpha}`;
};

const getInitials = (name?: string) => {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || ""))
    .toUpperCase()
    .slice(0, 2) || "?";
};

const InboxCard: React.FC<{
  item: MatchingInboxItem;
  onAccept: (id: string) => void;
  onRefuse: (id: string) => void;
  processing: string | null;
  isDark: boolean;
  th: Theme;
  styles: any;
  index: number;
}> = ({ item, onAccept, onRefuse, processing, isDark, th, styles, index }) => {
  const { t } = useTranslation();
  const busy = processing === item.id;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 70).duration(260)}
      style={styles.card}
    >
      {/* Avatar inviteur */}
      <View style={styles.avatarWrap}>
        {item.inviterProfileImage ? (
          <ExpoImage
            source={{ uri: item.inviterProfileImage }}
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
              {getInitials(item.inviterUsername)}
            </Text>
          </LinearGradient>
        )}
      </View>

      {/* Infos */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardUsername} numberOfLines={1}>
          {item.inviterUsername}
        </Text>
        <Text style={styles.cardChallenge} numberOfLines={1}>
          {item.challengeTitle}
        </Text>
        <View style={styles.cardMeta}>
          <Ionicons
            name="calendar-outline"
            size={11}
            color={isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)"}
          />
          <Text style={styles.cardMetaText}>
            {item.selectedDays}{" "}
            {t("matching.days", { defaultValue: "jours" })}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        {/* Refuser */}
        <Pressable
          onPress={() => !busy && onRefuse(item.id)}
          style={({ pressed }) => [
            styles.refuseBtn,
            pressed && { opacity: 0.75 },
          ]}
          disabled={!!processing}
        >
          <Ionicons
            name="close"
            size={16}
            color={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)"}
          />
        </Pressable>

        {/* Accepter */}
        <Pressable
          onPress={() => !busy && onAccept(item.id)}
          style={({ pressed }) => [
            styles.acceptBtn,
            pressed && { opacity: 0.88 },
          ]}
          disabled={!!processing}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="checkmark" size={16} color="#000" />
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
};

const MatchingInboxModal: React.FC<Props> = ({
  visible,
  onClose,
  items,
  onAccepted,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [processing, setProcessing] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<MatchingInboxItem[]>([]);

  // Sync items à l'ouverture
  React.useEffect(() => {
    if (visible) setLocalItems(items);
  }, [visible, items]);

  const styles = useMemo(() => createStyles(isDark, th, insets), [isDark, th, insets]);

  const handleAccept = useCallback(
    async (id: string) => {
      setProcessing(id);
      try {
        await acceptMatchingInvitation(id);
        const accepted = localItems.find((i) => i.id === id);
        if (accepted) {
          onAccepted(accepted);
          setLocalItems((prev) => prev.filter((i) => i.id !== id));
        }
        // Si plus d'invitations → ferme
        if (localItems.length <= 1) onClose();
      } catch (e: any) {
        const msg = String(e?.message || "");
        Alert.alert(
          t("alerts.error"),
          msg.includes("expired")
            ? t("matching.inviteExpired", { defaultValue: "Cette invitation a expiré." })
            : msg.includes("invitation_deja_traitee")
            ? t("matching.inviteAlreadyTreated", { defaultValue: "Invitation déjà traitée." })
            : t("matching.acceptError", { defaultValue: "Erreur lors de l'acceptation." })
        );
      } finally {
        setProcessing(null);
      }
    },
    [localItems, onAccepted, onClose, t]
  );

  const handleRefuse = useCallback(
    async (id: string) => {
      setProcessing(id);
      try {
        await refuseMatchingInvitation(id);
        setLocalItems((prev) => prev.filter((i) => i.id !== id));
        if (localItems.length <= 1) onClose();
      } catch {
        // En cas d'erreur on retire quand même localement
        setLocalItems((prev) => prev.filter((i) => i.id !== id));
        if (localItems.length <= 1) onClose();
      } finally {
        setProcessing(null);
      }
    },
    [localItems, onClose]
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
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Ionicons
                      name="mail"
                      size={15}
                      color={isDark ? "#F8FAFC" : "#0B1220"}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>
                      {t("matching.inboxTitle", {
                        defaultValue: "Invitations reçues",
                      })}
                    </Text>
                    <Text style={styles.subtitle}>
                      {localItems.length}{" "}
                      {t("matching.inboxCount", {
                        count: localItems.length,
                        defaultValue: "invitation(s) en attente",
                      })}
                    </Text>
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

              {/* Liste */}
              {localItems.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="mail-open-outline"
                    size={36}
                    color={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
                  />
                  <Text style={styles.emptyText}>
                    {t("matching.inboxEmpty", {
                      defaultValue: "Aucune invitation en attente.",
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
                  {localItems.map((item, i) => (
                    <InboxCard
                      key={item.id}
                      item={item}
                      onAccept={handleAccept}
                      onRefuse={handleRefuse}
                      processing={processing}
                      isDark={isDark}
                      th={th}
                      styles={styles}
                      index={i}
                    />
                  ))}
                </ScrollView>
              )}

              {/* Footer hint */}
              <Text style={styles.footerHint}>
                {t("matching.inboxHint", {
                  defaultValue: "Les invitations expirent après 72h.",
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
      backgroundColor: isDark ? "rgba(0,0,0,0.80)" : "rgba(0,0,0,0.60)",
    },
    cardWrap: {
      width: "100%",
      maxWidth: 400,
      maxHeight: 520,
      marginHorizontal: 20,
      borderRadius: 26,
      overflow: "hidden",
    },
    borderGlow: {
      padding: 1.5,
      borderRadius: 26,
      flex: 1,
    },
    modalCard: {
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
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
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

    // Empty
    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 30,
      gap: 10,
    },
    emptyText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 13,
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)",
      textAlign: "center",
    },

    // List
    list: { flex: 1, minHeight: 0 },
    listContent: { paddingBottom: 8, gap: 10 },

    // Card
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    },

    // Avatar
    avatarWrap: { width: 44, height: 44 },
    avatar: { width: 44, height: 44, borderRadius: 14 },
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 15,
      color: "#fff",
    },

    // Card info
    cardInfo: { flex: 1, minWidth: 0 },
    cardUsername: {
      fontFamily: "Comfortaa_700Bold",
      fontSize: 14,
      color: isDark ? "#F8FAFC" : "#0B1220",
    },
    cardChallenge: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 12,
      color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.48)",
      marginTop: 2,
    },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    cardMetaText: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)",
    },

    // Actions
    cardActions: { flexDirection: "row", gap: 8 },
    refuseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
    },
    acceptBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: th.colors.primary,
    },

    // Footer
    footerHint: {
      fontFamily: "Comfortaa_400Regular",
      fontSize: 11,
      color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)",
      textAlign: "center",
      marginTop: 10,
    },
  });

export default MatchingInboxModal;
