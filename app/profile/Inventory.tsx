// app/profile/Inventory.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/constants/firebase-config";
import GlobalLayout from "../../components/GlobalLayout";
import CustomHeader from "@/components/CustomHeader";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import designSystem, { Theme as TTheme } from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import BannerSlot from "@/components/BannerSlot";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

type UserInventory = {
  streakPass?: number;
  // futurs items: superBoost, rerollToken, etc.
  [key: string]: any;
};

interface UserData {
  inventory?: UserInventory;
  trophies?: number;
  username?: string;
}

const InventoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const currentTheme: TTheme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   const insets = useSafeAreaInsets();

  // 🔒 Safe tabBarHeight: évite l'erreur "Couldn't find the bottom tab bar height"
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (_e) {
    tabBarHeight = 0; // fallback si l'écran n'est pas rendu dans un BottomTabNavigator
  }

  const { showBanners } = useAdsVisibility();
  const [adHeight, setAdHeight] = useState(0);


  const bottomPadding =
    (showBanners ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    normalize(40);

  // 🔥 Récupération live de l’inventaire utilisateur
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError(t("noUserConnected"));
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserData;
          setUserData(data ?? {});
          setError(null);
        } else {
          setError(t("profileNotFound"));
        }
        setLoading(false);
      },
      (err) => {
        console.error("[Inventory] onSnapshot error:", err);
        setError(t("profileLoadError"));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t]);

  // 🧮 Normalisation de l’inventaire
  const inventory: UserInventory = useMemo(() => {
    if (!userData?.inventory || typeof userData.inventory !== "object") {
      return {};
    }
    return userData.inventory;
  }, [userData]);

  // Nombre total d’objets (tous items numériques)
  const totalItems = useMemo(() => {
    return Object.values(inventory).reduce((sum, val) => {
      if (typeof val === "number" && isFinite(val)) {
        return sum + val;
      }
      return sum;
    }, 0);
  }, [inventory]);

  const streakPassCount =
    typeof inventory.streakPass === "number" ? inventory.streakPass : 0;

  const hasItems = totalItems > 0;

  if (loading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isDark ? "light-content" : "dark-content"}
          />
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.primary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("common.loading", "Chargement...")}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  if (error) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isDark ? "light-content" : "dark-content"}
          />
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={normalize(32)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.errorText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {error}
            </Text>
          </View>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
          currentTheme.colors.primary + "22",
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Orbes décoratives pour le côté premium */}
        <LinearGradient
          pointerEvents="none"
          colors={[currentTheme.colors.primary + "33", "transparent"]}
          style={styles.bgOrbTop}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[currentTheme.colors.secondary + "33", "transparent"]}
          style={styles.bgOrbBottom}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDark ? "light-content" : "dark-content"}
        />

        <CustomHeader
          title={t("inventory.title", "Inventaire")}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero / résumé */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: isDark
                  ? "rgba(10,10,18,0.95)"
                  : "rgba(255,255,255,0.97)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTitleRow}>
                <Ionicons
                  name="briefcase-outline"
                  size={normalize(22)}
                  color={currentTheme.colors.secondary}
                />
                <Text
                  style={[
                    styles.heroTitle,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("inventory.title", "Inventaire")}
                </Text>
              </View>

              {hasItems && (
                <View
                  style={[
                    styles.heroBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    },
                  ]}
                >
                  <Ionicons
                    name="sparkles"
                    size={normalize(14)}
                    color={currentTheme.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.heroBadgeText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {t("inventory.totalItems", {
                      defaultValue: "{{count}} objets",
                      count: totalItems,
                    })}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.heroSubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t(
                "inventory.subtitle",
                "Gère ici tes bonus spéciaux et protections de série."
              )}
            </Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatCard}>
                <Text
  style={[
    styles.statLabel,
    { color: currentTheme.colors.textSecondary },
  ]}
>
  {t("inventory.items.streakPass.title", "Streak Pass")}
</Text>
                <View style={styles.statValueRow}>
                  <Ionicons
                    name="shield-checkmark"
                    size={normalize(18)}
                    color="#FFD54F"
                  />
                  <Text style={styles.statValueText}>×{streakPassCount}</Text>
                </View>
              </View>

              <View style={styles.heroStatCard}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t("trophiesLabel", "Trophées")}
                </Text>
                <View style={styles.statValueRow}>
                  <Ionicons
                    name="trophy"
                    size={normalize(18)}
                    color={currentTheme.colors.trophy}
                  />
                  <Text style={styles.statValueText}>
                    {userData?.trophies ?? 0}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Liste détaillée des items */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("inventory.title", "Inventaire")}
            </Text>
           <Text
  style={[
    styles.sectionSubtitle,
    { color: currentTheme.colors.textSecondary },
  ]}
>
  {t(
    "inventory.sectionSubtitle",
    "Aperçois tous tes bonus spéciaux et protections de série."
  )}
</Text>

            {hasItems ? (
              <View style={styles.itemsList}>
                {/* Streak Pass */}
                {streakPassCount > 0 && (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconCircle,
                        { backgroundColor: "#FFD54F" },
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={normalize(20)}
                        color="#1A1A1A"
                      />
                    </View>

                    <View style={styles.itemTextZone}>
                      <View style={styles.itemTitleRow}>
                        <Text
                          style={[
                            styles.itemTitle,
                            { color: currentTheme.colors.textPrimary },
                          ]}
                        >
                          {t(
                            "inventory.items.streakPass.title",
                            "Streak Pass"
                          )}
                        </Text>
                        <View style={styles.itemCountBadge}>
                          <Text style={styles.itemCountText}>
                            ×{streakPassCount}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.itemSubtitle,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                        numberOfLines={3}
                      >
                        {t(
                          "inventory.items.streakPass.subtitle",
                          "Protège ta série une fois en cas de défi manqué."
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ⚠️ Futurs items
                    Quand tu rajouteras un nouveau bonus dans inventory
                    (ex: superBoost, rerollToken), tu pourras l'afficher ici.
                */}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="cloud-outline"
                  size={normalize(32)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                >
                  {t("inventory.emptyTitle", "Aucun bonus pour l’instant")}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {t(
                    "inventory.emptyText",
                    "Complète des défis et tourne la roue du jour pour remplir ton inventaire."
                  )}
                </Text>
              </View>
            )}
          </View>

          {/* Hint sur le comportement des Streak Pass */}
          <View
            style={[
              styles.helperBox,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.02)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={normalize(20)}
              color={currentTheme.colors.secondary}
              style={{ marginRight: normalize(8) }}
            />
            <Text
              style={[
                styles.helperText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t(
  "inventory.streakHint",
  "Tu peux utiliser tes Streak Pass dans l'écran d'un défi manqué pour sauver ta série."
)}

            </Text>
          </View>
        </ScrollView>

        {/* Bannière pub dockée */}
        {showBanners && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom,
              alignItems: "center",
              zIndex: 9999,
              backgroundColor: "transparent",
              paddingBottom: 6,
            }}
            pointerEvents="box-none"
          >
            <BannerSlot onHeight={(h) => setAdHeight(h)} />
          </View>
        )}
      </LinearGradient>
    </GlobalLayout>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: normalize(16),
    paddingTop: normalize(12),
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalize(8),
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
   writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  errorBox: {
    alignItems: "center",
    paddingHorizontal: normalize(24),
  },
  errorText: {
    marginTop: normalize(8),
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  heroCard: {
    borderRadius: normalize(22),
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(14),
    marginBottom: normalize(14),
    borderWidth: 1,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalize(6),
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: normalize(8),
  },
  heroTitle: {
    fontSize: normalize(18),
    fontFamily: "Comfortaa_700Bold",
     writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroSubtitle: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalize(10),
     writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    columnGap: normalize(4),
  },
  heroBadgeText: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
  heroStatsRow: {
    flexDirection: "row",
    columnGap: normalize(10),
  },
  heroStatCard: {
    flex: 1,
    borderRadius: normalize(14),
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(8),
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statLabel: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.85,
    marginBottom: normalize(2),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: normalize(6),
  },
  statValueText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFFFFF",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "left",
  },
  section: {
    marginTop: normalize(8),
    marginBottom: normalize(8),
  },
  sectionTitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(4),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  sectionSubtitle: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    marginBottom: normalize(8),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  itemsList: {
    marginTop: normalize(2),
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(10),
    borderRadius: normalize(16),
    borderWidth: 1,
    marginBottom: normalize(8),
  },
  itemIconCircle: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    alignItems: "center",
    justifyContent: "center",
    marginRight: normalize(10),
  },
  itemTextZone: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: normalize(2),
  },
  itemTitle: {
    flex: 1,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  itemCountBadge: {
    borderRadius: 999,
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(2),
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  itemCountText: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFD54F",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
  itemSubtitle: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: normalize(18),
  },
  emptyTitle: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalize(6),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
  emptyText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalize(4),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
  helperBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(10),
    borderRadius: normalize(16),
    marginTop: normalize(10),
    borderWidth: 1,
  },
  helperText: {
    flex: 1,
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
});

export default InventoryScreen;
