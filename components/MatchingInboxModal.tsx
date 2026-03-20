// components/MatchingInboxModal.tsx
// ✅ Inbox des invitations matching — top 1 mondial

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
  Dimensions,
  Platform,
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
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import type { MatchingInboxItem } from "@/hooks/useMatchingInbox";

const { width: SW } = Dimensions.get("window");
const ns = (s: number) => Math.round(s * Math.min(Math.max(SW / 375, 0.82), 1.35));

const ORANGE = "#F97316";
const GOLD   = "#E8B84B";

type Props = {
  visible: boolean;
  onClose: () => void;
  items: MatchingInboxItem[];
  onAccepted: (item: MatchingInboxItem) => void;
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
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase().slice(0, 2) || "?";
};

const InboxCard: React.FC<{
  item: MatchingInboxItem;
  onAccept: (id: string) => void;
  onRefuse: (id: string) => void;
  processing: string | null;
  isDark: boolean;
  th: Theme;
  styles: ReturnType<typeof createStyles>;
  index: number;
  chatId?: string;
}> = ({ item, onAccept, onRefuse, processing, isDark, th, styles, index, chatId }) => {
  const { t } = useTranslation();
  const busy = processing === item.id;

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).duration(260)} style={styles.card}>
      {/* Accent barre gauche */}
      <View style={[styles.cardAccentBar, { backgroundColor: ORANGE }]} />

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {item.inviterProfileImage ? (
          <ExpoImage source={{ uri: item.inviterProfileImage }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[ORANGE + "55", GOLD + "33"]} style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{getInitials(item.inviterUsername)}</Text>
          </LinearGradient>
        )}
        <View style={[styles.duoBadge, { backgroundColor: ORANGE }]}>
          <Ionicons name="people" size={ns(8)} color="#000" />
        </View>
      </View>

      {/* Infos */}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardUsername, { color: isDark ? "#F1F5F9" : "#0F172A" }]} numberOfLines={1}>
          {item.inviterUsername}
        </Text>
        <Text style={[styles.cardChallenge, { color: ORANGE }]} numberOfLines={2}>
          {chatId
            ? t(`challenges.${chatId}.title`, { defaultValue: item.challengeTitle })
            : item.challengeTitle}
        </Text>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={ns(10)} color={isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)"} />
          <Text style={styles.cardMetaText}>{item.selectedDays} {t("matching.days", { defaultValue: "jours" })}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <Pressable
          onPress={() => !busy && onRefuse(item.id)}
          style={({ pressed }) => [styles.refuseBtn, pressed && { opacity: 0.75 }]}
          disabled={!!processing}
        >
          <Ionicons name="close" size={ns(16)} color={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)"} />
        </Pressable>
        <Pressable
          onPress={() => !busy && onAccept(item.id)}
          style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.88 }]}
          disabled={!!processing}
        >
          {busy
            ? <ActivityIndicator size="small" color="#000" />
            : <Ionicons name="checkmark" size={ns(16)} color="#000" />
          }
        </Pressable>
      </View>
    </Animated.View>
  );
};

const MatchingInboxModal: React.FC<Props> = ({
  visible, onClose, items, onAccepted,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const th: Theme = isDark ? designSystem.darkTheme : designSystem.lightTheme;

  const [processing, setProcessing] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<MatchingInboxItem[]>([]);
  const [chatIds, setChatIds] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (visible && items.length > 0) setLocalItems(items);
  }, [visible, items]);

  // Sync immédiat si items arrivent après l'ouverture
  React.useEffect(() => {
    if (visible && items.length > 0 && localItems.length === 0) {
      setLocalItems(items);
    }
  }, [items]);

  React.useEffect(() => {
    if (!visible || localItems.length === 0) return;
    const missing = localItems.filter(i => !chatIds[i.challengeId]);
    if (!missing.length) return;

    missing.forEach(async (item) => {
      try {
        const snap = await getDoc(doc(db, "challenges", item.challengeId));
        if (snap.exists()) {
          const data = snap.data() as any;
          const chatId = data?.chatId;
          if (chatId) {
            setChatIds(prev => ({ ...prev, [item.challengeId]: chatId }));
          }
        }
      } catch {}
    });
  }, [visible, localItems]);

  const styles = useMemo(() => createStyles(isDark, th, insets), [isDark, th, insets]);

  const handleAccept = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      await acceptMatchingInvitation(id);
      const accepted = localItems.find(i => i.id === id);
      if (accepted) { onAccepted(accepted); setLocalItems(prev => prev.filter(i => i.id !== id)); }
      if (localItems.length <= 1) onClose();
    } catch (e: any) {
      console.log("ACCEPT ERROR:", e?.message, e?.code, JSON.stringify(e));
      const msg = String(e?.message || "");
      Alert.alert(
        t("alerts.error"),
        msg.includes("expired") ? t("matching.inviteExpired", { defaultValue: "Cette invitation a expiré." })
          : msg.includes("invitation_deja_traitee") ? t("matching.inviteAlreadyTreated", { defaultValue: "Invitation déjà traitée." })
          : t("matching.acceptError", { defaultValue: "Erreur lors de l'acceptation." })
      );
    } finally { setProcessing(null); }
  }, [localItems, onAccepted, onClose, t]);

  const handleRefuse = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      await refuseMatchingInvitation(id);
      setLocalItems(prev => prev.filter(i => i.id !== id));
      if (localItems.length <= 1) onClose();
    } catch {
      setLocalItems(prev => prev.filter(i => i.id !== id));
      if (localItems.length <= 1) onClose();
    } finally { setProcessing(null); }
  }, [localItems, onClose]);

  return (
    <Modal
      visible={visible} transparent animationType="none"
      statusBarTranslucent presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop} />
        <Pressable onPress={e => e.stopPropagation()}>
          <Animated.View entering={FadeIn.duration(200)} style={styles.cardWrap}>
          <LinearGradient colors={[ORANGE + "CC", GOLD + "AA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.borderGlow}>
            <View style={styles.modalCard}>

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
                    <Ionicons name="mail" size={ns(15)} color={ORANGE} />
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{t("matching.inboxTitle", { defaultValue: "Invitations reçues" })}</Text>
                    <Text style={styles.subtitle}>{localItems.length} {t("matching.inboxCount", { count: localItems.length, defaultValue: "invitation(s) en attente" })}</Text>
                  </View>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={ns(18)} color={isDark ? "#F8FAFC" : "#0B1220"} />
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Liste */}
              {localItems.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <LinearGradient colors={[ORANGE + "20", "transparent"]} style={styles.emptyIconWrap}>
                    <Ionicons name="mail-open-outline" size={ns(38)} color={ORANGE + "90"} />
                  </LinearGradient>
                  <Text style={styles.emptyText}>{t("matching.inboxEmpty", { defaultValue: "Aucune invitation en attente." })}</Text>
                </View>
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} bounces={false}>
                  {localItems.map((item, i) => (
                    <InboxCard key={item.id} item={item} onAccept={handleAccept} onRefuse={handleRefuse} processing={processing} isDark={isDark} th={th} styles={styles} index={i} chatId={chatIds[item.challengeId]} />
                  ))}
                </ScrollView>
              )}

              <Text style={styles.footerHint}>{t("matching.inboxHint", { defaultValue: "Les invitations expirent après 72h." })}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
          </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (isDark: boolean, th: Theme, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    overlay:  { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.62)" },
    cardWrap: {
      width: SW * 0.90,
      maxHeight: SW * 1.4,
      borderRadius: ns(26), overflow: "hidden",
      alignSelf: "center",
    },
    borderGlow: { padding: 1.5, borderRadius: ns(26) },
    modalCard: {
      borderRadius: ns(24),
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

    emptyWrap:    { alignItems: "center", justifyContent: "center", paddingVertical: ns(28), gap: ns(10) },
    emptyIconWrap:{ width: ns(72), height: ns(72), borderRadius: ns(36), alignItems: "center", justifyContent: "center" },
    emptyText:    { fontFamily: "Comfortaa_400Regular", fontSize: ns(13), color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)", textAlign: "center" },

   list:        { flexShrink: 1, maxHeight: SW * 0.55 },
    listContent: { paddingBottom: ns(4), gap: ns(8) },

    /* Card */
    card: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: ns(16),
      borderWidth: 1,
      overflow: "hidden",
      paddingVertical: ns(11),
      paddingRight: ns(12),
      gap: ns(10),
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.88)",
      borderColor: isDark ? ORANGE + "28" : ORANGE + "35",
    },
    cardAccentBar: { width: ns(3), alignSelf: "stretch" },
    avatarWrap:    { position: "relative", marginLeft: ns(10) },
    avatar:        { width: ns(44), height: ns(44), borderRadius: ns(13) },
    avatarFallback:{ width: ns(44), height: ns(44), borderRadius: ns(13), alignItems: "center", justifyContent: "center" },
    avatarInitials:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(14), color: "#fff" },
    duoBadge:      { position: "absolute", bottom: -ns(3), right: -ns(4), width: ns(17), height: ns(17), borderRadius: ns(9), alignItems: "center", justifyContent: "center" },

    cardInfo:     { flex: 1, minWidth: 0 },
    cardUsername: { fontFamily: "Comfortaa_700Bold", fontSize: ns(13.5) },
    cardChallenge:{ fontFamily: "Comfortaa_700Bold", fontSize: ns(11.5), marginTop: ns(2), flexShrink: 1, flexWrap: "wrap" },
    cardMeta:     { flexDirection: "row", alignItems: "center", gap: ns(4), marginTop: ns(3) },
    cardMetaText: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)" },

    cardActions: { flexDirection: "row", gap: ns(7) },
    refuseBtn:   { width: ns(34), height: ns(34), borderRadius: ns(10), alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" },
    acceptBtn:   { width: ns(34), height: ns(34), borderRadius: ns(10), alignItems: "center", justifyContent: "center", backgroundColor: ORANGE },

    footerHint: { fontFamily: "Comfortaa_400Regular", fontSize: ns(11), color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)", textAlign: "center", marginTop: ns(10) },
  });

export default MatchingInboxModal;
