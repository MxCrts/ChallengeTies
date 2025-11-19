// app/profile/notifications.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState  } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthProvider";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import { useRouter } from "expo-router";
import { useToast } from "@/src/ui/Toast";
import { warmChallengeMetas, readTitleSync } from "../../src/services/challengeMetaCache";


type Invitation = {
  id: string;
  challengeId: string;
  inviterId: string;
  inviteeId?: string | null;
  inviteeUsername?: string | null;
  selectedDays: number;
  status: "pending" | "accepted" | "refused" | "cancelled";
  kind?: "open" | "direct";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expiresAt?: Timestamp;
  acceptedAt?: Timestamp;
};

type FilterTab = "inbox" | "sent" | "accepted" | "refused";
type Scope = "all" | "duo";

const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inbox, setInbox] = useState<Invitation[]>([]);
  const [sent, setSent] = useState<Invitation[]>([]);
  const [active, setActive] = useState<FilterTab>("inbox");
  const [scope, setScope] = useState<Scope>("all");
  const [nowMs, setNowMs] = useState<number>(Date.now());
  
   // Ticker pour forcer un re-render toutes les 60s (compte à rebours)
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // -------- Fetch (2 listeners: reçues & envoyées) ----------
  useEffect(() => {
    if (!user?.uid) return;
    const baseRef = collection(db, "invitations");

    // Reçues (où je suis inviteeId)
    const qInbox = query(
      baseRef,
      where("inviteeId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    // Envoyées (où je suis inviterId)
    const qSent = query(
      baseRef,
      where("inviterId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubInbox = onSnapshot(
      qInbox,
      (snap) => {
        const rows: Invitation[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        setInbox(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubSent = onSnapshot(
      qSent,
      (snap) => {
        const rows: Invitation[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        setSent(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubInbox();
      unsubSent();
    };
  }, [user?.uid]);

  // Warm cache des titres en batch pour un rendu premium
  useEffect(() => {
    const ids = new Set<string>();
    inbox.forEach(i => ids.add(i.challengeId));
    sent.forEach(i => ids.add(i.challengeId));
    if (ids.size) {
      warmChallengeMetas(Array.from(ids)).catch(() => {});
    }
  }, [inbox, sent]);

  const onRefresh = useCallback(() => {
    // listeners temps réel -> simple feedback
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // --------- Filtrage local ----------
  const list = useMemo(() => {
    const byTab = (() => {
      switch (active) {
      case "inbox":
        return inbox.filter((r) => r.status === "pending");
      case "sent":
        return sent.filter((r) => r.status === "pending");
      case "accepted":
        return [...inbox, ...sent].filter((r) => r.status === "accepted");
      case "refused":
        return [...inbox, ...sent].filter((r) => r.status === "refused" || r.status === "cancelled");
      default:
        return [];
    }
    })();
    // mini-scope: "duo" n’affiche que les invitations (actuellement tout est duo)
    return scope === "duo" ? byTab /* déjà duo */ : byTab;
  }, [active, inbox, sent, scope]);

  // 🚀 Prefetch titres des challenges visibles (cache + déduplication)
  useEffect(() => {
    try {
      const ids = list.map((it) => String(it.challengeId || "")).filter(Boolean);
      if (ids.length) void warmChallengeMetas(ids);
    } catch {
      // no-op
    }
  }, [list]);

  // --------- Actions ----------
  const accept = useCallback(async (inv: Invitation) => {
    if (!user?.uid) return;
    try {
      // Règles: pour accept (open/direct), on met status, updatedAt et acceptedAt
      await updateDoc(doc(db, "invitations", inv.id), {
        status: "accepted",
        updatedAt: serverTimestamp(),
        acceptedAt: serverTimestamp(),
        // pour OPEN, c’est généralement déjà set côté service;
        // si jamais l’open n’avait pas d’inviteeId, c’est refusé par rules -> on ne touche pas ici
      });
      show(t("invitationS.sentShort"), "success");
      // Redirige vers la page challenge pour démarrer
      router.push(`/challenge-details/${inv.challengeId}`);
    } catch (e: any) {
      console.log("accept error", e);
      Alert.alert(t("commonS.errorTitle", { defaultValue: "Erreur" }), t("invitationS.errors.unknown"));
    }
  }, [router, show, t, user?.uid]);

  const refuse = useCallback(async (inv: Invitation) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, "invitations", inv.id), {
        status: "refused",
        updatedAt: serverTimestamp(),
      });
      show(t("notificationsPush.invitationRefused", { username: "" }), "info");
    } catch (e: any) {
      console.log("refuse error", e);
      Alert.alert(t("commonS.errorTitle", { defaultValue: "Erreur" }), t("invitationS.errors.unknown"));
    }
  }, [show, t, user?.uid]);

  const cancel = useCallback(async (inv: Invitation) => {
    // uniquement l’inviter
    Alert.alert(
      t("notificationsScreen.cancelTitle", { defaultValue: "Annuler l’invitation ?" }),
      t("notificationsScreen.cancelMessage", { defaultValue: "Cette invitation sera annulée." }),
      [
        { text: t("commonS.cancel"), style: "cancel" },
        {
          text: t("notificationsScreen.cancelConfirm", { defaultValue: "Annuler" }),
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "invitations", inv.id), {
                status: "cancelled",
                updatedAt: serverTimestamp(),
              });
              show(t("notificationsScreen.cancelled", { defaultValue: "Invitation annulée" }), "info");
            } catch (e: any) {
              console.log("cancel error", e);
              Alert.alert(t("commonS.errorTitle", { defaultValue: "Erreur" }), t("invitationS.errors.unknown"));
            }
          },
        },
      ]
    );
  }, [show, t]);

  // --------- UI ----------
  const Header = () => (
    <LinearGradient
      colors={["#0f172a", "#111827"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Text style={styles.title}>{t("notificationsScreen.title", { defaultValue: "Invitations & Notifications" })}</Text>
      <Text style={styles.subtitle}>
        {t("notificationsScreen.subtitle", { defaultValue: "Gère tes invitations duo et suivez leurs statuts." })}
      </Text>

      <View style={styles.tabs}>
        <Tab
          active={active === "inbox"}
          label={t("notificationsScreen.tabInbox", { defaultValue: "Reçues" })}
          icon="mail-unread-outline"
          onPress={() => setActive("inbox")}
        />
        <Tab
          active={active === "sent"}
          label={t("notificationsScreen.tabSent", { defaultValue: "Envoyées" })}
          icon="paper-plane-outline"
          onPress={() => setActive("sent")}
        />
        <Tab
          active={active === "accepted"}
          label={t("notificationsScreen.tabAccepted", { defaultValue: "Acceptées" })}
          icon="checkmark-done-outline"
          onPress={() => setActive("accepted")}
        />
        <Tab
          active={active === "refused"}
          label={t("notificationsScreen.tabRefused", { defaultValue: "Refusées" })}
          icon="close-circle-outline"
          onPress={() => setActive("refused")}
        />
      </View>

      {/* Mini-filtre (préparé pour élargir le scope plus tard) */}
      <View style={styles.scopeRow}>
        <Chip
          active={scope === "all"}
          label={t("notificationsScreen.filterAll", { defaultValue: "Tous" })}
          onPress={() => setScope("all")}
        />
        <Chip
          active={scope === "duo"}
          label={t("notificationsScreen.filterDuo", { defaultValue: "Duo uniquement" })}
          onPress={() => setScope("duo")}
        />
      </View>
    </LinearGradient>
  );

  // ------ Helpers countdown & badge ------
const formatRemaining = useCallback((ms: number) => {
  if (ms <= 0) {
    return t("notificationsScreen.expired", { defaultValue: "Expirée" });
  }
  const m = Math.floor(ms / 60000);
  if (m < 60) {
    return t("notificationsScreen.remain.m", { defaultValue: "{{count}} min", count: m });
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return t("notificationsScreen.remain.h", { defaultValue: "{{count}} h", count: h });
  }
  const d = Math.floor(h / 24);
  return t("notificationsScreen.remain.d", { defaultValue: "{{count}} j", count: d });
}, [t]);

  const ExpireBadge: React.FC<{ expiresAt?: Timestamp }> = ({ expiresAt }) => {
   if (!expiresAt) return null;
    const ms = expiresAt.toMillis() - nowMs;
    const isExpired = ms <= 0;
    const label = isExpired
      ? t("notificationsScreen.expired", { defaultValue: "Expirée" })
      : t("notificationsScreen.expiresInShort", { defaultValue: "Expire dans {{time}}" , time: formatRemaining(ms) });
    // Couleur en fonction de l’urgence
    let bg = "#1f2937"; // neutre
    if (isExpired) bg = "#b91c1c";       // rouge
    else if (ms < 24 * 3600 * 1000) bg = "#dc2626"; // <24h rouge vif
    else if (ms < 72 * 3600 * 1000) bg = "#d97706"; // <72h orange
    else bg = "#374151"; // gris foncé
    return (
      <View style={[styles.badgeExpire, { backgroundColor: bg }]}>
        <Ionicons name={isExpired ? "alert-circle-outline" : "time-outline"} size={14} color="#fff" />
        <Text style={styles.badgeExpireText}>{label}</Text>
      </View>
    );
  };


  const renderItem = ({ item }: { item: Invitation }) => (
    <Animated.View entering={FadeInUp.springify().mass(0.8)} style={styles.cardWrap}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.badge}>
            <Ionicons name="flash-outline" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {t("notificationsScreen.challenge", { defaultValue: "Défi" })} • {readTitleSync(item.challengeId) || item.challengeId}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.selectedDays} {t("challengeDetails.days")}
              {"  •  "}
              {t(`notificationsScreen.status.${item.status}`, { defaultValue: item.status })}
            </Text>
          </View>
          <ExpireBadge expiresAt={item.expiresAt} />
        </View>

        <View style={styles.actions}>
          {/* INBOX PENDING: Accept / Refuse */}
          {active === "inbox" && item.status === "pending" && (
            <>
              <PrimaryButton
                title={t("invitationS.actions.continue")}
                icon="checkmark-outline"
                onPress={() => accept(item)}
                a11y={t("notificationsScreen.a11y.accept")}
              />
              <SecondaryButton
                title={t("invitationS.actions.cancel")}
                icon="close-outline"
                onPress={() => refuse(item)}
                a11y={t("notificationsScreen.a11y.refuse")}
              />
            </>
          )}

          {/* SENT PENDING: Cancel */}
          {active === "sent" && item.status === "pending" && (
            <SecondaryButton
              title={t("notificationsScreen.cancelShort", { defaultValue: "Annuler" })}
              icon="trash-outline"
              onPress={() => cancel(item)}
              a11y={t("notificationsScreen.a11y.cancel")}
            />
          )}

          {/* Accepted: Ouvrir challenge */}
          {active === "accepted" && (
            <PrimaryButton
              title={t("notificationsScreen.open", { defaultValue: "Ouvrir" })}
              icon="arrow-forward-outline"
              onPress={() => router.push(`/challenge-details/${item.challengeId}`)}
              a11y={t("notificationsScreen.a11y.open")}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );

  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons name="notifications-off-outline" size={36} color="#94a3b8" />
      <Text style={styles.emptyTitle}>
        {t("notificationsScreen.emptyTitle", { defaultValue: "Rien pour le moment" })}
      </Text>
      <Text style={styles.emptyText}>
        {t("notificationsScreen.emptyText", { defaultValue: "Tes invitations apparaîtront ici." })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListEmptyComponent={<Empty />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          getItemLayout={(_, index) => ({ length: 92, offset: 92 * index, index })}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        />
      )}
    </View>
  );
};

// --------- UI atoms ----------
const Tab: React.FC<{ active: boolean; label: string; icon: any; onPress: () => void }> = ({
  active,
  label,
  icon,
  onPress,
}) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.tab, active && styles.tabActive]}
  >
    <Ionicons name={icon} size={16} color={active ? "#111827" : "#e5e7eb"} />
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const PrimaryButton: React.FC<{
  title: string;
  icon?: any;
  onPress: () => void;
  a11y?: string;
}> = ({ title, icon, onPress, a11y }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.primaryBtn}
    accessibilityRole="button"
    accessibilityLabel={a11y || title}
  >
    {icon ? <Ionicons name={icon} size={18} color="#0f172a" /> : null}
    <Text style={styles.primaryBtnText}>{title}</Text>
  </TouchableOpacity>
);

const SecondaryButton: React.FC<{
  title: string;
  icon?: any;
  onPress: () => void;
  a11y?: string;
}> = ({ title, icon, onPress, a11y }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.secondaryBtn}
    accessibilityRole="button"
    accessibilityLabel={a11y || title}
  >
    {icon ? <Ionicons name={icon} size={18} color="#e5e7eb" /> : null}
    <Text style={styles.secondaryBtnText}>{title}</Text>
  </TouchableOpacity>
);

const Chip: React.FC<{ active: boolean; label: string; onPress: () => void }> = ({ active, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.chip, active && styles.chipActive]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default NotificationsScreen;

// --------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    paddingTop: Platform.select({ ios: 64, android: 28 }),
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabActive: {
    backgroundColor: "#f8fafc",
    borderColor: "#f8fafc",
  },
  tabText: { color: "#e5e7eb", fontSize: 13 },
  tabTextActive: { color: "#111827", fontWeight: "700" },

  cardWrap: { marginBottom: 12 },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 10 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  scopeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  badgeExpire: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeExpireText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#e5e7eb",
  },
  chipText: { color: "#e5e7eb", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  cardTitle: { color: "#fff", fontSize: 15, fontFamily: "Comfortaa_700Bold" },
  cardMeta: { color: "#94a3b8", marginTop: 2 },

  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#0f172a", fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: { color: "#e5e7eb", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: { color: "#e5e7eb", fontSize: 16, fontFamily: "Comfortaa_700Bold" },
  emptyText: { color: "#94a3b8" },

  loader: { padding: 24, alignItems: "center" },
});
