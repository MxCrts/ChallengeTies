import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
  I18nManager,
} from "react-native";
import {
   collection,
   onSnapshot,
   updateDoc,
   doc,
   getDoc,
   addDoc,
   increment,
   setDoc,
   runTransaction,
 } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import ModalExplicatif from "../components/ModalExplicatif";
import FeatureDetailModal from "../components/FeatureDetailModal";
import ProposeFeatureModal from "../components/ProposeFeatureModal";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import * as Haptics from "expo-haptics";
import { useShareCard } from "@/hooks/useShareCard";
import { FeatureShareCard } from "@/components/ShareCards";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { incStat } from "@/src/services/metricsService";
import { useToast } from "@/src/ui/Toast";

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const withAlpha = (color: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};

interface CountdownValues {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

interface Feature {
  id: string;
  title: string;
  votes: number;
  approved?: boolean;
  description?: string;
  username?: string;
}

interface User {
  uid: string;
  username?: string;
  votedFor?: string;
  [key: string]: any;
}

export default function NewFeatures() {
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownValues>({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });

// Pull-to-Refresh (le flux est realtime via onSnapshot, ici on gère juste l'UI)
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const tid = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(tid);
  }, []);

  const npa = (globalThis as any).__NPA__ === true;
  const [user, setUser] = useState<User | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showFeatureDetailModal, setShowFeatureDetailModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const insets = useSafeAreaInsets();
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // ↓↓↓ DANS le composant NewFeatures
  const { showInterstitials } = useAdsVisibility();

  // === ShareCard: feature ===
  const { ref: featureShareRef, share: shareFeatureCard } = useShareCard();
  const [featureSharePayload, setFeatureSharePayload] = useState<{
    id: string;
    title: string;
    votes: number;
    username?: string;
    deepLink?: string;
  } | null>(null);

  const interstitialAdUnitId = __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({
        ios: "ca-app-pub-4725616526467159/3625641580",
        android: "ca-app-pub-4725616526467159/1602005670",
      })!;

  const interstitialRef = React.useRef<InterstitialAd | null>(null);

  // Gestion du cooldown des pubs
  const checkAdCooldown = useCallback(async () => {
    const lastAdTime = await AsyncStorage.getItem("lastInterstitialTime");
    if (!lastAdTime) return true;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000;
    return now - parseInt(lastAdTime) > cooldownMs;
  }, []);

  const markAdShown = useCallback(async () => {
    await AsyncStorage.setItem("lastInterstitialTime", Date.now().toString());
  }, []);

  // Gestion des pubs
  useEffect(() => {
    if (!showInterstitials) {
      interstitialRef.current = null;
      setAdLoaded(false);
      return;
    }

    const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  requestNonPersonalizedAdsOnly: npa,
});

    interstitialRef.current = ad;

    const loadedSub = ad.addAdEventListener(AdEventType.LOADED, () => {
      setAdLoaded(true);
    });
    const errorSub = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error("Erreur interstitiel:", error);
      setAdLoaded(false);
    });
    const closedSub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      try {
        ad.load();
      } catch {}
    });

    try {
      ad.load();
    } catch {}

    return () => {
      loadedSub();
      errorSub();
      closedSub();
      interstitialRef.current = null;
      setAdLoaded(false);
    };
  }, [showInterstitials, interstitialAdUnitId]);

  // Authentification
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const snapshot = await getDoc(userDocRef);
          const userData = snapshot.exists()
            ? { ...snapshot.data(), uid: firebaseUser.uid }
            : { uid: firebaseUser.uid };
          setUser(userData as User);
          setUserVote(
            snapshot.exists() ? snapshot.data().votedFor || null : null
          );
        } catch (error) {
          console.error("Erreur récupération utilisateur:", error);
        }
      } else {
        setUser(null);
        setUserVote(null);
      }
    });
    return unsubscribeAuth;
  }, []);

  // Modal explicatif (une fois)
  useEffect(() => {
    const checkModalShown = async () => {
      const value = await AsyncStorage.getItem("explanationModalShown");
      if (!value) {
        setShowExplanationModal(true);
        await AsyncStorage.setItem("explanationModalShown", "true");
      }
    };
    checkModalShown();
  }, []);

  // Chargement des fonctionnalités
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    const featuresRef = collection(db, "polls", "new-features", "features");
    const unsubscribe = onSnapshot(
      featuresRef,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Feature, "id">),
        }));
        setFeatures(
          data
            .filter((feature) => feature.approved)
            .sort((a, b) => b.votes - a.votes)
        );
        setLoading(false);
      },
      (error) => {
        console.error("Erreur snapshot:", error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user?.uid]);

 // ⏱️ Compte à rebours basé sur i18n.deadlineIso + progression du mois
  useEffect(() => {
    const targetDate = new Date("2025-12-31T23:59:59Z");
    const updateTimer = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      setCountdown({
       days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Footer countdown (ancien rendu)
  const renderCountdown = useCallback(
    () => (
      <Animated.View entering={FadeInUp} style={styles.countdownContainer}>
        <LinearGradient
          colors={[
            withAlpha(currentTheme.colors.secondary, 1),
            withAlpha(currentTheme.colors.primary, 1),
          ]}
          style={styles.countdownGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {(["days", "hours", "mins", "secs"] as const).map((unit, index) => (
            <Animated.View key={unit} entering={FadeInUp.delay(index * 120)} style={styles.countdownBox}>
              <Text style={[styles.countdownNumber, { color: currentTheme.colors.textPrimary }]}>
                {countdown[unit]}
              </Text>
              <Text
  style={[
    styles.countdownLabel,
    { color: currentTheme.colors.textPrimary },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: "center",
    },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {t(`newFeatures.countdown.${unit}`)}
</Text>

            </Animated.View>
          ))}
        </LinearGradient>
      </Animated.View>
    ),
    [countdown, t, currentTheme]
  );

  // Vote
  const handleVote = useCallback(
    async (featureId: string) => {
      if (!user?.uid) {
        show(t("newFeatures.loginRequiredMessage"), "warning");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
        return;
      }
      if (userVote) {
        show(t("newFeatures.alreadyVotedMessage"), "info");
        try { Haptics.selectionAsync(); } catch {}
        return;
      }
      try {
        const featureRef = doc(db, "polls", "new-features", "features", featureId);
        const userRef = doc(db, "users", user.uid);

        // 🚧 Transaction atomique : n'incrémente que si l'user n'a pas encore voté
        await runTransaction(db, async (tx) => {
          const userSnap = await tx.get(userRef);
          const already = userSnap.exists() ? userSnap.data()?.votedFor : null;
          if (already) {
            throw new Error("already_voted");
          }
          tx.update(featureRef, { votes: increment(1) });
          tx.update(userRef, { votedFor: featureId });
        });
        // 3) ✅ SUCCESS COUNTER normalisé pour achievements: stats.voteFeature.total
        try { await incStat(user.uid, "voteFeature.total", 1); } catch {}
        setUserVote(featureId);
        try { await checkForAchievements(user.uid); } catch {}

        const canShowAd = await checkAdCooldown();
        if (showInterstitials && canShowAd && adLoaded && interstitialRef.current) {
          try {
            await interstitialRef.current.show();
            await markAdShown();
          } catch (e) {
            console.warn("Interstitial show error:", (e as any)?.message ?? e);
          }
          setAdLoaded(false);
          try {
            interstitialRef.current.load();
          } catch {}
        }

        show(t("newFeatures.voteRegisteredMessage"), "success");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      } catch (error) {
        if (error?.message === "already_voted") {
          // cas rare : double-tap / multi-device → UI cohérente
          setUserVote((prev) => prev ?? featureId);
          show(t("newFeatures.alreadyVotedMessage"), "info");
          try { Haptics.selectionAsync(); } catch {}
          return;
        }
        console.error("Erreur lors du vote:", error);
        show(t("newFeatures.voteErrorMessage"), "error");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      }
    },
    [user, userVote, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials, show]
  );

  // Proposition de fonctionnalité
  const handleProposeFeature = useCallback(
    
    async (title: string, description?: string) => {
      if (!user?.uid) {
        show(t("newFeatures.loginRequiredMessage"), "warning");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
        return;
      }
      if (userVote) {
        show(t("newFeatures.alreadyVotedMessage"), "info");
        try { Haptics.selectionAsync(); } catch {}
        return;
      }
      try {
        const featureRef = await addDoc(
          collection(db, "polls", "new-features", "features"),
          {
            title,
            description: description || "",
            votes: 1,
            approved: false,
            username: user.username || t("newFeatures.unknown"),
          }
        );
        // 1) marque le choix utilisateur (idempotent)
        await setDoc(
          doc(db, "users", user.uid),
          { votedFor: featureRef.id },
          { merge: true }
        );
        // 2) ✅ SUCCESS COUNTER normalisé pour achievements: stats.voteFeature.total
        try { await incStat(user.uid, "voteFeature.total", 1); } catch {}
        setUserVote(featureRef.id);
        try { await checkForAchievements(user.uid); } catch {}

        const canShowAd = await checkAdCooldown();
        if (showInterstitials && canShowAd && adLoaded && interstitialRef.current) {
          await interstitialRef.current.show();
          await markAdShown();
          setAdLoaded(false);
          interstitialRef.current.load();
        }

        show(t("newFeatures.proposalSentMessage"), "success");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      } catch (error) {
        console.error("Erreur lors de la proposition:", error);
        show(t("newFeatures.proposalErrorMessage"), "error");
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      }
    },
    [user, userVote, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials, show]
  );

  // Partage de fonctionnalité
  const handleShareFeature = useCallback(
    async (feature: Feature) => {
      try {
        try { await Haptics.selectionAsync(); } catch {}
        // 1) Prépare la payload → on va rendre la carte cachée
        //    ❌ plus d’URL; ✅ début de la description
        const rawDesc = feature.description?.toString?.() || "";
        const trimmed = rawDesc.replace(/\s+/g, " ").trim();
        const snippet = trimmed.length > 140 ? trimmed.slice(0, 140) + "…" : trimmed;

        // Ligne meta traduite: "X votes • par Y" (si dispo)
        const metaParts: string[] = [
          t("newFeatures.votes", { count: feature.votes ?? 0 }),
        ];
        if (feature.username) {
          metaParts.push(`${t("newFeatures.by")} ${feature.username}`);
        }
        const metaLine = metaParts.join(" • ");
        setFeatureSharePayload({
          id: feature.id,
          title: feature.title,
          votes: feature.votes ?? 0,
          username: feature.username,
        });
        // 2) Laisse React peindre la vue invisible
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        // 3) Capture + partage via le hook (image PNG)
        await shareFeatureCard(
          `ct-feature-${feature.id}-${Date.now()}.png`,
          t("newFeatures.shareDialogTitle", { defaultValue: "Partager cette nouveauté" })
        );
        // ✅ SUCCESS COUNTER pour achievements: stats.shareChallenge.total
        const uid = auth.currentUser?.uid;
        if (uid) {
          try { await incStat(uid, "shareChallenge.total", 1); } catch {}
          try { await checkForAchievements(uid); } catch {}
        }
      } catch (error) {
        console.error("Erreur partage:", error);
      } finally {
        // 4) Nettoyage
        setFeatureSharePayload(null);
      }
    },
     [t, shareFeatureCard]
  );

  // Feature Item (UI only)
  const FeatureItem = useMemo(
    () =>
      React.memo(({ item, index }: { item: Feature; index: number }) => (
        <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.featureCard}>
          <TouchableOpacity
            onPress={() => {
              setSelectedFeature(item);
              setShowFeatureDetailModal(true);
            }}
            accessibilityLabel={t("newFeatures.featureDetails", { title: item.title })}
            accessibilityHint={t("newFeatures.featureDetailsHint")}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedFeature?.id === item.id }}
            testID={`feature-card-${item.id}`}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? [withAlpha(currentTheme.colors.cardBackground, 0.85), withAlpha("#333333", 0.85)]
                  : [withAlpha("#FFFFFF", 0.95), withAlpha("#F5F5F5", 0.95)]
              }
              style={styles.featureGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.featureHeaderRow}>
                <Text
  style={[
    styles.featureTitle,
    { color: isDarkMode ? currentTheme.colors.textPrimary : "#000000" },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
  numberOfLines={2}
  adjustsFontSizeToFit
  minimumFontScale={0.9}   // ✅ ne descend jamais en dessous de 90% de la taille
>
  {item.title}
</Text>


                <View style={styles.votesPill}>
                  <Ionicons
                    name="heart-outline"
                    size={normalizeSize(14)}
                    color={isDarkMode ? currentTheme.colors.secondary : currentTheme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.votesPillText,
                      {
                        color: isDarkMode
                          ? currentTheme.colors.secondary
                          : currentTheme.colors.primary,
                      },
                    ]}
                  >
                    {item.votes}
                  </Text>
                </View>
              </View>

              {item.username && (
              <Text
    style={[
      styles.featureUsername,
      { color: isDarkMode ? "#A0A0A0" : currentTheme.colors.textSecondary },
      {
        writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
        textAlign: I18nManager.isRTL ? "right" : "left",
      },
    ]}
    numberOfLines={1}
    adjustsFontSizeToFit
  >
    {t("newFeatures.by")} {item.username}
  </Text>
              )}

              {item.description && (
                <Text
    style={[
      styles.featureDescription,
      { color: currentTheme.colors.textSecondary },
      {
        writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
        textAlign: I18nManager.isRTL ? "right" : "left",
      },
    ]}
    numberOfLines={SCREEN_WIDTH > 600 ? 4 : 2}
    ellipsizeMode="tail"    // ✅ on coupe proprement à la fin
  >
    {item.description}
  </Text>

              )}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (!userVote) handleVote(item.id);
                  }}
                  disabled={!!userVote}
                  style={[
                    styles.voteBtn,
                    {
                      backgroundColor: userVote
                        ? withAlpha("#000", 0.25)
                        : currentTheme.colors.primary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!userVote }}
                  accessibilityLabel={
                    userVote
                      ? t("newFeatures.alreadyVotedTitle")
                      : t("newFeatures.vote", { defaultValue: "Voter" })
                  }
                >
                  <Text
                    style={[
                      styles.voteBtnText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {userVote
                      ? t("newFeatures.alreadyVotedShort", { defaultValue: "Déjà voté" })
                      : t("newFeatures.vote", { defaultValue: "Voter" })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleShareFeature(item)}
                  style={styles.shareBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("newFeatures.shareFeature", { defaultValue: "Partager la fonctionnalité" })}
                >
                  <Ionicons name="share-social-outline" size={normalizeSize(16)} color={isDarkMode ? "#fff" : "#111"} />
                  <Text style={[styles.shareBtnText, { color: isDarkMode ? "#fff" : "#111" }]}>
                    {t("newFeatures.share", { defaultValue: "Partager" })}
                  </Text>
                </TouchableOpacity>
              </View>

            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )),
   [t, currentTheme, selectedFeature, isDarkMode, userVote, handleShareFeature, handleVote]
  );

  // Métadonnées (inchangé)
  const metadata = useMemo(
    () => ({
      title: t("newFeatures.title"),
      description: t("newFeatures.description"),
      url: `https://challengeme.com/${i18n.language}/features`,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: features.map((feature, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: feature.title,
          description: feature.description || "",
        })),
      },
    }),
   [t, features, i18n]
  );

  // Libellé du mois (fallback sûr si la clé n'est pas encore traduite)
  const monthLabel = useMemo(
    () => t("newFeatures.monthLabel", { defaultValue: "Mise à jour • Décembre" }),
    [t]
  );
 
  const createStyles = (isDarkMode: boolean) =>
    StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: "transparent",
        paddingTop:
          Platform.OS === "ios" ? insets.top : StatusBar.currentHeight ?? 0,
      },
      gradientContainer: {
        flex: 1,
        backgroundColor: "transparent",
      },

      /** HERO HEADER (premium) */
      heroHeader: {
        marginHorizontal: SPACING,
        marginTop: Math.max(SPACING - 4, 8),
        borderRadius: normalizeSize(22),
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#fff", isDarkMode ? 0.08 : 0.25),
      },
      heroGradient: {
        paddingVertical: normalizeSize(18),
        paddingHorizontal: normalizeSize(16),
      },
      monthPill: {
        alignSelf: "flex-start",
        paddingVertical: normalizeSize(6),
        paddingHorizontal: normalizeSize(12),
        borderRadius: 999,
        backgroundColor: withAlpha("#000", 0.25),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#fff", 0.18),
        marginBottom: normalizeSize(10),
      },
      monthPillText: {
        fontSize: normalizeSize(12),
        fontFamily: "Comfortaa_700Bold",
        color: "#fff",
        letterSpacing: 0.3,
      },
      heroTitle: {
        fontSize: normalizeSize(20),
        fontFamily: "Comfortaa_700Bold",
        color: "#fff",
        marginBottom: normalizeSize(6),
        textAlign: "left",
      },
      heroSubtitle: {
        fontSize: normalizeSize(13),
        fontFamily: "Comfortaa_400Regular",
        color: withAlpha("#fff", 0.9),
      },

      /** Orbes décoratives (arrière-plan) */
      bgOrbTop: {
        position: "absolute",
        top: -SCREEN_WIDTH * 0.25,
        left: -SCREEN_WIDTH * 0.2,
        width: SCREEN_WIDTH * 0.9,
        height: SCREEN_WIDTH * 0.9,
        borderRadius: SCREEN_WIDTH * 0.45,
      },
      bgOrbBottom: {
        position: "absolute",
        bottom: -SCREEN_WIDTH * 0.3,
        right: -SCREEN_WIDTH * 0.25,
        width: SCREEN_WIDTH * 1.1,
        height: SCREEN_WIDTH * 1.1,
        borderRadius: SCREEN_WIDTH * 0.55,
      },

      contentWrapper: {
        flex: 1,
        paddingHorizontal: normalizeSize(15),
        paddingBottom: normalizeSize(40),
        backgroundColor: "transparent",
      },

      description: {
        fontSize: normalizeSize(16),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        marginVertical: normalizeSize(18),
        lineHeight: normalizeSize(24),
      },

      featuresWindow: {
        flex: 1,
        marginTop: normalizeSize(1),
        marginBottom: normalizeSize(1),
        borderRadius: normalizeSize(25),
        overflow: "hidden",
        backgroundColor: isDarkMode ? "transparent" : withAlpha("#fff", 0.08),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#fff", isDarkMode ? 0.12 : 0.18),
      },
      featuresContent: {
        paddingVertical: normalizeSize(16),
        paddingHorizontal: normalizeSize(10),
        backgroundColor: "transparent",
      },

      featureCard: {
        marginVertical: normalizeSize(10),
        borderRadius: normalizeSize(25),
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: normalizeSize(4) },
        shadowOpacity: isDarkMode ? 0.25 : 0.15,
        shadowRadius: normalizeSize(6),
        elevation: 5,
        borderWidth: 1,
        borderColor: withAlpha("#fff", 0.12),
      },
      featureGradient: {
        padding: normalizeSize(16),
        borderRadius: normalizeSize(25),
        borderWidth: normalizeSize(2),
        borderColor: isDarkMode ? withAlpha("#FFDD95", 0.7) : withAlpha("#FF6200", 0.7),
      },
      featureHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: normalizeSize(6),
      },
      votesPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: withAlpha("#000", 0.1),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#fff", 0.12),
      },
      votesPillText: {
        fontSize: normalizeSize(12),
        fontFamily: "Comfortaa_700Bold",
      },
      featureTitle: {
        flex: 1,
        fontSize: normalizeSize(18),
        fontFamily: "Comfortaa_700Bold",
        marginRight: normalizeSize(10),
      },
      featureUsername: {
        fontSize: normalizeSize(12),
        fontFamily: "Comfortaa_400Regular",
        marginBottom: normalizeSize(8),
        textAlign: "left",
      },
      featureDescription: {
        fontSize: normalizeSize(13),
        fontFamily: "Comfortaa_400Regular",
        lineHeight: normalizeSize(20),
        textAlign: "left",
      },
      bottomContainer: {
        alignItems: "center",
        paddingVertical: normalizeSize(5),
        marginTop: normalizeSize(1),
      },
      countdownContainer: {
        width: "100%",
        marginBottom: normalizeSize(16),
      },
      countdownGradient: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: normalizeSize(16),
        borderRadius: normalizeSize(18),
        // fond légèrement translucide pour un look “verre” propre en clair/sombre
        backgroundColor: withAlpha("#fff", isDarkMode ? 0.08 : 0.95),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#000", isDarkMode ? 0.15 : 0.08),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: normalizeSize(3) },
        shadowOpacity: isDarkMode ? 0.25 : 0.12,
        shadowRadius: normalizeSize(5),
        elevation: 3,
      },
      countdownBox: {
        alignItems: "center",
        flex: 1,
        marginHorizontal: normalizeSize(4),
      },
      countdownNumber: {
        fontSize: normalizeSize(20),
        fontFamily: "Comfortaa_700Bold",
      },
      countdownLabel: {
        fontSize: normalizeSize(10),
        fontFamily: "Comfortaa_400Regular",
      },

      proposeButton: {
        paddingVertical: normalizeSize(10),
        paddingHorizontal: normalizeSize(16),
        borderRadius: normalizeSize(14),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: normalizeSize(3) },
        shadowOpacity: 0.3,
        shadowRadius: normalizeSize(5),
        elevation: 5,
      },
      proposeButtonText: {
        fontSize: normalizeSize(12),
        fontFamily: "Comfortaa_700Bold",
      },
      thankYouText: {
        fontSize: normalizeSize(14),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        marginVertical: normalizeSize(12),
      },

      loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      },
      loadingText: {
        marginTop: normalizeSize(15),
        fontSize: normalizeSize(16),
        fontFamily: "Comfortaa_400Regular",
      },
      noFeaturesText: {
        fontSize: normalizeSize(14),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        padding: normalizeSize(15),
      },
      /** Actions inline dans la carte */
      cardActionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: normalizeSize(12),
      },
      voteBtn: {
        paddingVertical: normalizeSize(10),
        paddingHorizontal: normalizeSize(16),
        borderRadius: normalizeSize(999),
      },
      voteBtnText: {
        fontSize: normalizeSize(13),
        fontFamily: "Comfortaa_700Bold",
      },
      shareBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: normalizeSize(8),
        paddingHorizontal: normalizeSize(12),
        borderRadius: normalizeSize(999),
        backgroundColor: withAlpha("#fff", isDarkMode ? 0.12 : 0.9),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha("#000", 0.08),
      },
      shareBtnText: {
        marginLeft: 6,
        fontSize: normalizeSize(12),
        fontFamily: "Comfortaa_700Bold",
      },
    });

  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode, insets]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[
            withAlpha(currentTheme.colors.background, 1),
            withAlpha(currentTheme.colors.cardBackground, 1),
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.secondary} />
          <Text
  style={[
    styles.loadingText,
    { color: currentTheme.colors.textPrimary },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: "center",
    },
  ]}
  numberOfLines={2}
  adjustsFontSizeToFit
>
  {t("newFeatures.loading")}
</Text>

        </LinearGradient>        
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={[
        withAlpha(currentTheme.colors.background, 1),
        withAlpha(currentTheme.colors.cardBackground, 1),
        withAlpha(currentTheme.colors.primary, 0.13),
      ]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Orbes premium en arrière-plan */}
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(currentTheme.colors.primary, 0.28), "transparent"]}
        style={styles.bgOrbTop}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(currentTheme.colors.secondary, 0.25), "transparent"]}
        style={styles.bgOrbBottom}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />

        <CustomHeader
          title={t("newFeatures.title")}
          rightIcon={
            <TouchableOpacity
              onPress={() => setShowExplanationModal(true)}
              accessibilityLabel={t("newFeatures.openExplanation")}
              accessibilityHint={t("newFeatures.openExplanationHint")}
            >
              <Ionicons
                name="help-circle-outline"
                size={normalizeSize(26)}
                color={currentTheme.colors.secondary}
              />
            </TouchableOpacity>
          }
        />

        {/* HERO SEPTEMBRE */}
        <View style={styles.heroHeader}>
          <LinearGradient
            colors={[
              withAlpha(currentTheme.colors.secondary, 0.9),
              withAlpha(currentTheme.colors.primary, 0.9),
            ]}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.monthPill}>
              <Text
  style={[
    styles.monthPillText,
    { writingDirection: I18nManager.isRTL ? "rtl" : "ltr" },
  ]}
  numberOfLines={1}
  adjustsFontSizeToFit
>
  {monthLabel}
</Text>

            </View>
            <Text
  style={[
    styles.heroTitle,
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
  numberOfLines={2}
  adjustsFontSizeToFit
>
  {t("newFeatures.heroTitleSep", {
    defaultValue: "Vote les nouveautés qui arrivent fin décembre 🚀",
  })}
</Text>

           <Text
  style={[
    styles.heroSubtitle,
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: I18nManager.isRTL ? "right" : "left",
    },
  ]}
  numberOfLines={3}
  adjustsFontSizeToFit
>
  {t("newFeatures.heroSubtitleNov", {
    defaultValue: "Ta voix compte : propose, vote et suis l’évolution des features.",
  })}
</Text>

          </LinearGradient>
        </View>

        <View style={styles.contentWrapper}>


          <View
            style={[
              styles.featuresWindow,
              { backgroundColor: withAlpha(currentTheme.colors.cardBackground, 0.8) },
            ]}
          >
            {features.length > 0 ? (
              <FlatList
                data={features}
                renderItem={({ item, index }) => <FeatureItem item={item} index={index} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.featuresContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
               keyboardShouldPersistTaps="handled"
               scrollEventThrottle={16}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={7}
                getItemLayout={(_, index) => ({
                  length: normalizeSize(130),
                  offset: normalizeSize(130) * index,
                  index,
                })}
                contentInset={{ top: SPACING, bottom: normalizeSize(40) }}
                accessibilityRole="list"
                accessibilityLabel={t("newFeatures.featuresListLabel")}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={currentTheme.colors.secondary}
                    colors={[currentTheme.colors.secondary]}
                    progressViewOffset={SPACING}
                  />
                }
              />
            ) : (
              <View style={{ alignItems: "center", paddingVertical: normalizeSize(20) }}>
                <Text
  style={[
    styles.noFeaturesText,
    { color: currentTheme.colors.textSecondary },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: "center",
    },
  ]}
  numberOfLines={3}
  adjustsFontSizeToFit
>
  {t("newFeatures.noFeatures")}
</Text>

                <TouchableOpacity
                  style={[styles.proposeButton, { backgroundColor: currentTheme.colors.primary, marginTop: normalizeSize(6) }]}
                  onPress={() => setShowProposeModal(true)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.proposeButtonText, { color: currentTheme.colors.textPrimary }]}>
                    {t("newFeatures.proposeIdea")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        {/* —— Footer ANCIEN : countdown + message/bouton —— */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.bottomContainer}>
            {renderCountdown()}
            {userVote ? (
              <Text
  style={[
    styles.thankYouText,
    { color: currentTheme.colors.textSecondary },
    {
      writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
      textAlign: "center",
    },
  ]}
  numberOfLines={3}
  adjustsFontSizeToFit
>
  {t("newFeatures.thankYouForVote", {
    featureTitle: features.find((f) => f.id === userVote)?.title || "???",
  })}
</Text>

            ) : (
              <Animated.View entering={ZoomIn.delay(500)}>
                <TouchableOpacity
                  style={[styles.proposeButton, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={() => setShowProposeModal(true)}
                  accessibilityLabel={t("newFeatures.proposeIdea")}
                  accessibilityHint={t("newFeatures.proposeIdeaHint")}
                  accessibilityRole="button"
                  testID="propose-button"
                  activeOpacity={0.85}
                >
                  <Text style={[styles.proposeButtonText, { color: currentTheme.colors.textPrimary }]}>
                    {t("newFeatures.proposeIdea")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        </View>

        {showExplanationModal && (
          <ModalExplicatif onClose={() => setShowExplanationModal(false)} />
        )}
        {showFeatureDetailModal && selectedFeature && (
          <FeatureDetailModal
            visible={showFeatureDetailModal}
            feature={selectedFeature}
            userVoted={!!userVote}
            onVote={handleVote}
            onShare={() => handleShareFeature(selectedFeature)}
            onClose={() => {
              setShowFeatureDetailModal(false);
              setSelectedFeature(null);
            }}
          />
        )}
        {showProposeModal && (
          <ProposeFeatureModal
            visible={showProposeModal}
            onClose={() => setShowProposeModal(false)}
            onSubmit={handleProposeFeature}
          />
        )}
      </SafeAreaView>
      {/* ——— Carte de partage invisible, capturable (parité Tips/Leaderboard) ——— */}
    {featureSharePayload && (
      <View
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          left: 0,
          top: 0,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <FeatureShareCard
   ref={featureShareRef}
          featureTitle={featureSharePayload.title}
          i18n={{
            kicker: t("newFeatures.sharE.kicker"), // ✅ fix key: sharE -> share
            footer: t("newFeatures.sharE.footerWithDays", { days: Math.max(0, countdown.days) })
          }}
        />
      </View>
    )}
    </LinearGradient>
  );
}
