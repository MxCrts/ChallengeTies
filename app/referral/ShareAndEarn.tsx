// app/referral/ShareAndEarn.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Animated, Easing, Platform, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { auth, db } from "@/constants/firebase-config";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { buildAppLink, buildWebLink, getAppNameFallback } from "@/src/referral/links";
import { logEvent } from "@/src/analytics";
import { useFocusEffect } from "@react-navigation/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/constants/firebase-config";
import { useTranslation } from "react-i18next";
import { maybeAskForReview } from "@/src/services/reviewService";
import { tap, success, warning, error, soft } from "@/src/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "@/theme/designSystem";

const REWARDS: Record<number, number> = { 5: 20, 10: 60, 25: 200 };
const MILESTONES = [5, 10, 25];
const P = 16;

export default function ShareAndEarn() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const palette = isDark ? designSystem.darkTheme.colors : designSystem.lightTheme.colors;
  const { width } = useWindowDimensions();
  const me = auth.currentUser?.uid;
  const [activatedCount, setActivatedCount] = useState(0);
  const [claimed, setClaimed] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [rewardBanner, setRewardBanner] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const bannerY = React.useRef(new Animated.Value(-80)).current;
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; char: string }[]>([]);
  const confettiId = React.useRef(0);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  const appLink = useMemo(() => (me ? buildAppLink(me) : ""), [me]);
  const webLink = useMemo(() => (me ? buildWebLink(me) : ""), [me]);

  const fetchStats = React.useCallback(async () => {
    try {
       if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!me) return;

      const meRef = doc(db, "users", me);
      const meSnap = await getDoc(meRef);

      let serverCount: number | undefined;
      let serverClaimed: number[] = [];

      if (meSnap.exists()) {
        const data = meSnap.data() as any;
        serverCount = data?.referral?.activatedCount;
        serverClaimed = Array.isArray(data?.referral?.claimedMilestones)
          ? data.referral.claimedMilestones
          : [];
        setClaimed(serverClaimed);
      }

      if (typeof serverCount === "number") {
        setActivatedCount(serverCount);
        try { await logEvent("share_open" as any); } catch {}
        return;
      }

      // Fallback: comptage client
      const q = query(
        collection(db, "users"),
        where("referrerId", "==", me),
        where("activated", "==", true)
      );
      const snap = await getDocs(q);
      setActivatedCount(snap.size);
      try { await logEvent("share_open" as any); } catch {}
    } catch (e: any) {
      console.log("[share] load error:", e?.message ?? e);
      Alert.alert(t("referral.share.errors.title"), t("referral.share.errors.loadStats"));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [me, t]);

  const showRewardBanner = (amount: number) => {
    setRewardBanner({ visible: true, amount });
    Animated.timing(bannerY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      Animated.timing(bannerY, { toValue: -80, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        setRewardBanner({ visible: false, amount: 0 });
      });
    }, 2200);
  };

  const fireConfetti = () => {
    const chars = ["🎉","🎊","🏆","✨","💥","👏"];
    const batch: typeof confetti = Array.from({ length: 18 }).map(() => ({
      id: ++confettiId.current,
      x: Math.random() * Math.max(320, width - 40) + 20,
      y: -20 - Math.random() * 40,
      char: chars[Math.floor(Math.random() * chars.length)],
    }));
    setConfetti(batch);
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    confettiTimerRef.current = setTimeout(() => setConfetti([]), 1200);
  };

  const renderConfetti = () => {
    return confetti.map((c) => (
      <Animated.Text
        key={c.id}
        style={{
          position: "absolute",
          left: c.x,
          top: c.y,
          fontSize: 20 + Math.random() * 8,
          transform: [{
            translateY: bannerY.interpolate({
              inputRange: [-80, 0],
              outputRange: [0, 180 + Math.random() * 60],
            }),
          }],
        }}
      >
        {c.char}
      </Animated.Text>
    ));
  };

  const claimMilestone = React.useCallback(
    async (m: number) => {
      if (!me) return;
      try {
        const functions = getFunctions(app, "europe-west1");
        const callable = httpsCallable(functions, "claimReferralMilestone");
        await callable({ milestone: m });

        setLoading(true);
        await fetchStats();

        const amount = REWARDS[m] ?? 0;
        success();
        showRewardBanner(amount);
        fireConfetti();
        try { await maybeAskForReview(); } catch {}
        try { await logEvent("share_claim_success" as any, { milestone: m }); } catch {}
      } catch (e: any) {
        const msg =
          e?.message?.includes("already_claimed") ? t("referral.share.errors.alreadyClaimed")
          : e?.message?.includes("not_reached") ? t("referral.share.errors.notReached")
          : t("referral.share.errors.claimFailed");
        Alert.alert(t("referral.share.errors.oops"), msg);
        try { await logEvent("share_claim_error" as any, { milestone: m, error: String(e?.message || e) }); } catch {}
      }
    },
    [me, fetchStats, t]
  );

  useEffect(() => {
    fetchStats();
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, [fetchStats]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      fetchStats();
    }, [fetchStats])
  );

  const nextMilestone = React.useMemo(() => {
    for (const m of MILESTONES) if (activatedCount < m) return m;
    return null;
  }, [activatedCount]);

  const onCopy = async (text: string, kind: "app" | "web") => {
     tap();
    try {
      await Clipboard.setStringAsync(text);
      success();
      Alert.alert(t("referral.share.copiedTitle"), t("referral.share.copiedMsg"));
      try { await logEvent("share_link_copied", { kind }); } catch {}
    } catch {}
  };

  const onNativeShare = async () => {
    tap();
    try {
      const appName = getAppNameFallback();
      await Share.share({
        title: t("referral.share.nativeShare.title", { appName }),
        message: t("referral.share.nativeShare.message", { appName, appLink, webLink }),
      });
      success();
      try { await logEvent("share_native_opened"); } catch {}
    } catch (e: any) {
      if (e?.message) console.log("Share error:", e.message);
    }
  };

  // ===== UI helpers: Progress + LinkRow =====
  const Progress = ({ value, max }: { value: number; max: number }) => {
    const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
    return (
      <View style={styles.progressWrap} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}>
        <Animated.View style={[styles.progressBar, { width: `${pct * 100}%` }]} />
      </View>
    );
  };

  const LinkRow = React.memo(function LinkRow({
    label, value, onCopyPress
  }: { label: string; value: string; onCopyPress: () => void }) {
    return (
      <>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={onCopyPress} accessibilityLabel={label}>
            <Ionicons name="copy-outline" size={18} />
            <Text style={styles.copyTxt}>{t("referral.share.copy")}</Text>
          </TouchableOpacity>
        </View>
        <Text numberOfLines={2} selectable style={styles.link}>{value || "—"}</Text>
      </>
    );
  });

  // ===== Non-auth guard =====
  if (!me) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="lock-closed-outline" size={28} color="#111" />
        <Text style={[styles.title, { marginTop: 8 }]}>{t("referral.share.auth.title", { defaultValue: "Connexion requise" })}</Text>
        <Text style={styles.subtitle}>{t("referral.share.auth.subtitle", { defaultValue: "Connecte-toi pour accéder à Share & Earn." })}</Text>
        <TouchableOpacity onPress={() => router.replace("/login")} style={[styles.shareBtn, { marginTop: 16 }]}>
          <Ionicons name="log-in-outline" size={18} color="#111" />
          <Text style={styles.shareTxt}>{t("login", { defaultValue: "Se connecter" })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <View style={styles.container}>
      {rewardBanner.visible && (
        <Animated.View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            transform: [{ translateY: bannerY }],
            backgroundColor: "#111",
            borderColor: "#FFB800",
            borderWidth: 2,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 14,
            zIndex: 99,
          }}
        >
          <Text style={{ color: "#FFB800", fontWeight: "800", fontSize: 16 }}>
            {t("referral.share.banner.amount", { amount: rewardBanner.amount })}
          </Text>
          <Text style={{ color: "#fff", marginTop: 2 }}>
            {t("referral.share.banner.message")}
          </Text>
        </Animated.View>
      )}

      {/* Confettis emoji overlay */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {renderConfetti()}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("referral.share.title")}</Text>
        <Text style={styles.subtitle}>{t("referral.share.subtitle")}</Text>

      <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("referral.share.linksTitle")}</Text>
          <LinkRow label={t("referral.share.linkApp")} value={appLink} onCopyPress={() => onCopy(appLink, "app")} />
          <LinkRow label={t("referral.share.linkWeb")} value={webLink} onCopyPress={() => onCopy(webLink, "web")} />
          <TouchableOpacity style={styles.shareBtn} onPress={onNativeShare}>
            <Ionicons name="share-social-outline" size={18} color="#111" />
            <Text style={styles.shareTxt}>{t("referral.share.shareBtn")}</Text>
          </TouchableOpacity>
        </View>

      <View style={{ height: 8 }} />
        <TouchableOpacity
          onPress={() => router.push("/referral/ShareCard")}
          style={styles.cardCta}
          accessibilityLabel={t("referral.share.cardCta")}
          testID="open-share-card"
        >
          <Ionicons name="image-outline" size={18} color="#111" />
          <Text style={styles.cardCtaTxt}>{t("referral.share.cardCta")}</Text>
        </TouchableOpacity>

       <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("referral.share.statsTitle")}</Text>
          {loading ? (
            <View style={styles.skeletonRow} accessible accessibilityLabel={t("loading", { defaultValue: "Chargement" })}>
              <View style={styles.skeletonDot} />
              <View style={styles.skeletonBar} />
            </View>
          ) : (
            <Text style={styles.bigCount}>
              {activatedCount} <Text style={styles.small}>{t("referral.share.bigCountSuffix")}</Text>
            </Text>
          )}

        {!!nextMilestone && !loading && (
            <>
              <Progress value={activatedCount} max={nextMilestone} />
              <Text style={styles.tip}>
                {t("referral.share.tipNext", {
                  remaining: Math.max(0, nextMilestone - activatedCount),
                  milestone: nextMilestone,
                })}
              </Text>
            </>
          )}
          {!nextMilestone && !loading && (
            <Text style={styles.tip}>{t("referral.share.tipAllReached")}</Text>
          )}

          <View style={styles.milestones}>
            {MILESTONES.map((m) => {
              const reached = activatedCount >= m;
              const isClaimed = claimed.includes(m);
              return (
                <View
                  key={m}
                  style={[
                    styles.milestone,
                    reached && styles.milestoneReached,
                    isClaimed && { borderColor: "#22C55E", backgroundColor: "#DCFCE7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.milestoneTxt,
                      reached && styles.milestoneTxtReached,
                    ]}
                  >
                    {t("referral.share.milestoneLabel", { count: m })}
                    {isClaimed ? " ✅" : ""}
                  </Text>

                  {reached && !isClaimed && (
                    <TouchableOpacity
                      style={{
                        marginTop: 6,
                        alignSelf: "flex-start",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "#111",
                        backgroundColor: "#FFB800",
                      }}
                      onPress={() => claimMilestone(m)}
                      accessibilityRole="button"
                      accessibilityLabel={t("referral.share.claim")}
                    >
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {t("referral.share.claim")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      <TouchableOpacity
          onPress={() => router.push("/referral/History")}
          style={[styles.cardCta, { marginTop: 8 }]}
          accessibilityLabel={t("referral.share.historyCta")}
          testID="open-referral-history"
        >
          <Ionicons name="people-outline" size={18} color="#111" />
          <Text style={styles.cardCtaTxt}>{t("referral.share.historyCta")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8E7" },
  scrollContent: {
    padding: P,
    paddingBottom: P * 4,
    rowGap: P,
    paddingTop: P
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8E7",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#111" },
  subtitle: { fontSize: 14, color: "#333" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: P,
    borderWidth: 2,
    borderColor: "#FFB800",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    rowGap: 8
  },
  cardCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF1C9",
    borderWidth: 1,
    borderColor: "#FFB800",
  },
  cardCtaTxt: { fontWeight: "800", color: "#111" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, color: "#333" },
 link: { fontSize: 12, color: "#111", opacity: 0.9, marginTop: 2 },
  copyBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: "#FFE9A6", borderWidth: 1, borderColor: "#FFB800",
  },
  copyTxt: { color: "#111", fontWeight: "600" },
  shareBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFB800", borderColor: "#111", borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
  },
  shareTxt: { color: "#111", fontWeight: "700" },
  bigCount: { fontSize: 28, fontWeight: "800", color: "#111", marginTop: 4 },
  small: { fontSize: 14, fontWeight: "600", color: "#333" },
  tip: { fontSize: 13, color: "#333", marginTop: 4 },
  bold: { fontWeight: "800", color: "#111" },
  milestones: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  milestone: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: "#FFB800",
    backgroundColor: "#FFF1C9",
  },
  milestoneReached: { backgroundColor: "#D9F99D", borderColor: "#65A30D" },
  milestoneTxt: { fontSize: 12, color: "#7C5800", fontWeight: "700" },
  milestoneTxtReached: { color: "#2D5900" },
  // Skeleton + Progress
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4
  },
  skeletonDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#EEE2B7" },
  skeletonBar: { flex: 1, height: 12, borderRadius: 6, backgroundColor: "#F5E4B5" },
  progressWrap: {
    height: 10,
    backgroundColor: "#FFF1C9",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FFB800",
    marginTop: 8
  },
  progressBar: { height: "100%", backgroundColor: "#FFB800" }
});
