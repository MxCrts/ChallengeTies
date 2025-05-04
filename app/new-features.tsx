import React, { useState, useEffect } from "react";
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
import Animated, { FadeInUp } from "react-native-reanimated";
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

const SPACING = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) =>
  Math.round(size * (SCREEN_WIDTH / 375));

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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const snapshot = await getDoc(userDocRef);
        const userData = snapshot.exists()
          ? { ...snapshot.data(), uid: firebaseUser.uid }
          : { uid: firebaseUser.uid };
        setUser(userData as User);
        setUserVote(snapshot.exists() ? snapshot.data().votedFor || null : null);
      }
    });
    return unsubscribeAuth;
  }, []);

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

  useEffect(() => {
    if (!user?.uid) return;
    const featuresRef = collection(db, "polls", "new-features", "features");
    const unsubscribe = onSnapshot(featuresRef, (snapshot) => {
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
    });
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    const targetDate = new Date("2025-04-30T23:59:59Z");
    const updateTimer = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0)
        return setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
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

  const handleVote = async (featureId: string) => {
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
      await updateDoc(
        doc(db, "polls", "new-features", "features", featureId),
        { votes: increment(1) }
      );
      await updateDoc(doc(db, "users", user.uid), { votedFor: featureId });
      setUserVote(featureId);
      Alert.alert(
        t("newFeatures.voteRegisteredTitle"),
        t("newFeatures.voteRegisteredMessage")
      );
    } catch (error) {
      console.error("Erreur lors du vote :", error);
      Alert.alert(
        t("newFeatures.voteErrorTitle"),
        t("newFeatures.voteErrorMessage")
      );
    }
  };

  const handleProposeFeature = async (title: string, description?: string) => {
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
      Alert.alert(
        t("newFeatures.proposalSentTitle"),
        t("newFeatures.proposalSentMessage")
      );
    } catch (error) {
      console.error("Erreur lors de la proposition :", error);
      Alert.alert(
        t("newFeatures.proposalErrorTitle"),
        t("newFeatures.proposalErrorMessage")
      );
    }
  };

  const renderCountdown = () => (
    <LinearGradient
      colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
      style={styles.countdownContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {(["days", "hours", "mins", "secs"] as const).map((unit, idx) => (
        <Animated.View
          key={unit}
          entering={FadeInUp.delay(idx * 100)}
          style={styles.countdownBox}
        >
          <Text
            style={[styles.countdownNumber, { color: currentTheme.colors.textPrimary }]}
          >
            {countdown[unit]}
          </Text>
          <Text
            style={[styles.countdownLabel, { color: currentTheme.colors.textPrimary }]}
          >
            {t(`newFeatures.countdown.${unit}`)}
          </Text>
        </Animated.View>
      ))}
    </LinearGradient>
  );

  const renderFeatureItem = ({ item, index }: { item: Feature; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 50)}
      style={styles.featureCard}
    >
      <TouchableOpacity
        onPress={() => {
          setSelectedFeature(item);
          setShowFeatureDetailModal(true);
        }}
        accessibilityLabel={t("newFeatures.featureDetails", { title: item.title })}
        testID={`feature-card-${item.id}`}
      >
        <LinearGradient
          colors={[currentTheme.colors.cardBackground, `${currentTheme.colors.cardBackground}F0`]}
          style={styles.featureGradient}
        >
          <Text style={[styles.featureTitle, { color: currentTheme.colors.textPrimary }]}>
            {item.title}
          </Text>
          {item.username && (
            <Text
              style={[styles.featureUsername, { color: currentTheme.colors.textSecondary }]}
            >
              {t("newFeatures.by")} {item.username}
            </Text>
          )}
          <Text style={[styles.featureVotes, { color: currentTheme.colors.primary }]}>
            {item.votes} {t("newFeatures.votes", { count: item.votes })}
          </Text>
          {item.description && (
            <Text
              style={[styles.featureDescription, { color: currentTheme.colors.textSecondary }]}
            >
              {item.description.length > 50
                ? `${item.description.substring(0, 50)}...`
                : item.description}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <LinearGradient
          colors={[currentTheme.colors.background, currentTheme.colors.cardBackground]}
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[currentTheme.colors.background, `${currentTheme.colors.cardBackground}F0`]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title={t("newFeatures.title")} />
          <TouchableOpacity
            style={styles.helpIcon}
            onPress={() => setShowExplanationModal(true)}
            accessibilityLabel={t("newFeatures.openExplanation")}
            testID="help-icon"
          >
            <Ionicons
              name="help-circle-outline"
              size={normalizeSize(30)}
              color={currentTheme.colors.secondary}
            />
          </TouchableOpacity>
        </View>
        <Text
          style={[styles.description, { color: currentTheme.colors.textSecondary }]}
        >
          {t("newFeatures.description")}
        </Text>
        <View
          style={[styles.featuresWindow, { backgroundColor: `${currentTheme.colors.cardBackground}80` }]}
        >
          {features.length > 0 ? (
            <FlatList
              data={features}
              renderItem={renderFeatureItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.featuresContent}
              showsVerticalScrollIndicator
              initialNumToRender={10}
              getItemLayout={(_, index) => ({
                length: normalizeSize(100),
                offset: normalizeSize(100) * index,
                index,
              })}
              accessibilityRole="list"
              accessibilityLabel={t("newFeatures.featuresListLabel")}
            />
          ) : (
            <Text
              style={[styles.noFeaturesText, { color: currentTheme.colors.textSecondary }]}
            >
              {t("newFeatures.noFeatures")}
            </Text>
          )}
        </View>
        <View style={styles.bottomContainer}>
          {renderCountdown()}
          {userVote ? (
            <Text
              style={[styles.thankYouText, { color: currentTheme.colors.textSecondary }]}
            >
              {t("newFeatures.thankYouForVote", {
                featureTitle: features.find((f) => f.id === userVote)?.title || "???"
              })}
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.proposeButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => setShowProposeModal(true)}
              accessibilityLabel={t("newFeatures.proposeIdea")}
              testID="propose-button"
            >
              <Text
                style={[styles.proposeButtonText, { color: currentTheme.colors.textPrimary }]}
              >
                {t("newFeatures.proposeIdea")}
              </Text>
            </TouchableOpacity>
          )}
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING },
  headerWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  helpIcon: {
    padding: SPACING / 2,
  },
  description: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  featuresWindow: {
    flex: 0.85,
    marginVertical: SPACING,
    borderRadius: normalizeSize(15),
    overflow: "hidden",
  },
  featuresContent: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING / 2,
  },
  featureCard: {
    marginVertical: SPACING / 2,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(6),
    elevation: 5,
  },
  featureGradient: {
    padding: SPACING,
    borderRadius: normalizeSize(20),
  },
  featureTitle: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureUsername: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureVotes: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    marginBottom: normalizeSize(5),
  },
  featureDescription: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  bottomContainer: {
    alignItems: "center",
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  countdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: SCREEN_WIDTH * 0.9,
    padding: SPACING,
    borderRadius: normalizeSize(15),
    marginBottom: SPACING,
  },
  countdownBox: { alignItems: "center", width: "22%" },
  countdownNumber: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
  },
  countdownLabel: {
    fontSize: normalizeSize(10),
    fontFamily: "Comfortaa_400Regular",
  },
  proposeButton: {
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(25),
  },
  proposeButtonText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
  },
  thankYouText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: SPACING,
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  noFeaturesText: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    padding: SPACING,
  },
});