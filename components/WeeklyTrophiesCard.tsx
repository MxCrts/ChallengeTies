// components/WeeklyTrophiesCard.tsx
import React, { useEffect, useMemo, useState, useCallback  } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  UIManager,
  LayoutAnimation,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { auth, db } from "../constants/firebase-config";
import { doc, onSnapshot } from "firebase/firestore";
import type { DimensionValue } from "react-native";
import { useTrophiesEconomy } from "../hooks/useTrophiesEconomy";
import { Ionicons } from "@expo/vector-icons";
import { DeviceEventEmitter } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useMicroWeek } from "../hooks/useMicroWeek";

type UserSnapshot = {
  trophies?: number;
  longestStreak?: number;
};

const CARD_RADIUS = 18;

type Props = {
  /** start in compact mode (tap to expand) */
  defaultExpanded?: boolean;
};

export default function WeeklyTrophiesCard({ defaultExpanded = false }: Props) {
  const { t } = useTranslation();
  const { TROPHY } = useTrophiesEconomy();
  const { used: weekUsed } = useMicroWeek();

  const [userData, setUserData] = useState<UserSnapshot>({});
  const [expanded, setExpanded] = useState<boolean>(!!defaultExpanded);

  const cap = TROPHY.MICRO_WEEKLY_CAP;
  const remain = Math.max(0, cap - weekUsed);

  // enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
 }, []);

  // Chargement user (trophies, longestStreak)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() || {};
      setUserData({
        trophies: Number(d?.trophies || 0),
        longestStreak: Number(d?.longestStreak || 0),
      });
    });
    return () => unsub();
  }, []);

  const pct = useMemo(() => {
    if (cap <= 0) return 0;
    return Math.min(1, Math.max(0, weekUsed / cap));
  }, [weekUsed, cap]);

  const progressWidth: DimensionValue = `${Math.round(pct * 100)}%`;


const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const CompactSummary = () => (
    <>
      {/* progress + quick KPIs */}
      <View style={[styles.progressWrap, styles.compactSpacing]}>
        <View style={styles.progressBgMini}>
          <View style={[styles.progressFgMini, { width: progressWidth }]} />
        </View>
        <View style={styles.progressLegend}>
          <Text style={styles.legendText}>
            {t("economy.used", { used: weekUsed, cap })}
          </Text>
          <Text style={styles.legendText}>
            {t("economy.remaining", { remain })}
          </Text>
        </View>
      </View>
    </>
  );

  const ExpandedDetails = () => (
    <>
      <Text style={styles.subtitle}>{t("economy.weeklySubtitle")}</Text>
      <View style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFg, { width: progressWidth }]} />
        </View>
        <View style={styles.progressLegend}>
          <Text style={styles.legendText}>
            {t("economy.used", { used: weekUsed, cap })}
          </Text>
          <Text style={styles.legendText}>
            {t("economy.remaining", { remain })}
          </Text>
        </View>
      </View>

      {remain <= 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t("economy.capReached")}</Text>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>{t("economy.dailyHint")}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.bonusTitle}>{t("economy.streakBonusesTitle")}</Text>
      <View style={styles.bonusGrid}>
        {[3, 7, 14, 21, 30].map((at) => (
          <View key={at} style={styles.bonusItem}>
            <Text style={styles.bonusAt}>{t("economy.streakAt", { at })}</Text>
            <Text style={styles.bonusValue}>
              {t("economy.bonus", { bonus: bonusValue(at) })}
            </Text>
          </View>
        ))}
      </View>

      {!!userData.longestStreak && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>
            {t("economy.pb", { days: userData.longestStreak })}
          </Text>
        </View>
      )}
      </>
  );

  return (
    <LinearGradient
      colors={["#0F1020", "#151736"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, !expanded && styles.cardCompact]}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("economy.weeklyTitle")}
        accessibilityHint={expanded ? t("collapse") : t("expand")}
        // @ts-ignore (React Native prop)
        aria-expanded={expanded}
        style={styles.headerRow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.title}>{t("economy.weeklyTitle")}</Text>
        <View style={styles.headerRight}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {t("economy.total", { count: userData.trophies ?? 0 })}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#fff"
            style={{ marginLeft: 8, opacity: 0.9 }}
          />
        </View>
      </TouchableOpacity>

      {expanded ? <ExpandedDetails /> : <CompactSummary />}
    </LinearGradient>
  );
}

function bonusValue(at: number) {
  switch (at) {
    case 3: return 1;
    case 7: return 3;
    case 14: return 6;
    case 21: return 10;
    case 30: return 20;
    default: return 0;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    padding: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardCompact: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  pillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  progressWrap: {
    marginTop: 12,
  },
  compactSpacing: { marginTop: 8 },
  progressBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#4ED1A1",
  },
  progressBgMini: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFgMini: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#4ED1A1",
  },
  progressLegend: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11.5,
  },
  notice: {
    marginTop: 10,
    backgroundColor: "rgba(255, 87, 87, 0.15)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  noticeText: {
    color: "#FFB3B3",
    fontSize: 12,
    fontWeight: "600",
  },
  hintRow: {
    marginTop: 10,
  },
  hintText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 12,
  },
  bonusTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 10,
  },
  bonusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bonusItem: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  bonusAt: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 11.5,
    fontWeight: "700",
  },
  bonusValue: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11.5,
    marginTop: 2,
  },
  streakRow: {
    marginTop: 12,
  },
  streakText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
});
