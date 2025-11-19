import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "@/constants/firebase-config";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

type Row = {
  id: string;
  username?: string;
  email?: string;
  activated?: boolean;
  createdAt?: any;
  activatedAt?: any;
};

const P = 16;

export default function ReferralHistory() {
  const { t } = useTranslation();
  const me = auth.currentUser?.uid;
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "activated" | "pending">("all");

  useEffect(() => {
    if (!me) return;
    setLoading(true);

    const baseQ = query(
      collection(db, "users"),
      where("referrerId", "==", me),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      baseQ,
      (snap) => {
        const list: Row[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            username: data?.username,
            email: data?.email,
            activated: !!data?.activated,
            createdAt: data?.createdAt,
            activatedAt: data?.activatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.log("[referral/history] error:", err?.message || err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [me]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "activated") return rows.filter((r) => r.activated);
    return rows.filter((r) => !r.activated);
  }, [rows, filter]);

  const countActivated = rows.filter((r) => r.activated).length;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>{t("referral.history.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      <Text style={styles.subtitle}>
        {t("referral.history.subtitle", { total: rows.length, activated: countActivated })}
      </Text>

      {/* Filtres */}
      <View style={styles.filters}>
        {(["all", "activated", "pending"] as const).map((f) => {
          const label =
            f === "all"
              ? t("referral.history.filters.all")
              : f === "activated"
              ? t("referral.history.filters.activated")
              : t("referral.history.filters.pending");
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>{t("referral.history.empty")}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const when = item.activated
              ? item.activatedAt?.toDate?.()
              : item.createdAt?.toDate?.();
            const whenTxt = when ? dayjs(when).format("DD MMM YYYY") : "—";

            const badgeBox = item.activated
              ? [styles.badgeBase, styles.badgeOk]
              : [styles.badgeBase, styles.badgePending];
            const badgeTxt = item.activated
              ? [styles.badgeTxtBase, styles.badgeTxtOk]
              : [styles.badgeTxtBase, styles.badgeTxtPending];

            const metaText = item.activated
              ? t("referral.history.activatedOn", { date: whenTxt })
              : t("referral.history.invitedOn", { date: whenTxt });

            return (
              <View style={[styles.row, item.activated && styles.rowActivated]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.username || item.email || item.id.slice(0, 6)}
                  </Text>
                  <Text style={styles.meta}>{metaText}</Text>
                </View>
                <View style={badgeBox}>
                  <Text style={badgeTxt}>
                    {item.activated
                      ? t("referral.history.status.activated")
                      : t("referral.history.status.pending")}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8E7", padding: P },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFE9A6", borderWidth: 1, borderColor: "#FFB800",
  },
  title: { fontSize: 20, fontWeight: "900", color: "#111" },
  subtitle: { fontSize: 13, color: "#333" },

  filters: { flexDirection: "row", marginTop: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#FFF1C9", borderWidth: 1, borderColor: "#FFB800",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#FFB800", borderColor: "#111" },
  chipTxt: { fontSize: 12, fontWeight: "800", color: "#7C5800" },
  chipTxtActive: { color: "#111" },

  empty: { marginTop: 16, color: "#333" },

  row: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: P,
    borderWidth: 2,
    borderColor: "#FFB800",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rowActivated: { backgroundColor: "#F0FDF4", borderColor: "#22C55E" },
  name: { fontSize: 16, fontWeight: "800", color: "#111" },
  meta: { fontSize: 12, color: "#555", marginTop: 2 },

  // badges
  badgeBase: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.2 },
  badgeOk: { borderColor: "#22C55E", backgroundColor: "#DCFCE7" },
  badgePending: { borderColor: "#7C5800", backgroundColor: "#FFF1C9" },
  badgeTxtBase: { fontSize: 12, fontWeight: "900" },
  badgeTxtOk: { color: "#14532D" },
  badgeTxtPending: { color: "#7C5800" },
});
