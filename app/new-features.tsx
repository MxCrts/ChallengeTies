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

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

// ID interstitiel
const adUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-4725616526467159/6097960289";
const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: false,
});

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
    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setAdLoaded(true);
      }
    );
    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error("Erreur interstitiel:", error);
        setAdLoaded(false);
        setTimeout(() => interstitial.load(), 5000);
      }
    );
    interstitial.load();
    return () => {
      unsubscribeLoaded();
      unsubscribeError();
    };
  }, []);

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

  // Modal explicatif
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

  // Compte à rebours
  useEffect(() => {
    const targetDate = new Date("2025-07-30T23:59:59Z");
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
        if (canShowAd && adLoaded) {
          interstitial.show();
          await markAdShown();
          setAdLoaded(false);
          interstitial.load();
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
    [user, userVote, adLoaded, t, checkAdCooldown, markAdShown]
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
        if (canShowAd && adLoaded) {
          interstitial.show();
          await markAdShown();
          setAdLoaded(false);
          interstitial.load();
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
    [user, adLoaded, t, checkAdCooldown, markAdShown]
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

  // Memoized Feature Item
  const FeatureItem = useMemo(
    () =>
      React.memo(({ item, index }: { item: Feature; index: number }) => (
        <Animated.View
          entering={FadeInUp.delay(index * 50)}
          style={styles.featureCard}
        >
          <TouchableOpacity
            onPress={() => {
              setSelectedFeature(item);
              setShowFeatureDetailModal(true);
            }}
            accessibilityLabel={t("newFeatures.featureDetails", {
              title: item.title,
            })}
            accessibilityHint={t("newFeatures.featureDetailsHint")}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedFeature?.id === item.id }}
            testID={`feature-card-${item.id}`}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? [currentTheme.colors.cardBackground, "#333333"]
                  : ["#FFFFFF", "#F5F5F5"]
              }
              style={styles.featureGradient}
            >
              <Text
                style={[
                  styles.featureTitle,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  },
                ]}
              >
                {item.title}
              </Text>
              {item.username && (
                <Text
                  style={[
                    styles.featureUsername,
                    {
                      color: isDarkMode
                        ? "#A0A0A0"
                        : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {t("newFeatures.by")} {item.username}
                </Text>
              )}
              <Text
                style={[
                  styles.featureVotes,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.secondary
                      : currentTheme.colors.primary,
                  },
                ]}
              >
                {item.votes} {t("newFeatures.votes", { count: item.votes })}
              </Text>
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

  // Compte à rebours
  const renderCountdown = useCallback(
    () => (
      <Animated.View entering={FadeInUp} style={styles.countdownContainer}>
        <LinearGradient
          colors={
            isDarkMode
              ? [
                  currentTheme.colors.secondary,
                  currentTheme.colors.primary + "CC",
                ]
              : [
                  currentTheme.colors.secondary,
                  currentTheme.colors.primary + "CC",
                ]
          }
          style={styles.countdownGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {(["days", "hours", "mins", "secs"] as const).map((unit, index) => (
            <Animated.View
              key={unit}
              entering={FadeInUp.delay(index * 200)}
              style={styles.countdownBox}
            >
              <Text
                style={[
                  styles.countdownNumber,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {countdown[unit]}
              </Text>
              <Text
                style={[
                  styles.countdownLabel,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t(`newFeatures.countdown.${unit}`)}
              </Text>
            </Animated.View>
          ))}
        </LinearGradient>
      </Animated.View>
    ),
    [countdown, t, currentTheme, isDarkMode]
  );

  // Métadonnées SEO
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

  const createStyles = (isDarkMode: boolean) =>
    StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: "transparent",
        paddingTop:
          Platform.OS === "ios" ? insets.top : StatusBar.currentHeight ?? 0,
      },
      container: {
        flex: 1,
        backgroundColor: "transparent",
      },
      gradientContainer: {
        flex: 1,
        backgroundColor: "transparent",
      },
      contentWrapper: {
        flex: 1,
        paddingHorizontal: normalizeSize(15),
        paddingBottom: normalizeSize(40),
        backgroundColor: "transparent",
      },
      backButton: {
        position: "absolute",
        top:
          Platform.OS === "android"
            ? StatusBar.currentHeight ?? SPACING
            : SPACING,
        left: normalizeSize(15),
        zIndex: 10,
        padding: SPACING / 2,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: normalizeSize(20),
      },
      headerWrapper: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: SPACING,
        paddingVertical: SPACING * 1.5,
        position: "relative",
        backgroundColor: "transparent",
      },
      helpIcon: {
        position: "absolute",
        right: normalizeSize(15),
        top: normalizeSize(15),
      },
      description: {
        fontSize: normalizeSize(16),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        marginVertical: normalizeSize(20),
        lineHeight: normalizeSize(24),
      },
      featuresWindow: {
        flex: 1,
        marginVertical: normalizeSize(20),
        borderRadius: normalizeSize(25),
        overflow: "hidden",
        backgroundColor: isDarkMode
          ? "transparent"
          : "rgba(255, 255, 255, 0.1)", // Fond léger en light pour premium
      },
      featuresContent: {
        paddingVertical: normalizeSize(20),
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
      },
      featureGradient: {
        padding: normalizeSize(16),
        borderRadius: normalizeSize(25),
        borderWidth: normalizeSize(2.5),
        borderColor: isDarkMode ? "#FFDD95" : "#FF6200",
        backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.4)" : undefined,
      },
      featureTitle: {
        fontSize: normalizeSize(18),
        fontFamily: "Comfortaa_700Bold",
        textAlign: "center",
        marginBottom: normalizeSize(8),
      },
      featureUsername: {
        fontSize: normalizeSize(13),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        marginBottom: normalizeSize(8),
      },
      featureVotes: {
        fontSize: normalizeSize(15),
        fontFamily: "Comfortaa_700Bold",
        textAlign: "center",
        marginBottom: normalizeSize(8),
      },
      featureDescription: {
        fontSize: normalizeSize(13),
        fontFamily: "Comfortaa_400Regular",
        textAlign: "center",
        lineHeight: normalizeSize(20),
      },
      bottomContainer: {
        alignItems: "center",
        paddingVertical: normalizeSize(25),
        marginTop: normalizeSize(20),
      },
      countdownContainer: {
        width: "100%",
        marginBottom: normalizeSize(20),
      },
      countdownGradient: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: normalizeSize(18),
        borderRadius: normalizeSize(18),
        backgroundColor: "rgba(255, 255, 255, 0.95)",
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
        marginVertical: normalizeSize(15),
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
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("newFeatures.loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={
        isDarkMode
          ? ["#1C2526", "#2D3A3A", "#4A5A5A"]
          : [
              currentTheme.colors.background,
              currentTheme.colors.cardBackground,
              currentTheme.colors.primary + "22",
            ]
      }
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={styles.backButton}
          accessibilityLabel={t("newFeatures.goBack")}
          testID="back-button"
        >
          <Ionicons
            name="arrow-back"
            size={normalizeSize(24)}
            color={currentTheme.colors.secondary}
          />
        </TouchableOpacity>
        <View style={styles.contentWrapper}>
          <View style={styles.headerWrapper}>
            <CustomHeader title={t("newFeatures.title")} />
            <Animated.View entering={ZoomIn.delay(300)}>
              <TouchableOpacity
                style={styles.helpIcon}
                onPress={() => setShowExplanationModal(true)}
                accessibilityLabel={t("newFeatures.openExplanation")}
                accessibilityHint={t("newFeatures.openExplanationHint")}
                accessibilityRole="button"
                testID="help-icon"
                activeOpacity={0.7}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={normalizeSize(30)}
                  color={currentTheme.colors.secondary}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
          <Text
            style={[
              styles.description,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("newFeatures.description")}
          </Text>
          <View
            style={[
              styles.featuresWindow,
              { backgroundColor: currentTheme.colors.cardBackground + "80" },
            ]}
          >
            {features.length > 0 ? (
              <FlatList
                data={features}
                renderItem={({ item, index }) => (
                  <FeatureItem item={item} index={index} />
                )}
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
              <Text
                style={[
                  styles.noFeaturesText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("newFeatures.noFeatures")}
              </Text>
            )}
          </View>
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={styles.bottomContainer}
          >
            {renderCountdown()}
            {userVote ? (
              <Text
                style={[
                  styles.thankYouText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("newFeatures.thankYouForVote", {
                  featureTitle:
                    features.find((f) => f.id === userVote)?.title || "???",
                })}
              </Text>
            ) : (
              <Animated.View entering={ZoomIn.delay(500)}>
                <TouchableOpacity
                  style={[
                    styles.proposeButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={() => setShowProposeModal(true)}
                  accessibilityLabel={t("newFeatures.proposeIdea")}
                  accessibilityHint={t("newFeatures.proposeIdeaHint")}
                  accessibilityRole="button"
                  testID="propose-button"
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.proposeButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
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
