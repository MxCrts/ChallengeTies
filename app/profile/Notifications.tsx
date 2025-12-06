// app/profile/notifications.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  Dimensions,
 I18nManager,
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
  Timestamp,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import { useRouter } from "expo-router";
import { useToast } from "@/src/ui/Toast";
import {
  warmChallengeMetas,
  readTitleSync,
} from "@/src/services/challengeMetaCache";
import {
  acceptInvitation,
  refuseInvitationDirect,
  refuseOpenInvitation,
  cancelInvitationByInviter,
  isInvitationExpired,
  type Invitation as ServiceInvitation,
} from "@/services/invitationService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};


type Invitation = ServiceInvitation & { id: string; chatId?: string };


type FilterTab = "inbox" | "sent" | "accepted" | "refused";
type Scope = "all" | "duo";

const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme(); // laissé comme dans ta version (même si pas utilisé)
  const router = useRouter();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inbox, setInbox] = useState<Invitation[]>([]);
  const [sent, setSent] = useState<Invitation[]>([]);
  const [active, setActive] = useState<FilterTab>("inbox");
  const [scope, setScope] = useState<Scope>("all");
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [titlesByChallengeId, setTitlesByChallengeId] = useState<
    Record<string, string>
  >({});

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
        snap.forEach((d) =>
          rows.push({ id: d.id, ...(d.data() as ServiceInvitation) })
        );
        setInbox(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubSent = onSnapshot(
      qSent,
      (snap) => {
        const rows: Invitation[] = [];
        snap.forEach((d) =>
          rows.push({ id: d.id, ...(d.data() as ServiceInvitation) })
        );
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
    inbox.forEach((i) => ids.add(i.challengeId));
    sent.forEach((i) => ids.add(i.challengeId));
    if (ids.size) {
      warmChallengeMetas(Array.from(ids)).catch(() => {});
    }
  }, [inbox, sent]);

  // 🔤 Titres localisés des challenges (comme sur index)
  useEffect(() => {
    const ids = new Set<string>();
    inbox.forEach((i) => ids.add(i.challengeId));
    sent.forEach((i) => ids.add(i.challengeId));

    if (!ids.size) {
      setTitlesByChallengeId({});
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const entries: [string, string][] = [];

        await Promise.all(
          Array.from(ids).map(async (id) => {
            try {
              const ref = doc(db, "challenges", id);
              const snap = await getDoc(ref);

              if (snap.exists()) {
                const data = snap.data() as any;
                const chatId = data?.chatId;
                const rawTitle =
                  data?.title || readTitleSync(id) || String(id);

                let title: string;

                if (chatId) {
                  // 🧠 Comme dans index : challenges.<chatId>.title
                  title =
                    t(`challenges.${chatId}.title`, {
                      defaultValue: rawTitle,
                    }) || rawTitle;
                } else {
                  // Fallback : on tente avec l'id comme clé, sinon brut
                  title =
                    t(`challenges.${id}.title`, {
                      defaultValue: rawTitle,
                    }) || rawTitle;
                }

                entries.push([id, title]);
              } else {
                const fallback =
                  readTitleSync(id) ||
                  t("mysteriousChallenge", {
                    defaultValue: "Défi mystère",
                  }) ||
                  String(id);
                entries.push([id, fallback]);
              }
            } catch {
              const fallback =
                readTitleSync(id) ||
                t("mysteriousChallenge", {
                  defaultValue: "Défi mystère",
                }) ||
                String(id);
              entries.push([id, fallback]);
            }
          })
        );

        if (!cancelled) {
          setTitlesByChallengeId((prev) => {
            const next = { ...prev };
            entries.forEach(([id, title]) => {
              next[id] = title;
            });
            return next;
          });
        }
      } catch {
        // no-op
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // 🔁 On relance quand la langue change
  }, [inbox, sent, i18n.language, t]);


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
          return [...inbox, ...sent].filter(
            (r) => r.status === "refused" || r.status === "cancelled"
          );
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
      const ids = list
        .map((it) => String(it.challengeId || ""))
        .filter(Boolean);
      if (ids.length) void warmChallengeMetas(ids);
    } catch {
      // no-op
    }
  }, [list]);

  // ------ Helpers countdown & badge ------
  const formatRemaining = useCallback(
    (ms: number) => {
      if (ms <= 0) {
        return t("notificationsScreen.expired", { defaultValue: "Expirée" });
      }
      const m = Math.floor(ms / 60000);
      if (m < 60) {
        return t("notificationsScreen.remain.m", {
          defaultValue: "{{count}} min",
          count: m,
        });
      }
      const h = Math.floor(m / 60);
      if (h < 24) {
        return t("notificationsScreen.remain.h", {
          defaultValue: "{{count}} h",
          count: h,
        });
      }
      const d = Math.floor(h / 24);
      return t("notificationsScreen.remain.d", {
        defaultValue: "{{count}} j",
        count: d,
      });
    },
    [t]
  );

  const ExpireBadge: React.FC<{ expiresAt?: Timestamp }> = ({ expiresAt }) => {
    if (!expiresAt) return null;
    const ms = expiresAt.toMillis() - nowMs;
    const isExpired = ms <= 0;
    const label = isExpired
      ? t("notificationsScreen.expired", { defaultValue: "Expirée" })
      : t("notificationsScreen.expiresInShort", {
          defaultValue: "Expire dans {{time}}",
          time: formatRemaining(ms),
        });
    // Couleur en fonction de l’urgence
    let bg = "#1f2937"; // neutre
    if (isExpired) bg = "#b91c1c"; // rouge
    else if (ms < 24 * 3600 * 1000) bg = "#dc2626"; // <24h rouge vif
    else if (ms < 72 * 3600 * 1000) bg = "#d97706"; // <72h orange
    else bg = "#374151"; // gris foncé
    return (
      <View style={[styles.badgeExpire, { backgroundColor: bg }]}>
        <Ionicons
          name={isExpired ? "alert-circle-outline" : "time-outline"}
          size={14}
          color="#fff"
        />
         <Text
          style={styles.badgeExpireText}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </View>
    );
  };

  // --------- Actions (⚡ via invitationService) ----------
  const accept = useCallback(
    async (inv: Invitation) => {
      if (!user?.uid) return;

      // Check expiration côté client (UX + évite une erreur inutile)
      if (isInvitationExpired(inv)) {
        show(
          t("notificationsScreen.expiredToast", {
            defaultValue: "Cette invitation a expiré.",
          }),
          "info"
        );
        return;
      }

      try {
        await acceptInvitation(inv.id);
        show(t("invitationS.sentShort"), "success");
        // Redirige vers la page challenge pour démarrer
        router.push(`/challenge-details/${inv.challengeId}`);
      } catch (e: any) {
        console.log("accept error", e);
        Alert.alert(
          t("commonS.errorTitle", { defaultValue: "Erreur" }),
          t("invitationS.errors.unknown")
        );
      }
    },
    [router, show, t, user?.uid]
  );

  const refuse = useCallback(
    async (inv: Invitation) => {
      if (!user?.uid) return;
      try {
        if (inv.kind === "open") {
          await refuseOpenInvitation(inv.id);
        } else {
          await refuseInvitationDirect(inv.id);
        }
        show(
          t("notificationsPush.invitationRefused", {
            username: inv.inviteeUsername || "",
          }),
          "info"
        );
      } catch (e: any) {
        console.log("refuse error", e);
        Alert.alert(
          t("commonS.errorTitle", { defaultValue: "Erreur" }),
          t("invitationS.errors.unknown")
        );
      }
    },
    [show, t, user?.uid]
  );

  const cancel = useCallback(
    async (inv: Invitation) => {
      // uniquement l’inviter (enforced par invitationService)
      Alert.alert(
        t("notificationsScreen.cancelTitle", {
          defaultValue: "Annuler l’invitation ?",
        }),
        t("notificationsScreen.cancelMessage", {
          defaultValue: "Cette invitation sera annulée.",
        }),
        [
          { text: t("commonS.cancel"), style: "cancel" },
          {
            text: t("notificationsScreen.cancelConfirm", {
              defaultValue: "Annuler",
            }),
            style: "destructive",
            onPress: async () => {
              try {
                await cancelInvitationByInviter(inv.id);
                show(
                  t("notificationsScreen.cancelled", {
                    defaultValue: "Invitation annulée",
                  }),
                  "info"
                );
              } catch (e: any) {
                console.log("cancel error", e);
                Alert.alert(
                  t("commonS.errorTitle", { defaultValue: "Erreur" }),
                  t("invitationS.errors.unknown")
                );
              }
            },
          },
        ]
      );
    },
    [show, t]
  );

  // --------- UI ----------
  const Header = () => (
    <LinearGradient
      colors={["#0f172a", "#111827"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Text
        style={styles.title}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {t("notificationsScreen.title", {
          defaultValue: "Invitations & Notifications",
        })}
      </Text>
      <Text
        style={styles.subtitle}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {t("notificationsScreen.subtitle", {
          defaultValue: "Gère tes invitations duo et suivez leurs statuts.",
        })}
      </Text>

      <View style={styles.tabs}>
        <Tab
          active={active === "inbox"}
          label={t("notificationsScreen.tabInbox", {
            defaultValue: "Reçues",
          })}
          icon="mail-unread-outline"
          onPress={() => setActive("inbox")}
        />
        <Tab
          active={active === "sent"}
          label={t("notificationsScreen.tabSent", {
            defaultValue: "Envoyées",
          })}
          icon="paper-plane-outline"
          onPress={() => setActive("sent")}
        />
        <Tab
          active={active === "accepted"}
          label={t("notificationsScreen.tabAccepted", {
            defaultValue: "Acceptées",
          })}
          icon="checkmark-done-outline"
          onPress={() => setActive("accepted")}
        />
        <Tab
          active={active === "refused"}
          label={t("notificationsScreen.tabRefused", {
            defaultValue: "Refusées",
          })}
          icon="close-circle-outline"
          onPress={() => setActive("refused")}
        />
      </View>

      {/* Mini-filtre (préparé pour élargir le scope plus tard) */}
      <View style={styles.scopeRow}>
        <Chip
          active={scope === "all"}
          label={t("notificationsScreen.filterAll", {
            defaultValue: "Tous",
          })}
          onPress={() => setScope("all")}
        />
        <Chip
          active={scope === "duo"}
          label={t("notificationsScreen.filterDuo", {
            defaultValue: "Duo uniquement",
          })}
          onPress={() => setScope("duo")}
        />
      </View>
    </LinearGradient>
  );

    const renderItem = ({ item }: { item: Invitation }) => {
    const localizedTitle =
      titlesByChallengeId[item.challengeId] ||
      readTitleSync(item.challengeId) ||
      item.challengeId;

    return (
      <Animated.View
        entering={FadeInUp.springify().mass(0.8)}
        style={styles.cardWrap}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.badge}>
              <Ionicons name="flash-outline" size={18} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={styles.cardTitle}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {localizedTitle}
              </Text>

              <Text
                style={styles.cardMeta}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {item.selectedDays} {t("challengeDetails.days")}
                {"  •  "}
                {t(`notificationsScreen.status.${item.status}`, {
                  defaultValue: item.status,
                })}
              </Text>
            </View>

            {item.status === "pending" && (
              <ExpireBadge expiresAt={item.expiresAt} />
            )}
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
                title={t("notificationsScreen.cancelShort", {
                  defaultValue: "Annuler",
                })}
                icon="trash-outline"
                onPress={() => cancel(item)}
                a11y={t("notificationsScreen.a11y.cancel")}
              />
            )}

            {/* Accepted: Ouvrir challenge */}
            {active === "accepted" && (
              <PrimaryButton
                title={t("notificationsScreen.open", {
                  defaultValue: "Ouvrir",
                })}
                icon="arrow-forward-outline"
                onPress={() =>
                  router.push(`/challenge-details/${item.challengeId}`)
                }
                a11y={t("notificationsScreen.a11y.open")}
              />
            )}
          </View>
        </View>
      </Animated.View>
    );
  };


  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons name="notifications-off-outline" size={36} color="#94a3b8" />
      <Text
        style={styles.emptyTitle}
        numberOfLines={1}
        adjustsFontSizeToFit
      >

        {t("notificationsScreen.emptyTitle", {
          defaultValue: "Rien pour le moment",
        })}
      </Text>
      <Text
        style={styles.emptyText}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {t("notificationsScreen.emptyText", {
          defaultValue: "Tes invitations apparaîtront ici.",
        })}
      </Text>
    </View>
  );

  return (
  <LinearGradient
    colors={["#0f172a", "#1e293b", "#0f172a"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{ flex: 1 }}
  >
    {/* Orbes décoratives */}
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,184,0,0.22)", "transparent"]}
      style={styles.bgOrbTop}
    />
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,184,0,0.18)", "transparent"]}
      style={styles.bgOrbBottom}
    />

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
          getItemLayout={(_, index) => ({
            length: 92,
            offset: 92 * index,
            index,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
        />
      )}
    </View>
</LinearGradient>
  );
};

// --------- UI atoms ----------
const Tab: React.FC<{
  active: boolean;
  label: string;
  icon: any;
  onPress: () => void;
}> = ({ active, label, icon, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.tab, active && styles.tabActive]}
  >
    <Ionicons
      name={icon}
      size={16}
      color={active ? "#111827" : "#e5e7eb"}
    />
     <Text
      style={[styles.tabText, active && styles.tabTextActive]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {label}
    </Text>
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
     <Text
      style={styles.primaryBtnText}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {title}
    </Text>
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
    <Text
      style={styles.secondaryBtnText}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const Chip: React.FC<{
  active: boolean;
  label: string;
  onPress: () => void;
}> = ({ active, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.chip, active && styles.chipActive]}
  >
    <Text
      style={[styles.chipText, active && styles.chipTextActive]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default NotificationsScreen;

// --------- Styles ----------
const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: "transparent", // anciennement noir
},
  header: {
  paddingTop: Platform.select({ ios: 64, android: 34 }),
  paddingBottom: 24,
  paddingHorizontal: 18,
  borderBottomLeftRadius: 22,
  borderBottomRightRadius: 22,
  backgroundColor: "rgba(0,0,0,0.15)",
  backdropFilter: "blur(12px)",
},
  title: {
    color: "#fff",
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 6,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: normalizeSize(14),
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
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
    borderColor: "rgba(255,255,255,0.25)",
backgroundColor: "rgba(255,255,255,0.06)",

  },
  tabActive: {
    backgroundColor: "#FFB800",
borderColor: "#FFB800",
shadowColor: "#FFB800",
shadowOpacity: 0.3,
shadowRadius: 6,
shadowOffset: { width: 0, height: 2 },
elevation: 3,

  },
  tabText: {
    color: "#e5e7eb",
    fontSize: normalizeSize(13),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
  },
  tabTextActive: {  color: "#1a1a1a",
fontWeight: "800",},

  cardWrap: { marginBottom: 12 },
  card: {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1.2,
  borderColor: "rgba(255,255,255,0.12)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 6,
},

  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  badge: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: "#FFB800",
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#FFB800",
  shadowOpacity: 0.45,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
},

  bgOrbTop: {
  position: "absolute",
  top: -SCREEN_WIDTH * 0.4,
  left: -SCREEN_WIDTH * 0.2,
  width: SCREEN_WIDTH * 1.2,
  height: SCREEN_WIDTH * 1.2,
  borderRadius: SCREEN_WIDTH * 0.6,
},

bgOrbBottom: {
  position: "absolute",
  bottom: -SCREEN_WIDTH * 0.5,
  right: -SCREEN_WIDTH * 0.3,
  width: SCREEN_WIDTH * 1.4,
  height: SCREEN_WIDTH * 1.4,
  borderRadius: SCREEN_WIDTH * 0.7,
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
 badgeExpireText: {
    color: "#fff",
    fontSize: normalizeSize(12),
    fontWeight: "700",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#e5e7eb",
  },
  chipText: {
    color: "#e5e7eb",
    fontSize: normalizeSize(12),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: "center",
  },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  cardTitle: {
  color: "#fff",
  fontSize: normalizeSize(18),
  fontFamily: "Comfortaa_700Bold",
  marginBottom: 2,
},
cardMeta: {
  color: "rgba(255,255,255,0.75)",
  fontSize: normalizeSize(13),
  marginTop: 4,
},

  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
 primaryBtnText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: normalizeSize(13),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  secondaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: "#e5e7eb",
    fontWeight: "700",
    fontSize: normalizeSize(13),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: {
    color: "#e5e7eb",
   fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: I18nManager.isRTL ? "right" : "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: normalizeSize(13),
    textAlign: I18nManager.isRTL ? "right" : "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  loader: { padding: 24, alignItems: "center" },
});
