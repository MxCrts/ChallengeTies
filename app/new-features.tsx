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
  Alert,
  Platform,
  Share,
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
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../constants/firebase-config";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

/** Util robuste pour ajouter une alpha sans casser les gradients */
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
  const { t } = useTranslation();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownValues>({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });
  const npa = (globalThis as any).__NPA__ === true;
  const [user, setUser] = useState<User | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showFeatureDetailModal, setShowFeatureDetailModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // ↓↓↓ DANS le composant NewFeatures
  const { showInterstitials } = useAdsVisibility();

  const interstitialAdUnitId = __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({
        ios: "ca-app-pub-4725616526467159/4942270608",
        android: "ca-app-pub-4725616526467159/6097960289",
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

  // ⏱️ Compte à rebours → FIN SEPTEMBRE
  useEffect(() => {
    const targetDate = new Date("2025-09-30T23:59:59Z");
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

  // Vote
  const handleVote = useCallback(
    async (featureId: string) => {
      if (!user?.uid) {
        Alert.alert(
          t("newFeatures.loginRequiredTitle"),
          t("newFeatures.loginRequiredMessage")
        );
        return;
      }
      if (userVote) {
        Alert.alert(
          t("newFeatures.alreadyVotedTitle"),
          t("newFeatures.alreadyVotedMessage")
        );
        return;
      }
      try {
        const featureRef = doc(
          db,
          "polls",
          "new-features",
          "features",
          featureId
        );
        const userRef = doc(db, "users", user.uid);
        await Promise.all([
          updateDoc(featureRef, { votes: increment(1) }),
          updateDoc(userRef, { votedFor: featureId }),
        ]);
        setUserVote(featureId);

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

        Alert.alert(
          t("newFeatures.voteRegisteredTitle"),
          t("newFeatures.voteRegisteredMessage")
        );
      } catch (error) {
        console.error("Erreur lors du vote:", error);
        Alert.alert(
          t("newFeatures.voteErrorTitle"),
          t("newFeatures.voteErrorMessage")
        );
      }
    },
    [user, userVote, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials]
  );

  // Proposition de fonctionnalité
  const handleProposeFeature = useCallback(
    async (title: string, description?: string) => {
      if (!user?.uid) {
        Alert.alert(
          t("newFeatures.loginRequiredTitle"),
          t("newFeatures.loginRequiredMessage")
        );
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
        await setDoc(
          doc(db, "users", user.uid),
          { votedFor: featureRef.id },
          { merge: true }
        );
        setUserVote(featureRef.id);

        const canShowAd = await checkAdCooldown();
        if (showInterstitials && canShowAd && adLoaded && interstitialRef.current) {
          await interstitialRef.current.show();
          await markAdShown();
          setAdLoaded(false);
          interstitialRef.current.load();
        }

        Alert.alert(
          t("newFeatures.proposalSentTitle"),
          t("newFeatures.proposalSentMessage")
        );
      } catch (error) {
        console.error("Erreur lors de la proposition:", error);
        Alert.alert(
          t("newFeatures.proposalErrorTitle"),
          t("newFeatures.proposalErrorMessage")
        );
      }
    },
    [user, adLoaded, t, checkAdCooldown, markAdShown, showInterstitials]
  );

  // Partage de fonctionnalité
  const handleShareFeature = useCallback(
    async (feature: Feature) => {
      try {
        await Share.share({
          message: `${t("newFeatures.shareMessage")} ${feature.title}`,
          url: `https://challengeme.com/features/${feature.id}`,
          title: feature.title,
        });
      } catch (error) {
        console.error("Erreur partage:", error);
      }
    },
    [t]
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
                  ]}
                  numberOfLines={2}
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
                    {
                      color: isDarkMode ? "#A0A0A0" : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {t("newFeatures.by")} {item.username}
                </Text>
              )}

              {item.description && (
                <Text
                  style={[
                    styles.featureDescription,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                  numberOfLines={SCREEN_WIDTH > 600 ? 4 : 2}
                >
                  {item.description}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )),
    [t, currentTheme, selectedFeature, isDarkMode]
  );

  // Compte à rebours (UI only)
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
              <Text style={[styles.countdownLabel, { color: currentTheme.colors.textPrimary }]}>
                {t(`newFeatures.countdown.${unit}`)}
              </Text>
            </Animated.View>
          ))}
        </LinearGradient>
      </Animated.View>
    ),
    [countdown, t, currentTheme]
  );

  // Métadonnées (inchangé)
  const metadata = useMemo(
    () => ({
      title: t("newFeatures.title"),
      description: t("newFeatures.description"),
      url: "https://challengeme.com/features",
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
    [t, features]
  );

  const monthLabel = t("newFeatures.monthLabel", { defaultValue: "Mise à jour • Septembre" });

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
        marginTop: SPACING,
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
        marginVertical: normalizeSize(12),
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
        paddingVertical: normalizeSize(22),
        marginTop: normalizeSize(10),
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
        backgroundColor: withAlpha("#fff", isDarkMode ? 0.08 : 0.95),
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
        paddingVertical: normalizeSize(15),
        paddingHorizontal: normalizeSize(30),
        borderRadius: normalizeSize(30),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: normalizeSize(3) },
        shadowOpacity: 0.3,
        shadowRadius: normalizeSize(5),
        elevation: 5,
      },
      proposeButtonText: {
        fontSize: normalizeSize(14),
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
    });

  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

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
          <Text style={[styles.loadingText, { color: currentTheme.colors.textPrimary }]}>
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
              <Text style={styles.monthPillText}>{monthLabel}</Text>
            </View>
            <Text style={styles.heroTitle}>
              {t("newFeatures.heroTitleSep", {
                defaultValue: "Vote les nouveautés qui arrivent fin septembre 🚀",
              })}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t("newFeatures.heroSubtitleSep", {
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
              />
            ) : (
              <Text style={[styles.noFeaturesText, { color: currentTheme.colors.textSecondary }]}>
                {t("newFeatures.noFeatures")}
              </Text>
            )}
          </View>

          <Animated.View entering={FadeInUp.delay(400)} style={styles.bottomContainer}>
            {renderCountdown()}
            {userVote ? (
              <Text style={[styles.thankYouText, { color: currentTheme.colors.textSecondary }]}>
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
    </LinearGradient>
  );
}
