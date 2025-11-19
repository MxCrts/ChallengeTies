// app/admin/events.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";

// Util: clé jour UTC "YYYY-MM-DD"
const dayKeyUTC = (d: Date) => d.toISOString().slice(0, 10);

type EventRow = {
  id: string;
  name: string;
  createdAt: Date | null;
};

export default function AdminEventsScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ⚠️ Garde: seulement si connecté
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError("Tu dois être connecté (admin).");
          setLoading(false);
          return;
        }

        // Fenêtre: 7 derniers jours (UTC)
        const now = new Date();
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // On lit tous les events >= start, ordonnés par date
        const ref = collection(db, "appEvents");
        const q = query(
          ref,
          where("createdAt", ">=", Timestamp.fromDate(start)),
          orderBy("createdAt", "asc")
        );
        const snap = await getDocs(q);

        if (cancelled) return;

        const list: EventRow[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const ts = d?.createdAt;
          const jsDate =
            ts instanceof Timestamp
              ? ts.toDate()
              : typeof ts?.toDate === "function"
              ? ts.toDate()
              : null;

          list.push({
            id: docSnap.id,
            name: String(d?.name ?? "unknown"),
            createdAt: jsDate,
          });
        });

        setRows(list);
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Agrégation: { "YYYY-MM-DD": { app_open: 12, register_success: 2, ... } }
  const aggregated = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const k = r.createdAt ? dayKeyUTC(r.createdAt) : "unknown";
      if (!map[k]) map[k] = {};
      if (!map[k][r.name]) map[k][r.name] = 0;
      map[k][r.name] += 1;
    }
    // On trie par jour décroissant
    const days = Object.keys(map).sort((a, b) => (a < b ? 1 : -1));
    return { map, days };
  }, [rows]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Events (7 derniers jours)</Text>

      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>Erreur : {error}</Text>}

      {!loading && !error && aggregated.days.length === 0 && (
        <Text style={styles.empty}>Aucun event dans la fenêtre.</Text>
      )}

      {!loading &&
        !error &&
        aggregated.days.map((day) => {
          const perType = aggregated.map[day];
          const types = Object.keys(perType).sort();
          const total = types.reduce((sum, t) => sum + perType[t], 0);

          return (
            <View key={day} style={styles.card}>
              <Text style={styles.day}>
                {day} — <Text style={styles.total}>{total}</Text> events
              </Text>
              {types.map((t) => (
                <View key={t} style={styles.row}>
                  <Text style={styles.type}>{t}</Text>
                  <Text style={styles.count}>{perType[t]}</Text>
                </View>
              ))}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: "white", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  error: { color: "#fca5a5", marginBottom: 12 },
  empty: { color: "white", opacity: 0.8 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  day: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  total: { color: "#a78bfa" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  type: { color: "white", opacity: 0.9 },
  count: { color: "white", fontWeight: "700" },
});
