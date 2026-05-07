import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
  Pressable,
  StatusBar,
  I18nManager,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { auth, db } from "@/constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileUpdate } from "../../context/ProfileUpdateContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import GlobalLayout from "../../components/GlobalLayout";
import designSystem from "../../theme/designSystem";
import { useTranslation, Trans } from "react-i18next";
import BannerSlot from "@/components/BannerSlot";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useTutorial } from "../../context/TutorialContext";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PioneerBadge from "@/components/PioneerBadge";
import { setDuoAvailable } from "@/services/matchingService";
import { useMatchingInbox } from "@/hooks/useMatchingInbox";
import MatchingInboxModal from "@/components/MatchingInboxModal";
import WeeklyReportModal, { type WeeklyReportData } from "@/components/WeeklyReportModal";

// ── Responsive ────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
let __win = Dimensions.get("window");
Dimensions.addEventListener("change", ({ window }) => { __win = window; });
const n = (size: number) => {
  const W = __win?.width ?? 375;
  const scale = Math.min(Math.max(W / 375, 0.75), 1.8);
  return Math.round(size * scale);
};

const withAlpha = (color: string, alpha: number) => {
  const a = Math.min(Math.max(alpha, 0), 1);
  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r},${g},${b},${a})`;
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(0,0,0,${a})`;
};

// ── Helpers rapport ───────────────────────────────────────────────────────────
/** Retourne le weekId du lundi de la semaine PASSÉE (format YYYY-MM-DD) */
function getLastWeekId(): string {
  const now = new Date();
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  const dow = (thisMonday.getDay() + 6) % 7;
  thisMonday.setDate(thisMonday.getDate() - dow);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  return [
    lastMonday.getFullYear(),
    String(lastMonday.getMonth() + 1).padStart(2, "0"),
    String(lastMonday.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Charge le rapport le plus récent disponible pour l'uid */
async function loadLatestWeeklyReport(uid: string): Promise<WeeklyReportData | null> {
  try {
    // 1. Essaie d'abord le rapport de la semaine passée
    const lastWeekId = getLastWeekId();
    const directRef = doc(db, "users", uid, "weeklyReports", lastWeekId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return directSnap.data() as WeeklyReportData;

    // 2. Fallback : prend le plus récent dans la sous-collection
    const q = query(
      collection(db, "users", uid, "weeklyReports"),
      orderBy("weekId", "desc"),
      limit(1)
    );
    const qs = await getDocs(q);
    if (!qs.empty) return qs.docs[0].data() as WeeklyReportData;

    return null;
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserData {
  username?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  profileImage?: string;
  trophies?: number;
  newAchievements?: string[];
  isPioneer?: boolean;
  unreadNotifications?: number;
  inventory?: { streakPass?: number; [key: string]: any };
  duoAvailable?: boolean;
  challengeCategories?: string[];
}

interface ProfileSection {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  navigateTo: string;
  testID: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  unclaimedCount?: number;
}

// ── Composant Toggle custom ───────────────────────────────────────────────────
const CustomToggle = ({ value, isDarkMode }: { value: boolean; isDarkMode: boolean }) => (
  <View style={[s.toggleTrack, {
    backgroundColor: value ? "#F97316" : isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
  }]}>
    <View style={[s.toggleThumb, { alignSelf: value ? "flex-end" : "flex-start" }]} />
  </View>
);

// ── Composant principal ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profileUpdated } = useProfileUpdate();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const { t, i18n } = useTranslation();
  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [adHeight, setAdHeight] = useState(0);
  const [duoToggleBusy, setDuoToggleBusy] = useState(false);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [matchingInboxVisible, setMatchingInboxVisible] = useState(false);
  const { items: matchingItems, count: matchingCount } = useMatchingInbox();

  // ── Weekly report state ───────────────────────────────────────────────────
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [weeklyReportVisible, setWeeklyReportVisible] = useState(false);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [hasWeeklyReport, setHasWeeklyReport] = useState(false);

  const PROFILE_FIRST_SEEN_KEY = "profile.firstSeen.v1";
  const firstProfileGateRef = React.useRef(false);
  const { isTutorialActive } = useTutorial();

  const bottomContentPadding = (showBanners ? adHeight : 0) + tabBarHeight + insets.bottom + n(24);
  const handleAdHeight = useCallback((h: number) => setAdHeight(h), []);

  const CATEGORY_SLUG_MAP: Record<string, string> = {
    "Fitness": "fitness",
    "Santé": "health",
    "Productivité": "productivity",
    "Éducation": "education",
    "Bien-être": "wellbeing",
    "Sport": "sport",
    "Méditation": "meditation",
    "Nutrition": "nutrition",
    "Créativité": "creativity",
    "Social": "social",
  };

  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const totalInventoryItems = useMemo(() => {
    const inv = userData?.inventory;
    if (!inv || typeof inv !== "object") return 0;
    return Object.values(inv).reduce((sum, val) => {
      if (typeof val === "number" && isFinite(val)) return sum + val;
      return sum;
    }, 0);
  }, [userData]);

  // ── Firestore user ────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setError(t("noUserConnected")); setIsLoading(false); return; }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserData;
        setUserData(data);
        setError(null);
        if (data.duoAvailable === undefined || data.duoAvailable === null) {
          setDuoAvailable(uid, true).catch(() => {});
        }
      } else setError(t("profileNotFound"));
      setIsLoading(false);
    }, () => { setError(t("profileLoadError")); setIsLoading(false); });
    return () => unsub();
  }, [profileUpdated]);

  // ── Charge le rapport dès que uid dispo ───────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const report = await loadLatestWeeklyReport(uid);
      if (cancelled) return;
      if (report) {
        setWeeklyReport(report);
        setHasWeeklyReport(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Ouvre le rapport manuellement ─────────────────────────────────────────
  const handleOpenWeeklyReport = useCallback(async () => {
    if (weeklyReportLoading) return;
    if (weeklyReport) {
      setWeeklyReportVisible(true);
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setWeeklyReportLoading(true);
    const report = await loadLatestWeeklyReport(uid);
    setWeeklyReportLoading(false);
    if (report) {
      setWeeklyReport(report);
      setHasWeeklyReport(true);
      setWeeklyReportVisible(true);
    } else {
      Alert.alert(
        t("weeklyReport.noReportTitle", { defaultValue: "Pas encore de bilan" }),
        t("weeklyReport.noReportDesc", { defaultValue: "Ton premier bilan sera disponible le lundi prochain après une semaine d'activité." })
      );
    }
  }, [weeklyReport, weeklyReportLoading, t]);

  const handleWeeklyReportClose = useCallback(() => {
    setWeeklyReportVisible(false);
  }, []);

  const handleWeeklyReportGoalAccept = useCallback(() => {
    setWeeklyReportVisible(false);
  }, []);

  // ── Pioneer modal au premier focus ────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (firstProfileGateRef.current) return;
        firstProfileGateRef.current = true;
        const seen = await AsyncStorage.getItem(PROFILE_FIRST_SEEN_KEY);
        if (cancelled) return;
        if (seen !== "1") {
          setShowPioneerModal(true);
          await AsyncStorage.setItem(PROFILE_FIRST_SEEN_KEY, "1");
          const uid = auth.currentUser?.uid;
          if (uid && !userData?.duoAvailable) {
            setDuoAvailable(uid, true).catch(() => {});
          }
        }
      } catch {}
    };
    if (!isLoading && !!userData) run();
    return () => { cancelled = true; };
  }, [isLoading, userData]));

  const handleDuoToggle = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || duoToggleBusy) return;
    setDuoToggleBusy(true);
    try {
      await setDuoAvailable(uid, !userData?.duoAvailable);
    } catch {
      Alert.alert(t("alerts.error"), t("matching.toggleError", { defaultValue: "Impossible de mettre à jour." }));
    } finally {
      setDuoToggleBusy(false);
    }
  }, [duoToggleBusy, userData?.duoAvailable, t]);

  // Sections grille
  const sections = useMemo<ProfileSection[]>(() => [
    { name: t("editProfile"), icon: "person-circle-outline", navigateTo: "profile/UserInfo", testID: "edit-profile-button", accessibilityLabel: t("access.editProfile.label"), accessibilityHint: t("access.editProfile.hint") },
    { name: t("ongoingChallenges"), icon: "flag-outline", navigateTo: "profile/CurrentChallenges", testID: "current-challenges-button", accessibilityLabel: t("access.ongoingChallenges.label"), accessibilityHint: t("access.ongoingChallenges.hint") },
    { name: t("completedChallenges"), icon: "checkmark-done-outline", navigateTo: "profile/CompletedChallenges", testID: "completed-challenges-button", accessibilityLabel: t("access.completedChallenges.label"), accessibilityHint: t("access.completedChallenges.hint") },
    { name: t("statistics"), icon: "stats-chart-outline", navigateTo: "profile/UserStats", testID: "stats-button", accessibilityLabel: t("access.statistics.label"), accessibilityHint: t("access.statistics.hint") },
    { name: t("favorites"), icon: "bookmark-outline", navigateTo: "profile/SavedChallenges", testID: "favorites-button", accessibilityLabel: t("access.favorites.label"), accessibilityHint: t("access.favorites.hint") },
    { name: t("rewards"), icon: "medal-outline", navigateTo: "profile/Achievements", testID: "achievements-button", unclaimedCount: userData?.newAchievements?.length ?? 0, accessibilityLabel: t("access.rewards.label"), accessibilityHint: t("access.rewards.hint") },
    { name: t("inventory.title"), icon: "briefcase-outline", navigateTo: "profile/Inventory", testID: "inventory-button", unclaimedCount: totalInventoryItems, accessibilityLabel: t("access.inventory.label", { defaultValue: "Ouvrir ton inventaire" }), accessibilityHint: t("access.inventory.hint", { defaultValue: "Voir et gérer tes bonus." }) },
    { name: t("myChallenges"), icon: "create-outline", navigateTo: "profile/MyChallenges", testID: "my-challenges-button", accessibilityLabel: t("access.myChallenges.label"), accessibilityHint: t("access.myChallenges.hint") },
  ], [t, i18n.language, userData, totalInventoryItems]);

  const rows = useMemo<ProfileSection[][]>(() => {
    const split: ProfileSection[][] = [];
    for (let i = 0; i < sections.length; i += 2) split.push(sections.slice(i, i + 2));
    return split;
  }, [sections, i18n.language]);

  // ── États de chargement ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <GlobalLayout>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={[withAlpha(currentTheme.colors.background, 1), withAlpha(currentTheme.colors.cardBackground, 1), withAlpha(currentTheme.colors.primary, 0.13)]} style={s.centered}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[s.loadingText, { color: currentTheme.colors.textSecondary }]}>{t("loadingProfile")}</Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  if (error || !userData) {
    return (
      <GlobalLayout>
        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={[withAlpha(currentTheme.colors.background, 1), withAlpha(currentTheme.colors.cardBackground, 1), withAlpha(currentTheme.colors.primary, 0.13)]} style={s.centered}>
          <Ionicons name="alert-circle-outline" size={n(40)} color={currentTheme.colors.textSecondary} />
          <Text style={[s.loadingText, { color: currentTheme.colors.textSecondary }]}>{error || t("profileS.noData")}</Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  const cardBg = isDarkMode
    ? [currentTheme.colors.background, currentTheme.colors.cardBackground]
    : ["#FFFFFF", "#FFF7EE"];
  const primaryColor = "#F97316";
  const ORANGE_D = "#D4620C";
  const textPrimary = isDarkMode ? currentTheme.colors.textPrimary : "#111827";
  const textSecondary = isDarkMode ? currentTheme.colors.textSecondary : "#6B7280";

  return (
    <GlobalLayout>
      <LinearGradient
        colors={[withAlpha(currentTheme.colors.background, 1), withAlpha(currentTheme.colors.cardBackground, 1), withAlpha(currentTheme.colors.primary, 0.10)]}
        style={s.flex} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* Orbes */}
        <LinearGradient pointerEvents="none" colors={[withAlpha(primaryColor, 0.20), "transparent"]} style={s.orbTop} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} />
        <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.secondary, 0.18), "transparent"]} style={s.orbBottom} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />

        <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <CustomHeader title={t("yourProfile", { defaultValue: "Ton profil" })} backgroundColor="transparent" useBlur={false} showHairline={false} />

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: bottomContentPadding }]}
          showsVerticalScrollIndicator={false}
          contentInset={Platform.OS === "ios" ? { top: 4, bottom: 0 } : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── CARTE PROFIL ─────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(80)} style={s.cardWrap}>
            <LinearGradient colors={cardBg as any} style={[s.card, { borderColor: withAlpha(primaryColor, isDarkMode ? 0.18 : 0.12) }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <LinearGradient pointerEvents="none" colors={[withAlpha(primaryColor, isDarkMode ? 0.16 : 0.10), "transparent"]} style={s.cardHaloTop} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} />

              <View style={s.avatarRow}>
                <View style={s.avatarWrap}>
                  <Image
                    source={userData?.profileImage ? { uri: userData.profileImage } : require("../../assets/images/default-profile.webp")}
                    defaultSource={require("../../assets/images/default-profile.webp")}
                    style={[s.avatar, { borderColor: withAlpha(primaryColor, isDarkMode ? 0.30 : 0.22) }]}
                  />
                  {userData?.isPioneer && (
                    <PioneerBadge size="mini" label={t("badges.pioneer", { defaultValue: "Pioneer" })} style={s.pioneerBadge} />
                  )}
                </View>

                <Animated.View entering={ZoomIn.delay(200)} style={s.trophyChip}>
                  <LinearGradient
                    colors={isDarkMode ? [withAlpha(currentTheme.colors.background, 0.80), withAlpha(currentTheme.colors.cardBackground, 0.70)] : ["rgba(255,255,255,0.96)", "rgba(255,244,225,0.92)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.trophyChipInner, { borderColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.30 : 0.40) }]}
                  >
                    <Ionicons name="trophy" size={n(14)} color={currentTheme.colors.trophy} />
                    <Text style={[s.trophyText, { color: isDarkMode ? "#FFD36A" : "#8A4B00" }]}>{userData?.trophies ?? 0}</Text>
                  </LinearGradient>
                </Animated.View>
              </View>

              <Text style={[s.username, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                {userData?.username || t("yourProfile")}
              </Text>

              {userData?.challengeCategories && userData.challengeCategories.filter(Boolean).length > 0 ? (
                <View style={s.interestsRow}>
                  {userData.challengeCategories.filter(Boolean).slice(0, 4).map((cat, i) => (
                    <View key={i} style={[s.interestPill, {
                      borderColor: withAlpha(primaryColor, isDarkMode ? 0.35 : 0.25),
                      backgroundColor: withAlpha(primaryColor, isDarkMode ? 0.10 : 0.07),
                    }]}>
                      <Text style={[s.interestPillText, { color: isDarkMode ? primaryColor : "#C86A00" }]} numberOfLines={1}>
                        {t(`userInfo.category.${CATEGORY_SLUG_MAP[String(cat).trim()] ?? String(cat).trim()}`, { defaultValue: String(cat).trim() })}
                      </Text>
                    </View>
                  ))}
                  {userData.challengeCategories.filter(Boolean).length > 4 && (
                    <View style={[s.interestPill, {
                      borderColor: withAlpha(primaryColor, 0.20),
                      backgroundColor: withAlpha(primaryColor, 0.06),
                    }]}>
                      <Text style={[s.interestPillText, { color: textSecondary }]}>
                        +{userData.challengeCategories.filter(Boolean).length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("profile/UserInfo")}
                  activeOpacity={0.80}
                  style={[s.interestPlaceholder, {
                    borderColor: withAlpha(primaryColor, isDarkMode ? 0.25 : 0.18),
                    backgroundColor: withAlpha(primaryColor, isDarkMode ? 0.07 : 0.05),
                  }]}
                >
                  <Ionicons name="add-circle-outline" size={n(13)} color={primaryColor} />
                  <Text style={[s.interestPlaceholderText, { color: primaryColor }]}>
                    {t("addInterestsHere", { defaultValue: "Choisir mes catégories" })}
                  </Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </Animated.View>

          {/* ── BILAN HEBDO ──────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(130)} style={s.sectionBlock}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionHeaderDot, { backgroundColor: primaryColor }]} />
              <Text style={[s.sectionHeaderText, { color: textSecondary }]}>
                {t("weeklyReport.sectionTitle", { defaultValue: "Bilan hebdomadaire" })}
              </Text>
            </View>

            <Pressable
              onPress={handleOpenWeeklyReport}
              disabled={weeklyReportLoading}
              style={({ pressed }) => ({
                opacity: pressed ? 0.84 : 1,
                transform: [{ scale: pressed ? 0.984 : 1 }],
              })}
            >
              <View style={[s.weeklyCard, {
                backgroundColor: isDarkMode
                  ? withAlpha(currentTheme.colors.cardBackground, 0.90)
                  : "#FFFFFF",
                borderColor: hasWeeklyReport
                  ? withAlpha(primaryColor, isDarkMode ? 0.36 : 0.24)
                  : withAlpha(primaryColor, isDarkMode ? 0.12 : 0.08),
                shadowColor: hasWeeklyReport ? primaryColor : "#000000",
                shadowOpacity: hasWeeklyReport
                  ? (isDarkMode ? 0.18 : 0.08)
                  : (isDarkMode ? 0.10 : 0.04),
              }]}>

                {/* Icône */}
                <View style={[s.weeklyIconBox, {
                  backgroundColor: hasWeeklyReport
                    ? withAlpha(primaryColor, isDarkMode ? 0.18 : 0.10)
                    : isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
                }]}>
                  {weeklyReportLoading
                    ? <ActivityIndicator size="small" color={primaryColor} />
                    : <Ionicons
                        name={hasWeeklyReport ? "bar-chart" : "bar-chart-outline"}
                        size={n(22)}
                        color={hasWeeklyReport ? primaryColor : textSecondary}
                      />
                  }
                </View>

                {/* Textes */}
                <View style={s.weeklyTexts}>
                  <Text
                    style={[s.weeklyTitle, { color: textPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {t("weeklyReport.btnTitle", { defaultValue: "Mon bilan de la semaine" })}
                  </Text>
                  <Text
                    style={[s.weeklySub, { color: hasWeeklyReport ? primaryColor : textSecondary }]}
                    numberOfLines={1}
                  >
                    {hasWeeklyReport
                      ? t("weeklyReport.btnSubAvailable", { defaultValue: "Rapport disponible — voir mon momentum" })
                      : t("weeklyReport.btnSubEmpty", { defaultValue: "Disponible chaque lundi" })
                    }
                  </Text>
                </View>

                {/* CTA ou chevron */}
                {hasWeeklyReport ? (
                  <View style={s.weeklyViewBtn}>
                    <Text style={s.weeklyViewBtnText}>
                      {t("weeklyReport.newBadge", { defaultValue: "VOIR" })}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={n(16)}
                    color={withAlpha(textSecondary, 0.45)}
                  />
                )}
              </View>
            </Pressable>
          </Animated.View>

          {/* ── SECTION BINÔME ───────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(180)} style={s.sectionBlock}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionHeaderDot, { backgroundColor: primaryColor }]} />
              <Text style={[s.sectionHeaderText, { color: textSecondary }]}>
                {t("matching.sectionTitle", { defaultValue: "Binôme & invitations" })}
              </Text>
            </View>

            <LinearGradient
              colors={isDarkMode ? [withAlpha(currentTheme.colors.cardBackground, 0.90), withAlpha(currentTheme.colors.background, 0.80)] : ["#FFFFFF", "#FFF7EE"]}
              style={[s.binomeCard, { borderColor: withAlpha(primaryColor, isDarkMode ? 0.16 : 0.10) }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Pressable
                onPress={() => !duoToggleBusy && handleDuoToggle()}
                disabled={duoToggleBusy}
                style={({ pressed }) => [s.binomeRow, {
                  backgroundColor: userData?.duoAvailable
                    ? isDarkMode ? "rgba(249,115,22,0.10)" : "rgba(249,115,22,0.07)"
                    : "transparent",
                  opacity: pressed ? 0.78 : 1,
                }]}
              >
                <View style={[s.binomeIcon, {
                  backgroundColor: userData?.duoAvailable
                    ? "rgba(249,115,22,0.16)"
                    : isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                }]}>
                  <Ionicons name="people-outline" size={n(20)} color={userData?.duoAvailable ? primaryColor : textSecondary} />
                </View>
                <View style={s.binomeTexts}>
                  <Text style={[s.binomeTitle, { color: textPrimary }]} numberOfLines={2}>
                    {t("matching.duoAvailableLabel", { defaultValue: "Disponible pour un duo" })}
                  </Text>
                  <Text style={[s.binomeSub, { color: userData?.duoAvailable ? primaryColor : textSecondary }]} numberOfLines={2}>
                    {userData?.duoAvailable
                      ? t("matching.duoAvailableOn", { defaultValue: "Tu apparais dans les matchs" })
                      : t("matching.duoAvailableOff", { defaultValue: "Tu n'apparais pas dans les matchs" })}
                  </Text>
                </View>
                <CustomToggle value={!!userData?.duoAvailable} isDarkMode={isDarkMode} />
              </Pressable>

              <View style={[s.binomeDivider, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]} />

              <Pressable
                onPress={() => setMatchingInboxVisible(true)}
                style={({ pressed }) => [s.binomeRow, {
                  backgroundColor: matchingCount > 0
                    ? isDarkMode ? "rgba(249,115,22,0.10)" : "rgba(249,115,22,0.07)"
                    : "transparent",
                  opacity: pressed ? 0.78 : 1,
                }]}
              >
                <View style={s.binomeIconWrap}>
                  <View style={[s.binomeIcon, {
                    backgroundColor: matchingCount > 0
                      ? "rgba(249,115,22,0.16)"
                      : isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                  }]}>
                    <Ionicons name="mail-outline" size={n(20)} color={matchingCount > 0 ? primaryColor : textSecondary} />
                  </View>
                  {matchingCount > 0 && (
                    <View style={s.inboxBadge}>
                      <Text style={s.inboxBadgeText}>{matchingCount > 9 ? "9+" : matchingCount}</Text>
                    </View>
                  )}
                </View>
                <View style={s.binomeTexts}>
                  <Text style={[s.binomeTitle, { color: textPrimary }]} numberOfLines={2}>
                    {t("matching.inboxBtnLabel", { defaultValue: "Invitations de binôme" })}
                  </Text>
                  <Text style={[s.binomeSub, { color: matchingCount > 0 ? primaryColor : textSecondary }]} numberOfLines={2}>
                    {matchingCount > 0
                      ? t("matching.inboxBtnSub", { count: matchingCount, defaultValue: `${matchingCount} invitation(s) en attente` })
                      : t("matching.inboxEmpty", { defaultValue: "Aucune invitation pour l'instant" })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={n(16)} color={withAlpha(textSecondary, 0.50)} />
              </Pressable>
            </LinearGradient>
          </Animated.View>

          {/* ── GRILLE SECTIONS ──────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.delay(260)}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionHeaderDot, { backgroundColor: primaryColor }]} />
              <Text style={[s.sectionHeaderText, { color: textSecondary }]}>
                {t("profileS.mySpace", { defaultValue: "Mon espace" })}
              </Text>
            </View>
          </Animated.View>

          <View key={i18n.language} style={s.grid}>
            {rows.map((row, rowIndex) => (
              <Animated.View key={rowIndex} entering={FadeInUp.delay(300 + rowIndex * 80)} style={s.gridRow}>
                {row.map((section, index) => (
                  <Animated.View key={index} entering={ZoomIn.delay(160 + index * 40)} style={s.gridCell}>
                    <TouchableOpacity
                      onPress={() => router.push(section.navigateTo)}
                      accessibilityLabel={section.accessibilityLabel}
                      accessibilityHint={section.accessibilityHint}
                      accessibilityRole="button"
                      testID={section.testID}
                      activeOpacity={0.72}
                      style={s.gridCellTouch}
                    >
                      <LinearGradient
                        colors={[withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.20 : 0.14), withAlpha(primaryColor, isDarkMode ? 0.14 : 0.10), withAlpha("#FFFFFF", isDarkMode ? 0.08 : 0.16)]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={s.gridCellGradient}
                      >
                        <View style={[s.gridCellInner, { backgroundColor: withAlpha(isDarkMode ? currentTheme.colors.cardBackground : "#FFFFFF", isDarkMode ? 0.55 : 0.92) }]}>
                          <LinearGradient pointerEvents="none" colors={[withAlpha("#FFFFFF", isDarkMode ? 0.14 : 0.28), "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.cellHighlight} />
                          <View style={s.cellTopRow}>
                            <View style={[s.cellIconBubble, { backgroundColor: withAlpha(currentTheme.colors.background, isDarkMode ? 0.20 : 0.28), borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.16 : 0.12) }]}>
                              <Ionicons name={section.icon} size={n(20)} color={currentTheme.colors.secondary} />
                              {(section.unclaimedCount ?? 0) > 0 && (
                                <Animated.View entering={ZoomIn} style={s.cellBadge}>
                                  {(section.unclaimedCount ?? 0) > 1 && (
                                    <Text style={s.cellBadgeText}>{section.unclaimedCount! > 99 ? "99+" : section.unclaimedCount}</Text>
                                  )}
                                </Animated.View>
                              )}
                            </View>
                            <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={n(15)} color={withAlpha(textSecondary, 0.60)} />
                          </View>
                          <Text style={[s.cellText, { color: textPrimary }]} numberOfLines={2} adjustsFontSizeToFit>
                            {section.name}
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </Animated.View>
            ))}
          </View>

          <View style={{ height: n(8) }} />
        </ScrollView>

        {/* Bannière pub */}
        {showBanners && (
          <View style={[s.bannerWrap, { bottom: tabBarHeight + insets.bottom }]} pointerEvents="box-none">
            <BannerSlot onHeight={handleAdHeight} />
          </View>
        )}

        {/* ── WEEKLY REPORT MODAL ────────────────────────────────────────── */}
        {weeklyReport && (
          <WeeklyReportModal
            visible={weeklyReportVisible}
            data={weeklyReport}
            isDark={isDarkMode}
            onClose={handleWeeklyReportClose}
            onGoalAccept={handleWeeklyReportGoalAccept}
            t={t}
          />
        )}

        {/* ── MODAL PIONEER ────────────────────────────────────────────── */}
        <Modal visible={showPioneerModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowPioneerModal(false)} presentationStyle="overFullScreen" hardwareAccelerated>
          <View style={s.pioneerOverlay} pointerEvents="auto">
            <BlurView intensity={55} tint={isDarkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)" }]} />
            <Animated.View entering={ZoomIn.duration(260)} style={[s.pioneerWrap, { paddingTop: 0, paddingBottom: 0 }]}>
              <LinearGradient
                colors={isDarkMode ? [withAlpha(currentTheme.colors.cardBackground, 0.92), withAlpha(currentTheme.colors.background, 0.78)] : ["rgba(255,255,255,0.92)", "rgba(255,245,230,0.92)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.pioneerCard, { borderColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.35 : 0.45), marginTop: insets.top + n(10), marginBottom: insets.bottom + n(10) }]}
              >
                <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.primary, isDarkMode ? 0.35 : 0.25), "transparent"]} style={s.pioneerHaloTop} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} />
                <LinearGradient pointerEvents="none" colors={[withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.28 : 0.22), "transparent"]} style={s.pioneerHaloBottom} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />
                <ScrollView style={{ width: "100%" }} contentContainerStyle={s.pioneerContent} showsVerticalScrollIndicator={false} bounces={false}>
                  <View style={s.pioneerHero}>
                    <LinearGradient colors={[withAlpha(currentTheme.colors.secondary, 0.95), withAlpha(currentTheme.colors.primary, 0.85)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pioneerIconRing}>
                      <View style={[s.pioneerIconInner, { backgroundColor: withAlpha(currentTheme.colors.background, isDarkMode ? 0.55 : 0.35) }]}>
                        <Ionicons name="sparkles" size={n(28)} color={isDarkMode ? "#FFD36A" : "#FFB800"} />
                      </View>
                    </LinearGradient>
                    <View style={s.pioneerPillRow}>
                      <View style={[s.pioneerPill, { backgroundColor: withAlpha(currentTheme.colors.secondary, isDarkMode ? 0.16 : 0.12), borderColor: withAlpha(currentTheme.colors.secondary, 0.25) }]}>
                        <Text style={[s.pioneerPillText, { color: isDarkMode ? currentTheme.colors.secondary : "#C86A00" }]}>{t("pioneerModal.pill", { defaultValue: "1000 premiers" })}</Text>
                      </View>
                      <View style={[s.pioneerPill, { backgroundColor: withAlpha(currentTheme.colors.trophy, isDarkMode ? 0.14 : 0.10), borderColor: withAlpha(currentTheme.colors.trophy, 0.22) }]}>
                        <Ionicons name="trophy" size={n(14)} color={currentTheme.colors.trophy} />
                        <Text style={[s.pioneerPillText, { color: currentTheme.colors.trophy, marginLeft: 6 }]}>+50 {t("pioneerModal.trophiesShort", { defaultValue: "trophées" })}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[s.pioneerTitle, { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" }]} numberOfLines={3} adjustsFontSizeToFit>{t("pioneerModal.title", { defaultValue: "Tu fais partie des Pioneers." })}</Text>
                  <Text style={[s.pioneerDesc, { color: isDarkMode ? currentTheme.colors.textSecondary : "#2B2B2B" }]}>
                    <Trans i18nKey="pioneerModal.description" values={{ first: 1000, trophies: 50 }} components={{ b: <Text style={[s.pioneerBold, { color: isDarkMode ? currentTheme.colors.textPrimary : "#FF8A00" }]} /> }} />
                  </Text>
                  <View style={s.pioneerBullets}>
                    {[{ icon: "shield-checkmark-outline", key: "pioneerModal.b1", def: "Badge Pioneer visible sur ton profil." }, { icon: "flash-outline", key: "pioneerModal.b2", def: "Bonus immédiat pour accélérer ta progression." }, { icon: "people-outline", key: "pioneerModal.b3", def: "Tu fais partie de la toute première vague." }].map((b, i) => (
                      <View key={i} style={[s.pioneerBulletRow, i === 2 && { marginBottom: 0 }]}>
                        <Ionicons name={b.icon as any} size={n(18)} color={currentTheme.colors.secondary} />
                        <Text style={[s.pioneerBulletText, { color: isDarkMode ? currentTheme.colors.textPrimary : "#111" }]}>{t(b.key, { defaultValue: b.def })}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => setShowPioneerModal(false)} activeOpacity={0.85} style={s.pioneerCtaWrap}>
                    <LinearGradient colors={[currentTheme.colors.secondary, currentTheme.colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pioneerCta}>
                      <Text style={s.pioneerCtaText}>{t("pioneerModal.cta", { defaultValue: "Let's go 🚀" })}</Text>
                      <Ionicons name="arrow-forward" size={n(16)} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <Text style={[s.pioneerFoot, { color: withAlpha(currentTheme.colors.textSecondary, 0.85) }]}>{t("pioneerModal.foot", { defaultValue: "Merci de construire l'aventure avec nous." })}</Text>
                </ScrollView>
              </LinearGradient>
            </Animated.View>
          </View>
        </Modal>

        {/* Matching Inbox */}
        <MatchingInboxModal
          visible={matchingInboxVisible}
          onClose={() => setMatchingInboxVisible(false)}
          items={matchingItems}
          onAccepted={(item) => { setMatchingInboxVisible(false); router.push(`/challenge-details/${item.challengeId}`); }}
        />
      </LinearGradient>
    </GlobalLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: n(10), fontSize: n(15), fontFamily: "Comfortaa_400Regular", textAlign: "center" },
  scroll: { paddingHorizontal: n(16), paddingTop: n(8) },
  orbTop: { position: "absolute", top: -SCREEN_WIDTH * 0.25, left: -SCREEN_WIDTH * 0.2, width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9, borderRadius: SCREEN_WIDTH * 0.45 },
  orbBottom: { position: "absolute", bottom: -SCREEN_WIDTH * 0.3, right: -SCREEN_WIDTH * 0.25, width: SCREEN_WIDTH * 1.1, height: SCREEN_WIDTH * 1.1, borderRadius: SCREEN_WIDTH * 0.55 },

  // Carte profil
  cardWrap: { marginBottom: n(14) },
  card: { borderRadius: n(24), padding: n(20), borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: n(8) }, shadowOpacity: 0.08, shadowRadius: n(20), elevation: 2 },
  cardHaloTop: { position: "absolute", top: -SCREEN_WIDTH * 0.2, left: -SCREEN_WIDTH * 0.15, width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.65, borderRadius: SCREEN_WIDTH * 0.325 },
  avatarRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  avatarWrap: { position: "relative", alignItems: "center" },
  avatar: { width: n(96), height: n(96), borderRadius: n(48), borderWidth: 3 },
  pioneerBadge: { position: "absolute", bottom: -n(10), left: n(8) },
  trophyChip: { position: "absolute", right: 0, top: 0 },
  trophyChipInner: { flexDirection: "row", alignItems: "center", gap: n(5), paddingVertical: n(5), paddingHorizontal: n(10), borderRadius: n(999), borderWidth: 1, overflow: "hidden" },
  trophyText: { fontFamily: "Comfortaa_700Bold", fontSize: n(13), includeFontPadding: false },
  username: { fontFamily: "Comfortaa_700Bold", fontSize: n(24), letterSpacing: -0.3, textAlign: "center", marginTop: n(14) },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: n(6), marginTop: n(10) },
  interestPill: { paddingVertical: n(5), paddingHorizontal: n(10), borderRadius: n(999), borderWidth: 1 },
  interestPillText: { fontFamily: "Comfortaa_700Bold", fontSize: n(11), includeFontPadding: false },
  interestPlaceholder: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: n(5), marginTop: n(10), paddingVertical: n(7), paddingHorizontal: n(14), borderRadius: n(999), borderWidth: 1 },
  interestPlaceholderText: { fontFamily: "Comfortaa_700Bold", fontSize: n(12), includeFontPadding: false },

  // Section headers
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: n(8), marginBottom: n(10), marginTop: n(4) },
  sectionHeaderDot: { width: n(6), height: n(6), borderRadius: n(3) },
  sectionHeaderText: { fontFamily: "Comfortaa_700Bold", fontSize: n(11), letterSpacing: 0.5, textTransform: "uppercase" },
  sectionBlock: { marginBottom: n(16) },

  // Weekly report card
  weeklyCard: {
    borderRadius: n(16),
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: n(14),
    paddingHorizontal: n(14),
    gap: n(12),
    shadowOffset: { width: 0, height: n(3) },
    shadowRadius: n(10),
    elevation: 2,
  },
  weeklyIconBox: {
    width: n(44),
    height: n(44),
    borderRadius: n(13),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  weeklyTexts: {
    flex: 1,
    minWidth: 0,
    gap: n(3),
  },
  weeklyTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: n(13.5),
    lineHeight: n(18),
    includeFontPadding: false,
  },
  weeklySub: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: n(11),
    lineHeight: n(15),
    includeFontPadding: false,
  },
  weeklyViewBtn: {
    backgroundColor: "#F97316",
    paddingHorizontal: n(12),
    paddingVertical: n(8),
    borderRadius: n(10),
    flexShrink: 0,
    elevation: 4,
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: n(2) },
    shadowOpacity: 0.40,
    shadowRadius: n(5),
  },
  weeklyViewBtnText: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: n(11.5),
    color: "#FFFFFF",
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  // Binome
  binomeCard: { borderRadius: n(20), borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: n(4) }, shadowOpacity: 0.06, shadowRadius: n(12), elevation: 2 },
  binomeRow: { flexDirection: "row", alignItems: "center", paddingVertical: n(14), paddingHorizontal: n(16), gap: n(12), borderRadius: n(16), minHeight: n(64) },
  binomeDivider: { height: 1, marginHorizontal: n(16) },
  binomeIconWrap: { position: "relative" },
  binomeIcon: { width: n(42), height: n(42), borderRadius: n(13), alignItems: "center", justifyContent: "center" },
  binomeTexts: { flex: 1, minWidth: 0, paddingRight: n(4) },
  binomeTitle: { fontFamily: "Comfortaa_700Bold", fontSize: n(13), lineHeight: n(18), flexWrap: "wrap" },
  binomeSub: { fontFamily: "Comfortaa_400Regular", fontSize: n(11), lineHeight: n(16), marginTop: n(2), flexWrap: "wrap" },
  toggleTrack: { width: n(46), height: n(26), borderRadius: n(13), justifyContent: "center", paddingHorizontal: n(3), flexShrink: 0 },
  toggleThumb: { width: n(20), height: n(20), borderRadius: n(10), backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 4, elevation: 3 },
  inboxBadge: { position: "absolute", top: -n(4), right: -n(4), minWidth: n(18), height: n(18), borderRadius: n(9), backgroundColor: "#F97316", alignItems: "center", justifyContent: "center", paddingHorizontal: n(4), borderWidth: 1.5, borderColor: "#FFFFFF" },
  inboxBadgeText: { fontFamily: "Comfortaa_700Bold", fontSize: n(9), color: "#FFFFFF", includeFontPadding: false },

  // Grille
  grid: { gap: n(12) },
  gridRow: { flexDirection: "row", gap: n(12) },
  gridCell: { flex: 1, minHeight: n(108), borderRadius: n(18), overflow: "hidden", elevation: 0 },
  gridCellTouch: { flex: 1 },
  gridCellGradient: { flex: 1, borderRadius: n(18), padding: 1.2, overflow: "hidden" },
  gridCellInner: { flex: 1, borderRadius: n(17), paddingHorizontal: n(12), paddingVertical: n(12), justifyContent: "space-between", overflow: "hidden" },
  cellHighlight: { position: "absolute", top: 0, left: 0, right: 0, height: n(20) },
  cellTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cellIconBubble: { width: n(40), height: n(40), borderRadius: n(20), alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cellBadge: { position: "absolute", top: -n(4), right: -n(4), minWidth: n(16), height: n(16), borderRadius: n(8), backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: n(4), borderWidth: 1, borderColor: "#FFFFFF", overflow: "hidden" },
  cellBadgeText: { color: "#FFF", fontSize: n(9), fontFamily: "Comfortaa_700Bold", includeFontPadding: false },
  cellText: { fontFamily: "Comfortaa_700Bold", fontSize: n(12.5), marginTop: n(8), lineHeight: n(17) },
  bannerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 50, elevation: 50, backgroundColor: "transparent", paddingBottom: 6 },

  // Pioneer modal
  pioneerOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  pioneerWrap: { width: "100%", paddingHorizontal: n(16), alignItems: "center", justifyContent: "center", flex: 1 },
  pioneerCard: { width: "100%", maxWidth: 520, borderRadius: n(24), borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 12 },
  pioneerHaloTop: { position: "absolute", top: -SCREEN_WIDTH * 0.2, left: -SCREEN_WIDTH * 0.15, width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, borderRadius: SCREEN_WIDTH * 0.35 },
  pioneerHaloBottom: { position: "absolute", bottom: -SCREEN_WIDTH * 0.25, right: -SCREEN_WIDTH * 0.2, width: SCREEN_WIDTH * 0.85, height: SCREEN_WIDTH * 0.85, borderRadius: SCREEN_WIDTH * 0.425 },
  pioneerContent: { paddingTop: n(28), paddingHorizontal: n(18), paddingBottom: n(18), alignItems: "center" },
  pioneerHero: { alignItems: "center", marginBottom: n(10) },
  pioneerIconRing: { width: n(72), height: n(72), borderRadius: n(36), alignItems: "center", justifyContent: "center" },
  pioneerIconInner: { width: n(56), height: n(56), borderRadius: n(28), alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  pioneerPillRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: n(12), gap: n(8) },
  pioneerPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: n(10), paddingVertical: n(6), borderRadius: n(999), borderWidth: 1 },
  pioneerPillText: { fontFamily: "Comfortaa_700Bold", fontSize: n(12) },
  pioneerTitle: { fontFamily: "Comfortaa_700Bold", fontSize: n(22), textAlign: "center", marginTop: n(6) },
  pioneerDesc: { fontFamily: "Comfortaa_400Regular", fontSize: n(14), lineHeight: n(20), textAlign: "center", marginTop: n(10) },
  pioneerBold: { fontFamily: "Comfortaa_700Bold" },
  pioneerBullets: { width: "100%", marginTop: n(14), padding: n(12), borderRadius: n(16), backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pioneerBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: n(10), marginBottom: n(10) },
  pioneerBulletText: { flex: 1, fontFamily: "Comfortaa_400Regular", fontSize: n(13), lineHeight: n(18) },
  pioneerCtaWrap: { width: "100%", marginTop: n(14) },
  pioneerCta: { width: "100%", borderRadius: n(16), paddingVertical: n(12), paddingHorizontal: n(14), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: n(10), shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 10 },
  pioneerCtaText: { color: "#fff", fontFamily: "Comfortaa_700Bold", fontSize: n(14) },
  pioneerFoot: { marginTop: n(12), fontFamily: "Comfortaa_400Regular", fontSize: n(12), textAlign: "center" },
});
